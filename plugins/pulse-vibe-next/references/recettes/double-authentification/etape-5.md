### 5. Les actions

`connecter` (version de la recette `email`) envoie le code quand better-auth le demande, puis mène à la page du code. Le cookie `two_factor` vient d'être posé dans la réponse : `enTetesDeSession()` le lit par `cookies()`. Si la recette `limite` est appliquée, gardez sa ligne `await exigerLimite("connexion");` en tête, et ajoutez celles des nouvelles actions (étape 7 de `limite`).

<!-- fichier: src/features/compte/actions/connecter.action.ts -->
```ts
// src/features/compte/actions/connecter.action.ts
"use server";

import { enTetesDeSession, getAuth } from "@src/adapters/auth/auth.adapter";
import { logger } from "@src/lib/logger";
import { actionPublique } from "@src/lib/safe-action";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { returnServerError } from "next-safe-action";
import { schemaConnexion } from "../schemas/compte.schema";

export const connecter = actionPublique
  .metadata({ nom: "connecter" })
  .inputSchema(schemaConnexion)
  .action(async ({ parsedInput, ctx }) => {
    let codeDemande = false;
    try {
      const resultat = await getAuth().api.signInEmail({
        body: {
          email: parsedInput.email,
          password: parsedInput.motDePasse,
          callbackURL: "/adresse-verifiee",
        },
        headers: await headers(),
      });
      // Double authentification active : pas encore de session, un code part par e-mail.
      if ("twoFactorRedirect" in resultat && resultat.twoFactorRedirect) {
        codeDemande = true;
        await getAuth().api.sendTwoFactorOTP({
          headers: await enTetesDeSession(),
        });
      }
    } catch (erreur) {
      if (erreur instanceof APIError && erreur.status === "UNAUTHORIZED") {
        // Sans l'adresse ni le mot de passe : le motif et l'identifiant de la requête.
        logger.warn(
          { motif: "identifiants-incorrects", requete: ctx.requete },
          "Connexion refusée",
        );
        returnServerError("Adresse e-mail ou mot de passe incorrect.");
      }
      if (
        erreur instanceof APIError &&
        erreur.body?.code === "EMAIL_NOT_VERIFIED"
      ) {
        logger.warn(
          { motif: "adresse-non-confirmee", requete: ctx.requete },
          "Connexion refusée",
        );
        returnServerError(
          "Adresse pas encore confirmée : un nouvel e-mail vient de partir.",
        );
      }
      throw erreur;
    }
    redirect(codeDemande ? "/connexion/code" : "/compte");
  });
```

Le code saisi : la session s'ouvre s'il est bon. Un code faux est journalisé comme une connexion refusée.

<!-- fichier: src/features/compte/actions/verifier-code.action.ts -->
```ts
// src/features/compte/actions/verifier-code.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { logger } from "@src/lib/logger";
import { actionPublique } from "@src/lib/safe-action";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { returnServerError } from "next-safe-action";
import { schemaCodeConnexion } from "../schemas/compte.schema";

// Erreurs attendues de better-auth → message affiché sous le formulaire.
const MESSAGES: Record<string, string> = {
  INVALID_CODE: "Code incorrect. Vérifiez les 6 chiffres reçus par e-mail.",
  OTP_HAS_EXPIRED: "Ce code a expiré. Demandez un nouveau code.",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE:
    "Trop d'essais. Demandez un nouveau code.",
  INVALID_TWO_FACTOR_COOKIE:
    "Le temps de connexion est dépassé. Reprenez depuis la page de connexion.",
};

export const verifierCode = actionPublique
  .metadata({ nom: "verifierCode" })
  .inputSchema(schemaCodeConnexion)
  .action(async ({ parsedInput, ctx }) => {
    try {
      await getAuth().api.verifyTwoFactorOTP({
        body: { code: parsedInput.code },
        headers: await headers(),
      });
    } catch (erreur) {
      const raison = erreur instanceof APIError ? erreur.body?.code : undefined;
      const message = raison ? MESSAGES[raison] : undefined;
      if (message) {
        logger.warn(
          { motif: "code-refuse", raison, requete: ctx.requete },
          "Connexion refusée",
        );
        returnServerError(message);
      }
      throw erreur;
    }
    redirect("/compte");
  });
```

<!-- fichier: src/features/compte/actions/renvoyer-code.action.ts -->
```ts
// src/features/compte/actions/renvoyer-code.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { actionPublique } from "@src/lib/safe-action";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";

export const renvoyerCode = actionPublique
  .metadata({ nom: "renvoyerCode" })
  .action(async () => {
    try {
      await getAuth().api.sendTwoFactorOTP({ headers: await headers() });
    } catch (erreur) {
      if (
        erreur instanceof APIError &&
        erreur.body?.code === "INVALID_TWO_FACTOR_COOKIE"
      ) {
        returnServerError(
          "Le temps de connexion est dépassé. Reprenez depuis la page de connexion.",
        );
      }
      throw erreur;
    }
    return { message: "Un nouveau code vient de partir." };
  });
```

Activer et désactiver, depuis « Mon compte » : le mot de passe est demandé dans les deux cas.

<!-- fichier: src/features/compte/actions/activer-double-authentification.action.ts -->
```ts
// src/features/compte/actions/activer-double-authentification.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { actionConnectee } from "@src/lib/safe-action";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";
import { schemaReglageDoubleAuthentification } from "../schemas/compte.schema";

export const activerDoubleAuthentification = actionConnectee
  .metadata({ nom: "activerDoubleAuthentification" })
  .inputSchema(schemaReglageDoubleAuthentification)
  .action(async ({ parsedInput }) => {
    try {
      // method « otp » : le code arrive par e-mail, sans application à installer.
      await getAuth().api.enableTwoFactor({
        body: { password: parsedInput.motDePasse, method: "otp" },
        headers: await headers(),
      });
    } catch (erreur) {
      if (
        erreur instanceof APIError &&
        erreur.body?.code === "INVALID_PASSWORD"
      ) {
        returnServerError("Mot de passe incorrect.");
      }
      throw erreur;
    }
    return {
      message:
        "Double authentification activée : un code vous sera demandé à chaque connexion.",
    };
  });
```

<!-- fichier: src/features/compte/actions/desactiver-double-authentification.action.ts -->
```ts
// src/features/compte/actions/desactiver-double-authentification.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { actionConnectee } from "@src/lib/safe-action";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";
import { schemaReglageDoubleAuthentification } from "../schemas/compte.schema";

export const desactiverDoubleAuthentification = actionConnectee
  .metadata({ nom: "desactiverDoubleAuthentification" })
  .inputSchema(schemaReglageDoubleAuthentification)
  .action(async ({ parsedInput }) => {
    try {
      await getAuth().api.disableTwoFactor({
        body: { password: parsedInput.motDePasse },
        headers: await headers(),
      });
    } catch (erreur) {
      if (
        erreur instanceof APIError &&
        erreur.body?.code === "INVALID_PASSWORD"
      ) {
        returnServerError("Mot de passe incorrect.");
      }
      throw erreur;
    }
    return { message: "Double authentification désactivée." };
  });
```

Activer ou désactiver remplace la session en cours (better-auth) : la page « Mon compte » se réaffiche avec le nouvel état, lu par `enTetesDeSession()`.

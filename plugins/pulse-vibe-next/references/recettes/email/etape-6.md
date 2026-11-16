### 6. Les actions

Une action par fichier. `inscrire` renvoie un message au lieu de rediriger, et passe `callbackURL` ; `connecter` traduit `EMAIL_NOT_VERIFIED` ; deux actions nouvelles. Les liens de confirmation ramènent sur `/adresse-verifiee` (étape 9). Si la recette `limite` est déjà appliquée, gardez ses lignes `await exigerLimite(…)` en tête de `inscrire` et `connecter`, et ajoutez celles des nouvelles actions (tableau de l'étape 7 de `limite`).

<!-- fichier: src/features/compte/actions/inscrire.action.ts -->
```ts
// src/features/compte/actions/inscrire.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { MOT_DE_PASSE_COMPROMIS } from "@src/adapters/auth/mot-de-passe-compromis";
import { actionPublique } from "@src/lib/safe-action";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";
import { MESSAGE_MOT_DE_PASSE_COMPROMIS } from "../constants/messages";
import { schemaInscription } from "../schemas/compte.schema";

// Même réponse que l'adresse soit libre ou déjà prise : personne ne peut tester les comptes.
export const inscrire = actionPublique
  .metadata({ nom: "inscrire" })
  .inputSchema(schemaInscription)
  .action(async ({ parsedInput }) => {
    try {
      await getAuth().api.signUpEmail({
        body: {
          name: parsedInput.nom,
          email: parsedInput.email,
          password: parsedInput.motDePasse,
          callbackURL: "/adresse-verifiee",
        },
        headers: await headers(),
      });
    } catch (erreur) {
      if (
        erreur instanceof APIError &&
        erreur.body?.code === MOT_DE_PASSE_COMPROMIS
      ) {
        returnServerError(MESSAGE_MOT_DE_PASSE_COMPROMIS);
      }
      throw erreur;
    }
    return {
      message:
        "Compte créé. Ouvrez l'e-mail que nous venons d'envoyer pour confirmer votre adresse.",
    };
  });
```

<!-- fichier: src/features/compte/actions/connecter.action.ts -->
```ts
// src/features/compte/actions/connecter.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
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
    try {
      await getAuth().api.signInEmail({
        body: {
          email: parsedInput.email,
          password: parsedInput.motDePasse,
          callbackURL: "/adresse-verifiee",
        },
        headers: await headers(),
      });
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
    redirect("/compte");
  });
```

<!-- fichier: src/features/compte/actions/demander-nouveau-mot-de-passe.action.ts -->
```ts
// src/features/compte/actions/demander-nouveau-mot-de-passe.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { actionPublique } from "@src/lib/safe-action";
import { headers } from "next/headers";
import { schemaMotDePasseOublie } from "../schemas/compte.schema";

// Même réponse que l'adresse existe ou non : personne ne peut tester les comptes.
export const demanderNouveauMotDePasse = actionPublique
  .metadata({ nom: "demanderNouveauMotDePasse" })
  .inputSchema(schemaMotDePasseOublie)
  .action(async ({ parsedInput }) => {
    await getAuth().api.requestPasswordReset({
      body: { email: parsedInput.email, redirectTo: "/nouveau-mot-de-passe" },
      headers: await headers(),
    });
    return {
      message:
        "Si un compte existe pour cette adresse, un e-mail vient de partir. Pensez à regarder vos indésirables.",
    };
  });
```

<!-- fichier: src/features/compte/actions/choisir-nouveau-mot-de-passe.action.ts -->
```ts
// src/features/compte/actions/choisir-nouveau-mot-de-passe.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { MOT_DE_PASSE_COMPROMIS } from "@src/adapters/auth/mot-de-passe-compromis";
import { actionPublique } from "@src/lib/safe-action";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";
import { MESSAGE_MOT_DE_PASSE_COMPROMIS } from "../constants/messages";
import { schemaChoixMotDePasse } from "../schemas/compte.schema";

export const choisirNouveauMotDePasse = actionPublique
  .metadata({ nom: "choisirNouveauMotDePasse" })
  .inputSchema(schemaChoixMotDePasse)
  .action(async ({ parsedInput }) => {
    try {
      await getAuth().api.resetPassword({
        body: {
          token: parsedInput.token,
          newPassword: parsedInput.nouveauMotDePasse,
        },
        headers: await headers(),
      });
    } catch (erreur) {
      if (erreur instanceof APIError && erreur.body?.code === "INVALID_TOKEN") {
        returnServerError(
          "Ce lien n'est plus valable. Demandez un nouveau lien depuis « Mot de passe oublié ».",
        );
      }
      if (
        erreur instanceof APIError &&
        erreur.body?.code === MOT_DE_PASSE_COMPROMIS
      ) {
        returnServerError(MESSAGE_MOT_DE_PASSE_COMPROMIS);
      }
      throw erreur;
    }
    return { message: "Mot de passe modifié. Connectez-vous." };
  });
```

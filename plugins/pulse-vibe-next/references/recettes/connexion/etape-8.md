### 8. Les actions

Une action par fichier. better-auth porte les règles du compte (mots de passe, sessions) : rien à placer dans `src/core/`, donc pas de `Result` ni de `erreur-messages.ts`. Chaque action traduit elle-même l'erreur attendue de better-auth en message, avec `returnServerError("…")`. Le message d'un mot de passe compromis sert à trois actions (inscription, changement, et nouveau mot de passe avec la recette `email`) : il vit dans les constantes de la feature.

<!-- fichier: src/features/compte/constants/messages.ts -->
```ts
// src/features/compte/constants/messages.ts
export const MESSAGE_MOT_DE_PASSE_COMPROMIS =
  "Ce mot de passe circule sur Internet après une fuite de données. Choisissez-en un autre.";
```

<!-- fichier: src/features/compte/actions/inscrire.action.ts -->
```ts
// src/features/compte/actions/inscrire.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { MOT_DE_PASSE_COMPROMIS } from "@src/adapters/auth/mot-de-passe-compromis";
import { actionPublique } from "@src/lib/safe-action";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { returnServerError } from "next-safe-action";
import { MESSAGE_MOT_DE_PASSE_COMPROMIS } from "../constants/messages";
import { schemaInscription } from "../schemas/compte.schema";

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
      if (
        erreur instanceof APIError &&
        erreur.body?.code?.startsWith("USER_ALREADY_EXISTS")
      ) {
        returnServerError(
          "Un compte existe déjà avec cette adresse. Connectez-vous.",
        );
      }
      throw erreur;
    }
    redirect("/compte");
  });
```

La connexion refusée est journalisée avec son motif et l'identifiant de la requête (le même que dans les journaux de l'hébergeur) : ni l'adresse, ni le mot de passe.

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
        body: { email: parsedInput.email, password: parsedInput.motDePasse },
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
      throw erreur;
    }
    redirect("/compte");
  });
```

<!-- fichier: src/features/compte/actions/changer-mot-de-passe.action.ts -->
```ts
// src/features/compte/actions/changer-mot-de-passe.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { MOT_DE_PASSE_COMPROMIS } from "@src/adapters/auth/mot-de-passe-compromis";
import { actionConnectee } from "@src/lib/safe-action";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";
import { MESSAGE_MOT_DE_PASSE_COMPROMIS } from "../constants/messages";
import { schemaChangementMotDePasse } from "../schemas/compte.schema";

export const changerMotDePasse = actionConnectee
  .metadata({ nom: "changerMotDePasse" })
  .inputSchema(schemaChangementMotDePasse)
  .action(async ({ parsedInput }) => {
    try {
      await getAuth().api.changePassword({
        body: {
          currentPassword: parsedInput.motDePasseActuel,
          newPassword: parsedInput.nouveauMotDePasse,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch (erreur) {
      if (
        erreur instanceof APIError &&
        erreur.body?.code === "INVALID_PASSWORD"
      ) {
        returnServerError("Mot de passe actuel incorrect.");
      }
      if (
        erreur instanceof APIError &&
        erreur.body?.code === MOT_DE_PASSE_COMPROMIS
      ) {
        returnServerError(MESSAGE_MOT_DE_PASSE_COMPROMIS);
      }
      throw erreur;
    }
    return { message: "Mot de passe modifié." };
  });
```

<!-- fichier: src/features/compte/actions/deconnecter.action.ts -->
```ts
// src/features/compte/actions/deconnecter.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { actionConnectee } from "@src/lib/safe-action";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const deconnecter = actionConnectee
  .metadata({ nom: "deconnecter" })
  .action(async () => {
    await getAuth().api.signOut({ headers: await headers() });
    redirect("/connexion");
  });
```

Codes vérifiés avec better-auth 1.7.25 : adresse déjà prise → `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` (422) ; mauvais mot de passe à la connexion → `UNAUTHORIZED` / `INVALID_EMAIL_OR_PASSWORD` ; mauvais mot de passe actuel → `INVALID_PASSWORD` (400) ; mot de passe compromis → `PASSWORD_COMPROMISED` (400, levé par `refuserMotDePasseCompromis`). `revokeOtherSessions: true` déconnecte les autres appareils et remplace la session en cours par une nouvelle.

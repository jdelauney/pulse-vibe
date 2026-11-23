### 5. Envoyer depuis une fonctionnalité

Une fonctionnalité reçoit un `EnvoyeurEmail` et ne connaît ni Nodemailer ni `env`. Une action qui assemble ses objets passe `getEnvoyeurEmail()` à son use-case ; un use-case testé reçoit une doublure. Le contenu (sujet, texte, HTML) se compose dans `src/core/<domaine>/` (comme `EmailsCompte` de la recette `email`), et chaque valeur saisie par quelqu'un et insérée dans le HTML y est échappée. Quand la réponse à l'écran ne doit pas attendre le serveur d'e-mail, l'envoi part après elle avec `after()` de Next.js :

<!-- sans-verification: exemple d'usage ; la fonctionnalité, son schéma et son contenu appartiennent au projet -->
```ts
// src/features/contact/actions/envoyer-message.action.ts
"use server";

import { getEnvoyeurEmail } from "@src/adapters/email/email.adapter";
import { MessagesContact } from "@src/core/contact/messages-contact.rules";
import { actionPublique } from "@src/lib/safe-action";
import { after } from "next/server";
import { schemaMessage } from "../schemas/contact.schema";

export const envoyerMessageAction = actionPublique
  .metadata({ nom: "envoyerMessage" })
  .inputSchema(schemaMessage)
  .action(async ({ parsedInput }) => {
    const contenu = new MessagesContact().notification(parsedInput);
    // L'e-mail part après la réponse ; un échec est journalisé par Next.js.
    after(() =>
      getEnvoyeurEmail().envoyer({
        a: "contact@exemple.fr",
        repondreA: parsedInput.email,
        ...contenu,
      }),
    );
    return { ok: true };
  });
```

Pour un envoi qui doit réussir avant de répondre (la personne attend la confirmation), `await getEnvoyeurEmail().envoyer(…)` dans l'action : une panne du serveur devient une `ErreurService`, journalisée par `safe-action`, et l'écran affiche le message générique.


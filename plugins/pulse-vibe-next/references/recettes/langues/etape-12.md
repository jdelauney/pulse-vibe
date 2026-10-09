### 12. Traduire les messages d'une action

`next/root-params` ne fonctionne pas dans une Server Action. Le formulaire envoie la langue (`useLocale()` de `next-intl`), et l'action la passe à `getTranslations`. Exemple, avec les clés `Contact.merci` et `Contact.liensRefuses` ajoutées aux deux fichiers de messages :

```json
  "Contact": {
    "merci": "Merci, votre message est envoyé.",
    "liensRefuses": "Les liens ne sont pas acceptés dans le message."
  }
```

```json
  "Contact": {
    "merci": "Thank you, your message is sent.",
    "liensRefuses": "Links are not accepted in the message."
  }
```

Le schéma accepte seulement les langues déclarées. Ces messages traduits sont l'exception à la règle « message des erreurs attendues dans `constants/erreur-messages.ts` » : ils dépendent de la langue.

```ts
// src/features/contact/schemas/contact.schema.ts
import { routing } from "@src/config/i18n";
import { z } from "zod";

export const schemaMessage = z.object({
  langue: z.enum(routing.locales),
  message: z.string().trim().min(1).max(2000),
});
```

```ts
// src/features/contact/actions/envoyer-message.action.ts
"use server";

import { actionPublique } from "@src/lib/safe-action";
import { getTranslations } from "next-intl/server";
import { returnServerError } from "next-safe-action";
import { schemaMessage } from "../schemas/contact.schema";

export const envoyerMessage = actionPublique
  .metadata({ nom: "envoyerMessage" })
  .inputSchema(schemaMessage)
  .action(async ({ parsedInput }) => {
    // next/root-params est indisponible dans une action : la langue arrive avec les valeurs.
    const t = await getTranslations({
      locale: parsedInput.langue,
      namespace: "Contact",
    });
    if (parsedInput.message.includes("http")) {
      returnServerError(t("liensRefuses"));
    }
    return { message: t("merci") };
  });
```


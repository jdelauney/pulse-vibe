### 1. Le routage

Avec `localePrefix: "as-needed"`, les adresses françaises restent celles d'avant (liens des e-mails, retour de Stripe, favoris) ; l'anglais reçoit le préfixe `/en`. Cette configuration est lue au démarrage : elle vit dans `src/config/`.

<!-- fichier: src/config/i18n.ts -->
```ts
// src/config/i18n.ts
import { defineRouting } from "next-intl/routing";

// Langues du site, lues au démarrage par le proxy, la navigation et les pages.
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  // Le français garde ses adresses sans préfixe (/compte) ; l'anglais a le sien (/en/compte).
  localePrefix: "as-needed",
});

export type Langue = (typeof routing.locales)[number];
```


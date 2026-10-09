### 2. La langue de chaque requête

La langue se lit dans le segment `[locale]` avec `next/root-params`, sans en-tête de requête : les pages restent prérendues avec Cache Components. `setRequestLocale` devient inutile (next-intl le présente comme une API ancienne).

```ts
// src/lib/i18n/request.ts
import { routing } from "@src/config/i18n";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => {
  // La langue vient du segment [locale] de l'adresse, lue sans en-tête : les pages restent prérendables.
  if (!locale) {
    const valeur = await rootParams.locale();
    if (hasLocale(routing.locales, valeur)) {
      locale = valeur;
    } else {
      notFound();
    }
  }
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```


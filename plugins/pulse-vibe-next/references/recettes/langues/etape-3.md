### 3. Les liens et redirections qui gardent la langue

```ts
// src/lib/i18n/navigation.ts
import { routing } from "@src/config/i18n";
import { createNavigation } from "next-intl/navigation";

// À utiliser à la place de next/link et next/navigation : la langue courante est ajoutée d'office.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

```ts
// src/lib/i18n/chemins.ts
import { type Langue, routing } from "@src/config/i18n";

// "/en/compte" → { langue: "en", chemin: "/compte" } ; "/compte" → { langue: "fr", chemin: "/compte" }.
export function separerLangue(pathname: string): {
  langue: Langue;
  chemin: string;
} {
  const [, premier, ...reste] = pathname.split("/");
  const langue = routing.locales.find((l) => l === premier);
  if (langue) {
    return { langue, chemin: `/${reste.join("/")}` };
  }
  return { langue: routing.defaultLocale, chemin: pathname };
}

export function cheminDansLaLangue(langue: Langue, chemin: string): string {
  if (langue === routing.defaultLocale) return chemin;
  // L'accueil anglais est « /en », sans barre finale.
  return chemin === "/" ? `/${langue}` : `/${langue}${chemin}`;
}
```


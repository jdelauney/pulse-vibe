### 5. Les versions de langue pour Google

Chaque page déclare sa propre adresse et celles de ses traductions, elle-même comprise, plus `x-default` (la version française) : Google ignore des liens qui ne sont pas réciproques.

<!-- fichier: src/lib/i18n/referencement.ts -->
```ts
// src/lib/i18n/referencement.ts
import { routing } from "@src/config/i18n";
import { hasLocale } from "next-intl";
import { cheminDansLaLangue } from "./chemins";

/** Adresse officielle (canonique) d'une page dans la langue de la requête. `locale` vient de `params` ; une langue inconnue prend la langue par défaut (le layout répond déjà 404). */
export function adresseDansLaLangue(locale: string, chemin: string): string {
  const langue = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;
  return cheminDansLaLangue(langue, chemin);
}

/** Toutes les versions de langue d'une page, elle-même comprise, plus `x-default` (la langue par défaut). */
export function versionsDeLangue(chemin: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = cheminDansLaLangue(l, chemin);
  languages["x-default"] = cheminDansLaLangue(routing.defaultLocale, chemin);
  return languages;
}
```

L'accueil du squelette devient la page d'exemple : ses métadonnées dépendent de la langue de l'adresse, donc `generateMetadata` remplace `metadata` et l'`alternates` de `metadonneesDePage()`. Chaque autre page publique suit le même modèle, avec son propre chemin (`"/tarifs"`).

<!-- fichier: app/[locale]/page.tsx -->
```tsx
// app/[locale]/page.tsx
import { JsonLd } from "@src/components/shared/elements/json-ld";
import { projet } from "@src/config/projet";
import { adresseDuSite } from "@src/config/site";
import {
  adresseDansLaLangue,
  versionsDeLangue,
} from "@src/lib/i18n/referencement";
import { siteWeb } from "@src/lib/seo/donnees-structurees";
import { metadonneesDePage } from "@src/lib/seo/seo";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...metadonneesDePage({
      titre: projet.nom,
      description: projet.description,
      chemin: "/",
      accueil: true,
    }),
    alternates: {
      canonical: adresseDansLaLangue(locale, "/"),
      languages: versionsDeLangue("/"),
    },
  };
}

export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <JsonLd
        donnees={siteWeb({ nom: projet.nom, adresse: adresseDuSite() })}
      />
      <h1 className="font-heading text-4xl font-semibold tracking-tight">
        {projet.nom}
      </h1>
      <p className="text-lg text-muted-foreground">{projet.description}</p>
    </main>
  );
}
```

Dans `app/sitemap.ts`, chaque page donne une entrée par langue, et chaque entrée porte les adresses complètes de toutes les versions (construites avec `adresseDuSite()`).

<!-- fichier: app/sitemap.ts -->
```ts
// app/sitemap.ts
import { type Langue, routing } from "@src/config/i18n";
import { adresseDuSite } from "@src/config/site";
import { cheminDansLaLangue } from "@src/lib/i18n/chemins";
import type { MetadataRoute } from "next";

// Les pages publiques, chacune par son adresse officielle. Ajouter ici chaque nouvelle page publique ;
// des contenus publiés en base se lisent avec une fonction "use cache" (recette seo).
// misAJourLe : seulement une vraie date de modification du contenu, jamais la date du jour.
// Google ignore priority et changeFrequency : inutile de les remplir.
const PAGES_PUBLIQUES: { chemin: string; misAJourLe?: Date }[] = [
  { chemin: "/" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const adresse = adresseDuSite();
  // Adresse complète d'une page dans une langue (l'accueil français est l'adresse du site seule).
  const adresseDans = (langue: Langue, chemin: string) => {
    const dansLaLangue = cheminDansLaLangue(langue, chemin);
    return dansLaLangue === "/" ? adresse : `${adresse}${dansLaLangue}`;
  };
  // Une entrée par page et par langue, chacune avec toutes les versions (elle-même comprise).
  return PAGES_PUBLIQUES.flatMap(({ chemin, misAJourLe }) =>
    routing.locales.map((langue) => ({
      url: adresseDans(langue, chemin),
      ...(misAJourLe ? { lastModified: misAJourLe } : {}),
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, adresseDans(l, chemin)]),
        ),
      },
    })),
  );
}
```


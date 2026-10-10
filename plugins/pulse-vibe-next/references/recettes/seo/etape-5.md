### 5. Une page de détail publique (`[slug]`)

Adresse lisible par un `slug` (« /realisations/table-en-chene »), lecture partagée en `"use cache"`, `generateStaticParams` (au moins une valeur : exigence de Cache Components), `notFound()` au premier niveau, **avant** tout `<Suspense>`, sans `loading.tsx` dans ce segment. Le contenu se lit en base : domaine `realisations` dans `core/`, `db/` et `features/`.

Le type et la table (les contenus non publiés restent hors du public) :

<!-- fichier: src/core/realisations/realisation.entity.ts -->
```ts
// src/core/realisations/realisation.entity.ts
export type Realisation = {
  slug: string;
  titre: string;
  resume: string;
  /** Date de la dernière modification du contenu : elle alimente le sitemap. */
  misAJourLe: Date;
};
```

<!-- fichier: src/db/realisations/realisation.table.ts -->
```ts
// src/db/realisations/realisation.table.ts
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const realisations = pgTable("realisations", {
  id: uuid().primaryKey().defaultRandom(),
  // unique() crée l'index qui rend la vérification d'existence du proxy légère.
  slug: text().notNull().unique(),
  titre: text().notNull(),
  resume: text().notNull(),
  publiee: boolean().notNull().default(false),
  misAJourLe: timestamp("mis_a_jour_le", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

<!-- commande: npm run db:generate -->

Puis `npm run db:generate` (migration dans `drizzle/`) et `npm run db:migrate`.

Le repository porte la condition « publiée » dans chaque requête ; `existePubliee` ne lit qu'une colonne indexée (elle sert au proxy de l'étape 6) :

<!-- fichier: src/db/realisations/realisation.repository.ts -->
```ts
// src/db/realisations/realisation.repository.ts
import "server-only";
import type { Realisation } from "@src/core/realisations/realisation.entity";
import type { Db } from "@src/db/db-client";
import { and, desc, eq } from "drizzle-orm";
import { realisations } from "./realisation.table";

const colonnes = {
  slug: realisations.slug,
  titre: realisations.titre,
  resume: realisations.resume,
  misAJourLe: realisations.misAJourLe,
};

export function realisationRepository(db: Db) {
  const publiee = (slug: string) =>
    and(eq(realisations.slug, slug), eq(realisations.publiee, true));
  return {
    /** Une réalisation publiée, ou null : un brouillon reste invisible. */
    async trouverPubliee(slug: string): Promise<Realisation | null> {
      const [ligne] = await db
        .select(colonnes)
        .from(realisations)
        .where(publiee(slug));
      return ligne ?? null;
    },
    /** Requête légère pour le proxy : une seule colonne indexée, jamais le contenu. */
    async existePubliee(slug: string): Promise<boolean> {
      const lignes = await db
        .select({ slug: realisations.slug })
        .from(realisations)
        .where(publiee(slug))
        .limit(1);
      return lignes.length > 0;
    },
    async listerPubliees(): Promise<Realisation[]> {
      return db
        .select(colonnes)
        .from(realisations)
        .where(eq(realisations.publiee, true))
        .orderBy(desc(realisations.misAJourLe));
    },
  };
}
```

Les lectures commencent par `"use cache"` avec `cacheLife("hours")` et `cacheTag("realisations")` (fiche, règle 5). Elles renvoient `null` quand le contenu manque : le `notFound()` reste dans le container, hors du cache.

<!-- fichier: src/features/realisations/constants/cache-tags.ts -->
```ts
// src/features/realisations/constants/cache-tags.ts
export const TAG_REALISATIONS = "realisations";
```

<!-- fichier: src/features/realisations/queries/lire-realisation.query.ts -->
```ts
// src/features/realisations/queries/lire-realisation.query.ts
import "server-only";
import { getDb } from "@src/db/db-client";
import { realisationRepository } from "@src/db/realisations/realisation.repository";
import { cacheLife, cacheTag } from "next/cache";
import { TAG_REALISATIONS } from "../constants/cache-tags";

/** Une réalisation publiée, ou null. La page décide du 404 (notFound) : il reste hors du cache. */
export async function lireRealisation(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG_REALISATIONS);
  return realisationRepository(getDb()).trouverPubliee(slug);
}
```

<!-- fichier: src/features/realisations/queries/lister-realisations.query.ts -->
```ts
// src/features/realisations/queries/lister-realisations.query.ts
import "server-only";
import { getDb } from "@src/db/db-client";
import { realisationRepository } from "@src/db/realisations/realisation.repository";
import { cacheLife, cacheTag } from "next/cache";
import { TAG_REALISATIONS } from "../constants/cache-tags";

/** Les réalisations publiées, avec leur vraie date de mise à jour : pages générées et sitemap. */
export async function listerRealisations() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG_REALISATIONS);
  return realisationRepository(getDb()).listerPubliees();
}
```

L'affichage (section) et la lecture (container) :

<!-- fichier: src/features/realisations/components/sections/detail-realisation.tsx -->
```tsx
// src/features/realisations/components/sections/detail-realisation.tsx
export function DetailRealisation({
  titre,
  resume,
}: {
  titre: string;
  resume: string;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-3xl font-semibold">{titre}</h1>
      <p>{resume}</p>
    </main>
  );
}
```

<!-- fichier: src/features/realisations/components/containers/detail-realisation.container.tsx -->
```tsx
// src/features/realisations/components/containers/detail-realisation.container.tsx
import { notFound } from "next/navigation";
import { lireRealisation } from "../../queries/lire-realisation.query";
import { DetailRealisation } from "../sections/detail-realisation";

export async function DetailRealisationContainer({ slug }: { slug: string }) {
  const realisation = await lireRealisation(slug);
  if (!realisation) notFound();
  return (
    <DetailRealisation titre={realisation.titre} resume={realisation.resume} />
  );
}
```

La page ne met aucun `<Suspense>` autour du container : `notFound()` s'exécute au premier niveau. `generateMetadata` lit la même réalisation (le cache évite une seconde lecture) :

<!-- sans-verification: lit la base pendant la construction (generateStaticParams) ; essayée à la main sur une version construite avec une base, voir « Sources » -->
```tsx
// app/(public)/realisations/[slug]/page.tsx
import { DetailRealisationContainer } from "@src/features/realisations/components/containers/detail-realisation.container";
import { lireRealisation } from "@src/features/realisations/queries/lire-realisation.query";
import { listerRealisations } from "@src/features/realisations/queries/lister-realisations.query";
import { metadonneesDePage } from "@src/lib/seo/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  return (await listerRealisations()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/realisations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const realisation = await lireRealisation(slug);
  if (!realisation) notFound();
  return metadonneesDePage({
    titre: realisation.titre,
    description: realisation.resume,
    chemin: `/realisations/${realisation.slug}`,
  });
}

export default async function Realisation({
  params,
}: PageProps<"/realisations/[slug]">) {
  const { slug } = await params;
  return <DetailRealisationContainer slug={slug} />;
}
```

Le sitemap ajoute ces adresses avec leur vraie date (`misAJourLe` = colonne de mise à jour) : `sitemap()` devient asynchrone et appelle la lecture en `"use cache"`.

<!-- sans-verification: plan du site prérendu, lit la base pendant la construction ; essayé à la main sur une version construite avec une base, voir « Sources » -->
```ts
// app/sitemap.ts
import { adresseDuSite } from "@src/config/site";
import { listerRealisations } from "@src/features/realisations/queries/lister-realisations.query";
import type { MetadataRoute } from "next";

// Les pages publiques, chacune par son adresse officielle. Ajouter ici chaque nouvelle page publique ;
// les contenus publiés en base s'ajoutent avec leur vraie date, par une lecture en "use cache".
// misAJourLe : seulement une vraie date de modification du contenu, jamais la date du jour.
// Google ignore priority et changeFrequency : inutile de les remplir.
const PAGES_PUBLIQUES: { chemin: string; misAJourLe?: Date }[] = [
  { chemin: "/" },
  { chemin: "/tarifs" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const adresse = adresseDuSite();
  const realisations = await listerRealisations();
  const pages = [
    ...PAGES_PUBLIQUES,
    ...realisations.map(({ slug, misAJourLe }) => ({
      chemin: `/realisations/${slug}`,
      misAJourLe,
    })),
  ];
  return pages.map(({ chemin, misAJourLe }) => ({
    url: chemin === "/" ? adresse : `${adresse}${chemin}`,
    ...(misAJourLe ? { lastModified: misAJourLe } : {}),
  }));
}
```

Une action qui publie ou modifie une réalisation appelle `updateTag(TAG_REALISATIONS)` (de `next/cache`) après l'écriture.


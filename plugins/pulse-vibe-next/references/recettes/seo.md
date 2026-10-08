# Recette : seo

> Quand l'utiliser : le site a des pages publiques qui doivent être trouvées sur Google et par les assistants IA (adresse officielle, titres, sitemap, robots, carte de partage, données structurées, vraie page 404).

## Prérequis

- Squelette du pack, version qui contient `src/config/site.ts` et `src/lib/seo/seo.ts`. Projet créé avec une version plus ancienne : relancer `pulse-aidd pile squelette --nom "<nom du projet>"` à la racine : il ajoute les fichiers manquants et garde les fichiers présents (les étapes 1 et 2 indiquent ce qui change dans `app/layout.tsx` et `app/page.tsx`).
- Paquet de développement `schema-dts` (types schema.org, publiés par Google) : déjà dans le squelette ; sinon `npm install -D schema-dts` (dernière version ; recette vérifiée avec 2.1.0). Il sert seulement aux types (`import type`) : rien n'est ajouté au site.
- Les textes des pages (titres, descriptions) sont validés dans `docs/seo.md` (`/pulse:seo textes`). En attendant, le nom et la description du projet servent.
- Étapes 5 et 6 (page de détail lue en base) : `src/db/index.ts` (`getDb()`, type `Db`), `drizzle.config.ts` (il lit `src/db/*/*.table.ts`) et `tests/helpers/base-de-test.ts` du squelette ; une base Neon dont la variable `DATABASE_URL` est renseignée **au moment de la construction**, avec les migrations appliquées (`npm run db:migrate`) : `generateStaticParams` et le sitemap lisent la base pendant `npm run build`.
- Étape 4 : la recette `connexion` est faite (groupe `app/(connecte)/` et `proxy.ts` à la racine).

## Variables d'environnement

| Nom | Où | Valeur |
|---|---|---|
| `SITE_URL` | Vercel, **Production** seulement (et `.env` si besoin) | L'adresse officielle, sans barre finale : `https://www.mon-site.fr`. Sans elle : le domaine de production fourni par Vercel, sinon `http://localhost:3000` |

Valeur non secrète. Elle est lue pendant la construction : après l'avoir changée, redéployer.

## Fichiers créés ou modifiés

Le squelette contient déjà les fichiers marqués « squelette » ; les étapes 1 à 4 montrent ce qu'ils contiennent et ce qui change d'une page à l'autre. Les étapes 5 et 6 ajoutent un domaine `realisations` (exemple de contenu publié en base : renommer selon le glossaire du projet).

| Fichier | Rôle |
|---|---|
| `src/config/site.ts` (squelette) | `adresseDuSite()` |
| `src/lib/seo/seo.ts`, `src/lib/seo/__tests__/seo.test.ts` (squelette) | `metadonneesDePage()`, `partageCommun`, `imageDePartage` |
| `src/lib/seo/politique-robots.ts`, `src/lib/seo/__tests__/politique-robots.test.ts` (squelette) | Politique des robots IA, `reglesRobots()` |
| `src/lib/seo/donnees-structurees.ts`, `src/lib/seo/__tests__/donnees-structurees.test.ts` (squelette) | `siteWeb()`, `organisation()`, `commerceLocal()`, `filDAriane()` |
| `src/components/shared/elements/json-ld.tsx` (squelette) | `<JsonLd>` : données structurées échappées |
| `app/robots.ts`, `app/sitemap.ts` (squelette) | robots.txt et sitemap.xml |
| `app/opengraph-image.tsx`, `app/icon.tsx`, `app/apple-icon.tsx` (squelette) | Image de partage et icônes |
| `app/layout.tsx` (modifié) | `metadataBase`, modèle de titre, carte de partage commune |
| `app/page.tsx` (modifié) | Métadonnées de l'accueil, nom du site (`WebSite`) |
| `app/(connecte)/layout.tsx` | Pages connectées hors de Google (si la recette `connexion` est appliquée) |
| `app/(public)/<page>/page.tsx` (modifiés) | Métadonnées de chaque page publique |
| `app/(public)/tarifs/__tests__/metadonnees.test.ts` | Test des métadonnées d'une page (exemple) |
| `src/core/realisations/realisation.entity.ts` | Type `Realisation` |
| `src/db/realisations/realisation.table.ts` | Table Drizzle `realisations` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée par `npm run db:generate` |
| `src/db/realisations/realisation.repository.ts` | `realisationRepository(db)` : `trouverPubliee`, `existePubliee`, `listerPubliees` |
| `src/features/realisations/constants/cache-tags.ts` | Étiquette de cache `realisations` |
| `src/features/realisations/queries/lire-realisation.query.ts` | Lecture d'une réalisation en `"use cache"` |
| `src/features/realisations/queries/lister-realisations.query.ts` | Liste des réalisations en `"use cache"` (pages générées, sitemap) |
| `src/features/realisations/components/sections/detail-realisation.tsx` | Affichage d'une réalisation |
| `src/features/realisations/components/containers/detail-realisation.container.tsx` | Lit la réalisation, `notFound()` si elle manque |
| `app/(public)/realisations/[slug]/page.tsx` | Page de détail publique |
| `app/sitemap.ts` (modifié) | Ajoute les pages fixes et les réalisations avec leur vraie date |
| `proxy.ts` (modifié) | Vrai 404 pour un `slug` inconnu (étape 6) |
| `src/db/realisations/__tests__/realisation.repository.test.ts` | Tests d'intégration avec PGlite |
| `e2e/referencement.spec.ts` (squelette) | robots.txt, sitemap, vraie 404, balises de l'accueil |

## Étapes

### 1. Le layout racine

`metadataBase` complète les adresses relatives (adresse officielle, image de partage) ; le modèle de titre ajoute le nom du site aux pages enfants.

```tsx
// app/layout.tsx (extrait : imports et metadata)
import { projet } from "@src/config/projet";
import { adresseDuSite } from "@src/config/site";
import { partageCommun } from "@src/lib/seo/seo";

export const metadata: Metadata = {
  metadataBase: new URL(adresseDuSite()),
  title: { default: projet.nom, template: `%s | ${projet.nom}` },
  description: projet.description,
  openGraph: {
    ...partageCommun,
    title: projet.nom,
    description: projet.description,
  },
  twitter: { card: "summary_large_image" },
};
```

### 2. L'accueil

Titre affiché tel quel (le modèle ne s'applique pas au segment qui le définit), nom du site pour Google.

```tsx
// app/page.tsx
import { JsonLd } from "@src/components/shared/elements/json-ld";
import { projet } from "@src/config/projet";
import { adresseDuSite } from "@src/config/site";
import { siteWeb } from "@src/lib/seo/donnees-structurees";
import { metadonneesDePage } from "@src/lib/seo/seo";
import type { Metadata } from "next";

export const metadata: Metadata = metadonneesDePage({
  titre: projet.nom,
  description: projet.description,
  chemin: "/",
  accueil: true,
});

export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <JsonLd
        donnees={siteWeb({ nom: projet.nom, adresse: adresseDuSite() })}
      />
      {/* … contenu de l'accueil … */}
    </main>
  );
}
```

Pour un commerce avec une adresse physique, ajouter sur l'accueil ou la page « À propos » `<JsonLd donnees={commerceLocal({ … })} />`, avec les informations **affichées** sur la page. Sinon, `organisation({ nom, adresse, logo })` (logo carré d'au moins 112 pixels).

### 3. Chaque page publique

Les pages publiques vivent dans `app/(public)/` ; les métadonnées de chaque page passent par `metadonneesDePage()`.

```tsx
// app/(public)/tarifs/page.tsx
import { metadonneesDePage } from "@src/lib/seo/seo";
import type { Metadata } from "next";

// Textes validés dans docs/seo.md
export const metadata: Metadata = metadonneesDePage({
  titre: "Tarifs",
  description: "Nos tarifs de réparation, sur devis gratuit sous 48 heures.",
  chemin: "/tarifs",
});

export default function Tarifs() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-3xl font-semibold">Tarifs</h1>
    </main>
  );
}
```

Puis ajouter la page à `PAGES_PUBLIQUES` de `app/sitemap.ts` (`{ chemin: "/tarifs" }`). Une page qui a sa propre image de partage la passe en `image` (`{ url, width: 1200, height: 630, alt }`).

### 4. Les pages connectées hors de Google

```tsx
// app/(connecte)/layout.tsx
import type { Metadata } from "next";

// Pages réservées aux personnes connectées : hors de Google.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LayoutConnecte({ children }: LayoutProps<"/">) {
  return children;
}
```

La protection reste la connexion (`utilisateurConnecte()`, recette `connexion`) ; robots.txt est public et reste ouvert.

### 5. Une page de détail publique (`[slug]`)

Adresse lisible par un `slug` (« /realisations/table-en-chene »), lecture partagée en `"use cache"`, `generateStaticParams` (au moins une valeur : exigence de Cache Components), `notFound()` au premier niveau, **avant** tout `<Suspense>`, sans `loading.tsx` dans ce segment. Le contenu se lit en base : domaine `realisations` dans `core/`, `db/` et `features/`.

Le type et la table (les contenus non publiés restent hors du public) :

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

Puis `npm run db:generate` (migration dans `drizzle/`) et `npm run db:migrate`.

Le repository porte la condition « publiée » dans chaque requête ; `existePubliee` ne lit qu'une colonne indexée (elle sert au proxy de l'étape 6) :

```ts
// src/db/realisations/realisation.repository.ts
import "server-only";
import type { Realisation } from "@src/core/realisations/realisation.entity";
import type { Db } from "@src/db";
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

```ts
// src/features/realisations/constants/cache-tags.ts
export const TAG_REALISATIONS = "realisations";
```

```ts
// src/features/realisations/queries/lire-realisation.query.ts
import "server-only";
import { getDb } from "@src/db";
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

```ts
// src/features/realisations/queries/lister-realisations.query.ts
import "server-only";
import { getDb } from "@src/db";
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

### 6. Un vrai 404 pour un `slug` inconnu (facultatif)

Avec Cache Components, une adresse inconnue de ce segment répond **200 avec `noindex`** à Googlebot et aux robots IA (la coquille prérendue part avant `notFound()`) ; Google l'écarte des résultats, mais la compte comme « soft 404 ». Pour un vrai 404, vérifier l'existence dans `proxy.ts` (à la racine), qui agit avant le rendu. Le proxy appelle `existePubliee` du repository : c'est la seule lecture de base permise dans le proxy, une requête légère (colonne indexée), jamais le contenu entier.

```ts
// proxy.ts (à fusionner avec le proxy existant de la recette connexion)
import { getDb } from "@src/db";
import { realisationRepository } from "@src/db/realisations/realisation.repository";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Page publique : un slug sans contenu publié répond 404 avant le rendu (vrai 404 pour les robots).
  if (pathname.startsWith("/realisations/")) {
    const slug = pathname.split("/")[2] ?? "";
    if (!(await realisationRepository(getDb()).existePubliee(slug))) {
      // Adresse sans page : Next.js répond 404 avec app/not-found.tsx.
      return NextResponse.rewrite(new URL("/introuvable", request.url));
    }
    return NextResponse.next();
  }

  // Pages connectées : seulement l'ouverture d'une page (GET). Une action (POST) continue jusqu'à
  // actionConnectee, qui répond « Connexion requise » dans le formulaire.
  if (request.method === "GET" && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Une ligne par page du groupe (connecte) : les groupes de routes n'apparaissent pas dans l'adresse.
  matcher: ["/compte/:path*", "/factures/:path*", "/realisations/:slug"],
};
```

Le bloc des réalisations passe en premier et rend la main : une page publique n'est jamais renvoyée vers la connexion. Gardez une seule fonction `proxy` et réunissez les listes de `matcher` (le fichier montre `compte` et `factures` ; gardez les lignes de votre projet).

### 7. Renommer une adresse publique

Décidé avec la personne. Dans `next.config.ts` : `async redirects() { return [{ source: "/ancienne", destination: "/nouvelle", permanent: true }]; }` (308), puis mettre à jour le sitemap et `docs/seo.md`.

### 8. La politique des robots IA

Décidée avec `/pulse:seo ia`. Changer `politiqueRobotsIa` dans `src/lib/seo/politique-robots.ts` (« A », « B », « C » ou « D ») ; options : `signalDeContenu` (ligne Content-Signal), `cheminsFermes` (chemins à ne pas explorer, rien de secret). Les listes de robots reprennent la référence du cœur (`pulse-aidd reference seo/robots-ia.json`).

### 9. L'image de partage et les icônes

Accorder les couleurs de `app/opengraph-image.tsx`, `app/icon.tsx` et `app/apple-icon.tsx` à `docs/design.md` (valeurs, car une image ne lit pas les variables du thème ; flexbox seulement, pas de grille). Une image fournie par la personne les remplace : `app/opengraph-image.png` (1200 × 630) avec `app/opengraph-image.alt.txt`, `app/icon.png` (carrée).

### 10. Vérifier

```
npm run check && npm run typecheck && npm test
npm run build && npm run start
pulse-aidd seo http://localhost:3000 --ia --chemins "$(pulse-aidd pile seo-code --pages)"
pulse-aidd pile seo-code
```

Attendu : aucun Critique ni Haute. Puis `npm run test:e2e` (robots.txt, sitemap, 404, balises de l'accueil). Avec l'étape 6, ouvrir aussi `/realisations/inconnu` : la réponse est 404 (même avec l'en-tête `User-Agent: Googlebot`).

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Référencement des pages publiques

  Règle: Chaque page publique se présente avec ses propres textes

    @US-XXX-1 @unitaire
    Exemple: La page Tarifs a son titre, sa description et son adresse officielle
      Étant donné les textes validés de la page « /tarifs »
      Quand on construit ses métadonnées
      Alors le titre est « Tarifs », l'adresse officielle « /tarifs », et la carte de partage porte le nom du site et son image

  Règle: Les robots trouvent le plan du site

    @US-XXX-2 @bout-en-bout
    Exemple: robots.txt cite le sitemap par son adresse complète
      Quand un robot ouvre « /robots.txt »
      Alors la réponse est 200 et contient « Sitemap: » suivi d'une adresse complète

    @US-XXX-2 @bout-en-bout
    Exemple: Une adresse inconnue répond « introuvable »
      Quand un robot ouvre une adresse qui n'existe pas
      Alors la réponse est 404

  Règle: Les robots IA suivent la politique choisie

    @US-XXX-3 @unitaire
    Exemple: Politique B : l'entraînement est refusé, la recherche reste ouverte
      Étant donné la politique « B »
      Quand on construit les règles de robots.txt
      Alors GPTBot est bloqué et OAI-SearchBot ne l'est pas

  Règle: Une réalisation non publiée reste invisible

    @US-XXX-4 @unitaire
    Exemple: Un brouillon n'est ni trouvé ni listé
      Étant donné une réalisation non publiée et deux réalisations publiées
      Quand on cherche ou on liste les réalisations pour le public
      Alors le brouillon n'existe pas et la liste montre les deux autres, les plus récentes d'abord
```

## Tâches de plan prêtes

- [ ] **Tn – Fondations du référencement** · US-XXX
  - Objectif : le site déclare son adresse, son plan, ses robots, son image de partage et son nom
  - Dépend de : —
  - Fichiers : déjà dans le squelette : `src/config/site.ts`, `src/lib/seo/seo.ts`, `src/lib/seo/politique-robots.ts`, `src/lib/seo/donnees-structurees.ts`, `src/components/shared/elements/json-ld.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`, `app/icon.tsx`, `app/apple-icon.tsx` · à modifier : `app/layout.tsx`, `app/page.tsx` (projet plus ancien), `app/(connecte)/layout.tsx` (si connexion)
  - Vérification : US-XXX critère 2 – `pulse-aidd seo http://localhost:3000` : aucun Critique ni Haute
  - Tests : « robots.txt cite le sitemap par son adresse complète », « Une adresse inconnue répond « introuvable » » (bout en bout, `e2e/referencement.spec.ts` du squelette)
  - Action manuelle : la personne saisit `SITE_URL` dans Vercel (Production) quand le domaine est définitif
- [ ] **Tn+1 – Les textes des pages publiques** · US-XXX
  - Objectif : chaque page publique a le titre et la description validés dans `docs/seo.md`
  - Dépend de : Tn, `/pulse:seo textes`
  - Fichiers : à modifier : chaque `app/(public)/<page>/page.tsx`, `app/sitemap.ts` · à créer : `app/(public)/tarifs/__tests__/metadonnees.test.ts` (une page par test)
  - Vérification : US-XXX critère 1 – `pulse-aidd seo http://localhost:3000 --chemins …` : titres et descriptions présents et uniques
  - Tests : « La page Tarifs a son titre, sa description et son adresse officielle » (unitaire, `app/(public)/tarifs/__tests__/metadonnees.test.ts`)
- [ ] **Tn+2 – La politique des robots IA** · US-XXX
  - Objectif : robots.txt applique la politique choisie avec `/pulse:seo ia`
  - Dépend de : Tn
  - Fichiers : à modifier : `src/lib/seo/politique-robots.ts`
  - Vérification : US-XXX critère 3 – `pulse-aidd seo http://localhost:3000 --ia` : IA1 vert
  - Tests : « Politique B : l'entraînement est refusé, la recherche reste ouverte » (unitaire, `src/lib/seo/__tests__/politique-robots.test.ts` du squelette)
- [ ] **Tn+3 – Les pages de détail publiques** · US-XXX
  - Objectif : chaque contenu publié a sa page, son entrée de sitemap datée et, pour une adresse inconnue, un vrai 404
  - Dépend de : Tn, Tn+1
  - Fichiers : à créer : `src/core/realisations/realisation.entity.ts`, `src/db/realisations/realisation.table.ts`, `src/db/realisations/realisation.repository.ts`, `src/features/realisations/constants/cache-tags.ts`, `src/features/realisations/queries/lire-realisation.query.ts`, `src/features/realisations/queries/lister-realisations.query.ts`, `src/features/realisations/components/sections/detail-realisation.tsx`, `src/features/realisations/components/containers/detail-realisation.container.tsx`, `app/(public)/realisations/[slug]/page.tsx` · à modifier : `app/sitemap.ts`, `proxy.ts`
  - Vérification : US-XXX critère 4 – `/realisations/inconnu` répond 404 ; le sitemap liste les réalisations publiées avec leur `lastmod`
  - Tests : « Un brouillon n'est ni trouvé ni listé » (intégration PGlite, `src/db/realisations/__tests__/realisation.repository.test.ts`)

## Tests

### Unitaires

Les tests du squelette couvrent `metadonneesDePage()`, `adresseDuSite()`, `reglesRobots()` et les fonctions de données structurées (`src/lib/seo/__tests__/*.test.ts`, `src/config/__tests__/`). Pour une page :

```ts
// app/(public)/tarifs/__tests__/metadonnees.test.ts
import { describe, expect, it } from "vitest";
import { metadata } from "../page";

describe("Référencement des pages publiques", () => {
  it("US-XXX-1 – La page Tarifs a son titre, sa description et son adresse officielle", () => {
    expect(metadata.title).toBe("Tarifs");
    expect(metadata.alternates?.canonical).toBe("/tarifs");
    expect(metadata.openGraph).toMatchObject({ url: "/tarifs" });
  });
});
```

`vitest.config.ts` inclut déjà `app/**/*.test.ts` et `src/**/*.test.ts`.

### Intégration (PGlite)

Le repository est testé sur une base en mémoire (`creerBaseDeTest()`) : une réalisation publiée est trouvée avec sa date, un brouillon et un `slug` inconnu n'existent pas pour le public, la liste ne contient que les publiées, la plus récente d'abord.

```ts
// src/db/realisations/__tests__/realisation.repository.test.ts
import type { Db } from "@src/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { realisationRepository } from "../realisation.repository";
import { realisations } from "../realisation.table";

let db: Db;
let fermer: () => Promise<void>;

beforeEach(async () => {
  ({ db, fermer } = await creerBaseDeTest());
  await db.insert(realisations).values([
    {
      slug: "table-en-chene",
      titre: "Table en chêne",
      resume: "Une table sur mesure.",
      publiee: true,
      misAJourLe: new Date("2026-03-01T10:00:00Z"),
    },
    {
      slug: "buffet-brouillon",
      titre: "Buffet",
      resume: "Pas encore publié.",
      publiee: false,
    },
    {
      slug: "etagere-noyer",
      titre: "Étagère en noyer",
      resume: "Une étagère murale.",
      publiee: true,
      misAJourLe: new Date("2026-05-01T10:00:00Z"),
    },
  ]);
});

afterEach(async () => {
  await fermer();
});

describe("realisationRepository", () => {
  it("US-XXX-4 – Une réalisation publiée est trouvée avec sa date de mise à jour", async () => {
    const realisation =
      await realisationRepository(db).trouverPubliee("table-en-chene");
    expect(realisation).toMatchObject({
      slug: "table-en-chene",
      titre: "Table en chêne",
      misAJourLe: new Date("2026-03-01T10:00:00Z"),
    });
  });

  it("US-XXX-4 – Un brouillon et un slug inconnu n'existent pas pour le public", async () => {
    const repository = realisationRepository(db);
    expect(await repository.trouverPubliee("buffet-brouillon")).toBeNull();
    expect(await repository.existePubliee("buffet-brouillon")).toBe(false);
    expect(await repository.existePubliee("inconnu")).toBe(false);
    expect(await repository.existePubliee("table-en-chene")).toBe(true);
  });

  it("US-XXX-4 – La liste ne contient que les publiées, les plus récentes d'abord", async () => {
    const liste = await realisationRepository(db).listerPubliees();
    expect(liste.map((r) => r.slug)).toEqual([
      "etagere-noyer",
      "table-en-chene",
    ]);
  });
});
```

### Bout en bout (Playwright)

`e2e/referencement.spec.ts` du squelette : robots.txt (200, ligne `Sitemap:` complète), sitemap.xml, adresse inconnue en 404, titre, adresse officielle et image de partage dans `<head>` de l'accueil.

## Points de sécurité

- **S6 – Affichage** : les données structurées passent par `<JsonLd>`, qui échappe `<` ; jamais `JSON.stringify` nu dans `dangerouslySetInnerHTML`.
- **S4 – Pages réservées** : robots.txt est public et ne cache rien ; une page privée est protégée par la connexion, et `noindex` la garde hors de Google.
- `SITE_URL` et le jeton de vérification Search Console ne sont pas des secrets ; aucune clé n'est nécessaire au référencement.
- Le proxy de l'étape 6 lit seulement l'existence d'un contenu publié (`existePubliee`, requête légère et paramétrée) ; la décision d'accès reste dans chaque page et chaque action. Le repository ne renvoie jamais un contenu non publié.

## Pièges connus

- **Image de partage perdue sur une page** : un `openGraph` défini par une page remplace tout celui du layout, et l'image du layout (`opengraph-image.tsx`) ne s'applique qu'à son segment. `metadonneesDePage()` reconstruit donc la carte complète, image comprise (constaté dans le code de Next.js 16.4, `metadata-resolution-primitives.js`).
- **Adresse officielle** : rien n'est automatique ; chaque page la déclare (`chemin`).
- **`metadataBase` absent** : les adresses relatives retombent sur `localhost` ; dans une fonction `"use cache"`, renvoyer `metadataBase` en chaîne (`toString()`), pas en `URL`.
- **`loading.tsx` dans un segment public** : toute adresse de ce segment répond 200 avant `notFound()`, et Googlebot reçoit une « soft 404 ».
- **`slug` inconnu** : 200 avec `noindex` même sans `loading.tsx` (étape 6 pour un vrai 404). Les robots dits « HTML limités » (Bingbot, facebookexternalhit) reçoivent, eux, un 404.
- **`generateStaticParams` vide** : erreur de construction avec Cache Components ; renvoyer au moins une valeur.
- **Base injoignable pendant `npm run build`** : `generateStaticParams` et le sitemap lisent la base ; sans `DATABASE_URL` valide et sans migrations appliquées, la construction échoue (« Failed to collect page data for /realisations/[slug] »). Appliquer les migrations avant de construire.
- **`lastModified: new Date()`** dans le sitemap : Google et Bing ignorent alors toutes les dates. Seulement une vraie date de modification.
- **`public/robots.txt`** en plus de `app/robots.ts` : deux fichiers pour la même adresse ; garder `robots.ts`.
- **`htmlLimitedBots`** : le définir remplace toute la liste par défaut de Next.js. Inutile quand les métadonnées des pages publiques sont prérendables.
- **`cookies()` ou `headers()` dans `generateMetadata`** d'une page publique : métadonnées envoyées en fin de page pour Googlebot et les robots IA.
- **Types `schema-dts`** : un type comme `Organization` inclut aussi une chaîne ; dans un test, vérifier l'objet entier (`toMatchObject`) plutôt qu'une propriété.
- **Proxy fusionné avec la connexion** : si le contrôle de session s'applique avant le bloc des réalisations, une page publique est renvoyée vers `/connexion`. Garder le bloc des réalisations en premier, avec son `return`.

## Sources

- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/04-functions/generate-metadata.md` (`metadataBase`, `title.template`, fusion, métadonnées en streaming) ; `03-file-conventions/01-metadata/robots.md`, `sitemap.md`, `opengraph-image.md`, `app-icons.md` ; `02-guides/json-ld.md` (échappement de `<`, `schema-dts`) ; `02-guides/streaming.md` (statuts) ; `03-file-conventions/dynamic-routes.md` (Cache Components et `generateStaticParams`) ; `03-file-conventions/loading.md` (« Status codes ») ; `05-config/01-next-config-js/htmlLimitedBots.md`
- Code de Next.js 16.4 : `dist/lib/metadata/metadata-resolution-primitives.js` (`mergeStaticMetadata`)
- Google Search Central (dates dans la référence du cœur « Référencement : les règles ») ; `schema-dts` 2.1.0 (npm, 2026-10-02)
- Essais du 2026-10-07 (squelette construit, `next start`) : `/robots.txt` 200 avec `Sitemap:` complet ; `/sitemap.xml` 200 ; adresse inconnue à la racine 404 ; `/a-propos` avec titre « À propos | Nom », canonique et `og:image` complètes ; `(connecte)` : `noindex, nofollow` ; `[slug]` inconnu : 200 + `noindex` pour un navigateur, Googlebot et OAI-SearchBot, 404 pour Bingbot et facebookexternalhit ; avec le proxy de l'étape 6 : 404 pour tous ; `slug` publié après la construction (lecture asynchrone en `"use cache"`) : titre et canonique dans `<head>` pour Googlebot. `pulse-aidd seo http://localhost:3000 --ia` : aucun Critique ni Haute.
- Essai du 2026-10-08 (structure hexagonale, projet d'essai avec `connexion` et `liste`, base PGlite en mémoire à la place de Neon) : construction réussie avec `generateStaticParams` et sitemap lus en base ; `/realisations/table-en-chene` 200 (titre « Table en chêne | Essai », canonique) ; `/realisations/inconnu` et le brouillon 404, y compris avec l'en-tête Googlebot ; `/sitemap.xml` avec `lastmod` de la réalisation ; `/compte` sans session renvoyé vers `/connexion` ; `pulse-aidd pile seo-code` : aucun Critique ni Haute.

## Points à vérifier

- Les étapes 5 et 6 avec une vraie base Neon (durée de la requête d'existence dans le proxy) : essayées avec PGlite seulement.
- `generateStaticParams` qui lit la base pendant la construction : les variables doivent exister au moment de construire (c'est le cas chez Vercel ; en CI, prévoir une base de test ou une valeur d'exemple).
- La canonique envoyée en fin de `<body>` (métadonnées en streaming) : prise en compte par Google non tranchée ; d'où des métadonnées prérendables.
- Le test unitaire d'une page qui importe `metadata` depuis `page.tsx` : essayé sur une page sans composant client (Vitest, Biome et types passent) ; une page qui importe un composant client n'a pas été essayée.

# Recette : seo

> Quand l'utiliser : le site a des pages publiques qui doivent être trouvées sur Google et par les assistants IA (adresse officielle, titres, sitemap, robots, carte de partage, données structurées, vraie page 404).

## Prérequis

- Squelette du pack, version qui contient `src/lib/site.ts` et `src/lib/seo.ts`. Projet créé avec une version plus ancienne : relancer `pulse-aidd pile squelette --nom "<nom du projet>"` à la racine : il ajoute les fichiers manquants et garde les fichiers présents (les étapes 1 et 2 indiquent ce qui change dans `layout.tsx` et `page.tsx`).
- Paquet de développement `schema-dts` (types schema.org, publiés par Google) : déjà dans le squelette ; sinon `npm install -D schema-dts` (dernière version ; recette vérifiée avec 2.1.0). Il sert seulement aux types (`import type`) : rien n'est ajouté au site.
- Les textes des pages (titres, descriptions) sont validés dans `docs/seo.md` (`/pulse:seo textes`). En attendant, le nom et la description du projet servent.

## Variables d'environnement

| Nom | Où | Valeur |
|---|---|---|
| `SITE_URL` | Vercel, **Production** seulement (et `.env` si besoin) | L'adresse officielle, sans barre finale : `https://www.mon-site.fr`. Sans elle : le domaine de production fourni par Vercel, sinon `http://localhost:3000` |

Valeur non secrète. Elle est lue pendant la construction : après l'avoir changée, redéployer.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/lib/site.ts` | `adresseDuSite()` |
| `src/lib/seo.ts`, `seo.test.ts` | `metadonneesDePage()`, `partageCommun`, `imageDePartage` |
| `src/lib/politique-robots.ts`, `politique-robots.test.ts` | Politique des robots IA, `reglesRobots()` |
| `src/lib/donnees-structurees.ts`, `donnees-structurees.test.ts` | `siteWeb()`, `organisation()`, `commerceLocal()`, `filDAriane()` |
| `src/components/json-ld.tsx` | `<JsonLd>` : données structurées échappées |
| `src/app/robots.ts`, `src/app/sitemap.ts` | robots.txt et sitemap.xml |
| `src/app/opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx` | Image de partage et icônes |
| `src/app/layout.tsx` (modifié) | `metadataBase`, modèle de titre, carte de partage commune |
| `src/app/page.tsx` (modifié) | Métadonnées de l'accueil, nom du site (`WebSite`) |
| `src/app/(connecte)/layout.tsx` | Pages connectées hors de Google (si la recette `connexion` est appliquée) |
| `src/app/<page>/page.tsx` (modifiés) | Métadonnées de chaque page publique |
| `e2e/referencement.spec.ts` | robots.txt, sitemap, vraie 404, balises de l'accueil |

## Étapes

### 1. Le layout racine

`metadataBase` complète les adresses relatives (adresse officielle, image de partage) ; le modèle de titre ajoute le nom du site aux pages enfants.

```tsx
// src/app/layout.tsx (extrait : imports et metadata)
import { projet } from "@/lib/projet";
import { partageCommun } from "@/lib/seo";
import { adresseDuSite } from "@/lib/site";

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
// src/app/page.tsx
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { siteWeb } from "@/lib/donnees-structurees";
import { projet } from "@/lib/projet";
import { metadonneesDePage } from "@/lib/seo";
import { adresseDuSite } from "@/lib/site";

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

```tsx
// src/app/tarifs/page.tsx
import type { Metadata } from "next";
import { metadonneesDePage } from "@/lib/seo";

// Textes validés dans docs/seo.md
export const metadata: Metadata = metadonneesDePage({
  titre: "Tarifs",
  description: "Nos tarifs de réparation, sur devis gratuit sous 48 heures.",
  chemin: "/tarifs",
});
```

Puis ajouter la page à `PAGES_PUBLIQUES` de `src/app/sitemap.ts` (`{ chemin: "/tarifs" }`). Une page qui a sa propre image de partage la passe en `image` (`{ url, width: 1200, height: 630, alt }`).

### 4. Les pages connectées hors de Google

```tsx
// src/app/(connecte)/layout.tsx
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

Adresse lisible par un `slug` (« /realisations/table-en-chene »), lecture partagée en `"use cache"`, `generateStaticParams` (au moins une valeur : exigence de Cache Components), `notFound()` au premier niveau, **avant** tout `<Suspense>`, sans `loading.tsx` dans ce segment.

```tsx
// src/app/realisations/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  lireRealisation,
  slugsDesRealisations,
} from "@/features/realisations/queries";
import { metadonneesDePage } from "@/lib/seo";

export async function generateStaticParams() {
  return (await slugsDesRealisations()).map((slug) => ({ slug }));
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
  const realisation = await lireRealisation(slug);
  if (!realisation) notFound();
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-3xl font-semibold">{realisation.titre}</h1>
      <p>{realisation.resume}</p>
    </main>
  );
}
```

Dans `queries.ts`, `lireRealisation(slug)` et `slugsDesRealisations()` commencent par `"use cache"` avec `cacheLife("hours")` et `cacheTag("realisations")` (fiche, règle 5), et ne lisent que les contenus publiés. Une action qui publie appelle `updateTag("realisations")`. Le sitemap ajoute ces adresses avec leur vraie date (`misAJourLe` = colonne de mise à jour) : rendre `sitemap()` asynchrone et y appeler une lecture en `"use cache"`.

### 6. Un vrai 404 pour un `slug` inconnu (facultatif)

Avec Cache Components, une adresse inconnue de ce segment répond **200 avec `noindex`** à Googlebot et aux robots IA (la coquille prérendue part avant `notFound()`) ; Google l'écarte des résultats, mais la compte comme « soft 404 ». Pour un vrai 404, vérifier l'existence dans `src/proxy.ts`, qui agit avant le rendu. Une requête légère (colonne indexée), jamais le contenu entier :

```ts
// src/proxy.ts (à fusionner avec le proxy existant de la recette connexion)
import { type NextRequest, NextResponse } from "next/server";
import { realisationPubliee } from "@/features/realisations/existence";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/realisations/")) {
    const slug = pathname.split("/")[2] ?? "";
    if (!(await realisationPubliee(slug))) {
      // Adresse sans page : Next.js répond 404 avec src/app/not-found.tsx.
      return NextResponse.rewrite(new URL("/introuvable", request.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/realisations/:slug"] };
```

Avec la recette `connexion`, garder une seule fonction `proxy` : le renvoi vers la connexion, puis ce contrôle ; réunir les deux listes dans `matcher`.

### 7. Renommer une adresse publique

Décidé avec la personne. Dans `next.config.ts` : `async redirects() { return [{ source: "/ancienne", destination: "/nouvelle", permanent: true }]; }` (308), puis mettre à jour le sitemap et `docs/seo.md`.

### 8. La politique des robots IA

Décidée avec `/pulse:seo ia`. Changer `politiqueRobotsIa` dans `src/lib/politique-robots.ts` (« A », « B », « C » ou « D ») ; options : `signalDeContenu` (ligne Content-Signal), `cheminsFermes` (chemins à ne pas explorer, rien de secret). Les listes de robots reprennent la référence du cœur (`pulse-aidd reference seo/robots-ia.json`).

### 9. L'image de partage et les icônes

Accorder les couleurs de `src/app/opengraph-image.tsx`, `icon.tsx` et `apple-icon.tsx` à `docs/design.md` (valeurs, car une image ne lit pas les variables du thème ; flexbox seulement, pas de grille). Une image fournie par la personne les remplace : `src/app/opengraph-image.png` (1200 × 630) avec `opengraph-image.alt.txt`, `src/app/icon.png` (carrée).

### 10. Vérifier

```
npm run check && npm run typecheck && npm test
npm run build && npm run start
pulse-aidd seo http://localhost:3000 --ia --chemins "$(pulse-aidd pile seo-code --pages)"
pulse-aidd pile seo-code
```

Attendu : aucun Critique ni Haute. Puis `npm run test:e2e` (robots.txt, sitemap, 404, balises de l'accueil).

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
```

## Tâches de plan prêtes

- [ ] **Tn – Fondations du référencement** · US-XXX
  - Objectif : le site déclare son adresse, son plan, ses robots, son image de partage et son nom
  - Dépend de : —
  - Fichiers : déjà dans le squelette : `src/lib/site.ts`, `seo.ts`, `politique-robots.ts`, `donnees-structurees.ts`, `src/components/json-ld.tsx`, `src/app/robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx` · à modifier : `src/app/layout.tsx`, `src/app/page.tsx` (projet plus ancien), `src/app/(connecte)/layout.tsx` (si connexion)
  - Vérification : US-XXX critère 2 – `pulse-aidd seo http://localhost:3000` : aucun Critique ni Haute
  - Tests : « robots.txt cite le sitemap par son adresse complète », « Une adresse inconnue répond « introuvable » » (bout en bout)
  - Action manuelle : la personne saisit `SITE_URL` dans Vercel (Production) quand le domaine est définitif
- [ ] **Tn+1 – Les textes des pages publiques** · US-XXX
  - Objectif : chaque page publique a le titre et la description validés dans `docs/seo.md`
  - Dépend de : Tn, `/pulse:seo textes`
  - Fichiers : à modifier : chaque `page.tsx` publique, `src/app/sitemap.ts`
  - Vérification : US-XXX critère 1 – `pulse-aidd seo http://localhost:3000 --chemins …` : titres et descriptions présents et uniques
  - Tests : « La page Tarifs a son titre, sa description et son adresse officielle » (unitaire)
- [ ] **Tn+2 – La politique des robots IA** · US-XXX
  - Objectif : robots.txt applique la politique choisie avec `/pulse:seo ia`
  - Dépend de : Tn
  - Fichiers : à modifier : `src/lib/politique-robots.ts`
  - Vérification : US-XXX critère 3 – `pulse-aidd seo http://localhost:3000 --ia` : IA1 vert
  - Tests : « Politique B : l'entraînement est refusé, la recherche reste ouverte » (unitaire)

## Tests

### Unitaires

Les tests du squelette couvrent `metadonneesDePage()`, `adresseDuSite()`, `reglesRobots()` et les fonctions de données structurées (`src/lib/*.test.ts`). Pour une page :

```ts
// src/app/tarifs/metadonnees.test.ts
import { describe, expect, it } from "vitest";
import { metadata } from "./page";

describe("Référencement des pages publiques", () => {
  it("US-XXX-1 – La page Tarifs a son titre, sa description et son adresse officielle", () => {
    expect(metadata.title).toBe("Tarifs");
    expect(metadata.alternates?.canonical).toBe("/tarifs");
    expect(metadata.openGraph).toMatchObject({ url: "/tarifs" });
  });
});
```

`vitest.config.ts` inclut déjà `src/**/*.test.ts`.

### Bout en bout (Playwright)

`e2e/referencement.spec.ts` du squelette : robots.txt (200, ligne `Sitemap:` complète), sitemap.xml, adresse inconnue en 404, titre, adresse officielle et image de partage dans `<head>` de l'accueil.

## Points de sécurité

- **S6 – Affichage** : les données structurées passent par `<JsonLd>`, qui échappe `<` ; jamais `JSON.stringify` nu dans `dangerouslySetInnerHTML`.
- **S4 – Pages réservées** : robots.txt est public et ne cache rien ; une page privée est protégée par la connexion, et `noindex` la garde hors de Google.
- `SITE_URL` et le jeton de vérification Search Console ne sont pas des secrets ; aucune clé n'est nécessaire au référencement.
- Le proxy de l'étape 6 lit seulement l'existence d'un contenu publié (requête légère) ; la décision d'accès reste dans chaque page et chaque action.

## Pièges connus

- **Image de partage perdue sur une page** : un `openGraph` défini par une page remplace tout celui du layout, et l'image du layout (`opengraph-image.tsx`) ne s'applique qu'à son segment. `metadonneesDePage()` reconstruit donc la carte complète, image comprise (constaté dans le code de Next.js 16.4, `metadata-resolution-primitives.js`).
- **Adresse officielle** : rien n'est automatique ; chaque page la déclare (`chemin`).
- **`metadataBase` absent** : les adresses relatives retombent sur `localhost` ; dans une fonction `"use cache"`, renvoyer `metadataBase` en chaîne (`toString()`), pas en `URL`.
- **`loading.tsx` dans un segment public** : toute adresse de ce segment répond 200 avant `notFound()`, et Googlebot reçoit une « soft 404 ».
- **`slug` inconnu** : 200 avec `noindex` même sans `loading.tsx` (étape 6 pour un vrai 404). Les robots dits « HTML limités » (Bingbot, facebookexternalhit) reçoivent, eux, un 404.
- **`generateStaticParams` vide** : erreur de construction avec Cache Components ; renvoyer au moins une valeur.
- **`lastModified: new Date()`** dans le sitemap : Google et Bing ignorent alors toutes les dates. Seulement une vraie date de modification.
- **`public/robots.txt`** en plus de `src/app/robots.ts` : deux fichiers pour la même adresse ; garder `robots.ts`.
- **`htmlLimitedBots`** : le définir remplace toute la liste par défaut de Next.js. Inutile quand les métadonnées des pages publiques sont prérendables.
- **`cookies()` ou `headers()` dans `generateMetadata`** d'une page publique : métadonnées envoyées en fin de page pour Googlebot et les robots IA.
- **Types `schema-dts`** : un type comme `Organization` inclut aussi une chaîne ; dans un test, vérifier l'objet entier (`toMatchObject`) plutôt qu'une propriété.

## Sources

- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/04-functions/generate-metadata.md` (`metadataBase`, `title.template`, fusion, métadonnées en streaming) ; `03-file-conventions/01-metadata/robots.md`, `sitemap.md`, `opengraph-image.md`, `app-icons.md` ; `02-guides/json-ld.md` (échappement de `<`, `schema-dts`) ; `02-guides/streaming.md` (statuts) ; `03-file-conventions/dynamic-routes.md` (Cache Components et `generateStaticParams`) ; `03-file-conventions/loading.md` (« Status codes ») ; `05-config/01-next-config-js/htmlLimitedBots.md`
- Code de Next.js 16.4 : `dist/lib/metadata/metadata-resolution-primitives.js` (`mergeStaticMetadata`)
- Google Search Central (dates dans la référence du cœur « Référencement : les règles ») ; `schema-dts` 2.1.0 (npm, 2026-10-02)
- Essais du 2026-10-07 (squelette construit, `next start`) : `/robots.txt` 200 avec `Sitemap:` complet ; `/sitemap.xml` 200 ; adresse inconnue à la racine 404 ; `/a-propos` avec titre « À propos | Nom », canonique et `og:image` complètes ; `(connecte)` : `noindex, nofollow` ; `[slug]` inconnu : 200 + `noindex` pour un navigateur, Googlebot et OAI-SearchBot, 404 pour Bingbot et facebookexternalhit ; avec le proxy de l'étape 6 : 404 pour tous ; `slug` publié après la construction (lecture asynchrone en `"use cache"`) : titre et canonique dans `<head>` pour Googlebot. `pulse-aidd seo http://localhost:3000 --ia` : aucun Critique ni Haute.

## Points à vérifier

- Les étapes 5 et 6 avec une vraie base Neon (`queries.ts`, durée de la requête d'existence dans le proxy) : le mécanisme a été essayé avec une liste en mémoire seulement.
- `generateStaticParams` qui lit la base pendant la construction : les variables doivent exister au moment de construire (c'est le cas chez Vercel ; en CI, prévoir une base de test ou une valeur d'exemple).
- La canonique envoyée en fin de `<body>` (métadonnées en streaming) : prise en compte par Google non tranchée ; d'où des métadonnées prérendables.
- Le test unitaire d'une page qui importe `metadata` depuis `page.tsx` : essayé sur une page sans composant client (Vitest, Biome et types passent) ; une page qui importe un composant client n'a pas été essayée.

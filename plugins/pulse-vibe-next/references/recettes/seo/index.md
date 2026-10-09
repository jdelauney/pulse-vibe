# Recette : seo

> Quand l'utiliser : le site a des pages publiques qui doivent être trouvées sur Google et par les assistants IA (adresse officielle, titres, sitemap, robots, carte de partage, données structurées, vraie page 404).

## Prérequis

- Squelette du pack, version qui contient `src/config/site.ts` et `src/lib/seo/seo.ts`. Projet créé avec une version plus ancienne : relancer `pulse-aidd pile squelette --nom "<nom du projet>"` à la racine : il ajoute les fichiers manquants et garde les fichiers présents (les étapes 1 et 2 indiquent ce qui change dans `app/layout.tsx` et `app/page.tsx`).
- Paquet de développement `schema-dts` (types schema.org, publiés par Google) : déjà dans le squelette ; sinon `npm install -D schema-dts` (dernière version ; recette vérifiée avec 2.1.0). Il sert seulement aux types (`import type`) : rien n'est ajouté au site.
- Les textes des pages (titres, descriptions) sont validés dans `docs/seo.md` (`/pulse:seo textes`). En attendant, le nom et la description du projet servent.
- Étapes 5 et 6 (page de détail lue en base) : `src/db/db-client.ts` (`getDb()`, type `Db`), `drizzle.config.ts` (il lit `src/db/*/*.table.ts`) et `tests/helpers/base-de-test.ts` du squelette ; une base Neon dont la variable `DATABASE_URL` est renseignée **au moment de la construction**, avec les migrations appliquées (`npm run db:migrate`) : `generateStaticParams` et le sitemap lisent la base pendant `npm run build`.
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
| `e2e/realisations.spec.ts` | 404 d'un `slug` inconnu (aussi pour Googlebot) et `lastmod` d'une réalisation publiée |

## Étapes

- Étape 1 – Le layout racine : `pulse-aidd pile recette seo etape 1`
- Étape 2 – L'accueil : `pulse-aidd pile recette seo etape 2`
- Étape 3 – Chaque page publique : `pulse-aidd pile recette seo etape 3`
- Étape 4 – Les pages connectées hors de Google : `pulse-aidd pile recette seo etape 4`
- Étape 5 – Une page de détail publique (`[slug]`) : `pulse-aidd pile recette seo etape 5`
- Étape 6 – Un vrai 404 pour un `slug` inconnu (facultatif) : `pulse-aidd pile recette seo etape 6`
- Étape 7 – Renommer une adresse publique : `pulse-aidd pile recette seo etape 7`
- Étape 8 – La politique des robots IA : `pulse-aidd pile recette seo etape 8`
- Étape 9 – L'image de partage et les icônes : `pulse-aidd pile recette seo etape 9`
- Étape 10 – Vérifier : `pulse-aidd pile recette seo etape 10`
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

  Règle: Les pages de détail répondent comme les robots l'attendent

    @US-XXX-5 @bout-en-bout
    Exemple: Une réalisation inconnue répond « introuvable », même à Googlebot
      Étant donné une réalisation publiée « table-en-chene »
      Quand un robot, dont Googlebot, ouvre « /realisations/slug-inconnu »
      Alors la réponse est 404

    @US-XXX-6 @bout-en-bout
    Exemple: Le sitemap donne la date de modification d'une réalisation publiée
      Étant donné une réalisation publiée « table-en-chene »
      Quand un robot ouvre « /sitemap.xml »
      Alors l'entrée de « /realisations/table-en-chene » porte une date « lastmod »
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
  - Objectif : chaque page publique a le titre et la description validés dans `docs/seo.md` (sauf les pages d'authentification : fiche, règle 47)
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
  - Fichiers : à créer : `e2e/realisations.spec.ts`, `src/core/realisations/realisation.entity.ts`, `src/db/realisations/realisation.table.ts`, `src/db/realisations/realisation.repository.ts`, `src/features/realisations/constants/cache-tags.ts`, `src/features/realisations/queries/lire-realisation.query.ts`, `src/features/realisations/queries/lister-realisations.query.ts`, `src/features/realisations/components/sections/detail-realisation.tsx`, `src/features/realisations/components/containers/detail-realisation.container.tsx`, `app/(public)/realisations/[slug]/page.tsx` · `drizzle/<numéro>_<nom>.sql` (migration générée) · à modifier : `app/sitemap.ts`, `proxy.ts`
  - Vérification : US-XXX critères 4 à 6 – `/realisations/inconnu` répond 404 ; le sitemap liste les réalisations publiées avec leur `lastmod`
  - Action manuelle : insérer une réalisation publiée (`publiee = true`, slug `table-en-chene`) dans une base de **test ou de branche** (une branche Neon), jamais dans la base de production ; y lancer `npm run db:migrate` avant, puis `CI=1 npx playwright test e2e/realisations.spec.ts`
  - Tests : « Un brouillon n'est ni trouvé ni listé » (intégration PGlite, `src/db/realisations/__tests__/realisation.repository.test.ts`) ; « Une réalisation inconnue répond « introuvable », même à Googlebot » et « Le sitemap donne la date de modification d'une réalisation publiée » (bout en bout, `e2e/realisations.spec.ts`, base avec une réalisation publiée « table-en-chene »)

## Tests
Le code des tests : `pulse-aidd pile recette seo tests`
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
- **Aucune ligne publiée pendant `npm run build`** : juste après les migrations la table est vide, `generateStaticParams` renvoie `[]` et la construction échoue. Insérer d'abord au moins une réalisation publiée (`publiee = true`), par exemple depuis l'écran d'administration du projet ou une insertion SQL, puis construire.
- **Base injoignable pendant `npm run build`** : `generateStaticParams` et le sitemap lisent la base ; sans `DATABASE_URL` valide et sans migrations appliquées, la construction échoue (« Failed to collect page data for /realisations/[slug] »). Appliquer les migrations avant de construire.
- **`lastModified: new Date()`** dans le sitemap : Google et Bing ignorent alors toutes les dates. Seulement une vraie date de modification.
- **`public/robots.txt`** en plus de `app/robots.ts` : deux fichiers pour la même adresse ; garder `robots.ts`.
- **`htmlLimitedBots`** : le définir remplace toute la liste par défaut de Next.js. Inutile quand les métadonnées des pages publiques sont prérendables.
- **`cookies()` ou `headers()` dans `generateMetadata`** d'une page publique : métadonnées envoyées en fin de page pour Googlebot et les robots IA.
- **Types `schema-dts`** : un type comme `Organization` inclut aussi une chaîne ; dans un test, vérifier l'objet entier (`toMatchObject`) plutôt qu'une propriété.
- **Base indisponible dans le proxy** : l'appel à `existePubliee` est entouré d'un `try/catch` ; sans lui, une panne de base ferait répondre 500 à toutes les adresses `/realisations/…`. Le message du journal reste fixe (ni adresse ni donnée de la requête).
- **Proxy fusionné avec la connexion** : si le contrôle de session s'applique avant le bloc des réalisations, une page publique est renvoyée vers `/connexion`. Garder le bloc des réalisations en premier, avec son `return`.

## Sources

- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/04-functions/generate-metadata.md` (`metadataBase`, `title.template`, fusion, métadonnées en streaming) ; `03-file-conventions/01-metadata/robots.md`, `sitemap.md`, `opengraph-image.md`, `app-icons.md` ; `02-guides/json-ld.md` (échappement de `<`, `schema-dts`) ; `02-guides/streaming.md` (statuts) ; `03-file-conventions/dynamic-routes.md` (Cache Components et `generateStaticParams`) ; `03-file-conventions/loading.md` (« Status codes ») ; `05-config/01-next-config-js/htmlLimitedBots.md`
- Code de Next.js 16.4 : `dist/lib/metadata/metadata-resolution-primitives.js` (`mergeStaticMetadata`)
- Google Search Central (dates dans la référence du cœur « Référencement : les règles ») ; `schema-dts` 2.1.0 (npm, 2026-10-02)
- Essais du 2026-10-07 (squelette construit, `next start`) : `/robots.txt` 200 avec `Sitemap:` complet ; `/sitemap.xml` 200 ; adresse inconnue à la racine 404 ; `/a-propos` avec titre « À propos | Nom », canonique et `og:image` complètes ; `(connecte)` : `noindex, nofollow` ; `[slug]` inconnu : 200 + `noindex` pour un navigateur, Googlebot et OAI-SearchBot, 404 pour Bingbot et facebookexternalhit ; avec le proxy de l'étape 6 : 404 pour tous ; `slug` publié après la construction (lecture asynchrone en `"use cache"`) : titre et canonique dans `<head>` pour Googlebot. `pulse-aidd seo http://localhost:3000 --ia` : aucun Critique ni Haute.
- Essai du 2026-10-08 (`e2e/realisations.spec.ts`, version construite, base PGlite en mémoire avec une réalisation publiée et un brouillon, à la place de Neon) : les 16 tests de `realisations.spec.ts` et `referencement.spec.ts` passent (ordinateur et téléphone).
- Essai du 2026-10-08 (structure hexagonale, projet d'essai avec `connexion` et `liste`, base PGlite en mémoire à la place de Neon) : construction réussie avec `generateStaticParams` et sitemap lus en base ; `/realisations/table-en-chene` 200 (titre « Table en chêne | Essai », canonique) ; `/realisations/inconnu` et le brouillon 404, y compris avec l'en-tête Googlebot ; `/sitemap.xml` avec `lastmod` de la réalisation ; `/compte` sans session renvoyé vers `/connexion` ; `pulse-aidd pile seo-code` : aucun Critique ni Haute.

## Points à vérifier

- Les étapes 5 et 6 avec une vraie base Neon (durée de la requête d'existence dans le proxy) : essayées avec PGlite seulement.
- `generateStaticParams` qui lit la base pendant la construction : les variables doivent exister au moment de construire (c'est le cas chez Vercel ; en CI, prévoir une base de test ou une valeur d'exemple).
- La canonique envoyée en fin de `<body>` (métadonnées en streaming) : prise en compte par Google non tranchée ; d'où des métadonnées prérendables.
- Le test unitaire d'une page qui importe `metadata` depuis `page.tsx` : essayé sur une page sans composant client (Vitest, Biome et types passent) ; une page qui importe un composant client n'a pas été essayée.

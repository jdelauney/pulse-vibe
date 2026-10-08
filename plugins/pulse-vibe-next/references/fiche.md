# Fiche de la pile Pulse Next.js

Next.js 16.4 (App Router, Cache Components, React Compiler), React 19, TypeScript 7, Tailwind 4 et shadcn/ui (Base UI), Drizzle + Neon, better-auth, next-safe-action + Zod, TanStack Form, nuqs, pino, Biome, Vitest, Playwright, Vercel.

Ces règles s'appliquent à chaque ligne de code. Elles décrivent les versions installées, qui diffèrent souvent de vos souvenirs : en cas de doute, **lire la documentation livrée avec le projet**, `node_modules/next/dist/docs/` (exacte pour la version installée ; le fichier `AGENTS.md` que `next dev` écrit à la racine y renvoie aussi), puis la documentation officielle des autres bibliothèques.

## 1. Où vit chaque chose

L'organisation complète est dans **Architecture du code** (affichée avec cette fiche) : arborescence, sens des imports, niveaux de composants, flux, erreurs, modèles.

| Quoi | Où |
|---|---|
| Pages et mises en page | `app/` ; pages connectées dans `app/(connecte)/` |
| Règles métier | `src/core/<domaine>/` : `<sujet>.rules.ts`, `.entity.ts`, `.errors.ts`, ports, `use-cases/` |
| Tables et accès aux données | `src/db/<domaine>/` : `<sujet>.table.ts`, `<sujet>.repository.ts` |
| Écritures, lectures, écrans d'un domaine | `src/features/<domaine>/` : `actions/`, `queries/`, `schemas/`, `components/` |
| Services externes | `src/adapters/<service>/` |
| Connexion à la base | `src/db/db-client.ts` : `getDb()` et le type `Db` |
| Environnement, adresse du site, nom du projet | `src/config/` : `env.ts`, `site.ts`, `projet.ts` |
| Actions, journaux, erreurs techniques | `src/lib/` : `safe-action.ts`, `logger.ts`, `errors/` |
| Composants shadcn | `src/components/ui/` (générés par la commande shadcn, puis adaptés au thème) |
| Thème | `app/globals.css` (variables de couleur, rayon, polices) |
| Redirection vers la connexion | `proxy.ts` (racine) |
| Référencement | `src/config/site.ts`, `src/lib/seo/` (`seo.ts`, `politique-robots.ts`, `donnees-structurees.ts`), `src/components/shared/elements/json-ld.tsx`, `app/robots.ts`, `sitemap.ts`, `opengraph-image.tsx` |
| Tests | `__tests__/` près du code ; `tests/helpers/` (base de test) ; `e2e/` (Playwright) |
| Migrations | `drizzle/` (générées, relues, enregistrées) |

Projet créé avant cette organisation : il garde la sienne (« Organisation des fichiers » de son `docs/technical.md`) ; l'aligner est une tâche du plan, faite quand la personne demande un refactoring ou un alignement sur les règles du pack.

## 2. Lire des données (Cache Components)

1. **Tout est dynamique par défaut.** Une requête en base, `cookies()`, `headers()`, `params` et `searchParams` se placent dans un composant **sous `<Suspense fallback={…}>`** (ou dans une page couverte par `loading.tsx`). Hors Suspense, c'est une erreur, souvent dès la construction.
2. **La page reste légère** : titre, textes fixes et `fallback` dans la page ; la lecture dans un petit composant asynchrone placé dessous. Ce qui est au-dessus du Suspense s'affiche tout de suite.
3. **La session se lit avec `utilisateurConnecte()`** (`src/features/compte/queries/utilisateur-connecte.query.ts`, recette `connexion`) : `server-only`, `React.cache`, redirection vers `/connexion` si personne n'est connecté, objet réduit `{ id, nom }`. On l'appelle dans le composant qui en a besoin, sous Suspense, jamais au premier niveau d'un layout.
4. **Les données d'une personne se lisent sans `"use cache"`**, sous Suspense, filtrées par `utilisateur.id` dans la requête. Une mise en cache par personne suit uniquement le modèle documenté (`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`, étape 4).
5. **`"use cache"`** sert aux données communes à tous les visiteurs (catalogue, page publique). Il se place en tête de la fonction (jamais en tête de fichier), avec `cacheLife(...)` et, si une écriture doit l'invalider, `cacheTag(...)`. Interdits dedans : `cookies()`, `headers()`, `searchParams`, `connection()`. Clés et tags sont stockés en clair : un identifiant, jamais un e-mail ni un jeton.
6. **`params` et `searchParams` sont des promesses** : `const { id } = await params`, avec les types globaux `PageProps<"/factures/[id]">` et `LayoutProps<"/">`.
7. **Heure et hasard** : `await io()` (de `next/cache`) avant `new Date()`, `Date.now()` ou `Math.random()` dans un composant serveur ; sous Suspense.
8. **Options de segment retirées** : pas de `export const dynamic`, `revalidate`, `fetchCache`, `dynamicParams` ni `runtime = "edge"` (erreur avec Cache Components) ; le comportement s'exprime avec Suspense, `"use cache"` et `cacheLife`.
9. **Ressource absente ou appartenant à quelqu'un d'autre** : `notFound()`, avec un `not-found.tsx` ; un segment qui charge des données a son `loading.tsx` ; `error.tsx` est un composant client qui reçoit `{ error, retry }` (et non plus `reset`).

## 3. Écrire (Server Actions avec next-safe-action)

10. **Toute écriture passe par une action** de `features/<domaine>/actions/<action>.action.ts`, construite avec `actionConnectee` (ou `actionPublique` pour une page publique) de `src/lib/safe-action.ts`, et un schéma Zod de `schemas/<sujet>.schema.ts` (`.inputSchema(schema)`). Elle appelle un use-case s'il y a une règle métier, sinon le repository (Architecture §5).
11. **Une action est une adresse publique** : n'importe qui peut l'appeler directement. `actionConnectee` relit la session ; **l'action vérifie en plus que la donnée appartient à la personne**, dans la requête, avec la condition de propriété du repository (l'action lui passe `ctx.utilisateur.id`) : `where(and(eq(factures.id, id), eq(factures.utilisateurId, utilisateurId)))`.
12. **L'identité vient de la session (`ctx.utilisateur.id`), jamais des données reçues.**
13. **Le retour d'une action part dans le navigateur** : renvoyer seulement ce que l'écran affiche (`{ ok: true }`, un message). Une erreur attendue est une valeur de retour ; une erreur imprévue est journalisée côté serveur et remplacée par un message générique. Une erreur attendue vient d'un `Result` du métier et se traduit par `erreur-messages.ts` (Architecture §8).
14. **Après une écriture, rafraîchir ce qui est affiché** : `refresh()` (de `next/cache`) si la lecture n'est pas en cache ; `updateTag(tag)` si elle l'est avec ce tag ; `revalidateTag(tag, "max")` (deux arguments) depuis un Route Handler.
15. **`redirect()` et `notFound()` hors de tout `try/catch`**, après l'invalidation : ils interrompent le code qui suit.
16. **Cookies** : posés ou supprimés seulement dans une action ou un Route Handler, jamais pendant le rendu d'une page.

## 4. Sécurité

17. **`import "server-only"`** en tête de tout module qui touche la base, la session ou un secret (`src/db/`, `src/adapters/`, `queries/`, `src/config/env.ts`, `src/lib/logger.ts`) : un import par erreur depuis un composant client casse la construction au lieu de fuir. Un composant client lit ses variables publiques par `envPublic` de `src/config/env-public.ts`, jamais par `env`.
18. **Variables** (t3 env, validées au chargement) : secrets dans `server` de `src/config/env.ts`, lus par `env` (`import { env } from "@src/config/env"`, serveur seulement) ; variables publiques `NEXT_PUBLIC_…` dans `client` **et** dans `experimental__runtimeEnv` de `src/config/env-public.ts` (lecture écrite en entier, copiée dans le code du navigateur), lues par `envPublic` dans un composant client et par `env` sur le serveur ; jamais de secret en `NEXT_PUBLIC_`. `SKIP_ENV_VALIDATION=1` sert seulement aux constructions de vérification (CI) ; sur Vercel, la validation s'applique quand même. Chaque variable obligatoire a une valeur de test dans `VARIABLES_VALIDES` (`tests/helpers/env-de-test.ts`). `.env*` à la racine du projet, jamais dans `src/`.
19. **`proxy.ts` sert au confort** : il lit la **présence** du cookie de session et redirige vers `/connexion`, avec un `matcher` qui exclut `api`, `_next/static`, `_next/image` et les fichiers publics. La protection réelle est dans `utilisateurConnecte()` et dans chaque action. Seule lecture en base permise dans le proxy : l'existence d'un contenu publié, pour un vrai 404 (recette `seo`).
20. **HTML saisi par une personne** : l'afficher en texte simple ; si du HTML doit vraiment s'afficher, le nettoyer avec `isomorphic-dompurify` avant `dangerouslySetInnerHTML`.
21. **Journaux** (`logger` de `src/lib/logger.ts`) : côté serveur, dans les actions et les Route Handlers ; jamais de mot de passe, de jeton, ni de donnée personnelle dans un message.
22. **En-têtes de sécurité** : déjà envoyés par `next.config.ts` ; les compléter là si un service l'exige.

## 5. Base de données (Drizzle + Neon)

23. **Les repositories reçoivent la base en paramètre** : `factureRepository(db: Db)`. L'application passe `getDb()` (Neon) ; les tests passent la base de `creerBaseDeTest()` (PGlite).
24. **Deux adresses Neon** : `DATABASE_URL` (« pooled », avec `-pooler`) pour l'application, `DATABASE_URL_DIRECT` pour drizzle-kit.
25. **Changer le schéma** : modifier `src/db/<domaine>/<sujet>.table.ts`, puis `npm run db:generate` (crée la migration dans `drizzle/`), la relire, puis `npm run db:migrate`. `drizzle-kit push` est réservé à une base jetable (le garde-fou de Pulse demande confirmation).
26. **Types** : montants en centimes (`integer`), dates en `timestamp("…", { withTimezone: true })`, identifiants en `uuid` ou `text` selon la table, colonne `utilisateurId` sur chaque table qui appartient à une personne.

## 6. Interface

27. **Composants shadcn d'abord** : `npx shadcn@latest add <composant>` ; couleurs par rôle du thème (`bg-primary`, `text-muted-foreground`, `border-border`), jamais une couleur brute (`bg-blue-500`) ni une valeur en dur. Variantes avec `cva` ; classes combinées avec `cn()` (`@src/lib/utils`).
28. **Formulaires** : TanStack Form et les composants `Field` de shadcn, avec le **même schéma Zod** que l'action ; erreurs de validation du serveur affichées sous le champ ; état « en cours » sur le bouton ; message de retour avec `toast` de `sonner`. Après un envoi réussi, vider le formulaire explicitement (une page quittée garde son état au retour).
29. **Chaque liste prévoit trois états** : vide (message et action utile), chargement (`fallback` ou `loading.tsx`, avec `Skeleton`), erreur.
30. **État dans l'adresse avec nuqs** (filtres, tri, page, onglet) ; le composant client qui l'utilise est sous `<Suspense>`. **Zustand** seulement pour un état d'interface partagé entre composants clients sans lien direct. **TanStack Query** seulement pour un écran très interactif (rafraîchissement automatique, défilement infini), sous `<Suspense>`.
31. **React Compiler actif** : écrire des composants simples, sans `useMemo`, `useCallback` ni `React.memo` ajoutés par précaution.
32. **Images** avec `next/image` (texte alternatif obligatoire) ; l'image principale de la page (celle qui mesure l'affichage, LCP) reçoit `loading="eager"` **et** `fetchPriority="high"` (`fetchPriority` seul la laisse en `loading="lazy"` ; avec les deux, React ajoute aussi son préchargement dans `<head>`) ; `preload` seulement si c'est la même image principale sur tous les écrans ; `priority` est déprécié ; polices avec `next/font` dans `layout.tsx` ; titre de page avec `metadata`. Textes affichés en français.

## 7. Bibliothèques

33. **Ajouter une bibliothèque seulement quand une recette ou une tâche le demande**, avec l'accord de la personne, toujours à sa **dernière version** : `npm install <paquet>` (vérifier le nom exact et la version avec `npm view <paquet> version`). Une recette indique la version avec laquelle elle a été vérifiée ; si la dernière version publiée change de numéro majeur, lire ses notes de version avant d'écrire le code et signaler l'écart à la personne.

## 8. Pièges constatés sur ces versions

36. **Lire la requête avant la base ou la session** : `await headers()` (ou `cookies()`) **avant** `getDb()` ou `getAuth()`. Dans l'ordre inverse, la construction (`npm run build`) tente de pré-rendre la page avec la base ou la session, et échoue.
37. **Pages gardées cachées dans le document** : Next.js garde les pages déjà visitées, masquées. Deux formulaires avec `id="email"` créent des doublons : préfixer les `id` avec `useId()`. Dans Playwright, viser les champs visibles (`getByLabel("E-mail", { exact: true })` filtré avec `{ visible: true }`, ou l'aide `champ()` de la recette `connexion`).
38. **better-auth ne limite pas les appels serveur** (`auth.api.*`) : avant d'ouvrir le site au public, ajouter la recette `limite` sur la connexion et l'inscription (compteurs dans la base Neon par défaut). Un formulaire ouvert à tous (contact, devis, avis) reçoit la recette `formulaire-public` (champ piège, délai signé, limite).
39. **Après une action qui change la session** (changement de mot de passe), lire la session depuis `cookies()` (aide `enTetesDeSession()` de la recette `connexion`) : `headers()` porte encore l'ancien cookie.
40. **Un `fetch` dans un composant client** (envoi direct vers un service, lecture d'une route) : l'entourer de `try/catch` et afficher un message ; une coupure réseau lance une exception qui, sans cela, fait basculer toute la page sur l'écran d'erreur. Le tester en coupant la requête dans Playwright (`page.route(…, (route) => route.abort())`).
41. **Playwright après un clic de navigation** : attendre un élément propre à la nouvelle page (son titre) avant de remplir un champ ; deux pages peuvent avoir un champ de même libellé.
42. **Tests** : `server-only` est neutralisé par l'alias de `vitest.config.ts` ; une base PGlite neuve par test (`creerBaseDeTest()` de `tests/helpers/base-de-test.ts`), migrations de `drizzle/` appliquées.
43. **Métadonnées d'une page publique** : `metadonneesDePage({ titre, description, chemin })` de `src/lib/seo/seo.ts`. Un `openGraph` défini par une page remplace tout celui du layout, image du layout (`opengraph-image`) comprise : la fonction reconstruit la carte complète. L'adresse officielle se déclare page par page (`chemin`) ; `metadataBase` vient d'`adresseDuSite()` (dans une fonction `"use cache"`, le renvoyer en chaîne).
44. **Vrai 404** : `notFound()` au premier niveau de la page, avant tout `<Suspense>`, sans `loading.tsx` dans un segment public. Une adresse inconnue d'un segment `[slug]` répond quand même 200 avec `noindex` à Googlebot (coquille prérendue envoyée d'abord) : pour un vrai 404, vérifier l'existence dans `proxy.ts` (recette `seo`).
45. **Métadonnées publiques prérendables** : `generateMetadata` d'une page publique lit ses données en `"use cache"`, sans `cookies()` ni `headers()` ; Googlebot et les robots IA (absents de `htmlLimitedBots`) reçoivent alors titre et adresse officielle dans `<head>`. Définir `htmlLimitedBots` remplace toute la liste par défaut.
46. **Sitemap et robots** : `lastModified` = vraie date de mise à jour du contenu, jamais `new Date()` ; ni `priority` ni `changeFrequency` ; un seul robots.txt (`app/robots.ts`, pas de `public/robots.txt`).
47. **Données structurées** : `<JsonLd>` (`src/components/shared/elements/json-ld.tsx`) avec les fonctions de `src/lib/seo/donnees-structurees.ts`, jamais `JSON.stringify` nu dans `dangerouslySetInnerHTML`.
48. **Images sur l'offre Hobby de Vercel** : 5 000 transformations d'images par mois ; au-delà, les nouvelles images répondent 402 et `next/image` affiche seulement le texte alternatif. Images du site en import statique ; pour un site très illustré, prévoir l'offre Pro (`pulse-aidd pile reference contexte/perf.md`).
49. **Pages d'authentification** (connexion, inscription, mot de passe oublié, nouveau mot de passe) : `robots: { index: false, follow: false }`, hors du sitemap, accessibles à robots.txt pour que Google lise la consigne.
50. **Projet créé avant pulse-vibe-next 0.11.0** (`envServeur()`, `src/db/index.ts`) : `npm install @t3-oss/env-nextjs`, reprendre du squelette `src/config/env.ts`, `src/config/env-public.ts`, `src/config/env-commun.ts`, `src/db/db-client.ts`, `tests/helpers/env-de-test.ts` et le réglage `env` de `vitest.config.ts` ; reporter les variables du projet dans `server` d'`env.ts` (secrets) ou dans `client` + `experimental__runtimeEnv` d'`env-public.ts` (publiques, lues par `envPublic` dans les composants client), et les vérifications croisées dans le `createFinalSchema` d'`env.ts` ; supprimer `src/db/index.ts` ; remplacer `envServeur().X` par `env.X` et `@src/db` par `@src/db/db-client` ; dans les tests, `{ envServeur: () => ({…}) }` devient `{ env: {…} }`. Puis `npm run check && npm run typecheck && npm test`.

## 9. Avant de rendre la main

34. `npm run check` (Biome), `npm run typecheck`, `npm test` passent ; `npm run build` avant une mise en ligne. Une erreur Next.js de Cache Components propose une correction étiquetée (`[stream]`, `[cache]`, `[block]`) : la lire et l'appliquer.
35. Le titre de chaque test tiré d'un scénario commence par son étiquette : `US-003-1 – Facture échue hier : elle est en retard`.

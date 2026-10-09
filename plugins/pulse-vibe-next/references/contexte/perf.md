# Pack Pulse Next.js – pour /pulse:perf

Next.js 16.4 sur Vercel. Documentation exacte de la version installée : `node_modules/next/dist/docs/` (chemins ci-dessous relatifs à ce dossier).

## Mesurer le squelette en local

- Pages : `app/**/page.tsx` (un dossier entre crochets, `[id]`, est un gabarit de détail ; le groupe `(connecte)` reste hors mesure).
- Construire puis servir en mode production : `npm run build`, puis `npx next start -p 3456` en arrière-plan (un port libre) ; mesurer `http://localhost:3456/…` avec `--source local`. Arrêter ensuite ce serveur par son numéro de processus (Windows : `netstat -ano` donne le processus qui écoute le port ; `taskkill /PID <n> /T /F`).
- `npm run dev` mesure un autre site (code non optimisé, compilé à la demande) : réservé au développement.
- Sur le squelette nu, Lighthouse 13 signale `unused-javascript` (≈ 50 Kio) et `legacy-javascript-insight` (≈ 13 Kio) : c'est le socle de Next.js et React, à présenter comme normal, hors des priorités.

## Corrections Next.js 16.4, par diagnostic Lighthouse 13

| Diagnostic | Correction dans ce projet | Source (doc livrée) |
|---|---|---|
| `lcp-discovery-insight` (image principale) | `<Image … loading="eager" fetchPriority="high" />` sur l'image principale de la page, et sur elle seule. Vérifié : `fetchPriority="high"` seul laisse `loading="lazy"` (valeur par défaut) et le diagnostic reste en échec ; avec les deux, React ajoute aussi le préchargement dans `<head>`. `preload` seulement si c'est la même image principale sur tous les écrans ; `priority` est déprécié | `01-app/03-api-reference/02-components/image.md` (`preload`, `loading`, `priority`) |
| `image-delivery-insight` | `next/image` pour chaque image ; import statique (`import photo from "./photo.jpg"`) pour les images du site (dimensions et cache `immutable` automatiques) ; `sizes` juste (ex. `"(max-width: 768px) 100vw, 720px"`) ; AVIF à activer dans `next.config.ts` (`images.formats: ["image/avif", "image/webp"]` : plus léger, encodage plus long) ; `images.qualities` est obligatoire depuis Next 16 (`[75]` par défaut) : une `quality` hors liste est ramenée à la plus proche | `image.md` (`sizes`, `formats`, `qualities`, `minimumCacheTTL`) |
| `cls-culprits-insight`, `unsized-images` | `next/image` exige `width` et `height`, ou `fill` dans un parent dimensionné (`relative` + hauteur ou `aspect-*`) ; réserver la place d'un contenu chargé plus tard (`Skeleton` de même taille dans le `fallback` du `<Suspense>`) | `image.md` (`fill`) |
| `font-display-insight` | polices par `next/font` dans `app/layout.tsx` (déjà en place : auto-hébergées, `display: "swap"` par défaut, police de repli ajustée) ; une ou deux familles, les graisses utilisées seulement | `01-app/03-api-reference/02-components/font.md` |
| `render-blocking-insight` | une seule feuille de style (Tailwind), petite : la laisser. Si ce diagnostic est une vraie priorité (premières visites sur réseau lent), proposer `experimental: { inlineCss: true }` dans `next.config.ts`, avec l'accord de la personne : option **expérimentale**, styles intégrés à chaque page, sans cache séparé | `01-app/03-api-reference/05-config/01-next-config-js/inlineCss.md` |
| `third-parties-insight`, `long-tasks`, `bootup-time` | `next/script` avec `strategy="lazyOnload"` pour un outil tiers non essentiel, placé dans la page qui l'utilise (pas dans le layout) ; la stratégie `worker` reste hors App Router ; `@next/third-parties` (YouTube, Google Maps, GTM) est expérimental : le proposer avec ce statut | `01-app/02-guides/scripts.md`, `01-app/02-guides/third-party-libraries.md` |
| `unused-javascript`, `duplicated-javascript-insight`, `forced-reflow-insight`, `inp-breakdown-insight` | composants serveur par défaut, `"use client"` sur le plus petit composant interactif ; gros composant client chargé à la demande avec `next/dynamic` ; trouver les gros modules avec `npx next analyze --output` (comparaison avant/après : `--snapshot`) ; React Compiler actif : composants simples | `01-app/02-guides/lazy-loading.md`, `01-app/02-guides/package-bundling.md` |
| `document-latency-insight`, TTFB | coquille statique servie par le CDN : la page garde son titre et ses textes fixes, la lecture de données va dans un petit composant sous `<Suspense>` ; données communes avec `"use cache"` + `cacheLife(...)` ; options de segment (`export const dynamic`, `revalidate`) remplacées par ces outils ; fonctions en `fra1` (`vercel.json`), près de Neon Francfort. Base Neon en veille après 5 minutes sans requête : la première visite est plus lente (le préchauffage de `pulse-aidd perf` l'écarte de la mesure) | `01-app/02-guides/optimizing-the-static-shell.md`, fiche de la pile § 2 |
| `cache-insight` | fichiers de `/_next/static/` déjà en cache long chez Vercel ; images du site par import statique ; `images.minimumCacheTTL` (4 h par défaut) pour les images distantes | `image.md` (`minimumCacheTTL`) |
| `bf-cache` | aucun gestionnaire `unload` ; pages publiques sans `Cache-Control: no-store` ajouté à la main | — |
| Navigation interne lente (hors Core Web Vitals) | `partialPrefetching: true` (déjà dans `next.config.ts`), `<Link>` ; test `instant()` de `@next/playwright` pour protéger la coquille statique de l'accueil | `01-app/02-guides/instant-navigation.md`, `01-app/02-guides/optimizing-prefetching.md` |

Next.js propose aussi des skills d'agent officielles (`next-bundle-optimizer`, `next-cache-components-optimizer`) : `01-app/02-guides/ai-agents.md`. Les proposer comme dépendance, avec l'accord de la personne.

## Vercel

- Mesurer l'adresse de **production** : les adresses de prévisualisation sont protégées par défaut (Vercel Authentication), PageSpeed Insights reçoit alors une page de connexion.
- Offre Hobby : 5 000 transformations d'images par mois ; au-delà, les nouvelles images répondent 402 et `next/image` affiche le texte alternatif. L'offre Hobby est réservée à un usage personnel non commercial.
- Mesure réelle (Speed Insights de Vercel, ou `useReportWebVitals` vers une route du site) : lire la vue d'ensemble avec `pulse-aidd pile recette mesure-reelle`, puis charger chaque étape utile avec `pulse-aidd pile recette mesure-reelle etape <id>` (et `tests` à la demande).
- CI : la construction locale se sert avec `npm run build` puis `npx next start -p 3000` ; l'image `ubuntu-latest` de GitHub Actions contient Google Chrome.

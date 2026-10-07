# Pack Pulse Next.js – pour /pulse:seo

**Où vivent les choses** (squelette du pack) :

| Quoi | Fichier |
|---|---|
| Adresse du site (`SITE_URL`, sinon domaine de production Vercel, sinon `http://localhost:3000`) | `src/lib/site.ts` : `adresseDuSite()` |
| Métadonnées d'une page publique (titre, description, adresse officielle, carte de partage complète) | `src/lib/seo.ts` : `metadonneesDePage()` |
| Modèle de titre, `metadataBase`, carte de partage commune | `src/app/layout.tsx` |
| Politique des robots IA (A, B, C, D) | `src/lib/politique-robots.ts` ; `src/app/robots.ts` la lit |
| Sitemap (pages publiques, vraies dates) | `src/app/sitemap.ts` |
| Image de partage, icônes | `src/app/opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx` |
| Données structurées | `src/lib/donnees-structurees.ts` (fonctions typées avec `schema-dts`) et `src/components/json-ld.tsx` (`<JsonLd>`) |
| Pages connectées hors de Google | `src/app/(connecte)/layout.tsx` (`robots: { index: false, follow: false }`) |

- **audit** : construire avec `npm run build`, servir avec `npm run start` (adresse `http://localhost:3000`), puis `pulse-aidd seo http://localhost:3000 --ia --chemins "$(pulse-aidd pile seo-code --pages)"`. Ensuite `pulse-aidd pile seo-code` (contrôles C1 à C13, NC1 à NC3). Ordre de correction : C1 et C6 (adresse du site, robots, sitemap), puis les constats L4, L5, L11, puis C3 et C4 (métadonnées des pages), puis le reste.
- **bases** : `pulse-aidd pile recette seo`.
- **textes** : chaque page publique exporte `metadata = metadonneesDePage({ titre, description, chemin })` avec les textes de `docs/seo.md`, et figure dans `PAGES_PUBLIQUES` de `src/app/sitemap.ts`. L'accueil passe `accueil: true` (titre affiché tel quel).
- **ia** : changer `politiqueRobotsIa` (et, si choisis, `signalDeContenu`, `cheminsFermes`) dans `src/lib/politique-robots.ts` ; montrer le robots.txt produit (`npm run build`, `npm run start`, puis ouvrir `/robots.txt`). Les métadonnées des pages publiques restent prérendables (lectures en `"use cache"`, sans `cookies()` ni `headers()`) : Googlebot et les robots IA les reçoivent alors dans `<head>`, sans toucher à `htmlLimitedBots`.
- **lancer** : variable `SITE_URL` = l'adresse officielle (ex. `https://www.mon-site.fr`) dans Vercel, pour Production seulement, puis redéployer ; domaine et redirection des variantes dans Vercel (Project → Settings → Domains) ; vérification Search Console : « Balise de vérification » ou « Domaine personnel » des consignes Search Console du pack (`pulse-aidd pile reference contexte/search-console.md`).

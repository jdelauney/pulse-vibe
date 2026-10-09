### 7. Déplacer les pages

1. Créer le dossier `app/[locale]/`.
2. Y déplacer `page.tsx`, `error.tsx`, `not-found.tsx`, `(public)/` et `(connecte)/`.
3. Laisser dans `app/` : `api/`, `global-error.tsx`, `globals.css`, `favicon.ico`, et les fichiers du référencement (`robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx`).
4. Supprimer `app/layout.tsx` : il est remplacé à l'étape suivante.
5. Dans les pages et layouts déplacés, ajouter `[locale]` aux clés de `PageProps` et `LayoutProps` : `PageProps<"/nouveau-mot-de-passe">` devient `PageProps<"/[locale]/nouveau-mot-de-passe">`, `LayoutProps<"/">` de `app/[locale]/(connecte)/layout.tsx` devient `LayoutProps<"/[locale]">`. `npm run typecheck` signale chaque clé à corriger.


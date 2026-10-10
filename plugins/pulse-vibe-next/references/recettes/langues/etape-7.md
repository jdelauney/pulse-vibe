### 7. Déplacer les pages

1. Créer le dossier `app/[locale]/` (l'étape 5 y a déjà mis `page.tsx`).
2. Y déplacer `error.tsx`, `not-found.tsx`, `(public)/` et `(connecte)/` :

<!-- deplacer: app/error.tsx vers: app/[locale]/error.tsx -->

<!-- deplacer: app/not-found.tsx vers: app/[locale]/not-found.tsx -->

<!-- deplacer: app/(public) vers: app/[locale]/(public) -->

<!-- deplacer: app/(connecte) vers: app/[locale]/(connecte) -->

3. Supprimer `app/page.tsx` : il est remplacé par `app/[locale]/page.tsx` (étape 5) ; reporter d'abord dans ce dernier le contenu propre au projet.

<!-- supprimer: app/page.tsx -->

4. Laisser dans `app/` : `api/`, `global-error.tsx`, `globals.css`, `favicon.ico`, et les fichiers du référencement (`robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx`).
5. Supprimer `app/layout.tsx` : il est remplacé à l'étape suivante.

<!-- supprimer: app/layout.tsx -->

6. Dans les pages et layouts déplacés, ajouter `[locale]` aux clés de `PageProps` et `LayoutProps` : `PageProps<"/nouveau-mot-de-passe">` devient `PageProps<"/[locale]/nouveau-mot-de-passe">`. `npm run typecheck` signale chaque clé à corriger. Pour le layout des pages connectées :

<!-- remplacer-ligne: app/[locale]/(connecte)/layout.tsx début: export default function LayoutConnecte( -->
```tsx
export default function LayoutConnecte({ children }: LayoutProps<"/[locale]">) {
```

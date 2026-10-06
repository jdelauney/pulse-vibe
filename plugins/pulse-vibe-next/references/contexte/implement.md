# Pack Pulse Next.js – pour réaliser et corriger

- Appliquer la fiche ci-dessous à chaque fichier. En cas de doute sur une API de Next.js, lire `node_modules/next/dist/docs/` (exacte pour la version installée) avant d'écrire.
- Une tâche qui cite une recette (« Recette : connexion ») : la charger avec `pulse-aidd pile recette <nom>` et suivre ses étapes, dans l'organisation de la fiche.
- Nouvelle bibliothèque : seulement celles qu'une recette ou la fiche prévoit, à leur dernière version (`npm view <paquet> version`, puis `npm install <paquet>`), avec l'accord de la personne.
- Composant d'interface : `npx shadcn@latest add <composant>` s'il manque, puis rôles du thème uniquement.
- Une erreur de Next.js liée à Cache Components (route bloquante, donnée non mise en cache lue hors de `Suspense`, donnée de requête dans `"use cache"`) se corrige comme le message le propose : `[stream]` → envelopper dans `Suspense` ; `[cache]` → `"use cache"` pour une donnée commune à tous ; jamais `export const dynamic`.
- Avant de rendre la main : `npm run check`, `npm run typecheck`, `npm test` (et `npm run format` pour la mise en forme).

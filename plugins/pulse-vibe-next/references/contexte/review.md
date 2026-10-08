# Pack Pulse Next.js – pour relire

Contrôles propres à la pile, en plus de la checklist Pulse :

- **Chaque action** de `actions/` est construite sur `actionConnectee` (ou `actionPublique` pour une page publique, avec sa raison) avec `.inputSchema(...)`, et sa requête d'écriture filtre par `ctx.utilisateur.id` (condition de propriété). Une action qui prend l'identifiant de l'utilisateur dans ses entrées : 🔴 Critique.
- **Chaque lecture** de données personnelles filtre par la personne connectée (`utilisateurConnecte()`), sans `"use cache"` (ou selon le modèle documenté de mise en cache par personne).
- `import "server-only"` présent dans les fichiers de `src/db/`, `src/adapters/`, `queries/`, et dans `src/lib/logger.ts`.
- Aucune variable secrète préfixée `NEXT_PUBLIC_` ; variables lues par `env` (`@src/config/env`) : secrets dans `server`, publiques dans `client` et `experimental__runtimeEnv` ; aucun `process.env.X` dans `src/` hors `src/config/`.
- `dangerouslySetInnerHTML` seulement après `isomorphic-dompurify`.
- `proxy.ts` (racine) : `matcher` présent, aucune décision d'accès qui ne soit pas répétée côté serveur ; une seule lecture en base permise : l'existence d'un contenu publié pour un vrai 404 (requête légère, recette `seo`, étape 6).
- Lectures dynamiques sous `Suspense` ; pas d'`export const dynamic`, `revalidate` ni `runtime` ; `error.tsx` avec `retry`.
- Journaux sans mot de passe, jeton ni donnée personnelle.
- Couleurs par rôle du thème, aucune couleur Tailwind brute dans les composants (hors `src/components/ui/`).
- Migrations de `drizzle/` cohérentes avec les tables de `src/db/<domaine>/*.table.ts` (pas de `drizzle-kit push` sur la base partagée).
- Architecture : chaque fichier à sa place (« Architecture du code ») ; `npm run check` (imports entre couches et niveaux de composants) et `npm test` (structure : 20 fichiers par dossier, tests dans `__tests__/`) passent.

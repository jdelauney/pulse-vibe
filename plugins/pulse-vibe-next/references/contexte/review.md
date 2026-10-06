# Pack Pulse Next.js – pour relire

Contrôles propres à la pile, en plus de la checklist Pulse :

- **Chaque action** de `actions.ts` est construite sur `actionConnectee` (ou `actionPublique` pour une page publique, avec sa raison) avec `.inputSchema(...)`, et sa requête d'écriture filtre par `ctx.utilisateur.id` (condition de propriété). Une action qui prend l'identifiant de l'utilisateur dans ses entrées : 🔴 Critique.
- **Chaque lecture** de données personnelles filtre par la personne connectée (`utilisateurConnecte()`), sans `"use cache"` (ou selon le modèle documenté de mise en cache par personne).
- `import "server-only"` présent dans `src/db/index.ts`, `queries.ts`, `session.ts`, `auth.ts`, `env.ts`, `logger.ts`.
- Aucune variable secrète préfixée `NEXT_PUBLIC_` ; secrets lus par `envServeur()`.
- `dangerouslySetInnerHTML` seulement après `isomorphic-dompurify`.
- `src/proxy.ts` : `matcher` présent, aucune lecture en base, aucune décision d'accès qui ne soit pas répétée côté serveur.
- Lectures dynamiques sous `Suspense` ; pas d'`export const dynamic`, `revalidate` ni `runtime` ; `error.tsx` avec `retry`.
- Journaux sans mot de passe, jeton ni donnée personnelle.
- Couleurs par rôle du thème, aucune couleur Tailwind brute dans les composants (hors `src/components/ui/`).
- Migrations de `drizzle/` cohérentes avec `src/db/schema/` (pas de `drizzle-kit push` sur la base partagée).

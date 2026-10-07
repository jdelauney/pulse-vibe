# Pack Pulse Next.js – pour /pulse:spec

- **Écrans** : nommer la route de chaque écran (`/factures`, `/factures/[id]`) et indiquer s'il est public ou dans `src/app/(connecte)/`.
- **Écrans publics** : métadonnées par `metadonneesDePage()` (`src/lib/seo.ts`), entrée dans `src/app/sitemap.ts` ; une page de détail publique suit l'étape 5 de la recette `seo`.
- **Données** : pour chaque table, ses colonnes (montants en centimes, dates avec fuseau), son propriétaire (`utilisateurId`) et qui peut la lire ou la modifier. La section « Données et sécurité » précise, pour chaque écriture, la condition de propriété vérifiée dans l'action.
- **Fichiers** (section « Fichiers » de la spec) : d'après l'organisation de la fiche : `src/features/<domaine>/` (`actions.ts`, `queries.ts`, `schemas.ts`, `regles.ts`, `components/`), `src/db/schema/<domaine>.ts`, la page dans `src/app/`.
- **Recettes** : si l'US demande une connexion, une liste, des e-mails, des fichiers, un paiement, des langues ou une limite de requêtes, citer la recette dans la spec (« Recette : connexion ») et reprendre ses scénarios Gherkin, adaptés à l'US (étiquettes `@US-XXX-n`). Lire une recette avec `pulse-aidd pile recette <nom>`.
- **Scénarios** : niveau `@unitaire` pour une règle métier (`regles.ts`), `@integration` pour une lecture ou une action avec la base (PGlite), `@bout-en-bout` pour le parcours principal, `@securite` pour chaque règle d'accès (une autre personne ne voit ni ne modifie la donnée).

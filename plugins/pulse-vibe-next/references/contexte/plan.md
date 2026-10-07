# Pack Pulse Next.js – pour /pulse:plan

Conception technique (section du plan) :

- **Écrans** : la route de chaque écran (`/factures`, `/factures/[id]`), publique ou dans `src/app/(connecte)/`. Écran public : métadonnées par `metadonneesDePage()` (`src/lib/seo.ts`), entrée dans `src/app/sitemap.ts` ; une page de détail publique suit l'étape 5 de la recette `seo`.
- **Données** : pour chaque table, ses colonnes (montants en centimes, dates avec fuseau), son propriétaire (`utilisateurId`) et la condition de propriété vérifiée dans chaque action d'écriture.
- **Fichiers** : d'après l'organisation de la fiche : `src/features/<domaine>/` (`actions.ts`, `queries.ts`, `schemas.ts`, `regles.ts`, `components/`), `src/db/schema/<domaine>.ts`, la page dans `src/app/`.
- **Recettes** : citer chaque recette utilisée (« Recette : connexion ») dans la conception et dans les tâches concernées.

Découpage type d'une US, chaque tâche livrant quelque chose de visible et de testé :

1. **Table et migration** : `src/db/schema/<domaine>.ts`, `npm run db:generate`, migration relue ; la personne applique `npm run db:migrate` sur sa base (ligne « Action manuelle »).
2. **Règle métier** : fonction pure dans `regles.ts`, tests unitaires des scénarios `@unitaire`.
3. **Lecture** : `queries.ts` (base en paramètre), test d'intégration avec PGlite ; puis la page et ses états (vide, chargement, erreur).
4. **Écriture** : schéma Zod dans `schemas.ts`, action dans `actions.ts` (`actionConnectee`, condition de propriété), test d'intégration ; puis le formulaire (TanStack Form et `Field`).
5. **Parcours** : test de bout en bout du scénario principal (`e2e/`).

Une recette apporte ses tâches prêtes (section « Tâches de plan prêtes ») : les reprendre en les numérotant dans la suite du projet, avec la ligne « Recette : <nom> » dans chaque tâche concernée. La recette `connexion` vient avant toute US qui a des données personnelles.

Un écran public : ses métadonnées et son entrée du sitemap font partie de la même tâche. Avant « Mettre en ligne le MVP » d'un site à trouver : la recette `seo` (tâches prêtes).

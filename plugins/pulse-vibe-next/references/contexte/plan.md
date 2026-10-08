# Pack Pulse Next.js – pour /pulse:plan

Conception technique (section du plan) :

- **Écrans** : la route de chaque écran (`/factures`, `/factures/[id]`), publique ou dans `app/(connecte)/`. Écran public : métadonnées par `metadonneesDePage()` (`src/lib/seo/seo.ts`), entrée dans `app/sitemap.ts` ; une page de détail publique suit l'étape 5 de la recette `seo`.
- **Données** : pour chaque table, ses colonnes (montants en centimes, dates avec fuseau), son propriétaire (`utilisateurId`) et la condition de propriété vérifiée dans chaque action d'écriture.
- **Fichiers** : d'après « Architecture du code » : `src/core/<domaine>/` (règles, ports, use-cases), `src/db/<domaine>/` (table, repository), `src/features/<domaine>/` (`actions/`, `queries/`, `schemas/`, `components/`), la page dans `app/`.
- **Recettes** : citer chaque recette utilisée (« Recette : connexion ») dans la conception et dans les tâches concernées.

Découpage type d'une US, chaque tâche livrant quelque chose de visible et de testé :

1. **Table et migration** : `src/db/<domaine>/<sujet>.table.ts`, `npm run db:generate`, migration relue ; la personne applique `npm run db:migrate` sur sa base (ligne « Action manuelle »).
2. **Règle métier** : `src/core/<domaine>/<sujet>.rules.ts` (et `.errors.ts`), tests unitaires des scénarios `@unitaire` dans `__tests__/`.
3. **Lecture** : repository (`src/db/<domaine>/<sujet>.repository.ts`, test d'intégration PGlite), query (`queries/<lecture>.query.ts`), container et sections ; puis la page et ses états (vide, chargement, erreur).
4. **Écriture** : schéma Zod (`schemas/<sujet>.schema.ts`), use-case s'il y a une règle métier, action (`actions/<action>.action.ts`, `actionConnectee`), test d'intégration du repository ; puis le formulaire (section + container).
5. **Parcours** : test de bout en bout du scénario principal (`e2e/`).

Une recette apporte ses tâches prêtes (section « Tâches de plan prêtes ») : les reprendre en les numérotant dans la suite du projet, avec la ligne « Recette : <nom> » dans chaque tâche concernée. La recette `connexion` vient avant toute US qui a des données personnelles.

Un écran public : ses métadonnées et son entrée du sitemap font partie de la même tâche. Avant « Mettre en ligne le MVP » d'un site à trouver : la recette `seo` (tâches prêtes).

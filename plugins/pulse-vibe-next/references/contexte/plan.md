# Pack Pulse Next.js – pour /pulse:plan

Découpage type d'une US, chaque tâche livrant quelque chose de visible et de testé :

1. **Table et migration** : `src/db/schema/<domaine>.ts`, `npm run db:generate`, migration relue ; la personne applique `npm run db:migrate` sur sa base (ligne « Action manuelle »).
2. **Règle métier** : fonction pure dans `regles.ts`, tests unitaires des scénarios `@unitaire`.
3. **Lecture** : `queries.ts` (base en paramètre), test d'intégration avec PGlite ; puis la page et ses états (vide, chargement, erreur).
4. **Écriture** : schéma Zod dans `schemas.ts`, action dans `actions.ts` (`actionConnectee`, condition de propriété), test d'intégration ; puis le formulaire (TanStack Form et `Field`).
5. **Parcours** : test de bout en bout du scénario principal (`e2e/`).

Une recette apporte ses tâches prêtes (section « Tâches de plan prêtes ») : les reprendre en les numérotant dans la suite du projet, avec la ligne « Recette : <nom> » dans chaque tâche concernée. La recette `connexion` vient avant toute US qui a des données personnelles.

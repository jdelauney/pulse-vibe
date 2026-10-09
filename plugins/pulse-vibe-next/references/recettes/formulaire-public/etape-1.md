### 1. La variable `FORMULAIRE_SECRET`

Ajouter la ligne de `env.ts` (section « Variables d'environnement »), puis générer la valeur dans `.env` : `pulse-aidd secrets generer FORMULAIRE_SECRET`. Ajouter `FORMULAIRE_SECRET: "x".repeat(32),` dans `VARIABLES_VALIDES` de `tests/helpers/env-de-test.ts`, puis `npm test`.


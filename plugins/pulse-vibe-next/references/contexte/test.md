# Pack Pulse Next.js – pour les tests

- **Vitest** (`npm test`) : environnement Node ; fichiers `*.test.ts` dans un sous-dossier `__tests__/` du dossier testé ; alias `@src` vers `src/`. Les règles (`src/core/`) se testent en unitaire, les repositories (`src/db/`) en intégration, les actions, queries et containers par Playwright.
- **Base de test : PGlite** (Postgres en mémoire, `@electric-sql/pglite` et `drizzle-orm/pglite`) : une base neuve par fichier de test, migrations de `drizzle/` appliquées au départ, puis passée en paramètre aux fonctions (`db: Db`). L'aide `tests/helpers/base-de-test.ts` la prépare. La base Neon reste hors des tests.
- **Actions** : tester la logique par sa fonction métier ; pour l'action elle-même, doubler la session (`utilisateurConnecte`) avec `vi.mock`, et vérifier le refus quand la donnée appartient à quelqu'un d'autre (`@securite`).
- **Services externes** (e-mail, paiement, fichiers) : doublés aux frontières (`vi.mock` du module `src/adapters/<service>/<service>.adapter.ts`) ; en bout en bout, Mailpit pour l'e-mail.
- **Playwright** (`npm run test:e2e`) : dossier `e2e/`, projets « ordinateur » et « telephone » ; première fois : `npx playwright install chromium`. En local il lance `npm run dev` ; en CI, `npm run build && npm run start`.
- Titre de chaque test tiré d'un scénario : `US-003-1 – <titre de l'exemple>`.

# Pack Pulse Next.js – pour /pulse:perf code

Les outils de mesure de la pile, pour la procédure de `perf/code.md`. Scripts de mesure dans un dossier temporaire hors du projet ; base de test PGlite, jamais la base Neon.

| Métrique | Mesurer avec | Remarque |
|---|---|---|
| Temps d'une règle ou d'un use-case (`src/core/`) | `bench()` de Vitest (`npx vitest bench <fichier>` sur un fichier `*.bench.ts` du dossier temporaire) | médiane et écart donnés par Vitest ; données générées au volume réaliste |
| Durée d'une requête et son plan | test d'intégration PGlite (`creerBaseDeTest()` de `tests/helpers/base-de-test.ts`), requête Drizzle convertie par `.toSQL()`, puis `EXPLAIN ANALYZE` sur PGlite | un index se déclare dans `src/db/<domaine>/<sujet>.table.ts`, puis `npm run db:generate` (migration relue, appliquée par la personne) |
| Nombre de requêtes par écran (N+1) | compter les requêtes d'une query ou d'un container dans le test d'intégration | une lecture groupée (`inArray`) ou une jointure dans le repository, plutôt qu'une requête par ligne |
| Temps d'une action ou d'une page côté serveur | `npm run build` puis `npx next start -p <port libre>`, chronométrer la réponse (5 appels après une chauffe) | jamais `npm run dev` : code non optimisé ; la base Neon en veille rend la première réponse plus lente |
| Rendu et réaction d'un composant client | `<Profiler id onRender>` de React autour du composant, dans un essai Playwright | React Compiler actif : chercher d'abord un état copié ou un effet en trop (`react.md` § 2 et 3) avant toute mémoïsation |
| Poids du code envoyé au navigateur | `npx next analyze --output` (comparaison : `--snapshot`) | `"use client"` plus bas dans l'arbre, ou `next/dynamic` pour un gros composant (`contexte/perf.md`) |

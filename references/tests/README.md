# Stratégie de tests

Ces références décrivent **quoi tester, comment écrire un test et dans quel ordre**, quelle que soit **la technologie**. Les exemples sont en pseudo-code : la syntaxe réelle vient de l'outil de test retenu dans `docs/technical.md` et de sa documentation officielle.

1. **Outil et commandes** : l'outil de test, la commande qui lance les tests et celle de la couverture se trouvent dans « Commandes du projet » de `docs/technical.md`. Tests automatisés seulement si un outil de test y figure ; le test manuel reste toujours dû (`tests/test-manuel.md`).
2. **Emplacement et nommage des fichiers de test** : `qualite/organisation.md` §7.
3. **Code testable** (décider / agir séparés, dépendances injectées, règles métier pures) : `qualite/clean-code.md` §5. Un code difficile à tester se redécoupe d'abord.
4. **Dans Pulse** : les scénarios Gherkin de la spec décrivent le comportement attendu ; avec les tests d'abord (option `-t` de `/pulse:implement` et `/pulse:spirc`), les agents `pulse:test-writer` et `pulse:test-runner` appliquent ces références (procédure : `tests-automatiques.md`).
5. **Priorité** en cas de conflit : code et conventions de test existants → `CLAUDE.md` et mémoire du projet → règles communes → ces références.

| Fichier | Contenu |
|---|---|
| `tests/strategie.md` | Pyramide, choix du niveau de test, couverture, quand lancer quoi |
| `tests/ecrire-un-test.md` | Commun à tous les types : F.I.R.S.T, Fonctionnalité / Règle / Exemple, Étant donné / Quand / Alors, objet SUT, cas Z.O.M.B.I.E.S, données, assertions, doublures, signaux d'alerte |
| `tests/unitaires.md` | Règles métier, cas d'usage, conversions, logique d'interface |
| `tests/integration.md` | Accès aux données, services externes, points d'entrée serveur, base de test, pannes |
| `tests/bout-en-bout.md` | Parcours critiques, repérage des éléments, objets page, stabilité, tests après déploiement |
| `tests/gherkin.md` | Scénarios de la spec au format Gherkin : mots-clés français, écriture, étiquettes, passage au test |
| `tests/tdd.md` | Cycle rouge / vert / remaniement, les 5 étapes pour écrire un exemple, ordre des exemples |
| `tests/test-manuel.md` | Fiche de test manuel à adapter à chaque fonctionnalité, passe préalable dans le navigateur |

## Vocabulaire

| Terme | Sens |
|---|---|
| **SUT** (*System Under Test*) | Ce qu'on teste ; par extension, l'objet de test qui l'enveloppe et expose des méthodes `given…`, `when…`, `then…` |
| **Assertion** | Vérification automatique qui fait passer ou échouer le test |
| **Doublure** | Remplaçant contrôlé d'une dépendance (factice, bouchon, espion, simulacre, faux) : `tests/ecrire-un-test.md` §8 |
| **Jeu de données** (*fixture*) | Données de test prêtes à l'emploi, souvent produites par un constructeur avec valeurs par défaut |
| **Frontière** | Point où le code du projet parle à l'extérieur : réseau, base, fichiers, horloge, hasard, service tiers |
| **Test instable** (*flaky*) | Test qui passe ou échoue sans changement du code |
| **DAMP** | *Descriptive And Meaningful Phrases* : un test se lit comme une phrase métier, quitte à répéter un peu |

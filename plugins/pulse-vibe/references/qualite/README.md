# Règles de qualité du code

Ces références décrivent **comment écrire** le code, quelle que soit **la technologie**. L'emplacement réel des fichiers vient de `docs/technical.md` ; `qualite/organisation.md` sert à le décider pour un projet neuf et à le compléter là où il se tait.

1. **Vérifier dans le projet avant d'utiliser** : un fichier, un module, une table ou une bibliothèque est tenu pour existant une fois vu dans le projet. Les noms des exemples sont des exemples.
2. **Technologie, organisation et commandes** : « Pile retenue », « Organisation des fichiers » et « Commandes du projet » de `docs/technical.md`, sinon le code existant. Syntaxe et API de la technologie retenue : documentation officielle, consultée à chaque fois.
3. **Priorité** en cas de conflit : code et conventions existants → `CLAUDE.md` et mémoire du projet → règles communes et checklist sécurité → ces références.

| Fichier | Contenu | Chargement |
|---|---|---|
| `qualite/clean-code.md` | Principes, limites, nommage, testabilité, couplage, règles métier isolées, erreurs, dépendances | `pulse-aidd qualite clean-code` |
| `qualite/organisation.md` | Nommage des fichiers, suffixes, structure des dossiers par paliers, règles de dépendance, emplacement des tests | `pulse-aidd qualite organisation` ; `/pulse:tech` la lit à l'étape 6.1, projet neuf sans pack |
| `qualite/composants.md` | Présentation / orchestration, état, quatre états, formulaires, accessibilité | `pulse-aidd qualite composants` |
| `qualite/securite-code.md` | Points d'entrée sécurisés, contrôle d'accès, anti-abus (S1–S13) | `pulse-aidd qualite securite` |
| `qualite/code-concepts.md` | Code smells, SOLID, refactorings | `pulse-aidd reference qualite/code-concepts.md` |

**Règle de choix** (un appel par famille) : `clean-code` toujours ; `composants` si la tâche touche l'interface ; `securite` pour un point d'entrée serveur, une action, une route ou la base ; `organisation` pour un nouveau fichier ou dossier. Exemple : `pulse-aidd qualite clean-code`, puis `pulse-aidd qualite securite`, chaque sortie lue en entier (deux familles ensemble dépassent 30 000 caractères). Les déduire des fichiers de la tâche.

Chaque famille se termine par sa checklist ; `pulse-aidd qualite <famille> --checklists` affiche les checklists seules, pour relire. `pulse-aidd qualite --tout` charge les quatre familles d'un coup.

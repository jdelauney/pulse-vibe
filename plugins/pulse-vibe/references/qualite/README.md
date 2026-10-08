# Règles de qualité du code

Ces références décrivent **comment écrire** le code, quelle que soit **la technologie**. L'emplacement réel des fichiers vient de `docs/technical.md` ; `qualite/organisation.md` sert à le décider pour un projet neuf et à le compléter là où il se tait.

1. **Vérifier dans le projet avant d'utiliser** : un fichier, un module, une table ou une bibliothèque est tenu pour existant une fois vu dans le projet. Les noms des exemples sont des exemples.
2. **Technologie, organisation et commandes** : « Pile retenue », « Organisation des fichiers » et « Commandes du projet » de `docs/technical.md`, sinon le code existant. Syntaxe et API de la technologie retenue : documentation officielle, consultée à chaque fois.
3. **Priorité** en cas de conflit : code et conventions existants → `CLAUDE.md` et mémoire du projet → règles communes et checklist sécurité → ces références.

| Fichier | Contenu | Chargement |
|---|---|---|
| `qualite/clean-code.md` | Principes, limites, nommage, testabilité, couplage, règles métier isolées, erreurs, dépendances | `pulse-aidd qualite` |
| `qualite/organisation.md` | Nommage des fichiers, suffixes, structure des dossiers par paliers, règles de dépendance, emplacement des tests | `pulse-aidd qualite`, contexte de `/pulse:tech` |
| `qualite/composants.md` | Présentation / orchestration, état, quatre états, formulaires, accessibilité | `pulse-aidd qualite` |
| `qualite/securite-code.md` | Points d'entrée sécurisés, contrôle d'accès, anti-abus (S1–S13) | `pulse-aidd qualite` |
| `qualite/code-concepts.md` | Code smells, SOLID, refactorings | `pulse-aidd reference qualite/code-concepts.md` |

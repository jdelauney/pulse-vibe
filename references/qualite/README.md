# Règles de qualité du code

Ces références décrivent **comment écrire** le code, jamais **avec quelle technologie**. L'emplacement réel des fichiers vient de `docs/technical.md` ; `qualite/organisation.md` sert à le décider pour un projet neuf et à combler ce qu'il ne dit pas.

1. **Ne rien supposer du projet** : un fichier, un module, une table ou une bibliothèque n'existe que si on l'a vu. Les noms des exemples sont des exemples.
2. **Technologie, organisation et commandes** : « Pile retenue », « Organisation des fichiers » et « Commandes du projet » de `docs/technical.md`, sinon le code existant. Syntaxe et API de la technologie retenue : documentation officielle, jamais de mémoire.
3. **Priorité** en cas de conflit : code et conventions existants → `CLAUDE.md` et mémoire du projet → règles communes et checklist sécurité → ces références.

| Fichier | Contenu | Chargement |
|---|---|---|
| `qualite/clean-code.md` | Principes, limites, nommage, erreurs, dépendances | `pulse-aidd qualite` |
| `qualite/organisation.md` | Nommage des fichiers, suffixes, structure des dossiers par paliers, règles de dépendance, emplacement des tests | `pulse-aidd qualite`, contexte de `/pulse:tech` |
| `qualite/composants.md` | Présentation / orchestration, état, quatre états, formulaires, accessibilité | `pulse-aidd qualite` |
| `qualite/securite-code.md` | Points d'entrée sécurisés, contrôle d'accès, anti-abus (S1–S12) | `pulse-aidd qualite` |
| `qualite/code-concepts.md` | Code smells, SOLID, refactorings | `pulse-aidd reference qualite/code-concepts.md` |

# Préparer un nouveau projet

Utilisé par `/pulse:init` et `/pulse:nouveau`, dans un dossier vide ou presque. La préparation tient en deux questions : la personne parle de son idée dès le premier échange, et les réglages arrivent au moment où ils servent (les autorisations avec les choix techniques, le dépôt distant avec la mise en ligne).

1. **L'idée.** Reprendre celle que donne l'argument. Sinon, demander dans la conversation (réponse libre) : « Racontez votre idée en une phrase. » Elle devient la description du projet. Déduire de l'argument, de l'idée ou du nom du dossier un **nom** court, et l'annoncer sans question : « Je nomme le projet « carnet-reservations ». Dites-le si vous en préférez un autre. »
2. **Le niveau.** Demander (AskUserQuestion) votre **niveau** en programmation : « Jamais programmé » / « Quelques notions » / « Développeur ». Les explications valent « Normales » ; le dire en une phrase : « Je donne des explications courtes. Dites « l'essentiel » ou « plus de détails » quand vous voulez. »
3. **Git sans nom ou email** : les demander (nom affiché dans l'historique, email, qui peut être celui du compte GitHub), puis `git config --global user.name "…"` et `git config --global user.email "…"`. Expliquer : chaque version enregistrée porte le nom de son auteur.
4. **Créer** : lancer `pulse-aidd nouveau "<nom>" --ici --description "<description>" --oui`. Le script crée **uniquement les fichiers absents** (CLAUDE.md complet, avec une section « Stack technique » qui indique « Pile non choisie », `.gitignore`, `.env.example`, README, dossiers `docs/` et `aidd_docs/`, mémoire branchée) et fait le premier enregistrement Git. Il n'installe aucune technologie. Puis écrire les réponses du profil dans le bloc `<!-- pulse_profil:debut -->` de `CLAUDE.md` (lignes « Niveau » et « Explications »).
5. **Lire sa sortie** et la traduire simplement. Si elle indique que le dossier fait partie d'un autre dépôt Git : expliquer le risque (les fichiers du projet finiraient dans ce dépôt) et proposer « Créer un historique propre à ce projet (Recommandé) » → `git init -b main`, puis `git add -A -- .` et `git commit -m "chore: initialisation du projet avec Pulse"`.
6. **Le contrôle des secrets** : lancer `pulse-aidd installer-hook` : un contrôle des secrets s'exécute avant chaque commit, même fait hors de Claude Code ; le dire en une phrase.
7. **Annoncer** en une phrase : « Votre dossier est prêt. Parlons de votre idée. » Le détail du dossier s'affiche sur demande :

```
CLAUDE.md        → les règles du projet, lues par l'IA à chaque session
docs/            → les documents de la méthode (brief, PRD, choix techniques, référentiel des user stories)
aidd_docs/       → la mémoire du projet (choix, glossaire, décisions), relue par l'IA à chaque session,
                   et tasks/ : un dossier par groupe de user stories, avec chaque user story, sa spec et son plan
README.md        → la présentation du projet
.gitignore       → la liste de ce que Git doit ignorer (dont vos secrets)
.env.example     → le modèle des clés secrètes (sans les valeurs)
```

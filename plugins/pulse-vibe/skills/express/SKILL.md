---
description: Démarrer vite - en une seule conversation, l'idée, les écrans, l'apparence et les contraintes deviennent le brief, le PRD et les user stories ; puis les choix techniques et l'identité visuelle, jusqu'à la première US prête à réaliser
argument-hint: "[votre idée en une phrase]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte cicd) Bash(pulse-aidd contexte commit) Bash(pulse-aidd contexte deploy) Bash(pulse-aidd contexte express) Bash(pulse-aidd contexte perf) Bash(pulse-aidd contexte tech) Bash(pulse-aidd contexte ui) Bash(pulse-aidd etape cicd --sans-communes) Bash(pulse-aidd etape commit --sans-communes) Bash(pulse-aidd etape deploy --sans-communes) Bash(pulse-aidd etape perf --sans-communes) Bash(pulse-aidd etape tech --sans-communes) Bash(pulse-aidd etape ui --sans-communes) Bash(pulse-aidd agent designer) Bash(pulse-aidd agent ui-critic) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd comparer *) Bash(pulse-aidd identite *) Bash(pulse-aidd installer-ci) Bash(pulse-aidd installer-hook) Bash(pulse-aidd memoire) Bash(pulse-aidd perf *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd pile squelette *) Bash(pulse-aidd piles) Bash(pulse-aidd secrets inventaire *) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd seo *) Bash(pulse-aidd sessions *) Bash(pulse-aidd sonder *) Bash(pulse-aidd travail-fini) Bash(pulse-aidd verifier) Bash(pulse-aidd pile contexte *) Bash(pulse-aidd maquettes verifier *) Bash(pulse-aidd textes verifier *) Bash(pulse-aidd contraste *) Bash(pulse-aidd guide) Bash(pulse-aidd etape pr --sans-communes) Read Glob Grep Bash(start "" *.html") Bash(open *.html") Bash(xdg-open *.html") Bash(git ls-files *) Bash(git grep -n *) Bash(git grep -l *) Bash(git status *) Write(docs/brief.md) Edit(docs/brief.md) Write(docs/prd.md) Edit(docs/prd.md) Write(docs/user-stories.md) Edit(docs/user-stories.md) Write(aidd_docs/tasks/**) Edit(aidd_docs/tasks/**) Write(docs/lexique.md) Edit(docs/lexique.md) Bash(git diff *) Bash(git log *) Bash(git remote -v) Bash(git remote get-url *) Bash(git fetch origin) Bash(pulse-aidd revue *) Write(docs/technical.md) Edit(docs/technical.md) Edit(./CLAUDE.md) Write(aidd_docs/memory/**) Edit(aidd_docs/memory/**) Write(docs/design.md) Edit(docs/design.md) Write(docs/design/**) Edit(docs/design/**)
---

# /pulse:express – Démarrer vite

## Objectif

Amener la personne, dans une seule conversation, d'une idée à une première user story prête à réaliser, avec les **mêmes documents** que le parcours complet (brief, PRD, user stories, choix techniques, identité visuelle). Phrase à dire : « On va droit au but : quatre blocs de questions, un seul écran de validation, puis on choisit les outils et l'apparence. Vous pourrez tout affiner ensuite. »

La rapidité vient du regroupement des questions et des déductions que Pulse fait lui-même ; les décisions restent celles de la personne.

## Règles

Appliquer les « Règles communes Pulse » (chargées dans « Contexte ») pendant toute la commande. Appliquer aussi « Penser avant d'écrire » et les « Règles de la mémoire projet » (chargés dans « Contexte ») pendant toute la commande.

## Contexte

!`pulse-aidd contexte express`

Les modèles cités dans cette commande figurent dans ce contexte. Si ce contexte est absent, lancer `pulse-aidd contexte express` et lire sa sortie.

Idée de départ (facultative) : `$ARGUMENTS`

### Prérequis

- `CLAUDE.md` Pulse présent : sinon, proposer `/pulse:init` et s'arrêter.
- `docs/brief.md`, `docs/prd.md` ou `docs/user-stories.md` existent déjà : le projet a commencé. Proposer (AskUserQuestion) « Reprendre là où en est le projet avec `/pulse:init` (Recommandé) » / « Repartir de zéro en express (les documents existants sont remplacés) ». Remplacer seulement avec cet accord explicite.
- `aidd_docs/tasks/in-progress.md` concerne `/pulse:express` : proposer de reprendre à l'étape notée.

## Processus

### 1. Annoncer le parcours

Afficher la liste, puis la mettre à jour (⬜ → ✅) à la fin de chaque bloc :

```
⬜ L'idée          pour qui, quel problème, comment on fait aujourd'hui
⬜ Les écrans      ce qu'on voit et ce qu'on fait sur chaque écran
⬜ L'apparence     l'impression que l'outil doit donner
⬜ Les contraintes données personnelles, budget, technologie imposée, échéance, être trouvé
⬜ Validation      un seul écran récapitulatif
⬜ Outils          les choix techniques
⬜ Identité        2 apparences à comparer, vous choisissez
```

### 2. Les quatre blocs

Pour chaque bloc : poser ses questions, puis reformuler en 2 lignes (« ✔ Compris : … ») et faire confirmer. Les questions clés suivent « Penser avant d'écrire » (réponse libre, exemples d'autres métiers) ; les autres passent par AskUserQuestion, en rondes de 4 au plus. Une question déjà tranchée par l'argument ou par une réponse précédente se cite au lieu de se reposer.

1. **L'idée** (questions clés) : pour qui est l'outil ; quel problème il règle et comment la personne s'y prend aujourd'hui ; ce qui lui ferait dire « ça m'aide vraiment ».
2. **Les écrans** : proposer une liste d'écrans déduite de l'idée ; la personne ajoute, retire, renomme. Pour chaque écran principal : ce qu'on y voit, ce qu'on y fait. **Noter chaque action** (réserver, payer, envoyer, se connecter, déposer un fichier…) : c'est la source des déductions de l'étape 3. Demander s'il existe un espace réservé (administration, compte client).
3. **L'apparence** : la personnalité de l'outil en 3 mots (réponses proposées concrètes, réponse libre possible) ; 1 à 3 outils ou sites dont la personne aime l'allure. Codes couleur et polices viendront à l'étape 7.
4. **Les contraintes** : données personnelles ou sensibles ; budget mensuel accepté ; technologie imposée ou refusée ; échéance ; **être trouvé** (sur Google ou par les assistants IA : par qui, avec quels mots ; ou outil interne).

Avant de rendre la main sur une question clé ou une ronde, écrire `aidd_docs/tasks/in-progress.md` (règle commune 16).

### 3. Déduire (sans rien afficher)

À partir des quatre blocs, Pulse déduit lui-même :

- **Le MVP** (MoSCoW) : le parcours le plus court qui règle le problème principal = **Indispensable** ; le reste en Essentiel, Optionnel ou « En attente ».
- **Les groupes et les US** (règles de `/pulse:us` : identifiants, `<epic>`, `<nom>`, critères d'acceptation vérifiables, INVEST et Definition of Ready), avec un **parcours utilisateur** et un **ordre de réalisation**.
- **Les besoins techniques**, à partir des actions notées : comptes ou espace réservé → connexion ; réservation, commande, fiche, contenu géré → données partagées ; paiement → service de paiement, en mode test ; dépôt de fichiers → stockage ; e-mails ou confirmations → service d'e-mail ; plusieurs langues → traduction. Seulement ce que la personne a décrit : une mesure d'audience, par exemple, attend une demande explicite.

Une ambiguïté qui change le périmètre (paiement unique ou abonnement ? une seule personne ou une équipe ?) : poser **une seule** question ciblée.

### 4. Un seul écran de validation

```
Votre projet en un coup d'œil

Pour qui      : …
Le problème   : …
Première version : US-001 … · US-002 … · US-003 …   (Indispensables, dans l'ordre du parcours)
Ensuite       : US-004 … · US-005 …               (Essentielles, Optionnelles)
Groupes       : « … » (dossier <epic>), …
Il faudra     : connexion · données partagées · e-mails …   (déduit de vos réponses)
Proposé par Pulse : …                               (ce que vous n'avez pas dit vous-même)
```

Demander (AskUserQuestion) : « Valider (Recommandé) » / « Modifier quelque chose ». Modifier : appliquer la demande, puis remontrer l'écran.

### 5. Écrire les documents

Avec les modèles ci-dessus, en appliquant « Qui a décidé quoi » (`raisonnement.md` § 5) :

- `docs/brief.md` (blocs 1 et 2) et `aidd_docs/memory/glossary.md` (les mots du métier employés par la personne) ;
- `docs/prd.md` : objectifs, utilisateurs, MVP en MoSCoW, contraintes (bloc 4), questions ouvertes ;
- `docs/user-stories.md` (référentiel) et un fichier `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` par US ; si la mémoire projet indique un outil de ticketing, les tickets aussi (étape 6 de `/pulse:us`) ;
- les réponses du bloc 3 dans la section « Décisions prises » du brief, sur une ligne « Apparence souhaitée : <3 mots> ; références : … », pour l'étape 7.

Dans le bloc `pulse_profil` de `CLAUDE.md`, écrire « - **Rythme** : rapide » (ajouter la ligne si elle manque), et le dire en une phrase : « J'ai réglé la réalisation sur le rythme rapide : l'essentiel des tests, et un seul test complet par vous à la fin de chaque user story. Dites « rythme complet » si vous voulez tout le détail. »

Lancer `pulse-aidd memoire`, puis `pulse-aidd travail-fini`.

### 6. Les outils (choix techniques)

Annoncer : « Maintenant, on choisit les outils. » Lancer `pulse-aidd etape tech --sans-communes` et appliquer sa section « Processus » à l'identique, hors son bloc de fin de commande. Les besoins de l'étape 3 remplissent d'office le tableau « Les besoins qui guident le choix » : poser seulement les questions restantes.

### 7. L'identité visuelle

Annoncer : « Dernière étape : l'apparence. Vous allez en voir deux et choisir. » Lancer `pulse-aidd etape ui --sans-communes`, puis appliquer la section « identite » avec **2 directions** (au lieu de 2 ou 3) ; l'entretien de l'étape 2 de « identite » part des réponses du bloc 3 et pose seulement ce qui manque.

### Fin

Résumé en 4 lignes : ce qui entre dans la première version, la pile retenue, l'apparence choisie, ce qui reste à faire par la personne (comptes à créer, mise en ligne).

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:spirc <première US Indispensable du parcours>`, qui écrit sa spec, son plan, puis la réalise tâche par tâche ; à défaut, une fois le plan écrit, `/pulse:implement <US-XXX> <tâche>` pour la réaliser pas à pas. Proposer de faire `/clear` avant : la conversation repartira légère.

## Exemples

- `/pulse:express "un carnet de commandes pour ma boulangerie"` : quatre séries de questions, un seul écran récapitulatif à valider, puis le choix des outils et de l'apparence.
- `/pulse:express` dans un projet déjà commencé : la proposition de reprendre là où il en est avec `/pulse:init`, ou de repartir de zéro avec votre accord.

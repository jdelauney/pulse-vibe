---
description: Enregistrer une version dans Git - un sujet par commit, message clair, après contrôle des secrets ; option push pour l'envoyer
argument-hint: "[push] [\"message\"] (facultatifs)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Bash(git status *) Bash(git diff *) Bash(git add *) Bash(git commit *) Bash(git log *) Bash(git rev-parse *) Bash(git branch --show-current) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch --merged*) Bash(git branch -f * origin/*) Bash(git push) Bash(git push -u origin *) Bash(git symbolic-ref *) Bash(git pull *) Bash(git switch -c *) Bash(git switch feat/*) Bash(git switch main) Bash(git switch master) Bash(gh auth status*) Bash(gh pr view*) Bash(gh pr create --draft *) Bash(gh pr ready*) Bash(glab auth status*) Bash(glab mr view*) Bash(glab mr create --draft *) Bash(glab mr update --ready*) Bash(git worktree list*) Bash(git worktree add *) Bash(git merge --no-ff *) Bash(git merge --abort) EnterWorktree ExitWorktree
---

# /pulse:commit – Enregistrer une version

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte commit`

Appliquer les « Règles communes Pulse » et les « Conventions Git » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte commit` et lire sa sortie.

Arguments : `$ARGUMENTS` — le mot `push` (n'importe où) demande d'envoyer la branche après le commit ; le reste, s'il y en a, est le message proposé par la personne.

Identifiant de cette session : `${CLAUDE_SESSION_ID}` (à passer à `pulse-aidd sessions` si l'on sort d'un worktree).

## Objectif

Enregistrer l'état actuel du projet dans l'historique Git. Une phrase d'explication : « Un commit est une photo datée de votre projet, avec une légende. On peut toujours revenir à une photo précédente, avec `/pulse:annuler`. »

## Prérequis

- Le dossier doit être un dépôt Git (`git rev-parse --is-inside-work-tree`). Sinon, proposer `/pulse:init`.
- Il doit y avoir des modifications (`git status --short`). Sinon, dire que tout est déjà enregistré (avec `push` : proposer d'envoyer seulement, si des commits restent à envoyer).

## Déroulé

### 1. Contrôles de sécurité

- `.gitignore` existe et exclut le fichier local de secrets (celui de « Secrets et variables d'environnement » de `docs/technical.md`, `.env` sinon). Sinon, ajouter les lignes du modèle `.gitignore` et expliquer pourquoi.
- Les fichiers d'environnement locaux restent hors de `git status` (seul `.env.example` peut y figurer).
- Parcourir rapidement les modifications (`git diff`, nouveaux fichiers) à la recherche d'une clé ou d'un mot de passe.

Le garde-fou automatique de Pulse bloque de toute façon un commit qui contient un secret. S'il se déclenche, expliquer simplement pourquoi c'est une protection, corriger, puis recommencer.

### 2. Vérifier que la tâche a été relue

Repérer les tâches `[~]` dans les plans (`aidd_docs/tasks/*/PLAN-SPEC-US-*.md`). Pour chacune, s'il manque le rapport `<Tâche>-*.md` dans le dossier de relecture de son plan (`aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/`), demander (AskUserQuestion) : « Cette tâche attend encore sa relecture. » → « Lancer la relecture d'abord (recommandé) » / « Enregistrer quand même ». Dans le premier cas, s'arrêter et proposer `/pulse:review`. Dans le second, la ligne de journal de la tâche porte la remarque « enregistrée sans relecture, à la demande de la personne ».

### 3. Trier les modifications par sujet

Lire `git status --short` et `git diff --stat` (et `git diff --cached --stat` pour ce qui est déjà préparé), puis regrouper les fichiers par sujet (Conventions Git § 1) : la tâche en cours (fichiers listés par la tâche et ceux qu'elle a créés), la mémoire du projet, un autre changement sans rapport…

- **Un seul sujet** : continuer avec ces fichiers.
- **Plusieurs sujets** : les montrer en quelques lignes (sujet → fichiers) et proposer un commit par sujet (AskUserQuestion : « Un commit par sujet (Recommandé) » / « Tout dans un seul commit » / « Seulement la tâche, le reste plus tard »). Traiter ensuite les sujets **un par un** : étapes 4 à 6 pour chacun.
- La personne a déjà préparé des fichiers (`git add`) : les respecter, et demander avant d'en ajouter d'autres.
- Un fichier modifié inexpliqué (par la tâche comme par la personne) : le signaler et le laisser de côté par défaut.
- **Appelé par `/pulse:implement` ou `/pulse:spirc`** (une tâche à la fois) : le sujet est la tâche. Enregistrer ses fichiers (plus ceux de la mémoire acceptés pour ce commit) directement ; signaler en une ligne les autres fichiers laissés de côté.

### 4. Préparer le message

Suivre « Le message » des Conventions Git : `<type>(<Tâche>): <description>`, impératif, minuscules, sans point final, 72 caractères au plus ; un corps qui dit **pourquoi** seulement si la raison est peu évidente ; `Réf. : <US>` quand la tâche se rattache à une US (lue dans son plan ou sa spec). Expliquer les types la première fois.

Hors tâche en cours, omettre la parenthèse ou mettre une zone courte. Si la personne a proposé un message, partir du sien et l'ajuster à la convention en le lui disant.

### 5. Mettre à jour le plan

Pour chaque tâche `[~]` concernée par ce commit : la faire passer à `[x]` dans son plan (`aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`) et ajouter une ligne au tableau « Journal » de ce plan (date, tâche, message, remarque). La remarque suit « Garder la trace » des règles communes (§ 7) : mode autonome ou examen renforcé (lus dans la ligne `Mode` du rapport), test reporté ou non concluant, constats laissés sans correction, relecture absente. Le plan fait partie des fichiers de ce commit.

### 6. Enregistrer

- Montrer les fichiers de ce commit et le message.
- `git add <fichiers du sujet>` (nommer chaque fichier, plutôt que `git add -A`, tant que d'autres sujets restent), puis `git commit` avec le message (corps et `Réf.` compris).
- **Commit refusé par un contrôle** : appliquer « Quand un contrôle refuse le commit » des Conventions Git (correction mécanique dans les fichiers de ce commit, 3 essais au plus, sinon s'arrêter et expliquer ; jamais `--no-verify`).
- Afficher `git log --oneline -3` et expliquer la première ligne (identifiant court + message).

### 7. Envoyer

- **Commit d'une tâche** : appliquer « 3. Envoyer après chaque tâche enregistrée » de la référence « Le dépôt distant et l'envoi du travail », selon la ligne « Envoi » de son plan. Si un dépôt distant existe et que cette ligne vaut encore « à choisir » : appliquer d'abord son § 2 (le choix est écrit dans le plan et enregistré au commit suivant ; en mode PR, sur la branche principale, les commits non envoyés se déplacent sur la branche de l'US comme le prévoit l'étape **pr**, section B.1).
- **Autre commit** (documents, mémoire…) : envoyer seulement avec `push`.
- Branche courante : `git branch --show-current`. Dépôt distant absent (`git remote` vide) : garder le commit en local ; avec `push`, proposer `/pulse:init` pour en relier un (ou `/pulse:deploy`).
- `git push` (première fois pour cette branche : `git push -u origin <branche>`). **Jamais `--force`.** Envoi refusé parce que le dépôt distant a des changements plus récents : ne pas forcer ; expliquer et proposer `git pull` puis un nouvel envoi.
- Sur la branche principale, rappeler que l'envoi met le site à jour si le déploiement automatique est en place.

### 8. Compte rendu

En deux lignes : identifiant court et message de chaque commit, nombre de fichiers, corrections faites après un refus, résultat de l'envoi (« envoyé sur `<branche>` » ou « resté en local »).

## Suite

- S'il reste des tâches dans le plan : prochaine étape `/pulse:implement <US-XXX> <tâche suivante>`.
- Si le plan est terminé et que son « Envoi » est **PR** : appliquer « 4. Fin du plan, en mode PR » de la référence « Le dépôt distant et l'envoi du travail ». Plan terminé sur une **branche de travail** autre que la branche principale : prochaine étape `/pulse:pr`, pour proposer la fusion.
- Si le plan est terminé et que des US attendent encore leur spec : prochaine étape `/pulse:spec <US-XXX suivante du parcours>`.
- Si toutes les US Indispensables (le MVP) sont terminées, ou si la tâche suivante est « Mettre en ligne… » : prochaine étape `/pulse:deploy`.
- Si le commit a été fait **dans un worktree** (`git rev-parse --git-dir` différent de `git rev-parse --git-common-dir`) et que le plan de l'US est terminé : appliquer « 3. Terminer : rassembler le travail » de la référence worktree (`pulse-aidd reference worktree.md`).
- Si le site est déjà en ligne et que cette version reste en local : rappeler que `/pulse:commit push` (ou `git push`) mettra cette version en ligne.

Terminer avec le bloc de fin de commande.

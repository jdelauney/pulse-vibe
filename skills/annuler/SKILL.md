---
description: Revenir en arrière sans rien perdre - abandonner les changements en cours, annuler une tâche enregistrée, revenir à une version précédente, ou récupérer ce qui a été annulé ; aperçu et accord avant toute opération
argument-hint: "[T3 | US-003] (facultatif : la tâche ou l'US à annuler)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git rev-parse *) Bash(git branch *) Bash(git stash *) Bash(git revert *) Bash(git add *) Bash(git commit *) Bash(git push *) Bash(git remote *) Bash(git symbolic-ref *)
---

# /pulse:annuler – Revenir en arrière

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte annuler`

Appliquer les « Règles communes Pulse », les « Conventions Git » (en particulier « 7. Annuler ») et « Le dépôt distant et l'envoi du travail » ci-dessus pendant toute la commande. Si ce contexte est absent, lancer `pulse-aidd contexte annuler` et lire sa sortie.

Arguments : `$ARGUMENTS` — une tâche (`T3`) ou une US (`US-003` : toutes ses tâches enregistrées), facultatif.

## Objectif

Revenir en arrière **sans rien perdre** : chaque annulation est elle-même réversible. Une phrase d'explication : « Annuler ne gomme rien : j'ajoute une nouvelle version qui défait l'ancienne, ou je mets vos changements de côté. Vous pourrez toujours récupérer ce que nous annulons. »

## Prérequis

- Le dossier doit être un dépôt Git avec au moins un commit (`git rev-parse --is-inside-work-tree`, `git log --oneline -1`). Sinon, proposer `/pulse:init`.
- Une opération Git est en cours (fusion, revert interrompu : `git status` l'indique) : l'expliquer et proposer de l'interrompre proprement (`git revert --abort` ou `git merge --abort`) avant toute chose.

## Déroulé

### 1. Lire l'état

`git status --short`, `git log -15 --date=format:'%d/%m %H:%M' --format='%h %ad %s'`, `git stash list`, `git branch --list 'sauvegarde/*'`, `git remote -v`, et les plans (`aidd_docs/tasks/*/PLAN-SPEC-US-*.md`) pour relier chaque commit `(<Tâche>)` à sa tâche et à son US.

### 2. Choisir le cas

- Argument `T3` ou `US-003` : cas « Annuler une tâche enregistrée ».
- Sinon, demander (AskUserQuestion, question « Que voulez-vous annuler ? »), la recommandation selon l'état en premier :
  - « Abandonner les changements en cours » (seulement s'il y en a ; recommandé dans ce cas) ;
  - « Annuler une tâche enregistrée » ;
  - « Revenir à une version précédente » ;
  - « Récupérer quelque chose que j'ai annulé » (seulement s'il existe une mise de côté `pulse-annuler`, un commit `revert` ou une branche `sauvegarde/`).

### 3. Préciser et montrer l'aperçu

**Changements en cours** : lister les fichiers modifiés, un par ligne, avec ce qu'ils représentent (« la page d'accueil », « le plan de US-003 »). Demander : « Tout abandonner » / « Seulement certains fichiers » (puis lesquels).

**Tâche enregistrée** : trouver ses commits (`git log --format='%h %s' --grep='(<Tâche>)'`). Sans argument, proposer la dernière tâche enregistrée, ou en choisir une autre dans la liste. Montrer : le titre de la tâche, ce qu'elle apportait à l'utilisateur (son objectif dans le plan), ses commits, ses fichiers (`git show --stat`). Signaler les tâches **postérieures** qui touchent les mêmes fichiers : elles pourraient ne plus fonctionner ; proposer de les annuler aussi ou de s'arrêter.

**Version précédente** : présenter les 10 dernières versions en langage simple (« hier 17 h – T4 : permet de cocher une tâche terminée ») et demander laquelle retrouver. Montrer tout ce qui sera défait : les tâches et leurs objectifs.

Dans tous les cas, ajouter :
- **Déjà envoyé ou en ligne ?** (`git status` « ahead », adresse du site dans « Adresses » de `CLAUDE.md`) : le dire.
- **Ce qu'annuler ne défait pas**, quand cela s'applique : un schéma appliqué dans la console du fournisseur de données, des données saisies sur le site en ligne, des variables saisies chez l'hébergeur, un compte créé sur un service. Les nommer d'après le plan (lignes « Action manuelle ») et expliquer comment les défaire à la main si besoin.

### 4. Obtenir l'accord

Demander (AskUserQuestion) : « Annuler » / « Ne rien faire ». Une réponse ambiguë ou une autre réponse vaut « Ne rien faire » : le dire et s'arrêter.

### 5. Opérer

**Changements en cours** :
- `git stash push -u -m "pulse-annuler <AAAA-MM-JJ HH:MM> <résumé en quelques mots>"` (ajouter `-- <fichiers>` pour une partie seulement).
- Une tâche `[~]` dont tous les changements sont mis de côté : la remettre à `[ ]` dans son plan.

**Tâche enregistrée** :
1. Des changements non enregistrés existent : proposer d'abord de les mettre de côté (comme ci-dessus), sinon s'arrêter.
2. `git revert --no-commit <commits de la tâche, du plus récent au plus ancien>`.
3. Conflit : `git revert --abort`, expliquer simplement (« une tâche plus récente a modifié les mêmes lignes ») et proposer `/pulse:get-help`. S'arrêter.
4. Dans le plan : la tâche repasse de `[x]` à `[ ]`, et une ligne s'ajoute au Journal (date, tâche, « annulée par /pulse:annuler », remarque). Les rapports de relecture restent en place.
5. `git add <fichiers défaits> <plan>` puis `git commit` avec le message `revert(<Tâche>): annule <description de la tâche>` et un corps `Annule <commits>.`

**Version précédente** :
1. Changements non enregistrés : comme pour une tâche.
2. `git branch sauvegarde/<AAAA-MM-JJ-HHMM>` (l'état actuel, intact).
3. `git revert --no-commit <version>..HEAD`. Conflit : `git revert --abort`, expliquer, proposer `/pulse:get-help`, s'arrêter.
4. Les tâches défaites repassent à `[ ]` dans leurs plans, avec une ligne de Journal chacune.
5. Un seul commit : `revert: revient à la version du <date>` et un corps qui liste les tâches défaites.

**Récupérer** :
- Une mise de côté : `git stash list`, choisir l'entrée `pulse-annuler`, `git stash apply <entrée>`. Après vérification par la personne, proposer de supprimer l'entrée (`git stash drop <entrée>`).
- Un commit d'annulation : `git revert --no-commit <commit d'annulation>`, tâches remises à `[x]` avec une ligne de Journal, commit `revert: rétablit <description>`.
- Une branche `sauvegarde/` : l'expliquer et proposer `/pulse:get-help` si la personne veut repartir de cette branche (opération délicate).

### 6. Envoyer

Pour une tâche ou une version : appliquer « 3. Envoyer après chaque tâche enregistrée » de « Le dépôt distant et l'envoi du travail », selon la ligne « Envoi » du plan concerné. Si le site est en ligne, rappeler que cet envoi le remettra dans l'état choisi (si le déploiement automatique est en place). Toujours un envoi simple : **jamais `--force`**.

### 7. Compte rendu

En trois lignes : ce qui a été annulé, l'identifiant du commit (ou le nom de la mise de côté, de la branche de sauvegarde), et comment le récupérer : « relancez `/pulse:annuler` et choisissez *Récupérer* ».

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:status`, ou `/pulse:implement <US-XXX> <Tâche>` pour refaire autrement une tâche annulée.

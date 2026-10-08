---
description: Revenir en arrière sans rien perdre - abandonner les changements en cours, annuler une tâche enregistrée, revenir à une version précédente, ou récupérer ce qui a été annulé ; aperçu et accord avant toute opération
argument-hint: "[T3 | US-003] (facultatif : la tâche ou l'US à annuler)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte annuler) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd sessions *) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git rev-parse *) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch sauvegarde/*) Bash(git stash push *) Bash(git stash list*) Bash(git stash show *) Bash(git stash apply *) Bash(git revert *) Bash(git merge --abort) Bash(git rev-list *) Bash(git checkout --ours *) Bash(git add *) Bash(git commit -m *) Bash(git remote -v) Bash(git remote get-url *) Bash(git symbolic-ref *)
---

# /pulse:annuler – Revenir en arrière

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte annuler`

Appliquer les « Règles communes Pulse », les « Conventions Git » (en particulier « 7. Annuler ») et « Le dépôt distant et l'envoi du travail » ci-dessus pendant toute la commande. Si ce contexte est absent, lancer `pulse-aidd contexte annuler` et lire sa sortie.

Arguments : `$ARGUMENTS` — une tâche (`T3`) ou une US (`US-003` : toutes ses tâches enregistrées), facultatif.

Identifiant de cette session : `${CLAUDE_SESSION_ID}` (à passer à `pulse-aidd sessions`).

## Objectif

Revenir en arrière **sans rien perdre** : chaque annulation est elle-même réversible. Une phrase d'explication : « Annuler ne gomme rien : j'ajoute une nouvelle version qui défait l'ancienne, ou je mets vos changements de côté. Vous pourrez toujours récupérer ce que nous annulons. »

## Prérequis

- Le dossier doit être un dépôt Git avec au moins un commit (`git rev-parse --is-inside-work-tree`, `git log --oneline -1`). Sinon, proposer `/pulse:init`.
- Une opération Git est en cours (fusion, revert interrompu : `git status` l'indique) : l'expliquer et proposer de l'interrompre proprement (`git revert --abort` ou `git merge --abort`) avant toute chose. Si une autre session travaille sur ce dossier (`pulse-aidd sessions <session>`, `autres` > 0), cette opération est peut-être la sienne : le dire et laisser la personne la terminer dans cette session.

## Déroulé

### 1. Lire l'état

`git status --short`, `git log -15 --date=format:'%d/%m %H:%M' --format='%h %ad %s'`, `git stash list`, `git branch --list 'sauvegarde/*'`, `git remote -v`, `pulse-aidd sessions <session>` (la ligne `autres=N` : N > 0 signifie qu'une autre session Claude Code travaille sur ce dossier), et les plans (`aidd_docs/tasks/*/PLAN-SPEC-US-*.md`) pour relier chaque commit `(<Tâche>)` à sa tâche et à son US.

### 2. Choisir le cas

- Argument `T3` ou `US-003` : cas « Annuler une tâche enregistrée ».
- Sinon, demander (AskUserQuestion, question « Que voulez-vous annuler ? »), la recommandation selon l'état en premier :
  - « Abandonner les changements en cours » (seulement s'il y en a ; recommandé dans ce cas) ;
  - « Annuler une tâche enregistrée » ;
  - « Revenir à une version précédente » ;
  - « Récupérer quelque chose que j'ai annulé » (seulement s'il existe une mise de côté `pulse-annuler`, un commit `revert` ou une branche `sauvegarde/`).

### 3. Préciser et montrer l'aperçu

**Changements en cours** : lister les fichiers modifiés, un par ligne, avec ce qu'ils représentent (« la page d'accueil », « le plan de US-003 »). Demander : « Tout abandonner » / « Seulement certains fichiers » (puis lesquels). **Une autre session travaille sur ce dossier** (`autres` > 0) : certains de ces changements sont peut-être les siens ; le dire, et proposer seulement « Seulement certains fichiers », pour ne mettre de côté que ceux que la personne nomme.

**Toute une US** (argument `US-003`) : ses tâches enregistrées, du plus récent au plus ancien, traitées comme une seule annulation (un seul aperçu, un seul accord, un seul commit).

**Tâche enregistrée** : trouver ses commits (`git log --format='%h %s' --grep='(<Tâche>)'`). Sans argument, proposer la dernière tâche enregistrée, ou en choisir une autre dans la liste. Montrer : le titre de la tâche, ce qu'elle apportait à l'utilisateur (son objectif dans le plan), ses commits, ses fichiers (`git show --stat`). Signaler les tâches **postérieures** qui touchent les mêmes fichiers : elles pourraient ne plus fonctionner ; proposer de les annuler aussi ou de s'arrêter.

**Version précédente** : présenter les 10 dernières versions en langage simple (« hier 17 h – T4 : permet de cocher une tâche terminée ») et demander laquelle retrouver. Montrer tout ce qui sera défait : les tâches et leurs objectifs.

Dans tous les cas, ajouter :
- **Déjà envoyé ou en ligne ?** Un commit est déjà envoyé quand `git branch -r --contains <commit>` affiche au moins une branche ; le site est en ligne quand « Adresses » de `CLAUDE.md` indique son adresse. Le dire.
- **Ce qu'annuler ne défait pas**, quand cela s'applique : un schéma appliqué dans la console du fournisseur de données, des données saisies sur le site en ligne, des variables saisies chez l'hébergeur, un compte créé sur un service. Les nommer d'après le plan (lignes « Action manuelle ») et expliquer comment les défaire à la main si besoin.

### 4. Obtenir l'accord

Demander (AskUserQuestion) : « Annuler » / « Ne rien faire ». Une réponse ambiguë ou une autre réponse vaut « Ne rien faire » : le dire et s'arrêter.

### 5. Opérer

**Changements en cours** :
- `git stash push -u -m "pulse-annuler <AAAA-MM-JJ HH:MM> <résumé en quelques mots>"` (ajouter `-- <fichiers>` pour une partie seulement, et toujours quand une autre session travaille sur ce dossier).
- Une tâche `[~]` dont tous les changements sont mis de côté : la remettre à `[ ]` dans son plan.

**Défaire des commits** (utilisé par les trois cas suivants) :
- Défaire chaque commit, **du plus récent au plus ancien** : `git revert --no-commit <commit>` ; pour un commit de fusion (il a deux parents : `git rev-list --parents -n 1 <commit>` affiche trois identifiants), `git revert --no-commit -m 1 <commit>`.
- **Conflit sur un plan seulement** (`aidd_docs/tasks/*/PLAN-SPEC-US-*.md`, souvent le Journal, mis à jour par une tâche plus récente) : garder la version actuelle du plan (`git checkout --ours -- <plan>`, puis `git add <plan>`) ; la mise à jour du plan se fait ensuite à la main (étape « plan » ci-dessous). Continuer.
- **Tout autre conflit, ou toute autre erreur** de `git revert` : `git revert --abort` (l'état d'avant revient), expliquer simplement (« une tâche plus récente a modifié les mêmes lignes de code ») et proposer `/pulse:get-help`. S'arrêter.

**Tâche enregistrée, ou toute une US** :
1. Des changements non enregistrés existent : proposer d'abord de les mettre de côté (comme ci-dessus), sinon s'arrêter.
2. Défaire les commits de la tâche (ou de toutes les tâches de l'US), comme ci-dessus.
3. **Plan** : chaque tâche défaite repasse de `[x]` à `[ ]`, et une ligne s'ajoute au Journal (date, tâche, « annulée par /pulse:annuler », remarque). Les rapports de relecture restent en place.
4. `git add <fichiers défaits> <plan>` puis `git commit` avec le message `revert(<Tâche ou US>): annule <description>` et un corps `Annule <commits>.`

**Version précédente** :
1. Changements non enregistrés : comme pour une tâche.
2. `git branch sauvegarde/<AAAA-MM-JJ-HHMM>` (l'état actuel, intact).
3. Les commits à défaire sont ceux de la branche courante depuis cette version, fusions comprises : `git rev-list --first-parent <version>..HEAD` (déjà du plus récent au plus ancien). Les défaire comme ci-dessus.
4. **Plan** : les tâches défaites repassent à `[ ]` dans leurs plans, avec une ligne de Journal chacune.
5. Un seul commit : `revert: revient à la version du <date>` et un corps qui liste les tâches défaites.

**Récupérer** :
- Une mise de côté : `git stash list`, choisir l'entrée `pulse-annuler`, `git stash apply <entrée>`. Après vérification par la personne, proposer de supprimer l'entrée (`git stash drop <entrée>`).
- Un commit d'annulation : le défaire comme ci-dessus, remettre ses tâches à `[x]` avec une ligne de Journal, puis commit `revert: rétablit <description>`.
- Une branche `sauvegarde/` : l'expliquer et proposer `/pulse:get-help` si la personne veut repartir de cette branche (opération délicate).

### 6. Envoyer

Pour une tâche ou une version : appliquer « 3. Envoyer après chaque tâche enregistrée » de « Le dépôt distant et l'envoi du travail », selon la ligne « Envoi » du plan concerné. Si le site est en ligne, rappeler que cet envoi le remettra dans l'état choisi (si le déploiement automatique est en place). Toujours un envoi simple : **jamais `--force`**.

### 7. Compte rendu

En trois lignes : ce qui a été annulé, l'identifiant du commit (ou le nom de la mise de côté, de la branche de sauvegarde), et comment le récupérer : « relancez `/pulse:annuler` et choisissez *Récupérer* ».

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:status`, ou `/pulse:implement <US-XXX> <Tâche>` pour refaire autrement une tâche annulée.

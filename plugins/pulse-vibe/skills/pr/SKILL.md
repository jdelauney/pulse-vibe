---
description: Travailler sur une version parallèle et proposer de la rassembler - créer la branche de travail, puis ouvrir sur le site du dépôt la proposition en brouillon, décrite à partir des commits, du plan et des relectures
argument-hint: "[branche [<US-XXX>] | <branche de base>] (vide : ouvrir la demande pour la branche en cours)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte pr) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch --show-current) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch --merged*) Bash(git rev-parse *) Bash(git remote -v) Bash(git remote get-url *) Bash(git symbolic-ref *) Bash(git fetch origin) Bash(git switch -c *) Bash(git switch feat/*) Bash(git switch main) Bash(git switch master) Bash(gh auth status*) Bash(gh repo view *) Bash(gh pr create --draft *) Bash(gh pr view*) Bash(glab auth status*) Bash(glab repo view *) Bash(glab mr create --draft *) Bash(glab mr view*)
---

# /pulse:pr – Branche de travail et demande de fusion

## Objectif

Phrase à dire la première fois : « Une branche, c'est une version parallèle de votre projet : vous y avancez sans toucher au site en ligne. Une proposition, sur le site du dépôt, permet ensuite de rassembler ce travail dans la version principale ; on peut la relire, la tester, puis l'accepter sur le site du dépôt. »

## Règles

Appliquer les « Règles communes Pulse » (chargées dans « Contexte ») pendant toute la commande.

Appliquer aussi les « Conventions Git » (chargées dans « Contexte ») pendant toute la commande.

Cette commande **laisse toujours la fusion à la personne**, envoie les commits normalement (`--force` interdit) et laisse le code et les documents du projet tels quels.

## Contexte

!`pulse-aidd contexte pr`

Si ce contexte est absent, lancer `pulse-aidd contexte pr` et lire sa sortie.

Argument : `$ARGUMENTS`

Fichiers de cette commande : [assets/pull-request.md](assets/pull-request.md).

### Choisir l'action

| Argument | Action |
|---|---|
| `branche [<US-XXX>]` | **A. Créer la branche de travail** |
| vide | **B. Ouvrir la demande de fusion** pour la branche en cours |
| un nom de branche | **B**, avec cette branche comme base |

### Prérequis communs

- Dépôt Git (`git rev-parse --is-inside-work-tree`), sinon proposer `/pulse:init`.
- Dépôt distant (`git remote get-url origin`), sinon expliquer qu'une proposition se fait sur un dépôt en ligne et proposer `/pulse:deploy` (première mise en ligne).
- **Branche principale** : la lire (Conventions Git § 5), après `git fetch origin`, à chaque fois plutôt que la supposer.

## Processus

### A. Créer la branche de travail (`branche [<US-XXX>]`)

À faire **avant** de coder, typiquement avant `/pulse:implement <US-XXX>`.

1. Modifications non enregistrées (`git status --short`) : proposer d'abord `/pulse:commit`, sauf si la personne veut les emporter sur la nouvelle branche (elles suivent automatiquement).
2. **Nom** : à partir du plan désigné (ou de la spec, ou de la demande de la personne ; argument absent : lister les plans de `aidd_docs/tasks/` et demander, règle commune « Argument absent »), selon Conventions Git § 5 : `feat/us-xxx-<nom>` par défaut (l'identifiant de l'US et son nom, en minuscules), `fix/…` pour une correction. Le faire valider (AskUserQuestion, le nom proposé avec « (Recommandé) », « Autre nom »).
3. Partir de la branche principale à jour (Claude Code va vous demander l'accord pour `git pull` : c'est ce qui récupère la dernière version du dépôt distant) : `git switch <principale>`, `git pull`, puis `git switch -c <nom>`. Si la branche existe déjà : proposer d'y revenir (`git switch <nom>`) plutôt que d'en créer une autre.
4. Expliquer : « Vous êtes maintenant sur `<nom>`. Vos commits y seront rangés ; le site en ligne change seulement quand sa proposition est acceptée sur le site du dépôt. »

Prochaine étape : `/pulse:implement <US-XXX>`, puis `/pulse:pr` quand le travail est prêt.

### B. Ouvrir la demande de fusion

#### 1. Vérifier

- Modifications non enregistrées : proposer `/pulse:commit` d'abord et s'arrêter.
- **Sur la branche principale** :
  - Des commits n'ont pas encore été envoyés (`git log --oneline origin/<principale>..HEAD`) : proposer de les **déplacer sur une nouvelle branche** (nom comme en A.2). Expliquer : « Vos commits seront rangés sur la branche `<nom>` ; la branche principale reviendra à l'état du dépôt en ligne. Tout est conservé. » Après accord explicite (AskUserQuestion) : `git switch -c <nom>` puis `git branch -f <principale> origin/<principale>`, et vérifier avec `git log --oneline -5` que les commits sont bien sur `<nom>`.
  - Tous les commits déjà envoyés : la demande se fait depuis une branche de travail ; l'expliquer et proposer `/pulse:pr branche` pour la prochaine fois.
- Branche identique à la base : le dire et s'arrêter, la demande attend de nouveaux commits.

#### 2. Rassembler

- **Base** : l'argument s'il y en a un, sinon Conventions Git § 6. La dire en une phrase avec sa raison (« vers `main`, la branche principale du dépôt »).
- **Outil** : déduit de l'adresse du dépôt distant (Conventions Git § 6) ; vérifier la connexion (`gh auth status` ou `glab auth status`).
- **Changement** : `git log --oneline <base>..HEAD` et `git diff --stat <base>...HEAD`. Relever les tâches citées dans les commits (`(Tn)`), leur plan dans `aidd_docs/tasks/<epic>/`, l'US liée, la section « Vérification » du plan et les rapports de relecture `Tn-*.md` du dossier `revues/` de ce plan.
- Une demande existe déjà pour cette branche (`gh pr view` ou `glab mr view`) : donner son adresse et proposer de simplement envoyer les nouveaux commits (`git push`) ; garder cette demande unique.

#### 3. Rédiger

- **Modèle** : celui du dépôt s'il existe (Conventions Git § 6), sinon le modèle Pulse ci-dessus. Remplir chaque section d'après le changement, puis retirer tous les commentaires du modèle.
- **Titre** : court et parlant, 72 caractères au plus, en français.
- Une tâche sans rapport de relecture : l'indiquer dans « Relecture et sécurité » et proposer `/pulse:review` avant d'ouvrir la demande.
- Montrer titre, base et description, puis demander (AskUserQuestion) : « Ouvrir la proposition en brouillon (Recommandé) » / « Modifier le texte » / « Annuler ».

#### 4. Envoyer et créer

1. Contrôle des secrets, comme à l'étape 1 de `/pulse:commit` (fichiers d'environnement hors du suivi Git, `git diff <base>...HEAD` exempt de clé).
2. Annoncer : « Claude Code va vous demander l'accord pour envoyer : c'est ce qui met votre travail sur le dépôt distant. » Puis `git push -u origin <branche>` (jamais `--force` ; envoi refusé : expliquer, proposer `git pull` puis réessayer).
3. Créer la demande **en brouillon** :
   - GitHub : `gh pr create --draft --base <base> --head <branche> --title "<titre>" --body "<description>"` ;
   - GitLab : `glab mr create --draft --target-branch <base> --source-branch <branche> --title "<titre>" --description "<description>"`.
4. **Outil absent ou non connecté** : passer par le site du dépôt et laisser l'installation à la personne. Donner le lien à ouvrir (GitHub : `https://github.com/<compte>/<dépôt>/compare/<base>...<branche>?expand=1` ; GitLab : `<adresse du dépôt>/-/merge_requests/new?merge_request[source_branch]=<branche>`), puis le titre et la description à coller, et expliquer comment cocher « brouillon » (Draft).

#### 5. Expliquer la suite

- L'adresse de la proposition, et ce qu'est un **brouillon** : on la passe « prête » (Ready for review) quand on veut la faire relire.
- Si l'hébergeur le propose, une **adresse de prévisualisation** apparaît souvent dans la proposition : tester les « Étapes pour tester » dessus, sans toucher au site en ligne.
- Pour l'accepter : bouton « Merge » sur le site du dépôt. Ensuite, dans Claude Code : `git switch <principale>` puis `git pull` pour récupérer la version principale à jour ; la mise en ligne suit si le déploiement automatique est en place.
- D'autres commits sur la même branche ? `/pulse:commit push` : la proposition se met à jour toute seule.

### Fin

Terminer avec le bloc de fin de commande. Fichiers : « aucun » (seulement Git et le dépôt distant). Prochaine étape : selon le cas, `/pulse:implement <US-XXX>` (après A), tester la prévisualisation puis accepter la proposition sur le site du dépôt (après B).

## Exemples

- `/pulse:pr branche US-003` : un nom de branche proposé (`feat/us-003-…`) ; après votre accord, vous y travaillez sans toucher au site en ligne.
- `/pulse:pr` quand le travail est prêt : le titre et la description vous sont montrés ; après votre accord, l'envoi, puis la proposition en brouillon et son adresse sur le site du dépôt.

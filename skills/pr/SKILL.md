---
description: Travailler sur une branche et proposer ses changements - créer la branche de travail, puis ouvrir une demande de fusion (pull request) en brouillon, décrite à partir des commits, du plan et des relectures
argument-hint: "[branche [<US-XXX>] | <branche de base>] (vide : ouvrir la demande pour la branche en cours)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *) Bash(git rev-parse *) Bash(git remote *) Bash(git symbolic-ref *) Bash(git fetch *) Bash(git switch *) Bash(git pull *) Bash(git push *) Bash(gh auth status*) Bash(gh repo view *) Bash(gh pr create *) Bash(gh pr view *) Bash(glab auth status*) Bash(glab repo view *) Bash(glab mr create *) Bash(glab mr view *)
---

# /pulse:pr – Branche de travail et demande de fusion

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte pr`

Appliquer les « Règles communes Pulse » et les « Conventions Git » ci-dessus pendant toute la commande. Si ce contexte est absent, lancer `pulse-aidd contexte pr` et lire sa sortie.

Argument : `$ARGUMENTS`

## Objectif

Phrase à dire la première fois : « Une branche, c'est une copie de travail de votre projet : vous y avancez sans toucher au site en ligne. Une demande de fusion (pull request, ou PR) propose ensuite d'intégrer ce travail à la version principale ; on peut la relire, la tester, puis l'accepter sur le site du dépôt. »

| Argument | Action |
|---|---|
| `branche [<US-XXX>]` | **A. Créer la branche de travail** |
| vide | **B. Ouvrir la demande de fusion** pour la branche en cours |
| un nom de branche | **B**, avec cette branche comme base |

Cette commande **ne fusionne jamais**, ne force jamais un envoi (`--force` interdit) et ne modifie ni le code ni les documents du projet.

## Prérequis communs

- Dépôt Git (`git rev-parse --is-inside-work-tree`), sinon proposer `/pulse:init`.
- Dépôt distant (`git remote get-url origin`), sinon expliquer qu'une demande de fusion se fait sur un dépôt en ligne et proposer `/pulse:deploy` (première mise en ligne).
- **Branche principale** : la lire (Conventions Git § 5), après `git fetch origin`. Ne jamais la supposer.

## A. Créer la branche de travail (`branche [<US-XXX>]`)

À faire **avant** de coder, typiquement avant `/pulse:implement <US-XXX>`.

1. Modifications non enregistrées (`git status --short`) : proposer d'abord `/pulse:commit`, sauf si la personne veut les emporter sur la nouvelle branche (elles suivent automatiquement).
2. **Nom** : à partir du plan désigné (ou de la spec, ou de la demande de la personne ; argument absent : lister les plans de `aidd_docs/tasks/` et demander, règle commune « Argument absent »), selon Conventions Git § 5 : `feat/us-xxx-<nom>` par défaut (l'identifiant de l'US et son nom, en minuscules), `fix/…` pour une correction. Le faire valider (AskUserQuestion, le nom proposé avec « (Recommandé) », « Autre nom »).
3. Partir de la branche principale à jour : `git switch <principale>`, `git pull`, puis `git switch -c <nom>`. Si la branche existe déjà : proposer d'y revenir (`git switch <nom>`) plutôt que d'en créer une autre.
4. Expliquer : « Vous êtes maintenant sur `<nom>`. Vos commits y seront rangés ; le site en ligne ne change pas tant que la demande de fusion n'est pas acceptée. »

Prochaine étape : `/pulse:implement <US-XXX>`, puis `/pulse:pr` quand le travail est prêt.

## B. Ouvrir la demande de fusion

### 1. Vérifier

- Modifications non enregistrées : proposer `/pulse:commit` d'abord et s'arrêter.
- **Sur la branche principale** :
  - Des commits n'ont pas encore été envoyés (`git log --oneline origin/<principale>..HEAD`) : proposer de les **déplacer sur une nouvelle branche** (nom comme en A.2). Expliquer : « Vos commits seront rangés sur la branche `<nom>` ; la branche principale reviendra à l'état du dépôt en ligne. Rien n'est perdu. » Après accord explicite (AskUserQuestion) : `git switch -c <nom>` puis `git branch -f <principale> origin/<principale>`, et vérifier avec `git log --oneline -5` que les commits sont bien sur `<nom>`.
  - Rien à déplacer : il n'y a rien à proposer ; expliquer et proposer `/pulse:pr branche` pour la prochaine fois.
- Aucun commit depuis la base : rien à proposer, le dire.

### 2. Rassembler

- **Base** : l'argument s'il y en a un, sinon Conventions Git § 6. La dire en une phrase avec sa raison (« vers `main`, la branche principale du dépôt »).
- **Outil** : déduit de l'adresse du dépôt distant (Conventions Git § 6) ; vérifier la connexion (`gh auth status` ou `glab auth status`).
- **Changement** : `git log --oneline <base>..HEAD` et `git diff --stat <base>...HEAD`. Relever les tâches citées dans les commits (`(Tn)`), leur plan dans `aidd_docs/tasks/<epic>/`, l'US liée, la section « Vérification » du plan et les rapports de relecture `Tn-*.md` du dossier `revues/` de ce plan.
- Une demande existe déjà pour cette branche (`gh pr view` ou `glab mr view`) : donner son adresse et proposer de simplement envoyer les nouveaux commits (`git push`) ; ne pas en créer une deuxième.

### 3. Rédiger

- **Modèle** : celui du dépôt s'il existe (Conventions Git § 6), sinon le modèle Pulse ci-dessus. Remplir chaque section d'après le changement, puis retirer tous les commentaires du modèle.
- **Titre** : court et parlant, 72 caractères au plus, en français.
- Une tâche sans rapport de relecture : l'indiquer dans « Relecture et sécurité » et proposer `/pulse:review` avant d'ouvrir la demande.
- Montrer titre, base et description, puis demander (AskUserQuestion) : « Ouvrir la demande en brouillon (Recommandé) » / « Modifier le texte » / « Annuler ».

### 4. Envoyer et créer

1. Contrôle des secrets, comme à l'étape 1 de `/pulse:commit` (aucun fichier d'environnement suivi, aucune clé dans `git diff <base>...HEAD`).
2. `git push -u origin <branche>` (jamais `--force` ; envoi refusé : expliquer, proposer `git pull` puis réessayer).
3. Créer la demande **en brouillon** :
   - GitHub : `gh pr create --draft --base <base> --head <branche> --title "<titre>" --body "<description>"` ;
   - GitLab : `glab mr create --draft --target-branch <base> --source-branch <branche> --title "<titre>" --description "<description>"`.
4. **Outil absent ou non connecté** : ne rien installer. Donner le lien à ouvrir (GitHub : `https://github.com/<compte>/<dépôt>/compare/<base>...<branche>?expand=1` ; GitLab : `<adresse du dépôt>/-/merge_requests/new?merge_request[source_branch]=<branche>`), puis le titre et la description à coller, et expliquer comment cocher « brouillon » (Draft).

### 5. Expliquer la suite

- L'adresse de la demande, et ce qu'est un **brouillon** : on la passe « prête » (Ready for review) quand on veut la faire relire.
- Si l'hébergeur le propose, une **adresse de prévisualisation** apparaît souvent dans la demande : tester les « Étapes pour tester » dessus, sans toucher au site en ligne.
- Pour fusionner : bouton « Merge » sur le site du dépôt. Ensuite, dans Claude Code : `git switch <principale>` puis `git pull` pour récupérer la version fusionnée ; la mise en ligne suit si le déploiement automatique est en place.
- D'autres commits sur la même branche ? `/pulse:commit push` : la demande se met à jour toute seule.

## Fin

Terminer avec le bloc de fin de commande. Fichiers : « aucun » (seulement Git et le dépôt distant). Prochaine étape : selon le cas, `/pulse:implement <US-XXX>` (après A), tester la prévisualisation puis fusionner (après B).

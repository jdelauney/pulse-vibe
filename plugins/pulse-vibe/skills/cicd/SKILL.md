---
description: Mettre en place les contrôles automatiques - secrets, règles du code, tests et construction vérifiés à chaque envoi et sur chaque proposition de version parallèle, adaptés au fournisseur du dépôt distant ; puis, au choix, protéger la branche principale
argument-hint: "[proteger] (vide : installer ou mettre à jour les contrôles automatiques)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte cicd) Bash(pulse-aidd etape fix --sans-noyau) Bash(pulse-aidd etape auto-fix --sans-noyau) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite *) Bash(pulse-aidd tests *) Bash(pulse-aidd scenarios) Bash(pulse-aidd installer-ci) Bash(pulse-aidd installer-hook) Bash(pulse-aidd perf installer) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Read Glob Grep Bash(git status *) Bash(git remote -v) Bash(git remote get-url *) Bash(git branch --show-current) Bash(git log *) Bash(git rev-parse *) Bash(git add *) Bash(git commit -m *) Bash(node scripts/verifier.js) Bash(gh auth status*) Bash(gh run list*) Bash(gh run watch*) Bash(gh run view*) Bash(glab auth status*) Bash(glab ci status*) Bash(glab ci view*) Edit(docs/technical.md) Write(docs/performance.md) Edit(docs/performance.md) Bash(pulse-aidd contexte auto-fix) Bash(pulse-aidd verifier) Bash(pulse-aidd agent fixer) Bash(pulse-aidd contexte fix) Bash(pulse-aidd pile contexte *) Bash(pulse-aidd etape *) Bash(pulse-aidd agent *) Bash(git diff *) Bash(pulse-aidd preuve *) Bash(pulse-aidd verifier --index)
---

# /pulse:cicd – Les contrôles automatiques (CI)

## Objectif

Expliquer en deux phrases : « L'intégration continue (CI), c'est un contrôle qualité automatique : à chaque envoi et sur chaque proposition de version parallèle, le fournisseur du dépôt vérifie que les secrets restent hors du code, que chaque scénario prévu en test automatique a bien son test, que les dépendances n'ont pas de faille grave connue, que le code respecte les règles et que l'appli se construit. Une croix rouge vous prévient avant que l'erreur n'arrive sur le site. »

Le **déploiement continu (CD)**, la mise en ligne automatique à chaque envoi, se met en place avec `/pulse:deploy` : cette commande se limite à la CI.

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte cicd` et lire sa sortie en entier, fichier enregistré compris) pendant toute la commande.

## Contexte

Argument : `$ARGUMENTS`

### Choisir l'action

| Argument | Action |
|---|---|
| vide | Installer la CI, ou la mettre à jour si elle existe (§ 1 à 6), puis proposer la protection (§ 7) et les mises à jour des dépendances (§ 8) |
| `proteger` | Seulement protéger la branche principale (§ 7) ; la CI doit déjà exister |

### Prérequis

- `docs/technical.md` est nécessaire (« Commandes du projet », « Hébergement et mise en ligne ») : sinon, proposer `/pulse:tech` et s'arrêter.
- Un **dépôt distant** relié (`git remote -v`) : sinon, et seulement dans ce cas, lancer `pulse-aidd reference depot-distant.md` et appliquer sa section « 1. Relier le projet à un dépôt distant » ; s'arrêter tant qu'il manque (la CI tourne chez son fournisseur).
- Le **squelette** de la pile en place (« Mise en place » de `docs/technical.md` faite, les fichiers qu'elle annonce présents) : sinon, les contrôles attendent encore du code à vérifier. Proposer « Installer seulement le contrôle des secrets maintenant » / « Attendre la première tâche du plan (Recommandé) ».
- Des modifications non enregistrées : proposer de taper `/pulse:commit` d'abord, pour que le commit de la CI contienne uniquement la CI.
- Pour tout ce qui est propre au fournisseur de CI (emplacement et format du fichier, déclencheurs, étapes, réglages du dépôt) : suivre sa **documentation officielle** (outil de documentation comme context7 s'il est disponible, sinon WebFetch). Tirer de cette documentation chaque syntaxe, nom d'action ou menu.

## Processus

### 1. Choisir l'outil de CI

- Celui de « Hébergement et mise en ligne » de `docs/technical.md` (ligne « Contrôle automatique avant mise en ligne (CI) ») s'il est renseigné.
- Sinon, celui du fournisseur du dépôt distant, déduit de `git remote get-url origin` : GitHub → GitHub Actions ; GitLab → GitLab CI/CD. Le proposer en une phrase (« c'est la CI intégrée à votre dépôt : déjà prête et gratuite pour un petit projet »), avec « Autre outil » en alternative.
- Une CI existe déjà (fichier de l'outil retenu, par exemple `.github/workflows/*.yml` ou `.gitlab-ci.yml`) : la lire, et proposer de la **compléter** plutôt que de la remplacer.
- La ligne « Auditer les dépendances » de « Commandes du projet » manque (ancien `docs/technical.md`) : la remplir d'après la documentation officielle de la pile (l'outil d'audit des vulnérabilités de son gestionnaire de paquets), sinon écrire « aucune » ; la CI saute alors cette étape.

### 2. Préparer

Lancer `pulse-aidd installer-ci` : il copie `scripts/verifier.js` (le contrôle des secrets et, dans un projet Pulse, des scénarios sans test des US terminées ; sans dépendance) et `scripts/ci-verifications.exemple.yml` (la liste des étapes, à traduire pour l'outil retenu).

Lancer aussi `pulse-aidd installer-hook` : le même contrôle des secrets s'exécute avant chaque commit, y compris ceux faits hors de Claude Code (éditeur, terminal). Si le projet a déjà ses contrôles avant commit (Husky…), suivre le message affiché pour y ajouter la ligne.

### 3. Écrire le fichier de CI

D'après la documentation officielle de l'outil retenu, à l'emplacement qu'elle impose :

- **Déclencheurs** : chaque envoi sur la branche principale, et chaque demande de fusion (PR / MR) vers elle.
- **Étapes** : celles de `scripts/ci-verifications.exemple.yml` (copié à l'étape 2), dans son ordre, avec les commandes de « Commandes du projet », en sautant celles qui valent « aucune ». Node.js reste disponible pour `node scripts/verifier.js`, même si la pile utilise un autre langage. L'audit des dépendances (« Auditer les dépendances ») fait échouer la CI sur une faille de gravité élevée ou critique.
- **Versions fixées** pour chaque action ou image utilisée, comme pour une bibliothèque (règle commune 8).
- **Secrets hors du fichier**. Si la construction a besoin d'une variable d'environnement, écrire seulement son **nom** ; la personne saisit elle-même la valeur dans les réglages du dépôt (« secrets » ou « variables » de la CI), guidée pas à pas. La valeur va uniquement dans ces réglages, jamais dans la conversation.
- Montrer le fichier complet, expliquer chaque bloc en une ligne, puis l'écrire avec accord. Supprimer ensuite `scripts/ci-verifications.exemple.yml`, devenu inutile.
- **Vitesse** (facultatif) : seulement si `docs/performance.md` contient une section « Budget », proposer la vérification de vitesse : `pulse-aidd reference perf/ci-vitesse.md`, à appliquer telle quelle, puis noter la façon choisie dans « Mesure réelle et suivi » de `docs/performance.md`. Sans budget : la proposer plus tard avec `/pulse:perf suivre`.

### 4. Essayer en local d'abord

Lancer `pulse-aidd preuve lancer --portee suite --construire`, puis l'audit des dépendances et `node scripts/verifier.js` : les mêmes contrôles que la CI. Une erreur ici serait une croix rouge là-bas : la corriger d'abord (`pulse-aidd etape auto-fix --sans-noyau` pour le lint et les types, `pulse-aidd etape fix --sans-noyau` pour un test), ou s'arrêter et l'expliquer.

### 5. Enregistrer et envoyer

- Commit `ci: contrôles automatiques à chaque envoi et sur chaque proposition` (`scripts/verifier.js`, le fichier de CI) : `git add` de ces fichiers, `pulse-aidd verifier --index`, puis `git commit -m "<sujet>"`.
- Annoncer : « Claude Code va vous demander l'accord pour envoyer : c'est ce qui met le fichier de CI sur le dépôt distant. » Puis l'envoyer (`git push`) : la CI tourne seulement après l'envoi.
- Commit ou envoi refusé : seulement dans ce cas, lancer `pulse-aidd reference git.md` et suivre « Quand un contrôle refuse le commit » (§ 3) ou « Envoyer (push) » (§ 4).
- Mettre à jour la ligne « Contrôle automatique avant mise en ligne (CI) » de « Hébergement et mise en ligne » dans `docs/technical.md` (outil, fichier, ce qu'il contrôle), dans le même commit ou un commit `docs: CI`.

### 6. Voir le premier passage

- Montrer où suivre le résultat : l'onglet de la CI sur le site du dépôt, ou en ligne de commande si l'outil est connecté (GitHub : `gh run list --limit 1`, puis `gh run watch` ; GitLab : `glab ci status`).
- **Coche verte** : expliquer qu'elle apparaîtra désormais à chaque envoi et sur chaque proposition de version parallèle.
- **Croix rouge** : lire le journal de l'étape en échec (GitHub : `gh run view --log-failed`), l'expliquer simplement, corriger (`pulse-aidd etape fix --sans-noyau`), enregistrer et renvoyer. Deux essais au plus, puis s'arrêter et proposer de taper `/pulse:get-help`.

### 7. Protéger la branche principale (facultatif)

Proposer (AskUserQuestion) : « Accepter une version parallèle seulement si ses contrôles sont verts (Recommandé si vous publiez par versions parallèles) » / « Plus tard ». Expliquer : « La branche principale est celle qui part en ligne : avec cette protection, une version parallèle y est rassemblée seulement si ses contrôles automatiques sont verts. »

- Guider la personne pas à pas dans les réglages du dépôt, d'après la documentation officielle du fournisseur (règles de protection de branche) : la protection se règle sur le site, par la personne.
- Selon l'offre du fournisseur, cette protection peut être indisponible pour un dépôt **privé** gratuit : le vérifier dans sa documentation et le dire simplement. La CI reste utile : la croix rouge reste visible sur chaque demande.
- Avec la protection, l'envoi direct sur la branche principale peut être refusé : le rappeler si des plans ont « **Envoi** : branche principale », et proposer de passer en mode PR (`/pulse:refine US-XXX "changer l'envoi"`).

### 8. Mises à jour des dépendances (facultatif)

Proposer (AskUserQuestion) : « Recevoir chaque semaine une proposition pour les nouvelles versions des dépendances (Recommandé) » / « Plus tard ». Expliquer : « Un robot du dépôt propose les nouvelles versions, failles corrigées comprises ; la CI vérifie chacune avant que vous l'acceptiez. »

- GitHub : Dependabot (fichier `.github/dependabot.yml`) ; GitLab ou autre fournisseur : Renovate. Écrire la configuration d'après la documentation officielle de l'outil : l'écosystème de la pile retenue, et celui des actions de la CI ; fréquence hebdomadaire.
- Montrer le fichier, expliquer chaque bloc en une ligne, puis l'enregistrer et l'envoyer comme en § 5.
- Chaque demande reçue se relit et se fusionne par la personne, sur le site du dépôt, une fois la CI verte.

### Fin

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:deploy` si l'appli reste à mettre en ligne (la CI et le déploiement automatique se complètent), sinon reprendre le travail en cours (`/pulse:status`).

## Exemples

- `/pulse:cicd` : un contrôle automatique écrit pour votre dépôt, essayé d'abord sur votre ordinateur, puis envoyé ; vous voyez ensuite la coche verte ou la croix rouge.
- `/pulse:cicd proteger` : un guidage pas à pas pour que seules les versions aux contrôles verts rejoignent la branche principale.

## Références de la commande

!`pulse-aidd contexte cicd`

Si ce contexte est absent, lancer `pulse-aidd contexte cicd` et lire sa sortie en entier, fichier enregistré compris.

---
description: Mettre en place l'intégration continue (CI) - contrôles automatiques (secrets, lint, tests, construction) à chaque envoi et sur chaque demande de fusion, adaptés au fournisseur du dépôt distant ; puis, au choix, protéger la branche principale
argument-hint: "[proteger] (vide : installer ou mettre à jour la CI)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte cicd) Bash(pulse-aidd contexte perf) Bash(pulse-aidd etape perf) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd installer-ci) Bash(pulse-aidd installer-hook) Bash(pulse-aidd perf *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd sonder *) Read Glob Grep Bash(git status *) Bash(git remote -v) Bash(git remote get-url *) Bash(git branch --show-current) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch --merged*) Bash(git log *) Bash(git rev-parse *) Bash(git add *) Bash(git commit -m *) Bash(node scripts/verifier.js) Bash(gh auth status*) Bash(gh run list*) Bash(gh run watch*) Bash(gh run view*) Bash(glab auth status*) Bash(glab ci status*) Bash(glab ci view*)
---

# /pulse:cicd – Les contrôles automatiques (CI)

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte cicd`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte cicd` et lire sa sortie.

Argument : `$ARGUMENTS`

## Objectif

Expliquer en deux phrases : « L'intégration continue (CI), c'est un contrôle qualité automatique : à chaque envoi et sur chaque demande de fusion, le fournisseur du dépôt vérifie que les secrets restent hors du code, que chaque scénario prévu en test automatique a bien son test, que les dépendances n'ont pas de faille grave connue, que le code respecte les règles et que l'appli se construit. Une croix rouge vous prévient avant que l'erreur n'arrive sur le site. »

Le **déploiement continu (CD)**, la mise en ligne automatique à chaque envoi, se met en place avec `/pulse:deploy` : cette commande se limite à la CI.

| Argument | Action |
|---|---|
| vide | Installer la CI, ou la mettre à jour si elle existe (§ 1 à 6), puis proposer la protection (§ 7) et les mises à jour des dépendances (§ 8) |
| `proteger` | Seulement protéger la branche principale (§ 7) ; la CI doit déjà exister |

## Prérequis

- `docs/technical.md` est nécessaire (« Commandes du projet », « Hébergement et mise en ligne ») : sinon, proposer `/pulse:tech` et s'arrêter.
- Un **dépôt distant** relié (`git remote -v`) : sinon, appliquer « 1. Relier le projet à un dépôt distant » de la référence « Le dépôt distant et l'envoi du travail » ; s'arrêter tant qu'il manque (la CI tourne chez son fournisseur).
- Le **squelette** de la pile en place (« Mise en place » de `docs/technical.md` faite, les fichiers qu'elle annonce présents) : sinon, les contrôles attendent encore du code à vérifier. Proposer « Installer seulement le contrôle des secrets maintenant » / « Attendre la première tâche du plan (Recommandé) ».
- Des modifications non enregistrées : proposer `/pulse:commit` d'abord, pour que le commit de la CI contienne uniquement la CI.
- Pour tout ce qui est propre au fournisseur de CI (emplacement et format du fichier, déclencheurs, étapes, réglages du dépôt) : suivre sa **documentation officielle** (outil de documentation comme context7 s'il est disponible, sinon WebFetch). Tirer de cette documentation chaque syntaxe, nom d'action ou menu.

## 1. Choisir l'outil de CI

- Celui de « Hébergement et mise en ligne » de `docs/technical.md` (ligne « Contrôle automatique avant mise en ligne (CI) ») s'il est renseigné.
- Sinon, celui du fournisseur du dépôt distant, déduit de `git remote get-url origin` : GitHub → GitHub Actions ; GitLab → GitLab CI/CD. Le proposer en une phrase (« c'est la CI intégrée à votre dépôt : déjà prête et gratuite pour un petit projet »), avec « Autre outil » en alternative.
- Une CI existe déjà (fichier de l'outil retenu, par exemple `.github/workflows/*.yml` ou `.gitlab-ci.yml`) : la lire, et proposer de la **compléter** plutôt que de la remplacer.
- La ligne « Auditer les dépendances » de « Commandes du projet » manque (ancien `docs/technical.md`) : la remplir d'après la documentation officielle de la pile (l'outil d'audit des vulnérabilités de son gestionnaire de paquets), sinon écrire « aucune » ; la CI saute alors cette étape.

## 2. Préparer

Lancer `pulse-aidd installer-ci` : il copie `scripts/verifier.js` (le contrôle des secrets et, dans un projet Pulse, des scénarios sans test des US terminées ; sans dépendance) et `scripts/ci-verifications.exemple.yml` (la liste des étapes, à traduire pour l'outil retenu).

Lancer aussi `pulse-aidd installer-hook` : le même contrôle des secrets s'exécute avant chaque commit, y compris ceux faits hors de Claude Code (éditeur, terminal). Si le projet a déjà ses contrôles avant commit (Husky…), suivre le message affiché pour y ajouter la ligne.

## 3. Écrire le fichier de CI

D'après la documentation officielle de l'outil retenu, à l'emplacement qu'elle impose :

- **Déclencheurs** : chaque envoi sur la branche principale, et chaque demande de fusion (PR / MR) vers elle.
- **Étapes**, dans l'ordre, en sautant celles qui valent « aucune » dans « Commandes du projet » :
  1. récupérer le code ;
  2. installer l'environnement d'exécution de la pile retenue, à la version de « Pile retenue » ;
  3. installer les dépendances (« installer ») ;
  4. contrôler les secrets et les scénarios : `node scripts/verifier.js` (Node.js doit être disponible : l'installer dans une étape si la pile utilise un autre langage que JavaScript) ;
  5. auditer les dépendances (« Auditer les dépendances » : une faille de gravité élevée ou critique fait échouer la CI) ;
  6. les contrôles automatiques (lint, format, types) ;
  7. les tests (« tester ») ;
  8. la construction (« construire »).
- **Versions fixées** pour chaque action ou image utilisée, comme pour une bibliothèque (règle commune 8).
- **Secrets hors du fichier**. Si la construction a besoin d'une variable d'environnement, écrire seulement son **nom** ; la personne saisit elle-même la valeur dans les réglages du dépôt (« secrets » ou « variables » de la CI), guidée pas à pas. La valeur va uniquement dans ces réglages, jamais dans la conversation.
- Montrer le fichier complet, expliquer chaque bloc en une ligne, puis l'écrire avec accord. Supprimer ensuite `scripts/ci-verifications.exemple.yml`, devenu inutile.
- **Vitesse** (facultatif) : si `docs/performance.md` contient une section « Budget », proposer la vérification de vitesse de « suivre » de `/pulse:perf` (`pulse-aidd etape perf`, volet 3) : chaque semaine sur le site en ligne (recommandé), ou sur chaque demande de fusion contre la construction locale. Sans budget : la proposer plus tard avec `/pulse:perf suivre`.

## 4. Essayer en local d'abord

Lancer, dans l'ordre, les mêmes commandes que la CI : `node scripts/verifier.js`, l'audit des dépendances, les contrôles automatiques, les tests, la construction. Une erreur ici serait une croix rouge là-bas : la corriger d'abord (`/pulse:fix` ou `/pulse:auto-fix`), ou s'arrêter et l'expliquer.

## 5. Enregistrer et envoyer

- Commit `ci: contrôles automatiques à chaque envoi et demande de fusion` (`scripts/verifier.js`, le fichier de CI), avec les contrôles de sécurité de `/pulse:commit`.
- Annoncer : « Claude Code va vous demander l'accord pour envoyer : c'est ce qui met le fichier de CI sur le dépôt distant. » Puis l'envoyer (`git push`, jamais `--force`) : la CI tourne seulement après l'envoi.
- Mettre à jour la ligne « Contrôle automatique avant mise en ligne (CI) » de « Hébergement et mise en ligne » dans `docs/technical.md` (outil, fichier, ce qu'il contrôle), dans le même commit ou un commit `docs: CI`.

## 6. Voir le premier passage

- Montrer où suivre le résultat : l'onglet de la CI sur le site du dépôt, ou en ligne de commande si l'outil est connecté (GitHub : `gh run list --limit 1`, puis `gh run watch` ; GitLab : `glab ci status`).
- **Coche verte** : expliquer qu'elle apparaîtra désormais à chaque envoi et sur chaque demande de fusion.
- **Croix rouge** : lire le journal de l'étape en échec (GitHub : `gh run view --log-failed`), l'expliquer simplement, corriger (ou `/pulse:fix`), enregistrer et renvoyer. Deux essais au plus, puis s'arrêter et proposer `/pulse:get-help`.

## 7. Protéger la branche principale (facultatif)

Proposer (AskUserQuestion) : « Exiger que les contrôles passent avant toute fusion (Recommandé si vous travaillez avec des demandes de fusion) » / « Plus tard ». Expliquer : « La branche principale est celle qui part en ligne : avec cette protection, une demande de fusion est acceptée seulement si la CI est verte. »

- Guider la personne pas à pas dans les réglages du dépôt, d'après la documentation officielle du fournisseur (règles de protection de branche) : la protection se règle sur le site, par la personne.
- Selon l'offre du fournisseur, cette protection peut être indisponible pour un dépôt **privé** gratuit : le vérifier dans sa documentation et le dire simplement. La CI reste utile : la croix rouge reste visible sur chaque demande.
- Avec la protection, l'envoi direct sur la branche principale peut être refusé : le rappeler si des plans ont « **Envoi** : branche principale », et proposer de passer en mode PR (`/pulse:refine US-XXX "changer l'envoi"`).

## 8. Mises à jour des dépendances (facultatif)

Proposer (AskUserQuestion) : « Recevoir chaque semaine une demande de fusion pour les nouvelles versions des dépendances (Recommandé) » / « Plus tard ». Expliquer : « Un robot du dépôt propose les nouvelles versions, failles corrigées comprises ; la CI vérifie chacune avant que vous l'acceptiez. »

- GitHub : Dependabot (fichier `.github/dependabot.yml`) ; GitLab ou autre fournisseur : Renovate. Écrire la configuration d'après la documentation officielle de l'outil : l'écosystème de la pile retenue, et celui des actions de la CI ; fréquence hebdomadaire.
- Montrer le fichier, expliquer chaque bloc en une ligne, puis l'enregistrer et l'envoyer comme en § 5.
- Chaque demande reçue se relit et se fusionne par la personne, sur le site du dépôt, une fois la CI verte.

## Fin

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:deploy` si l'appli reste à mettre en ligne (la CI et le déploiement automatique se complètent), sinon reprendre le travail en cours (`/pulse:status`).

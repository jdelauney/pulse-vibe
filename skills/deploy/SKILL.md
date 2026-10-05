---
description: Mettre l'appli en ligne avec déploiement automatique (CD), puis en mode production avec contrôle automatique (CI)
argument-hint: "[premiere | production] (détecté automatiquement si vide)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Bash(git status *) Bash(git remote *) Bash(git push *) Bash(git log *) Bash(git branch *) Bash(git rev-parse *) Bash(node *verifier.js)
---

# /pulse:deploy – Mettre en ligne

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte deploy`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte deploy` et lire sa sortie.

Mode demandé (facultatif) : `$ARGUMENTS`

## Objectif

Mettre l'appli en ligne, et faire comprendre la chaîne :
**commit → envoi (push) vers le dépôt distant → l'hébergeur détecte la nouvelle version → il la met en ligne tout seul.**

Analogie à donner : « C'est comme un document partagé qui se met à jour tout seul : chaque fois que vous envoyez une nouvelle version sur le dépôt distant, le site se met à jour en quelques minutes. C'est le déploiement continu (CD). »

## 0. Prérequis : la mise en ligne est choisie

Lire la section « Hébergement et mise en ligne » de `docs/technical.md` : hébergeur, dépôt distant, CI éventuelle. Lire aussi « Commandes du projet » (en particulier « construire » et « déployer ») et « Secrets et variables d'environnement ».

- `docs/technical.md` absent, ou hébergeur / dépôt distant non choisis (vides ou « aucune ») : expliquer qu'il faut d'abord choisir où mettre l'appli en ligne, et proposer `/pulse:tech`. Ne rien installer, ne rien configurer, s'arrêter là.
- Pour chaque étape propre à l'hébergeur, au dépôt distant ou à la CI retenus : suivre **leur documentation officielle** (outil de documentation comme context7 s'il est disponible, sinon WebFetch). Ne jamais deviner un libellé, un menu ou un nom de fichier de configuration ; si la documentation est inaccessible, le dire et guider à partir de ce que la personne voit à l'écran.

## 1. Contrôles avant envoi (toujours)

1. Dépôt Git présent, sinon proposer `/pulse:init`.
2. Branche : `git branch --show-current`. Si c'est `master`, proposer `git branch -M main` et expliquer que `main` est la branche publiée.
3. Rien en attente : si `git status --short` n'est pas vide, proposer `/pulse:commit` d'abord.
4. Secrets : lancer `pulse-aidd verifier` depuis la racine du projet. Il vérifie l'absence de fichiers d'environnement suivis par Git et de clés secrètes dans le projet. S'il échoue, expliquer chaque problème simplement et corriger avant d'aller plus loin.
5. Contrôles du projet : lancer les contrôles automatiques et la commande « construire » de « Commandes du projet » (celles qui ne valent pas « aucune »). Une erreur bloque l'envoi : proposer `/pulse:fix` ou `/pulse:auto-fix`. Si aucune commande de contrôle n'existe, le signaler et proposer d'en ajouter avec `/pulse:tech`.

## 2. Choisir le mode

- `premiere`, ou **aucun dépôt distant** (`git remote -v` vide) → **Première mise en ligne** (section 3).
- `production`, ou projet qui stocke des données ou utilise des secrets (« Données et contrôle d'accès », « Secrets et variables d'environnement ») sans `scripts/verifier.js` → **Mode production** (section 5), après la section 4 si besoin.
- Sinon → **Mise à jour** (section 4).

## 3. Première mise en ligne

### 3a. Créer le dépôt distant

Le dépôt distant est celui de « Hébergement et mise en ligne » (par exemple GitHub, GitLab…). Il est **privé** par défaut.

- Si l'outil en ligne de commande du fournisseur est installé **et** connecté (vérifier son état de connexion avec la commande prévue par sa documentation) : proposer la commande qui crée un dépôt **privé**, le relie à ce dossier sous le nom `origin` et fait le premier envoi. Montrer la commande et expliquer chaque partie avant de la lancer, avec accord.
- Sinon, guider pas à pas, d'après la documentation officielle du fournisseur :
  1. Sur le site du fournisseur, créer un nouveau dépôt.
  2. Nom du projet, visibilité **privée**, **sans** README ni fichier d'exclusion (le projet en a déjà).
  3. Copier l'adresse du dépôt et me la coller ici.
  4. Vous lancer ensuite `git remote add origin <adresse>` puis `git push -u origin main`.
  Si une fenêtre de connexion au fournisseur s'ouvre au premier envoi, c'est normal : il faut l'accepter.

### 3b. Relier le dépôt à l'hébergeur (à faire par la personne, guidé)

Suivre la documentation officielle de l'hébergeur retenu, et la traduire en étapes simples, une à la fois :
1. Se connecter à l'hébergeur (avec le compte du dépôt distant si c'est proposé : c'est souvent le plus simple).
2. Créer un nouveau site ou projet à partir d'un dépôt existant, autoriser l'accès au dépôt, choisir le dépôt.
3. Vérifier les réglages de construction et de publication d'après « Commandes du projet » (commande « construire », ou aucune) et « Organisation des fichiers » (dossier publié ou point d'entrée). Si un fichier de configuration de l'hébergeur est nécessaire, le proposer d'après sa documentation, le montrer avant de l'écrire, puis l'enregistrer avec `/pulse:commit`.
4. Si l'appli a besoin de variables d'environnement (« Secrets et variables d'environnement », `.env.example`) : les faire saisir **avant** le premier déploiement (section 5, point 2), sinon la construction ou l'appli échoue.
5. Lancer le premier déploiement, attendre la fin, puis renommer le site si souhaité.
6. Me coller l'adresse du site.

Ensuite : inscrire l'adresse du dépôt et celle du site dans la section « Adresses » de `CLAUDE.md` et dans `README.md`. Si un outil de lecture web est disponible, vérifier que la page répond.

### 3c. Voir le déploiement automatique en action

Proposer une petite modification visible (par exemple le texte du titre), puis : `/pulse:commit`, `git push`, et suivre l'avancement dans la liste des déploiements de l'hébergeur. Rafraîchir le site quand le déploiement est terminé. C'est le moment « waouh » : la nouvelle version est en ligne sans rien faire d'autre.

## 4. Mise à jour

1. `git push` (après les contrôles de la section 1).
2. Expliquer que l'hébergeur publie la nouvelle version automatiquement, et où suivre l'avancement (liste des déploiements de l'hébergeur).
3. Donner l'adresse du site (section « Adresses » de `CLAUDE.md`) pour vérifier.

## 5. Mode production (« pour de vrai »)

Expliquer d'abord l'**intégration continue (CI)** : « Avant chaque mise en ligne, un contrôle qualité automatique vérifie le projet. Si le contrôle échoue, la nouvelle version défectueuse n'est pas publiée, et l'ancienne reste en ligne. »

1. **Installer le contrôle** :
   - lancer `pulse-aidd installer-ci` : il copie `scripts/verifier.js` (contrôle des secrets) et un exemple de CI dans le projet ;
   - **adapter** cet exemple à la CI retenue dans « Hébergement et mise en ligne », d'après sa documentation officielle : emplacement et format du fichier, déclenchement à chaque envoi, puis les étapes « installer », `node scripts/verifier.js`, les contrôles automatiques et « construire » de « Commandes du projet ». Montrer le fichier avant de l'écrire. Si aucune CI n'est retenue, le dire et proposer `/pulse:tech` pour en choisir une, ou s'appuyer seulement sur l'hébergeur (point suivant) ;
   - si l'hébergeur le permet, le configurer pour exécuter ce contrôle **avant chaque mise en ligne** (commande de construction qui enchaîne `node scripts/verifier.js`, les contrôles du projet, puis la construction), d'après sa documentation ;
   - lancer `node scripts/verifier.js` pour vérifier qu'il passe.
2. **Variables d'environnement** : lister les noms présents dans `.env.example` et dans « Secrets et variables d'environnement ». Guider la personne pour les saisir **elle-même** à l'endroit indiqué pour la production (réglages de l'hébergeur). Les valeurs ne doivent **jamais** être collées dans cette conversation. Après un ajout de variable, relancer un déploiement si l'hébergeur ne le fait pas seul.
3. **Services connectés** : si un service de « Pile retenue » (connexion, données, emails…) doit connaître l'adresse du site (liens de connexion, redirections, origines autorisées), guider la personne pour la renseigner, d'après la documentation officielle du service.
4. **Environnements** : si l'hébergeur le propose, expliquer la différence entre une adresse de **prévisualisation** (pour une branche ou une demande de fusion, pour tester sans toucher au site) et la **production** publiée depuis `main` (le site des clients).
5. **Retour arrière** : montrer, d'après la documentation de l'hébergeur, comment republier une version précédente. Rassurer : on ne casse rien de façon définitive.
6. **Enregistrer et envoyer** : commit `chore: contrôle automatique avant mise en ligne`, puis `git push`. Montrer où voir le résultat de la CI (coche verte ou croix rouge sur le dépôt distant, ou journal de la CI) et le journal du déploiement chez l'hébergeur.

## 6. Clore

Si une tâche « Mettre en ligne… » est `[ ]` ou `[~]` dans un plan de `docs/plans/`, la faire passer à `[x]` et ajouter une ligne au journal de ce plan (puis enregistrer ce changement avec un commit `docs: plan à jour` et un `git push`).

Terminer avec le bloc de fin de commande, en indiquant l'adresse du site.

---
description: Mettre l'appli en ligne et la mettre à jour automatiquement à chaque envoi, puis passer en mode production (variables, services, retour arrière ; les contrôles automatiques se mettent en place avec /pulse:cicd)
argument-hint: "[premiere | production] (détecté automatiquement si vide)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte *) Bash(pulse-aidd etape *) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite *) Bash(pulse-aidd verifier) Bash(pulse-aidd installer-ci) Bash(pulse-aidd sonder *) Bash(pulse-aidd seo *) Bash(pulse-aidd perf *) Bash(pulse-aidd secrets inventaire*) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd installer-hook) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(git status *) Bash(git ls-files *) Bash(git grep -n *) Bash(git remote -v) Bash(git remote get-url *) Bash(gh auth status*) Bash(glab auth status*) Bash(git log *) Bash(git branch --show-current) Bash(git branch -m main) Bash(git rev-parse *) Bash(node scripts/verifier.js) Edit(docs/technical.md) Edit(./CLAUDE.md) Edit(./README.md) Edit(aidd_docs/tasks/**) Write(docs/performance.md) Edit(docs/performance.md) Bash(pulse-aidd sessions *) Bash(pulse-aidd revue *) Bash(pulse-aidd agent fixer) Bash(pulse-aidd guide) Bash(pulse-aidd pile contexte *) Bash(git diff *) Bash(git add *) Bash(git commit -m *) Bash(pulse-aidd preuve *) Bash(pulse-aidd verifier --index)
---

# /pulse:deploy – Mettre en ligne

## Objectif

Mettre l'appli en ligne, et faire comprendre la chaîne :
**commit → envoi (push) vers le dépôt distant → l'hébergeur détecte la nouvelle version → il la met en ligne tout seul.**

Analogie à donner : « C'est comme un document partagé qui se met à jour tout seul : chaque fois que vous envoyez une nouvelle version sur le dépôt distant, le site se met à jour en quelques minutes. C'est le déploiement continu (CD). »

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte deploy` et lire sa sortie en entier) pendant toute la commande.

## Contexte

Mode demandé (facultatif) : `$ARGUMENTS`

### 0. Prérequis : la mise en ligne est choisie

Lire la section « Hébergement et mise en ligne » de `docs/technical.md` : hébergeur, dépôt distant, CI éventuelle. Lire aussi « Commandes du projet » (en particulier « construire » et « déployer ») et « Secrets et variables d'environnement ».

- `docs/technical.md` absent, ou hébergeur / dépôt distant encore à choisir (vides ou « aucune ») : expliquer qu'il faut d'abord choisir où mettre l'appli en ligne, et proposer `/pulse:tech`. S'arrêter là, avant toute installation ou configuration.
- Pour chaque étape propre à l'hébergeur, au dépôt distant ou à la CI retenus : suivre **leur documentation officielle** (outil de documentation comme context7 s'il est disponible, sinon WebFetch). Tirer de cette documentation chaque libellé, menu ou nom de fichier de configuration ; si la documentation est inaccessible, le dire et guider à partir de ce que la personne voit à l'écran.

## Processus

### 1. Contrôles avant envoi (toujours)

1. Dépôt Git présent, sinon proposer `/pulse:init`.
2. Branche : `git branch --show-current`. Si c'est `master`, proposer `git branch -m main` et expliquer que `main` est la branche publiée.
3. Tout est enregistré : si `git status --short` liste des fichiers, proposer de taper `/pulse:commit` d'abord.
4. Secrets : lancer `pulse-aidd verifier` depuis la racine du projet. Il vérifie que les fichiers d'environnement restent hors de Git et que le projet est exempt de clés secrètes. S'il échoue, expliquer chaque problème simplement et corriger avant d'aller plus loin.
5. Contrôles du projet (contrôles automatiques, la commande « Tester » et la commande « Construire » de « Commandes du projet ») : `pulse-aidd preuve etat --exiger suite --exiger construction` ; si son code n'est pas 0 (preuve rouge, périmée, absente ou sans construction), `pulse-aidd preuve lancer --portee suite --construire`. Une erreur ou un test en échec bloque l'envoi : appliquer `pulse-aidd etape fix --sans-noyau` (un test ou une erreur précise) ou `pulse-aidd etape auto-fix --sans-noyau` (beaucoup d'erreurs de lint ou de types). Si aucune commande de contrôle ni de test n'existe, le signaler et proposer d'en ajouter (tapez `/pulse:tech`).
6. Sécurité, avant la **première** mise en ligne (aucun dépôt distant, mode `premiere`, ou ligne « Site en ligne » de `docs/technical.md` encore vide) : appliquer à l'identique le contrôle rapide de `/pulse:security rapide` (`pulse-aidd reference security/rapide.md`, en lecture seule). Un ⛔ bloque la mise en ligne : le corriger d'abord (une clé exposée : appliquer tout de suite `pulse-aidd reference secrets/fuite.md`). Les ⚠️ s'affichent avec leur correction proposée, et la mise en ligne continue.

### 2. Choisir le mode

Chaque envoi déclenche une demande d'accord de Claude Code : c'est ce qui met votre travail sur le dépôt distant, d'où l'hébergeur le publie. Le dire en une phrase avant chaque envoi de cette commande.

- `premiere`, ou **aucun dépôt distant** (`git remote -v` vide) → **Première mise en ligne** (section 3).
- `production`, ou projet qui stocke des données ou utilise des secrets (« Données et contrôle d'accès », « Secrets et variables d'environnement ») sans `scripts/verifier.js` → **Mode production** (section 5), après la section 4 si des commits restent à envoyer.
- Sinon → **Mise à jour** (section 4).

Chaque mode lance ce qu'il applique, au moment de commencer (chaque sortie lue en entier) :
- **Première mise en ligne** : `pulse-aidd reference deploy/premiere.md` et, avec un pack de pile, `pulse-aidd pile contexte deploy-premiere`. Seulement sans dépôt distant relié, lancer aussi `pulse-aidd reference depot-distant.md` au moment de 3a.
- **Mode production** : `pulse-aidd reference deploy/production.md` et, avec un pack de pile, `pulse-aidd pile contexte deploy-production`. Si la CI reste à installer, l'étape **cicd** (`pulse-aidd etape cicd --sans-communes`) s'applique au point 1 de `deploy/production.md`.
- **Variables d'environnement** (production, ou première mise en ligne qui en a besoin) : `pulse-aidd reference deploy/variables.md` (elle fait lancer, au moment d'envoyer une valeur, la référence qui garde les valeurs hors de la conversation).
- **Mise à jour** : la section 4 ci-dessous suffit.

### 3. Première mise en ligne

Appliquer `deploy/premiere.md` dans l'ordre (3a, 3b, 3c), puis passer à la section 6.

### 4. Mise à jour

1. **Commits à envoyer** (`git log --oneline @{u}..` non vide, ou branche sans suivi) : annoncer : « Claude Code va vous demander l'accord pour envoyer : c'est ce qui met votre travail sur le dépôt distant, d'où l'hébergeur le publie. » Puis `git push` (après les contrôles de la section 1). Tout est déjà envoyé : le dire, et passer au point 3.
2. Expliquer que l'hébergeur publie la nouvelle version automatiquement, et où suivre l'avancement (liste des déploiements de l'hébergeur).
3. Une fois la publication terminée chez l'hébergeur, lancer `pulse-aidd sonder <adresse du site>` (section « Adresses » de `CLAUDE.md`), avec `--texte` suivi d'un texte que la nouvelle version affiche, puis `pulse-aidd seo <adresse du site> --essentiel` (❌ = mise en ligne à corriger, comme en première mise en ligne). Donner l'adresse à la personne pour qu'elle regarde la nouveauté.
4. Si cette version change une page de « Pages suivies » dans `docs/performance.md`, proposer `/pulse:perf mesurer` en une ligne (la mesure reste au choix de la personne : elle prend quelques minutes).

### 5. Mode production (« pour de vrai »)

Appliquer `deploy/production.md` dans l'ordre (points 1 à 8), puis passer à la section 6.

### 6. Clore

Si une tâche « Mettre en ligne… » est `[ ]` ou `[~]` dans un plan de `aidd_docs/tasks/`, la faire passer à `[x]` et ajouter une ligne au journal de ce plan (puis enregistrer ce changement avec un commit `docs: plan à jour` ; annoncer : « Claude Code va vous demander l'accord pour envoyer : c'est ce qui met votre travail sur le dépôt distant, d'où l'hébergeur le publie. » ; puis `git push`).

Site sur son adresse définitive, « Être trouvé » de `docs/prd.md` à oui (ou absent), et section « Référencement » de `docs/technical.md` absente : proposer `/pulse:seo lancer` (il vérifie l'essentiel et relie Search Console). Si le pack de pile prévoit un envoi IndexNow, il se fait ici, après les preuves ci-dessous.

Après la première mise en ligne, ou si `docs/securite.md` est absent : proposer `/pulse:security audit` (audit complet et test du cambrioleur), car le site est désormais ouvert à tous.

Terminer avec le bloc de fin de commande, en indiquant l'adresse du site, le résultat de `pulse-aidd sonder` et celui de `pulse-aidd seo --essentiel` (les lignes ✅ ou ❌ qu'ils affichent) comme preuves de la mise en ligne.

## Exemples

- `/pulse:deploy` la première fois : les vérifications, puis un guidage pas à pas chez l'hébergeur ; à la fin, l'adresse de votre site et la preuve qu'il répond.
- `/pulse:deploy` ensuite : votre dernière version est envoyée, l'hébergeur la publie toute seule, et la nouveauté est vérifiée en ligne.
- `/pulse:deploy production` : un contrôle automatique avant chaque mise en ligne, les clés secrètes et les réglages enregistrés chez l'hébergeur, et une surveillance du site.

## Références de la commande

!`pulse-aidd contexte deploy`

Si ce contexte est absent, lancer `pulse-aidd contexte deploy` et lire sa sortie.

---
description: Réaliser une tâche d'un plan et l'expliquer, en coulisse ou devant vous, au besoin dans un dossier à part ; pour enchaîner tout le plan, /pulse:spirc
argument-hint: "<US-XXX> <T3>"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte implement) Bash(pulse-aidd etape implement) Bash(pulse-aidd etape pr --sans-communes) Bash(git add *) Bash(pulse-aidd agent *) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite *) Bash(pulse-aidd tests *) Bash(pulse-aidd scenarios) Bash(pulse-aidd guide) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd sessions *) Bash(pulse-aidd secrets historique *) Bash(pulse-aidd seo *) Bash(pulse-aidd verifier) Bash(pulse-aidd preuve *) Bash(pulse-aidd pile contexte *) Edit(docs/lexique.md) Write(docs/lexique.md) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git rev-parse *) Bash(git worktree list*) Bash(git worktree add *) Bash(pulse-aidd copier-env *) Bash(git branch --show-current) Bash(git branch --list *) Bash(git switch -c *) Bash(git switch feat/*) Bash(git remote -v) Bash(git remote get-url *) Bash(gh auth status*) Bash(gh pr view*) Bash(gh pr create --draft *) Bash(glab auth status*) Bash(glab mr view*) Bash(glab mr create --draft *) EnterWorktree ExitWorktree Write(aidd_docs/tasks/**) Edit(aidd_docs/tasks/**) Edit(docs/prd.md) Bash(git fetch origin) Bash(pulse-aidd revue *) Bash(pulse-aidd travail-fini) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd secrets verifier *) Bash(pulse-aidd realisation *)
---

# /pulse:implement – Réaliser une tâche

## Objectif

Réaliser **une tâche** d'un plan (`aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`), en coulisse ou devant la personne, puis expliquer ce qui a été fait et comment le tester. La relecture et le commit se font ensuite avec `/pulse:review` et `/pulse:commit`. Pour enchaîner toutes les tâches d'un plan (réaliser, relire, tester, enregistrer, tâche suivante), la personne tape `/pulse:spirc <US-XXX>`.

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte implement` et lire sa sortie en entier, fichier enregistré compris) pendant toute la commande.

## Contexte

Arguments reçus : `$ARGUMENTS` (les options, l'US, puis la tâche)

Identifiant de cette session : `${CLAUDE_SESSION_ID}` (à passer à `pulse-aidd sessions`).

### Raccourcis (facultatifs)

Les choix de la façon de travailler se font par une question au démarrage (§ 0). Les habitués peuvent les donner d'avance, avant l'US, regroupables (`-sw` = `-s -w`). Une lettre inconnue : la signaler et demander ce que la personne voulait. `-s` et `-d` ensemble se contredisent : demander lequel garder.
- `-s` **en coulisse** : la réalisation est confiée au sous-agent `pulse:implementer`, qui code dans son propre contexte ; cette commande prépare, contrôle et explique.
- `-d` **devant vous** : la réalisation se fait dans cette conversation, sous les yeux de la personne, pour apprendre en voyant chaque étape.
- `-w` **dossier à part (worktree)** : travailler dans un dossier à part, sur sa propre branche (référence « Travailler dans un worktree »).
- `-t` **tests d'abord** : `pulse:test-writer` écrit les tests de la tâche, qu'on voit échouer ; le code doit les faire passer, contrôlé par `pulse:test-runner` (référence « Tests d'abord »).

### Prérequis

- **Le plan** : celui de l'US désignée (règles « User stories, specs et plans »). Introuvable : lister les plans (celui qui a une tâche `[~]` en premier) et demander lequel. Aucun plan : proposer `/pulse:plan`.
- **La tâche** : elle doit appartenir au plan, sinon indiquer le plan qui la contient et demander. **Sans tâche** : dire en une phrase que tout le plan s'enchaîne avec `/pulse:spirc <US-XXX>`, à taper par la personne, puis demander (AskUserQuestion) : « Je tape /pulse:spirc US-XXX pour enchaîner tout le plan (Recommandé) » / « Réaliser seulement <Tn> – <titre> ici » (la première tâche `[~]`, sinon `[ ]`, du plan).
- La spec et l'US du même dossier et `docs/technical.md` sont nécessaires ; sinon, proposer la commande manquante (sans `docs/technical.md` : `/pulse:tech`, et attendre le choix de la pile pour installer ou coder).
- Des modifications non enregistrées qui concernent **une autre tâche** (`git status`) : proposer de taper d'abord `/pulse:review` puis `/pulse:commit` pour celle-là. Un commit = une seule tâche.
- Tâche déjà `[~]` : sauf si `aidd_docs/tasks/in-progress.md` concerne cette commande et cette tâche (reprendre à son étape, règle commune 16), ou si `pulse-aidd realisation` montre `commande: implement`, `us: <US-XXX>`, `tache: <Tn>` et `etape: realisation` ou `test`, sans `perime: oui` (code commencé : reprendre au § 2, devant vous si `devant: true` ; des fichiers de test déjà à l'index (`git diff --cached --name-only`) sont les tests figés des tests d'abord : reprendre alors à « Vert : réaliser » de `pulse-aidd reference tests-dabord.md`, et le § 3 va jusqu'au verdict ✅ Vert), lancer `pulse-aidd revue <Tn>` : `examen`, `test`, `correction` ou `aide` → proposer de taper `/pulse:review <Tn>` ; `commit` → proposer de taper `/pulse:commit` ; `decision` → proposer de taper `/pulse:spirc <US-XXX>`, qui pose la question puis reprend la tâche ; `aucune` → le dire et demander de quelle tâche il s'agit.
- Tâche « Mettre en ligne… » : elle se fait avec `/pulse:deploy`. Toutes les tâches `[x]` : féliciter la personne et proposer `/pulse:deploy`.

## Rôle

Cette commande prépare, contrôle, explique et parle à la personne ; devant vous, elle réalise elle-même. Ses moyens :
- `pulse:implementer` : réalise la tâche en coulisse, puis corrige les erreurs qu'on lui renvoie ;
- `pulse:test-writer` et `pulse:test-runner` (tests d'abord).

## Processus

### 0. Choisir la façon de travailler

**Mode découverte** (règles de réalisation) : aucune question ; chaque choix prend sa réponse recommandée, annoncée en une phrase. Sinon, **une seule ronde** (AskUserQuestion, 4 questions au plus) avec, selon le cas :
- **Mode** (sans `-s` ni `-d`) : « Comment réaliser la tâche ? » → « Je code en coulisse (Recommandé) » (un assistant spécialisé code à part : la conversation reste légère) / « Je code devant vous » (vous voyez chaque étape). Sous-agent `pulse:implementer` indisponible : devant vous, en le signalant.
- **Tests** (sans `-t`) : « 2. Choisir au démarrage » de « Tests automatiques ».
- **Dossier à part** (sans `-w`) : « 1. Faut-il un worktree ? » de la référence worktree, si la question se pose.
- **Envoi** : dès qu'un dépôt distant existe, lancer `pulse-aidd reference envoi.md` (à chaque lancement, y compris à une reprise) ; appliquer « 1. Choisir comment envoyer le travail d'un plan » si la ligne « Envoi » du plan vaut « à choisir » ; en mode PR, préparer la branche de l'US ou y revenir (selon « L'envoi du travail »).

**Avec un dossier à part** : `pulse-aidd reference worktree-dossier.md`, puis le créer ou y revenir (« 2. Créer le worktree ou y revenir »), **avant** de marquer la tâche `[~]`.

Annoncer le choix en une ligne (« Je code en coulisse · tests d'abord · dans le dossier à part `us-003-<nom>` »). Puis « 4. Suggérer une US à mener en parallèle » de la référence worktree.

### 1. Annoncer

Marquer la tâche `[~]` dans le plan, puis annoncer en 4 lignes au plus : « **T3 – Titre**. Je vais : … (2 à 4 puces). Fichiers concernés : … »

**Marqueur de réalisation** : `pulse-aidd realisation debut <US-XXX> --commande implement --rythme <rapide si le profil vaut « rapide », sinon complet>`, plus `--devant` devant vous ; à chaque étape, `pulse-aidd realisation etape <Tn> <test|realisation>` ; avant le bloc de fin, `pulse-aidd realisation fin`.

**Travail en cours** (règle commune 16) : à chaque arrêt pour la personne (blocage, choix), écrire `aidd_docs/tasks/in-progress.md` avec « Pour reprendre : `/pulse:implement <US-XXX> <Tn>` » ; l'effacer (`pulse-aidd travail-fini`) dès sa réponse.

### 2. Réaliser

**Tests d'abord** : lancer `pulse-aidd reference tests-dabord.md` et appliquer « Rouge : écrire les tests », puis réaliser comme ci-dessous avec ce que prévoit son étape 4.

**En coulisse** : déléguer à **`pulse:implementer`** selon « Déléguer à l'implementer » (message, puis retour).

**Devant vous** (marqueur lancé avec `--devant`) : la sortie de `pulse-aidd realisation etape <Tn> realisation`, fiche du pack de pile comprise, se lit en entier avant le premier fichier écrit. Puis lancer `pulse-aidd agent implementer` et appliquer, dans cette conversation, ses « Règles absolues », sa « Méthode » (règles de qualité par famille comprises) et la fiche ainsi chargée (son « Pack de pile »), en annonçant chaque étape : ce que vous lisez, ce que vous écrivez et pourquoi. Une correction faite par cette conversation hors de cette étape commence par `pulse-aidd pile contexte implement`, lu en entier, s'il ne figure pas dans la conversation. S'arrêter dès qu'un choix de la personne apparaît (« Bloqué – décision nécessaire »), comme au retour de l'agent.

### 3. Vérifier

**Tests d'abord** : « Vert : réaliser » (étape 5) et « Trier les échecs » de « Tests d'abord », jusqu'au verdict ✅ Vert ou à l'arrêt après deux cycles.

Relire chaque critère d'acceptation de la tâche et vérifier que le code le réalise (en coulisse : dans ses changements, au-delà de son rapport ; un critère non rempli repart à l'implementer comme une erreur, avec les mêmes deux essais).
- **En coulisse** : s'appuyer sur « Vérifications lancées » et « Tests » du rapport de l'implementer et sur le contrôle de fin de tour ; ne pas relancer. Une erreur signalée : relancer l'implementer avec la liste (« Déléguer à l'implementer », une correction), deux essais au plus.
- **Devant vous** : lancer les contrôles automatiques de « Commandes du projet » (lint, format, types, tests, selon ce qui existe ; « aucune » : le signaler) et corriger, deux essais au plus.

Une erreur qui reste se cite dans le rapport de réalisation, et le bloc de fin propose de taper `/pulse:auto-fix`. Un critère qui se vérifie seulement en cliquant va dans le test manuel.

### 4. Expliquer

Présenter, en expliquant chaque terme technique :
1. **Ce qui a changé** : un fichier par ligne, avec son rôle.
2. **💡 La notion du jour** : **une** notion de programmation présente dans le code écrit, un extrait de 3 à 8 lignes expliqué simplement ; de préférence une notion absente du lexique, puis l'y ajouter (règle commune § 1, « Le lexique »).
3. **🧪 À vous de tester** : écrire la fiche de test de la tâche, `aidd_docs/tasks/<epic>/SMOKE-TEST-US-XXX-<Tâche>-<titre-de-la-tache>.md` (modèle `pulse-aidd modele smoke-test.md` ; règles `pulse-aidd reference tests/test-manuel.md` § 1), lancer l'application en arrière-plan, puis donner le lien vers la fiche, sa durée et sa première étape.
4. **Le rapport de réalisation** (règles communes § 4), construit à partir des rubriques « Vérifications lancées » et « Tests » du rapport de l'implementer (en coulisse) ou des contrôles du § 3 (devant vous). Il dit que la preuve indépendante viendra de `/pulse:review`.

La tâche **reste `[~]`** : elle sera terminée après relecture et commit.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:review`, où deux assistants indépendants relisent la tâche et l'essaient en marche, puis `/pulse:commit`. Dans un dossier à part, la session y reste ; une fois le plan terminé, `/pulse:commit` propose de rassembler le travail.

## Exemples

- `/pulse:implement US-003 T3` : la tâche T3 est réalisée, puis expliquée : ce qui a changé, la notion du jour et les étapes pour la tester vous-même.
- `/pulse:implement -d US-003 T3` : le même travail, fait devant vous étape par étape, pour apprendre en regardant.
- `/pulse:implement US-003` sans tâche : Pulse vous propose de taper `/pulse:spirc US-003` pour enchaîner tout le plan, ou de réaliser seulement la tâche suivante ici.

## Références de la commande

!`pulse-aidd contexte implement`

Ce contexte contient aussi « Tests automatiques », « Travailler dans un worktree », « Déléguer à l'implementer » et « Modèle : docs/lexique.md ». Se lancent à leur étape : « L'envoi du travail » (`pulse-aidd reference envoi.md`, au choix de l'envoi), « Tests d'abord » (`pulse-aidd reference tests-dabord.md`, avec `-t`), la suite de la référence worktree (`pulse-aidd reference worktree-dossier.md`, avec un dossier à part), les consignes de l'implementer (`pulse-aidd agent implementer`, devant vous, § 2) et la fiche de test (`pulse-aidd modele smoke-test.md` et `pulse-aidd reference tests/test-manuel.md`, à « À vous de tester »). Si ce contexte est absent, lancer `pulse-aidd contexte implement` et lire sa sortie en entier, fichier enregistré compris.

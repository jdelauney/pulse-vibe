---
description: Réaliser une tâche d'un plan et l'expliquer, directement ou via le sous-agent implementer, au besoin dans un worktree ; sans tâche, boucler sur tout le plan (réaliser, relire, corriger, commiter, tâche suivante)
argument-hint: "<US-XXX> [T3] (sans tâche : tout le plan)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Edit(docs/lexique.md) Write(docs/lexique.md) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git add *) Bash(git commit *) Bash(git log *) Bash(git rev-parse *) Bash(git worktree list*) Bash(git worktree add *) Bash(git merge --no-ff *) Bash(git merge --abort) Bash(git branch --show-current) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch --merged*) Bash(git branch -f * origin/*) Bash(git switch -c *) Bash(git switch feat/*) Bash(git switch main) Bash(git switch master) Bash(git pull *) Bash(git push) Bash(git push -u origin *) Bash(git remote *) Bash(gh auth status*) Bash(gh pr view*) Bash(gh pr create --draft *) Bash(gh pr ready*) Bash(glab auth status*) Bash(glab mr view*) Bash(glab mr create --draft *) Bash(glab mr update --ready*) EnterWorktree ExitWorktree
---

# /pulse:implement – Réaliser une tâche

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte implement`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte implement` et lire sa sortie.

Arguments reçus : `$ARGUMENTS` (les options, l'US dont on réalise le plan, puis la tâche, facultative)

Identifiant de cette session : `${CLAUDE_SESSION_ID}` (à passer à `pulse-aidd sessions`).

## Raccourcis (facultatifs)

Les choix de la façon de travailler se font par une question au démarrage (§ 0). Les habitués peuvent les donner d'avance, avant l'US, regroupables (`-sw` = `-s -w`, dans n'importe quel ordre). Une lettre inconnue : la signaler et demander ce que la personne voulait. `-s` et `-d` ensemble se contredisent : demander lequel garder.
- `-s` **via sous-agent** : la réalisation (étapes 3 et 4) est confiée au sous-agent `pulse:implementer`, qui code dans son propre contexte ; cette commande prépare, contrôle et explique. La conversation reste légère : conseillé pour tout un plan.
- `-d` **directe** : la réalisation se fait dans cette conversation, sous les yeux de la personne. Pratique pour apprendre en voyant chaque étape.
- `-w` **worktree** : travailler dans une copie de travail séparée, sur sa propre branche (référence « Travailler dans un worktree » ci-dessus). Utile quand une autre session travaille sur le même dossier.
- `-t` **tests d'abord** : avant le code de chaque tâche, le sous-agent `pulse:test-writer` écrit ses tests, qu'on voit échouer ; le code doit ensuite les faire passer, contrôlé par `pulse:test-runner` (référence « Tests automatiques : tests d'abord » ci-dessus).

## Objectif

- **Avec une tâche** : réaliser **cette tâche** d'un plan (`aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`), expliquer ce qui a été fait et comment le tester. La relecture et le commit se font ensuite avec `/pulse:review` et `/pulse:commit`.
- **Sans tâche** : réaliser **tout le plan**, en bouclant sur chaque tâche restante, dans l'ordre : réaliser → relire → corriger → commiter → tâche suivante (§ 6). Chaque tâche a son propre commit.

## Prérequis

- **Le plan** : celui de l'US désignée en premier argument (règles « User stories, specs et plans » ci-dessus). Argument vide ou introuvable : lister les plans (en premier celui qui a une tâche `[~]`) et demander lequel. Aucun plan : proposer `/pulse:plan`.
- La spec et l'US du même dossier (`SPEC-US-XXX-<nom>.md`, `US-XXX-<nom>.md`) et `docs/technical.md` sont nécessaires. Sinon, proposer la commande manquante. Sans `docs/technical.md` (pile non choisie) : proposer `/pulse:tech`, et attendre le choix de la pile pour installer ou coder.
- Si des modifications non enregistrées concernent **une autre tâche** (`git status`), proposer d'abord `/pulse:review` puis `/pulse:commit` pour celle-ci. Un commit = une seule tâche.
- Mode « tout le plan » : le dossier doit être un dépôt Git (`git rev-parse --is-inside-work-tree`). Sinon, proposer `/pulse:init`.

## Déroulé

### 0. Choisir la façon de travailler

- **Mode** : sans `-s` ni `-d`, demander (AskUserQuestion, question « Comment réaliser la tâche ? ») : « 1. Implémentation via sous-agent (Recommandé) » (un assistant spécialisé code dans son propre contexte, la conversation reste légère) / « 2. Implémentation directe » (je code ici, vous voyez chaque étape). Si le sous-agent `pulse:implementer` n'est pas disponible : mode direct, en le signalant.
- **Tests** : sans `-t`, appliquer « 2. Choisir au démarrage » de la référence « Tests automatiques » ; la question se pose **dans le même appel** AskUserQuestion que le mode.
- **Worktree** : sans `-w`, appliquer « 1. Faut-il un worktree ? » de la référence worktree ; si la question se pose, la poser **dans le même appel** AskUserQuestion que le mode.
- **Envoi** : appliquer « 2. Choisir comment envoyer le travail d'un plan » de la référence « Le dépôt distant et l'envoi du travail » (question posée dans le même appel AskUserQuestion que le mode et le worktree, seulement si un dépôt distant existe et que la ligne « Envoi » du plan vaut « à choisir »), puis préparer la branche si le mode est PR.
- **Avec un worktree** : le créer ou y revenir (« 2. Créer le worktree ou y revenir »), **avant** de marquer la moindre tâche `[~]` : tout le travail de la commande (code, plan, commits) se fait ensuite dans le worktree.

Annoncer le choix en une ligne (« Mode : sous-agent · tests d'abord · dans le worktree `us-003-<nom>` »). Puis appliquer « 4. Suggérer une US à mener en parallèle » de la référence worktree.

### 1. Choisir la ou les tâches

- **Tâche donnée** (`T3`) : celle-ci ; elle doit appartenir au plan, sinon indiquer le plan qui la contient et demander.
- **Sans tâche** : toutes les tâches `[~]` puis `[ ]` du plan, dans l'ordre du plan. Annoncer la liste en une ligne (« Je vais réaliser T3, T4 et T5, l'une après l'autre : chacune sera relue, corrigée et enregistrée avant de passer à la suivante. »), puis appliquer la boucle du § 6.

Si toutes les tâches du plan sont `[x]` : féliciter la personne et proposer `/pulse:deploy`.
Une tâche « Mettre en ligne… » se réalise avec `/pulse:deploy` : s'arrêter avant elle et l'indiquer.
Si une tâche bloque (question de besoin, action manuelle en attente, contrôle automatique qui reste en échec) : s'arrêter sur cette tâche et l'expliquer.

### 2. Annoncer

Marquer la tâche `[~]` dans le plan. Puis annoncer en 4 lignes maximum :
« **T3 – Titre**. Je vais : … (2 à 4 puces). Fichiers concernés : … »

### 3. Réaliser

**Tests d'abord** : appliquer d'abord « Rouge : écrire les tests » (§ 4 de la référence « Tests automatiques »), dans les deux modes ; puis réaliser comme ci-dessous, en ajoutant à la délégation (ou à vos propres consignes en mode direct) ce que prévoit son étape 4 : fichiers de test, interface attendue, tests figés.

**Mode sous-agent** : déléguer à **`pulse:implementer`** (outil Agent) : la tâche (identifiant, titre, objectif, fichiers), ses critères d'acceptation complets (repris du fichier de l'US), les extraits utiles de la spec, les sections « Pile retenue », « Organisation des fichiers », « Commandes du projet », « Données et contrôle d'accès » et « Secrets et variables d'environnement » de `docs/technical.md` (recopiées), les conventions et pièges de `aidd_docs/memory/technical.md`, les mots du glossaire utiles, le chemin de `docs/design.md` et de la maquette citée s'ils existent, et les consignes ci-dessous (qualité avec `pulse-aidd qualite`, documentation officielle, s'appuyer sur le code réel, sécurité, contrôles automatiques). Le sous-agent travaille sans les fichiers du plugin : tout recopier. À son retour :
- **Bloqué** sur une question de besoin : la poser à la personne, puis relancer l'agent avec la réponse ;
- **Bloqué** sur une action manuelle (schéma à appliquer dans une console, compte à créer, variable à saisir chez l'hébergeur, clé secrète à écrire dans le fichier local) : guider la personne pas à pas, puis relancer ;
- **Bloqué – décision nécessaire** : présenter le choix à la personne en langage courant, avec ses options et leurs conséquences (AskUserQuestion) ; noter la réponse dans le plan (section « Ajouts proposés par Pulse ») et relancer l'agent avec elle. En mode direct, s'arrêter de la même façon dès qu'un tel choix apparaît.
- **Terminé** : lire son rapport et les changements (`git diff`, `git status`), puis passer à l'étape 4. Les points « À signaler » sur `docs/` sont traités ici (une idée hors périmètre va dans `docs/prd.md`, « En attente »).

**Mode direct** : réaliser soi-même, en suivant les consignes ci-dessous.

Consignes de réalisation (pour les deux modes) :

- Relire la tâche, les critères de l'US qu'elle couvre (fichier `US-XXX-<nom>.md`), et les parties utiles de la spec du plan.
- **S'appuyer sur le code réel** : créer ou modifier les fichiers listés par la tâche, à l'emplacement prévu par l'organisation de `docs/technical.md` ; avant d'importer un module, vérifier qu'il existe (Glob/Grep) ; s'il manque, le créer dans cette tâche et le signaler. Dans un projet existant, réutiliser ce qui existe au lieu de le dupliquer.
- Si `docs/design.md` existe, l'appliquer (couleurs, typographie, composants et leurs états). Si la tâche ou la spec cite une maquette, l'ouvrir et la **traduire** dans la pile retenue : son HTML sert de modèle, à réécrire.
- Coder **uniquement** ce que demande la tâche. Une idée en plus se note dans `docs/prd.md` (« En attente »), pour plus tard.
- Respecter « Pile retenue » de `docs/technical.md` (résumée dans le bloc « Pile technique » de `CLAUDE.md`) et **les références de qualité** (`pulse-aidd qualite` : clean code, composants, sécurité du code, concepts) : fonctions courtes, noms explicites, mots du glossaire, commentaires en français qui expliquent le *pourquoi*.
- **Documentation officielle** : pour toute API, forme du code ou configuration de la technologie retenue, consulter sa documentation officielle, à la version indiquée dans « Pile retenue » (outil de documentation comme context7 s'il est disponible, sinon WebFetch). Vérifier chaque API, plutôt que la deviner.
- Sécurité, toujours : les données saisies sont affichées comme du texte, jamais interprétées comme du code ; les secrets restent hors du code ; validation des champs côté serveur quand il y en a un ; messages d'erreur compréhensibles.
- Données et contrôle d'accès, selon « Données et contrôle d'accès » de `docs/technical.md` :
  - le schéma et les règles d'accès vont à l'emplacement prévu par « Organisation des fichiers » ; si leur application demande une action dans la console du fournisseur, guider la personne pas à pas ;
  - le contrôle d'accès est vérifié là où le prévoit cette section (côté serveur ou dans la base), jamais seulement dans l'interface ;
  - une valeur publique par conception peut être donnée par la personne ; une **clé secrète** reste chez la personne, jamais transmise : elle l'écrit elle-même dans le fichier local prévu par « Secrets et variables d'environnement », puis ajouter seulement le **nom** de la variable dans `.env.example`.
- Ajouter une bibliothèque uniquement après accord, avec une version fixée.

### 4. Vérifier vous-même

**Tests d'abord** : appliquer d'abord « Vert : réaliser » (étape 5) et « Trier les échecs » de la référence « Tests automatiques », jusqu'au verdict ✅ Vert ou à l'arrêt après deux cycles.

Relire chaque critère d'acceptation de la tâche et vérifier que le code le réalise (en mode sous-agent : dans les changements qu'il a faits, au-delà de son rapport). Lancer les contrôles automatiques de « Commandes du projet » (`docs/technical.md`) : lint, format, types, tests, selon ce qui existe (« aucune » : le signaler, et s'en tenir aux commandes déclarées). Corriger avant de rendre la main (s'il reste beaucoup d'erreurs : `/pulse:auto-fix`). Si un critère se vérifie seulement en cliquant, l'inclure dans le test manuel.

### 5. Expliquer

Présenter, en expliquant chaque terme technique :

1. **Ce qui a changé** : un fichier par ligne, avec son rôle.
2. **💡 La notion du jour** : choisir **une** notion de programmation présente dans le code écrit (variable, constante, condition, boucle, fonction, événement, tableau, objet, stockage, requête, attente d'une réponse…). Montrer un extrait de 3 à 8 lignes et l'expliquer simplement, ligne par ligne si besoin. Choisir de préférence une notion absente du lexique, puis l'y ajouter (règle commune § 1, « Le lexique »).
3. **🧪 À vous de tester** : les étapes du test manuel, issues des critères d'acceptation, avec des données réalistes. Indiquer comment ouvrir l'appli : la commande « lancer en local » de « Commandes du projet » (`docs/technical.md`), et l'adresse ou l'écran qu'elle affiche.
4. **Le rapport de réalisation** (règles communes § 4) : chaque critère de la tâche classé en ✅ Prouvé (avec sa preuve), 🧪 À vérifier par vous ou ⚪ Non vérifié, puis la ligne « Contrôles ». En mode sous-agent, le construire à partir des rubriques « Vérifications lancées » et « Tests » de son rapport, sans les réinterpréter.

La tâche **reste `[~]`** : elle sera terminée après relecture et commit.

Avec une tâche : terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:review` pour une relecture indépendante, puis `/pulse:commit`. Dans un worktree, la session y reste : la relecture et le commit s'y font aussi ; une fois le plan terminé, `/pulse:commit` propose de rassembler le travail.

### 6. Boucle sur tout le plan (sans tâche)

Pour chaque tâche, dans l'ordre du plan :

1. **Réaliser** : étapes 2 à 5 ci-dessus (l'explication reste courte : ce qui a changé et la notion du jour ; le test manuel est donné à l'étape suivante).
2. **Relire** : lancer `pulse-aidd etape review` et appliquer sa section « Déroulé » à l'identique pour cette tâche, **hors** son bloc de fin de commande : relecture indépendante par le sous-agent `pulse:reviewer`, rapport `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/<Tâche>-<AAAA-MM-JJ>.md`, présentation du verdict, **test manuel par la personne**.
3. **Corriger** : appliquer l'étape « Corriger » de la relecture (constats Critique, Haute et Moyenne, constats Basse confrontés au code, test non concluant : règles communes § 6), avec la relecture de contrôle. En mode sous-agent, relancer `pulse:implementer` **avec la liste des constats** à corriger. Avec les tests d'abord, la relecture de contrôle inclut le test-runner en phase « vert attendu ». **Deux cycles au maximum** : si un constat Critique persiste, arrêter la boucle, laisser la tâche `[~]`, expliquer simplement le blocage et proposer `/pulse:get-help`.
4. **Commiter** : lancer `pulse-aidd etape commit` et appliquer sa section « Déroulé » à l'identique, **hors** son bloc de fin de commande : contrôles de sécurité, message `<type>(<Tâche>): …`, tâche passée à `[x]` avec sa ligne de journal. Le rapport de revue existe : la relecture est faite, passer directement au commit.
5. **Passer à la suivante** : annoncer l'avancement en une ligne (`T3 ✅ enregistrée · US-XXX : 3/6 · suite : T4 – <titre>`), puis enchaîner directement. Si la personne demande une pause, s'arrêter : relancer `/pulse:implement <US-XXX>` reprendra à la tâche suivante.

S'arrêter aussi avant une tâche « Mettre en ligne… » (elle se fait avec `/pulse:deploy`) et à tout blocage (§ 1). Après 3 tâches, rappeler qu'on peut faire `/clear` puis relancer `/pulse:implement <US-XXX>` : la boucle reprend grâce aux statuts du plan et aux rapports de revue (une tâche `[~]` qui a déjà un rapport reprend à la correction ou au commit).

À la fin, présenter un récapitulatif :

```
| Tâche | Relecture | Test | Commit |
|---|---|---|---|
| T3 – … | ✅ Validé | ✅ | abc1234 |
```

**Dans un worktree** : quand le plan est terminé, ou si la personne s'arrête, appliquer « 3. Terminer : rassembler le travail » de la référence worktree.

Puis le bloc de fin de commande. Prochaine étape : `/pulse:deploy` si le plan est terminé et que la nouvelle version reste à mettre en ligne, sinon `/pulse:implement <US-XXX>` pour reprendre (Pulse propose de revenir dans le worktree gardé).

## Contraintes d'implémentation
- Toujours appliquer les règles de qualité de code, chargées avec `pulse-aidd qualite`.
- Pour une tâche de refactoring, ou pour nommer une odeur de code et choisir son remède : consulter `pulse-aidd reference qualite/code-concepts.md` (odeurs de code, SOLID, refactorings).

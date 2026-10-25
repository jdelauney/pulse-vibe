---
description: Enchaîner tout le travail d'une user story (spirc = Spécifier, Planifier, Implémenter, Relire, Commiter) - des assistants indépendants explorent, codent, relisent et vérifient ; je m'arrête pour votre accord et vous testez chaque tâche ; la spec et le plan s'écrivent d'abord s'ils manquent
argument-hint: "<US-XXX> [T3 | \"une demande\"] (sans tâche ni demande : tout le plan de l'US) | <US-XXX US-YYY…> | version"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte cicd) Bash(pulse-aidd contexte commit) Bash(pulse-aidd contexte deploy) Bash(pulse-aidd contexte perf) Bash(pulse-aidd contexte refine) Bash(pulse-aidd contexte spirc) Bash(pulse-aidd contexte tech) Bash(pulse-aidd contexte us) Bash(pulse-aidd contexte spec) Bash(pulse-aidd contexte plan) Bash(pulse-aidd etape *) Bash(pulse-aidd agent *) Bash(pulse-aidd reference *) Bash(pulse-aidd autorisations) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite *) Bash(pulse-aidd tests *) Bash(pulse-aidd scenarios) Bash(pulse-aidd guide) Bash(pulse-aidd installer-ci) Bash(pulse-aidd installer-hook) Bash(pulse-aidd memoire) Bash(pulse-aidd perf *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd secrets inventaire *) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd seo *) Bash(pulse-aidd sessions *) Bash(pulse-aidd sonder *) Bash(pulse-aidd travail-fini) Bash(pulse-aidd captures effacer *) Bash(pulse-aidd verifier) Bash(pulse-aidd verifier-spec *) Bash(pulse-aidd piles) Bash(pulse-aidd pile squelette *) Bash(pulse-aidd pile contexte *) Bash(pulse-aidd secrets historique *) Edit(docs/lexique.md) Write(docs/lexique.md) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git add *) Bash(git commit -m *) Bash(git log *) Bash(git rev-parse *) Bash(git worktree list*) Bash(git worktree add *) Bash(git merge --abort) Bash(git branch --show-current) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch --merged*) Bash(git switch -c *) Bash(git switch feat/*) Bash(git switch main) Bash(git switch master) Bash(git remote -v) Bash(git remote get-url *) Bash(gh auth status*) Bash(gh pr view*) Bash(gh pr create --draft *) Bash(gh pr ready*) Bash(glab auth status*) Bash(glab mr view*) Bash(glab mr create --draft *) Bash(glab mr update --ready*) EnterWorktree ExitWorktree Bash(git ls-files *) Bash(git grep -n *) Bash(git grep -l *) Write(aidd_docs/tasks/**) Edit(aidd_docs/tasks/**) Edit(docs/prd.md) Edit(docs/user-stories.md) Bash(git fetch origin) Bash(pulse-aidd revue *) Bash(pulse-aidd verifier-plan *) Write(docs/technical.md) Edit(docs/technical.md) Edit(./CLAUDE.md) Write(aidd_docs/memory/**) Edit(aidd_docs/memory/**) Bash(pulse-aidd secrets verifier *) Bash(pulse-aidd contexte ui) Bash(pulse-aidd comparer *) Bash(pulse-aidd identite *) Bash(pulse-aidd maquettes verifier *) Bash(pulse-aidd textes verifier *) Bash(pulse-aidd contraste *) Bash(start "" *.html) Bash(open *.html) Bash(xdg-open *.html) Write(docs/design.md) Edit(docs/design.md) Write(docs/design/**) Edit(docs/design/**) Bash(pulse-aidd realisation *) Bash(pulse-aidd attente *) Bash(pulse-aidd copies) Bash(pulse-aidd contexte review) Bash(pulse-aidd contexte auto-fix) Bash(pulse-aidd contexte fix) Bash(pulse-aidd etape spirc)
---

# /pulse:spirc – Spécifier, Planifier, Implémenter, Relire, Commiter

## Objectif

### Principe (à présenter en 3 lignes)

« Je fais travailler des assistants spécialisés, chacun dans son rôle : l'un **explore**, l'un **réalise**, d'autres **relisent** et **vérifient** sans avoir écrit le code. Je m'arrête pour votre accord sur le plan, et c'est **vous** qui testez chaque tâche avant qu'elle soit envoyée (en mode autonome : toutes les tâches ensemble, à la fin). »

```
plan existant ─────────────────────────────┬─ pour chaque tâche : ([T] Tests d'abord) → [I] Implémenter → [R] Relire et vérifier → test par vous* → [C] Commiter → mémoire*
pas de plan ── [S] Spécifier ─ [P] Planifier ┤   (une US = une spec = un plan)
demande libre ─ [A] Analyser (ajout au plan) ┘
* en mode autonome : regroupés à la fin (test groupé, puis envoi et mémoire)
```

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte spirc` et lire sa sortie en entier) pendant toute la commande.

### Comment appliquer une étape de la méthode

Pour les étapes Tech, US, Spec, Plan et Commit, **lancer l'étape voulue** : `pulse-aidd etape tech --sans-communes`, `pulse-aidd etape us --sans-communes`, `pulse-aidd etape spec --sans-communes`, `pulse-aidd etape plan --sans-communes`, ou l'étape Commit (décrite plus bas). Puis appliquer sa section « Processus » à l'identique (prérequis, questions, fichiers produits, garde-fous), **hors** son bloc de fin de commande. L'étape Commit se charge une seule fois, au démarrage de la réalisation (section « Choisir la façon de travailler »), et sert à chaque tâche.

## Contexte

Arguments reçus : `$ARGUMENTS`

Identifiant de cette session : `${CLAUDE_SESSION_ID}` (à passer à `pulse-aidd sessions`).

### Lire les arguments

**Raccourcis (facultatifs)**, placés avant l'US, regroupables (`-axw` = `-a -x -w`, dans n'importe quel ordre). Une lettre inconnue : la signaler et demander ce que la personne voulait. **Sans aucune option**, tout se choisit dans la ronde de départ (ci-dessous) ; **avec au moins une option**, le rythme est celui du profil (« rapide » vaut `-f`) ; profil « à choisir » ou absent : complet (pas à pas, avec points de validation, sans contrôle de sécurité supplémentaire), sans question. Les **tests** se choisissent par une question dès que `-t` est absent, avec ou sans autre option (comme `/pulse:implement`).
- `-a` **autonome** : enchaîner les tâches sans s'arrêter : point de validation ✋ 2 et « Continuer avec T4 ? » sautés, constats de relecture traités automatiquement (Critique, Haute et Moyenne corrigés, Basse confrontés au code : règles de relecture). **Le test par la personne et l'accord sur la mémoire sont regroupés à la fin**, en une seule fois (§ « Test groupé »). La validation du plan quand il vient d'être créé s'obtient avant de partir. En cours de route, une décision de la personne attend dans le plan et seule sa tâche s'arrête (§ « Questions en attente ») ; un petit choix est pris et noté (même §).
- `-t` **tests d'abord** : avant le code de chaque tâche, `pulse:test-writer` écrit ses tests, qu'on voit échouer ; le code doit ensuite les faire passer, contrôlé par `pulse:test-runner` (référence « Tests d'abord », chargée au démarrage de la réalisation, § [T]).
- `-x` **contrôle de sécurité à chaque tâche** : ajouter un audit de sécurité (`pulse:security-auditor`) à l'examen de chaque tâche.
- `-w` **dossier à part (worktree)** : réaliser le plan dans un dossier à part du projet, sur sa propre branche (référence « Travailler dans un worktree », chargée au démarrage de la réalisation). Sans `-w`, si une autre session semble travailler sur ce dossier, le dossier à part est proposé (même avec `-a` : c'est une décision de la personne).
- `-f` **rapide** : le rythme rapide pour cette réalisation, sans changer le profil (règles de réalisation, « Rythme ») : autonome (`-a`), tests essentiels (référence « Tests automatiques », § 2 bis), et une fiche de test complète de l'US à la fin.
- `-d` **devant vous** : chaque tâche est réalisée dans cette conversation, sous vos yeux ([I]) ; la relecture et la vérification restent faites par des assistants qui n'ont pas écrit le code. Avec `-a` ou `-f` (un profil « rapide » vaut `-f`), demander lequel garder.

**US** (premier argument après les options) : l'US dont on réalise le plan (`aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`), désignée selon les règles des tâches. Une US qui a une spec sans plan, ou ni spec ni plan : commencer à § S ou § P. Absent ou introuvable : lister les plans (en premier celui qui a une tâche `[~]`) et demander lequel, avec en dernière réponse « Spécifier et planifier une autre US » (§ S).

**Série** : plusieurs US (`US-001 US-003`) ou `version` (les US Indispensables encore à faire) : lancer `pulse-aidd reference spirc/serie.md` et l'appliquer. On prépare d'abord toutes les specs et tous les plans avec la personne, puis on les réalise à la suite, en autonome.

**Ronde de départ** : sans aucune option, poser avant toute étape, même en mode découverte, **une seule ronde** (un appel AskUserQuestion, la réponse recommandée en premier), après avoir chargé les références de la réalisation (premier paragraphe de « Choisir la façon de travailler ») :
1. **Rythme** (seulement si la ligne « Rythme » du profil de `CLAUDE.md` vaut « à choisir » ou manque ; « rapide » vaut `-f`, « complet » vaut la réponse « Complet ») : « Comment réaliser cette user story ? » → « Rapide (Recommandé) » (l'essentiel des tests, les tâches enchaînées, vous testez toute l'US à la fin) / « Complet » (tests détaillés, vous testez chaque tâche). « Rapide » vaut `-f`.
2. **Options**, à cocher (`multiSelect`, aucune cochée possible) : « Quelles options voulez-vous ? » → « Enchaîner les tâches sans m'arrêter » (`-a`, déjà compris dans Rapide : je note vos décisions et vous les pose ensemble ; vous testez tout à la fin) / « Un contrôle de sécurité à chaque tâche » (`-x`) / « Travailler dans un dossier à part » (`-w`) ; si un signe d'une autre session est trouvé (§ 1 de la référence « Travailler dans un worktree »), le citer dans la description de cette option et la mettre en premier.
3. **Tests** (si la question 1 est posée, ou si le profil vaut « complet ») : « Si vous choisissez Complet, quels tests ? » → les réponses de « 2. Choisir au démarrage » de la référence « Tests automatiques » ; « Tests d'abord » vaut `-t`. Avec « Rapide », cette réponse est sans effet.
4. **Envoi** (dépôt distant présent, ligne « Envoi » du plan à choisir ou plan pas encore écrit) : la question de « 2. Choisir comment envoyer le travail d'un plan » de la référence « Le dépôt distant et l'envoi du travail », avec « Directement sur la version principale » recommandé en mode découverte.

Annoncer ensuite les choix retenus en une ligne (« Rapide · autonome · dossier à part · envoi : version principale »). La réponse « Envoi » s'écrit dans la ligne « Envoi » du plan dès qu'il existe.

**Portée** (le reste des arguments) :
- **vide** : toutes les tâches `[~]` et `[ ]` du plan, dans l'ordre ;
- `T3` (ou autre identifiant) : uniquement cette tâche, qui doit appartenir au plan (sinon indiquer le plan qui la contient et demander) ;
- **une demande libre** (« ajouter un filtre par date », « le bouton Supprimer ne marche pas ») : un seul changement, cadré puis ajouté au plan (§ A).

### Prérequis

- `CLAUDE.md` et un dépôt Git sont nécessaires. Sinon, proposer `/pulse:init`.
- `docs/prd.md` est nécessaire (le périmètre MVP en dépend). S'il manque : si `docs/brief.md` existe, proposer `/pulse:prd`, sinon `/pulse:brainstorm`. S'arrêter là.
- `docs/technical.md` est nécessaire : sinon, appliquer d'abord l'étape **tech** (même avec `-a` : le choix de la pile appartient à la personne). Installer et coder une fois la pile choisie.
- Des modifications non enregistrées qui ne concernent pas la tâche à reprendre : avec l'accord de la personne, appliquer d'abord l'étape **review** (`pulse-aidd etape review --sans-communes`) puis l'étape **commit** (`pulse-aidd etape commit --sans-communes`, à lancer à ce moment-là, sauf si elle est déjà chargée) sur ces modifications. Un commit = une seule tâche.

## Rôle

### Les rôles (à respecter strictement)

| Rôle | Qui | Ne fait jamais |
|---|---|---|
| Orchestrer, parler à la personne, écrire `docs/` et la mémoire, commiter | vous (cette commande) | coder une tâche soi-même, sauf avec `-d` |
| Rassembler les faits | sous-agent `pulse:explorer` | modifier un fichier, décider |
| Écrire les tests (`-t`) | sous-agent `pulse:test-writer` | toucher au code de production |
| Réaliser une tâche | sous-agent `pulse:implementer` | planifier, toucher `docs/`, commiter, juger son travail, modifier les tests figés |
| Lancer les tests et trier les échecs (`-t`) | sous-agent `pulse:test-runner` | modifier un fichier |
| Relire (critères, sécurité, besoin) | sous-agent `pulse:reviewer` | modifier un fichier |
| Prouver que ça marche | sous-agent `pulse:verifier` | modifier un fichier |
| Audit sécurité (`-x`) | sous-agent `pulse:security-auditor` | modifier un fichier |

- Les sous-agents lisent eux-mêmes les fichiers du projet et les références du plugin : un message de délégation porte seulement ce qui est propre à la tâche (pour l'implementer : « Déléguer à l'implementer »).
- Lancer **en parallèle** (plusieurs appels Agent dans le même message) les sous-agents indépendants.
- Si un sous-agent n'est pas disponible : faire son travail soi-même en suivant **strictement** ses consignes (`pulse-aidd agent <nom>`), et le signaler. Pour la relecture, la faire de préférence dans un contexte distinct de celui qui a écrit le code ; sinon, le dire à la personne.
- **Travail en cours** : à chaque arrêt pour la personne (✋ 2, test manuel, questions en attente, test groupé, choix de correction, « Continuer avec T4 ? »), écrire `aidd_docs/tasks/in-progress.md` (règle commune 16) ; l'effacer (`pulse-aidd travail-fini`) quand la personne a répondu. Le relancement de `/pulse:spirc <US-XXX>` lit ce fichier et reprend à cette étape.

## Processus

### [A] Analyser – seulement pour une demande libre

Lancer `pulse-aidd reference spirc/analyser.md` et l'appliquer : la demande devient une tâche du plan (ou une nouvelle US), puis ✋ 2.

### [S] Spécifier – seulement s'il n'y a pas encore de plan

Quand la personne choisit « Spécifier et planifier une autre US », que l'US désignée n'a pas encore de spec, ou qu'une demande a créé une nouvelle US :
- Si `docs/user-stories.md` manque : appliquer l'étape **us**.
- Sans US désignée : la demander (les US sans spec, dans l'ordre du parcours, ou une demande décrite), puis appliquer l'étape **spec** avec cette **seule** US. Si sa spec existe déjà sans plan, passer à § P.

La validation de la spec par l'étape **spec** vaut accord pour passer au plan : enchaîner sur § P, sans nouvelle question. Si sa ligne « Maquettes » vaut « à voir » : d'abord lancer `pulse-aidd etape ui --sans-communes` et appliquer son action « maquettes » pour cette US (propositions, comparaison, choix de la personne), puis § P, qui cite la maquette retenue. Une spec restée en brouillon (des `TBD:` restants) attend les réponses de la personne avant le plan, même avec `-a`.

### Choisir la façon de travailler

**Charger une seule fois les références de la réalisation** : chacune par son propre appel, dans le même message (chaque sortie reste lisible en entier) : `pulse-aidd etape commit --sans-communes` (conventions Git, envoi du travail ; inutile si les prérequis l'ont déjà chargée), `pulse-aidd reference worktree.md`, `pulse-aidd reference tests-automatiques.md` ; avec `-t` ou la réponse « Tests d'abord », aussi `pulse-aidd reference tests-dabord.md`. Elles servent à cette ronde et à chaque tâche de la boucle.

Avant la boucle par tâche (spec et plan écrits et validés), appliquer les choix de la ronde de départ. Avec au moins un raccourci, poser en **une seule ronde** les questions de la ronde de départ restées sans réponse, jamais le rythme : **Tests** (sans `-t` ni rythme rapide : « 2. Choisir au démarrage » de la référence « Tests automatiques »), **Envoi** (« 2. Choisir comment envoyer le travail d'un plan » de la référence « Le dépôt distant et l'envoi du travail », même en autonome : c'est une décision de la personne), **Dossier à part** (« 1. Faut-il un worktree ? » de la référence worktree). « Tests d'abord » vaut `-t`. Le point ✋ 2 déjà passé ne se rejoue pas.

**Rythme rapide** (règles de réalisation) ou option `-f` : autonome et tests essentiels, sans question sur le rythme ni les tests.

**Mode autonome** (`-a`, `-f`, rythme rapide) : `pulse-aidd autorisations` ; s'il en manque, appliquer `pulse-aidd reference autorisations.md` avant la première tâche. Puis dire : « Vous pouvez faire autre chose : je note mes questions et vous les pose toutes ensemble ; une notification vous prévient ; `/pulse:status` dit où on en est. »

**Marqueur de réalisation** (reprise comprise) : avant la première tâche, `pulse-aidd realisation debut <US-XXX> --commande spirc --rythme <complet|rapide>` (plus `--autonome` en mode autonome, `--devant` avec `-d` ou sans agent disponible), puis `pulse-aidd realisation questions <n>` si le plan a des questions ouvertes. À chaque étape, `pulse-aidd realisation etape <Tn> <étape>` : `test` ([T]), `realisation` ([I]), `examen` ([R]), `commit` ([C]), `questions` (arrêt pour les questions) et `test-groupe` (avec `<US-XXX>` à la place de la tâche).

Puis, si un dossier à part est retenu : `pulse-aidd reference worktree-dossier.md`, « 2. Créer le worktree ou y revenir ». La spec et le plan doivent être enregistrés avant (`docs: spec et plan de US-XXX`), pour que ce dossier les contienne. Toute la suite (réalisation, relecture, commits) se fait dans ce dossier. Sans dossier à part, en mode PR : préparer la branche de l'US (§ 2 de la référence « Le dépôt distant et l'envoi du travail »). Puis appliquer « 4. Suggérer une US à mener en parallèle » de la référence worktree.

### [P] Planifier

- Plan à créer : appliquer l'étape **plan** avec l'US de § S. Sa validation vaut ✋ 2 : l'étape écrit elle-même la ligne « plan validé » du journal (ne pas l'ajouter une seconde fois). Cette validation est la seule question sur le plan, y compris avec `-a` : le plan fixe le besoin, c'est une décision de la personne (règles communes § 1, « les validations restent »). Plan existant avec « Statut : à valider » : reprendre l'étape **plan** à son contrôle (étape 3 de son déroulé), jusqu'à sa validation. Plan existant validé : lancer `pulse-aidd verifier-plan <US-XXX>`, puis montrer la liste résumée de ses tâches (titres et statuts) ; chaque constat « à corriger » se montre en une ligne, avec « Corriger le plan d'abord (Recommandé) » (étape **refine**) / « Commencer quand même ».

✋ **Point de validation 2** (plan existant ou demande libre, sauf `-a`) : « Le plan vous convient ? On commence la réalisation ? » Pour une demande libre : montrer la tâche ajoutée (objectif, critères, fichiers). Si la personne veut le modifier : appliquer l'étape **refine** (`pulse-aidd etape refine --sans-communes`) avec ses remarques, puis reposer la question. Une fois le plan accepté, ajouter au journal du plan la ligne « plan validé » (règles de réalisation ; en mode autonome : « plan accepté sans validation, mode autonome »).

### Boucle par tâche

À chaque lancement, y compris une reprise (`/clear`, `aidd_docs/tasks/in-progress.md`) : avant la première tâche, le test groupé ou la fin (le premier des trois), si les références de la réalisation ne figurent pas dans la conversation, lancer les commandes de « Choisir la façon de travailler ». Une reprise sans tâche restante passe donc aussi par là.

Tâches concernées, dans l'ordre du plan : les tâches `[ ]` ou `[~]` de la portée. Une tâche `[~]` est reprise là où elle en était : lancer `pulse-aidd revue <Tn>` et suivre sa ligne `reprendre` (en rythme rapide, `examen` : relancer ses contrôles, puis [C]) : `examen` → [R] étape 1 ; `correction` → [R] étape 3 ; `test` → [R] étape 4 (le test par la personne) ; `commit` → [C] ; `decision` → elle attend une réponse : passer à la tâche suivante (§ « Questions en attente ») ; `aide` → arrêter la boucle, expliquer le blocage et proposer de taper `/pulse:get-help`.

**Tâche « Mettre en ligne… »** : attendre l'accord de la personne, même avec `-a` (en mode autonome, elle passe après le test groupé). Demander : « Mettre en ligne maintenant (Recommandé) » / « Plus tard ». Si oui, appliquer l'étape **deploy** (`pulse-aidd etape deploy --sans-communes`).

#### [T] Tests d'abord (avec `-t`)

Lancer `pulse-aidd reference tests-dabord.md` s'il ne figure pas dans la conversation, puis appliquer « Rouge : écrire les tests » : `pulse:test-writer`, puis `pulse:test-runner` en phase « rouge attendu », puis tests figés. Une tâche dont la ligne `Tests` vaut « aucun » passe directement à [I].

#### [I] Implémenter

1. Marquer la tâche `[~]` dans le plan. Annoncer en 3 lignes : « **T3 – Titre**. Ce qui va être fait : … »
2. Déléguer à **`pulse:implementer`** selon « Déléguer à l'implementer » (le message, puis le retour). Le pack de pile est chargé par l'agent. Avec `-d`, ou quand l'agent est indisponible (dans les deux cas, marqueur lancé avec `--devant`) : la sortie de `pulse-aidd realisation etape <Tn> realisation`, fiche du pack de pile comprise, se lit en entier avant le premier fichier écrit. Puis lancer `pulse-aidd agent implementer` et appliquer, dans cette conversation, ses « Règles absolues », sa « Méthode » et la fiche ainsi chargée (son « Pack de pile »), en annonçant chaque étape ; s'arrêter de la même façon dès qu'un choix de la personne apparaît.
3. À son retour, appliquer « Au retour » de « Déléguer à l'implementer » (avec `-d` : une fois le code écrit). **Terminé** : avec les tests d'abord (`-t` ou la réponse « Tests d'abord »), appliquer d'abord « Vert : réaliser » (étape 5) et « Trier les échecs » de la référence « Tests d'abord », jusqu'au verdict ✅ Vert ou à l'arrêt après deux cycles ; puis passer à l'examen.

#### [R] Relire et vérifier (eXaminer)

**Rythme rapide** : pas de [R] par tâche ; après [I] et ses contrôles, passer à [C]. Toute l'US s'examine à la fin (§ « Test groupé »), et la notion du jour s'y donne une fois.

1. **Examiner** : appliquer le § 2 de la référence « Examiner une tâche » (`pulse:reviewer` et `pulse:verifier` en parallèle ; avec `-t`, le reviewer reçoit aussi les fichiers de test et le dernier rapport du test-runner ; avec `-x`, l'audit de sécurité).
2. **Écrire le rapport** : § 3 de la même référence (avec `-t`, la section `## Tests automatiques` ; avec `-x`, `## Audit de sécurité`).
3. **Trier les constats** :
   - **écart de besoin** (la demande elle-même est à revoir) : le présenter simplement et demander à la personne (en mode autonome : § « Questions en attente ») ; si elle change le contrat, mettre à jour la tâche dans le plan (et le fichier de l'US), puis reprendre à [I] ;
   - **défauts de réalisation** (constats du reviewer, critères ❌ du verifier, constats de l'audit avec `-x`) : appliquer « Les constats de relecture » des règles de relecture et noter chaque décision dans « Suite donnée aux constats » ; relancer `pulse:implementer` avec la liste à corriger et les familles de qualité qu'ils concernent (« Déléguer à l'implementer », une correction ; avec `-d`, corriger ici : `pulse-aidd pile contexte implement` s'il ne figure pas dans la conversation, puis `pulse-aidd qualite <famille>` pour chaque famille des constats, une commande par famille), puis la relecture de contrôle (§ 4 de la référence « Examiner une tâche ») ; après un test de la personne ❌, remettre la ligne « Résultat » de « Test par la personne » à la valeur du modèle, comme le décrit ce § 4 ;
   - **Deux cycles de correction au maximum.** Si un constat Critique persiste : laisser la tâche `[~]` ; pas à pas, arrêter la boucle, expliquer simplement le blocage et proposer de taper `/pulse:get-help` ; en mode autonome, § « Questions en attente », et la boucle continue avec les tâches qui n'en dépendent pas.
4. **Le test par la personne** (toujours ; en mode autonome, il est **reporté au test groupé** : noter « ⏳ reporté au test groupé » dans « Test par la personne » du rapport, garder ses étapes dans le rapport, et passer au commit sans s'arrêter). Hors mode autonome : présenter le **rapport de réalisation** (règles communes § 4, construit à partir du tableau du verifier) et les 3 points les plus importants de la relecture **en langage simple**, puis la fiche de test de la tâche, selon « 3 bis. Écrire la fiche de test de la personne » de la référence « Examiner une tâche » (fiche `SMOKE-TEST-…` écrite, application lancée, lien vers la fiche et sa première étape). Demander « Le test est-il concluant ? » → « Oui, tout fonctionne » / « Non, quelque chose ne va pas ». Noter « ✅ concluant » ou « ❌ non concluant : <ce qui ne va pas> » (les choix du modèle) dans « Test par la personne » du rapport ; après un nouveau test (suite à une correction), réécrire cette section avec le dernier résultat. Si non : recueillir ce qui ne va pas, et le traiter comme un constat Critique (étape 3).
5. **💡 La notion du jour** : choisir **une** notion de programmation présente dans le code de la tâche, montrer un extrait de 3 à 8 lignes et l'expliquer simplement. Choisir de préférence une notion absente du lexique, puis l'y ajouter (règle commune § 1, « Le lexique »).

#### [C] Commiter

Appliquer l'étape **commit** chargée au démarrage de la réalisation (contrôles de sécurité, message `<type>(<Tâche>): …`, plan mis à jour en `[x]` avec sa ligne de journal, remarque selon les règles de réalisation). Le § 2 de l'étape commit donne `commit` (tâche relue, vérifiée et testée, ou test reporté en mode autonome) : passer directement à l'enregistrement.

En mode autonome : enregistrer en local, et **attendre la fin du test groupé pour l'envoi** (§ 3 de la référence « Le dépôt distant et l'envoi du travail ») ; la remarque du journal vaut « mode autonome · test reporté ».

#### Mémoire

Repérer ce qui mérite d'être retenu pendant la tâche : un piège rencontré, une convention apparue, un mot du métier précisé, une décision (avec les 3 conditions pour un fichier de décision). S'il y a quelque chose, lancer `pulse-aidd reference memoire.md` (les règles de la mémoire projet, dont les 3 conditions d'un fichier de décision), puis le proposer **en une seule question** (en mode autonome : le garder pour la fin du test groupé) (lignes exactes et destinations) : « Ajouter à la mémoire (Recommandé) » / « Garder la mémoire telle quelle ». Si accepté : écrire, lancer `pulse-aidd memoire`, et inclure ces fichiers au **commit suivant** (ou dans un commit `docs: mémoire …` si c'était la dernière tâche). Réserver la proposition à ce qui est durable.

#### Entre deux tâches

Annoncer l'avancement en une ligne : `T3 ✅ terminée · US-XXX : 3/6`.

✋ **Après chaque tâche** (sauf `-a`) : « Continuer avec T4 – <titre> ? » → « Continuer » / « Faire une pause ».

**Garde-fou anti-secrets déclenché** : expliquer, corriger (avec un pack de pile, après `pulse-aidd pile contexte implement`), puis reprendre l'étape en cours.
**Conversation longue** (hors mode autonome) : après 3 tâches, rappeler qu'on peut faire `/clear` puis relancer `/pulse:spirc <US-XXX>` : la commande reprend automatiquement grâce aux statuts du plan, aux rapports de revue et à la mémoire.
**Reprise** (après `/clear`, un résumé automatique ou la limite d'utilisation) : relire l'état dans le plan, `pulse-aidd revue <Tn>` et `pulse-aidd realisation` ; ces fichiers font foi, le souvenir de la conversation peut être incomplet.

### Questions en attente (mode autonome)

Une décision de la personne arrête seulement sa tâche, par exemple T4 : question de besoin, de priorité, de périmètre, de sécurité ou de coût, « Bloqué – décision nécessaire », écart de besoin, action manuelle, ou constat Critique qui persiste après deux cycles (« T4 : constat Critique non résolu » · Options : « Demander de l'aide (`/pulse:get-help`) (Recommandé) » / « Laisser cette tâche pour plus tard » ; la tâche reste `[~]`). Après la réponse, la sous-ligne « En pause » reste : aide → proposer de taper `/pulse:get-help` ; plus tard → la tâche est citée dans « Fin ».

**Petit choix** : il se défait facilement et ne touche ni ce que promet la spec, ni le périmètre, ni les données gardées, ni la sécurité, ni un coût (un nom, l'ordre de deux boutons, le texte d'un message, l'organisation interne du code). Le prendre avec sa recommandation, l'écrire dans « Choix faits par Pulse » du plan (`- T4 · <choix retenu> · Autre possibilité : … · Raison : …`), puis relancer l'agent. Dans le doute, c'est une question en attente.

Pour une question en attente :

1. **Noter** dans « Questions en attente » du plan, au format du modèle de plan : `- [ ] Q<n> · T4 · <question en mots de tous les jours> · Options : <a> / <b> · Recommandé : <a>`. Sous T4 et sous chaque tâche qui en dépend (« Dépend de »), ajouter la sous-ligne `En pause : Q<n> (votre décision)`. Puis `pulse-aidd realisation questions <nombre de questions ouvertes>` (en série : de toute la série).
2. **Mettre de côté le travail commencé** sur T4 : `pulse-aidd attente mettre-de-cote T4 -- <fichiers de T4>` (ceux que `git status` montre pour T4, tests figés de « Tests d'abord » compris ; les documents de `docs/` et `aidd_docs/` restent en place). `fait` : ajouter sa `ligne-plan` à la ligne de la question ; le commit d'une autre tâche reste ainsi sans fichier de T4. `rien-a-mettre-de-cote` : T4 n'a changé que des documents ; continuer. `refuse` (rien n'a bougé : les lignes `inconnu`, `deja` ou `refuse` disent pourquoi ; le travail de T4 reste en place) ou `echec` (le travail de T4 reste disponible : dans le dossier pour les `fichier-reste`, et dans la copie de côté signalée par `mise-de-cote-orpheline`, à garder) : c'est l'arrêt unique : l'expliquer simplement, proposer de taper `/pulse:get-help` et laisser toutes les tâches en l'état.
3. **Continuer** avec la tâche suivante qui n'attend rien.
4. **Arrêt unique**, quand plus aucune tâche ne peut avancer, ou à la fin de la portée : les questions d'abord, puis le test groupé. Écrire `in-progress.md`, puis poser toutes les questions ensemble (AskUserQuestion, 4 par ronde, la recommandation en premier). Pour chaque réponse : cocher la ligne (`- [x] … · Réponse : <a> (AAAA-MM-JJ)`), noter la décision dans « Ajouts proposés par Pulse », retirer la sous-ligne `En pause : Q<n>` de chaque tâche qu'elle bloquait, et mettre à jour `pulse-aidd realisation questions <n>`.
5. **Remettre le travail en place** avant de reprendre T4 : `pulse-aidd attente remettre T4`. `remis` : le travail de T4 est revenu tel quel, tests figés compris ; reprendre T4. `absente` : rien n'est mis de côté pour T4 ; si la ligne de la question dit « Mis de côté », l'expliquer simplement et proposer de taper `/pulse:get-help`, sinon reprendre T4. `echec` : la copie de côté ne se lit pas (rien n'a bougé) ; l'expliquer simplement, proposer de taper `/pulse:get-help` et laisser tout en l'état. `arbre-occupe` : d'autres changements en cours (les documents de `docs/` et `aidd_docs/` modifiés ne comptent pas), ou un fichier déjà présent à la place de ceux de T4 ou de leurs dossiers, empêchent la remise (rien n'a bougé) ; garder le travail de côté, l'expliquer simplement et proposer de finir et d'enregistrer d'abord l'autre travail (sans rien lancer à la place de la personne), ou demander (AskUserQuestion : « Demander de l'aide (`/pulse:get-help`) (Recommandé) » / « Laisser T4 pour plus tard »). `conflit` : tout est revenu à l'état d'avant et le travail reste mis de côté ; c'est l'arrêt unique : expliquer simplement (les `fichier-en-conflit` disent où), proposer de taper `/pulse:get-help` et laisser toutes les tâches en l'état. `conflit-non-nettoye` : un reste de la remise n'a pas pu être défait ; l'expliquer simplement, proposer de taper `/pulse:get-help` et laisser tout en l'état. `remis-sans-nettoyage` : le travail est en place, l'entrée restante sera à retirer plus tard (le dire dans le récapitulatif). Puis reprendre les tâches débloquées (boucle par tâche), avant le test groupé.

### Test groupé (mode autonome)

Quand toutes les tâches de la portée sont passées, après les réponses aux questions en attente, avant la tâche « Mettre en ligne… » (les tâches restées en pause sont hors du test) :

En rythme rapide, d'abord écrire `aidd_docs/tasks/in-progress.md` (« Pour reprendre : `/pulse:spirc <US-XXX>` »), puis lancer `pulse-aidd reference spirc/examen-us.md` et l'appliquer : toute la suite de tests, relecture et vérification de toute l'US en parallèle, corrections ; à une reprise, `pulse-aidd revue <US-XXX>` dit où reprendre. Les étapes ci-dessous lisent alors le rapport de l'US au lieu de ceux des tâches.

**En rythme complet** : lancer d'abord « Tester de bout en bout » (référence « Tests automatiques », § 2 ter), s'il existe ; un échec est un constat Critique, corrigé comme à l'étape 5.

1. **Les choix faits par Pulse** d'abord (section du plan), s'il y en a : chacun en une ligne, avec sa question (AskUserQuestion, 4 par ronde) « Garder ce choix (Recommandé) » / « Changer ce choix ». Un choix changé : noter la nouvelle décision sur sa ligne, puis corriger la tâche comme à l'étape 5.
2. Présenter, tâche par tâche, le **rapport de réalisation** (règles communes § 4) et, en langage simple, les constats corrigés et ceux écartés.
3. Écrire **une fiche de test complète de l'US**, `aidd_docs/tasks/<epic>/SMOKE-TEST-US-XXX-<nom>.md`, qui enchaîne les étapes de toutes les tâches dans l'ordre du plan (« 3 bis » de la référence « Examiner une tâche »), lancer l'application en arrière-plan, puis `pulse-aidd realisation etape <US-XXX> test-groupe` et donner le lien vers la fiche, sa durée et sa première étape.
4. Demander (AskUserQuestion) : « Les tests sont-ils concluants ? » → « Oui, tout fonctionne » / « Non, sur certaines tâches » (puis lesquelles et ce qui ne va pas).
5. Pour chaque tâche en échec : constat Critique, corrigé comme à l'étape 3 de [R] (implementer, relecture de contrôle), puis commit `fix(<Tâche>): …` ; refaire tester seulement ces tâches. Deux cycles au plus.
6. Mettre à jour « Test par la personne » de chaque rapport et ajouter une ligne au journal du plan (« test groupé concluant » ou « test groupé : <problème> corrigé »), enregistrées avec un commit `docs: résultat du test groupé de US-XXX`.
7. Envoyer le travail selon la ligne « Envoi » du plan (§ 3 de la référence « Le dépôt distant et l'envoi du travail »).
8. Proposer en **une seule question** les ajouts à la mémoire repérés pendant les tâches (lignes exactes et destinations ; règles : `pulse-aidd reference memoire.md`).

### Fin

Rythme complet hors autonome, US faite : lancer « Tester de bout en bout » (§ 2 ter des tests) ; échec = constat Critique.

Présenter un récapitulatif :

```
| Tâche | Tests auto | Examen | Constats (corrigés / écartés) | Test | Commit |
|---|---|---|---|---|---|
| T1 – … | 6 ✅ (ou —) | ✅ Validé · ✅ Prouvé | 3 / 1 | ✅ | abc1234 |
```

Ajouter, si c'est le cas : les ajouts à la mémoire, les idées notées « En attente » dans le PRD, les tâches restées `[~]` et pourquoi, les questions encore ouvertes, le travail encore mis de côté (`pulse-aidd attente liste`).

**Dans un worktree** : lancer `pulse-aidd reference worktree-dossier.md` et appliquer « 3. Terminer : rassembler le travail » (fusion, demande de fusion ou worktree gardé).

Une fois l'US réellement envoyée (travail publié, fusion ou demande de fusion faite), retirer ses captures de preuve : `pulse-aidd captures effacer <US-XXX>` (elle ne supprime que les images du verifier de cette US, dans `aidd_docs/captures/`).

Retirer le marqueur : `pulse-aidd realisation fin`.

Puis le bloc de fin de commande. Prochaine étape : `/pulse:deploy` si la première version (toutes les US Indispensables) est terminée et pas encore en ligne (pousser et déployer seulement avec l'accord de la personne), sinon `/pulse:spirc <US-XXX>` pour continuer, ou `/pulse:spirc <US-XXX suivante du parcours>` si ce plan est terminé (elle passera par la spec et le plan), ou `/pulse:security` pour un audit complet.

## Exemples

- `/pulse:spirc US-003` : les tâches du plan sont réalisées une à une par des assistants, puis relues ; pas à pas, vous testez chaque tâche avant qu'elle soit enregistrée.
- `/pulse:spirc -a US-003` : toutes les tâches s'enchaînent sans arrêt ; vos décisions sont notées et posées ensemble ; vous testez tout à la fin, en un seul parcours.
- `/pulse:spirc version` : les specs et les plans de toutes les US de la première version, préparés avec vous, puis réalisés à la suite ; à votre retour, les questions mises de côté et un test par US.
- `/pulse:spirc US-003 "le bouton Supprimer ne marche pas"` : la demande devient une nouvelle tâche du plan, montrée pour votre accord avant d'être réalisée.

## Références de la commande

!`pulse-aidd contexte spirc`

Ce contexte contient aussi « Examiner une tâche », le modèle de rapport de revue, « Déléguer à l'implementer » et le lexique. Les références de la réalisation (worktree, tests automatiques, conventions Git, envoi du travail) se chargent une seule fois, au démarrage de la réalisation : section « Choisir la façon de travailler ». Trois autres se lancent à la demande : `pulse-aidd reference tests-dabord.md` (tests d'abord), `pulse-aidd reference worktree-dossier.md` (dossier à part) et `pulse-aidd reference spirc/analyser.md` (demande libre). Les règles de la mémoire projet se chargent à l'étape « Mémoire ». Si ce contexte est absent, lancer `pulse-aidd contexte spirc` et lire sa sortie.

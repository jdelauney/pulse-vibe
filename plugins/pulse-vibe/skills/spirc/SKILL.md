---
description: Enchaîner tout le travail d'une user story (spirc = Spécifier, Planifier, Implémenter, Relire, Commiter) - des assistants indépendants explorent, codent, relisent et vérifient ; je m'arrête pour votre accord et vous testez chaque tâche ; la spec et le plan s'écrivent d'abord s'ils manquent
argument-hint: "<US-XXX> [T3 | \"une demande\"] (sans tâche ni demande : tout le plan de l'US)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte cicd) Bash(pulse-aidd contexte commit) Bash(pulse-aidd contexte deploy) Bash(pulse-aidd contexte perf) Bash(pulse-aidd contexte plan) Bash(pulse-aidd contexte pr) Bash(pulse-aidd contexte refine) Bash(pulse-aidd contexte spec) Bash(pulse-aidd contexte spirc) Bash(pulse-aidd contexte tech) Bash(pulse-aidd contexte us) Bash(pulse-aidd etape *) Bash(pulse-aidd agent *) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd guide) Bash(pulse-aidd installer-ci) Bash(pulse-aidd installer-hook) Bash(pulse-aidd memoire) Bash(pulse-aidd perf *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd pile squelette *) Bash(pulse-aidd piles) Bash(pulse-aidd secrets inventaire *) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd seo *) Bash(pulse-aidd sessions *) Bash(pulse-aidd sonder *) Bash(pulse-aidd travail-fini) Bash(pulse-aidd verifier) Bash(pulse-aidd pile contexte *) Bash(pulse-aidd secrets historique *) Edit(docs/lexique.md) Write(docs/lexique.md) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git add *) Bash(git commit -m *) Bash(git log *) Bash(git rev-parse *) Bash(git worktree list*) Bash(git worktree add *) Bash(git merge --abort) Bash(git branch --show-current) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch --merged*) Bash(git switch -c *) Bash(git switch feat/*) Bash(git switch main) Bash(git switch master) Bash(git remote -v) Bash(git remote get-url *) Bash(gh auth status*) Bash(gh pr view*) Bash(gh pr create --draft *) Bash(gh pr ready*) Bash(glab auth status*) Bash(glab mr view*) Bash(glab mr create --draft *) Bash(glab mr update --ready*) EnterWorktree ExitWorktree Bash(git ls-files *) Bash(git grep -n *) Bash(git grep -l *) Write(aidd_docs/tasks/**) Edit(aidd_docs/tasks/**) Edit(docs/prd.md) Edit(docs/user-stories.md) Bash(git fetch origin) Bash(pulse-aidd revue *) Write(docs/technical.md) Edit(docs/technical.md) Edit(./CLAUDE.md) Write(aidd_docs/memory/**) Edit(aidd_docs/memory/**) Bash(pulse-aidd secrets verifier *)
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

Appliquer les « Règles communes Pulse » (chargées dans « Contexte ») pendant toute la commande.

### Comment appliquer une étape de la méthode

Pour les étapes Tech, US, Spec, Plan et Commit, **lancer `pulse-aidd etape <commande> --sans-communes`**, puis appliquer sa section « Processus » à l'identique (prérequis, questions, fichiers produits, garde-fous), **hors** son bloc de fin de commande. L'étape Commit se charge une seule fois, au démarrage de la réalisation (section « Choisir la façon de travailler »), et sert à chaque tâche.

## Contexte

!`pulse-aidd contexte spirc`

Ce contexte contient aussi « Examiner une tâche », le modèle de rapport de revue et le lexique. Les références de la réalisation (worktree, tests automatiques, conventions Git, envoi du travail) se chargent une seule fois, au démarrage de la réalisation : section « Choisir la façon de travailler ». Les règles de la mémoire projet se chargent à l'étape « Mémoire ». Si ce contexte est absent, lancer `pulse-aidd contexte spirc` et lire sa sortie.

Arguments reçus : `$ARGUMENTS`

Identifiant de cette session : `${CLAUDE_SESSION_ID}` (à passer à `pulse-aidd sessions`).

### Lire les arguments

**Raccourcis (facultatifs)**, placés avant l'US, regroupables (`-axw` = `-a -x -w`, dans n'importe quel ordre). Une lettre inconnue : la signaler et demander ce que la personne voulait. **Sans aucune option**, tout se choisit dans la ronde de départ (ci-dessous) ; **avec au moins une option**, le rythme non précisé prend sa valeur par défaut (pas à pas, avec points de validation, sans contrôle de sécurité supplémentaire), sans question. Les **tests** se choisissent par une question dès que `-t` est absent, avec ou sans autre option (comme `/pulse:implement`).
- `-a` **autonome** : enchaîner les tâches sans s'arrêter : point de validation ✋ 2 et « Continuer avec T4 ? » sautés, constats de relecture traités automatiquement (Critique, Haute et Moyenne corrigés, Basse confrontés au code : règles communes § 6). **Le test par la personne et l'accord sur la mémoire sont regroupés à la fin**, en une seule fois (§ « Test groupé »). S'arrêtent toujours en cours de route : la validation du plan quand il vient d'être créé, les questions de besoin, de priorité ou de périmètre (dont « Bloqué – décision nécessaire » et les écarts de besoin) et les actions manuelles.
- `-t` **tests d'abord** : avant le code de chaque tâche, `pulse:test-writer` écrit ses tests, qu'on voit échouer ; le code doit ensuite les faire passer, contrôlé par `pulse:test-runner` (référence « Tests automatiques : tests d'abord », chargée au démarrage de la réalisation, § [T]).
- `-x` **contrôle de sécurité à chaque tâche** : ajouter un audit de sécurité (`pulse:security-auditor`) à l'examen de chaque tâche.
- `-w` **dossier à part (worktree)** : réaliser le plan dans un dossier à part du projet, sur sa propre branche (référence « Travailler dans un worktree », chargée au démarrage de la réalisation). Sans `-w`, si une autre session semble travailler sur ce dossier, le dossier à part est proposé (même avec `-a` : c'est une décision de la personne).
- `-f` **rapide** : le rythme rapide pour cette réalisation, sans changer le profil (règles communes § 1, « Rythme rapide ») : autonome (`-a`), tests essentiels (référence « Tests automatiques », § 2 bis), et une fiche de test complète de l'US à la fin.

**US** (premier argument après les options) : l'US dont on réalise le plan (`aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`), désignée selon les règles « User stories, specs et plans » ci-dessus. Une US qui a une spec sans plan, ou ni spec ni plan : commencer à § S ou § P. Absent ou introuvable : lister les plans (en premier celui qui a une tâche `[~]`) et demander lequel, avec en dernière réponse « Spécifier et planifier une autre US » (§ S).

**Ronde de départ** : sans aucune option, poser avant toute étape, même en mode découverte, **une seule ronde** (un appel AskUserQuestion, la réponse recommandée en premier), après avoir chargé les références de la réalisation (premier paragraphe de « Choisir la façon de travailler ») :
1. **Rythme** (sauf si le profil de `CLAUDE.md` indique « Rythme : rapide ») : « Comment réaliser cette user story ? » → « Rapide (Recommandé) » (l'essentiel des tests, les tâches enchaînées, vous testez toute l'US à la fin) / « Complet » (tests détaillés, vous testez chaque tâche). « Rapide » vaut `-f`.
2. **Options**, à cocher (`multiSelect`, aucune cochée possible) : « Quelles options voulez-vous ? » → « Enchaîner les tâches sans m'arrêter » (`-a`, déjà compris dans Rapide : je m'arrête seulement pour vos décisions : besoin, validation du plan, actions à la main ; vous testez tout à la fin) / « Un contrôle de sécurité à chaque tâche » (`-x`) / « Travailler dans un dossier à part » (`-w`) ; si un signe d'une autre session est trouvé (§ 1 de la référence « Travailler dans un worktree »), le citer dans la description de cette option et la mettre en premier.
3. **Tests** (seulement si la question 1 est posée) : « Si vous choisissez Complet, quels tests ? » → les réponses de « 2. Choisir au démarrage » de la référence « Tests automatiques » ; « Tests d'abord » vaut `-t`. Avec « Rapide », cette réponse est sans effet.
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
- Des modifications non enregistrées qui ne concernent pas la tâche à reprendre : proposer d'abord `/pulse:review` puis `/pulse:commit`. Un commit = une seule tâche.

## Rôle

### Les rôles (à respecter strictement)

| Rôle | Qui | Ne fait jamais |
|---|---|---|
| Orchestrer, parler à la personne, écrire `docs/` et la mémoire, commiter | vous (cette commande) | coder une tâche soi-même quand l'agent est disponible |
| Rassembler les faits | sous-agent `pulse:explorer` | modifier un fichier, décider |
| Écrire les tests (`-t`) | sous-agent `pulse:test-writer` | toucher au code de production |
| Réaliser une tâche | sous-agent `pulse:implementer` | planifier, toucher `docs/`, commiter, juger son travail, modifier les tests figés |
| Lancer les tests et trier les échecs (`-t`) | sous-agent `pulse:test-runner` | modifier un fichier |
| Relire (critères, sécurité, besoin) | sous-agent `pulse:reviewer` | modifier un fichier |
| Prouver que ça marche | sous-agent `pulse:verifier` | modifier un fichier |
| Audit sécurité (`-x`) | sous-agent `pulse:security-auditor` | modifier un fichier |

- Les sous-agents voient les fichiers du projet et chargent eux-mêmes les références du plugin (`pulse-aidd qualite`, `pulse-aidd reference checklist-securite.md`) : recopier dans chaque message de délégation les extraits utiles du projet (sections utiles de `docs/technical.md`, conventions de la mémoire).
- Lancer **en parallèle** (plusieurs appels Agent dans le même message) les sous-agents indépendants.
- Si un sous-agent n'est pas disponible : faire son travail soi-même en suivant **strictement** ses consignes (`pulse-aidd agent <nom>`), et le signaler. Pour la relecture, la faire de préférence dans un contexte distinct de celui qui a écrit le code ; sinon, le dire à la personne.
- **Travail en cours** : à chaque arrêt pour la personne (✋ 2, test manuel, test groupé, choix de correction, « Continuer avec T4 ? »), écrire `aidd_docs/tasks/in-progress.md` (règle commune 16) ; l'effacer (`pulse-aidd travail-fini`) quand la personne a répondu. Le relancement de `/pulse:spirc <US-XXX>` lit ce fichier et reprend à cette étape.

## Processus

### [A] Analyser – seulement pour une demande libre

1. **Explorer** : déléguer à `pulse:explorer` la demande, avec la consigne de rassembler les faits utiles (mémoire, US et critères liés, fichiers concernés, risques). Laisser l'explorateur trouver les faits : réserver à la personne les questions qu'il ne peut pas résoudre.
2. **Situer la demande** :
   - **correction** d'un comportement prévu par une US : garder cette US ; la tâche ira dans le plan de **cette** US (si ce n'est pas l'US désignée, le dire et continuer avec son plan) ;
   - **précision** d'une US déjà planifiée (un critère qui manque) : sa spec est verrouillée et reste telle quelle ; la précision devient une **nouvelle US** qui complète l'ancienne (cas suivant), avec sa spec et son plan ;
   - **nouveau comportement** prévu au PRD : créer une **nouvelle US** (numéro suivant, modèle d'US) dans l'epic qui convient (la demander : AskUserQuestion, l'epic la plus proche avec « (Recommandé) », « Un nouveau groupe »), écrire son fichier dans `aidd_docs/tasks/<epic>/` et l'ajouter au référentiel `docs/user-stories.md`. Elle aura sa propre spec et son propre plan : passer à § S avec cette US ;
   - **nouveau comportement hors PRD** : c'est une décision de périmètre, la poser (AskUserQuestion) : « La noter « En attente » dans le PRD (Recommandé) » / « L'ajouter au périmètre maintenant ». Dans le premier cas, l'écrire dans `docs/prd.md` et s'arrêter.
3. **Clarifier ce qui change ce qui sera construit**, et seulement cela : poser les questions de la frontière en une ronde (AskUserQuestion, 4 questions au plus, réponse recommandée en premier, « (Recommandé) »), deux rondes au maximum. Employer et respecter les mots du glossaire ; signaler un mot employé dans un autre sens.
4. **Écrire le contrat** (correction ou précision) comme une nouvelle tâche à la fin de la section `## Tâches` du plan de l'US concernée (avant une éventuelle tâche « Mettre en ligne la première version »), numérotée après le plus grand `Tn` de tous les plans de `aidd_docs/tasks/`, au format du plan : objectif vu par l'utilisateur, fichiers, critères d'acceptation **vérifiables**, et une ligne « Hors périmètre » si utile. Si elle touche plus de 3 fichiers ou couvre plus de 3 critères, la découper en plusieurs tâches.
5. La portée devient cette (ou ces) tâche(s). Passer à ✋ 2.

### [S] Spécifier – seulement s'il n'y a pas encore de plan

Quand la personne choisit « Spécifier et planifier une autre US », que l'US désignée n'a pas encore de spec, ou qu'une demande a créé une nouvelle US :
- Si `docs/user-stories.md` manque : appliquer l'étape **us**.
- Sans US désignée : la demander (les US sans spec, dans l'ordre du parcours, ou une demande décrite), puis appliquer l'étape **spec** avec cette **seule** US. Si sa spec existe déjà sans plan, passer à § P.

La validation de la spec par l'étape **spec** vaut accord pour passer au plan : enchaîner sur § P, sans nouvelle question. Une spec restée en brouillon (des `TBD:` restants) attend les réponses de la personne avant le plan, même avec `-a`.

### Choisir la façon de travailler

**Charger une seule fois les références de la réalisation** : lancer `pulse-aidd etape commit --sans-communes` (conventions Git, envoi du travail), `pulse-aidd reference worktree.md` et `pulse-aidd reference tests-automatiques.md`. Elles servent à cette ronde et à chaque tâche de la boucle. Si elles ne figurent plus dans la conversation (après `/clear` ou un résumé automatique), les relancer.

Avant la boucle par tâche (une fois la spec et le plan écrits et validés), appliquer les choix de la ronde de départ ou des raccourcis. Avec au moins un raccourci, poser seulement ce qui reste à choisir, en **une seule ronde** :

- **Tests** (seulement sans `-t` ni `-f`, et hors rythme rapide) : « 2. Choisir au démarrage » de la référence « Tests automatiques » ;
- **Envoi** : « 2. Choisir comment envoyer le travail d'un plan » de la référence « Le dépôt distant et l'envoi du travail » (même en autonome : c'est une décision de la personne) ;
- **Dossier à part** : « 1. Faut-il un worktree ? » de la référence worktree.

« Tests d'abord » vaut `-t`. Le point ✋ 2 déjà passé ne se rejoue pas.

**Rythme rapide** (règles communes § 1) ou option `-f` : autonome et tests essentiels, sans question sur le rythme ni les tests.

Puis, si un dossier à part est retenu, « 2. Créer le worktree ou y revenir ». La spec et le plan doivent être enregistrés avant (`docs: spec et plan de US-XXX`), pour que ce dossier les contienne. Toute la suite (réalisation, relecture, commits) se fait dans ce dossier. Sans dossier à part, en mode PR : préparer la branche de l'US (§ 2 de la référence « Le dépôt distant et l'envoi du travail »). Puis appliquer « 4. Suggérer une US à mener en parallèle » de la référence worktree.

### [P] Planifier

- Plan à créer : appliquer l'étape **plan** avec l'US de § S. Sa validation vaut ✋ 2 : l'étape écrit elle-même la ligne « plan validé » du journal (ne pas l'ajouter une seconde fois). Cette validation est la seule question sur le plan, y compris avec `-a` : le plan fixe le besoin, c'est une décision de la personne (règles communes § 1, « les validations restent »). Plan existant : montrer la liste résumée de ses tâches (titres et statuts).

✋ **Point de validation 2** (plan existant ou demande libre, sauf `-a`) : « Le plan vous convient ? On commence la réalisation ? » Pour une demande libre : montrer la tâche ajoutée (objectif, critères, fichiers). Si la personne veut le modifier : appliquer l'étape **refine** (`pulse-aidd etape refine --sans-communes`) avec ses remarques, puis reposer la question. Une fois le plan accepté, ajouter au journal du plan la ligne « plan validé » (règles communes § 7 ; en mode autonome : « plan accepté sans validation, mode autonome »).

### Boucle par tâche

À chaque lancement, y compris une reprise (`/clear`, `aidd_docs/tasks/in-progress.md`) : avant la première tâche, le test groupé ou la fin (le premier des trois), si les références de la réalisation ne figurent pas dans la conversation, lancer les commandes de « Choisir la façon de travailler ». Une reprise sans tâche restante passe donc aussi par là.

Tâches concernées, dans l'ordre du plan : les tâches `[ ]` ou `[~]` de la portée. Une tâche `[~]` est reprise là où elle en était : lancer `pulse-aidd revue <Tn>` et suivre sa ligne `reprendre` : `examen` → [R] étape 1 ; `correction` → [R] étape 3 ; `test` → [R] étape 4 (le test par la personne) ; `commit` → [C] ; `aide` → arrêter la boucle, expliquer le blocage et proposer `/pulse:get-help`.

**Tâche « Mettre en ligne… »** : attendre l'accord de la personne, même avec `-a` (en mode autonome, elle passe après le test groupé). Demander : « Mettre en ligne maintenant (Recommandé) » / « Plus tard ». Si oui, appliquer l'étape **deploy** (`pulse-aidd etape deploy --sans-communes`).

#### [T] Tests d'abord (avec `-t`)

Appliquer « Rouge : écrire les tests » (§ 4 de la référence « Tests automatiques ») : `pulse:test-writer`, puis `pulse:test-runner` en phase « rouge attendu », puis tests figés. Une tâche dont la ligne `Tests` vaut « aucun » passe directement à [I].

#### [I] Implémenter

1. Marquer la tâche `[~]` dans le plan. Annoncer en 3 lignes : « **T3 – Titre**. Ce qui va être fait : … »
2. Déléguer à **`pulse:implementer`** : la tâche (identifiant, titre, objectif, fichiers), ses critères d'acceptation complets, les sections « Pile retenue », « Organisation des fichiers », « Commandes du projet », « Données et contrôle d'accès » et « Secrets et variables d'environnement » de `docs/technical.md` (recopiées), la consigne de charger **les règles de qualité** avec `pulse-aidd qualite` (sécurité du code comprise), de consulter la **documentation officielle** de la technologie retenue pour toute API (vérifier plutôt que deviner), de **s'appuyer sur le code réel** (vérifier qu'un fichier ou module existe avant de s'en servir) et de lancer les contrôles automatiques de « Commandes du projet », les conventions et pièges de `aidd_docs/memory/technical.md`, les mots du glossaire utiles. Avec `-t` : en plus, ce que prévoit l'étape 4 de la référence « Tests automatiques » (fichiers de test, interface attendue, tests figés).
3. À son retour :
   - **Bloqué** sur une question de besoin : la poser à la personne, puis relancer l'agent avec la réponse.
   - **Bloqué** sur une action manuelle (appliquer un schéma dans la console du fournisseur, créer un compte, saisir une variable chez l'hébergeur) : guider la personne pas à pas, puis relancer.
   - **Bloqué – décision nécessaire** : présenter le choix à la personne en langage courant, avec ses options et leurs conséquences (AskUserQuestion) ; noter la réponse dans le plan (section « Ajouts proposés par Pulse ») et relancer l'agent avec elle. C'est une décision de la personne : elle interrompt aussi le mode autonome. En mode direct, s'arrêter de la même façon dès qu'un tel choix apparaît.
   - **Terminé** : avec `-t`, appliquer d'abord « Vert : réaliser » (étape 5) et « Trier les échecs » de la référence « Tests automatiques », jusqu'au verdict ✅ Vert ou à l'arrêt après deux cycles ; puis passer à l'examen. Les points « À signaler » sur `docs/` sont traités par vous (une idée hors périmètre va dans `docs/prd.md`, « En attente »).

#### [R] Relire et vérifier (eXaminer)

1. **Examiner** : appliquer le § 2 de la référence « Examiner une tâche » (`pulse:reviewer` et `pulse:verifier` en parallèle ; avec `-t`, le reviewer reçoit aussi les fichiers de test et le dernier rapport du test-runner ; avec `-x`, l'audit de sécurité).
2. **Écrire le rapport** : § 3 de la même référence (avec `-t`, la section `## Tests automatiques` ; avec `-x`, `## Audit de sécurité`).
3. **Trier les constats** :
   - **écart de besoin** (la demande elle-même est à revoir) : le présenter simplement et demander à la personne ; si elle change le contrat, mettre à jour la tâche dans le plan (et le fichier de l'US), puis reprendre à [I] ;
   - **défauts de réalisation** (constats du reviewer, critères ❌ du verifier, constats de l'audit avec `-x`) : appliquer « Les constats de relecture » des règles communes (§ 6). Avec `-a`, sans question : corriger tous les constats Critique, Haute et Moyenne ; pour chaque constat Basse, lire le passage cité dans le code et décider vous-même (corriger ou écarter, avec la raison). Noter chaque décision dans « Suite donnée aux constats ». Relancer `pulse:implementer` **avec la liste des constats à corriger**, puis la relecture de contrôle (§ 4 de la référence « Examiner une tâche ») ; après un test de la personne ❌, remettre la ligne « Résultat » de « Test par la personne » à la valeur du modèle, comme le décrit ce § 4 ;
   - **Deux cycles de correction au maximum.** Si un constat Critique persiste : arrêter la boucle, laisser la tâche `[~]`, expliquer simplement le blocage et proposer `/pulse:get-help` (en mode autonome : passer d'abord au test groupé des tâches déjà enregistrées).
4. **Le test par la personne** (toujours ; en mode autonome, il est **reporté au test groupé** : noter « ⏳ reporté au test groupé » dans « Test par la personne » du rapport, garder ses étapes dans le rapport, et passer au commit sans s'arrêter). Hors mode autonome : présenter le **rapport de réalisation** (règles communes § 4, construit à partir du tableau du verifier) et les 3 points les plus importants de la relecture **en langage simple**, puis la fiche de test de la tâche, selon « 3 bis. Écrire la fiche de test de la personne » de la référence « Examiner une tâche » (fiche `SMOKE-TEST-…` écrite, application lancée, lien vers la fiche et sa première étape). Demander « Le test est-il concluant ? » → « Oui, tout fonctionne » / « Non, quelque chose ne va pas ». Noter « ✅ concluant » ou « ❌ non concluant : <ce qui ne va pas> » (les choix du modèle) dans « Test par la personne » du rapport ; après un nouveau test (suite à une correction), réécrire cette section avec le dernier résultat. Si non : recueillir ce qui ne va pas, et le traiter comme un constat Critique (étape 3).
5. **💡 La notion du jour** : choisir **une** notion de programmation présente dans le code de la tâche, montrer un extrait de 3 à 8 lignes et l'expliquer simplement. Choisir de préférence une notion absente du lexique, puis l'y ajouter (règle commune § 1, « Le lexique »).

#### [C] Commiter

Appliquer l'étape **commit** chargée au démarrage de la réalisation (contrôles de sécurité, message `<type>(<Tâche>): …`, plan mis à jour en `[x]` avec sa ligne de journal, remarque selon les règles communes § 7). Le § 2 de l'étape commit donne `commit` (tâche relue, vérifiée et testée, ou test reporté en mode autonome) : passer directement à l'enregistrement.

En mode autonome : enregistrer en local, et **attendre la fin du test groupé pour l'envoi** (§ 3 de la référence « Le dépôt distant et l'envoi du travail ») ; la remarque du journal vaut « mode autonome · test reporté ».

#### Mémoire

Repérer ce qui mérite d'être retenu pendant la tâche : un piège rencontré, une convention apparue, un mot du métier précisé, une décision (avec les 3 conditions pour un fichier de décision). S'il y a quelque chose, lancer `pulse-aidd reference memoire.md` (les règles de la mémoire projet, dont les 3 conditions d'un fichier de décision), puis le proposer **en une seule question** (en mode autonome : le garder pour la fin du test groupé) (lignes exactes et destinations) : « Ajouter à la mémoire (Recommandé) » / « Garder la mémoire telle quelle ». Si accepté : écrire, lancer `pulse-aidd memoire`, et inclure ces fichiers au **commit suivant** (ou dans un commit `docs: mémoire …` si c'était la dernière tâche). Réserver la proposition à ce qui est durable.

#### Entre deux tâches

Annoncer l'avancement en une ligne : `T3 ✅ terminée · US-XXX : 3/6`.

✋ **Après chaque tâche** (sauf `-a`) : « Continuer avec T4 – <titre> ? » → « Continuer » / « Faire une pause ».

**Garde-fou anti-secrets déclenché** : expliquer, corriger, puis reprendre l'étape en cours.
**Conversation longue** : après 3 tâches, rappeler qu'on peut faire `/clear` puis relancer `/pulse:spirc <US-XXX>` : la commande reprend automatiquement grâce aux statuts du plan, aux rapports de revue et à la mémoire.

### Test groupé (mode autonome)

Quand toutes les tâches de la portée sont passées (ou que la boucle s'est arrêtée sur un blocage), avant la tâche « Mettre en ligne… » :

1. Présenter, tâche par tâche, le **rapport de réalisation** (règles communes § 4) et, en langage simple, les constats corrigés et ceux écartés.
2. Écrire **une fiche de test complète de l'US**, `aidd_docs/tasks/<epic>/SMOKE-TEST-US-XXX-<nom>.md`, qui enchaîne les étapes de toutes les tâches dans l'ordre du plan (« 3 bis » de la référence « Examiner une tâche »), lancer l'application en arrière-plan, puis donner le lien vers la fiche, sa durée et sa première étape.
3. Demander (AskUserQuestion) : « Les tests sont-ils concluants ? » → « Oui, tout fonctionne » / « Non, sur certaines tâches » (puis lesquelles et ce qui ne va pas).
4. Pour chaque tâche en échec : constat Critique, corrigé comme à l'étape 3 de [R] (implementer, relecture de contrôle), puis commit `fix(<Tâche>): …` ; refaire tester seulement ces tâches. Deux cycles au plus.
5. Mettre à jour « Test par la personne » de chaque rapport et ajouter une ligne au journal du plan (« test groupé concluant » ou « test groupé : <problème> corrigé »), enregistrées avec un commit `docs: résultat du test groupé de US-XXX`.
6. Envoyer le travail selon la ligne « Envoi » du plan (§ 3 de la référence « Le dépôt distant et l'envoi du travail »). Références de la réalisation chargées ; sinon les relancer (voir « Choisir la façon de travailler »).
7. Proposer en **une seule question** les ajouts à la mémoire repérés pendant les tâches (lignes exactes et destinations ; règles : `pulse-aidd reference memoire.md`).

### Fin

Présenter un récapitulatif :

```
| Tâche | Tests auto | Examen | Constats (corrigés / écartés) | Test | Commit |
|---|---|---|---|---|---|
| T1 – … | 6 ✅ (ou —) | ✅ Validé · ✅ Prouvé | 3 / 1 | ✅ | abc1234 |
```

Ajouter, si c'est le cas : les ajouts à la mémoire, les idées notées « En attente » dans le PRD, les tâches restées `[~]` et pourquoi.

**Dans un worktree** : appliquer « 3. Terminer : rassembler le travail » de la référence worktree (fusion, demande de fusion ou worktree gardé), après avoir vérifié que les références de la réalisation sont chargées ; sinon les relancer (voir « Choisir la façon de travailler »).

Puis le bloc de fin de commande. Prochaine étape : `/pulse:deploy` si la première version (toutes les US Indispensables) est terminée et pas encore en ligne (pousser et déployer seulement avec l'accord de la personne), sinon `/pulse:spirc <US-XXX>` pour continuer, ou `/pulse:spirc <US-XXX suivante du parcours>` si ce plan est terminé (elle passera par la spec et le plan), ou `/pulse:security` pour un audit complet.

## Exemples

- `/pulse:spirc US-003` : les tâches du plan sont réalisées une à une par des assistants, puis relues ; pas à pas, vous testez chaque tâche avant qu'elle soit enregistrée.
- `/pulse:spirc -a US-003` : toutes les tâches s'enchaînent sans arrêt, sauf pour vos décisions ; vous testez tout à la fin, en un seul parcours.
- `/pulse:spirc US-003 "le bouton Supprimer ne marche pas"` : la demande devient une nouvelle tâche du plan, montrée pour votre accord avant d'être réalisée.

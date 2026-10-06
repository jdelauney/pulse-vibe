---
description: Orchestrer pour le plan d'une user story Implémenter, Relire et Commiter (et Spécifier, Planifier s'il manque), avec des agents indépendants (explorer, test-writer, implementer, test-runner, reviewer, verifier), des points de validation et la mise à jour de la mémoire
argument-hint: "<US-XXX> [T3 | \"une demande\"] (sans tâche ni demande : tout le plan de l'US)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Edit(docs/lexique.md) Write(docs/lexique.md) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git add *) Bash(git commit *) Bash(git log *) Bash(git rev-parse *) Bash(git worktree list*) Bash(git worktree add *) Bash(git merge --no-ff *) Bash(git merge --abort) Bash(git branch --show-current) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch --merged*) Bash(git branch -f * origin/*) Bash(git switch -c *) Bash(git switch feat/*) Bash(git switch main) Bash(git switch master) Bash(git pull *) Bash(git push) Bash(git push -u origin *) Bash(git remote *) Bash(gh auth status*) Bash(gh pr view*) Bash(gh pr create --draft *) Bash(gh pr ready*) Bash(glab auth status*) Bash(glab mr view*) Bash(glab mr create --draft *) Bash(glab mr update --ready*) EnterWorktree ExitWorktree
---

# /pulse:spirc – Spécifier, Planifier, Implémenter, Relire, Commiter

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte spirc`

Appliquer les « Règles communes Pulse » et les « Règles de la mémoire projet » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte spirc` et lire sa sortie.

Arguments reçus : `$ARGUMENTS`

Identifiant de cette session : `${CLAUDE_SESSION_ID}` (à passer à `pulse-aidd sessions`).

## Lire les arguments

**Raccourcis (facultatifs)**, placés avant l'US, regroupables (`-axw` = `-a -x -w`, dans n'importe quel ordre). Une lettre inconnue : la signaler et demander ce que la personne voulait. **Sans aucune option**, le rythme et l'examen se choisissent par une question avant la réalisation (section « Worktree ») ; **avec au moins une option**, ces deux choix non précisés prennent leur valeur par défaut (avec points de validation, examen standard), sans question. Les **tests** se choisissent par une question dès que `-t` est absent, avec ou sans autre option (comme `/pulse:implement`).
- `-a` **autonome** : enchaîner les tâches sans s'arrêter : points de validation ✋1, ✋2 et « Continuer avec T4 ? » sautés, constats de relecture traités automatiquement (Critique, Haute et Moyenne corrigés, Basse confrontés au code : règles communes § 6). **Le test par la personne et l'accord sur la mémoire sont regroupés à la fin**, en une seule fois (§ « Test groupé »). S'arrêtent toujours en cours de route : les questions de besoin, de priorité ou de périmètre (dont « Bloqué – décision nécessaire » et les écarts de besoin) et les actions manuelles.
- `-t` **tests d'abord** : avant le code de chaque tâche, `pulse:test-writer` écrit ses tests, qu'on voit échouer ; le code doit ensuite les faire passer, contrôlé par `pulse:test-runner` (référence « Tests automatiques : tests d'abord » ci-dessus, § [T]).
- `-x` **examen renforcé** : ajouter un audit de sécurité (`pulse:security-auditor`) à l'examen de chaque tâche.
- `-w` **worktree** : réaliser le plan dans une copie de travail séparée, sur sa propre branche (référence « Travailler dans un worktree » ci-dessus). Sans `-w`, si une autre session semble travailler sur ce dossier, le worktree est proposé (même avec `-a` : c'est une décision de la personne).

**US** (premier argument après les options) : l'US dont on réalise le plan (`aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`), désignée selon les règles « User stories, specs et plans » ci-dessus. Une US qui a une spec sans plan, ou ni spec ni plan : commencer à § S ou § P. Absent ou introuvable : lister les plans (en premier celui qui a une tâche `[~]`) et demander lequel, avec en dernière réponse « Spécifier et planifier une autre US » (§ S).

**Portée** (le reste des arguments) :
- **vide** : toutes les tâches `[~]` et `[ ]` du plan, dans l'ordre ;
- `T3` (ou autre identifiant) : uniquement cette tâche, qui doit appartenir au plan (sinon indiquer le plan qui la contient et demander) ;
- **une demande libre** (« ajouter un filtre par date », « le bouton Supprimer ne marche pas ») : un seul changement, cadré puis ajouté au plan (§ A).

## Principe (à présenter en 3 lignes)

« Je fais travailler des assistants spécialisés, chacun dans son rôle : l'un **explore**, l'un **réalise**, d'autres **relisent** et **vérifient** sans avoir écrit le code. Je m'arrête pour votre accord sur le plan, et c'est **vous** qui testez chaque tâche avant qu'elle soit envoyée (en mode autonome : toutes les tâches ensemble, à la fin). »

```
plan existant ─────────────────────────────┬─ pour chaque tâche : ([T] Tests d'abord) → [I] Implémenter → [R] Relire et vérifier → test par vous* → [C] Commiter → mémoire*
pas de plan ── [S] Spécifier ─ [P] Planifier ┤   (une US = une spec = un plan)
demande libre ─ [A] Analyser (ajout au plan) ┘
* en mode autonome : regroupés à la fin (test groupé, puis envoi et mémoire)
```

## Les rôles (à respecter strictement)

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

- Les sous-agents **travaillent sans les fichiers du plugin** : recopier dans chaque message de délégation les extraits utiles du contexte ci-dessus (sections utiles de `docs/technical.md`, checklist sécurité, conventions de la mémoire).
- Lancer **en parallèle** (plusieurs appels Agent dans le même message) les sous-agents indépendants.
- Si un sous-agent n'est pas disponible : faire son travail soi-même en suivant **strictement** ses consignes (`pulse-aidd agent <nom>`), et le signaler. Pour la relecture, la faire de préférence dans un contexte distinct de celui qui a écrit le code ; sinon, le dire à la personne.
- **Travail en cours** : à chaque arrêt pour la personne (✋ 1, ✋ 2, test manuel, test groupé, choix de correction, « Continuer avec T4 ? »), écrire `aidd_docs/tasks/in-progress.md` (règle commune 16) ; l'effacer (`pulse-aidd travail-fini`) quand la personne a répondu. Le relancement de `/pulse:spirc <US-XXX>` lit ce fichier et reprend à cette étape.

## Prérequis

- `CLAUDE.md` et un dépôt Git sont nécessaires. Sinon, proposer `/pulse:init`.
- `docs/prd.md` est nécessaire (le périmètre MVP en dépend). S'il manque : si `docs/brief.md` existe, proposer `/pulse:prd`, sinon `/pulse:brainstorm`. S'arrêter là.
- `docs/technical.md` est nécessaire : sinon, appliquer d'abord l'étape **tech** (même avec `-a` : le choix de la pile appartient à la personne). Installer et coder une fois la pile choisie.
- Des modifications non enregistrées qui ne concernent pas la tâche à reprendre : proposer d'abord `/pulse:review` puis `/pulse:commit`. Un commit = une seule tâche.

## Comment appliquer une étape de la méthode

Pour les étapes Tech, US, Spec, Plan et Commit, **lancer `pulse-aidd etape <commande>`**, puis appliquer sa section « Déroulé » à l'identique (prérequis, questions, fichiers produits, garde-fous), **hors** son bloc de fin de commande.

## [A] Analyser – seulement pour une demande libre

1. **Explorer** : déléguer à `pulse:explorer` la demande, avec la consigne de rassembler les faits utiles (mémoire, US et critères liés, fichiers concernés, risques). Laisser l'explorateur trouver les faits : réserver à la personne les questions qu'il ne peut pas résoudre.
2. **Situer la demande** :
   - **correction** d'un comportement prévu par une US : garder cette US ; la tâche ira dans le plan de **cette** US (si ce n'est pas l'US désignée, le dire et continuer avec son plan) ;
   - **précision** d'une US déjà planifiée (un critère qui manque) : ajouter le critère dans le fichier de l'US, puis la tâche dans son plan ;
   - **nouveau comportement** prévu au PRD : créer une **nouvelle US** (numéro suivant, modèle d'US) dans l'epic qui convient (la demander : AskUserQuestion, l'epic la plus proche avec « (Recommandé) », « Nouvelle epic »), écrire son fichier dans `aidd_docs/tasks/<epic>/` et l'ajouter au référentiel `docs/user-stories.md`. Elle aura sa propre spec et son propre plan : passer à § S avec cette US ;
   - **nouveau comportement hors PRD** : c'est une décision de périmètre, la poser (AskUserQuestion) : « La noter « En attente » dans le PRD (recommandé) » / « L'ajouter au périmètre maintenant ». Dans le premier cas, l'écrire dans `docs/prd.md` et s'arrêter.
3. **Clarifier ce qui change ce qui sera construit**, et seulement cela : poser les questions de la frontière en une ronde (AskUserQuestion, 4 questions au plus, réponse recommandée en premier, « (Recommandé) »), deux rondes au maximum. Employer et respecter les mots du glossaire ; signaler un mot employé dans un autre sens.
4. **Écrire le contrat** (correction ou précision) comme une nouvelle tâche à la fin de la section `## Tâches` du plan de l'US concernée (avant une éventuelle tâche « Mettre en ligne le MVP »), numérotée après le plus grand `Tn` de tous les plans de `aidd_docs/tasks/`, au format du plan : objectif vu par l'utilisateur, fichiers, critères d'acceptation **vérifiables**, et une ligne « Hors périmètre » si utile. Si elle touche plus de 3 fichiers ou couvre plus de 3 critères, la découper en plusieurs tâches.
5. La portée devient cette (ou ces) tâche(s). Passer à ✋ 2.

## [S] Spécifier – seulement s'il n'y a pas encore de plan

Quand la personne choisit « Spécifier et planifier une autre US », que l'US désignée n'a pas encore de spec, ou qu'une demande a créé une nouvelle US :
- Si `docs/user-stories.md` manque : appliquer l'étape **us**.
- Sans US désignée : la demander (les US sans spec, dans l'ordre du parcours, ou une demande décrite), puis appliquer l'étape **spec** avec cette **seule** US. Si sa spec existe déjà sans plan, passer à § P.

✋ **Point de validation 1** (sauf `-a`) : résumé en 5 lignes (US, écrans, données, points de sécurité). « On passe au plan ? » → « Oui » / « Je veux modifier quelque chose ».

## Worktree

Avant la boucle par tâche (une fois la spec et le plan écrits et validés), poser **une seule ronde** (AskUserQuestion) qui regroupe, selon le cas :
- **Rythme** (seulement si aucune option n'a été passée) : « Avec mes points de validation (Recommandé) » (je m'arrête pour votre accord entre les étapes) / « Autonome » (j'enchaîne et je corrige seul ; vous testez tout à la fin) ;
- **Examen** (seulement si aucune option n'a été passée) : « Standard (Recommandé) » (relecture et vérification) / « Renforcé » (plus un audit de sécurité à chaque tâche) ;
- **Tests** (seulement sans `-t`, même avec d'autres options ou `-a`) : « 2. Choisir au démarrage » de la référence « Tests automatiques » ;
- **Envoi** : « 2. Choisir comment envoyer le travail d'un plan » de la référence « Le dépôt distant et l'envoi du travail » (même en autonome : c'est une décision de la personne) ;
- **Worktree** : « 1. Faut-il un worktree ? » de la référence worktree.

« Autonome » vaut `-a`, « Renforcé » vaut `-x`, « Tests d'abord » vaut `-t`. Les points ✋ 1 et ✋ 2 déjà passés ne se rejouent pas.

Puis, si un worktree est retenu, « 2. Créer le worktree ou y revenir ». La spec et le plan doivent être enregistrés avant (`docs: spec et plan de US-XXX`), pour que le worktree les contienne. Toute la suite (réalisation, relecture, commits) se fait dans le worktree. Sans worktree, en mode PR : préparer la branche de l'US (§ 2 de la référence « Le dépôt distant et l'envoi du travail »). Puis appliquer « 4. Suggérer une US à mener en parallèle » de la référence worktree.

## [P] Planifier

- Plan à créer : appliquer l'étape **plan** avec l'US de § S. Plan existant : montrer son kanban résumé.

✋ **Point de validation 2** (sauf `-a`) : « Le plan vous convient ? On commence la réalisation ? » Pour une demande libre : montrer la tâche ajoutée (objectif, critères, fichiers). Si la personne veut le modifier : appliquer l'étape **refine** (`pulse-aidd etape refine`) avec ses remarques, puis reposer la question. Une fois le plan accepté, ajouter au journal du plan la ligne « plan validé » (règles communes § 7 ; en mode autonome : « plan accepté sans validation, mode autonome »).

## Boucle par tâche

Tâches concernées, dans l'ordre du plan : les tâches `[ ]` ou `[~]` de la portée. Une tâche `[~]` est reprise là où elle en était (un rapport existe déjà dans `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/` : reprendre à l'examen).

**Tâche « Mettre en ligne… »** : attendre l'accord de la personne, même avec `-a` (en mode autonome, elle passe après le test groupé). Demander : « Mettre en ligne maintenant (recommandé) » / « Plus tard ». Si oui, appliquer l'étape **deploy** (`pulse-aidd etape deploy`).

### [T] Tests d'abord (avec `-t`)

Appliquer « Rouge : écrire les tests » (§ 4 de la référence « Tests automatiques ») : `pulse:test-writer`, puis `pulse:test-runner` en phase « rouge attendu », puis tests figés. Une tâche dont la ligne `Tests` vaut « aucun » passe directement à [I].

### [I] Implémenter

1. Marquer la tâche `[~]` dans le plan. Annoncer en 3 lignes : « **T3 – Titre**. Ce qui va être fait : … »
2. Déléguer à **`pulse:implementer`** : la tâche (identifiant, titre, objectif, fichiers), ses critères d'acceptation complets, les sections « Pile retenue », « Organisation des fichiers », « Commandes du projet », « Données et contrôle d'accès » et « Secrets et variables d'environnement » de `docs/technical.md` (recopiées), les règles de sécurité (extraits du contexte), la consigne de charger **les règles de qualité** avec `pulse-aidd qualite`, de consulter la **documentation officielle** de la technologie retenue pour toute API (vérifier plutôt que deviner), de **s'appuyer sur le code réel** (vérifier qu'un fichier ou module existe avant de s'en servir) et de lancer les contrôles automatiques de « Commandes du projet », les conventions et pièges de `aidd_docs/memory/technical.md`, les mots du glossaire utiles. Avec `-t` : en plus, ce que prévoit l'étape 4 de la référence « Tests automatiques » (fichiers de test, interface attendue, tests figés).
3. À son retour :
   - **Bloqué** sur une question de besoin : la poser à la personne, puis relancer l'agent avec la réponse.
   - **Bloqué** sur une action manuelle (appliquer un schéma dans la console du fournisseur, créer un compte, saisir une variable chez l'hébergeur) : guider la personne pas à pas, puis relancer.
   - **Bloqué – décision nécessaire** : présenter le choix à la personne en langage courant, avec ses options et leurs conséquences (AskUserQuestion) ; noter la réponse dans le plan (section « Ajouts proposés par Pulse ») et relancer l'agent avec elle. C'est une décision de la personne : elle interrompt aussi le mode autonome. En mode direct, s'arrêter de la même façon dès qu'un tel choix apparaît.
   - **Terminé** : avec `-t`, appliquer d'abord « Vert : réaliser » (étape 5) et « Trier les échecs » de la référence « Tests automatiques », jusqu'au verdict ✅ Vert ou à l'arrêt après deux cycles ; puis passer à l'examen. Les points « À signaler » sur `docs/` sont traités par vous (une idée hors périmètre va dans `docs/prd.md`, « En attente »).

### [R] Relire et vérifier (eXaminer)

1. Lancer **en parallèle** :
   - **`pulse:reviewer`** : la tâche, les documents à lire (le plan, la spec et l'US du même dossier `aidd_docs/tasks/<epic>/` — `PLAN-SPEC-US-XXX-<nom>.md`, `SPEC-US-XXX-<nom>.md`, `US-XXX-<nom>.md` —, `docs/user-stories.md`, `docs/brief.md`, `aidd_docs/memory/glossary.md`), la **checklist sécurité complète** recopiée, les sections « Pile retenue », « Organisation des fichiers » et « Données et contrôle d'accès » de `docs/technical.md`, la consigne de juger la qualité avec `pulse-aidd qualite` ;
   - **`pulse:reviewer`** reçoit aussi, avec `-t`, les fichiers de test et le dernier rapport du test-runner ;
   - **`pulse:verifier`** : la tâche, la **demande d'origine** (la phrase de la personne ou l'objectif de la tâche), les critères d'acceptation, les fichiers modifiés, la section « Commandes du projet » de `docs/technical.md` (contrôles automatiques, tests, lancer en local) ;
   - avec `-x`, **`pulse:security-auditor`** : la checklist sécurité complète et la consigne de se limiter aux fichiers modifiés par la tâche.
2. **Écrire le rapport** dans `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/<Tâche>-<AAAA-MM-JJ>.md` (modèle de rapport de revue ; suffixe `-2`, `-3` si besoin) : la ligne `Mode`, le rapport du reviewer, puis une section `## Vérification` (verdict et tableau du verifier), avec `-t` la section `## Tests automatiques` (verdicts et tableaux du test-runner, rouge puis vert), puis, avec `-x`, `## Audit de sécurité`.
3. **Trier les constats** :
   - **écart de besoin** (la demande elle-même est à revoir) : le présenter simplement et demander à la personne ; si elle change le contrat, mettre à jour la tâche dans le plan (et le fichier de l'US), puis reprendre à [I] ;
   - **défauts de réalisation** (constats du reviewer, critères ❌ du verifier, constats de l'audit avec `-x`) : appliquer « Les constats de relecture » des règles communes (§ 6). Avec `-a`, sans question : corriger tous les constats Critique, Haute et Moyenne ; pour chaque constat Basse, lire le passage cité dans le code et décider vous-même (corriger ou écarter, avec la raison). Noter chaque décision dans « Suite donnée aux constats ». Relancer `pulse:implementer` **avec la liste des constats à corriger**, puis un examen court (reviewer et verifier, et avec `-t` le test-runner en phase « vert attendu », en parallèle) ajouté au rapport dans `## Relecture de contrôle` ;
   - **Deux cycles de correction au maximum.** Si un constat Critique persiste : arrêter la boucle, laisser la tâche `[~]`, expliquer simplement le blocage et proposer `/pulse:get-help` (en mode autonome : passer d'abord au test groupé des tâches déjà enregistrées).
4. **Le test par la personne** (toujours ; en mode autonome, il est **reporté au test groupé** : noter « ⏳ reporté au test groupé » dans « Test par la personne » du rapport, garder ses étapes, et passer au commit sans s'arrêter). Hors mode autonome : présenter le **rapport de réalisation** (règles communes § 4, construit à partir du tableau du verifier) et les 3 points les plus importants de la relecture **en langage simple**, puis les étapes du test manuel (en commençant par les critères ❓ du verifier) et comment ouvrir l'appli (la commande « lancer en local » de « Commandes du projet » de `docs/technical.md`). Demander « Le test est-il concluant ? » → « Oui, tout fonctionne » / « Non, quelque chose ne va pas ». Noter la réponse dans « Test par la personne » du rapport. Si non : recueillir ce qui ne va pas, et le traiter comme un constat Critique (étape 3).
5. **💡 La notion du jour** : choisir **une** notion de programmation présente dans le code de la tâche, montrer un extrait de 3 à 8 lignes et l'expliquer simplement. Choisir de préférence une notion absente du lexique, puis l'y ajouter (règle commune § 1, « Le lexique »).

### [C] Commiter

Appliquer l'étape **commit** (contrôles de sécurité, message `<type>(<Tâche>): …`, plan mis à jour en `[x]` avec sa ligne de journal, remarque selon les règles communes § 7). Le rapport de revue existe : la relecture est faite, passer directement au commit.

En mode autonome : enregistrer en local, et **attendre la fin du test groupé pour l'envoi** (§ 3 de la référence « Le dépôt distant et l'envoi du travail ») ; la remarque du journal vaut « mode autonome · test reporté ».

### Mémoire

Repérer ce qui mérite d'être retenu pendant la tâche : un piège rencontré, une convention apparue, un mot du métier précisé, une décision (avec les 3 conditions pour un fichier de décision). S'il y a quelque chose, le proposer **en une seule question** (en mode autonome : le garder pour la fin du test groupé) (lignes exactes et destinations) : « Ajouter à la mémoire (recommandé) » / « Garder la mémoire telle quelle ». Si accepté : écrire, lancer `pulse-aidd memoire`, et inclure ces fichiers au **commit suivant** (ou dans un commit `docs: mémoire …` si c'était la dernière tâche). Réserver la proposition à ce qui est durable.

### Entre deux tâches

Annoncer l'avancement en une ligne : `T3 ✅ terminée · US-XXX : 3/6`.

✋ **Après chaque tâche** (sauf `-a`) : « Continuer avec T4 – <titre> ? » → « Continuer » / « Faire une pause ».

**Garde-fou anti-secrets déclenché** : expliquer, corriger, puis reprendre l'étape en cours.
**Conversation longue** : après 3 tâches, rappeler qu'on peut faire `/clear` puis relancer `/pulse:spirc <US-XXX>` : la commande reprend automatiquement grâce aux statuts du plan, aux rapports de revue et à la mémoire.

## Test groupé (mode autonome)

Quand toutes les tâches de la portée sont passées (ou que la boucle s'est arrêtée sur un blocage), avant la tâche « Mettre en ligne… » :

1. Présenter, tâche par tâche, le **rapport de réalisation** (règles communes § 4) et, en langage simple, les constats corrigés et ceux écartés.
2. Donner **un seul parcours de test** qui enchaîne les étapes de test manuel de toutes les tâches, dans l'ordre du plan, en commençant pour chacune par ses critères ❓, avec la commande « lancer en local ».
3. Demander (AskUserQuestion) : « Les tests sont-ils concluants ? » → « Oui, tout fonctionne » / « Non, sur certaines tâches » (puis lesquelles et ce qui ne va pas).
4. Pour chaque tâche en échec : constat Critique, corrigé comme à l'étape 3 de [R] (implementer, examen court), puis commit `fix(<Tâche>): …` ; refaire tester seulement ces tâches. Deux cycles au plus.
5. Mettre à jour « Test par la personne » de chaque rapport et ajouter une ligne au journal du plan (« test groupé concluant » ou « test groupé : <problème> corrigé »), enregistrées avec un commit `docs: résultat du test groupé de US-XXX`.
6. Envoyer le travail selon la ligne « Envoi » du plan (§ 3 de la référence « Le dépôt distant et l'envoi du travail »).
7. Proposer en **une seule question** les ajouts à la mémoire repérés pendant les tâches (lignes exactes et destinations).

## Fin

Présenter un récapitulatif :

```
| Tâche | Tests auto | Examen | Constats (corrigés / écartés) | Test | Commit |
|---|---|---|---|---|---|
| T1 – … | 6 ✅ (ou —) | ✅ Validé · ✅ Prouvé | 3 / 1 | ✅ | abc1234 |
```

Ajouter, si c'est le cas : les ajouts à la mémoire, les idées notées « En attente » dans le PRD, les tâches restées `[~]` et pourquoi.

**Dans un worktree** : appliquer « 3. Terminer : rassembler le travail » de la référence worktree (fusion, demande de fusion ou worktree gardé).

Puis le bloc de fin de commande. Prochaine étape : `/pulse:deploy` si le MVP (toutes les US Indispensables) est terminé et pas encore en ligne (pousser et déployer seulement avec l'accord de la personne), sinon `/pulse:spirc <US-XXX>` pour continuer, ou `/pulse:spirc <US-XXX suivante du parcours>` si ce plan est terminé (elle passera par la spec et le plan), ou `/pulse:security` pour un audit complet.

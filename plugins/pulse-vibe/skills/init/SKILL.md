---
description: Démarrer ou reprendre un projet Pulse - prépare le dossier (CLAUDE.md, mémoire, Git), montre où en est le projet et guide vers la prochaine étape, en boucle
argument-hint: "[nom du projet]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte brainstorm) Bash(pulse-aidd contexte cicd) Bash(pulse-aidd contexte commit) Bash(pulse-aidd contexte deploy) Bash(pulse-aidd contexte express) Bash(pulse-aidd contexte init) Bash(pulse-aidd contexte memory) Bash(pulse-aidd contexte perf) Bash(pulse-aidd contexte tech) Bash(pulse-aidd contexte ui) Bash(pulse-aidd etape *) Bash(pulse-aidd agent designer) Bash(pulse-aidd agent memory-compactor) Bash(pulse-aidd agent ui-critic) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd comparer *) Bash(pulse-aidd guide) Bash(pulse-aidd identite *) Bash(pulse-aidd installer-ci) Bash(pulse-aidd installer-hook) Bash(pulse-aidd memoire) Bash(pulse-aidd nouveau *) Bash(pulse-aidd perf *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd pile squelette *) Bash(pulse-aidd piles) Bash(pulse-aidd secrets inventaire *) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd seo *) Bash(pulse-aidd sessions *) Bash(pulse-aidd sonder *) Bash(pulse-aidd travail-fini) Bash(pulse-aidd verifier) Read Glob Grep Bash(git --version) Bash(node --version) Bash(git config user.name) Bash(git config user.email) Bash(git config --global user.name *) Bash(git config --global user.email *) Bash(git init *) Bash(git status *) Bash(git add *) Bash(git mv *) Bash(git rm docs/*) Bash(git commit -m *) Bash(git rev-parse *) Bash(git log *) Bash(git remote *) Bash(git branch --show-current) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch --merged*) Bash(git branch -M main) Bash(gh auth status*) Bash(glab auth status*)
---

# /pulse:init – Démarrer et se repérer

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte init`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte init` et lire sa sortie.

Argument reçu (nom du projet, facultatif) : `$ARGUMENTS`

## Principe

Cette commande est le **point d'entrée** de la méthode, qu'on la lance dans un dossier vide, dans un projet existant ou au milieu du travail. Elle tourne en boucle :

```
lire l'état → décider la prochaine étape → montrer l'écran → agir sur la réponse → relire l'état …
```

Règles de la boucle :
- **Guider, en restant bref.** Un écran court, une seule action recommandée.
- **Citer uniquement de vraies commandes** `/pulse:*`, celles qui existent.
- **Attendre une réponse explicite** de la personne avant de lancer quoi que ce soit.
- **Travailler sur un état frais** : relire l'état après chaque action.

## 1. Lire l'état (sans rien afficher)

**Environnement** : `git --version`, `node --version`, `git config user.name`, `git config user.email`.

**Fondations** (dans cet ordre) :

| Fondation | Satisfaite quand | À reprendre quand |
|---|---|---|
| Profil | le bloc `<!-- pulse_profil:debut -->` de `CLAUDE.md` indique un niveau | bloc absent, ou niveau « à préciser ». Sans `CLAUDE.md` (projet neuf), les deux questions du profil se posent avec la préparation du projet |
| Dossier du projet | `CLAUDE.md` mentionne la méthode Pulse | `CLAUDE.md` existe sans Pulse (projet existant) |
| Mémoire branchée | `aidd_docs/memory/` contient `project.md`, `technical.md`, `glossary.md`, et `CLAUDE.md` contient `<!-- pulse_memoire:debut -->` | dossier présent mais fichier manquant, ou bloc absent |
| Pile technique | `docs/technical.md` existe **et** le bloc `<!-- pulse_pile:debut -->` de `CLAUDE.md` n'indique plus « Pile non choisie » | marqueurs absents (projet créé avant Pulse 0.3), ou `docs/technical.md` présent alors que le bloc indique encore « Pile non choisie » |
| Historique Git | `git rev-parse --show-toplevel` est le dossier du projet, avec au moins un commit | dossier inclus dans un autre dépôt Git, ou aucun commit |
| Secrets protégés | `.claude/settings.json` contient la règle `permissions.deny` « `Read(./.env)` » | règle absente : la proposer une fois (« Protéger les secrets » ci-dessous), en expliquant qu'elle empêche l'IA de lire vos clés ; la suite continue quelle que soit la réponse |
| Dépôt distant (facultatif) | `git remote -v` n'est pas vide, ou « Adresses » de `CLAUDE.md` indique « Dépôt distant : aucun pour l'instant » | ni l'un ni l'autre : poser la question une fois (« Le dépôt distant et l'envoi du travail », § 1) ; la suite continue quelle que soit la réponse |

**Projet existant** : du code est présent (fichiers source, manifeste de dépendances, configuration d'outils, dans n'importe quel langage) sans `CLAUDE.md` Pulse. La pile s'observe dans le code, avec `/pulse:tech`, plutôt que de la demander.

**Avancement de la méthode** (cumulatif : un document plus avancé implique les précédents) : `docs/brief.md` → `docs/prd.md` → `docs/technical.md` → `docs/user-stories.md` (le référentiel par epic) et les fichiers d'US de `aidd_docs/tasks/<epic>/` → au moins une spec (`SPEC-US-XXX-<nom>.md`) → au moins un plan (`PLAN-SPEC-US-XXX-<nom>.md` ; tâches `[ ]`, `[~]`, `[x]` par plan, et pour l'ensemble des US Indispensables, le MVP ; une spec sans plan compte comme une étape à faire) → rapports de relecture (`aidd_docs/tasks/<epic>/revues/`) → en ligne (section « Adresses » de `CLAUDE.md`, `git remote -v`, `git status` « ahead »).

**Santé** (seulement si le signal existe) : `docs/securite.md` absent alors que le MVP (toutes les US Indispensables) est terminé → `/pulse:security` ; erreurs signalées par les contrôles automatiques de « Commandes du projet » (`docs/technical.md`) lors de la dernière session → `/pulse:auto-fix`.

## 2. Décider (la première règle qui s'applique)

1. **Git absent** → s'arrêter : expliquer que Git enregistre l'historique des versions, donner https://git-scm.com/downloads. **Node.js absent, ou en version inférieure à 22.19** (`node --version`) → s'arrêter de la même façon : expliquer que Node.js fait tourner les garde-fous de Pulse (secrets, commandes risquées) et ses outils (vitesse, référencement), donner https://nodejs.org (version LTS, 22.19 ou plus), puis proposer de relancer `/pulse:init` une fois Node.js installé et le terminal rouvert.
2. **Une fondation manquante ou à reprendre**, dans l'ordre du tableau. Proposer les étapes de la méthode une fois toutes les fondations en place. Exception : dans un **projet neuf**, la pile technique peut attendre ; elle se choisit à son tour dans la méthode (`/pulse:tech`, après le PRD). Dans un **projet existant**, elle se documente juste après la mémoire (`/pulse:memory creer`, puis `/pulse:tech`). Le **dépôt distant** est facultatif : la question se pose une seule fois (à la création du projet, ou à la première séance d'un projet Pulse qui n'en a pas), puis la méthode continue quelle que soit la réponse.
3. **La première étape de la méthode restant à faire** : brief → `/pulse:brainstorm`, avec `/pulse:express` en alternative pour démarrer vite (brief, PRD et US en une conversation) ; PRD → `/pulse:prd` ; choix techniques → `/pulse:tech` ; identité visuelle, **facultative** → si `docs/design.md` et `docs/user-stories.md` n'existent pas encore, proposer `/pulse:ui identite` en précisant qu'elle est facultative (les user stories, specs et plans s'y conformeront), avec « Passer directement aux user stories » en alternative ; user stories → `/pulse:us` ; spec → `/pulse:spec <US-XXX>` (la prochaine US Indispensable du parcours) ; spec sans plan → `/pulse:plan <US-XXX>`.
4. **Le travail en cours** : modifications d'une tâche `[~]` sans revue → `/pulse:review` ; tâche `[~]` relue → `/pulse:commit` ; tâches restantes → `/pulse:spirc <US-XXX>` (ou `/pulse:implement <US-XXX>`), les US Indispensables d'abord ; plan terminé et US Indispensables restantes → `/pulse:spec <US-XXX suivante du parcours>` ; MVP terminé et pas en ligne, ou commits non envoyés → `/pulse:deploy`.
5. **Un signal de santé.**
6. **Tout est à jour** : proposer `/pulse:spec <US-XXX suivante>` (US Essentielles à spécifier), `/pulse:spirc <US-XXX> "une demande"`, `/pulse:cicd` (si un dépôt distant est relié et qu'aucune CI n'existe), `/pulse:security`, `/pulse:memory actualiser`, `/pulse:guide`.

## 3. Montrer l'écran

Afficher la **bannière** (modèle « Bannière ») au premier écran de la session seulement, puis :

```
👋 <« Bienvenue ! » pour un nouveau projet, « Bon retour sur <nom>. » sinon>

Votre projet :
  Dossier      ✅ CLAUDE.md Pulse            (ou ❌ à préparer · ⚠️ CLAUDE.md sans Pulse)
  Mémoire      ✅ branchée · 3 fichiers       (ou ⚠️ <cause> · ❌ pas encore)
  Pile         ✅ choisie · docs/technical.md (ou ⚠️ à choisir avec /pulse:tech · ❌)
  Git          ✅ 12 versions enregistrées    (ou ⚠️ <cause> · ❌)
  En ligne     ✅ dépôt relié · github.com/…   (ou ⬜ aucun pour l'instant · ❓ à décider)

  Méthode : ✅ brief · ✅ PRD · [choix techniques] · ⬜ design (facultatif) · ⬜ US · ⬜ spec · ⬜ plan · ⬜ réalisation · ⬜ en ligne

➡️ Prochaine étape : <action> — <pourquoi, en une phrase>
```

- `✅` fait · `⚠️` présent mais à reprendre (toujours avec sa cause) · `❌` manquant · l'étape en cours entre crochets.
- Lignes courtes. La ligne « Prochaine étape » termine l'écran.

Puis demander (AskUserQuestion) : l'action recommandée en premier avec « (Recommandé) », 1 ou 2 alternatives utiles, et « M'expliquer la méthode ». La personne peut aussi répondre librement.

## 4. Agir sur la réponse

### Préparer un nouveau projet (dossier vide ou presque)

1. **Git sans nom ou email** : les demander (nom affiché dans l'historique, email, qui peut être celui du compte GitHub), puis `git config --global user.name "…"` et `git config --global user.email "…"`. Expliquer : chaque version enregistrée porte le nom de son auteur.
2. **Questions** (une ronde AskUserQuestion) : le **nom** (si l'argument est vide) ; une **description** en une phrase (facultative) ; votre **niveau** en programmation : « Jamais programmé » / « Quelques notions » / « Développeur » ; la **quantité d'explications** voulue : « Normales (Recommandé) » / « L'essentiel » / « Détaillées ». Réserver les questions techniques à plus tard : la pile se choisit avec `/pulse:tech`, une fois le besoin compris.
3. **Créer** : lancer `pulse-aidd nouveau "<nom>" --ici --description "<description>" --oui`. Le script crée **uniquement les fichiers absents** (CLAUDE.md complet, avec un bloc Pile technique qui indique « Pile non choisie », `.gitignore`, `.env.example`, README, dossiers `docs/` et `aidd_docs/`, mémoire branchée) et fait le premier enregistrement Git. Il n'installe aucune technologie. Puis écrire les deux réponses du profil dans le bloc `<!-- pulse_profil:debut -->` de `CLAUDE.md` (lignes « Niveau » et « Explications »).
4. **Lire sa sortie** et la traduire simplement. Si elle indique que le dossier fait partie d'un autre dépôt Git : expliquer le risque (les fichiers du projet finiraient dans ce dépôt) et proposer « Créer un historique propre à ce projet (Recommandé) » → `git init -b main`, puis `git add -A -- .` et `git commit -m "chore: initialisation du projet avec Pulse"`.
   Puis lancer `pulse-aidd installer-hook` : un contrôle des secrets s'exécute avant chaque commit, même fait hors de Claude Code ; le dire en une phrase.
5. **Protéger les secrets** : proposer d'ajouter à `.claude/settings.json` (créé s'il manque) `{ "permissions": { "deny": ["Read(./.env)", "Read(./.env.local)", "Read(./.env.*.local)", "Read(./.env.envoi)"] } }`. Une phrase : « Vos clés seront dans un fichier `.env` ; cette règle empêche l'IA de le lire. » Montrer le bloc, écrire après accord (Claude Code demande l'autorisation : c'est un changement de configuration).
6. **Dépôt distant** : appliquer « 1. Relier le projet à un dépôt distant » de la référence « Le dépôt distant et l'envoi du travail ».
7. Présenter l'arborescence avec une ligne d'explication par élément :

```
CLAUDE.md        → les règles du projet, lues par l'IA à chaque session
docs/            → les documents de la méthode (brief, PRD, choix techniques, référentiel des user stories)
aidd_docs/       → la mémoire du projet (choix, glossaire, décisions), relue par l'IA à chaque session,
                   et tasks/ : un dossier par epic, avec chaque user story, sa spec et son plan
README.md        → la présentation du projet
.gitignore       → la liste de ce que Git doit ignorer (dont vos secrets)
.env.example     → le modèle des clés secrètes (sans les valeurs)
```

Ajouter : « Le code et ses dossiers viendront après le choix de la pile technique (`/pulse:tech`). »

8. **Choisir le parcours** (AskUserQuestion) : « Parcours express (Recommandé pour démarrer vite) » : une seule conversation pour l'idée, les écrans, l'apparence et les contraintes, puis les outils et l'identité visuelle, jusqu'à la première US prête à réaliser ; ou « Parcours complet, étape par étape » : brief, PRD, choix techniques, identité, user stories, chacun avec son entretien approfondi. Express : lancer `pulse-aidd etape express`, puis appliquer à l'identique ses sections « 1. Annoncer le parcours » à « 7. L'identité visuelle », et sa « Fin » hors bloc de fin de commande. Complet : reprendre la boucle (prochaine étape : `/pulse:brainstorm`).

### Reprendre un projet existant (du code sans Pulse)

1. Expliquer : « Votre projet a déjà du code. Je vais lui ajouter les règles et la mémoire de Pulse, en gardant tout ce qui existe. »
2. Si `CLAUDE.md` existe **sans** Pulse : le garder et le compléter. Montrer les sections à ajouter (Le projet, Comportement, Communication, Action, Pile technique avec ses marqueurs, Qualité du code, Sécurité, Mémoire avec ses marqueurs, Adresses, d'après le « Modèle : CLAUDE.md ») et demander l'accord avant de les ajouter. Garder les règles existantes ; signaler une contradiction et laisser la personne trancher.
3. Lancer `pulse-aidd nouveau "<nom>" --ici --oui --sans-git` pour créer les autres éléments manquants (il garde tous les fichiers existants).
4. Pas de dépôt distant : appliquer « 1. Relier le projet à un dépôt distant » de la référence « Le dépôt distant et l'envoi du travail ».
5. Prochaine étape recommandée : `/pulse:memory creer` (remplir la mémoire à partir du code), puis `/pulse:tech` (documenter la pile observée dans le code).

### Mettre à niveau un projet Pulse plus ancien

- Bloc mémoire ou `glossary.md` manquant → appliquer `pulse-aidd etape memory` (action `creer`).
- Bloc `pulse_profil` absent de `CLAUDE.md`, ou « Niveau : à préciser » → poser les deux questions du profil (niveau, quantité d'explications) en une ronde, puis ajouter ou remplir le bloc dans la section « Communication » (modèle `CLAUDE.md`).
- `.gitignore` sans la ligne `aidd_docs/tasks/in-progress.md` → l'ajouter (avec les deux lignes du modèle `.gitignore`), en expliquant en une phrase : ce fichier note une décision en attente, propre à cette machine.
- `scripts/verifier.js` présent sans le contrôle des scénarios (le mot « Scénarios » n'y figure pas) ou sans le contrôle avant commit (`--index` n'y figure pas) → montrer la différence (`pulse-aidd modele verifier.js` comparé à la copie du projet), demander l'accord de la personne, puis le mettre à jour avec `pulse-aidd installer-ci --forcer` (puis supprimer `scripts/ci-verifications.exemple.yml`, inutile), en expliquant en une phrase : le contrôle avant mise en ligne vérifie maintenant que chaque scénario prévu en test automatique a son test.
- Aucun contrôle avant commit (`.git/hooks/pre-commit` absent, ou sans « pulse-aidd: contrôle des secrets ») → `pulse-aidd installer-hook`, en expliquant en une phrase que les commits faits hors de Claude Code sont désormais contrôlés eux aussi.
- Marqueurs `pulse_pile` absents → appliquer `pulse-aidd etape tech` (le point 2 de l'étape « Écrire » suffit si `docs/technical.md` existe déjà et contient « Pile retenue » et « Commandes du projet »).
- **Documents à l'ancien format** (`docs/spec.md`, `docs/plan.md`, `docs/specs/`, `docs/plans/`, `docs/revues/`, ou US détaillées dans `docs/user-stories.md` sans fichiers dans `aidd_docs/tasks/`) → expliquer en deux phrases la nouvelle organisation (une US = une spec = un plan, rangés par epic dans `aidd_docs/tasks/<epic>/`), puis, avec l'accord de la personne, réorganiser **en conservant tout le contenu** :
  1. Proposer les epics (règles de `/pulse:us`, étape 1) et les faire valider.
  2. Garder les identifiants d'US s'ils suivent déjà le format `US-001` ; sinon, proposer une correspondance (ancien → `US-XXX`) et la faire valider. La noter dans le journal de chaque plan concerné.
  3. Écrire un fichier `US-XXX-<nom>.md` par US détaillée (contenu repris tel quel, au format du modèle d'US), puis réécrire `docs/user-stories.md` en référentiel (modèle du référentiel).
  4. Découper chaque spec et chaque plan par US : `SPEC-US-XXX-<nom>.md` reprend les parties de la spec qui concernent l'US (une partie commune à plusieurs US va dans la spec de la première, et les autres y renvoient) ; `PLAN-SPEC-US-XXX-<nom>.md` reprend ses tâches **avec leurs numéros, leurs statuts et leur journal**, sous `## Tâches`, avec la priorité de l'US dans la vue d'ensemble. Une tâche sans US (mise en place, mise en ligne) va dans le plan de la première, ou de la dernière, US Indispensable du parcours.
  5. Supprimer les anciens fichiers (`git rm`, ou `git mv` quand un fichier passe entier), déplacer `docs/design/maquettes/<ancien nom>/` vers `docs/design/maquettes/US-XXX-<nom>/` si la maquette ne concerne qu'une US, déplacer chaque rapport `docs/revues/Tn-*.md` dans le dossier de relecture du plan qui contient la tâche `Tn` (`aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/`) et chaque audit `docs/revues/ui-*.md` dans `docs/design/audits/`, lancer `pulse-aidd guide`, et montrer le résultat. Les numéros de tâche restent valables.
  Faire un commit `docs: réorganisation des user stories, specs et plans par epic` une fois la personne d'accord.

### Lancer une étape de la méthode

Les commandes Pulse ne peuvent pas s'appeler entre elles directement. Pour lancer l'étape choisie **dans la foulée** : lancer `pulse-aidd etape <commande>` (ex. `pulse-aidd etape brainstorm`), puis appliquer sa section « Déroulé » à l'identique, **hors** son bloc de fin de commande. Ensuite, **relire l'état** et montrer l'écran suivant.

Après une étape longue (brainstorm, spirc), proposer plutôt : « Faites `/clear` puis lancez `<commande>` : vous repartirez avec une conversation légère. »

### « M'expliquer la méthode »

En 9 lignes maximum, le chemin complet, l'étape en cours entre crochets :

```
/pulse:init → /pulse:brainstorm → /pulse:prd → /pulse:tech → (/pulse:ui identite) → /pulse:us (epics et US)
   (ou, pour démarrer vite : /pulse:express, qui fait tout cela en une conversation)
   → pour chaque US : /pulse:spec <US-XXX> → (/pulse:ui maquettes <US-XXX>) → /pulse:plan <US-XXX>
   → pour chaque tâche : /pulse:implement <US-XXX> <tâche> → /pulse:review → /pulse:commit   (ou tout d'un coup : /pulse:spirc <US-XXX>)
   → /pulse:deploy   (les étapes entre parenthèses sont facultatives)
À tout moment : /pulse:init (où j'en suis), /pulse:guide (carnet de route), /pulse:fix (une erreur), /pulse:refine (changer le plan),
               /pulse:security, /pulse:memory, /pulse:auto-fix, /pulse:test, /pulse:explain, /pulse:learn, /pulse:pr, /pulse:ui (audit, polish)
```

Puis remontrer l'écran.

## Fin

Quand la personne arrête la boucle (ou après une étape lancée), terminer avec le bloc de fin de commande ; la prochaine étape est celle de l'écran.

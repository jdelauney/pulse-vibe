---
description: Démarrer ou reprendre un projet Pulse - prépare le dossier (CLAUDE.md, mémoire, Git), montre où en est le projet et guide vers la prochaine étape, en boucle
argument-hint: "[nom du projet]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte brainstorm) Bash(pulse-aidd contexte cicd) Bash(pulse-aidd contexte commit) Bash(pulse-aidd contexte deploy) Bash(pulse-aidd contexte express) Bash(pulse-aidd contexte init) Bash(pulse-aidd etat *) Bash(pulse-aidd contexte memory) Bash(pulse-aidd contexte perf) Bash(pulse-aidd contexte tech) Bash(pulse-aidd contexte ui) Bash(pulse-aidd etape *) Bash(pulse-aidd agent designer) Bash(pulse-aidd agent memory-compactor) Bash(pulse-aidd agent ui-critic) Bash(pulse-aidd reference *) Bash(pulse-aidd copies) Bash(pulse-aidd autorisations) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite *) Bash(pulse-aidd tests *) Bash(pulse-aidd scenarios) Bash(pulse-aidd comparer *) Bash(pulse-aidd guide) Bash(pulse-aidd identite *) Bash(pulse-aidd installer-ci) Bash(pulse-aidd installer-hook) Bash(pulse-aidd memoire) Bash(pulse-aidd nouveau *) Bash(pulse-aidd perf *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd pile squelette *) Bash(pulse-aidd piles) Bash(pulse-aidd secrets inventaire *) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd seo *) Bash(pulse-aidd sessions *) Bash(pulse-aidd sonder *) Bash(pulse-aidd travail-fini *) Bash(pulse-aidd verifier) Bash(pulse-aidd pile contexte *) Bash(pulse-aidd maquettes verifier *) Bash(pulse-aidd textes verifier *) Bash(pulse-aidd contraste *) Read Glob Grep Bash(git --version) Bash(node --version) Bash(git config user.name) Bash(git config user.email) Bash(git config --global user.name *) Bash(git config --global user.email *) Bash(git init *) Bash(git status *) Bash(git add *) Bash(git commit -m *) Bash(git rev-parse *) Bash(git log *) Bash(git remote -v) Bash(git remote get-url *) Bash(git branch --show-current) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch --merged*) Bash(gh auth status*) Bash(glab auth status*) Bash(git ls-files *) Bash(git grep -n *) Bash(git grep -l *) Write(docs/brief.md) Edit(docs/brief.md) Write(docs/prd.md) Edit(docs/prd.md) Write(docs/user-stories.md) Edit(docs/user-stories.md) Write(aidd_docs/tasks/**) Edit(aidd_docs/tasks/**) Write(docs/lexique.md) Edit(docs/lexique.md) Bash(git diff *) Bash(git fetch origin) Bash(pulse-aidd revue *) Edit(./CLAUDE.md) Write(docs/technical.md) Edit(docs/technical.md) Write(aidd_docs/memory/**) Edit(aidd_docs/memory/**) Write(docs/design.md) Edit(docs/design.md) Write(docs/design/**) Edit(docs/design/**) Bash(pulse-aidd contexte auto-fix) Bash(pulse-aidd agent fixer) Bash(pulse-aidd contexte fix) Bash(start "" *.html) Bash(open *.html) Bash(xdg-open *.html) Bash(pulse-aidd preuve *)
---

# /pulse:init – Démarrer et se repérer

## Objectif

### Principe

Cette commande est le **point d'entrée** de la méthode, qu'on la lance dans un dossier vide, dans un projet existant ou au milieu du travail. Elle tourne en boucle :

```
lire l'état → décider la prochaine étape → montrer l'écran → agir sur la réponse → relire l'état …
```

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte init` et lire sa sortie en entier) pendant toute la commande.

Règles de la boucle :
- **Guider, en restant bref.** Un écran court, une seule action recommandée.
- **Citer uniquement de vraies commandes** `/pulse:*`, celles qui existent.
- **Attendre une réponse explicite** de la personne avant de lancer quoi que ce soit.
- **Travailler sur un état frais** : relire l'état après chaque action.

## Contexte

Argument reçu (nom du projet, facultatif) : `$ARGUMENTS`

Fichiers de cette commande : [assets/banniere.txt](assets/banniere.txt), [scripts/nouveau-projet.js](scripts/nouveau-projet.js).

## Processus

### 1. Lire l'état (sans rien afficher)

**Environnement** : `git --version`, `node --version`, `git config user.name`, `git config user.email`.

**État du projet** : lancer `pulse-aidd etat`. Il lit les fichiers du projet et Git, et répond en lignes « clé: valeur » : `prochaine` (la commande conseillée), `raison`, `regle`, au besoin `fondation` (ce qui reste à préparer), `attente`, `ancien` et `dossier` (une décision en attente), `aussi` (les alternatives utiles), `etapes` (l'avancement de la méthode) et `mvp` (tâches terminées des US Indispensables). `/pulse:status` affiche la même décision.

**Projet existant** : du code est présent (fichiers source, manifeste de dépendances, configuration d'outils, dans n'importe quel langage) sans `CLAUDE.md` Pulse : appliquer § 4 « Reprendre un projet existant », puis suivre le verdict de `pulse-aidd etat` (`/pulse:tech`, puis `/pulse:memory creer`). La pile s'observe dans le code plutôt que de la demander.

### 2. Décider (la première règle qui s'applique)

1. **Git absent** → s'arrêter : expliquer que Git enregistre l'historique des versions, donner https://git-scm.com/downloads. **Node.js absent, ou en version inférieure à 22.19** (`node --version`) → s'arrêter de la même façon : expliquer que Node.js fait tourner les garde-fous de Pulse (secrets, commandes risquées) et ses outils (vitesse, référencement), donner https://nodejs.org (version LTS, 22.19 ou plus), puis proposer de relancer `/pulse:init` une fois Node.js installé, après avoir **fermé puis relancé Claude Code** (pas seulement le terminal : Claude Code lit la liste des programmes installés à son démarrage).
2. **Sinon, appliquer le verdict de `pulse-aidd etat`** : la ligne `prochaine` est l'action recommandée, avec sa `raison` ; les lignes `aussi` donnent 1 ou 2 alternatives. Avec `ancien: oui`, demander d'abord si la décision en attente est toujours d'actualité ; sinon, l'effacer (`pulse-aidd travail-fini <dossier>`, avec la valeur de la ligne `dossier` ; sans cette ligne, `pulse-aidd travail-fini`). Quand une ligne `fondation` est présente, l'action se fait ici même (§ 4) :

   | `fondation` | Action dans cette commande |
   |---|---|
   | `dossier` | « Préparer un nouveau projet » (dossier vide ou presque) ou « Reprendre un projet existant » (du code est présent) |
   | `profil` | les deux questions du profil (« Préparer un nouveau projet », point 2 : niveau, quantité d'explications) en une ronde, puis remplir le bloc `pulse_profil` de `CLAUDE.md` ; s'il manque, l'ajouter dans « Communication » de « Contraintes », seulement à ce moment d'après le modèle (`pulse-aidd modele CLAUDE.md`) |
   | `memoire` | `pulse-aidd etape memory --sans-communes` (action `creer`) |
   | `git` | « Préparer un nouveau projet », point 4 (un historique propre au projet) ; si le dépôt existe sans aucune version, faire le premier enregistrement : ajouter les fichiers par leur nom, en montrer la liste, puis `git commit -m "chore: initialisation du projet avec Pulse"` |
   | `pile` | `pulse-aidd etape tech --sans-communes` ; si `docs/technical.md` contient déjà « Pile retenue » et « Commandes du projet », son étape « Écrire », point 2, suffit |

   Une ligne `aussi` qui commence par `/pulse:init` se traite ici, une seule fois par séance : « Régler les autorisations » (§ 4, point 5), « 1. Relier le projet à un dépôt distant » (§ 4, « Préparer un nouveau projet », point 6), ou « Remettre les contrôles du projet à jour » (§ 4). La personne peut refuser un point : la suite continue quelle que soit la réponse.
3. **Après la mise en ligne** (`regle` R21, R22 ou R23) : proposer aussi `/pulse:status`, qui regarde la CI, le référencement et la Search Console.

### 3. Montrer l'écran

Afficher la **bannière** (modèle « Bannière ») au premier écran de la session seulement, puis :

```
👋 <« Bienvenue ! » pour un nouveau projet, « Bon retour sur <nom>. » sinon>

Votre projet :
  Dossier      ✅ CLAUDE.md Pulse            (ou ❌ à préparer · ⚠️ CLAUDE.md sans Pulse)
  Mémoire      ✅ branchée · 3 fichiers       (ou ⚠️ <cause> · ❌ pas encore)
  Pile         ✅ choisie · docs/technical.md (ou ⚠️ à choisir avec /pulse:tech · ❌)
  Git          ✅ 12 versions enregistrées    (ou ⚠️ <cause> · ❌)
  En ligne     ✅ dépôt relié · github.com/…   (ou ⬜ aucun pour l'instant · ❓ à décider)

  Méthode : ✅ brief · ✅ PRD · [choix techniques] · ⬜ design (facultatif) · ⬜ US · ⬜ spec · ⬜ plan · ⬜ réalisation · ⬜ en ligne   (d'après la ligne etapes)

➡️ Prochaine étape : <action> — <pourquoi, en une phrase>
```

- `✅` fait · `⚠️` présent mais à reprendre (toujours avec sa cause) · `❌` manquant · l'étape en cours entre crochets.
- Lignes courtes. La ligne « Prochaine étape » termine l'écran.

Puis demander (AskUserQuestion) : l'action recommandée (`prochaine`) en premier avec « (Recommandé) », 1 ou 2 alternatives tirées des lignes `aussi`, et « M'expliquer la méthode ». La personne peut aussi répondre librement.

### 4. Agir sur la réponse

#### Préparer un nouveau projet (dossier vide ou presque)

1. **Git sans nom ou email** : les demander (nom affiché dans l'historique, email, qui peut être celui du compte GitHub), puis `git config --global user.name "…"` et `git config --global user.email "…"`. Expliquer : chaque version enregistrée porte le nom de son auteur.
2. **Questions** : d'abord le **nom** (si l'argument est vide) et une **description** en une phrase (facultative), demandés en texte dans la conversation (réponse libre) ; puis, en une ronde AskUserQuestion, votre **niveau** en programmation : « Jamais programmé » / « Quelques notions » / « Développeur », et la **quantité d'explications** voulue : « Normales (Recommandé) » / « L'essentiel » / « Détaillées ». Réserver les questions techniques à plus tard : la pile se choisit avec `/pulse:tech`, une fois le besoin compris.
3. **Créer** : lancer `pulse-aidd nouveau "<nom>" --ici --description "<description>" --oui`. Le script crée **uniquement les fichiers absents** (CLAUDE.md complet, avec une section « Stack technique » qui indique « Pile non choisie », `.gitignore`, `.env.example`, README, dossiers `docs/` et `aidd_docs/`, mémoire branchée) et fait le premier enregistrement Git. Il n'installe aucune technologie. Puis écrire les deux réponses du profil dans le bloc `<!-- pulse_profil:debut -->` de `CLAUDE.md` (lignes « Niveau » et « Explications »).
4. **Lire sa sortie** et la traduire simplement. Si elle indique que le dossier fait partie d'un autre dépôt Git : expliquer le risque (les fichiers du projet finiraient dans ce dépôt) et proposer « Créer un historique propre à ce projet (Recommandé) » → `git init -b main`, puis `git add -A -- .` et `git commit -m "chore: initialisation du projet avec Pulse"`.
   Puis lancer `pulse-aidd installer-hook` : un contrôle des secrets s'exécute avant chaque commit, même fait hors de Claude Code ; le dire en une phrase.
5. **Régler les autorisations** : lancer `pulse-aidd reference autorisations.md` et l'appliquer (fichier [.claude/settings.json](.claude/settings.json), créé s'il manque ; règles existantes gardées, seules les absentes s'ajoutent).
6. **Dépôt distant** : au moment de relier le projet, lancer `pulse-aidd reference depot-distant.md` et suivre sa section « 1. Relier le projet à un dépôt distant ».
7. Présenter l'arborescence avec une ligne d'explication par élément :

```
CLAUDE.md        → les règles du projet, lues par l'IA à chaque session
docs/            → les documents de la méthode (brief, PRD, choix techniques, référentiel des user stories)
aidd_docs/       → la mémoire du projet (choix, glossaire, décisions), relue par l'IA à chaque session,
                   et tasks/ : un dossier par groupe de user stories, avec chaque user story, sa spec et son plan
README.md        → la présentation du projet
.gitignore       → la liste de ce que Git doit ignorer (dont vos secrets)
.env.example     → le modèle des clés secrètes (sans les valeurs)
```

Ajouter : « Le code et ses dossiers viendront après le choix de la pile technique (`/pulse:tech`). »

8. **Choisir le parcours** (AskUserQuestion) : « Parcours express (Recommandé pour démarrer vite) » : une seule conversation pour l'idée, les écrans, l'apparence et les contraintes, puis les outils et l'identité visuelle, jusqu'à la première US prête à réaliser ; ou « Parcours complet, étape par étape » : brief, PRD, choix techniques, identité, user stories, chacun avec son entretien approfondi. Express : lancer `pulse-aidd etape express --sans-communes`, puis appliquer à l'identique ses sections « 1. Annoncer le parcours » à « 7. L'identité visuelle », et sa « Fin » hors bloc de fin de commande. Complet : reprendre la boucle (prochaine étape : `/pulse:brainstorm`).

#### Reprendre un projet existant (du code sans Pulse)

1. Expliquer : « Votre projet a déjà du code. Je vais lui ajouter les règles et la mémoire de Pulse, en gardant tout ce qui existe. »
2. Si `CLAUDE.md` existe **sans** Pulse : le garder et le compléter. Montrer les sections à ajouter, d'après le modèle lu seulement dans ce cas (`pulse-aidd modele CLAUDE.md` : Résumé du projet avec ses adresses, Stack technique avec ses marqueurs, Architecture avec la mémoire et ses marqueurs, Commandes, Contraintes) et demander l'accord avant de les ajouter. Garder les règles existantes ; signaler une contradiction et laisser la personne trancher.
3. Lancer `pulse-aidd nouveau "<nom>" --ici --oui --sans-git` pour créer les autres éléments manquants (il garde tous les fichiers existants).
4. Pas de dépôt distant : seulement dans ce cas, lancer `pulse-aidd reference depot-distant.md` et suivre sa section « 1. Relier le projet à un dépôt distant ».
5. Prochaine étape recommandée : `/pulse:tech` (documenter les outils observés dans le code), puis `/pulse:memory creer` (les conventions et les pièges propres au code).

#### Remettre les contrôles du projet à jour

Quand une ligne `aussi` propose de remettre les contrôles du projet à jour : lancer `pulse-aidd reference init/controles.md` et appliquer chacun de ses points dont le signe se voit dans le projet.

#### Lancer une étape de la méthode

Les commandes Pulse ne peuvent pas s'appeler entre elles directement. Pour lancer l'étape choisie **dans la foulée** : lancer `pulse-aidd etape <commande> --sans-communes` (ex. `pulse-aidd etape brainstorm --sans-communes`), puis appliquer sa section « Processus » à l'identique, **hors** son bloc de fin de commande. Ensuite, **relire l'état** et montrer l'écran suivant.

Après une étape longue (brainstorm, spirc), proposer plutôt : « Faites `/clear` puis lancez `<commande>` : vous repartirez avec une conversation légère. »

#### « M'expliquer la méthode »

Au moment de répondre, lancer `pulse-aidd reference cycle.md`, puis montrer son chemin (son bloc, puis ses deux dernières lignes : `/pulse:spirc` et les commandes à tout moment), en 9 lignes au plus, l'étape en cours entre crochets. Puis remontrer l'écran.

### Fin

Quand la personne arrête la boucle (ou après une étape lancée), terminer avec le bloc de fin de commande ; la prochaine étape est celle de l'écran.

## Exemples

- `/pulse:init` dans un dossier vide : l'écran propose de préparer le projet ; après votre accord, quelques questions (nom, niveau, explications), puis les dossiers et la mémoire sont créés.
- `/pulse:init` au milieu du travail : l'écran « Votre projet » montre où vous en êtes et propose la prochaine étape ; rien ne se lance sans votre réponse.
- `/pulse:init` dans un projet qui a déjà du code : les règles et la mémoire de Pulse s'ajoutent, et tout ce qui existe est gardé.

## Références de la commande

!`pulse-aidd contexte init`

La bannière figure dans ce contexte ; chaque référence ou modèle se charge à l'action qui le cite. Si ce contexte est absent, lancer `pulse-aidd contexte init` et lire sa sortie.

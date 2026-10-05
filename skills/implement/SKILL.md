---
description: Réaliser une tâche d'un plan et l'expliquer ; sans tâche, boucler sur tout le plan (réaliser, relire, corriger, commiter, tâche suivante)
argument-hint: "<plan> [T3] (sans tâche : tout le plan, une tâche après l'autre)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git add *) Bash(git commit *) Bash(git log *) Bash(git rev-parse *)
---

# /pulse:implement – Réaliser une tâche

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte implement`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte implement` et lire sa sortie.

Arguments reçus : `$ARGUMENTS` (le plan, puis la tâche, facultative)

## Objectif

- **Avec une tâche** : réaliser **cette tâche** d'un plan de `docs/plans/`, expliquer ce qui a été fait et comment le tester. La relecture et le commit se font ensuite avec `/pulse:review` et `/pulse:commit`.
- **Sans tâche** : réaliser **tout le plan**, en bouclant sur chaque tâche restante, dans l'ordre : réaliser → relire → corriger → commiter → tâche suivante (§ 6). Chaque tâche a son propre commit.

## Prérequis

- **Le plan** : celui désigné en premier argument, dans `docs/plans/` (règles « Specs et plans » ci-dessus). Argument vide ou introuvable : lister les plans (en premier celui qui a une tâche `[~]`) et demander lequel. Aucun plan : proposer `/pulse:plan`.
- La spec du même nom (`docs/specs/<nom>.md`), `docs/user-stories.md` et `docs/technical.md` sont nécessaires. Sinon, proposer la commande manquante. Sans `docs/technical.md` (pile non choisie) : ne rien installer ni coder, proposer `/pulse:tech`.
- Si des modifications non enregistrées concernent **une autre tâche** (`git status`), proposer d'abord `/pulse:review` puis `/pulse:commit` pour celle-ci. Ne pas mélanger deux tâches dans un même commit.
- Mode « tout le plan » : le dossier doit être un dépôt Git (`git rev-parse --is-inside-work-tree`). Sinon, proposer `/pulse:init`.

## Déroulé

### 1. Choisir la ou les tâches

- **Tâche donnée** (`T3`) : celle-ci ; elle doit appartenir au plan, sinon indiquer le plan qui la contient et demander.
- **Sans tâche** : toutes les tâches `[~]` puis `[ ]` du plan, dans l'ordre du plan. Annoncer la liste en une ligne (« Je vais réaliser T3, T4 et T5, l'une après l'autre : chacune sera relue, corrigée et enregistrée avant de passer à la suivante. »), puis appliquer la boucle du § 6.

Si toutes les tâches du plan sont `[x]` : féliciter la personne et proposer `/pulse:deploy`.
Une tâche « Mettre en ligne… » ne se réalise pas ici : s'arrêter avant elle et indiquer qu'elle se fait avec `/pulse:deploy`.
Si une tâche bloque (question de besoin, action manuelle non faite, contrôle automatique qui reste en échec) : s'arrêter là, sans passer à la suivante, et l'expliquer.

### 2. Annoncer

Marquer la tâche `[~]` dans le plan. Puis annoncer en 4 lignes maximum :
« **T3 – Titre**. Je vais : … (2 à 4 puces). Fichiers concernés : … »

### 3. Réaliser

- Relire la tâche, les user stories et critères qu'elle couvre, et les parties utiles de la spec du plan.
- **Ne rien supposer du code** : créer ou modifier les fichiers listés par la tâche, à l'emplacement prévu par l'organisation de `docs/technical.md` ; avant d'importer un module, vérifier qu'il existe (Glob/Grep) ; s'il manque, le créer dans cette tâche et le signaler. Dans un projet existant, réutiliser ce qui existe au lieu de le dupliquer.
- Si `docs/design.md` existe, l'appliquer (couleurs, typographie, composants et leurs états). Si la tâche ou la spec cite une maquette, l'ouvrir et la **traduire** dans la pile retenue : ne pas copier son HTML tel quel.
- Coder **uniquement** ce que demande la tâche. Une idée en plus se note dans `docs/prd.md` (« En attente »), elle ne se code pas.
- Respecter « Pile retenue » de `docs/technical.md` (résumée dans le bloc « Pile technique » de `CLAUDE.md`) et **les références de qualité** (`pulse-aidd qualite` : clean code, composants, sécurité du code, concepts) : fonctions courtes, noms explicites, mots du glossaire, commentaires en français qui expliquent le *pourquoi*.
- **Documentation officielle** : pour toute API, forme du code ou configuration de la technologie retenue, consulter sa documentation officielle, à la version indiquée dans « Pile retenue » (outil de documentation comme context7 s'il est disponible, sinon WebFetch). Ne jamais deviner une API.
- Sécurité, toujours : les données saisies sont affichées comme du texte, jamais interprétées comme du code ; aucun secret dans le code ; validation des champs côté serveur quand il y en a un ; messages d'erreur compréhensibles.
- Données et contrôle d'accès, selon « Données et contrôle d'accès » de `docs/technical.md` :
  - le schéma et les règles d'accès vont à l'emplacement prévu par « Organisation des fichiers » ; si leur application demande une action dans la console du fournisseur, guider la personne pas à pas ;
  - le contrôle d'accès est vérifié là où le prévoit cette section (côté serveur ou dans la base), jamais seulement dans l'interface ;
  - une valeur publique par conception peut être donnée par la personne ; une **clé secrète** ne doit jamais être transmise : la personne l'écrit elle-même dans le fichier local prévu par « Secrets et variables d'environnement », puis ajouter seulement le **nom** de la variable dans `.env.example`.
- Ajouter une bibliothèque uniquement après accord, avec une version fixée.

### 4. Vérifier vous-même

Relire chaque critère d'acceptation de la tâche et vérifier que le code le réalise. Lancer les contrôles automatiques de « Commandes du projet » (`docs/technical.md`) : lint, format, types, tests, selon ce qui existe (« aucune » : le signaler, sans en inventer). Corriger avant de rendre la main (s'il reste beaucoup d'erreurs : `/pulse:auto-fix`). Si un critère ne peut être vérifié qu'en cliquant, l'inclure dans le test manuel.

### 5. Expliquer

Présenter, sans jargon inexpliqué :

1. **Ce qui a changé** : un fichier par ligne, avec son rôle.
2. **💡 La notion du jour** : choisir **une** notion de programmation présente dans le code écrit (variable, constante, condition, boucle, fonction, événement, tableau, objet, stockage, requête, attente d'une réponse…). Montrer un extrait de 3 à 8 lignes et l'expliquer simplement, ligne par ligne si besoin.
3. **🧪 À vous de tester** : les étapes du test manuel, issues des critères d'acceptation, avec des données réalistes. Indiquer comment ouvrir l'appli : la commande « lancer en local » de « Commandes du projet » (`docs/technical.md`), et l'adresse ou l'écran qu'elle affiche.

La tâche **reste `[~]`** : elle ne sera terminée qu'après relecture et commit.

Avec une tâche : terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:review` pour une relecture indépendante, puis `/pulse:commit`.

### 6. Boucle sur tout le plan (sans tâche)

Pour chaque tâche, dans l'ordre du plan :

1. **Réaliser** : étapes 2 à 5 ci-dessus (l'explication reste courte : ce qui a changé et la notion du jour ; le test manuel est donné à l'étape suivante).
2. **Relire** : lancer `pulse-aidd etape review` et appliquer sa section « Déroulé » à l'identique pour cette tâche, **sans** son bloc de fin de commande : relecture indépendante par le sous-agent `pulse:reviewer`, rapport `docs/revues/<Tâche>-<AAAA-MM-JJ>.md`, présentation du verdict, **test manuel par la personne**.
3. **Corriger** : appliquer l'étape « Corriger » de la relecture (⛔, ⚠️, test non concluant), avec la relecture de contrôle. **Deux cycles au maximum** : si un point bloquant persiste, arrêter la boucle, laisser la tâche `[~]`, expliquer simplement le blocage et conseiller de demander de l'aide à une personne qui sait programmer.
4. **Commiter** : lancer `pulse-aidd etape commit` et appliquer sa section « Déroulé » à l'identique, **sans** son bloc de fin de commande : contrôles de sécurité, message `<type>(<Tâche>): …`, tâche passée à `[x]` avec sa ligne de journal. Le rapport de revue existe : ne pas redemander de relecture.
5. **Passer à la suivante** : annoncer l'avancement en une ligne (`T3 ✅ enregistrée · plan <nom> : 3/6 · suite : T4 – <titre>`), puis enchaîner directement. Si la personne demande une pause, s'arrêter : relancer `/pulse:implement <plan>` reprendra à la tâche suivante.

S'arrêter aussi avant une tâche « Mettre en ligne… » (elle se fait avec `/pulse:deploy`) et à tout blocage (§ 1). Après 3 tâches, rappeler qu'on peut faire `/clear` puis relancer `/pulse:implement <plan>` : la boucle reprend grâce aux statuts du plan et aux rapports de revue (une tâche `[~]` qui a déjà un rapport reprend à la correction ou au commit).

À la fin, présenter un récapitulatif :

```
| Tâche | Relecture | Test | Commit |
|---|---|---|---|
| T3 – … | ✅ Validé | ✅ | abc1234 |
```

Puis le bloc de fin de commande. Prochaine étape : `/pulse:deploy` si le plan est terminé et que la nouvelle version n'est pas en ligne, sinon `/pulse:implement <plan>` pour reprendre.

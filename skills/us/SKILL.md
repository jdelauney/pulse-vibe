---
description: Écrire les user stories, découpées par epic (un fichier par US dans aidd_docs/tasks/<epic>/, référentiel dans docs/user-stories.md), avec règles métier, exemples et critères d'acceptation (Étant donné / Lorsque / Alors)
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *)
---

# /pulse:us – Les user stories

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte us`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte us` et lire sa sortie.

## Objectif

Produire le **référentiel** `docs/user-stories.md` (les epics, la vue d'ensemble, le parcours utilisateur) et **un fichier par user story** dans le dossier de son epic : `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` (règles « User stories, specs et plans » ci-dessus). Expliquer en deux phrases :
« Une user story décrit un besoin du point de vue de l'utilisateur. Ses critères d'acceptation, écrits sous la forme Étant donné… Lorsque… Alors…, sont ce qui permettra de vérifier que l'IA a codé exactement ce que vous vouliez. »

## Prérequis

- `docs/prd.md` est nécessaire (à défaut `docs/brief.md`, en le signalant). Sinon, proposer `/pulse:prd`.
- Si `docs/user-stories.md` existe : demander s'il faut le compléter ou le refaire. Le compléter garde les numéros des US existantes. Le refaire conserve les fichiers de `aidd_docs/tasks/` qui ont déjà une spec ou un plan : le signaler et demander.
- Si `docs/user-stories.md` contient encore le détail des US (ancien format, sans fichiers dans `aidd_docs/tasks/`) : proposer `/pulse:init`, qui réorganise les documents.

## Déroulé

### 1. Découper en epics

Regrouper les fonctionnalités **Indispensables**, **Essentielles** et **Optionnelles** du PRD en **epics** : une epic = un grand besoin de l'utilisateur (« Gérer les demandes », « Suivre les paiements »), qui contient plusieurs US. Viser 2 à 6 epics pour un MVP ; une epic d'une seule US est possible. Les **En attente** restent hors des epics.

Pour chaque epic : un titre, un objectif en une phrase et un nom de dossier `<epic>` (règles ci-dessus). Montrer la liste des epics avec leurs dossiers et la faire valider (« Valider » / « Modifier les epics ») avant d'écrire les US.

### 2. Écrire les user stories

Pour chaque fonctionnalité **Indispensable** et **Essentielle** du PRD, écrire une ou plusieurs US détaillées, chacune dans **son fichier**. Les **Optionnelles** apparaissent seulement dans le tableau de leur epic, sans fichier (colonne « Fichier » : « — (détaillée lors de sa spec) ») ; leur fichier sera écrit par `/pulse:spec` quand elles seront traitées.

Chaque US suit le modèle de fichier d'US :

- **Identifiant** : `US-001`, `US-002`… dans l'ordre du parcours puis des epics. En complément d'un référentiel existant, reprendre après le plus grand numéro existant.
- **Fichier** : `aidd_docs/tasks/<epic>/US-XXX-<nom>.md`, `<nom>` tiré du titre court.
- **Phrase** : « En tant que {{acteur}}, je souhaite {{action + objet}} afin de {{objectif}} ».
- **Taille** (S, M ; une US de taille L se découpe) et **Dépend de** (l'US qui doit exister avant, ou « — »).
- **Règle(s) métier** : la règle que l'exemple illustre.
- **Exemple concret** avec des données **réalistes et fictives** (noms et situations plausibles du métier de la personne), plutôt que « élément A ».
- **Critères d'acceptation** : 2 à 4, chacun nommé (cas nominal, cas d'erreur ou limite, cas alternatif, accès), au format « **Étant donné** contexte, **lorsque** action, **alors** résultat attendu ». **Au moins un** couvre un cas d'erreur ou un cas limite (champ vide, texte trop long, élément introuvable, accès non autorisé).
- **Hors périmètre de cette US** : ce qu'elle laisse volontairement de côté, pour que l'IA s'en tienne à son périmètre.

### 3. Vérifier la qualité de chaque US

- **Un seul acteur, une seule action.** Si la phrase contient « et » ou « ou », découper en deux US.
- **Petite** : si une US a plus de 4 critères ou plusieurs règles métier, la découper.
- **Testable** : chaque critère décrit un résultat **visible** par l'utilisateur.
- **En langage courant** : les mots de l'utilisateur, à la place de « base de données », « API », « composant ».
- **Bien rangée** : l'US sert l'objectif de son epic ; sinon, la déplacer ou proposer une autre epic.
- Si des données sont partagées entre plusieurs personnes, intégrer des US d'accès : qui voit quoi (ex. « En tant que <acteur>, je vois seulement mes propres <éléments> »). Ce sont elles qui porteront la sécurité.

### 4. Trancher les questions ouvertes

Si un critère dépend de questions encore ouvertes, poser à la personne les plus importantes (3 au maximum), une par une. Les autres restent notées dans l'US.

### 5. Écrire et valider

1. Remplir le référentiel `docs/user-stories.md` (modèle du référentiel) : le tableau des epics, le **parcours utilisateur** (les US Indispensables dans l'ordre où l'utilisateur les vit ; la dernière clôt le MVP), puis, pour chaque epic, son tableau d'US avec le lien vers chaque fichier. Vérifier que les dépendances s'enchaînent dans un seul sens, sans boucle.
2. Écrire les fichiers `aidd_docs/tasks/<epic>/US-XXX-<nom>.md`.
3. Montrer le tableau des epics, le parcours et **une** US complète en exemple, puis demander validation (« Valider » / « Modifier une US »).

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:spec <US-XXX>` (la première US du parcours).

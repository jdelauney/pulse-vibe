---
description: Écrire les user stories, découpées par epic (un fichier par US dans aidd_docs/tasks/<epic>/, référentiel dans docs/user-stories.md), avec règles métier, exemples et critères d'acceptation (Étant donné / Lorsque / Alors), chacune vérifiée avant d'être déclarée prête, triées par ordre de réalisation, sauvegardées après validation
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte us) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd travail-fini)
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

Appliquer « Penser avant d'écrire » ci-dessus. Les règles déjà tranchées (brief, glossaire, PRD) se reprennent sans les redemander. La rédaction (format, découpage, contrôle qualité) reste à Pulse.

**Clarifier le périmètre par rondes** : **3 questions au plus par ronde** (un seul appel AskUserQuestion), chacune sur un besoin de l'utilisateur : ce qu'il fait, ce qu'il voit, ce qui se passe dans un cas limite. Les choix techniques se tranchent plus tard, avec `/pulse:tech` et le plan. Les **cas limites importants** sont les questions clés de cette commande.

### 1. Découper en epics

Regrouper les fonctionnalités **Indispensables**, **Essentielles** et **Optionnelles** du PRD en **epics** : une epic = un grand besoin de l'utilisateur (« Gérer les demandes », « Suivre les paiements »), qui contient plusieurs US. Viser 2 à 6 epics pour un MVP ; une epic d'une seule US est possible. Les **En attente** restent hors des epics.

Pour chaque epic : un titre, un objectif en une phrase et un nom de dossier `<epic>` (règles ci-dessus). Montrer la liste des epics avec leurs dossiers et la faire valider (« Valider » / « Modifier les epics ») avant d'écrire les US.

### 2. Écrire les user stories

Pour chaque fonctionnalité **Indispensable** et **Essentielle** du PRD, écrire une ou plusieurs US détaillées, chacune dans **son fichier**. Les **Optionnelles** apparaissent seulement dans le tableau de leur epic, sans fichier (colonne « Fichier » : « — (détaillée lors de sa spec) ») ; leur fichier sera écrit par `/pulse:spec` quand elles seront traitées.

Chaque US suit le modèle de fichier d'US :

- **Identifiant** : `US-001`, `US-002`… dans l'ordre de réalisation (étape 4). En complément d'un référentiel existant, reprendre après le plus grand numéro existant.
- **Fichier** : `aidd_docs/tasks/<epic>/US-XXX-<nom>.md`, `<nom>` tiré du titre court.
- **Phrase** : « En tant que {{acteur}}, je souhaite {{action + objet}} afin de {{objectif}} ».
- **Taille** (S, M ; une US de taille L se découpe) et **Dépend de** (l'US qui doit exister avant, ou « — »).
- **Règle(s) métier** : la règle que l'exemple illustre.
- **Exemple concret** avec des données **réalistes et fictives** (noms et situations plausibles du métier de la personne), plutôt que « élément A ».
- **Critères d'acceptation** : 2 à 4, chacun nommé (cas nominal, cas d'erreur ou limite, cas alternatif, accès), au format « **Étant donné** contexte, **lorsque** action, **alors** résultat attendu ». **Au moins un** couvre un cas d'erreur ou un cas limite (champ vide, texte trop long, élément introuvable, accès non autorisé).
- **Hors périmètre de cette US** : ce qu'elle laisse volontairement de côté, pour que l'IA s'en tienne à son périmètre.

### 3. Valider chaque US contre INVEST

| Critère | Ce qu'on vérifie | Sinon |
|---|---|---|
| **Indépendante** | Elle se réalise et se teste seule, une fois ses « Dépend de » terminées ; les dépendances vont dans un seul sens. | Regrouper ou redécouper pour casser la dépendance croisée. |
| **Négociable** | Elle décrit le besoin et laisse la solution ouverte : les mots de l'utilisateur, à la place de « base de données », « API », « composant ». | Réécrire du point de vue de l'utilisateur. |
| **Valuable** (utile) | Son « afin de » apporte une valeur que l'utilisateur reconnaît. | La fusionner avec l'US qu'elle sert. |
| **Estimable** | Sa taille (S ou M) se donne sans inconnue majeure. | L'inconnue devient une question de la ronde suivante. |
| **Small** (petite) | Un seul acteur, une seule action (une phrase sans « et » ni « ou »), 4 critères et une règle métier au plus. | La découper. |
| **Testable** | Chaque critère décrit un résultat **visible** par l'utilisateur. | Reformuler le critère en résultat observable. |

Vérifier aussi qu'elle est **bien rangée** : l'US sert l'objectif de son epic ; sinon, la déplacer ou proposer une autre epic.
- Si des données sont partagées entre plusieurs personnes, intégrer des US d'accès : qui voit quoi (ex. « En tant que <acteur>, je vois seulement mes propres <éléments> »). Ce sont elles qui porteront la sécurité.

### 4. Trancher les questions et trier

1. **Questions clés** : repérer les **cas limites** dont le comportement change ce que vit l'utilisateur et qu'aucun document ne tranche (une annulation tardive, un doublon, un accès refusé). Les poser par rondes de 3 au plus, sous forme de scénario concret (« Un client annule une heure avant le rendez-vous : que se passe-t-il ? »), avec des exemples de réponses tirés d'autres métiers. La réponse donne le « alors… » du critère de cas d'erreur ou limite. Une question **bloquante** (sans sa réponse, un critère d'acceptation reste à écrire ou la taille reste inconnue) se pose dans une ronde ; une question **non bloquante** (un détail que la spec tranchera) reste dans les « Questions ouvertes » de l'US.
2. **Ordre de réalisation** : trier les US par priorité d'implémentation : d'abord celles dont d'autres dépendent, puis par priorité (Indispensable, Essentiel, Optionnel), puis dans l'ordre du parcours. Vérifier que les dépendances s'enchaînent dans un seul sens, sans boucle.

### 5. Definition of Ready

Une US est **prête** quand ces conditions sont réunies ; elle se sauvegarde seulement prête :
- elle passe INVEST (étape 3) ;
- ses critères d'acceptation sont écrits, dont au moins un cas d'erreur ou limite ;
- ses dépendances sont notées (« Dépend de », ou « — ») ;
- **aucune question bloquante** ne reste : sinon, poser une nouvelle ronde (3 questions au plus).

Cocher la section « Prête » du modèle d'US une fois ces conditions vérifiées.

### 6. Valider, puis sauvegarder

**Travail en cours** : avant de présenter la validation, écrire `aidd_docs/tasks/in-progress.md` (règle commune 16) avec les epics, les décisions prises et la question en attente ; l'effacer (`pulse-aidd travail-fini`) une fois les US sauvegardées.

1. **Présenter**, dans la conversation : le tableau des epics, le parcours, l'**ordre de réalisation**, chaque US en résumé (phrase, taille, dépendances, critères), puis **le tableau des règles métier** de toutes les US : `| Règle | US | Origine |`, l'origine valant « Décidé par vous » (brief, PRD, réponse à une question clé) ou « Proposé par Pulse ».
2. **Attendre la validation explicite** (AskUserQuestion) : « Valider et sauvegarder » / « Contester une règle proposée par Pulse » / « Modifier une US ». Une règle contestée se tranche par une question clé, puis l'US est corrigée et présentée à nouveau. Seule la réponse « Valider et sauvegarder » déclenche l'écriture.
3. **Sauvegarder** vers l'outil de ticketing de la mémoire projet (ligne « Outil de ticketing » de `aidd_docs/memory/project.md`) :
   - **toujours** les fichiers : le référentiel `docs/user-stories.md` (modèle du référentiel : epics, parcours, ordre de réalisation, puis pour chaque epic son tableau d'US, rangé dans l'ordre de réalisation, avec le lien vers chaque fichier) et les fichiers `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` ;
   - **si un outil est indiqué** (GitHub Issues, Jira, Linear…) : créer aussi un ticket par US détaillée, dans l'ordre de réalisation, avec la phrase, les critères et le lien vers le fichier. GitHub Issues passe par `gh issue create` ; un autre outil, par son connecteur (MCP) s'il est disponible ; sinon, le signaler et garder les fichiers seuls. Reporter le lien de chaque ticket dans la ligne « Ticket » de son US ;
   - **ligne absente** : garder les fichiers, et proposer d'ajouter la ligne « Outil de ticketing » à la mémoire projet (`/pulse:memory`).

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:spec <US-XXX>` (la première US de l'ordre de réalisation).

---
description: Écrire les user stories, rangées par groupe (un fichier par US, et le référentiel docs/user-stories.md), avec règles métier, exemples et critères d'acceptation (Étant donné / Lorsque / Alors), chacune vérifiée avant d'être déclarée prête, triées par ordre de réalisation, sauvegardées après validation
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte us) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite *) Bash(pulse-aidd tests *) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd travail-fini) Read Glob Grep Write(docs/user-stories.md) Edit(docs/user-stories.md) Write(aidd_docs/tasks/**) Edit(aidd_docs/tasks/**) Write(docs/lexique.md) Edit(docs/lexique.md)
---

# /pulse:us – Les user stories

## Objectif

Produire le **référentiel** `docs/user-stories.md` (les groupes, la vue d'ensemble, le parcours utilisateur) et **un fichier par user story** dans le dossier de son groupe : `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` (règles des tâches chargées en fin de fichier, dans « Références de la commande »). Expliquer en deux phrases :
« Une user story décrit un besoin du point de vue de l'utilisateur. Ses critères d'acceptation, écrits sous la forme Étant donné… Lorsque… Alors…, sont ce qui permettra de vérifier que l'IA a codé exactement ce que vous vouliez. »

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte us` et lire sa sortie en entier) pendant toute la commande. Appliquer aussi « Les règles des user stories » (chargées en fin de fichier, dans « Références de la commande ») pendant toute la commande.

## Contexte

### Prérequis

- `docs/prd.md` est nécessaire (à défaut `docs/brief.md`, en le signalant). Sinon, proposer `/pulse:prd`.
- Si `docs/user-stories.md` existe : demander s'il faut le compléter ou le refaire. Le compléter garde les numéros des US existantes. Le refaire conserve les fichiers de `aidd_docs/tasks/` qui ont déjà une spec ou un plan : le signaler et demander.

## Processus

Appliquer « Penser avant d'écrire » (en fin de fichier). Les règles déjà tranchées (brief, glossaire, PRD) se reprennent sans les redemander. La rédaction (format, découpage, contrôle qualité) reste à Pulse.

**Clarifier le périmètre** : les questions secondaires (ce que l'utilisateur fait, ce qu'il voit) suivent la règle commune 5 ; les cas limites importants sont les questions clés de cette commande (étape 4). Les choix techniques se tranchent plus tard, avec `/pulse:tech` et le plan.

### 1. Découper en groupes

Regrouper les fonctionnalités **Indispensables**, **Essentielles** et **Optionnelles** du PRD en **groupes** : un groupe = un grand besoin de l'utilisateur (« Gérer les demandes », « Suivre les paiements »), qui contient plusieurs US. Viser 2 à 6 groupes pour une première version ; un groupe d'une seule US est possible. Les **En attente** restent hors des groupes.

Pour chaque groupe : un titre, un objectif en une phrase et un nom de dossier `<epic>` (« Fichier » dans le « Format » des règles des user stories). Montrer la liste des groupes avec leurs dossiers et la faire valider (« Valider » / « Modifier les groupes ») avant d'écrire les US.

### 2. Écrire les user stories

Pour chaque fonctionnalité **Indispensable** et **Essentielle** du PRD, écrire une ou plusieurs US détaillées, chacune dans **son fichier**. Les **Optionnelles** apparaissent seulement dans le tableau de leur groupe, sans fichier (colonne « Fichier » : « — (détaillée lors de sa spec) ») ; leur fichier sera écrit par `/pulse:spec` quand elles seront traitées.

Chaque US suit le modèle de fichier d'US et le « Format » des règles des user stories.

### 3. Valider chaque US : INVEST et rangement

Vérifier chaque US selon « INVEST » et « Bien rangée et US d'accès » des règles des user stories.

### 4. Trancher les questions et trier

1. **Questions clés** (1 à 2 par groupe, « Penser avant d'écrire » § 1 à 4) : les **cas limites** dont le comportement change ce que vit l'utilisateur et qu'aucun document ne tranche (une annulation tardive, un doublon, un accès refusé). Chacune se pose seule, dans la conversation, en réponse libre, sous forme de scénario concret (« Un client annule une heure avant le rendez-vous : que se passe-t-il ? »), suivie de 2 ou 3 exemples tirés d'autres métiers ; reformuler et confronter la réponse, qui donne le « alors… » du critère de cas d'erreur ou limite. Les autres cas bloquants (un détail, une valeur par défaut, sans lesquels un critère reste à écrire) se posent en questions secondaires (règle commune 5) ; un cas non bloquant reste dans les « Questions ouvertes » de l'US.
2. **Ordre de réalisation** : trier les US par priorité d'implémentation : d'abord celles dont d'autres dépendent, puis par priorité (Indispensable, Essentiel, Optionnel), puis dans l'ordre du parcours. Vérifier que les dépendances s'enchaînent dans un seul sens, sans boucle.

### 5. Definition of Ready

Une US se sauvegarde seulement prête (« Definition of Ready » des règles des user stories) ; une question bloquante restante se tranche d'abord (étape 4).

### 6. Valider, puis sauvegarder

**Travail en cours** : avant de présenter la validation, écrire `aidd_docs/tasks/in-progress.md` (règle commune 16) avec les groupes, les décisions prises et la question en attente ; l'effacer (`pulse-aidd travail-fini`) une fois les US sauvegardées.

1. **Présenter**, dans la conversation : le tableau des groupes, le parcours, l'**ordre de réalisation**, chaque US en résumé (phrase, taille, dépendances, critères), puis **le tableau des règles métier** de toutes les US : `| Règle | US | Origine |`, l'origine valant « Décidé par vous » (brief, PRD, réponse à une question clé) ou « Proposé par Pulse ».
2. **Attendre la validation explicite** (AskUserQuestion) : « Valider et sauvegarder » / « Contester une règle proposée par Pulse » / « Modifier une US ». Une règle contestée se tranche par une question clé, puis l'US est corrigée et présentée à nouveau. Seule la réponse « Valider et sauvegarder » déclenche l'écriture.
3. **Sauvegarder** selon « Ticketing » des règles des user stories.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:spec <US-XXX>` (la première US de l'ordre de réalisation).

## Exemples

- `/pulse:us` : les groupes proposés à valider, puis chaque user story résumée avec ses critères ; après « Valider et sauvegarder », un fichier par user story et le référentiel `docs/user-stories.md`.
- `/pulse:us` quand `docs/user-stories.md` existe déjà : la question « le compléter ou le refaire ? » ; le compléter garde les numéros existants.

## Références de la commande

!`pulse-aidd contexte us`

Les références et modèles cités dans cette commande figurent dans ce contexte. Si ce contexte est absent, lancer `pulse-aidd contexte us` et lire sa sortie.

---
description: Rédiger la spécification d'une user story (une US = une spec, rangée à côté de l'US dans aidd_docs/tasks/<epic>/) - l'intention seule, la solution étant laissée au plan - périmètre, hors objectifs, écrans, informations, règles, scénarios, « terminé quand » ; les points encore ouverts notés comme questions ; figée une fois validée
argument-hint: "<US-XXX [US-YYY…] | \"description de la demande\">"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte spec) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *)
---

# /pulse:spec – La spécification

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte spec`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte spec` et lire sa sortie.

Sujet de la spec : `$ARGUMENTS`

## Objectif

Produire `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`, à côté du fichier de l'US (`US-XXX-<nom>.md`) : **ce que** l'outil doit permettre pour **une** user story, du point de vue de l'utilisateur. **Une US = une spec.** Le **comment** (pile, stockage, fichiers, services) se décide ensuite dans le plan. Expliquer en une phrase : « La spec fixe ce que vous voulez obtenir ; le plan choisira comment le construire. »

## Les quatre règles de la spec

1. **L'intention seulement.** La spec reste valable quelle que soit la solution technique : elle décrit des écrans, des informations, des règles et des résultats visibles, avec les mots du métier. Les fichiers, composants, routes, tables, bibliothèques, motifs de code et la manière de faire vont dans le plan (`/pulse:plan`). « Terminé quand » énonce des **résultats** observables par l'utilisateur, plutôt que des étapes de travail ; 2 à 4 suffisent.
2. **Rien d'inventé.** Chaque information de la spec vient de l'US, du PRD, du brief, du glossaire, d'une spec déjà écrite ou d'une réponse de la personne. Un trou s'écrit à sa place `TBD: <question précise>` (« TBD: un rendez-vous annulé reste-t-il visible dans l'historique ? ») et se reprend dans « Questions en suspens ». Si la demande est trop vague pour écrire une spec utile (aucun acteur, aucune action ou aucun résultat identifiable), s'arrêter et demander une demande plus précise, avec un exemple de formulation.
3. **Lisible d'un coup d'œil.** Des titres clairs, les critères en puces, et des **hors objectifs** explicites.
4. **Verrouillée une fois validée.** La validation de la personne verrouille la spec (`Statut : verrouillée le AAAA-MM-JJ`). Une spec verrouillée se lit sans se réécrire ; un changement de besoin passe par une **nouvelle US** et sa spec (étape 0).

## Prérequis

- `docs/user-stories.md` (le référentiel) et `docs/prd.md` sont nécessaires. Sinon, proposer `/pulse:us`.
- Ancien format (`docs/specs/`, ou US détaillées dans `docs/user-stories.md` sans fichiers dans `aidd_docs/tasks/`) : proposer `/pulse:init`, qui réorganise les documents, et s'arrêter.

## Déroulé

### 0. Identifier l'US

Lire l'argument (règles « User stories, specs et plans » ci-dessus) :
- **un identifiant d'US** (`US-003`) : retrouver l'US dans `docs/user-stories.md` et son fichier `aidd_docs/tasks/<epic>/US-003-<nom>.md`. Introuvable : lister les US proches et demander.
- **plusieurs identifiants** (une liste ou une plage) : une spec **par US**. Les traiter l'une après l'autre, dans l'ordre de réalisation du référentiel, en appliquant tout le déroulé (brouillon, questions, validation) à chacune.
- **une description** (« ajouter un filtre par date ») : chercher l'US qui la couvre déjà.
  - Une US la couvre et sa spec est encore en brouillon (ou absente) : la spec porte sur cette US (la citer).
  - Une US la couvre et sa spec est **verrouillée** : le changement devient une nouvelle US (cas suivant), qui complète ou remplace l'ancienne.
  - **Nouveau comportement prévu au PRD** : créer une nouvelle US (numéro suivant, format du modèle d'US, prête selon `/pulse:us` : INVEST et Definition of Ready), demander son epic (AskUserQuestion : les epics existantes, l'epic la plus proche en premier avec « (Recommandé) », et « Nouvelle epic »), la montrer et attendre sa validation, puis écrire son fichier dans `aidd_docs/tasks/<epic>/` et l'ajouter au tableau de son epic et à l'ordre de réalisation dans `docs/user-stories.md`.
  - **Nouveau comportement hors PRD** : décision de périmètre, la poser (AskUserQuestion) : « La noter « En attente » dans le PRD (recommandé) » / « L'ajouter au périmètre maintenant ». Dans le premier cas, l'écrire dans `docs/prd.md` et s'arrêter.
- **argument vide** : demander (AskUserQuestion) quelle US spécifier, en proposant les US sans spec dans l'ordre de réalisation du référentiel (« La prochaine US à réaliser (Recommandé) »), et « Décrire une demande ».

Si l'US attend encore son fichier (US Optionnelle, seulement dans le référentiel) : l'écrire d'abord au format du modèle d'US, la montrer et la faire valider, puis remplir la colonne « Fichier » du référentiel.

Si `SPEC-US-XXX-<nom>.md` existe déjà :
- **brouillon** : la compléter, en commençant par ses `TBD:` ;
- **verrouillée** : la laisser intacte, et proposer (AskUserQuestion) « Créer une nouvelle US qui la fait évoluer (Recommandé) » / « Garder la spec telle quelle ». La nouvelle spec cite l'ancienne dans « Remplace ou complète » ; une fois la nouvelle verrouillée, l'ancienne reçoit seulement son changement de statut (`remplacée par US-YYY le AAAA-MM-JJ`) si elle est remplacée.

Si l'US est de taille **L** : proposer de la découper d'abord (`/pulse:us`), une spec couvrant une seule US.

### 1. Rédiger le brouillon

Suivre le modèle de spec, avec `Statut : brouillon`. Relire les autres specs (`aidd_docs/tasks/*/SPEC-US-*.md`) pour réutiliser leurs écrans, informations et règles en y renvoyant :

1. **Intention** : ce que l'utilisateur pourra faire, en une phrase ; l'US couverte (et la demande d'origine si elle vient d'une demande) ; les specs sur lesquelles elle s'appuie ; la spec verrouillée qu'elle fait évoluer, le cas échéant.
2. **Périmètre** : ce qui est inclus, puis les **hors objectifs**, explicites (repris de « Hors périmètre » de l'US, des autres US de l'epic, des « En attente » du PRD).
3. **Ce que l'utilisateur voit et fait** : pour chaque écran, qui y accède, ce qu'on y voit, ce qu'on y fait ; les situations à prévoir (en attente, rien à afficher, échec, sur téléphone) décrites par ce que vit l'utilisateur ; le parcours principal (schéma `flowchart` du modèle, 3 à 7 étapes ; le retirer pour un écran unique). Un écran se nomme par ce qu'il montre (« la liste de mes factures »), sans adresse ni composant.
4. **Informations manipulées** : pour chaque type d'information, ses informations en mots du métier (obligatoire ou non, règle, exemple réaliste et fictif), et **qui peut consulter, ajouter, modifier, supprimer**, en français (« un client consulte seulement les demandes dont il est l'auteur »). Le lieu de stockage et de vérification est décidé dans le plan.
5. **Règles métier** : reprises de l'US, chacune en une phrase vraie.
6. **Scénarios** : selon la référence « Scénarios Gherkin » ci-dessus, une `Règle` par règle métier de l'US, et pour chacune 2 à 5 exemples concrets (cas nominal, limites, cas refusés), écrits en langage métier avec des données fictives et les mots du glossaire. Chaque exemple porte l'étiquette du critère qu'il illustre (`@US-XXX-1`) et son niveau de preuve prévu (`@unitaire`, `@integration`, `@bout-en-bout`, ou `@manuel`, selon `tests/strategie.md` §2, affichable avec `pulse-aidd reference tests/strategie.md`) ; chaque critère d'acceptation est couvert par au moins un exemple.
7. **Données personnelles et accès** : voir l'étape 2.
8. **Ajouts proposés par Pulse** : voir l'étape 3.
9. **Terminé quand** : 2 à 4 résultats observables par l'utilisateur, tirés des critères d'acceptation.
10. **Questions en suspens** : chaque `TBD:` de la spec.

**Relecture « intention »** avant de montrer le brouillon : chercher dans le texte tout nom de fichier, composant, route, table, bibliothèque, service technique ou verbe de construction (« créer une fonction », « stocker dans ») ; le reformuler en résultat pour l'utilisateur, ou le noter pour le plan.

### 2. La section « Données personnelles et accès » (obligatoire)

Pré-remplir les 3 réponses à partir de l'US (et des specs déjà écrites qui partagent ses informations), puis faire **valider par la personne** les deux qui relèvent de sa décision :
- « Ces données personnelles sont-elles toutes nécessaires ? » (minimisation des données)
- « Qui a le droit de voir quoi ? »

La troisième (ce que vit l'utilisateur qui remplit mal un formulaire) se déduit des critères d'erreur de l'US ; une réponse introuvable devient un `TBD:`. Les secrets, contrôles techniques et points de la checklist sécurité sont traités dans le plan.

### 3. Trancher, puis verrouiller

1. **Ajouts proposés par Pulse** : relever tout ce que la spec ajoute au-delà de l'US et du PRD (un écran, un message, une confirmation, une règle d'accès) et le présenter dans la section « Ajouts proposés par Pulse », une ligne par ajout, avec « Pourquoi ça compte » en langage courant. Faire trancher chaque ligne (AskUserQuestion, choix multiple « Lesquels gardez-vous ? »). Un ajout refusé sort de la spec ; s'il reste une bonne idée, il va dans `docs/prd.md` (« En attente »).
2. **Les `TBD:`** : poser les questions en suspens par rondes de 3 au plus (AskUserQuestion, réponse recommandée en premier quand un document la suggère) ; chaque réponse remplace son `TBD:`. Une question que la personne veut garder ouverte reste `TBD:`, et la spec reste en brouillon.
3. Écrire `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`. Présenter un résumé en 5 lignes au plus (US, écrans, informations, hors objectifs, « terminé quand »), puis les **titres des scénarios**, groupés par règle (« Voici ce que l'outil devra faire, exemple par exemple »).
4. **Validation** (AskUserQuestion) : « Valider (la spec ne bougera plus) » / « Corriger un scénario ou un point ». « Valider (la spec ne bougera plus) » est proposé seulement quand il ne reste aucun `TBD:` ; sinon, dire lesquels restent et proposer « La garder en brouillon ». À la validation, écrire `Statut : verrouillée le <date du jour>`. Plusieurs US demandées : passer à la suivante seulement après cette validation.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:plan US-XXX` pour une spec verrouillée (ou `/pulse:ui maquettes US-XXX` d'abord, si la spec a des écrans et que la personne veut les voir avant de construire) ; `/pulse:spec US-XXX` pour une spec restée en brouillon.

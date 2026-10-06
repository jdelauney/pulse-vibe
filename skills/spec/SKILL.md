---
description: Rédiger la spécification d'une user story (une US = une spec, rangée à côté de l'US dans aidd_docs/tasks/<epic>/) - écrans, données, règles, services et section Données et sécurité obligatoire
argument-hint: "<US-XXX [US-YYY…] | \"description de la demande\">"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *)
---

# /pulse:spec – La spécification

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte spec`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte spec` et lire sa sortie.

Sujet de la spec : `$ARGUMENTS`

## Objectif

Produire `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`, à côté du fichier de l'US (`US-XXX-<nom>.md`) : **comment** sera construit ce que demande **une** user story. **Une US = une spec.** Lisible par une personne non technique, c'est le document que l'IA suivra pour coder.

## Prérequis

- `docs/user-stories.md` (le référentiel) et `docs/prd.md` sont nécessaires. Sinon, proposer `/pulse:us`.
- `docs/technical.md` est nécessaire : la pile, l'organisation des fichiers et le contrôle d'accès en viennent. S'il manque, ou si le bloc « Pile technique » de `CLAUDE.md` indique encore « Pile non choisie » : proposer `/pulse:tech` et s'arrêter.
- Ancien format (`docs/specs/`, ou US détaillées dans `docs/user-stories.md` sans fichiers dans `aidd_docs/tasks/`) : proposer `/pulse:init`, qui réorganise les documents, et s'arrêter.

## Déroulé

### 0. Identifier l'US

Lire l'argument (règles « User stories, specs et plans » ci-dessus) :
- **un identifiant d'US** (`US-003`) : retrouver l'US dans `docs/user-stories.md` et son fichier `aidd_docs/tasks/<epic>/US-003-<nom>.md`. Introuvable : lister les US proches et demander.
- **plusieurs identifiants** (une liste ou une plage) : une spec **par US**. Les traiter l'une après l'autre, dans l'ordre du parcours, en appliquant tout le déroulé (brouillon, sécurité, validation) à chacune.
- **une description** (« ajouter un filtre par date ») : chercher l'US qui la couvre déjà.
  - Une US la couvre : la spec porte sur cette US (la citer).
  - **Nouveau comportement prévu au PRD** : créer une nouvelle US (numéro suivant, format du modèle d'US), demander son epic (AskUserQuestion : les epics existantes, l'epic la plus proche en premier avec « (Recommandé) », et « Nouvelle epic »), écrire son fichier dans `aidd_docs/tasks/<epic>/` et l'ajouter au tableau de son epic dans `docs/user-stories.md`, en le montrant.
  - **Nouveau comportement hors PRD** : décision de périmètre, la poser (AskUserQuestion) : « La noter « En attente » dans le PRD (recommandé) » / « L'ajouter au périmètre maintenant ». Dans le premier cas, l'écrire dans `docs/prd.md` et s'arrêter.
- **argument vide** : demander (AskUserQuestion) quelle US spécifier, en proposant les US Indispensables sans spec, dans l'ordre du parcours (« La prochaine US du parcours (Recommandé) »), puis les Essentielles, et « Décrire une demande ».

Si l'US attend encore son fichier (US Optionnelle, seulement dans le référentiel) : l'écrire d'abord au format du modèle d'US, la montrer et la faire valider, puis remplir la colonne « Fichier » du référentiel.

Si `SPEC-US-XXX-<nom>.md` existe déjà : demander s'il faut la compléter ou la refaire. Si l'US est de taille **L** : proposer de la découper d'abord (`/pulse:us`), une spec couvrant une seule US.

### 1. Rédiger le brouillon

Suivre le modèle de spec ; relire les autres specs (`aidd_docs/tasks/*/SPEC-US-*.md`) pour réutiliser leurs écrans, données et règles en y renvoyant :

1. **Résumé** : l'US couverte (et la demande d'origine, en une phrase, si elle vient d'une demande) et les specs existantes sur lesquelles elle s'appuie.
2. **Périmètre** : ce qui est inclus, et ce qui est exclu volontairement (repris de « Hors périmètre » de l'US, des autres US de l'epic, des « En attente » du PRD).
3. **Pile technique** : reprendre « Pile retenue » de `docs/technical.md` (y renvoyer plutôt que la recopier en détail). Expliquer chaque choix en une phrase simple. Introduire un outil absent de « Pile retenue » seulement après l'avoir demandé ; si un besoin l'exige, proposer `/pulse:tech` pour revoir la pile.
4. **Écrans** : pour chacun, qui y accède, ce qu'on y voit, ce qu'on y fait, et l'US liée. Décrire les états (chargement, liste vide, erreur, téléphone) et le parcours principal (schéma `flowchart` du modèle, 3 à 7 étapes ; le retirer pour un écran unique). Si `docs/design.md` existe, décrire les écrans dans son registre et avec ses composants. Si `docs/design/maquettes/US-XXX-<nom>/retenue/` existe, ajouter la ligne « Maquette : `docs/design/maquettes/US-XXX-<nom>/retenue/` ». Sinon, signaler en fin de commande que les écrans peuvent être maquettés avec `/pulse:ui maquettes US-XXX`.
5. **Données** : pour chaque type d'information :
   - **où elle est stockée**, selon « Données et contrôle d'accès » de `docs/technical.md` (sur l'appareil, dans une base, dans des fichiers…) ;
   - ses **champs** (type, obligatoire, règle, exemple réaliste) ;
   - **qui peut lire, créer, modifier, supprimer**, en français (« un client lit seulement les demandes dont il est l'auteur ») ;
   - **où ce contrôle d'accès est vérifié** (côté serveur ou dans la base, comme le décrit « Données et contrôle d'accès » ; « sans objet » si les données restent sur l'appareil d'une seule personne) ;
   - s'il y a plusieurs types d'information, leurs **liens** (schéma `erDiagram` du modèle ; sinon le retirer).
6. **Règles métier** : reprises de l'US, avec l'endroit où chacune est vérifiée. Toute règle de sécurité ou d'intégrité doit être vérifiée **dans la base ou côté serveur** ; une vérification dans le navigateur vient seulement en plus.
7. **Services externes** : reprendre ceux de « Pile retenue » de `docs/technical.md` (1 ou 2 au maximum pour le MVP) et préciser ce que chacun fait dans ce projet. Si le PRD en demande un autre : le signaler et proposer `/pulse:tech`. Un service de paiement s'intègre d'abord en **mode test** ; le passage en mode réel est une décision de la personne, prise au moment de la mise en ligne.
8. **Données et sécurité** : voir l'étape 2 ci-dessous.
9. **Fichiers** : renvoyer à « Organisation des fichiers » de `docs/technical.md` (la reprendre telle quelle) et lister seulement les fichiers propres à cette spec, chacun marqué « à créer » ou « à modifier » après vérification dans le projet. Présenter comme existant seulement un fichier vu dans le projet.
10. **Vérifications** : une ligne par critère d'acceptation de l'US, plus les vérifications transverses du modèle qui s'appliquent (accès non autorisé, formulaire mal rempli, téléphone). Proposer un test automatique seulement si la pile retenue en prévoit.
11. **Points d'attention** : les risques réels de cette spec (donnée partagée, règle délicate, service externe, action manuelle) et ce qu'on prévoit ; sinon « aucun identifié ».
12. **Questions ouvertes** : ce qui reste à trancher avant le plan. Poser les plus importantes (3 au maximum), une par une ; les autres restent notées.
13. **Définition de « terminé »** : reprendre celle du modèle.

### 2. La section « Données et sécurité » (obligatoire)

Pré-remplir les 4 réponses à partir de l'US (et des specs déjà écrites qui partagent ses données), puis faire **valider par la personne** les deux qui relèvent de sa décision :
- « Ces données personnelles sont-elles toutes nécessaires ? » (minimisation des données)
- « Qui a le droit de voir quoi ? »

Les deux autres (secrets utilisés, contrôle des formulaires) sont des choix techniques : appliquer « Secrets et variables d'environnement » et « Données et contrôle d'accès » de `docs/technical.md` ainsi que la checklist, puis les expliquer.

Lister enfin les points de la checklist sécurité (S1 à S12) qui s'appliquent au projet.

### 3. Écrire et valider

**Ajouts proposés par Pulse** : relever tout ce que la spec ajoute au-delà de l'US et du PRD (sécurité, confort, bibliothèque, écran ou message supplémentaire) et le présenter dans la section « Ajouts proposés par Pulse », une ligne par ajout, avec « Pourquoi ça compte » en langage courant. Faire trancher chaque ligne (AskUserQuestion, choix multiple « Lesquels gardez-vous ? ») ; les lignes imposées par la checklist sécurité portent « exigé par la sécurité » et s'expliquent sans se négocier. Un ajout refusé sort de la spec ; s'il reste une bonne idée, il va dans `docs/prd.md` (« En attente »).

Écrire `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`. Présenter un résumé en 5 lignes maximum (US, écrans, données, services, points de sécurité) et demander validation. Plusieurs US demandées : passer à la suivante seulement après cette validation.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:plan US-XXX` (ou `/pulse:ui maquettes US-XXX` d'abord, si la spec a des écrans et que la personne veut les voir avant de construire).

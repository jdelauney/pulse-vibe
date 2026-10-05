---
description: Rédiger la spécification d'une user story ou d'une demande - écrans, données, règles, services et section Données et sécurité obligatoire
argument-hint: "<identifiant(s) d'US | \"description de la demande\">"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *)
---

# /pulse:spec – La spécification

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte spec`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte spec` et lire sa sortie.

Sujet de la spec : `$ARGUMENTS`

## Objectif

Produire `docs/specs/<nom>.md` : **comment** sera construit ce que demandent une ou plusieurs user stories, ou une demande décrite par la personne. Lisible par une personne non technique, c'est le document que l'IA suivra pour coder.

## Prérequis

- `docs/user-stories.md` et `docs/prd.md` sont nécessaires. Sinon, proposer `/pulse:us`.
- `docs/technical.md` est nécessaire : la pile, l'organisation des fichiers et le contrôle d'accès en viennent. S'il manque, ou si le bloc « Pile technique » de `CLAUDE.md` indique encore « Pile non choisie » : proposer `/pulse:tech` et s'arrêter.

## Déroulé

### 0. Identifier le sujet

Lire l'argument :
- **une ou plusieurs références d'US** (une, plusieurs, ou une plage, dans le format d'identifiant de `docs/user-stories.md`) : vérifier qu'elles existent dans ce fichier ; sinon, lister les US proches et demander ;
- **une description** (« ajouter un filtre par date ») : chercher l'US qui la couvre déjà.
  - Une US la couvre : la spec porte sur cette US (la citer).
  - **Nouveau comportement prévu au PRD** : ajouter l'US et ses critères dans `docs/user-stories.md` (format du fichier existant), en le montrant.
  - **Nouveau comportement hors PRD** : décision de périmètre, la poser (AskUserQuestion) : « La noter « En attente » dans le PRD (recommandé) » / « L'ajouter au périmètre maintenant ». Dans le premier cas, l'écrire dans `docs/prd.md` et s'arrêter.
- **argument vide** : demander (AskUserQuestion) quelles US spécifier, en proposant les US Indispensables pas encore couvertes par une spec de `docs/specs/` (« Toutes les US Indispensables (Recommandé) » pour un premier MVP), et « Décrire une demande ».

Puis proposer le **nom** (règles « Specs et plans » ci-dessus) et le faire valider ou modifier par la personne. Si `docs/specs/<nom>.md` existe, ou si une autre spec couvre déjà ces US : demander s'il faut la compléter, la refaire ou en créer une nouvelle.

### 1. Rédiger le brouillon

Suivre le modèle de spec ; relire les autres specs de `docs/specs/` pour réutiliser leurs écrans, données et règles au lieu de les redécrire (y renvoyer) :

1. **Résumé** : liste des US couvertes (ou la demande d'origine, en une phrase) et specs existantes sur lesquelles elle s'appuie.
2. **Périmètre** : ce qui est inclus, et ce qui est exclu volontairement (repris de « Hors périmètre » des US, des US d'une autre priorité, des « En attente » du PRD).
3. **Pile technique** : reprendre « Pile retenue » de `docs/technical.md` (sans la recopier en détail : y renvoyer). Expliquer chaque choix en une phrase simple. Ne pas introduire d'outil absent de « Pile retenue » sans le demander ; si un besoin l'exige, proposer `/pulse:tech` pour revoir la pile.
4. **Écrans** : pour chacun, qui y accède, ce qu'on y voit, ce qu'on y fait, et les US liées. Décrire les états (chargement, liste vide, erreur, téléphone) et le parcours principal (schéma `flowchart` du modèle, 3 à 7 étapes ; le retirer s'il n'y a qu'un écran). Si `docs/design.md` existe, décrire les écrans dans son registre et avec ses composants. Si `docs/design/maquettes/<nom>/retenue/` existe, ajouter la ligne « Maquette : `docs/design/maquettes/<nom>/retenue/` ». Sinon, signaler en fin de commande que les écrans peuvent être maquettés avec `/pulse:ui maquettes <nom>`.
5. **Données** : pour chaque type d'information :
   - **où elle est stockée**, selon « Données et contrôle d'accès » de `docs/technical.md` (sur l'appareil, dans une base, dans des fichiers…) ;
   - ses **champs** (type, obligatoire, règle, exemple réaliste) ;
   - **qui peut lire, créer, modifier, supprimer**, en français (« un client ne lit que les demandes dont il est l'auteur ») ;
   - **où ce contrôle d'accès est vérifié** (côté serveur ou dans la base, comme le décrit « Données et contrôle d'accès » ; « sans objet » si les données restent sur l'appareil d'une seule personne) ;
   - s'il y a plusieurs types d'information, leurs **liens** (schéma `erDiagram` du modèle ; sinon le retirer).
6. **Règles métier** : reprises des US, avec l'endroit où chacune est vérifiée. Toute règle de sécurité ou d'intégrité doit être vérifiée **dans la base ou côté serveur**, pas seulement dans le navigateur.
7. **Services externes** : reprendre ceux de « Pile retenue » de `docs/technical.md` (1 ou 2 au maximum pour le MVP) et préciser ce que chacun fait dans ce projet. Si le PRD en demande un qui n'y figure pas : le signaler et proposer `/pulse:tech`. Un service de paiement s'intègre d'abord en **mode test** ; le passage en mode réel est une décision de la personne, prise au moment de la mise en ligne.
8. **Données et sécurité** : voir l'étape 2 ci-dessous.
9. **Fichiers** : renvoyer à « Organisation des fichiers » de `docs/technical.md` (ne pas la réinventer) et lister seulement les fichiers propres à cette spec, chacun marqué « à créer » ou « à modifier » après vérification dans le projet. Ne jamais présenter comme existant un fichier qui n'existe pas encore.
10. **Vérifications** : une ligne par critère d'acceptation des US couvertes, plus les vérifications transverses du modèle qui s'appliquent (accès non autorisé, formulaire mal rempli, téléphone). Ne proposer un test automatique que si la pile retenue en prévoit.
11. **Points d'attention** : les risques réels de cette spec (donnée partagée, règle délicate, service externe, action manuelle) et ce qu'on prévoit ; sinon « aucun identifié ».
12. **Questions ouvertes** : ce qui reste à trancher avant le plan. Poser les plus importantes (3 au maximum), une par une ; les autres restent notées.
13. **Définition de « terminé »** : reprendre celle du modèle.

### 2. La section « Données et sécurité » (obligatoire)

Pré-remplir les 4 réponses à partir des US, puis faire **valider par la personne** les deux qui relèvent de sa décision :
- « Ces données personnelles sont-elles toutes nécessaires ? » (minimisation des données)
- « Qui a le droit de voir quoi ? »

Les deux autres (secrets utilisés, contrôle des formulaires) sont des choix techniques : appliquer « Secrets et variables d'environnement » et « Données et contrôle d'accès » de `docs/technical.md` ainsi que la checklist, puis les expliquer.

Lister enfin les points de la checklist sécurité (S1 à S11) qui s'appliquent au projet.

### 3. Écrire et valider

Écrire `docs/specs/<nom>.md`. Présenter un résumé en 5 lignes maximum (US couvertes, écrans, données, services, points de sécurité) et demander validation.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:plan <nom>` (ou `/pulse:ui maquettes <nom>` d'abord, si la spec a des écrans et que la personne veut les voir avant de construire).

---
description: Concevoir comment réaliser la spec d'une user story (pile, données, écrans, sécurité, fichiers), puis la découper en petites tâches ordonnées, chacune testable à l'écran (une spec = un plan, rangé à côté de sa spec), écrit une fois validé avec vous
argument-hint: "<US-XXX [US-YYY…] | chemin de la spec>"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte plan) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite *) Bash(pulse-aidd tests *) Bash(pulse-aidd scenarios) Bash(pulse-aidd guide) Bash(pulse-aidd verifier-plan *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Read Glob Grep Write(aidd_docs/tasks/**) Edit(aidd_docs/tasks/**) Write(docs/lexique.md) Edit(docs/lexique.md) Edit(docs/prd.md) Bash(pulse-aidd travail-fini)
---

# /pulse:plan – Le plan de réalisation

## Objectif

Produire `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`, à côté de la spec `SPEC-US-XXX-<nom>.md` : la **conception technique** (comment réaliser ce que la spec demande) et la liste ordonnée des tâches qui réalisent cette spec (**une spec = un plan**), qui sert aussi de **tableau de suivi des tâches** (`[ ]` à faire, `[~]` en cours, `[x]` terminé). Expliquer en une phrase : « On avance par petites tâches que vous pouvez tester une par une : l'IA se trompe moins, et vous gardez le contrôle. »

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte plan` et lire sa sortie en entier) pendant toute la commande.

### Règles de découpage

Appliquer les « Règles de découpage » (chargées dans « Références de la commande ») à chaque tâche.

## Contexte

US (ou spec) à traiter : `$ARGUMENTS`

### Prérequis

- **La spec** : celle de l'US désignée en argument (règles des tâches), `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`. Plusieurs US : un plan par US, traités l'un après l'autre dans l'ordre du parcours. Argument vide ou introuvable : lister les specs, en premier celles qui attendent encore leur plan (dans l'ordre du parcours), et demander laquelle traiter. Spec absente pour cette US, ou encore en brouillon (`Statut : brouillon`, ou des `TBD:` restants) : proposer `/pulse:spec US-XXX` et s'arrêter. Le plan s'appuie sur une spec **verrouillée**, qu'il lit sans la modifier.
- `docs/user-stories.md` (le référentiel : priorité de l'US, parcours) et le fichier de l'US sont nécessaires. Sinon, proposer `/pulse:us`.
- `docs/technical.md` est nécessaire (organisation des fichiers, commandes, mise en place). Sinon, proposer `/pulse:tech`.
- Si `PLAN-SPEC-US-XXX-<nom>.md` existe avec « Statut : à valider » : il attend la validation de la personne ; reprendre à l'étape 3 du déroulé (contrôle, puis présentation).
- Si `PLAN-SPEC-US-XXX-<nom>.md` existe avec des tâches terminées : le conserver, et proposer d'ajouter ou de réordonner les tâches restantes.
- Relire les autres plans (`aidd_docs/tasks/*/PLAN-SPEC-US-*.md`) : ce qui y est déjà prévu ou fait reste dans son plan (y renvoyer).

## Processus

### Conception technique

Avant le découpage, remplir la section « Conception technique » du modèle de plan : c'est ici que se décide le **comment** de la spec. Appliquer la règle commune 4 (les choix purement techniques suivent ce qui est déjà en place, sinon le plus simple compatible avec « Pile retenue », expliqué en une phrase) :

1. **Pile et services** : reprendre « Pile retenue » de `docs/technical.md` (y renvoyer plutôt que la recopier en détail), et les services externes de « Pile retenue » utiles à l'US (1 ou 2 au maximum pour le MVP), avec ce que chacun fait ici. Introduire un outil absent de « Pile retenue » seulement après l'avoir demandé ; si un besoin l'exige, proposer `/pulse:tech` pour revoir la pile. Un service de paiement s'intègre d'abord en **mode test** ; le passage en mode réel est une décision de la personne, prise au moment de la mise en ligne.
2. **Écrans** : pour chaque écran de la spec, son adresse, s'il est public ou réservé, et sa **présentation**, reprise de la colonne « Présentation » de la spec. Les tâches qui réalisent un écran la reprennent, mot pour mot. Pour un écran public, la colonne « Référencement » (adresse lisible, titre, description, indexé ou non) d'après `docs/seo.md` et « Être trouvé » du PRD. Si `docs/design/maquettes/US-XXX-<nom>/retenue/` existe, la citer sur la ligne « Maquette » ; sinon, signaler en fin de commande que les écrans peuvent être maquettés avec `/pulse:ui maquettes US-XXX`. Pour chaque écran, nommer les motifs de `ui/motifs.md` qu'il emploie (tableau de données, panneau latéral, notification…) ; la tâche qui réalise l'écran les reprend.
3. **Données** : pour chaque type d'information de la spec, **où il est stocké** et ses champs, selon « Données et contrôle d'accès » de `docs/technical.md` ; **où le contrôle d'accès est vérifié** (côté serveur ou dans la base ; « sans objet » si les données restent sur l'appareil d'une seule personne), pour appliquer « Qui peut » de la spec ; leurs liens (schéma `erDiagram` du modèle, s'il y a plusieurs types).
4. **Où chaque règle est vérifiée** : toute règle de sécurité ou d'intégrité est vérifiée **dans la base ou côté serveur** ; une vérification dans le navigateur vient seulement en plus.
5. **Sécurité** : les secrets utilisés (selon « Secrets et variables d'environnement »), les contrôles de formulaire côté serveur qui produisent le résultat décrit par la spec, et les points de la checklist sécurité (S1 à S13) qui s'appliquent. Une protection exigée par la checklist et absente de la spec va dans « Ajouts proposés par Pulse » avec la décision « exigé par la sécurité » : elle s'explique sans se négocier.
6. **Fichiers** : renvoyer à « Organisation des fichiers » de `docs/technical.md` et lister seulement les fichiers propres à cette US, chacun marqué « à créer » ou « à modifier » après vérification dans le projet. Présenter comme existant seulement un fichier vu dans le projet.
7. **Points d'attention** : les risques réels de cette conception (donnée partagée, règle délicate, service externe, action manuelle) et ce qu'on prévoit, rattachés à leurs tâches ; sinon « aucun identifié ».

Cette conception reste fidèle à la spec : elle réalise ses scénarios et ses « Qui peut », sans ajouter de comportement visible. Un comportement que la spec ne prévoit pas va dans « Ajouts proposés par Pulse ».

### Déroulé

1. Remplir la conception technique, puis construire les tâches selon les « Règles de découpage », avec le modèle de plan. Numéroter à la suite des autres plans (règles des tâches).
2. Compter les tâches : viser **1 à 4** pour une US (hors mise en place et mise en ligne). Au-delà, le signaler et proposer de découper l'US en deux (`/pulse:us`, puis une spec et un plan pour chacune).
3. **Contrôler.** Écrire le plan, `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`, avec la ligne « Statut : à valider » de sa vue d'ensemble, puis lancer `pulse-aidd verifier-plan US-XXX`. Corriger chaque constat « à corriger » (critère ou scénario sans tâche, dépendance inconnue, mise en ligne mal placée…) et relancer : **deux tours au plus**. Ce qui reste (constats « à corriger » non résolus, avertissements à garder) se montre à la personne à l'étape suivante, en une ligne chacun, avec la raison.
4. **Montrer, puis faire valider.** Présenter la conception technique en 5 lignes au plus (pile et services, stockage et contrôle d'accès, secrets, points de sécurité, fichiers principaux), puis la liste résumée des tâches (titres), avec la ligne « En parallèle avec » et, si d'autres plans sont mis à jour en conséquence, lesquels. **Ajouts proposés par Pulse** : un élément absent de la spec et de « Pile retenue » (bibliothèque, écran, règle, réglage), ou exigé par la checklist sécurité, se présente aussi, et se valide avec le plan. Avant la question, écrire `aidd_docs/tasks/in-progress.md` (règle commune 16 : le plan attend sa validation) ; l'effacer avec `pulse-aidd travail-fini` une fois le plan validé. Demander (AskUserQuestion) : « Valider le plan (Recommandé) » / « Je veux changer quelque chose ». Si la personne veut des changements : les appliquer au plan en respectant les « Règles de découpage », relancer le contrôle (étape 3), montrer ce qui change, puis redemander. Un changement de périmètre (une fonctionnalité en plus) se note « En attente » dans `docs/prd.md` ; il se traitera avec `/pulse:refine` une fois le plan écrit.
5. Plan validé. Passer sa ligne « Statut » à « validé le AAAA-MM-JJ » (section « Ajouts proposés par Pulse » seulement s'il y en a), ajouter la ligne « plan validé » à son journal (règles de réalisation), et mettre à jour les lignes « En parallèle avec » des autres plans concernés.
6. Lancer `pulse-aidd guide` : il produit le guide de réalisation `docs/guide/` (les commandes à copier, tâche par tâche). Le présenter en une phrase : « Votre carnet de route est dans `docs/guide/index.md` ; il se met à jour tout seul. »

Terminer avec le bloc de fin de commande. Prochaine étape recommandée : `/pulse:spirc US-XXX`, qui enchaîne réalisation, relecture et commit tâche par tâche ; ou, pour réaliser seulement la première tâche, `/pulse:implement US-XXX <première tâche>`.

## Exemples

- `/pulse:plan US-003` : la conception et 3 tâches présentées en quelques lignes ; après votre accord, le plan est écrit à côté de la spec.
- `/pulse:plan` sans argument : la liste des specs qui attendent leur plan, et la question « laquelle traiter ? ».
- `/pulse:plan US-005` alors que sa spec est encore en brouillon : la commande vous propose de la terminer d'abord avec `/pulse:spec US-005`.

## Références de la commande

!`pulse-aidd contexte plan`

Les références et modèles cités dans cette commande figurent dans ce contexte. Si ce contexte est absent, lancer `pulse-aidd contexte plan` et lire sa sortie.

---
description: Concevoir comment réaliser la spec d'une user story (pile, données, écrans, sécurité, fichiers), puis la découper en petites tâches ordonnées, chacune testable à l'écran (une spec = un plan, rangé à côté dans aidd_docs/tasks/<epic>/), écrit une fois validé avec vous
argument-hint: "<US-XXX [US-YYY…] | chemin de la spec>"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte plan) Bash(pulse-aidd contexte refine) Bash(pulse-aidd etape refine --sans-communes) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd guide) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd etape pr --sans-communes) Read Glob Grep Write(aidd_docs/tasks/**) Edit(aidd_docs/tasks/**) Write(docs/lexique.md) Edit(docs/lexique.md) Edit(docs/prd.md) Bash(pulse-aidd travail-fini)
---

# /pulse:plan – Le plan de réalisation

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte plan`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte plan` et lire sa sortie.

US (ou spec) à traiter : `$ARGUMENTS`

## Objectif

Produire `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`, à côté de la spec `SPEC-US-XXX-<nom>.md` : la **conception technique** (comment réaliser ce que la spec demande) et la liste ordonnée des tâches qui réalisent cette spec (**une spec = un plan**), qui sert aussi de **tableau de suivi des tâches** (`[ ]` à faire, `[~]` en cours, `[x]` terminé). Expliquer en une phrase : « On avance par petites tâches que vous pouvez tester une par une : l'IA se trompe moins, et vous gardez le contrôle. »

## Prérequis

- **La spec** : celle de l'US désignée en argument (règles « User stories, specs et plans » ci-dessus), `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`. Plusieurs US : un plan par US, traités l'un après l'autre dans l'ordre du parcours. Argument vide ou introuvable : lister les specs, en premier celles qui attendent encore leur plan (dans l'ordre du parcours), et demander laquelle traiter. Spec absente pour cette US, ou encore en brouillon (`Statut : brouillon`, ou des `TBD:` restants) : proposer `/pulse:spec US-XXX` et s'arrêter. Le plan s'appuie sur une spec **verrouillée**, qu'il lit sans la modifier. Une spec plus ancienne, sans ligne « Statut » : la traiter comme validée ; ses sections techniques (pile, stockage, fichiers) se reprennent dans la conception technique du plan.
- `docs/user-stories.md` (le référentiel : priorité de l'US, parcours) et le fichier de l'US sont nécessaires. Sinon, proposer `/pulse:us`.
- `docs/technical.md` est nécessaire (organisation des fichiers, commandes, mise en place). Sinon, proposer `/pulse:tech`.
- Si `PLAN-SPEC-US-XXX-<nom>.md` existe avec des tâches terminées : le conserver, et proposer d'ajouter ou de réordonner les tâches restantes.
- Relire les autres plans (`aidd_docs/tasks/*/PLAN-SPEC-US-*.md`) : ce qui y est déjà prévu ou fait reste dans son plan (y renvoyer), et le plus grand numéro de tâche de tous ces plans donne le premier numéro de ce plan.

## Conception technique

Avant le découpage, remplir la section « Conception technique » du modèle de plan : c'est ici que se décide le **comment** de la spec. Appliquer la règle commune 4 (les choix purement techniques suivent ce qui est déjà en place, sinon le plus simple compatible avec « Pile retenue », expliqué en une phrase) :

1. **Pile et services** : reprendre « Pile retenue » de `docs/technical.md` (y renvoyer plutôt que la recopier en détail), et les services externes de « Pile retenue » utiles à l'US (1 ou 2 au maximum pour le MVP), avec ce que chacun fait ici. Introduire un outil absent de « Pile retenue » seulement après l'avoir demandé ; si un besoin l'exige, proposer `/pulse:tech` pour revoir la pile. Un service de paiement s'intègre d'abord en **mode test** ; le passage en mode réel est une décision de la personne, prise au moment de la mise en ligne.
2. **Écrans** : pour chaque écran de la spec, son adresse et s'il est public ou réservé. Pour un écran public, la colonne « Référencement » (adresse lisible, titre, description, indexé ou non) d'après `docs/seo.md` et « Être trouvé » du PRD. Si `docs/design/maquettes/US-XXX-<nom>/retenue/` existe, la citer sur la ligne « Maquette » ; sinon, signaler en fin de commande que les écrans peuvent être maquettés avec `/pulse:ui maquettes US-XXX`. Pour chaque écran, nommer les motifs de `design/motifs.md` qu'il emploie (tableau de données, panneau latéral, notification…) ; la tâche qui réalise l'écran les reprend.
3. **Données** : pour chaque type d'information de la spec, **où il est stocké** et ses champs, selon « Données et contrôle d'accès » de `docs/technical.md` ; **où le contrôle d'accès est vérifié** (côté serveur ou dans la base ; « sans objet » si les données restent sur l'appareil d'une seule personne), pour appliquer « Qui peut » de la spec ; leurs liens (schéma `erDiagram` du modèle, s'il y a plusieurs types).
4. **Où chaque règle est vérifiée** : toute règle de sécurité ou d'intégrité est vérifiée **dans la base ou côté serveur** ; une vérification dans le navigateur vient seulement en plus.
5. **Sécurité** : les secrets utilisés (selon « Secrets et variables d'environnement »), les contrôles de formulaire côté serveur qui produisent le résultat décrit par la spec, et les points de la checklist sécurité (S1 à S13) qui s'appliquent. Une protection exigée par la checklist et absente de la spec va dans « Ajouts proposés par Pulse » avec la décision « exigé par la sécurité » : elle s'explique sans se négocier.
6. **Fichiers** : renvoyer à « Organisation des fichiers » de `docs/technical.md` et lister seulement les fichiers propres à cette US, chacun marqué « à créer » ou « à modifier » après vérification dans le projet. Présenter comme existant seulement un fichier vu dans le projet.
7. **Points d'attention** : les risques réels de cette conception (donnée partagée, règle délicate, service externe, action manuelle) et ce qu'on prévoit, rattachés à leurs tâches ; sinon « aucun identifié ».

Cette conception reste fidèle à la spec : elle réalise ses scénarios et ses « Qui peut », sans ajouter de comportement visible. Un comportement que la spec ne prévoit pas va dans « Ajouts proposés par Pulse ».

## Règles de découpage

1. **Découpage vertical** : chaque tâche livre quelque chose que l'utilisateur peut **voir et tester** en moins de 2 minutes (« Créer une tâche et la voir dans la liste »), plutôt qu'une couche technique isolée (« Écrire toutes les fonctions »).
2. **Petite** : une tâche = une partie de l'user story du plan. Si une tâche touche plus de 3 fichiers ou couvre plus de 3 critères d'acceptation, la découper.
3. **Ordre** (toutes les tâches vont sous la seule section `## Tâches` du plan) :
   - première tâche = si le squelette de la pile retenue reste à mettre en place (« Mise en place » de `docs/technical.md` l'indique « À réaliser en tâche T1 du plan », ou les fichiers qu'elle annonce sont absents) : d'abord sa mise en place, en suivant « Mise en place » (initialisation selon la documentation officielle, dans un dossier temporaire si le dossier contient déjà des fichiers, en préservant `CLAUDE.md`, `README.md` et `.gitignore` ; compléments à `.gitignore` et `.env.example`) ; puis, dans tous les cas, le **squelette visible** (l'écran principal s'affiche avec sa structure, même vide), testable avec la commande « lancer en local » de « Commandes du projet » ;
   - puis les tranches de l'US, du cas nominal vers les cas d'erreur, limites et règles d'accès ;
   - la tâche d'un écran public inclut ses métadonnées (titre, description, adresse officielle de la colonne « Référencement » de la conception technique) et son entrée dans le sitemap ;
   - enfin, **seulement** dans le plan de la **dernière US Indispensable du parcours** (`docs/user-stories.md`) : si « Être trouvé » de `docs/prd.md` répond oui, une tâche **« Fondations du référencement »** (`/pulse:seo bases` ; recette `seo` d'un pack de pile), puis la tâche **« Mettre en ligne le MVP »** · — (elle dépend de toutes les tâches des US Indispensables). Pour les autres plans, la mise en ligne se fait avec `/pulse:deploy` une fois le plan terminé.
4. **Données** : la création du stockage et de son contrôle d'accès (selon « Données et contrôle d'accès » de `docs/technical.md`) fait partie de la **première tranche qui en a besoin** (ex. « Créer une demande et la voir dans ma liste, enregistrée »), plutôt que d'une tâche « base de données » séparée.
5. **Actions manuelles** : les tâches qui demandent une action de la personne, selon la pile retenue (appliquer un schéma dans la console du fournisseur de données, créer un compte de service, saisir une variable d'environnement chez l'hébergeur, écrire une clé secrète dans le fichier local), le précisent dans une ligne `- Action manuelle : …` (le guide de réalisation la met en évidence).
6. Chaque tâche porte l'identifiant de l'US (`- [ ] **Tn – Titre** · US-XXX`) et indique : l'**objectif** du point de vue de l'utilisateur, la tâche dont elle **dépend** (dans ce plan ou dans le plan d'une autre US), les **fichiers** concernés (à créer / à modifier, repris de « Fichiers » de la conception technique), la **vérification** (le ou les critères d'acceptation à tester à la main, par identifiant d'US et numéro de critère), les **tests** automatiques (ligne `- Tests : …` : les scénarios de la spec que la tâche réalise, désignés par leur titre ou leur étiquette de critère, avec leur niveau selon la référence « Stratégie de tests » ci-dessus ; « aucun » pour une tâche sans décision à tester, comme la mise en place ou une mise en page) et, si besoin, une ligne `- Attention : …` pour un point délicat repris des « Points d'attention » du plan (une action de la personne va, elle, dans `Action manuelle`).
7. Si la conception cite une maquette, une tâche qui réalise un écran maquetté cite la maquette dans sa ligne « Vérification » (« conforme à `docs/design/maquettes/US-XXX-<nom>/retenue/` »).
8. **Autour des tâches** : la vue d'ensemble (US, epic, **priorité** reprise du référentiel : le guide de réalisation s'en sert pour ordonner les plans ; **Envoi** : « à choisir », il se décide au démarrage de la réalisation), le schéma « Ordre des tâches » (une flèche par dépendance ; seulement pour un plan de plusieurs tâches), « Avant de commencer » (comptes ou accès à obtenir), la phrase « US terminée quand : … » sous `## Tâches`, et les « Points d'attention » rattachés à leurs tâches. Ces éléments restent hors de la liste des tâches : le guide de réalisation lit seulement les lignes `- [ ] **Tn – …**` de `## Tâches` et leurs détails.
9. **En parallèle avec** : la liste des US dont le plan est encore en cours (au moins une tâche `[ ]` ou `[~]`) et qui peuvent avancer **en même temps** que celle-ci, chacune dans sa session et son worktree. Deux US sont **indépendantes** quand toutes ces conditions sont réunies :
   - chacune est libre de toute dépendance envers l'autre, directe ou par une chaîne de dépendances (« Dépend de » du référentiel, « S'appuie sur » des plans, « Dépend de » des tâches) ;
   - les fichiers de leurs tâches (lignes « Fichiers ») sont distincts, y compris les fichiers partagés que l'une modifierait (mise en page, navigation, schéma des données, configuration) ;
   - elles créent et modifient des types d'information différents (« Informations manipulées » des specs, « Données » de la conception des plans) ;
   - toutes deux sont exemptes de tâche de mise en place du squelette et de tâche « Mettre en ligne le MVP ».
   Dans le doute, les traiter comme dépendantes : un conflit de fusion coûte plus cher que le temps gagné. La relation vaut dans les deux sens : mettre à jour aussi la ligne « En parallèle avec » des plans concernés (seulement cette ligne, avec l'accord donné à l'étape 3).

## Déroulé

1. Remplir la conception technique, puis construire les tâches selon ces règles, avec le modèle de plan. Numéroter à la suite des autres plans (T1, T2… pour le premier ; Tn+1, Tn+2… si le plus grand numéro existant est Tn).
2. Compter les tâches : viser **1 à 4** pour une US (hors mise en place et mise en ligne). Au-delà, le signaler et proposer de découper l'US en deux (`/pulse:us`, puis une spec et un plan pour chacune).
3. **Montrer, puis faire valider.** Présenter la conception technique en 5 lignes au plus (pile et services, stockage et contrôle d'accès, secrets, points de sécurité, fichiers principaux), puis la liste résumée des tâches (titres), avec la ligne « En parallèle avec » et, si d'autres plans sont mis à jour en conséquence, lesquels. **Ajouts proposés par Pulse** : un élément absent de la spec et de « Pile retenue » (bibliothèque, écran, règle, réglage), ou exigé par la checklist sécurité, se présente aussi, et se valide avec le plan. Avant la question, écrire `aidd_docs/tasks/in-progress.md` (règle commune 16 : le plan présenté y est résumé, il n'est pas encore écrit) ; l'effacer avec `pulse-aidd travail-fini` une fois le plan validé. Demander (AskUserQuestion) : « Valider le plan (Recommandé) » / « Je veux changer quelque chose ». Si la personne veut des changements : les appliquer au plan présenté en respectant les règles ci-dessus, montrer ce qui change, puis redemander. Un changement de périmètre (une fonctionnalité en plus) se note « En attente » dans `docs/prd.md` ; il se traitera avec `/pulse:refine` une fois le plan écrit.
4. Plan validé. Écrire `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md` (section « Ajouts proposés par Pulse » seulement s'il y en a), avec la ligne « plan validé » dans son journal (règles communes § 7), et les lignes « En parallèle avec » des autres plans concernés.
5. Lancer `pulse-aidd guide` : il produit le guide de réalisation `docs/guide/` (les commandes à copier, tâche par tâche). Le présenter en une phrase : « Votre carnet de route est dans `docs/guide/index.md` ; il se met à jour tout seul. »

Terminer avec le bloc de fin de commande. Prochaine étape recommandée : `/pulse:spirc US-XXX`, qui enchaîne réalisation, relecture et commit tâche par tâche ; ou, pour réaliser seulement la première tâche, `/pulse:implement US-XXX <première tâche>`.

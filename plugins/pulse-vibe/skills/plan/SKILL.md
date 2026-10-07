---
description: Découper la spec d'une user story en petites tâches ordonnées (une spec = un plan, rangé à côté dans aidd_docs/tasks/<epic>/ ; découpage vertical, kanban)
argument-hint: "<US-XXX [US-YYY…] | chemin de la spec>"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *)
---

# /pulse:plan – Le plan de réalisation

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte plan`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte plan` et lire sa sortie.

US (ou spec) à traiter : `$ARGUMENTS`

## Objectif

Produire `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`, à côté de la spec `SPEC-US-XXX-<nom>.md` : la liste ordonnée des tâches qui réalisent cette spec (**une spec = un plan**), qui sert aussi de **tableau kanban** (`[ ]` à faire, `[~]` en cours, `[x]` terminé). Expliquer en une phrase : « On avance par petites tâches que vous pouvez tester une par une : l'IA se trompe moins, et vous gardez le contrôle. »

## Prérequis

- **La spec** : celle de l'US désignée en argument (règles « User stories, specs et plans » ci-dessus), `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`. Plusieurs US : un plan par US, traités l'un après l'autre dans l'ordre du parcours. Argument vide ou introuvable : lister les specs, en premier celles qui attendent encore leur plan (dans l'ordre du parcours), et demander laquelle traiter. Spec absente pour cette US : proposer `/pulse:spec US-XXX`.
- `docs/user-stories.md` (le référentiel : priorité de l'US, parcours) et le fichier de l'US sont nécessaires. Sinon, proposer `/pulse:us`.
- `docs/technical.md` est nécessaire (organisation des fichiers, commandes, mise en place). Sinon, proposer `/pulse:tech`.
- Si `PLAN-SPEC-US-XXX-<nom>.md` existe avec des tâches terminées : le conserver, et proposer d'ajouter ou de réordonner les tâches restantes.
- Relire les autres plans (`aidd_docs/tasks/*/PLAN-SPEC-US-*.md`) : ce qui y est déjà prévu ou fait reste dans son plan (y renvoyer), et le plus grand numéro de tâche de tous ces plans donne le premier numéro de ce plan.

## Règles de découpage

1. **Découpage vertical** : chaque tâche livre quelque chose que l'utilisateur peut **voir et tester** en moins de 2 minutes (« Créer une tâche et la voir dans la liste »), plutôt qu'une couche technique isolée (« Écrire toutes les fonctions »).
2. **Petite** : une tâche = une partie de l'user story du plan. Si une tâche touche plus de 3 fichiers ou couvre plus de 3 critères d'acceptation, la découper.
3. **Ordre** (toutes les tâches vont sous la seule section `## Tâches` du plan) :
   - première tâche = si le squelette de la pile retenue reste à mettre en place (« Mise en place » de `docs/technical.md` l'indique « À réaliser en tâche T1 du plan », ou les fichiers qu'elle annonce sont absents) : d'abord sa mise en place, en suivant « Mise en place » (initialisation selon la documentation officielle, dans un dossier temporaire si le dossier contient déjà des fichiers, en préservant `CLAUDE.md`, `README.md` et `.gitignore` ; compléments à `.gitignore` et `.env.example`) ; puis, dans tous les cas, le **squelette visible** (l'écran principal s'affiche avec sa structure, même vide), testable avec la commande « lancer en local » de « Commandes du projet » ;
   - puis les tranches de l'US, du cas nominal vers les cas d'erreur, limites et règles d'accès ;
   - la tâche d'un écran public inclut ses métadonnées (titre, description, adresse officielle de la ligne « Référencement » de la spec) et son entrée dans le sitemap ;
   - enfin, **seulement** dans le plan de la **dernière US Indispensable du parcours** (`docs/user-stories.md`) : si « Être trouvé » de `docs/prd.md` répond oui, une tâche **« Fondations du référencement »** (`/pulse:seo bases` ; recette `seo` d'un pack de pile), puis la tâche **« Mettre en ligne le MVP »** · — (elle dépend de toutes les tâches des US Indispensables). Pour les autres plans, la mise en ligne se fait avec `/pulse:deploy` une fois le plan terminé.
4. **Données** : la création du stockage et de son contrôle d'accès (selon « Données et contrôle d'accès » de `docs/technical.md`) fait partie de la **première tranche qui en a besoin** (ex. « Créer une demande et la voir dans ma liste, enregistrée »), plutôt que d'une tâche « base de données » séparée.
5. **Actions manuelles** : les tâches qui demandent une action de la personne, selon la pile retenue (appliquer un schéma dans la console du fournisseur de données, créer un compte de service, saisir une variable d'environnement chez l'hébergeur, écrire une clé secrète dans le fichier local), le précisent dans une ligne `- Action manuelle : …` (le guide de réalisation la met en évidence).
6. Chaque tâche porte l'identifiant de l'US (`- [ ] **Tn – Titre** · US-XXX`) et indique : l'**objectif** du point de vue de l'utilisateur, la tâche dont elle **dépend** (dans ce plan ou dans le plan d'une autre US), les **fichiers** concernés (à créer / à modifier, repris de la section « Fichiers » de la spec), la **vérification** (le ou les critères d'acceptation à tester à la main, par identifiant d'US et numéro de critère), les **tests** automatiques (ligne `- Tests : …` : les scénarios de la spec que la tâche réalise, désignés par leur titre ou leur étiquette de critère, avec leur niveau selon la référence « Stratégie de tests » ci-dessus ; « aucun » pour une tâche sans décision à tester, comme la mise en place ou une mise en page) et, si besoin, une ligne `- Attention : …` pour un point délicat repris des « Points d'attention » de la spec (une action de la personne va, elle, dans `Action manuelle`).
7. Si la spec cite une maquette, une tâche qui réalise un écran maquetté cite la maquette dans sa ligne « Vérification » (« conforme à `docs/design/maquettes/US-XXX-<nom>/retenue/` »).
8. **Autour des tâches** : la vue d'ensemble (US, epic, **priorité** reprise du référentiel : le guide de réalisation s'en sert pour ordonner les plans ; **Envoi** : « à choisir », il se décide au démarrage de la réalisation), le schéma « Ordre des tâches » (une flèche par dépendance ; seulement pour un plan de plusieurs tâches), « Avant de commencer » (questions ouvertes de la spec, comptes ou accès à obtenir), la phrase « US terminée quand : … » sous `## Tâches`, et les « Points d'attention » rattachés à leurs tâches. Ces éléments restent hors de la liste des tâches : le guide de réalisation lit seulement les lignes `- [ ] **Tn – …**` de `## Tâches` et leurs détails.
9. **En parallèle avec** : la liste des US dont le plan est encore en cours (au moins une tâche `[ ]` ou `[~]`) et qui peuvent avancer **en même temps** que celle-ci, chacune dans sa session et son worktree. Deux US sont **indépendantes** quand toutes ces conditions sont réunies :
   - chacune est libre de toute dépendance envers l'autre, directe ou par une chaîne de dépendances (« Dépend de » du référentiel, « S'appuie sur » des plans, « Dépend de » des tâches) ;
   - les fichiers de leurs tâches (lignes « Fichiers ») sont distincts, y compris les fichiers partagés que l'une modifierait (mise en page, navigation, schéma des données, configuration) ;
   - elles créent et modifient des types d'information différents (section « Données » des specs) ;
   - toutes deux sont exemptes de tâche de mise en place du squelette et de tâche « Mettre en ligne le MVP ».
   Dans le doute, les traiter comme dépendantes : un conflit de fusion coûte plus cher que le temps gagné. La relation vaut dans les deux sens : mettre à jour aussi la ligne « En parallèle avec » des plans concernés (seulement cette ligne, avec l'accord donné à l'étape 4).

## Déroulé

1. Construire le plan selon ces règles, avec le modèle de plan. Numéroter à la suite des autres plans (T1, T2… pour le premier ; Tn+1, Tn+2… si le plus grand numéro existant est Tn).
2. Compter les tâches : viser **1 à 4** pour une US (hors mise en place et mise en ligne). Au-delà, le signaler et proposer de découper l'US en deux (`/pulse:us`, puis une spec et un plan pour chacune).
3. Écrire `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`. **Ajouts proposés par Pulse** : une tâche qui introduit un élément absent de la spec (bibliothèque, écran, règle, réglage) le signale dans la section « Ajouts proposés par Pulse » du plan, validée avec le plan. Sinon, supprimer cette section.
4. Présenter le plan sous forme de kanban résumé (titres seulement), avec la ligne « En parallèle avec » et, si d'autres plans sont mis à jour en conséquence, lesquels ; demander validation. Si la personne veut des changements : appliquer l'étape **refine** (`pulse-aidd etape refine`) avec ses remarques.
5. Lancer `pulse-aidd guide` : il produit le guide de réalisation `docs/guide/` (les commandes à copier, tâche par tâche). Le présenter en une phrase : « Votre carnet de route est dans `docs/guide/index.md` ; il se met à jour tout seul. »

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:implement US-XXX <première tâche>` pour réaliser la première tâche, ou `/pulse:spirc US-XXX` pour enchaîner réalisation, relecture et commit tâche par tâche.

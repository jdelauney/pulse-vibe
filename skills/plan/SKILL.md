---
description: Découper une spec en petites tâches ordonnées (découpage vertical, kanban)
argument-hint: "<spec : nom ou chemin dans docs/specs/>"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *)
---

# /pulse:plan – Le plan de réalisation

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte plan`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte plan` et lire sa sortie.

Spec à traiter : `$ARGUMENTS`

## Objectif

Produire `docs/plans/<nom>.md` (même nom que la spec) : la liste ordonnée des tâches qui réalisent cette spec, qui sert aussi de **tableau kanban** (`[ ]` à faire, `[~]` en cours, `[x]` terminé). Expliquer en une phrase : « On avance par petites tâches que vous pouvez tester une par une : l'IA se trompe moins, et vous gardez le contrôle. »

## Prérequis

- **La spec** : celle désignée en argument, dans `docs/specs/` (règles « Specs et plans » ci-dessus). Argument vide ou introuvable : lister les specs, en premier celles qui n'ont pas encore de plan, et demander laquelle traiter. Aucune spec : proposer `/pulse:spec`.
- `docs/user-stories.md` est nécessaire. Sinon, proposer `/pulse:us`.
- `docs/technical.md` est nécessaire (organisation des fichiers, commandes, mise en place). Sinon, proposer `/pulse:tech`.
- Si `docs/plans/<nom>.md` existe avec des tâches terminées : ne pas le remplacer. Proposer d'ajouter ou de réordonner les tâches restantes.
- Relire les autres plans de `docs/plans/` : ce qui y est déjà prévu ou fait ne se replanifie pas (y renvoyer), et le plus grand numéro de tâche donne le premier numéro de ce plan.

## Règles de découpage

1. **Découpage vertical** : chaque tâche livre quelque chose que l'utilisateur peut **voir et tester** en moins de 2 minutes (« Créer une tâche et la voir dans la liste »), et non une couche technique isolée (« Écrire toutes les fonctions »).
2. **Petite** : une tâche = une user story ou une partie d'une user story. Si une tâche touche plus de 3 fichiers ou couvre plus de 3 critères d'acceptation, la découper.
3. **Ordre** (les jalons et la tâche de mise en ligne ne valent que pour le **premier plan**, celui du MVP ; un plan suivant n'a qu'un jalon, « Jalon 1 – <titre de la spec> », et sa mise en ligne se fait avec `/pulse:deploy` une fois le plan terminé) :
   - première tâche = si le squelette de la pile retenue n'est pas encore en place (« Mise en place » de `docs/technical.md` l'indique « À réaliser en tâche T1 du plan », ou les fichiers qu'elle annonce sont absents) : d'abord sa mise en place, en suivant « Mise en place » (initialisation selon la documentation officielle, dans un dossier temporaire si le dossier n'est pas vide, sans écraser `CLAUDE.md`, `README.md` ni `.gitignore` ; compléments à `.gitignore` et `.env.example`) ; puis, dans tous les cas, le **squelette visible** (l'écran principal s'affiche avec sa structure, même vide), testable avec la commande « lancer en local » de « Commandes du projet » ;
   - puis les US **Indispensables**, dans l'ordre du parcours utilisateur ;
   - puis la tâche **« Mettre en ligne le MVP »** (elle clôt le jalon 1) ;
   - puis les **Essentielles** (jalon 2), puis les **Optionnelles** (jalon 3).
4. **Données** : la création du stockage et de son contrôle d'accès (selon « Données et contrôle d'accès » de `docs/technical.md`) fait partie de la **première tranche qui en a besoin** (ex. « Créer une demande et la voir dans ma liste, enregistrée »), pas d'une tâche « base de données » séparée.
5. **Actions manuelles** : les tâches qui demandent une action de la personne, selon la pile retenue (appliquer un schéma dans la console du fournisseur de données, créer un compte de service, saisir une variable d'environnement chez l'hébergeur, écrire une clé secrète dans le fichier local), le précisent dans une ligne `- Action manuelle : …` (le guide de réalisation la met en évidence).
6. Chaque tâche indique : l'**objectif** du point de vue de l'utilisateur, la tâche dont elle **dépend**, les **fichiers** concernés (à créer / à modifier, repris de la section « Fichiers » de la spec), la **vérification** (le ou les critères d'acceptation à tester à la main, par identifiant d'US et numéro de critère) et, si besoin, une ligne `- Attention : …` pour un point délicat repris des « Points d'attention » de la spec (jamais pour une action de la personne : elle va dans `Action manuelle`).
7. Si la spec cite une maquette, une tâche qui réalise un écran maquetté cite la maquette dans sa ligne « Vérification » (« conforme à `docs/design/maquettes/<nom>/retenue/` »).
8. **Autour des tâches** : la vue d'ensemble, le schéma « Ordre des tâches » (une flèche par dépendance ; un plan d'une seule tâche n'en a pas), « Avant de commencer » (questions ouvertes de la spec, comptes ou accès à obtenir), la phrase « Jalon terminé quand : … » sous chaque titre de jalon, et les « Points d'attention » rattachés à leurs tâches. Ces éléments restent hors des listes de tâches : le guide de réalisation ne lit que les lignes `- [ ] **Tn – …**` et leurs détails.

## Déroulé

1. Construire le plan selon ces règles, avec le modèle de plan. Numéroter à la suite des autres plans (T1, T2… pour le premier ; Tn+1, Tn+2… si le plus grand numéro existant est Tn).
2. Compter les tâches du jalon 1. Pour un MVP d'une journée, viser **4 à 8 tâches** ; pour une US seule, **1 à 4**. Au-delà, le signaler et proposer de déplacer des tâches au jalon 2 (MVP) ou de découper la spec.
3. Écrire `docs/plans/<nom>.md`.
4. Présenter le plan sous forme de kanban résumé (titres seulement), demander validation. Si la personne veut des changements : appliquer l'étape **refine** (`pulse-aidd etape refine`) avec ses remarques.
5. Lancer `pulse-aidd guide` : il produit le guide de réalisation `docs/guide/` (les commandes à copier, tâche par tâche). Le présenter en une phrase : « Votre carnet de route est dans `docs/guide/index.md` ; il se met à jour tout seul. »

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:implement <nom> <première tâche>` pour réaliser la première tâche, ou `/pulse:spirc <nom>` pour enchaîner réalisation, relecture et commit tâche par tâche.

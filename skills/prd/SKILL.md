---
description: Produire le PRD - besoin, objectifs et périmètre du MVP priorisé avec MoSCoW
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *)
---

# /pulse:prd – Le besoin produit et le périmètre du MVP

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte prd`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte prd` et lire sa sortie.

## Objectif

Produire `docs/prd.md` : ce que l'outil doit faire, pour qui, et surtout **ce qui entre dans la première version (le MVP)** grâce à la priorisation MoSCoW.

Rappeler en une phrase : « Le MVP est la plus petite version réellement utilisable. On vise petit et fini, plutôt que grand et inachevé. »

## Prérequis

- `docs/brief.md` est nécessaire. S'il manque, proposer `/pulse:brainstorm`. Si la personne veut aller vite, proposer un **mode express** : 3 questions (l'idée et les utilisateurs ; le problème actuel ; les 5 choses que l'outil doit permettre), puis continuer.
- Si `docs/prd.md` existe : demander s'il faut le compléter ou le refaire.

## Déroulé

### 1. Lister les fonctionnalités

À partir de l'histoire du brief, dresser la liste des fonctionnalités, chacune en une phrase du point de vue de l'utilisateur (« Créer une tâche avec un titre », « Filtrer les tâches terminées »).

### 2. Prioriser avec MoSCoW (le cœur de l'étape)

Expliquer les 4 catégories en une ligne chacune :
- **Indispensable** (Must) : sans ça, l'outil ne sert à rien → c'est le MVP.
- **Essentiel** (Should) : vraie valeur ajoutée, juste après le MVP.
- **Optionnel** (Could) : la cerise sur le gâteau.
- **En attente** (Won't, cette fois) : bonne idée, mais pas maintenant.

Proposer un classement, puis le faire valider par la personne (AskUserQuestion, par exemple une question à choix multiples « Lesquelles sont vraiment indispensables ? »). C'est **sa** décision.

**Garde-fou de taille** : si plus de 5 ou 6 fonctionnalités sont « Indispensables » pour un MVP à réaliser en une journée, dites-le franchement et proposer lesquelles passer en « Essentiel ». Poser la question test : « Si cette fonctionnalité manquait, l'outil serait-il quand même utile ? »

### 3. Compléter le reste du PRD

Rédiger, en vous appuyant sur le brief, et sans demander ce qui peut se déduire :
- la vision (2-3 phrases) et le problème principal ;
- le tableau des utilisateurs ;
- 1 à 3 **objectifs mesurables** (les proposer, faire valider) ;
- la phrase « Le MVP est atteint quand… », vérifiable ;
- les contraintes (données personnelles, budget, délai, appareils) ;
- le hors périmètre (ce que l'outil ne fera pas) ;
- les risques et questions ouvertes.

### 4. Écrire et valider

Écrire `docs/prd.md` à partir du modèle `docs/prd.md`. Montrer le tableau MoSCoW et la définition du MVP, demander validation.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:tech` pour choisir les outils adaptés au besoin (puis, facultatif, `/pulse:ui identite`, et `/pulse:us`), ou `/pulse:spirc` pour enchaîner choix techniques, user stories, spec, plan et réalisation avec des points de validation.

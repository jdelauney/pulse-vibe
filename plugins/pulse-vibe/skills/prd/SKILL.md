---
description: Produire le PRD - le besoin, les objectifs et le périmètre du MVP, décidés avec vous : ce qui est indispensable, ce qui peut attendre
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte prd) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd travail-fini) Read Glob Grep Write(docs/prd.md) Edit(docs/prd.md) Write(aidd_docs/tasks/in-progress.md) Edit(aidd_docs/tasks/in-progress.md) Write(docs/lexique.md) Edit(docs/lexique.md)
---

# /pulse:prd – Le besoin produit et le périmètre du MVP

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte prd`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte prd` et lire sa sortie.

## Objectif

Produire `docs/prd.md` : ce que l'outil doit faire, pour qui, et surtout **ce qui entre dans la première version (le MVP)** grâce à la priorisation MoSCoW.

Rappeler en une phrase : « Le MVP est la plus petite version réellement utilisable. On vise petit et fini, plutôt que grand et inachevé. »

## Prérequis

- `docs/brief.md` est nécessaire. S'il manque, proposer `/pulse:brainstorm`. Si la personne veut aller vite, proposer un **mode express** : 3 questions clés (l'idée et les utilisateurs ; le problème actuel ; les 5 choses que l'outil doit permettre), posées une à une avec des exemples, puis continuer.
- Si `docs/prd.md` existe : demander s'il faut le compléter ou le refaire.

## Déroulé

Appliquer « Penser avant d'écrire » ci-dessus : la coupe du MVP et la définition « Le MVP est atteint quand… » sont des **questions clés** ; les objectifs mesurables, les contraintes et le hors périmètre se proposent par questions à choix.

### 1. Lister les fonctionnalités

À partir de l'histoire du brief, dresser la liste des fonctionnalités, chacune en une phrase du point de vue de l'utilisateur (« Créer une tâche avec un titre », « Filtrer les tâches terminées »).

### 2. Prioriser avec MoSCoW (le cœur de l'étape)

Expliquer les 4 catégories en une ligne chacune :
- **Indispensable** (Must) : l'outil en a besoin pour être utile → c'est le MVP.
- **Essentiel** (Should) : vraie valeur ajoutée, juste après le MVP.
- **Optionnel** (Could) : la cerise sur le gâteau.
- **En attente** (Won't, cette fois) : bonne idée, pour plus tard.

**La personne fait la première coupe** (question clé) : « Si vous ne pouviez livrer que 3 choses dans quinze jours, lesquelles ? », avec des exemples d'autres métiers. Puis **confronter** sa coupe à la liste et au brief :
- un **oubli bloquant** : une fonctionnalité sans laquelle sa coupe ne fonctionne pas (« sans "se connecter", "voir mes réservations" ne marche pas ») ;
- un **Indispensable** qui ne l'est peut-être pas (question test ci-dessous) ;
- une fonctionnalité du brief absente de la liste.

Construire ensuite le classement complet à partir de sa coupe, le montrer avec la colonne « Origine » (vous / Pulse), et le faire valider (AskUserQuestion). C'est **sa** décision.

**Garde-fou de taille** : si plus de 5 ou 6 fonctionnalités sont « Indispensables » pour un MVP à réaliser en une journée, dites-le franchement et proposer lesquelles passer en « Essentiel ». Poser la question test : « Si cette fonctionnalité manquait, l'outil serait-il quand même utile ? »

**Travail en cours** : tant que la coupe du MVP ou la définition « Le MVP est atteint quand… » attend la personne, tenir `aidd_docs/tasks/in-progress.md` à jour (règle commune 16). L'effacer (`pulse-aidd travail-fini`) après l'écriture de `docs/prd.md`.

### 3. Compléter le reste du PRD

Rédiger, en vous appuyant sur le brief, et en déduisant tout ce qui peut l'être (demander seulement le reste) :
- la vision (2-3 phrases) et le problème principal ;
- le tableau des utilisateurs ;
- 1 à 3 **objectifs mesurables** (les proposer, faire valider) ;
- la phrase « Le MVP est atteint quand… » : **question clé**, formulée d'abord par la personne, puis rendue vérifiable avec elle (un constat observable, daté si possible) ;
- les contraintes (données personnelles, budget, délai, appareils) ;
- **être trouvé** (question à choix) : « Votre outil doit-il être trouvé sur Google ou par les assistants IA ? Par qui, avec quels mots ? » ; un outil interne répond « non » (le référencement se limitera alors à rester hors de Google) ;
- le hors périmètre (ce qui reste en dehors de l'outil) ;
- les risques et questions ouvertes ;
- les **hypothèses à vérifier**, reprises du brief et complétées.

### 4. Écrire et valider

Écrire `docs/prd.md` à partir du modèle `docs/prd.md`. Montrer le tableau MoSCoW et la définition du MVP, demander validation.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:tech` pour choisir les outils adaptés au besoin (puis, facultatif, `/pulse:ui identite`, et `/pulse:us`), ou `/pulse:spirc` pour enchaîner choix techniques, user stories, spec, plan et réalisation avec des points de validation.

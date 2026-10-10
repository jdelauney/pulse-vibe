---
description: Produire le guide de réalisation pas à pas (docs/guide/) à partir du plan - pour chaque tâche, dans l'ordre, les commandes à copier-coller, ce qu'il faut vérifier et les actions manuelles
argument-hint: "[expliquer] (facultatif : présenter le guide pas à pas)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte guide) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd guide) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Read Glob Grep Bash(git status *) Edit(aidd_docs/tasks/**)
---

# /pulse:guide – Le guide de réalisation

## Objectif

Donner à la personne une **feuille de route** qu'elle suit seule, dans l'ordre :

- `docs/guide/index.md` : où en est le projet, la prochaine commande à lancer, les étapes avant le plan, les plans par epic et l'avancement du MVP, quoi faire en cas de blocage ;
- `docs/guide/<epic>/US-XXX-<nom>.md` (une page par plan) : pour chaque tâche, les commandes à copier-coller (🔵 obligatoires, ⚪ facultatives), les actions manuelles et prérequis (⚠️), ce qu'il faudra vérifier.

Phrase à dire : « Ce guide est votre carnet de route : chaque ligne est une commande à copier dans Claude Code. Il se met à jour tout seul chaque fois que le plan change. »

## Règles

Appliquer les « Règles communes Pulse » (chargées dans « Contexte ») pendant toute la commande.

### Principes

- **Le plan est la seule source** : le guide est produit par un script à partir des plans de `aidd_docs/tasks/<epic>/`, entièrement, à chaque fois. Il reprend exactement les tâches et les statuts du plan.
- **Mise à jour automatique** : un hook du plugin régénère le guide dès qu'un plan de `aidd_docs/tasks/` est modifié (par `/pulse:plan`, `/pulse:commit`, `/pulse:refine`…), en silence.
- **Lecture seule** sur le plan, les documents et le code ; écriture uniquement dans `docs/guide/`.
- **La personne lance elle-même chaque commande** : le guide se copie-colle.

## Contexte

!`pulse-aidd contexte guide`

Si ce contexte est absent, lancer `pulse-aidd contexte guide` et lire sa sortie.

Argument : `$ARGUMENTS`

### Prérequis

- Au moins un plan dans `aidd_docs/tasks/` est nécessaire. Sinon, proposer `/pulse:plan` (ou `/pulse:init` pour retrouver la bonne étape).

## Processus

1. Lancer `pulse-aidd guide`.
   - **Plan absent ou non reconnu** : la sortie l'explique. Vérifier dans le plan signalé que les tâches suivent le format du modèle (`- [ ] **Tn – Titre** · US-XXX` sous `## Tâches`, et la ligne « **Priorité** : … » dans la vue d'ensemble) ; sinon, proposer de remettre le plan au format (avec accord, en gardant intact le contenu des tâches), puis relancer.
2. Lire `docs/guide/index.md` et la page du plan en cours.
3. **Contrôler la cohérence** avec le projet, en lecture seule :
   - une tâche `[~]` sans modification en cours (`git status`) ou une tâche `[ ]` déjà réalisée dans le code : le signaler, et proposer `/pulse:refine` pour corriger le plan ;
   - une action manuelle qui manque probablement dans le plan (ex. appliquer un schéma dans la console du fournisseur de données, saisir une variable d'environnement chez l'hébergeur, selon `docs/technical.md`) : la signaler de la même façon.
4. **Présenter** en quelques lignes : la progression (première version, US en cours, tâches terminées), la **prochaine commande à copier**, et les éventuelles actions manuelles à prévoir.
5. Avec l'argument `expliquer` : parcourir avec la personne la page du plan en cours, une tâche à la fois : ce que fait chaque commande, et pourquoi cet ordre (réaliser → relire et tester → enregistrer).

Terminer avec le bloc de fin de commande. Prochaine étape : la commande indiquée dans « Où en êtes-vous ? » du guide.

## Exemples

- `/pulse:guide` : le guide est mis à jour à partir du plan, puis vous voyez où en est le projet et la prochaine commande à copier.
- `/pulse:guide expliquer` : la page du plan en cours, parcourue avec vous une tâche à la fois, avec le rôle de chaque commande.

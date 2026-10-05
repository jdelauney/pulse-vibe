---
description: Produire le guide de réalisation pas à pas (docs/guide/) à partir du plan - pour chaque tâche, dans l'ordre, les commandes à copier-coller, ce qu'il faut vérifier et les actions manuelles
argument-hint: "[expliquer] (facultatif : présenter le guide pas à pas)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Read Glob Grep
---

# /pulse:guide – Le guide de réalisation

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte guide`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Si ce contexte est absent, lancer `pulse-aidd contexte guide` et lire sa sortie.

Argument : `$ARGUMENTS`

## Objectif

Donner à la personne une **feuille de route** qu'elle suit seule, dans l'ordre :

- `docs/guide/index.md` : où en est le projet, la prochaine commande à lancer, les étapes avant le plan, les plans et leurs jalons, quoi faire en cas de blocage ;
- `docs/guide/<plan>/jalon-NN-<nom>.md` : pour chaque tâche, les commandes à copier-coller (🔵 obligatoires, ⚪ facultatives), les actions manuelles et prérequis (⚠️), ce qu'il faudra vérifier.

Phrase à dire : « Ce guide est votre carnet de route : chaque ligne est une commande à copier dans Claude Code. Il se met à jour tout seul chaque fois que le plan change. »

## Principes

- **Le plan est la seule source** : le guide est produit par un script à partir des plans de `docs/plans/`, entièrement, à chaque fois. Il n'ajoute ni ne retire aucune tâche, et ses statuts sont ceux du plan.
- **Mise à jour automatique** : un hook du plugin régénère le guide dès qu'un plan de `docs/plans/` est modifié (par `/pulse:plan`, `/pulse:commit`, `/pulse:refine`…), sans rien afficher.
- **Lecture seule** sur le plan, les documents et le code ; écriture uniquement dans `docs/guide/`.
- **Rien n'est exécuté à la place de la personne** : le guide se copie-colle, il ne se lance pas tout seul.

## Prérequis

- Au moins un plan dans `docs/plans/` est nécessaire. Sinon, proposer `/pulse:plan` (ou `/pulse:init` pour retrouver la bonne étape).

## Déroulé

1. Lancer `pulse-aidd guide`.
   - **Plan absent ou non reconnu** : la sortie l'explique. Vérifier dans le plan signalé que les tâches suivent le format du modèle (`- [ ] **Tn – Titre** · <US>` sous `## Jalon 1 – …`) ; si ce n'est pas le cas, proposer de remettre le plan au format (avec accord, sans changer le contenu des tâches), puis relancer.
2. Lire `docs/guide/index.md` et le fichier du jalon en cours du plan en cours.
3. **Contrôler la cohérence** avec le projet, sans rien modifier :
   - une tâche `[~]` sans modification en cours (`git status`) ou une tâche `[ ]` déjà réalisée dans le code : le signaler, et proposer `/pulse:refine` pour corriger le plan ;
   - une action manuelle qui manque probablement dans le plan (ex. appliquer un schéma dans la console du fournisseur de données, saisir une variable d'environnement chez l'hébergeur, selon `docs/technical.md`) : la signaler de la même façon.
4. **Présenter** en quelques lignes : la progression (jalon en cours, tâches terminées), la **prochaine commande à copier**, et les éventuelles actions manuelles à prévoir.
5. Avec l'argument `expliquer` : parcourir avec la personne le fichier du jalon en cours, une tâche à la fois : ce que fait chaque commande, et pourquoi cet ordre (réaliser → relire et tester → enregistrer).

Terminer avec le bloc de fin de commande. Prochaine étape : la commande indiquée dans « Où en êtes-vous ? » du guide.

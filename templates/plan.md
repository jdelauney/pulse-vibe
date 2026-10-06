# Plan – {{NOM_DU_PROJET}} – US-{{XXX}} {{Titre court}}

> Produit par `/pulse:plan` le {{DATE}} à partir de `SPEC-US-{{XXX}}-{{nom}}.md` (même dossier).
> Un plan par spec, donc par user story. Numéros de tâche uniques dans tout le projet : ce plan reprend après le plus grand `Tn` des autres plans de `aidd_docs/tasks/`.
> La tâche « Mettre en ligne le MVP » figure uniquement dans le plan de la **dernière US Indispensable du parcours** (`docs/user-stories.md`).
> Statuts : `[ ]` à faire · `[~]` en cours · `[x]` terminé. C'est notre tableau **kanban**.
> Chaque tâche est petite (une seule chose visible à tester) et livre de la valeur (découpage vertical).

## Vue d'ensemble

- **US** : US-{{XXX}} – {{titre}} · **Epic** : {{Titre de l'epic}} · **Priorité** : {{Indispensable | Essentiel | Optionnel}}
- **Tâches** : {{nombre}} ({{Tn}} à {{Tm}})
- **S'appuie sur** : {{plans d'autres US dont des tâches doivent être terminées avant (US-XXX), ou « aucun »}}
- **Envoi** : à choisir (au premier commit, s'il existe un dépôt distant : PR, branche principale ou local)
- **En parallèle avec** : {{US-YYY, US-ZZZ (US non terminées qui peuvent avancer en même temps, dans une autre session et un worktree), ou « aucune »}}

## Ordre des tâches

```mermaid
flowchart LR
    T1[{{T1 – titre court}}] --> T2[{{T2 – titre court}}]
```

## Avant de commencer

- {{Questions à trancher, comptes à créer, accès à obtenir ; ou « rien »}}

## Tâches

> US terminée quand : {{ce que l'utilisateur peut faire de bout en bout}}.

- [ ] **T1 – {{Titre}}** · US-{{XXX}}
  - Objectif : {{ce que l'utilisateur pourra faire à la fin de la tâche}}
  - Dépend de : {{Tn, ou « — »}}
  - Fichiers : {{à créer : … · à modifier : …}}
  - Vérification : US-{{XXX}} critère {{n}} – {{ce qu'on fait et ce qu'on doit voir}}
  - Attention : {{point délicat de la tâche (cas limite, donnée partagée, règle d'accès) ; sinon supprimer cette ligne}}
  - Action manuelle : {{seulement si la personne doit agir elle-même, ex. appliquer un schéma dans la console du fournisseur, saisir une variable chez l'hébergeur ; sinon supprimer cette ligne}}

<!-- Tâche suivante : seulement dans le plan de la dernière US Indispensable du parcours ; sinon la supprimer, avec ce commentaire. -->
- [ ] **T2 – Mettre en ligne le MVP** · —
  - Objectif : l'outil est accessible à une adresse publique
  - Dépend de : toutes les tâches des US Indispensables
  - Vérification : l'adresse s'ouvre sur un téléphone et le parcours principal fonctionne

## Points d'attention

| Risque | Tâche | Ce qu'on prévoit |
|---|---|---|
| {{ou « aucun identifié »}} | | |

## Journal

| Date | Tâche | Commit | Remarque (écart, limite connue, idée pour plus tard) |
|---|---|---|---|

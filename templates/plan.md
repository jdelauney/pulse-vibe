# Plan – {{NOM_DU_PROJET}} – {{titre de la spec}}

> Produit par `/pulse:plan` le {{DATE}} à partir de `docs/specs/{{NOM}}.md`.
> Numéros de tâche uniques dans tout le projet : ce plan reprend après le plus grand `Tn` des autres plans.
> Le premier plan (MVP) a trois jalons et la tâche « Mettre en ligne le MVP » ; un plan suivant n'a qu'un jalon, « Jalon 1 – {{titre de la spec}} ».
> Statuts : `[ ]` à faire · `[~]` en cours · `[x]` terminé. C'est notre tableau **kanban**.
> Chaque tâche est petite (une seule chose visible à tester) et livre de la valeur (découpage vertical).

## Vue d'ensemble

- **US couvertes** : {{ID des US}}
- **Tâches** : {{nombre}} ({{Tn}} à {{Tm}})
- **S'appuie sur** : {{plans dont des tâches doivent être terminées avant, ou « aucun »}}

## Ordre des tâches

```mermaid
flowchart LR
    T1[{{T1 – titre court}}] --> T2[{{T2 – titre court}}]
```

## Avant de commencer

- {{Questions à trancher, comptes à créer, accès à obtenir ; ou « rien »}}

## Jalon 1 – MVP (toutes les US « Indispensables »)

> Jalon terminé quand : {{ce que l'utilisateur peut faire de bout en bout}}.

- [ ] **T1 – {{Titre}}** · {{ID d'US}}
  - Objectif : {{ce que l'utilisateur pourra faire à la fin de la tâche}}
  - Dépend de : {{Tn, ou « — »}}
  - Fichiers : {{à créer : … · à modifier : …}}
  - Vérification : {{ID d'US}} critère {{n}} – {{ce qu'on fait et ce qu'on doit voir}}
  - Attention : {{point délicat de la tâche (cas limite, donnée partagée, règle d'accès) ; sinon supprimer cette ligne}}
  - Action manuelle : {{seulement si la personne doit agir elle-même, ex. appliquer un schéma dans la console du fournisseur, saisir une variable chez l'hébergeur ; sinon supprimer cette ligne}}

- [ ] **T2 – Mettre en ligne le MVP** · —
  - Objectif : l'outil est accessible à une adresse publique
  - Dépend de : toutes les tâches du jalon 1
  - Vérification : l'adresse s'ouvre sur un téléphone et le parcours principal fonctionne

## Jalon 2 – Essentiel

> Jalon terminé quand : {{…}}.

- [ ] **T3 – {{Titre}}** · {{ID d'US}}

## Jalon 3 – Optionnel

> Jalon terminé quand : {{…}}.

- [ ] **T4 – {{Titre}}** · {{ID d'US}}

## Points d'attention

| Risque | Tâche | Ce qu'on prévoit |
|---|---|---|
| {{ou « aucun identifié »}} | | |

## Journal

| Date | Tâche | Commit | Remarque (écart, limite connue, idée pour plus tard) |
|---|---|---|---|

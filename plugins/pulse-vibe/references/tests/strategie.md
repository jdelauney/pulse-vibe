# Stratégie de tests

Un test sert à **prouver qu'un comportement attendu par le métier fonctionne**, et à prévenir dès qu'il cesse de fonctionner. Il raconte une histoire métier et reste valable tant que cette histoire ne change pas, même si le code est réécrit.

## 1. La pyramide

```
            /\         Bout en bout (peu)
           /  \        parcours critiques, vérification après déploiement
          /----\
         /      \      Intégration (quelques-uns)
        /        \     modules réels ensemble, base, API, fichiers
       /----------\
      /            \   Unitaires (beaucoup)
     /              \  règles métier, calculs, transformations
    /----------------\
    Contrôles statiques (toujours) : formatage, lint, types
```

- **Beaucoup de tests unitaires** : rapides, précis, ils disent exactement quelle règle est cassée.
- **Quelques tests d'intégration** : ils prouvent que les morceaux s'assemblent (requête réelle, écriture en base, appel d'API).
- **Peu de tests de bout en bout** : ils donnent la plus grande confiance mais coûtent le plus cher à écrire, à lancer et à maintenir ; on les réserve aux parcours dont l'échec bloquerait l'usage.
- **Les contrôles statiques** passent avant tout test : les commandes sont dans « Commandes du projet » de `docs/technical.md`.

## 2. Choisir le niveau

Un comportement se teste **au niveau le plus bas qui suffit à le prouver**. Une règle de calcul se prouve par un test unitaire ; le fait que le résultat s'enregistre se prouve par un test d'intégration ; le fait que la personne puisse le faire depuis l'écran se prouve par un test de bout en bout ou par le test manuel.

| | Unitaire | Intégration | Bout en bout |
|---|---|---|---|
| **Prouve** | Une règle, un calcul, une transformation | Que plusieurs modules réels fonctionnent ensemble | Qu'un parcours complet marche comme pour la personne |
| **Durée visée** | Millisecondes | Secondes | Minutes pour l'ensemble |
| **Frontières** | Toutes passées en paramètre ou doublées | Celles du projet réelles (base de test, fichiers temporaires), services tiers doublés | Application complète, base de test |
| **En cas d'échec** | Dit quelle règle est cassée | Dit quel assemblage est cassé | Dit quel parcours est cassé ; il faut souvent descendre d'un niveau pour trouver la cause |
| **Référence** | `tests/unitaires.md` | `tests/integration.md` | `tests/bout-en-bout.md` |

Le découpage suit `qualite/clean-code.md` §5 et `qualite/organisation.md` §5 et §6 : plus on est près du métier, plus le test est unitaire.

| Partie du code | Type |
|---|---|
| Règles métier, cas d'usage, conversions de données, logique d'interface | Unitaire |
| Accès aux données, services externes, points d'entrée serveur | Intégration |
| Parcours critiques de bout en bout | Bout en bout, ou test manuel |
| Composant d'orchestration de l'interface | Test manuel, ou bout en bout s'il est retenu |

**Ce qu'on laisse aux autres niveaux** :
- Un **accès aux données simple** (lire, créer, modifier, supprimer sans règle) : couvert par un test d'intégration du parcours, sans test unitaire en plus.
- Une fonction **sans décision** (simple transmission, accesseur) : couverte par les tests de ce qui l'utilise.
- Le **comportement de l'outil ou du framework** lui-même : déjà testé par ses auteurs ; on teste notre usage.

## 3. Couverture

La couverture mesure les lignes exécutées par les tests. C'est **un indicateur pour trouver les zones oubliées**, pas un objectif : une ligne exécutée sans assertion utile n'est pas testée.

| Zone | Repère |
|---|---|
| Règles métier | 80 % ou plus |
| Chaque règle métier | Cas nominal, limites, cas refusés : tous présents |
| Parcours critiques | Chacun prouvé par au moins un test d'intégration ou de bout en bout |
| Gestion des erreurs | Chaque erreur prévue par la spec a son test |

Un repère non atteint se discute dans la revue : on ajoute les tests qui prouvent un comportement, sans écrire de test dans le seul but de faire monter le chiffre.

## 4. Quand lancer quoi

| Moment | Ce qui tourne |
|---|---|
| Pendant l'écriture du code | Contrôles statiques et tests unitaires du module en cours, à chaque changement |
| Avant chaque commit | Contrôles statiques et toute la suite unitaire et d'intégration, au vert |
| Intégration continue (CI) | Contrôles statiques, puis unitaires, puis intégration, puis bout en bout : on s'arrête au premier échec. Dépendances en cache, étapes en parallèle quand c'est possible |
| Après un déploiement | Quelques tests de bout en bout rapides sur les parcours critiques (`tests/bout-en-bout.md` §5) |

- **Tests de performance et de charge** (temps de réponse, opérations simultanées) : à part, dans une étape dédiée et sur un environnement stable, car leurs résultats varient avec la machine. Seuil chiffré venant de `docs/prd.md` ou `docs/technical.md`.
- **Test instable** : il se corrige tout de suite (le plus souvent : horloge, ordre, attente fixe, état partagé), ou se met de côté avec une note dans la mémoire du projet et une tâche de correction. Relancer jusqu'à ce qu'il passe masque le problème.
- Suivre dans le temps : durée de la suite, tests instables, évolution de la couverture, défauts trouvés en production qu'aucun test n'avait vus (chacun mérite un test qui le reproduit).

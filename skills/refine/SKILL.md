---
description: Ajuster le plan à partir des questions ou remarques de la personne - répondre à chaque point, modifier les tâches concernées en respectant les règles du plan, montrer ce qui change, puis faire valider
argument-hint: "[<plan>] \"vos questions ou remarques sur le plan\""
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Read Glob Grep Bash(git status *) Bash(git log *)
---

# /pulse:refine – Ajuster le plan

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte refine`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte refine` et lire sa sortie.

Arguments reçus : `$ARGUMENTS` (le plan, facultatif, puis les remarques)

## Objectif

Quand la personne a des questions ou veut des changements sur un plan de `docs/plans/`, **répondre à chaque point**, mettre à jour le plan (et seulement ce qu'il faut ailleurs), **montrer ce qui change**, et faire valider avant d'écrire. Phrase à dire : « Le plan est à vous : on peut le changer, à condition de savoir ce que ça change. »

## Prérequis

- **Le plan** : celui désigné en premier argument (règles « Specs et plans » ci-dessus). Absent : demander lequel, en premier celui qui a une tâche `[~]`. Aucun plan : proposer `/pulse:plan`.
- Remarques vides : demander (AskUserQuestion) « Qu'est-ce qui ne vous convient pas dans le plan ? » avec des réponses types : « Une tâche n'est pas claire » / « L'ordre ne me convient pas » / « Il manque quelque chose » / « Une tâche est de trop ».

## Déroulé

### 1. Classer chaque remarque

Lire le plan, sa spec (`docs/specs/<nom>.md`), `docs/user-stories.md` et `docs/prd.md` utiles. Pour chaque remarque, déterminer son type :

| Type | Exemple | Où se fait le changement |
|---|---|---|
| **Question** | « Pourquoi le filtre est en jalon 2 ? » | aucune modification : répondre |
| **Ordre ou découpage** | « Je veux voir la liste avant le formulaire » | le plan |
| **Changement de périmètre** | « Ajoutons l'export PDF au MVP » | `docs/prd.md` (MoSCoW) d'abord, puis US, puis plan |
| **Souci technique** | « Je ne veux pas créer de compte chez ce fournisseur » | `docs/technical.md` / la spec → proposer `/pulse:tech` si la pile retenue change |
| **Exigence manquante** | « Il faut pouvoir annuler une suppression » | `docs/user-stories.md` (critère d'acceptation), puis plan |

Les **faits** se cherchent dans les documents et le code ; seules les **décisions** se posent à la personne. Si une remarque est ambiguë, poser une ronde de questions (AskUserQuestion, 4 au plus, réponse recommandée en premier avec « (Recommandé) »).

### 2. Répondre et proposer

Pour chaque remarque : la réponse directe, la raison (règle de découpage, priorité MoSCoW, dépendance, sécurité), et, si utile, une alternative. Pour expliquer un choix de code ou de structure, s'appuyer sur les règles de qualité (`pulse-aidd qualite`).

Appliquer les **règles du plan** (rappelées dans le modèle « plan » ci-dessus et dans `/pulse:plan`) à toute tâche nouvelle ou modifiée : découpage vertical (visible et testable en moins de 2 minutes), 3 fichiers et 3 critères au plus, première tâche = squelette et « Mettre en ligne le MVP » qui clôt le jalon 1 (premier plan seulement).

**Ce qu'on ne touche pas** :
- une tâche `[x]` (terminée et enregistrée) : on ne la modifie pas ; un changement devient une **nouvelle tâche** ;
- une tâche `[~]` : la modifier seulement avec l'accord explicite de la personne, en signalant le code déjà écrit ;
- les numéros des tâches existantes : une nouvelle tâche prend le numéro qui suit le plus grand `Tn` de **tous** les plans, même si elle s'insère plus tôt dans l'ordre ;
- le « Journal ».

Un changement de périmètre qui gonfle le jalon 1 au-delà de 8 tâches : le signaler et proposer de déplacer des tâches au jalon 2.

### 3. Montrer avant d'écrire

```
## Ajustement du plan

| Remarque | Réponse | Changement |
|---|---|---|
| … | … | Tn découpée en deux tâches / aucun |

### Ce qui change dans docs/plans/<nom>.md
- ✏️ T3 – <ancien titre> → <nouveau titre> (<pourquoi>)
- ➕ Tn+1 – <titre> · <US>, placée après <tâche> (<jalon>)
- ➖ T6 – <titre> → déplacée en jalon 2

### Ailleurs
- docs/prd.md : <ligne ajoutée ou déplacée> (ou « rien »)
- docs/user-stories.md : <critère ajouté> (ou « rien »)

Questions restantes : <aucune ou liste>
```

Demander (AskUserQuestion) : « Appliquer ces changements (Recommandé) » / « Modifier la proposition » / « Ne rien changer ».

### 4. Écrire

- Appliquer **exactement** ce qui a été validé : le plan, puis les autres documents concernés, dans le format de chaque fichier.
- Une décision durable est apparue (ex. « pas de compte utilisateur dans le MVP ») : proposer de la noter dans la mémoire (`aidd_docs/memory/project.md`, section « Décisions importantes »).
- Le guide de réalisation (`docs/guide/`) se met à jour automatiquement ; lancer `pulse-aidd guide` pour afficher la prochaine étape.

Terminer avec le bloc de fin de commande. Prochaine étape : la commande indiquée par `pulse-aidd guide` (en général `/pulse:implement` ou `/pulse:spirc`), ou `/pulse:tech` si un choix technique est remis en cause.

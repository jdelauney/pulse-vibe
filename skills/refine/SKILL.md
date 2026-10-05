---
description: Ajuster le plan à partir des questions ou remarques de la personne - répondre à chaque point, modifier les tâches concernées en respectant les règles du plan, montrer ce qui change, puis faire valider
argument-hint: "[<US-XXX>] \"vos questions ou remarques sur le plan\""
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Read Glob Grep Bash(git status *) Bash(git log *)
---

# /pulse:refine – Ajuster le plan

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte refine`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte refine` et lire sa sortie.

Arguments reçus : `$ARGUMENTS` (l'US dont on ajuste le plan, facultative, puis les remarques)

## Objectif

Quand la personne a des questions ou veut des changements sur un plan (`aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`), **répondre à chaque point**, mettre à jour le plan (et seulement ce qu'il faut ailleurs), **montrer ce qui change**, et faire valider avant d'écrire. Phrase à dire : « Le plan est à vous : on peut le changer, à condition de savoir ce que ça change. »

## Prérequis

- **Le plan** : celui de l'US désignée en premier argument (règles « User stories, specs et plans » ci-dessus). Absent : demander lequel, en premier celui qui a une tâche `[~]`. Aucun plan : proposer `/pulse:plan`.
- Remarques vides : demander (AskUserQuestion) « Qu'est-ce qui ne vous convient pas dans le plan ? » avec des réponses types : « Une tâche n'est pas claire » / « L'ordre ne me convient pas » / « Il manque quelque chose » / « Une tâche est de trop ».

## Déroulé

### 1. Classer chaque remarque

Lire le plan, sa spec et son US (même dossier : `SPEC-US-XXX-<nom>.md`, `US-XXX-<nom>.md`), `docs/user-stories.md` et `docs/prd.md` utiles. Pour chaque remarque, déterminer son type :

| Type | Exemple | Où se fait le changement |
|---|---|---|
| **Question** | « Pourquoi le filtre n'est pas dans le MVP ? » | aucune modification : répondre |
| **Ordre ou découpage** | « Je veux voir la liste avant le formulaire » | le plan |
| **Changement de périmètre** | « Ajoutons l'export PDF au MVP » | `docs/prd.md` (MoSCoW) d'abord, puis une nouvelle US (référentiel et fichier), sa spec et son plan ; ou la priorité d'une US existante dans le référentiel |
| **Souci technique** | « Je ne veux pas créer de compte chez ce fournisseur » | `docs/technical.md` / la spec → proposer `/pulse:tech` si la pile retenue change |
| **Exigence manquante** | « Il faut pouvoir annuler une suppression » | le fichier de l'US (critère d'acceptation), sa spec si besoin, puis plan ; une exigence qui relève d'une autre US va dans celle-ci |

Les **faits** se cherchent dans les documents et le code ; seules les **décisions** se posent à la personne. Si une remarque est ambiguë, poser une ronde de questions (AskUserQuestion, 4 au plus, réponse recommandée en premier avec « (Recommandé) »).

### 2. Répondre et proposer

Pour chaque remarque : la réponse directe, la raison (règle de découpage, priorité MoSCoW, dépendance, sécurité), et, si utile, une alternative. Pour expliquer un choix de code ou de structure, s'appuyer sur les règles de qualité (`pulse-aidd qualite`).

Appliquer les **règles du plan** (rappelées dans le modèle « plan » ci-dessus et dans `/pulse:plan`) à toute tâche nouvelle ou modifiée : découpage vertical (visible et testable en moins de 2 minutes), 3 fichiers et 3 critères au plus, première tâche = squelette (s'il n'est pas en place), et « Mettre en ligne le MVP » seulement dans le plan de la dernière US Indispensable du parcours. Un plan ne couvre qu'une US : une tâche qui relève d'une autre US va dans le plan de celle-ci. Si les fichiers ou les dépendances des tâches changent, revérifier la ligne « En parallèle avec » (règle 9 de `/pulse:plan`) de ce plan et des plans qu'elle cite.

**Ce qu'on ne touche pas** :
- une tâche `[x]` (terminée et enregistrée) : on ne la modifie pas ; un changement devient une **nouvelle tâche** ;
- une tâche `[~]` : la modifier seulement avec l'accord explicite de la personne, en signalant le code déjà écrit ;
- les numéros des tâches existantes : une nouvelle tâche prend le numéro qui suit le plus grand `Tn` de **tous** les plans, même si elle s'insère plus tôt dans l'ordre ;
- le « Journal ».

Un plan qui dépasse 4 tâches (sans compter la mise en place ni la mise en ligne) : le signaler et proposer de découper l'US en deux (`/pulse:us`).

### 3. Montrer avant d'écrire

```
## Ajustement du plan

| Remarque | Réponse | Changement |
|---|---|---|
| … | … | Tn découpée en deux tâches / aucun |

### Ce qui change dans PLAN-SPEC-US-XXX-<nom>.md
- ✏️ T3 – <ancien titre> → <nouveau titre> (<pourquoi>)
- ➕ Tn+1 – <titre> · US-XXX, placée après <tâche>
- ➖ T6 – <titre> → déplacée dans le plan de US-YYY

### Ailleurs
- docs/prd.md : <ligne ajoutée ou déplacée> (ou « rien »)
- US-XXX-<nom>.md : <critère ajouté> (ou « rien »)
- docs/user-stories.md : <US ajoutée, priorité changée> (ou « rien »)

Questions restantes : <aucune ou liste>
```

Demander (AskUserQuestion) : « Appliquer ces changements (Recommandé) » / « Modifier la proposition » / « Ne rien changer ».

### 4. Écrire

- Appliquer **exactement** ce qui a été validé : le plan, puis les autres documents concernés, dans le format de chaque fichier.
- Une décision durable est apparue (ex. « pas de compte utilisateur dans le MVP ») : proposer de la noter dans la mémoire (`aidd_docs/memory/project.md`, section « Décisions importantes »).
- Le guide de réalisation (`docs/guide/`) se met à jour automatiquement ; lancer `pulse-aidd guide` pour afficher la prochaine étape.

Terminer avec le bloc de fin de commande. Prochaine étape : la commande indiquée par `pulse-aidd guide` (en général `/pulse:implement` ou `/pulse:spirc`), ou `/pulse:tech` si un choix technique est remis en cause.

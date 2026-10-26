---
description: Ajuster le plan à partir des questions ou remarques de la personne - répondre à chaque point, modifier les tâches concernées en respectant les règles du plan, montrer ce qui change, puis faire valider
argument-hint: "[<US-XXX>] \"vos questions ou remarques sur le plan\""
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte refine) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite *) Bash(pulse-aidd tests *) Bash(pulse-aidd scenarios) Bash(pulse-aidd guide) Bash(pulse-aidd verifier-plan *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd etape pr --sans-communes) Read Glob Grep Bash(git status *) Bash(git log *) Write(aidd_docs/tasks/**) Edit(aidd_docs/tasks/**) Edit(docs/prd.md) Edit(docs/user-stories.md) Write(docs/lexique.md) Edit(docs/lexique.md)
---

# /pulse:refine – Ajuster le plan

## Objectif

Quand la personne a des questions ou veut des changements sur un plan (`aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`), **répondre à chaque point**, mettre à jour le plan (et seulement ce qu'il faut ailleurs), **montrer ce qui change**, et faire valider avant d'écrire. Phrase à dire : « Le plan est à vous : on peut le changer, à condition de savoir ce que ça change. »

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte refine` et lire sa sortie en entier, fichier enregistré compris) pendant toute la commande.

## Contexte

Arguments reçus : `$ARGUMENTS` (l'US dont on ajuste le plan, facultative, puis les remarques)

### Prérequis

- **Le plan** : celui de l'US désignée en premier argument (règles des tâches). Absent : demander lequel, en premier celui qui a une tâche `[~]`. Aucun plan : proposer `/pulse:plan`.
- Remarques vides : demander (AskUserQuestion) « Qu'aimeriez-vous changer dans le plan ? » avec des réponses types : « Une tâche est floue » / « Je veux changer l'ordre » / « Je veux ajouter quelque chose » / « Une tâche est de trop ».

## Processus

### 1. Classer chaque remarque

Lire le plan, sa spec et son US (même dossier : `SPEC-US-XXX-<nom>.md`, `US-XXX-<nom>.md`), `docs/user-stories.md` et `docs/prd.md` utiles. Pour chaque remarque, déterminer son type :

| Type | Exemple | Où se fait le changement |
|---|---|---|
| **Question** | « Pourquoi le filtre n'est pas dans la première version ? » | répondre ; le plan reste tel quel |
| **Ordre ou découpage** | « Je veux voir la liste avant le formulaire » | le plan |
| **Changement de périmètre** | « Ajoutons l'export PDF à la première version » | `docs/prd.md` (MoSCoW) d'abord, avec l'accord ; puis proposer `/pulse:spec "…"` (nouvelle US et sa spec) et `/pulse:plan` ; ou la priorité d'une US existante dans le référentiel |
| **Souci technique** | « Je ne veux pas créer de compte chez ce fournisseur » | la conception technique du plan, ou `docs/technical.md` → proposer `/pulse:tech` si la pile retenue change |
| **Exigence manquante** | « Il faut pouvoir annuler une suppression » | la spec du plan est verrouillée : l'exigence devient une nouvelle US, avec sa spec et son plan → proposer `/pulse:spec "…"` ; une exigence qui relève d'une autre US va dans celle-ci |

Les **faits** se cherchent dans les documents et le code ; seules les **décisions** se posent à la personne. Si une remarque est ambiguë, poser une ronde de questions (règle commune 5).

### 2. Répondre et proposer

Pour chaque remarque : la réponse directe, la raison (règle de découpage, priorité MoSCoW, dépendance, sécurité), et, si utile, une alternative. Pour expliquer un choix de code ou de structure, s'appuyer sur les règles de qualité (`pulse-aidd qualite clean-code`, et la famille du sujet).

Appliquer les « Règles de découpage » (chargées dans « Références de la commande ») à toute tâche nouvelle ou modifiée. Une conception technique modifiée reste fidèle à la spec ; un comportement visible en plus va dans « Ajouts proposés par Pulse ». Un plan couvre une seule US : une tâche qui relève d'une autre US va dans le plan de celle-ci.

La ligne « Envoi » (version parallèle, branche principale ou local) se change ici à la demande de la personne : en passant au mode PR, préparer la branche comme le décrit « 1. Choisir comment envoyer le travail d'un plan » de la référence « L'envoi du travail » (`pulse-aidd reference envoi.md`).

Si les fichiers ou les dépendances des tâches changent, revérifier la ligne « En parallèle avec » (règle 9 des « Règles de découpage ») de ce plan et des plans qu'elle cite.

**Ce qu'on garde tel quel** :
- une tâche `[x]` (terminée et enregistrée) : elle reste telle quelle ; un changement devient une **nouvelle tâche** ;
- une tâche `[~]` : la modifier seulement avec l'accord explicite de la personne, en signalant le code déjà écrit ;
- les numéros des tâches existantes : une nouvelle tâche prend le numéro qui suit le plus grand `Tn` de tous les plans (règles des tâches), même si elle s'insère plus tôt dans l'ordre ;
- le « Journal », complété d'une ligne (date, tâche « — », « plan modifié : <résumé> ») une fois les changements validés.

Un plan qui dépasse 4 tâches (hors mise en place et mise en ligne) : le signaler et proposer de découper l'US en deux (`/pulse:us`).

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
- docs/user-stories.md : <priorité changée> (ou « rien »)
- Nouvelle US à écrire ensuite : `/pulse:spec "…"` (ou « aucune »)

Questions restantes : <aucune ou liste>
```

Demander (AskUserQuestion) : « Appliquer ces changements (Recommandé) » / « Modifier la proposition » / « Garder le plan actuel ».

### 4. Écrire

- Appliquer **exactement** ce qui a été validé : le plan, puis les autres documents concernés, dans le format de chaque fichier.
- Lancer `pulse-aidd verifier-plan US-XXX` : un constat « à corriger » né des changements se montre en une ligne, avec sa correction, validée comme à l'étape 3.
- Une décision durable est apparue (ex. « pas de compte utilisateur dans la première version ») : proposer de la noter dans la mémoire (`aidd_docs/memory/project.md`, section « Décisions importantes »).
- Le guide de réalisation (`docs/guide/`) se met à jour automatiquement ; lancer `pulse-aidd guide` pour afficher la prochaine étape.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:spec "…"` si une nouvelle US a été proposée ; sinon la commande indiquée par `pulse-aidd guide` (en général `/pulse:spirc <US-XXX>`, ou `/pulse:implement <US-XXX> <tâche>` pour la faire pas à pas), ou `/pulse:tech` si un choix technique est remis en cause.

## Exemples

- `/pulse:refine US-003 "Je veux voir la liste avant le formulaire"` : la réponse, le nouvel ordre des tâches montré avant tout changement ; après votre accord, le plan est mis à jour.
- `/pulse:refine US-003 "Pourquoi le filtre n'est pas dans la première version ?"` : une réponse avec sa raison ; le plan reste tel quel.
- `/pulse:refine` sans remarque : la question « Qu'aimeriez-vous changer dans le plan ? », avec quelques réponses types.

## Références de la commande

!`pulse-aidd contexte refine`

Ce contexte contient aussi « Règles de découpage du plan ». Le plan lui-même montre le format des tâches ; lancer `pulse-aidd modele plan.md` seulement quand une section manque. Si ce contexte est absent, lancer `pulse-aidd contexte refine` et lire sa sortie en entier, fichier enregistré compris.

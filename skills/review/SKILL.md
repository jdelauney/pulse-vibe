---
description: Relecture indépendante d'une tâche (critères d'acceptation et sécurité), test manuel, puis corrections
argument-hint: "[T3 | <US-XXX> | tout]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Bash(git status *) Bash(git diff *) Bash(git log *)
---

# /pulse:review – Relire, tester, corriger

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte review`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte review` et lire sa sortie.

Tâche demandée (facultative) : `$ARGUMENTS`

## Objectif

Lancer une relecture indépendante du code, faire tester la personne elle-même, puis corriger. Expliquer en une phrase : « Relire avec un regard externe aide à détecter les erreurs oubliées ; valider ensuite en testant manuellement. »

## Prérequis

- Au moins un plan dans `aidd_docs/tasks/` et `docs/user-stories.md` sont nécessaires.
- Vérifier qu'il y a quelque chose à relire : des modifications (`git status`, `git diff`) ou une tâche `[~]`. Sinon, l'indiquer et proposer `/pulse:implement <US-XXX>`.

## Déroulé

### 1. Identifier la tâche

- `T3` : cette tâche, cherchée dans tous les plans de `aidd_docs/tasks/` (les numéros sont uniques).
- **une US** (`US-003`, son plan) : toutes ses tâches `[~]`, relues une par une (une délégation et un rapport par tâche, délégations lancées en parallèle), puis un test manuel par tâche.
- `tout` : la relecture porte sur l'ensemble du projet par rapport à toutes les US terminées.
- vide : la tâche `[~]` ; s'il y en a zéro ou plusieurs, demander.

Le plan qui contient la tâche, la spec et l'US du même dossier (`SPEC-US-XXX-<nom>.md`, `US-XXX-<nom>.md`) sont les documents de référence de la relecture.

### 2. Lancer la relecture indépendante

Utiliser l'outil Agent avec le sous-agent **`pulse:reviewer`**. Dans le message de délégation, indiquer :
- la tâche (identifiant et titre) et la racine du projet ;
- les documents à lire : le plan, la spec et l'US de la tâche (`aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`, `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`, `aidd_docs/tasks/<epic>/US-XXX-<nom>.md`), `docs/user-stories.md` ;
- la **checklist sécurité complète**, recopiée dans le message (le sous-agent voit seulement les fichiers du projet) ;
- si elles existent, le chemin de `docs/design.md` et celui de la maquette citée par la spec ou la tâche (`docs/design/maquettes/US-XXX-<nom>/retenue/`) ;
- le document `docs/technical.md` (sections « Pile retenue », « Organisation des fichiers », « Commandes du projet », « Données et contrôle d'accès », « Secrets et variables d'environnement »), et la consigne de charger les références de qualité avec `pulse-aidd qualite`.

Si le sous-agent est indisponible, faire la relecture en suivant **strictement** la méthode et le format décrits par `pulse-aidd agent reviewer`, en lecture seule pendant la relecture.

### 3. Enregistrer le rapport

Écrire le rapport à côté du plan de la tâche, dans `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/<Tâche>-<AAAA-MM-JJ>.md` (structure : le modèle de rapport de revue ; créer le dossier au besoin). Si un rapport du même jour existe, ajouter un suffixe `-2`, `-3`. Avec `tout` : `docs/revue-projet-<AAAA-MM-JJ>.md`.

### 4. Présenter

Présenter en quelques lignes : le verdict, le nombre de points ⛔ et ⚠️, et les 3 plus importants **traduits en langage simple** (ce que ça change pour l'utilisateur).

### 5. Le test manuel par la personne

Donner les étapes du test manuel du rapport, puis demander (AskUserQuestion) : « Le test est-il concluant ? » → « Oui, tout fonctionne » / « Non, il y a un problème ». Dans ce cas, demander lequel.

### 6. Corriger

S'il y a des ⛔, des ⚠️ ou un test manuel en échec, proposer (AskUserQuestion) : « Tout corriger (recommandé) » / « Seulement les points bloquants » / « Je regarde d'abord ».

Pour chaque correction : la faire, puis l'expliquer en une ligne. Ensuite relancer **une** relecture courte (même sous-agent) pour confirmer, et ajouter son résultat à la fin du même rapport, dans une section `## Relecture de contrôle` (date, verdict, points restants). Mettre à jour la ligne **Verdict** en tête du rapport. Limiter à **deux cycles** de correction maximum : si un point bloquant persiste, l'expliquer simplement et conseiller de demander de l'aide à une personne qui sait programmer.

Appliquer les 💡 suggestions à la demande de la personne.

### 7. Conclure

Quand le verdict est ✅ (ou ⚠️ accepté par la personne) **et** que le test manuel est concluant, considérer la tâche comme prête à être enregistrée.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:commit`.

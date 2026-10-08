---
description: Relecture et vérification indépendantes d'une tâche (critères d'acceptation, sécurité, essai de l'application en marche), test manuel, puis corrections
argument-hint: "[T3 | <US-XXX> | tout]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte review) Bash(pulse-aidd agent reviewer) Bash(pulse-aidd agent verifier) Bash(pulse-aidd agent security-auditor) Bash(pulse-aidd agent test-runner) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd secrets historique *) Bash(pulse-aidd seo *) Bash(pulse-aidd verifier) Bash(pulse-aidd pile contexte *) Bash(git status *) Bash(git diff *) Bash(git log *)
---

# /pulse:review – Relire, tester, corriger

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte review`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte review` et lire sa sortie.

Tâche demandée (facultative) : `$ARGUMENTS`

## Objectif

Faire examiner la tâche par deux assistants qui ne l'ont pas écrite (l'un relit le code, l'autre essaie l'application en marche), faire tester la personne elle-même, puis corriger. Expliquer en une phrase : « Un regard extérieur repère les oublis, et un essai en marche prouve que ça fonctionne ; votre test manuel le confirme ensuite. »

## Prérequis

- Au moins un plan dans `aidd_docs/tasks/` et `docs/user-stories.md` sont nécessaires.
- Vérifier qu'il y a quelque chose à relire : des modifications (`git status`, `git diff`) ou une tâche `[~]`. Sinon, l'indiquer et proposer `/pulse:implement <US-XXX>`.

## Déroulé

### 1. Identifier la tâche

- `T3` : cette tâche, cherchée dans tous les plans de `aidd_docs/tasks/` (les numéros sont uniques).
- **une US** (`US-003`, son plan) : toutes ses tâches `[~]`, relues une par une (un examen et un rapport par tâche, examens lancés en parallèle), puis un test manuel par tâche.
- `tout` : la relecture porte sur l'ensemble du projet par rapport à toutes les US terminées.
- vide : la tâche `[~]` ; s'il y en a zéro ou plusieurs, demander.

Les documents de référence sont ceux du § 1 de la référence « Examiner une tâche ».

### 2. Lancer l'examen

Appliquer le § 2 de la référence « Examiner une tâche » : `pulse:reviewer` et `pulse:verifier` en parallèle, pour chaque tâche. Avec `tout` : seulement `pulse:reviewer`, sur l'ensemble du projet par rapport à toutes les US terminées ; la vérification en marche se fait tâche par tâche.

### 3. Enregistrer le rapport

Appliquer le § 3 de la référence « Examiner une tâche ». Avec `tout` : `docs/revue-projet-<AAAA-MM-JJ>.md`.

### 4. Présenter

Présenter en quelques lignes : le **rapport de réalisation** (règles communes § 4, construit à partir du tableau du verifier), le verdict, le nombre de constats par gravité (Critique, Haute, Moyenne, Basse), et les 3 plus importants **traduits en langage simple** (ce que ça change pour l'utilisateur).

### 5. Le test manuel par la personne

Donner les étapes du test manuel du rapport, en commençant par les critères ❓ du verifier, puis demander (AskUserQuestion) : « Le test est-il concluant ? » → « Oui, tout fonctionne » / « Non, il y a un problème ». Dans ce cas, demander lequel.

Noter la réponse dans la section « Test par la personne » du rapport (date, résultat, remarque).

### 6. Corriger

Traiter les constats selon « Les constats de relecture » des règles communes (§ 6) : Critique, Haute et Moyenne à corriger, Basse confrontés au code, décision notée dans « Suite donnée aux constats ». Un test manuel en échec compte comme un constat Critique.

Pour chaque correction : la faire, puis l'expliquer en une ligne. Ensuite lancer la relecture de contrôle (§ 4 de la référence « Examiner une tâche »). Limiter à **deux cycles** de correction maximum : si un point bloquant persiste, l'expliquer simplement et proposer `/pulse:get-help`.

### 7. Conclure

Quand le verdict est ✅ (ou ⚠️ accepté par la personne, noté dans « Suite donnée aux constats ») **et** que le test manuel est concluant, considérer la tâche comme prête à être enregistrée.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:commit`.

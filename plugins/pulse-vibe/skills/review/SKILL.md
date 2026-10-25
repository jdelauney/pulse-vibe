---
description: Relecture et vérification indépendantes d'une tâche (critères d'acceptation, sécurité, essai de l'application en marche), test manuel, puis corrections
argument-hint: "[T3 | <US-XXX> | tout]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte review) Bash(pulse-aidd agent reviewer) Bash(pulse-aidd agent verifier) Bash(pulse-aidd agent security-auditor) Bash(pulse-aidd agent test-runner) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite *) Bash(pulse-aidd tests *) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd secrets historique *) Bash(pulse-aidd seo *) Bash(pulse-aidd verifier) Bash(pulse-aidd preuve *) Bash(pulse-aidd pile contexte *) Bash(git status *) Bash(git diff *) Bash(git log *) Write(aidd_docs/tasks/**) Edit(aidd_docs/tasks/**) Bash(pulse-aidd revue *) Bash(pulse-aidd copies)
---

# /pulse:review – Relire, tester, corriger

## Objectif

Faire examiner la tâche par deux assistants qui ne l'ont pas écrite (l'un relit le code, l'autre essaie l'application en marche), faire tester la personne elle-même, puis corriger. Expliquer la phrase d'« Examiner une tâche ».

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte review` et lire sa sortie en entier) pendant toute la commande.

## Contexte

Tâche demandée (facultative) : `$ARGUMENTS`

### Prérequis

- Au moins un plan dans `aidd_docs/tasks/` et `docs/user-stories.md` sont nécessaires.
- Vérifier qu'il y a quelque chose à relire : des modifications (`git status`, `git diff`) ou une tâche `[~]`. Sinon, l'indiquer et proposer de taper `/pulse:spirc <US-XXX>`.

## Rôle

La conversation principale orchestre : elle choisit la tâche, enregistre le rapport, le présente, fait tester la personne et corrige. Deux agents, qui n'ont pas écrit la tâche, apportent le regard extérieur :
- `pulse:reviewer` relit le code (avec `tout` : l'ensemble du projet par rapport à toutes les US terminées) ;
- `pulse:verifier` essaie l'application en marche, tâche par tâche.

## Processus

### 1. Identifier la tâche

- `T3` : cette tâche, cherchée dans tous les plans de `aidd_docs/tasks/` (les numéros sont uniques).
- **une US** (`US-003`, son plan) : toutes ses tâches `[~]`, relues une par une (un examen et un rapport par tâche, examens lancés en parallèle), puis un test manuel par tâche.
- `tout` : la relecture porte sur l'ensemble du projet par rapport à toutes les US terminées.
- vide : la tâche `[~]` ; s'il y en a zéro ou plusieurs, demander.

Les documents de référence sont ceux du § 1 de la référence « Examiner une tâche ».

Pour une tâche qui a déjà un rapport, lancer `pulse-aidd revue <Tn>` : `test` → passer directement au § 5 (l'examen est fait, il manque le test par la personne) ; `commit` → la tâche est prête : le dire et proposer de taper `/pulse:commit` ; `correction` → reprendre au § 6 avec les constats du rapport ; `aide` → la ligne « Blocage » du rapport : proposer de taper `/pulse:get-help` ; `examen` → tout le processus ; `aucune` (la tâche n'est dans aucun plan) → le dire et demander de quelle tâche il s'agit.

### 2. Lancer l'examen

Appliquer le § 2 de la référence « Examiner une tâche » : `pulse:reviewer` et `pulse:verifier` en parallèle, pour chaque tâche. Une US, avant des examens en parallèle : lire `pulse-aidd preuve etat --exiger suite` et lancer au besoin une seule preuve, de toute la suite (la relance indiquée ; `--construire` si une des tâches touche une page, une route ou la configuration ; outil Bash : `timeout` 600000) ; les verifiers la relisent. Avec `tout` : seulement `pulse:reviewer` (message : examen sans verifier), sur l'ensemble du projet par rapport à toutes les US terminées ; la vérification en marche se fait tâche par tâche.

### 3. Enregistrer le rapport

Appliquer le § 3 de la référence « Examiner une tâche » ; au moment d'écrire le rapport, lancer `pulse-aidd modele revue.md` (le modèle de rapport). Avec `tout` : `docs/revue-projet-<AAAA-MM-JJ>.md`.

### 4. Présenter

Présenter en quelques lignes : le **rapport de réalisation** (règles communes § 4, construit à partir du tableau du verifier), le verdict, le nombre de constats par gravité (Critique, Haute, Moyenne, Basse), et les 3 plus importants **traduits en langage simple** (ce que ça change pour l'utilisateur).

### 5. Le test manuel par la personne

Appliquer « 3 bis. Écrire la fiche de test de la personne » de la référence « Examiner une tâche » : fiche `SMOKE-TEST-…` écrite (ou réécrite après une correction), application lancée, lien vers la fiche donné avec sa première étape ; puis demander (AskUserQuestion) : « Le test est-il concluant ? » → « Oui, tout fonctionne » / « Non, il y a un problème ». Dans ce cas, demander lequel.

Noter dans la section « Test par la personne » du rapport la date, le résultat et la remarque ; le résultat reprend les choix du modèle : « ✅ concluant » ou « ❌ non concluant : <ce qui ne va pas> ».

### 6. Corriger

Traiter les constats selon « Les constats de relecture » des règles de relecture : Critique, Haute et Moyenne à corriger, Basse confrontés au code, décision notée dans « Suite donnée aux constats ». Un test manuel en échec compte comme un constat Critique.

Avec un pack de pile, avant la première correction faite par cette conversation elle-même (un agent qui corrige charge le pack lui-même), lancer `pulse-aidd pile contexte implement`, lu en entier, et coder les corrections selon elles.

Pour chaque correction : la faire, puis l'expliquer en une ligne. Ensuite lancer la relecture de contrôle (§ 4 de la référence « Examiner une tâche ») ; après un test de la personne ❌, remettre aussi la ligne « Résultat » de « Test par la personne » à la valeur du modèle, comme le décrit ce § 4. Limiter à **deux cycles** de correction maximum : si un point bloquant persiste, l'expliquer simplement, le noter dans la ligne « Blocage » du rapport (« persiste après 2 cycles : /pulse:get-help ») et proposer de taper `/pulse:get-help`.

### 7. Conclure

Après un nouveau test manuel (suite à une correction), réécrire « Test par la personne » avec son dernier résultat. Quand la personne accepte un ⚠️, le noter dans « Suite donnée aux constats » et écrire la ligne **Verdict** en tête du rapport « ⚠️ … accepté par la personne » (ou ✅). Quand le verdict est ✅ (ou ⚠️ accepté par la personne, noté dans « Suite donnée aux constats ») **et** que le test manuel est concluant, considérer la tâche comme prête à être enregistrée.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:commit`.

## Exemples

- `/pulse:review T3` : deux assistants relisent et essaient la tâche 3 ; vous recevez le verdict, les points importants en langage simple, puis les étapes de votre test.
- `/pulse:review US-003` : chaque tâche en cours de l'US est examinée, puis vous la testez une par une.
- `/pulse:review` sans argument : la tâche en cours est reprise ; s'il y en a plusieurs, la question « laquelle relire ? ».

## Références de la commande

!`pulse-aidd contexte review`

Ce contexte contient « Examiner une tâche » ; le modèle de rapport s'affiche au § 3. Avec un pack de pile, ses consignes de relecture servent au reviewer : le reviewer les charge lui-même (`pulse-aidd pile contexte review`) ; pour confronter un constat Basse à une règle du pack, la lire avec `pulse-aidd pile reference fiche.md`. Si ce contexte est absent, lancer `pulse-aidd contexte review` et lire sa sortie.

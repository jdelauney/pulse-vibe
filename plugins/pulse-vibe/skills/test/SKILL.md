---
description: Lancer les tests automatiques du projet et expliquer chaque échec (lancer), ou écrire les tests d'un code existant à partir des scénarios de la spec (ecrire), via les agents test-runner et test-writer
argument-hint: "[lancer | ecrire <US-XXX | Tn | chemin>]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte test) Bash(pulse-aidd agent test-runner) Bash(pulse-aidd agent test-writer) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd verifier) Bash(pulse-aidd pile contexte *) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git add *) Edit(aidd_docs/tasks/**)
---

# /pulse:test – Les tests automatiques

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte test`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références citées plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte test` et lire sa sortie.

Arguments reçus : `$ARGUMENTS`

## Objectif

- **`lancer`** (ou sans argument) : lancer toute la suite de tests, expliquer chaque échec en langage simple et proposer qui le corrige.
- **`ecrire <cible>`** (`écrire` accepté) : écrire les tests d'un code qui existe déjà sans tests, à partir des scénarios de la spec et des critères d'acceptation. Cible : une US (`US-003`, toutes ses tâches `[x]`), une tâche (`T3`), ou un fichier ou dossier du code.

Phrase à dire : « Les tests sont de petits programmes qui vérifient automatiquement que l'outil fait ce que la spec demande. Un assistant les lance ou les écrit ; un autre, qui n'a pas écrit le code, juge les résultats. »

Pour écrire des tests **avant** le code d'une nouvelle tâche : `/pulse:implement -t` ou `/pulse:spirc -t` (référence « Tests automatiques : tests d'abord » ci-dessus).

## Prérequis

- `docs/technical.md` existe. Sinon, proposer `/pulse:tech` et s'arrêter.
- « Tester » de « Commandes du projet » existe. Sinon (« aucune ») : proposer d'installer un outil de test selon le § 3 de la référence « Tests automatiques » ; sans accord, s'arrêter.
- Noter les fichiers déjà modifiés (`git status --short`) : à la fin, montrer seulement ce que cette commande a changé.

## Lancer

1. Déléguer à **`pulse:test-runner`**, phase « suite complète » : la commande « tester » (et celle de couverture si elle existe), les plans en cours (`aidd_docs/tasks/*/PLAN-SPEC-US-*.md`) pour relier un échec à une tâche.
2. Présenter :

   ```
   🧪 Tests : <n réussis> réussis · <n en échec> en échec · <n instables> instables
   ```

   puis chaque échec en une ligne simple : ce qui ne marche pas, la cause (code, test, environnement, instable), la tâche concernée si on la trouve.
3. Demander (AskUserQuestion), seulement s'il y a des échecs : « Corriger maintenant (Recommandé) » / « Seulement noter les échecs ».
   - Échec **dû au code** : un par un, avec `/pulse:fix` (cause d'abord, correction minimale, preuve), en lui transmettant le test et le message d'échec.
   - Échec **dû au test** ou test **instable** : `pulse:test-writer`, mode « corriger », avec la liste du test-runner ; puis relancer le test-runner sur ces tests. Deux cycles au plus.
   - Échec **dû à l'environnement** : guider la personne pas à pas.
4. Les constats de qualité des tests suivent « Les constats de relecture » (règles communes § 6).

## Écrire

1. **Retrouver le contrat** : pour une US ou une tâche, sa spec (section « Scénarios »), le fichier de l'US (critères d'acceptation) et le plan (lignes `Fichiers` et `Tests`). Pour un fichier ou un dossier : la tâche dont la ligne `Fichiers` le cite, sinon demander quel comportement il doit avoir. Une spec sans scénarios (spec plus ancienne) : rédiger les scénarios manquants selon la référence Gherkin, les montrer, les faire valider, puis les ajouter à la spec.
2. Déléguer à **`pulse:test-writer`**, mode « code existant » : le contrat recopié (scénarios, critères, lignes `Tests`), les fichiers de code concernés, les sections « Pile retenue », « Organisation des fichiers » et « Commandes du projet » de `docs/technical.md`, les mots du glossaire utiles. Plusieurs tâches indépendantes : un test-writer par tâche, en parallèle (plusieurs appels Agent dans le même message).
3. Déléguer à **`pulse:test-runner`**, phase « suite complète », limitée aux nouveaux tests puis à toute la suite.
4. Présenter :
   - les tests écrits, groupés par règle, en une ligne chacun ;
   - les **défauts probables du code** (un test fidèle au scénario qui échoue) : chacun expliqué simplement, avec la proposition `/pulse:fix` ; un tel test reste dans la suite ;
   - les tests à corriger : test-writer en mode « corriger », deux cycles au plus ;
   - les scénarios à préciser : à trancher avec la personne s'ils touchent au besoin, puis mettre à jour la spec.
5. Ajouter une ligne au journal du plan concerné (date, tâche, commit à venir, « tests ajoutés : <n> ; défauts trouvés : <n> »).

## Fin

```
🧪 Tests : <n écrits> écrits · <n réussis> réussis · <n en échec> en échec (dont <n> défauts du code)
Fichiers : <liste>   (git diff --stat)
```

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:fix "<échec>"` s'il reste un défaut du code ; sinon `/pulse:commit` (message `test(<Tâche>): …` ou `test: …`).

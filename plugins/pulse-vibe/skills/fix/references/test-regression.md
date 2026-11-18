# Reproduire l'erreur par un test (test de non-régression)

Utilisé par `/pulse:fix`, étape 4, avant toute correction. Le test décrit le comportement attendu ; il échoue tant que l'erreur est là, passe une fois la cause corrigée, puis reste dans le projet : si l'erreur revient un jour, il prévient. La méthode d'écriture des tests est dans `references/tests/` (`pulse-aidd tests <morceaux>`).

## 1. Quand écrire le test

- **Oui** quand la commande « tester » existe dans « Commandes du projet » de `docs/technical.md`, et que la cause tient dans une règle qui s'observe par un programme : un calcul, une validation, un droit d'accès, une donnée enregistrée ou lue, la réponse d'une route ou d'une action.
- **Non**, sans le présenter comme un manque, quand l'erreur se voit seulement à l'écran (mise en page, couleur, texte), vient de l'environnement (variable absente chez l'hébergeur, service arrêté, dépendance non installée) ou de la configuration d'un outil. Le dire en une phrase : « Cette erreur se voit à l'écran : nous vérifierons ensemble, après la correction, que tout est revenu. » Passer à l'étape 5.
- **Pas de commande « tester »** : le dire en une phrase et proposer d'en ajouter une avec `/pulse:test`, sans bloquer la correction.

Phrase à dire, la première fois : « J'écris d'abord un petit test qui montre l'erreur. Il échoue maintenant ; après la correction, il passera, et il préviendra si l'erreur revient. »

## 2. Le cycle

1. **Écrire le test** : déléguer à **`pulse:test-writer`** (outil Agent, `model: "sonnet"`), mode « reproduire un bogue » : le symptôme, la cause en une phrase, le comportement attendu, les fichiers concernés, le parcours qui déclenche l'erreur (avec les données fictives), et, quand le comportement vient d'une US, les chemins de son US et de sa spec. Agent indisponible : `pulse-aidd agent test-writer`, puis suivre strictement ses consignes dans la conversation.
2. **Vérifier qu'il échoue pour la bonne raison** : déléguer à **`pulse:test-runner`**, phase « rouge attendu », avec la consigne « l'échec attendu est celui du bogue : <symptôme> ».
   - 🔴 Rouge, et le résultat observé est bien le symptôme : continuer.
   - ⚠️ Le test passe, ou échoue pour une autre raison (erreur dans le test lui-même) : renvoyer au test-writer le constat du test-runner, puis relancer le test-runner ; deux cycles au plus. Un test qui passe encore montre que la cause n'est pas celle trouvée : revenir à l'étape 2 de `/pulse:fix` avec ce fait.
   - ⛔ Impossible à lancer : expliquer le blocage en une phrase et continuer sans test (preuve par la personne à l'étape 6).
3. **Figer le test** : `git add <fichiers de test>`, puis `pulse-aidd tests-figes figer <fichiers de test>`. Le garde-fou refuse ensuite toute modification de ces fichiers.
4. **Corriger** (étape 5 de `/pulse:fix`) : le message à `pulse:fixer` donne en plus les fichiers de test figés, et la commande qui lance ce test comme commande de preuve.
5. **Vérifier qu'il passe** : déléguer à **`pulse:test-runner`**, phase « vert attendu », avec les fichiers de test et les fichiers corrigés. Un test contesté par le fixer (« Test contesté : … ») se tranche ici : s'il est vraiment faux, `pulse-aidd tests-figes liberer <fichier>`, correction par le test-writer (mode « corriger »), `git add` et `pulse-aidd tests-figes figer <fichier>`, puis nouvelle vérification. Deux cycles de correction au plus, comme à l'étape 6 de `/pulse:fix`.
6. **Libérer** : `pulse-aidd tests-figes liberer` une fois le test vert. Le test fait partie du commit de la correction (`fix(<Tâche>): …` ou `fix: …`).

## 3. Dans le bilan

La ligne `Preuve` du bloc « 🩺 Correction » cite le test : `✅ test « <titre> » : rouge avant la correction, vert après — <fichier>`.

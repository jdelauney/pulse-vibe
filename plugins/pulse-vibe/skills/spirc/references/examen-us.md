# Examiner toute l'US (rythme rapide)

Utilisé par `/pulse:spirc` en rythme rapide, à la place de l'examen de chaque tâche (référence « Examiner une tâche »). Une seule relecture et une seule vérification, sur le code de toutes les tâches de l'US.

Quand toutes les tâches de la portée sont enregistrées, avant le test groupé :

1. **Tests** : lancer une fois toute la suite, avec les contrôles automatiques, par `pulse-aidd preuve lancer --portee suite` (outil Bash : `timeout` 600000) ; inscrire la ligne « Filet anti-régression : N tests, tous verts » (« — (aucun test automatique) » si « Tester » vaut « aucune », « — (aucun test écrit pour l'instant) » si la preuve le dit), tirée de sa ligne `preuve:`, dans le rapport de l'US (référence « Tests automatiques » § 2 ter) ; une preuve ❌ se corrige d'abord (étape 4). Le verifier relit cette preuve au lieu de relancer les tests.
2. **Examiner, en parallèle** (deux appels Agent dans le même message) :
   - `pulse:reviewer` : l'US (identifiant), les mêmes informations qu'au § 2 de « Examiner une tâche », et le code de **toutes** ses tâches : `git diff <départ>..HEAD`, où `<départ>` est le commit qui précède le premier commit des tâches (journal du plan, `git log`) ;
   - `pulse:verifier` : l'US, sa demande d'origine (l'intention de la spec), les critères d'acceptation de **toutes** ses tâches, le parcours principal `@manuel` de la spec en premier, et les fichiers modifiés depuis `<départ>`. Il lance l'application **une seule fois** pour toute l'US, sans la construction ni les contrôles longs (tests essentiels, référence « Tests automatiques » § 2 bis) : l'annoncer en une phrase, comme au § 2 de « Examiner une tâche ».
3. **Le rapport de l'US** : `revues/PLAN-SPEC-US-XXX-<nom>/US-<AAAA-MM-JJ>.md` (modèle : `pulse-aidd modele revue.md`, titre `US-XXX`, ligne `Mode` « /pulse:spirc rapide (toute l'US) »), rempli comme au § 3 de « Examiner une tâche ». `pulse-aidd revue US-XXX` donne où reprendre (`examen`, `correction`, `test` : le test groupé, `commit` : l'envoi, `aide`).
4. **Corriger** : constats du reviewer et critères ❌ du verifier, triés et confiés à la réalisation comme dans la boucle de `/pulse:spirc` (mode autonome, [R] étape 3) ; un commit `fix(US-XXX): …` ; puis la relecture de contrôle (§ 4 de « Examiner une tâche »), dans le même rapport. Deux cycles au plus.
5. Puis le test groupé (§ 3 bis de « Examiner une tâche ») : son résultat va dans « Test par la personne » de ce rapport.

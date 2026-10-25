# Tests automatiques

Utilisé par `/pulse:implement`, `/pulse:spirc` et `/pulse:test`. La méthode d'écriture des tests est dans `references/tests/` (`pulse-aidd tests <morceaux>`). La procédure des tests d'abord (option `-t`, rôles, rouge, vert, échecs) : `pulse-aidd reference tests-dabord.md`.


## 2. Choisir au démarrage

- **Option `-t`** : tests d'abord (`pulse-aidd reference tests-dabord.md`), sans question.
- **Rythme rapide** (profil de `CLAUDE.md`, ou option `-f` de `/pulse:spirc` ; sans `-t`) : tests essentiels (§ 2 bis), sans question.
- **Sans `-t`** : poser la question avec les autres questions de démarrage (même appel AskUserQuestion) quand la commande pose ses questions (voir la commande), avec la réponse recommandée selon « Tester » de « Commandes du projet » (`docs/technical.md`) :
  - commande présente : « Tests d'abord (Recommandé) » (un assistant écrit les tests avant le code, qui doit les faire passer) / « Sans tests automatiques » (le test manuel et la relecture seulement) ;
  - « aucune », et la documentation officielle de la pile retenue recommande un outil de test : « Installer un outil de test (Recommandé) » (§ 3, puis tests d'abord) / « Sans tests automatiques » (le test manuel et la relecture seulement) ;
  - « aucune », sans outil recommandé par la documentation de la pile, mais le langage du projet a un lanceur de tests intégré (`unittest` pour Python ; `node --test` pour JavaScript avec Node.js, et pour TypeScript avec Node.js 22.19 ou plus quand le code s'en tient à la syntaxe effaçable, importe ses fichiers avec l'extension `.ts` et n'utilise pas d'alias de chemins, sinon l'outil de test recommandé pour la pile) : « Utiliser le lanceur de tests intégré (Recommandé) » (l'outil de test fourni avec le langage, rien à installer ; § 3, puis tests d'abord) / « Sans tests automatiques » (le test manuel et la relecture seulement) ;
  - « aucune », du code à tester, mais ni outil recommandé par la documentation de la pile ni lanceur intégré au langage : « Installer un outil de test (Recommandé) » (§ 3, puis tests d'abord) / « Sans tests automatiques » (le test manuel et la relecture seulement) ;
  - « aucune », aucun code à tester automatiquement (pages HTML et CSS seules, outil sans code) : « Sans tests automatiques (Recommandé) » (le test manuel et la relecture seulement) / « Installer un outil de test, puis tests d'abord » (§ 3).
- Annoncer le choix dans la ligne de démarrage (« … · tests d'abord »).

## 2 bis. Tests essentiels (rythme rapide)

Le rythme rapide va à l'essentiel : tests essentiels (ci-dessous), tâches enchaînées en autonome par `/pulse:spirc` (`-a`), puis une fiche de test complète de l'US, faite par la personne à la fin ; le parcours principal de la spec est `@manuel`. Annoncé en une phrase ; les questions de besoin et les validations restent les mêmes.

- **Pas de tests d'abord** : l'implementer (ou la conversation, devant vous avec `-d`) écrit les tests avec le code, dans le même passage, les lance et donne leur résultat réel. Ni test-writer ni test-runner.
- **Seulement les tests d'intégration et de sécurité nécessaires** : une lecture ou une écriture d'informations qui porte une règle métier, et chaque règle d'accès `@securite`. Une tâche sans ce genre de règle n'a pas de test. Ni test unitaire, ni test de mise en page.
- **Aucun test de l'interface pendant les tâches** : ni test de bout en bout, ni application lancée ou interrogée, ni verifier (référence « Examiner une tâche », § 2). Avec `/pulse:spirc`, l'interface s'essaie une fois, sur toute l'US, par le verifier (`/pulse:spirc`, « Examiner toute l'US »), puis par la personne avec la fiche de test complète de l'US.
- **Seulement les contrôles rapides** : règles du code et types. La construction (commande « construire », ex. `next build`), les audits, les mesures de vitesse et tout contrôle long restent à la mise en ligne (`/pulse:deploy`, vérification automatique en ligne, hébergeur), même quand une consigne du pack ou une étape de recette les demande en cours de route.
- Chaque scénario `@integration` de la spec a son test (titre qui commence par son étiquette).
- **Lancés une seule fois par tâche, et seulement les siens** : à la fin de la tâche, la commande « Tester » limitée aux fichiers de test de la tâche (une tâche sans test : rien à lancer). Les contrôles rapides (règles du code, types) restent lancés. **Toute la suite tourne une seule fois**, quand toutes les tâches de l'US sont faites, avant le test groupé.

## 2 ter. Filet anti-régression (rythme complet)

Le filet attrape ce qu'une tâche casse ailleurs. Il vaut pour le rythme complet (profil `complet`), avec ou sans `-a`.

- **Avant le commit de chaque tâche** : toute la suite, pas seulement les tests de la tâche, doit être prouvée verte sur le code à enregistrer : `pulse-aidd preuve etat --exiger suite` ; si elle répond autre chose qu'« à jour », `pulse-aidd preuve lancer --portee suite`. La preuve vient d'ordinaire du test-runner ou du verifier, pendant l'examen. Un échec se corrige d'abord (« Trier les échecs » de `pulse-aidd reference tests-dabord.md`).
- **Tests de bout en bout** (ceux qui ouvrent un navigateur, ligne « Tester de bout en bout (navigateur) » de « Commandes du projet ») : lancés une fois, à la fin de l'US. `/pulse:spirc` : au « Test groupé » (autonome) ou à la « Fin ».
- **Rythme rapide** : inchangé, toute la suite tourne une fois à la fin de l'US (§ 2 bis).
- **La preuve** : la ligne `Filet anti-régression : N tests, tous verts` se tire de la ligne `preuve:` de `pulse-aidd preuve etat --exiger suite`, « à jour » et ✅ (code 0). Le script la lie au contenu des fichiers : un fichier modifié depuis la rend périmée. Une preuve ❌, périmée, absente ou de portée insuffisante ne prouve rien : relancer `pulse-aidd preuve lancer --portee suite` avant de dire « terminé ».
- **Suite trop longue** : au-delà de 2 minutes, le dire une fois à la personne, ne lancer plus que les tests de la tâche pour le reste de l'US (`pulse-aidd preuve lancer --portee tache <fichiers de test>`, lue par `pulse-aidd preuve etat` sans `--exiger suite`), et noter au journal du plan « filet limité aux tests de chaque tâche (suite > 2 min) ».

La ligne figure dans le rapport de revue (section « Vérification »), et dans le rapport de fin d'US en rythme rapide.

## 3. Si l'outil de test manque

« Tester » vaut « aucune » et la personne veut des tests :

1. Choisir l'outil recommandé par la documentation officielle de la pile retenue, version fixée, ou le lanceur intégré au langage (§ 2) ; à défaut, l'outil de test le plus répandu pour ce langage, version fixée. Règle commune « La personne décide » : choix technique, l'option la plus simple compatible avec « Pile retenue ». L'outil de bout en bout attend que `docs/prd.md` ou `docs/technical.md` en montrent le besoin.
2. Expliquer en une phrase ce qu'il apporte. Une bibliothèque à installer demande l'accord (règle commune « Des dépendances réelles et vérifiées ») ; un lanceur intégré au langage s'utilise tel quel : passer à l'étape 3.
3. Installer et configurer selon la documentation officielle, puis vérifier que la commande « tester » tourne (zéro test : réussite ou message « aucun test trouvé »).
4. Mettre à jour `docs/technical.md` : ligne « Tests automatiques » de « Pile retenue », « Tester » de « Commandes du projet », emplacement des tests dans « Organisation des fichiers » (`qualite/organisation.md` §7) ; puis la ligne correspondante du bloc `pulse_pile` de `CLAUDE.md`.
5. Enregistrer ce changement à part : `chore: outil de test <nom>`.

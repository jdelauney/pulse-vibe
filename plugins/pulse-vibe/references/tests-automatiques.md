# Tests automatiques : tests d'abord

Utilisé par `/pulse:implement` et `/pulse:spirc` (option `-t`, ou réponse « Tests d'abord » à la question de démarrage) et par `/pulse:test`. La méthode d'écriture des tests est dans `references/tests/` (`pulse-aidd tests`).

À expliquer en deux phrases, la première fois : « Avant d'écrire le code, un assistant écrit des tests : de petits programmes qui vérifient automatiquement que l'outil fait ce que la spec demande. On les voit d'abord échouer (le code n'existe pas encore), puis le code les fait passer : à chaque changement futur, ils préviendront si quelque chose casse. »

## 1. Les rôles

| Rôle | Qui | Laisse aux autres |
|---|---|---|
| Écrire les tests à partir des scénarios et des critères | sous-agent `pulse:test-writer` | le code de production |
| Lancer les tests, trier chaque échec et juger la qualité des tests | sous-agent `pulse:test-runner` | toute modification de fichier |
| Écrire le code qui fait passer les tests | sous-agent `pulse:implementer` (ou la conversation en mode direct) | les fichiers de test |
| Orchestrer, aiguiller les échecs, parler à la personne | la commande | — |

Si un sous-agent est indisponible : faire son travail soi-même en suivant **strictement** ses consignes (`pulse-aidd agent <nom>`), et le signaler. Le test-writer et l'implementer restent de préférence deux contextes distincts : des tests écrits par celui qui code finissent par vérifier le code plutôt que le besoin.

## 2. Choisir au démarrage

- **Option `-t`** : tests d'abord, sans question.
- **Sans `-t`** : poser la question avec les autres questions de démarrage (même appel AskUserQuestion) quand la commande pose ses questions (voir la commande), avec la réponse recommandée selon « Tester » de « Commandes du projet » (`docs/technical.md`) :
  - commande présente : « Tests d'abord (Recommandé) » (un assistant écrit les tests avant le code, qui doit les faire passer) / « Sans tests automatiques » (le test manuel et la relecture seulement) ;
  - « aucune », et la documentation officielle de la pile retenue recommande un outil de test : « Installer un outil de test (Recommandé) » (§ 3, puis tests d'abord) / « Sans tests automatiques » (le test manuel et la relecture seulement) ;
  - « aucune », sans outil de test connu pour cette pile : « Sans tests automatiques (Recommandé) » / « Installer un outil de test, puis tests d'abord » (§ 3).
- Annoncer le choix dans la ligne de démarrage (« … · tests d'abord »).

## 3. Si l'outil de test manque

« Tester » vaut « aucune » et la personne veut des tests :

1. Choisir l'outil recommandé par la documentation officielle de la pile retenue (règle commune « La personne décide » : choix technique, l'option la plus simple compatible avec « Pile retenue »), version fixée. L'outil de bout en bout attend que `docs/prd.md` ou `docs/technical.md` en montrent le besoin.
2. Expliquer en une phrase ce qu'il apporte, et demander l'accord pour l'installer (c'est une bibliothèque : règle commune « Des dépendances réelles et vérifiées »).
3. Installer et configurer selon la documentation officielle, puis vérifier que la commande « tester » tourne (zéro test : réussite ou message « aucun test trouvé »).
4. Mettre à jour `docs/technical.md` : ligne « Tests automatiques » de « Pile retenue », « Tester » de « Commandes du projet », emplacement des tests dans « Organisation des fichiers » (`qualite/organisation.md` §7) ; puis la ligne correspondante du bloc `pulse_pile` de `CLAUDE.md`.
5. Enregistrer ce changement à part : `chore: outil de test <nom>`.

## 4. Le cycle d'une tâche

Une tâche dont la ligne `Tests` du plan vaut « aucun » (mise en place, mise en page sans règle), ou une tâche « Mettre en ligne… », passe directement à la réalisation. Sans ligne `Tests` (plan plus ancien), le test-writer part des scénarios de la spec et des critères de la tâche.

### Rouge : écrire les tests

1. Déléguer à **`pulse:test-writer`**, mode « avant le code » : la tâche (identifiant, titre, objectif, fichiers), ses critères d'acceptation complets, sa ligne `Tests`, les **scénarios Gherkin** de la spec qu'elle couvre (recopiés), les règles métier de l'US, les « Informations manipulées » utiles de la spec et les « Données » de la conception technique du plan, les sections « Pile retenue », « Organisation des fichiers » et « Commandes du projet » de `docs/technical.md` (recopiées), les mots du glossaire utiles, et la consigne de charger `pulse-aidd tests`.
2. Déléguer à **`pulse:test-runner`**, phase « rouge attendu » : les fichiers de test écrits, la commande « tester », les critères de la tâche.
   - **🔴 Rouge confirmé** (chaque test échoue parce que le comportement manque) : continuer.
   - **⚠️ Rouge pour une mauvaise raison** (erreur dans le test lui-même) ou test qui passe déjà : renvoyer au test-writer la liste du test-runner, puis relancer le test-runner. Deux cycles au plus.
   - **⛔ Impossible à lancer** (outil absent ou cassé) : § 3, ou expliquer le blocage.
3. **Figer les tests** : `git add <fichiers de test>` (ajout à l'index, sans commit). Toute modification ultérieure de ces fichiers apparaîtra dans `git diff -- <fichiers de test>`.

### Vert : réaliser

4. Déléguer la tâche à **`pulse:implementer`** comme d'habitude, en ajoutant : les chemins des fichiers de test, l'**interface attendue** rapportée par le test-writer (fonctions, routes, paramètres, résultats), et la consigne « faire passer ces tests sans modifier les fichiers de test ; un test qui semble faux se conteste dans « Tests contestés », avec la raison ». En mode direct, s'appliquer la même consigne.
5. Déléguer à **`pulse:test-runner`**, phase « vert attendu » : les fichiers de test, les fichiers modifiés par la tâche, la commande « tester », les critères de la tâche, les tests contestés par l'implementer.

### Trier les échecs

| Verdict ou constat du test-runner | Destinataire | Ensuite |
|---|---|---|
| ✅ Vert, tests intacts | — | passer à la relecture (et, dans `/pulse:implement`, à « Vérifier vous-même ») |
| ❌ échec **dû au code** | `pulse:implementer`, avec la liste des échecs | relancer le test-runner |
| ❌ échec **dû au test** (ou test contesté confirmé) | `pulse:test-writer`, mode « corriger », avec la liste | `git add` des fichiers corrigés, puis relancer le test-runner |
| Tests modifiés pendant la réalisation (`git diff -- <fichiers de test>` non vide) | — | constat Critique : remettre les tests figés (`git restore -- <fichiers de test>`, avec l'accord demandé par Claude Code), puis renvoyer à l'implementer |
| ⛔ échec **dû à l'environnement** (base de test, variable, outil) | la personne ou la commande | guider pas à pas, puis relancer |
| Test **instable** | `pulse:test-writer` | corriger la cause (`tests/strategie.md` §4) |

- **Après toute correction ultérieure de la tâche** (constats de relecture, test manuel non concluant) : relancer le test-runner en phase « vert attendu » avec la relecture de contrôle.
- **Deux cycles de correction au plus**. Un échec qui persiste arrête la tâche (`[~]`) et s'explique simplement, avec `/pulse:get-help`.
- Un test contesté qui révèle un **écart de besoin** (le scénario ou le critère semble faux) se tranche avec la personne, quel que soit le mode. Si elle change le contrat : mettre à jour le scénario dans la spec, le critère dans l'US et la tâche dans le plan, puis reprendre au rouge.
- Les constats du test-runner sur la **qualité des tests** suivent « Les constats de relecture » (règles communes § 6).

## 5. Garder la trace

- **Rapport de revue** : section « Tests automatiques », remplie avec le verdict et les tableaux du test-runner (rouge, puis vert).
- **Rapport de réalisation** : la ligne « Contrôles » donne les tests écrits, lancés et leur résultat (`tests : 6 écrits, 6 lancés, tous réussis`).
- **Journal du plan** : remarque « tests d'abord » sur la ligne de la tâche ; « tests figés modifiés puis restaurés » si c'est arrivé.
- **Commit** : les tests font partie du commit de la tâche (`feat(T3): …`). Des tests ajoutés seuls, sur du code existant (`/pulse:test ecrire`) : `test(T3): …` ou `test: …`.

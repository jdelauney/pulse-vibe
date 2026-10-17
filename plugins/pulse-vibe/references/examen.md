# Examiner une tâche : relecture et vérification

Utilisé par `/pulse:review`, par la boucle de `/pulse:implement` (lancé sans numéro de tâche, elle passe par `/pulse:review`) et par `/pulse:spirc`. Une seule façon d'examiner une tâche, quel que soit le chemin : un assistant relit le code, un autre l'essaie en marche. Aucun des deux n'a écrit le code.

À expliquer en une phrase, la première fois : « Deux assistants qui n'ont pas écrit le code l'examinent : l'un le relit, l'autre lance l'application et essaie chaque critère. »

## 1. Les documents de référence

Pour la tâche `Tn`, dans le dossier de son epic `aidd_docs/tasks/<epic>/` : le plan qui la contient (`PLAN-SPEC-US-XXX-<nom>.md`), la spec et l'US du même dossier (`SPEC-US-XXX-<nom>.md`, `US-XXX-<nom>.md`), et le référentiel `docs/user-stories.md`.

## 2. Lancer l'examen

Lancer **en parallèle** (plusieurs appels Agent dans le même message) :

- **`pulse:reviewer`** : la tâche (identifiant et titre) et la racine du projet ; les documents de référence (§ 1), `docs/brief.md` et `aidd_docs/memory/glossary.md` ; la consigne de charger la checklist sécurité avec `pulse-aidd reference checklist-securite.md` ; les sections « Pile retenue », « Organisation des fichiers », « Commandes du projet », « Données et contrôle d'accès » et « Secrets et variables d'environnement » de `docs/technical.md` ; s'ils existent, le chemin de `docs/design.md` et celui de la maquette citée par la spec ou la tâche (`docs/design/maquettes/US-XXX-<nom>/retenue/`) ; la consigne de juger la qualité avec `pulse-aidd qualite`. Avec les tests d'abord : en plus, les fichiers de test et le dernier rapport du test-runner.
- **`pulse:verifier`** : la tâche, la **demande d'origine** (la phrase de la personne, ou l'objectif de la tâche), ses critères d'acceptation complets, les fichiers modifiés (`git status`, `git diff --stat`), la section « Commandes du projet » de `docs/technical.md` (contrôles automatiques, tests, lancer en local).
  Le verifier démarre lui-même l'application (commande « Lancer en local » de « Commandes du projet »), note l'adresse, puis l'arrête à la fin. Claude Code demande alors l'accord de la personne pour démarrer l'application et l'interroger : l'annoncer d'avance en une phrase (« Claude Code va vous demander l'accord pour lancer l'application et l'essayer : c'est ainsi que je prouve que chaque critère fonctionne. »).
- Avec le **contrôle de sécurité à chaque tâche** (option `-x` de `/pulse:spirc`) : **`pulse:security-auditor`**, avec la consigne de charger la checklist sécurité (`pulse-aidd reference checklist-securite.md`) et de se limiter aux fichiers modifiés par la tâche.

**Rythme rapide** (règles communes § 1) : avec `/pulse:spirc`, aucun examen par tâche : toute l'US s'examine une fois, à la fin (`spirc/examen-us.md`). Sinon : `pulse:reviewer` seul, sur le code de la tâche ; ni verifier, ni application lancée ou interrogée, ni test de l'interface pendant les tâches. Les tests de la tâche sont ceux lancés à la fin de sa réalisation. Chaque critère qui se voit à l'écran passe en ❓, vers la fiche de test de fin d'US ; la section « Vérification » du rapport porte « — (rythme rapide) ».

Un agent indisponible : faire son travail soi-même en suivant **strictement** ses consignes (`pulse-aidd agent <nom>`), en lecture seule, et le signaler. La relecture se fait de préférence dans un autre contexte que celui qui a écrit le code ; sinon, le dire à la personne.

## 3. Écrire le rapport

Avant d'écrire le rapport, comparer les constats du reviewer à ceux des rapports précédents de la même US. Même remarque sur deux tâches et motif sûr : proposer une règle contrôlée (`pulse-aidd reference controles-proposes.md`) ; en autonome, elle rejoint l'accord sur la mémoire du test groupé.

Un rapport par tâche, à côté du plan : `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/<Tâche>-<AAAA-MM-JJ>.md` (modèle « rapport de revue » ; créer le dossier au besoin ; suffixe `-2`, `-3` si un rapport du même jour existe). Il contient, dans l'ordre :

- la ligne `Mode` (la commande, et « contrôle de sécurité à chaque tâche » s'il y a lieu) ;
- le rapport du reviewer ;
- la section `## Vérification` : le verdict et le tableau du verifier (les captures de la colonne « Preuve » s'y affichent en images Markdown au chemin relatif `../../../../captures/US-XXX/<fichier>.png`, suivies de la phrase « Ces images restent sur cet ordinateur, jusqu'à l'envoi de l'US. »), puis la ligne « Filet anti-régression » (référence « Tests automatiques » § 2 ter) ;
- avec les tests d'abord, la section `## Tests automatiques` (verdicts et tableaux du test-runner, rouge puis vert) ;
- avec le contrôle de sécurité, la section `## Audit de sécurité`.

La ligne **Verdict** en tête résume l'ensemble : ✅ Validé quand le reviewer valide **et** qu'aucun critère du verifier n'est ❌ ; en rythme complet, il demande aussi un filet anti-régression vert.

Le **rapport de réalisation** présenté ensuite à la personne (règles communes § 4) se construit à partir du tableau du verifier.

## 3 bis. Écrire la fiche de test de la personne

À partir de la section « Test manuel » du verifier, écrire la fiche `aidd_docs/tasks/<epic>/SMOKE-TEST-US-XXX-<Tâche>-<titre-de-la-tache>.md` (modèle : `pulse-aidd modele smoke-test.md` ; règles : `pulse-aidd reference tests/test-manuel.md` § 1) : étapes détaillées geste par geste, critères ❓ du verifier en premier, résultat des contrôles automatiques en tête. Quand le verifier a gardé des captures, la fiche les montre en images Markdown au chemin relatif `../../captures/US-XXX/<fichier>.png` (là où l'écran attendu est décrit), avec la phrase « Ces images restent sur cet ordinateur, jusqu'à l'envoi de l'US. ». Dans le rapport, la section « Test manuel à faire par vous » donne seulement le lien vers la fiche.

Au moment du test : lancer l'application en arrière-plan (commande « lancer en local » de « Commandes du projet »), vérifier que l'adresse répond, puis donner à la personne le lien cliquable vers la fiche, sa durée et sa première étape. Les contrôles automatiques restent à l'assistant : la personne n'a aucune commande à taper. Arrêter l'application après sa réponse.

**Test groupé** (mode autonome, rythme rapide) : une seule fiche, complète, pour toute l'US : `aidd_docs/tasks/<epic>/SMOKE-TEST-US-XXX-<nom>.md`, qui reprend dans l'ordre du plan les étapes de chaque tâche, gardées dans leurs rapports (en rythme rapide, tirées de la section « Test manuel » du verifier de l'US). Les critères prouvés par le verifier y tiennent en une ligne ; les critères ❓ viennent d'abord.

## 4. Relecture de contrôle, après une correction

Relancer un examen court, limité aux constats corrigés : reviewer et verifier en parallèle (avec les tests d'abord, le test-runner en phase « vert attendu » ; avec le contrôle de sécurité, l'auditeur). Ajouter son résultat à la fin du même rapport, dans `## Relecture de contrôle` (date, verdict, points restants), puis mettre à jour la ligne **Verdict**. Quand la correction suit un test par la personne « ❌ non concluant » : remettre la ligne **Résultat** de `## Test par la personne` à la valeur du modèle (`✅ concluant | ❌ non concluant | ⏳ reporté au test groupé de fin de plan (mode autonome)`), et garder dans **Remarque** ce qui n'allait pas. `pulse-aidd revue <Tn>` donne alors `test`, même le jour du premier test : la personne refait le test.

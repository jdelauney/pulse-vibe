# Examiner une tâche : relecture et vérification

Utilisé par `/pulse:review`, par la boucle de `/pulse:implement` (lancé sans numéro de tâche, elle passe par `/pulse:review`) et par `/pulse:spirc`. Une seule façon d'examiner une tâche, quel que soit le chemin : un assistant relit le code, un autre l'essaie en marche. Aucun des deux n'a écrit le code.

À expliquer en une phrase, la première fois : « Deux assistants qui n'ont pas écrit le code l'examinent : l'un le relit, l'autre lance l'application et essaie chaque critère. »

## 1. Les documents de référence

Pour la tâche `Tn`, dans le dossier de son epic `aidd_docs/tasks/<epic>/` : le plan qui la contient (`PLAN-SPEC-US-XXX-<nom>.md`), la spec et l'US du même dossier (`SPEC-US-XXX-<nom>.md`, `US-XXX-<nom>.md`), et le référentiel `docs/user-stories.md`.

## 2. Lancer l'examen

Lancer **en parallèle** (plusieurs appels Agent dans le même message) :

- **`pulse:reviewer`** : la tâche (identifiant et titre) et la racine du projet ; les documents de référence (§ 1), `docs/brief.md` et `aidd_docs/memory/glossary.md` ; la **checklist sécurité complète**, recopiée dans le message (l'agent voit seulement les fichiers du projet) ; les sections « Pile retenue », « Organisation des fichiers », « Commandes du projet », « Données et contrôle d'accès » et « Secrets et variables d'environnement » de `docs/technical.md` ; s'ils existent, le chemin de `docs/design.md` et celui de la maquette citée par la spec ou la tâche (`docs/design/maquettes/US-XXX-<nom>/retenue/`) ; la consigne de juger la qualité avec `pulse-aidd qualite`. Avec les tests d'abord : en plus, les fichiers de test et le dernier rapport du test-runner.
- **`pulse:verifier`** : la tâche, la **demande d'origine** (la phrase de la personne, ou l'objectif de la tâche), ses critères d'acceptation complets, les fichiers modifiés (`git status`, `git diff --stat`), la section « Commandes du projet » de `docs/technical.md` (contrôles automatiques, tests, lancer en local).
  Le verifier démarre lui-même l'application (commande « Lancer en local » de « Commandes du projet »), note l'adresse, puis l'arrête à la fin.
- Avec le **contrôle de sécurité à chaque tâche** (option `-x` de `/pulse:spirc`) : **`pulse:security-auditor`**, avec la checklist sécurité complète et la consigne de se limiter aux fichiers modifiés par la tâche.

Un agent indisponible : faire son travail soi-même en suivant **strictement** ses consignes (`pulse-aidd agent <nom>`), en lecture seule, et le signaler. La relecture se fait de préférence dans un autre contexte que celui qui a écrit le code ; sinon, le dire à la personne.

## 3. Écrire le rapport

Un rapport par tâche, à côté du plan : `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/<Tâche>-<AAAA-MM-JJ>.md` (modèle « rapport de revue » ; créer le dossier au besoin ; suffixe `-2`, `-3` si un rapport du même jour existe). Il contient, dans l'ordre :

- la ligne `Mode` (la commande, et « contrôle de sécurité à chaque tâche » s'il y a lieu) ;
- le rapport du reviewer ;
- la section `## Vérification` : le verdict et le tableau du verifier ;
- avec les tests d'abord, la section `## Tests automatiques` (verdicts et tableaux du test-runner, rouge puis vert) ;
- avec le contrôle de sécurité, la section `## Audit de sécurité`.

La ligne **Verdict** en tête résume l'ensemble : ✅ Validé quand le reviewer valide **et** qu'aucun critère du verifier n'est ❌.

Le **rapport de réalisation** présenté ensuite à la personne (règles communes § 4) se construit à partir du tableau du verifier, et son test manuel commence par les critères ❓ du verifier.

## 4. Relecture de contrôle, après une correction

Relancer un examen court, limité aux constats corrigés : reviewer et verifier en parallèle (avec les tests d'abord, le test-runner en phase « vert attendu » ; avec le contrôle de sécurité, l'auditeur). Ajouter son résultat à la fin du même rapport, dans `## Relecture de contrôle` (date, verdict, points restants), puis mettre à jour la ligne **Verdict**.

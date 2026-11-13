# Audit de sécurité de fin de réalisation

Utilisé par `/pulse:spirc`, une seule fois, quand la réalisation est finie : à la fin du plan d'une US, ou à la fin d'une série (une fois pour toutes ses US). Les tâches, elles, se réalisent et se relisent sans contrôle de sécurité ; ses garde-fous immédiats restent actifs (règles de sécurité de l'implementer, contrôle des clés à chaque commit, tests des règles d'accès `@securite`).

À expliquer en une phrase, la première fois : « Un assistant spécialisé passe maintenant en revue la sécurité de tout ce qui vient d'être construit, en une seule fois. »

## 1. Quand

- Toutes les tâches de la portée sont passées (celles restées en pause en sont exclues), avant le test groupé ou la « Fin », et avant toute tâche « Mettre en ligne… ».
- Une seule fois par réalisation : sauté si le journal du plan (dans une série, celui de la dernière US construite) porte déjà la ligne « audit de sécurité de fin » de cette réalisation, et quand aucune tâche n'a été réalisée.
- En rythme rapide, il part en même temps que l'examen de l'US (`spirc/examen-us.md`). Dans une série, il attend la fin de la construction de toute la série (`spirc/serie.md` § 4).

## 2. Lancer l'audit

Écrire d'abord `aidd_docs/tasks/in-progress.md` (« Pour reprendre : `/pulse:spirc <US de la portée>` »). Lancer `pulse-aidd secrets historique`, puis l'outil Agent avec **`pulse:security-auditor`**, portée `realisation` : la racine du projet, les US réalisées et le chemin de leurs documents (US, spec, plan), le commit `<départ>` (celui qui précède le premier commit des tâches : journal du plan, `git log`), la liste `git diff --stat <départ>..HEAD`, et la sortie de `pulse-aidd secrets historique` (noms et types seulement, aucune valeur). L'agent lit lui-même la checklist et les documents du projet.

Agent indisponible : faire l'audit soi-même en suivant **strictement** `pulse-aidd agent security-auditor`, en lecture seule, et le signaler.

## 3. Le rapport

Écrire sa réponse, telle quelle, dans `aidd_docs/securite/<AAAA-MM-JJ>-<US-XXX>.md` (une série : les US à la suite, `2026-11-13-US-001-US-003.md` ; suffixe `-2` si le fichier existe), avec en tête le titre `# Audit de sécurité de fin – <US> – <date>` et la ligne `**Portée** : <départ>..<dernier commit>`.

## 4. Corriger

- Chaque ⛔ est un constat Critique, chaque ⚠️ un constat Moyenne : les trier et les confier à la réalisation comme les constats d'une relecture (règles de relecture ; `pulse:implementer`, une correction, avec la famille `securite`), puis un commit `fix(securite): …`.
- Relancer ensuite l'auditeur, portée `realisation`, limité aux points corrigés ; ajouter son résultat à la fin du rapport, dans `## Contrôle après correction`. Deux cycles au plus ; un ⛔ qui persiste devient une question pour la personne (mode autonome : « Questions en attente » de `/pulse:spirc`).
- Ajouter au journal de chaque plan concerné une ligne « audit de sécurité de fin : <niveau>, <n> bloquant(s), <n> corrigé(s) · <chemin du rapport> », enregistrée avec le rapport (`docs: audit de sécurité de fin de <US>`).

## 5. La fiche du cambrioleur

Les tests de la « Fiche du cambrioleur » de l'auditeur rejoignent le test de la personne : après les critères ❓ de la fiche du test groupé ; en rythme complet hors autonome, présentés à la « Fin », comme une courte fiche à part (`aidd_docs/tasks/<epic>/SMOKE-TEST-US-XXX-securite.md`, mêmes règles : `pulse-aidd reference tests/test-manuel.md` § 1).

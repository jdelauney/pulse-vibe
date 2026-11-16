# Relectures de fin de réalisation : sécurité, expérience et simplicité

Utilisé par `/pulse:spirc`, une seule fois, quand la réalisation est finie : à la fin du plan d'une US, ou à la fin d'une série (une fois pour toutes ses US). Les tâches, elles, se réalisent et se relisent sans contrôle de sécurité ; ses garde-fous immédiats restent actifs (règles de sécurité de l'implementer, contrôle des clés à chaque commit, tests des règles d'accès `@securite`).

À expliquer en une phrase, la première fois : « Des assistants spécialisés passent maintenant en revue, en une seule fois, la sécurité de tout ce qui vient d'être construit, ce que vivront les utilisateurs sur ses écrans, et ce qui peut s'écrire plus simplement. »

Ces relectures partent ensemble : l'audit de sécurité (§ 2), pour chaque US la relecture de la simplicité (§ 2 ter) et, pour chaque US dont la réalisation a changé un écran, la relecture de l'expérience (§ 2 bis). Toutes suivent les mêmes règles que l'audit pour le moment (§ 1), le tri et les corrections (§ 4).

## 1. Quand

- Toutes les tâches de la portée sont passées (celles restées en pause en sont exclues), avant le test groupé ou la « Fin », et avant toute tâche « Mettre en ligne… ».
- Une seule fois par réalisation : sauté si le journal du plan (dans une série, celui de la dernière US construite) porte déjà la ligne « audit de sécurité de fin » de cette réalisation, et quand aucune tâche n'a été réalisée ; les relectures de l'expérience et de la simplicité d'une US, de même, si son journal porte déjà la ligne « relecture de l'expérience de fin » ou « relecture de la simplicité de fin ».
- En rythme rapide, il part en même temps que l'examen de l'US (`spirc/examen-us.md`). Dans une série, il attend la fin de la construction de toute la série (`spirc/serie.md` § 4).

## 2. Lancer l'audit

Écrire d'abord `aidd_docs/tasks/in-progress.md` (« Pour reprendre : `/pulse:spirc <US de la portée>` »). Lancer `pulse-aidd secrets historique`, puis l'outil Agent avec **`pulse:security-auditor`**, portée `realisation` : la racine du projet, les US réalisées et le chemin de leurs documents (US, spec, plan), le commit `<départ>` (celui qui précède le premier commit des tâches : journal du plan, `git log`), la liste `git diff --stat <départ>..HEAD`, et la sortie de `pulse-aidd secrets historique` (noms et types seulement, aucune valeur). L'agent lit lui-même la checklist et les documents du projet.

Agent indisponible : faire l'audit soi-même en suivant **strictement** `pulse-aidd agent security-auditor`, en lecture seule, et le signaler.

## 2 bis. Lancer la relecture de l'expérience

Dans le même message que l'audit (appels Agent en parallèle), pour chaque US de la portée dont `git diff --stat <départ>..HEAD` montre un fichier d'interface (écran, composant, formulaire, selon « Organisation des fichiers » de `docs/technical.md`) : **`pulse:ux-reviewer`**, avec la racine du projet, l'US et le chemin de ses documents (US, spec, plan), le même `<départ>`, et, s'ils existent, les chemins de `docs/design.md`, `docs/voix.md`, `aidd_docs/memory/glossary.md` et des maquettes retenues de l'US (`docs/design/maquettes/US-XXX-<nom>/retenue/`). L'agent lit lui-même ses règles (`pulse-aidd qualite experience`) et les consignes du pack.

Agent indisponible : faire la relecture soi-même en suivant **strictement** `pulse-aidd agent ux-reviewer`, en lecture seule, et le signaler.

Sa réponse s'écrit telle quelle dans `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/experience-<AAAA-MM-JJ>.md` (suffixe `-2` si le fichier existe), avec en tête le titre `# Relecture de l'expérience de fin – US-XXX – <date>` et la ligne `**Portée** : <départ>..<dernier commit>`. Un verdict « ✅ Rien à signaler » termine cette relecture, sans correction.

## 2 ter. Lancer la relecture de la simplicité

Dans le même message (appels Agent en parallèle), pour chaque US de la portée : **`pulse:simplicity-reviewer`**, avec la racine du projet, l'US et le chemin de ses documents (US, spec, plan) et le même `<départ>`. L'agent lit lui-même ses règles (`pulse-aidd qualite clean-code`) et l'architecture du pack.

Agent indisponible : faire la relecture soi-même en suivant **strictement** `pulse-aidd agent simplicity-reviewer`, en lecture seule, et le signaler.

Sa réponse s'écrit telle quelle dans `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/simplicite-<AAAA-MM-JJ>.md` (suffixe `-2` si le fichier existe), avec en tête le titre `# Relecture de la simplicité de fin – US-XXX – <date>` et la ligne `**Portée** : <départ>..<dernier commit>`. Un verdict « ✅ Rien à signaler » termine cette relecture, sans correction.

## 3. Le rapport

Écrire sa réponse, telle quelle, dans `aidd_docs/securite/<AAAA-MM-JJ>-<US-XXX>.md` (une série : les US à la suite, `2026-11-13-US-001-US-003.md` ; suffixe `-2` si le fichier existe), avec en tête le titre `# Audit de sécurité de fin – <US> – <date>` et la ligne `**Portée** : <départ>..<dernier commit>`.

## 4. Corriger

- Chaque ⛔ est un constat Critique, chaque ⚠️ un constat Moyenne : les trier et les confier à la réalisation comme les constats d'une relecture (règles de relecture ; `pulse:implementer`, une correction, avec la famille `securite`), puis un commit `fix(securite): …`.
- Relancer ensuite l'auditeur, portée `realisation`, limité aux points corrigés ; ajouter son résultat à la fin du rapport, dans `## Contrôle après correction`. Deux cycles au plus ; un ⛔ qui persiste devient une question pour la personne (mode autonome : « Questions en attente » de `/pulse:spirc`).
- Les constats de la relecture de l'expérience gardent leur gravité (🔴 Critique, 🟠 Haute, 🟡 Moyenne, 🔵 Basse) et se traitent avec ceux de l'audit, selon les mêmes règles de relecture : `pulse:implementer`, une correction, avec les familles `experience` et `composants`, puis un commit `fix(experience): …`. Ceux de la relecture de la simplicité, de même, avec la famille `clean-code`, sans changer ce que voit la personne ; la suite de tests reste verte (preuve relancée), puis un commit `refactor(simplicite): …` et `pulse:simplicity-reviewer` relancé sur les constats corrigés. Relancer ensuite `pulse:ux-reviewer`, limité aux constats corrigés ; son résultat va à la fin de son rapport, dans `## Contrôle après correction`. Deux cycles au plus ; un Critique qui persiste devient une question pour la personne, comme un ⛔. Un constat marqué « ajout à décider » se présente d'abord à la personne (mode autonome : « Questions en attente » de `/pulse:spirc`) ; accepté, il se note dans « Ajouts proposés par Pulse » du plan avant la correction.
- Ajouter au journal de chaque plan concerné une ligne « audit de sécurité de fin : <niveau>, <n> bloquant(s), <n> corrigé(s) · <chemin du rapport> » et, après la relecture de l'expérience, « relecture de l'expérience de fin : <verdict>, <n> constat(s), <n> corrigé(s) · <chemin du rapport> » (« relecture de la simplicité de fin : … » de même), enregistrées avec les rapports (`docs: relectures de fin de <US>`).

## 5. La fiche du cambrioleur et les gestes à vérifier

Les points « À vérifier à la main » de la relecture de l'expérience rejoignent la fiche du test de la personne, juste après ses critères ❓, comme les tests de la « Fiche du cambrioleur ».

Les tests de la « Fiche du cambrioleur » de l'auditeur rejoignent le test de la personne : après les critères ❓ de la fiche du test groupé ; en rythme complet hors autonome, présentés à la « Fin », comme une courte fiche à part (`aidd_docs/tasks/<epic>/SMOKE-TEST-US-XXX-securite.md`, mêmes règles : `pulse-aidd reference tests/test-manuel.md` § 1).

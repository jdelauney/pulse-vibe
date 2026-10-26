---
description: Optimiser une skill Claude Code (moins de texte chargé) en gardant sa qualité, avec un plan à valider et une relecture avant / après
argument-hint: "<chemin d'une skill> (vide : la question vous le demande)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte optimize-skill) Bash(pulse-aidd skill mesurer *) Bash(pulse-aidd skill verifier *) Bash(pulse-aidd skill empreinte *) Bash(pulse-aidd modele audit-skill/*) Bash(pulse-aidd reference skills/*) Bash(pulse-aidd reference optimize-skill/*) Bash(pulse-aidd agent skill-auditor) Bash(pulse-aidd reference fichiers-projet.md) Bash(pulse-aidd reference cycle.md) Bash(pulse-aidd reference gestes.md) Bash(pulse-aidd reference secrets/fuite.md) Bash(git status *) Bash(git diff *) Read Glob Grep Write(.claude/skills/**) Edit(.claude/skills/**) Write(docs/audits-skills/**) Edit(docs/audits-skills/**)
---

# /pulse:optimize-skill – Optimiser une skill

## Objectif

Alléger une skill Claude Code (moins de texte chargé, donc moins de jetons à chaque lancement) en gardant la qualité de ce qu'elle produit. Une skill est une compétence que Claude Code charge : un dossier avec son fichier `SKILL.md`. Le déroulé : audit, plan point par point, votre validation, application, relecture avant / après, mesure. Le bilan s'ajoute au rapport d'audit, dans `docs/audits-skills/`.

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte optimize-skill` et lire sa sortie en entier) pendant toute la commande.

- Appliquer les règles des skills (« Règles des skills », dans le même contexte) : chaque point du plan cite sa règle `K<n>`.
- Garder chaque question clé, validation, point d'arrêt, refus et garde-fou de la skill (K12). Un texte déplacé dans `references/` se charge à l'étape qui le sert, avec sa condition (K6).
- Modifier seulement ce que la personne a validé, après avoir gardé l'avant (étape 5).
- Expliquer chaque terme technique la première fois, en mots simples : la description (la phrase qui dit à Claude quand utiliser la skill), le contexte (le texte que Claude garde en tête pendant le travail), les jetons (l'unité que compte Claude, environ 3,5 caractères).

## Contexte

Skill : `$ARGUMENTS` (vide : demander laquelle, en listant celles du projet, Glob `.claude/skills/*/SKILL.md`).

Une skill à la fois : son dossier ou son `SKILL.md`. Pour un dossier de skills, demander laquelle optimiser. Un audit sans modification : `/pulse:audit-skill`.

## Rôle

- La conversation principale orchestre : elle mesure, fait le plan, le fait valider, applique, fait relire et écrit le bilan.
- L'agent **`pulse:skill-auditor`** juge en lecture seule : l'audit de la skill, puis la comparaison avant / après.

## Processus

### 1. Vérifier la cible

1. Lancer `pulse-aidd skill mesurer <chemin>` et lire sa première ligne : `introuvable:` → le chemin n'existe pas, le dire et demander le bon ; `hors-format:` → ce n'est pas une skill Claude Code, le dire et s'arrêter ; plusieurs lignes `skill:` → demander laquelle optimiser.
2. Lancer `pulse-aidd skill verifier <chemin>`. Avec `installe: oui` en tête (chemin sous `plugins/cache/`, le dossier où Claude Code range les plugins installés) : laisser la skill telle quelle, car la prochaine mise à jour du plugin effacerait le changement ; indiquer le dossier source du plugin s'il est connu (catalogue local de `~/.claude/plugins/known_marketplaces.json`), sinon dire que la correction se fait chez l'auteur du plugin ; puis s'arrêter. Prochaine étape : tapez `/pulse:optimize-skill <chemin dans le dossier source>` depuis ce dossier.
3. Lancer `pulse-aidd skill empreinte <chemin>`.

Ces trois sorties sont la mesure « avant » : les garder pour le bilan.

### 2. L'audit

- Un rapport du jour existe (`docs/audits-skills/<nom>-<AAAA-MM-JJ>.md`, le nom de la skill) et sa section « Empreinte » donne la même empreinte pour chaque fichier : le reprendre, et le dire.
- Sinon : utiliser l'outil Agent avec **`pulse:skill-auditor`** en mode `audit`, avec le chemin de la skill, les lignes de `mesurer` et de `verifier`, l'usage « non lu », et si la skill est dans un plugin Pulse (`pulse`, `pulse-next`). Écrire ensuite le rapport d'après `pulse-aidd modele audit-skill/rapport.md`. Si l'assistant est indisponible, faire le jugement en suivant strictement `pulse-aidd agent skill-auditor`, en lecture seule.

### 3. Le plan, point par point

Lancer `pulse-aidd reference optimize-skill/plan.md` et lire sa sortie en entier. Tirer du rapport un plan numéroté, les bloquants d'abord : pour chaque point, la règle, le changement, le gain mesuré attendu, le risque pour la qualité ; puis ce qui reste tel quel, et pourquoi. L'ajouter au rapport (« Plan d'optimisation »). Un rapport sans constat : dire que la skill est déjà optimisée, et s'arrêter.

### 4. Votre validation

Montrer le plan : chaque point en une phrase de tous les jours, avec son gain, et le lien de chaque fichier touché (règle commune 19). Valider (AskUserQuestion : « Tout appliquer (Recommandé) » / « Une partie » / « Rien »). Une partie : la personne donne les numéros, en texte. Rien : le plan reste dans le rapport ; s'arrêter.

### 5. Garder l'avant

Lancer `git status --short -- <chemin>` depuis le projet :

- Sortie vide : la skill est suivie par Git, sans changement en cours ; l'avant est la version enregistrée.
- Sinon (une ligne `fatal:` : hors Git, le cas des skills personnelles de `~/.claude/skills/` ; ou des changements en cours) : faire une copie de sauvegarde du dossier à côté, `<dossier>.avant-<AAAA-MM-JJ>/`, avant toute modification. Dans la copie, renommer `SKILL.md` en `SKILL.md.avant`, pour que Claude Code la laisse de côté au lieu de la charger comme une deuxième skill. Dire en une phrase que Claude Code demande l'accord pour cette copie. Une copie du même jour existe déjà : la garder, c'est l'état d'avant la première optimisation du jour.

### 6. Appliquer

- Appliquer les points validés, et eux seuls. Dans `.claude/skills/` du projet, l'écriture se fait sans demande ; ailleurs (skills personnelles, plugin), Claude Code demande l'accord pour chaque fichier : le dire une fois.
- Dans un plugin Pulse : suivre en plus le `CLAUDE.md` du dépôt (plafond de `budget-contexte.test.js` abaissé avec la mesure et la raison, tests).
- Lancer `pulse-aidd skill mesurer <chemin>` et `pulse-aidd skill verifier <chemin>` : un nouveau constat bloquant se corrige tout de suite.

### 7. La relecture avant / après

Utiliser l'outil Agent avec **`pulse:skill-auditor`** en mode `avant-apres`, avec le paramètre `model` à `opus` (la comparaison demande le jugement le plus fin). Le message donne le chemin d'après, l'avant (le chemin de la copie, ou les changements donnés par `git diff -- <fichier>`, un appel par fichier modifié) et les points appliqués.

- `Verdict : aucune perte` : passer au bilan.
- `Verdict : pertes (<n>)` : rendre chaque perte selon la correction proposée, une fois, puis relancer `pulse-aidd skill verifier <chemin>`. Une perte qui reste va dans le bilan, et se dit en premier à la personne.

Si l'assistant est indisponible, faire la comparaison en suivant strictement le mode `avant-apres` de `pulse-aidd agent skill-auditor`, en lecture seule.

### 8. Le bilan

Ajouter au rapport le « Bilan avant / après » de `plan.md` : les tailles et les constats avant et après, le verdict de la relecture, les points appliqués et laissés. Présenter :

- le gain : caractères et jetons estimés en moins, au lancement et à chaque lecture ;
- le verdict de la relecture ;
- le lien du rapport, et celui de la copie de sauvegarde s'il y en a une (à supprimer vous-même quand le résultat vous convient).

Terminer avec le bloc de fin de commande. Prochaine étape, dans un dossier suivi par Git : tapez `/pulse:commit` pour enregistrer la skill optimisée. Hors Git : tapez `/<nom>` avec un exemple réel, pour l'essayer.

## Exemples

- `/pulse:optimize-skill .claude/skills/rediger-devis` : un plan en 4 points (« le détail des remises lu seulement quand il y a une remise : 3 000 caractères en moins à chaque devis »), vous validez, la skill est allégée, puis relue pour vérifier qu'aucune question ni vérification ne s'est perdue.
- `/pulse:optimize-skill ~/.claude/skills/resumer-reunion` : une skill personnelle ; une copie de sauvegarde est faite à côté avant tout changement.

## Références de la commande

!`pulse-aidd contexte optimize-skill`

Ce contexte contient « Règles des skills » (K1 à K14). Si ce contexte est absent, lancer `pulse-aidd contexte optimize-skill` et lire sa sortie.

---
description: Auditer une skill, un dossier de skills ou un plugin selon les règles d'optimisation, avec un rapport et sans rien modifier
argument-hint: "[chemin d'une skill, d'un dossier de skills ou d'un plugin] (par défaut : .claude/skills/)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte audit-skill) Bash(pulse-aidd skill mesurer *) Bash(pulse-aidd skill verifier *) Bash(pulse-aidd modele audit-skill/*) Bash(pulse-aidd reference skills/*) Bash(pulse-aidd agent skill-auditor) Bash(pulse-aidd reference fichiers-projet.md) Bash(pulse-aidd reference cycle.md) Bash(pulse-aidd reference gestes.md) Bash(pulse-aidd reference secrets/fuite.md) Bash(git hash-object *) Read Glob Grep Write(docs/audits-skills/**)
---

# /pulse:audit-skill – Auditer des skills

## Objectif

Dire si une ou plusieurs skills Claude Code respectent les règles K1 à K14 (tirées du refactoring d'optimisation de Pulse), et ce que chaque correction ferait gagner. Une skill est une compétence que Claude Code charge : un dossier avec son fichier `SKILL.md`. Le résultat est un rapport dans `docs/audits-skills/`. Rien n'est modifié dans les skills.

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte audit-skill` et lire sa sortie en entier) pendant toute la commande.

- Appliquer les règles des skills (« Règles des skills », dans le même contexte) : chaque constat cite sa règle `K<n>`.
- Travailler en lecture seule : la seule écriture est le rapport.
- Expliquer chaque terme technique la première fois, en mots simples : la description (la phrase qui dit à Claude quand utiliser la skill), le contexte (le texte que Claude garde en tête pendant le travail), les jetons (l'unité que compte Claude, environ 3,5 caractères).

## Contexte

Cible : `$ARGUMENTS` (vide = les skills du projet, `.claude/skills/`).

Fichiers de cette commande : [assets/rapport.md](assets/rapport.md).

La cible peut être une skill (son dossier ou son `SKILL.md`), un agent (`agents/<nom>.md`), un dossier de skills, un dossier `.claude/` (skills et agents) ou un plugin entier.

## Rôle

- La conversation principale orchestre : elle choisit la cible, lance le contrôle par script, demande l'accord pour l'historique, répartit les skills entre les assistants, écrit le rapport et le présente.
- L'agent **`pulse:skill-auditor`** juge les skills en lecture seule (doublons, utilité, chargement, validations, destinataire).

## Processus

### 1. Choisir la cible

- Avec un argument : l'auditer tel quel.
- Sans argument : les skills et agents du projet (chemin `.claude`, qui couvre `.claude/skills/` et `.claude/agents/`). Proposer d'ajouter les skills personnelles de la personne, rangées dans `~/.claude/skills/` (AskUserQuestion : « Seulement celles du projet (Recommandé) » / « Aussi mes skills personnelles »).
- `mesurer` répond par son mode d'emploi (code 1) : le chemin n'existe pas. Le dire et demander le bon chemin.
- `hors-format:` : ce n'est pas une skill Claude Code. Le dire et s'arrêter.
- `installe: oui` : skill d'un plugin installé. L'audit continue ; une correction se fera dans le dossier source du plugin, car une mise à jour remplace ce dossier.

### 2. Le constat par script

1. Lancer `pulse-aidd skill mesurer <chemin>`, puis `pulse-aidd skill verifier <chemin>`, pour chaque cible. Lire chaque sortie en entier. Ces deux sorties sont la preuve du constat : les assistants la reçoivent et la reprennent.
2. Calculer l'empreinte des fichiers (pour savoir plus tard s'ils ont changé) : lister avec Glob les fichiers de chaque skill (`SKILL.md`, `references/`, `assets/`, `scripts/`) et de chaque agent, puis `git hash-object <fichiers>` en un appel. Sans Git : la taille de chaque fichier donnée par `mesurer`.

### 3. L'usage observé, avec votre accord

Proposer de compter les lancements de chaque skill dans l'historique des conversations Claude Code de cet ordinateur (`~/.claude/projects/`, 90 derniers jours). Dire en une phrase que rien n'est envoyé ailleurs et que Claude Code demandera l'autorisation de lire ce dossier (AskUserQuestion : « Oui, lire l'historique (Recommandé) » / « Non, auditer sans l'usage »).

- Oui : lancer `pulse-aidd skill usage` (ou `pulse-aidd skill usage --depuis <AAAA-MM-JJ>` pour une autre période). Garder les lignes `usage:` des skills auditées (nom seul ou `<plugin>:<nom>`). Une skill absente des lignes est « non observée sur la période » : elle reste en place. Une skill d'incident, de sécurité, de reprise ou de migration garde sa place pour ce seul motif. `historique: absent` : l'usage est « non lu (historique absent) ».
- Non : l'usage est « non lu ».

### 4. Le jugement, par lots

Répartir les skills en lots de 5 skills au plus (chaque agent avec la skill qui l'appelle). Pour chaque lot, utiliser l'outil Agent avec **`pulse:skill-auditor`** en mode `audit` ; plusieurs lots se lancent en parallèle, dans le même message. Le message donne :

- le mode `audit` et les chemins des skills du lot (l'assistant lit lui-même les fichiers) ;
- les lignes de `mesurer` et de `verifier` qui concernent le lot, avec `descriptions-total:` et les `recoupement:` ;
- les lignes `usage:` du lot avec leur période, ou « non lu » ;
- si la cible est dans un plugin Pulse (`pulse`, `pulse-next`).

Si l'assistant est indisponible, faire le jugement en suivant strictement la méthode et le format de `pulse-aidd agent skill-auditor`, en lecture seule.

### 5. Le rapport

Partir du modèle `pulse-aidd modele audit-skill/rapport.md` et écrire `docs/audits-skills/<nom>-<AAAA-MM-JJ>.md` :

- `<nom>` : le nom de la skill ; pour un dossier, un seul rapport, au nom du dossier (`skills-projet` pour `.claude`, `skills-personnelles` pour `~/.claude/skills/`, le nom du plugin pour un plugin) ;
- un rapport du même nom et du même jour est remplacé ;
- les constats du script et ceux des assistants, rangés par gravité, les bloquants d'abord, chacun avec sa correction et son gain estimé.

Rien n'est modifié en dehors de ce rapport.

### 6. Présenter

- Le bilan : nombre de skills auditées, de bloquants, de points à corriger et de conseils.
- Les 3 constats qui comptent le plus, chacun en une phrase de tous les jours, avec ce que la correction apporte.
- Le gain estimé si tout est corrigé, et le lien vers le rapport.

Terminer avec le bloc de fin de commande. Prochaine étape : corriger les constats bloquants, en suivant la correction proposée par le rapport.

## Exemples

- `/pulse:audit-skill` : les skills de votre projet passent au crible ; vous choisissez si l'on compte leurs lancements ; un rapport vous dit quoi corriger et ce que vous y gagnez.
- `/pulse:audit-skill .claude/skills/rediger-devis` : l'audit d'une seule skill.
- `/pulse:audit-skill plugins/mon-plugin` : toutes les skills et tous les agents d'un plugin, avec les doublons entre skills.

## Références de la commande

!`pulse-aidd contexte audit-skill`

Ce contexte contient « Règles des skills » (K1 à K14). Si ce contexte est absent, lancer `pulse-aidd contexte audit-skill` et lire sa sortie.

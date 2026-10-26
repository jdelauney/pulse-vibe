---
description: Créer une skill Claude Code qui respecte les règles d'optimisation, après quelques questions sur son travail
argument-hint: "[ce que la skill doit faire] (vide : la première question vous le demande)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte skill-creator) Bash(pulse-aidd skill mesurer *) Bash(pulse-aidd skill verifier *) Bash(pulse-aidd modele skill-creator/*) Bash(pulse-aidd reference skills/*) Bash(pulse-aidd reference fichiers-projet.md) Bash(pulse-aidd reference cycle.md) Bash(pulse-aidd reference gestes.md) Bash(pulse-aidd reference secrets/fuite.md) Read Glob Grep Write(.claude/skills/**) Edit(.claude/skills/**)
---

# /pulse:skill-creator – Créer une skill

## Objectif

Écrire avec la personne une skill Claude Code juste du premier coup : un seul travail, une description claire, des autorisations précises, un déroulé court, et le détail chargé au moment où il sert. Une skill est une compétence que Claude Code charge : un dossier avec son fichier `SKILL.md`. Le résultat est une skill ordinaire, qui fonctionne sans Pulse.

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte skill-creator` et lire sa sortie en entier) pendant toute la commande.

- Appliquer à la skill écrite les règles des skills (« Règles des skills », dans le même contexte) : K1 à K14.
- Écrire une skill ordinaire, sans `pulse-aidd` : ses consignes citent les outils de Claude Code et ceux du projet. Dans un plugin Pulse, suivre en plus les conventions du dépôt (étape 3).
- Poser seulement les questions qui changent ce qui est construit ; ce que l'argument ou le projet dit déjà se reprend sans question.
- Expliquer chaque terme technique la première fois, en mots simples : la description (la phrase qui dit à Claude quand utiliser la skill), les autorisations (les commandes que la skill lance sans vous demander), le contexte (le texte que Claude garde en tête pendant le travail), les jetons (l'unité que compte Claude, environ 3,5 caractères).

## Contexte

Demande : `$ARGUMENTS` (vide : la première question vous la demande).

Fichiers de cette commande : [assets/SKILL.md](assets/SKILL.md) (le modèle d'une skill).

Où ranger une skill :

- dans le projet, `.claude/skills/<nom>/` : elle suit le projet ; écrite sans demande ;
- pour la personne, `~/.claude/skills/<nom>/` : dans tous ses projets, sur cet ordinateur ; Claude Code demande l'accord pour chaque fichier ;
- dans un plugin, `<plugin>/skills/<nom>/` : Claude Code demande l'accord pour chaque fichier.

## Processus

### 1. Comprendre le travail

Poser les questions de fond une à la fois, dans cet ordre (règles communes 4 et 5), en sautant celles dont la réponse est déjà connue :

1. **Le travail** : ce que la skill fait, du début à la fin, et ce qu'elle rend (réponse libre, en texte). Deux travaux distincts : proposer deux skills (K1). Chercher dans `.claude/skills/` (Glob `.claude/skills/*/SKILL.md`) une skill qui fait déjà ce travail, et le dire.
2. **Les phrases** que la personne dira pour s'en servir (réponse libre) : elles donnent les exemples, et les déclencheurs de la description si Claude peut la lancer.
3. **Qui la lance** (AskUserQuestion, la réponse recommandée selon ses effets en premier, K3) : « Vous seul, en tapant /<nom> » pour une skill qui écrit, envoie, coûte ou charge beaucoup ; « Vous, et Claude quand la demande s'y prête » pour une skill sans effet, utile en plein travail.
4. **Ce qu'elle touche** : fichiers lus et écrits, commandes lancées, services en ligne (réponse libre). Un envoi, une suppression, un changement de configuration ou une mise en ligne reste soumis à l'accord de la personne (K4).
5. **À qui elle parle** : la langue et le ton de ce qu'elle montre (AskUserQuestion : « En français, en vouvoyant (Recommandé) » / « En français, en tutoyant » / « En anglais »).
6. **Où la ranger** (AskUserQuestion : « Dans ce projet, `.claude/skills/` (Recommandé) » / « Pour moi, dans tous mes projets » / « Dans un plugin »). Pour vous : `~/.claude/skills/<nom>/` ; pour un plugin : demander son dossier.

Proposer ensuite un nom court, tiré du travail : minuscules, chiffres et tirets, 64 caractères au plus. Si le dossier `<emplacement>/<nom>/` existe déjà, il reste tel quel : proposer un autre nom ; pour améliorer la skill existante, tapez `/pulse:optimize-skill <chemin>`.

### 2. Proposer le plan de la skill

Montrer en une liste courte, avec le lien de chaque fichier à créer (règle commune 19) :

- le nom, l'emplacement, et la description proposée (K2) ;
- qui la lance, et les autorisations : un motif précis par commande lancée (`Bash(git status *)`, `Write(docs/**)`) ; les gestes sensibles passent par l'accord (K4) ;
- les étapes du Processus, une ligne chacune ;
- ce qui va dans `references/` (le détail d'un mode ou d'une étape, lu à l'étape qui le sert, K6), dans `assets/` (les modèles de fichiers) et dans un script (un travail qui se compte, se contrôle ou se déplace, K10).

Valider (AskUserQuestion : « Écrire cette skill (Recommandé) » / « Changer quelque chose »). Changer : ajuster, puis montrer le plan à nouveau.

### 3. Écrire

Lancer `pulse-aidd modele skill-creator/SKILL.md` et partir de ce modèle :

- **En-tête** : `name` ; `description` qui commence par ce que la skill fait, puis, si Claude peut la lancer, « À utiliser quand … » avec les phrases de la personne ; 50 à 300 caractères ; entre guillemets si elle contient « : » ; `disable-model-invocation: true` si la personne seule la lance ; `allowed-tools` du plan.
- **Corps** : Objectif, Règles, Contexte, Processus, Exemples, Références. Le Processus se termine dans les 5 000 premiers jetons estimés du fichier (environ 17 500 caractères), car une compaction (le résumé automatique d'une longue conversation) garde seulement le début d'une skill (K5). Une question clé à la fois, la réponse recommandée en premier (K12). Des consignes dites positivement (K9), dans la langue et le ton choisis (K13).
- **Références** : le détail d'un mode ou d'une étape dans `references/<fichier>.md`, avec sa condition dans le Processus (« Pour une première fois : lire `references/premiere.md` ») ; chaque fichier sous 30 000 caractères (K7).
- **Script** : dans `scripts/`, il refuse d'avance plutôt que de défaire après, et sort avec un code clair (0 fait, 1 usage, 2 refus avant tout changement, 3 échec rattrapé) ; la skill le lance avec un motif précis dans `allowed-tools` (K10).

Dans un plugin Pulse (son `.claude-plugin/plugin.json` s'appelle `pulse` ou `pulse-next`) : suivre en plus le `CLAUDE.md` du dépôt (trame Pulse, contexte de la commande injecté en dernière section, plafonds de `budget-contexte.test.js`, page du wiki, README et mémo).

### 4. Contrôler et mesurer

1. Lancer `pulse-aidd skill verifier <chemin>` et lire sa sortie en entier ; corriger chaque constat bloquant et relancer, jusqu'à aucun bloquant (code 0). Corriger aussi les points « à corriger » quand la correction garde le plan validé ; sinon, les expliquer. Après trois passages avec un bloquant restant, le montrer à la personne avec la correction proposée.
2. Lancer `pulse-aidd skill mesurer <chemin>` : la taille chargée au lancement, la fin du Processus, la plus grande lecture.

### 5. Présenter

- Le lien de chaque fichier écrit.
- Ce que la skill charge : à chaque lancement (caractères et jetons estimés), et en permanence si Claude peut la lancer (sa description).
- Comment la lancer : `/<nom>` (dans un plugin : `/<plugin>:<nom>`) ; si Claude peut la lancer, les phrases qui la déclenchent. Si la commande n'apparaît pas, relancer Claude Code.
- Le bilan du contrôle (bloquants, points à corriger, conseils).

Proposer un essai sur un vrai exemple : ce qui ne va pas se corrige ensuite, en le disant simplement.

Terminer avec le bloc de fin de commande. Prochaine étape : tapez `/<nom>` avec un exemple réel, pour l'essayer.

## Exemples

- `/pulse:skill-creator rédiger un devis à partir d'une demande client` : quelques questions (vos phrases, qui la lance, où la ranger), un plan à valider, puis la skill écrite dans `.claude/skills/rediger-devis/` et contrôlée.
- `/pulse:skill-creator` : Claude vous demande d'abord ce que la skill doit faire.

## Références de la commande

!`pulse-aidd contexte skill-creator`

Ce contexte contient « Règles des skills » (K1 à K14). Si ce contexte est absent, lancer `pulse-aidd contexte skill-creator` et lire sa sortie.

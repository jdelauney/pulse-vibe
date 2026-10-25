---
description: Préparer une demande d'aide claire et sans secret, à transmettre à une personne qui programme (forum, communauté de la technologie, freelance) quand Pulse n'arrive pas à débloquer la situation
argument-hint: "[\"ce qui bloque\"] (facultatif)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte get-help) Bash(pulse-aidd reference *) Bash(pulse-aidd revue *) Bash(pulse-aidd modele *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd pile contexte *) Read Glob Grep Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git remote -v) Bash(git remote get-url *) Bash(git rev-parse *) Write(docs/aide/**) Edit(docs/aide/**)
---

# /pulse:get-help – Préparer une demande d'aide

## Objectif

Quand Pulse n'arrive pas à débloquer une situation, préparer une **demande d'aide** qu'une personne qui programme pourra comprendre en deux minutes : le contexte, l'erreur exacte, ce qui a déjà été essayé, une question précise. Une phrase d'explication : « Une bonne demande d'aide obtient une réponse rapide : je rassemble pour vous tout ce qu'un développeur aurait besoin de savoir, sans vos secrets. »

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte get-help` et lire sa sortie en entier) pendant toute la commande.

Cette commande écrit seulement la fiche `docs/aide/demande-<AAAA-MM-JJ>-<sujet>.md`. Elle ne publie rien : c'est la personne qui choisit où l'envoyer.

## Contexte

Description reçue (facultative) : `$ARGUMENTS`

Fichiers de cette commande : [assets/demande-aide.md](assets/demande-aide.md).

## Rôle

La conversation principale orchestre : elle comprend le blocage, nettoie les secrets, écrit la fiche et aide à choisir où l'envoyer ; s'il y a du code, l'agent `pulse:explorer` cherche dans le projet (étape 2).

## Processus

### 1. Comprendre

Reprendre ce que la conversation, la description reçue et le projet disent déjà (dernier blocage expliqué par `/pulse:fix`, `/pulse:review`, `/pulse:implement` ou `/pulse:spirc`). Poser seulement ce qui manque : ce que la personne voulait faire et ce qui se passe à la place (réponse libre, en texte), puis, si besoin, le partage de l'adresse du dépôt (AskUserQuestion).

### 2. Rassembler

Relever d'abord la **ligne décisive** de l'erreur (message, console ou journal) et les corrections déjà tentées dans la conversation, qu'un sous-agent ne voit pas, puis la dernière relecture de la tâche en cours (`pulse-aidd revue <Tn>`). S'il y a du code, les transmettre au sous-agent **`pulse:explorer`** et lui confier (sans code, faire ces recherches soi-même) :
- la pile et ses versions (« Pile retenue » de `docs/technical.md`, fichier de dépendances) ;
- l'US et la tâche concernées (plan `[~]`, fichier de l'US) ;
- le Journal du plan et `git log --oneline -10` ;
- les étapes pour reproduire d'après la spec, avec des données fictives ;
- les fichiers concernés, avec leur rôle.

« Déjà essayé » réunit les corrections relevées dans la conversation et ce que rapporte l'explorer.

### 3. Nettoyer

Remplacer toute clé, tout mot de passe, toute adresse de base de données et toute donnée réelle par une valeur fictive (`sk_test_XXXX`, `client@example.com`), et le dire en une ligne. Le garde-fou anti-secrets de Pulse vérifie aussi la fiche à l'écriture. Si la personne a collé une vraie clé ou un vrai mot de passe pendant l'échange, ou si le garde-fou bloque l'écriture de la fiche : la valeur est exposée ; appliquer tout de suite `pulse-aidd reference secrets/fuite.md` avant d'envoyer la demande.

### 4. Écrire

Remplir le modèle « demande d'aide » et écrire `docs/aide/demande-<AAAA-MM-JJ>-<sujet>.md` (`<sujet>` : minuscules, sans accent, mots séparés par des tirets, 40 caractères au plus). Le **message court** en tête tient en 10 lignes et se suffit à lui-même.

### 5. Où demander

Proposer (AskUserQuestion) où l'envoyer, la personne choisit :
- **la communauté officielle de la technologie retenue** (forum, Discord, GitHub Discussions) : la trouver dans sa documentation officielle et donner le lien vérifié ;
- **une plateforme de freelances**, pour une aide payante et rapide ;
- **une personne de son entourage** qui programme : lui transmettre la fiche complète.

Expliquer en une ligne comment l'envoyer (copier le message court, joindre ou coller la fiche complète). Rappeler que la fiche est sans secret, mais que la personne garde la main sur ce qu'elle partage.

Terminer avec le bloc de fin de commande. Prochaine étape : une fois la réponse reçue, `/pulse:fix "<la piste proposée>"` pour l'appliquer avec Pulse.

## Exemples

- `/pulse:get-help "la page de connexion reste blanche"` : quelques questions si besoin, puis une fiche prête à envoyer, sans vos mots de passe ni vos clés, et le choix de l'endroit où demander.
- `/pulse:get-help` sans argument : le dernier blocage de la conversation sert de point de départ.

## Références de la commande

!`pulse-aidd contexte get-help`

Le modèle cité dans cette commande figure dans ce contexte. Si ce contexte est absent, lancer `pulse-aidd contexte get-help` et lire sa sortie.

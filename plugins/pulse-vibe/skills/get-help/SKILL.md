---
description: Préparer une demande d'aide claire et sans secret, à transmettre à une personne qui programme (forum, communauté de la technologie, freelance) quand Pulse n'arrive pas à débloquer la situation
argument-hint: "[\"ce qui bloque\"] (facultatif)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte get-help) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd pile contexte *) Read Glob Grep Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git remote -v) Bash(git remote get-url *) Bash(git rev-parse *)
---

# /pulse:get-help – Préparer une demande d'aide

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte get-help`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Le modèle cité plus bas figure ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte get-help` et lire sa sortie.

Description reçue (facultative) : `$ARGUMENTS`

## Objectif

Quand Pulse n'arrive pas à débloquer une situation, préparer une **demande d'aide** qu'une personne qui programme pourra comprendre en deux minutes : le contexte, l'erreur exacte, ce qui a déjà été essayé, une question précise. Une phrase d'explication : « Une bonne demande d'aide obtient une réponse rapide : je rassemble pour vous tout ce qu'un développeur aurait besoin de savoir, sans vos secrets. »

Cette commande écrit seulement la fiche `docs/aide/demande-<AAAA-MM-JJ>-<sujet>.md`. Elle ne publie rien : c'est la personne qui choisit où l'envoyer.

## Déroulé

### 1. Comprendre

Reprendre ce que la conversation, la description reçue et le projet disent déjà (dernier blocage expliqué par `/pulse:fix`, `/pulse:review`, `/pulse:implement` ou `/pulse:spirc`). Poser seulement ce qui manque, en une ronde (AskUserQuestion, 3 questions au plus) : ce que la personne voulait faire, ce qui se passe à la place, si elle accepte de partager l'adresse du dépôt.

### 2. Rassembler

S'il y a du code, confier la recherche au sous-agent **`pulse:explorer`** (sinon, la faire soi-même) :
- la pile et ses versions (« Pile retenue » de `docs/technical.md`, fichier de dépendances) ;
- l'US et la tâche concernées (plan `[~]`, fichier de l'US) ;
- l'erreur exacte : la **ligne décisive** du message, de la console ou du journal ;
- les étapes pour reproduire, avec des données fictives ;
- ce qui a déjà été essayé : Journal du plan, rapports de relecture de la tâche, `git log --oneline -10`, corrections tentées dans la conversation ;
- les fichiers concernés, avec leur rôle.

### 3. Nettoyer

Remplacer toute clé, tout mot de passe, toute adresse de base de données et toute donnée réelle par une valeur fictive (`sk_test_XXXX`, `client@example.com`), et le dire en une ligne. Le garde-fou anti-secrets de Pulse vérifie aussi la fiche à l'écriture. Si la personne a collé une vraie clé ou un vrai mot de passe pendant l'échange, ou si le garde-fou bloque l'écriture de la fiche : la valeur est exposée ; proposer `/pulse:secrets fuite` avant d'envoyer la demande.

### 4. Écrire

Remplir le modèle « demande d'aide » et écrire `docs/aide/demande-<AAAA-MM-JJ>-<sujet>.md` (`<sujet>` : minuscules, sans accent, mots séparés par des tirets, 40 caractères au plus). Le **message court** en tête tient en 10 lignes et se suffit à lui-même.

### 5. Où demander

Proposer (AskUserQuestion) où l'envoyer, la personne choisit :
- **la communauté officielle de la technologie retenue** (forum, Discord, GitHub Discussions) : la trouver dans sa documentation officielle et donner le lien vérifié ;
- **une plateforme de freelances**, pour une aide payante et rapide ;
- **une personne de son entourage** qui programme : lui transmettre la fiche complète.

Expliquer en une ligne comment l'envoyer (copier le message court, joindre ou coller la fiche complète). Rappeler que la fiche est sans secret, mais que la personne garde la main sur ce qu'elle partage.

Terminer avec le bloc de fin de commande. Prochaine étape : une fois la réponse reçue, `/pulse:fix "<la piste proposée>"` pour l'appliquer avec Pulse.

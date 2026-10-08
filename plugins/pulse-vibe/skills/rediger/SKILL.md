---
description: Écrire les textes de vos pages (accueil, à propos, services…) dans la voix du site, sans tics d'écriture IA, puis les intégrer si vous le souhaitez
argument-hint: "[page] [--humaniser]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte rediger) Bash(pulse-aidd textes *) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd agent redacteur) Bash(pulse-aidd pile contexte rediger) Read Glob Grep
---

# /pulse:rediger – Écrire les textes des pages

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte rediger`

Appliquer les « Règles communes Pulse » et « Rédiger les textes des pages » ci-dessus pendant toute la commande. Les modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte rediger` et lire sa sortie.

Demande : `$ARGUMENTS` (une page, éventuellement suivie de `--humaniser`)

## Objectif

Donner à chaque page un texte qui parle au public du site, dans la voix du projet, avec des faits vrais, sans les tics d'écriture des IA. Phrase à dire : « On fixe d'abord la voix du site, puis on écrit la page avec vos faits ; un contrôle vérifie que le texte ne sonne pas écrit par une IA. »

## 1. La voix

Si `docs/voix.md` existe, le lire et passer à l'étape 2.

Sinon, le préparer d'après le modèle `voix.md` :
1. Préremplir depuis `docs/brief.md`, le glossaire (`aidd_docs/memory/glossary.md`) et les trois mots de personnalité de `docs/design.md`, s'ils existent.
2. Poser les questions qui restent, une à la fois (AskUserQuestion) : vous ou tu ; les trois traits de ton ; la promesse du site en une phrase ; les mots à éviter.
3. Montrer le fichier ; l'écrire dans `docs/voix.md` après l'accord de la personne.

## 2. La page

1. La page visée : l'argument, sinon une question (AskUserQuestion) avec les pages connues du projet (specs, code des pages).
2. Avec `--humaniser` : lire le texte actuel de la page (ou le fichier indiqué) et passer à l'étape 3.
3. Sinon, une question à la fois : l'objectif de la page ; son public ; l'action attendue (le bouton ou le geste visé) ; les faits disponibles (chiffres, noms, lieux, exemples). Un fait inconnu reste inconnu : il sera marqué « [à compléter] » dans le texte.

## 3. La rédaction

Lancer le sous-agent `pulse:redacteur`. Lui indiquer : la fiche de la page (objectif, public, action attendue, faits), le chemin `docs/textes/<page>.md` et, pour `--humaniser`, le texte d'origine. Si les sous-agents ne sont pas disponibles, lancer `pulse-aidd agent redacteur`, lire ses consignes et écrire le texte soi-même.

## 4. La relecture

1. Relancer `pulse-aidd textes verifier docs/textes/<page>.md`. S'il reste des erreurs après les trois tours du rédacteur, les montrer à la personne (phrase et consigne) : elle choisit de corriger, ou de garder le constat avec sa raison.
2. Relire les règles listées « À relire » d'après la section « La relecture à la main » des règles de rédaction ; corriger le texte au besoin ; noter ce qui a été vérifié dans la section « Contrôle » du fichier.
3. Présenter le texte, ses mesures (longueur des phrases, phrases courtes, connecteurs), les avertissements gardés et les « [à compléter] ». Proposer d'ajuster une phrase ou une section si la personne le souhaite.

## 5. Le choix

Demander (AskUserQuestion) :
- **Garder le document** : le texte reste dans `docs/textes/<page>.md`, prêt pour plus tard.
- **Intégrer dans la page** : appliquer les consignes de la pile (`pulse-aidd pile contexte rediger`) ; sans pack de pile, suivre l'organisation des pages décrite dans `docs/technical.md`. Ensuite, lancer les vérifications du projet (« Commandes du projet » de `docs/technical.md`) et montrer la page à la personne.

Terminer avec le bloc de fin de commande. Prochaine étape : une autre page avec `/pulse:rediger <page>`, sinon `/pulse:commit`.

---
name: <nom-de-la-skill>
description: "<Ce que la skill fait, en une phrase.> <Si Claude peut la lancer : À utiliser quand <les phrases de la personne>.>"
disable-model-invocation: true
allowed-tools: <un motif précis par commande lancée, par exemple Bash(git status *) Read Write(docs/rapports/**)>
---

# <Titre de la skill>

## Objectif

<Le travail de la skill en deux ou trois phrases : ce qu'elle fait, pour qui, ce qu'elle rend et où.>

## Règles

- <Une règle valable pendant tout le travail, dite positivement : ce qu'il faut faire.>
- <Un geste sensible (envoi, suppression, mise en ligne) : annoncé en une phrase, puis laissé à la demande d'accord de Claude Code.>

## Contexte

Demande : `$ARGUMENTS` (<ce que vaut une demande vide>).

<Les fichiers lus et écrits, avec leur chemin.>

## Processus

### 1. <Première étape>

<Ce qu'il faut faire. Une question clé à la fois, la réponse recommandée en premier.>

### 2. <Étape suivante>

<Ce qu'il faut faire. Pour <cas précis> : lire `references/<fichier>.md`.>

### 3. Rendre le résultat

<Ce qui est montré à la fin, et où le résultat est écrit.>

## Exemples

- `/<nom-de-la-skill> <exemple de demande>` : <ce qui se passe>.

## Références

- `references/<fichier>.md` : <son contenu, et l'étape qui le lit>.

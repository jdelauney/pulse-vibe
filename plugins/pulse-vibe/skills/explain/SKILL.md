---
description: Expliquer simplement un fichier, une fonction ou une ligne de code, avec une question pour vérifier
argument-hint: "[fichier | fichier:ligne | nom de fonction | question]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte explain) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Edit(docs/lexique.md) Write(docs/lexique.md) Read Glob Grep Bash(git status *) Bash(git diff *)
---

# /pulse:explain – Comprendre le code

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte explain`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte explain` et lire sa sortie.

Ce qu'il faut expliquer : `$ARGUMENTS`

Cette commande **travaille en lecture seule** sur le code ; elle écrit seulement dans le lexique `docs/lexique.md`, sans demander d'autorisation, et signale chaque ajout en une ligne (« 📘 Ajouté au lexique : **…** »). Son but : apprendre à **lire** le code, compétence clé pour relire ce que l'IA produit.

## Choisir la cible

- Un fichier, `fichier:ligne`, un nom de fonction ou une question : expliquer cela.
- Argument vide : prendre le fichier le plus récemment modifié (`git status`, `git diff --stat`) et le proposer, ou demander quoi expliquer.

## Comment expliquer

1. **En une phrase** : « Ce fichier / cette fonction sert à… », du point de vue de l'utilisateur de l'appli.
2. **Par blocs** : découper en blocs logiques (10 au maximum pour un long fichier). Pour chaque bloc, citer un extrait court (8 lignes au plus) puis expliquer ce qu'il fait, simplement. Pour une ligne ou une fonction courte, expliquer ligne par ligne.
3. **Relier aux notions de base** quand elles apparaissent, avec une analogie si utile :
   - variable / constante (une boîte avec une étiquette) ;
   - condition (un aiguillage) ;
   - boucle (répéter pour chaque élément d'une liste) ;
   - fonction (une recette qu'on peut réutiliser) ;
   - événement (réagir à un clic, une saisie) ;
   - tableau, objet (une liste, une fiche avec des champs) ;
   - stockage des données (un carnet où l'appli range ce qu'elle doit retenir) ;
   - requête et attente de la réponse (demander quelque chose à un serveur et attendre qu'il réponde).
4. Si un problème de sécurité ou un bug est repéré au passage, le signaler en une ligne, laisser le code tel quel et proposer `/pulse:review`.

## Pour finir

Poser **une question de vérification** à choix multiples (AskUserQuestion, 3 réponses possibles) sur ce qui vient d'être expliqué, par exemple « Que se passe-t-il si le champ titre est vide ? ». Après la réponse, confirmer ou corriger avec bienveillance, puis proposer d'expliquer autre chose.

Bonne réponse sur un terme du lexique : passer son statut à « maîtrisé ». Terme nouveau rencontré dans l'explication : l'ajouter au lexique (règle commune § 1).

Pour cette commande, le bloc de fin de commande est facultatif.

---
description: Comprendre et corriger une erreur précise (message, console du navigateur, bouton qui ne marche pas), en cherchant la vraie cause, puis expliquer la correction et comment l'éviter
argument-hint: "<message d'erreur ou description du problème> [fichier]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte fix) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd verifier) Bash(pulse-aidd pile contexte *) Edit(docs/lexique.md) Write(docs/lexique.md) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Edit(aidd_docs/tasks/**)
---

# /pulse:fix – Corriger une erreur

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte fix`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les règles de qualité du code se chargent à l'étape 3, avec `pulse-aidd qualite`. Si ce contexte est absent, lancer `pulse-aidd contexte fix` et lire sa sortie.

Problème signalé : `$ARGUMENTS`

## Objectif

Trouver la **vraie cause** d'un problème précis, la corriger avec le plus petit changement possible, le **prouver**, puis expliquer à la personne ce qui s'est passé et comment l'éviter. Phrase à dire : « Une erreur est une étape normale. On va d'abord comprendre pourquoi, avant de toucher au code. »

Pour une liste d'erreurs de lint ou de types sur tout le projet : `/pulse:auto-fix`. Pour un comportement **nouveau** (c'est une demande, plutôt qu'une erreur) : le noter dans `docs/prd.md` (« En attente ») ou proposer `/pulse:spirc <US-XXX> "<demande>"`.

## 1. Comprendre le problème

Formats acceptés : message d'erreur collé, sortie du terminal, erreur de la console du navigateur, code d'erreur (d'un outil, du serveur ou de la base), chemin de fichier, ou description (« le bouton Ajouter ne fait rien »).

Si l'argument est vide ou flou, poser **une seule ronde** de questions (AskUserQuestion) parmi :
- « Que faisiez-vous ? » (l'action exacte, avec les données fictives utilisées) ;
- « Qu'attendiez-vous, et que s'est-il passé à la place ? » ;
- « Y a-t-il un message en rouge ? » : guider pour l'obtenir : touche F12 → onglet « Console », copier la ligne rouge ; pour du code serveur : le journal du serveur (en local : le terminal de la commande « lancer en local » ; en ligne : les journaux de l'hébergeur) ; pour la base : le message renvoyé.

**Lire dans les fichiers** ce qu'ils permettent de savoir, plutôt que le demander. **Travailler avec des données fictives** ; ne jamais demander de vraie donnée ni de vraie clé : si la personne en colle une, le signaler et la faire remplacer.

## 2. Trouver la cause (avant toute correction)

1. **Reproduire ou localiser** : relier le message au fichier et à la ligne ; sinon, suivre le parcours de l'action (bouton → gestion de l'événement → fonction → stockage ou appel serveur → contrôle d'accès).
2. **Diagnostics** : les contrôles automatiques de « Commandes du projet » de `docs/technical.md` (lint, types…), filtrés sur le fichier concerné, et `pulse-aidd verifier` ; la commande « construire » si l'erreur apparaît seulement en ligne ; pour un accès refusé ou des données invisibles, les règles décrites dans « Données et contrôle d'accès » (et le fichier où elles sont écrites). Si aucune commande de contrôle n'existe (toutes à « aucune »), le dire et proposer d'en ajouter avec `/pulse:tech`. Pour le sens exact d'un message ou d'un code d'erreur propre à la technologie retenue : consulter sa documentation officielle et s'appuyer sur elle.
3. **Chercher les erreurs de même cause** (un même oubli répété ailleurs).
4. **Distinguer symptôme et cause** : énoncer la cause en une phrase (« le script est chargé avant que le bouton existe dans la page »). Si deux hypothèses restent possibles, les vérifier une par une, avant toute correction.

Repères fréquents :

| Symptôme | Cause habituelle |
|---|---|
| Élément introuvable (« null », « undefined », « not found » en manipulant un élément de la page) | mauvais sélecteur ou identifiant, ou code exécuté avant que l'élément existe (ordre de chargement) |
| Module, import ou fichier introuvable | chemin ou nom mal écrit, élément non exporté, dépendance non installée (commande « installer » de « Commandes du projet »), ou page ouverte directement depuis le disque au lieu de la commande « lancer en local » |
| Erreur de syntaxe (« Unexpected token », « SyntaxError »…) | parenthèse, accolade, guillemet ou virgule manquant : le contrôle automatique donne la ligne |
| « X n'est pas défini » / « X n'est pas une fonction » | nom mal écrit, élément non exporté ou non importé, portée d'une variable |
| Un appel réseau reçoit une réponse inattendue (une page HTML au lieu de données) | mauvaise adresse, ou erreur 404/500 côté serveur : lire la réponse réelle et le journal du serveur |
| Accès refusé par la base ou le serveur à une action légitime | règle de contrôle d'accès manquante ou trop stricte pour cette action (« Données et contrôle d'accès ») : corriger la règle, sans l'ouvrir à tous |
| Liste vide alors que les données existent | règle de contrôle d'accès en lecture absente pour cet utilisateur, ou filtre erroné |
| `401` / `403` | connexion absente ou expirée, ou rôle insuffisant |
| Données perdues au rechargement | données jamais enregistrées (seulement gardées en mémoire), ou lecture d'une valeur absente non traitée |
| Fonctionne en local, pas en ligne | variable d'environnement non saisie chez l'hébergeur (« Secrets et variables d'environnement »), fichier non publié ou hors du dossier publié (« Organisation des fichiers »), commande « construire » qui échoue |
| Erreur de type (types incompatibles) | corriger la donnée à la source plutôt que forcer le type |
| Valeur possiblement absente | cas « absent » non traité : vérification préalable ou valeur par défaut |
| Rendu différent entre serveur et navigateur | valeur qui change d'un rendu à l'autre (date, nombre aléatoire, élément propre au navigateur) |

## 3. Choisir la correction

Lancer `pulse-aidd qualite` (règles de qualité du code), puis évaluer 1 à 3 solutions selon : **corrige la cause** (plutôt que le symptôme), **préserve ce qui fonctionne**, **le plus petit changement**, **cohérent avec le code existant** et les règles de qualité. Écarter toute « correction » qui affaiblit la sécurité ou les contrôles : désactiver une règle de contrôle d'accès ou du lint, ignorer ou contourner un avertissement de type, ouvrir l'accès à tous, déplacer une clé côté client, interpréter comme du HTML une saisie qui doit s'afficher comme du texte.

Si la correction **change le comportement attendu** (une règle métier, un écran) : cela devient une décision, au-delà d'une correction. La poser à la personne (AskUserQuestion), et proposer de mettre à jour la user story.

## 4. Corriger

- **Simple** (5 fichiers au plus, cause claire) : déléguer à l'agent **`pulse:fixer`** avec, par fichier : l'erreur, la ligne, la cause et la solution retenue. S'il est indisponible, corriger soi-même en suivant ses consignes.
- **Complexe** (plusieurs couches, contexte nécessaire) : corriger soi-même, avec des changements minimes, dans le style du code existant.
- Une action manuelle est nécessaire (appliquer une règle d'accès dans la console de la base ou du fournisseur, saisir une variable chez l'hébergeur) : guider la personne pas à pas.

## 5. Prouver

- Relancer les diagnostics de l'étape 2 sur les fichiers touchés : zéro erreur, ancienne ou nouvelle.
- **La personne refait l'action** qui échouait (même parcours, mêmes données fictives) : « Est-ce que ça fonctionne maintenant ? » → « Oui » / « Toujours le même problème » / « Un autre problème est apparu ».
- Échec : revenir à l'étape 2 avec ce nouvel élément. **Deux tentatives au maximum** ; ensuite, arrêter, expliquer simplement où l'on en est, et proposer `/pulse:get-help`, qui prépare une demande d'aide à transmettre.

## 6. Expliquer et retenir

```
🩺 Correction
Problème : <ce qui se passait, en une phrase simple>
Cause    : <pourquoi, en une phrase>
Correction : <ce qui a changé> — <fichier:ligne>
Preuve   : <✅ commande et résultat · 🧪 test refait par la personne · ⚪ non vérifié, et pourquoi>
Pour l'éviter : <réflexe à retenir>
```

- **💡 La notion du jour** : la notion de programmation au cœur de l'erreur (ordre de chargement, portée d'une variable, asynchrone, contrôle d'accès…), en 3 à 6 lignes. Choisir de préférence une notion absente du lexique, puis l'y ajouter (règle commune § 1, « Le lexique »).
- Si la correction touche une **tâche d'un plan** (fichier listé par la tâche, ou comportement décrit par son US) : ajouter une ligne au journal de ce plan (date, tâche, commit à venir, « correction : <problème en quelques mots> »), enregistrée avec la correction.
- Si la cause est un **piège qui peut revenir** : proposer de l'ajouter à la mémoire (section « Pièges et leçons » de `aidd_docs/memory/technical.md`) en montrant la ligne exacte.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:review` si la correction touche une tâche en cours ou plusieurs fichiers, sinon `/pulse:commit` (message `fix(<Tâche>): …`, ou `fix: …` hors tâche).

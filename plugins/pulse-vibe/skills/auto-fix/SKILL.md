---
description: Faire passer au vert tous les contrôles automatiques du code (syntaxe, règles d'écriture, types, formatage), en confiant les corrections à des agents en parallèle
argument-hint: "[--detail]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte auto-fix) Bash(pulse-aidd agent fixer) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd verifier) Bash(pulse-aidd pile contexte *) Bash(git status *) Bash(git diff *) Read Glob Grep Edit(aidd_docs/tasks/**)
---

# /pulse:auto-fix – Corriger les erreurs automatiquement détectables

## Objectif

Éliminer **toutes** les erreurs que les contrôles automatiques du projet détectent seuls (syntaxe, lint, types, formatage), en gardant intact le comportement de l'appli. Phrase à dire : « Ces outils relisent le code comme un correcteur d'orthographe. Je fais corriger chaque erreur par un assistant, puis je revérifie. »

Vient en complément de la relecture (`/pulse:review`) et du test par la personne, qui restent nécessaires.

## Règles

Appliquer les « Règles communes Pulse » (chargées dans « Contexte ») pendant toute la commande.

## Contexte

!`pulse-aidd contexte auto-fix`

Si ce contexte est absent, lancer `pulse-aidd contexte auto-fix` et lire sa sortie.

Option : `$ARGUMENTS` (`--detail` : afficher chaque erreur dans le rapport final)

### Prérequis

- `docs/technical.md` existe, avec sa section « Commandes du projet ». Sinon, le signaler et proposer `/pulse:tech`, puis s'arrêter.
- Noter les fichiers déjà modifiés (`git status --short`) : à la fin, montrer seulement ce que cette commande a changé.

## Rôle

- La conversation principale orchestre : elle lance les contrôles, répartit les erreurs, revérifie et rédige le rapport.
- Les agents **`pulse:fixer`**, lancés en parallèle, apportent les corrections : 5 fichiers au plus chacun, chaque fichier confié à un seul agent.
- Une erreur de secret se résout avec la personne.

## Processus

### 1. Diagnostiquer

Lancer les contrôles et collecter **toutes** les erreurs (fichier, ligne, code, message) :

1. les **contrôles automatiques** de « Commandes du projet » de `docs/technical.md` (format, lint, types…), dans cet ordre : d'abord le formatage s'il existe (il corrige seul la mise en forme), puis les autres ; lancer chaque commande telle qu'elle est écrite, depuis la racine du projet ;
2. `pulse-aidd verifier` (secrets et fichiers d'environnement suivis par Git).

- Aucune commande de contrôle dans « Commandes du projet » (toutes à « aucune ») : le dire clairement (seul `pulse-aidd verifier` a pu être lancé) et proposer d'en ajouter avec `/pulse:tech`. S'en tenir aux commandes écrites dans « Commandes du projet ».
- Une commande qui échoue parce que l'outil manque (non installé) : le signaler, proposer la commande « installer » de « Commandes du projet », avec accord.
- Une **erreur de secret** (`pulse-aidd verifier`) se traite avec la personne, jamais par un agent : l'expliquer et la résoudre ensemble (la clé va dans le fichier d'environnement local décrit par « Secrets et variables d'environnement », puis la révoquer chez le fournisseur si elle a été envoyée sur le dépôt distant).
- Aucune erreur : le dire, et terminer.

### 2. Répartir

Grouper les erreurs par fichier, puis les fichiers par dossier ou fonctionnalité :

- **5 fichiers au plus** par agent ;
- **chaque fichier confié à un seul agent** ;
- lancer **tous** les agents **`pulse:fixer`** en parallèle (plusieurs appels Agent dans le même message).

Message de délégation (un par agent) :

```
Correction automatique : <fichier1>, <fichier2>…
Revérification : <commande de « Commandes du projet », limitée à ces fichiers si l'outil le permet>

<chemin/fichier1>:
- [<outil>/<code>] <message exact> (ligne 42)
- [<outil>/<code>] <message exact> (ligne 15)

<chemin/fichier2>:
- [<outil>/<code>] <message exact> (ligne 2)
```

Rappeler dans chaque message que chaque correction préserve la sécurité et les contrôles ; restent interdites les « corrections » qui les affaiblissent : désactiver une règle du lint ou un contrôle, ignorer ou contourner un avertissement de type, ouvrir l'accès à tous, déplacer une clé côté client, supprimer le code qui pose problème.

**Confier chaque correction aux agents** : tout passe par eux. Si l'agent `pulse:fixer` est indisponible, corriger en suivant **strictement** ses consignes (`pulse-aidd agent fixer`), et le signaler.

### 3. Revérifier

Relancer les contrôles de l'étape 1.

- Il reste des erreurs et moins de **3 cycles** ont été faits : recommencer l'étape 2 avec **uniquement** les erreurs restantes (et celles signalées « cause ailleurs », confiées à l'agent du bon fichier).
- Après 3 cycles : arrêter, et rapporter les erreurs restantes.

### 4. Rapport

```
🔧 Correction automatique
Erreurs corrigées : <n> · restantes : <m> · cycles : <k>/3
Fichiers modifiés : <liste>   (git diff --stat)
```

Si des fichiers corrigés appartiennent à une tâche d'un plan (fichiers listés par la tâche) : ajouter une ligne au journal de ce plan (date, tâche, commit à venir, « correction automatique : <n> erreurs <outil> »), enregistrée avec les corrections.

Erreurs restantes : pour chacune, l'expliquer en langage simple et proposer l'action (ex. « une fonction attend un nombre et reçoit un texte : à décider avec vous, car corriger change le comportement »). Avec `--detail` : la liste de toutes les corrections.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:review` pour une relecture indépendante si une tâche est en cours, sinon `/pulse:commit` (message `style:` ou `fix:` selon les corrections).

## Exemples

- `/pulse:auto-fix` : les contrôles du projet relèvent 12 erreurs, plusieurs assistants les corrigent en même temps, puis tout est revérifié ; le rapport donne le nombre d'erreurs corrigées.
- `/pulse:auto-fix --detail` : le même travail, avec la liste de chaque correction dans le rapport.
- Une clé secrète écrite dans le code : la commande vous l'explique et vous la mettez à l'abri ensemble.

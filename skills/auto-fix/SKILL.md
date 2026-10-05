---
description: Faire passer au vert tous les contrôles automatiques du code (syntaxe, lint, types, formatage), en confiant les corrections à des agents en parallèle
argument-hint: "[--detail]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Bash(git status *) Bash(git diff *) Read Glob Grep
---

# /pulse:auto-fix – Corriger les erreurs automatiquement détectables

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte auto-fix`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Si ce contexte est absent, lancer `pulse-aidd contexte auto-fix` et lire sa sortie.

Option : `$ARGUMENTS` (`--detail` : afficher chaque erreur dans le rapport final)

## Objectif

Éliminer **toutes** les erreurs que les contrôles automatiques du projet détectent seuls (syntaxe, lint, types, formatage), sans changer le comportement de l'appli. Phrase à dire : « Ces outils relisent le code comme un correcteur d'orthographe. Je fais corriger chaque erreur par un assistant, puis je revérifie. »

Ne remplace ni la relecture (`/pulse:review`) ni le test par la personne.

## Prérequis

- `docs/technical.md` existe, avec sa section « Commandes du projet ». Sinon, le signaler et proposer `/pulse:tech`, puis s'arrêter.
- Noter les fichiers déjà modifiés (`git status --short`) : à la fin, montrer seulement ce que cette commande a changé.

## 1. Diagnostiquer

Lancer les contrôles et collecter **toutes** les erreurs (fichier, ligne, code, message) :

1. les **contrôles automatiques** de « Commandes du projet » de `docs/technical.md` (format, lint, types…), dans cet ordre : d'abord le formatage s'il existe (il corrige seul la mise en forme), puis les autres ; lancer chaque commande telle qu'elle est écrite, depuis la racine du projet ;
2. `pulse-aidd verifier` (secrets et fichiers d'environnement suivis par Git).

- Aucune commande de contrôle dans « Commandes du projet » (toutes à « aucune ») : le dire clairement (seul `pulse-aidd verifier` a pu être lancé) et proposer d'en ajouter avec `/pulse:tech`. Ne pas inventer de commande.
- Une commande qui échoue parce que l'outil manque (non installé) : le signaler, proposer la commande « installer » de « Commandes du projet », avec accord.
- Une **erreur de secret** (`pulse-aidd verifier`) n'est jamais confiée à un agent : l'expliquer et la traiter avec la personne (la clé va dans le fichier d'environnement local décrit par « Secrets et variables d'environnement », puis la révoquer chez le fournisseur si elle a été envoyée sur le dépôt distant).
- Aucune erreur : le dire, et terminer.

## 2. Répartir

Grouper les erreurs par fichier, puis les fichiers par dossier ou fonctionnalité :

- **5 fichiers au plus** par agent ;
- **aucun fichier partagé** entre deux agents ;
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

Rappeler dans chaque message l'interdiction des « corrections » qui affaiblissent la sécurité ou les contrôles : désactiver une règle du lint ou un contrôle, ignorer ou contourner un avertissement de type, ouvrir l'accès à tous, déplacer une clé côté client, supprimer le code qui pose problème.

**Ne corriger aucun fichier soi-même** : tout passe par les agents. Si l'agent `pulse:fixer` n'est pas disponible, corriger en suivant **strictement** ses consignes (`pulse-aidd agent fixer`), et le signaler.

## 3. Revérifier

Relancer les contrôles de l'étape 1.

- Il reste des erreurs et moins de **3 cycles** ont été faits : recommencer l'étape 2 avec **uniquement** les erreurs restantes (et celles signalées « cause ailleurs », confiées à l'agent du bon fichier).
- Après 3 cycles : arrêter, et rapporter les erreurs restantes.

## 4. Rapport

```
🔧 Correction automatique
Erreurs corrigées : <n> · restantes : <m> · cycles : <k>/3
Fichiers modifiés : <liste>   (git diff --stat)
```

Erreurs restantes : pour chacune, l'expliquer en langage simple et proposer l'action (ex. « une fonction attend un nombre et reçoit un texte : à décider avec vous, car corriger change le comportement »). Avec `--detail` : la liste de toutes les corrections.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:review` pour une relecture indépendante si une tâche est en cours, sinon `/pulse:commit` (message `style:` ou `fix:` selon les corrections).

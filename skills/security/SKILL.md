---
description: Sécurité du projet - audit complet S1 à S12 et test du cambrioleur, contrôle rapide, en-têtes de sécurité, préparation d'un audit outillé
argument-hint: "[audit | rapide | entetes | preparer] (par défaut : audit)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Bash(git status *) Bash(git ls-files *) Bash(git log *) Bash(git grep *) Bash(curl -sI *) Bash(gitleaks *)
---

# /pulse:security – La sécurité du projet

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte security`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte security` et lire sa sortie.

Action demandée : `$ARGUMENTS` (vide = `audit`)

## Choisir l'action

| Action | Quand | Comment |
|---|---|---|
| `audit` (par défaut) | Avant une mise en ligne, à la fin du MVP ou d'une epic | Section « Audit complet » ci-dessous |
| `rapide` | En 2 minutes, à tout moment : « suis-je dans les clous ? » | Lancer `pulse-aidd reference securite/rapide.md` et l'appliquer à l'identique (lecture seule) |
| `entetes` | Configurer les en-têtes de sécurité (CSP, HSTS…) | Lancer `pulse-aidd reference securite/entetes.md` et l'appliquer ; montrer la configuration avant de l'écrire |
| `preparer` | Préparer un audit outillé (développeur, outils d'analyse) | Lancer `pulse-aidd reference securite/preparer.md` et l'appliquer |

La technologie du projet est décrite dans `docs/technical.md` (« Pile retenue », « Organisation des fichiers », « Données et contrôle d'accès », « Secrets et variables d'environnement », « Hébergement et mise en ligne ») ; chaque action s'appuie sur ces sections. Si `docs/technical.md` est absent, le signaler et proposer `/pulse:tech`. Pour la syntaxe ou la configuration propre à la technologie retenue : consulter sa documentation officielle et s'appuyer uniquement sur elle. Pour `rapide`, `entetes` et `preparer`, terminer avec le bloc de fin de commande.

## Audit complet

### Objectif

Passer tout le projet au crible de la checklist sécurité Pulse, puis donner à la personne une **fiche de tests manuels** (« le test du cambrioleur ») adaptée à son appli. Phrase à rappeler : **« Seul ce que le serveur bloque est vraiment interdit. »**

### Prérequis

- Le projet doit contenir du code (constater avec `git ls-files` et « Organisation des fichiers » de `docs/technical.md`). Sinon, dites que l'audit attendra les premiers fichiers de code.
- Les specs (`aidd_docs/tasks/*/SPEC-US-*.md`) sont conseillées (elles décrivent qui a le droit de voir quoi). En leur absence, l'audit se fait quand même, en le signalant.

### Déroulé

#### 1. Lancer l'audit de sécurité

Expliquer en une phrase que l'audit est effectué en lecture seule : les fichiers restent intacts.

Utiliser l'outil Agent avec le sous-agent **`pulse:security-auditor`**. Indiquer : la racine du projet, le document `docs/technical.md` (sections « Pile retenue », « Organisation des fichiers », « Données et contrôle d'accès », « Secrets et variables d'environnement »), les specs (`aidd_docs/tasks/*/SPEC-US-*.md`), `docs/user-stories.md` et les fichiers d'US, et la **checklist sécurité complète**, recopiée dans le message (le sous-agent voit seulement les fichiers du projet).

Si le sous-agent est indisponible, faire l'audit en suivant **strictement** la méthode et le format décrits par `pulse-aidd agent security-auditor`, en lecture seule pendant l'audit.

#### 2. Enregistrer

Écrire `docs/securite.md` à partir du modèle `docs/securite.md` (remplace l'audit précédent ; l'historique reste dans Git).

#### 3. Présenter

- Le niveau global (🟢 / 🟠 / 🔴) et le nombre de points bloquants.
- Pour chaque ⛔ : ce qu'un inconnu pourrait faire concrètement, en une phrase, puis la correction proposée.
- Les ⚠️ en liste courte.

Rester factuel et rassurant : trouver des failles maintenant, c'est exactement le but.

#### 4. Le test du cambrioleur

Présenter la fiche adaptée au projet comme une liste à cocher. Proposer de la dérouler ensemble, **un test à la fois** : décrire le test, la personne le fait, puis indique le résultat (AskUserQuestion : « Protégé ✅ » / « Faille ❌ » / « J'ai besoin d'aide pour ce test »). Reporter les résultats dans `docs/securite.md`.

#### 5. Corriger

Proposer de corriger les points par ordre de priorité (AskUserQuestion : « Corriger les points bloquants maintenant (recommandé) » / « Tout corriger » / « Plus tard »). Expliquer chaque correction en une ligne. Une correction du contrôle d'accès se fait dans le code ou le fichier de règles indiqué par « Données et contrôle d'accès » ; si elle doit aussi être appliquée à la main dans la base ou chez le fournisseur (console d'administration), guider la personne pas à pas, d'après la documentation officielle. Une clé exposée se révoque chez le fournisseur, puis la nouvelle valeur se saisit à l'endroit indiqué par « Secrets et variables d'environnement ». Après correction, refaire le test manuel concerné.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:review` puis `/pulse:commit` si des corrections ont été faites.

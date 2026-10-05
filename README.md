# Pulse-vibe – la méthode AIDD de PulseIA pour Claude Code

**Pulse-vibe** est un plugin pour Claude Code qui guide une personne non développeuse **du brief à la mise en ligne**, étape par étape, avec l'IA. Il s'adresse aux indépendants, dirigeants et collaborateurs de petites structures.

Tout est en français. Chaque commande pose ses questions une par une, explique ce qu'elle fait, produit un document ou du code, et indique la prochaine étape.

## Les commandes

| Commande | Étape | Produit |
|---|---|---|
| `/pulse:init` | Point d'entrée : prépare le projet (nouveau ou existant), montre où il en est et guide vers la prochaine étape, en boucle | `CLAUDE.md`, dossiers, `.gitignore`, mémoire `aidd_docs/`, Git |
| `/pulse:brainstorm` | Entretien approfondi par rondes (arbre de décisions), puis l'idée racontée (domain storytelling) | `docs/brief.md`, glossaire |
| `/pulse:prd` | Besoin produit et périmètre MVP (MoSCoW) | `docs/prd.md` |
| `/pulse:tech` | Choix techniques : besoins, 2-3 options comparées et vérifiées sur leur documentation officielle ; **c'est la personne qui choisit sa technologie** (ou la pile existante est documentée) | `docs/technical.md`, bloc « Pile technique » de `CLAUDE.md` |
| `/pulse:spec <US-003 \| "demande">` | Spécification d'une user story (une US = une spec), ou d'une demande décrite, avec section sécurité obligatoire | `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md` |
| `/pulse:us` | Epics, user stories et critères d'acceptation : un référentiel, puis un fichier par US rangé dans le dossier de son epic | `docs/user-stories.md`, `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` |
| `/pulse:plan <US-003>` | Petites tâches ordonnées (kanban) pour la spec d'une US (une spec = un plan) ; numéros de tâche uniques dans tout le projet | `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md` |
| `/pulse:refine [<US-003>] "…"` | Ajuster un plan selon vos questions ou remarques : réponse à chaque point, changements montrés avant d'écrire | le plan (et PRD, US si besoin) |
| `/pulse:guide` | Le carnet de route : pour chaque tâche, dans l'ordre, les commandes à copier-coller, ce qu'il faut vérifier, les actions manuelles. Mis à jour automatiquement à chaque modification du plan | `docs/guide/` |
| `/pulse:implement [-sdw] <US-003> [T3]` | Réaliser une tâche du plan et l'expliquer, via le sous-agent implementer (`-s`) ou directement (`-d`) ; sans option, la question est posée ; options regroupables (`-sw`). `-w` : dans un worktree (proposé d'office si une autre session travaille sur le même dossier) ; sans tâche, boucler sur tout le plan : réaliser → relire → corriger → commiter → tâche suivante | le code des tâches, un commit par tâche |
| `/pulse:review` | Relecture indépendante, test manuel, corrections | `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/Tn-date.md` |
| `/pulse:commit [push] ["message"]` | Enregistrer une version après contrôle des secrets : un sujet par commit (modifications triées, plusieurs commits proposés si besoin), message conventionnel avec le pourquoi et l'US, correction encadrée si un contrôle refuse le commit ; `push` l'envoie ensuite | un ou plusieurs commits Git |
| `/pulse:pr [branche [<US-003>] \| <base>]` | `branche` : créer la branche de travail d'un plan ; sans argument : ouvrir une demande de fusion (pull request) **en brouillon**, décrite à partir des commits, du plan et des relectures (GitHub `gh`, GitLab `glab`, sinon lien à ouvrir). Ne fusionne jamais | une branche, une PR en brouillon |
| `/pulse:cicd [proteger]` | Contrôles automatiques (CI) à chaque envoi et sur chaque demande de fusion : secrets, lint, tests, construction, adaptés au fournisseur du dépôt (GitHub Actions, GitLab CI…) ; `proteger` : n'accepter une fusion que si la CI est verte | fichier de CI, `scripts/verifier.js` |
| `/pulse:deploy` | Mise en ligne et déploiement continu (CD), puis mode production (variables, services, retour arrière) | site en ligne |
| `/pulse:spirc [-axw] <US-003> [T3 \| "demande"]` | Orchestre pour le plan d'une US **I**mplémentation, **R**evue, **C**ommit avec des agents indépendants, tâche par tâche (et **S**pec, **P**lan s'il n'y a pas encore de plan) ; une demande libre est ajoutée au plan. Options `-a` (autonome), `-x` (examen renforcé) et `-w` (worktree), regroupables (`-axw`) | tout ce qui précède |
| `/pulse:status` | Où en suis-je ? Prochaine étape conseillée | — |
| `/pulse:explain` | Expliquer un fichier, une fonction, une ligne | — |
| `/pulse:learn [<notion>]` | Un professeur de programmation, limité au développement logiciel : leçon, `feynman <notion>` (vous expliquez, il vous aide à combler les trous), `exercice <notion>`, `parcours "<objectif>"` ; adapté à votre niveau, illustré avec votre projet. Sans argument : révision des notions à revoir | `docs/apprentissage.md` (carnet, facultatif) |
| `/pulse:security` | Audit S1 à S11 et « test du cambrioleur » ; `rapide` (contrôle en 2 min), `entetes` (CSP, HSTS…), `preparer` (`endpoints.txt`, `.gitleaks.toml`) | `docs/securite.md` |
| `/pulse:ui identite` | (Facultatif) Vous montre 2 ou 3 apparences possibles pour votre outil ; vous choisissez | `docs/design.md` |
| `/pulse:ui maquettes <US-003>` | (Facultatif) Dessine 2 à 4 versions de vos écrans, à comparer dans le navigateur | `docs/design/maquettes/US-XXX-<nom>/` |
| `/pulse:ui audit` puis `/pulse:ui polish` | « Mon interface est-elle soignée, lisible, cohérente ? » | `docs/design/audits/ui-<date>.md` |
| `/pulse:auto-fix` | Fait passer au vert les contrôles automatiques du projet (lint, types, formatage…), via des agents en parallèle | code corrigé |
| `/pulse:fix` | Corriger une erreur précise (message, console, « le bouton ne marche pas ») : cause d'abord, correction minimale, preuve, explication | code corrigé |
| `/pulse:memory` | Créer, actualiser ou enrichir la mémoire du projet (`creer`, `actualiser`, `retenir "…"`) | `aidd_docs/memory/` |

```
/pulse:init → /pulse:brainstorm → /pulse:prd → /pulse:tech → (/pulse:ui identite, facultatif) → /pulse:us (epics et US)
   → pour chaque US : /pulse:spec <US-XXX> → /pulse:plan <US-XXX>
   → pour chaque tâche : /pulse:implement <US-XXX> <tâche> → /pulse:review → /pulse:commit   (ou : /pulse:spirc <US-XXX>)
   → /pulse:deploy
```

## Ce que le plugin contient en plus des commandes

- **Des agents spécialisés**, chacun dans son rôle :
  - `pulse:explorer` rassemble les faits utiles à une demande (lecture seule) ;
  - `pulse:implementer` réalise une tâche validée, sans toucher aux documents ni commiter (utilisé par `/pulse:spirc` et par `/pulse:implement` en mode sous-agent) ;
  - `pulse:reviewer` relit une tâche : critères, sécurité et adéquation au besoin (lecture seule) ;
  - `pulse:verifier` prouve que la tâche fonctionne, critère par critère, et prépare le test manuel (lecture seule) ;
  - `pulse:security-auditor` réalise l'audit de sécurité (lecture seule) ;
  - `pulse:designer` génère une proposition visuelle (identité, maquettes, variantes) ;
  - `pulse:ui-critic` relit l'interface (contraste, cohérence, accessibilité) pour `/pulse:ui audit` (lecture seule) ;
  - `pulse:fixer` corrige une liste précise d'erreurs dans 5 fichiers au plus (utilisé par `/pulse:auto-fix`).
- **Aucune technologie imposée** : Pulse ne choisit ni langage, ni framework, ni base de données, ni hébergeur. La personne choisit avec `/pulse:tech` ; tout le reste (spec, plan, code, contrôles, mise en ligne) s'appuie sur `docs/technical.md`, et l'IA consulte la documentation officielle de la technologie retenue.
- **Des références de qualité du code**, agnostiques, chargées à chaque implémentation et relecture (`pulse-aidd qualite`) : clean code, composants d'interface, sécurité du code, et `code-concepts` (odeurs de code, SOLID, refactorings).
- **Une mémoire projet** (`aidd_docs/memory/`) : vision, choix techniques, pièges, glossaire du métier et décisions. Un hook l'injecte dans `CLAUDE.md` à l'ouverture de chaque session : l'IA la relit automatiquement, sans tout redécouvrir.
- **Le dépôt distant et l'envoi** : `/pulse:init` propose de relier le projet à un dépôt distant (en créer un privé, ou relier un existant). Chaque plan choisit ensuite comment envoyer ses tâches : une branche par US avec une demande de fusion en brouillon mise à jour à chaque tâche (recommandé), directement sur la branche principale, ou rien.
- **Le travail en parallèle** : un hook tient le registre des sessions Claude Code ouvertes sur le projet. Quand une autre session travaille déjà sur le même dossier, `/pulse:implement` et `/pulse:spirc` proposent un **worktree** (option `-w`) : une copie de travail sur sa propre branche, créée à partir du dernier commit local, puis fusionnée et supprimée à la fin. `/pulse:plan` repère les US **indépendantes** (aucune dépendance, aucun fichier ni donnée en commun) ; `/pulse:implement`, `/pulse:spirc`, `/pulse:status` et le guide proposent alors d'en mener une en parallèle, dans une deuxième session.
- **Un garde-fou anti-secrets** (hook) qui bloque, avant qu'elles n'arrivent :
  - l'écriture d'une clé secrète dans un fichier de code ;
  - l'ajout d'un fichier `.env` à Git ;
  - un commit contenant une clé ou un `.env` ;
  - un push alors qu'un `.env` est suivi par Git.
  Il reconnaît les clés Stripe, Supabase (`service_role`, `sb_secret_`), Resend, OpenAI, Anthropic, GitHub, AWS, SendGrid, Slack, les clés privées et les mots de passe dans les adresses de base de données. La clé **publique** Supabase est autorisée.
- **Des modèles** pour tous les documents, le `CLAUDE.md` du projet, `.gitignore`, `.env.example`, un exemple de CI à adapter, la mention de confidentialité et la CI GitHub.
- **Un contrôle automatique des secrets avant mise en ligne** (`scripts/verifier.js`), installé dans le projet en mode production et branché sur la CI ou l'hébergeur retenus.

## Installation

Prérequis : Claude Code (abonnement Pro, Max, Team, Enterprise ou compte Console), Git, Node.js LTS. Sous Windows, **Git for Windows** est indispensable (le plugin utilise Git Bash).

Dans une session Claude Code :

```
/plugin marketplace add jdelauney/pulse-vibe
/plugin install pulse-vibe@pulseia
```

Ou depuis un terminal :

```bash
claude plugin marketplace add jdelauney/pulse-vibe
claude plugin install pulse-vibe@pulseia
```

Pour tester en local sans GitHub : `claude plugin marketplace add ./chemin/vers/pulse-vibe`.

Mise à jour : `claude plugin marketplace update pulseia` puis `claude plugin update pulse-vibe@pulseia`, et redémarrer Claude Code.

## Documentation

| Document | Pour qui |
|---|---|
| [Mémo des commandes](docs/memo-commandes.md) | Les personnes qui utilisent le plugin (une page, à imprimer) |

## Structure du dépôt

```
.claude-plugin/marketplace.json   catalogue (marketplace « pulseia »)
.claude-plugin/plugin.json        manifeste du plugin
skills/<commande>/SKILL.md        les 24 commandes
agents/                           explorer, implementer, reviewer, verifier, security-auditor, designer, ui-critic, fixer
hooks/hooks.json                  garde-fou anti-secrets, synchronisation de la mémoire, registre des sessions, régénération du guide
scripts/                          garde-secrets.js, motifs.js, memoire.js, nouveau-projet.js (pulse-aidd nouveau, /pulse:init), guide.js, comparer.js, sessions.js
bin/pulse-aidd                    outil interne (charge règles et modèles, contrôle, CI)
references/                       règles communes, aide au choix technique, checklist sécurité, mémoire,
                                  qualite/ (références de qualité du code), securite/ (actions de /pulse:security),
                                  design/ (références d'interface de /pulse:ui), pedagogie.md (/pulse:learn),
                                  git.md (conventions de commit, de branche et de PR), worktree.md (travail en parallèle)
templates/                        modèles de documents et de fichiers projet
tests/                            tests (node --test tests/*.test.js)
docs/                             documentation
```

## Licence

Licence MIT (voir [LICENCE.md](./LICENCE.md)).

# Pulse-vibe – la méthode AIDD de PulseIA pour Claude Code

**Pulse-vibe** est un plugin pour Claude Code qui guide une personne non développeuse **du brief à la mise en ligne**, étape par étape, avec l'IA. Il s'adresse aux indépendants, dirigeants et collaborateurs de petites structures.

Tout est en français. Chaque commande pose ses questions (une à la fois, ou en une ronde de 4 au plus), explique ce qu'elle fait, produit un document ou du code, et indique la prochaine étape.

## Les commandes

| Commande | Étape | Produit |
|---|---|---|
| `/pulse:init` | Point d'entrée : prépare le projet (nouveau ou existant), montre où il en est et guide vers la prochaine étape, en boucle | `CLAUDE.md`, dossiers, `.gitignore`, mémoire `aidd_docs/`, Git |
| `/pulse:express [idée]` | Démarrer vite : en une conversation, l'idée, les écrans, l'apparence et les contraintes ; un seul écran de validation ; puis les choix techniques et 2 identités visuelles à comparer, jusqu'à la première US prête à réaliser | brief, PRD, user stories, `docs/technical.md`, `docs/design.md` |
| `/pulse:brainstorm` | Entretien approfondi par rondes (arbre de décisions), puis l'idée racontée (domain storytelling) | `docs/brief.md`, glossaire |
| `/pulse:prd` | Besoin produit et périmètre MVP (MoSCoW) | `docs/prd.md` |
| `/pulse:tech` | Choix techniques : besoins, 2-3 options comparées et vérifiées sur leur documentation officielle ; **c'est la personne qui choisit sa technologie** (ou la pile existante est documentée) ; un pack de pile installé est proposé comme option ; mise en ligne d'une page de départ dès le premier jour | `docs/technical.md`, bloc « Pile technique » de `CLAUDE.md` |
| `/pulse:spec <US-003 \| "demande">` | Spécification d'une user story (une US = une spec), ou d'une demande décrite : l'intention seule, trous marqués `TBD:`, hors objectifs, données personnelles et accès ; verrouillée une fois validée | `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md` |
| `/pulse:us` | Epics, user stories et critères d'acceptation, validées INVEST et prêtes (Definition of Ready), triées par ordre de réalisation, sauvegardées après validation (fichiers, et l'outil de ticketing de la mémoire projet) : un référentiel, puis un fichier par US rangé dans le dossier de son epic | `docs/user-stories.md`, `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` |
| `/pulse:plan <US-003>` | Conception technique (pile, données, sécurité, fichiers), puis petites tâches ordonnées pour la spec d'une US (une spec = un plan) ; numéros de tâche uniques dans tout le projet | `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md` |
| `/pulse:refine [<US-003>] "…"` | Ajuster un plan selon vos questions ou remarques : réponse à chaque point, changements montrés avant d'écrire | le plan (et PRD, US si besoin) |
| `/pulse:guide` | Le carnet de route : pour chaque tâche, dans l'ordre, les commandes à copier-coller, ce qu'il faut vérifier, les actions manuelles. Mis à jour automatiquement à chaque modification du plan | `docs/guide/` |
| `/pulse:implement <US-003> [T3]` | Réaliser une tâche du plan et l'expliquer, en coulisse (agent implementer) ou devant vous (question posée au démarrage, sauf en mode découverte), au besoin dans une copie à part du projet (worktree, proposée d'office si une autre session travaille sur le même dossier) ; sans tâche, boucler sur tout le plan : réaliser → relire et vérifier → corriger → commiter → tâche suivante | le code des tâches, un commit par tâche |
| `/pulse:review` | Relecture (agent reviewer) et essai de l'application en marche (agent verifier) en parallèle, test manuel, corrections ; la même preuve que spirc | `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/Tn-date.md` |
| `/pulse:commit [push] ["message"]` | Enregistrer une version après contrôle des secrets : un sujet par commit (modifications triées, plusieurs commits proposés si besoin), message conventionnel avec le pourquoi et l'US, correction encadrée si un contrôle refuse le commit ; `push` l'envoie ensuite | un ou plusieurs commits Git |
| `/pulse:pr [branche [<US-003>] \| <base>]` | `branche` : créer la branche de travail d'un plan ; sans argument : ouvrir une demande de fusion (pull request) **en brouillon**, décrite à partir des commits, du plan et des relectures (GitHub `gh`, GitLab `glab`, sinon lien à ouvrir). Ne fusionne jamais | une branche, une PR en brouillon |
| `/pulse:cicd [proteger]` | Contrôles automatiques (CI) à chaque envoi et sur chaque demande de fusion : secrets, audit des dépendances, lint, tests, construction (et, en option, robot de mises à jour des dépendances), adaptés au fournisseur du dépôt (GitHub Actions, GitLab CI…) ; `proteger` : n'accepter une fusion que si la CI est verte | fichier de CI, `scripts/verifier.js` |
| `/pulse:deploy` | Mise en ligne et déploiement continu (CD), puis mode production (variables, services, retour arrière) ; tests et construction avant l'envoi, contrôle rapide de sécurité avant la première mise en ligne ; chaque mise en ligne est prouvée par `pulse-aidd sonder` et par le garde-fou de référencement `pulse-aidd seo --essentiel` ; une sonde de disponibilité est proposée | site en ligne |
| `/pulse:search-console [relier \| lire [28j\|3m] \| suivre \| inspecter <adresse>]` | Après la mise en ligne : relier le site à Google Search Console et à Bing (balise ou DNS, sitemap), puis lire ce que Google voit, en lecture seule (export CSV, ou connexion Google personnelle dont l'accès reste hors du projet) : chiffres, requêtes à potentiel, pages oubliées, échantillon d'indexation, 3 actions ; `suivre` compare 28 jours aux 28 précédents | `docs/referencement/search-console-<date>.md`, section « Référencement » de `docs/technical.md` |
| `/pulse:spirc <US-003> [T3 \| "demande"]` | Orchestre pour le plan d'une US **I**mplémentation, **R**evue, **C**ommit avec des agents indépendants, tâche par tâche (et **S**pec, **P**lan s'il n'y a pas encore de plan) ; une demande libre est ajoutée au plan. Une seule ronde de 4 questions au plus au démarrage. Rythme choisi au démarrage : pas à pas, pas à pas avec un contrôle de sécurité à chaque tâche, ou autonome | tout ce qui précède |
| `/pulse:status` | Où en suis-je ? Prochaine étape conseillée, calculée par `pulse-aidd etat` comme pour `/pulse:init` | — |
| `/pulse:explain` | Expliquer un fichier, une fonction, une ligne | — |
| `/pulse:learn [<notion>]` | Un professeur de programmation, limité au développement logiciel : leçon, `feynman <notion>` (vous expliquez, il vous aide à combler les trous), `exercice <notion>`, `parcours "<objectif>"` ; adapté à votre niveau, illustré avec votre projet. Sans argument : révision des notions à revoir | `docs/apprentissage.md` (carnet, facultatif) |
| `/pulse:security` | Audit S1 à S13 et « test du cambrioleur » ; `rapide` (contrôle en 2 min), `entetes` (CSP, HSTS…), `preparer` (`endpoints.txt`, `.gitleaks.toml`) | `docs/securite.md` |
| `/pulse:secrets [inventaire \| renouveler <NOM> \| fuite [<NOM>]]` | Les secrets du projet sans jamais afficher une valeur : inventaire (noms, présence, type chez l'hébergeur), renouvellement sans coupure (nouvelle valeur d'abord, révocation après la preuve en production), réaction à une fuite (révoquer d'abord) ; la valeur va du fournisseur à `.env` par la personne, puis à l'hébergeur par l'entrée standard | `docs/secrets.md`, `docs/incidents/` |
| `/pulse:seo [audit \| bases \| textes \| ia \| lancer]` | Être trouvé : audit du site **servi** (comme un robot, sans JavaScript) rangé par 4 questions (Google peut-il venir ? garder la page ? comment se présente-t-elle ? mérite-t-elle d'être choisie ?) ; fondations ; titres et descriptions **choisis par vous** ; politique des robots IA (4 choix expliqués, sans recommandation) ; lancement (Search Console, Bing, carte de partage). `/pulse:deploy` vérifie à chaque mise en ligne qu'aucun `noindex`, `Disallow: /` ou `localhost` n'est parti | `docs/seo.md`, `docs/seo/audits/seo-<date>.md` |
| `/pulse:rediger [page] [--humaniser]` | Les textes de vos pages (accueil, à propos, services…) dans la voix du site : entretien court (voix, objectif, public, action attendue, faits), rédaction par un agent, contrôle des tics d'écriture IA (`pulse-aidd textes verifier`), puis intégration dans la page si vous le souhaitez | `docs/voix.md`, `docs/textes/<page>.md` |
| `/pulse:perf [mesurer \| corriger \| suivre]` | La vitesse vécue par vos visiteurs : simulation Lighthouse 13 en plusieurs passages (médiane, instabilité signalée) et vrais visiteurs (CrUX), jamais mélangés ; 3 priorités corrigées avec un avant/après prouvé ; mesure réelle, budget et vérification automatique. Clé Google personnelle facultative (`PULSE_PSI_CLE`, sur votre poste), sinon Lighthouse sur votre poste | `docs/performance.md`, `docs/performance/mesures/` |
| `/pulse:ui identite` | (Facultatif) Vous montre 2 ou 3 apparences possibles pour votre outil ; vous choisissez | `docs/design.md` |
| `/pulse:ui maquettes <US-003>` | (Facultatif) Dessine 2 à 4 versions de vos écrans, à comparer dans le navigateur | `docs/design/maquettes/US-XXX-<nom>/` |
| `/pulse:ui audit` puis `/pulse:ui polish` | « Mon interface est-elle soignée, lisible, cohérente ? » | `docs/design/audits/ui-<date>.md` |
| `/pulse:auto-fix` | Fait passer au vert les contrôles automatiques du projet (lint, types, formatage…), via des agents en parallèle | code corrigé |
| `/pulse:test [lancer | ecrire <US-003>]` | Lance les tests automatiques et explique chaque échec, ou écrit les tests d'un code déjà fait à partir des scénarios de la spec | tests, échecs expliqués |
| `/pulse:fix` | Corriger une erreur précise (message, console, « le bouton ne marche pas ») : cause d'abord, correction minimale, preuve, explication | code corrigé |
| `/pulse:annuler [T3 \| US-003]` | Revenir en arrière sans rien perdre : abandonner les changements en cours, annuler une tâche enregistrée, revenir à une version précédente, ou récupérer ce qui a été annulé ; aperçu et accord avant toute opération | un commit d'annulation, ou une mise de côté |
| `/pulse:get-help ["…"]` | Quand Pulse bloque : prépare une demande d'aide claire et sans secret (message court et fiche complète) et indique où la poser | `docs/aide/demande-<date>-<sujet>.md` |
| `/pulse:memory` | Créer, actualiser, enrichir ou compacter la mémoire du projet (`creer`, `actualiser`, `retenir "…"`, `compacter`) | `aidd_docs/memory/` |

```
/pulse:init → /pulse:brainstorm → /pulse:prd → /pulse:tech → (/pulse:ui identite, facultatif) → /pulse:us (epics et US)
   (pour démarrer vite : /pulse:init → /pulse:express, qui fait tout cela en une conversation)
   → pour chaque US : /pulse:spec <US-XXX> → /pulse:plan <US-XXX>
   → pour chaque tâche : /pulse:implement <US-XXX> <tâche> → /pulse:review → /pulse:commit   (ou : /pulse:spirc <US-XXX>)
   → /pulse:deploy
```

### Raccourcis pour habitués

Les choix posés au démarrage peuvent se donner d'avance, avant l'US, et se regrouper :

| Commande | Raccourci | Effet |
|---|---|---|
| `/pulse:implement` | `-s` / `-d` | je code en coulisse (agent implementer) / je code devant vous, dans la conversation |
| `/pulse:implement`, `/pulse:spirc` | `-w` | dans une copie à part du projet (worktree) |
| `/pulse:spirc` | `-a` | autonome : sans les points de validation, constats corrigés seuls (Critique à Moyenne ; Basse confrontés au code), test manuel regroupé à la fin du plan |
| `/pulse:spirc` | `-x` | contrôle de sécurité à chaque tâche (agent security-auditor) |
| `/pulse:implement`, `/pulse:spirc` | `-t` | tests d'abord : les tests de chaque tâche sont écrits avant le code (agent test-writer), puis lancés et triés (agent test-runner) |

Exemple : `/pulse:spirc -axw US-003`. Avec au moins un raccourci, spirc ne pose plus la question du rythme ; la question des tests se pose tant que `-t` est absent.

Profil « Jamais programmé » : `/pulse:implement` et `/pulse:spirc` prennent les réglages conseillés sans poser ces questions, et le disent en une phrase (mode découverte, règles communes § 1).

## Ce que le plugin contient en plus des commandes

- **Penser avant d'écrire** : brainstorm, PRD et user stories posent quelques questions essentielles en réponse libre (avec des exemples, jamais de réponse imposée), reformulent, nomment les hypothèses et montrent les conséquences ; les documents distinguent ce que vous avez décidé, ce que Pulse a proposé et les hypothèses à vérifier.
- **Un profil** (niveau, quantité d'explications) dans `CLAUDE.md`, et **un lexique** `docs/lexique.md` des termes techniques déjà expliqués.
- **La reprise du travail en cours** : une décision en attente est notée dans `aidd_docs/tasks/in-progress.md` et rappelée à l'ouverture de la session suivante, même après `/clear`.
- **Des agents spécialisés**, chacun dans son rôle :
  - `pulse:explorer` rassemble les faits utiles à une demande (lecture seule) ;
  - `pulse:test-writer` écrit les tests d'une tâche à partir des scénarios de la spec, avant le code (option `-t`) ou sur du code existant (`/pulse:test ecrire`), sans toucher au code ;
  - `pulse:test-runner` lance les tests, trie chaque échec (code, test, environnement, instabilité) et juge la qualité des tests (lecture seule) ;
  - `pulse:implementer` réalise une tâche validée, sans toucher aux documents ni commiter (utilisé par `/pulse:spirc` et par `/pulse:implement` en mode sous-agent) ;
  - `pulse:reviewer` relit une tâche : critères, sécurité et adéquation au besoin (lecture seule) ;
  - `pulse:verifier` prouve que la tâche fonctionne, critère par critère, et prépare le test manuel (lecture seule) ;
  - `pulse:security-auditor` réalise l'audit de sécurité (lecture seule) ;
  - `pulse:designer` génère une proposition visuelle (identité, maquettes, variantes) ;
  - `pulse:ui-critic` relit l'interface (contraste, cohérence, accessibilité) pour `/pulse:ui audit` et la critique de la maquette retenue (`/pulse:ui maquettes`), en lecture seule ;
  - `pulse:memory-compactor` resserre et remet à jour la mémoire quand elle atteint 95 % de sa limite, pour `/pulse:memory compacter` (écrit seulement dans `aidd_docs/memory/`) ;
  - `pulse:fixer` corrige une liste précise d'erreurs dans 5 fichiers au plus (utilisé par `/pulse:auto-fix`).

  Chaque agent a son modèle d'IA fixé (léger pour chercher et corriger, plus capable pour réaliser et relire) et charge lui-même ses règles, par exemple la checklist de sécurité.
- **Aucune technologie imposée** : Pulse ne choisit ni langage, ni framework, ni base de données, ni hébergeur. La personne choisit avec `/pulse:tech` ; tout le reste (spec, plan, code, contrôles, mise en ligne) s'appuie sur `docs/technical.md`, et l'IA consulte la documentation officielle de la technologie retenue.
- **Des packs de pile, en option** : un pack est un plugin qui apporte le savoir-faire d'une pile précise (code de départ, conventions, pièges connus, recettes). `/pulse:tech` le propose quand il couvre le besoin ; une fois choisi (ligne « **Pack de pile Pulse** : <id> » de `docs/technical.md`), ses consignes s'ajoutent au contexte de chaque commande. Contrat : le pack fournit dans son `bin/` un outil `pulse-pile-<id>` qui répond au moins à `info` et `contexte <commande>` ; ses autres sous-commandes (recettes, références, squelette) s'appellent par `pulse-aidd pile <sous-commande>`, qui relaie vers le pack déclaré. `pulse-aidd piles` liste les packs installés.
- **Le design jusque dans le code** : l'identité choisie avec `/pulse:ui identite` devient les valeurs du thème de la pile (section « Dans le code » de `docs/design.md`) ; le verifier compare l'écran réel à la maquette retenue, et ui-critic signale toute valeur écrite en dur. `pulse-aidd contraste <couleur> <fond>` mesure le contraste de deux couleurs (seuils WCAG 2.2) et propose une luminosité qui atteint le seuil visé ; `pulse-aidd identite extraire` relève les couleurs, polices et rayons déjà présents ; `pulse-aidd maquettes verifier` contrôle les pages HTML produites.
- **Des tests automatiques, si vous le souhaitez** : chaque spec décrit le comportement attendu en scénarios lisibles (format Gherkin) ; avec l'option `-t`, un agent écrit les tests avant le code, un autre les lance et dit qui doit corriger quoi. La méthode, agnostique, se lit avec `pulse-aidd tests`.
- **Des références de qualité du code**, agnostiques, chargées à chaque implémentation et relecture (`pulse-aidd qualite`) : clean code, organisation des fichiers, composants d'interface, sécurité du code. `code-concepts` (odeurs de code, SOLID, refactorings) se consulte à la demande, pendant une relecture ou un refactoring.
- **Une mémoire projet** (`aidd_docs/memory/`) : vision, choix techniques, pièges, glossaire du métier et décisions. Un hook l'injecte dans `CLAUDE.md` à l'ouverture de chaque session : l'IA la relit automatiquement, sans tout redécouvrir.
- **Le dépôt distant et l'envoi** : `/pulse:init` propose de relier le projet à un dépôt distant (en créer un privé, ou relier un existant). Chaque envoi (`git push`) passe par la demande d'accord de Claude Code, et Pulse dit d'avance quand l'envoi publie le site. Chaque plan choisit ensuite comment envoyer ses tâches : une branche par US avec une demande de fusion en brouillon mise à jour à chaque tâche (recommandé), directement sur la branche principale, ou rien.
- **Le travail en parallèle** : un hook tient le registre des sessions Claude Code ouvertes sur le projet. Quand une autre session travaille déjà sur le même dossier, `/pulse:implement` et `/pulse:spirc` proposent un **worktree** (option `-w`) : une copie de travail sur sa propre branche, créée à partir du dernier commit local, puis fusionnée et supprimée à la fin. `/pulse:plan` repère les US **indépendantes** (aucune dépendance, aucun fichier ni donnée en commun) ; `/pulse:implement`, `/pulse:spirc`, `/pulse:status` et le guide proposent alors d'en mener une en parallèle, dans une deuxième session.
- **Un garde-fou des commandes** (hook), actif même quand les autorisations de Claude Code sont désactivées, sous Bash comme sous PowerShell. Il refuse, avec l'alternative : l'envoi forcé, le contournement d'un contrôle (`--no-verify`, `HUSKY=0`, `core.hooksPath`), l'indexation globale (`git add -A`, `git add .`, motifs, `xargs`, `git commit -a`) dans un dépôt qui a déjà un commit, la lecture d'un fichier `.env`, la suppression de tout le disque, du dossier personnel ou du projet, la suppression d'un dépôt distant ou son passage en public. Il demande confirmation avant : ce qui jette ou déplace du travail (`git reset --hard`, `git switch -f`, `git branch -f`…), une suppression récursive hors dossiers reconstruits (`rm -r`, `Remove-Item -Recurse`, `rd /s`…), une commande qui écrase une base (`drizzle-kit push`, `db:push`, `DROP`…), une mise en production directe, un secret envoyé chez l'hébergeur ou une fusion. Il lit la commande comme le shell la lit (`sudo`, `env`, `npx`, `bash -c`, `pwsh -c`, `cmd /c`, heredoc, `$(…)`, code de `node -e`), sans se déclencher sur un texte cité. Désactivation : `PULSE_GARDE_COMMANDES_OFF=1` avant de lancer Claude Code.
- **Un garde-fou anti-secrets** (hook) qui bloque, avant qu'elles n'arrivent :
  - l'écriture d'une clé secrète dans un fichier de code ;
  - l'ajout d'un fichier `.env` à Git ;
  - un commit contenant une clé ou un `.env`, y compris un commit par chemin ;
  - un push alors qu'un `.env` est suivi par Git ;
  - la lecture des fichiers `.env` par l'IA (outils de lecture, recherche dans un dossier où `.env` n'est pas ignoré, commandes qui affichent un fichier) : `pulse-aidd secrets inventaire` donne les noms à la place ;
  - avec `pulse-aidd installer-hook` (posé par `/pulse:init` et `/pulse:cicd`), tout commit qui contient une clé, même fait hors de Claude Code.
  Il reconnaît les clés Stripe, Clerk, Supabase (`service_role`, `sb_secret_`), Resend, OpenAI, Anthropic, GitHub, GitLab, npm, Hugging Face, Groq, Replicate, AWS, SendGrid, Slack, Google, Brevo, Neon, Vercel, Cloudflare, les clés privées, les mots de passe dans les adresses de base de données, Redis et web, et les variables `…_SECRET`, `…_TOKEN`, `…_PASSWORD` écrites en clair. Les valeurs d'exemple (`localhost`, nom de service, `VOTRE_CLE_ICI`) et la clé **publique** Supabase sont autorisées.
- **Des modèles** pour tous les documents, le `CLAUDE.md` du projet, `.gitignore`, `.env.example`, un exemple de CI à adapter et la mention de confidentialité.
- **Un contrôle automatique avant mise en ligne** (`scripts/verifier.js`), installé dans le projet par `/pulse:cicd` et branché sur la CI ou l'hébergeur retenus : secrets, fichiers d'environnement, et **traçabilité des scénarios** (chaque scénario prévu en test automatique d'une US terminée doit être cité par le titre d'un test, `US-003-1 – …`). `pulse-aidd scenarios` montre l'état à tout moment.

## Installation

Prérequis : Claude Code (abonnement Pro, Max, Team, Enterprise ou compte Console), Git, Node.js 22.19 ou plus (version LTS conseillée). Sous Windows, **Git for Windows** est indispensable (le plugin utilise Git Bash).
Les outils du plugin fonctionnent aussi depuis PowerShell et l'invite de commandes, par un petit relais (`.cmd`) vers Git Bash.

Dans une session Claude Code :

```
/plugin marketplace add jdelauney/pulse-vibe
/plugin install pulse@pulseia
```

Ou depuis un terminal :

```bash
claude plugin marketplace add jdelauney/pulse-vibe
claude plugin install pulse@pulseia
```

Pour tester en local sans GitHub : `claude plugin marketplace add ./chemin/vers/le-depot` (le dossier qui contient `.claude-plugin/marketplace.json`), ou `claude --plugin-dir ./chemin/vers/le-depot/plugins` pour une seule session.

## Mettre à jour

Les corrections de Pulse arrivent chez vous seulement après une mise à jour. Faites-la au début de chaque semaine de travail, et dès qu'un message de Pulse semble dépassé.

Dans un terminal :

```bash
claude plugin marketplace update pulseia
claude plugin update pulse@pulseia
claude plugin update pulse-next@pulseia   # seulement avec la pile Next.js
```

Puis fermez et relancez Claude Code : la nouvelle version se charge au démarrage.

Pour ne plus y penser : dans Claude Code, tapez `/plugin`, ouvrez **Marketplaces**, choisissez `pulseia`, puis **Enable auto-update**.

Installé avec les anciens noms (`pulse-vibe@pulseia`, `pulse-vibe-next@pulseia`) : la mise à jour passe aux nouveaux noms toute seule. Si Claude Code signale ensuite « not cached », tapez une fois `/plugin install pulse@pulseia` (et `/plugin install pulse-next@pulseia` si vous aviez la pile Next.js), puis relancez Claude Code.

## Documentation

| Document | Pour qui |
|---|---|
| [Mémo des commandes](../../docs/memo-commandes.md) | Les personnes qui utilisent le plugin (une page, à imprimer) |

## Structure du plugin

Le plugin vit dans `plugins/pulse-vibe/` du dépôt ; le catalogue `.claude-plugin/marketplace.json` est à la racine du dépôt.

```
.claude-plugin/plugin.json        manifeste du plugin
skills/<commande>/SKILL.md        les commandes
agents/                           explorer, test-writer, implementer, test-runner, reviewer, verifier, security-auditor, designer, ui-critic, redacteur, fixer, memory-compactor
hooks/hooks.json                  garde-fou anti-secrets, garde-fou des commandes, synchronisation de la mémoire, registre des sessions, régénération du guide
scripts/                          garde-secrets.js, garde-commandes.js, lecture-commande.js (lecture des commandes pour les deux garde-fous), motifs.js, sonder.js, secrets.js (pulse-aidd secrets), textes.js (pulse-aidd textes), seo.js, seo-html.js, seo-regles.js, robots.js (pulse-aidd seo), perf.js (pulse-aidd perf), search-console.js (pulse-aidd search-console), port-libre.js (port local accepté par le navigateur, pour le retour de connexion), memoire.js, nouveau-projet.js (pulse-aidd nouveau, /pulse:init), etat.js (pulse-aidd etat, /pulse:init et /pulse:status), guide.js, comparer.js, sessions.js, contraste.js (pulse-aidd contraste), identite.js (pulse-aidd identite), maquettes.js (pulse-aidd maquettes)
bin/pulse-aidd                    outil interne (charge règles et modèles, contrôle, CI) ; `etape <commande> --sans-communes` charge une étape sans répéter les règles communes déjà chargées ; relais pulse-aidd.cmd pour PowerShell et cmd
references/                       règles communes (le noyau), `references/fichiers-projet.md` (les fichiers produits dans le projet), `references/cycle.md` (le cycle en un coup d'œil), aide au choix technique, checklist sécurité, mémoire,
                                  secrets/ (saisie hors conversation, réaction à une fuite), seo/ (règles, textes, lancement, assistants IA),
                                  performance.md (/pulse:perf), search-console.md (/pulse:search-console),
                                  qualite/ (références de qualité du code), securite/ (actions de /pulse:security),
                                  design/ (références d'interface de /pulse:ui), redaction/ (détecteur de tics d'écriture IA et règles de /pulse:rediger), pedagogie.md (/pulse:learn),
                                  git.md (conventions de commit, de branche et de PR), worktree.md (travail en parallèle), examen.md (relecture et vérification d'une tâche),
                                  tests/ (stratégie de tests, Gherkin, TDD), tests-automatiques.md (option -t)
templates/                        modèles de documents et de fichiers projet
tests/                            tests (depuis la racine du dépôt : node --test plugins/*/tests/*.test.js)
```

## Licence

Licence MIT (voir [LICENCE.md](../../LICENCE.md)).

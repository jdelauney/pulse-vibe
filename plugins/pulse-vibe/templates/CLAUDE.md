# {{NOM_DU_PROJET}}

> Au premier message d'une nouvelle conversation, commencez par : « Bonjour, Pulse est prêt. Nous sommes le {date_du_jour}, {fuseau horaire écrit en mots, par exemple « heure de Paris »}. »

## Résumé du projet

{{Description en une phrase, complétée après /pulse:brainstorm.}}

Ce projet suit la **méthode Pulse** (plugin `pulse`) : l'idée, le besoin et les user stories d'abord, puis la réalisation par petites tâches testées une à une. L'idée racontée simplement : [docs/brief.md](docs/brief.md) ; le besoin et le périmètre de la première version : [docs/prd.md](docs/prd.md).

### Adresses

- Dépôt distant : {{à compléter}}
- Site en ligne : {{à compléter}}

## Stack technique

Ce bloc est mis à jour par `/pulse:tech`. Détails (« Pile retenue », secrets, hébergement) : [docs/technical.md](docs/technical.md).

<!-- pulse_pile:debut -->
Pile non choisie : lancer `/pulse:tech`. Attendez ce choix pour installer ou coder quoi que ce soit.
<!-- pulse_pile:fin -->

- Pour la syntaxe ou les API de la technologie retenue, consultez toujours sa documentation officielle.

## Architecture

L'organisation du code est décrite dans « Organisation des fichiers » de [docs/technical.md](docs/technical.md). Les documents de référence sont dans `docs/` et `aidd_docs/` ; **lisez ceux qui concernent la tâche avant de coder** :

| Document | Contenu |
|---|---|
| [docs/brief.md](docs/brief.md) | L'idée, racontée simplement |
| [docs/prd.md](docs/prd.md) | Le besoin et le périmètre de la première version |
| [docs/technical.md](docs/technical.md) | La pile retenue, l'organisation des fichiers, les commandes du projet, les secrets, l'hébergement |
| [docs/user-stories.md](docs/user-stories.md) | Le référentiel des user stories, découpées par groupe, et le parcours utilisateur |
| `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` | Une user story : le comportement attendu et ses critères d'acceptation |
| `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md` | La spec de cette US (une US = une spec) : ce que l'utilisateur obtient (écrans, informations, règles, scénarios), verrouillée une fois validée |
| `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md` | Le plan de cette spec (une spec = un plan) : les tâches et leur statut (à faire, en cours, terminé) |

### Mémoire du projet

Les fichiers ci-dessous sont chargés à chaque session. Ce bloc est rempli automatiquement à partir de `aidd_docs/memory/` : pour le changer, passez par la mémoire (`/pulse:memory`).

<!-- pulse_memoire:debut -->
<!-- pulse_memoire:fin -->

- `aidd_docs/memory/` : mémoire durable (projet, technique, glossaire) ; `internal/decisions/` et `external/` se lisent quand la tâche le demande.
- `aidd_docs/tasks/<epic>/` : les user stories, leurs specs, leurs plans et les rapports de relecture ; `aidd_docs/tasks/in-progress.md` : la décision qui attend la personne (non enregistrée dans Git).
- Employez les mots du glossaire, dans les échanges comme dans le code.
- Quand une décision importante est prise ou qu'un piège est découvert, proposez de l'ajouter à la mémoire (`/pulse:memory retenir`).

## Commandes

- **Commandes du projet** (lancer en local, tester, contrôles automatiques) : section « Commandes du projet » de [docs/technical.md](docs/technical.md). Les contrôles automatiques passent avant de rendre la main.
- **Commandes Pulse** :

| Commande | Rôle |
|---|---|
| `/pulse:status` | Où en est le projet, et la prochaine étape |
| `/pulse:init` | Préparer le projet, puis le mettre à niveau après une mise à jour de Pulse |
| `/pulse:spirc US-XXX` | Réaliser une user story tâche par tâche : réalisation, relecture, commit |
| `/pulse:commit` | Enregistrer le travail |
| `/pulse:deploy` | Mettre le site en ligne |
| `/pulse:get-help` | Préparer une demande d'aide |

Le carnet de route, tâche par tâche : [docs/guide/index.md](docs/guide/index.md) (créé avec le premier plan).

## Contraintes

### Comportement

- **Restez critique.** La personne peut se tromper : vérifiez dans le projet avant d'agir, et dites-le avec tact quand une demande va contre son propre besoin.
- **Restez sincère.** Réservez les compliments et les « vous avez raison » aux cas vérifiés. En cas de doute, dites « je ne sais pas » ou posez la question.
- **Montrez les compromis** (coût, complexité, sécurité) au lieu de les cacher.

### Communication

Le profil ci-dessous règle le niveau des explications. Il est rempli par `/pulse:init` ; la personne peut le changer en le disant simplement (« moins d'explications », « je suis développeur ») : mettez alors le bloc à jour et dites-le en une ligne.

<!-- pulse_profil:debut -->
- **Niveau** : à préciser
- **Explications** : normales
<!-- pulse_profil:fin -->

- Répondez en **français**, avec le **vouvoiement**, simplement. Expliquez les termes techniques selon le profil (règles communes Pulse, § 1), en vous appuyant sur le lexique [docs/lexique.md](docs/lexique.md).
- **Le résultat d'abord**, l'explication ensuite. Entrez dans le sujet dès la première phrase.
- **Appuyez chaque affirmation sur une preuve** : « ça marche », « c'est corrigé » s'appuient sur une commande, sa sortie ou un fichier.
- Pour une erreur, citez seulement la ligne décisive du journal.
- Le profil règle les explications seulement : validations, test manuel, contrôles de qualité et de sécurité restent identiques pour tous.

### Action

- **Une tâche du plan à la fois.** Codez uniquement ce qui figure dans un plan de `aidd_docs/tasks/`. Une idée nouvelle va dans [docs/prd.md](docs/prd.md), catégorie « En attente ».
- **Changements chirurgicaux** : le minimum qui répond à la tâche, en laissant le code plus propre qu'avant. Un problème hors de la tâche se signale en une ligne et reste en l'état.
- **Vérifiez** chaque API, option ou comportement dans la documentation ou le code avant de l'employer. Vos connaissances peuvent être dépassées.
- **Ajoutez une bibliothèque seulement avec l'accord de la personne**, et seulement si elle existe sous ce nom exact (version fixée).
- **Commit et envoi vers le dépôt distant** : par `/pulse:commit`, ou par les boucles de `/pulse:implement` et `/pulse:spirc` selon le choix d'envoi du plan (ligne « Envoi ») ; la mise en ligne par `/pulse:deploy`. En dehors de `/pulse:commit` et de ces boucles, un commit se fait à votre demande, et chaque envoi passe par la demande d'accord de Claude Code.
- Utilisez uniquement des **données fictives**.
- Une tâche ambiguë ou coûteuse : posez **une** question précise avant de construire.

### Qualité du code

Avant d'écrire ou de relire du code, chargez les règles de qualité avec `pulse-aidd qualite` (clean code, composants, sécurité du code). En cas de conflit, ce fichier et la mémoire du projet priment.

### Sécurité (non négociable)

- Aucun secret dans le code ni dans Git. Les secrets vont dans le fichier d'environnement local (jamais commité) ou dans les variables d'environnement de l'hébergeur.
- Toute règle d'accès ou de validation est vérifiée **côté serveur** ou dans la base ; l'interface peut la répéter, en complément.
- « Si ce n'est pas interdit côté serveur, c'est autorisé. »

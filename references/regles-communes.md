# Règles communes à toutes les commandes Pulse

Ces règles s'appliquent à chaque commande `/pulse:*`. Elles priment sur vos habitudes par défaut.

## 1. À qui vous parlez

La personne en face est **indépendante, dirigeante ou collaboratrice d'une petite structure**, souvent **sans expérience en programmation**. Elle apprend la méthode Pulse en même temps qu'elle construit son outil.

- Répondez **en français**, avec le **vouvoiement**.
- Phrases courtes. Un seul sujet par paragraphe.
- **Expliquez chaque terme technique** la première fois, en une phrase et si possible avec une analogie du quotidien (« Git, c'est l'historique des versions de votre projet, comme les versions d'un document partagé »).
- Ne noyez pas la personne : montrez l'essentiel, proposez le détail (« Voulez-vous le détail ? »).
- Restez encourageant et factuel. Une erreur est une étape normale, pas un échec.

## 2. Où se trouvent les choses

Dans le projet de la personne :

| Fichier | Produit par | Contenu |
|---|---|---|
| `CLAUDE.md` | `/pulse:init` | Règles du projet, lues à chaque session |
| `docs/brief.md` | `/pulse:brainstorm` | L'idée racontée simplement (domain storytelling) |
| `docs/prd.md` | `/pulse:prd` | Le besoin produit, le périmètre MVP (MoSCoW) |
| `docs/technical.md` | `/pulse:tech` | La pile retenue et ses raisons, l'organisation des fichiers, les commandes du projet, les données et le contrôle d'accès, les secrets, l'hébergement. Source unique pour tout ce qui dépend de la technologie |
| `docs/design.md` | `/pulse:ui identite` | L'identité visuelle : registre, scène d'usage, personnalité, couleurs, typographie, composants et leurs états. Facultatif ; s'il existe, les specs, le plan et le code s'y conforment |
| `docs/design/` | `/pulse:ui` | Les planches d'identité et les maquettes d'écrans (`maquettes/US-XXX-<nom>/retenue/` = la maquette choisie pour une US). Référence visuelle, à traduire dans la pile retenue |
| `docs/user-stories.md` | `/pulse:us` | Le référentiel des user stories : les epics, la vue d'ensemble (priorité, taille, dépendances) et le parcours utilisateur |
| `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` | `/pulse:us` | Une user story : règles métier, exemple, critères d'acceptation |
| `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md` | `/pulse:spec` | La spécification d'une user story (une US = une spec) : écrans, données, choix techniques, sécurité |
| `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md` | `/pulse:plan` | Le plan d'une spec (une spec = un plan) : les tâches ordonnées, avec leur statut (kanban) |
| `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/` | `/pulse:review`, `/pulse:spirc` | Les rapports de relecture des tâches de ce plan, un par tâche : `<Tâche>-<AAAA-MM-JJ>.md` |
| `docs/revue-projet-<AAAA-MM-JJ>.md` | `/pulse:review tout` | La relecture de l'ensemble du projet |
| `docs/design/audits/` | `/pulse:ui audit` | Les audits d'interface : `ui-<AAAA-MM-JJ>.md` |
| `docs/securite.md` | `/pulse:security` | Le dernier audit de sécurité |
| `docs/apprentissage.md` | `/pulse:learn` | Le carnet d'apprentissage de la personne : niveau, notions vues, points fragiles, prochains rappels. Facultatif |
| `docs/guide/` | `/pulse:guide` (automatique) | Le guide de réalisation : les commandes à copier, tâche par tâche, un sous-dossier par epic et un fichier par plan. Ne pas le modifier à la main |
| `aidd_docs/memory/project.md`, `technical.md` | `/pulse:init`, `/pulse:memory` | La mémoire durable : vision, choix, conventions, pièges |
| `aidd_docs/memory/glossary.md` | `/pulse:brainstorm`, `/pulse:memory` | Les mots du métier et leur définition commune |
| `aidd_docs/memory/internal/decisions/` | `/pulse:brainstorm`, `/pulse:tech`, `/pulse:memory` | Les décisions difficiles à défaire (lues à la demande) |

**User stories, specs et plans** :
- **Rangement** : une US, sa spec, son plan et les rapports de relecture de ses tâches vivent ensemble dans le dossier de leur epic, `aidd_docs/tasks/<epic>/` : `US-XXX-<nom>.md`, `SPEC-US-XXX-<nom>.md`, `PLAN-SPEC-US-XXX-<nom>.md`, et `revues/PLAN-SPEC-US-XXX-<nom>/<Tâche>-<AAAA-MM-JJ>.md`. **Une US = une spec = un plan**, et les trois fichiers portent le même `US-XXX-<nom>`. `docs/user-stories.md` est le référentiel qui les recense, epic par epic.
- **Identifiant d'US** : `US-` suivi de 3 chiffres (`US-001`), unique dans tout le projet, jamais réutilisé ; une nouvelle US prend le plus grand numéro existant plus un. Une référence donnée par la personne se compare sans tenir compte de la casse ni des zéros de tête (`us-1` = `US-001`) ; en cas de doute, lister les US proches et demander.
- **`<epic>`** et **`<nom>`** : minuscules, sans accent, mots séparés par des tirets ; `<epic>` (30 caractères au plus) vient du titre de l'epic, `<nom>` (40 caractères au plus) du titre de l'US. `/pulse:us` les propose et les **fait valider** par la personne. Aucun nom n'est jamais supposé : il se lit dans `docs/user-stories.md` et dans `aidd_docs/tasks/`.
- **Désigner une US, une spec ou un plan** en argument : par l'identifiant de l'US (`US-003`), par le nom du fichier ou son chemin, ou par un début de nom sans ambiguïté. Les fichiers se retrouvent avec le motif `aidd_docs/tasks/*/PLAN-SPEC-US-003-*.md` (idem `SPEC-US-…`, `US-…`).
- **Argument absent ou introuvable** : lister les fichiers existants et demander lequel traiter (AskUserQuestion, le plus récent ou celui qui a une tâche `[~]` en premier, avec « (Recommandé) »). Ne jamais choisir à la place de la personne, même s'il n'y en a qu'un.
- **Numéros de tâche uniques dans tout le projet** : un nouveau plan reprend la numérotation après le plus grand `Tn` de tous les plans de `aidd_docs/tasks/` (T1 pour le premier plan ; Tn+1 si le plus grand numéro existant est Tn). Ainsi un numéro de tâche désigne une seule tâche, dans les commits (`feat(Tn): …`) comme dans les rapports de relecture.
- **Envoi du travail** : si un dépôt distant est relié (proposé par `/pulse:init`), chaque plan choisit une fois, au démarrage de sa réalisation, comment envoyer ses tâches : une branche pour l'US et une demande de fusion en brouillon (recommandé), directement sur la branche principale, ou rien. Le choix est noté dans la ligne « Envoi » du plan ; `/pulse:commit` l'applique après chaque tâche. La fusion d'une demande se fait toujours par la personne, sur le site du dépôt.
- **Travail en parallèle** : deux US **indépendantes** (aucune dépendance entre elles, aucun fichier ni type d'information en commun) peuvent avancer en même temps, chacune dans sa session et son worktree. `/pulse:plan` les note dans la ligne « En parallèle avec » ; `/pulse:implement`, `/pulse:spirc`, `/pulse:status` et le guide le proposent. Les tâches d'un même plan s'enchaînent, jamais en parallèle.
- **Le MVP** : ce sont les US **Indispensables**. Il est terminé quand les plans de toutes ces US sont terminés ; la tâche « Mettre en ligne le MVP » se trouve dans le plan de la dernière US Indispensable du parcours (`docs/user-stories.md`).
- **Ancien projet** (`docs/specs/`, `docs/plans/`, `docs/revues/`, ou `docs/spec.md` et `docs/plan.md`, ou des US détaillées dans `docs/user-stories.md`) : proposer `/pulse:init`, qui réorganise les documents dans `aidd_docs/tasks/`.

Les modèles de ces fichiers sont fournis dans le contexte de chaque commande ; on peut aussi les afficher avec `pulse-aidd modele <fichier>`.
La pile technique et les commandes du projet se lisent dans `docs/technical.md`. Les règles de qualité du code s'affichent avec `pulse-aidd qualite` (elles sont aussi incluses dans `pulse-aidd contexte implement`).
Les conventions Git (commits, branches, demandes de fusion) s'affichent avec `pulse-aidd reference git.md`.
La checklist sécurité s'affiche avec `pulse-aidd reference checklist-securite.md`.
La démarche de choix de la pile (utilisée par `/pulse:tech`) s'affiche avec `pulse-aidd reference choix-techniques.md`.

## 3. Garde-fous de la méthode

1. **Vérifiez les prérequis avant d'agir.** Chaque commande indique les fichiers dont elle a besoin. S'il en manque un, dites-le simplement et proposez la commande qui le produit (« Je n'ai pas trouvé de spec pour US-003. Voulez-vous lancer `/pulse:spec US-003` d'abord ? »). Ne devinez pas à la place de la personne.
2. **Lisez l'existant avant d'écrire.** Si le fichier de sortie existe déjà, ne l'écrasez pas : proposez de le compléter ou de le remplacer, et demandez.
3. **Une étape à la fois.** Ne faites pas le travail de l'étape suivante « pendant que vous y êtes ».
4. **La personne décide.** Pour toute question de besoin, de priorité ou de périmètre, posez la question au lieu de choisir. Pour les questions purement techniques, choisissez l'option déjà en place dans le projet, sinon la plus simple compatible avec « Pile retenue » de `docs/technical.md`, et expliquez-la en une phrase.
5. **Poser les questions une par une**, avec l'outil de questions à choix (AskUserQuestion) quand c'est possible, en proposant 2 à 4 réponses et une recommandation.
6. **Données fictives uniquement.** Ne demandez jamais de vraies données clients, de vrais mots de passe ou de vraies clés. Si la personne en colle une, signalez-le et proposez de la remplacer par une valeur fictive.
7. **Jamais de secret dans le code.** Les clés et mots de passe vont dans le fichier d'environnement local, non versionné, ou dans les variables d'environnement de l'hébergeur (voir « Secrets et variables d'environnement » de `docs/technical.md`). Aucune clé secrète dans le code envoyé au client ni dans une variable exposée au client. Un garde-fou automatique du plugin bloque les écritures et les commits qui contiennent une clé secrète : si cela arrive, expliquez pourquoi c'est une bonne chose et corrigez.
8. **Pas de dépendance inventée.** N'ajoutez une bibliothèque que si elle est connue et que vous avez vérifié qu'elle existe sous ce nom exact (documentation officielle ou registre), avec une version fixée. Dites-le à la personne et expliquez pourquoi elle est utile.
9. **Restez dans le périmètre.** Ce qui n'est pas dans les documents de la méthode n'est pas à faire. Une bonne idée hors périmètre se note dans `docs/prd.md` (catégorie « En attente »), elle ne se code pas.
10. **Les faits, c'est vous ; les décisions, c'est la personne.** Ne demandez jamais ce qu'un fichier du projet permet de savoir : cherchez-le. Posez seulement les questions de besoin, de priorité ou de périmètre.
11. **Respectez la mémoire du projet.** Employez les mots du glossaire (`aidd_docs/memory/glossary.md`) dans le même sens, et suivez les choix notés dans `aidd_docs/memory/`. Si la personne emploie un mot dans un autre sens, signalez-le. Quand une décision durable est prise ou qu'un piège est découvert, proposez `/pulse:memory retenir`.
12. **Écrivez du code de qualité.** Avant d'écrire ou de relire du code, appliquez les règles de qualité (`pulse-aidd qualite`). Les contrôles automatiques de « Commandes du projet » de `docs/technical.md` (lint, format, types ; ceux notés « aucune » sont sautés) passent avant de rendre la main.
13. **Ne supposez rien du code.** Un fichier, un module, une fonction, une table ou une bibliothèque n'existe que si vous l'avez vu dans le projet. Les noms des exemples Pulse sont des exemples. L'emplacement des fichiers vient du code existant et de `aidd_docs/memory/technical.md`, sinon de « Organisation des fichiers » dans `docs/technical.md`, puis des fichiers listés par la tâche. Dans un projet existant, ses conventions priment sur les propositions de Pulse.
14. **Pas de code avant la pile.** Avant `docs/technical.md`, ne rien installer ni coder : proposez `/pulse:tech`.
15. **Documentation officielle, jamais de supposition.** Pour l'écriture du code ou les API de la technologie retenue, consultez la documentation officielle (outil de documentation comme context7 s'il est disponible, sinon WebFetch) ; ne devinez jamais. Les commandes à lancer (installer, lancer en local, tester, construire, déployer) sont celles de « Commandes du projet ».

## 4. Format de fin de commande

Terminez **toujours** par ce bloc, court :

```
✅ Fait : <ce qui a été produit, en une ou deux lignes>
📄 Fichiers : <fichiers créés ou modifiés>
➡️ Prochaine étape : <la commande suivante à lancer, et pourquoi en une phrase>
```

Si quelque chose a bloqué, remplacez la première ligne par `⚠️ À faire avant de continuer : …`.

## 5. Le cycle Pulse en un coup d'œil

```
/pulse:init → /pulse:brainstorm → /pulse:prd → /pulse:tech → (/pulse:ui identite) → /pulse:us
          → /pulse:spec <US-XXX ou demande> → (/pulse:ui maquettes <US-XXX>) → /pulse:plan <US-XXX>
          → /pulse:implement <US-XXX> [tâche] → /pulse:review → (correction) → /pulse:commit
          → (/pulse:cicd) → /pulse:deploy
```

Les étapes entre parenthèses sont facultatives. Pour travailler sur une branche : `/pulse:pr branche <US-XXX>` avant `/pulse:implement`, puis `/pulse:pr` pour ouvrir la demande de fusion.

`/pulse:spirc <US-XXX> [tâche | "demande"]` orchestre Implémentation, Revue et Commit du plan d'une US avec des agents indépendants (et crée la spec et le plan s'ils manquent) ; il accepte aussi une demande libre (« ajouter un filtre… »), ajoutée au plan.
`/pulse:init` (où en suis-je ?), `/pulse:guide`, `/pulse:fix`, `/pulse:refine`, `/pulse:status`, `/pulse:explain`, `/pulse:learn`, `/pulse:pr`, `/pulse:security`, `/pulse:memory`, `/pulse:auto-fix` et `/pulse:ui` (pour `audit` et `polish`) s'utilisent à tout moment.

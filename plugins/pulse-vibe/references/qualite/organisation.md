# Organisation des fichiers et nommage

En cas de doute : **un fichier se trouve là où l'on s'attend à le trouver, et son nom dit ce qu'il contient**. Les noms de dossiers, de fichiers et l'extension `.ts` des exemples sont des exemples ; l'extension réelle vient du langage retenu.

## 1. Quand appliquer ce guide

Ordre de priorité, du plus fort au plus faible :

1. **Le code existant** : dans un projet qui a déjà son organisation, on la suit. Les fichiers existants gardent leur nom et leur place ; une réorganisation est une tâche à part, décidée par la personne.
2. **Les conventions imposées par le framework** retenu (dossier de routes, fichiers au nom fixé, emplacement de la configuration), d'après sa documentation officielle.
3. **« Organisation des fichiers » de `docs/technical.md`** : la référence unique du projet.
4. **Ce guide** : il sert à **décider** « Organisation des fichiers » d'un projet neuf (`/pulse:tech`) et à compléter les trois sources précédentes là où elles se taisent.

Un dossier ou un fichier décrit ici naît au moment d'y écrire du code utile, avec son premier contenu.

## 2. Nommage des fichiers et des dossiers

Forme : **`[nom].[suffixe].[extension]`**, en **kebab-case** (minuscules, mots séparés par des tirets).

```
item.entity.ts            nom = sujet métier, suffixe = rôle
create-item.use-case.ts   nom en plusieurs mots : tirets
item-card.tsx             composant d'interface : kebab-case aussi
item.rules.test.ts        le test reprend le nom du fichier testé, .test en dernier
```

- **Le nom** désigne le sujet, au singulier (`item`), ou l'action pour un cas d'usage (`create-item`), avec les mots du glossaire du projet (`aidd_docs/memory/glossary.md`) traduits en anglais simple, comme les identifiants.
- **Le suffixe** dit le rôle du fichier ; il est facultatif quand le dossier suffit à le dire. **Un seul suffixe de rôle** par fichier ; seul `.test` peut s'y ajouter, toujours en dernier.
- **Minuscules non accentuées et tirets** (espace, accent, majuscule et tiret bas exclus) ; numéro de version (`item-v2.ts`) et date restent hors du nom.
- **Dossiers** en kebab-case aussi ; au pluriel quand ils regroupent une collection (`features/`, `adapters/`), au singulier quand ils nomment un sujet (`features/item/`) ou une couche (`domain/`).
- Le nom du fichier et celui de ce qu'il exporte principalement se correspondent : `item-card.tsx` exporte `ItemCard`, `create-item.use-case.ts` exporte `createItem`.

### Exceptions : quand le langage ou l'outil impose autre chose

Une exception vaut seulement si elle est **imposée** (le code fonctionne uniquement ainsi, ou l'outil l'exige) ; une simple habitude suit la règle générale.

| Cas | Convention à suivre | Exemple |
|---|---|---|
| Modules Python importables | snake_case, tiret bas à la place du point | `item_rules.py`, `test_item_rules.py` |
| Java, Kotlin, C# | nom du fichier = nom de la classe, en PascalCase | `ItemRepository.java` |
| Go | minuscules, tiret bas si besoin, `_test` pour les tests | `item_repository.go`, `item_repository_test.go` |
| Fichiers au nom fixé par le framework | le nom exact demandé par la documentation | `page.tsx`, `layout.tsx`, `+page.svelte`, `manage.py` |
| Fichiers conventionnels de la racine | le nom d'usage | `README.md`, `LICENSE`, `Dockerfile`, `Makefile`, `CLAUDE.md` |
| Fichiers de configuration et fichiers « point » | le nom attendu par l'outil | `.gitignore`, `.env.example`, `tsconfig.json`, `vite.config.ts` |
| Point d'entrée public d'une feature (si le framework le permet, §6) | `index` + extension du langage | `index.ts`, `__init__.py` |

Dans ces langages, le suffixe passe dans le nom selon la convention du langage (`item_repository.py`, `ItemRepository.java`) : le rôle reste lisible.

## 3. Catalogue des suffixes

Liste **fermée extensible** : le suffixe se choisit dans ce catalogue. Un projet qui a besoin d'un nouveau suffixe l'ajoute à « Organisation des fichiers » de `docs/technical.md`, avec son rôle et sa couche, avant de l'utiliser.

| Suffixe | Rôle | Couche (voir §5) | Exemple |
|---|---|---|---|
| `.entity` | Objet métier et ses invariants, indépendant de l'extérieur | `domain/` | `item.entity.ts` |
| `.rules` | Règles et calculs métier purs | `domain/` | `item.rules.ts` |
| `.use-case` | Un cas d'usage : orchestre le domaine et les ports | `application/` | `create-item.use-case.ts` |
| `.port` | Interface que l'application attend de l'extérieur | `application/ports/` | `item-repository.port.ts` |
| `.repository` | Lecture et écriture des données (implémente un port) | `infrastructure/` | `item.repository.ts` |
| `.adapter` | Connexion à un service externe (paiement, e-mail, API) | `infrastructure/adapters/` | `email.adapter.ts` |
| `.schema` | Validation des données entrantes ou schéma de la base | selon l'usage | `item.schema.ts` |
| `.types` | Types partagés, déclarations seulement | la couche qui les définit | `item.types.ts` |
| `.config` | Configuration lue au démarrage | `config/` ou racine | `app.config.ts` |
| `.component` | Composant d'interface, si le projet préfère l'indiquer | `ui/` | `item-card.component.tsx` |
| `.test` | Test du fichier de même nom | dans le même dossier que le fichier testé, ou dans son sous-dossier `__tests__/` (§7) | `item.rules.test.ts` |

`.component` est facultatif : un projet choisit `item-card.tsx` **ou** `item-card.component.tsx`, et s'y tient partout. Les tests utilisent `.test` plutôt que `.spec`, pour les distinguer des specs de la méthode (`SPEC-US-XXX-<nom>.md`).

## 4. La racine du dépôt

```
.
├── docs/            documents du projet (brief, PRD, référentiel des user stories) — privé, jamais publié
├── aidd_docs/       mémoire du projet, et tasks/<epic>/ : US, specs et plans — privé, jamais publié
├── src/             tout le code de l'application (voir §5)
├── tests/
│   └── e2e/         tests de bout en bout (parcours complets)
├── scripts/         scripts d'outillage (vérifications, migrations, import de données)
├── public/          fichiers servis tels quels (images, icônes) — publié
├── .env.example     noms des variables d'environnement, sans valeurs
├── .gitignore
├── CLAUDE.md
└── README.md
```

- **Publié ou privé** : seuls le résultat de la construction et `public/` sont publiés. `docs/`, `aidd_docs/`, `scripts/`, `tests/` et les fichiers `.env*` restent toujours privés.
- Les fichiers de configuration des outils restent à la racine quand l'outil les y attend.
- Si le framework impose un autre emplacement pour le code (routes à la racine, dossier `app/` hors de `src/`), on suit le framework et on le note dans « Organisation des fichiers ».

## 5. Le code : des paliers progressifs, découpés par fonctionnalité

Le code est **d'abord découpé par fonctionnalité** (`features/<nom>/`), plutôt que par type (`controllers/`, `services/`, `models/`) ; à l'intérieur d'une feature, les **couches** apparaissent quand le projet en a besoin. Les arborescences montrent l'`index` public de chaque feature ; il disparaît quand le framework déconseille les fichiers de réexportation (§6).

### Palier 1 — simple

Pour une application avec peu de règles métier et une seule source de données.

```
src/
├── app/                 points d'entrée : routes, pages, écran principal, démarrage
├── features/
│   └── item/            tout ce qui concerne les éléments, à plat : index.ts, item-list.tsx,
│                        item.rules.ts, item.rules.test.ts, item.repository.ts
├── shared/              ce qui sert à plusieurs features (composants, fonctions utilitaires)
└── config/
```

### Palier 2 — métier

Quand une feature porte de vraies règles métier qu'on veut tester sans base de données ni interface.

```
src/features/item/
├── index.ts
├── domain/            item.entity.ts, item.rules.ts
├── application/       create-item.use-case.ts
├── infrastructure/    item.repository.ts
└── ui/                item-list.tsx, item-card.tsx
```

`app/`, `shared/` et `config/` restent comme au palier 1.

### Palier 3 — hexagonal

Quand le projet dépend de plusieurs services externes interchangeables (base de données, paiement, e-mail, IA) ou qu'on doit pouvoir les remplacer par des doublures dans les tests.

```
src/
├── app/                 assemble : choisit quel adapter branche quel port
├── features/item/
│   ├── index.ts, domain/, ui/   comme au palier 2
│   ├── application/     create-item.use-case.ts ; ports/ : item-repository.port.ts, notifier.port.ts
│   └── infrastructure/  item.repository.ts ; adapters/ : email.adapter.ts
├── shared/              domain/, application/ports/, infrastructure/adapters/
└── config/
```

### Choisir et changer de palier

| Constat | Palier |
|---|---|
| Peu de règles métier, une seule source de données, quelques écrans | 1 |
| Des règles métier qui méritent leurs propres tests (calculs, statuts, droits) | 2 |
| Plusieurs services externes, ou un service qu'on prévoit de remplacer | 3 |

- `/pulse:tech` choisit le palier d'après les besoins et l'écrit dans « Organisation des fichiers », avec les suffixes retenus.
- **On monte d'un palier quand le besoin est constaté** (YAGNI) ; c'est une tâche du plan, décidée avant l'implémentation. Un petit projet reste au palier le plus simple qui répond au besoin.
- Les features d'un même projet suivent le même palier ; une feature triviale peut rester à plat si « Organisation des fichiers » le prévoit.
- Chaque composant d'interface vit dans le `ui/` de sa feature (à plat au palier 1) ; `shared/` reçoit seulement ce qui sert **réellement** à au moins deux features, sous un nom qui dit son sujet (`shared/date-format.ts`), plutôt qu'un dossier `utils/` ou `helpers/` fourre-tout.

## 6. Règles de dépendance

Une couche importe seulement ce qui est **en dessous** d'elle. Le domaine est au centre, indépendant de tout le reste.

| Dossier | Peut importer | Ne doit jamais importer |
|---|---|---|
| `domain/` | `shared/domain/`, la bibliothèque standard | `application/`, `infrastructure/`, `ui/`, framework, base de données, réseau |
| `application/` | `domain/`, ses `ports/`, `shared/` | `infrastructure/`, `ui/`, une implémentation concrète |
| `infrastructure/` | `domain/`, `application/ports/`, `shared/`, bibliothèques d'accès aux données et aux services | `ui/`, `app/` |
| `ui/` | `application/` (cas d'usage), `domain/` (types), `shared/` | `infrastructure/` directement |
| `app/` | tout : c'est là qu'on assemble | — |
| `shared/` | `shared/` et les bibliothèques, en respectant les mêmes règles entre ses couches | une feature, `app/` |

Le domaine qui a besoin de la base ou d'un service passe par un port dans `application/ports/`, implémenté dans `infrastructure/`. Au palier 1, sans couches, la même idée vaut entre fichiers : les règles (`.rules`) restent indépendantes de l'interface et de l'accès aux données.

### L'index public d'une feature

- Chaque feature expose ce qu'elle partage par **un seul fichier `index`** à sa racine, qui liste explicitement, élément par élément, ce qui est exporté (plutôt qu'un export global du dossier).
- Une feature importe une autre feature **seulement par son `index`** et laisse ses fichiers internes de côté (`features/item/domain/item.rules.ts` reste hors de portée depuis `features/project/`).
- À l'intérieur d'une feature, on importe directement le fichier qui définit ce qu'on utilise, plutôt que son propre `index`.
- Imports à sens unique entre features : si deux features ont besoin l'une de l'autre, la partie commune va dans `shared/`.
- **Quand le framework déconseille les fichiers de réexportation** (ex. Next.js : ils dégradent le tree shaking), la feature n'a pas d'`index` : on importe directement le fichier visé, et « Organisation des fichiers » de `docs/technical.md` liste les dossiers qu'une autre feature peut importer.

## 7. Tests

- **Tests unitaires et d'intégration près du fichier testé**, même nom avec `.test` (`item.rules.ts` → `item.rules.test.ts`), dans le même dossier **ou** dans son sous-dossier `__tests__/`, qui garde les dossiers courts quand ils grandissent. Un projet choisit l'une des deux formes et s'y tient (« Organisation des fichiers »).
- **Tests de bout en bout** (parcours complet dans l'application) dans `tests/e2e/`, nommés par parcours : `create-item.e2e.test.ts`.
- Données et doublures de test partagées : `tests/fixtures/` ; une doublure propre à une feature reste à côté de ses tests.
- Si l'outil de test du langage impose un autre emplacement (`tests/` obligatoire, préfixe `test_` en Python), on suit l'outil et on le note dans « Organisation des fichiers ».

## 8. Anti-patterns

Pièges fréquents, chacun corrigé par sa règle : dossier `utils/`, `helpers/` ou `components/` fourre-tout, ou découpage d'abord par type (§5) ; suffixe inventé (`.manager`, `.helper`, `.handler`) au lieu du catalogue (§3) ; dossiers créés vides « pour la suite » (§1) ; fichiers existants renommés ou déplacés pour suivre ce guide (§1).

## 9. Checklist

- [ ] Chaque nouveau fichier est à l'emplacement prévu par « Organisation des fichiers » de `docs/technical.md`, sinon par le palier en place (§5).
- [ ] Nom en kebab-case, avec un suffixe du catalogue (§2, §3).
- [ ] Code rangé par feature, puis par couche (§5) ; aucun dossier créé vide « pour la suite ».
- [ ] Imports dans le sens permis (§6) : le domaine n'importe ni la base ni le framework ; une feature n'entre pas dans les fichiers internes d'une autre.
- [ ] Tests au même nom avec `.test`, à l'emplacement choisi par le projet (§7).
- [ ] Organisation existante suivie, sans fichier déplacé hors de la tâche.

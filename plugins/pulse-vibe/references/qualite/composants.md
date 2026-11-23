# Composants d'interface

**Séparer ce qui affiche de ce qui décide.** Ces règles valent pour toute interface (page web, application installée, application mobile), avec ou sans bibliothèque d'interface. Le mécanisme concret (composant, gabarit, vue, fonction d'affichage) est celui de « Pile retenue » de `docs/technical.md` ; sa syntaxe vient de la documentation officielle.

## 1. Présentation et orchestration

| Aspect | Présentation (« Dumb ») | Orchestration (« Smart ») |
|---|---|---|
| Rôle | Afficher | Obtenir les données, décider, enchaîner |
| Reçoit | Des données prêtes + des callbacks | Les paramètres de l'écran, l'état, l'accès aux données |
| État | Au plus un état purement visuel (panneau ouvert, onglet actif) | État métier de l'écran |
| Données | Reçoit tout prêt ; laisse **entièrement** stockage, réseau et base à l'orchestration | Appelle l'accès aux données, gère les résultats |
| Logique métier | Affiche tel quel (tri, filtre et règles faits en amont) | Prépare les données avant de les transmettre |
| Vérification | Affichage avec des données factices | Parcours complet : chargement, vide, erreur, succès |

**Questions pour trancher** : il lit ou écrit des données ? → Smart. Il décide quoi faire après un clic ou un envoi ? → Smart. Il se contente de transformer des données en affichage ? → Dumb. Il servirait dans une autre fonctionnalité ? → Dumb partagé, au vocabulaire générique.

**Règle d'or** : commencer Dumb ; créer un Smart seulement lorsqu'il faut lire des données, garder un état métier ou déclencher une action.

## 2. Niveaux de composants

| Niveau | Rôle | Exemples | Règle |
|---|---|---|---|
| **Élément** | Brique de base générique | bouton, champ, message d'erreur, état vide | Réutilisable partout, ignore tout du métier |
| **Composite** | Assemble 2 à 5 éléments autour d'une donnée ou d'un petit formulaire | champ avec libellé et erreur, ligne d'élément, formulaire d'ajout | Une donnée ou un formulaire ; reçoit ses données de l'extérieur |
| **Section** | Bloc complet d'un écran | liste d'éléments, bloc de statistiques | Assemble des composites, reste Dumb : tout arrive de l'extérieur |
| **Container** (écran) | La section **branchée** sur les données | écran des éléments | Seul niveau qui lit l'état et déclenche les actions |

Une fonction qui parle seulement d'affichage est un composant de présentation ; une fonction qui parle de la fonctionnalité (règles, données, enchaînement) va dans son état ou son orchestration ; une fonction utile partout sans interface (formatage de date, calcul) est un utilitaire partagé.

**Un dossier par niveau, dès le premier composant**, avec un framework de composants (React, Vue, Svelte, Angular…) : `containers/` (Smart), puis `sections/`, `composites/` et `elements/` (Dumb), dans le dossier d'interface de chaque fonctionnalité ; les éléments génériques partagés vont dans `elements/` du dossier partagé (ou dans le dossier imposé par la bibliothèque de composants, par exemple `components/ui/` de shadcn). Chaque composant est rangé au niveau que donne le tableau ; un composant de présentation qui lit des données ou déclenche une action remonte dans `containers/`. Ces dossiers s'appliquent au nouveau code, même si le code existant ou repris d'un autre projet est rangé autrement.

## 3. État

- **Source unique** : chaque donnée a un seul propriétaire (l'état d'une fonctionnalité, ou le serveur), et vit dans un seul composant ; si deux composants la partagent, la remonter à leur parent commun. L'affichage est recalculé depuis elle.
- **État dérivé calculé à l'affichage** : un total, une liste filtrée ou un libellé se recalcule depuis l'état, plutôt que d'être copié dans une seconde variable à synchroniser.
- **État local d'abord** : ce qui concerne seulement l'interface (champ en cours de saisie, panneau ouvert) reste dans son composant. Un état partagé par toute l'application (personne connectée, thème) naît quand il est réellement partagé.
- **Modifications par des actions nommées** (`addItem`, `toggleItem`, `removeItem`) : toute modification de l'état passe par elles.
- **Variantes explicites** pour l'état d'un écran : `{ status: chargement | prêt | erreur, items, errorMessage }` plutôt que plusieurs booléens.
- Un élément affiché s'identifie par **l'identifiant de sa donnée**, plutôt que par sa position dans la liste (elle change dès qu'on trie, filtre ou supprime).

## 4. Accès aux données centralisé

- Toutes les lectures et écritures d'une fonctionnalité passent par **un seul module d'accès** (`fetchItems`, `insertItem`, `deleteItem`) ; les composants passent par lui pour toucher au stockage, au réseau ou à la base.
- Le client d'un service (base, authentification, API) est **créé une seule fois** puis réutilisé par tous les écrans.
- Le module d'accès renvoie des données prêtes ou une erreur au message compréhensible ; le détail technique reste dans le journal.
- Le stockage local de l'appareil, s'il sert, passe par deux fonctions génériques (lire avec valeur par défaut, écrire) ; la lecture tolère une donnée absente, abîmée ou dans un ancien format ; la clé est préfixée par le nom du projet.
- L'authentification suit le même principe : connexion, déconnexion et lecture de la session regroupées dans un seul module.
- Un bouton caché relève du confort : le contrôle d'accès se vérifie côté serveur ou dans la base (`qualite/securite-code.md`).

## 5. Flux de données

- **Les données descendent** : l'écran lit les données et les transmet aux sections, qui les transmettent aux composites, déjà prêtes (tri, filtre et formatage faits en amont).
- **Les événements montent** : un composant de présentation signale ce qui s'est passé par un callback (`onToggle`, `onSubmit`) ; l'orchestration décide de la suite (action nommée → accès aux données → nouvel état → nouvel affichage).
- Écouteurs globaux regroupés en un seul endroit ; chaque écouteur est ajouté une seule fois, même après un nouvel affichage.
- Pour une longue liste, quand la technologie laisse ce soin au code : un seul écouteur sur le conteneur, qui retrouve l'élément par son identifiant, plutôt qu'un écouteur par ligne.

## 6. Les états d'une vue

Les cinq états de chaque vue qui charge des données (chargement, vide, erreur, partiel, succès), ce qu'ils disent et quand ils s'affichent : `qualite/experience.md` § 1 à 3. L'orchestration choisit l'état ; un composant de présentation l'affiche.

## 7. Formulaires

Moment de la validation, focus, saisie conservée, bouton d'envoi : `qualite/experience.md` § 5. Côté structure : la section porte les champs et la validation du navigateur, pour le confort ; l'orchestration envoie et reçoit les erreurs par champ ; la validation côté serveur, avec les mêmes règles, protège (S5).

## 8. Accessibilité

- **Structure** : éléments sémantiques de la plateforme (titres hiérarchisés niveau après niveau, listes, zones principales) ; un seul titre principal par écran.
- **Action ou navigation** : une action est un vrai bouton, un changement d'écran un vrai lien, plutôt qu'un bloc rendu cliquable.
- **Libellés** : chaque champ a un libellé visible et associé ; un bouton au texte ambigu reçoit un nom accessible précis (« Supprimer l'élément « <titre> » ») ; une image porte un texte alternatif utile, ou vide si elle est décorative.
- **Clavier, focus et messages annoncés** : `qualite/experience.md` § 6.
- **Contrastes** suffisants en mode clair et sombre ; l'information passe aussi par autre chose que la couleur ; les animations respectent la préférence « réduire les animations ».

## 9. Nommage

| Quoi | Convention | Exemple |
|---|---|---|
| Composant de présentation | Nom de ce qu'il affiche | `ItemRow`, `ItemList`, `ItemForm` |
| Élément partagé | Nom générique, hors vocabulaire métier | `Button`, `TextField`, `EmptyState`, `ErrorMessage` |
| Orchestration | Fonctionnalité + rôle | `ItemsScreen`, `ItemCreateContainer` |
| Accès aux données, actions sur l'état | verbe + nom | `fetchItems`, `insertItem`, `addItem`, `toggleItem` |
| Callbacks | `onX` | `onToggle`, `onSubmit`, `onClose` |
| États visuels | `is…` | `isClosed`, `isLoading`, `isOpen` |

La casse (des composants, des fichiers) suit la convention de la technologie retenue et celle du projet.

## 10. Découpage et regroupement

- **Commencer petit**, sans framework de composants (page en JavaScript simple) : tant qu'un écran reste court et que l'application compte peu d'écrans, un seul fichier rangé en blocs (état, présentation, actions, démarrage) suffit ; la séparation Smart / Dumb existe déjà à l'intérieur. Avec un framework de composants, les dossiers par niveau du § 2 valent dès le premier composant.
- **Découper quand un signal apparaît** : fichier de plus de ~200 à 300 lignes, plusieurs écrans ou zones indépendantes, une deuxième fonctionnalité, un accès à des données distantes. Trois responsabilités se séparent alors : la présentation, l'état (et ses actions), l'accès aux données ; l'orchestration fait le lien.
- **Regrouper par fonctionnalité** ; à part, les éléments partagés et les utilitaires sans interface. **Un point d'entrée** crée l'état une seule fois et branche chaque écran.
- **Réutiliser avant de créer** : chercher les composants et utilitaires déjà présents ; un élément générique se partage plutôt que de se recopier d'une fonctionnalité à l'autre.
- Chaque composant se définit au niveau du module, hors de tout autre composant, si la technologie le recréerait à chaque affichage.

## 11. Entrées d'un composant et composition

- Les entrées d'un composant (propriétés, paramètres) sont **typées strictement si le langage le permet**, sinon documentées ; le composant les laisse intactes.
- **Variantes par une table de correspondance** (`VARIANTS = { default: …, danger: … }` et une entrée `variant`) plutôt qu'une série de booléens (`isRed`, `isLarge`) qui peuvent se contredire.
- **Composition par contenu imbriqué** plutôt que par une multitude d'entrées de contenu : un `EmptyState` reçoit un titre et, en contenu, le bouton d'action à afficher.
- Un élément qui enveloppe un élément natif (bouton, champ) transmet les attributs natifs qu'il ne gère pas lui-même (accessibilité, identifiant, type).
- Valeurs par défaut sûres : un bouton est un bouton simple par défaut ; l'envoi de formulaire se demande explicitement.
- Un composant reçoit seulement ce qu'il affiche : `item`, plutôt que tout l'état de l'application.

## 12. Tests

- Le **test manuel des états** de chaque vue (`qualite/experience.md` § 1) par la personne reste obligatoire.
- Tests automatisés **seulement si** un outil de test figure dans « Commandes du projet » de `docs/technical.md`.
- Tester d'abord la **logique pure** (validation, calculs, préparation des données) : le plus simple et le plus utile.
- Un composant de présentation se teste avec des **données factices**, sur ce que la personne perçoit (textes, rôles, noms accessibles), plutôt que sur le style.
- L'orchestration se couvre par le test manuel, ou par des tests de bout en bout s'ils sont retenus.

## 13. Sécurité de l'affichage

- Toute donnée saisie ou venant de la base s'affiche **comme du texte**, avec le mécanisme d'échappement normal de la technologie retenue.
- **Jamais** de HTML (ou de balisage équivalent) construit en assemblant des chaînes avec une saisie, ni d'insertion de balisage brut contournant l'échappement (S6).
- Une adresse fournie par une personne devient un lien seulement après vérification de son schéma (`https:`).
- Un lien externe ouvert dans un nouvel onglet empêche la page ouverte d'agir sur la page d'origine.

## 14. Checklist (implémentation et relecture)

- [ ] Chaque module importé existe ou a été créé dans la tâche ; les composants déjà présents sont réutilisés.
- [ ] Avec un framework de composants : chaque composant dans le dossier de son niveau (`containers/`, `sections/`, `composites/`, `elements/`, § 2), dès le premier.
- [ ] Composants de présentation qui reçoivent des données prêtes et laissent stockage, réseau, base et logique métier à l'orchestration.
- [ ] Seule l'orchestration lit l'état, appelle l'accès aux données et déclenche les actions.
- [ ] Source unique de vérité ; état dérivé calculé ; chaque donnée à un seul endroit.
- [ ] Accès aux données centralisé par fonctionnalité ; client de service créé une seule fois.
- [ ] Données descendantes, événements montants par callbacks ; éléments identifiés par l'identifiant de leur donnée.
- [ ] Chaque vue qui charge des données branche ses états (choisis par l'orchestration, affichés par la présentation) ; leur comportement suit `qualite/experience.md`, relu en fin de plan par `pulse:ux-reviewer`.
- [ ] Formulaires : validation du navigateur et du serveur avec les mêmes règles, erreurs reçues par champ.
- [ ] Accessibilité : structure sémantique, libellés, noms accessibles précis, contrastes.
- [ ] Saisies affichées comme du texte, jamais insérées comme du balisage (S6).
- [ ] Découpage proportionné, regroupé par fonctionnalité ; nommage conforme.
- [ ] Contrôles automatiques de « Commandes du projet » de `docs/technical.md` passés ; test manuel des états fait.

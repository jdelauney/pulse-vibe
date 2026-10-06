# Composants d'interface

**Séparer ce qui affiche de ce qui décide.** Ces règles valent pour toute interface (page web, application installée, application mobile), avec ou sans bibliothèque d'interface. Le mécanisme concret (composant, gabarit, vue, fonction d'affichage) est celui de la technologie retenue dans « Pile retenue » de `docs/technical.md` ; sa syntaxe vient de la documentation officielle.

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

```
// Présentation : reçoit un élément et des callbacks, ne touche à aucune donnée
composant ItemRow(item, onToggle, onDelete) :
  afficher case à cocher (cochée = item.isClosed, libellé = item.title, au changement → onToggle(item.id))
  afficher bouton "Supprimer" (nom accessible = "Supprimer l'élément « " + item.title + " »",
                               au clic → onDelete(item.id))

// Orchestration : lit l'état, appelle l'accès aux données, passe des callbacks
composant ItemsScreen() :
  state = itemsStore.state
  handlers = {
    onToggle: (id) → itemsStore.toggle(id),
    onDelete: (id) → itemsStore.remove(id) puis annoncer("Élément supprimé.")
  }
  afficher ItemList(trierParDate(state.items), handlers)
```

## 2. Niveaux de composants

| Niveau | Rôle | Exemples | Règle |
|---|---|---|---|
| **Élément** | Brique de base générique | bouton, champ, message d'erreur, état vide | Réutilisable partout, ignore tout du métier |
| **Composite** | Assemble 2 à 5 éléments autour d'une donnée ou d'un petit formulaire | champ avec libellé et erreur, ligne d'élément, formulaire d'ajout | Une donnée ou un formulaire ; reçoit ses données de l'extérieur |
| **Section** | Bloc complet d'un écran | liste d'éléments, bloc de statistiques | Assemble des composites, reste Dumb : tout arrive de l'extérieur |
| **Écran** | La section **branchée** sur les données | écran des éléments | Seul niveau qui lit l'état et déclenche les actions |

- Une fonction qui parle **seulement d'affichage** est un composant de présentation.
- Une fonction qui parle **de la fonctionnalité** (règles, données, enchaînement) appartient à l'état ou à l'orchestration de cette fonctionnalité.
- Une fonction utile partout **sans interface** (formatage de date, calcul) est un utilitaire partagé.
- Créer des dossiers par niveau quand les composants d'une fonctionnalité dépassent une poignée de fichiers.

## 3. État

- **Source unique** : chaque donnée a un seul propriétaire (l'état d'une fonctionnalité, ou le serveur). L'affichage est recalculé depuis lui ; l'interface reflète les données.
- **État dérivé calculé à l'affichage** : un total, une liste filtrée ou un libellé se calcule à partir de l'état au moment de l'affichage. Le recalculer plutôt que le copier dans une seconde variable qu'il faudrait synchroniser.
- **Une donnée, un composant** : chaque donnée vit dans un seul composant ; si deux composants la partagent, la remonter à leur parent commun.
- **État local d'abord** : ce qui concerne seulement l'interface (champ en cours de saisie, panneau ouvert) reste dans le composant concerné. Un état partagé par toute l'application (personne connectée, thème) est créé seulement lorsqu'il est réellement partagé.
- **Modifications par des actions nommées** (`addItem`, `toggleItem`, `removeItem`), seules autorisées à changer l'état ; toute modification passe par elles.
- **Variantes explicites** pour l'état d'un écran : `{ status: chargement | prêt | erreur, items, errorMessage }` plutôt que plusieurs booléens.
- Identifier un élément affiché par **l'identifiant de sa donnée**, plutôt que par sa position dans la liste (la position change dès qu'on trie, filtre ou supprime).

## 4. Accès aux données centralisé

- Toutes les lectures et écritures d'une fonctionnalité passent par **un seul module d'accès** (`fetchItems`, `insertItem`, `deleteItem`). Les composants passent par ce module pour toucher au stockage, au réseau ou à la base.
- Le client d'un service (base, authentification, API) est **créé une seule fois** puis réutilisé par tous les écrans.
- Le module d'accès renvoie des données prêtes ou une erreur au message compréhensible ; le détail technique reste dans le journal.
- Le stockage local de l'appareil, s'il est utilisé, est encapsulé dans deux fonctions génériques (lire avec valeur par défaut, écrire) ; la lecture tolère une donnée absente, abîmée ou dans un ancien format ; la clé est préfixée par le nom du projet.
- L'authentification suit le même principe : connexion, déconnexion et lecture de la session regroupées dans un seul module.
- La sécurité repose sur le serveur : un bouton caché relève du simple confort. Le contrôle d'accès est vérifié côté serveur ou dans la base (voir `qualite/securite-code.md`).

## 5. Flux de données

- **Les données descendent** : l'écran lit les données et les transmet aux sections, qui les transmettent aux composites.
- **Les événements montent** : un composant de présentation signale ce qui s'est passé par un callback (`onToggle`, `onSubmit`) ; l'orchestration décide de la suite.
- Les données transmises sont **déjà prêtes** : tri, filtre et formatage sont faits en amont du composant de présentation.
- Écouteurs globaux regroupés en un seul endroit ; chaque écouteur est ajouté une seule fois, même après un nouvel affichage.
- Pour une longue liste, un seul écouteur sur le conteneur qui retrouve l'élément par son identifiant est préférable à un écouteur par ligne, quand la technologie laisse ce soin au code.

```
Écran (lit l'état) ──données──▶ Section ──données──▶ Composite ──▶ Élément
       ▲                                                   │
       └───────────── callback (événement) ────────────────┘
       │
       └──▶ action nommée ──▶ accès aux données ──▶ nouvel état ──▶ nouvel affichage
```

## 6. Les quatre états d'interface

Chaque écran qui dépend de données prévoit les quatre états. L'orchestration choisit l'état ; un composant de présentation l'affiche.

| État | Ce qu'on affiche | Exemple de message |
|---|---|---|
| Chargement | Texte ou indicateur ; bouton d'envoi désactivé | « Chargement des éléments… » |
| Vide | Message utile + invitation à agir | « Aucun élément pour l'instant. Ajoutez-en un ci-dessus. » |
| Erreur | Message clair (détail technique réservé au journal), avec une piste ou un bouton « Réessayer » | « Impossible de charger les éléments. Vérifiez votre connexion puis réessayez. » |
| Succès | Confirmation brève, annoncée aux technologies d'assistance | « Élément ajouté. » |

```
composant ItemsScreen() :
  SELON state.status :
    chargement → afficher StatusMessage("Chargement des éléments…")
    erreur     → afficher ErrorMessage(state.errorMessage, action "Réessayer" → itemsStore.load())
    prêt       → SI state.items est vide ALORS afficher EmptyState("Aucun élément pour l'instant.")
                 SINON afficher ItemList(state.items, handlers)
```

## 7. Formulaires

- **Validation côté client pour le confort** (message immédiat, champ obligatoire, longueur maximale, format) ; **validation côté serveur pour la sécurité**, toujours, avec les mêmes règles. La seconde reste obligatoire même quand la première existe (S5).
- **Conserver la saisie après une erreur** : la personne retrouve tout ce qu'elle a tapé. Le résultat d'un envoi refusé renvoie les valeurs saisies et les erreurs par champ.
- **Désactiver l'envoi pendant le traitement** (et changer son libellé : « Envoi… ») pour qu'il parte une seule fois ; le réactiver quoi qu'il arrive.
- Erreur affichée **à côté du champ concerné**, reliée à lui pour les technologies d'assistance ; champ marqué comme invalide.
- Message de succès bref, puis remise à zéro du formulaire et focus replacé dans le premier champ.
- Écouter l'**envoi du formulaire** plutôt que le clic sur le bouton : la touche Entrée fonctionne.
- Types de champ adaptés (email, téléphone, date) et indications de remplissage automatique.

```
composant ItemForm(state, onSubmit, isPending) :
  champ "Titre" (nom = "title", valeur initiale = state.values.title,
                 erreur = state.fieldErrors.title, obligatoire, longueur max = MAX_TITLE_LENGTH)
  bouton envoyer (désactivé SI isPending, libellé = isPending ? "Ajout…" : "Ajouter")
  zone d'annonce : state.message
```

## 8. Accessibilité

- **Structure** : éléments sémantiques de la plateforme (titres hiérarchisés niveau après niveau, listes, zones principales) ; un seul titre principal par écran.
- **Action ou navigation** : une action est un vrai bouton, un changement d'écran est un vrai lien, plutôt qu'un bloc quelconque rendu cliquable.
- **Libellés** : chaque champ a un libellé visible et associé ; un bouton au texte ambigu reçoit un nom accessible précis (« Supprimer l'élément « <titre> » ») ; une image porte un texte alternatif utile, ou vide si elle est décorative.
- **Messages annoncés** : une zone d'annonce toujours présente pour les succès (annonce polie) et les erreurs (annonce immédiate), remplie avec du texte.
- **Focus** : visible en permanence ; après un ajout, il revient dans le champ ; après une suppression ou un nouvel affichage, il se place sur un élément logique ; une fenêtre modale garde le focus et le rend à l'élément d'origine à la fermeture.
- **Clavier** : tout est utilisable au clavier (tabulation, Entrée, Espace, Échap pour fermer), dans un ordre logique ; l'ordre de tabulation suit l'ordre naturel de l'écran.
- **Contrastes** suffisants en mode clair et sombre ; l'information passe aussi par autre chose que la couleur ; les animations respectent la préférence « réduire les animations ».

## 9. Nommage

| Quoi | Convention | Exemple |
|---|---|---|
| Composant de présentation | Nom de ce qu'il affiche | `ItemRow`, `ItemList`, `ItemForm` |
| Élément partagé | Nom générique, hors vocabulaire métier | `Button`, `TextField`, `EmptyState`, `ErrorMessage` |
| Orchestration | Fonctionnalité + rôle | `ItemsScreen`, `ItemCreateContainer` |
| Accès aux données | verbe + nom | `fetchItems`, `insertItem`, `deleteItem` |
| Actions sur l'état | verbe + nom | `addItem`, `toggleItem` |
| Callbacks | `onX` | `onToggle`, `onSubmit`, `onClose` |
| États visuels | `is…` | `isClosed`, `isLoading`, `isOpen` |
| Textes affichés, commentaires | français ; le commentaire explique le *pourquoi* | |

La casse (des composants, des fichiers) suit la convention de la technologie retenue et celle déjà présente dans le projet.

## 10. Découpage et regroupement

- **Commencer petit** : tant qu'un écran reste court et que l'application compte peu d'écrans, un seul fichier rangé en blocs (état, présentation, actions, démarrage) suffit ; la séparation Smart / Dumb existe déjà à l'intérieur du fichier.
- **Découper quand un signal apparaît** : fichier de plus de ~200 à 300 lignes, plusieurs écrans ou zones indépendantes, une deuxième fonctionnalité, un accès à des données distantes.
- **Séparer trois responsabilités** : la présentation, l'état (et ses actions), l'accès aux données. L'orchestration fait le lien.
- **Regrouper par fonctionnalité** (une fonctionnalité par dossier) plutôt que par type de fichier ; mettre à part les éléments partagés et les utilitaires sans interface.
- **Un point d'entrée** crée l'état une seule fois et branche chaque écran.
- **Réutiliser avant de créer** : chercher les composants et utilitaires déjà présents dans le projet ; un élément générique se partage plutôt que de se recopier d'une fonctionnalité à l'autre.
- Définir chaque composant au niveau du module, hors de tout autre composant, si la technologie le recréerait à chaque affichage.

## 11. Entrées d'un composant et composition

- Les entrées d'un composant (propriétés, paramètres) sont **typées strictement si le langage le permet**, sinon documentées ; le composant les laisse intactes.
- **Variantes par une table de correspondance** (`VARIANTS = { default: …, danger: … }` et une entrée `variant`) plutôt qu'une série de booléens (`isRed`, `isLarge`) qui peuvent se contredire.
- **Composition par contenu imbriqué** plutôt que par une multitude d'entrées de contenu : un `EmptyState` reçoit un titre et, en contenu, le bouton d'action à afficher.
- Un élément qui enveloppe un élément natif de la plateforme (bouton, champ) transmet les attributs natifs qu'il ne gère pas lui-même (accessibilité, identifiant, type).
- Les valeurs par défaut sont sûres : un bouton est un bouton simple par défaut, et l'envoi de formulaire se demande explicitement.
- Un composant connaît seulement ce qu'il affiche : passer `item`, plutôt que tout l'état de l'application.

```
composant EmptyState(title, description?, contenu?) :
  afficher title
  SI description ALORS afficher description
  SI contenu ALORS afficher contenu        // par exemple : bouton "Créer un élément"

composant Button(label, variant = "default", type = "bouton simple", attributsNatifs…) :
  afficher bouton (style = VARIANTS[variant], type, attributsNatifs…)
```

## 12. Tests

- Le **test manuel des quatre états** (chargement, vide, erreur, succès) par la personne reste obligatoire.
- Tests automatisés **seulement si** un outil de test figure dans « Commandes du projet » de `docs/technical.md`.
- Tester d'abord la **logique pure** (validation, calculs, préparation des données) : c'est le plus simple et le plus utile.
- Tester un composant de présentation avec des **données factices**, en vérifiant ce que la personne perçoit (textes, rôles, noms accessibles), plutôt que les détails de style.
- Couvrir l'orchestration par le test manuel, ou par des tests de bout en bout s'ils sont retenus.

## 13. Sécurité de l'affichage

- Toute donnée saisie ou venant de la base s'affiche **comme du texte**, avec le mécanisme d'échappement normal de la technologie retenue.
- **Jamais** de HTML (ou de balisage équivalent) construit en assemblant des chaînes avec une saisie, ni d'insertion de balisage brut contournant l'échappement (S6).
- Une adresse fournie par une personne est utilisée comme lien seulement après vérification de son schéma (`https:`).
- Les liens externes ouverts dans un nouvel onglet empêchent la page ouverte d'agir sur la page d'origine.

## 14. Checklist (implémentation et relecture)

- [ ] Chaque module importé existe ou a été créé dans la tâche ; les composants déjà présents sont réutilisés.
- [ ] Composants de présentation qui reçoivent des données prêtes et laissent stockage, réseau, base et logique métier à l'orchestration.
- [ ] Seule l'orchestration lit l'état, appelle l'accès aux données et déclenche les actions.
- [ ] Source unique de vérité ; état dérivé calculé ; chaque donnée à un seul endroit.
- [ ] Accès aux données centralisé par fonctionnalité ; client de service créé une seule fois.
- [ ] Données descendantes, événements montants par callbacks ; éléments identifiés par l'identifiant de leur donnée.
- [ ] Les quatre états (chargement, vide, erreur, succès) sont traités, en français, détail technique réservé au journal.
- [ ] Formulaires : validation client et serveur, saisie conservée après erreur, envoi désactivé pendant le traitement.
- [ ] Accessibilité : libellés, noms accessibles précis, messages annoncés, focus géré, clavier, contrastes.
- [ ] Saisies affichées comme du texte, jamais insérées comme du balisage (S6).
- [ ] Découpage proportionné, regroupé par fonctionnalité ; nommage conforme.
- [ ] Contrôles automatiques de « Commandes du projet » de `docs/technical.md` passés ; test manuel des quatre états fait.

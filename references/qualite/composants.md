# Composants d'interface

**Séparer ce qui affiche de ce qui décide.** Ces règles valent pour toute interface (page web, application installée, application mobile), avec ou sans bibliothèque d'interface. Le mécanisme concret (composant, gabarit, vue, fonction d'affichage) est celui de la technologie retenue dans « Pile retenue » de `docs/technical.md` ; sa syntaxe vient de la documentation officielle.

## 1. Présentation et orchestration

| Aspect | Présentation (« Dumb ») | Orchestration (« Smart ») |
|---|---|---|
| Rôle | Afficher | Obtenir les données, décider, enchaîner |
| Reçoit | Des données prêtes + des callbacks | Les paramètres de l'écran, l'état, l'accès aux données |
| État | Aucun, ou état purement visuel (panneau ouvert, onglet actif) | État métier de l'écran |
| Données | N'accède **jamais** au stockage, au réseau ni à la base | Appelle l'accès aux données, gère les résultats |
| Logique métier | Aucune (ni tri, ni filtre, ni règle) | Prépare les données avant de les transmettre |
| Vérification | Affichage avec des données factices | Parcours complet : chargement, vide, erreur, succès |

**Questions pour trancher** : il lit ou écrit des données ? → Smart. Il décide quoi faire après un clic ou un envoi ? → Smart. Il ne fait que transformer des données en affichage ? → Dumb. Il servirait dans une autre fonctionnalité ? → Dumb partagé, sans vocabulaire métier.

**Règle d'or** : commencer Dumb ; ne créer un Smart que lorsqu'il faut lire des données, garder un état métier ou déclencher une action.

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
| **Élément** | Brique de base sans notion métier | bouton, champ, message d'erreur, état vide | Réutilisable partout, ne connaît aucune notion métier |
| **Composite** | Assemble 2 à 5 éléments autour d'une donnée ou d'un petit formulaire | champ avec libellé et erreur, ligne d'élément, formulaire d'ajout | Une donnée ou un formulaire ; jamais d'accès aux données |
| **Section** | Bloc complet d'un écran | liste d'éléments, bloc de statistiques | Assemble des composites, reste Dumb : tout arrive de l'extérieur |
| **Écran** | La section **branchée** sur les données | écran des éléments | Seul niveau qui lit l'état et déclenche les actions |

- Une fonction qui ne parle **que d'affichage** est un composant de présentation.
- Une fonction qui parle **de la fonctionnalité** (règles, données, enchaînement) appartient à l'état ou à l'orchestration de cette fonctionnalité.
- Une fonction utile partout **sans interface** (formatage de date, calcul) est un utilitaire partagé.
- Ne pas créer de dossiers par niveau tant que les composants d'une fonctionnalité tiennent dans une poignée de fichiers.

## 3. État

- **Source unique** : chaque donnée a un seul propriétaire (l'état d'une fonctionnalité, ou le serveur). L'affichage est recalculé depuis lui ; l'interface n'est jamais la source des données.
- **État dérivé calculé, pas stocké** : un total, une liste filtrée ou un libellé se calcule à partir de l'état au moment de l'affichage. Ne pas le dupliquer dans une seconde variable qu'il faudrait synchroniser.
- **Pas de duplication** : la même donnée ne vit pas à la fois dans deux composants ; si deux composants la partagent, la remonter à leur parent commun.
- **État local d'abord** : ce qui ne concerne que l'interface (champ en cours de saisie, panneau ouvert) reste dans le composant concerné. Un état partagé par toute l'application (personne connectée, thème) n'est créé que lorsqu'il est réellement partagé.
- **Modifications par des actions nommées** (`addItem`, `toggleItem`, `removeItem`), seules autorisées à changer l'état ; jamais de modification directe éparpillée.
- **Variantes explicites** pour l'état d'un écran : `{ status: chargement | prêt | erreur, items, errorMessage }` plutôt que plusieurs booléens.
- Identifier un élément affiché par **l'identifiant de sa donnée**, jamais par sa position dans la liste (la position change dès qu'on trie, filtre ou supprime).

## 4. Accès aux données centralisé

- Toutes les lectures et écritures d'une fonctionnalité passent par **un seul module d'accès** (`fetchItems`, `insertItem`, `deleteItem`). Aucun composant ne parle directement au stockage, au réseau ou à la base.
- Le client d'un service (base, authentification, API) est **créé une seule fois** puis réutilisé, jamais recréé par écran.
- Le module d'accès renvoie des données prêtes ou une erreur au message compréhensible ; le détail technique reste dans le journal.
- Le stockage local de l'appareil, s'il est utilisé, est encapsulé dans deux fonctions génériques (lire avec valeur par défaut, écrire) ; la lecture tolère une donnée absente, abîmée ou dans un ancien format ; la clé est préfixée par le nom du projet.
- L'authentification suit le même principe : connexion, déconnexion et lecture de la session regroupées dans un seul module.
- La sécurité ne repose jamais sur l'interface : un bouton caché ne protège rien. Le contrôle d'accès est vérifié côté serveur ou dans la base (voir `qualite/securite-code.md`).

## 5. Flux de données

- **Les données descendent** : l'écran lit les données et les transmet aux sections, qui les transmettent aux composites.
- **Les événements montent** : un composant de présentation signale ce qui s'est passé par un callback (`onToggle`, `onSubmit`) ; l'orchestration décide de la suite.
- Les données transmises sont **déjà prêtes** : tri, filtre et formatage sont faits avant, jamais dans le composant de présentation.
- Pas d'écouteur global éparpillé ; un écouteur n'est pas ajouté une seconde fois à chaque nouvel affichage.
- Pour une longue liste, un seul écouteur sur le conteneur qui retrouve l'élément par son identifiant est préférable à un écouteur par ligne, si la technologie ne le gère pas déjà.

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
| Erreur | Message clair, sans détail technique, avec une piste ou un bouton « Réessayer » | « Impossible de charger les éléments. Vérifiez votre connexion puis réessayez. » |
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

- **Validation côté client pour le confort** (message immédiat, champ obligatoire, longueur maximale, format) ; **validation côté serveur pour la sécurité**, toujours, avec les mêmes règles. La première ne remplace jamais la seconde (S5).
- **Conserver la saisie après une erreur** : la personne ne doit jamais tout retaper. Le résultat d'un envoi refusé renvoie les valeurs saisies et les erreurs par champ.
- **Désactiver l'envoi pendant le traitement** (et changer son libellé : « Envoi… ») pour éviter les doublons ; le réactiver quoi qu'il arrive.
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

- **Structure** : éléments sémantiques de la plateforme (titres hiérarchisés sans sauter de niveau, listes, zones principales) ; un seul titre principal par écran.
- **Action ou navigation** : une action est un vrai bouton, un changement d'écran est un vrai lien ; jamais un bloc quelconque rendu cliquable.
- **Libellés** : chaque champ a un libellé visible et associé ; un bouton au texte ambigu reçoit un nom accessible précis (« Supprimer l'élément « <titre> » ») ; une image porte un texte alternatif utile, ou vide si elle est décorative.
- **Messages annoncés** : une zone d'annonce toujours présente pour les succès (annonce polie) et les erreurs (annonce immédiate), remplie avec du texte.
- **Focus** : visible en permanence ; après un ajout, il revient dans le champ ; après une suppression ou un nouvel affichage, il se place sur un élément logique ; une fenêtre modale garde le focus et le rend à l'élément d'origine à la fermeture.
- **Clavier** : tout est utilisable au clavier (tabulation, Entrée, Espace, Échap pour fermer), dans un ordre logique ; pas d'ordre de tabulation forcé.
- **Contrastes** suffisants en mode clair et sombre ; l'information ne repose jamais sur la couleur seule ; les animations respectent la préférence « réduire les animations ».

## 9. Nommage

| Quoi | Convention | Exemple |
|---|---|---|
| Composant de présentation | Nom de ce qu'il affiche | `ItemRow`, `ItemList`, `ItemForm` |
| Élément partagé | Nom générique, sans vocabulaire métier | `Button`, `TextField`, `EmptyState`, `ErrorMessage` |
| Orchestration | Fonctionnalité + rôle | `ItemsScreen`, `ItemCreateContainer` |
| Accès aux données | verbe + nom | `fetchItems`, `insertItem`, `deleteItem` |
| Actions sur l'état | verbe + nom | `addItem`, `toggleItem` |
| Callbacks | `onX` | `onToggle`, `onSubmit`, `onClose` |
| États visuels | `is…` | `isClosed`, `isLoading`, `isOpen` |
| Textes affichés, commentaires | français ; le commentaire explique le *pourquoi* | |

La casse (des composants, des fichiers) suit la convention de la technologie retenue et celle déjà présente dans le projet.

## 10. Découpage et regroupement

- **Commencer petit** : tant qu'un écran reste court et que l'application compte peu d'écrans, un seul fichier rangé en blocs (état, présentation, actions, démarrage) suffit ; la séparation Smart / Dumb existe déjà sans découpage en fichiers.
- **Découper quand un signal apparaît** : fichier de plus de ~200 à 300 lignes, plusieurs écrans ou zones indépendantes, une deuxième fonctionnalité, un accès à des données distantes.
- **Séparer trois responsabilités** : la présentation, l'état (et ses actions), l'accès aux données. L'orchestration fait le lien.
- **Regrouper par fonctionnalité** (une fonctionnalité par dossier) plutôt que par type de fichier ; mettre à part les éléments partagés et les utilitaires sans interface.
- **Un point d'entrée** crée l'état une seule fois et branche chaque écran.
- **Réutiliser avant de créer** : chercher les composants et utilitaires déjà présents dans le projet ; un élément générique ne se recopie pas d'une fonctionnalité à l'autre.
- Ne jamais définir un composant à l'intérieur d'un autre si la technologie le recrée à chaque affichage.

## 11. Entrées d'un composant et composition

- Les entrées d'un composant (propriétés, paramètres) sont **typées strictement si le langage le permet**, sinon documentées ; elles ne sont jamais modifiées par le composant.
- **Variantes par une table de correspondance** (`VARIANTS = { default: …, danger: … }` et une entrée `variant`) plutôt qu'une série de booléens (`isRed`, `isLarge`) qui peuvent se contredire.
- **Composition par contenu imbriqué** plutôt que par une multitude d'entrées de contenu : un `EmptyState` reçoit un titre et, en contenu, le bouton d'action à afficher.
- Un élément qui enveloppe un élément natif de la plateforme (bouton, champ) transmet les attributs natifs qu'il ne gère pas lui-même (accessibilité, identifiant, type).
- Les valeurs par défaut sont sûres : un bouton n'envoie pas de formulaire sauf si on le demande.
- Un composant ne connaît que ce qu'il affiche : passer `item`, pas tout l'état de l'application.

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
- Tester un composant de présentation avec des **données factices**, en vérifiant ce que la personne perçoit (textes, rôles, noms accessibles), pas les détails de style.
- Couvrir l'orchestration par le test manuel, ou par des tests de bout en bout s'ils sont retenus.

## 13. Sécurité de l'affichage

- Toute donnée saisie ou venant de la base s'affiche **comme du texte**, avec le mécanisme d'échappement normal de la technologie retenue.
- **Jamais** de HTML (ou de balisage équivalent) construit en assemblant des chaînes avec une saisie, ni d'insertion de balisage brut contournant l'échappement (S6).
- Une adresse fournie par une personne n'est utilisée comme lien qu'après vérification de son schéma (`https:`).
- Les liens externes ouverts dans un nouvel onglet empêchent la page ouverte d'agir sur la page d'origine.

## 14. Checklist (implémentation et relecture)

- [ ] Chaque module importé existe ou a été créé dans la tâche ; les composants déjà présents sont réutilisés.
- [ ] Composants de présentation sans accès au stockage, au réseau ni à la base, sans logique métier.
- [ ] Seule l'orchestration lit l'état, appelle l'accès aux données et déclenche les actions.
- [ ] Source unique de vérité ; état dérivé calculé ; aucune donnée dupliquée.
- [ ] Accès aux données centralisé par fonctionnalité ; client de service créé une seule fois.
- [ ] Données descendantes, événements montants par callbacks ; éléments identifiés par l'identifiant de leur donnée.
- [ ] Les quatre états (chargement, vide, erreur, succès) sont traités, en français, sans détail technique.
- [ ] Formulaires : validation client et serveur, saisie conservée après erreur, envoi désactivé pendant le traitement.
- [ ] Accessibilité : libellés, noms accessibles précis, messages annoncés, focus géré, clavier, contrastes.
- [ ] Saisies affichées comme du texte, jamais insérées comme du balisage (S6).
- [ ] Découpage proportionné, regroupé par fonctionnalité ; nommage conforme.
- [ ] Contrôles automatiques de « Commandes du projet » de `docs/technical.md` passés ; test manuel des quatre états fait.

# Clean code

En cas de doute : **lisible avant d'être malin**. Ces règles valent pour tout langage ; la syntaxe et les conventions propres à la technologie retenue viennent de « Pile retenue » de `docs/technical.md`, du code existant et de la documentation officielle.

## 1. Principes

- **KISS** : la solution la plus simple qui marche. Du code lisible plutôt qu'une astuce sur une ligne, une abstraction quand le besoin est là (plutôt qu'« au cas où »), une optimisation face à un problème constaté.
- **DRY** : une information à un seul endroit (constante, fonction, module). Deux bouts de code qui se ressemblent mais servent des buts différents peuvent rester séparés : fusionner seulement les vraies répétitions, et laisser de côté les ressemblances accidentelles.
- **YAGNI** : coder exactement ce que la spec demande. Paramètre, option, couche, fichier ou dépendance s'ajoutent le jour où le besoin existe, plutôt que « pour plus tard ».
- **Responsabilité unique** : une fonction fait une chose, un fichier a un sujet, un module une raison de changer. Si le nom contient « et » (`saveAndRender`), on coupe en deux.
- **Séparer les rôles** : les données (lecture, calcul, écriture) d'un côté, l'affichage de l'autre, la configuration à part.
- **Règles métier isolées et centralisées** : chaque règle métier (calcul, statut, droit, seuil, validation métier) est écrite **une seule fois**, dans un module dédié, **sans** interface, base de données, réseau ni framework. Tous les écrans et traitements qui en ont besoin l'appellent (§5).
- **Testable** : tout code qui décide quelque chose peut être vérifié par un test automatique rapide, sans lancer l'application, ni base réelle, ni réseau, ni horloge réelle (§5).
- **Évolutif par faible couplage** : un module connaît le moins possible des autres ; on peut changer l'un (affichage, stockage, service externe) sans réécrire les autres. Évolutif veut dire facile à changer demain, construit pour le besoin d'aujourd'hui : YAGNI s'applique toujours (§5).
- **Vérifier avant d'utiliser** : un fichier, un module, une fonction, une table ou une bibliothèque est tenu pour existant une fois vu dans le projet. Avant d'utiliser quelque chose, le chercher ; s'il manque, le créer dans la tâche si elle le prévoit, sinon le signaler.

### Limites chiffrées

| Mesure | Limite | Si on dépasse |
|---|---|---|
| Lignes par fonction (ou composant) | ≤ 30 | Extraire des sous-fonctions bien nommées |
| Niveaux d'imbrication (conditions, boucles) | ≤ 3 | Retours anticipés, extraction de fonction |
| Paramètres par fonction | ≤ 4 | Passer un objet (ou une structure) nommé |
| Lignes par fichier | ≤ 300 | Découper en modules à responsabilité unique |
| Branches d'une chaîne « si / sinon si » | ≤ 3 | Table de correspondance avec valeur de repli |

Ces limites sont des signaux, à appliquer avec discernement : une fonction de 32 lignes parfaitement claire vaut mieux que trois fonctions artificielles.

## 2. Nommage

- Suivre d'abord la convention du langage et celle déjà présente dans le projet (casse des variables, des fonctions, des types, des fichiers).
- **Identifiants en anglais simple**, textes affichés et commentaires en français (sauf règle contraire du `CLAUDE.md` du projet).
- Pluriel pour une collection (`items`), singulier pour un élément (`item`).
- Booléens préfixés `is`, `has`, `should`, en logique positive : `isVisible` plutôt que `isNotHidden`.
- Fonctions nommées par un verbe qui dit **quoi** (le **comment** reste dans le corps) : `addItem`, `formatDate`, `sendInvitation`.
- Choisir un nom qui dit le contenu (`data`, `data2`, `temp`, `info`, `manager`, `handleData`, `doStuff`, `process` sont trop vagues).
- Un nom long et clair vaut mieux qu'une abréviation (`maxTitleLength` plutôt que `mtl`).

## 3. Constantes : aucune valeur magique

Un nombre ou une chaîne qui a un sens métier reçoit un nom, déclaré une fois en haut du fichier, ou dans un module de constantes partagé s'il sert à plusieurs endroits.

```
// ❌ Que veut dire 120 ?
SI longueur(title) > 120 ALORS afficherErreur(...)

// ✅
CONSTANTE MAX_TITLE_LENGTH = 120
SI longueur(title) > MAX_TITLE_LENGTH ALORS
  afficherErreur("Le titre ne doit pas dépasser " + MAX_TITLE_LENGTH + " caractères.")
```

Les valeurs qui vont ensemble (statuts, rôles, catégories) forment un ensemble fermé nommé (énumération, objet figé ou équivalent du langage). Plutôt qu'une longue chaîne de conditions, une table de correspondance avec repli :

```
STATUS_LABELS = { draft: "Brouillon", published: "Publié" }
label = STATUS_LABELS[item.status] SINON "Inconnu"
```

## 4. Fonctions

- Courtes, une seule responsabilité, un seul niveau d'abstraction.
- **Retours anticipés** plutôt qu'imbrication : le cas particulier sort tout de suite.
- Une fonction fait l'un ou l'autre : elle **calcule** (retourne une valeur) **ou** elle **agit** (écrit, affiche, envoie).
- Remplacer un paramètre booléen « drapeau » (`render(true)`) par deux fonctions explicites ou un objet d'options nommées.
- Retourner une nouvelle valeur ; laisser intacts les paramètres reçus.
- Une condition complexe devient une variable nommée : `isLate = dueDate < today ET NON item.isClosed`.
- Chaque expression conditionnelle reste à un seul niveau ; le code exécuté est celui des sources, jamais du code construit à partir d'une chaîne.
- Variables immuables par défaut quand le langage le permet ; chaque variable dans la portée la plus courte, propre à son module.

```
// ❌ Imbrication
fonction getPayAmount(employee) :
  SI employee.isDead ALORS résultat = deadAmount()
  SINON SI employee.isSeparated ALORS résultat = separatedAmount()
  SINON SI employee.isRetired ALORS résultat = retiredAmount()
  SINON résultat = normalAmount()
  RETOURNER résultat

// ✅ Retours anticipés
fonction getPayAmount(employee) :
  SI employee.isDead ALORS RETOURNER deadAmount()
  SI employee.isSeparated ALORS RETOURNER separatedAmount()
  SI employee.isRetired ALORS RETOURNER retiredAmount()
  RETOURNER normalAmount()
```

## 5. Testabilité, couplage et règles métier

Ces trois exigences se renforcent : une règle métier isolée est facile à tester, et un code facile à tester est peu couplé. Où ranger les fichiers selon le palier du projet (`.rules`, `domain/`, ports) : `qualite/organisation.md` §5 et §6.

### Règles métier : un seul endroit, sans dépendance extérieure

- Une règle métier vit dans **un module de règles** de la fonctionnalité (`item.rules`, ou `domain/` aux paliers 2 et 3), à l'écart des composants d'affichage, gestionnaires de route, requêtes à la base et scripts de migration.
- Ce module est **pur** : il reçoit des valeurs et retourne un résultat. Il reste indépendant de l'interface, de l'accès aux données, du réseau et du framework ; l'heure courante, le hasard et les variables d'environnement lui sont passés en paramètre.
- **Une règle = une fonction nommée avec les mots du glossaire** (`canPublish`, `computeLateFee`, `isEligibleForDiscount`). Les seuils et valeurs de la règle sont des constantes nommées dans ce même module (§3).
- **Une seule version** : si la même règle sert à l'écran (confort) et au serveur (protection, S5), les deux appellent la même fonction quand le langage le permet ; sinon la version serveur fait foi et l'autre la cite en commentaire.
- Une règle qui change se modifie **à un seul endroit**. Si une modification de règle oblige à toucher plusieurs fichiers, c'est qu'elle a été dispersée : la regrouper.

```
// ❌ Règle enfouie dans l'affichage, et recopiée ailleurs
composant InvoiceRow(invoice) :
  SI invoice.dueDate < maintenant() ET invoice.status != "paid" ALORS afficher badge "En retard"

// ✅ Règle centralisée, pure, appelée partout
// invoice.rules
fonction isOverdue(invoice, today) :
  RETOURNER invoice.dueDate < today ET invoice.status != InvoiceStatus.PAID

composant InvoiceRow(invoice, today) :
  SI isOverdue(invoice, today) ALORS afficher badge "En retard"
```

### Testable

- **Séparer décider et agir** : le calcul (pur, testé par des tests unitaires) d'un côté, les effets (écrire, envoyer, afficher) de l'autre, réduits à une fine couche qui appelle le calcul (§4 : une fonction calcule *ou* agit).
- **Les dépendances entrent par la porte** : une fonction reçoit ce dont elle a besoin (données, date du jour, fonction d'envoi, accès au stockage) en paramètre ou à la construction, au lieu de l'aller chercher elle-même (import direct d'un client de base, appel à l'heure système, variable globale). C'est ce qui permet de lui passer une doublure dans un test.
- Tout état modifiable est explicite et passé en paramètre, plutôt que global ou caché dans un singleton : deux tests lancés dans n'importe quel ordre donnent le même résultat.
- Une fonction difficile à tester est un signal de conception (trop de responsabilités, dépendances cachées) : la redécouper, puis la tester.
- Chaque règle métier a ses tests : cas nominal, limites (seuil exact, valeur vide, zéro), cas refusés. Emplacement des tests : `qualite/organisation.md` §7.

```
// ❌ Intestable sans vraie base ni vraie horloge
fonction sendReminders() :
  invoices = Database.query("SELECT ...")
  POUR CHAQUE invoice DANS invoices
    SI invoice.dueDate < maintenant() ALORS Mailer.send(invoice.email, ...)

// ✅ La décision est pure, les effets sont injectés
fonction selectInvoicesToRemind(invoices, today) :
  RETOURNER filtrer(invoices, i => isOverdue(i, today))

fonction sendReminders({ loadInvoices, sendEmail, today }) :
  POUR CHAQUE invoice DANS selectInvoicesToRemind(loadInvoices(), today)
    sendEmail(invoice.email, ...)
```

### Faible couplage

- **Dépendre seulement de ce qu'on utilise** : passer à une fonction les champs dont elle a besoin plutôt qu'un objet complet de la base, et s'appuyer sur ce qu'un autre module expose plutôt que sur sa forme interne.
- **Le sens des dépendances va vers le métier** : l'affichage et l'accès aux données dépendent des règles, et les règles restent indépendantes d'eux (`qualite/organisation.md` §6).
- **Les détails techniques restent au bord** : le format d'un service externe, d'une table ou d'une bibliothèque est traduit dans le module qui lui parle ; le reste du code manipule les types du projet. Changer de service touche seulement ce module.
- Une fonctionnalité passe par ce qu'une autre expose (son `index`) et laisse ses fichiers internes de côté.
- Demander une valeur au module qui la possède, plutôt que de la chercher par une chaîne d'accès qui traverse plusieurs objets (`order.customer.account.settings.currency`).
- **Faible couplage, abstraction minimale** : on ajoute une interface, un port ou une fabrique seulement lorsqu'il existe déjà deux implémentations, ou qu'un test en a réellement besoin pour passer une doublure (§10, YAGNI). Passer une fonction en paramètre suffit souvent.

## 6. Commentaires : expliquer le pourquoi

On écrit des **commentaires en français qui expliquent le *pourquoi*** (une intention, une contrainte, un piège évité) ; le *quoi*, le code le dit déjà. Une règle différente du `CLAUDE.md` du projet l'emporte.

```
// ❌ Répète le code
// On ajoute l'élément à la liste
items = ajouter(items, item)

// ✅ Explique le pourquoi
// On enregistre avant d'afficher : si l'affichage échoue, la saisie n'est pas perdue
save(items)
render(items)
```

- Un commentaire en tête de chaque fichier : à quoi il sert, en une ou deux lignes.
- Supprimer le code commenté (l'historique de versions le garde) ; chaque « à faire » a une suite ; chaque commentaire reste à jour.

## 7. Typage et contrats de données

- **Si le langage le permet, typer strictement** : activer le mode le plus strict déjà configuré dans le projet, écrire des types précis plutôt que le type « n'importe quoi », et corriger ce que signale le compilateur plutôt que le faire taire. Une valeur d'origine inconnue (réponse réseau, fichier lu, saisie) est traitée comme inconnue, puis vérifiée.
- **Sinon, documenter les entrées et sorties** des fonctions exportées ou partagées (commentaire de documentation au format habituel du langage) : types attendus, valeurs possibles, ce qui est renvoyé en cas d'échec.
- Typer ou documenter explicitement les **signatures exportées** ; l'annotation des variables locales évidentes est facultative.
- Représenter les états par des variantes explicites (chargement / erreur / succès) plutôt que par une combinaison de booléens incohérents (`isLoading` et `hasError` vrais en même temps).
- Quand le langage le permet, faire échouer la compilation pour toute variante oubliée (vérification exhaustive).
- Toute donnée qui entre dans le système (saisie, requête, fichier, service externe) est **validée à la frontière** : forme, type, longueur, format. Ensuite, le reste du code travaille sur des données sûres.

## 8. Gestion des erreurs

- **Chaque erreur est traitée ou remonte** : sur une opération importante, un bloc de capture contient toujours un traitement. Soit on traite l'erreur, soit on la laisse remonter à un endroit qui la traite.
- **Message compréhensible** pour la personne qui utilise l'application, en français, avec une piste (« Vérifiez votre connexion puis réessayez. »).
- **Seul le message compréhensible** atteint l'écran ou une réponse : pile d'appels, requête à la base, chemin de fichier, nom de variable d'environnement et message brut d'un service restent internes (S11).
- Le détail technique va dans le journal côté serveur, **sans donnée personnelle ni jeton**.
- Erreurs **attendues** (saisie invalide, droit refusé, ressource absente) : les retourner comme un résultat explicite (`{ ok: false, message }` ou équivalent). Erreurs **inattendues** : les laisser remonter jusqu'au gestionnaire global prévu par le projet.
- Lever des erreurs du type prévu par le langage, avec un message, plutôt qu'une simple chaîne.
- Un appel réseau peut répondre avec un statut d'erreur sans lever d'exception : **vérifier le statut** de la réponse.

```
fonction loadItems() :
  ESSAYER
    réponse = appelerService("/items")
    SI réponse.statut n'est pas un succès ALORS lever Erreur("Statut " + réponse.statut)
    RETOURNER réponse.contenu
  EN CAS D'ERREUR e
    journaliser("items: chargement échoué", e.code)   // détail technique, sans donnée personnelle
    RETOURNER { ok: faux, message: "Impossible de charger les éléments. Réessayez dans un instant." }
```

## 9. Asynchrone

- Utiliser la forme d'attente la plus lisible offerte par le langage ; un seul style par module.
- Chaque opération asynchrone est **attendue ou explicitement gérée** : chaque promesse, tâche ou futur a une suite.
- Appels **indépendants** : les lancer en parallèle puis attendre l'ensemble, plutôt qu'une attente dans une boucle.
- Appels **dépendants** : les enchaîner dans l'ordre, à plat plutôt qu'en rappels imbriqués.
- Toute attente réseau a une issue en cas d'échec (message, nouvel essai proposé) et, si possible, un délai maximal.
- Pendant une action déclenchée par la personne, désactiver le déclencheur pour qu'elle parte une seule fois, et le réactiver quoi qu'il arrive.

## 10. Organisation du code

- **Regrouper par fonctionnalité** ce qui sert à une même fonction (affichage, validation, lecture, écriture, types) ; mettre à part ce qui est partagé par plusieurs fonctionnalités.
- **Un fichier = une responsabilité.** Découper quand un fichier dépasse ~300 lignes ou mélange plusieurs sujets.
- On crée un fichier **au moment d'y écrire du code utile** : dossiers et fichiers naissent avec leur premier contenu, au fil des besoins.
- L'emplacement des fichiers suit le code existant, puis « Organisation des fichiers » de `docs/technical.md`, puis la liste de fichiers de la tâche du plan. L'arborescence vient de ces sources, et d'elles seules. Nommage des fichiers, paliers de structure et règles de dépendance entre dossiers : `qualite/organisation.md`.
- Une couche d'abstraction (service, dépôt, fabrique) s'ajoute quand elle évite une vraie duplication ou qu'elle rend testable un code difficile à tester (§5), plutôt que par principe. Isoler les règles métier dans leur module est à part : c'est toujours requis.
- Importer directement le module qui définit ce qu'on utilise, plutôt qu'un fichier qui ne fait que réexporter d'autres modules. **Seule exception** : l'`index` public d'une feature, qui liste explicitement ce qu'elle partage (`qualite/organisation.md` §6).
- Imports à sens unique : quand A dépend de B, B reste indépendant de A.
- Avant d'importer un module du projet, vérifier qu'il existe.

## 11. Séparer serveur et client

- Le code qui lit un **secret**, accède directement à la base ou applique une règle de sécurité s'exécute **uniquement côté serveur** et reste hors du code envoyé au navigateur ou à l'application installée.
- Le code côté client est **public** : tout ce qu'il contient (clés, règles, champs cachés, boutons désactivés) peut être lu et contourné.
- Les données qui passent du serveur au client sont limitées au nécessaire : les champs utiles, plutôt qu'un objet complet de la base « pour simplifier ».
- Une même règle de validation peut exister des deux côtés (confort côté client), mais celle du serveur est la seule qui protège (S5).
- Où passe la frontière dans la technologie retenue : « Pile retenue » et « Données et contrôle d'accès » de `docs/technical.md`, puis documentation officielle.

## 12. Dépendances

- **Ajouter une bibliothèque après l'accord de la personne**, et seulement quand le langage ou la plateforme manque d'une solution simple.
- **Vérifier qu'elle existe** sous ce nom exact, qu'elle est maintenue et qu'elle provient d'une source officielle (S8). Le nom du paquet se recopie depuis cette source, jamais deviné.
- **Version fixée** (fichier de verrouillage enregistré, ou version explicite), plutôt qu'une « dernière version » implicite.
- Importer seulement les bibliothèques présentes dans le fichier de dépendances du projet ; pour une autre, demander.
- Pour son API : documentation officielle de la version installée, consultée à chaque fois.

## 13. Configuration

- Ajouter une option de configuration **seulement pour résoudre un problème constaté**, dans le fichier de configuration **déjà présent** dans le projet, après accord de la personne.
- Réserver la création d'un fichier de configuration et l'ajout d'une dépendance à un besoin réel, au-delà d'une option simplement « recommandée ».
- Les valeurs qui changent selon l'environnement (adresses, clés, options) passent par des **variables d'environnement**, déclarées sans valeur dans le fichier d'exemple du projet ; leurs noms et l'endroit où les saisir viennent de « Secrets et variables d'environnement » de `docs/technical.md`.

## 14. Outils de contrôle du projet

- Respecter le style imposé par les outils déjà configurés (analyse statique, formatage, vérification des types).
- Lancer les contrôles automatiques listés dans « Commandes du projet » de `docs/technical.md` avant de livrer ; seules les commandes listées se lancent (« aucune » signifie qu'il n'y a rien à lancer).
- Quand un contrôle échoue, **corriger la cause** et garder la règle active.

## 15. Anti-patterns

| À éviter | À faire |
|---|---|
| Importer un module ou une bibliothèque supposés exister | Vérifier ; sinon créer dans la tâche, ou demander |
| Inventer une arborescence de dossiers | Suivre le code existant, `docs/technical.md` et le plan |
| Fonction de 80 lignes, 5 niveaux d'imbrication | Sous-fonctions nommées, retours anticipés |
| `render(true, false, null)` | Objet d'options nommées ou deux fonctions distinctes |
| Nombre ou texte magique | Constante nommée |
| Bloc de capture vide, message brut affiché | Message clair, détail dans le journal serveur |
| Statut de réponse non vérifié | Vérifier le statut avant d'utiliser le contenu |
| Type « n'importe quoi », silence forcé du compilateur | Type précis, valeur inconnue vérifiée |
| Couche, option ou dépendance « pour plus tard » | Ajouter quand le besoin est réel |
| Secret dans le code client | Code serveur + variable d'environnement |
| Règle d'analyse désactivée pour faire passer | Corriger la cause |
| Commentaire qui répète le code, code commenté | Commentaire du *pourquoi* ; historique de versions |
| Fichier qui réexporte tout un dossier | Import direct du module concerné |
| Règle métier dans un composant, une route ou une requête | Fonction nommée dans le module de règles, appelée partout |
| Même règle recopiée à plusieurs endroits | Une seule fonction, importée par tous |
| Fonction qui lit elle-même l'heure, la base ou le réseau | Valeurs et dépendances reçues en paramètre |
| Calcul et effet mêlés dans la même fonction | Calcul pur testé, effet dans une fine couche autour |
| Format d'un service externe qui circule dans tout le code | Traduction dans le seul module qui lui parle |
| Interface ou port créé « pour être propre » | Ajouté quand une 2ᵉ implémentation ou un test l'exige |

## 16. Checklist

### À l'implémentation

- [ ] Chaque import pointe vers un module qui existe ou une dépendance présente dans le projet.
- [ ] Fonctions ≤ 30 lignes, ≤ 3 niveaux d'imbrication, ≤ 4 paramètres ; fichiers ≤ 300 lignes.
- [ ] Fichiers placés selon le code existant, `docs/technical.md` et le plan ; conventions existantes respectées.
- [ ] Noms explicites, booléens `is/has/should`, chaque valeur à sens métier nommée en constante.
- [ ] Chaque règle métier est une fonction nommée, écrite une seule fois dans le module de règles, indépendante de l'interface, des données, du réseau et du framework.
- [ ] Les décisions sont des calculs purs ; heure, hasard, accès aux données et services externes sont reçus en paramètre.
- [ ] Les règles métier ont leurs tests (nominal, limites, refus), qui passent sans base, réseau ni interface.
- [ ] Les dépendances vont vers le métier ; les formats externes sont traduits au bord ; chaque fonctionnalité passe par l'index public des autres.
- [ ] Commentaire en tête de fichier ; commentaires en français sur le *pourquoi* (sauf règle contraire du `CLAUDE.md`).
- [ ] Types stricts si le langage le permet, sinon entrées et sorties documentées ; données entrantes validées à la frontière.
- [ ] Chaque erreur est traitée ou remonte au gestionnaire prévu ; messages compréhensibles ; détails internes gardés côté serveur.
- [ ] Opérations asynchrones toutes attendues ou gérées ; appels indépendants en parallèle.
- [ ] Code serveur et code client séparés ; secrets uniquement côté serveur.
- [ ] Chaque dépendance ou option de configuration ajoutée l'a été avec accord.
- [ ] Contrôles automatiques de « Commandes du projet » passés.

### À la relecture

- [ ] Le code fait ce que la spec demande, ni plus ni moins (YAGNI).
- [ ] Chaque information à un seul endroit ; code mort, code commenté et traces de débogage supprimés.
- [ ] Journaux limités au détail technique : aucune donnée personnelle ni jeton (S11).
- [ ] Chaque règle métier dans le module de règles, écrite une seule fois (hors affichage, routes et requêtes).
- [ ] Changer d'affichage, de stockage ou de service externe ne toucherait qu'un module.
- [ ] Une personne qui débute peut lire chaque fonction et dire ce qu'elle fait.

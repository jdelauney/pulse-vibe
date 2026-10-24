# Clean code

En cas de doute : **lisible avant d'être malin**. Ces règles valent pour tout langage ; syntaxe et conventions de la technologie retenue : « Pile retenue » de `docs/technical.md`, le code existant, la documentation officielle.

## 1. Principes

- **KISS** : la solution la plus simple qui marche ; une abstraction quand le besoin est là, une optimisation face à un problème constaté.
- **DRY** : une information à un seul endroit (constante, fonction, module). Fusionner les vraies répétitions ; deux codes qui se ressemblent mais servent des buts différents restent séparés.
- **YAGNI** : coder exactement ce que la spec demande. Paramètre, option, couche, fichier ou dépendance s'ajoutent le jour où le besoin existe.
- **Responsabilité unique** : une fonction fait une chose, un fichier a un sujet. Un nom qui contient « et » (`saveAndRender`) se coupe en deux.
- **Séparer les rôles** : les données (lecture, calcul, écriture), l'affichage, la configuration.
- **Règles métier isolées, code testable, faible couplage** : §5. Évolutif veut dire facile à changer demain, construit pour le besoin d'aujourd'hui.
- **Vérifier avant d'utiliser** : un fichier, un module, une fonction, une table ou une bibliothèque existe une fois vu dans le projet. Le chercher avant de l'utiliser ; s'il manque, le créer si la tâche le prévoit, sinon le signaler.

### Limites chiffrées

| Mesure | Limite | Si on dépasse |
|---|---|---|
| Lignes par fonction (ou composant) | ≤ 30 | Extraire des sous-fonctions bien nommées |
| Niveaux d'imbrication (conditions, boucles) | ≤ 3 | Retours anticipés, extraction de fonction |
| Paramètres par fonction | ≤ 4 | Passer un objet (ou une structure) nommé |
| Lignes par fichier | ≤ 300 | Découper en modules à responsabilité unique |
| Branches d'une chaîne « si / sinon si » | ≤ 3 | Table de correspondance avec valeur de repli |

Ce sont des signaux : une fonction de 32 lignes parfaitement claire vaut mieux que trois fonctions artificielles.

## 2. Nommage

- Suivre d'abord la convention du langage et celle du projet (casse des variables, fonctions, types, fichiers).
- **Identifiants en anglais simple**, textes affichés et commentaires en français (sauf règle contraire du `CLAUDE.md` du projet).
- Booléens `is`, `has`, `should`, en logique positive (`isVisible`) ; fonctions nommées par un verbe qui dit **quoi** (`addItem`, `formatDate`) ; pluriel pour une collection (`items`).
- Le nom dit le contenu, en entier : `maxTitleLength`, plutôt qu'une abréviation (`mtl`) ou un nom vague (`data`, `temp`, `info`, `manager`, `handleData`, `process`).

## 3. Constantes : aucune valeur magique

Un nombre ou une chaîne au sens métier reçoit un nom, déclaré une fois en haut du fichier, ou dans un module de constantes partagé s'il sert à plusieurs endroits : `MAX_TITLE_LENGTH = 120`, cité dans la condition et dans le message d'erreur. Les valeurs qui vont ensemble (statuts, rôles, catégories) forment un ensemble fermé nommé (énumération, objet figé ou équivalent). Une longue chaîne de conditions devient une table de correspondance avec repli :

```
STATUS_LABELS = { draft: "Brouillon", published: "Publié" }
label = STATUS_LABELS[item.status] SINON "Inconnu"
```

## 4. Fonctions

- Une seule responsabilité, un seul niveau d'abstraction ; **retours anticipés** plutôt qu'imbrication.
- Une fonction **calcule** (retourne une valeur) **ou** **agit** (écrit, affiche, envoie).
- Un paramètre booléen « drapeau » (`render(true)`) devient deux fonctions explicites ou un objet d'options nommées.
- Retourner une nouvelle valeur ; les paramètres reçus restent intacts. Variables immuables par défaut si le langage le permet, chacune dans la portée la plus courte.
- Une condition complexe devient une variable nommée : `isLate = dueDate < today ET NON item.isClosed`.
- Expressions conditionnelles à un seul niveau ; le code exécuté est celui des sources, jamais du code construit à partir d'une chaîne.

## 5. Testabilité, couplage et règles métier

Une règle métier isolée se teste facilement, et un code facile à tester est peu couplé. Emplacement selon le palier du projet (`.rules`, `domain/`, ports) : `qualite/organisation.md` §5 et §6.

### Règles métier : un seul endroit, sans dépendance extérieure

- Une règle métier (calcul, statut, droit, seuil, validation métier) vit dans **le module de règles** de la fonctionnalité (`item.rules`, ou `domain/` aux paliers 2 et 3), à l'écart des composants d'affichage, gestionnaires de route, requêtes à la base et scripts de migration.
- Ce module est **pur** : il reçoit des valeurs et retourne un résultat, indépendant de l'interface, des données, du réseau et du framework ; l'heure courante, le hasard et les variables d'environnement lui sont passés en paramètre.
- **Une règle = une fonction nommée avec les mots du glossaire** (`canPublish`, `computeLateFee`) ; ses seuils sont des constantes nommées du même module (§3).
- **Une seule version** : si la règle sert à l'écran (confort) et au serveur (protection, S5), les deux appellent la même fonction quand le langage le permet ; sinon la version serveur fait foi et l'autre la cite en commentaire.
- Une règle qui change se modifie **à un seul endroit** ; si elle oblige à toucher plusieurs fichiers, la regrouper.

### Testable

- **Séparer décider et agir** : le calcul pur, couvert par des tests unitaires ; les effets (écrire, envoyer, afficher) dans une fine couche qui l'appelle.
- **Les dépendances entrent par la porte** : données, date du jour, fonction d'envoi, accès au stockage arrivent en paramètre ou à la construction, au lieu d'un import direct d'un client de base, de l'heure système ou d'une variable globale. Un test passe alors une doublure, sans application lancée ni base, réseau ou horloge réels.
- Tout état modifiable est explicite et passé en paramètre, plutôt que global ou caché dans un singleton : deux tests donnent le même résultat dans n'importe quel ordre.
- Une fonction difficile à tester signale une conception à revoir : la redécouper, puis la tester.
- Chaque règle métier a ses tests : cas nominal, limites (seuil exact, valeur vide, zéro), cas refusés. Emplacement : `qualite/organisation.md` §7.

```
// invoice.rules : la règle, pure, écrite une fois
fonction isOverdue(invoice, today) :
  RETOURNER invoice.dueDate < today ET invoice.status != InvoiceStatus.PAID

// L'affichage l'appelle, au lieu de recopier la condition
composant InvoiceRow(invoice, today) :
  SI isOverdue(invoice, today) ALORS afficher badge "En retard"

// La décision est pure, les effets sont reçus en paramètre
fonction sendReminders({ loadInvoices, sendEmail, today }) :
  POUR CHAQUE invoice DANS filtrer(loadInvoices(), i => isOverdue(i, today))
    sendEmail(invoice.email, ...)
```

### Faible couplage

- **Dépendre seulement de ce qu'on utilise** : passer les champs utiles plutôt qu'un objet complet de la base ; s'appuyer sur ce qu'un module expose plutôt que sur sa forme interne.
- **Le sens des dépendances va vers le métier** : l'affichage et l'accès aux données dépendent des règles, qui restent indépendantes d'eux (`qualite/organisation.md` §6).
- **Les détails techniques restent au bord** : le format d'un service externe, d'une table ou d'une bibliothèque est traduit dans le seul module qui lui parle ; le reste du code manipule les types du projet.
- Une fonctionnalité passe par ce qu'une autre expose (son `index`, ou les dossiers ouverts quand le framework déconseille l'`index`).
- Demander une valeur au module qui la possède, plutôt qu'une chaîne d'accès qui traverse plusieurs objets (`order.customer.account.settings.currency`).
- **Abstraction minimale** : interface, port ou fabrique s'ajoutent quand deux implémentations existent déjà, ou qu'un test en a besoin pour passer une doublure (YAGNI). Passer une fonction en paramètre suffit souvent.

## 6. Commentaires : expliquer le pourquoi

Commentaires en français qui expliquent le *pourquoi* (intention, contrainte, piège évité : « on enregistre avant d'afficher : si l'affichage échoue, la saisie est gardée ») ; le *quoi*, le code le dit. Une règle différente du `CLAUDE.md` du projet l'emporte.

- Un commentaire en tête de chaque fichier : à quoi il sert, en une ou deux lignes.
- Code commenté supprimé (l'historique de versions le garde) ; chaque « à faire » a une suite ; chaque commentaire reste à jour.

## 7. Typage et contrats de données

- **Si le langage le permet, typer strictement** : le mode le plus strict déjà configuré, des types précis plutôt que le type « n'importe quoi » ; corriger ce que signale le compilateur plutôt que le faire taire. **Sinon, documenter** les entrées et sorties des fonctions exportées ou partagées (format habituel du langage) : types attendus, valeurs possibles, retour en cas d'échec. Les signatures exportées sont typées ou documentées explicitement ; les variables locales évidentes peuvent rester sans annotation.
- Toute donnée qui entre (saisie, requête, fichier, service externe) est traitée comme inconnue et **validée à la frontière** : forme, type, longueur, format. Le reste du code travaille ensuite sur des données sûres.
- États en variantes explicites (chargement / erreur / succès) plutôt qu'en booléens qui se contredisent (`isLoading` et `hasError` vrais ensemble) ; si le langage le permet, une variante oubliée fait échouer la compilation.

## 8. Gestion des erreurs

- **Chaque erreur est traitée ou remonte** à un endroit qui la traite : un bloc de capture contient toujours un traitement.
- Erreurs **attendues** (saisie invalide, droit refusé, ressource absente) : un résultat explicite (`{ ok: false, message }` ou équivalent). Erreurs **inattendues** : elles remontent au gestionnaire global prévu par le projet. Lever le type d'erreur du langage, avec un message.
- **Message compréhensible** pour la personne, en français, avec une piste (« Vérifiez votre connexion puis réessayez. »). Seul ce message atteint l'écran ou une réponse : pile d'appels, requête à la base, chemin de fichier, nom de variable d'environnement et message brut d'un service restent internes (S11).
- Le détail technique va dans le journal côté serveur, **sans donnée personnelle ni jeton**.
- Un appel réseau peut répondre par un statut d'erreur sans lever d'exception : **vérifier le statut** avant d'utiliser le contenu.

## 9. Asynchrone

- La forme d'attente la plus lisible du langage, un seul style par module.
- Chaque opération asynchrone est **attendue ou explicitement gérée** : chaque promesse, tâche ou futur a une suite.
- Appels **indépendants** lancés en parallèle puis attendus ensemble ; appels **dépendants** enchaînés dans l'ordre, à plat.
- Toute attente réseau a une issue en cas d'échec (message, nouvel essai proposé) et, si possible, un délai maximal.
- Pendant une action déclenchée par la personne, le déclencheur est désactivé pour qu'elle parte une seule fois, puis réactivé quoi qu'il arrive.

## 10. Organisation du code

- **Regrouper par fonctionnalité** ce qui sert à une même fonction ; mettre à part ce qui est partagé. **Un fichier = une responsabilité** : découper au-delà de ~300 lignes ou de plusieurs sujets.
- Un fichier ou un dossier naît avec son premier code utile.
- L'emplacement suit le code existant, puis « Organisation des fichiers » de `docs/technical.md`, puis la liste de fichiers de la tâche du plan : l'arborescence vient de ces sources seules. Nommage, paliers et dépendances entre dossiers : `qualite/organisation.md`.
- Une couche d'abstraction (service, dépôt, fabrique) s'ajoute quand elle évite une vraie duplication ou rend testable un code difficile à tester (§5). Isoler les règles métier, lui, est toujours requis.
- Importer le module qui définit ce qu'on utilise, plutôt qu'un fichier qui réexporte d'autres modules ; **seule exception** : l'`index` public d'une feature, quand le framework le permet (`qualite/organisation.md` §6). Imports à sens unique : si A dépend de B, B reste indépendant de A.

## 11. Séparer serveur et client

- Le code qui lit un **secret**, accède directement à la base ou applique une règle de sécurité s'exécute **uniquement côté serveur**, hors du code envoyé au navigateur ou à l'application installée.
- Le code côté client est **public** : clés, règles, champs cachés, boutons désactivés s'y lisent et se contournent.
- Le serveur envoie au client les seuls champs utiles, plutôt qu'un objet complet de la base « pour simplifier ».
- Une même validation peut exister des deux côtés (confort côté client) ; seule celle du serveur protège (S5).
- Où passe la frontière dans la technologie retenue : « Pile retenue » et « Données et contrôle d'accès » de `docs/technical.md`, puis documentation officielle.

## 12. Dépendances

- **Une bibliothèque s'ajoute avec l'accord de la personne**, seulement quand le langage ou la plateforme manque d'une solution simple ; sans cet accord, seules celles du fichier de dépendances du projet s'importent.
- Elle **existe sous ce nom exact**, est maintenue et provient d'une source officielle (S8) : le nom se recopie depuis cette source, jamais deviné.
- **Version fixée** (fichier de verrouillage enregistré, ou version explicite), plutôt qu'une « dernière version » implicite.
- Son API : documentation officielle de la version installée, consultée à chaque fois.

## 13. Configuration

- Une option de configuration s'ajoute **seulement pour résoudre un problème constaté**, dans le fichier de configuration **déjà présent**, avec l'accord de la personne. Un nouveau fichier de configuration ou une dépendance répond à un besoin réel, au-delà d'une option « recommandée ».
- Les valeurs qui changent selon l'environnement (adresses, clés, options) passent par des **variables d'environnement**, déclarées sans valeur dans le fichier d'exemple du projet ; noms et lieu de saisie : « Secrets et variables d'environnement » de `docs/technical.md`.

## 14. Outils de contrôle du projet

- Le style suit les outils déjà configurés (analyse statique, formatage, vérification des types).
- Avant de livrer, lancer les contrôles de « Commandes du projet » de `docs/technical.md`, et seulement ceux-là (« aucune » : rien à lancer).
- Un contrôle échoue : **corriger la cause**, en gardant la règle active.

## 15. Anti-patterns

Pièges fréquents du code généré, chacun corrigé par sa règle : module, bibliothèque ou dossier supposés exister (§1, §10) ; compilateur ou règle d'analyse réduits au silence (§7, §14) ; couche, option ou interface « pour plus tard » (§1, §5) ; règle métier recopiée dans un composant, une route ou une requête (§5) ; fonction qui lit elle-même l'heure, la base ou le réseau (§5) ; format d'un service externe qui circule dans tout le code (§5) ; bloc de capture vide ou message brut affiché (§8) ; secret dans le code client (§11).

## 16. Checklist

### À l'implémentation

- [ ] Chaque import pointe vers un module qui existe ou une dépendance présente dans le projet.
- [ ] Fonctions ≤ 30 lignes, ≤ 3 niveaux d'imbrication, ≤ 4 paramètres ; fichiers ≤ 300 lignes.
- [ ] Fichiers placés selon le code existant, `docs/technical.md` et le plan ; conventions existantes respectées.
- [ ] Noms explicites, booléens `is/has/should`, chaque valeur à sens métier nommée en constante.
- [ ] Chaque règle métier est une fonction nommée, écrite une seule fois dans le module de règles, indépendante de l'interface, des données, du réseau et du framework.
- [ ] Les décisions sont des calculs purs ; heure, hasard, accès aux données et services externes sont reçus en paramètre.
- [ ] Les règles métier ont leurs tests (nominal, limites, refus), qui passent sans base, réseau ni interface.
- [ ] Les dépendances vont vers le métier ; les formats externes sont traduits au bord ; chaque fonctionnalité passe par ce que les autres exposent (index public, ou dossiers ouverts).
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

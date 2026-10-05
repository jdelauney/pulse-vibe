# Clean code

En cas de doute : **lisible avant d'être malin**. Ces règles valent pour tout langage ; la syntaxe et les conventions propres à la technologie retenue viennent de « Pile retenue » de `docs/technical.md`, du code existant et de la documentation officielle.

## 1. Principes

- **KISS** : la solution la plus simple qui marche. Pas d'astuce sur une ligne, pas d'abstraction « au cas où », pas d'optimisation avant un problème constaté.
- **DRY** : une information à un seul endroit (constante, fonction, module). Deux bouts de code qui se ressemblent mais servent des buts différents peuvent rester séparés : ne pas fusionner une ressemblance accidentelle.
- **YAGNI** : on ne code que ce que la spec demande. Pas de paramètre, d'option, de couche, de fichier ni de dépendance « pour plus tard ».
- **Responsabilité unique** : une fonction fait une chose, un fichier a un sujet, un module une raison de changer. Si le nom contient « et » (`saveAndRender`), on coupe en deux.
- **Séparer les rôles** : les données (lecture, calcul, écriture) d'un côté, l'affichage de l'autre, la configuration à part.
- **Ne rien supposer** : un fichier, un module, une fonction, une table ou une bibliothèque n'existe que si on l'a vu dans le projet. Avant d'utiliser quelque chose, le chercher ; s'il manque, le créer dans la tâche si elle le prévoit, sinon le signaler.

### Limites chiffrées

| Mesure | Limite | Si on dépasse |
|---|---|---|
| Lignes par fonction (ou composant) | ≤ 30 | Extraire des sous-fonctions bien nommées |
| Niveaux d'imbrication (conditions, boucles) | ≤ 3 | Retours anticipés, extraction de fonction |
| Paramètres par fonction | ≤ 4 | Passer un objet (ou une structure) nommé |
| Lignes par fichier | ≤ 300 | Découper en modules à responsabilité unique |
| Branches d'une chaîne « si / sinon si » | ≤ 3 | Table de correspondance avec valeur de repli |

Ces limites sont des signaux, pas des dogmes : une fonction de 32 lignes parfaitement claire vaut mieux que trois fonctions artificielles.

## 2. Nommage

- Suivre d'abord la convention du langage et celle déjà présente dans le projet (casse des variables, des fonctions, des types, des fichiers).
- **Identifiants en anglais simple**, textes affichés et commentaires en français (sauf règle contraire du `CLAUDE.md` du projet).
- Pluriel pour une collection (`items`), singulier pour un élément (`item`).
- Booléens préfixés `is`, `has`, `should`, en logique positive : `isVisible` plutôt que `isNotHidden`.
- Fonctions nommées par un verbe qui dit **quoi**, pas **comment** : `addItem`, `formatDate`, `sendInvitation`.
- Noms interdits car vagues : `data`, `data2`, `temp`, `info`, `manager`, `handleData`, `doStuff`, `process`.
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
- Une fonction **calcule** (retourne une valeur) **ou** **agit** (écrit, affiche, envoie), pas les deux.
- Pas de paramètre booléen « drapeau » (`render(true)`) : deux fonctions explicites ou un objet d'options nommées.
- Ne pas modifier les paramètres reçus : retourner une nouvelle valeur.
- Une condition complexe devient une variable nommée : `isLate = dueDate < today ET NON item.isClosed`.
- Pas d'expression conditionnelle imbriquée dans une autre ; pas d'exécution de code construit à partir d'une chaîne.
- Variables immuables par défaut quand le langage le permet ; portée la plus courte possible ; pas de variable globale partagée entre modules.

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

## 5. Commentaires : expliquer le pourquoi

On écrit des **commentaires en français qui expliquent le *pourquoi*** (une intention, une contrainte, un piège évité), jamais le *quoi* que le code dit déjà. Une règle différente du `CLAUDE.md` du projet l'emporte.

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
- Pas de code commenté (l'historique de versions le garde), pas de « à faire » sans suite, pas de commentaire périmé.

## 6. Typage et contrats de données

- **Si le langage le permet, typer strictement** : activer le mode le plus strict déjà configuré dans le projet, ne jamais utiliser le type « n'importe quoi » ni forcer le compilateur à se taire. Une valeur d'origine inconnue (réponse réseau, fichier lu, saisie) est traitée comme inconnue, puis vérifiée.
- **Sinon, documenter les entrées et sorties** des fonctions exportées ou partagées (commentaire de documentation au format habituel du langage) : types attendus, valeurs possibles, ce qui est renvoyé en cas d'échec.
- Typer ou documenter explicitement les **signatures exportées** ; les variables locales évidentes n'ont pas besoin d'annotation.
- Représenter les états par des variantes explicites (chargement / erreur / succès) plutôt que par une combinaison de booléens incohérents (`isLoading` et `hasError` vrais en même temps).
- Quand le langage le permet, faire échouer la compilation si une variante n'est pas traitée (vérification exhaustive).
- Toute donnée qui entre dans le système (saisie, requête, fichier, service externe) est **validée à la frontière** : forme, type, longueur, format. Ensuite, le reste du code travaille sur des données sûres.

## 7. Gestion des erreurs

- **Jamais d'erreur silencieuse** : pas de bloc de capture vide sur une opération importante. Soit on traite l'erreur, soit on la laisse remonter à un endroit qui la traite.
- **Message compréhensible** pour la personne qui utilise l'application, en français, avec une piste (« Vérifiez votre connexion puis réessayez. »).
- **Aucun détail interne** à l'écran ni dans une réponse : pas de pile d'appels, de requête à la base, de chemin de fichier, de nom de variable d'environnement, de message brut d'un service (S11).
- Le détail technique va dans le journal côté serveur, **sans donnée personnelle ni jeton**.
- Erreurs **attendues** (saisie invalide, droit refusé, ressource absente) : les retourner comme un résultat explicite (`{ ok: false, message }` ou équivalent). Erreurs **inattendues** : les laisser remonter jusqu'au gestionnaire global prévu par le projet.
- Lever des erreurs du type prévu par le langage, avec un message, jamais une simple chaîne.
- Un appel réseau qui répond avec un statut d'erreur n'est pas forcément une exception : **vérifier le statut** de la réponse.

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

## 8. Asynchrone

- Utiliser la forme d'attente la plus lisible offerte par le langage ; ne pas mélanger plusieurs styles dans un même module.
- Chaque opération asynchrone est **attendue ou explicitement gérée** : aucune promesse, tâche ou futur laissé sans suite.
- Appels **indépendants** : les lancer en parallèle puis attendre l'ensemble, plutôt qu'une attente dans une boucle.
- Appels **dépendants** : les enchaîner dans l'ordre, sans imbrication de rappels.
- Toute attente réseau a une issue en cas d'échec (message, nouvel essai proposé) et, si possible, un délai maximal.
- Pendant une action déclenchée par la personne, désactiver le déclencheur pour éviter les doublons, et le réactiver quoi qu'il arrive.

## 9. Organisation du code

- **Regrouper par fonctionnalité** ce qui sert à une même fonction (affichage, validation, lecture, écriture, types) ; mettre à part ce qui est partagé par plusieurs fonctionnalités.
- **Un fichier = une responsabilité.** Découper quand un fichier dépasse ~300 lignes ou mélange plusieurs sujets.
- On ne crée un fichier **que lorsqu'on y écrit du code utile** : pas de dossier vide, pas de squelette complet d'avance.
- L'emplacement des fichiers suit le code existant, puis « Organisation des fichiers » de `docs/technical.md`, puis la liste de fichiers de la tâche du plan. Ne jamais inventer d'arborescence. Nommage des fichiers, paliers de structure et règles de dépendance entre dossiers : `qualite/organisation.md`.
- Pas de couche d'abstraction (service, dépôt, fabrique) imposée par principe : on l'ajoute quand elle évite une vraie duplication.
- Pas de fichier qui ne fait que réexporter d'autres modules ; importer directement le module qui définit ce qu'on utilise. **Seule exception** : l'`index` public d'une feature, qui liste explicitement ce qu'elle partage (`qualite/organisation.md` §6).
- Pas d'import circulaire (A dépend de B qui dépend de A).
- Avant d'importer un module du projet, vérifier qu'il existe.

## 10. Séparer serveur et client

- Le code qui lit un **secret**, accède directement à la base ou applique une règle de sécurité s'exécute **uniquement côté serveur** ; il n'est jamais importé par du code envoyé au navigateur ou à l'application installée.
- Le code côté client est **public** : tout ce qu'il contient (clés, règles, champs cachés, boutons désactivés) peut être lu et contourné.
- Les données qui passent du serveur au client sont limitées au nécessaire : pas d'objet complet de la base « pour simplifier ».
- Une même règle de validation peut exister des deux côtés (confort côté client), mais celle du serveur est la seule qui protège (S5).
- Où passe la frontière dans la technologie retenue : « Pile retenue » et « Données et contrôle d'accès » de `docs/technical.md`, puis documentation officielle.

## 11. Dépendances

- **N'ajouter une bibliothèque qu'après l'accord de la personne**, et seulement si le langage ou la plateforme ne fait pas déjà le travail simplement.
- **Vérifier qu'elle existe** sous ce nom exact, qu'elle est maintenue et qu'elle provient d'une source officielle (S8). Ne jamais deviner un nom de paquet.
- **Version fixée** (fichier de verrouillage enregistré, ou version explicite) ; jamais « dernière version » implicite.
- Une bibliothèque absente du fichier de dépendances du projet ne s'importe pas : demander.
- Pour son API : documentation officielle de la version installée, jamais de mémoire.

## 12. Configuration

- N'ajouter une option de configuration **que pour résoudre un problème constaté**, dans le fichier de configuration **déjà présent** dans le projet, après accord de la personne.
- Ne pas créer de nouveau fichier de configuration ni ajouter une dépendance pour une option « recommandée ».
- Les valeurs qui changent selon l'environnement (adresses, clés, options) passent par des **variables d'environnement**, déclarées sans valeur dans le fichier d'exemple du projet ; leurs noms et l'endroit où les saisir viennent de « Secrets et variables d'environnement » de `docs/technical.md`.

## 13. Outils de contrôle du projet

- Respecter le style imposé par les outils déjà configurés (analyse statique, formatage, vérification des types).
- Lancer les contrôles automatiques listés dans « Commandes du projet » de `docs/technical.md` avant de livrer ; une commande notée « aucune » n'existe pas : ne pas l'inventer.
- Quand un contrôle échoue, **corriger la cause** ; ne pas désactiver une règle pour « faire passer ».

## 14. Anti-patterns

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

## 15. Checklist

### À l'implémentation

- [ ] Chaque import pointe vers un module qui existe ou une dépendance présente dans le projet.
- [ ] Fonctions ≤ 30 lignes, ≤ 3 niveaux d'imbrication, ≤ 4 paramètres ; fichiers ≤ 300 lignes.
- [ ] Fichiers placés selon le code existant, `docs/technical.md` et le plan ; conventions existantes respectées.
- [ ] Noms explicites, booléens `is/has/should`, aucune valeur magique.
- [ ] Commentaire en tête de fichier ; commentaires en français sur le *pourquoi* (sauf règle contraire du `CLAUDE.md`).
- [ ] Types stricts si le langage le permet, sinon entrées et sorties documentées ; données entrantes validées à la frontière.
- [ ] Aucune erreur silencieuse ; messages compréhensibles ; aucun détail interne exposé.
- [ ] Opérations asynchrones toutes attendues ou gérées ; appels indépendants en parallèle.
- [ ] Code serveur et code client séparés ; aucun secret côté client.
- [ ] Aucune dépendance ni option de configuration ajoutée sans accord.
- [ ] Contrôles automatiques de « Commandes du projet » passés.

### À la relecture

- [ ] Le code fait ce que la spec demande, ni plus ni moins (YAGNI).
- [ ] Aucune duplication évitable, aucun code mort ni commenté, aucune trace de débogage oubliée.
- [ ] Aucune donnée personnelle ni jeton dans les journaux (S11).
- [ ] Une personne qui débute peut lire chaque fonction et dire ce qu'elle fait.

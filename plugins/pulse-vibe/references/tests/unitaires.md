# Tests unitaires

Un test unitaire prouve **une règle, un calcul ou une transformation**, en isolant le code du projet de tout ce qui l'entoure. C'est la base de la pyramide (`tests/strategie.md` §1) : le plus grand nombre de tests, les plus rapides. Règles communes d'écriture : `tests/ecrire-un-test.md`.

## 1. Caractéristiques

- **Toutes les frontières passées en paramètre** (`qualite/clean-code.md` §5) : base, réseau, fichiers, horloge, hasard. Le test passe des valeurs fixes ou des doublures, et le code du projet tourne seul.
- **Rapide** : quelques millisecondes par test ; toute la suite unitaire tourne en quelques secondes.
- **Précis** : un test qui échoue désigne une seule règle.

## 2. Ce qu'on teste en unitaire

| Partie du code | Ce qu'on vérifie |
|---|---|
| **Règles métier** (module de règles, `domain/`) | Chaque règle : cas nominal, limites, cas refusés. Invariants (ce qui doit toujours rester vrai) |
| **Entités** | Changements d'état autorisés et refusés (« une facture payée ne repasse pas en brouillon »), validations |
| **Objets valeur** | Validation à la création, égalité par la valeur, immuabilité, mise en forme et lecture |
| **Services métier** | Règles qui font intervenir plusieurs entités |
| **Cas d'usage** (orchestration d'une action) | Enchaînement des étapes, droits et validations appliqués, erreurs remontées, effets demandés aux frontières (doublées) |
| **Conversions de données** | Transformation entre formats, validation des entrées, lecture et écriture d'un format d'échange |
| **Logique d'interface** | Voir §4 |

## 3. Exemples

### Règle métier pure : appel direct

Pour une fonction pure, un test direct suffit, sans objet SUT :

```
exemple "Facture qui arrive à échéance aujourd'hui : elle n'est pas encore en retard"
  invoice = anInvoice().withDueDate("2026-03-10").withStatus(SENT).build()
  VÉRIFIER isOverdue(invoice, "2026-03-10") ÉGAL faux
```

### Cas d'usage : SUT et doublures aux frontières

```
exemple "Nom et e-mail valides : le compte est enregistré"
  sut.givenValidUserData({ name: "Camille Martin", email: "camille@exemple.fr" })
  sut.whenUserIsCreated()
  sut.thenSavedUserIs({ id: "user-001", name: "Camille Martin", email: "camille@exemple.fr" })

fonction createSut() :
  userRepository = fakeUserRepository()       // faux : dépôt en mémoire
  generateId = () => "user-001"                // identifiant fixé
  userData
  RETOURNER {
    givenValidUserData(data) : userData = data
    whenUserIsCreated()      : createUser(userData, { userRepository, generateId })
    thenSavedUserIs(user)    : VÉRIFIER userRepository.all() ÉGAL [user]
  }
```

L'objet attendu est comparé **en entier** (`tests/ecrire-un-test.md` §7), et l'identifiant généré est fixé par injection pour rester reproductible.

## 4. Interface

D'après `qualite/composants.md` §12 :

| Élément | Test |
|---|---|
| **Logique pure** extraite des composants (validation, calcul, préparation des données) | Unitaire, en premier : c'est le plus simple et le plus utile |
| **Composant de présentation** | Rendu avec des données factices ; on vérifie ce que la personne perçoit (textes, rôles, noms accessibles, réaction à un clic ou à une saisie), plutôt que l'état interne ou le style. Ex. : fiche client de Camille Martin → `thenTextIsVisible("Camille Martin")`, puis son e-mail |
| **Quatre états** (chargement, vide, erreur, succès) | Un exemple par état quand le composant les gère lui-même |
| **Frontière d'erreur** | Un composant enfant qui échoue ; « Alors » vérifie l'affichage de secours et la possibilité de réessayer |
| **Chargement progressif** | Bouchon lent maîtrisé par le test : d'abord l'état de chargement, puis les données |
| **Formulaire** | Saisie valide envoyée, saisie invalide refusée avec message à côté du champ, champs obligatoires, bouton désactivé pendant l'envoi |
| **Logique d'état réutilisable** (fonction d'état partagée entre composants) | Testée seule : valeurs de départ, réaction à chaque action, nettoyage à la fin |
| **Composant d'orchestration** | Test manuel, ou test de bout en bout s'il est retenu (`tests/bout-en-bout.md`) |

## 5. Code exécuté côté serveur

Rendu côté serveur, action serveur, tâche planifiée : la **décision** se teste en unitaire, avec l'accès aux données, l'authentification et l'horloge doublés. Le fonctionnement avec la vraie base et le vrai contrôle d'accès relève de l'intégration (`tests/integration.md` §2).

## 6. Liste de contrôle

- [ ] Chaque règle métier a ses exemples : nominal, limites, refusés (Z.O.M.B.I.E.S, `tests/ecrire-un-test.md` §5).
- [ ] Aucun test ne touche une base, le réseau, des fichiers ou l'horloge réelle.
- [ ] Les doublures se limitent aux frontières ; le code du projet tourne réellement.
- [ ] La suite unitaire complète tourne en quelques secondes.

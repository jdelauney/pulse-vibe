# Tests d'intégration

Un test d'intégration prouve que **plusieurs morceaux réels fonctionnent ensemble** : le code du projet avec sa base, ses fichiers, ses routes, sa configuration. Il donne plus de confiance qu'un test unitaire et coûte plus cher : on en écrit quelques-uns, ciblés (`tests/strategie.md` §1). Règles communes d'écriture : `tests/ecrire-un-test.md`.

## 1. Caractéristiques

- **Durée** : quelques secondes par test.
- **Frontières du projet réelles** : base de test, fichiers temporaires, serveur du projet démarré en mode test.
- **Services tiers doublés** (paiement, envoi d'e-mails, API externes) : faux serveur local ou doublure à la frontière. Un service tiers réel rendrait le test lent, payant et instable.
- **Préparation et nettoyage plus lourds** : chaque test laisse la base et les fichiers dans l'état où il les a trouvés.
- Même discipline que les tests unitaires : histoire métier, Étant donné / Quand / Alors, objet SUT.

## 2. Ce qu'on teste en intégration

| Partie du code | Ce qu'on vérifie |
|---|---|
| **Accès aux données** (dépôts, requêtes) | Enregistrement puis relecture, filtres et tris, transactions (tout ou rien), contraintes (unicité, champ obligatoire), cas d'erreur |
| **Services externes** (adaptateurs d'API) | Traduction entre le format du service et les types du projet, erreurs renvoyées, délai dépassé, nouvelles tentatives |
| **Points d'entrée serveur** (routes, actions serveur) | Validation des entrées, contrôle d'accès, réponse, codes d'erreur, contrôles S1–S13 de `qualite/securite-code.md` |
| **Code exécuté côté serveur** | Avec la base de test et un utilisateur de test : un cas « connecté et autorisé », un cas « non connecté », un cas « pas le droit » |
| **Configuration** | L'application démarre avec la configuration attendue, et refuse de démarrer quand un réglage obligatoire manque |
| **Passage entre couches** | Une action complète côté serveur : entrée reçue → règle appliquée → donnée enregistrée → réponse |
| **Accès aux données simple** (lire, créer, modifier, supprimer sans règle) | Un test du parcours suffit, sans test unitaire en plus |

## 3. Préparation, nettoyage et données

- **Base de test dédiée**, distincte de toute base réelle ; ses accès viennent de la configuration de test, jamais d'un secret de production.
- **Remise à zéro** : transaction annulée après chaque test, ou tables vidées. Chaque scénario installe ses propres données de départ.
- **Ressource coûteuse démarrée une seule fois pour le groupe** (conteneur de base, serveur de test), à condition que chaque test nettoie ses propres données.
- **Le SUT d'intégration** prépare les ressources et expose `cleanup()`, appelé après chaque test :

```
fonctionnalité "Inscription"
  règle "Une inscription valide crée le compte et envoie l'e-mail de bienvenue"
    AVANT CHAQUE TEST : sut = createIntegrationSut()
    APRÈS CHAQUE TEST : sut.cleanup()

    exemple "Camille s'inscrit avec des données valides : compte créé et e-mail envoyé"
      // Étant donné
      sut.givenEmptyUserDatabase()
      sut.givenEmailServiceIsAvailable()
      // Quand
      sut.whenUserRegisters({ name: "Camille Martin", email: "camille@exemple.fr", password: "phrase-de-passe-longue" })
      // Alors
      sut.thenUserIsStoredInDatabase({ name: "Camille Martin", email: "camille@exemple.fr" })
      sut.thenWelcomeEmailIsSentTo("camille@exemple.fr")

fonction createIntegrationSut() :
  database = startTestDatabase()
  emailService = spyEmailService()            // espion : service tiers doublé
  app = startApp({ database, emailService })

  RETOURNER {
    givenEmptyUserDatabase()       : database.clear("users")
    givenEmailServiceIsAvailable() : emailService.respondWith(SUCCESS)
    whenUserRegisters(data)        : app.post("/register", data)
    thenUserIsStoredInDatabase(u)  : VÉRIFIER database.findUserByEmail(u.email) CONTIENT u
    thenWelcomeEmailIsSentTo(addr) : VÉRIFIER emailService.sentTo() ÉGAL [addr]
    cleanup()                      : database.close() ; app.stop()
  }
```

Ici, deux assertions vérifient le même résultat (l'inscription réussie et ses deux effets) : c'est toujours un seul comportement (`tests/ecrire-un-test.md` §3).

## 4. Pannes et erreurs

Une frontière en panne se simule par une doublure qui échoue ; « Alors » vérifie le comportement prévu par la spec :

```
exemple "Base indisponible : l'erreur est remontée et journalisée"
  sut.givenDatabaseIsUnavailable()
  sut.whenUserIsQueried("user-001")
  sut.thenDatabaseErrorIsRaised()
  sut.thenErrorIsLogged()
```

Cas à couvrir selon la spec : base indisponible, délai dépassé, réponse malformée d'un service tiers, nouvelle tentative puis abandon, valeur de repli.

## 5. Liste de contrôle

- [ ] Chaque test d'intégration prouve un assemblage qu'un test unitaire ne peut pas prouver.
- [ ] Base de test dédiée, remise à zéro entre deux tests.
- [ ] Services tiers doublés ; aucun appel réel vers l'extérieur.
- [ ] Points d'entrée : cas autorisé, non connecté et refusé présents.
- [ ] Ressources fermées après chaque test (connexions, serveurs, fichiers temporaires).

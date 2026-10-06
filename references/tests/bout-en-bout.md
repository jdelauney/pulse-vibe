# Tests de bout en bout

Un test de bout en bout prouve qu'**un parcours complet fonctionne comme pour la personne** : application démarrée, vraie interface, base de test. C'est la plus grande confiance et le plus grand coût : on en garde **peu**, sur les parcours dont l'échec bloquerait l'usage (`tests/strategie.md` §1). Règles communes d'écriture : `tests/ecrire-un-test.md`.

## 1. Caractéristiques

- **Durée** : plusieurs secondes par test ; quelques minutes pour l'ensemble.
- **Toute la pile** : interface, serveur, base de test, dans un vrai navigateur (ou la vraie interface pour une application non web).
- **Services tiers** : environnement de test du service (« bac à sable ») ou faux serveur ; jamais de paiement ni d'envoi réel.
- **Coûteux à maintenir** : chaque changement d'écran peut les toucher. Ils complètent les tests unitaires et d'intégration, et ne les remplacent pas.

## 2. Quels parcours

- **Parcours critiques** : ceux sans lesquels l'outil ne sert à rien (s'inscrire et se connecter, créer l'objet principal, payer). La liste vient des fonctionnalités « Must » de `docs/prd.md`.
- **Un parcours par test**, du point d'entrée jusqu'au résultat visible.
- **Non-régression** : un parcours qui a déjà cassé en production gagne son test.
- **Selon le besoin** déclaré dans `docs/prd.md` ou `docs/technical.md` : plusieurs navigateurs, tailles d'écran (mobile, tablette, ordinateur), accessibilité (clavier, lecteur d'écran), temps de chargement.

Les variantes d'une règle (limites, cas refusés) se testent aux niveaux inférieurs ; le test de bout en bout garde le cas nominal du parcours et, au plus, l'erreur la plus importante.

## 3. Écrire un test de bout en bout

- **Repérer les éléments comme la personne les perçoit** : rôle et nom accessible (« le bouton Enregistrer », « le champ E-mail »), puis texte visible. Un identifiant de test dédié (`data-testid` ou équivalent) seulement quand rien de visible ne convient. Les classes de style et la structure de la page changent trop souvent pour servir de repère.
- **Attendre un état observable** (le message de succès apparaît, la ligne est dans la liste) avec un délai maximal, plutôt qu'une pause de durée fixe.
- **Données** : chaque test crée ce dont il a besoin (de préférence par l'API ou directement en base, plus rapide que par l'écran) et le nettoie, ou part d'une base de test remise à zéro.
- **Objets page** : la mécanique d'un écran (où cliquer, quoi remplir) va dans un objet dédié à cet écran ; le test garde les phrases métier. Quand l'écran change, seul l'objet page change. C'est l'équivalent du SUT (`tests/ecrire-un-test.md` §4).

```
fonctionnalité "Gestion des factures"
  règle "Une facture créée apparaît dans la liste"
    AVANT CHAQUE TEST : resetTestDatabase() ; user = createTestUser()

    exemple "Camille crée une facture de 120 € : elle apparaît dans la liste"
      // Étant donné
      invoicesPage = loginAs(user).openInvoicesPage()
      // Quand
      invoicesPage.createInvoice({ customer: "Atelier Dupont", amount: "120,00" })
      // Alors
      invoicesPage.thenSuccessMessageIsVisible("Facture créée")
      invoicesPage.thenListContains("Atelier Dupont", "120,00 €")

// Objet page : seule la mécanique de l'écran vit ici
objet InvoicesPage(browser) :
  createInvoice(data) :
    browser.click(bouton "Nouvelle facture")
    browser.fill(champ "Client", data.customer)
    browser.fill(champ "Montant", data.amount)
    browser.click(bouton "Enregistrer")
  thenSuccessMessageIsVisible(text) : ATTENDRE QUE browser.voit(message text)
  thenListContains(...cells)        : ATTENDRE QUE browser.voit(ligne contenant cells)
```

## 4. Stabilité

- Navigateur sans affichage en CI, même configuration à chaque exécution (taille de fenêtre, langue, fuseau horaire).
- Tests indépendants : aucun test ne compte sur les données d'un autre ; ils peuvent tourner en parallèle quand l'outil le permet.
- En cas d'échec, l'outil conserve capture d'écran, trace et journaux de la console : ce sont les preuves pour diagnostiquer.
- Un test instable se traite comme indiqué dans `tests/strategie.md` §4.

## 5. Après un déploiement

Une petite série de tests rapides (« test de fumée ») vérifie sur l'environnement déployé que les parcours critiques répondent : la page d'accueil s'affiche, la connexion fonctionne, l'écran principal charge. Ils lisent sans rien modifier, ou utilisent un compte de test prévu pour cela.

## 6. Liste de contrôle

- [ ] Chaque test correspond à un parcours critique ou à un défaut déjà vu en production.
- [ ] Éléments repérés par rôle, nom accessible ou texte visible.
- [ ] Aucune pause de durée fixe ; attente d'un état observable.
- [ ] Données créées et nettoyées par le test, ou base remise à zéro.
- [ ] Aucun appel réel vers un service tiers (paiement, e-mail).
- [ ] Capture et trace conservées en cas d'échec.

# Écrire un test

Un bon test **raconte une histoire métier** : une situation de départ, un événement, un résultat observable. Il se lit comme une spécification et change seulement quand l'histoire change.

Ces règles valent pour **tous les types de tests**. Ce qui est propre à chaque type se trouve dans `tests/unitaires.md`, `tests/integration.md` et `tests/bout-en-bout.md`.

## 1. F.I.R.S.T : les cinq qualités d'un test

| Qualité | Ce que cela demande |
|---|---|
| **F – Rapide** (*Fast*) | Unitaire en millisecondes, intégration en secondes, bout en bout en minutes pour l'ensemble. Les frontières lentes (réseau, service tiers) sont doublées en unitaire. Les tests peuvent tourner en parallèle |
| **I – Indépendant** (*Independent*) | Aucun état partagé entre deux tests. Chaque test prépare sa situation et nettoie ce qu'il a créé. N'importe quel ordre, et l'exécution en parallèle, donnent le même résultat |
| **R – Reproductible** (*Repeatable*) | Même résultat sur toute machine, à toute heure. Date du jour, hasard, identifiants générés et fuseau horaire sont fixés par le test (passés en paramètre, `qualite/clean-code.md` §5). Données de test écrites en dur plutôt que tirées au hasard. Système de fichiers et base remis dans leur état de départ |
| **S – Auto-vérifiant** (*Self-validating*) | Le test passe ou échoue tout seul, par ses assertions. Le message d'échec dit ce qui était attendu et ce qui a été obtenu. Les vérifications passent par des assertions, et les affichages en console servent seulement au débogage |
| **T – Complet** (*Thorough*) | Cas nominal, limites, cas refusés et erreurs : la liste Z.O.M.B.I.E.S (§5) |

Variante courante du T : *Timely*, écrit au bon moment, c'est-à-dire avant ou avec le code : c'est le rôle du TDD (`tests/tdd.md`).

## 2. Structure : Fonctionnalité / Règle / Exemple

Les tests se regroupent comme une spécification métier, avec les mots du glossaire du projet :

```
fonctionnalité "Relance des factures"
  règle "Une facture non payée après son échéance est en retard"
    exemple "Facture échue hier et non payée : elle est en retard"
    exemple "Facture échue hier mais payée : elle n'est pas en retard"
    exemple "Facture qui arrive à échéance aujourd'hui : elle n'est pas encore en retard"
  règle "Une facture en retard reçoit une seule relance par semaine"
    exemple ...
```

- **Fonctionnalité** : le sujet, tel que la personne le nomme.
- **Règle** : une règle métier, formulée comme une phrase vraie.
- **Exemple** : un cas concret, avec ses valeurs, qui illustre la règle. Son titre dit la situation et le résultat attendu.
- Les titres sont écrits dans la langue des textes du projet (français par défaut) ; les noms de fonctions et de méthodes suivent `qualite/clean-code.md` §2 (anglais).
- Correspondance avec les outils : fonctionnalité et règle deviennent des groupes de tests imbriqués, l'exemple devient le test.

## 3. Le corps du test : Étant donné / Quand / Alors

Chaque test a trois parties, dans cet ordre, séparées visuellement :

| Partie | Rôle | Équivalent |
|---|---|---|
| **Étant donné** (*Given*) | La situation de départ, observable | *Arrange* |
| **Quand** (*When*) | L'action déclenchée, une seule | *Act* |
| **Alors** (*Then*) | Le résultat observable attendu | *Assert* |

- **Un comportement par test.** Plusieurs assertions sont permises si elles vérifient le même résultat (les champs d'un même objet, le message et le code d'une même erreur). Deux comportements différents font deux tests.
- **Une seule action** dans « Quand ». Deux actions successives racontent deux histoires, ou une histoire dont la première action fait partie de la situation de départ.
- Pas de condition ni de boucle dans un test : chaque cas a son propre exemple.

## 4. L'objet SUT : un test qui se lit comme une phrase

Pour qu'un test reste lisible, ses détails techniques vont dans un **objet de test** (SUT) créé à neuf pour chaque test. Il expose des méthodes nommées comme des phrases :

| Méthode | Rôle | Exemple de nom |
|---|---|---|
| `given…` | Installe la situation de départ | `givenInvoice(invoice)`, `givenToday(date)` |
| `when…` | Déclenche l'action testée | `whenOverdueStatusIsChecked()` |
| `then…` | Vérifie le résultat attendu | `thenInvoiceIsOverdue()`, `thenErrorIs("INVALID_EMAIL")` |

```
fonctionnalité "Relance des factures"
  règle "Une facture non payée après son échéance est en retard"
    AVANT CHAQUE TEST : sut = createSut()

    exemple "Facture échue hier et non payée : elle est en retard"
      // Étant donné
      sut.givenToday("2026-03-10")
      sut.givenInvoice(anInvoice().withDueDate("2026-03-09").withStatus(SENT))
      // Quand
      sut.whenOverdueStatusIsChecked()
      // Alors
      sut.thenInvoiceIsOverdue()

fonction createSut() :
  today, invoice, result          // l'état du test vit ici, et nulle part ailleurs

  RETOURNER {
    givenToday(date)       : today = date
    givenInvoice(i)        : invoice = i
    whenOverdueStatusIsChecked() : result = isOverdue(invoice, today)   // code de production
    thenInvoiceIsOverdue() : VÉRIFIER result ÉGAL vrai
  }
```

- **Tout l'état du test dans le SUT** : rien de global, rien de partagé entre deux tests.
- **Un SUT neuf par test** (créé avant chaque test).
- **Règle d'exhaustivité** : une méthode `given…` ou `when…` utilise **tous** ses paramètres, et les objets passés le sont **en entier**. Un paramètre ignoré tromperait la personne qui lit le test.
- Les méthodes sont **asynchrones** quand le code testé l'est : le test attend chaque étape.
- Le SUT est utile dès qu'un test demande de la préparation. Pour une fonction pure à une ligne, un test direct (appel puis assertion) reste plus clair.
- Pour un test d'intégration, le SUT prépare aussi les ressources réelles et les nettoie : `tests/integration.md` §3.

## 5. Z.O.M.B.I.E.S : la liste des cas à couvrir

Pour chaque règle, parcourir la liste et écrire un exemple pour chaque cas pertinent. C'est aussi l'ordre conseillé en TDD (`tests/tdd.md` §4).

| Lettre | Cas | Exemples |
|---|---|---|
| **Z** – Zéro | Rien, vide, absent | Liste vide, valeur absente, zéro, chaîne vide, paramètre obligatoire manquant |
| **O** – Un (*One*) | Le plus petit cas non vide | Un seul élément, la plus petite entrée valide |
| **M** – Plusieurs (*Many*) | Le cas réaliste | Plusieurs éléments, plusieurs conditions combinées, un volume réaliste |
| **B** – Limites (*Boundary*) | Les bords | Seuil exact, juste en dessous, juste au-dessus, longueur maximale, premier et dernier jour |
| **I** – Interface | Le contrat | Forme du résultat, format des erreurs, ce que la fonction promet à ses appelants |
| **E** – Exceptions | Ce qui doit échouer | Entrée invalide ou malformée, droit refusé, service indisponible, délai dépassé, ressource épuisée |
| **S** – Simple | La façon de l'écrire | Scénarios simples, préparation minimale, un comportement par test |

## 6. Données de test

**Ce qui compte pour l'exemple apparaît dans le test ; le reste vient des valeurs par défaut.**

Un **constructeur de données** produit un objet complet et valide, et chaque méthode `with…` change un seul champ :

```
// invoice.fixtures
fonction anInvoice() :
  data = {
    id: "invoice-001",
    customerEmail: "client@exemple.fr",
    amount: 120.00,
    dueDate: "2026-03-01",
    status: SENT
  }
  RETOURNER {
    withDueDate(d) : data.dueDate = d ; RETOURNER ce constructeur
    withStatus(s)  : data.status = s  ; RETOURNER ce constructeur
    build()        : RETOURNER copie(data)
  }

// Dans le test : seul le détail utile à l'histoire est visible
sut.givenInvoice(anInvoice().withStatus(PAID).build())
```

- Chaque appel produit **un objet neuf** : un test qui modifie ses données n'affecte pas les autres.
- Valeurs **réalistes mais simples**, écrites en dur, sans donnée personnelle réelle.
- **DAMP plutôt que DRY** : dans un test, la clarté prime sur la factorisation. On factorise la mécanique (constructeurs, SUT), et l'histoire reste écrite en entier dans chaque test.
- Emplacement des données partagées : `qualite/organisation.md` §7.
- Base de données de test : remise à zéro ou transaction annulée après chaque test, et données de départ propres à chaque scénario.

## 7. Assertions

- **Vérifier le résultat observable** : valeur retournée, état enregistré, message affiché, appel fait à une frontière. L'état interne et les fonctions privées restent hors du test.
- **Comparer l'objet entier** quand le résultat est un objet : l'objet attendu, construit avec le même constructeur de données, révèle aussi les champs inattendus. Pour une valeur imprévisible (identifiant généré), la fixer par injection, ou utiliser le comparateur « n'importe quelle valeur de ce type » de l'outil.
- **Comparateur adapté** : égalité stricte pour une valeur simple, égalité de contenu pour un objet ou une liste, comparateur dédié pour une erreur attendue.
- **Message d'échec utile** : le nom du test et l'assertion suffisent pour comprendre ce qui est cassé, sans relancer en mode débogage.

## 8. Doublures

### Où doubler

**Aux frontières, et seulement là.** Le code du projet tourne réellement ; ce qui sort du projet est remplacé.

| Doubler | Garder réel |
|---|---|
| Réseau, services tiers, envoi d'e-mails, paiement | Les règles métier et calculs du projet |
| Horloge, hasard, identifiants générés | Les modules du projet qui collaborent entre eux |
| Base de données et fichiers, **en test unitaire** | La base de test et les fichiers temporaires, **en test d'intégration** |
| Un service qui permet de provoquer une erreur rare (panne, délai dépassé) | Une dépendance simple et rapide, déjà fiable |

Trop de doublures rendent les tests fragiles : ils vérifient alors comment le code est écrit plutôt que ce qu'il fait. Si un test a besoin de nombreuses doublures, c'est un signal de couplage (`qualite/clean-code.md` §5).

### Les cinq sortes

| Sorte | Ce qu'elle fait | Usage typique |
|---|---|---|
| **Factice** (*dummy*) | Remplit un paramètre, jamais utilisée | Un paramètre obligatoire sans rapport avec l'histoire |
| **Bouchon** (*stub*) | Renvoie une réponse préparée | « Le service de taux de change renvoie 1,08 » |
| **Espion** (*spy*) | Enregistre les appels reçus | Vérifier qu'un e-mail a été demandé, avec quels arguments, combien de fois |
| **Simulacre** (*mock*) | Programmé avec des attentes, échoue si elles ne sont pas remplies | Un échange précis avec une frontière, quand l'ordre ou le détail des appels fait partie du contrat |
| **Faux** (*fake*) | Implémentation simplifiée qui fonctionne vraiment | Dépôt en mémoire à la place de la base |

- Préférer, dans cet ordre : **faux** et **bouchon** (on vérifie le résultat), puis **espion** (on vérifie un effet), puis **simulacre** (on vérifie un échange précis).
- Les doublures sont **remises à zéro avant chaque test** (ou recréées par le SUT).
- La doublure entre par la porte : le code reçoit sa dépendance en paramètre ou à la construction (`qualite/clean-code.md` §5), ce qui évite de remplacer des modules entiers par l'outil de test.

## 9. Préparation et nettoyage

- **Avant chaque test** : SUT neuf, données neuves, doublures remises à zéro.
- **Une seule fois pour le groupe** : seulement une ressource coûteuse à démarrer et que les tests ne modifient pas (conteneur de base de données, serveur de test). Chaque test nettoie quand même ses propres données (transaction annulée, tables vidées).
- **Après chaque test** : supprimer fichiers temporaires, connexions ouvertes, minuteries, données créées.
- **Code asynchrone** : le test attend la fin de chaque opération. Pour un état qui arrive plus tard, attendre une condition observable avec un délai maximal ; les pauses de durée fixe rendent le test lent et instable.

## 10. Erreurs attendues

« Quand » déclenche l'action ; « Alors » vérifie le type ou le code de l'erreur et son message. Si l'erreur doit être journalisée, un espion sur le journal le vérifie.

```
exemple "Adresse e-mail sans arobase : la création est refusée"
  sut.givenUserData(aUser().withEmail("adresse-invalide").build())
  sut.whenUserCreationIsAttempted()
  sut.thenCreationFailsWith("INVALID_EMAIL_FORMAT")
  sut.thenNoUserIsSaved()
```

## 11. Signaux d'alerte

| Signal | À faire |
|---|---|
| Le test lit une variable interne ou appelle une fonction privée | Vérifier le résultat visible : valeur retournée, texte affiché, effet à la frontière |
| Le test casse quand on renomme ou réorganise le code sans changer le comportement | Remonter l'assertion au niveau du comportement métier |
| Cinquante lignes de préparation | Déplacer la mécanique dans le SUT et les constructeurs de données ; si elle reste lourde, redécouper le code testé |
| Un test utilise ce qu'un autre a créé | Chaque test prépare ses propres données |
| Le test passe ou échoue selon l'heure, la machine ou l'ordre | Fixer horloge, hasard et fuseau ; isoler l'état ; remplacer les pauses fixes par l'attente d'une condition |
| Le test n'a jamais été vu échouer | Le faire échouer une fois (assertion inversée ou code cassé exprès) pour prouver qu'il vérifie quelque chose |
| Le titre dit « devrait fonctionner » | Titre qui dit la situation et le résultat : « Facture échue hier et non payée : elle est en retard » |
| Doublures partout, même sur le code du projet | Doubler seulement aux frontières (§8) |

## 12. Liste de contrôle

Avant d'écrire :
- [ ] Le comportement à prouver est formulé en une phrase métier.
- [ ] Le niveau de test est choisi : le plus bas qui suffit à le prouver (`tests/strategie.md` §2).
- [ ] Les cas Z.O.M.B.I.E.S pertinents sont listés.
- [ ] Les données et doublures nécessaires sont identifiées.

En écrivant :
- [ ] Fonctionnalité / Règle / Exemple, titres en langage métier.
- [ ] Étant donné / Quand / Alors, une seule action, un comportement par test.
- [ ] SUT neuf par test dès qu'il y a de la préparation ; tous les paramètres utilisés.
- [ ] Doublures aux frontières seulement.
- [ ] Cas nominal **et** cas refusés.

Après :
- [ ] Chaque test a été vu échouer pour la bonne raison.
- [ ] La suite passe, dans n'importe quel ordre, et reste rapide.
- [ ] Les règles métier et parcours critiques sont couverts (`tests/strategie.md` §3).
- [ ] Un scénario de test inhabituel porte un commentaire qui explique pourquoi.

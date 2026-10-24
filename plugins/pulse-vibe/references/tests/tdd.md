# Développement piloté par les tests (TDD)

En TDD, le test s'écrit **avant** le code qu'il vérifie. On sait ainsi qu'il vérifie vraiment quelque chose (on l'a vu échouer), et le code écrit est juste celui que le métier demande. Règles communes d'écriture : `tests/ecrire-un-test.md`.

## 1. Le cycle : rouge, vert, remaniement

| Étape | Ce qu'on fait | Fin de l'étape |
|---|---|---|
| **Rouge** | Écrire **un** exemple (les 5 étapes du §2), le lancer | Il échoue, **pour la bonne raison** : le comportement manque (et non une faute de frappe ou un import cassé) |
| **Vert** | Écrire le code de production **le plus simple** qui le fait passer | Ce test et tous les autres passent |
| **Remaniement** | Améliorer le code (et le test) sans changer le comportement : noms, duplication, découpage (`qualite/clean-code.md`) | Tous les tests passent toujours |

Puis exemple suivant, dans l'ordre Z.O.M.B.I.E.S (§4). Chaque tour dure quelques minutes.

## 2. Les 5 étapes pour écrire un exemple

On écrit le test **à rebours** : d'abord l'histoire, puis le résultat attendu, puis l'action, enfin la situation de départ. Chaque étape crée seulement ce que la suivante exige. Le résultat : l'exemple et le SUT de `tests/ecrire-un-test.md` §4.

### Étape 1 : raconter l'histoire avec un exemple concret

En une phrase, avec des valeurs réelles : la **situation de départ** (l'état observable avant l'action), l'**événement déclencheur** (l'action faite sur le système), la **situation finale** (le résultat observable attendu). « Le 10 mars, une facture échue le 9 mars et non payée est en retard. »

### Étape 2 : écrire l'histoire en code DAMP

Le corps du test se lit comme la phrase de l'étape 1 : `sut.givenToday("2026-03-10")`, `sut.givenInvoice(…)`, `sut.whenOverdueStatusIsChecked()`, `sut.thenInvoiceIsOverdue()`. Les méthodes du SUT n'existent pas encore : on les nomme d'abord comme on aimerait les lire. Les détails techniques vont dans le SUT, hors du corps du test.

### Étape 3 : écrire le « Alors » avec la valeur attendue en dur

On commence par la fin. La méthode `then…` compare le résultat à la valeur attendue, **écrite en dur** et **complète** : l'objet entier plutôt qu'un extrait (`tests/ecrire-un-test.md` §7).

### Étape 4 : relier le « Quand » au « Alors »

La méthode `when…` appelle le code de production et range le résultat là où `then…` le lit. Elle utilise **tous** ses paramètres. Le code de production peut commencer par renvoyer directement la valeur attendue (premier tour : `fonction isOverdue(invoice, today) : RETOURNER vrai`) : les exemples suivants l'obligeront à se généraliser.

### Étape 5 : relier le « Étant donné » au « Quand »

Les méthodes `given…` installent exactement l'état dont l'action a besoin. Elles utilisent **tous** les paramètres reçus, et les objets **en entier**.

Le test est complet : on le lance, il doit échouer ou passer pour une raison comprise, puis on poursuit le cycle (§1).

## 3. Faire grandir le code par les exemples

- Le premier exemple se contente d'une valeur en dur.
- L'exemple suivant **contredit** cette valeur (« facture payée : pas en retard ») et oblige à écrire la vraie règle.
- On ajoute un exemple par cas de la liste Z.O.M.B.I.E.S jusqu'à ce que le code soit général. Un nouvel exemple qui passe sans rien changer documente un cas : on le garde s'il apporte une information.

```
// Après les exemples « payée » et « échéance aujourd'hui »
fonction isOverdue(invoice, today) :
  RETOURNER invoice.dueDate < today ET invoice.status != InvoiceStatus.PAID
```

## 4. Ordre des exemples : Z.O.M.B.I.E.S

L'ordre de la liste (détail de chaque cas : `tests/ecrire-un-test.md` §5), ici pour les relances de factures :

1. **Zéro** : aucune facture à examiner, liste de relances vide.
2. **Un** : une facture en retard, une relance.
3. **Plusieurs** : plusieurs factures, certaines en retard : relances pour celles-là seulement.
4. **Limites** : échéance aujourd'hui, échéance hier.
5. **Interface** : forme exacte de la relance renvoyée.
6. **Exceptions** : facture sans date d'échéance, erreur claire.

**Simple**, tout au long : scénarios courts, un comportement par exemple.

## 5. Règles clés

- **À rebours** (Alors → Quand → Étant donné), avec les règles communes : histoire d'abord avec les mots du glossaire, DAMP, exhaustivité des paramètres (`tests/ecrire-un-test.md` §2, §4 et §6).
- **Indépendance vis-à-vis de l'implémentation** : un remaniement du code laisse les tests intacts. Si un test casse alors que le comportement est le même, il vérifiait l'implémentation : le réécrire au niveau du comportement.
- **Un défaut trouvé = un test d'abord** : on écrit l'exemple qui reproduit le défaut, on le voit échouer, puis on corrige.

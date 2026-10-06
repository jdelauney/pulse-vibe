# Scénarios Gherkin

Un scénario Gherkin décrit un comportement attendu **en langage métier**, avec un exemple concret : une situation de départ, une action, un résultat observable. Il se lit sans savoir programmer, et il se traduit directement en test (`tests/ecrire-un-test.md` §2 et §3).

Dans Pulse, les scénarios s'écrivent dans la spec (section « Scénarios »). Ils servent à trois choses : la personne valide le comportement avant le code, le test-writer en tire un test par exemple, et le test manuel les reprend. C'est un **format de spécification** : aucun outil d'exécution Gherkin n'est imposé, et le test-writer les traduit dans l'outil de test retenu.

## 1. Les mots-clés en français

| Mot-clé | Rôle | Correspond dans le test à |
|---|---|---|
| `Fonctionnalité:` | Le sujet, une par spec (le titre de l'US) | Groupe de tests de premier niveau |
| `Règle:` | Une règle métier de l'US, formulée comme une phrase vraie | Groupe de tests imbriqué |
| `Exemple:` | Un cas concret qui illustre la règle (synonyme : `Scénario:`) | Un test |
| `Contexte:` | Les étapes « Étant donné » communes à tous les exemples d'une règle | Préparation avant chaque test |
| `Étant donné` | La situation de départ | `given…` |
| `Quand` | L'action, une seule | `when…` |
| `Alors` | Le résultat observable | `then…` |
| `Et`, `Mais` | Prolongent l'étape précédente | Même type que l'étape prolongée |
| `Plan du scénario:` + `Exemples:` | Le même scénario avec plusieurs jeux de valeurs (tableau) | Un test par ligne du tableau |

## 2. Écrire un bon scénario

- **Déclaratif, pas impératif** : dire *ce qui se passe* pour l'utilisateur, plutôt que *comment il clique*. « Quand Camille enregistre une facture sans montant » plutôt que « Quand je clique sur le champ montant, que je le vide et que je clique sur #save ». Le scénario reste vrai si l'écran change.
- **Des données concrètes et fictives**, tirées du domaine du projet : « une facture de 120 € échue le 9 mars », plutôt que « une facture en retard ».
- **Les mots du glossaire** (`aidd_docs/memory/glossary.md`), dans le même sens partout.
- **Un comportement par exemple** : une seule étape `Quand` ; `Alors` décrit un seul résultat, éventuellement prolongé par `Et` s'il s'agit du même résultat (le message et la liste mise à jour).
- **Court** : 3 à 6 étapes. Un scénario plus long cache souvent deux comportements.
- **Titre de l'exemple = situation et résultat** : « Facture échue hier et non payée : elle est en retard ».
- **Observable** : `Alors` décrit ce que l'utilisateur voit ou obtient (un message, une liste, un refus, un e-mail reçu), jamais l'état interne du code.

## 3. Choisir les exemples

Pour chaque règle, parcourir la liste Z.O.M.B.I.E.S (`tests/ecrire-un-test.md` §5) et garder les exemples qui apprennent quelque chose :

- le **cas nominal** (toujours) ;
- les **limites** : seuil exact, juste avant, juste après ;
- les **cas refusés** : saisie invalide, droit refusé, ressource absente ;
- le cas **vide** quand il a un sens pour l'utilisateur (liste vide, premier usage).

Viser **2 à 5 exemples par règle**. Plusieurs valeurs pour un même comportement : un `Plan du scénario` avec un tableau, plutôt que des exemples recopiés.

## 4. Étiquettes

Chaque exemple porte, sur la ligne du dessus, des étiquettes qui le relient au reste de la méthode :

| Étiquette | Sens |
|---|---|
| `@US-003-1` | Illustre le critère d'acceptation n° 1 de l'US-003 (au moins une par exemple) |
| `@unitaire`, `@integration`, `@bout-en-bout` | Niveau de test automatique prévu, selon `tests/strategie.md` §2 |
| `@manuel` | Vérifié par le test manuel seulement (rendu visuel, confort, parcours non automatisé) |
| `@securite` | Règle d'accès ou de protection (checklist S1 à S12) |

Chaque critère d'acceptation de l'US est couvert par au moins un exemple.

## 5. Exemple complet

```gherkin
# language: fr
Fonctionnalité: Relance des factures en retard

  Règle: Une facture non payée après son échéance est en retard

    @US-003-1 @unitaire
    Exemple: Facture échue hier et non payée : elle est en retard
      Étant donné nous sommes le 10 mars 2026
      Et une facture de 120 € pour « Atelier Dupont », échue le 9 mars 2026, envoyée et non payée
      Quand on consulte les factures en retard
      Alors la facture de « Atelier Dupont » apparaît comme en retard

    @US-003-2 @unitaire
    Plan du scénario: Une facture n'est pas en retard tant qu'elle est payée ou pas encore échue
      Étant donné nous sommes le 10 mars 2026
      Et une facture échue le <échéance>, au statut <statut>
      Quand on consulte les factures en retard
      Alors la facture n'apparaît pas comme en retard

      Exemples:
        | échéance      | statut  |
        | 9 mars 2026   | payée   |
        | 10 mars 2026  | envoyée |

  Règle: Seul le propriétaire du compte voit ses factures

    @US-003-3 @integration @securite
    Exemple: Une autre personne connectée ne voit pas les factures de Camille
      Étant donné Camille a une facture pour « Atelier Dupont »
      Et Léo est connecté avec son propre compte
      Quand Léo demande la liste des factures
      Alors la facture de Camille n'y figure pas
```

## 6. Du scénario au test

| Gherkin | Test (`tests/ecrire-un-test.md`) |
|---|---|
| `Fonctionnalité` / `Règle` / `Exemple` | Groupes de tests imbriqués et test, avec les mêmes titres |
| `Étant donné …` | `sut.given…(…)`, avec les valeurs du scénario |
| `Quand …` | `sut.when…()` |
| `Alors …` | `sut.then…(…)` |
| Ligne de `Exemples:` | Un test par ligne |
| `@unitaire` / `@integration` / `@bout-en-bout` | Fichier de test du niveau correspondant (`qualite/organisation.md` §7) |
| `@manuel` | Une étape de la fiche de test manuel (`tests/test-manuel.md`) |

Si un scénario ne peut pas devenir un test tel quel (valeur imprécise, résultat non observable), c'est le scénario qui se précise, dans la spec, avec la personne si cela touche au besoin.

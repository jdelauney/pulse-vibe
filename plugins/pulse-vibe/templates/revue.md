# Revue – {{TACHE}} – {{DATE}}

**Verdict** : ✅ Validé | ⚠️ À corriger | ⛔ Bloquant
**Mode** : {{/pulse:review | /pulse:implement | /pulse:spirc avec points de validation | /pulse:spirc autonome}}{{ · contrôle de sécurité à chaque tâche}}

## Critères d'acceptation

| Critère | Résultat | Commentaire |
|---|---|---|
| | ✅ / ❌ / ❓ à tester à la main | |

## Vérification

<!-- Verdict et tableau du verifier : chaque critère essayé sur l'application en marche. -->

- **Verdict** : {{✅ Prouvé | ❓ Partiellement prouvé | ❌ Échoue}}

| Critère | Attendu | Obtenu | Résultat | Preuve |
|---|---|---|---|---|
| | | | ✅ / ❌ / ❓ à tester à la main | |

## Tests automatiques

<!-- Seulement avec les tests d'abord (option -t) ; sinon supprimer cette section, avec ce commentaire. Verdicts et tableaux du test-runner. -->

- **Rouge** : {{🔴 Rouge confirmé · n tests}}
- **Vert** : {{✅ Vert · n réussis · tests figés intacts}}

| Critère | Tests | Résultat |
|---|---|---|
| | | ✅ / ❌ / non couvert |

## Sécurité

| Point | Résultat | Détail |
|---|---|---|
| S1 Secrets | ✅ / ⚠️ / ⛔ / — | |

## Qualité et lisibilité

- …

## Adéquation au besoin

- ✅ conforme à l'intention / écart constaté : …

## Fidélité au design

- — (pas de docs/design.md ni de maquette) / ✅ conforme / ⚠️ écart : …

## Constats

1. 🔴 Critique / 🟠 Haute / 🟡 Moyenne / 🔵 Basse {{problème}} — {{fichier:ligne}} — {{Corriger / Remplacer / Valider ...}}

**Blocage** : {{aucun | persiste après 2 cycles : /pulse:get-help}}

## Suite donnée aux constats

<!-- Rempli par la commande après la relecture. -->

| Constat | Décision | Raison |
|---|---|---|
| {{n°}} | corrigé / écarté / reporté (« En attente » du PRD) / laissé à la demande de la personne | {{pour un constat Basse : ce que le code montre}} |

## Test manuel à faire par vous

1. …

## Test par la personne

<!-- Rempli après le test manuel. -->

- **Date** : {{AAAA-MM-JJ}}
- **Résultat** : ✅ concluant | ❌ non concluant | ⏳ reporté au test groupé de fin de plan (mode autonome)
- **Remarque** : {{ce qui n'allait pas, ou « aucune »}}

# User stories – {{NOM_DU_PROJET}}

> Produit par `/pulse:us` le {{DATE}} à partir de `docs/prd.md`.
> Ce fichier est le **référentiel** des user stories : leur découpage par epic, leur priorité et l'ordre du parcours.
> Le détail de chaque US (règles métier, exemple, critères d'acceptation) est dans son propre fichier : `aidd_docs/tasks/<epic>/US-XXX-<nom>.md`. Sa spec (`SPEC-US-XXX-<nom>.md`) et son plan (`PLAN-SPEC-US-XXX-<nom>.md`) sont rangés à côté.
> Une **epic** regroupe les US d'un même grand besoin (ex. « Gérer les demandes »). Son dossier porte son nom court : minuscules, sans accent, mots séparés par des tirets.
> Identifiants : `US-001`, `US-002`… uniques dans tout le projet, attribués une seule fois.
> Priorités : **Indispensable** (le MVP) · **Essentiel** · **Optionnel** · **En attente** (hors périmètre pour l'instant).
> Taille : **S** (une tâche) · **M** (2 ou 3 tâches) · **L** (à découper avant la spec).

## Epics

| Epic | Dossier | Objectif | US |
|---|---|---|---|
| {{Titre de l'epic}} | `aidd_docs/tasks/{{epic}}/` | {{le grand besoin couvert, en une phrase}} | {{US-001 à US-003}} |

## Parcours utilisateur

{{Les US Indispensables dans l'ordre où l'utilisateur les vit, en une ligne : US-001 → US-002 → US-003. La dernière clôt le MVP.}}

## Ordre de réalisation

> L'ordre dans lequel les US se spécifient et se réalisent : d'abord ce dont les autres dépendent, puis par priorité (Indispensable, Essentiel, Optionnel), puis dans l'ordre du parcours.

{{US-001 → US-002 → US-004 → US-003 …}}

---

## Epic – {{Titre de l'epic}} (`{{epic}}`)

> {{Objectif de l'epic en une phrase.}}

| ID | Titre | Acteur | Priorité | Taille | Dépend de | Fichier |
|---|---|---|---|---|---|---|
| US-001 | {{Titre court}} | {{acteur}} | Indispensable | S | — | [US-001-{{nom}}.md](../aidd_docs/tasks/{{epic}}/US-001-{{nom}}.md) |
| US-00n | {{Titre court}} | {{acteur}} | Optionnel | S | — | — (détaillée lors de sa spec) |

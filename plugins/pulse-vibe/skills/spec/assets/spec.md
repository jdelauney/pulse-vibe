# Spécification – {{NOM_DU_PROJET}} – US-{{XXX}} {{Titre court}}

> Produit par `/pulse:spec` le {{DATE}} à partir de `US-{{XXX}}-{{nom}}.md` (même dossier) et de `docs/prd.md`.
> Une spec par user story. Groupe : {{Titre du groupe}} (`aidd_docs/tasks/{{epic}}/`) · Plan associé : `PLAN-SPEC-US-{{XXX}}-{{nom}}.md` (même dossier).
> La spec décrit **ce que** l'outil doit permettre, du point de vue de l'utilisateur. Le **comment** (pile, stockage, fichiers) est décidé dans le plan.
> Une question sans réponse s'écrit `TBD: <question précise>` à l'endroit concerné. Une spec verrouillée se lit sans se réécrire : un changement passe par une nouvelle US et sa spec.

**Statut** : {{brouillon | verrouillée le AAAA-MM-JJ | remplacée par US-YYY le AAAA-MM-JJ}}

## 1. Intention

- **Ce que l'utilisateur pourra faire** : {{une phrase}}
- **User story** : US-{{XXX}} – {{titre}} (et, si elle vient d'une demande, la demande d'origine en une phrase)
- **S'appuie sur** : {{specs déjà écrites dont on réutilise écrans, informations ou règles (`aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`), ou « aucune »}}
- **Remplace ou complète** : {{spec verrouillée que celle-ci fait évoluer (`SPEC-US-XXX-<nom>.md`), ou « aucune »}}

## 2. Périmètre

**Inclus**
- {{ce que l'utilisateur pourra faire grâce à cette spec}}

**Hors objectifs** (volontairement exclus)
- {{ce qui est exclu, et où c'est noté : autre US, « En attente » dans le PRD}}

## 3. Ce que l'utilisateur voit et fait

| Écran | Qui y accède | Ce qu'on y voit | Ce qu'on y fait |
|---|---|---|---|
| | | | |

**Situations à prévoir** : en attente {{…}} · rien à afficher {{…}} · échec {{…}} · sur téléphone {{…}}

**Parcours principal**

```mermaid
flowchart LR
    A[{{Écran A}}] -->|{{action}}| B[{{Écran B}}]
    B -->|{{action}}| C[{{Résultat visible}}]
```

## 4. Informations manipulées

Pour chaque type d'information, en mots du métier :

### {{Nom du type d'information}}

| Information | Obligatoire | Règle | Exemple |
|---|---|---|---|
| | | | |

**Qui peut** : consulter {{…}} · ajouter {{…}} · modifier {{…}} · supprimer {{…}}

## 5. Règles métier

- {{Règle reprise de l'US, en une phrase vraie}} — US-{{XXX}}

## 6. Scénarios

> Le comportement attendu, en exemples concrets, au format Gherkin (référence « Scénarios Gherkin »). Chaque critère d'acceptation de l'US est illustré par au moins un exemple. Ils servent au test manuel et, si le projet a des tests automatiques, à l'écriture des tests.

```gherkin
# language: fr
Fonctionnalité: {{titre de l'US}}

  Règle: {{règle métier de l'US, en une phrase vraie}}

    @US-{{XXX}}-1 @{{unitaire | integration | bout-en-bout | manuel}}
    Exemple: {{situation : résultat attendu}}
      Étant donné {{situation de départ, avec des données fictives du domaine}}
      Quand {{action, une seule}}
      Alors {{résultat visible}}
```

## 7. Données personnelles et accès (obligatoire)

1. **Quelles données personnelles sont nécessaires ?** {{liste, ou « aucune »}} — chacune justifiée par un besoin de l'US.
2. **Qui a le droit de voir quoi ?** {{par rôle d'utilisateur}}
3. **Que vit l'utilisateur qui remplit mal un formulaire ?** {{résultat attendu, ex. un message clair, rien n'est enregistré}}

## 8. Ajouts proposés par Pulse

Ce que cette spec ajoute au-delà de l'US et du PRD, au niveau du besoin. Chaque ligne est validée par la personne.

| Détail | Proposition | Pourquoi ça compte | Décision |
|---|---|---|---|
| {{ex. suppression}} | {{ex. demander une confirmation avant de supprimer}} | {{ex. une suppression par erreur ne se rattrape pas}} | {{accepté · refusé}} |

## 9. Terminé quand

- {{résultat observable par l'utilisateur, ex. « une cliente retrouve ses rendez-vous à venir, du plus proche au plus lointain »}}
- {{2 à 4 résultats au plus}}

## 10. Questions en suspens

- {{chaque `TBD:` de la spec, repris ici ; « aucune » pour une spec verrouillée}}

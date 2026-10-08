# Plan – {{NOM_DU_PROJET}} – US-{{XXX}} {{Titre court}}

> Produit par `/pulse:plan` le {{DATE}} à partir de `SPEC-US-{{XXX}}-{{nom}}.md` (même dossier, verrouillée) et de `docs/technical.md`.
> La spec dit **ce que** l'utilisateur obtient ; ce plan décide **comment** le construire (« Conception technique »), puis le découpe en tâches.
> Un plan par spec, donc par user story. Numéros de tâche uniques dans tout le projet : ce plan reprend après le plus grand `Tn` des autres plans de `aidd_docs/tasks/`.
> La tâche « Mettre en ligne le MVP » figure uniquement dans le plan de la **dernière US Indispensable du parcours** (`docs/user-stories.md`).
> Statuts : `[ ]` à faire · `[~]` en cours · `[x]` terminé : c'est le tableau de suivi des tâches.
> Chaque tâche est petite (une seule chose visible à tester) et livre de la valeur (découpage vertical).

## Vue d'ensemble

- **US** : US-{{XXX}} – {{titre}} · **Epic** : {{Titre de l'epic}} · **Priorité** : {{Indispensable | Essentiel | Optionnel}}
- **Tâches** : {{nombre}} ({{Tn}} à {{Tm}})
- **S'appuie sur** : {{plans d'autres US dont des tâches doivent être terminées avant (US-XXX), ou « aucun »}}
- **Envoi** : à choisir (au premier commit, s'il existe un dépôt distant : PR, branche principale ou local)
- **En parallèle avec** : {{US-YYY, US-ZZZ (US non terminées qui peuvent avancer en même temps, dans une autre session et un worktree), ou « aucune »}}

## Ordre des tâches

```mermaid
flowchart LR
    T1[{{T1 – titre court}}] --> T2[{{T2 – titre court}}]
```

## Avant de commencer

- {{Comptes à créer, accès à obtenir ; ou « rien »}}

## Conception technique

> D'après « Pile retenue », « Organisation des fichiers », « Données et contrôle d'accès » et « Secrets et variables d'environnement » de `docs/technical.md` : y renvoyer plutôt que les recopier.

### Pile et services

| Élément | Choix | Pourquoi (en une phrase) |
|---|---|---|
| Pile | {{reprise de « Pile retenue »}} | |
| Données | {{stockage retenu}} | |
| Services externes | {{aucun, ou ceux de « Pile retenue » et leur usage dans cette US}} | |

### Écrans

| Écran de la spec | Adresse | Public ou réservé | Référencement (écran public) |
|---|---|---|---|
| | | | {{titre, description (docs/seo.md, ou « à valider avec /pulse:seo textes »), indexé oui / non ; sinon « sans objet »}} |

Maquette : {{docs/design/maquettes/US-XXX-<nom>/retenue/ | aucune}} · Design : {{docs/design.md | aucun}}

### Données

Pour chaque type d'information de la spec :

#### {{Nom du type d'information}}

**Stockée** : {{sur l'appareil / dans une base / dans des fichiers}}

| Champ | Type | Obligatoire | Contrainte |
|---|---|---|---|
| | | | |

**Contrôle d'accès vérifié** : {{côté serveur / dans la base / sans objet}}, selon « Qui peut » de la spec

**Liens entre les informations** (si plusieurs types) :

```mermaid
erDiagram
    {{TYPE_A}} ||--o{ {{TYPE_B}} : "{{verbe, ex. possède}}"
```

### Où chaque règle est vérifiée

| Règle de la spec | Où (base / serveur ; navigateur en plus) |
|---|---|
| | |

### Sécurité

- **Secrets** : {{nom de chaque variable, côté serveur ou public ; ou « aucun »}}
- **Formulaires** : {{contrôles côté serveur qui produisent le résultat décrit dans la spec}}
- **Checklist** : {{identifiants S1 à S13 qui s'appliquent}}

### Fichiers

Organisation générale : voir « Organisation des fichiers » dans `docs/technical.md`.

| Fichier | À créer / à modifier | Rôle |
|---|---|---|
| | | |

## Tâches

> US terminée quand : {{ce que l'utilisateur peut faire de bout en bout}}.

- [ ] **T1 – {{Titre}}** · US-{{XXX}}
  - Objectif : {{ce que l'utilisateur pourra faire à la fin de la tâche}}
  - Dépend de : {{Tn, ou « — »}}
  - Fichiers : {{à créer : … · à modifier : …}}
  - Vérification : US-{{XXX}} critère {{n}} – {{ce qu'on fait et ce qu'on doit voir}}
  - Tests : {{scénarios de la spec réalisés par la tâche et leur niveau, ex. « Facture échue hier et non payée : elle est en retard » (unitaire) ; ou « aucun »}}
  - Attention : {{point délicat de la tâche (cas limite, donnée partagée, règle d'accès) ; sinon supprimer cette ligne}}
  - Action manuelle : {{seulement si la personne doit agir elle-même, ex. appliquer un schéma dans la console du fournisseur, saisir une variable chez l'hébergeur ; sinon supprimer cette ligne}}

<!-- Tâche suivante : seulement dans le plan de la dernière US Indispensable du parcours ; sinon la supprimer, avec ce commentaire. -->
- [ ] **T2 – Mettre en ligne le MVP** · —
  - Objectif : l'outil est accessible à une adresse publique
  - Dépend de : toutes les tâches des US Indispensables
  - Vérification : l'adresse s'ouvre sur un téléphone et le parcours principal fonctionne

## Ajouts proposés par Pulse

<!-- Seulement si la conception ou une tâche introduit un élément absent de la spec et de « Pile retenue », ou exigé par la sécurité ; sinon supprimer cette section, avec ce commentaire. -->

| Détail | Proposition | Pourquoi ça compte | Tâche | Décision |
|---|---|---|---|---|
| {{ex. mots de passe}} | {{ex. les enregistrer sous une forme illisible (hachage)}} | {{ex. une fuite de la base ne révélerait aucun mot de passe}} | {{Tn}} | {{accepté · refusé · exigé par la sécurité}} |

## Points d'attention

| Risque | Tâche | Ce qu'on prévoit |
|---|---|---|
| {{ou « aucun identifié »}} | | |

## Journal

> Une ligne par événement (règles communes § 7) : tâche enregistrée, plan validé ou modifié, correction, annulation, test groupé. La remarque est obligatoire pour un mode autonome, un test reporté ou non concluant, une relecture absente ou un constat laissé sans correction.

| Date | Tâche | Commit | Remarque (écart, limite connue, idée pour plus tard) |
|---|---|---|---|

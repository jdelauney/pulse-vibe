# Spécification – {{NOM_DU_PROJET}} – US-{{XXX}} {{Titre court}}

> Produit par `/pulse:spec` le {{DATE}} à partir de `US-{{XXX}}-{{nom}}.md` (même dossier) et de `docs/prd.md`.
> Une spec par user story. Epic : {{Titre de l'epic}} (`aidd_docs/tasks/{{epic}}/`) · Plan associé : `PLAN-SPEC-US-{{XXX}}-{{nom}}.md` (même dossier).
> La spec décrit **comment** l'outil sera construit. Elle reste lisible par une personne non technique.

## 1. Résumé

- **Ce que fait l'outil** : {{une phrase}}
- **User story** : US-{{XXX}} – {{titre}} (et, si elle vient d'une demande, la demande d'origine en une phrase)
- **Pile** : voir « Pile retenue » dans `docs/technical.md`
- **S'appuie sur** : {{specs déjà écrites dont on réutilise écrans, données ou règles (`aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`), ou « aucune »}}

## 2. Périmètre

**Inclus**
- {{ce que cette spec construit}}

**Exclu** (volontairement, pour l'instant)
- {{ce qui est reporté, et où c'est noté : autre US, « En attente » dans le PRD}}

## 3. Pile technique

| Élément | Choix | Pourquoi (en une phrase) |
|---|---|---|
| Pile | {{reprise de « Pile retenue » dans docs/technical.md}} | |
| Données | {{stockage retenu}} | |
| Hébergement | {{hébergeur retenu}} | |
| Services externes | {{aucun, ou ceux de « Pile retenue »}} | |

## 4. Écrans

| Écran | Qui y accède | Ce qu'on y voit | Ce qu'on y fait | US |
|---|---|---|---|---|
| | | | | |

**États de chaque écran** : chargement {{…}} · liste vide {{…}} · erreur {{…}} · sur téléphone {{…}}

**Parcours principal**

```mermaid
flowchart LR
    A[{{Écran A}}] -->|{{action}}| B[{{Écran B}}]
    B -->|{{action}}| C[{{Résultat visible}}]
```

Maquette : {{docs/design/maquettes/US-XXX-<nom>/retenue/ | aucune}} · Design : {{docs/design.md | aucun}}

## 5. Données

Pour chaque type d'information stockée :

### {{Nom du type d'information}}

**Stockée** : {{sur l'appareil / dans une base / dans des fichiers, selon « Données et contrôle d'accès » de docs/technical.md}}

| Champ | Type | Obligatoire | Règle | Exemple |
|---|---|---|---|---|
| | | | | |

**Qui peut** : lire {{…}} · créer {{…}} · modifier {{…}} · supprimer {{…}}
**Contrôle d'accès vérifié** : {{côté serveur / dans la base / sans objet}}

**Liens entre les informations** (si plusieurs types) :

```mermaid
erDiagram
    {{TYPE_A}} ||--o{ {{TYPE_B}} : "{{verbe, ex. possède}}"
```

## 6. Règles métier

| Règle | US | Où elle est vérifiée (navigateur / base / serveur) |
|---|---|---|
| | | |

## 7. Services externes

| Service | Usage | Clé nécessaire ? | Où est la clé |
|---|---|---|---|
| | | | |

## 8. Données et sécurité (obligatoire)

1. **Quelles données personnelles je stocke ?** {{liste, ou « aucune »}} — Sont-elles toutes nécessaires ?
2. **Qui a le droit de voir quoi ?** {{par rôle d'utilisateur}}
3. **Quelles clés ou quels secrets mon appli utilise-t-elle ?** {{nom de la variable, côté serveur ou public}}
4. **Que se passe-t-il si quelqu'un remplit mal un formulaire ?** {{contrôles prévus}}

Points de la checklist sécurité qui s'appliquent : {{identifiants de la checklist}}

## 9. Fichiers

Organisation générale : voir « Organisation des fichiers » dans `docs/technical.md`.

| Fichier | À créer / à modifier | Rôle | US |
|---|---|---|---|
| | | | |

## 10. Vérifications

| Ce qu'on vérifie | Comment | US / critère |
|---|---|---|
| {{chaque critère d'acceptation de l'US}} | à la main | US-{{XXX}} #1 |
| Un utilisateur non autorisé ne voit pas les données d'un autre | à la main, avec deux comptes (sans objet si une seule personne) | |
| Un formulaire mal rempli affiche un message clair | à la main | |
| L'écran reste utilisable sur téléphone | à la main | |
| {{règle métier délicate}} | {{test automatique, si la pile en prévoit}} | |

## 11. Points d'attention

| Risque | Conséquence | Ce qu'on prévoit |
|---|---|---|
| {{ou « aucun identifié »}} | | |

## 12. Questions ouvertes

- {{questions à trancher par la personne avant le plan, ou « aucune »}}

## 13. Définition de « terminé »

Une tâche est terminée quand :
- ses critères d'acceptation sont vérifiés à la main par la personne ;
- la relecture (`/pulse:review`) ne signale aucun point bloquant ;
- elle est enregistrée dans Git (`/pulse:commit`).

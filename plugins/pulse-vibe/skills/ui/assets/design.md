# Design – {{NOM_DU_PROJET}}

> Produit par `/pulse:ui identite` le {{DATE}} à partir de `docs/prd.md`{{, docs/brief.md}}.
> Planche retenue : `docs/design/identite/retenue/` ; ses valeurs : `docs/design/identite/retenue/brandkit.json` (couleurs en OKLCH), la source que rechargent les maquettes et le thème du code.
> Ce document dit **à quoi ressemble** l'outil et **pourquoi**. Les specs, le plan et le code s'y conforment.

## 1. Registre

{{Outil (utiliser) | Vitrine (persuader) | les deux : quelle partie relève de quel registre}}

## 2. Pour qui et dans quelle scène

**Scène d'usage** : {{qui utilise l'outil, où, quand, sous quelle lumière, dans quelle humeur}}

Ce que la scène implique : {{clair ou sombre, densité, taille des cibles tactiles}}

## 3. Personnalité

- **Trois mots** : {{mot 1}} · {{mot 2}} · {{mot 3}}
- **Ne doit pas évoquer** : {{…}}

## 4. Références et anti-références

| Référence | Ce qu'on en retient |
|---|---|
| {{outil ou site cité par la personne}} | |

| À ne pas imiter | Pourquoi |
|---|---|
| | |

## 5. Principes

1. {{principe propre au projet}}
2.
3.

{{Sections 6 à 8 : la sortie de `pulse-aidd brandkit resume`, collée telle quelle ; elle porte leurs titres « ## 6. Couleur », « ## 7. Typographie » et « ## 8. Espacement, arrondis, ombres », avec les valeurs en OKLCH et les contrastes mesurés du brandkit retenu}}

## 9. Composants et états

| Composant | États prévus | Particularités |
|---|---|---|
| Bouton principal | normal, survol, focus visible, actif, désactivé, chargement | |
| Champ de saisie | normal, focus visible, erreur, désactivé | |
| Liste | chargement, vide, erreur | |
| Navigation | | |
| Message (succès, alerte, erreur) | | |

## 10. Mouvement

{{quand et comment animer, durées ; ou « aucun »}}

## 11. À faire / à éviter

- ✅ {{…}}
- ❌ {{…}}
- Voir aussi la liste des anti-patterns de Pulse (`pulse-aidd reference ui/anti-patterns.md`). Une exception volontaire est écrite ici avec sa raison.

## 12. Dans le code

- **Fichier du thème** : {{chemin du fichier où vivent les valeurs (couleurs par rôle, polices, rayons, espacements, ombres), d'après « Organisation des fichiers » de `docs/technical.md` ou le pack de pile ; ou « à créer à la mise en place »}}
- **Règle** : les composants emploient ces valeurs par leur nom de rôle (fond, texte, accent…), plutôt qu'une valeur écrite en dur. Un changement d'identité se fait dans ce seul fichier.
- **Correspondance**, en trois couches : nuances en OKLCH (copiées telles quelles depuis `pulse-aidd brandkit css`) → rôles de la section 6 → nom de la valeur dans le code, ex. Accent → `--primary: var(--ocre-700)` ; puis les valeurs de composant s'il y en a.

## 13. Sources

- Planche retenue : `docs/design/identite/retenue/` ({{direction d'origine ou hybride}})
- Décisions notées dans la mémoire : {{…}}
- Dernière mise à jour : {{DATE}}

---
description: Écrire les user stories avec règles métier, exemples et critères d'acceptation (Étant donné / Lorsque / Alors)
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *)
---

# /pulse:us – Les user stories

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte us`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte us` et lire sa sortie.

## Objectif

Produire `docs/user-stories.md`. Expliquer en deux phrases :
« Une user story décrit un besoin du point de vue de l'utilisateur. Ses critères d'acceptation, écrits sous la forme Étant donné… Lorsque… Alors…, sont ce qui permettra de vérifier que l'IA a codé exactement ce que vous vouliez. »

## Prérequis

- `docs/prd.md` est nécessaire (à défaut `docs/brief.md`, en le signalant). Sinon, proposer `/pulse:prd`.
- Si `docs/user-stories.md` existe : demander s'il faut le compléter ou le refaire.

## Déroulé

### 1. Écrire les user stories

Pour chaque fonctionnalité **Indispensable** et **Essentielle** du PRD, écrire une ou plusieurs US détaillées. Les **Optionnelles** apparaissent seulement dans le tableau d'ensemble, sans détail. Les **En attente** n'apparaissent pas.

Chaque US suit le modèle `docs/user-stories.md` :

- **Identifiant** : reprendre le format des identifiants déjà présents dans `docs/user-stories.md` ; pour un nouveau fichier, proposer un format court et stable, et le faire valider par la personne. Ne jamais supposer un format.
- **Phrase** : « En tant que {{acteur}}, je souhaite {{action + objet}} afin de {{objectif}} ».
- **Taille** (S, M ; une US de taille L se découpe) et **Dépend de** (l'US qui doit exister avant, ou « — »).
- **Règle(s) métier** : la règle que l'exemple illustre.
- **Exemple concret** avec des données **réalistes et fictives** (noms et situations plausibles du métier de la personne), jamais « élément A ».
- **Critères d'acceptation** : 2 à 4, chacun nommé (cas nominal, cas d'erreur ou limite, cas alternatif, accès), au format « **Étant donné** contexte, **lorsque** action, **alors** résultat attendu ». **Au moins un** couvre un cas d'erreur ou un cas limite (champ vide, texte trop long, élément introuvable, accès non autorisé).
- **Hors périmètre de cette US** : ce qu'elle ne fait volontairement pas, pour que l'IA ne l'ajoute pas d'elle-même.

### 2. Vérifier la qualité de chaque US

- **Un seul acteur, une seule action.** Si la phrase contient « et » ou « ou », découper en deux US.
- **Petite** : si une US a plus de 4 critères ou plusieurs règles métier, la découper.
- **Testable** : chaque critère décrit un résultat **visible** par l'utilisateur.
- **Sans jargon technique** : pas de « base de données », « API », « composant ».
- Si des données sont partagées entre plusieurs personnes, intégrer des US d'accès : qui voit quoi (ex. « En tant que <acteur>, je ne vois que mes propres <éléments> »). Ce sont elles qui porteront la sécurité.

### 3. Trancher les questions ouvertes

Si des questions empêchent d'écrire un critère, poser à la personne les plus importantes (3 au maximum), une par une. Les autres restent notées dans l'US.

### 4. Écrire et valider

Remplir le **parcours utilisateur** (les US Indispensables dans l'ordre où l'utilisateur les vit) et vérifier qu'aucune dépendance ne forme de boucle. Écrire `docs/user-stories.md`. Montrer le tableau d'ensemble et **une** US complète en exemple, puis demander validation (« Valider » / « Modifier une US »).

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:spec`.

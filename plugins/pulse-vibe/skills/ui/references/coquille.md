# La coquille des écrans

**Les parties communes à tous les écrans se dessinent une fois.** La coquille, `docs/design/coquille.html`, réunit l'en-tête, la navigation et le pied de page de l'outil. Chaque maquette la reprend telle quelle ; seul le contenu de l'écran change d'une US à l'autre.

## 1. La produire (designer, type `coquille`)

- Un seul fichier, `docs/design/coquille.html`, qui s'adapte à la largeur : la navigation du téléphone (onglets en bas ou menu) et celle de l'ordinateur (barre en haut ou barre latérale), d'après la maquette retenue reçue.
- Les parties communes de cette maquette, mêmes structures, mêmes textes, mêmes icônes, autour d'une zone `<main>` qui contient seulement la phrase « Contenu de l'écran ».
- Un commentaire en tête du fichier : sa source (`retenue/` et date), le jeu d'icônes, le logo, les entrées de navigation.
- Le `<head>` reprend la sortie de `pulse-aidd brandkit css` : les valeurs viennent toujours du brandkit retenu ; la coquille donne la structure et les textes.
- Une coquille qui existe déjà se complète (une entrée de navigation de plus) : le reste ne bouge pas.
- Contrôles : `pulse-aidd maquettes verifier docs/design/coquille.html`, puis `pulse-aidd maquettes capturer docs/design/coquille.html` (captures dans `docs/design/captures/`).

## 2. La créer ou la compléter (`/pulse:ui maquettes`)

Après `--retenir`, lancer un agent `pulse:designer` de type `coquille`, avec le dossier `retenue/`, quand :
- `docs/design/coquille.html` n'existe pas encore et la maquette retenue montre des parties communes (navigation, en-tête) ;
- la maquette retenue change ces parties (une entrée de navigation de plus, un autre en-tête).

Avec une coquille, les variantes d'un lot diffèrent par le contenu de l'écran ; la navigation devient un axe de différence seulement à la demande de la personne, et la coquille se refait alors depuis la variante retenue.

## 3. Dans le code

Les parties communes s'écrivent une fois, dans la mise en page commune de la pile retenue, d'après la coquille ; chaque écran les reçoit de là.

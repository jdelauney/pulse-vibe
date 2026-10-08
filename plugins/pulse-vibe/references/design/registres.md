# Registres d'interface

**Une page = un registre.** Avant toute décision visuelle, savoir si l'écran sert à *utiliser* (outil) ou à *persuader* (vitrine).

Un « registre » est la famille à laquelle appartient un écran. Chaque famille a ses propres règles de couleur, de texte, de densité et de mouvement. Mélanger les deux sans le décider donne un écran qui ne ressemble à rien.

## 1. Les deux registres

| Aspect | Outil (utiliser) | Vitrine (persuader) |
|---|---|---|
| But | Aider à accomplir ce que l'on est venu faire, vite et sans erreur | Convaincre, donner envie, faire agir |
| Exemples d'écrans | Espace de travail, tableau de bord, formulaire, réglages | Page d'accueil publique, présentation d'une offre, portfolio |
| Test de réussite | Une personne habituée aux meilleurs outils du domaine lui ferait-elle confiance ? La familiarité est une qualité. | Peut-on dire sans hésiter « une IA a fait ça » ? Si oui, c'est raté. |
| Couleur | Sobre, accent rare | Stratégie plus affirmée possible |
| Typographie | Lisibilité d'abord ; une seule famille suffit souvent | Titres avec du caractère |
| Densité | Élevée : beaucoup d'information utile visible d'un coup | Aérée : une idée par écran défilé |
| Mouvement | 150 à 250 ms ; le mouvement signale un changement d'état | Une seule séquence d'ouverture soignée |
| Images | Rares et utiles | Au moins une image forte, obligatoire |

**Ce que chaque registre écarte**

- **Vitrine** : tableaux de données, navigation dense, squelettes de chargement (les blocs gris qui annoncent un contenu).
- **Outil** : héros plein écran (grande image d'ouverture), texte d'ambiance, animations d'entrée, fonds décoratifs.

Les durées et la densité de chaque registre sont détaillées dans `regles-ui.md` (§ 3 et § 6).

## 2. Reconnaître le registre

Cherchez les indices dans trois endroits.

- **La demande** : « je veux que mes équipes puissent… » indique un outil ; « je veux que les visiteurs aient envie de… » indique une vitrine.
- **Le PRD** (le document qui décrit le produit, dans `docs/`) : qui utilise l'écran, et pour faire quoi ? Un usage répété, au quotidien, penche vers l'outil. Un passage unique, pour se décider, penche vers la vitrine.
- **L'adresse de l'écran** : un espace derrière une connexion est presque toujours un outil ; une page ouverte à tout le monde est souvent une vitrine.

**Si l'outil a les deux**, choisissez un registre par partie (par exemple, vitrine pour la page publique, outil pour l'espace connecté) et notez-le.

**Sinon, affirmez une hypothèse puis faites-la confirmer.** Proposez le registre avec des mots courants plutôt que de demander « quel registre voulez-vous ? » : le mot est inconnu de la personne. Dites par exemple :

> « Votre outil sert à *utiliser*, pas à *convaincre* : je pars sur le registre outil, d'accord ? »

## 3. La scène d'usage

Avant de choisir quoi que ce soit, écrivez **une phrase** qui décrit la situation réelle :

> « <qui> utilise <l'écran> <où>, <quand>, <lumière>, <humeur>. »

Elle dit : qui regarde l'écran, à quel endroit, à quel moment, sous quelle lumière, dans quel état d'esprit.

Cette phrase décide ensuite :

| Ce qu'elle décide | Comment |
|---|---|
| Clair ou sombre | Lumière vive ou extérieur : thème clair, contraste fort. Pièce sombre ou usage prolongé le soir : thème sombre possible. |
| Densité | Humeur pressée ou concentrée : dense et net. Humeur détendue ou découverte : plus d'air. |
| Taille des cibles tactiles | Usage debout, d'une main, en mouvement : cibles grandes (au moins 44 × 44 px). |
| Contraste | Écran regardé en plein jour ou sur un petit appareil : contraste renforcé, au-dessus du minimum de 4,5:1. |

S'il manque une information pour écrire la phrase, posez la question à la personne, une à la fois.

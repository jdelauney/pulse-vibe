# Règles d'interface

**Des règles courtes, vérifiables, applicables à toute interface.** Elles valent pour une maquette comme pour un écran réel. Gravités utilisées partout : 🔴 bloquant, 🟠 important, 🟢 finition.

## 1. Couleur

Choisir la **stratégie** avant les couleurs. Une stratégie dit quelle part de l'écran la couleur occupe.

| Stratégie (nom pour la personne) | Définition |
|---|---|
| Sobre avec une touche | Neutres teintés + un accent qui couvre 10 % de la surface au plus |
| Une couleur affirmée | Une couleur saturée porte 30 à 60 % de la surface |
| Plusieurs couleurs | Palette complète, chaque couleur a un rôle distinct |
| La couleur partout | La surface elle-même est la couleur |

- **Règle 60-30-10**, en poids visuel : 60 % de fond, 30 % de surfaces secondaires, 10 % d'accent. L'accent fonctionne parce qu'il est rare.
- **Rôles obligatoires de la palette** : fond, surface, texte, texte secondaire, accent, succès, alerte, erreur.
- **Noir et blanc teintés** : teintez-les légèrement vers la couleur de la marque, au lieu des valeurs pures.
- **Contraste** (écart de luminosité entre texte et fond) : texte courant ≥ 4,5:1 ; grands textes et icônes utiles ≥ 3:1.
- **Toute information portée par la couleur est doublée** : ajoutez un mot, une icône ou une forme.
- Définissez chaque teinte dans la palette plutôt que de la fabriquer par transparence (signe d'une palette mal définie).

## 2. Typographie

- **Échelle** de tailles avec un rapport ≥ 1,25 entre deux niveaux voisins.
- **Longueur de ligne** : 65 à 75 caractères pour le texte courant.
- **Corps de texte** ≥ 16 px.
- **Deux familles de polices au plus.**
- **Polices « réflexes »** : pour les titres, choisissez une autre police que celles que les IA prennent par défaut : Inter, Roboto, Arial, Open Sans, Poppins, Montserrat, Space Grotesk, DM Sans, Playfair Display, Fraunces. Exception possible avec une raison explicite, écrite dans `docs/design.md`.
- Choisissez la police à partir des **3 mots de personnalité** de l'identité, par choix réfléchi plutôt que par habitude.
- Prévoyez **toujours une police système de secours** (celle déjà présente sur l'appareil), au cas où la police choisie ne se charge pas.

## 3. Espacement et rythme

- Une **échelle** d'espacements, par exemple des multiples de 4 ou 8 px. Chaque valeur vient de l'échelle.
- **Espacements variés** pour former des groupes : plus d'espace entre deux groupes qu'à l'intérieur d'un groupe.
- **Alignements** sur une grille : les bords de blocs voisins tombent sur les mêmes lignes.
- **Un ou deux rayons d'arrondi au plus** dans tout le projet.

## 4. Composants et états obligatoires

| Composant | Normal | Survol | Focus visible | Actif | Désactivé | Chargement | Vide | Erreur | Succès |
|---|---|---|---|---|---|---|---|---|---|
| Tout élément interactif (bouton, lien, champ) | oui | oui | oui | oui | oui | | | | |
| Toute zone qui charge ou envoie (formulaire, action) | | | | | | oui | | oui | oui |
| Toute liste ou zone de contenu | | | | | | oui | oui | oui | |

- Un **état vide** explique quoi faire et propose l'action. Il contient toujours cette phrase et cette action, en plus d'une éventuelle icône.
- Le **focus visible** est le contour qui montre où l'on se trouve au clavier.

> Livrez chaque composant avec tous ses états.

## 5. Mise en page

- **Hiérarchie claire** : une action principale par écran, visuellement la plus forte.
- Réservez les **cartes** (blocs encadrés) aux éléments vraiment indépendants.
- **Un seul niveau de cartes** (jamais de cartes dans des cartes) : à l'intérieur, séparez par l'espace et des filets.
- **L'action en place d'abord** ; la **fenêtre modale** (qui s'ouvre par-dessus la page) en second choix.
- Le **mobile se conçoit pour lui-même** : pensez l'ordre et les priorités pour le petit écran, au lieu de rétrécir la version ordinateur.
- **Cibles tactiles** ≥ 44 × 44 px.

## 6. Mouvement

- Animer seulement **la position, l'échelle et l'opacité**.
- **150 à 250 ms** en outil.
- Sortie douce (*ease-out*, le mouvement ralentit à l'arrivée), **sans rebond**.
- Respecter la préférence système « réduire les animations ».

## 7. Accessibilité

- **Focus visible** en permanence.
- Chaque **champ** a une étiquette visible.
- Chaque **icône seule** a un nom accessible (le texte lu par les lecteurs d'écran).
- **Ordre de tabulation** logique, celui de la lecture.
- **Langue de la page** déclarée.

## 8. Textes d'interface

- **Libellés d'action précis** : verbe + objet. Dès qu'on peut dire ce qui se passe, nommez-le plutôt qu'écrire « Valider » ou « Découvrir » seuls.
- **Messages d'erreur** : ils disent ce qui s'est passé et comment s'en sortir.
- **Des mots précis** qui disent ce que fait l'outil, plutôt que du **jargon marketing**.
- **Textes de plus d'une phrase** (accroches, présentations) : contrôle des tics d'écriture IA, `pulse-aidd textes verifier` (règles : `references/redaction/regles.md` ; ponctuation, lexique, rythme).
- **Vocabulaire du glossaire** du projet (`aidd_docs/memory/glossary.md`) : les mêmes mots partout.

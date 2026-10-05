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
- **Jamais de noir ou de blanc purs** : teintez-les légèrement vers la couleur de la marque.
- **Contraste** (écart de luminosité entre texte et fond) : texte courant ≥ 4,5:1 ; grands textes et icônes utiles ≥ 3:1.
- **Jamais une information portée par la seule couleur** : ajoutez un mot, une icône ou une forme.
- La transparence utilisée pour fabriquer des teintes est le signe d'une palette mal définie : définissez la teinte.

## 2. Typographie

- **Échelle** de tailles avec un rapport ≥ 1,25 entre deux niveaux voisins.
- **Longueur de ligne** : 65 à 75 caractères pour le texte courant.
- **Corps de texte** ≥ 16 px.
- **Deux familles de polices au plus.**
- **Polices « réflexes »** : évitez, pour les titres, celles que les IA choisissent par défaut : Inter, Roboto, Arial, Open Sans, Poppins, Montserrat, Space Grotesk, DM Sans, Playfair Display, Fraunces. Sauf raison explicite, écrite dans `docs/design.md`.
- Choisissez la police à partir des **3 mots de personnalité** de l'identité, pas par habitude.
- Prévoyez **toujours une police système de secours** (celle déjà présente sur l'appareil), au cas où la police choisie ne se charge pas.

## 3. Espacement et rythme

- Une **échelle** d'espacements, par exemple des multiples de 4 ou 8 px. Pas de valeur au hasard.
- **Espacements variés** pour former des groupes : plus d'espace entre deux groupes qu'à l'intérieur d'un groupe.
- **Alignements** sur une grille : les bords de blocs voisins tombent sur les mêmes lignes.
- **Un ou deux rayons d'arrondi** dans tout le projet, pas plus.

## 4. Composants et états obligatoires

| Composant | Normal | Survol | Focus visible | Actif | Désactivé | Chargement | Vide | Erreur | Succès |
|---|---|---|---|---|---|---|---|---|---|
| Tout élément interactif (bouton, lien, champ) | oui | oui | oui | oui | oui | | | | |
| Toute zone qui charge ou envoie (formulaire, action) | | | | | | oui | | oui | oui |
| Toute liste ou zone de contenu | | | | | | oui | oui | oui | |

- Un **état vide** explique quoi faire et propose l'action. Une icône seule n'est pas un état vide.
- Le **focus visible** est le contour qui montre où l'on se trouve au clavier.

> Ne livrez pas un composant avec la moitié de ses états.

## 5. Mise en page

- **Hiérarchie claire** : une action principale par écran, visuellement la plus forte.
- Les **cartes** (blocs encadrés) ne sont pas une réponse par défaut : utilisez-les quand les éléments sont vraiment indépendants.
- **Jamais de cartes dans des cartes.**
- La **fenêtre modale** (qui s'ouvre par-dessus la page) n'est pas le premier réflexe : préférez l'action en place.
- Le **mobile se conçoit, il ne se rétrécit pas** : pensez l'ordre et les priorités pour le petit écran.
- **Cibles tactiles** ≥ 44 × 44 px.

## 6. Mouvement

- N'animer que **la position, l'échelle et l'opacité**.
- **150 à 250 ms** en outil.
- Sortie douce (*ease-out*, le mouvement ralentit à l'arrivée), **pas de rebond**.
- Respecter la préférence système « réduire les animations ».

## 7. Accessibilité

- **Focus visible** en permanence.
- Chaque **champ** a une étiquette visible.
- Chaque **icône seule** a un nom accessible (le texte lu par les lecteurs d'écran).
- **Ordre de tabulation** logique, celui de la lecture.
- **Langue de la page** déclarée.

## 8. Textes d'interface

- **Libellés d'action précis** : verbe + objet. Évitez « Valider » ou « Découvrir » seuls quand on peut dire ce qui se passe.
- **Messages d'erreur** : ils disent ce qui s'est passé et comment s'en sortir.
- Pas de **jargon marketing**.
- Pas de **tiret cadratin** (le long tiret) comme ponctuation décorative.
- **Vocabulaire du glossaire** du projet (`aidd_docs/memory/glossary.md`) : les mêmes mots partout.

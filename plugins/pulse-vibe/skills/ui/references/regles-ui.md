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
- **Toute couleur vient de la palette**, par une variable, y compris dans les maquettes ; chaque teinte y est définie à part entière, plutôt que fabriquée par transparence (signe d'une palette mal définie).
- **Cinq nuances par teinte**, de la plus claire à la plus foncée. En OKLCH (une notation de couleur où la luminosité se règle à part de la teinte), la luminosité change d'une nuance à l'autre ; la teinte reste fixe ; la saturation reste proche, et baisse aux nuances très claires ou très foncées si la couleur sort de ce que l'écran peut afficher (un outil de conversion le signale).
- **Valeurs en trois couches** : les **nuances** (les 5 nuances de chaque teinte, nommées `--<teinte>-100`, `-300`, `-500`, `-700` et `-900`, par exemple `--ocre-700`) ; les **rôles** (fond, texte, accent…), qui renvoient chacun à une nuance (`--texte: var(--ardoise-900)`) ; des valeurs de **composant**, seulement quand un composant s'écarte des rôles. Les composants emploient les rôles : un changement de couleur se fait alors à un seul endroit.
- **Neutres teintés** (noir, blanc, gris, fonds) : une saturation de 0,005 à 0,01 vers la teinte de la marque, au lieu des valeurs pures.
- **Couleurs de rôle** placées dans leur zone de teinte (en degrés sur le cercle des couleurs), puis accordées à la palette : succès vers 150 (vert), alerte vers 80 (ambre), erreur vers 25 (rouge).
- **Mode sombre** : même teinte pour chaque rôle ; la luminosité s'inverse et la saturation suit la même règle que les nuances. Le fond s'assombrit, le texte s'éclaircit ; une surface en relief est un peu plus claire que le fond.
- **Liens** : la couleur d'accent et un soulignement décalé du texte ; le bleu par défaut du navigateur reste réservé aux pages sans identité.
- **Contraste** : les seuils sont au § 7. Il se mesure pour chaque paire de couleurs avec `pulse-aidd contraste <couleur> <fond>` (hexadécimal, `rgb()` ou `oklch()`, transparence comprise) : rapport exact et seuils atteints. `--viser 4.5` propose la luminosité OKLCH qui atteint le seuil, à teinte et chroma égales. Convertir d'abord en hexadécimal ou en `oklch()` une variable CSS, un nom de couleur ou un `hsl()`, et prendre un fond opaque.
- **Toute information portée par la couleur est doublée** : ajoutez un mot, une icône ou une forme.

## 2. Typographie

- **Échelle** de tailles, avec un rapport fixe entre deux niveaux voisins, choisi selon l'usage : 1,2 à 1,25 pour un outil dense, 1,333 pour un équilibre, 1,5 pour une vitrine.
- **Interligne** (l'espace entre deux lignes) : 1,5 à 1,6 pour le texte courant, 1,1 à 1,25 pour les titres.
- **Longueur de ligne** : 65 à 75 caractères pour le texte courant.
- **Corps de texte** ≥ 16 px.
- **Deux familles de polices au plus.** Quand l'identité le demande, la police des titres se distingue de celle du texte (par exemple, une police à empattements, avec de petits traits au bout des lettres, pour les titres ; une police sans empattements pour le texte).
- **Grands titres** légèrement resserrés : espacement des lettres de −0,01 à −0,02 em (em : la taille du texte lui-même).
- **Majuscules** ponctuellement, sur un libellé court de 4 mots au plus ; un paragraphe s'écrit en minuscules.
- **Tailles en `rem`** (une unité qui suit la taille de texte choisie par la personne dans son système) plutôt qu'en pixels fixes.
- **Polices « réflexes »** : pour les titres, choisissez une autre police que celles que les IA prennent par défaut : Inter, Roboto, Arial, Open Sans, Poppins, Montserrat, Space Grotesk, DM Sans, Playfair Display, Fraunces. Exception possible avec une raison explicite, écrite dans `docs/design.md`.
- Choisissez la police à partir des **3 mots de personnalité** de l'identité, par choix réfléchi plutôt que par habitude.
- Prévoyez **toujours une police système de secours** (celle déjà présente sur l'appareil), au cas où la police choisie ne se charge pas.

## 3. Espacement et rythme

- Une **échelle** d'espacements, par exemple des multiples de 4 ou 8 px. Chaque valeur vient de l'échelle.
- **Espacements variés** pour former des groupes : plus d'espace entre deux groupes qu'à l'intérieur d'un groupe.
- **Alignements** sur une grille : les bords de blocs voisins tombent sur les mêmes lignes.
- **Un ou deux rayons d'arrondi au plus** dans tout le projet.
- **Ombres** : une petite ombre douce pour les éléments courants ; une ombre plus marquée seulement pour ce qui flotte au-dessus de la page (menu ouvert, fenêtre modale, notification).
- **Densité** selon le registre : compacte ou normale en outil, confortable en vitrine.
- **En vitrine**, l'espacement entre sections varie et reste borné : 80 à 140 px pour l'ouverture de la page, 60 à 100 px entre sections, avec `clamp()` (une valeur qui suit la largeur d'écran entre un minimum et un maximum).
- **Largeur de contenu** de 1 280 px au plus.
- **Largeur d'un champ** selon ce qu'on y saisit : court pour un code postal, plus long pour une adresse.

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
- **Cibles tactiles** ≥ 44 × 44 px (Pulse vise plus large que le minimum de 24 px de WCAG 2.2).
- **Vérifier chaque écran aux largeurs 320, 390, 768, 1 280 et 1 920 px** (petit téléphone, téléphone courant, tablette, ordinateur, grand écran).

## 6. Mouvement

- Animer **la position, l'échelle et l'opacité** ; la couleur, seulement pour le survol et le focus.
- **Durées** :

| Interaction | Durée |
|---|---|
| Survol | 120 à 150 ms |
| Focus | 100 ms |
| Menu déroulant | 200 ms |
| Fenêtre modale | 300 ms à l'entrée, 200 ms à la sortie |
| Notification | 300 ms à l'entrée, 200 ms à la sortie |
| Chargement vers contenu | 250 ms |
| Changement de page (vitrine) | 300 à 400 ms |

- **Courbe** : à l'entrée, le mouvement ralentit en arrivant (*ease-out*, par exemple `cubic-bezier(0.25, 1, 0.5, 1)`) ; à la sortie, il accélère en partant (*ease-in*). Le mouvement s'arrête net sur sa position finale. Une vitesse constante sert aux barres de progression et aux indicateurs de chargement qui tournent.
- **En vitrine**, les apparitions décalées (50 à 60 ms entre deux éléments, 6 éléments au plus) et la révélation au défilement (une seule fois par élément) font partie de la séquence d'ouverture. En outil, le mouvement signale seulement un changement d'état.
- **« Réduire les animations »** (préférence du système, `prefers-reduced-motion`) : un fondu court remplace les déplacements ; vidéos et animations attendent un geste de la personne.
- **Vidéo** : contrôles visibles, son coupé au départ.

## 7. Accessibilité

Niveau visé : **WCAG 2.2 AA** (le référentiel international d'accessibilité du web).

- **Contraste** : texte courant ≥ 4,5:1 ; grand texte (24 px, ou 18,66 px en gras) ≥ 3:1 ; contours de champs, boutons, icônes utiles et focus ≥ 3:1.
- **Focus** toujours visible à la navigation au clavier (`:focus-visible`) : un contour de 2 px au moins, décalé de l'élément, visible sur tous les fonds (exigence de Pulse, au-delà du niveau AA).
- Chaque **champ** a une étiquette visible ; son aide est reliée au champ (`aria-describedby`).
- Chaque **icône seule** a un nom accessible (le texte lu par les lecteurs d'écran) ; une icône décorative est cachée aux lecteurs d'écran (`aria-hidden`).
- **Ordre de tabulation** logique, celui de la lecture ; les **flèches du clavier** déplacent dans une liste de choix, des onglets ou un menu.
- **Page en cours** signalée dans la navigation (`aria-current`) ; chaque zone de navigation porte un nom.
- **Langue de la page** déclarée.

## 8. Textes d'interface

- **Libellés d'action précis** : verbe + objet. Dès qu'on peut dire ce qui se passe, nommez-le plutôt qu'écrire « Valider » ou « Découvrir » seuls.
- **Messages d'erreur** : ils disent ce qui s'est passé et comment s'en sortir.
- **Des mots précis** qui disent ce que fait l'outil, plutôt que du **jargon marketing**.
- **L'introduction ne répète pas le titre** : elle apporte l'information suivante.
- **Textes de plus d'une phrase** (accroches, présentations) : contrôle des tics d'écriture IA, `pulse-aidd textes verifier` (règles : `skills/rediger/references/regles.md` ; ponctuation, lexique, rythme).
- **Vocabulaire du glossaire** du projet (`aidd_docs/memory/glossary.md`) : les mêmes mots partout.

## Sources

- WCAG 2.2 : critères 1.4.3 (contraste du texte ; grand texte = 18 pt, ou 14 pt en gras), 1.4.11 (contraste des composants), 2.4.7 (focus visible), 2.4.13 (apparence du focus, niveau AAA, base du contour de 2 px), 2.5.8 (taille des cibles : 24 px au minimum ; Pulse vise 44 px) : https://www.w3.org/TR/WCAG22/
- MDN : `prefers-reduced-motion`, `:focus-visible`, `text-underline-offset`, `oklch()`, `clamp()` : https://developer.mozilla.org/

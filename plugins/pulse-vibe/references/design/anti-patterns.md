# Anti-patterns d'interface

**Le test : peut-on dire sans hésiter « une IA a fait ça » ? Si oui, recommencer.** Deuxième test : la palette se devine-t-elle à partir du seul nom de la catégorie ? Si oui, recommencer.

Un anti-pattern est un défaut fréquent, reconnaissable à l'œil. Gravités : 🔴 bloquant, 🟠 important, 🟢 finition. « Ce qui se voit » décrit le signal observable dans la page ou dans le code.

| Anti-pattern | Gravité | Ce qui se voit | À la place |
|---|---|---|---|
| Texte en dégradé de couleur | 🔴 | Titre dont les lettres passent d'une couleur à une autre | Une couleur unie du texte ; l'accent par le poids ou la taille |
| Effet verre dépoli décoratif | 🔴 | Panneaux translucides et flous posés sur un fond coloré, sans besoin de lire ce qui est derrière | Surface pleine, bien contrastée |
| Bandeau « gros chiffres » en tête de page sans raison | 🔴 | Trois ou quatre grands nombres alignés en haut, sans lien avec l'action de l'écran | Montrer d'abord ce que la personne vient faire ; chiffres seulement s'ils servent une décision |
| Grille de cartes identiques icône + titre + texte | 🔴 | Trois à six blocs de même forme, une icône ronde, un titre court, deux lignes | Une liste hiérarchisée, ou des blocs de tailles différentes selon leur importance |
| Bordure d'accent colorée sur le côté gauche des blocs | 🔴 | Un liseré épais de couleur sur le bord gauche de chaque bloc | Fond teinté léger, titre plus fort, ou l'espace seul pour séparer |
| Cartes dans des cartes | 🔴 | Un bloc encadré contenant d'autres blocs encadrés | Un seul niveau d'encadrement ; séparer le reste par l'espace et des filets |
| Fenêtre modale comme premier réflexe | 🔴 | Chaque action ouvre une fenêtre par-dessus la page | L'action en place : édition dans la ligne, panneau latéral, page dédiée |
| Contraste du texte sous 4,5:1 | 🔴 | Texte gris clair sur fond blanc, texte pâle sur image | Foncer le texte ou éclaircir le fond ; vérifier chaque paire de couleurs |
| Focus clavier invisible | 🔴 | En appuyant sur la touche de tabulation, rien ne montre où l'on est | Contour net et contrasté sur tout élément interactif |
| Police réflexe en titre (voir `regles-ui.md`) | 🟠 | Titres dans l'une des polices choisies par défaut par les IA | Une police choisie d'après les 3 mots de personnalité, ou une raison écrite |
| Palette devinable depuis la catégorie | 🟠 | Les couleurs se devinent en lisant seulement le type d'activité | Partir de la personnalité de l'identité plutôt que du lieu commun de la catégorie |
| Petite étiquette en majuscules au-dessus de chaque section | 🟠 | Une mention minuscule, en capitales espacées, avant chaque titre | Supprimer ; garder une étiquette seulement là où elle aide |
| Numérotation décorative 01 / 02 / 03 | 🟠 | Des numéros en gros devant des blocs qui n'ont pas d'ordre | Numéroter seulement une vraie suite d'étapes |
| État vide réduit à une icône | 🟠 | Zone vide avec un pictogramme et rien d'autre | Une phrase qui explique + le bouton qui permet d'agir |
| Espacements tous identiques | 🟠 | Même écart partout, tout paraît à égalité | Grouper : écart faible dans un groupe, écart net entre groupes |
| Rayons d'arrondi incohérents | 🟠 | Coins très ronds ici, à peine arrondis là, carrés ailleurs | Un ou deux rayons, définis une fois |
| Bordure fine grise + grande ombre floue sur tout | 🟠 | Chaque bloc a un filet gris et une large ombre diffuse | Choisir : un filet, ou une ombre légère, sur peu d'éléments |
| Mots creux de marketing (« révolutionnaire », « boostez », « sans effort ») | 🟠 | Promesses vagues dans les titres et les boutons | Dire ce que fait l'outil, avec des mots précis |
| Texte de remplissage générique au lieu de contenus réalistes | 🟠 | « Lorem ipsum », « Titre ici », « Description » | Des contenus plausibles, dans le vocabulaire du glossaire |
| Long texte centré | 🟢 | Paragraphe de plus de trois lignes aligné au centre | Aligner à gauche ; centrer seulement un titre ou une phrase courte |
| Icône seule sans nom accessible | 🟢 | Bouton avec un pictogramme, sans texte ni nom lu par les lecteurs d'écran | Ajouter un nom accessible précis, ou un libellé visible |
| Tiret cadratin décoratif dans les textes | 🟢 | Longs tirets utilisés comme ponctuation à la place de virgules ou de points | Phrases courtes, virgules, deux-points |
| Emoji en guise d'icônes d'interface | 🟢 | Pictogrammes colorés du système dans les boutons ou les titres | Un jeu d'icônes unique et cohérent, ou le texte seul |

Une règle peut être enfreinte **volontairement** si `docs/design.md` le justifie (section « À faire / à éviter ») ; la raison y est écrite.

# Composer un écran

**Une page premium se compose section par section, comme une affiche ou un magazine : chaque section a sa mise en page, choisie pour ce qu'elle doit montrer.** Sert au designer (maquettes) et à la critique. Les valeurs de typographie et de mouvement sont dans `regles-ui.md` (§ 2 et § 6) ; l'ordre des sections d'une vitrine dans `motifs.md` § 7.

## 1. Le niveau visé

Une page se publierait dans une sélection de sites remarquables (Awwwards, Siteinspire, Godly) quand :
- **un parti pris se voit dès le premier écran** : un titre d'affiche, une image forte, ou les deux, à une échelle qui surprend ;
- **les sections changent de forme** au fil du défilement : chaque section garde la même grille et la même palette, et prend une autre composition ;
- **l'échelle crée la hiérarchie** : grands écarts de taille entre l'affiche, les titres et le texte, plutôt que des tailles voisines ;
- **le mouvement accompagne la lecture** : une entrée chorégraphiée, des révélations au défilement, une réponse soignée à chaque survol, focus et pression ;
- **chaque détail vient d'une décision** : un alignement, un filet, une légende, un chiffre en grand, plutôt qu'un bloc tiré d'un gabarit.

En registre outil, le niveau premium passe par la justesse : composition maître-détail nette, typographie précise, densité tenue, micro-interactions rapides ; les compositions spectaculaires restent à la vitrine.

## 2. Les compositions

Choisir, pour chaque section, une composition de ce catalogue d'après ce qu'elle montre, et la nommer dans `note.md`.

| Composition | Quand | Structure |
|---|---|---|
| **Affiche typographique** | Ouverture, manifeste, appel final | Le titre d'affiche occupe la largeur (6 à 12 colonnes), le texte d'appui court en bas à droite ou sous une ligne de base décalée |
| **Éditoriale asymétrique** | Récit, présentation, preuve | Deux colonnes inégales (7/5, 8/4, 5/7) ; le titre dans l'étroite, le texte ou l'image dans la large ; des blancs francs |
| **Plein cadre** | Image forte, ambiance, preuve par l'image | Image ou vidéo de bord à bord, sur toute la largeur de l'écran ; texte posé dans une zone calme de l'image, contraste mesuré, ou sous l'image en légende |
| **Bento à tailles variées** | Plusieurs fonctionnalités d'importance inégale | Grille de blocs de 2 à 4 tailles : un grand (2 × 2), des moyens, des petits ; le contenu de chaque bloc diffère (image, chiffre, phrase, capture) |
| **Index à filets** | Liste de services, d'étapes, de questions | Lignes pleine largeur séparées par des filets, titre en grand à gauche, détail à droite ; le survol décale ou révèle |
| **Défilement narratif** | Une méthode, un avant / après, une démonstration | Une colonne reste fixe à l'écran (`position: sticky`) pendant que l'autre défile ; l'image fixe change à chaque étape |
| **Galerie décalée** | Réalisations, lieux, produits | Images de formats différents, en quinconce, certaines débordant de la grille ; légendes courtes |
| **Chiffre en majesté** | Une preuve chiffrée unique | Un nombre au niveau d'affiche, une phrase qui dit ce qu'il prouve, sa source |
| **Bandeau de rupture** | Changer de rythme entre deux sections denses | Une phrase seule, très grande, sur un fond de l'autre ambiance (sombre après clair) |
| **Maître-détail** (outil) | Liste et fiche d'un même objet | Liste à gauche, fiche à droite sur ordinateur ; fiche en page sur téléphone |
| **Tableau de bord hiérarchisé** (outil) | Suivi d'une activité | Un bloc principal large (ce qu'il faut faire maintenant), des blocs secondaires plus petits, la suite en liste |

## 3. Le rythme de la page

- **Une composition par section, jamais la même deux fois de suite** ; sur une vitrine de 5 sections ou plus, au moins 4 compositions différentes.
- **Au moins une rupture d'échelle par vitrine** : un plein cadre, une affiche typographique ou un chiffre en majesté.
- **Au moins une composition asymétrique** sur ordinateur ; le centrage se réserve à l'affiche et à l'appel final.
- **Alternance d'ambiances** : clair et sombre, dense et aéré, texte et image, d'une section à l'autre.
- **Une grille de 12 colonnes** tient l'ensemble : l'asymétrie et les débordements partent de ses lignes, qui restent les mêmes d'une section à l'autre.
- **Espacements entre sections variés** (`regles-ui.md` § 3) : plus d'air avant une rupture, moins entre deux sections liées.

## 4. Superpositions et cadrages

- **Superposer avec intention** : un titre qui mord sur une image, une image qui chevauche deux sections, une légende posée sur le bord. Le texte posé sur une image garde 4,5:1, mesuré sur la zone la plus claire (voile uni ou zone calme).
- **Cadrer les images** : recadrage serré sur un détail, format choisi (portrait, panoramique), fond perdu d'un côté ; une image par idée.
- **Sur téléphone**, chaque composition se recompose pour l'écran étroit : l'asymétrie devient un décalage de marge ou un ordre différent, le plein cadre garde sa force en hauteur, le bento passe en une colonne aux hauteurs variées.

## 5. Déclarer et justifier

- La page déclare son registre sur sa balise racine : `<html lang="fr" data-registre="vitrine">` (ou `outil`) ; les contrôles du rendu s'en servent.
- Le `note.md` de chaque maquette contient un **plan de composition** : pour chaque section, son nom, la composition choisie et la raison en une ligne.

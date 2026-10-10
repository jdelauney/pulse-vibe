# Motifs d'écrans

**Des solutions éprouvées pour les situations qui reviennent d'un écran à l'autre.** Elles décrivent des comportements, quelle que soit la technologie ; le pack de pile donne le composant correspondant. Les durées d'animation, les contrastes et l'accessibilité sont dans `regles-ui.md` ; les formulaires et le comportement au clavier dans `qualite/composants.md`.

## 1. Messages et retours

- **Notification** (un message bref qui apparaît puis disparaît) : en bas à droite sur ordinateur, en bas au centre sur téléphone ; 4 à 6 secondes ; 3 au plus à la fois. Elle propose « Annuler » quand l'action peut se défaire. Une erreur reste affichée jusqu'à ce que la personne la ferme.
- **Attente** : une roue qui tourne s'accompagne d'un texte (« Envoi en cours… ») ; en registre outil, une liste ou une page qui charge affiche un squelette de chargement (des blocs gris à la forme du contenu attendu). En vitrine, le contenu arrive déjà prêt.
- **Action destructive** (supprimer, vider) : une confirmation qui nomme ce qui disparaît (« Supprimer la facture F-2026-014 ? »), avec le bouton de l'action en couleur d'erreur.
- **Succès** : un retour visible à l'endroit de l'action (le bouton change, la ligne apparaît), et une notification pour ce qui se passe ailleurs.

## 2. Choisir dans une liste

| Nombre de choix | Contrôle |
|---|---|
| 2 à 6 | Boutons d'option, tous visibles d'un coup (cases à cocher quand on peut en choisir plusieurs) |
| 7 à 15 | Liste déroulante |
| Plus de 15 | Champ de sélection avec recherche : on tape quelques lettres, la liste se filtre |

Chaque choix passe par un vrai contrôle de formulaire, utilisable au clavier et lu par les lecteurs d'écran.

## 3. Panneaux et fenêtres

- **Panneau latéral** (un volet qui glisse sur le côté) : pour voir ou modifier un élément sans quitter la liste. À droite sur ordinateur, depuis le bas sur téléphone.
- **Fenêtre modale** (elle s'ouvre par-dessus la page et bloque le reste) : pour une décision courte qui demande toute l'attention (confirmer, choisir). Clavier et focus : `qualite/composants.md` § 8.
- **Formulaire courant** (créer, modifier) : en place, ou sur une page dédiée.

## 4. Tableaux de données

- **En-tête qui reste visible** quand on fait défiler ; le **tri** se signale dans l'en-tête de la colonne triée (flèche, et sens écrit pour les lecteurs d'écran).
- **Nombres alignés à droite**, avec le même nombre de décimales dans une colonne ; textes alignés à gauche.
- **Actions d'une ligne** : sur ordinateur, elles apparaissent au survol de la ligne et dès que le focus clavier entre dans la ligne ; elles restent atteignables avec la touche Tab. Sur téléphone, elles restent toujours visibles.
- **Pagination** (le découpage en pages, avec des boutons pour passer de l'une à l'autre) qui situe : « 1 à 20 sur 134 ».
- **Chargement** : un squelette de 5 à 8 lignes. **État vide** : une phrase et le bouton de création.
- **Sur téléphone** : les colonnes prioritaires seulement, ou une carte par ligne, empilées.

## 5. Indicateurs

Un indicateur (un chiffre clé suivi dans le temps) se compose d'un libellé, d'une valeur et d'une évolution, et éventuellement d'un petit graphique. L'évolution s'écrit aussi en mots ou avec un signe (« +12 % depuis mars »), en plus de la couleur. 5 au plus sur un écran, seulement s'ils servent une décision de l'écran (voir « Bandeau gros chiffres » dans `anti-patterns.md`).

## 6. Navigation

- **Jusqu'à 5 sections** : une barre en haut. **Au-delà** : une barre latérale d'environ 240 px, repliable.
- **Section active** marquée par une forme (fond, trait, ou graisse : l'épaisseur des lettres) en plus de la couleur, et signalée comme page en cours (`regles-ui.md` § 7).
- **Sur téléphone** : une barre d'onglets en bas (5 entrées au plus) ou un menu.
- **Fil d'Ariane** (le chemin « Accueil › Clients › Dupont ») à partir de 3 niveaux de profondeur.

## 7. Page vitrine

Un ordre de persuasion, dont chaque étape reste facultative :

1. **Ouverture** : la promesse en une ligne, dans les mots du public, et un bouton principal.
2. **Une preuve** : des logos de clients, ou un chiffre vérifiable (l'un ou l'autre).
3. **Problème, puis solution.**
4. **Fonctionnalités hiérarchisées** : une grande, deux ou trois moyennes, puis une liste courte (voir « Grille de cartes identiques » dans `anti-patterns.md`).
5. **Fonctionnement en quelques étapes** (3 le plus souvent) : une vraie suite, numérotée.
6. **Témoignages réels**, avec l'accord de leur auteur : nom, fonction, photo si possible.
7. **Tarifs** : 3 offres au plus, la recommandée mise en avant.
8. **Questions fréquentes** : 5 à 8 vraies questions de clients.
9. **Appel final** : le même bouton principal qu'à l'ouverture.

## 8. Graphiques

| Question | Graphique |
|---|---|
| Comment ça évolue ? | Courbe |
| Qui est plus grand ? | Barres (horizontales quand les libellés sont longs) |
| Quelle part du tout ? (5 parts au plus) | Anneau (un cercle évidé, découpé en parts) ou barre empilée (une seule barre découpée en segments) |
| Comment c'est réparti ? | Histogramme (des barres accolées, une par tranche de valeurs) |

- **Sobriété** : une légende seulement à partir de deux séries ; un axe des barres qui part de zéro ; une grille légère, horizontale ; les valeurs exactes au survol ou à côté des barres.
- **Accessibilité** : un titre qui dit ce que montre le graphique ; une alternative en texte ou en tableau ; chaque série reconnaissable par une étiquette ou un motif, en plus de sa couleur.

## 9. Icônes, logo et images de partage

- **Un seul jeu d'icônes** : dessinées sur la même grille (24 × 24 le plus souvent), même épaisseur de trait, couleur héritée du texte ; tailles 16, 20 et 24 px. Nom accessible et icônes décoratives : `regles-ui.md` § 7.
- **Logo** : une version principale, une version d'une seule couleur et une icône d'onglet (favicon) ; essayé sur fond clair et sur fond sombre ; un dégradé éventuel reste sur une forme, le texte du logo reste uni.
- **Image de partage** (l'aperçu affiché quand on partage un lien) : 1 200 × 630 px, avec le nom et la promesse lisibles en petit.

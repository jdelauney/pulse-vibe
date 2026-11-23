# Heuristiques d'utilisabilité

**Une grille pour juger un écran dans son ensemble, en plus des règles.** Elle sert à la critique (`ui-critic`) : d'abord une évaluation d'ensemble en 5 dimensions, puis les 10 heuristiques de Jakob Nielsen (des principes d'utilisabilité reconnus depuis 1994). Les valeurs chiffrées restent dans `regles-ui.md` et `motifs.md`.

## Évaluation d'ensemble

Chaque dimension reçoit une note sur 10, justifiée en une phrase qui cite ce qui se voit. Le total est sur 50. Pour une maquette, ce sont deux juges qui notent, d'après les seules captures (`ui/critique-maquette.md`).

| Note | Lecture |
|---|---|
| 0 à 2 | Absent : rien n'a été décidé |
| 3 à 4 | Présent par endroits, par hasard |
| 5 à 6 | Visible, avec des manques |
| 7 à 8 | Tenu partout, dans les petites décisions |
| 9 à 10 | Chaque détail sert l'intention |

**Le barème vise le niveau premium** décrit dans `composition.md` § 1 : 9 ou 10 seulement pour un écran qui figurerait dans une sélection de sites remarquables ; 7 ou 8 pour un écran soigné dont un parti pris se voit ; un écran propre et banal, construit comme un gabarit, reste à 5 ou 6. Une note de 7 ou plus cite la décision précise qui la justifie.

**Plafonds**, appliqués après la note :
- un anti-pattern 🔴 visible : Finition 4 au plus ;
- trois signes d'un écran fait par une IA ou plus (`anti-patterns.md`) : Personnalité 4 au plus ;
- en vitrine, sections bâties sur le même modèle, ou titre d'ouverture sans écart de taille franc avec le texte : Hiérarchie 5 au plus ;
- en vitrine, aucune rupture d'échelle (affiche, plein cadre, chiffre en majesté) : Personnalité 5 au plus.

### Intention

Peut-on dire pourquoi cet écran existe ?
- Peut-on dire, en une phrase, ce que l'écran veut faire ressentir ou faire faire ?
- Les choix (couleurs, polices, densité) suivent-ils `docs/design.md` et son registre ?

### Hiérarchie

Le regard trouve-t-il tout de suite où aller ?
- Quel élément le regard trouve-t-il en premier ? Est-ce le bon ?
- L'action principale se voit-elle sans chercher ? Combien d'éléments ont le même poids ?
- Les écarts de taille et de graisse sont-ils francs (`regles-ui.md` § 2) ? Les sections changent-elles de composition (`composition.md` § 3) ?

### Finition

Le soin se voit-il dans les petites choses ?
- Espacements, rayons et ombres viennent-ils de leurs échelles ?
- Chaque élément interactif a-t-il tous ses états (`regles-ui.md` § 4) et sa micro-interaction (§ 6) ?
- Alignements sur la grille, légendes, filets, cadrages : le détail est-il décidé ?

### Usage

La tâche se fait-elle sans friction ?
- Le parcours principal se fait-il sans obstacle, au clavier comme au toucher ?
- Les heuristiques ci-dessous sont-elles respectées ?

### Personnalité

L'écran a-t-il un choix mémorable ?
- Un détail le distingue-t-il d'un modèle générique (voir « Ce que chaque registre écarte » dans `registres.md`) ?
- En vitrine : une composition audacieuse (asymétrie, plein cadre, superposition, rupture d'échelle) se voit-elle ?
- En registre outil, la personnalité passe par la justesse (typographie, densité, textes) : un outil sobre et précis mérite une bonne note.

## Les 10 heuristiques

Une heuristique non respectée devient un constat de la rubrique `Usage`, avec son numéro (« H3 »).

### 1. État du système visible

La personne sait-elle toujours ce qui se passe ?
- Chaque attente montre un signe (motifs « Attente » de `motifs.md`).
- Chaque action reçoit un retour (motif « Succès »).
- Une tâche longue montre sa progression.

### 2. Les mots de la personne

Les mots de l'interface sont-ils ceux du public ?
- Les libellés viennent du glossaire du projet, sans jargon technique.
- Les icônes sont comprises sans légende, ou en ont une.
- Les conventions connues sont respectées (le logo ramène à l'accueil).

### 3. Contrôle et liberté

Peut-on revenir en arrière facilement ?
- Une action qui se défait propose de l'annuler (motif « Notification »).
- Chaque écran a une sortie (retour, fil d'Ariane, fermeture).
- Une action irréversible demande confirmation (motif « Action destructive »).

### 4. Cohérence

Les mêmes choses se ressemblent-elles partout ?
- Un même mot désigne toujours la même action.
- Une même forme se comporte toujours de la même façon.
- Les habitudes du web sont respectées (un lien souligné mène ailleurs).

### 5. Prévention des erreurs

L'interface aide-t-elle à éviter l'erreur avant qu'elle arrive ?
- La saisie est vérifiée dès qu'on quitte le champ.
- Le format attendu est indiqué avant la saisie (« jj/mm/aaaa »).
- Un bouton indisponible se voit comme tel et dit pourquoi.

### 6. Reconnaître plutôt que se souvenir

La personne doit-elle retenir une information d'un écran à l'autre ?
- Les choix possibles restent visibles.
- Un formulaire en plusieurs étapes rappelle ce qui a été saisi.
- Les éléments récents sont proposés.

### 7. Rapidité pour les habitués

Une personne habituée peut-elle aller plus vite ?
- Les actions fréquentes sont à portée d'un clic, ou d'un raccourci clavier.
- Les valeurs par défaut sont les plus probables.
- Une étape facultative se saute.

### 8. Sobriété

Chaque élément a-t-il une raison d'être là ?
- Chaque décoration a une fonction : en vitrine, persuader ; en outil, guider.
- La densité suit le registre (`registres.md`).
- L'information secondaire passe au second plan.

### 9. Sortir d'une erreur

Le message d'erreur aide-t-il à s'en sortir ?
- Il suit les règles des messages d'erreur (`regles-ui.md` § 8), en mots simples.
- Il s'affiche près de sa cause (formulaires : `qualite/composants.md`).

### 10. Aide

L'aide est-elle là quand on en a besoin ?
- Une aide courte accompagne ce qui n'est pas évident, à l'endroit où l'on bloque.
- Un écran vide explique quoi faire (`regles-ui.md` § 4).
- Une action peu claire a une infobulle (le petit texte qui apparaît au survol ou au focus).

## Source

Jakob Nielsen, « 10 Usability Heuristics for User Interface Design » : https://www.nngroup.com/articles/ten-usability-heuristics/

# Fidélité à la maquette retenue

Utilisé par `pulse:implementer`, `pulse:verifier`, `/pulse:spirc` et `/pulse:implement` quand une tâche réalise un écran maquetté (dossier `docs/design/maquettes/US-XXX-<nom>/retenue/`). La maquette retenue est l'apparence choisie par la personne : l'écran réel la reproduit. Seuls changent la façon de l'écrire (composants de la pile retenue) et les données, réelles au lieu d'exemples.

## 1. Réaliser l'écran (implementer)

1. Avant le premier fichier de l'écran, lire **en entier** `desktop.html` et `mobile.html` de `retenue/` : le HTML et tout le CSS (balises `<style>`, attributs `style`, feuilles liées), et `note.md` (états montrés, origine).
2. Reprendre sa **structure** : les mêmes zones, dans le même ordre, avec la même disposition (colonnes, grille, alignements, ce qui reste fixe ou défile), et le même passage de la mise en page ordinateur à celle du téléphone.
3. Reprendre ses **valeurs** : tailles et graisses de texte, interlignes, espacements, largeurs, arrondis, bordures, ombres, couleurs. Par la variable de `docs/design.md` quand elle existe, sinon la valeur exacte de la maquette.
4. Reprendre ses **textes** (titres, libellés, boutons, messages) et ses **états** montrés (vide, chargement, erreur) qui relèvent de la tâche.
5. Écrire le tout avec les composants et les classes de la pile retenue. Un composant existant sert quand son rendu correspond à la maquette ; sinon, l'adapter dans le périmètre de la tâche, ou le signaler.
6. Un écart inévitable (limite de la pile, accessibilité, donnée absente) : prendre la solution la plus proche de la maquette et le nommer dans le rapport.
7. Dans le rapport, section « Maquette » : les fichiers lus, les zones réalisées, les écarts (ou « aucun »).

## 2. Comparer l'écran à la maquette (verifier)

1. Avec un outil de navigateur : ouvrir la maquette (fichier HTML) et l'écran réel, chacun dans un onglet, à la même largeur : 1280 px (`desktop.html`), puis 390 px (`mobile.html`). Enregistrer les quatre captures dans `aidd_docs/captures/US-XXX/` : `T<n>-maquette-<ordinateur|telephone>.png` et `T<n>-ecran-<ordinateur|telephone>.png`.
2. Comparer **zone par zone**, en partant de la maquette : pour chaque zone (en-tête, navigation, titre, chaque bloc, chaque bouton, pied de page), sa présence, sa place, sa taille, ses couleurs, sa typographie, ses textes. Écrire le tableau `| Zone | Maquette | Écran | Écart |` dans « Obtenu », ou juste après le tableau des critères.
3. Conclure : ✅ seulement si aucune zone ne montre d'écart, hors données réelles (noms, nombres, nombre de lignes). Une zone absente, déplacée, empilée au lieu d'être côte à côte, ou d'une autre taille est ❌, même si les couleurs et les textes correspondent.
4. Sans outil de navigateur, ou si l'outil n'enregistre pas les captures : ❓, reporté au test manuel avec le chemin de la maquette à ouvrir à côté de l'écran.

## 3. Mener le contrôle (appelant)

- **Déléguer** : donner à l'implementer le chemin de `retenue/`, les zones de la maquette que la tâche réalise, et la consigne « reproduire la maquette retenue : `pulse-aidd reference fidelite-maquette.md` § 1 ». « Conforme à la maquette » seul ne suffit pas.
- **Contrôler chaque tâche maquettée avant son commit**, même en rythme rapide : `pulse:verifier`, avec le critère « L'écran reproduit la maquette retenue » (§ 2). En rythme rapide, c'est son seul critère, et la seule fois où l'application se lance pendant la tâche.
- **Regarder soi-même les captures** avant de reprendre le verdict : ouvrir les quatre images (outil Read) et les comparer deux à deux. Un écart visible absent de son tableau fait passer le critère à ❌. Sans captures enregistrées, faire la comparaison du § 2 soi-même avec l'outil de navigateur ; sinon ❓.
- **Écart** : relancer l'implementer avec la liste des écarts, zone par zone, puis comparer de nouveau ; deux cycles au plus, comme pour les constats de relecture. Noter le résultat dans le journal du plan (« maquette reproduite, captures regardées » ou les écarts restants).

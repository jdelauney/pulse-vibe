# Partir des documents de la personne

Utilisé par `/pulse:express` et `/pulse:brainstorm` quand la personne arrive avec des documents déjà prêts : un cahier des charges, des notes, des captures d'écran, des maquettes (pages HTML ou images faites avec un autre outil), une présentation.

## 1. Où les trouver

- les fichiers ou dossiers cités dans l'argument de la commande ;
- sinon, le dossier `docs/depart/` du projet, s'il existe.

La personne crée ce dossier elle-même, si elle le souhaite : Pulse le lit, sans le créer. Lire chaque fichier (textes, PDF, images, pages HTML). Un fichier illisible : le dire en une ligne et continuer avec les autres. Un fichier qui semble contenir une clé ou un mot de passe : le signaler, sans recopier la valeur.

## 2. En tirer les réponses

Pour chaque question de l'entretien, chercher la réponse dans les documents. Puis, au début de chaque bloc ou de chaque ronde, montrer ce qui a été compris, avec sa source :

« ✔ D'après vos documents (`cahier-des-charges.pdf`) : l'outil sert aux bénévoles de l'association pour réserver une salle. C'est bien ça ? »

- Confirmé : la question est réglée, elle ne se repose pas.
- Corrigé ou complété : garder la réponse de la personne.
- Absent des documents : poser la question, comme d'habitude.

Une information des documents vaut une **réponse de la personne** (« décidé par vous », `raisonnement.md` § 5) seulement après sa confirmation.

## 3. Les maquettes fournies

Une maquette ou une capture d'écran fournie sert deux fois :

- **les écrans** : la liste des écrans et ce qu'on y voit se déduisent de la maquette, puis se confirment ;
- **l'apparence** : noter dans « Décisions prises » du brief la ligne « Maquettes fournies : `<chemins>` ». L'étape « identite » de `/pulse:ui` part de ces maquettes : une des directions proposées les reprend fidèlement.

Les documents restent où la personne les a mis ; Pulse les cite par leur chemin, sans les recopier.

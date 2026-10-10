# Test manuel

Le test manuel est fait par la personne, dans l'application, comme un utilisateur. Il reste **toujours dû**, même quand des tests automatisés existent : il vérifie ce qu'aucun test ne voit (lisibilité, confort, impression d'ensemble) et la personne constate elle-même que la fonctionnalité marche.

## 1. Préparer la fiche

La personne n'est pas développeuse : la fiche se suit pas à pas, sans rien deviner.

- **Une fiche par tâche**, écrite dans un fichier à côté de la spec : `aidd_docs/tasks/<epic>/SMOKE-TEST-US-XXX-<Tâche>-<titre-de-la-tache>.md` (titre de la tâche en minuscules, sans accent, mots reliés par des tirets ; ex. `SMOKE-TEST-US-003-T4-creer-une-tache.md`), selon le modèle `pulse-aidd modele smoke-test.md`. Un nouveau test après une correction réécrit la même fiche. Pour un test groupé (fin de l'US), une seule fiche complète : `SMOKE-TEST-US-XXX-<nom>.md`.
- **Seulement des gestes dans l'application** : ouvrir une page, cliquer, taper, choisir, regarder. Les contrôles automatiques (formatage, règles du code, types, tests automatiques, construction) sont lancés par l'assistant (§ 4) : la fiche donne leur résultat en une ligne, et ne demande jamais de taper une commande.
- **Chaque geste est précis** : où se trouve l'élément (« en haut à droite », « sous le titre »), son texte exact en gras (**Enregistrer**), ce qu'il faut taper, mot pour mot, avec des données fictives réalistes (« tapez : `Acheter du pain` »). Un terme technique inévitable s'explique en quelques mots.
- **Chaque étape dit ce qu'on doit voir**, concrètement (texte, couleur, place à l'écran), avec une case à cocher : « Cliquez sur **Enregistrer** sans remplir le titre : un message rouge « Le titre est obligatoire » apparaît sous le champ. »
- **« Avant de commencer »** dit comment ouvrir l'application : l'assistant la lance lui-même en arrière-plan (commande « lancer en local » de « Commandes du projet ») avant de donner la fiche, et la fiche donne l'adresse exacte à taper dans le navigateur ; il l'arrête après la réponse de la personne. La fiche se relit aussi plus tard : elle donne donc les gestes pour lancer l'application soi-même, avec la commande exacte, et pour l'arrêter. Puis le compte fictif à utiliser, et ce qu'il faut avoir sous la main.
- **Tout geste technique s'explique** avec les phrases de `pulse-aidd reference gestes.md` § 4 (navigation privée, taille téléphone, console du navigateur…) : « Navigation privée » seul ne suffit pas, la fiche dit comment l'ouvrir.
- Les cas viennent des critères d'acceptation de la tâche (les critères que l'assistant n'a pas pu prouver en premier), des quatre états (`qualite/composants.md`) et des cas refusés ; on garde les rubriques utiles parmi celles du § 2.

## 2. Exemple de fiche : créer, consulter, modifier, supprimer

### Créer
- [ ] Le formulaire s'ouvre.
- [ ] Tous les champs se remplissent.
- [ ] Une saisie invalide affiche un message à côté du champ concerné.
- [ ] Un champ obligatoire vide empêche l'enregistrement.
- [ ] Un message confirme l'enregistrement.
- [ ] L'application mène à la bonne page après l'enregistrement (si prévu).
- [ ] Le nouvel élément apparaît dans la liste.

### Consulter
- [ ] La liste s'affiche correctement.
- [ ] Chaque élément est visible.
- [ ] La page de détail montre toutes les informations.
- [ ] Un indicateur de chargement apparaît pendant l'attente.
- [ ] Sans aucun élément, un message explique que la liste est vide et propose quoi faire.

### Modifier
- [ ] Le formulaire s'ouvre avec les valeurs actuelles.
- [ ] Les changements s'enregistrent.
- [ ] Une saisie invalide est refusée avec un message.
- [ ] Un message confirme la modification.
- [ ] Les nouvelles valeurs s'affichent.

### Supprimer
- [ ] Une confirmation est demandée avant de supprimer.
- [ ] La suppression fonctionne.
- [ ] Un message confirme la suppression.
- [ ] L'élément disparaît de la liste.

### Erreurs
- [ ] Sans connexion internet, un message clair s'affiche et rien ne se perd.
- [ ] Une erreur du serveur affiche un message compréhensible.
- [ ] Les erreurs de saisie s'affichent à côté des champs.
- [ ] Les notifications de succès apparaissent puis disparaissent ; une notification d'erreur reste jusqu'à ce que vous la fermiez.

### Affichage
- [ ] Sur téléphone, tout est lisible et utilisable.
- [ ] Sur tablette, tout est lisible et utilisable.
- [ ] Sur ordinateur, la mise en page est correcte.
- [ ] Le mode sombre fonctionne (si prévu).
- [ ] Un indicateur de chargement apparaît pendant les actions.
- [ ] Les boutons sont désactivés pendant un envoi (pas de double clic).

### Rapidité et propreté
- [ ] La page s'affiche en moins de 2 secondes.
- [ ] La console du navigateur ne montre ni erreur ni avertissement.
- [ ] Les interactions sont fluides.

## 3. Vérification dans le navigateur par l'assistant

Pour une fonctionnalité qui change beaucoup l'interface, l'assistant peut, avec un outil de pilotage du navigateur, faire une première passe avant la personne :

1. Ouvrir la fonctionnalité.
2. Suivre les parcours de la fiche.
3. Essayer les cas limites et les cas refusés.
4. Vérifier l'affichage sur plusieurs tailles d'écran.
5. Vérifier l'accessibilité de base : navigation au clavier, noms des boutons et des champs.

Cette passe prépare le test de la personne et ne le remplace pas.

## 4. Résultat attendu avant de valider

Les contrôles automatiques sont lancés par l'assistant (implementer, verifier, test-runner), qui note leur résultat dans le rapport de relecture et en tête de la fiche. La personne, elle, fait seulement la fiche.

| Contrôle | Attendu |
|---|---|
| Formatage | Appliqué automatiquement |
| Lint | 0 erreur |
| Types | 0 erreur |
| Tests automatisés | Tous au vert |
| Fiche de test (par la personne) | Toutes les cases cochées, ou chaque écart noté et traité |

Les commandes de ces contrôles sont dans « Commandes du projet » de `docs/technical.md`.

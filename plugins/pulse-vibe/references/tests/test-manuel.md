# Test manuel

Le test manuel est fait par la personne, dans l'application, comme un utilisateur. Il reste **toujours dû**, même quand des tests automatisés existent : il vérifie ce qu'aucun test ne voit (lisibilité, confort, impression d'ensemble) et la personne constate elle-même que la fonctionnalité marche.

## 1. Préparer la fiche

- Une fiche **par fonctionnalité**, adaptée à ce qu'elle fait : on garde les rubriques utiles parmi celles du §2, et on retire les autres.
- Chaque ligne est **une action et ce qu'on doit voir**, en mots simples, sans terme technique : « Cliquez sur Enregistrer sans remplir le titre : un message rouge demande le titre. »
- Les cas viennent des critères d'acceptation de la tâche, des quatre états (`qualite/composants.md`) et des cas refusés.
- Une case par ligne ; la personne note ce qui ne correspond pas.

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

| Contrôle | Attendu |
|---|---|
| Formatage | Appliqué automatiquement |
| Lint | 0 erreur |
| Types | 0 erreur |
| Tests automatisés | Tous au vert |
| Fiche de test manuel | Toutes les cases cochées, ou chaque écart noté et traité |

Les commandes de ces contrôles sont dans « Commandes du projet » de `docs/technical.md`.

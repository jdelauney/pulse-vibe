# Présentation des écrans (`/pulse:spec`)

La présentation est une décision de la personne : la poser, sans la choisir à sa place.

Pour chaque écran qui montre des informations ou un formulaire, une ronde (AskUserQuestion, 4 questions au plus, réponse recommandée en premier selon les critères entre parenthèses, avec sa raison en quelques mots ; un écran déjà décidé dans une autre spec reprend sa présentation, sans question) :

- **Montrer les informations** : « Comment présenter <les factures> ? » → « Un tableau, une ligne par <facture> » (beaucoup d'éléments ou de colonnes à comparer) / « Des cartes » (peu d'éléments, une image ou un résumé) / « Une liste simple » (un ou deux renseignements par élément).
- **Créer ou modifier** : « Où créer ou modifier <une facture> ? » → « Sur une page à part » (formulaire long, plus de 5 champs) / « Dans une fenêtre par-dessus la liste » (formulaire court) / « Dans un volet sur le côté » (modifier en gardant la liste sous les yeux) / « Directement dans la liste » (un ou deux champs).
- **Supprimer**, s'il y a lieu : « Supprimer <une facture> : demander confirmation (Recommandé) » / « Supprimer tout de suite, avec la possibilité d'annuler quelques secondes ».

Noter chaque réponse dans la colonne « Présentation » de « Ce que l'utilisateur voit et fait ». Puis proposer (AskUserQuestion) : « Voir 2 ou 3 propositions d'écran à comparer avant de coder (Recommandé) » / « Suivre ces choix, sans maquette » (en rythme rapide du profil de `CLAUDE.md`, la seconde est recommandée). Noter la réponse sur la ligne « Maquettes » de la spec ; « Voir » mène à `/pulse:ui maquettes US-XXX` une fois la spec verrouillée.

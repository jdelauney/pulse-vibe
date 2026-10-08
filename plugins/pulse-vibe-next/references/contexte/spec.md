# Pack Pulse Next.js – pour /pulse:spec

La spec reste au niveau de l'intention : routes, tables, fichiers et recettes se décident dans le plan (consignes du pack pour `/pulse:plan`).

- **Recettes** : si l'US demande une connexion, une liste, des e-mails, des fichiers, un paiement, des langues, une limite de requêtes ou la protection d'un formulaire public, reprendre les scénarios Gherkin de la recette (`pulse-aidd pile recette <nom>`, section « Scénarios Gherkin à ajouter à la spec »), adaptés à l'US (étiquettes `@US-XXX-n`), en reformulant dans les mots de l'utilisateur ce qui nomme une technique.
- **Scénarios** : niveau `@unitaire` pour une règle métier, `@integration` pour une lecture ou une écriture d'informations, `@bout-en-bout` pour le parcours principal, `@securite` pour chaque règle d'accès (une autre personne ne voit ni ne modifie l'information).

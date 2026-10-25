# Pack Pulse Next.js – pour mettre en ligne

**Vercel** (hébergeur), **GitHub** (dépôt) et **Neon** (base) :

- Chaque construction sur Vercel lance les tests, puis les migrations, puis la construction. Un test qui échoue arrête la construction avant toute migration, en Production comme en prévisualisation : la version en ligne reste celle d'avant, même pour un envoi sur `main` fait hors de `/pulse:deploy`, et la prévisualisation n'est pas créée tant que le test échoue.
- **Migrations** : automatiques, avant chaque construction (`scripts/migrer.mjs`). Un échec arrête la construction : la version en ligne reste celle d'avant. Le code de la version précédente sert encore pendant la construction : retirer ou renommer une colonne ou une table, ou changer son type, se fait en deux mises en ligne (d'abord le code qui ne l'emploie plus ou accepte les deux formes, puis la migration).
- Preuve : `pulse-aidd sonder <adresse> --texte "<nom du projet>"`, puis `pulse-aidd seo <adresse> --essentiel`.
- IndexNow (facultatif, si `public/<clé>.txt` existe) : envoi après les preuves, d'après « IndexNow » des consignes Search Console du pack (`pulse-aidd pile reference contexte/search-console.md`).

# Pack Pulse Next.js – pour mettre en ligne sur un serveur

Hébergement `docker` ou `serveur` (ligne « **Hébergement** » de `docs/technical.md`), **GitHub** (dépôt), base sur le serveur ou **Neon** :

- La mise en ligne se lance sur le serveur, après l'envoi sur `main` : `./scripts/deployer.sh` dans le dossier du site, tapé par la personne dans sa session SSH. Il récupère `main`, lance les tests, copie la base si elle est sur le serveur, applique les migrations, construit, puis remplace le site. Une étape qui échoue arrête la suite : la version en ligne reste celle d'avant. Rien ne part en ligne tout seul à l'envoi.
- **Migrations** : lancées par `./scripts/deployer.sh` (`scripts/migrer.mjs`), juste avant que la nouvelle version remplace l'ancienne : le code de la version précédente sert encore pendant la mise en ligne. Retirer ou renommer une colonne ou une table, ou changer son type, se fait en deux mises en ligne (d'abord le code qui ne l'emploie plus ou accepte les deux formes, puis la migration).
- Pas de prévisualisation : une version de travail s'essaie en local (`npm run build`, puis `npm run start`).
- Pas à pas, commandes du serveur et retour arrière : la fiche de l'hébergement, `pulse-aidd pile reference hebergement-docker.md` ou `hebergement-serveur.md`.
- Preuve : `pulse-aidd sonder <adresse> --texte "<nom du projet>"`, puis `pulse-aidd seo <adresse> --essentiel`.
- IndexNow (facultatif, si `public/<clé>.txt` existe) : envoi après les preuves, d'après « IndexNow » des consignes Search Console du pack (`pulse-aidd pile reference contexte/search-console.md`).

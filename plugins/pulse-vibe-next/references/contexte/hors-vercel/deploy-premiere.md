# Pack Pulse Next.js – première mise en ligne sur un serveur

- Suivre la fiche de l'hébergement de `docs/technical.md` : `pulse-aidd pile reference hebergement-docker.md` ou `hebergement-serveur.md`, sections « Ce qu'il faut », « Préparer le serveur », « Variables », puis « Première mise en ligne ». Une étape à la fois : la personne fait l'action sur le serveur (session SSH), puis la vérification se fait avant l'étape suivante. Donner chaque commande exacte, à copier telle quelle.
- Avant : le code est envoyé sur `main` (GitHub) ; le serveur le récupère par `git clone`, puis `git pull` à chaque mise en ligne.
- **Variables** : la personne écrit elle-même le fichier `.env` du serveur ; aucune valeur ne passe par la conversation. `pulse-aidd secrets envoyer` n'écrit pas sur le serveur : il rappelle quoi copier et où. Une valeur à tirer au hasard se tire sur le serveur (`openssl rand -hex 32`), sans quitter le serveur.
- **HTTPS** : Caddy quand rien n'est devant le site ; le proxy du fournisseur sinon, réglé dans son interface : la fiche dit lequel, d'après le fournisseur choisi.
- **Base** : sur le serveur, une copie (`pg_dump`) avant chaque mise en ligne, dans `sauvegardes/` ; Neon : une branche de sauvegarde avant chaque migration (`NEON_API_KEY` et `NEON_PROJECT_ID` dans le `.env` du serveur), comme sur Vercel.
- Le site doit répondre : `pulse-aidd sonder https://<domaine> --texte "<nom du projet>"`, puis `pulse-aidd sonder https://<domaine>/api/sante` (200 quand la base répond).

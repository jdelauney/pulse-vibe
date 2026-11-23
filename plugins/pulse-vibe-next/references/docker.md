# Pack Pulse Next.js – installer Docker Desktop

Pour la base de développement « PostgreSQL dans Docker en local, Neon en ligne ». `/pulse:tech` guide la personne une étape à la fois et attend qu'elle confirme chacune.

1. Télécharger Docker Desktop sur https://www.docker.com/products/docker-desktop/, pour votre système (Mac : puce Apple ou Intel, menu Pomme → « À propos de ce Mac »). Gratuit pour un usage personnel, l'enseignement et les entreprises de moins de 250 personnes et de moins de 10 millions de dollars de chiffre d'affaires ; au-delà, un abonnement payant.
2. Lancer l'installation ; sous Windows, garder cochée l'option « WSL 2 » proposée. Redémarrer l'ordinateur s'il le demande.
3. Ouvrir Docker Desktop et accepter les conditions ; le compte Docker est facultatif (« Skip »). La baleine de la barre des tâches (ou de la barre des menus) indique que Docker tourne.
4. Vérifier, dans un terminal : `docker version` affiche une partie « Server ». Docker Desktop s'ouvre à chaque séance de travail, avant `npm run db:up`.
5. Après le squelette (`--base postgres`) et `npm install` : copier `.env.example` en `.env` (ses adresses locales sont prêtes : identifiants de développement, sans secret), puis `npm run db:up`. La première fois, Docker télécharge PostgreSQL : quelques minutes. Le port 5432 déjà pris (un autre PostgreSQL sur le poste) : arrêter cet autre PostgreSQL, ou changer le premier 5432 de `docker-compose.yml` et celui des deux adresses de `.env`.

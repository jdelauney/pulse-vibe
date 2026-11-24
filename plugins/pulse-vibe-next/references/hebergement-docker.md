# Pack Pulse Next.js – mise en ligne sur un serveur avec Docker

Hébergement `docker` : le site tourne dans un conteneur sur un serveur loué (VPS), à côté de sa base PostgreSQL (ou avec Neon). Lu par `/pulse:tech` (valeurs de `docs/technical.md`) et par `/pulse:deploy` (pas à pas). Guider la personne une étape à la fois ; elle fait l'action, puis la vérification se fait avant l'étape suivante. Les commandes du serveur se tapent dans une session SSH (`ssh <compte>@<adresse du serveur>`, depuis le terminal de l'ordinateur ; sous Windows aussi).

## Valeurs de docs/technical.md

À la place des lignes et sections Vercel des valeurs du pack (`pulse-aidd pile reference technical.md`) :

- Ligne `**Hébergement** : docker`, sous `**Pack de pile Pulse** : next`.
- Tableau « Pile retenue », ligne Hébergement : `Serveur {{fournisseur}} avec Docker : image du site (sortie standalone de Next.js), compose.production.yml ; HTTPS par {{Caddy | le proxy du fournisseur}}`. Ligne Données : `{{PostgreSQL sur le serveur (conteneur db) | Neon (Postgres), région Francfort}}`.
- Commande « Déployer » : `sur le serveur, dans le dossier du site : ./scripts/deployer.sh` (construction et tests dans l'image, copie de la base si elle est sur le serveur, migrations, puis le site) ; retour arrière : `./scripts/deployer.sh retour`.
- Données et contrôle d'accès, « Où sont les données » : le serveur (volume Docker `donnees`) et le pays de son centre de données, ou Neon. « Sauvegarde et restauration » : base sur le serveur, une copie (`pg_dump`) avant chaque mise en ligne dans `sauvegardes/` du serveur (les 7 dernières), plus les sauvegardes du serveur proposées par le fournisseur (à activer) ; Neon : comme les valeurs du pack.
- Secrets : le fichier `.env` du serveur, saisi par la personne (section « Variables » ci-dessous) ; `.env.example` reste le modèle.
- Section « Hébergement et mise en ligne » : le fournisseur et l'offre, le nom de domaine, qui met à jour le système du serveur (mises à jour de sécurité automatiques), Caddy ou le proxy du fournisseur.
- Section « Retour arrière » : celle de cette fiche.

## Ce qu'il faut

- Un **serveur** loué (VPS) sous Ubuntu 26.04 LTS ou 24.04 LTS : 2 Go de mémoire au moins (la construction de l'image en a besoin), 20 Go de disque. Quelques euros par mois chez un fournisseur européen ; prix et pays du centre de données à vérifier chez lui. La personne est responsable du serveur : mises à jour, sécurité, sauvegardes.
- Un **nom de domaine**, dont l'adresse pointe vers le serveur (enregistrement DNS `A`, et `AAAA` si le serveur a une adresse IPv6).
- Le dépôt GitHub du projet, lisible par le serveur.

## Préparer le serveur (une fois)

1. Chez le fournisseur : créer le serveur avec Ubuntu, en ajoutant la **clé SSH** de l'ordinateur (sans clé : `ssh-keygen -t ed25519`, puis la clé publique `~/.ssh/id_ed25519.pub`). Vérifier : `ssh <compte>@<adresse>` ouvre une session sans mot de passe.
2. Mises à jour de sécurité automatiques et pare-feu : `sudo apt update && sudo apt upgrade -y`, `sudo apt install -y unattended-upgrades`, puis `sudo ufw allow OpenSSH`, `sudo ufw allow 80,443/tcp`, `sudo ufw allow 443/udp`, `sudo ufw enable`. Vérifier : `sudo ufw status` liste ces ports.
3. Docker (dépôt officiel, https://docs.docker.com/engine/install/ubuntu/) : suivre « Install using the apt repository », puis `sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`. Ajouter le compte au groupe docker : `sudo usermod -aG docker $USER`, puis fermer et rouvrir la session SSH (ce groupe donne les droits d'administration du serveur : seulement le compte du site). Vérifier : `docker version` affiche une partie « Server » et `docker compose version` répond.
4. Le code : `git clone <adresse du dépôt> site` dans le dossier personnel, puis `cd site`. Dépôt privé : une clé de déploiement en lecture seule (GitHub → le dépôt → Settings → Deploy keys → Add deploy key, la clé publique créée sur le serveur par `ssh-keygen -t ed25519`). Vérifier : `git pull` répond « Already up to date ».

## Variables : le fichier .env du serveur

La personne crée `~/site/.env` sur le serveur (`nano .env`), d'après `.env.example` ; les valeurs ne passent jamais par la conversation. Lignes propres au serveur :

- Toujours : `PULSE_ENV=production`, `SITE_URL=https://<domaine>` (utilisée aussi à la construction de l'image), puis les variables des recettes.
- Base sur le serveur : `COMPOSE_PROFILES=base` et `POSTGRES_PASSWORD=<valeur>` (tirée au hasard sur le serveur : `openssl rand -hex 32`) ; `DATABASE_URL` et `DATABASE_URL_DIRECT` restent absentes : `compose.production.yml` les déduit (base `db`, compte `app`).
- Base Neon : `DATABASE_URL` (adresse « pooled » de la branche principale), `DATABASE_URL_DIRECT` (adresse directe), `NEON_API_KEY` et `NEON_PROJECT_ID` (copie par une branche Neon avant chaque migration, comme sur Vercel) ; sans `COMPOSE_PROFILES=base`.
- HTTPS par Caddy (rien d'autre devant le site) : ajouter `caddy` au profil (`COMPOSE_PROFILES=base,caddy`, ou `caddy` seul avec Neon) et `DOMAINE=<domaine sans https://>`.
- Proxy du fournisseur devant le site : `APP_ECOUTE=0.0.0.0` et `APP_PORT=<port réglé chez lui>`. Docker ouvre ce port même si le pare-feu `ufw` le ferme (https://docs.docker.com/engine/network/packet-filtering-firewalls/) : limiter ce port au proxy chez le fournisseur (réseau privé ou pare-feu du fournisseur).
- Une valeur qui contient `$` s'écrit entre apostrophes (`'…'`) : Docker Compose lit `$` comme une variable.
- Puis `chmod 600 .env`. Vérifier : `docker compose -f compose.production.yml config --quiet` ne dit rien (fichier lisible, variables complètes).

## Première mise en ligne

1. `./scripts/deployer.sh` : la première construction prend plusieurs minutes (tests compris). Elle finit par « ✅ Site en ligne ». Vérifier depuis l'ordinateur : `pulse-aidd sonder https://<domaine> --texte "<nom du projet>"`, puis `pulse-aidd sonder https://<domaine>/api/sante`.
2. Proxy du fournisseur au lieu de Caddy : régler chez lui la redirection du domaine vers le port `APP_PORT` du serveur, et le certificat HTTPS ; puis la même vérification.
3. Un échec : `./scripts/deployer.sh journal` (le site), ou `docker compose -f compose.production.yml logs migrations` (les migrations) ; le message dit la cause. Le site d'avant reste en ligne.

## Mises en ligne suivantes

Envoyer le code sur `main` (`/pulse:deploy`), puis sur le serveur : `cd ~/site && ./scripts/deployer.sh`. Rien ne part en ligne tout seul : chaque mise en ligne se lance sur le serveur. Une variable du `.env` modifiée sert après `./scripts/deployer.sh` (le site redémarre avec elle).

## Retour arrière

- **Le site** : `./scripts/deployer.sh retour` remet l'image d'avant en ligne (une seule version en arrière). La mise en ligne suivante reprend la dernière version de `main`.
- **Les données**, base sur le serveur, seulement si une migration ou une écriture les a abîmées, avec l'accord de la personne (tout ce qui a été écrit depuis la copie est perdu) : `ls sauvegardes/` (la copie d'avant la mise en ligne en cause : `avant-mise-en-ligne-AAAAMMJJ-HHMMSS.dump`, heure UTC), puis `docker compose -f compose.production.yml exec -T db pg_restore --clean --if-exists -U app -d app < sauvegardes/<fichier>.dump`. Base Neon : comme les valeurs du pack (Restore from history).
- **Dans quel ordre** : le site d'abord, puis les données si besoin. Une migration qui ajoute seulement des tables ou des colonnes laisse l'ancienne version fonctionner.
- **Copies hors du serveur** : les copies de `sauvegardes/` disparaissent avec le serveur ; activer les sauvegardes du serveur chez le fournisseur, ou rapatrier une copie de temps en temps (`scp <compte>@<adresse>:site/sauvegardes/<fichier>.dump .`).
- **Répété le** : jamais (date du dernier essai guidé par `/pulse:deploy production`, AAAA-MM-JJ)

Sources : https://nextjs.org/docs/app/api-reference/config/next-config-js/output (2026-11-18) ; https://github.com/vercel/next.js/tree/canary/examples/with-docker ; https://docs.docker.com/compose/how-tos/profiles/ ; https://docs.docker.com/reference/compose-file/services/#depends_on ; https://docs.docker.com/engine/install/ubuntu/ ; https://caddyserver.com/docs/quick-starts/reverse-proxy ; images officielles relevées sur Docker Hub le 2026-11-23 (`node:26-slim`, Node.js 26 LTS ; `postgres:19-alpine` ; `caddy:2.11`).

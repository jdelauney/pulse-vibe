# Pack Pulse Next.js – mise en ligne sur un serveur, sans Docker

Hébergement `serveur` : Node.js tourne directement sur un serveur loué (VPS, ou serveur géré par le fournisseur), lancé par un service systemd. Lu par `/pulse:tech` (valeurs de `docs/technical.md`) et par `/pulse:deploy` (pas à pas). Guider la personne une étape à la fois ; elle fait l'action, puis la vérification se fait avant l'étape suivante. Les commandes du serveur se tapent dans une session SSH (`ssh <compte>@<adresse du serveur>`, depuis le terminal de l'ordinateur ; sous Windows aussi).

## Valeurs de docs/technical.md

À la place des lignes et sections Vercel des valeurs du pack (`pulse-aidd pile reference technical.md`) :

- Ligne `**Hébergement** : serveur`, sous `**Pack de pile Pulse** : next`.
- Tableau « Pile retenue », ligne Hébergement : `Serveur {{fournisseur}} : Node.js (nvm, version de .nvmrc), service systemd du compte du site ; HTTPS par {{Caddy | le proxy du fournisseur}}`. Ligne Données : `{{PostgreSQL installé sur le serveur | Neon (Postgres), région Francfort}}`.
- Commande « Déployer » : `sur le serveur, dans le dossier du site : ./scripts/deployer.sh` (installation, tests, copie de la base si elle est sur le serveur, migrations, construction, redémarrage) ; retour arrière : `./scripts/deployer.sh retour`.
- Données et contrôle d'accès, « Où sont les données » : le serveur et le pays de son centre de données, ou Neon. « Sauvegarde et restauration » : base sur le serveur, une copie (`pg_dump`) avant chaque mise en ligne dans `sauvegardes/` du serveur (les 7 dernières), plus les sauvegardes du serveur proposées par le fournisseur (à activer) ; Neon : comme les valeurs du pack.
- Secrets : le fichier `.env` du serveur, saisi par la personne (section « Variables » ci-dessous) ; `.env.example` reste le modèle.
- Section « Hébergement et mise en ligne » : le fournisseur et l'offre, le nom de domaine, qui met à jour le système du serveur, Caddy ou le proxy du fournisseur.
- Section « Retour arrière » : celle de cette fiche.

## Pourquoi construire sur le serveur

`./scripts/deployer.sh` construit le site sur le serveur, à chaque mise en ligne : le même système que celui qui le fait tourner (certains modules, comme celui qui optimise les images, sont compilés pour un système précis), et rien à copier depuis l'ordinateur. Il y faut 2 Go de mémoire au moins ; la version en ligne continue de répondre pendant la construction, puis le site redémarre sur la nouvelle version en quelques secondes.

## Ce qu'il faut

- Un **serveur** sous Linux avec SSH et systemd : un VPS sous Ubuntu 26.04 LTS ou 24.04 LTS (quelques euros par mois chez un fournisseur européen ; prix et pays du centre de données à vérifier chez lui), ou un serveur géré par le fournisseur. 2 Go de mémoire au moins, 20 Go de disque. Sur un VPS, la personne est responsable du serveur : mises à jour, sécurité, sauvegardes.
- Un **nom de domaine**, dont l'adresse pointe vers le serveur (enregistrement DNS `A`, et `AAAA` si le serveur a une adresse IPv6).
- Le dépôt GitHub du projet, lisible par le serveur.

## Préparer le serveur (une fois)

Le site tourne sous un compte sans droits d'administration : le compte SSH chez un serveur géré, un compte dédié sur un VPS.

1. **VPS** : chez le fournisseur, créer le serveur avec Ubuntu, en ajoutant la **clé SSH** de l'ordinateur (sans clé : `ssh-keygen -t ed25519`, puis la clé publique `~/.ssh/id_ed25519.pub`). Puis, avec le compte administrateur : `sudo apt update && sudo apt upgrade -y`, `sudo apt install -y unattended-upgrades git curl`, le pare-feu (`sudo ufw allow OpenSSH`, `sudo ufw allow 80,443/tcp`, `sudo ufw enable`), et le compte du site : `sudo adduser --disabled-password site`, sa clé SSH (`sudo mkdir -p /home/site/.ssh && sudo cp ~/.ssh/authorized_keys /home/site/.ssh/ && sudo chown -R site:site /home/site/.ssh`), et `sudo loginctl enable-linger site` (le site redémarre avec le serveur, sans session ouverte). Vérifier : `ssh site@<adresse>` ouvre une session sans mot de passe.
   **Serveur géré** (exemple : Serveur Cloud managé d'Infomaniak) : le compte SSH fourni sert de compte du site ; le fournisseur tient le système à jour. Vérifier : `ssh <compte>@<adresse>` ouvre une session, et `systemctl --user status` répond.
2. **Node.js**, sous le compte du site, par nvm (https://github.com/nvm-sh/nvm) : `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash`, puis fermer et rouvrir la session. Vérifier : `nvm --version` répond.
3. **Le code** : `git clone <adresse du dépôt> site`, puis `cd site`. Dépôt privé : une clé de déploiement en lecture seule (GitHub → le dépôt → Settings → Deploy keys → Add deploy key, la clé publique créée sur le serveur par `ssh-keygen -t ed25519`). Vérifier : `git pull` répond « Already up to date ».
4. **La base**, si elle est sur le serveur (sinon Neon : rien à installer) : avec le compte administrateur, `sudo apt install -y postgresql`, puis `sudo -u postgres createuser --pwprompt app` (mot de passe tiré au hasard : `openssl rand -hex 32`, saisi deux fois, gardé pour le `.env`) et `sudo -u postgres createdb --owner app app`. PostgreSQL écoute alors sur le serveur seul. Serveur géré : la base se crée dans l'interface du fournisseur ; noter son adresse. Vérifier : `psql "postgresql://app:<mot de passe>@localhost:5432/app" -c "select 1"`, tapé par la personne.
5. **Le service** : `./scripts/deployer.sh installer` installe la version de Node.js de `.nvmrc` et le service du site (`~/.config/systemd/user/<nom>.service`, d'après `deploiement/site.service`). Vérifier : il finit par « ✅ Node.js … et le service … sont prêts ».

## Variables : le fichier .env du serveur

La personne crée `~/site/.env` sur le serveur (`nano .env`), d'après `.env.example` ; les valeurs ne passent jamais par la conversation. Lignes propres au serveur :

- Toujours : `PULSE_ENV=production`, `SITE_URL=https://<domaine>`, puis les variables des recettes.
- Base sur le serveur : `DATABASE_URL` et `DATABASE_URL_DIRECT`, la même adresse `postgresql://app:<mot de passe>@localhost:5432/app`. Base Neon : les deux adresses de la branche principale, `NEON_API_KEY` et `NEON_PROJECT_ID` (copie par une branche Neon avant chaque migration, comme sur Vercel).
- Proxy du fournisseur devant le site : `PORT=<le port qu'il attend>` et `HOSTNAME=0.0.0.0` (sans proxy, le site écoute sur le port 3000 du serveur seul, derrière Caddy).
- Puis `chmod 600 .env`.

## HTTPS

- **Rien devant le site (VPS)** : Caddy, qui obtient et renouvelle le certificat tout seul. Avec le compte administrateur, installer Caddy (dépôt officiel, https://caddyserver.com/docs/install, « Debian, Ubuntu, Raspbian »), puis copier `deploiement/Caddyfile` en `/etc/caddy/Caddyfile`, y remplacer `www.mon-site.fr` par le domaine, et `sudo systemctl reload caddy`. Vérifier : `curl -I https://<domaine>` répond, une fois le site lancé.
- **Le fournisseur a son proxy** : Caddy est inutile. Exemple, Serveur Cloud managé d'Infomaniak : Manager → le Serveur Cloud → **Fast Installer** → HAProxy → menu ⋮ → **Configure** : le domaine principal vers le port du site, entre 4000 et 4009 (`PORT=4000` et `HOSTNAME=0.0.0.0` dans `.env`) ; le certificat HTTPS se règle dans le Manager, sur le site. L'adresse réelle du visiteur arrive par l'en-tête `X-Forwarded-For` (https://www.infomaniak.com/fr/support/faq/2171/rediriger-le-trafic-web-vers-un-port-specifique).

## Première mise en ligne

1. `./scripts/deployer.sh` : il finit par « ✅ Site en ligne ». Vérifier depuis l'ordinateur : `pulse-aidd sonder https://<domaine> --texte "<nom du projet>"`, puis `pulse-aidd sonder https://<domaine>/api/sante`.
2. Un échec : le message dit l'étape ; `./scripts/deployer.sh journal` montre le journal du site. Le site d'avant reste en ligne.

## Mises en ligne suivantes

Envoyer le code sur `main` (`/pulse:deploy`), puis sur le serveur : `cd ~/site && ./scripts/deployer.sh`. Rien ne part en ligne tout seul : chaque mise en ligne se lance sur le serveur. Une variable du `.env` modifiée sert après le redémarrage : `systemctl --user restart <nom>` (le nom du paquet, dans `package.json`), ou la mise en ligne suivante.

## Retour arrière

- **Le site** : `./scripts/deployer.sh retour` remet en ligne la version d'avant (les 3 dernières restent dans `versions/`). La mise en ligne suivante reprend la dernière version de `main`.
- **Les données**, base sur le serveur, seulement si une migration ou une écriture les a abîmées, avec l'accord de la personne (tout ce qui a été écrit depuis la copie est perdu) : `ls sauvegardes/` (la copie d'avant la mise en ligne en cause : `avant-mise-en-ligne-AAAAMMJJ-HHMMSS.dump`, heure UTC), puis `pg_restore --clean --if-exists --dbname "postgresql://app:<mot de passe>@localhost:5432/app" sauvegardes/<fichier>.dump`, tapé par la personne. Base Neon : comme les valeurs du pack (Restore from history).
- **Dans quel ordre** : le site d'abord, puis les données si besoin. Une migration qui ajoute seulement des tables ou des colonnes laisse l'ancienne version fonctionner.
- **Copies hors du serveur** : les copies de `sauvegardes/` disparaissent avec le serveur ; activer les sauvegardes du serveur chez le fournisseur, ou rapatrier une copie de temps en temps (`scp <compte>@<adresse>:site/sauvegardes/<fichier>.dump .`).
- **Répété le** : jamais (date du dernier essai guidé par `/pulse:deploy production`, AAAA-MM-JJ)

Sources : https://nextjs.org/docs/app/api-reference/config/next-config-js/output (2026-11-18 : sortie standalone, copie de `.env` dans la sortie) ; https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html ; https://www.infomaniak.com/fr/support/faq/2571/installer-et-configurer-systemd-sur-serveur-cloud (service systemd en mode utilisateur) ; https://caddyserver.com/docs/install ; https://github.com/nvm-sh/nvm (v0.41.0, relevée le 2026-11-23).

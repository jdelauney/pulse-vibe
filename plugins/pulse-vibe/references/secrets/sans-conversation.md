# Garder la valeur d'un secret hors de la conversation

Règle : **la valeur va du fournisseur au fichier `.env` par les mains de la personne, puis du fichier à l'hébergeur par un script qui n'affiche rien.** Vous travaillez avec les noms, jamais avec les valeurs.

Pourquoi : tout ce qui passe dans la conversation est enregistré sur l'ordinateur (transcription gardée 30 jours par défaut) et envoyé au service du modèle. Une valeur collée dans la conversation est donc exposée : elle se remplace.

## Les gestes, dans l'ordre

| Étape | Qui | Comment |
|---|---|---|
| Préparer la ligne | vous | `pulse-aidd secrets preparer <NOM>` : ajoute `NOM=` (sans valeur) dans `.env`, crée le fichier s'il manque et vérifie qu'il reste hors de Git |
| Saisir la valeur | la personne | elle ouvre `.env` dans son éditeur, colle la valeur juste après `=`, enregistre, puis **ferme l'onglet** (l'éditeur peut partager un fichier ouvert avec Claude Code) |
| Secret à inventer (clé de session, signature…) | vous | `pulse-aidd secrets generer <NOM>` : écrit une valeur aléatoire dans `.env`, sans l'afficher |
| Contrôler | vous | `pulse-aidd secrets verifier <NOM>` : présence, pièges de copier-coller, préfixe attendu, test réel ; aucun caractère de la valeur n'est affiché |
| Envoyer à l'hébergeur | vous | `pulse-aidd secrets envoyer <NOM> --env production,preview` : la valeur passe par l'entrée standard de l'outil de l'hébergeur, jamais dans une commande visible |
| Valeur propre à la production (clé « live », base de production) | la personne, puis vous | `pulse-aidd secrets preparer <NOM> --fichier .env.envoi` ; la personne y colle la valeur ; `pulse-aidd secrets envoyer <NOM> --env production --depuis .env.envoi --vider` (la ligne est vidée après l'envoi). Pour une variable que le pack marque « propre à chaque environnement », `envoyer` depuis `.env` vers la production s'arrête et rappelle ce chemin ; `--meme-valeur` sert seulement quand la personne confirme que sa valeur locale est aussi celle de la production |
| Redéployer | vous | `pulse-aidd secrets redeployer --env production` |

Sans pack de pile capable d'envoyer à l'hébergeur : la personne colle la valeur elle-même dans les réglages de l'hébergeur ; guidez-la écran par écran, d'après la documentation officielle.

## Ce que vous faites à la place

- Pour connaître les variables : `pulse-aidd secrets inventaire` (noms, présence, type chez l'hébergeur), et `.env.example`.
- Pour savoir si une valeur est la bonne : `pulse-aidd secrets verifier <NOM>`.
- Pour une valeur montrée par un fournisseur (réponse d'une API, page de création) : la personne la copie dans `.env` ; vous lancez seulement des commandes dont la sortie ne contient pas la valeur.
- Pour générer : `pulse-aidd secrets generer`, à la place des générateurs qui affichent leur résultat (`openssl rand`, `npx auth secret`…).
- Une valeur d'identifiant **public** (identifiant de compte, nom de bucket, adresse du site, clé publiable prévue pour le navigateur) peut, elle, passer par la conversation. Le test : « Quelqu'un qui lit cette valeur peut-il agir à la place de la personne ? » Si oui, c'est un secret.

## Protections en place

- Le garde-fou du plugin refuse la lecture de `.env` par les outils de Claude Code et par les commandes qui affichent un fichier (`cat`, `type`, `Get-Content`, `grep`…). `.env.example` reste lisible.
- La règle de Claude Code `permissions.deny` (« `Read(./.env)` », « `Read(./.env.local)` », « `Read(./.env.*.local)` », « `Read(./.env.envoi)` » dans `.claude/settings.json` ; `.env.example` reste lisible, car les recettes y ajoutent des noms) ajoute une seconde protection : proposez-la quand l'inventaire signale qu'elle manque.
- Les scripts de Pulse lisent `.env` dans un processus à part et n'affichent que des statuts.

## Si une valeur arrive quand même dans la conversation

Dites-le tout de suite, sans la répéter, puis enchaînez sur `/pulse:secrets fuite` : la valeur est exposée, elle se révoque et se remplace. Remplacer le texte de la conversation ne suffit pas.

Phrase à donner : « Cette clé est maintenant écrite dans l'historique de notre conversation. Par sécurité, on la change : c'est rapide, je vous guide. »

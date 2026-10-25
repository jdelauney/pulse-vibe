# Le dépôt distant

Utilisé par `/pulse:init`, `/pulse:deploy` et `/pulse:cicd`. L'envoi du travail d'un plan (après chaque tâche, en mode PR) est dans la référence « L'envoi du travail » (`envoi.md`).

À expliquer en deux phrases, la première fois : « Le dépôt distant est une copie de votre projet en ligne (GitHub, GitLab…) : une sauvegarde, et le point de départ de la mise en ligne. Chaque envoi (push) y recopie vos nouvelles versions. »

## 1. Relier le projet à un dépôt distant

**Quand** : `/pulse:init`, une fois le premier commit fait, si `git remote -v` est vide et que la section « Adresses » de `CLAUDE.md` n'indique pas « Dépôt distant : aucun pour l'instant » ; `/pulse:deploy`, si le dépôt distant manque toujours.

Demander (AskUserQuestion) « Relier le projet à un dépôt distant ? » :
- « Oui, en créer un nouveau (Recommandé) » → § 1a ;
- « Oui, j'en ai déjà un » → § 1b ;
- « Non, plus tard » → écrire « Dépôt distant : aucun pour l'instant » dans « Adresses » de `CLAUDE.md` (`/pulse:init` considère alors la question réglée ; `/pulse:deploy` la reposera), et s'arrêter.

**Fournisseur** : celui de « Hébergement et mise en ligne » de `docs/technical.md` s'il est déjà choisi ; sinon le demander (« GitHub (Recommandé) » / « GitLab » / « Autre »), en une phrase : « C'est là que sera rangée la copie en ligne ; GitHub est le plus répandu et la plupart des hébergeurs s'y relient en un clic. »

### 1a. En créer un

Toujours **privé**, au nom du projet (minuscules, tirets), et **vide** : le projet a déjà son README et son fichier d'exclusion.

- **Outil en ligne de commande installé et connecté** (`gh auth status` pour GitHub, `glab auth status` pour GitLab) : proposer la commande de création d'un dépôt privé relié à ce dossier sous le nom `origin`, avec le premier envoi, d'après la documentation officielle de l'outil (GitHub : `gh repo create <nom> --private --source . --remote origin --push` ; GitLab : `glab repo create <nom> --private`, puis § 1b, étape 2, si l'outil n'a pas relié le dossier). L'option `--private` figure toujours en toutes lettres dans la commande : un dépôt public expose pour toujours son historique. La montrer, expliquer chaque partie, puis la lancer : Claude Code demande l'accord de la personne.
- **Sinon** : s'en tenir au site du fournisseur et guider pas à pas (nouveau dépôt, nom, visibilité **privée**, dépôt laissé vide), faire coller l'adresse du dépôt, puis § 1b, étape 2.

### 1b. Relier un dépôt existant

1. Faire coller l'adresse du dépôt (HTTPS ou SSH).
2. Annoncer : « Claude Code va vous demander deux fois votre accord : d'abord pour relier ce projet au dépôt en ligne (un réglage de Git, fait une seule fois), puis pour y envoyer votre travail. » Puis `git remote add origin <adresse>`, puis `git push -u origin <branche courante>`. Une fenêtre de connexion au fournisseur peut s'ouvrir au premier envoi : c'est normal, il faut l'accepter.
3. **Envoi refusé parce que le dépôt contient déjà des fichiers** (un README créé sur le site, par exemple) : expliquer, puis, avec accord : `git pull origin <branche> --allow-unrelated-histories`, régler les éventuels conflits avec la personne (garder les deux contenus en cas de doute), commiter, et renvoyer. Jamais d'envoi forcé.

### 1c. Noter

Inscrire l'adresse dans « Adresses » de `CLAUDE.md` (« Dépôt distant : <adresse> ») et dans `README.md` s'il a une section pour cela ; l'enregistrer (`chore: dépôt distant relié`) et l'envoyer. Si `docs/technical.md` existe et que « Dépôt distant » y est vide, le compléter. Si la pile est déjà choisie et que le projet est encore sans CI, mentionner `/pulse:cicd` (facultatif) : des contrôles automatiques à chaque envoi et sur chaque demande de fusion.

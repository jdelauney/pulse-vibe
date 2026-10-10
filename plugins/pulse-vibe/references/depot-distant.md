# Le dépôt distant et l'envoi du travail

Utilisé par `/pulse:init`, `/pulse:deploy`, `/pulse:commit`, `/pulse:implement` et `/pulse:spirc`.

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
2. `git remote add origin <adresse>`, puis `git push -u origin <branche courante>`. Une fenêtre de connexion au fournisseur peut s'ouvrir au premier envoi : c'est normal, il faut l'accepter.
3. **Envoi refusé parce que le dépôt contient déjà des fichiers** (un README créé sur le site, par exemple) : expliquer, puis, avec accord : `git pull origin <branche> --allow-unrelated-histories`, régler les éventuels conflits avec la personne (garder les deux contenus en cas de doute), commiter, et renvoyer. Jamais d'envoi forcé.

### 1c. Noter

Inscrire l'adresse dans « Adresses » de `CLAUDE.md` (« Dépôt distant : <adresse> ») et dans `README.md` s'il a une section pour cela ; l'enregistrer (`chore: dépôt distant relié`) et l'envoyer. Si `docs/technical.md` existe et que « Dépôt distant » y est vide, le compléter. Si la pile est déjà choisie et que le projet est encore sans CI, mentionner `/pulse:cicd` (facultatif) : des contrôles automatiques à chaque envoi et sur chaque demande de fusion.

## 2. Choisir comment envoyer le travail d'un plan

**Quand** : au démarrage de `/pulse:implement` ou `/pulse:spirc` (dans la même ronde de questions que le mode et le worktree), ou au premier commit d'une tâche du plan, si **un dépôt distant existe** (`git remote -v`) et que la ligne « Envoi » de la vue d'ensemble du plan vaut « à choisir » (ou est absente). Une seule fois par plan : ensuite, la ligne fait foi. Sans dépôt distant : tout reste local, la question est sautée.

Demander (AskUserQuestion) « Comment envoyer le travail de US-XXX sur le dépôt distant ? » :
- « Une version parallèle pour l'US, publiée quand vous l'acceptez sur le site du dépôt (Recommandé) » : les commits vont sur `feat/us-xxx-<nom>`, chacun est envoyé et met à jour une demande de fusion (PR) en brouillon ; la version principale, et le site en ligne, changent seulement à la fusion, faite par la personne sur le site du dépôt. → ligne « **Envoi** : version parallèle (branche `feat/us-xxx-<nom>`) » ;
- « Directement sur la version principale » : chaque tâche enregistrée est envoyée sur `<principale>` ; si le déploiement automatique est en place, **chaque tâche est mise en ligne**. → « **Envoi** : branche principale » ;
- « Ne rien envoyer pour l'instant » : tout reste local. → « **Envoi** : local ».

En mode découverte (règles communes § 1), la question n'est pas posée (sauf dans la ronde de départ de `/pulse:spirc`, avec cette réponse recommandée) : l'envoi prend « Directement sur la version principale », annoncé en une phrase. Chaque tâche y part après le test par la personne (en mode autonome, après le test groupé) ; la personne n'a aucune demande de fusion à accepter elle-même sur le site du dépôt. Chaque envoi passe toujours par la demande d'autorisation de Claude Code : la personne garde l'accord, envoi par envoi.

Écrire la ligne dans la vue d'ensemble du plan (elle fait partie du commit suivant). Le **mode PR** désigne « **Envoi** : version parallèle » ; un plan plus ancien l'écrit « **Envoi** : PR », qui se lit pareil. Pour changer de mode ensuite : `/pulse:refine US-XXX "changer l'envoi"`.

**Préparer la branche (mode PR)**, avant de coder la première tâche :
- dans un worktree : sa branche est déjà `feat/us-xxx-<nom>`, elle est prête ;
- sinon, si la branche courante est une autre que `feat/us-xxx-<nom>` : appliquer l'étape **pr** section A (`pulse-aidd etape pr --sans-communes`) avec cette US (la branche existe déjà : y revenir).
- À chaque reprise du plan (`/pulse:implement`, `/pulse:spirc`) : vérifier qu'on est bien sur cette branche, sinon y revenir (`git switch feat/us-xxx-<nom>`, si toutes les modifications sont enregistrées).

## 3. Envoyer après chaque tâche enregistrée

Appliqué par `/pulse:commit` juste après le commit d'une tâche, selon la ligne « Envoi » de son plan (l'argument `push` envoie toujours, quel que soit le mode) :

- **Version parallèle** (ou **PR**, dans un plan plus ancien) : `git push -u origin feat/us-xxx-<nom>` (jamais `--force`). Si la demande de fusion de cette branche reste à créer (`gh pr view`, `glab mr view`) : appliquer l'étape **pr** section B (`pulse-aidd etape pr --sans-communes`) pour l'ouvrir en brouillon. Sinon, dire en une ligne que la demande est à jour, avec son adresse.
- **Branche principale** : `git push`. La première fois, rappeler que, si le déploiement automatique est en place, la tâche est maintenant en ligne.
- **Local** : tout reste local.
- Envoi refusé (le dépôt distant a des changements plus récents) : expliquer, proposer `git pull` puis un nouvel envoi ; jamais d'envoi forcé.

## 4. Fin du plan, en mode PR

Quand la dernière tâche du plan est enregistrée et envoyée :
1. Proposer de passer la demande « prête » (`gh pr ready`, `glab mr update --ready`, ou le bouton sur le site), après un dernier coup d'œil à l'adresse de prévisualisation si l'hébergeur en fournit une.
2. Rappeler que **la fusion se fait par la personne**, sur le site du dépôt (bouton « Merge ») : Pulse ne fusionne jamais une demande.
3. Après la fusion : `git switch <principale>`, `git pull`, puis supprimer la branche locale (`git branch -d feat/us-xxx-<nom>` ; jamais `-D`). `/pulse:status` le rappelle si la branche traîne.

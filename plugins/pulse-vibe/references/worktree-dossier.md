# Créer, entrer et rassembler un dossier à part

Suite de `pulse-aidd reference worktree.md`, pour `/pulse:implement` et `/pulse:spirc` quand un dossier à part est retenu. `<session>` est l'identifiant de la session, donné par la commande (« Identifiant de cette session »).

## 2. Créer le worktree ou y revenir

Un worktree par user story. Noms : dossier `.claude/worktrees/us-xxx-<nom>`, branche `feat/us-xxx-<nom>` (`US-XXX-<nom>` du plan, en minuscules ; Conventions Git § 5).

1. **Prérequis** : un dépôt Git avec au moins un commit. Le plan, la spec et l'US doivent être **enregistrés dans Git** (le worktree part du dernier commit : un fichier non enregistré en serait absent). Sinon, proposer de les enregistrer d'abord (`docs: spec et plan de US-XXX`).
2. **Noter la branche de départ** : `git rev-parse --abbrev-ref HEAD`. C'est elle qui recevra le travail à la fin.
3. **`.gitignore`** : s'il lui manque `.claude/worktrees/`, l'ajouter (avec accord) et l'enregistrer, sinon Git verrait le worktree comme un dossier à suivre.
4. **Worktree existant** (`git worktree list` montre `.claude/worktrees/us-xxx-<nom>`) : y revenir directement (étape 7).
5. **Créer**, à partir du dernier commit local (plutôt que du dépôt distant, qui a peut-être du retard sur le travail) :
   - branche absente : `git worktree add .claude/worktrees/us-xxx-<nom> -b feat/us-xxx-<nom>` ;
   - branche déjà présente : `git worktree add .claude/worktrees/us-xxx-<nom> feat/us-xxx-<nom>`.
6. **Préparer le dossier** : un worktree contient seulement les fichiers suivis par Git.
   - Copier les fichiers d'environnement locaux du dossier principal (`.env`, `.env.local`, `.env.*` sauf `.env.example`) dans le worktree, en gardant leur contenu confidentiel (jamais affiché ni lu à voix haute) : ils restent locaux et ignorés par Git.
   - Lancer la commande « installer » de « Commandes du projet » (`docs/technical.md`) dans le worktree, si elle existe.
7. **Entrer** : outil `EnterWorktree` avec `path` = le dossier du worktree, puis `pulse-aidd sessions --ici <session>`. Annoncer en une ligne : « Je travaille dans le dossier à part `us-xxx-<nom>` (version parallèle `feat/us-xxx-<nom>`). »
8. Si `EnterWorktree` manque : travailler dans le dossier du worktree en préfixant chaque commande par `cd .claude/worktrees/us-xxx-<nom> &&` et en écrivant les fichiers sous ce chemin ; le dire à la personne.

**Pendant le travail** : tout se passe dans le worktree (code, plan, commits). Pour tester l'appli, la lancer depuis le worktree ; si une autre session la fait déjà tourner, le port peut être pris : utiliser le port proposé par l'outil, et le dire.

## 3. Terminer : rassembler le travail

Quand le plan de l'US est terminé, ou quand la personne s'arrête, lire la ligne « Envoi » du plan, puis demander (AskUserQuestion) :
- **Envoi : version parallèle** (ou « PR », dans un plan plus ancien ; chaque tâche part déjà sur la demande de fusion de l'US) : « Marquer la proposition comme prête à accepter » (plan terminé : § 4 « Fin du plan, en mode PR » de la référence « Le dépôt distant et l'envoi du travail ») / « Garder le dossier à part pour continuer plus tard ». « (Recommandé) » va à la première quand toutes les tâches du plan sont terminées, sinon à « Garder le dossier à part ». Une fois la proposition marquée prête, sortir du dossier à part (outil `ExitWorktree`, puis `pulse-aidd sessions --ici <session>`). La fusion se fait ensuite par la personne, sur le site du dépôt ; le dossier à part reste en place jusque-là, puis `/pulse:status` propose de le supprimer.
- **Autre envoi** (branche principale ou local) : « Rassembler dans `<branche de départ>` maintenant (Recommandé) » (seulement si toutes les tâches traitées sont enregistrées : **Fusionner** ci-dessous) / « Proposer de rassembler sur le site du dépôt (`/pulse:pr`) » / « Garder le dossier à part pour continuer plus tard ».

**Fusionner** :
1. Vérifier que toutes les modifications du worktree sont enregistrées (`git status`). Sinon, s'arrêter : relire et enregistrer d'abord.
2. Sortir : outil `ExitWorktree`, puis `pulse-aidd sessions --ici <session>`.
3. Dans le dossier principal, vérifier qu'on est sur la branche de départ et que la voie est libre pour la fusion (`git status`) : laisser intactes les modifications d'une autre session ; si elles portent sur les mêmes fichiers, proposer d'attendre que l'autre session enregistre son travail.
4. Annoncer en une phrase : « Claude Code va vous demander l'accord pour fusionner : c'est ce qui rassemble le travail du dossier à part dans votre dossier principal. » Puis `git merge --no-ff feat/us-xxx-<nom> -m "merge: US-XXX <titre>"`.
   - **Conflit** : `git merge --abort`, expliquer simplement (« les deux sessions ont modifié les mêmes lignes ») et proposer `/pulse:pr`, qui laisse la fusion se faire sur le site du dépôt, ou `/pulse:get-help`. Préserver le travail de l'autre session : ne jamais résoudre un conflit en l'écrasant.
5. Nettoyer : `git worktree remove .claude/worktrees/us-xxx-<nom>` puis `git branch -d feat/us-xxx-<nom>` (jamais `-D`, ni `--force` : si Git refuse, il reste du travail à fusionner ; le dire et s'arrêter).
6. Lancer `pulse-aidd guide`. Rappeler que le travail reste local pour l'instant : `/pulse:deploy` l'envoie et le vérifie en ligne.

**Demande de fusion** : depuis le worktree, appliquer l'étape **pr** (`pulse-aidd etape pr --sans-communes`, section B) avec la branche `feat/us-xxx-<nom>`. Garder le worktree jusqu'à la fusion sur le site ; ensuite, `/pulse:status` propose de le supprimer.

**Garder** : `ExitWorktree`, puis `pulse-aidd sessions --ici <session>`. Pour reprendre : `/pulse:spirc US-XXX` (ou `/pulse:implement US-XXX <tâche>`) propose de revenir dans le même worktree.

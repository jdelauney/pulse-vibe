# Travailler dans un worktree, et en parallèle

Utilisé par `/pulse:implement` et `/pulse:spirc` (option `-w`, ou sur proposition quand une autre session est ouverte). `<session>` est l'identifiant de la session, donné par la commande (« Identifiant de cette session »).

À expliquer en deux phrases, la première fois : « Un worktree est une deuxième copie de travail du projet, dans un sous-dossier, sur sa propre branche Git. Deux sessions peuvent ainsi avancer en même temps, chacune sur sa user story, sans se marcher dessus ; on rassemble ensuite le travail dans la branche principale. »

## 1. Faut-il un worktree ?

- **Option `-w`** : oui, directement.
- **Sinon**, rechercher les signes d'une autre session au travail sur ce dossier :
  1. `pulse-aidd sessions <session>` : la ligne `autres=N` (N > 0 : une autre session Claude Code est ouverte sur ce dossier) ;
  2. une tâche `[~]` dans le plan d'**une autre US** que celle demandée ;
  3. des modifications non enregistrées (`git status`) étrangères à la tâche demandée.
  4. un worktree existe déjà pour cette US (`git worktree list` montre `.claude/worktrees/us-xxx-<nom>`) : proposer d'y revenir, « Reprendre dans la copie à part du projet (worktree) (Recommandé) » / « Travailler dans le dossier principal ».
- **Au moins un signe** : proposer le worktree (AskUserQuestion) : « Travailler dans une copie à part du projet (worktree) (Recommandé) » / « Continuer dans le dossier principal », en citant le signe trouvé en une ligne. **Aucun signe** : travailler directement dans le dossier principal.
- La commande est **déjà dans un worktree** (`git rev-parse --git-dir` différent de `git rev-parse --git-common-dir`) : y continuer, avec ce worktree.

## 2. Créer le worktree ou y revenir

Un worktree par user story. Noms : dossier `.claude/worktrees/us-xxx-<nom>`, branche `feat/us-xxx-<nom>` (`US-XXX-<nom>` du plan, en minuscules ; Conventions Git § 5).

1. **Prérequis** : un dépôt Git avec au moins un commit. Le plan, la spec et l'US doivent être **enregistrés dans Git** (le worktree part du dernier commit : un fichier non enregistré en serait absent). Sinon, proposer de les enregistrer d'abord (`docs: spec et plan de US-XXX`).
2. **Noter la branche de départ** : `git rev-parse --abbrev-ref HEAD`. C'est elle qui recevra le travail à la fin.
3. **`.gitignore`** : s'il lui manque `.claude/worktrees/`, l'ajouter (avec accord) et l'enregistrer, sinon Git verrait le worktree comme un dossier à suivre.
4. **Worktree existant** (`git worktree list` montre `.claude/worktrees/us-xxx-<nom>`) : y revenir directement (étape 7).
5. **Créer**, à partir du dernier commit local (plutôt que du dépôt distant, qui a peut-être du retard sur le travail) :
   - branche absente : `git worktree add .claude/worktrees/us-xxx-<nom> -b feat/us-xxx-<nom>` ;
   - branche déjà présente : `git worktree add .claude/worktrees/us-xxx-<nom> feat/us-xxx-<nom>`.
6. **Préparer la copie** : un worktree contient seulement les fichiers suivis par Git.
   - Copier les fichiers d'environnement locaux du dossier principal (`.env`, `.env.local`, `.env.*` sauf `.env.example`) dans le worktree, en gardant leur contenu confidentiel (jamais affiché ni lu à voix haute) : ils restent locaux et ignorés par Git.
   - Lancer la commande « installer » de « Commandes du projet » (`docs/technical.md`) dans le worktree, si elle existe.
7. **Entrer** : outil `EnterWorktree` avec `path` = le dossier du worktree, puis `pulse-aidd sessions --ici <session>`. Annoncer en une ligne : « Je travaille dans le worktree `us-xxx-<nom>` (branche `feat/us-xxx-<nom>`). »
8. Si `EnterWorktree` manque : travailler dans le dossier du worktree en préfixant chaque commande par `cd .claude/worktrees/us-xxx-<nom> &&` et en écrivant les fichiers sous ce chemin ; le dire à la personne.

**Pendant le travail** : tout se passe dans le worktree (code, plan, commits). Pour tester l'appli, la lancer depuis le worktree ; si une autre session la fait déjà tourner, le port peut être pris : utiliser le port proposé par l'outil, et le dire.

## 3. Terminer : rassembler le travail

Quand le plan de l'US est terminé, ou quand la personne s'arrête, lire la ligne « Envoi » du plan, puis demander (AskUserQuestion) :
- **Envoi PR** (chaque tâche part déjà sur la demande de fusion de l'US) : « Marquer la proposition comme prête à accepter (Recommandé) » (plan terminé : § 4 « Fin du plan, en mode PR » de la référence « Le dépôt distant et l'envoi du travail ») / « Garder le dossier à part pour continuer plus tard ». La fusion se fait ensuite par la personne, sur le site du dépôt ; le dossier à part reste en place jusque-là, puis `/pulse:status` propose de le supprimer.
- **Autre envoi** (branche principale ou local) : « Rassembler dans `<branche de départ>` maintenant (Recommandé) » (seulement si toutes les tâches traitées sont enregistrées : **Fusionner** ci-dessous) / « Proposer de rassembler sur le site du dépôt (`/pulse:pr`) » / « Garder le dossier à part pour continuer plus tard ».

**Fusionner** :
1. Vérifier que toutes les modifications du worktree sont enregistrées (`git status`). Sinon, s'arrêter : relire et enregistrer d'abord.
2. Sortir : outil `ExitWorktree`, puis `pulse-aidd sessions --ici <session>`.
3. Dans le dossier principal, vérifier qu'on est sur la branche de départ et que la voie est libre pour la fusion (`git status`) : laisser intactes les modifications d'une autre session ; si elles portent sur les mêmes fichiers, proposer d'attendre que l'autre session enregistre son travail.
4. Annoncer en une phrase : « Claude Code va vous demander l'accord pour fusionner : c'est ce qui rassemble le travail de la copie à part dans votre dossier principal. » Puis `git merge --no-ff feat/us-xxx-<nom> -m "merge: US-XXX <titre>"`.
   - **Conflit** : `git merge --abort`, expliquer simplement (« les deux sessions ont modifié les mêmes lignes ») et proposer `/pulse:pr`, qui laisse la fusion se faire sur le site du dépôt, ou `/pulse:get-help`. Préserver le travail de l'autre session : ne jamais résoudre un conflit en l'écrasant.
5. Nettoyer : `git worktree remove .claude/worktrees/us-xxx-<nom>` puis `git branch -d feat/us-xxx-<nom>` (jamais `-D`, ni `--force` : si Git refuse, il reste du travail à fusionner ; le dire et s'arrêter).
6. Lancer `pulse-aidd guide`. Rappeler que le travail reste local pour l'instant : `/pulse:deploy` ou `/pulse:commit push`.

**Demande de fusion** : depuis le worktree, appliquer l'étape **pr** (`pulse-aidd etape pr --sans-communes`, section B) avec la branche `feat/us-xxx-<nom>`. Garder le worktree jusqu'à la fusion sur le site ; ensuite, `/pulse:status` propose de le supprimer.

**Garder** : `ExitWorktree`, puis `pulse-aidd sessions --ici <session>`. Pour reprendre : `/pulse:implement US-XXX` ou `/pulse:spirc US-XXX` propose de revenir dans le même worktree.

## 4. Suggérer une US à mener en parallèle

Une seule fois par commande, au démarrage (après le choix du mode et du worktree), en simple information :

1. Lire la ligne « En parallèle avec » du plan de l'US en cours.
2. Garder les US citées dont le plan a encore des tâches `[ ]`, aucune tâche `[~]`, et pas de worktree en cours (`git worktree list` : pas de `.claude/worktrees/us-xxx-…` pour elles) : elles sont libres.
3. S'il en reste, l'indiquer en deux lignes, la première dans l'ordre du parcours :
   « 💡 US-004 – <titre> peut avancer en même temps que celle-ci, sans toucher aux mêmes fichiers. Si vous le souhaitez, ouvrez une deuxième session Claude Code dans ce projet et lancez-y `/pulse:spirc US-004` : Pulse lui proposera son propre worktree. »
4. Sinon, passer directement à la suite. Laisser la personne lancer elle-même la deuxième session (plutôt qu'une session ou un sous-agent lancé à sa place) : c'est elle qui décide de travailler à deux sessions.

Les tâches d'**un même plan** se mènent l'une après l'autre : elles touchent souvent les mêmes fichiers, et chacune est testée à la main avant la suivante.

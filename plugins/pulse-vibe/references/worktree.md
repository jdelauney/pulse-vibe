# Travailler dans un worktree, et en parallèle

Utilisé par `/pulse:implement` et `/pulse:spirc` (option `-w`, ou sur proposition quand une autre session est ouverte). `<session>` est l'identifiant de la session, donné par la commande (« Identifiant de cette session »).

À expliquer en deux phrases, la première fois : « Un worktree est un dossier à part du projet, sur sa propre version parallèle (une branche Git). Deux sessions peuvent ainsi avancer en même temps, chacune sur sa user story, sans se gêner ; on rassemble ensuite le travail dans la version principale. »

## 1. Faut-il un worktree ?

- **Option `-w`** : oui, directement.
- **Sinon**, rechercher les signes d'une autre session au travail sur ce dossier :
  1. `pulse-aidd sessions <session>` : la ligne `autres=N` (N > 0 : une autre session Claude Code est ouverte sur ce dossier) ;
  2. une tâche `[~]` dans le plan d'**une autre US** que celle demandée ;
  3. des modifications non enregistrées (`git status`) étrangères à la tâche demandée.
  4. un worktree existe déjà pour cette US (`git worktree list` montre `.claude/worktrees/us-xxx-<nom>`) : proposer d'y revenir, « Reprendre dans le dossier à part (Recommandé) » / « Travailler dans le dossier principal ».
- **Au moins un signe** : proposer le worktree (AskUserQuestion) : « Travailler dans un dossier à part (Recommandé) » / « Continuer dans le dossier principal », en citant le signe trouvé en une ligne. **Aucun signe** : travailler directement dans le dossier principal.
- La commande est **déjà dans un worktree** (`git rev-parse --git-dir` différent de `git rev-parse --git-common-dir`) : y continuer, avec ce worktree.

Créer, entrer, rassembler : `pulse-aidd reference worktree-dossier.md`.

## 4. Suggérer une US à mener en parallèle

Une seule fois par commande, au démarrage (après le choix du mode et du worktree), en simple information :

1. Lire la ligne « En parallèle avec » du plan de l'US en cours.
2. Garder les US citées dont le plan a encore des tâches `[ ]`, aucune tâche `[~]`, et pas de worktree en cours (`git worktree list` : pas de `.claude/worktrees/us-xxx-…` pour elles) : elles sont libres.
3. S'il en reste, l'indiquer en deux lignes, la première dans l'ordre du parcours :
   « 💡 US-004 – <titre> peut avancer en même temps que celle-ci, sans toucher aux mêmes fichiers. Si vous le souhaitez, ouvrez une deuxième session Claude Code dans ce projet et lancez-y `/pulse:spirc US-004` : Pulse lui proposera son propre dossier à part. »
4. Sinon, passer directement à la suite. Laisser la personne lancer elle-même la deuxième session (plutôt qu'une session ou un sous-agent lancé à sa place) : c'est elle qui décide de travailler à deux sessions. Sauf dans une série (`spirc/serie.md`), avec son accord.

Les tâches d'**un même plan** se mènent l'une après l'autre : elles touchent souvent les mêmes fichiers, et chacune est testée à la main avant la suivante.

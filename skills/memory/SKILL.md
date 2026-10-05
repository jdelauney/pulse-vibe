---
description: Créer, actualiser ou enrichir la mémoire du projet (choix, mots du métier, pièges), chargée par l'IA à chaque session
argument-hint: "[creer | actualiser | retenir \"leçon ou décision\"]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Read Glob Grep Bash(git status *) Bash(git log *) Bash(git diff *)
---

# /pulse:memory – La mémoire du projet

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte memory`

Appliquer les « Règles communes Pulse » et les « Règles de la mémoire projet » ci-dessus pendant toute la commande. Les modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte memory` et lire sa sortie.

Action demandée : `$ARGUMENTS`

## Ce que fait cette commande (à dire en 3 lignes)

« L'IA oublie tout d'une conversation à l'autre. La mémoire du projet lui rappelle à chaque session vos choix, vos mots et les pièges déjà rencontrés. Je vous montre chaque ajout avant de l'écrire. »

## Choisir l'action

- `creer` : la mémoire n'existe pas, ou elle est incomplète.
- `actualiser` : vérifier que la mémoire correspond encore au projet, puis corriger.
- `retenir "…"` : noter une leçon, une convention, un mot du métier ou une décision.
- Argument vide : si `aidd_docs/memory/` n'existe pas, faire `creer`. Sinon, demander (AskUserQuestion) : « Noter quelque chose (retenir) » / « Vérifier qu'elle est à jour (actualiser) » / « Compléter ce qui manque (creer) ».

Prérequis commun : `CLAUDE.md` doit exister. Sinon, proposer `/pulse:init` et s'arrêter.

## Action `creer`

1. **Lire le projet** : `CLAUDE.md`, les documents de `docs/` (brief, PRD, user stories, spec, plan), `docs/technical.md` s'il existe, le code du projet en suivant son « Organisation des fichiers » (ou, à défaut, les dossiers de code observés : sources, schéma des données, code serveur, configuration), `git log --oneline -20`. Ne rien demander que ces fichiers permettent de savoir.
2. **Créer ce qui manque**, sans rien remplacer :

   | À créer s'il manque | Modèle |
   |---|---|
   | `aidd_docs/memory/README.md` | Modèle : aidd_docs/memory/README.md |
   | `aidd_docs/memory/project.md` | Modèle : aidd_docs/memory/project.md |
   | `aidd_docs/memory/technical.md` | Modèle : aidd_docs/memory/technical.md |
   | `aidd_docs/memory/glossary.md` | Modèle : aidd_docs/memory/glossary.md |
   | `aidd_docs/memory/internal/.gitkeep`, `aidd_docs/memory/external/.gitkeep` | fichiers vides |

3. **Remplir** les fichiers créés à partir de ce qui a été lu, selon les règles de la mémoire : vision et périmètre depuis le brief et le PRD, pile et conventions depuis la spec et le code, mots du métier depuis le brief. Ce que les fichiers ne disent pas reste absent (pas de `{{…}}` inventé) ; le signaler à la fin.
4. **Montrer** le contenu proposé, fichier par fichier, en version courte. Demander (AskUserQuestion) : « Écrire tel quel (recommandé) » / « Modifier quelque chose ».
5. **Brancher la mémoire** : voir « Brancher et synchroniser » ci-dessous.

## Action `actualiser`

Ne rien modifier avant l'accord de la personne.

1. **Comparer** chaque fichier de `aidd_docs/memory/` avec le projet réel (`docs/`, code, `git log`). Relever :
   - une affirmation que le code ou les documents contredisent, ou devenue fausse ;
   - un fichier ou une commande cités qui n'existent pas ;
   - un fait présent à deux endroits (garder un seul endroit) ;
   - un choix, une convention ou un piège visibles dans le projet mais absents de la mémoire ;
   - un mot du métier employé dans `docs/` ou le code mais absent du glossaire, ou employé dans deux sens ;
   - un `{{…}}`, une section vide ou un commentaire de modèle restant ;
   - un secret ou une donnée personnelle réelle (à retirer en priorité).
2. **Présenter** les constats en liste numérotée courte : fichier, constat, correction proposée.
   Rien à signaler : dire que la mémoire est à jour, puis passer à « Brancher et synchroniser ».
3. **Demander** (AskUserQuestion, choix multiples) quelles corrections appliquer. Appliquer uniquement celles-là, ligne par ligne.

## Action `retenir`

1. **Comprendre** ce qui est à retenir (l'argument, ou à défaut la conversation en cours). Si c'est flou, poser **une** question.
2. **Écarter** ce qui n'a pas sa place : une préférence passagère, une note de travail, une chose que le code montre déjà, un secret. L'expliquer en une phrase.
3. **Choisir la destination** avec le tableau « Où va chaque information » des règles. Pour une décision, vérifier les **3 conditions** d'un fichier de décision ; sinon, une ligne datée suffit.
4. **Vérifier les doublons et contradictions** : si la mémoire dit déjà la même chose, ne rien ajouter ; si elle dit le contraire, proposer de **remplacer** l'ancienne ligne.
5. **Montrer** la ligne exacte (ou le fichier de décision) et sa destination. Demander : « Ajouter (recommandé) » / « Modifier » / « Ne pas retenir ».
6. Écrire, puis « Brancher et synchroniser ».

## Brancher et synchroniser (fin de chaque action)

1. Lancer `pulse-aidd memoire`.
2. Si la sortie indique que **le bloc mémoire est absent** de `CLAUDE.md` : remplacer l'ancienne section « Gestion de la mémoire (AIDD) » si elle existe, sinon ajouter en fin de fichier, avec le « Modèle : bloc mémoire de CLAUDE.md ». Ne rien changer d'autre dans `CLAUDE.md`. Relancer `pulse-aidd memoire`.
3. Si la sortie indique **un seul marqueur** : remettre la paire de marqueurs telle que dans le modèle, puis relancer.
4. Vérifier que la liste affichée correspond aux fichiers de `aidd_docs/memory/`.

Expliquer en une phrase : « À la prochaine session, l'IA chargera automatiquement ces fichiers. »

Terminer avec le bloc de fin de commande. Prochaine étape : la commande où vous en étiez (`/pulse:status` pour la retrouver).

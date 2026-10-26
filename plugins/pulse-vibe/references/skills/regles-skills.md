# Les règles des skills (K1 à K14)

Utilisé par les commandes Pulse qui créent, auditent et optimisent une skill, et par leur agent de relecture. Tirées du refactoring d'optimisation de Pulse (octobre 2026 : contexte −31 %, qualité égale ou meilleure). Elles valent pour toute skill Claude Code (dossier avec son `SKILL.md`) : du projet (`.claude/skills/`), de l'utilisateur (`~/.claude/skills/`) ou d'un plugin (`skills/`, avec ses `agents/`). Un autre format (règles Cursor, `AGENTS.md`) est « hors format ».

## Lire une règle

- **Niveau** : *universelle* = vaut pour toute skill ; *convention* = recommandée : « conseil », ou « à corriger » dans un plugin Pulse (`pulse`, `pulse-next`).
- **Gravité** : *bloquant* = skill fausse ou risquée, à corriger avant usage (code 1 de `pulse-aidd skill verifier`) ; *à corriger* = perte de qualité ou de contexte mesurable ; *conseil* = amélioration.
- **Vérification** : *script* = `pulse-aidd skill verifier <chemin>` donne le constat (`K<n> · gravité · fichier:ligne · message`), `pulse-aidd skill mesurer <chemin>` donne les tailles ; *jugement* = la question à trancher en lisant la skill.
- **Jetons estimés** : caractères ÷ 3,5 (une estimation, dite comme telle).
- **Bloquant**, en tout : description absente ou de plus de 1 024 caractères (K2) ; geste sensible autorisé d'avance ou motif trop large (K4) ; fin du Processus au-delà des 5 000 premiers jetons estimés, sans ligne de rechargement (K5) ; fichier ou sortie lue par un outil de plus de 30 000 caractères (K7) ; outil cité dans les consignes d'un agent sans lui être disponible (K11).

## K1 – Une skill, un travail

Universelle · à corriger · jugement, aidé du script.

Donner à chaque skill un seul travail, que son nom et sa description disent. Deux skills qui font le même travail se fusionnent ; deux skills qui se recoupent disent chacune ce qui les distingue.

- Script : `recoupement:` de `mesurer` sur un dossier (6 lignes identiques ou plus entre deux skills).
- Jugement : « Quelle autre skill fait déjà ce travail ? Celle-ci sert-elle encore ? » Avec l'usage observé (`pulse-aidd skill usage`, après l'accord de la personne), une skill jamais lancée est signalée « non observée sur la période » et reste en place ; une skill d'incident, de sécurité, de reprise ou de migration garde sa place pour ce seul motif.
- Avant → après : `/pulse:implement` sans tâche refaisait la boucle de `/pulse:spirc` → implement réalise une tâche, et renvoie à spirc pour le reste.

## K2 – La description : capacité, puis déclencheurs

Universelle · bloquant si absente ou de plus de 1 024 caractères ; à corriger sans « À utiliser quand » pour une skill invocable par le modèle ; conseil au-delà de 300 caractères chargés en permanence · script et jugement.

Commencer par ce que la skill fait, en une phrase. Skill que le modèle peut lancer : ajouter « À utiliser quand … » (ou « Use when … ») et les mots de la personne. Viser 50 à 300 caractères. La description d'une skill invocable par le modèle, et celle de chaque agent, restent chargées en permanence : chaque caractère compte. Une skill lancée seulement par la personne garde une description courte de capacité. Une description qui contient « : » s'écrit entre guillemets.

- Script : présence, longueur, « À utiliser quand », deux-points hors guillemets ; en-tête illisible = description absente.
- Jugement : « Les phrases réelles de la personne déclenchent-elles cette skill, et seulement elle ? »
- Avant → après : descriptions des agents « … Utilisé par /pulse:review et /pulse:spirc » (1 Ko chargé en permanence) → « … en lecture seule (commandes Pulse) ».

## K3 – Qui lance la skill

Convention · conseil (à corriger dans un plugin Pulse) · script (présence de `disable-model-invocation`) et jugement.

Mettre `disable-model-invocation: true` à une skill qui a des effets : elle écrit, envoie, coûte ou charge beaucoup de contexte. La personne la lance par `/<nom>`. Une skill sans effet, utile au modèle en plein travail, reste invocable, avec une description qui la déclenche (K2). Une skill qu'une autre appelle comme étape reste invocable, ou se charge par un outil (dans Pulse : `pulse-aidd etape <commande> --sans-communes`).

- Avant → après : `/pulse:explain` invocable aurait chargé 27 Ko à chaque « explique » d'une réalisation → lancée par la personne ; une ligne du `CLAUDE.md` du projet propose `/pulse:status` à qui se dit perdu.

## K4 – Des autorisations précises

Universelle · bloquant (geste sensible autorisé d'avance, motif trop large) ; à corriger (`Write` ou `Edit` sans chemin) · script et jugement.

Écrire dans `allowed-tools` des motifs précis : `Bash(git status *)`, `Write(docs/**)`. Laisser passer par la demande d'accord de Claude Code les envois (`git push`), suppressions (`rm`, `git clean`, `git branch -D`), fusions, envois forcés, changements de configuration (`git config`, `git remote`, `.claude/settings.json`) et gestes de production (mise en ligne, secrets). Chaque commande que la skill ou ses références font lancer est couverte par un motif, et chaque motif sert.

- Script : motifs trop larges (`Bash`, `Bash(*)`, `Bash(git *)`, `Bash(npm *)`, `Bash(node *)`, `Bash(pulse-aidd *)`…) et motifs qui couvrent un geste sensible.
- Avant → après : `Bash(git branch -M main)` dans deploy, qui écrase une `main` existante → `git branch -m`, qui échoue proprement ; `Bash(git remote add origin *)` → demande d'accord annoncée.

## K5 – Trame et compaction

Position du Processus : universelle, bloquant (à corriger avec une ligne de rechargement placée tôt) · trame des sections : convention · script et jugement.

Placer le Processus tôt : sa fin tient dans les 5 000 premiers jetons estimés du `SKILL.md`, car une compaction en garde seulement le début. Sinon, écrire dans ce début une ligne qui parle de compaction et cite la commande qui réaffiche les consignes (dans Pulse, `pulse-aidd etape` de la commande ; ailleurs, la lecture de son `SKILL.md`). Trame recommandée : Objectif, Règles, Contexte, Rôle (facultatif), Processus, Exemples, Références. Une injection dynamique (``!`commande` ``) ferme le fichier, après le Processus, suivie d'une ligne de repli qui dit comment recharger ce qu'elle apporte (« Si ce contexte est absent, lancer … et lire sa sortie »).

- Script : `processus-fin:` de `mesurer` ; sections présentes ; injection placée avant la fin du Processus.
- Jugement : « Après une compaction, la skill sait-elle encore quoi faire ? »
- Avant → après : 22,9 k de règles communes injectés avant le Processus → injection `!pulse-aidd contexte <commande>` en dernière section, Processus dans les premiers jetons.

## K6 – Charger à l'étape qui sert

Universelle · à corriger · jugement, aidé des tailles de `mesurer`.

Garder dans le `SKILL.md` le déroulé. Mettre le détail d'un mode ou d'une étape dans `references/`, chargé à l'étape qui le sert, avec sa condition (« Pour une première mise en ligne : lire `premiere.md` »). Ranger les modèles dans `assets/`, lus au moment d'écrire. Chaque texte chargé au lancement sert à chaque lancement.

- Jugement : « Ce texte sert-il à chaque lancement ? Sinon, à quelle étape ? »
- Avant → après : `/pulse:deploy` chargeait la première mise en ligne et la production à chaque mise à jour (52 861 octets) → une référence par mode, lue dans ce mode (21 766 octets).

## K7 – Sous la limite de lecture

Universelle · bloquant au-delà de 30 000 caractères lus par un outil ; à corriger pour une injection trop longue ou une règle coupée · script.

Garder chaque sortie lue par un outil (fichier, commande) sous 30 000 caractères : au-delà, Claude Code l'enregistre dans un fichier et en montre seulement un aperçu. Scinder en appels séparés. Une injection (``!`commande` ``) se charge en entier, mais à chaque lancement : la mesurer, et la scinder si possible. Lire les règles en entier, sans `head`, `tail` ni tube qui les coupe.

- Script : taille de chaque fichier de `references/` et `assets/` (données JSON, YAML ou CSV, souvent lues par un script : à corriger) et de chaque injection `!pulse-aidd …` (les autres : « non mesurée ») ; `head` ou `tail`.
- Avant → après : le reviewer lisait la checklist sécurité par `| head -60` (points S10 à S13 jamais lus) → une commande par famille, lue en entier.

## K8 – Un fait, un seul endroit

Universelle · à corriger · script (`recoupement:` sur un dossier) et jugement.

Écrire une règle partagée par plusieurs skills dans une référence commune ; chaque skill y renvoie. Une règle propre à une skill reste dans ses `references/`.

- Avant → après : délégation à l'implementer recopiée dans spirc et implement (2,2 Ko chacune) → `references/deleguer.md`, lu par les deux.

## K9 – Des consignes positives

Universelle · conseil dès 3 tournures négatives dans un fichier · script (comptage) et jugement.

Dire quoi faire. Garder une interdiction pour la sécurité ou l'irréversible, avec son alternative (« Pour défaire un travail envoyé : `git revert`, l'historique reste intact »).

- Avant → après : « Jamais `--force` », répété dans quatre commandes alors que le garde-fou le refuse → retiré ; la règle commune dit comment envoyer.

## K10 – Le travail déterministe dans un script

Convention · conseil (à corriger dans un plugin Pulse) · jugement.

Confier à un script ce qui se compte, se contrôle ou se déplace : contrôles, comptages, déplacements de fichiers, gestes Git. Le script refuse d'avance plutôt que de défaire après, et sort avec un code clair : 0 fait, 1 usage, 2 refus avant tout changement, 3 échec rattrapé (état d'avant remis). La skill lance le script et suit son verdict.

- Avant → après : `/pulse:pr` déplaçait les commits à la main (`switch -c`, puis `branch -f`) → `pulse-aidd deplacer-commits <branche>`, qui vérifie avant et après.

## K11 – Les agents

Outils cités : universelle, bloquant · `model` explicite : convention · script et jugement.

Donner à chaque agent les outils que ses consignes citent (listés dans `tools`, ou absents de `disallowedTools`), et une liste Bash « seulement pour … » qui nomme chaque commande demandée. Écrire `model` (`haiku`, `sonnet`, `opus`). Le message de délégation donne des chemins, pas des recopies. Une preuve produite par un agent (tests lancés, contrôle passé) est réutilisée par les suivants.

- Avant → après : designer et ui-critic devaient lancer `pulse-aidd contraste`, absent de leur liste Bash → ajouté ; tests lancés 27 fois par essai → preuve unique réutilisée (15).

## K12 – Les validations gardées

Universelle · à corriger ; en relecture avant / après, une perte se corrige avant le bilan · jugement.

Raccourcir une skill en gardant chaque question clé, validation, point d'arrêt et garde-fou. Poser une question clé à la fois, l'option recommandée en premier.

- Jugement : « Comparée à l'avant, la skill pose-t-elle les mêmes questions, aux mêmes arrêts, avec les mêmes refus ? »
- Avant → après : `/pulse:us` posait ses questions clés en bloc → une à une, en réponse libre ; aucune retirée.

## K13 – Parler au destinataire

Convention · conseil (à corriger dans un plugin Pulse) · jugement.

Écrire ce qui est montré dans la langue et le registre du destinataire déclaré par la skill. Pour Pulse : une personne sans expérience en programmation, vouvoyée, phrases courtes, mots de tous les jours ; un terme technique inévitable s'explique en mots simples la première fois (« la description, la phrase qui dit à Claude quand utiliser la skill »).

- Avant → après : « sous-agent » dans les pages lues par la personne → « assistant ».

## K14 – Mesurer avant et après

Universelle · à corriger · script (`mesurer`).

Mesurer avant de changer, puis après : taille chargée au lancement, taille de chaque forme lue (référence, injection, sortie de commande). Un plafond de taille baisse avec le gain ; il monte seulement avec la mesure et la raison.

- Avant → après : « plus léger » → `/pulse:tech` chargeait 81 629 octets, 43 337 après (−47 %), plafond du test abaissé à la mesure.

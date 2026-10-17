# Une série d'US : préparer d'abord, construire ensuite

Utilisé par `/pulse:spirc` quand il reçoit plusieurs US (`/pulse:spirc US-001 US-003`) ou `version` (toutes les US Indispensables encore à faire). À expliquer en deux phrases, la première fois : « On prépare d'abord toutes ces user stories ensemble : leurs specs et leurs plans, que vous validez. Ensuite je les réalise à la suite, sans vous déranger, et vous revenez pour les questions mises de côté et les tests. »

## 1. Composer la série

- **Les US** : celles demandées (`version` : les US Indispensables de `docs/user-stories.md`), dans l'**ordre du parcours** (« Ordre de réalisation » du référentiel). Retirer celles dont le plan est terminé, en le disant en une ligne.
- **Où en est chacune** : à spécifier, spec en brouillon, à planifier, plan à valider, prête (plan validé), en cours.
- Annoncer la série en un tableau court (US, titre, ce qui reste), puis écrire `aidd_docs/tasks/in-progress.md` (règle commune 16) : Commande `/pulse:spirc <les US de la série>`, et une section « Série » qui donne l'état de chaque US (à préparer, prête, en cours, en attente : <la question exacte>, terminée). Ce fichier se met à jour à chaque changement d'état ; il est la mémoire de la série, à relire plutôt que la conversation.

## 2. La ronde de départ, une seule fois

La ronde de départ de `/pulse:spirc` vaut pour **toute la série** (rythme, options, tests, envoi), posée une seule fois. Une série se construit toujours **en mode autonome** (`-a`) : le dire dans l'annonce des choix.

- **Envoi** : « Directement sur la version principale (Recommandé) » / « Ne rien envoyer pour l'instant ». Les US d'une série s'appuient souvent l'une sur l'autre : une version parallèle par US les séparerait. Pour une proposition à relire sur le site du dépôt, `/pulse:pr` le permet ensuite. Écrire la réponse dans la ligne « Envoi » de chaque plan.
- **Autorisations** : une série tourne sans vous ; lancer `pulse-aidd reference autorisations.md` et l'appliquer, pour que les contrôles ne s'arrêtent pas sur une demande d'accord.
- **Dossier à part** : la série se réalise dans le dossier courant (le dossier principal, ou le dossier à part où la session se trouve déjà), sauf deux US menées en même temps (§ 4 bis).

## 3. Préparer, avec la personne

Pour chaque US à préparer, dans l'ordre : § S (spec, puis maquettes si la personne le souhaite), puis § P (plan, contrôle `pulse-aidd verifier-plan`, validation). Les validations restent celles d'une US seule ; elles s'enchaînent sans autre question entre deux US. Enregistrer chaque spec et chaque plan validés (`docs: spec et plan de US-XXX`).

Une US dont la spec reste en brouillon (la personne veut réfléchir) : la noter « en attente : <question> » et passer à la suivante ; les US qui en dépendent attendent aussi.

À la fin de la préparation, annoncer : « Tout est prêt : <n> user stories, <m> tâches. Je les réalise maintenant, à la suite. Laissez cette fenêtre ouverte. », suivi de la phrase du « Mode autonome » de `/pulse:spirc` (« Vous pouvez faire autre chose… »). Chaque tâche fait travailler plusieurs assistants : le nombre de tâches donne l'ampleur du travail. Pour suivre l'avancement en bas de l'écran : `/pulse:status ligne` (à proposer en une ligne, si elle n'est pas déjà réglée).

## 4. Construire, sans la personne

Pour chaque US prête, dans l'ordre : la boucle par tâche de `/pulse:spirc` en mode autonome, avec son marqueur (`pulse-aidd realisation debut <US-XXX> … --autonome` à chaque nouvelle US, puis `pulse-aidd realisation questions <n>` avec les questions ouvertes de toute la série) ; en rythme rapide, puis l'examen de toute l'US (`pulse-aidd reference spirc/examen-us.md`). Le test groupé et l'envoi de chaque US attendent le retour de la personne (§ 5).

- **Une décision revient à la personne** sur une tâche (constat Critique persistant compris) : elle attend dans le plan (§ « Questions en attente » de `/pulse:spirc`) et les autres tâches de l'US continuent. Quand plus aucune tâche de l'US ne peut avancer, noter l'US dans la section « Série » (« US-002 : en attente : <n> questions dans le plan »), puis **passer à l'US suivante qui n'en dépend pas** (« Dépend de » du référentiel, « S'appuie sur » des plans, « Dépend de » des tâches). Une US qui en dépend attend aussi. L'arrêt pour les questions se fait au § 5, pour toute la série.
- **Entre deux US**, et à toute reprise : relire `in-progress.md`, `pulse-aidd realisation` et les documents de l'US (spec, plan et `pulse-aidd revue`, `docs/technical.md`) plutôt que s'appuyer sur la conversation.
- **Arrêt** avant toute tâche « Mettre en ligne… » : elle se fait au retour, avec l'accord de la personne.

## 4 bis. Deux US en même temps

Deux US prêtes de la série peuvent se construire en même temps quand leurs deux plans se citent l'un l'autre dans « En parallèle avec » (indépendantes : ni dépendance, ni fichier, ni donnée en commun). **Deux à la fois au plus.**

1. **Le proposer une fois**, à la fin de la préparation (AskUserQuestion) : « Faire avancer US-002 et US-004 en même temps, chacune dans un dossier à part (Recommandé) » / « L'une après l'autre ». Dire en une phrase ce que cela coûte : chaque dossier à part installe les outils du projet (place sur le disque, quelques minutes).
2. **Préparer** chaque dossier à part selon la référence worktree (`pulse-aidd reference worktree.md`), « 2. Créer le worktree ou y revenir », étapes 1 à 6, **sans y entrer** : la session reste dans le dossier principal.
3. **Construire en parallèle** : à chaque pas de la boucle par tâche, un appel Agent par US dans le même message. Chaque message de délégation commence par « Dossier de travail : `<chemin absolu du dossier à part>` ». Les contrôles, `git status`, `git diff` et les commits de chaque US se lancent dans son dossier (`cd <dossier> && …`), et son plan s'y met à jour. Une US qui s'arrête (décision, blocage) laisse l'autre continuer.
4. **Rassembler dès la fin de la construction** de chaque US (examen de l'US compris en rythme rapide) : « Fusionner », étapes 3 à 6 de la référence worktree, sans `ExitWorktree` (la session n'y est pas entrée). Les US qui en dépendent se construisent ensuite dans le dossier principal. L'envoi, lui, attend toujours les tests de la personne (§ 5). Conflit : `git merge --abort`, garder le dossier à part et noter l'US « en attente : rassembler » ; au retour, l'expliquer simplement et proposer `/pulse:pr` ou `/pulse:get-help`, sans jamais écraser le travail de l'une ou de l'autre.

## 5. Au retour de la personne

Quand plus aucune US ne peut avancer seule :

1. **Le point**, en une ligne par US : `US-001 ✅ prête à tester · US-002 ⏸ une question · US-003 ✅ prête à tester`.
2. **Les questions en attente** de tous les plans de la série, en une seule ronde (AskUserQuestion, 4 au plus ; au-delà, plusieurs rondes), traitées comme aux étapes 4 et 5 du § « Questions en attente » de `/pulse:spirc` (réponses notées, travail mis de côté remis en place). Avec les réponses : reprendre la construction des US débloquées (§ 4), puis revenir ici.
3. **Le test groupé, US par US**, dans l'ordre : le § « Test groupé » de `/pulse:spirc` pour chacune (une fiche par US), corrections comprises.
4. **L'envoi**, selon la ligne « Envoi » des plans, une fois les tests concluants ; puis les ajouts à la mémoire, en une seule question pour toute la série.
5. **Le récapitulatif** : celui de la « Fin » de `/pulse:spirc`, une ligne par tâche, groupées par US ; les US restées en attente et pourquoi. Effacer `in-progress.md` (`pulse-aidd travail-fini`) seulement quand toute la série est terminée.

Prochaine étape : `/pulse:deploy` si la première version est terminée et pas encore en ligne, sinon `/pulse:spirc <les US restées en attente>`.

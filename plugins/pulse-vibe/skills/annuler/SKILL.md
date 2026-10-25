---
description: Revenir en arrière sans rien perdre - abandonner les changements en cours, annuler une tâche enregistrée, revenir à une version précédente, ou récupérer ce qui a été annulé ; aperçu et accord avant toute opération
argument-hint: "[T3 | US-003] (facultatif : la tâche ou l'US à annuler)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte annuler) Bash(pulse-aidd annuler *) Bash(pulse-aidd etape pr --sans-communes) Bash(pulse-aidd reference *) Bash(pulse-aidd sessions *) Read Glob Grep Bash(git status *) Bash(git log *) Bash(git show *) Bash(git diff *) Bash(git revert --abort) Bash(git merge --abort) Bash(git remote -v) Bash(git remote get-url *) Bash(git symbolic-ref *) Edit(aidd_docs/tasks/**)
---

# /pulse:annuler – Revenir en arrière

## Objectif

Revenir en arrière **sans rien perdre** : chaque annulation est elle-même réversible. Une phrase d'explication : « Annuler ne gomme rien : j'ajoute une nouvelle version qui défait l'ancienne, ou je mets vos changements de côté. Vous pourrez toujours récupérer ce que nous annulons. »

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte annuler` et lire sa sortie en entier) pendant toute la commande.

Appliquer aussi « L'envoi du travail » à l'étape 6 (`pulse-aidd reference envoi.md`).

## Contexte

Arguments : `$ARGUMENTS` — une tâche (`T3`) ou une US (`US-003` : toutes ses tâches enregistrées), facultatif.

### Prérequis

- Le dossier doit être un dépôt Git avec au moins un commit (« `depot: non` » dans l'état, ou `commits: 0`). Sinon, proposer `/pulse:init`.
- Une opération Git est en cours (`operation:` n'est pas `aucune` : fusion, annulation interrompue) : l'expliquer et proposer de l'interrompre proprement (`git revert --abort` ou `git merge --abort`) avant toute chose. Pour une `suite d'annulations` ou une `suite de reports` (plusieurs versions défaites ou recopiées d'un coup, hors de Pulse), la personne la termine ou l'abandonne elle-même : expliquer simplement que la commande attend la fin de cette suite, que rien n'a changé, et proposer de taper `/pulse:get-help` en cas de doute. Si une autre session travaille sur ce dossier (`autres-sessions` > 0), cette opération est peut-être la sienne : le dire et laisser la personne la terminer dans cette session.

## Processus

### 1. Lire l'état

`pulse-aidd annuler etat --session ${CLAUDE_SESSION_ID}` : l'état du dépôt, les 15 dernières versions reliées à leurs tâches, les mises de côté, les sauvegardes, les autres sessions (`autres-sessions` > 0 : une autre session Claude Code travaille sur ce dossier).

### 2. Choisir le cas

- Argument `T3` ou `US-003` : cas « Annuler une tâche enregistrée ».
- Sinon, demander (AskUserQuestion, question « Que voulez-vous annuler ? »), la recommandation selon l'état en premier :
  - « Abandonner les changements en cours » (seulement s'il y en a ; recommandé dans ce cas) ;
  - « Annuler une tâche enregistrée » ;
  - « Revenir à une version précédente » ;
  - « Récupérer quelque chose que j'ai annulé » (seulement s'il existe une mise de côté `pulse-annuler`, un commit `revert` ou une branche `sauvegarde/`).

### 3. Préciser et montrer l'aperçu

**Changements en cours** : lister les fichiers modifiés (lignes `changement`), un par ligne, avec ce qu'ils représentent (« la page d'accueil », « le plan de US-003 »). Demander : « Tout abandonner » / « Seulement certains fichiers » (puis lesquels). **Une autre session travaille sur ce dossier** : certains de ces changements sont peut-être les siens ; le dire, et proposer seulement « Seulement certains fichiers », pour ne mettre de côté que ceux que la personne nomme.

**Une tâche, une US ou une version** : `pulse-aidd annuler apercu <T3 | US-003 | version <commit>>` donne les commits à défaire, leurs fichiers, les tâches postérieures qui touchent les mêmes fichiers (elles pourraient ne plus fonctionner : proposer de les annuler aussi ou de s'arrêter), ce qui est déjà envoyé et les actions manuelles du plan. Le présenter en langage simple (titre, objectif, fichiers ; pour une version : « hier 17 h – T4 : permet de cocher une tâche terminée »). Une US s'annule en un seul aperçu, un seul accord, un seul commit. Sans argument pour une tâche, proposer la dernière tâche enregistrée (lignes `version`), ou une autre de la liste.

Dans tous les cas, ajouter :
- **Déjà envoyé ou en ligne ?** (`envoyes`, `en-ligne`) Le dire.
- **Ce qu'annuler ne défait pas**, quand cela s'applique : un schéma appliqué dans la console du fournisseur de données, des données saisies sur le site en ligne, des variables saisies chez l'hébergeur, un compte créé sur un service (lignes `action-manuelle`). Les nommer et expliquer comment les défaire à la main si besoin.

### 4. Obtenir l'accord

Demander (AskUserQuestion) : « Annuler » / « Ne rien faire ». Une réponse ambiguë ou une autre réponse vaut « Ne rien faire » : le dire et s'arrêter.

### 5. Opérer

**Changements en cours** : `pulse-aidd annuler mettre-de-cote --resume "<quelques mots>"` (avec `-- <fichiers>` pour une partie, et toujours quand une autre session travaille sur ce dossier) ; la ligne `tache-en-cours: <Tn>` dit qu'une tâche `[~]` dont tous les changements sont partis est déjà repassée à `[ ]` dans son plan par la commande (ne pas modifier le plan une seconde fois).

**Tâche, US ou version** : des changements en cours existent (`etat: changements-en-cours`) : proposer d'abord de les mettre de côté, avec accord, sinon s'arrêter ; avec `autres-sessions` > 0 : demander à la personne de mettre l'autre session en pause ; puis `pulse-aidd annuler defaire <T3 | US-003 | version <commit>>`. `etat: operation-en-cours` (ici ou pour Récupérer) : rien n'a changé ; suivre les Prérequis selon la ligne `operation`. `etat: fait` : le commit d'annulation est fait et les plans sont mis à jour (une version garde aussi une branche `sauvegarde/`). `etat: echec` : tout est revenu à l'état d'avant. Avec `conflit: oui` : expliquer simplement (« une tâche plus récente a modifié les mêmes lignes »). Sans conflit (un contrôle a refusé le commit) : expliquer la `raison` en mots simples. Dans les deux cas, proposer de taper `/pulse:get-help`.

**Récupérer** : pour un commit d'annulation, montrer d'abord `pulse-aidd annuler apercu annulation <commit>` et obtenir l'accord (étape 4). `pulse-aidd annuler recuperer <entrée | commit>` (`etat: arbre-occupe` : des changements en cours ou un fichier au même endroit gênent la reprise, rien n'a changé ; expliquer, lister les `fichier`, et proposer de terminer ou d'enregistrer d'abord ; `etat: echec` : tout est revenu comme avant, l'entrée reste en place ; `etat: conflit-non-nettoye` : expliquer simplement, proposer de taper `/pulse:get-help` et ne rien défaire de plus) ; pour une mise de côté (`a-supprimer`), après vérification par la personne, proposer de la supprimer (`git stash drop <entrée>`) ; une branche `sauvegarde/` : l'expliquer et proposer de taper `/pulse:get-help` si la personne veut repartir de cette branche (opération délicate).

### 6. Envoyer

Pour une tâche ou une version : lire `pulse-aidd reference envoi.md` et appliquer « 2. Envoyer après chaque tâche enregistrée », selon la ligne « Envoi » du plan concerné. Si le site est en ligne, rappeler que cet envoi le remettra dans l'état choisi (si le déploiement automatique est en place). Toujours un envoi simple : **jamais `--force`**.

### 7. Compte rendu

En trois lignes : ce qui a été annulé, l'identifiant du commit (ou le nom de la mise de côté, de la branche de sauvegarde), et comment le récupérer : « relancez `/pulse:annuler` et choisissez *Récupérer* ».

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:status`, ou `/pulse:implement <US-XXX> <Tâche>` pour refaire autrement une tâche annulée.

## Exemples

- `/pulse:annuler T3` : la tâche T3 montrée (son objectif, ses fichiers) ; après votre accord, une nouvelle version la défait, et vous pourrez la récupérer.
- `/pulse:annuler` sans argument : la question « Que voulez-vous annuler ? » ; vos changements en cours peuvent être mis de côté, sans rien perdre.
- `/pulse:annuler` puis « Récupérer quelque chose que j'ai annulé » : ce qui avait été mis de côté revient.

## Références de la commande

!`pulse-aidd contexte annuler`

Si ce contexte est absent, lancer `pulse-aidd contexte annuler` et lire sa sortie.

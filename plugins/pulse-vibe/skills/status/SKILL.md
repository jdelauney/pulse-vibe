---
description: Où en suis-je ? Étapes faites, tâches à faire, en cours et terminées, état Git, dossiers à part en cours et prochaine étape conseillée, la même que /pulse:init ; propose de supprimer les dossiers à part déjà rassemblés
argument-hint: "[ligne | ligne retirer]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte status) Bash(pulse-aidd etat *) Bash(pulse-aidd reference *) Bash(pulse-aidd bilan) Bash(pulse-aidd modele *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd sessions *) Bash(pulse-aidd travail-fini *) Bash(pulse-aidd realisation fin) Read Glob Grep Bash(git status *) Bash(gh pr view*) Bash(glab mr view*) Bash(gh run list*) Bash(glab ci status*)
---

# /pulse:status – Où en suis-je ?

## Objectif

Répondre à « Où en suis-je ? » : les étapes faites, les tâches à faire, en cours et terminées, l'état Git, les dossiers à part en cours, et la prochaine étape conseillée, la même que `/pulse:init`.

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte status` et lire sa sortie en entier) pendant toute la commande.

Cette commande **lit et résume**. Elle modifie seulement quatre choses, chaque fois avec l'accord de la personne : elle efface un travail en cours devenu sans objet (ligne `ancien: oui` de `pulse-aidd etat`), retire le repère d'une réalisation interrompue (ligne `realisation: perimee`), supprime les worktrees dont le travail est déjà fusionné (§ Worktrees) et, avec l'argument `ligne`, règle la ligne d'état (§ La ligne d'état).

## Contexte

Argument : `$ARGUMENTS` (vide : le tableau de bord ; `ligne` ou `ligne retirer` : la ligne d'état).

## Processus

1. **Tableau** : lancer `pulse-aidd etat --tableau`. Ses lignes donnent tout le tableau de bord, sans autre lecture : l'avancement (`etapes`, `mvp`), la prochaine étape (`prochaine`, `raison`, `regle`, `aussi`), le travail en cours (`attente`, `ancien`, `dossier`, `questions`, `realisation`), puis une ligne par élément du format ci-dessous (`projet`, `pile`, `rythme`, `groupe`, `tache`, `plan`, `git`, `sessions`, `worktree`, `branche-fusionnee`, `ci`, `en-ligne`, `referencement`, `seo-suivi`, `revue`, `securite`, `memoire`). Avec la clé `questions`, lire seulement la section « Questions en attente » des plans pour nommer l'US. Une ligne `tableau: illisible` ou `suivi: illisible` : la prochaine étape reste valable ; le dire en une ligne, avec sa raison, et marquer « illisible » les éléments concernés.
2. **CI** : si `ci:` n'est pas `aucune` et que l'outil est connecté, lire le dernier passage (`gh run list --limit 1`, ou `glab ci status`). Un dernier passage en échec devient la prochaine étape quand `regle` vaut R21 à R24 (le verdict passe alors dans « Aussi »), sinon la tête de « Aussi » : `/pulse:fix` avec le message de l'étape en échec. Une CI en échec ne reste jamais cachée derrière une étape de réalisation.
3. **Réalisation interrompue** : avec la ligne `realisation: perimee` (une réalisation arrêtée depuis plusieurs heures sans se terminer), le dire en une phrase et demander (AskUserQuestion) « La reprendre : tapez `/pulse:spirc US-XXX` (Recommandé) » (ou `/pulse:implement US-XXX <Tn>` quand le repère nomme une tâche) / « La considérer comme terminée » (`pulse-aidd realisation fin`).

### Format de réponse

```
📍 Projet : <projet> (pile : <pile>)
⏸️ En attente : <décision en attente> — reprendre avec <commande>   (ligne absente s'il n'y a pas de travail en cours)
❓ <N> questions vous attendent — répondre avec /pulse:spirc US-XXX   (ligne absente quand la clé `questions` est absente)

Méthode : ✅ init · ✅ brief · ✅ PRD · ⬜ technique · ⬜ design (facultatif) · ⬜ user stories · ⬜ spec · ⬜ plan
Rythme   : <rythme> (à changer : « rythme rapide », « rythme complet » ou « demande-moi le rythme à chaque fois »)
Groupes  : <groupe 1> : US-001 (spec ✅ plan ✅) · US-002 (spec ✅ plan ⬜) · <groupe 2> : US-004 (spec ⬜)

Tâches – US-XXX <titre>   (lignes `tache`, titre de la ligne `plan`)
  À faire  : T4 …, T5 … (n)
  En cours : T3 … 
  Terminé  : T1 …, T2 … (n)
  Première version (US Indispensables) : 2/6 tâches terminées

Git      : 3 fichiers modifiés non enregistrés · dernier commit « feat(T2): … »   (ligne `git`)
Dossiers à part : us-003-filtre 🔄 en cours (2 enregistrements à rassembler) · us-001-creer ✅ rassemblé, peut être supprimé (ou « aucun »)
Sessions : 1 autre session ouverte sur ce dossier (ou « aucune autre »)
Parallèle: US-004 peut avancer en même temps que US-003 (ou ligne absente)
En ligne : https://… (ou « pas encore »)
Référencement : relié le … · dernier rapport le … · prochain conseillé le … (ou « à relier », la prochaine étape dit comment reprendre ; ligne absente avec `en-ligne: non`)
Contrôles: ✅ automatiques à chaque envoi (GitHub) · dernier passage ✅ (ou ⬜ pas encore en place · ❌ dernier passage en échec)
Revue    : T2 – ✅ Validé (date)
Sécurité : dernier audit le … (ou « pas encore »)   (ligne `securite`)
Mémoire  : ✅ branchée · glossaire 8 mots · 1 décision (ou « ⚠️ non branchée »)

➡️ Prochaine étape conseillée : <prochaine> — <raison>
   Aussi : <lignes aussi, séparées par « · »>   (ligne absente s'il n'y en a pas)
```

La prochaine étape conseillée est celle de `pulse-aidd etat` (lignes `prochaine`, `raison` et `aussi`), la même que celle de `/pulse:init`, signaux de suivi du référencement compris (règle R24 : `/pulse:seo lancer`, `/pulse:search-console relier`, `/pulse:seo audit`, `/pulse:search-console suivre`), puis la CI de l'étape 2. Avec `ancien: oui`, demander d'abord si ce travail est toujours d'actualité ; sinon, l'effacer (`pulse-aidd travail-fini <dossier>`, avec la valeur de la ligne `dossier` ; sans cette ligne, `pulse-aidd travail-fini`).

### Worktrees

Après l'affichage, seulement si une ligne `worktree` est dans ce cas :

- **`fusionne=oui modifies=0`** : demander (AskUserQuestion) « Supprimer les dossiers à part déjà rassemblés (Recommandé) » / « Les garder », en les nommant. Si oui, pour chacun : `git worktree remove .claude/worktrees/<nom>` puis `git branch -d <branche>` (jamais `--force` ni `-D` : si Git refuse, le dire et en rester là). Une session peut encore travailler dedans : avec `sessions` supérieur à 0, le rappeler dans la question.
- **`fusionne=non`** : le garder, et le signaler avec la façon de reprendre : « travail en cours dans le dossier à part `us-xxx-<nom>` : `/pulse:spirc US-XXX` (Pulse propose d'y revenir) pour continuer et le rassembler ».
- **`fusionne=oui` avec des modifications** : le garder ; le signaler (« des changements y restent, non enregistrés »).

Une ligne `branche-fusionnee` (branche `feat/us-…` sans dossier à part, déjà fusionnée dans la branche du dossier principal, après `git pull` si la demande de fusion a été acceptée sur le site) : proposer de la supprimer (`git branch -d`, jamais `-D`). Une demande de fusion encore ouverte pour un plan terminé (`gh pr view`, `glab mr view`) : rappeler à la personne que cette proposition attend d'être acceptée sur le site du dépôt.

**Travail en parallèle** : quand la prochaine étape conseillée porte sur une US dont la ligne `plan` cite une US `parallele` encore à faire, sans tâche `en-cours` ni ligne `worktree`, ajouter sous la ligne « Prochaine étape » : « 💡 En parallèle, dans une deuxième session Claude Code : `/pulse:spirc US-004` (Pulse proposera un dossier à part) ». Une proposition seulement : la personne la lance elle-même.

Pour cette commande, le format ci-dessus remplace le bloc de fin de commande habituel.

Sur demande (« où perd-on du temps ? », « le bilan des US ») : `pulse-aidd bilan`, présenté en une ligne par US, puis ce qu'il montre (l'US qui a demandé le plus de corrections, les tests non concluants).

### La ligne d'état (argument `ligne`)

Avec `ligne` ou `ligne retirer` : lancer `pulse-aidd reference status/ligne.md` et l'appliquer, au lieu du tableau de bord.

## Exemples

- `/pulse:status` : un tableau de bord en quelques lignes (méthode, tâches, enregistrements, site en ligne) et la prochaine étape conseillée.
- `/pulse:status ligne` : l'avancement affiché en permanence en bas de l'écran, après votre accord.
- Un dossier à part déjà rassemblé : la commande vous propose de le supprimer, et attend votre accord.

## Références de la commande

!`pulse-aidd contexte status`

Ce contexte contient « Règles communes Pulse », « Règles des tâches » et « Règles de réalisation » ; le tableau de bord vient de `pulse-aidd etat --tableau`, la ligne d'état de `pulse-aidd reference status/ligne.md`. Si ce contexte est absent, lancer `pulse-aidd contexte status` et lire sa sortie.

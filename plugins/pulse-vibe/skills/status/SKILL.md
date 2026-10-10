---
description: Où en suis-je ? Étapes faites, tâches à faire, en cours et terminées, état Git, dossiers à part en cours et prochaine étape conseillée, la même que /pulse:init ; propose de supprimer les dossiers à part déjà rassemblés
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte status) Bash(pulse-aidd etat) Bash(pulse-aidd etat *) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd sessions *) Bash(pulse-aidd travail-fini) Bash(pulse-aidd travail-fini *) Read Glob Grep Bash(git status *) Bash(git log *) Bash(git remote -v) Bash(git remote get-url *) Bash(git rev-parse *) Bash(git branch --show-current) Bash(git branch --list *) Bash(git branch -r *) Bash(git branch --merged*) Bash(git worktree list*) Bash(git -C * status --short) Bash(gh pr view*) Bash(glab mr view*) Bash(gh run list*) Bash(glab ci status*)
---

# /pulse:status – Où en suis-je ?

## Objectif

Répondre à « Où en suis-je ? » : les étapes faites, les tâches à faire, en cours et terminées, l'état Git, les dossiers à part en cours, et la prochaine étape conseillée, la même que `/pulse:init`.

## Règles

Appliquer les « Règles communes Pulse » (chargées dans « Contexte ») pendant toute la commande.

Cette commande **lit et résume**. Elle modifie seulement deux choses, chaque fois avec l'accord de la personne : elle efface un travail en cours devenu sans objet (ligne `ancien: oui` de `pulse-aidd etat`) et supprime les worktrees dont le travail est déjà fusionné (§ Worktrees).

## Contexte

!`pulse-aidd contexte status`

Les références et modèles cités dans cette commande figurent dans ce contexte. Si ce contexte est absent, lancer `pulse-aidd contexte status` et lire sa sortie.

## Processus

1. **État et prochaine étape** : lancer `pulse-aidd etat`. Ses lignes donnent l'avancement (`etapes`, `mvp`), la prochaine étape (`prochaine`, `raison`, `regle`), ses alternatives (`aussi`) et le travail en cours (`attente`, `ancien`, `dossier`). Relever aussi, epic par epic, pour la ligne « Groupes » : chaque US avec sa spec (brouillon ou validée) et son plan, et pour chaque spec `docs/design/maquettes/US-XXX-<nom>/retenue/` (facultatif).
2. **Tâches** : pour chaque plan (`aidd_docs/tasks/*/PLAN-SPEC-US-*.md`), lister les tâches `[ ]`, `[~]`, `[x]` pour le tableau des tâches. Relever ses lignes « Envoi » et « En parallèle avec ».
3. **Git** : `git status --short` (nombre de fichiers modifiés non enregistrés), `git log --oneline -3`, `git remote -v`, `pulse-aidd sessions` (autres sessions ouvertes sur ce dossier).
4. **Worktrees** : `git worktree list`. Pour chaque worktree de `.claude/worktrees/`, sa branche, son nombre de commits d'avance sur la branche du dossier principal, celle qui reçoit les fusions (`git branch --show-current` ; `git log --oneline <cette branche>..<branche du worktree>`), ses modifications non enregistrées (`git -C <dossier> status --short`), et s'il est **fusionné** (sa branche apparaît dans `git branch --merged <cette branche>`).
5. **CI** : un fichier de CI existe-t-il (`.github/workflows/`, `.gitlab-ci.yml`, ou l'emplacement noté dans « Hébergement et mise en ligne » de `docs/technical.md`) ; si l'outil est connecté, le résultat du dernier passage (`gh run list --limit 1`, `glab ci status`).
6. **En ligne** : l'adresse du site dans la section « Adresses » de `CLAUDE.md`, si elle est renseignée. **Référencement** : la section « Référencement » de `docs/technical.md` (propriété reliée et date) et le rapport le plus récent de `docs/referencement/` (sa date, et la date du prochain rapport conseillé écrite à sa fin).
7. **Dernière relecture** : le rapport de tâche le plus récent dans `aidd_docs/tasks/*/revues/*/` et son verdict ; le dernier audit `docs/securite.md` s'il existe.
8. **Mémoire** : les fichiers de `aidd_docs/memory/` (nombre de mots dans `glossary.md`, nombre de décisions dans `internal/decisions/`) et la présence du bloc mémoire dans `CLAUDE.md` (`<!-- pulse_memoire:debut -->`).
9. **Travail en cours** : `pulse-aidd etat` signale la décision en attente (clé `attente`).

### Format de réponse

```
📍 Projet : <nom> (pile : <résumé de « Pile retenue » de docs/technical.md, ou « non choisie »>)
⏸️ En attente : <décision en attente> — reprendre avec <commande>   (ligne absente s'il n'y a pas de travail en cours)

Méthode : ✅ init · ✅ brief · ✅ PRD · ⬜ technique · ⬜ design (facultatif) · ⬜ user stories · ⬜ spec · ⬜ plan
Groupes  : <groupe 1> : US-001 (spec ✅ plan ✅) · US-002 (spec ✅ plan ⬜) · <groupe 2> : US-004 (spec ⬜)

Tâches – US-XXX <titre>
  À faire  : T4 …, T5 … (n)
  En cours : T3 … 
  Terminé  : T1 …, T2 … (n)
  Première version (US Indispensables) : 2/6 tâches terminées

Git      : 3 fichiers modifiés non enregistrés · dernier commit « feat(T2): … »
Dossiers à part : us-003-filtre 🔄 en cours (2 enregistrements à rassembler) · us-001-creer ✅ rassemblé, peut être supprimé (ou « aucun »)
Sessions : 1 autre session ouverte sur ce dossier (ou « aucune autre »)
Parallèle: US-004 peut avancer en même temps que US-003 (ou ligne absente)
En ligne : https://… (ou « pas encore »)
Référencement : relié le … · dernier rapport le … · prochain conseillé le … (ou « à relier : /pulse:search-console relier », ligne absente si le site n'est pas en ligne)
Contrôles: ✅ automatiques à chaque envoi (GitHub) · dernier passage ✅ (ou ⬜ pas encore en place · ❌ dernier passage en échec)
Revue    : T2 – ✅ Validé (date)
Mémoire  : ✅ branchée · glossaire 8 mots · 1 décision (ou « ⚠️ non branchée »)

➡️ Prochaine étape conseillée : <prochaine> — <raison>
   Aussi : <lignes aussi, séparées par « · »>   (ligne absente s'il n'y en a pas)
```

La prochaine étape conseillée est celle de `pulse-aidd etat` (lignes `prochaine` et `raison`), la même que celle de `/pulse:init` :
- avec `ancien: oui`, demander d'abord si ce travail est toujours d'actualité ; sinon, l'effacer (`pulse-aidd travail-fini <dossier>`, avec la valeur de la ligne `dossier` ; sans cette ligne, `pulse-aidd travail-fini`) ;
- dès que le MVP est en ligne (`mvp` montre toutes les tâches des US Indispensables terminées, ou « Site en ligne » est noté dans `CLAUDE.md`), regarder ces signaux, qui ne se lisent pas dans les documents de la méthode, quelle que soit la règle (`regle`) : une CI en échec ne reste jamais cachée derrière une étape de réalisation. Le verdict de `pulse-aidd etat` reste la recommandation principale ; avec `regle` R21, R22 ou R23 (tout est terminé), le premier signal qui s'applique devient la prochaine étape et le verdict passe dans « Aussi » ; sinon, les signaux s'ajoutent en tête de « Aussi », la CI en échec d'abord :
  1. dernier passage de la CI en échec → `/pulse:fix` avec le message de l'étape en échec ;
  2. site en ligne sur son domaine définitif et « Être trouvé » de `docs/prd.md` à oui : section « Suivi » de `docs/seo.md` absente ou vide → `/pulse:seo lancer` ; sinon, section « Référencement » de `docs/technical.md` absente → `/pulse:search-console relier` ;
  3. rendez-vous dépassé : date de « Suivi » de `docs/seo.md` → `/pulse:seo audit` ; prochain rapport Search Console conseillé → `/pulse:search-console suivre`.

### Worktrees

Après l'affichage, seulement si un worktree est dans ce cas :

- **Fusionné, sans modification non enregistrée** : demander (AskUserQuestion) « Supprimer les dossiers à part déjà rassemblés (Recommandé) » / « Les garder », en les nommant. Si oui, pour chacun : `git worktree remove .claude/worktrees/<nom>` puis `git branch -d <branche>` (jamais `--force` ni `-D` : si Git refuse, le dire et en rester là). Une session peut encore travailler dedans : si `pulse-aidd sessions` signale une autre session, le rappeler dans la question.
- **Non fusionné** : le garder, et le signaler avec la façon de reprendre : « travail en cours dans le dossier à part `us-xxx-<nom>` : `/pulse:implement US-XXX` ou `/pulse:spirc US-XXX` (Pulse propose d'y revenir) pour continuer et le rassembler ».
- **Fusionné mais avec des modifications non enregistrées** : le garder ; le signaler (« des changements y restent, non enregistrés »).

De même, une branche locale `feat/us-…` sans worktree, déjà fusionnée dans la branche du dossier principal (`git branch --merged`, après `git pull` si la demande de fusion a été acceptée sur le site) et inutilisée en ce moment : proposer de la supprimer (`git branch -d`, jamais `-D`). Une demande de fusion encore ouverte pour un plan terminé (`gh pr view`, `glab mr view`) : rappeler à la personne que cette proposition attend d'être acceptée sur le site du dépôt.

**Travail en parallèle** : quand la prochaine étape conseillée porte sur une US dont la ligne « En parallèle avec » cite une US encore à faire, sans tâche `[~]` ni worktree en cours, ajouter sous la ligne « Prochaine étape » : « 💡 En parallèle, dans une deuxième session Claude Code : `/pulse:spirc US-004` (Pulse proposera un dossier à part) ». Une proposition seulement : la personne la lance elle-même.

Pour cette commande, le format ci-dessus remplace le bloc de fin de commande habituel.

## Exemples

- `/pulse:status` : un tableau de bord en quelques lignes (méthode, tâches, enregistrements, site en ligne) et la prochaine étape conseillée.
- Un dossier à part déjà rassemblé : la commande vous propose de le supprimer, et attend votre accord.

---
description: Où en suis-je ? Étapes faire, kanban des tâches, état Git et prochaine étape conseillée
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Read Glob Grep Bash(git status *) Bash(git log *) Bash(git remote *) Bash(git rev-parse *) Bash(git branch *)
---

# /pulse:status – Où en suis-je ?

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte status`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte status` et lire sa sortie.

Cette commande **ne modifie rien**. Elle lit et résume.

## Déroulé

1. **Étapes de la méthode** : vérifier l'existence de `CLAUDE.md`, `docs/brief.md`, `docs/prd.md`, `docs/technical.md`, `docs/user-stories.md`, d'au moins une spec dans `docs/specs/` et d'au moins un plan dans `docs/plans/`. Vérifier aussi `docs/design.md` (facultatif) et, pour chaque spec, `docs/design/maquettes/<spec>/retenue/` (facultatif). Relever les specs sans plan et les US Indispensables ou Essentielles couvertes par aucune spec.
2. **Tâches** : pour chaque plan de `docs/plans/`, compter et lister les tâches `[ ]`, `[~]`, `[x]`, par jalon.
3. **Git** : `git status --short` (nombre de fichiers modifiés non enregistrés), `git log --oneline -3`, `git remote -v`.
4. **En ligne** : l'adresse du site dans la section « Adresses » de `CLAUDE.md`, si elle est renseignée.
5. **Dernière relecture** : le rapport le plus récent dans `docs/revues/` (rapports de tâche ; les audits d'interface `ui-*` sont à part) et son verdict ; le dernier audit `docs/securite.md` s'il existe.
6. **Mémoire** : les fichiers de `aidd_docs/memory/` (nombre de mots dans `glossary.md`, nombre de décisions dans `internal/decisions/`) et la présence du bloc mémoire dans `CLAUDE.md` (`<!-- pulse_memoire:debut -->`).

## Format de réponse

```
📍 Projet : <nom> (pile : <résumé de « Pile retenue » de docs/technical.md, ou « non choisie »>)

Méthode : ✅ init · ✅ brief · ✅ PRD · ⬜ design (facultatif) · ⬜ technique · ⬜ user stories · ⬜ spec · ⬜ plan
Specs    : <spec 1> (plan ✅) · <spec 2> (plan ⬜) · US sans spec : <identifiants>

Kanban – <plan>
  À faire  : T4 …, T5 … (n)
  En cours : T3 … 
  Terminé  : T1 …, T2 … (n)
  Jalon MVP : 2/6 tâches terminées

Git      : 3 fichiers modifiés non enregistrés · dernier commit « feat(T2): … »
En ligne : https://… (ou « pas encore »)
Revue    : T2 – ✅ Validé (date)
Mémoire  : ✅ branchée · glossaire 8 mots · 1 décision (ou « ⚠️ non branchée »)

➡️ Prochaine étape conseillée : <commande> — <pourquoi, en une phrase>
```

Règles pour la prochaine étape conseillée, dans l'ordre :
1. Document de méthode manquant → la commande qui le produit. Mémoire absente ou non branchée → `/pulse:memory creer`.
2. Modifications non enregistrées d'une tâche `[~]` sans revue → `/pulse:review`.
3. Tâche `[~]` relue → `/pulse:commit`.
4. Jalon MVP terminé et site pas en ligne → `/pulse:deploy`.
5. Commits non envoyés sur GitHub (si un dépôt distant existe et que `git status` indique « ahead ») → `/pulse:deploy`.
6. Spec avec écrans, sans maquette ni plan → proposer `/pulse:ui maquettes <spec>` (facultatif) puis `/pulse:plan <spec>`.
7. Spec sans plan → `/pulse:plan <spec>`.
8. Tâches restantes → `/pulse:implement <plan> <tâche suivante>` (ou `/pulse:spirc <plan>`).
9. Sinon → `/pulse:spec <US suivante>` s'il reste des US sans spec.

Pour cette commande, ne pas ajouter le bloc de fin de commande habituel : le format ci-dessus le remplace.

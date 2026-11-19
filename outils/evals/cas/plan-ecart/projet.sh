#!/usr/bin/env bash
# Projet d'essai : T1 d'US-001 est relue, testée par la personne et prête à enregistrer, mais son code a demandé un
# fichier que le plan ne prévoyait pas (src/nettoyer.js, utilisé par src/liste.js). L'étape commit doit confronter les
# fichiers modifiés au plan (verifier-plan --apres T1) et noter l'écart dans la ligne « Fichiers » et le journal.
. "$(dirname "$0")/../_communs/projet.sh"

PLAN=aidd_docs/tasks/tenir-liste/PLAN-SPEC-US-001-ajouter-article.md
ecrire "$PLAN" <<'EOF'
# Plan – Liste de courses – US-001 Ajouter un article

## Vue d'ensemble

- **US** : US-001 – Ajouter un article · **Groupe** : Tenir la liste · **Priorité** : Indispensable
- **Tâches** : 1 (T1)
- **Statut** : validé le 2026-11-18
- **Envoi** : local

## Conception technique

### Arbitrages

- **Ce que ce changement peut casser** : rien d'existant n'est touché
- **Autre façon envisagée** : enregistrer à chaque frappe, écartée car inutile

### Cas limites et états à couvrir

| Cas | Ce que vit la personne | Tâche | Preuve |
|---|---|---|---|
| nom vide | le message « Indiquez un nom » | T1 | test unitaire « US-001-2 » |

## Tâches

- [~] **T1 – Ajouter un article** · US-001
  - Fichiers : à créer : `src/liste.js`
  - Vérification : US-001 critères 1 et 2
  - Tests : US-001-1, US-001-2 (unitaire)

## Journal

| Date | Tâche | Commit | Remarque |
|---|---|---|---|
| 2026-11-18 | — | — | plan validé |
EOF

ecrire aidd_docs/tasks/tenir-liste/revues/PLAN-SPEC-US-001-ajouter-article/T1-2026-11-18.md <<'EOF'
# Revue – T1 – 2026-11-18

**Verdict** : ✅ Validé
**Mode** : /pulse:review

## Critères d'acceptation

| Critère | Résultat | Commentaire |
|---|---|---|
| US-001 critère 1 | ✅ | l'article apparaît |
| US-001 critère 2 | ✅ | le nom vide est refusé |

## Vérification

- **Verdict** : ✅ Prouvé
- **Filet anti-régression** : 2 tests, tous verts (preuve à jour)

## Constats

aucun

**Blocage** : aucun

## Test par la personne

- **Date** : 2026-11-18
- **Résultat** : ✅ concluant
- **Remarque** : aucune
EOF
git -c user.email=essai@example.com -c user.name=essai add -A
git -c user.email=essai@example.com -c user.name=essai commit -q -m "docs: plan et relecture de T1"

ecrire src/nettoyer.js <<'EOF'
// Retire les espaces autour d'un nom d'article.
function nettoyer(nom) {
  return String(nom || "").trim();
}

module.exports = { nettoyer };
EOF
ecrire src/liste.js <<'EOF'
// Les règles de la liste de courses.
const { nettoyer } = require("./nettoyer.js");

/** Ajoute un article ; un nom vide ne change rien et rend le message à afficher. */
function ajouter(liste, nom) {
  const propre = nettoyer(nom);
  if (!propre) return { liste, message: "Indiquez un nom" };
  return { liste: [...liste, { nom: propre }], message: "" };
}

module.exports = { ajouter };
EOF
ecrire tests/liste.test.js <<'EOF'
const test = require("node:test");
const assert = require("node:assert");
const { ajouter } = require("../src/liste.js");

test("US-001-1 – Un article ajouté apparaît dans la liste", () => {
  assert.deepStrictEqual(ajouter([], "Pain").liste, [{ nom: "Pain" }]);
});

test("US-001-2 – Un nom vide est refusé", () => {
  assert.deepStrictEqual(ajouter([], "  "), { liste: [], message: "Indiquez un nom" });
});
EOF
# La preuve à jour que lit l'étape commit (rythme complet).
if command -v pulse-aidd >/dev/null 2>&1; then pulse-aidd preuve lancer --portee suite >/dev/null 2>&1 || true; fi

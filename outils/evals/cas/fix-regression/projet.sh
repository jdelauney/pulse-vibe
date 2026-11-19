#!/usr/bin/env bash
# Projet d'essai avec une erreur de règle : ajouter() accepte un nom vide, contre le critère 2 d'US-001.
# /pulse:fix doit d'abord écrire un test qui reproduit l'erreur (rouge), le figer, puis faire corriger le code sans y toucher.
. "$(dirname "$0")/../_communs/projet.sh"

ecrire src/liste.js <<'EOF'
// Les règles de la liste de courses.

/** Ajoute un article à la liste et rend la nouvelle liste. */
function ajouter(liste, nom) {
  return [...liste, { nom }];
}

module.exports = { ajouter };
EOF

ecrire tests/liste.test.js <<'EOF'
const test = require("node:test");
const assert = require("node:assert");
const { ajouter } = require("../src/liste.js");

test("US-001-1 – Un article ajouté apparaît dans la liste", () => {
  assert.deepStrictEqual(ajouter([], "Pain"), [{ nom: "Pain" }]);
});
EOF

git -c user.email=essai@example.com -c user.name=essai add -A
git -c user.email=essai@example.com -c user.name=essai commit -q -m "feat: ajouter un article"

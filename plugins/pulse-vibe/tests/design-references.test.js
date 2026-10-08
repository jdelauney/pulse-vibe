// Garde des références de design de /pulse:ui : valeurs clés présentes, format des anti-patterns.
// Lancer : node --test plugins/pulse-vibe/tests/design-references.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const D = path.join(__dirname, "..", "references", "design");
const lire = (f) => fs.readFileSync(path.join(D, f), "utf8");

test("règles d'interface : valeurs chiffrées de couleur, typographie, espacement, mouvement, accessibilité", () => {
  const t = lire("regles-ui.md");
  for (const attendu of ["Cinq nuances", "0,005", "1,333", "1,5 à 1,6", "rem", "1 280 px", "320, 390, 768, 1 280 et 1 920 px", "120 à 150 ms", "300 ms à l'entrée", "50 à 60 ms", "WCAG 2.2", "18,66 px", "3:1", ":focus-visible", "aria-current", "soulignement décalé", "ne répète pas le titre"])
    assert.ok(t.includes(attendu), attendu);
  assert.ok(!/ease-out-back|rebond permis/i.test(t), "jamais de rebond");
});

test("anti-patterns : 4 colonnes, une gravité, les six nouveaux motifs et le tableau par secteur", () => {
  const t = lire("anti-patterns.md");
  const motifs = t.split("\n").filter((l) => /^\| /.test(l) && /🔴|🟠|🟢/.test(l));
  for (const l of motifs) assert.strictEqual(l.split("|").length - 2, 4, l);
  for (const attendu of ["Ombres fortes partout", "Texte courant en majuscules", "Champs en pleine largeur", "Icônes génériques", "Introduction qui répète le titre", "Liens bleus par défaut", "| Secteur |"])
    assert.ok(t.includes(attendu), attendu);
});

test("registres : ce que chaque registre écarte, et renvoi aux durées", () => {
  const t = lire("registres.md");
  for (const attendu of ["Ce que chaque registre écarte", "squelettes de chargement", "héros plein écran", "regles-ui.md"]) assert.ok(t.includes(attendu), attendu);
});

// Garde : les références du pack décrivent seulement la structure actuelle (architecture.md).
// Lancer : node --test plugins/pulse-vibe-next/tests/references-structure.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const ANCIENS = [
  [/src\/app\b/, "app/ est à la racine"],
  [/src\/proxy\.ts/, "proxy.ts est à la racine"],
  [/["'`]@\//, "alias @src/ ou @app/"],
  [/src\/lib\/(env|site|projet)\.ts/, "src/config/"],
  [/src\/lib\/(seo|politique-robots|donnees-structurees)\.ts/, "src/lib/seo/"],
  [/src\/components\/json-ld/, "src/components/shared/elements/json-ld.tsx"],
  [/src\/db\/schema/, "src/db/<domaine>/<sujet>.table.ts"],
  [/src\/lib\/auth\.ts/, "src/adapters/auth/auth.adapter.ts"],
  [/features\/[^\s`/]+\/(actions|queries|schemas|regles|constantes|filtres|session)\.ts/, "un fichier par action/query dans actions/, queries/… (architecture.md)"],
  [/\bregles\.ts\b/, "src/core/<domaine>/<sujet>.rules.ts"],
  [/db\.query\./, "constructeur de requêtes db.select().from(table)"],
  [/\benvServeur\b/, 'import { env } from "@src/config/env" (t3 env)'],
  [/from ["']@src\/db["']/, "@src/db/db-client"],
  [/\bdb\/index\.ts\b/, "src/db/db-client.ts"],
];

function fichiers() {
  const ref = path.join(RACINE, "references");
  const liste = [path.join(RACINE, "README.md")];
  (function parcourir(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const chemin = path.join(d, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (e.name.endsWith(".md")) liste.push(chemin);
    }
  })(ref);
  return liste;
}

for (const fichier of fichiers()) {
  test(`${path.relative(RACINE, fichier)} : aucun ancien chemin`, () => {
    const fautes = [];
    fs.readFileSync(fichier, "utf8").split("\n").forEach((ligne, i) => {
      // Les notes de migration citent volontairement les anciens noms.
      if (/créé avant pulse-vibe-next/.test(ligne)) return;
      for (const [motif, attendu] of ANCIENS) if (motif.test(ligne)) fautes.push(`ligne ${i + 1} (${attendu}) : ${ligne.trim().slice(0, 120)}`);
    });
    assert.deepStrictEqual(fautes, []);
  });
}

module.exports = { ANCIENS };

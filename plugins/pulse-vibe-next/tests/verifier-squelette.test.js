// Tests de la montée de versions du squelette (scripts/verifier-squelette.js) et de la CI qui l'emploie.
// Lancer : node --test plugins/pulse-vibe-next/tests/verifier-squelette.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const { changementMajeur, monterLesVersions, lireArguments } = require(path.join(__dirname, "..", "scripts", "verifier-squelette.js"));

test("changement majeur au sens de npm : le premier nombre non nul", () => {
  assert.strictEqual(changementMajeur("1.4.0", "2.0.0"), true);
  assert.strictEqual(changementMajeur("1.4.0", "1.5.2"), false);
  assert.strictEqual(changementMajeur("0.45.3", "0.46.0"), true, "0.x : la deuxième position compte");
  assert.strictEqual(changementMajeur("0.45.3", "0.45.4"), false);
  assert.strictEqual(changementMajeur("0.0.1", "0.0.2"), true, "0.0.x : la troisième position compte");
  assert.strictEqual(changementMajeur("16.4.0", "16.4.0"), false);
});

test("--dernieres : les versions mineures montent, une version majeure reste en attente", () => {
  const paquet = {
    dependencies: { next: "16.4.0", "drizzle-orm": "0.45.3" },
    devDependencies: { vitest: "5.0.3", typescript: "7.0.2" },
  };
  const dernieres = { next: "16.5.1", "drizzle-orm": "0.46.0", vitest: "6.0.0", typescript: "7.0.2" };
  const r = monterLesVersions(paquet, { lireDerniere: (nom) => dernieres[nom] });
  assert.deepStrictEqual(r.changements, ["next 16.4.0 → 16.5.1"]);
  assert.deepStrictEqual(r.retenues, ["drizzle-orm 0.45.3 → 0.46.0", "vitest 5.0.3 → 6.0.0"]);
  assert.deepStrictEqual(paquet, {
    dependencies: { next: "16.5.1", "drizzle-orm": "0.45.3" },
    devDependencies: { vitest: "5.0.3", typescript: "7.0.2" },
  });
});

test("--dernieres --majeures : toutes les versions montent", () => {
  const paquet = { dependencies: { next: "16.4.0" }, devDependencies: { vitest: "5.0.3" } };
  const r = monterLesVersions(paquet, { majeures: true, lireDerniere: (nom) => ({ next: "17.0.0", vitest: "5.1.0" })[nom] });
  assert.deepStrictEqual(r.retenues, []);
  assert.deepStrictEqual(paquet, { dependencies: { next: "17.0.0" }, devDependencies: { vitest: "5.1.0" } });
  assert.strictEqual(lireArguments(["--dernieres", "--majeures"]).majeures, true);
  assert.throws(() => lireArguments(["--inconnue"]), /Option inconnue/);
});

test("CI hebdomadaire : mineures et majeures en demandes de fusion séparées, recettes vérifiées", () => {
  const ci = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".github", "workflows", "squelette-next.yml"), "utf8");
  assert.match(ci, /verifier-squelette\.js --dernieres --ecrire --e2e\n/, "mineures sans --majeures");
  assert.match(ci, /verifier-squelette\.js --dernieres --majeures --ecrire --e2e/);
  assert.match(ci, /branch: chore\/squelette-next-dernieres-versions/);
  assert.match(ci, /branch: chore\/squelette-next-versions-majeures/);
  assert.match(ci, /verifier-recettes\.js --recettes connexion,liste/);
  assert.match(ci, /verifier-recettes\.js --recettes connexion,fichiers/);
  assert.match(ci, /verifier-recettes\.js --recettes connexion,paiement/);
});

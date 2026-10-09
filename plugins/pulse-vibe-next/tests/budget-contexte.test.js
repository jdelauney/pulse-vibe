// Budget du contexte du pack Next.js (plan 4 « Coût en tokens »).
// Lancer : node --test plugins/pulse-vibe-next/tests/budget-contexte.test.js (nécessite bash dans le PATH)
// Tableau des mesures : node plugins/pulse-vibe-next/tests/budget-contexte.test.js --tableau
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const lancer = (...args) => spawnSync("bash", ["bin/pulse-pile-next", ...args], { cwd: RACINE, encoding: "utf8" });
const COEUR = path.join(RACINE, "..", "pulse-vibe", "bin", "pulse-aidd");

// pulse-pile-next contexte <commande> seul. Avant la tâche 8 (4cd0e56) : 38 204 caractères avec l'architecture ; mesure finale : 20 253 (plafond = mesure × 1,05, au 500 supérieur).
const PLAFONDS_PACK = { implement: 21500, fix: 21500, spirc: 21500, "auto-fix": 21500 };
// pulse-aidd contexte <commande> dans un projet qui déclare le pack. Mesures finales : implement 57 423, spirc 48 284 (plafond = mesure × 1,05, au 500 supérieur).
const PLAFONDS_AVEC_PACK = { implement: 60500, spirc: 51000 };

// Un projet qui déclare le pack, avec le pack dans le PATH, comme dans Claude Code.
function avecPack(commande) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-budget-"));
  fs.mkdirSync(path.join(d, "docs"));
  fs.writeFileSync(path.join(d, "docs", "technical.md"), "**Pack de pile Pulse** : next\n");
  const bin = path.join(RACINE, "bin").split(path.sep).join("/");
  const coeur = COEUR.split(path.sep).join("/");
  return spawnSync("bash", ["-c", `PATH="$(cd "${bin}" && pwd):$PATH" exec bash "${coeur}" contexte "$1"`, "budget", commande], { cwd: d, encoding: "utf8" });
}

for (const [commande, plafond] of Object.entries(PLAFONDS_PACK)) {
  test(`pack : contexte ${commande} ≤ ${plafond} caractères, fiche sans architecture`, () => {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("----- Fiche de la pile"), "fiche");
    assert.ok(!r.stdout.includes("----- Architecture du code"), "architecture à la demande");
    assert.ok(r.stdout.length <= plafond, `${r.stdout.length} > ${plafond}`);
  });
}

for (const [commande, plafond] of Object.entries(PLAFONDS_AVEC_PACK)) {
  test(`cœur et pack : contexte ${commande} ≤ ${plafond} caractères`, { skip: !fs.existsSync(COEUR) }, () => {
    const r = avecPack(commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("===== Pack de pile : Pulse Next.js ====="), "section du pack");
    assert.ok(r.stdout.length <= plafond, `${r.stdout.length} > ${plafond}`);
  });
}

if (process.argv.includes("--tableau")) {
  const lignes = ["| Mesure | Caractères | Plafond |", "|---|---|---|"];
  for (const [c, p] of Object.entries(PLAFONDS_PACK)) lignes.push(`| pulse-pile-next contexte ${c} | ${lancer("contexte", c).stdout.length} | ${p} |`);
  for (const [c, p] of Object.entries(PLAFONDS_AVEC_PACK)) lignes.push(`| contexte ${c} avec pack | ${avecPack(c).stdout.length} | ${p} |`);
  console.log(lignes.join("\n"));
}

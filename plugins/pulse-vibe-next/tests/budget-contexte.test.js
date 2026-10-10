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

for (const [commande, plafond] of Object.entries(PLAFONDS_PACK)) {
  test(`pack : contexte ${commande} ≤ ${plafond} caractères, fiche sans architecture`, () => {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("----- Fiche de la pile"), "fiche");
    assert.ok(!r.stdout.includes("----- Architecture du code"), "architecture à la demande");
    assert.ok(r.stdout.length <= plafond, `${r.stdout.length} > ${plafond}`);
  });
}

// Deux projets d'essai, avec le pack dans le PATH comme dans Claude Code : l'un déclare le pack, l'autre pas encore.
const PROJET_PACK = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-budget-"));
fs.mkdirSync(path.join(PROJET_PACK, "docs"));
fs.writeFileSync(path.join(PROJET_PACK, "docs", "technical.md"), "**Pack de pile Pulse** : next\n");
const PROJET_SANS_PACK = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-budget-sans-"));
function coeur(projet, ...args) {
  const bin = path.join(RACINE, "bin").split(path.sep).join("/");
  const outil = COEUR.split(path.sep).join("/");
  return spawnSync("bash", ["-c", `PATH="$(cd "${bin}" && pwd):$PATH" exec bash "${outil}" "$@"`, "budget", ...args], { cwd: projet, encoding: "utf8" });
}
const projetAvecPack = (...args) => coeur(PROJET_PACK, ...args);
const projetSansPack = (...args) => coeur(PROJET_SANS_PACK, ...args);
const taille = (lanceur, ...args) => {
  const r = lanceur(...args);
  assert.strictEqual(r.status, 0, `${args.join(" ")} : ${r.stderr}`);
  return r.stdout.length;
};

for (const [commande, plafond] of Object.entries(PLAFONDS_AVEC_PACK)) {
  test(`cœur et pack : contexte ${commande} ≤ ${plafond} caractères`, { skip: !fs.existsSync(COEUR) }, () => {
    const r = projetAvecPack("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("===== Pack de pile : Pulse Next.js ====="), "section du pack");
    assert.ok(r.stdout.length <= plafond, `${r.stdout.length} > ${plafond}`);
  });
}

// Ce que la conversation principale charge pour un parcours entier, avec le pack (N-P4, N-P5).
// Mesures au commit 04697d5 : boucle implement 137 107 (dont 36 369 de consignes du pack pour review) ; boucle spirc 93 552 ;
// tech, pack choisi en cours de commande : 182 249 en rechargeant `contexte tech`, 125 377 avec `pile contexte tech`.
// Mesures à la fin des tâches 10-11 du plan « Corrections 4 » (après 84043c8 et la consigne de correction de review) : boucle implement 106 755, boucle spirc 98 093, tech 127 898.
// Plafond = mesure × 1,05, au 500 supérieur.
const PARCOURS_AVEC_PACK = {
  "boucle implement de 4 tâches": { plafond: 112500, parties: [[projetAvecPack, "contexte", "implement"], [projetAvecPack, "etape", "review", "--sans-communes"], [projetAvecPack, "etape", "commit", "--sans-communes"], [projetAvecPack, "reference", "depot-distant.md"]] },
  "boucle spirc de 4 tâches": { plafond: 103000, parties: [[projetAvecPack, "contexte", "spirc"], [projetAvecPack, "etape", "commit", "--sans-communes"], [projetAvecPack, "reference", "worktree.md"], [projetAvecPack, "reference", "tests-automatiques.md"], [projetAvecPack, "reference", "memoire.md"]] },
  "tech, pack choisi en cours de commande": { plafond: 134500, parties: [[projetSansPack, "etape", "tech"], [projetAvecPack, "pile", "contexte", "tech"]] },
};

for (const [nom, { plafond, parties }] of Object.entries(PARCOURS_AVEC_PACK)) {
  test(`cœur et pack : ${nom} ≤ ${plafond} caractères`, { skip: !fs.existsSync(COEUR) }, () => {
    const total = parties.reduce((somme, [lanceur, ...args]) => somme + taille(lanceur, ...args), 0);
    assert.ok(total <= plafond, `${total} > ${plafond}`);
  });
}

if (process.argv.includes("--tableau")) {
  const lignes = ["| Mesure | Caractères | Plafond |", "|---|---|---|"];
  for (const [c, p] of Object.entries(PLAFONDS_PACK)) lignes.push(`| pulse-pile-next contexte ${c} | ${lancer("contexte", c).stdout.length} | ${p} |`);
  for (const [c, p] of Object.entries(PLAFONDS_AVEC_PACK)) lignes.push(`| contexte ${c} avec pack | ${projetAvecPack("contexte", c).stdout.length} | ${p} |`);
  for (const [n, { plafond, parties }] of Object.entries(PARCOURS_AVEC_PACK))
    lignes.push(`| ${n} avec pack | ${parties.reduce((s, [l, ...a]) => s + l(...a).stdout.length, 0)} | ${plafond} |`);
  console.log(lignes.join("\n"));
}

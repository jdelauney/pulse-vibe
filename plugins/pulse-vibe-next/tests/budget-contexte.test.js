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

// pulse-pile-next contexte <commande> seul. Avant la tâche 8 (4cd0e56) : 38 204 caractères avec l'architecture ; mesure à la fin du plan « Corrections 4 » : 20 087 (plafond = mesure × 1,05, au 500 supérieur).
const PLAFONDS_PACK = { implement: 21500, fix: 21500, spirc: 21500, "auto-fix": 21500 };
// pulse-aidd contexte <commande> dans un projet qui déclare le pack. Mesures à la fin du plan « Corrections 4 » : implement 60 103, spirc 49 017 (plafond = mesure × 1,05, au 500 supérieur).
const PLAFONDS_AVEC_PACK = { implement: 63500, spirc: 51500 };

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
// Mesures à la fin du plan « Corrections 4 » : boucle implement 106 755, boucle spirc 98 093, tech 127 898.
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

// Chaque commande que le pack enrichit (sa sortie `contexte` n'est pas vide), mesurée en entier : SKILL.md et contexte, pack compris (N-O5).
// Mesures au commit 04697d5 (etape avec pack) : tech 125 421, plan 99 975, seo 95 834, perf 94 195, refine 86 047, ui 83 766,
// security 82 959, implement 75 811, spirc 74 842, review 68 538 (35 000 une fois le pack laissé au reviewer).
// Plafond = mesure à la fin du plan « Corrections 4 » × 1,05, au 500 supérieur.
const PLAFONDS_COMMANDE_AVEC_PACK = {
  "auto-fix": 49500, // mesure 46 786
  cicd: 65000, // mesure 61 680
  deploy: 66000, // mesure 62 576
  express: 51500, // mesure 48 733
  fix: 54500, // mesure 51 889
  implement: 84000, // mesure 79 960
  perf: 100500, // mesure 95 315
  plan: 106000, // mesure 100 752
  rediger: 34500, // mesure 32 449
  refine: 91500, // mesure 86 865
  review: 35500, // mesure 33 552
  "search-console": 60000, // mesure 57 057
  secrets: 70500, // mesure 67 057
  security: 88000, // mesure 83 589
  seo: 102000, // mesure 96 880
  spec: 50000, // mesure 47 426
  spirc: 80500, // mesure 76 284
  tech: 134500, // mesure 127 942
  test: 48500, // mesure 46 124
  ui: 90000, // mesure 85 248
};

test("chaque commande enrichie par le pack a un plafond avec pack", { skip: !fs.existsSync(COEUR) }, () => {
  const commandes = fs.readdirSync(path.join(RACINE, "..", "pulse-vibe", "skills")).sort();
  const enrichies = commandes.filter((c) => lancer("contexte", c).stdout.trim() !== "");
  assert.deepStrictEqual(Object.keys(PLAFONDS_COMMANDE_AVEC_PACK).sort(), enrichies);
});

for (const [commande, plafond] of Object.entries(PLAFONDS_COMMANDE_AVEC_PACK)) {
  test(`cœur et pack : commande ${commande} (SKILL.md et contexte) ≤ ${plafond} caractères`, { skip: !fs.existsSync(COEUR) }, () => {
    const mesure = taille(projetAvecPack, "etape", commande);
    assert.ok(mesure <= plafond, `etape ${commande} avec pack : ${mesure} > ${plafond}`);
  });
}

if (process.argv.includes("--tableau")) {
  const lignes = ["| Mesure | Caractères | Plafond |", "|---|---|---|"];
  for (const [c, p] of Object.entries(PLAFONDS_PACK)) lignes.push(`| pulse-pile-next contexte ${c} | ${lancer("contexte", c).stdout.length} | ${p} |`);
  for (const [c, p] of Object.entries(PLAFONDS_AVEC_PACK)) lignes.push(`| contexte ${c} avec pack | ${projetAvecPack("contexte", c).stdout.length} | ${p} |`);
  for (const [n, { plafond, parties }] of Object.entries(PARCOURS_AVEC_PACK))
    lignes.push(`| ${n} avec pack | ${parties.reduce((s, [l, ...a]) => s + l(...a).stdout.length, 0)} | ${plafond} |`);
  for (const [c, p] of Object.entries(PLAFONDS_COMMANDE_AVEC_PACK)) lignes.push(`| commande ${c} avec pack (SKILL.md + contexte) | ${projetAvecPack("etape", c).stdout.length} | ${p} |`);
  console.log(lignes.join("\n"));
}

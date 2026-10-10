// Budget du contexte injecté par les commandes Pulse, sans pack de pile (plan 4 « Coût en tokens »).
// Lancer : node --test plugins/pulse-vibe/tests/budget-contexte.test.js (nécessite bash dans le PATH)
// Tableau des mesures : node plugins/pulse-vibe/tests/budget-contexte.test.js --tableau
// Mesures de départ, 4cd0e56 (caractères, sans pack de pile) :
// contexte : init 40312, brainstorm 37867, tech 63176, memory 36171, spirc 70981, express 44205, prd 32831, us 34626, spec 39410, plan 53675, implement 125493, fix 102962, review 42853, commit 42439, pr 36284, annuler 41732, get-help 28284, cicd 42706, deploy 39280, security 43213, secrets 42413, refine 47046, ui 64489, rediger 32299, seo 54520, perf 47116, search-console 46697, learn 39650, explain 27832, test 42428, auto-fix 27102, status 27102, guide 27102.
// etape review --sans-communes 47714, etape commit --sans-communes 52065 (option ignorée avant la tâche 4).
// boucle de 4 tâches : implement 225272, spirc 143378.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
// Chemin relatif et cwd = racine du plugin : aucun docs/technical.md, donc aucun pack de pile.
const lancer = (...args) => spawnSync("bash", ["bin/pulse-aidd", ...args], { cwd: RACINE, encoding: "utf8" });

function taille(...args) {
  const r = lancer(...args);
  assert.strictEqual(r.status, 0, `${args.join(" ")} : ${r.stderr}`);
  return r.stdout.length;
}

// Plafonds en caractères de « pulse-aidd contexte <commande> ».
// Plafond = mesure à la fin du plan 4 × 1,05, arrondie au 500 supérieur.
// Une commande qui grossit doit dépasser 5 % avant d’échouer : relever son plafond est alors un choix explicite.
const PLAFONDS = {
  init: 43500,
  brainstorm: 33500,
  tech: 60000,
  memory: 31500,
  spirc: 29500,
  express: 40000,
  prd: 28000,
  us: 30000,
  spec: 35000,
  plan: 50000,
  // implement : mesuré 39281 (lanceur de tests intégré recommandé sans pack, dans tests-automatiques.md) × 1,05, arrondi au 500 supérieur.
  implement: 41500,
  fix: 22500,
  review: 29000,
  commit: 38000,
  pr: 31500,
  annuler: 37500,
  "get-help": 23500,
  cicd: 38500,
  deploy: 35000,
  security: 39000,
  secrets: 38000,
  refine: 43000,
  ui: 61500,
  rediger: 27500,
  seo: 51000,
  perf: 43000,
  "search-console": 42500,
  learn: 35000,
  explain: 23000,
  // test : mesuré 38159 (repli « Installer un outil de test » et conditions TypeScript dans tests-automatiques.md) × 1,05, arrondi au 500 supérieur.
  test: 40500,
  "auto-fix": 22000,
  // 27 973 au commit 04697d5, 28 764 avant la tâche 11 ; 23 367 sans le tableau des fichiers du projet, chargé à la demande : plafond abaissé (mesure × 1,05, au 500 supérieur).
  status: 25000,
  guide: 29500,
};

// Étapes enchaînées par les orchestrateurs, sans les règles communes déjà chargées.
// commit : mesuré 26588 (fin d'un dossier à part selon l'envoi, mode découverte sur la version principale) × 1,05, arrondi au 500 supérieur.
const PLAFONDS_ETAPES = { review: 12500, commit: 28000 };

// Une boucle de 4 tâches : ce que la conversation principale charge, une seule fois.
const BOUCLES = {
  implement: {
    // mesuré 85380 (lanceur de tests intégré recommandé sans pack, dans tests-automatiques.md) × 1,05, arrondi au 500 supérieur.
    plafond: 90000,
    parties: [["contexte", "implement"], ["etape", "review", "--sans-communes"], ["etape", "commit", "--sans-communes"], ["reference", "depot-distant.md"]],
  },
  spirc: {
    // mesuré 77918 (repli « Installer un outil de test » et conditions TypeScript dans tests-automatiques.md) × 1,05, arrondi au 500 supérieur.
    plafond: 82000,
    parties: [["contexte", "spirc"], ["etape", "commit", "--sans-communes"], ["reference", "worktree.md"], ["reference", "tests-automatiques.md"], ["reference", "memoire.md"]],
  },
};

test("chaque commande a un plafond de contexte", () => {
  const skills = fs.readdirSync(path.join(RACINE, "skills")).sort();
  assert.deepStrictEqual(Object.keys(PLAFONDS).sort(), skills);
});

for (const [commande, plafond] of Object.entries(PLAFONDS)) {
  test(`contexte ${commande} : ${plafond} caractères au plus`, () => {
    const mesure = taille("contexte", commande);
    assert.ok(mesure <= plafond, `contexte ${commande} : ${mesure} > ${plafond}`);
  });
}

for (const [commande, plafond] of Object.entries(PLAFONDS_ETAPES)) {
  test(`etape ${commande} --sans-communes : ${plafond} caractères au plus, sans les règles communes`, () => {
    const r = lancer("etape", commande, "--sans-communes");
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(!r.stdout.includes("===== Règles communes Pulse ====="), "règles communes absentes");
    assert.ok(r.stdout.includes(`===== Instructions de l'étape /pulse:${commande} =====`), "instructions présentes");
    assert.ok(r.stdout.length <= plafond, `${r.stdout.length} > ${plafond}`);
  });
}

for (const [commande, { plafond, parties }] of Object.entries(BOUCLES)) {
  test(`boucle ${commande} de 4 tâches : ${plafond} caractères au plus`, () => {
    const total = parties.reduce((somme, args) => somme + taille(...args), 0);
    assert.ok(total <= plafond, `${total} > ${plafond}`);
  });
}

function tableau() {
  const lignes = ["| Mesure | Caractères | Plafond |", "|---|---|---|"];
  for (const [c, p] of Object.entries(PLAFONDS)) lignes.push(`| contexte ${c} | ${taille("contexte", c)} | ${p} |`);
  for (const [c, p] of Object.entries(PLAFONDS_ETAPES)) lignes.push(`| etape ${c} --sans-communes | ${taille("etape", c, "--sans-communes")} | ${p} |`);
  for (const [c, { plafond, parties }] of Object.entries(BOUCLES))
    lignes.push(`| boucle ${c} (4 tâches) | ${parties.reduce((s, a) => s + taille(...a), 0)} | ${plafond} |`);
  return lignes.join("\n");
}

if (process.argv.includes("--tableau")) console.log(tableau());

module.exports = { PLAFONDS, PLAFONDS_ETAPES, BOUCLES };

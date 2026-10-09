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
// Cibles (÷2) : implement et spirc ; les autres plafonds = mesure de départ arrondie au 500 supérieur (la tâche 11 les resserre).
const PLAFONDS = {
  init: 43500,
  brainstorm: 38000,
  tech: 63500,
  memory: 36500,
  spirc: 36500,
  express: 44500,
  prd: 33000,
  us: 35000,
  spec: 39500,
  plan: 54000,
  implement: 46500,
  fix: 22500,
  review: 43000,
  commit: 42500,
  pr: 36500,
  annuler: 42000,
  "get-help": 28500,
  cicd: 43000,
  deploy: 39500,
  security: 43500,
  secrets: 42500,
  refine: 47500,
  ui: 64500,
  rediger: 32500,
  seo: 55000,
  perf: 47500,
  "search-console": 47000,
  learn: 40000,
  explain: 28000,
  test: 42500,
  "auto-fix": 27500,
  status: 29500,
  guide: 29500,
};

// Étapes enchaînées par les orchestrateurs, sans les règles communes déjà chargées.
const PLAFONDS_ETAPES = { review: 22000, commit: 26500 };

// Une boucle de 4 tâches : ce que la conversation principale charge, une seule fois.
const BOUCLES = {
  implement: {
    plafond: 75000,
    parties: [["contexte", "implement"], ["etape", "review", "--sans-communes"], ["etape", "commit", "--sans-communes"]],
  },
  spirc: {
    plafond: 47500,
    parties: [["contexte", "spirc"], ["etape", "commit", "--sans-communes"], ["reference", "worktree.md"], ["reference", "tests-automatiques.md"], ["reference", "memoire.md"]],
  },
};

// Cibles pas encore atteintes : chaque tâche du plan 4 retire celles qu'elle atteint ; la tâche 11 supprime ce mécanisme.
const EN_ATTENTE = new Set([
  "spirc",
  "boucle implement", "boucle spirc",
]);
const attente = (cle) => (EN_ATTENTE.has(cle) ? "plafond atteint plus loin dans le plan 4" : false);

test("chaque commande a un plafond de contexte", () => {
  const skills = fs.readdirSync(path.join(RACINE, "skills")).sort();
  assert.deepStrictEqual(Object.keys(PLAFONDS).sort(), skills);
});

for (const [commande, plafond] of Object.entries(PLAFONDS)) {
  test(`contexte ${commande} : ${plafond} caractères au plus`, { todo: attente(commande) }, () => {
    const mesure = taille("contexte", commande);
    assert.ok(mesure <= plafond, `contexte ${commande} : ${mesure} > ${plafond}`);
  });
}

for (const [commande, plafond] of Object.entries(PLAFONDS_ETAPES)) {
  test(`etape ${commande} --sans-communes : ${plafond} caractères au plus, sans les règles communes`, { todo: attente(`etape ${commande}`) }, () => {
    const r = lancer("etape", commande, "--sans-communes");
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(!r.stdout.includes("===== Règles communes Pulse ====="), "règles communes absentes");
    assert.ok(r.stdout.includes(`===== Instructions de l'étape /pulse:${commande} =====`), "instructions présentes");
    assert.ok(r.stdout.length <= plafond, `${r.stdout.length} > ${plafond}`);
  });
}

for (const [commande, { plafond, parties }] of Object.entries(BOUCLES)) {
  test(`boucle ${commande} de 4 tâches : ${plafond} caractères au plus`, { todo: attente(`boucle ${commande}`) }, () => {
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

module.exports = { PLAFONDS, PLAFONDS_ETAPES, BOUCLES, EN_ATTENTE };

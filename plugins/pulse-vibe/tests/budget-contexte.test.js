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
// Plafond = mesure à la fin du plan « Corrections 4 – parcours et coût » × 1,05, arrondie au 500 supérieur.
// Une commande qui grossit doit dépasser 5 % avant d’échouer : relever son plafond est alors un choix explicite, avec la mesure et la raison.
const PLAFONDS = {
  init: 48000, // mesure 45 347 (pulse 0.42 : rythme rapide, option -f, gestes)
  brainstorm: 34000, // mesure 31 945
  tech: 60500, // mesure 57 222
  memory: 32000, // mesure 30 261
  spirc: 32500, // mesure 30 906 (pulse 0.40 : règle commune 19 et fiche de test)
  express: 40500, // mesure 38 394
  prd: 28500, // mesure 26 982
  us: 30500, // mesure 28 742
  spec: 35500, // mesure 33 492
  plan: 50500, // mesure 47 800
  implement: 44500, // mesure 42 344 (pulse 0.42 : rythme rapide, option -f, gestes)
  fix: 24000, // mesure 22 408
  review: 31500, // mesure 29 678 (pulse 0.40 : règle commune 19 et fiche de test)
  commit: 39000, // mesure 37 065
  pr: 32000, // mesure 30 391
  annuler: 38500, // mesure 36 358
  "get-help": 23500, // mesure 22 362
  cicd: 39500, // mesure 37 332
  deploy: 36000, // mesure 33 877
  security: 39500, // mesure 37 291
  secrets: 39000, // mesure 36 989
  refine: 44000, // mesure 41 433
  ui: 61500, // mesure 58 567
  rediger: 28500, // mesure 26 875
  seo: 52000, // mesure 49 096
  perf: 44000, // mesure 41 707
  "search-console": 43500, // mesure 41 273
  learn: 36000, // mesure 34 226
  explain: 24000, // mesure 22 408
  test: 43000, // mesure 40 581 (pulse 0.42 : rythme rapide, option -f, gestes)
  "auto-fix": 22500, // mesure 21 180
  status: 25000, // mesure 23 367 (28 764 avant la tâche 11 : le tableau des fichiers du projet se charge à la demande)
  guide: 30500, // mesure 28 747
};

// Étapes enchaînées par les orchestrateurs, sans les règles communes déjà chargées.
// Mesures à la fin du plan « Corrections 4 » : review 12 476, commit 26 737 (× 1,05, au 500 supérieur).
// review relevé à 15 000 (pulse 0.39) : trame des skills (Objectif, Règles, Contexte, Rôle, Processus, Exemples), mesure 13 945.
// review relevé à 16 000 (pulse 0.40) : règle commune 19 et fiche de test, mesure 15 023.
const PLAFONDS_ETAPES = { review: 16000, commit: 28500 };

// Plafonds en caractères de « pulse-aidd etape <commande> » : le SKILL.md et son contexte, soit tout ce que la commande
// injecte à son lancement (N-O5). Plafond = mesure à la fin du plan « Corrections 4 » × 1,05, arrondie au 500 supérieur.
const PLAFONDS_COMMANDE = {
  annuler: 48500, // mesure 45 775
  "auto-fix": 29500, // mesure 28 101 (pulse 0.40 : règle commune 19 et fiche de test)
  brainstorm: 44000, // mesure 41 756
  cicd: 51000, // mesure 48 229
  commit: 50500, // mesure 47 813
  deploy: 52000, // mesure 49 125
  explain: 29000, // mesure 27 251 (pulse 0.42 : rythme rapide, option -f, gestes)
  express: 50500, // mesure 48 062
  fix: 35500, // mesure 33 586 (pulse 0.42 : rythme rapide, option -f, gestes)
  "get-help": 29500, // mesure 28 126 (pulse 0.40 : règle commune 19 et fiche de test)
  guide: 34500, // mesure 32 577
  implement: 67500, // mesure 63 903 (pulse 0.42 : rythme rapide, option -f, gestes)
  init: 69500, // mesure 65 875 (pulse 0.40 : règle commune 19 et autorisations Git proposées)
  learn: 41500, // mesure 39 206
  memory: 41000, // mesure 38 661
  perf: 57500, // mesure 54 519
  plan: 65500, // mesure 62 257
  pr: 41000, // mesure 38 807
  prd: 34000, // mesure 32 244
  rediger: 34500, // mesure 32 639 (pulse 0.40 : règle commune 19 et fiche de test)
  refine: 51000, // mesure 48 370
  review: 39000, // mesure 36 785 (pulse 0.40 : règle commune 19 et fiche de test)
  "search-console": 56000, // mesure 52 989
  secrets: 50000, // mesure 47 290
  security: 46000, // mesure 43 499
  seo: 61000, // mesure 57 741
  spec: 47000, // mesure 44 715
  spirc: 62500, // mesure 59 111 (pulse 0.41 : règles communes 19 et 20, gestes de la personne)
  status: 34000, // mesure 32 369
  tech: 79500, // mesure 75 338
  test: 49500, // mesure 46 893 (pulse 0.42 : rythme rapide, option -f, gestes)
  ui: 81500, // mesure 77 215
  us: 41000, // mesure 38 722
};

// Une boucle de 4 tâches : ce que la conversation principale charge, une seule fois.
const BOUCLES = {
  implement: {
    // mesure 86 580 à la fin du plan « Corrections 4 » × 1,05, arrondie au 500 supérieur.
    plafond: 97500, // mesure 92 768 (pulse 0.42 : rythme rapide, option -f, gestes)
    parties: [["contexte", "implement"], ["etape", "review", "--sans-communes"], ["etape", "commit", "--sans-communes"], ["reference", "depot-distant.md"]],
  },
  spirc: {
    // mesure 77 918 à la fin du plan « Corrections 4 » × 1,05, arrondie au 500 supérieur.
    plafond: 87000, // mesure 82 698 (pulse 0.42 : rythme rapide, option -f, gestes)
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

test("chaque commande a un plafond de commande complète (SKILL.md compris)", () => {
  assert.deepStrictEqual(Object.keys(PLAFONDS_COMMANDE).sort(), fs.readdirSync(path.join(RACINE, "skills")).sort());
});

for (const [commande, plafond] of Object.entries(PLAFONDS_COMMANDE)) {
  test(`commande ${commande} (SKILL.md et contexte) : ${plafond} caractères au plus`, () => {
    const mesure = taille("etape", commande);
    assert.ok(mesure <= plafond, `etape ${commande} : ${mesure} > ${plafond}`);
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
  for (const [c, p] of Object.entries(PLAFONDS_COMMANDE)) lignes.push(`| commande ${c} (SKILL.md + contexte) | ${taille("etape", c)} | ${p} |`);
  for (const [c, { plafond, parties }] of Object.entries(BOUCLES))
    lignes.push(`| boucle ${c} (4 tâches) | ${parties.reduce((s, a) => s + taille(...a), 0)} | ${plafond} |`);
  return lignes.join("\n");
}

if (process.argv.includes("--tableau")) console.log(tableau());

module.exports = { PLAFONDS, PLAFONDS_ETAPES, BOUCLES, PLAFONDS_COMMANDE };

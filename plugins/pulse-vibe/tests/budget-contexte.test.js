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
  spirc: 34500, // mesure 34 020 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 33 528 (pulse 0.48 : captures gardées, examen.md § 3 et 3 bis et ménage de la fin ; avant, 32 608 : pulse 0.48 : constat récurrent de examen.md § 3, proposition de règle contrôlée)
  express: 40500, // mesure 38 394
  prd: 28500, // mesure 26 982
  us: 30500, // mesure 28 742
  spec: 35500, // mesure 33 492
  plan: 50500, // mesure 47 800
  implement: 45500, // mesure 45 116 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 44 573 (pulse 0.48 : filet anti-régression, tests-automatiques.md § 2 ter)
  fix: 24000, // mesure 22 408
  review: 33000, // mesure 32 792 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 32 300 (pulse 0.48 : captures gardées, examen.md § 3 et 3 bis ; avant, 31 617 : pulse 0.48 : filet anti-régression, tests-automatiques.md § 2 ter)
  commit: 40000, // mesure 39 518 (refactoring d'optimisation, tâche 2.3a : règle de choix des familles de qualité renvoyée à la commande sans famille, règles communes) ; avant, mesure 39 088 (pulse 0.49+ : annonce de l'accord avant git remote add dans depot-distant.md, envoi forcé refusé dans git.md)
  pr: 32000, // mesure 30 391
  annuler: 39000, // mesure 38 553 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 36 358
  "get-help": 24000, // mesure 23 797 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 22 362
  cicd: 40000, // mesure 39 527 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 37 332
  deploy: 36500, // mesure 36 030 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 33 877
  security: 39500, // mesure 37 291
  secrets: 39000, // mesure 36 989
  refine: 46500, // mesure 44 183 (pulse 0.45 : le plan écrit « à valider » et contrôlé par verifier-plan, dans les règles du plan)
  ui: 61500, // mesure 58 567
  rediger: 28500, // mesure 26 875
  seo: 52000, // mesure 49 096
  perf: 44000, // mesure 41 707
  "search-console": 43500, // mesure 41 273
  learn: 36000, // mesure 34 226
  explain: 24000, // mesure 22 408
  test: 43500, // mesure 43 019 (pulse 0.49 : règles de qualité et de tests chargées par famille ; le chargement de chaque agent baisse, plafonné à part) ; avant, 40 581 (pulse 0.42 : rythme rapide, option -f, gestes)
  "auto-fix": 23000, // mesure 22 615 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 21 180
  status: 25000, // mesure 23 367 (28 764 avant la tâche 11 : le tableau des fichiers du projet se charge à la demande)
  guide: 31000, // mesure 30 535 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 28 747
};

// Étapes enchaînées par les orchestrateurs, sans les règles communes déjà chargées.
// Mesures à la fin du plan « Corrections 4 » : review 12 476, commit 26 737 (× 1,05, au 500 supérieur).
// review relevé à 15 000 (pulse 0.39) : trame des skills (Objectif, Règles, Contexte, Rôle, Processus, Exemples), mesure 13 945.
// review relevé à 16 000 (pulse 0.40) : règle commune 19 et fiche de test, mesure 15 023.
// review : mesure 16 289 (pulse 0.48 : constat récurrent de examen.md § 3, proposition de règle contrôlée)
// review : mesure 16 526, commit : mesure 28 524 (pulse 0.48 : filet anti-régression, tests-automatiques.md § 2 ter)
const PLAFONDS_ETAPES = { review: 17000, commit: 28500 }; // review : mesure 17 209 (pulse 0.48 : captures gardées, examen.md)
// commit : mesure 26 900 (pulse 0.50 : etape sans en-tête ni Exemples)
// review : mesure 16 131 (pulse 0.50 : etape sans en-tête ni Exemples)

// Plafonds en caractères de « pulse-aidd etape <commande> » : le SKILL.md et son contexte, soit tout ce que la commande
// injecte à son lancement (N-O5). Plafond = mesure à la fin du plan « Corrections 4 » × 1,05, arrondie au 500 supérieur.
const PLAFONDS_COMMANDE = {
  annuler: 49000, // mesure 48 502 (refactoring d'optimisation, tâche 1.3 : « proposer de taper » devant /pulse:get-help) ; avant, 45 775
  "auto-fix": 29500, // mesure 28 101 (pulse 0.40 : règle commune 19 et fiche de test)
  brainstorm: 44500, // mesure 44 002 (pulse 0.49 : autorisations qualite * et tests *) ; avant, 41 756
  cicd: 52000, // mesure 51 517 (correction de la relecture finale de la phase 1 : étapes enchaînées nommées et autorisations de leurs commandes ajoutées à l'en-tête) ; avant, mesure 51 031 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 48 229
  commit: 51500, // mesure 51 100 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 50 722 (pulse 0.48 : filet anti-régression, tests-automatiques.md § 2 ter)
  deploy: 52500, // mesure 52 043 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, mesure 49 125
  explain: 28500, // mesure 26 705 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 27 251 (pulse 0.42 : rythme rapide, option -f, gestes)
  express: 50500, // mesure 47 936 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 50 537 (pulse 0.46 : documents de départ, série d'US en prochaine étape)
  fix: 35000, // mesure 32 933 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 33 586 (pulse 0.42 : rythme rapide, option -f, gestes)
  "get-help": 29500, // mesure 28 126 (pulse 0.40 : règle commune 19 et fiche de test)
  guide: 35000, // mesure 34 661 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 32 577
  implement: 64000, // mesure 60 878 (pulse 0.47 : la boucle sur tout le plan chargée seulement sans tâche, skills/implement/references/boucle.md)
  init: 67500, // mesure 64 250 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 65 875 (pulse 0.40 : règle commune 19 et autorisations Git proposées)
  learn: 42000, // mesure 41 613 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 39 206
  memory: 41500, // mesure 41 265 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 38 661
  perf: 58000, // mesure 57 522 (correction de la relecture finale de la phase 1 : étapes enchaînées nommées et autorisations de leurs commandes ajoutées à l'en-tête) ; avant, mesure 54 519
  plan: 66500, // mesure 66 048 (pulse 0.48 : sections « Questions en attente » et « Choix faits par Pulse » du modèle de plan)
  pr: 41000, // mesure 38 807
  prd: 34500, // mesure 34 036 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 32 244
  rediger: 34500, // mesure 32 639 (pulse 0.40 : règle commune 19 et fiche de test)
  refine: 54500, // mesure 51 808 (pulse 0.45 : le plan écrit « à valider » et contrôlé par verifier-plan, dans les règles du plan)
  review: 40000, // mesure 39 407 avec le pack (pulse 0.48 : captures gardées, examen.md ; avant, 36 785 : pulse 0.40 : règle commune 19 et fiche de test)
  "search-console": 56000, // mesure 52 989
  secrets: 50000, // mesure 47 290
  security: 46500, // mesure 46 122 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 43 499
  seo: 61000, // mesure 57 741
  spec: 50500, // mesure 47 787 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 48 422 (pulse 0.44 : présentation des écrans choisie dans la spec)
  spirc: 72500, // mesure 68 662 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 72 675 (correction de la relecture finale de la phase 1 : étapes enchaînées nommées et autorisations de leurs commandes ajoutées à l'en-tête) ; avant, mesure 72 108 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, mesure 71 538 (pulse 0.49 : règles de qualité et de tests chargées par famille ; le chargement de chaque agent baisse, plafonné à part) ; avant, 71 062 (pulse 0.48 : remise en place du travail mis de côté comparée avant, conflit = arrêt unique, suite d'un constat Critique en pause, contrôle de la copie avant une règle avec « sauf ») ; avant, 70 544 (pulse 0.48 : questions en attente, petit choix, marqueur de réalisation, travail mis de côté) ; avant, 62 528 (pulse 0.44.3 : rythme rapide sans test de l'interface)
  status: 36500, // mesure 34 467 (pulse 0.46 : argument « ligne », la ligne d'état chargée à la demande)
  tech: 80000, // mesure 79 604 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, mesure 75 338
  test: 50000, // mesure 49 776 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 46 893 (pulse 0.42 : rythme rapide, option -f, gestes)
  ui: 81500, // mesure 77 215
  us: 41000, // mesure 38 722
};

// Une boucle de 4 tâches : ce que la conversation principale charge, une seule fois.
const BOUCLES = {
  implement: {
    // mesure 86 580 à la fin du plan « Corrections 4 » × 1,05, arrondie au 500 supérieur.
    plafond: 105000, // mesure 99 888 (pulse 0.47 : boucle.md, sortie du SKILL.md, est désormais comptée dans la boucle)
    parties: [["contexte", "implement"], ["etape", "review", "--sans-communes"], ["etape", "commit", "--sans-communes"], ["reference", "depot-distant.md"], ["reference", "implement/boucle.md"]],
  },
  spirc: {
    // mesure 77 918 à la fin du plan « Corrections 4 » × 1,05, arrondie au 500 supérieur.
    plafond: 89000, // mesure 88 728 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, 88 161 (pulse 0.49 : règles de qualité et de tests chargées par famille ; le chargement de chaque agent baisse, plafonné à part) ; avant, 87 254 (pulse 0.48 : filet anti-régression, tests-automatiques.md § 2 ter)
    parties: [["contexte", "spirc"], ["etape", "commit", "--sans-communes"], ["reference", "worktree.md"], ["reference", "tests-automatiques.md"], ["reference", "memoire.md"]],
  },
};

// Ce que charge chaque agent de la boucle avant de lire le code : ses consignes, puis les règles que ses consignes lui font
// charger, dans un cas type, sans pack (plafond = mesure × 1,05, au 500 supérieur). Avant le chargement par famille (2026-10-23, pulse 0.48.2, pack Next compris) : implementer
// ≈ 107 000, reviewer ≈ 133 000, test-writer et test-runner ≈ 62 000 chacun. Avec le pack : tests du pack.
const AGENTS = {
  "implementer, tâche d'interface": { plafond: 44500, /* mesure 42 060 (pulse 0.50 : familles de qualité raccourcies) ; avant, 51 188 */ parties: [["agent", "implementer"], ["qualite", "clean-code"], ["qualite", "composants"]] },
  "implementer, tâche serveur": { plafond: 48000, /* mesure 45 439 (pulse 0.50 : familles de qualité raccourcies) ; avant, 53 914 */ parties: [["agent", "implementer"], ["qualite", "clean-code"], ["qualite", "securite"]] },
  reviewer: { plafond: 28000, /* mesure 26 888 (pulse 0.50 : checklists lues en entier, consigne ajoutée) ; avant, 26 273 */ parties: [["agent", "reviewer"], ["qualite", "--checklists"], ["reference", "checklist-securite.md"]] },
  "test-writer": { plafond: 43500, /* mesure 41 094 (pulse 0.50 : références de tests raccourcies) ; avant, 42 709 */ parties: [["agent", "test-writer"], ["tests", "ecrire", "gherkin"], ["tests", "unitaire"], ["tests", "tdd"]] },
  "test-runner": { plafond: 29000, /* mesure 27 266 (pulse 0.50 : références de tests raccourcies) ; avant, 28 268 */ parties: [["agent", "test-runner"], ["tests", "ecrire"], ["tests", "unitaire"]] },
};

for (const [agent, { plafond, parties }] of Object.entries(AGENTS)) {
  test(`agent ${agent} : ${plafond} caractères au plus chargés avant le code`, () => {
    const total = parties.reduce((somme, args) => somme + taille(...args), 0);
    assert.ok(total <= plafond, `${total} > ${plafond}`);
  });
}

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
  for (const [a, { plafond, parties }] of Object.entries(AGENTS))
    lignes.push(`| agent ${a} | ${parties.reduce((s, x) => s + taille(...x), 0)} | ${plafond} |`);
  return lignes.join("\n");
}

if (process.argv.includes("--tableau")) console.log(tableau());

module.exports = { PLAFONDS, PLAFONDS_ETAPES, BOUCLES, PLAFONDS_COMMANDE, AGENTS };

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
  init: 43000, // mesure 40 860 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 45 347 (pulse 0.42 : rythme rapide, option -f, gestes)
  brainstorm: 25500, // mesure 24 235 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 31 945
  tech: 52000, // mesure 49 242 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 57 222
  memory: 24000, // mesure 22 638 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 30 261
  spirc: 34500, // mesure 34 020 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 33 528 (pulse 0.48 : captures gardées, examen.md § 3 et 3 bis et ménage de la fin ; avant, 32 608 : pulse 0.48 : constat récurrent de examen.md § 3, proposition de règle contrôlée)
  express: 36000, // mesure 34 236 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 38 394
  prd: 20500, // mesure 19 165 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 26 982
  us: 26000, // mesure 24 465 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 28 742
  spec: 31500, // mesure 29 546 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 33 492
  plan: 49500, // mesure 46 853 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 47 800
  implement: 45500, // mesure 45 116 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 44 573 (pulse 0.48 : filet anti-régression, tests-automatiques.md § 2 ter)
  fix: 22000, // mesure 20 834 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 22 408
  review: 33000, // mesure 32 792 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 32 300 (pulse 0.48 : captures gardées, examen.md § 3 et 3 bis ; avant, 31 617 : pulse 0.48 : filet anti-régression, tests-automatiques.md § 2 ter)
  commit: 38500, // mesure 36 455 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 39 518 (refactoring d'optimisation, tâche 2.3a : règle de choix des familles de qualité renvoyée à la commande sans famille, règles communes) ; avant, mesure 39 088 (pulse 0.49+ : annonce de l'accord avant git remote add dans depot-distant.md, envoi forcé refusé dans git.md)
  pr: 28000, // mesure 26 192 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 30 391
  annuler: 37500, // mesure 35 609 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 38 553 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 36 358
  "get-help": 19000, // mesure 18 085 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 23 797 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 22 362
  cicd: 32000, // mesure 30 334 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 39 527 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 37 332
  deploy: 28500, // mesure 27 127 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 36 030 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 33 877
  security: 33500, // mesure 31 689 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 37 291
  secrets: 31500, // mesure 29 779 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 36 989
  refine: 45000, // mesure 42 413 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 44 183 (pulse 0.45 : le plan écrit « à valider » et contrôlé par verifier-plan, dans les règles du plan)
  ui: 59500, // mesure 56 299 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 58 567
  rediger: 20500, // mesure 19 057 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 26 875
  seo: 45500, // mesure 43 163 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 49 096
  perf: 36000, // mesure 33 884 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 41 707
  "search-console": 35500, // mesure 33 465 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 41 273
  learn: 28000, // mesure 26 412 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 34 226
  explain: 15500, // mesure 14 585 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 22 408
  test: 43500, // mesure 43 019 (pulse 0.49 : règles de qualité et de tests chargées par famille ; le chargement de chaque agent baisse, plafonné à part) ; avant, 40 581 (pulse 0.42 : rythme rapide, option -f, gestes)
  "auto-fix": 21000, // mesure 19 606 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 22 615 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 21 180
  status: 23000, // mesure 21 818 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 23 367 (28 764 avant la tâche 11 : le tableau des fichiers du projet se charge à la demande)
  guide: 26500, // mesure 24 823 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 30 535 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 28 747
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
  annuler: 46500, // mesure 44 004 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 48 502 (refactoring d'optimisation, tâche 1.3 : « proposer de taper » devant /pulse:get-help) ; avant, 45 775
  "auto-fix": 26500, // mesure 24 777 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 28 101 (pulse 0.40 : règle commune 19 et fiche de test)
  brainstorm: 36000, // mesure 33 866 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 44 002 (pulse 0.49 : autorisations qualite * et tests *) ; avant, 41 756
  cicd: 42500, // mesure 40 104 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 51 517 (correction de la relecture finale de la phase 1 : étapes enchaînées nommées et autorisations de leurs commandes ajoutées à l'en-tête) ; avant, mesure 51 031 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 48 229
  commit: 49000, // mesure 46 404 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 51 100 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 50 722 (pulse 0.48 : filet anti-régression, tests-automatiques.md § 2 ter)
  deploy: 44000, // mesure 41 456 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 52 043 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, mesure 49 125
  explain: 18500, // mesure 17 447 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 26 705 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 27 251 (pulse 0.42 : rythme rapide, option -f, gestes)
  express: 44500, // mesure 42 224 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 47 936 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 50 537 (pulse 0.46 : documents de départ, série d'US en prochaine étape)
  fix: 32000, // mesure 30 102 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 32 933 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 33 586 (pulse 0.42 : rythme rapide, option -f, gestes)
  "get-help": 23500, // mesure 22 116 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 28 126 (pulse 0.40 : règle commune 19 et fiche de test)
  guide: 29500, // mesure 28 033 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 34 661 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 32 577
  implement: 63500, // mesure 60 136 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 60 878 (pulse 0.47 : la boucle sur tout le plan chargée seulement sans tâche, skills/implement/references/boucle.md)
  init: 61500, // mesure 58 565 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 64 250 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 65 875 (pulse 0.40 : règle commune 19 et autorisations Git proposées)
  learn: 33000, // mesure 31 126 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 41 613 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 39 206
  memory: 32500, // mesure 30 804 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 41 265 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 38 661
  perf: 48500, // mesure 46 160 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 57 522 (correction de la relecture finale de la phase 1 : étapes enchaînées nommées et autorisations de leurs commandes ajoutées à l'en-tête) ; avant, mesure 54 519
  plan: 65000, // mesure 61 574 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 66 048 (pulse 0.48 : sections « Questions en attente » et « Choix faits par Pulse » du modèle de plan)
  pr: 35500, // mesure 33 643 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 38 807
  prd: 25000, // mesure 23 807 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 34 036 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 32 244
  rediger: 24500, // mesure 23 144 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 32 639 (pulse 0.40 : règle commune 19 et fiche de test)
  refine: 51500, // mesure 48 849 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 51 808 (pulse 0.45 : le plan écrit « à valider » et contrôlé par verifier-plan, dans les règles du plan)
  review: 39500, // mesure 37 526 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 39 407 avec le pack (pulse 0.48 : captures gardées, examen.md ; avant, 36 785 : pulse 0.40 : règle commune 19 et fiche de test)
  "search-console": 47000, // mesure 44 549 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 52 989
  secrets: 41500, // mesure 39 337 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 47 290
  security: 40000, // mesure 37 842 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 46 122 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 43 499
  seo: 54500, // mesure 51 696 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 57 741
  spec: 44500, // mesure 41 938 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 47 787 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 48 422 (pulse 0.44 : présentation des écrans choisie dans la spec)
  spirc: 71000, // mesure 67 549 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 68 662 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 72 675 (correction de la relecture finale de la phase 1 : étapes enchaînées nommées et autorisations de leurs commandes ajoutées à l'en-tête) ; avant, mesure 72 108 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, mesure 71 538 (pulse 0.49 : règles de qualité et de tests chargées par famille ; le chargement de chaque agent baisse, plafonné à part) ; avant, 71 062 (pulse 0.48 : remise en place du travail mis de côté comparée avant, conflit = arrêt unique, suite d'un constat Critique en pause, contrôle de la copie avant une règle avec « sauf ») ; avant, 70 544 (pulse 0.48 : questions en attente, petit choix, marqueur de réalisation, travail mis de côté) ; avant, 62 528 (pulse 0.44.3 : rythme rapide sans test de l'interface)
  status: 33000, // mesure 31 407 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 34 467 (pulse 0.46 : argument « ligne », la ligne d'état chargée à la demande)
  tech: 70500, // mesure 66 702 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 79 604 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, mesure 75 338
  test: 50000, // mesure 49 776 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (règles communes § 4, règles 1, 6 et 11, étapes fix et auto-fix chaînées)) ; avant, mesure 46 893 (pulse 0.42 : rythme rapide, option -f, gestes)
  ui: 79500, // mesure 75 319 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 77 215
  us: 35500, // mesure 33 709 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 38 722
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
  "test-writer": { plafond: 42500, /* mesure 40 058 (pulse 0.50 : références de tests raccourcies) ; avant, 42 709 */ parties: [["agent", "test-writer"], ["tests", "ecrire", "gherkin"], ["tests", "unitaire"], ["tests", "tdd"]] },
  "test-runner": { plafond: 28000, /* mesure 26 371 (pulse 0.50 : références de tests raccourcies) ; avant, 28 268 */ parties: [["agent", "test-runner"], ["tests", "ecrire"], ["tests", "unitaire"]] },
  // Les six agents hors de la boucle (pulse 0.51 : plafonnés pour qu'un ajout de consigne se voie).
  "security-auditor": { plafond: 18500, /* mesure 17 285 (pulse 0.51 : premier plafond, agent hors de la boucle) */ parties: [["agent", "security-auditor"], ["reference", "checklist-securite.md"]] },
  fixer: { plafond: 22500, /* mesure 21 001 (pulse 0.51 : premier plafond, agent hors de la boucle) */ parties: [["agent", "fixer"], ["qualite", "clean-code"]] },
  verifier: { plafond: 18500, /* mesure 17 569 (pulse 0.51 : premier plafond, agent hors de la boucle) */ parties: [["agent", "verifier"], ["reference", "tests/test-manuel.md"], ["reference", "gestes.md"]] },
  explorer: { plafond: 3500, /* mesure 3 030 (pulse 0.51 : premier plafond, agent hors de la boucle) */ parties: [["agent", "explorer"]] },
  "designer, planche": { plafond: 41000, /* mesure 38 682 (pulse 0.51 : premier plafond, agent hors de la boucle) */ parties: [["agent", "designer"], ["reference", "ui/registres.md"], ["reference", "ui/regles-ui.md"], ["reference", "ui/anti-patterns.md"], ["reference", "ui/motifs.md"], ["reference", "ui/directions.md"], ["modele", "ui/maquette-note.md"]] },
  "ui-critic": { plafond: 41000, /* mesure 39 029 (pulse 0.51 : premier plafond, agent hors de la boucle) */ parties: [["agent", "ui-critic"], ["reference", "ui/registres.md"], ["reference", "ui/regles-ui.md"], ["reference", "ui/anti-patterns.md"], ["reference", "ui/motifs.md"], ["reference", "ui/heuristiques.md"], ["modele", "ui/revue-ui.md"]] },
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

// Ce qu'une commande fait lire en un appel doit tenir sous 30 000 caractères : au-delà, Claude Code enregistre la sortie dans un
// fichier et n'en montre qu'un aperçu (lecture tronquée). Chaque forme « pulse-aidd etape <commande> --sans-communes|--sans-noyau »
// citée dans les textes livrés est mesurée (sans pack) ; plafond = mesure × 1,05, arrondie au 500 supérieur.
// pulse 0.50 : « commit --sans-noyau » (33 067) est remplacé par « commit --sans-communes » (26 800) suivi de
// « pulse-aidd reference regles-taches.md » et « regles-realisation.md », en appels séparés.
const LIMITE_LECTURE = 30000;
const PLAFONDS_FORMES = {
  "auto-fix --sans-communes": 5500, // mesure 5 212
  "auto-fix --sans-noyau": 12500, // mesure 11 479
  "brainstorm --sans-communes": 22000, // mesure 20 553
  "cicd --sans-communes": 28500, // mesure 26 708
  "commit --sans-communes": 28500, // mesure 26 800
  "deploy --sans-communes": 30000, // mesure 28 243
  "express --sans-communes": 27000, // mesure 25 332
  "fix --sans-communes": 11500, // mesure 10 479
  "fix --sans-noyau": 18000, // mesure 16 746
  "memory --sans-communes": 18500, // mesure 17 463
  "perf --sans-communes": 35000, // mesure 33 120 : dépasse la limite, voir DEPASSEMENTS_CONNUS
  "plan --sans-communes": 44500, // mesure 42 033 : dépasse la limite
  "pr --sans-communes": 18000, // mesure 16 829
  "pr --sans-noyau": 21500, // mesure 20 393
  "refine --sans-communes": 31000, // mesure 29 261
  "review --sans-communes": 17000, // mesure 15 745
  "spec --sans-communes": 26500, // mesure 24 973
  "tech --sans-communes": 56500, // mesure 53 438 : dépasse la limite
  "ui --sans-communes": 59500, // mesure 56 545 : dépasse la limite
  "ui --sans-noyau": 65500, // mesure 62 004 : dépasse la limite
  "us --sans-communes": 18000, // mesure 16 794
};
// Formes citées qui dépassent encore la limite : ce sont des commandes entières enchaînées comme étape, à scinder dans une phase suivante.
// Cette liste ne grandit pas : une forme nouvelle au-dessus de la limite fait échouer le test.
const DEPASSEMENTS_CONNUS = new Set(["perf --sans-communes", "plan --sans-communes", "tech --sans-communes", "ui --sans-communes", "ui --sans-noyau"]);

function formesCitees() {
  const formes = new Set();
  const parcourir = (dossier) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (e.name.endsWith(".md"))
        for (const m of fs.readFileSync(chemin, "utf8").matchAll(/pulse-aidd etape ([a-z][a-z-]*) (--sans-communes|--sans-noyau)/g)) formes.add(`${m[1]} ${m[2]}`);
    }
  };
  for (const d of ["skills", "references", "agents", "templates"]) parcourir(path.join(RACINE, d));
  return [...formes].sort();
}

test("chaque forme « etape <commande> --sans-… » citée a un plafond, et inversement", () => {
  assert.deepStrictEqual(formesCitees(), Object.keys(PLAFONDS_FORMES).sort());
});

for (const [forme, plafond] of Object.entries(PLAFONDS_FORMES)) {
  test(`etape ${forme} : ${plafond} caractères au plus, sous ${LIMITE_LECTURE} sauf dépassement connu`, () => {
    const mesure = taille("etape", ...forme.split(" "));
    assert.ok(mesure <= plafond, `${mesure} > ${plafond}`);
    if (DEPASSEMENTS_CONNUS.has(forme)) assert.ok(mesure > LIMITE_LECTURE, `${forme} passe sous ${LIMITE_LECTURE} (${mesure}) : la retirer de DEPASSEMENTS_CONNUS`);
    else assert.ok(mesure < LIMITE_LECTURE, `${forme} : ${mesure} caractères, la sortie serait enregistrée dans un fichier (limite ${LIMITE_LECTURE}) : la scinder`);
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

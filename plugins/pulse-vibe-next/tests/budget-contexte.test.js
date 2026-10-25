// Budget du contexte du pack Next.js (plan 4 « Coût en tokens »).
// Lancer : node --test plugins/pulse-vibe-next/tests/budget-contexte.test.js (nécessite bash dans le PATH)
// Tableau des mesures : node plugins/pulse-vibe-next/tests/budget-contexte.test.js --tableau
"use strict";

const test = require("node:test");
const { after } = test;
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const lancer = (...args) => spawnSync("bash", ["bin/pulse-pile-next", ...args], { cwd: RACINE, encoding: "utf8" });
const COEUR = path.join(RACINE, "..", "pulse-vibe", "bin", "pulse-aidd");

// pulse-pile-next contexte <commande> seul. Avant la tâche 8 (4cd0e56) : 38 204 caractères avec l'architecture ; mesure à la fin du plan « Corrections 4 » : 20 087 (plafond = mesure × 1,05, au 500 supérieur).
// Le pack n'est plus servi à spirc ni à auto-fix (pulse 0.50 : les agents qui codent le chargent) ; la clé implement mesure ce que charge l'agent implementer.
const PLAFONDS_PACK = { implement: 21500, fix: 21500, review: 20000 }; // review : mesure 18 629 (pulse 0.50 : sans l'architecture, sous le seuil de lecture de 30 000 ; avant, 31 229)
// Commandes dont le pack n'apporte pas la fiche (elle se lit à la demande : pulse-aidd pile reference fiche.md).
// tech : mesure 12 630 (pulse 0.50 : sans la fiche, l'architecture ni le thème ; avant, 47 523) ; security : mesure 5 890 (avant, 34 899) ;
// plan : mesure 16 718 (pulse 0.50 : l'architecture reste, la fiche part ; avant, 33 280) ; refine : mesure 4 766 (ni fiche ni architecture, à la demande ; avant, 33 280) ;
// seo : mesure 3 379 (pulse 0.50 : les consignes pour écrire du code, ni la fiche, ni l'architecture, ni la liste des recettes ; avant, 33 885) ; perf : mesure 6 737 (même cause ; avant, 35 578) ;
// ui : mesure 3 548 (même cause, et la section « Pour les maquettes » du thème passe dans ui.md ; avant, 8 195) ; rediger : mesure 1 926 (les consignes pour écrire du code en plus ; avant, 1 601).
const PLAFONDS_PACK_SANS_FICHE = { tech: { plafond: 13500 }, security: { plafond: 6500 }, plan: { plafond: 18000, architecture: true }, refine: { plafond: 5500 }, seo: { plafond: 4000 }, perf: { plafond: 7500 }, ui: { plafond: 4000 }, rediger: { plafond: 2500 } };
// pulse-aidd contexte <commande> dans un projet qui déclare le pack. Mesures à la fin du plan « Corrections 4 » : implement 60 103, spirc 49 017 (plafond = mesure × 1,05, au 500 supérieur).
// pulse 0.50 : spirc et implement laissent le pack à leurs agents, `contexte` ne le contient plus ; plafonds = mesure × 1,05 : implement 44 534 (avant 65 242), spirc 33 412 (avant 51 627).
const PLAFONDS_AVEC_PACK = { spirc: 35500 }; // refactoring d'optimisation, tâche 5.3 : modèle de rapport chargé à l'étape du rapport, spirc mesure 33 523 ; pulse 0.51, étape C : implement retiré (une tâche, le contexte n'est plus enrichi par le pack ; garde-fou de structure plus bas) ; pulse 0.51, étape A : implement mesure 35 665 (tests-dabord.md et worktree-dossier.md chargés à la demande, deleguer.md ajouté) ; spirc mesure 35 779 (deleguer.md ajouté) ; avant, implement : mesure 65 242 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, 64 704 (pulse 0.48 : filet anti-régression, tests-automatiques.md § 2 ter) ; spirc : mesure 51 627 (pulse 0.42 : rythme rapide, option -f, gestes)

for (const [commande, plafond] of Object.entries(PLAFONDS_PACK)) {
  test(`pack : contexte ${commande} ≤ ${plafond} caractères, fiche sans architecture`, () => {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("----- Fiche de la pile"), "fiche");
    assert.ok(!r.stdout.includes("----- Architecture du code"), "architecture à la demande");
    assert.ok(r.stdout.length <= plafond, `${r.stdout.length} > ${plafond}`);
  });
}

for (const [commande, { plafond, architecture }] of Object.entries(PLAFONDS_PACK_SANS_FICHE)) {
  test(`pack : contexte ${commande} ≤ ${plafond} caractères, sans la fiche${architecture ? ", avec l'architecture" : " ni l'architecture"}`, () => {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(!r.stdout.includes("----- Fiche de la pile"), "fiche à la demande");
    assert.strictEqual(r.stdout.includes("----- Architecture du code"), Boolean(architecture), "architecture");
    assert.ok(r.stdout.length <= plafond, `${r.stdout.length} > ${plafond}`);
  });
}

// Deux projets d'essai, avec le pack dans le PATH comme dans Claude Code : l'un déclare le pack, l'autre pas encore.
const PROJET_PACK = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-budget-"));
fs.mkdirSync(path.join(PROJET_PACK, "docs"));
fs.writeFileSync(path.join(PROJET_PACK, "docs", "technical.md"), "**Pack de pile Pulse** : next\n");
const PROJET_SANS_PACK = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-budget-sans-"));
after(() => {
  for (const dossier of [PROJET_PACK, PROJET_SANS_PACK]) fs.rmSync(dossier, { recursive: true, force: true });
});
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
    assert.ok(!r.stdout.includes("===== Pack de pile"), "le pack reste à l'agent qui code");
    assert.ok(r.stdout.length <= plafond, `${r.stdout.length} > ${plafond}`);
  });
}

// Ce que la conversation principale charge pour un parcours entier, avec le pack (N-P4, N-P5).
// Mesures au commit 04697d5 : boucle implement 137 107 (dont 36 369 de consignes du pack pour review) ; boucle spirc 93 552 ;
// tech, pack choisi en cours de commande : 182 249 en rechargeant `contexte tech`, 125 377 avec `pile contexte tech`.
// Mesures à la fin du plan « Corrections 4 » : boucle implement 106 755, boucle spirc 98 093, tech 127 898.
// Plafond = mesure × 1,05, au 500 supérieur.
const PARCOURS_AVEC_PACK = {
  "boucle spirc de 4 tâches": { plafond: 75000, /* mesure 71 421 (tâche 7.2 : modèle .gitignore lancé seulement s'il manque, contrôle des clés par pulse-aidd verifier --index) ; avant, mesure 72 016 (refactoring d'optimisation, tâche 7.1 : depot-distant.md scindé, l'envoi du travail dans envoi.md) ; avant, mesure 74 053 (refactoring d'optimisation, tâche 5.3 : modèle de rapport chargé à l'étape du rapport) ; avant, mesure 77 600 (pulse 0.51 : tests-dabord.md et worktree-dossier.md chargés à la demande, deleguer.md ajouté) ; avant, mesure 86 453 (pulse 0.50 : le pack laissé aux agents qui codent) ; avant, 108 552 (même cause que commit : annonce de l'accord avant git remote add, git.md ; avant 103 017, pulse 0.43 : ronde de départ de spirc) */ parties: [[projetAvecPack, "contexte", "spirc"], [projetAvecPack, "etape", "commit", "--sans-communes"], [projetAvecPack, "reference", "worktree.md"], [projetAvecPack, "reference", "tests-automatiques.md"], [projetAvecPack, "reference", "memoire.md"]] },
  "deploy, première mise en ligne": { plafond: 36500, /* mesure 34 423 (refactoring d'optimisation, tâche 7.5 : premier plafond, la commande, la référence du mode et les consignes du pack pour ce mode) */ parties: [[projetAvecPack, "etape", "deploy"], [projetAvecPack, "reference", "deploy/premiere.md"], [projetAvecPack, "pile", "contexte", "deploy-premiere"]] },
  "deploy, mode production": { plafond: 41000, /* mesure 38 931, plafond relevé (relecture de la tâche 7.5 : le mode production lance toujours deploy/variables.md, la saisie hors conversation et pile contexte deploy-variables ; ils sont comptés ; tâche 7.6 : deploy-variables affiche variables-vercel.md, seul endroit des faits sur les variables chez Vercel) ; avant, 29 624 sans eux (tâche 7.5 : premier plafond) */ parties: [[projetAvecPack, "etape", "deploy"], [projetAvecPack, "reference", "deploy/production.md"], [projetAvecPack, "pile", "contexte", "deploy-production"], [projetAvecPack, "reference", "deploy/variables.md"], [projetAvecPack, "reference", "secrets/sans-conversation.md"], [projetAvecPack, "pile", "contexte", "deploy-variables"]] },
  "secrets, fuite": { plafond: 51500, /* mesure 48 702 (refactoring d'optimisation, tâche 7.6 : premier plafond ; la commande, fuite.md, le modèle d'incident et la plus longue fiche, DATABASE_URL ; avant, tout au lancement : 59 494) */ parties: [[projetAvecPack, "etape", "secrets"], [projetAvecPack, "reference", "secrets/fuite.md"], [projetAvecPack, "modele", "secrets/incident.md"], [projetAvecPack, "pile", "secrets", "fiche", "DATABASE_URL"]] },
  "tech, pack choisi en cours de commande": { plafond: 66500, /* mesure 63 215 (phase 6, retouches de tech) ; avant, mesure 63 163, démarche de choix comprise (refactoring d'optimisation, tâche 6.2 : démarche de choix et organisation chargées à l'étape, squelette décrit une fois dans le modèle) ; avant, mesure 80 070 (pulse 0.50 : le pack de tech sans la fiche, l'architecture ni le thème) ; avant, 114 094 (pulse 0.50 : règles communes en noyau et modules) ; avant, 123 389 (pulse 0.50 : familles de qualité raccourcies) ; avant, 124 606 */ parties: [[projetSansPack, "etape", "tech"], [projetSansPack, "reference", "tech/choix-techniques.md"], [projetAvecPack, "pile", "contexte", "tech"]] },
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
  cicd: 25500, // mesure 24 033 (refactoring d'optimisation, tâche 7.4 : règles communes seules, étapes de la CI lues dans le modèle copié, vitesse par perf/ci-vitesse.md au lieu de l'étape perf ; le pack ne donne plus que contexte/cicd.md) ; avant, mesure 47 754 (refactoring d'optimisation, tâche 7.1 : depot-distant.md scindé, l'envoi du travail dans envoi.md, relier seul chargé) ; avant, mesure 53 554 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 65 020 (relecture finale de la phase 1 : étapes commit et deploy chaînées, leurs commandes autorisées dans l'en-tête) ; avant, mesure 61 680
  deploy: 24000, // mesure 22 696 (refactoring d'optimisation, tâche 7.5 : règles communes seules, chaque mode lance sa référence (deploy/premiere.md, production.md, variables.md) et les consignes du pack pour ce mode, mesure de vitesse sans l'étape perf ; le pack ne donne plus que la partie commune, deploy.md) ; avant, mesure 51 057 (refactoring d'optimisation, tâche 7.1 : depot-distant.md scindé, l'envoi du travail dans envoi.md, relier seul chargé) ; avant, mesure 54 906 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 62 576
  express: 49000, // mesure 46 656 (refactoring d'optimisation, tâche 6.4 : plafond relevé, les règles des user stories (regles-us.md, 3 648) chargées pour express, qui les citait sans les avoir) ; avant, mesure 42 894 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 48 606 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 51 845 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, mesure 48 733
  fix: 52500, // mesure 49 923 (pulse 0.51, étape D : fix confie la correction au fixer, tableau des symptômes ramené à cinq lignes) ; avant, mesure 50 228 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 51 889
  perf: 52000, // mesure 49 506 (refactoring d'optimisation, phases 7 et 8 : vérification de la vitesse en CI dans perf/ci-vitesse.md, clé Google dans perf/cle.md, règles communes allégées en phase 6) ; avant, mesure 51 131 (phase 8 : clé Google dans perf/cle.md, règles de la commande résumées) ; avant, mesure 53 788 (pulse 0.50 : seo, perf, ui et rediger chargent les consignes pour écrire du code à la place de la fiche et de l'architecture) ; avant, mesure 81 098 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 90 334 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 95 315
  plan: 82000, // mesure 78 095 (tâche 6.6 : règles de découpage en référence, dédoublonnées) ; avant, mesure 79 197 (pulse 0.50 : le pack de plan sans la fiche du code) ; avant, mesure 94 212 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 97 652 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 100 752
  rediger: 27000, // mesure 25 253 (phase 8 : modèle du texte de page laissé au redacteur, qualité chargée pour intégrer) ; avant, mesure 25 615 (pulse 0.50 : les consignes pour écrire du code en plus, 350 caractères ; plafond relevé avec la mesure) ; avant, mesure 24 764 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 34 022 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 34 612 (pulse 0.42 : rythme rapide, option -f, gestes)
  refine: 38500, // mesure 36 457 (tâche 6.6 : les seules règles de découpage, sans le SKILL de plan ni le modèle de plan) ; avant, mesure 54 577 (pulse 0.50 : le pack de refine sans la fiche ni l'architecture) ; avant, mesure 81 487 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 84 457 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 86 865
  review: 37500, // mesure 35 291 (refactoring d'optimisation, tâche 5.3 : modèle de rapport chargé à l'étape du rapport) ; avant, mesure 37 526 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 39 407 (pulse 0.48 : captures gardées, examen.md ; avant, 36 785 : pulse 0.40 : règle commune 19 et fiche de test)
  "search-console": 41000, // mesure 38 657 (phase 8 : la liaison écrite une fois dans relier.md, chargée à l'étape ; § 5 retiré) ; avant, mesure 48 616 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 57 057
  secrets: 38500, // mesure 36 488 (refactoring d'optimisation, tâche 7.6 : l'index des variables au lancement, chaque fiche à la demande ; fuite.md et le modèle d'incident chargés dans la branche fuite) ; avant, mesure 59 494 ; avant, mesure 59 103 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 67 057
  security: 30500, // mesure 28 768 (refactoring d'optimisation, tâche 5.5 : contexte du cœur réduit au modèle de docs/securite.md) ; avant, mesure 44 263 (pulse 0.50 : la fiche et l'architecture à la demande, `pile contexte security` passe sous le seuil de lecture de 30 000) ; avant, mesure 72 074 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 79 138 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 83 589
  seo: 47500, // mesure 44 878 (phase 8 : politique IA en mode ia, modèle d'audit à l'audit, liaison par relier.md au lancement) ; avant, mesure 55 761 (pulse 0.50 : consignes pour écrire du code à la place de la fiche, de l'architecture et de la liste des recettes) ; avant, mesure 84 978 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 92 297 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 96 880
  spec: 45500, // mesure 43 267 (tâche 6.5 : présentation des écrans en référence, modèle d'US à la demande) ; avant, mesure 44 700 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 50 549 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 51 162 (pulse 0.44 : présentation des écrans choisie dans la spec)
  tech: 57000, // mesure 54 317 (phase 6, retouches : portée et repli de la démarche, squelette du modèle sans pack) ; avant, mesure 54 265 (refactoring d'optimisation, tâche 6.2 : démarche de choix et organisation chargées à l'étape, squelette décrit une fois dans le modèle) ; avant, mesure 80 113 (pulse 0.50 : le pack de tech sans la fiche, l'architecture ni le thème) ; avant, mesure 114 137 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 123 432 (pulse 0.50 : familles de qualité raccourcies) ; avant, mesure 124 649 (pulse 0.50 : etape sans en-tête ni Exemples), et avant encore 127 942
  test: 32500, // mesure 30 863 (refactoring d'optimisation, tâche 5.4 : Tests automatiques et Gherkin chargés à la demande) ; avant, mesure 52 330 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, mesure 49 417 (pulse 0.42 : rythme rapide, option -f, gestes)
  ui: 44500, // mesure 42 785 (phase 8 : références et modèles de design chargés à l'étape qui les cite, les agents chargent les leurs ; correctifs : rechargement après compactage et dossiers acceptés par le rangement, cités) ; avant, mesure 79 522 (pulse 0.50 : consignes pour écrire du code à la place du thème complet, section « Pour les maquettes » gardée) ; avant, mesure 83 431 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 85 248
};

test("chaque commande enrichie par le pack a un plafond avec pack", { skip: !fs.existsSync(COEUR) }, () => {
  const commandes = fs.readdirSync(path.join(RACINE, "..", "pulse-vibe", "skills")).sort();
  // implement garde un contexte de pack, mais c'est l'agent implementer qui le charge (pulse-aidd pile contexte implement) : sa commande ne le contient pas.
  const enrichies = commandes.filter((c) => c !== "implement" && lancer("contexte", c).stdout.trim() !== "");
  assert.deepStrictEqual(Object.keys(PLAFONDS_COMMANDE_AVEC_PACK).sort(), enrichies);
});

for (const [commande, plafond] of Object.entries(PLAFONDS_COMMANDE_AVEC_PACK)) {
  test(`cœur et pack : commande ${commande} (SKILL.md et contexte) ≤ ${plafond} caractères`, { skip: !fs.existsSync(COEUR) }, () => {
    const mesure = taille(projetAvecPack, "etape", commande);
    assert.ok(mesure <= plafond, `etape ${commande} avec pack : ${mesure} > ${plafond}`);
  });
}

// Ce que charge chaque agent de la boucle avant de lire le code, pack déclaré : ses consignes, les règles de qualité ou de
// tests (l'organisation est couverte par le pack) et les consignes du pack (plafond = mesure × 1,05, au 500 supérieur). Avant le chargement par famille (2026-10-23,
// pulse 0.48.2) : implementer ≈ 107 000, reviewer ≈ 133 000, test-writer et test-runner ≈ 62 000 chacun.
const AGENTS_AVEC_PACK = {
  "implementer, tâche d'interface": { plafond: 64500, /* mesure 61 238 (pulse 0.50 : familles de qualité raccourcies) ; avant, 72 098 */ parties: [["agent", "implementer"], ["qualite", "clean-code", "composants"], ["pile", "contexte", "implement"]] },
  "implementer, tâche serveur": { plafond: 68000, /* mesure 64 617 (pulse 0.50 : familles de qualité raccourcies) ; avant, 74 824 */ parties: [["agent", "implementer"], ["qualite", "clean-code", "securite"], ["pile", "contexte", "implement"]] },
  reviewer: { plafond: 47500, /* mesure 45 184 (pulse 0.50 : l'architecture à la demande, `pile contexte review` sous le seuil de lecture de 30 000) ; avant, 56 335 */ parties: [["agent", "reviewer"], ["qualite", "--checklists"], ["reference", "checklist-securite.md"], ["pile", "contexte", "review"]] },
  "test-writer": { plafond: 43000, /* mesure 40 730 (pulse 0.50 : références de tests raccourcies) ; avant, 43 381 */ parties: [["agent", "test-writer"], ["tests", "ecrire", "gherkin", "tdd", "unitaire"], ["pile", "contexte", "test"]] },
  "test-writer, corriger": { plafond: 14000, /* mesure 13 231 (refactoring d'optimisation, tâche 5.2 : premier plafond ; le mode corriger charge seulement les checklists du niveau) */ parties: [["agent", "test-writer"], ["tests", "ecrire", "unitaire", "--checklists"], ["pile", "contexte", "test"]] },
  "test-runner": { plafond: 12500, /* mesure 11 661 (refactoring d'optimisation, tâche 5.2 : la qualité se juge avec les checklists, pulse-aidd tests ecrire --checklists) ; avant, 27 947 (pulse 0.50 : références de tests raccourcies) ; avant, 29 844 */ parties: [["agent", "test-runner"], ["tests", "ecrire", "--checklists", "unitaire"], ["pile", "contexte", "test"]] },
  // Les six agents hors de la boucle (pulse 0.50 : premiers plafonds).
  "security-auditor": { plafond: 24500, /* mesure 24 368 (refactoring d'optimisation, tâche 5.5 : section « Portée », projet ou tache) ; avant, mesure 23 175 (pulse 0.50 : premier plafond, agent hors de la boucle) */ parties: [["agent", "security-auditor"], ["reference", "checklist-securite.md"], ["pile", "contexte", "security"]] },
  fixer: { plafond: 62500, /* mesure 59 370 (pulse 0.51, étape D : correction de comportement envoyée par fix, le fixer charge clean-code et une famille, ici securite ; avant, 41 072 : clean-code seul, anticipé) */ parties: [["agent", "fixer"], ["pile", "contexte", "fix"], ["qualite", "clean-code", "securite"]] },
  verifier: { plafond: 21500, /* mesure 20 049 (pulse 0.50 : premier plafond, agent hors de la boucle) */ parties: [["agent", "verifier"], ["pile", "contexte", "test"], ["reference", "tests/test-manuel.md"], ["reference", "gestes.md"]] },
  explorer: { plafond: 6500, /* mesure 5 748 (pulse 0.50 : premier plafond, agent hors de la boucle) */ parties: [["agent", "explorer"], ["pile", "contexte", "spec"]] },
  "designer, maquette": { plafond: 35000, /* mesure 33 056 (phase 8 : premier plafond ; registres.md seulement pour une planche ou une direction provisoire) */ parties: [["agent", "designer"], ["reference", "ui/regles-ui.md"], ["reference", "ui/anti-patterns.md"], ["reference", "ui/motifs.md"], ["modele", "ui/maquette-note.md"], ["pile", "contexte", "ui"]] },
  "designer, planche": { plafond: 44500, /* mesure 42 588 (phase 8 : consigne de chargement des registres précisée) ; avant, mesure 42 454 sur 53ab806 (plafond posé en pulse 0.50 sur 42 230, agent hors de la boucle) */ parties: [["agent", "designer"], ["reference", "ui/registres.md"], ["reference", "ui/regles-ui.md"], ["reference", "ui/anti-patterns.md"], ["reference", "ui/motifs.md"], ["reference", "ui/directions.md"], ["modele", "ui/maquette-note.md"], ["pile", "contexte", "ui"]] },
  "ui-critic": { plafond: 45000, /* mesure 42 577 (pulse 0.50 : premier plafond, agent hors de la boucle) */ parties: [["agent", "ui-critic"], ["reference", "ui/registres.md"], ["reference", "ui/regles-ui.md"], ["reference", "ui/anti-patterns.md"], ["reference", "ui/motifs.md"], ["reference", "ui/heuristiques.md"], ["modele", "ui/revue-ui.md"], ["pile", "contexte", "ui"]] },
};
const chargementAgent = (parties) => parties.reduce((somme, args) => somme + taille(projetAvecPack, ...args), 0);

for (const [agent, { plafond, parties }] of Object.entries(AGENTS_AVEC_PACK)) {
  test(`cœur et pack : agent ${agent} ≤ ${plafond} caractères chargés avant le code`, { skip: !fs.existsSync(COEUR) }, () => {
    const total = chargementAgent(parties);
    assert.ok(total <= plafond, `${total} > ${plafond}`);
  });
}

// Structure : ce que le pack n'ajoute pas, commande par commande (un plafond seul laisse revenir 15 000 caractères sous la marge).
// Le titre « ----- Fiche de la pile » est celui de afficher() dans bin/pulse-pile-next ; « ===== Pack de pile » celui du cœur.
for (const commande of ["tech", "seo", "perf", "security", "plan", "refine"]) {
  test(`structure : contexte du pack pour ${commande} sans la fiche de la pile`, { skip: !fs.existsSync(COEUR) }, () => {
    for (const r of [lancer("contexte", commande), projetAvecPack("pile", "contexte", commande)]) {
      assert.strictEqual(r.status, 0, r.stderr);
      assert.ok(r.stdout.trim() !== "", "le pack apporte ses consignes");
      assert.ok(!r.stdout.includes("----- Fiche de la pile"), "fiche à la demande");
    }
  });
}

test("structure : spirc, auto-fix et implement laissent le pack à leurs agents ; fix le garde", { skip: !fs.existsSync(COEUR) }, () => {
  for (const commande of ["spirc", "auto-fix", "implement"]) assert.ok(!projetAvecPack("contexte", commande).stdout.includes("===== Pack de pile"), commande);
  assert.ok(projetAvecPack("contexte", "fix").stdout.includes("===== Pack de pile"), "fix : le pack dans le contexte");
  assert.ok(lancer("contexte", "implement").stdout.includes("----- Fiche de la pile"), "l'agent implementer charge la fiche");
});

// Les formes « pulse-aidd etape <commande> --sans-communes|--sans-noyau » citées par le cœur, mesurées avec le pack (limite de lecture : 30 000 caractères).
// Plafond = mesure × 1,05, au 500 supérieur. Une forme au-dessus de la limite entre dans DEPASSEMENTS_CONNUS_AVEC_PACK avec sa mesure ; cette liste ne grandit pas.
const LIMITE_LECTURE = 30000;
const PLAFONDS_FORMES_AVEC_PACK = {
  "auto-fix --sans-noyau": 12500, // mesure 11 686
  "brainstorm --sans-communes": 21500, // mesure 20 265 (tâche 6.3 : règles citées au lieu d'être recopiées) ; avant, 20 653
  "cicd --sans-communes": 11000, // mesure 10 301 (tâche 7.4 : règles communes seules, étapes de la CI lues dans le modèle copié, vitesse par perf/ci-vitesse.md au lieu de l'étape perf ; sous la limite de lecture) ; avant, 34 022 (tâche 7.1 : relier seul chargé) ; avant, 40 252
  "commit --sans-communes": 22500, // mesure 21 385 (tâche 7.2 : modèle .gitignore à la demande) ; avant, 21 980 (tâche 7.1 : envoi.md au lieu de depot-distant.md) ; avant, 26 896
  "deploy --sans-communes": 9500, // mesure 8 964 (tâche 7.5 : règles communes seules, chaque mode lance sa référence (deploy/premiere.md, production.md, variables.md) et les consignes du pack pour ce mode, mesure de vitesse sans l'étape perf ; sous la limite de lecture) ; avant, 37 325 (tâche 7.1 : relier seul chargé) ; avant, 41 789
  "express --sans-communes": 31500, // mesure 29 709 (tâche 6.4 : plafond relevé, règles des user stories chargées ; marge de 291 sous la limite de lecture) ; avant, 26 109
  "fix --sans-communes": 32000, // mesure 30 157 : dépasse la limite, voir DEPASSEMENTS_CONNUS_AVEC_PACK (pulse 0.51, étape D ; avant, 30 759)
  "fix --sans-noyau": 38500, // mesure 36 209 : dépasse la limite, voir DEPASSEMENTS_CONNUS_AVEC_PACK (pulse 0.51, étape D ; avant, 37 026)
  "memory --sans-communes": 15000, // mesure 14 006 (tâche 6.7 : modèles de la mémoire affichés à l'action) ; avant, 17 559
  "perf --sans-communes": 38000, // mesure 36 105 (refactoring d'optimisation, phases 7 et 8 : vérification de la vitesse en CI dans perf/ci-vitesse.md, clé Google dans perf/cle.md) ; avant, 37 399 (phase 8) ; avant, 40 050 : dépasse la limite, voir DEPASSEMENTS_CONNUS_AVEC_PACK
  "plan --sans-communes": 61500, // mesure 58 445 (tâche 6.6) ; avant, 59 210 : dépasse la limite, voir DEPASSEMENTS_CONNUS_AVEC_PACK
  "pr --sans-communes": 15000, // mesure 13 840 (tâche 7.3 : modèle de description lancé au moment de rédiger, déplacement par pulse-aidd deplacer-commits) ; avant, 16 931
  "pr --sans-noyau": 18500, // mesure 17 404 (tâche 7.3 : modèle de description lancé au moment de rédiger, déplacement par pulse-aidd deplacer-commits) ; avant, 20 495
  "refine --sans-communes": 18000, // mesure 16 807 (tâche 6.6 : les seules règles de découpage, sortie de DEPASSEMENTS_CONNUS_AVEC_PACK) ; avant, 34 590
  "review --sans-communes": 14500, // mesure 13 415 (tâche 5.3 : modèle de rapport chargé à l'étape) ; avant, 15 728
  "spec --sans-communes": 28000, // mesure 26 320 (tâche 6.5 : présentation des écrans en référence, modèle d'US à la demande) ; avant, 27 839
  "tech --sans-communes": 43000, // mesure 40 916 (phase 6, retouches) ; avant, 40 864 (tâche 6.2 : démarche et organisation chargées à l'étape) ; avant, 66 375 : dépasse la limite, voir DEPASSEMENTS_CONNUS_AVEC_PACK
  "ui --sans-communes": 24500, // mesure 23 612 (phase 8 : références et modèles de design chargés à l'étape qui les cite, les agents chargent les leurs) ; avant, 60 343
  "ui --sans-noyau": 30500, // mesure 29 071 (même raison ; sous la limite de lecture) ; avant, 65 802
  "us --sans-communes": 18000, // mesure 16 880 (tâche 6.4 : questions clés une à une) ; avant, 16 910
};
const DEPASSEMENTS_CONNUS_AVEC_PACK = new Set([
  "fix --sans-communes", "fix --sans-noyau", "perf --sans-communes", "plan --sans-communes", "tech --sans-communes",
]);
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
  for (const d of ["skills", "references", "agents", "templates"]) parcourir(path.join(RACINE, "..", "pulse-vibe", d));
  return [...formes].sort();
}

test("avec le pack : chaque forme « etape <commande> --sans-… » citée a un plafond, et inversement", { skip: !fs.existsSync(COEUR) }, () => {
  assert.deepStrictEqual(formesCitees(), Object.keys(PLAFONDS_FORMES_AVEC_PACK).sort());
});

for (const [forme, plafond] of Object.entries(PLAFONDS_FORMES_AVEC_PACK)) {
  test(`avec le pack : etape ${forme} ≤ ${plafond} caractères, sous ${LIMITE_LECTURE} sauf dépassement connu`, { skip: !fs.existsSync(COEUR) }, () => {
    const mesure = taille(projetAvecPack, "etape", ...forme.split(" "));
    assert.ok(mesure <= plafond, `${mesure} > ${plafond}`);
    if (DEPASSEMENTS_CONNUS_AVEC_PACK.has(forme)) assert.ok(mesure > LIMITE_LECTURE, `${forme} passe sous ${LIMITE_LECTURE} (${mesure}) : la retirer de DEPASSEMENTS_CONNUS_AVEC_PACK`);
    else assert.ok(mesure < LIMITE_LECTURE, `${forme} : ${mesure} caractères avec le pack, la sortie serait enregistrée dans un fichier (limite ${LIMITE_LECTURE}) : la scinder`);
  });
}

if (process.argv.includes("--tableau")) {
  const lignes = ["| Mesure | Caractères | Plafond |", "|---|---|---|"];
  for (const [c, p] of Object.entries({ ...PLAFONDS_PACK, ...Object.fromEntries(Object.entries(PLAFONDS_PACK_SANS_FICHE).map(([k, v]) => [k, v.plafond])) })) lignes.push(`| pulse-pile-next contexte ${c} | ${lancer("contexte", c).stdout.length} | ${p} |`);
  for (const [c, p] of Object.entries(PLAFONDS_AVEC_PACK)) lignes.push(`| contexte ${c} avec pack | ${projetAvecPack("contexte", c).stdout.length} | ${p} |`);
  for (const [n, { plafond, parties }] of Object.entries(PARCOURS_AVEC_PACK))
    lignes.push(`| ${n} avec pack | ${parties.reduce((s, [l, ...a]) => s + l(...a).stdout.length, 0)} | ${plafond} |`);
  for (const [c, p] of Object.entries(PLAFONDS_COMMANDE_AVEC_PACK)) lignes.push(`| commande ${c} avec pack (SKILL.md + contexte) | ${projetAvecPack("etape", c).stdout.length} | ${p} |`);
  for (const [a, { plafond, parties }] of Object.entries(AGENTS_AVEC_PACK)) lignes.push(`| agent ${a} avec pack | ${chargementAgent(parties)} | ${plafond} |`);
  for (const [forme, p] of Object.entries(PLAFONDS_FORMES_AVEC_PACK)) lignes.push(`| etape ${forme} avec pack | ${projetAvecPack("etape", ...forme.split(" ")).stdout.length} | ${p} |`);
  console.log(lignes.join("\n"));
}

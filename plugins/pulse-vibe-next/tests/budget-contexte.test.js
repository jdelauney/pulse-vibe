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
const PLAFONDS_PACK = { implement: 21500, fix: 21500, review: 20000 }; // review : mesure 18 629 (pulse 0.51 : sans l'architecture, sous le seuil de lecture de 30 000 ; avant, 31 229)
// Commandes dont le pack n'apporte pas la fiche (elle se lit à la demande : pulse-aidd pile reference fiche.md).
// tech : mesure 12 630 (pulse 0.51 : sans la fiche, l'architecture ni le thème ; avant, 47 523) ; security : mesure 5 890 (avant, 34 899) ;
// plan : mesure 16 718 (pulse 0.51 : l'architecture reste, la fiche part ; avant, 33 280) ; refine : mesure 4 766 (ni fiche ni architecture, à la demande ; avant, 33 280).
const PLAFONDS_PACK_SANS_FICHE = { tech: { plafond: 13500 }, security: { plafond: 6500 }, plan: { plafond: 18000, architecture: true }, refine: { plafond: 5500 } };
// pulse-aidd contexte <commande> dans un projet qui déclare le pack. Mesures à la fin du plan « Corrections 4 » : implement 60 103, spirc 49 017 (plafond = mesure × 1,05, au 500 supérieur).
// pulse 0.50 : spirc et implement laissent le pack à leurs agents, `contexte` ne le contient plus ; plafonds = mesure × 1,05 : implement 44 534 (avant 65 242), spirc 33 412 (avant 51 627).
const PLAFONDS_AVEC_PACK = { implement: 47000, spirc: 35500 }; // implement : avant, mesure 65 242 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, 64 704 (pulse 0.48 : filet anti-régression, tests-automatiques.md § 2 ter) ; spirc : mesure 51 627 (pulse 0.42 : rythme rapide, option -f, gestes)

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
  "boucle implement de 4 tâches": { plafond: 100500, /* mesure 95 300 (pulse 0.50 : le pack laissé à l'agent implementer) ; avant, 119 519 (relecture finale de la phase 1 : annonce des deux accords du dépôt distant) ; avant, 119 035 (même cause que commit : annonce de l'accord avant git remote add, git.md ; avant 112 943, pulse 0.42 : rythme rapide, option -f, gestes) */ parties: [[projetAvecPack, "contexte", "implement"], [projetAvecPack, "etape", "review", "--sans-communes"], [projetAvecPack, "etape", "commit", "--sans-communes"], [projetAvecPack, "reference", "depot-distant.md"]] },
  "boucle spirc de 4 tâches": { plafond: 91000, /* mesure 86 453 (pulse 0.50 : le pack laissé aux agents qui codent) ; avant, 108 552 (même cause que commit : annonce de l'accord avant git remote add, git.md ; avant 103 017, pulse 0.43 : ronde de départ de spirc) */ parties: [[projetAvecPack, "contexte", "spirc"], [projetAvecPack, "etape", "commit", "--sans-communes"], [projetAvecPack, "reference", "worktree.md"], [projetAvecPack, "reference", "tests-automatiques.md"], [projetAvecPack, "reference", "memoire.md"]] },
  "tech, pack choisi en cours de commande": { plafond: 84500, /* mesure 80 070 (pulse 0.51 : le pack de tech sans la fiche, l'architecture ni le thème) ; avant, 114 094 (pulse 0.50 : règles communes en noyau et modules) ; avant, 123 389 (pulse 0.50 : familles de qualité raccourcies) ; avant, 124 606 */ parties: [[projetSansPack, "etape", "tech"], [projetAvecPack, "pile", "contexte", "tech"]] },
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
  cicd: 56500, // mesure 53 554 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 65 020 (relecture finale de la phase 1 : étapes commit et deploy chaînées, leurs commandes autorisées dans l'en-tête) ; avant, mesure 61 680
  deploy: 58000, // mesure 54 906 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 62 576
  express: 45500, // mesure 42 894 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 48 606 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 51 845 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, mesure 48 733
  fix: 53000, // mesure 50 228 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 51 889
  perf: 85500, // mesure 81 098 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 90 334 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 95 315
  plan: 83500, // mesure 79 197 (pulse 0.51 : le pack de plan sans la fiche du code) ; avant, mesure 94 212 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 97 652 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 100 752
  rediger: 26500, // mesure 24 764 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 34 022 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 34 612 (pulse 0.42 : rythme rapide, option -f, gestes)
  refine: 57500, // mesure 54 577 (pulse 0.51 : le pack de refine sans la fiche ni l'architecture) ; avant, mesure 81 487 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 84 457 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 86 865
  review: 39500, // mesure 37 526 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 39 407 (pulse 0.48 : captures gardées, examen.md ; avant, 36 785 : pulse 0.40 : règle commune 19 et fiche de test)
  "search-console": 51500, // mesure 48 616 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 57 057
  secrets: 62500, // mesure 59 103 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 67 057
  security: 46500, // mesure 44 263 (pulse 0.51 : la fiche et l'architecture à la demande, `pile contexte security` passe sous le seuil de lecture de 30 000) ; avant, mesure 72 074 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 79 138 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 83 589
  seo: 89500, // mesure 84 978 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 92 297 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 96 880
  spec: 47000, // mesure 44 700 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 50 549 (pulse 0.50 : etape sans en-tête ni Exemples) ; avant, mesure 51 162 (pulse 0.44 : présentation des écrans choisie dans la spec)
  tech: 84500, // mesure 80 113 (pulse 0.51 : le pack de tech sans la fiche, l'architecture ni le thème) ; avant, mesure 114 137 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 123 432 (pulse 0.50 : familles de qualité raccourcies) ; avant, mesure 124 649 (pulse 0.50 : etape sans en-tête ni Exemples), et avant encore 127 942
  test: 52500, // mesure 52 330 (refactoring d'optimisation, tâche 1.3 : une commande n'en lance plus une autre (étapes fix et auto-fix chaînées, règles communes § 4)) ; avant, mesure 49 417 (pulse 0.42 : rythme rapide, option -f, gestes)
  ui: 88000, // mesure 83 431 (pulse 0.50 : règles communes en noyau et modules) ; avant, mesure 85 248
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
  reviewer: { plafond: 47500, /* mesure 45 184 (pulse 0.51 : l'architecture à la demande, `pile contexte review` sous le seuil de lecture de 30 000) ; avant, 56 335 */ parties: [["agent", "reviewer"], ["qualite", "--checklists"], ["reference", "checklist-securite.md"], ["pile", "contexte", "review"]] },
  "test-writer": { plafond: 43000, /* mesure 40 730 (pulse 0.50 : références de tests raccourcies) ; avant, 43 381 */ parties: [["agent", "test-writer"], ["tests", "ecrire", "gherkin", "tdd", "unitaire"], ["pile", "contexte", "test"]] },
  "test-runner": { plafond: 29500, /* mesure 27 947 (pulse 0.50 : références de tests raccourcies) ; avant, 29 844 */ parties: [["agent", "test-runner"], ["tests", "ecrire", "unitaire"], ["pile", "contexte", "test"]] },
};
const chargementAgent = (parties) => parties.reduce((somme, args) => somme + taille(projetAvecPack, ...args), 0);

for (const [agent, { plafond, parties }] of Object.entries(AGENTS_AVEC_PACK)) {
  test(`cœur et pack : agent ${agent} ≤ ${plafond} caractères chargés avant le code`, { skip: !fs.existsSync(COEUR) }, () => {
    const total = chargementAgent(parties);
    assert.ok(total <= plafond, `${total} > ${plafond}`);
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
  console.log(lignes.join("\n"));
}

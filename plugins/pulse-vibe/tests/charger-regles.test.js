// Tests du chargement des règles par morceaux : pulse-aidd qualite <familles> [--tout] [--checklists], pulse-aidd tests <morceaux> [--tout] [--checklists],
// la règle de travail sobre en tête, et les familles qu'un pack de pile déclare couvrir.
// Lancer : node --test plugins/pulse-vibe/tests/charger-regles.test.js (nécessite bash dans le PATH)
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const chargeur = require(path.join(RACINE, "scripts", "charger-regles.js"));
// Chemin relatif et cwd = racine du plugin : aucun docs/technical.md, donc aucun pack de pile.
const lancer = (args, env = {}) =>
  spawnSync("bash", ["bin/pulse-aidd", ...args], { cwd: RACINE, encoding: "utf8", env: { ...process.env, ...env } });

/** Vrai si les titres apparaissent dans la sortie, dans cet ordre. */
function dansLOrdre(sortie, titres) {
  let depuis = 0;
  for (const t of titres) {
    const i = sortie.indexOf(`===== ${t} =====`, depuis);
    if (i < 0) return false;
    depuis = i;
  }
  return true;
}

test("qualite sans famille : la règle de choix, sans aucune famille, sous 4 000 caractères", () => {
  const r = lancer(["qualite"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.length < 4000, String(r.stdout.length));
  assert.ok(dansLOrdre(r.stdout, ["Travailler sobrement", "Règles de qualité du code"]), r.stdout.slice(0, 300));
  assert.ok(r.stdout.includes("Relancez avec les familles utiles"));
  for (const nom of ["clean-code", "composants", "securite", "organisation"]) assert.ok(r.stdout.includes(nom), nom);
  assert.match(r.stdout, /`clean-code` toujours ; `composants` si la tâche touche l'interface ; `securite` pour un point d'entrée serveur, une action, une route ou la base ; `organisation` pour un nouveau fichier ou dossier/);
  for (const titre of ["Clean code", "Composants d'interface", "Sécurité du code", "Organisation des fichiers et nommage"]) assert.ok(!r.stdout.includes(`===== ${titre} =====`), titre);
});

test("qualite --tout : les quatre familles, dans l'ordre, et la règle sobre en tête", () => {
  const r = lancer(["qualite", "--tout"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes("Relancez avec"));
  assert.ok(
    dansLOrdre(r.stdout, [
      "Travailler sobrement",
      "Règles de qualité du code",
      "Clean code",
      "Organisation des fichiers et nommage",
      "Composants d'interface",
      "Sécurité du code",
    ]),
    r.stdout.slice(0, 500),
  );
});

test("qualite clean-code securite : seulement ces familles", () => {
  const r = lancer(["qualite", "clean-code", "securite"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("===== Clean code ====="));
  assert.ok(r.stdout.includes("===== Sécurité du code ====="));
  assert.ok(!r.stdout.includes("Composants d'interface"));
  assert.ok(!r.stdout.includes("Organisation des fichiers et nommage"));
});

test("qualite --checklists : une checklist par famille, bien plus court", () => {
  const complet = lancer(["qualite", "--tout"]).stdout;
  const r = lancer(["qualite", "--checklists"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual((r.stdout.match(/ : checklist =====/g) || []).length, 4, r.stdout.slice(0, 800));
  assert.ok(r.stdout.length < complet.length * 0.25, `${r.stdout.length} / ${complet.length}`);
  assert.ok(!r.stdout.includes("## 1. Principes"));
});

test("chaque famille a exactement une section Checklist", () => {
  for (const f of chargeur.familles("qualite")) {
    const texte = fs.readFileSync(f.fichier, "utf8");
    assert.strictEqual((texte.match(/^## .*Checklist/gm) || []).length, 1, f.nom);
    assert.ok(chargeur.checklist(texte), f.nom);
  }
});

test("nom inconnu : liste des noms valides", () => {
  const r = lancer(["qualite", "secu"]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout + r.stderr, /clean-code, organisation, composants, securite/);
  assert.ok(!r.stdout.includes("===== Clean code ====="));
});

test("relais PowerShell : familles et --checklists transmis", () => {
  const r = lancer([], { PULSE_RELAIS_ARGC: "3", PULSE_RELAIS_ARG_0: "qualite", PULSE_RELAIS_ARG_1: "securite", PULSE_RELAIS_ARG_2: "--checklists" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("===== Sécurité du code : checklist ====="));
  assert.ok(!r.stdout.includes("Clean code : checklist"));
});

test("travail-sobre.md : court et positif", () => {
  const texte = fs.readFileSync(path.join(RACINE, "references", "travail-sobre.md"), "utf8");
  assert.ok(texte.length < 1500, String(texte.length));
  for (const idee of [/[Cc]herche[rz]? .*avant de lire/, /[Ff]iltre/, /inchangé/, /lignes qui changent/, /critères passent/, /qualité/]) {
    assert.match(texte, idee);
  }
});

const TITRES_TESTS = [
  "Stratégie de tests",
  "Écrire un test",
  "Tests unitaires",
  "Tests d'intégration",
  "Tests de bout en bout",
  "Développement piloté par les tests (TDD)",
  "Scénarios Gherkin",
];

test("tests sans morceau : le sommaire et « Relancez avec les morceaux utiles », sous 4 000 caractères", () => {
  const r = lancer(["tests"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.length < 4000, String(r.stdout.length));
  assert.ok(dansLOrdre(r.stdout, ["Travailler sobrement", "Stratégie de tests : sommaire"]), r.stdout.slice(0, 300));
  assert.ok(r.stdout.includes("Relancez avec les morceaux utiles"));
  for (const t of TITRES_TESTS) assert.ok(!r.stdout.includes(`===== ${t} =====`), t);
});

test("tests --tout : la méthode entière, règle sobre en plus", () => {
  const r = lancer(["tests", "--tout"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(dansLOrdre(r.stdout, ["Travailler sobrement", "Stratégie de tests : sommaire", ...TITRES_TESTS]), r.stdout.slice(0, 500));
  assert.ok(!r.stdout.includes("Relancez avec"));
});

test("tests ecrire unitaire --checklists : seulement des sections de contrôle", () => {
  const r = lancer(["tests", "ecrire", "unitaire", "--checklists"]);
  assert.strictEqual(r.status, 0, r.stderr);
  const sections = r.stdout.split("\n").filter((l) => /^## /.test(l));
  assert.ok(sections.length >= 3, sections.join("|"));
  for (const l of sections) assert.match(l, /Checklist|Liste de contrôle|Signaux d'alerte/, l);
  assert.ok(r.stdout.includes("===== Écrire un test : checklist ====="));
  assert.ok(r.stdout.includes("===== Tests unitaires : checklist ====="));
  assert.ok(!r.stdout.includes("===== Tests d'intégration"));
});

test("tests ecrire tdd gherkin unitaire : le nécessaire du test-writer", () => {
  const r = lancer(["tests", "ecrire", "tdd", "gherkin", "unitaire"]);
  assert.strictEqual(r.status, 0, r.stderr);
  for (const t of ["Écrire un test", "Tests unitaires", "Développement piloté par les tests (TDD)", "Scénarios Gherkin"]) {
    assert.ok(r.stdout.includes(`===== ${t} =====`), t);
  }
  for (const t of ["Tests d'intégration", "Tests de bout en bout", "Stratégie de tests"]) assert.ok(!r.stdout.includes(`===== ${t} =====`), t);
});

test("tests : nom inconnu", () => {
  const r = lancer(["tests", "unitaires"]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout + r.stderr, /strategie, ecrire, unitaire, integration, bout-en-bout, tdd, gherkin/);
});

// Projet d'essai qui déclare le pack Next ; le pack est mis dans le PATH, comme dans Claude Code, sauf pour « non installé ».
const os = require("os");
const PACK_BIN = path.join(RACINE, "..", "pulse-vibe-next", "bin");
const PROJET_PACK = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-regles-pack-"));
fs.mkdirSync(path.join(PROJET_PACK, "docs"));
fs.writeFileSync(path.join(PROJET_PACK, "docs", "technical.md"), "**Pack de pile Pulse** : next\n");
function dansLeProjet(args, { avecPack = true } = {}) {
  const outil = path.join(RACINE, "bin", "pulse-aidd").split(path.sep).join("/");
  const bin = PACK_BIN.split(path.sep).join("/");
  const chemin = avecPack ? `PATH="$(cd "${bin}" && pwd):$PATH" ` : "";
  return spawnSync("bash", ["-c", `${chemin}exec bash "${outil}" "$@"`, "regles", ...args], { cwd: PROJET_PACK, encoding: "utf8" });
}

test("pack qui couvre l'organisation : famille remplacée par un renvoi, sécurité gardée", { skip: !fs.existsSync(PACK_BIN) }, () => {
  const r = dansLeProjet(["qualite", "--tout"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("Couverte par le pack Pulse Next.js"), r.stdout.slice(0, 300));
  assert.ok(!r.stdout.includes("## 5. Le code : des paliers progressifs"));
  assert.ok(r.stdout.includes("===== Sécurité du code ====="));
  const checklists = dansLeProjet(["qualite", "--checklists"]).stdout;
  assert.ok(!checklists.includes("Organisation des fichiers et nommage : checklist"));
  assert.ok(checklists.includes("Sécurité du code : checklist"));
});

test("pack non installé : organisation gardée", () => {
  const r = dansLeProjet(["qualite", "--tout"], { avecPack: false });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("## 5. Le code : des paliers progressifs"));
});

test("contexte tech : l'organisation se charge à l'étape 6.1, projet neuf sans pack, plutôt qu'au lancement", () => {
  const r = dansLeProjet(["contexte", "tech"], { avecPack: false });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes("===== Organisation des fichiers et nommage ====="), "organisation hors du contexte de tech");
  const tech = fs.readFileSync(path.join(RACINE, "skills", "tech", "SKILL.md"), "utf8");
  assert.match(tech, /Projet neuf sans pack : lancer `pulse-aidd reference qualite\/organisation\.md`/);
});

test("un pack remplace seulement l'organisation, jamais la sécurité du code", () => {
  const r = chargeur.composer("qualite", ["securite", "organisation"], { couvre: ["organisation", "securite", "clean-code"], nom: "Essai" });
  assert.ok(r.sortie.includes("## 14. Checklist avant de livrer"), "sécurité gardée");
  assert.ok(r.sortie.includes("Couverte par le pack Essai"), "organisation remplacée");
});

test("avec des noms : la règle sobre sans le sommaire, qui reste réservé à l'appel sans nom", () => {
  const r = lancer(["qualite", "clean-code"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("===== Travailler sobrement ====="));
  assert.ok(!r.stdout.includes("===== Règles de qualité du code ====="), "sommaire absent");
  assert.ok(r.stdout.includes("===== Clean code ====="));
  const tests = lancer(["tests", "tdd"]);
  assert.ok(tests.stdout.includes("===== Travailler sobrement ====="));
  assert.ok(!tests.stdout.includes("===== Stratégie de tests : sommaire ====="));
  const tout = lancer(["qualite", "--tout"]);
  assert.ok(tout.stdout.includes("===== Règles de qualité du code ====="), "--tout garde le sommaire");
});

test("--tout avec des noms : toutes les familles, les noms sont ignorés", () => {
  const r = lancer(["qualite", "securite", "--tout"]);
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of ["Clean code", "Organisation des fichiers et nommage", "Composants d'interface", "Sécurité du code"]) assert.ok(r.stdout.includes(`===== ${titre} =====`), titre);
});

test("un morceau sans liste de contrôle : « (aucune liste de contrôle) » avec --checklists", () => {
  const r = lancer(["tests", "tdd", "--checklists"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("===== Développement piloté par les tests (TDD) : checklist =====\n\n(aucune liste de contrôle)\n"), r.stdout.slice(-300));
});

test("l'aide de pulse-aidd montre --tout pour qualite et tests", () => {
  const aide = fs.readFileSync(path.join(RACINE, "bin", "pulse-aidd"), "utf8");
  assert.ok(aide.includes("#   pulse-aidd qualite <famille…> [--tout] [--checklists]"));
  assert.ok(aide.includes("#   pulse-aidd tests <morceau…> [--tout] [--checklists]"));
});

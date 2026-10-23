// Tests du chargement des règles par morceaux : pulse-aidd qualite [familles] [--checklists], pulse-aidd tests [morceaux],
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

test("qualite sans argument : les quatre familles, dans l'ordre, et la règle sobre en tête", () => {
  const r = lancer(["qualite"]);
  assert.strictEqual(r.status, 0, r.stderr);
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
  const complet = lancer(["qualite"]).stdout;
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

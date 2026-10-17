// Tests de pulse-aidd captures (scripts/captures.js) : effacer les captures d'une US.
// Lancer : node --test plugins/pulse-vibe/tests/captures.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "captures.js");

function projet() {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-captures-"));
  const captures = path.join(dossier, "aidd_docs", "captures");
  fs.mkdirSync(path.join(captures, "US-001"), { recursive: true });
  fs.mkdirSync(path.join(captures, "US-002"), { recursive: true });
  fs.writeFileSync(path.join(captures, "US-001", "T1-critere-1-ordinateur.png"), "x");
  fs.writeFileSync(path.join(captures, "US-002", "T1-critere-1-ordinateur.png"), "x");
  return { dossier, captures };
}
const lancer = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8" });

test("effacer retire le dossier de l'US demandée, et seulement lui", () => {
  const { dossier, captures } = projet();
  const r = lancer(dossier, "effacer", "US-001");
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /US-001/);
  assert.strictEqual(r.stdout.trim().split("\n").length, 1);
  assert.ok(!fs.existsSync(path.join(captures, "US-001")));
  assert.ok(fs.existsSync(path.join(captures, "US-002", "T1-critere-1-ordinateur.png")));
  fs.rmSync(dossier, { recursive: true, force: true });
});

test("effacer refuse un nom qui sort du dossier des captures", () => {
  const { dossier, captures } = projet();
  fs.mkdirSync(path.join(dossier, "x"));
  for (const nom of ["../x", "US-1/..", "US-001/..", path.resolve(dossier, "x"), "US-12", "..", "US-001/../US-002", ""]) {
    const r = lancer(dossier, "effacer", nom);
    assert.notStrictEqual(r.status, 0, `refusé : ${nom}`);
  }
  assert.ok(fs.existsSync(path.join(dossier, "x")));
  assert.ok(fs.existsSync(path.join(captures, "US-001")));
  assert.ok(fs.existsSync(path.join(captures, "US-002")));
  fs.rmSync(dossier, { recursive: true, force: true });
});

test("effacer sans dossier : silencieux, code 0", () => {
  const { dossier } = projet();
  const r = lancer(dossier, "effacer", "US-777");
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), "");
  fs.rmSync(dossier, { recursive: true, force: true });
});

test("une action inconnue affiche l'usage et sort en erreur", () => {
  const { dossier } = projet();
  const r = lancer(dossier, "autre");
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /effacer/);
  fs.rmSync(dossier, { recursive: true, force: true });
});

test("effacer depuis un sous-dossier du projet : la racine vient de Git", () => {
  const { dossier, captures } = projet();
  spawnSync("git", ["init", "-q"], { cwd: dossier });
  const sous = path.join(dossier, "src", "lib");
  fs.mkdirSync(sous, { recursive: true });
  const r = lancer(sous, "effacer", "US-001");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(path.join(captures, "US-001")));
  assert.ok(!fs.existsSync(path.join(sous, "aidd_docs")));
  fs.rmSync(dossier, { recursive: true, force: true });
});

test("effacer impossible (suppression refusée) : une phrase simple, code 1, sans trace technique", () => {
  const { effacer } = require(SCRIPT);
  const { dossier } = projet();
  const rmSync = fs.rmSync;
  fs.rmSync = () => {
    throw Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
  };
  let r;
  try {
    r = effacer("US-001", dossier);
  } finally {
    fs.rmSync = rmSync;
  }
  assert.strictEqual(r.code, 1);
  assert.match(r.erreur, /US-001/);
  assert.doesNotMatch(r.erreur, /EBUSY|at /);
  fs.rmSync(dossier, { recursive: true, force: true });
});

// Tests du marqueur « réalisation en cours » (aidd_docs/tasks/realisation.json).
// Lancer : node --test plugins/pulse-vibe/tests/realisation.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "realisation.js");
const MARQUEUR = path.join("aidd_docs", "tasks", "realisation.json");

function projet() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pulse-realisation-"));
}

function lancer(dossier, ...args) {
  return spawnSync("node", [SCRIPT, ...args], {
    encoding: "utf8",
    cwd: dossier,
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", CLAUDE_PLUGIN_ROOT: "" },
  });
}

const marqueur = (dossier) => JSON.parse(fs.readFileSync(path.join(dossier, MARQUEUR), "utf8"));

test("debut crée le marqueur avec l'US, la commande, le rythme et l'autonomie", () => {
  const d = projet();
  const r = lancer(d, "debut", "US-003", "--commande", "spirc", "--rythme", "rapide", "--autonome");
  assert.strictEqual(r.status, 0, r.stderr);
  const m = marqueur(d);
  assert.strictEqual(m.us, "US-003");
  assert.strictEqual(m.commande, "spirc");
  assert.strictEqual(m.rythme, "rapide");
  assert.strictEqual(m.autonome, true);
  assert.strictEqual(m.questions, 0);
  assert.ok(!Number.isNaN(Date.parse(m.debut)) && !Number.isNaN(Date.parse(m.maj)));
  assert.deepStrictEqual(fs.readdirSync(path.dirname(path.join(d, MARQUEUR))), ["realisation.json"], "pas de fichier temporaire oublié");
});

test("debut sans --autonome : autonome faux", () => {
  const d = projet();
  lancer(d, "debut", "US-001", "--commande", "implement", "--rythme", "complet");
  assert.strictEqual(marqueur(d).autonome, false);
});

test("etape et questions mettent à jour tache, etape, questions et maj", () => {
  const d = projet();
  lancer(d, "debut", "US-003", "--commande", "spirc", "--rythme", "complet");
  const avant = marqueur(d).maj;
  assert.strictEqual(lancer(d, "etape", "T2", "examen").status, 0);
  assert.strictEqual(lancer(d, "questions", "3").status, 0);
  const m = marqueur(d);
  assert.strictEqual(m.tache, "T2");
  assert.strictEqual(m.etape, "examen");
  assert.strictEqual(m.questions, 3);
  assert.ok(Date.parse(m.maj) >= Date.parse(avant));
});

test("fin supprime le marqueur ; sans marqueur, la commande nue n'affiche rien", () => {
  const d = projet();
  const vide = lancer(d);
  assert.strictEqual(vide.status, 0);
  assert.strictEqual(vide.stdout, "");
  lancer(d, "debut", "US-003", "--commande", "spirc", "--rythme", "complet");
  const nue = lancer(d);
  assert.match(nue.stdout, /^us: US-003$/m);
  assert.match(nue.stdout, /^rythme: complet$/m);
  assert.strictEqual(lancer(d, "fin").status, 0);
  assert.ok(!fs.existsSync(path.join(d, MARQUEUR)));
  assert.strictEqual(lancer(d, "fin").status, 0, "fin sans marqueur : sans erreur");
  assert.strictEqual(lancer(d).stdout, "");
});

test("etape sans marqueur : sans erreur, rien n'est créé", () => {
  const d = projet();
  assert.strictEqual(lancer(d, "etape", "T1", "test").status, 0);
  assert.ok(!fs.existsSync(path.join(d, MARQUEUR)));
});

test("lire et rappel : où on en est", () => {
  const { lire, rappel } = require(SCRIPT);
  const d = projet();
  assert.strictEqual(lire(d), null);
  assert.strictEqual(rappel(d), "");
  lancer(d, "debut", "US-003", "--commande", "spirc", "--rythme", "rapide");
  lancer(d, "etape", "T2", "examen");
  const texte = rappel(d);
  assert.match(texte, /US-003/);
  assert.match(texte, /T2/);
  assert.match(texte, /examen/);
  assert.ok(!/question/.test(texte));
  lancer(d, "questions", "2");
  assert.match(rappel(d), /2 questions vous attendent/);
  lancer(d, "questions", "1");
  assert.match(rappel(d), /1 question vous attend/);
  assert.strictEqual(lire(d).questions, 1);
});

test("--rappel affiche le rappel", () => {
  const d = projet();
  assert.strictEqual(lancer(d, "--rappel").stdout, "");
  lancer(d, "debut", "US-003", "--commande", "spirc", "--rythme", "rapide");
  assert.match(lancer(d, "--rappel").stdout, /US-003/);
});

test("marqueur illisible : lire renvoie null, sans erreur", () => {
  const { lire } = require(SCRIPT);
  const d = projet();
  fs.mkdirSync(path.join(d, "aidd_docs", "tasks"), { recursive: true });
  fs.writeFileSync(path.join(d, MARQUEUR), "{pas du json", "utf8");
  assert.strictEqual(lire(d), null);
  assert.strictEqual(lancer(d).status, 0);
});

test("--rappel : la racine vient de CLAUDE_PROJECT_DIR quand elle est donnée", () => {
  const d = projet();
  const ailleurs = projet();
  lancer(d, "debut", "US-009", "--commande", "spirc", "--rythme", "rapide");
  const r = spawnSync("node", [SCRIPT, "--rappel"], { encoding: "utf8", cwd: ailleurs, env: { ...process.env, CLAUDE_PROJECT_DIR: d } });
  assert.match(r.stdout, /US-009/);
  assert.strictEqual(lancer(ailleurs, "--rappel").stdout, "");
});

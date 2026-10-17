// Tests de la notification pendant une réalisation (hook Notification).
// Lancer : node --test plugins/pulse-vibe/tests/notifier.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const HOOK = path.join(__dirname, "..", "scripts", "notifier.js");
const { message } = require("../scripts/notifier");

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-notifier-"));
const PULSE = path.join(BASE, "pulse");
const AUTRE = path.join(BASE, "autre");
for (const d of [PULSE, AUTRE]) spawnSync("git", ["init", "-q", d]);
fs.writeFileSync(path.join(PULSE, "CLAUDE.md"), "# Projet\n\n<!-- pulse_profil:debut -->\n<!-- pulse_profil:fin -->\n");
fs.writeFileSync(path.join(AUTRE, "CLAUDE.md"), "# Projet sans Pulse\n");
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));

function marqueur(dossier, etat) {
  fs.mkdirSync(path.join(dossier, "aidd_docs", "tasks"), { recursive: true });
  fs.writeFileSync(path.join(dossier, "aidd_docs", "tasks", "realisation.json"), JSON.stringify({ maj: new Date().toISOString(), ...etat }));
}

function lancer(entree, env = {}) {
  const r = spawnSync("node", [HOOK], { input: JSON.stringify(entree), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", ...env } });
  assert.strictEqual(r.status, 0);
  return r.stdout ? JSON.parse(r.stdout) : null;
}

test("message : questions, test de groupe, accord, sinon réponse ; rien sans marqueur", () => {
  assert.match(message({ questions: 2 }, "idle_prompt"), /2 questions vous attendent/);
  assert.match(message({ questions: 1 }, "idle_prompt"), /1 question vous attend/);
  assert.match(message({ questions: 0, etape: "test-groupe" }, "idle_prompt"), /La réalisation est terminée : à vous de tester/);
  assert.match(message({ questions: 0, etape: "test" }, "permission_prompt"), /Claude Code attend votre accord/);
  assert.match(message({ questions: 2, etape: "questions" }, "permission_prompt"), /Claude Code attend votre accord/, "une demande d'accord passe avant les questions");
  assert.match(message({ questions: 0, etape: "test-groupe" }, "permission_prompt"), /Claude Code attend votre accord/);
  assert.match(message({ questions: 0, etape: "test" }, "idle_prompt"), /Pulse attend votre réponse/);
  assert.strictEqual(message(null, "idle_prompt"), null);
});

test("sans marqueur : aucune sortie", () => {
  assert.strictEqual(lancer({ notification_type: "idle_prompt", cwd: PULSE }), null);
});

test("avec questions : la séquence OSC 9 porte le message", () => {
  marqueur(PULSE, { us: "US-001", questions: 2, etape: "questions" });
  const s = lancer({ notification_type: "idle_prompt", cwd: PULSE });
  assert.strictEqual(s.terminalSequence, "\u001b]9;Pulse – 2 questions vous attendent\u0007");
});

test("hors projet Pulse : rien, même avec un marqueur", () => {
  marqueur(AUTRE, { us: "US-001", questions: 2 });
  assert.strictEqual(lancer({ notification_type: "idle_prompt", cwd: AUTRE }), null);
});

test("marqueur périmé (plus de 6 h) : aucune sortie", () => {
  marqueur(PULSE, { us: "US-001", questions: 2, maj: new Date(Date.now() - 7 * 3600 * 1000).toISOString() });
  assert.strictEqual(lancer({ notification_type: "idle_prompt", cwd: PULSE }), null);
});

test("le marqueur sous la racine Git du cwd passe avant celui de CLAUDE_PROJECT_DIR", () => {
  const ailleurs = path.join(BASE, "ailleurs");
  spawnSync("git", ["init", "-q", ailleurs]);
  fs.copyFileSync(path.join(PULSE, "CLAUDE.md"), path.join(ailleurs, "CLAUDE.md"));
  marqueur(ailleurs, { us: "US-002", questions: 1 });
  marqueur(PULSE, { us: "US-001", questions: 0, etape: "test-groupe" });
  fs.mkdirSync(path.join(ailleurs, "src"), { recursive: true });
  const s = lancer({ notification_type: "idle_prompt", cwd: path.join(ailleurs, "src") }, { CLAUDE_PROJECT_DIR: PULSE });
  assert.match(s.terminalSequence, /1 question vous attend/);
});

test("la racine vient de CLAUDE_PROJECT_DIR quand elle est donnée", () => {
  marqueur(PULSE, { us: "US-001", questions: 0, etape: "test-groupe" });
  const s = lancer({ notification_type: "idle_prompt", cwd: AUTRE }, { CLAUDE_PROJECT_DIR: PULSE });
  assert.match(s.terminalSequence, /à vous de tester/);
});

test("entrée illisible : rien, sortie 0", () => {
  const r = spawnSync("node", [HOOK], { input: "pas du json", encoding: "utf8" });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, "");
});

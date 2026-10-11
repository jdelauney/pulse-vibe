// Tests du point d'entrée unique des garde-fous (hook PreToolUse).
// Lancer : node --test plugins/pulse-vibe/tests/garde.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const HOOK = path.join(__dirname, "..", "scripts", "garde.js");
const { combiner, projetPulse } = require("../scripts/garde");

// Un projet Pulse (CLAUDE.md du modèle) et un projet sans Pulse, chacun dans son dépôt.
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-garde-"));
const PULSE = path.join(BASE, "pulse");
const AUTRE = path.join(BASE, "autre");
for (const d of [PULSE, AUTRE]) fs.mkdirSync(path.join(d, ".git"), { recursive: true });
fs.writeFileSync(path.join(PULSE, "CLAUDE.md"), "# Projet\n\n<!-- pulse_profil:debut -->\n<!-- pulse_profil:fin -->\n");
fs.writeFileSync(path.join(AUTRE, "CLAUDE.md"), "# Projet sans Pulse\n");
fs.mkdirSync(path.join(PULSE, "src", "lib"), { recursive: true });
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));

function lancer(entree, env = {}) {
  const r = spawnSync("node", [HOOK], {
    input: typeof entree === "string" ? entree : JSON.stringify(entree),
    encoding: "utf8",
    env: { ...process.env, PULSE_GARDE_OFF: "", PULSE_GARDE_COMMANDES_OFF: "", ...env },
  });
  assert.strictEqual(r.status, 0, "le hook sort toujours avec le code 0");
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
}
const bash = (command, cwd = PULSE) => ({ tool_name: "Bash", tool_input: { command }, cwd });
const cle = ["sk", "test", "4eC39HqLyjWDarjtT1zdp7dc"].join("_");

test("combiner : le refus l'emporte sur l'accord, les raisons d'un même niveau s'additionnent", () => {
  assert.strictEqual(combiner([null, null]), null);
  assert.deepStrictEqual(combiner([{ decision: "ask", raison: "a" }, { decision: "deny", raison: "b" }]), { decision: "deny", raison: "b" });
  assert.deepStrictEqual(combiner([{ decision: "ask", raison: "a" }, null, { decision: "ask", raison: "c" }]), { decision: "ask", raison: "a\n\nc" });
  assert.deepStrictEqual(combiner([{ decision: "deny", raison: "a" }, { decision: "deny", raison: "a" }]), { decision: "deny", raison: "a" });
});

test("une commande passe par les deux garde-fous", () => {
  assert.strictEqual(lancer(bash("git push --force")).permissionDecision, "deny");
  assert.strictEqual(lancer(bash("git reset --hard")).permissionDecision, "ask");
  assert.strictEqual(lancer(bash("ls -la")), null);
  assert.strictEqual(lancer({ tool_name: "PowerShell", tool_input: { command: "Get-Content .env" }, cwd: PULSE }).permissionDecision, "deny");
});

test("écritures et lectures passent par le garde-fou anti-secrets", () => {
  assert.strictEqual(lancer({ tool_name: "Write", tool_input: { file_path: "/p/app.js", content: `const k = "${cle}";` }, cwd: PULSE }).permissionDecision, "deny");
  assert.strictEqual(lancer({ tool_name: "Read", tool_input: { file_path: "/p/.env" }, cwd: PULSE }).permissionDecision, "deny");
  assert.strictEqual(lancer({ tool_name: "Read", tool_input: { file_path: "/p/README.md" }, cwd: PULSE }), null);
});

test("chaque garde-fou se désactive séparément ; entrée illisible : rien n'est bloqué", () => {
  assert.strictEqual(lancer(bash("git push --force"), { PULSE_GARDE_COMMANDES_OFF: "1" }), null);
  assert.strictEqual(lancer({ tool_name: "Read", tool_input: { file_path: "/p/.env" }, cwd: PULSE }, { PULSE_GARDE_OFF: "1" }), null);
  assert.strictEqual(lancer(bash("cat .env"), { PULSE_GARDE_OFF: "1" }).permissionDecision, "deny");
  for (const e of ["", "pas du json"]) assert.strictEqual(lancer(e), null);
});

test("un refus de commande est rendu sans attendre le garde-fou anti-secrets", () => {
  const r = lancer(bash("git push --force"));
  assert.strictEqual(r.permissionDecision, "deny");
  assert.ok(!/secrets/i.test(r.permissionDecisionReason) || r.permissionDecisionReason.includes("🔒"));
});

test("projetPulse : un CLAUDE.md du modèle Pulse, du dossier courant jusqu'à la racine du dépôt", () => {
  assert.strictEqual(projetPulse(PULSE), true);
  assert.strictEqual(projetPulse(path.join(PULSE, "src", "lib")), true);
  assert.strictEqual(projetPulse(AUTRE), false);
  // La recherche s'arrête à la racine du dépôt : un sous-dépôt sans Pulse ne l'hérite pas.
  const sous = path.join(PULSE, "vendor", "outil");
  fs.mkdirSync(path.join(sous, ".git"), { recursive: true });
  assert.strictEqual(projetPulse(sous), false);
});

test("hors d'un projet Pulse, les garde-fous laissent tout passer", () => {
  for (const c of ["git add -A", "git add .", "git push --force", "cat .env"]) assert.strictEqual(lancer(bash(c, AUTRE)), null, c);
  assert.strictEqual(lancer({ tool_name: "Read", tool_input: { file_path: "/p/.env" }, cwd: AUTRE }), null);
});

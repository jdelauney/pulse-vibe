// Tests du point d'entrée unique des garde-fous (hook PreToolUse).
// Lancer : node --test plugins/pulse-vibe/tests/garde.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const HOOK = path.join(__dirname, "..", "scripts", "garde.js");
const { combiner } = require("../scripts/garde");

function lancer(entree, env = {}) {
  const r = spawnSync("node", [HOOK], {
    input: typeof entree === "string" ? entree : JSON.stringify(entree),
    encoding: "utf8",
    env: { ...process.env, PULSE_GARDE_OFF: "", PULSE_GARDE_COMMANDES_OFF: "", ...env },
  });
  assert.strictEqual(r.status, 0, "le hook sort toujours avec le code 0");
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
}
const bash = (command) => ({ tool_name: "Bash", tool_input: { command }, cwd: os.tmpdir() });
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
  assert.strictEqual(lancer({ tool_name: "PowerShell", tool_input: { command: "Get-Content .env" }, cwd: os.tmpdir() }).permissionDecision, "deny");
});

test("écritures et lectures passent par le garde-fou anti-secrets", () => {
  assert.strictEqual(lancer({ tool_name: "Write", tool_input: { file_path: "/p/app.js", content: `const k = "${cle}";` } }).permissionDecision, "deny");
  assert.strictEqual(lancer({ tool_name: "Read", tool_input: { file_path: "/p/.env" } }).permissionDecision, "deny");
  assert.strictEqual(lancer({ tool_name: "Read", tool_input: { file_path: "/p/README.md" } }), null);
});

test("chaque garde-fou se désactive séparément ; entrée illisible : rien n'est bloqué", () => {
  assert.strictEqual(lancer(bash("git push --force"), { PULSE_GARDE_COMMANDES_OFF: "1" }), null);
  assert.strictEqual(lancer({ tool_name: "Read", tool_input: { file_path: "/p/.env" } }, { PULSE_GARDE_OFF: "1" }), null);
  assert.strictEqual(lancer(bash("cat .env"), { PULSE_GARDE_OFF: "1" }).permissionDecision, "deny");
  for (const e of ["", "pas du json"]) assert.strictEqual(lancer(e), null);
});

test("un refus de commande est rendu sans attendre le garde-fou anti-secrets", () => {
  const tmp = os.tmpdir();
  const r = lancer({ tool_name: "Bash", tool_input: { command: "git push --force" }, cwd: tmp });
  assert.strictEqual(r.permissionDecision, "deny");
  assert.ok(!/secrets/i.test(r.permissionDecisionReason) || r.permissionDecisionReason.includes("🔒"));
});

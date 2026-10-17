// Les hooks du plugin : chaque script existe, et un seul point d'entrée (garde.js) couvre les outils surveillés.
// Lancer : node --test plugins/pulse-vibe/tests/hooks.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const HOOKS = JSON.parse(fs.readFileSync(path.join(RACINE, "hooks", "hooks.json"), "utf8")).hooks;

// Le script d'un hook : premier argument (forme exec, `args`), ou chemin entre guillemets de la commande (forme shell).
const scriptDe = (x) => (x.args ? x.args[0] : (x.command.match(/"(\$\{CLAUDE_PLUGIN_ROOT\}[^"]*)"/) || [])[1]);

const scriptsPour = (evenement, outil) =>
  (HOOKS[evenement] || [])
    .filter((h) => !h.matcher || new RegExp(`^(?:${h.matcher})$`).test(outil))
    .flatMap((h) => h.hooks.map((x) => ({ script: path.basename(scriptDe(x)), si: x.if })));

test("chaque script cité par hooks.json existe", () => {
  for (const liste of Object.values(HOOKS))
    for (const h of liste)
      for (const x of h.hooks) {
        assert.ok(scriptDe(x), `script introuvable dans ${x.command}`);
        assert.ok(fs.existsSync(scriptDe(x).replace("${CLAUDE_PLUGIN_ROOT}", RACINE)), scriptDe(x));
      }
});

test("démarrage : Node.js vérifié par un hook en forme shell, qui ne dépend pas de Node", () => {
  const hooks = (HOOKS.SessionStart || []).flatMap((h) => h.hooks);
  const sansNode = hooks.find((x) => !x.args && /verifier-node\.sh/.test(x.command));
  assert.ok(sansNode, "hook SessionStart vers verifier-node.sh");
  assert.strictEqual(sansNode.command, 'sh "${CLAUDE_PLUGIN_ROOT}/scripts/verifier-node.sh"');
  assert.ok(hooks.some((x) => x.args && /memoire\.js$/.test(x.args[0])), "memoire.js reste au démarrage");
});

test("PreToolUse : un seul point d'entrée, garde.js, pour chaque outil surveillé, sans filtre if", () => {
  for (const outil of ["Bash", "PowerShell", "Write", "Edit", "MultiEdit", "NotebookEdit", "Read", "Grep"]) {
    const s = scriptsPour("PreToolUse", outil);
    assert.deepStrictEqual(s.map((x) => x.script), ["garde.js"], outil);
    assert.strictEqual(s[0].si, undefined, `${outil} sans filtre if`);
  }
});

test("garde.js passe l'entrée aux deux garde-fous", () => {
  const source = fs.readFileSync(path.join(RACINE, "scripts", "garde.js"), "utf8");
  for (const m of ["./garde-secrets", "./garde-commandes"]) assert.ok(source.includes(`"${m}"`), m);
});

test("PostToolUse : un seul point d'entrée, apres-ecriture.js, pour chaque outil d'écriture", () => {
  for (const outil of ["Write", "Edit", "MultiEdit"])
    assert.deepStrictEqual(scriptsPour("PostToolUse", outil).map((x) => x.script), ["apres-ecriture.js"], outil);
});

test("Stop et SubagentStop : fin-de-tour.js, sans filtre, délai de 90 s", () => {
  for (const evenement of ["Stop", "SubagentStop"]) {
    const liste = HOOKS[evenement] || [];
    assert.strictEqual(liste.length, 1, evenement);
    assert.strictEqual(liste[0].matcher, undefined, `${evenement} sans filtre`);
    assert.deepStrictEqual(liste[0].hooks.map((x) => [x.command, x.args, x.timeout]), [["node", ["${CLAUDE_PLUGIN_ROOT}/scripts/fin-de-tour.js"], 90]], evenement);
  }
});

test("la description de hooks.json cite le contrôle de fin de tour", () => {
  const description = JSON.parse(fs.readFileSync(path.join(RACINE, "hooks", "hooks.json"), "utf8")).description;
  assert.match(description, /contrôle de fin de tour/);
});

test("rappel après compactage et notification pendant une réalisation", () => {
  const compact = (HOOKS.SessionStart || []).find((h) => h.matcher === "compact");
  assert.ok(compact, "entrée SessionStart compact");
  assert.ok(compact.hooks.some((x) => x.args && /realisation\.js$/.test(x.args[0]) && x.args.includes("--rappel")));
  const notif = (HOOKS.Notification || []).find((h) => h.matcher === "idle_prompt|permission_prompt");
  assert.ok(notif, "entrée Notification");
  assert.ok(notif.hooks.some((x) => x.args && /notifier\.js$/.test(x.args[0])));
});

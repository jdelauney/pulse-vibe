// Les hooks du plugin : chaque script existe, et un seul point d'entrée (garde.js) couvre les outils surveillés.
// Lancer : node --test plugins/pulse-vibe/tests/hooks.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const HOOKS = JSON.parse(fs.readFileSync(path.join(RACINE, "hooks", "hooks.json"), "utf8")).hooks;

const scriptsPour = (evenement, outil) =>
  (HOOKS[evenement] || [])
    .filter((h) => !h.matcher || new RegExp(`^(?:${h.matcher})$`).test(outil))
    .flatMap((h) => h.hooks.map((x) => ({ script: path.basename(x.args[0]), si: x.if })));

test("chaque script cité par hooks.json existe", () => {
  for (const liste of Object.values(HOOKS))
    for (const h of liste)
      for (const x of h.hooks) assert.ok(fs.existsSync(x.args[0].replace("${CLAUDE_PLUGIN_ROOT}", RACINE)), x.args[0]);
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

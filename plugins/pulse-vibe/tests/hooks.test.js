// Les hooks du plugin : chaque script existe, et les deux garde-fous couvrent Bash et PowerShell.
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

test("Bash et PowerShell passent par les deux garde-fous, sans filtre if", () => {
  for (const outil of ["Bash", "PowerShell"]) {
    const s = scriptsPour("PreToolUse", outil);
    for (const nom of ["garde-secrets.js", "garde-commandes.js"]) {
      const h = s.find((x) => x.script === nom);
      assert.ok(h, `${outil} → ${nom}`);
      assert.strictEqual(h.si, undefined, `${outil} → ${nom} sans filtre if`);
    }
  }
});

test("écritures et lectures passent par le garde-fou anti-secrets", () => {
  for (const outil of ["Write", "Edit", "MultiEdit", "NotebookEdit", "Read", "Grep"])
    assert.ok(scriptsPour("PreToolUse", outil).some((x) => x.script === "garde-secrets.js"), outil);
});

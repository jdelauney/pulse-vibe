// Les skills et les agents de Pulse passent leur propre contrôle : `pulse-aidd skill verifier` (scripts/skill.js), avec les
// conventions Pulse, ne relève aucun constat bloquant dans le cœur ni dans le pack Next.js.
// Lancer : node --test plugins/pulse-vibe/tests/skills-pulse.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const PLUGINS = path.join(__dirname, "..", "..");
const { verifier } = require(path.join(__dirname, "..", "scripts", "skill.js"));

for (const plugin of ["pulse-vibe", "pulse-vibe-next"]) {
  test(`${plugin} : aucun constat bloquant de pulse-aidd skill verifier (conventions Pulse)`, () => {
    const bloquants = verifier(path.join(PLUGINS, plugin), { pulse: true }).filter((c) => c.gravite === "bloquant");
    assert.deepStrictEqual(bloquants.map((c) => `${c.regle} · ${c.fichier}:${c.ligne} · ${c.message}`), []);
  });
}

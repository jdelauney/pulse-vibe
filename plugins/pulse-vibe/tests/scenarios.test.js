// Tests de la traçabilité des scénarios (templates/verifier.js et pulse-aidd scenarios).
// Lancer : node --test plugins/pulse-vibe/tests/scenarios.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const VERIFIER = path.join(__dirname, "..", "templates", "verifier.js");

const SPEC = `# Spec – US-003 Factures en retard

## 7. Scénarios

\`\`\`gherkin
# language: fr
Fonctionnalité: Factures en retard

  Règle: une facture échue et non payée est en retard

    @US-003-1 @unitaire
    Exemple: Facture échue hier et non payée : elle est en retard
      Étant donné une facture de 120 € échue hier
      Quand on consulte la liste
      Alors elle est marquée en retard

    @US-003-2 @integration @securite
    Exemple: Un autre client ne voit pas la facture
      Étant donné une facture de Camille
      Quand Dominique ouvre la liste
      Alors la facture est absente

    @US-003-3 @manuel
    Exemple: La pastille rouge se voit sur téléphone
      Étant donné une facture en retard
      Quand Camille ouvre la liste sur téléphone
      Alors la pastille rouge est visible
\`\`\`
`;

const plan = (statuts) =>
  `# Plan\n\n## Tâches\n\n` + statuts.map((s, k) => `- [${s}] **T${k + 1} – Tâche ${k + 1}** · US-003\n  - Objectif : x\n`).join("\n");

function projet({ statuts, tests = {} }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-scen-"));
  const epic = path.join(d, "aidd_docs", "tasks", "facturation");
  fs.mkdirSync(epic, { recursive: true });
  fs.writeFileSync(path.join(epic, "SPEC-US-003-factures-en-retard.md"), SPEC);
  if (statuts) fs.writeFileSync(path.join(epic, "PLAN-SPEC-US-003-factures-en-retard.md"), plan(statuts));
  for (const [fichier, contenu] of Object.entries(tests)) {
    fs.mkdirSync(path.dirname(path.join(d, fichier)), { recursive: true });
    fs.writeFileSync(path.join(d, fichier), contenu);
  }
  return d;
}

const lancer = (d, ...args) => spawnSync("node", [VERIFIER, ...args], { cwd: d, encoding: "utf8" });

test("plan terminé, chaque scénario automatisé cité par un test : la vérification réussit", () => {
  const d = projet({
    statuts: ["x", "x"],
    tests: {
      "src/factures/retard.test.ts": 'test("US-003-1 – Facture échue hier et non payée", () => {});',
      "tests/integration/factures.test.ts": 'test("US-003-2 – Un autre client ne voit pas la facture", () => {});',
    },
  });
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Scénarios/);
});

test("plan terminé, un scénario automatisé sans test : la vérification échoue et le nomme", () => {
  const d = projet({ statuts: ["x", "x"], tests: { "src/factures/retard.test.ts": 'test("US-003-1 – échue", () => {});' } });
  const r = lancer(d);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /US-003-2/);
  assert.match(r.stderr, /Un autre client ne voit pas la facture/);
  assert.doesNotMatch(r.stderr, /US-003-3/, "un scénario manuel ne fait jamais échouer");
});

test("plan en cours : un scénario sans test ne fait pas échouer", () => {
  const d = projet({ statuts: ["x", "~"], tests: { "src/factures/retard.test.ts": 'test("US-003-1", () => {});' } });
  assert.strictEqual(lancer(d).status, 0);
});

test("étiquette citée seulement comme préfixe d'une autre (US-003-10) : ne compte pas", () => {
  const d = projet({
    statuts: ["x"],
    tests: { "tests/a.test.js": 'test("US-003-10 et US-003-20", () => {}); test("US-003-1", () => {});' },
  });
  const r = lancer(d);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /US-003-2/);
});

test("aucun test ne cite d'étiquette : avertissement, sans échec (projet d'avant la traçabilité)", () => {
  const d = projet({ statuts: ["x"], tests: { "tests/a.test.js": 'test("calcule le retard", () => {});' } });
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /aucun test ne cite/i);
});

test("projet sans aidd_docs : seul le contrôle des secrets s'applique", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-scen-vide-"));
  fs.writeFileSync(path.join(d, "index.html"), "<h1>ok</h1>");
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /Scénarios/);
});

test("--scenarios : état de couverture de tous les plans, sans échouer", () => {
  const d = projet({ statuts: ["x", " "], tests: { "e2e/factures.spec.ts": 'test("US-003-2", () => {});' } });
  const r = lancer(d, "--scenarios");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /US-003-1.*sans test/);
  assert.match(r.stdout, /US-003-2.*e2e\/factures\.spec\.ts/);
  assert.match(r.stdout, /US-003-3.*manuel/);
});

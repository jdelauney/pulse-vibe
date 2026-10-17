// Tests de `pulse-aidd bilan` (scripts/bilan.js) : le bilan chiffré des US, lu dans les plans et les rapports de relecture.
// Lancer : node --test plugins/pulse-vibe/tests/bilan.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "bilan.js");
const { bilan, lireRapport } = require(SCRIPT);

const PLAN = "# Plan\n\n## Tâches\n\n- [x] **T1 – A** · US-001\n- [x] **T2 – B** · US-001\n- [ ] **T3 – C** · US-001\n";
const RAPPORT = ({ mode = "/pulse:spirc autonome", constats = [], controles = 0, resultat = "✅ concluant" } = {}) =>
  `# Revue – T1\n\n**Verdict** : ✅ Validé\n**Mode** : ${mode}\n\n## Constats\n\n${constats.map((c, i) => `${i + 1}. ${c} problème — a.js:1 — Corriger`).join("\n")}\n\n**Blocage** : aucun\n` +
  "\n## Relecture de contrôle\n\n- **Date** : 2026-10-16\n".repeat(controles) +
  `\n## Test par la personne\n\n- **Date** : 2026-10-16\n- **Résultat** : ${resultat}\n`;

function projet(fichiers) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-bilan-"));
  for (const [f, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), contenu);
  }
  return d;
}
const REVUES = "aidd_docs/tasks/g/revues/PLAN-SPEC-US-001-a";

test("un rapport : relectures de contrôle, test non concluant, constats par gravité, mode ; le modèle non rempli ne compte pas", () => {
  const r = lireRapport(RAPPORT({ constats: ["🔴 Critique", "🟡 Moyenne", "🟡 Moyenne", "🔵 Basse"], controles: 2, resultat: "❌ non concluant" }));
  assert.deepStrictEqual([r.controles, r.nonConcluants, r.parGravite, r.mode], [2, 1, [1, 0, 2, 1], "/pulse:spirc autonome"]);
  const modele = lireRapport(RAPPORT({ constats: ["🔴 Critique / 🟠 Haute / 🟡 Moyenne / 🔵 Basse"], resultat: "✅ concluant | ❌ non concluant | ⏳ reporté" }));
  assert.deepStrictEqual([modele.nonConcluants, modele.parGravite], [0, [0, 0, 0, 0]]);
});

test("le bilan d'un projet : une ligne par US, puis le total", () => {
  const d = projet({
    "aidd_docs/tasks/g/PLAN-SPEC-US-001-a.md": PLAN,
    [`${REVUES}/T1-2026-10-16.md`]: RAPPORT({ constats: ["🟠 Haute"], controles: 1 }),
    [`${REVUES}/T2-2026-10-16.md`]: RAPPORT({ mode: "/pulse:review", resultat: "❌ non concluant : le bouton ne fait rien" }),
    "aidd_docs/tasks/g/PLAN-SPEC-US-002-b.md": "# Plan\n\n## Tâches\n\n- [ ] **T4 – D** · US-002\n",
  });
  const lignes = bilan(d);
  assert.deepStrictEqual(lignes.map((l) => [l.us, l.faites, l.total, l.relectures, l.controles, l.nonConcluants]), [["US-001", 2, 3, 2, 1, 1], ["US-002", 0, 1, 0, 0, 0]]);
  const sortie = spawnSync(process.execPath, [SCRIPT], { cwd: d, encoding: "utf8" }).stdout;
  assert.match(sortie, /^US-001 · 2\/3 tâches · 2 relectures · 1 correction · 1 test non concluant · constats 0\/1\/0\/0 · \/pulse:spirc autonome, \/pulse:review$/m);
  assert.match(sortie, /^total · 2\/4 tâches · 2 relectures · 1 correction · 1 test non concluant · constats 0\/1\/0\/0$/m);
  assert.match(spawnSync(process.execPath, [SCRIPT], { cwd: projet({}), encoding: "utf8" }).stdout, /^bilan: aucun plan/);
});

test("plan avec questions en attente et « En pause » : T4 compte comme à faire, Q1 n'est pas une tâche", () => {
  const plan = "# Plan\n\n## Tâches\n\n- [x] **T3 – C** · US-002\n- [ ] **T4 – D** · US-002\n  - En pause : Q1 (votre décision)\n\n## Questions en attente\n\n- [ ] Q1 · T4 · Garder ? · Options : oui / non · Recommandé : oui\n\n## Choix faits par Pulse\n\n- T4 · tri · Autre possibilité : nom · Raison : simple\n";
  const lignes = bilan(projet({ "aidd_docs/tasks/g/PLAN-SPEC-US-002-b.md": plan }));
  assert.deepStrictEqual(lignes.map((l) => [l.us, l.faites, l.total]), [["US-002", 1, 2]]);
});

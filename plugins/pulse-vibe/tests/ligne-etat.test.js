// Tests de `pulse-aidd ligne-etat` (scripts/ligne-etat.js) : la ligne d'état de Claude Code et son installation.
// Lancer : node --test plugins/pulse-vibe/tests/ligne-etat.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "ligne-etat.js");
const { ligne } = require(SCRIPT);

const PLAN = (taches) => `# Plan\n\n## Tâches\n\n${taches}\n\n## Journal\n`;

function projet(fichiers) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-ligne-"));
  const tous = { "CLAUDE.md": "Ce projet suit la **méthode Pulse**.\n", ...fichiers };
  for (const [f, contenu] of Object.entries(tous)) {
    if (contenu === null) continue;
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), contenu);
  }
  return d;
}
const lancer = (d, entree, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: d, input: entree, encoding: "utf8" });

test("la ligne : tâche en cours, avancement, décision en attente", () => {
  const d = projet({
    "aidd_docs/tasks/g/PLAN-SPEC-US-001-a.md": PLAN("- [x] **T1 – A** · US-001\n- [x] **T2 – B** · US-001"),
    "aidd_docs/tasks/g/PLAN-SPEC-US-002-b.md": PLAN("- [~] **T3 – C** · US-002\n- [ ] **T4 – D** · US-002"),
    "aidd_docs/tasks/in-progress.md": "- **Étape** : test manuel de T3\n\n## Série\n\n- US-004 : en attente : un e-mail ?\n",
  });
  assert.strictEqual(ligne(d), "Pulse · US-002 · T3 en cours · 2/4 tâches · ⏸ test manuel de T3 · 1 US en attente");
  const sansEnCours = projet({ "aidd_docs/tasks/g/PLAN-SPEC-US-002-b.md": PLAN("- [x] **T3 – C** · US-002\n- [ ] **T4 – D** · US-002") });
  assert.strictEqual(ligne(sansEnCours), "Pulse · US-002 · prochaine : T4 · 1/2 tâches");
  assert.strictEqual(ligne(projet({})), "Pulse");
  assert.strictEqual(ligne(projet({ "CLAUDE.md": "# Autre projet\n" })), "", "hors d'un projet Pulse : rien");
});

test("en ligne de commande : lit le dossier du JSON de Claude Code, jamais d'erreur", () => {
  const d = projet({ "aidd_docs/tasks/g/PLAN-SPEC-US-001-a.md": PLAN("- [~] **T1 – A** · US-001") });
  const r = lancer(os.tmpdir(), JSON.stringify({ workspace: { current_dir: d } }));
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, "Pulse · US-001 · T1 en cours · 0/1 tâches\n");
  const illisible = lancer(d, "pas du JSON");
  assert.strictEqual(illisible.status, 0);
  assert.match(illisible.stdout, /^Pulse/);
});

test("installer : copie, réglage local, .gitignore ; une autre ligne d'état reste en place sauf --remplacer ; retirer", () => {
  const d = projet({ ".gitignore": ".env\n", ".claude/settings.local.json": JSON.stringify({ permissions: { allow: ["Bash(ls)"] } }) });
  const r = lancer(d, "", "--installer");
  assert.match(r.stdout, /^installee: \.claude\/settings\.local\.json/m);
  const reglages = JSON.parse(fs.readFileSync(path.join(d, ".claude", "settings.local.json"), "utf8"));
  assert.deepStrictEqual(reglages.permissions, { allow: ["Bash(ls)"] }, "les autres réglages restent");
  assert.strictEqual(reglages.statusLine.type, "command");
  assert.match(reglages.statusLine.command, /^node ".*\/\.claude\/pulse-ligne-etat\.js"$/);
  assert.ok(fs.existsSync(path.join(d, ".claude", "pulse-ligne-etat.js")));
  const gitignore = fs.readFileSync(path.join(d, ".gitignore"), "utf8");
  assert.match(gitignore, /^\.claude\/settings\.local\.json$/m);
  assert.match(gitignore, /^\.claude\/pulse-ligne-etat\.js$/m);
  // La copie fonctionne seule, hors du plugin.
  const copie = spawnSync(process.execPath, [path.join(d, ".claude", "pulse-ligne-etat.js")], { cwd: d, input: "{}", encoding: "utf8" });
  assert.strictEqual(copie.stdout, "Pulse\n");
  // Réinstaller ne duplique rien.
  lancer(d, "", "--installer");
  assert.strictEqual(fs.readFileSync(path.join(d, ".gitignore"), "utf8"), gitignore);
  // Retirer.
  assert.match(lancer(d, "", "--retirer").stdout, /^retiree:/);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(d, ".claude", "settings.local.json"), "utf8")).statusLine, undefined);
  assert.ok(!fs.existsSync(path.join(d, ".claude", "pulse-ligne-etat.js")));

  const autre = projet({ ".claude/settings.local.json": JSON.stringify({ statusLine: { type: "command", command: "mon-script" } }) });
  assert.match(lancer(autre, "", "--installer").stdout, /^deja:/);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(autre, ".claude", "settings.local.json"), "utf8")).statusLine.command, "mon-script");
  assert.match(lancer(autre, "", "--installer", "--remplacer").stdout, /^installee:/);
  assert.match(lancer(autre, "", "--retirer").stdout, /^retiree:/);
  assert.match(lancer(autre, "", "--retirer").stdout, /^absente:/);

  const casse = projet({ ".claude/settings.local.json": "{ pas du json" });
  assert.match(lancer(casse, "", "--installer").stdout, /^erreur: .*rien n'a été modifié/);
  assert.strictEqual(fs.readFileSync(path.join(casse, ".claude", "settings.local.json"), "utf8"), "{ pas du json");
});

test("plan avec questions en attente et « En pause » : la tâche en pause compte comme à faire", () => {
  const plan = "# Plan\n\n## Tâches\n\n- [x] **T3 – C** · US-002\n- [ ] **T4 – D** · US-002\n  - En pause : Q1 (votre décision)\n\n## Questions en attente\n\n- [ ] Q1 · T4 · Garder ? · Options : oui / non · Recommandé : oui\n\n## Choix faits par Pulse\n\n- T4 · tri · Autre possibilité : nom · Raison : simple\n\n## Journal\n";
  assert.strictEqual(ligne(projet({ "aidd_docs/tasks/g/PLAN-SPEC-US-002-b.md": plan })), "Pulse · US-002 · prochaine : T4 · 1/2 tâches");
});

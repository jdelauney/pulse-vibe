// Tests de la suite d'évaluations (evals/, lancée par outils/evals/lancer.sh) : chaque cas se charge et prépare son projet.
// Lancer : node --test plugins/pulse-vibe/tests/evals.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const EVALS = path.join(__dirname, "..", "evals");
const cas = fs.readdirSync(EVALS).filter((d) => fs.existsSync(path.join(EVALS, d, "prompt.md")));
const bash = spawnSync("bash", ["--version"]).error ? "bash absent" : false;

test("au moins trois cas, chacun avec un prompt, des vérifications et son script de préparation", () => {
  assert.ok(cas.length >= 3, cas.join(", "));
  for (const c of cas) {
    const dossier = path.join(EVALS, c);
    assert.match(fs.readFileSync(path.join(dossier, "prompt.md"), "utf8"), /^---\n[\s\S]*?allowed_tools: \[[^\]]*Skill[^\]]*\][\s\S]*?\n---\n\n\/pulse:/, c);
    const graders = fs.readdirSync(path.join(dossier, "graders"));
    assert.ok(graders.length >= 2, `${c} : au moins deux vérifications`);
    for (const g of graders) assert.match(fs.readFileSync(path.join(dossier, "graders", g), "utf8"), /^---\ntype: (regex|tool_used|tool_order|file_exists|llm)\n/, `${c}/${g}`);
    const yaml = fs.readFileSync(path.join(dossier, "case.yaml"), "utf8");
    assert.match(yaml, /^schema_version: "1\.1"$/m);
    assert.match(yaml, new RegExp(`^name: ${c}$`, "m"));
    const script = /scaffold_script: (\S+)/.exec(yaml)[1];
    assert.ok(fs.existsSync(path.join(dossier, script)), `${c} : ${script}`);
  }
});

test("chaque script de préparation crée son projet d'essai dans un dossier vide", { skip: bash }, () => {
  for (const c of cas) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), `pulse-eval-${c}-`));
    const r = spawnSync("bash", [path.join(EVALS, c, "projet.sh").split(path.sep).join("/")], { cwd: d, encoding: "utf8" });
    assert.strictEqual(r.status, 0, `${c} : ${r.stderr}`);
    assert.match(fs.readFileSync(path.join(d, "CLAUDE.md"), "utf8"), /méthode Pulse/, c);
  }
});

test("le projet d'essai partagé attend le plan d'US-001", { skip: bash }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-eval-etat-"));
  spawnSync("bash", [path.join(EVALS, "_communs", "projet.sh").split(path.sep).join("/")], { cwd: d, encoding: "utf8" });
  const r = spawnSync(process.execPath, [path.join(__dirname, "..", "scripts", "etat.js"), "--sans-git"], { cwd: d, encoding: "utf8" });
  assert.match(r.stdout, /^prochaine: \/pulse:plan US-001$/m);
});

test("le lanceur accorde les commandes dont les cas ont besoin, rien de plus", () => {
  const lanceur = fs.readFileSync(path.join(__dirname, "..", "..", "..", "outils", "evals", "lancer.sh"), "utf8");
  assert.match(lanceur, /--allow-tools Write Edit "Bash\(pulse-aidd \*\)" "Bash\(git \*\)" "Bash\(node \*\)"/);
  assert.match(lanceur, /--no-publish/);
  assert.match(lanceur, /--max-cost-usd/);
});

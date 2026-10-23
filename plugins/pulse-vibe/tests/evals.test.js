// Tests de la suite d'évaluations (outils/evals/cas/, hors du plugin publié, lancée par outils/evals/lancer.js) : chaque cas se charge et prépare son projet.
// Lancer : node --test plugins/pulse-vibe/tests/evals.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const EVALS = path.join(__dirname, "..", "..", "..", "outils", "evals", "cas");
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
    const r = spawnSync("bash", [path.join(EVALS, c, "projet.sh").split(path.sep).join("/")], { cwd: d, encoding: "utf8", env: { ...process.env, PULSE_EVAL_SANS_INSTALL: "1" } });
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

const OUTILS_EVALS = path.join(__dirname, "..", "..", "..", "outils", "evals");
const lanceur = require(path.join(OUTILS_EVALS, "lancer.js"));

test("le lanceur accorde les commandes dont les cas ont besoin, rien de plus", () => {
  const args = lanceur.argumentsEval("/tmp/x/pulse-vibe", {}, ["--case", "plan-controle"]);
  assert.strictEqual(args[2], "/tmp/x/pulse-vibe");
  const i = args.indexOf("--allow-tools");
  assert.deepStrictEqual(args.slice(i + 1, i + 6), ["Write", "Edit", "Bash(pulse-aidd *)", "Bash(git *)", "Bash(node *)"]);
  assert.ok(args.includes("--no-publish"));
  assert.deepStrictEqual(args.slice(args.indexOf("--runs"), args.indexOf("--runs") + 4), ["--runs", "1", "--max-cost-usd", "5"]);
  assert.deepStrictEqual(args.slice(-2), ["--case", "plan-controle"]);
  const reglees = lanceur.argumentsEval("/depot", { RUNS: "3", PLAFOND: "2" }, []);
  assert.deepStrictEqual(reglees.slice(reglees.indexOf("--runs"), reglees.indexOf("--runs") + 4), ["--runs", "3", "--max-cost-usd", "2"]);
});

test("le lanceur repère les liens symboliques de ~/.docker, que le bac à sable refuse", (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-docker-"));
  fs.writeFileSync(path.join(d, "config.json"), "{}");
  assert.deepStrictEqual(lanceur.liensDocker(d), []);
  try {
    fs.symlinkSync(path.join(d, "config.json"), path.join(d, "features.json"));
  } catch (e) {
    return t.skip("liens symboliques non permis ici");
  }
  assert.deepStrictEqual(lanceur.liensDocker(d), ["features.json"]);
  assert.deepStrictEqual(lanceur.liensDocker(path.join(d, "absent")), []);
});

test("le lanceur assemble le cœur et les cas dans un dossier temporaire, puis range les rapports à part", () => {
  const racine = path.join(__dirname, "..", "..", "..");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-evals-test-"));
  const plugin = lanceur.assembler(racine, EVALS, temp);
  assert.ok(fs.existsSync(path.join(plugin, ".claude-plugin", "plugin.json")));
  assert.ok(fs.existsSync(path.join(plugin, "evals", "plan-controle", "prompt.md")));
  assert.ok(!fs.existsSync(path.join(racine, "plugins", "pulse-vibe", "evals")), "les cas ne sont plus dans le plugin publié");
  fs.mkdirSync(path.join(plugin, "evals", "results", "2026-01-01"), { recursive: true });
  fs.writeFileSync(path.join(plugin, "evals", "results", "2026-01-01", "report.html"), "ok");
  const resultats = path.join(temp, "resultats");
  assert.deepStrictEqual(lanceur.rapatrier(plugin, resultats), ["2026-01-01"]);
  assert.strictEqual(fs.readFileSync(path.join(resultats, "2026-01-01", "report.html"), "utf8"), "ok");
  assert.deepStrictEqual(lanceur.rapatrier(path.join(temp, "vide"), resultats), []);
});

test("le lanceur : Windows passe par WSL2, macOS et Linux lancent directement, chacun ses outils", () => {
  assert.strictEqual(lanceur.strategie("win32"), "wsl");
  assert.strictEqual(lanceur.strategie("darwin"), "direct");
  assert.strictEqual(lanceur.strategie("linux"), "direct");
  assert.deepStrictEqual(lanceur.outilsRequis("linux"), ["claude", "git", "bwrap", "socat"]);
  assert.deepStrictEqual(lanceur.outilsRequis("darwin"), ["claude", "git"]);
});

test("le lanceur : versions, distributions WSL et arguments passés à bash", () => {
  assert.ok(lanceur.comparerVersions("2.1.268", "2.1.269") < 0);
  assert.strictEqual(lanceur.comparerVersions("2.1.269", "2.1.269"), 0);
  assert.ok(lanceur.comparerVersions("2.2.0", "2.1.269") > 0);
  assert.strictEqual(lanceur.premiereVersion("2.1.270 (Claude Code)"), "2.1.270");
  assert.strictEqual(lanceur.premiereVersion("git version 2.47.1.windows.1"), "2.47.1");
  assert.deepStrictEqual(lanceur.distributions("U\u0000b\u0000u\u0000n\u0000t\u0000u\u0000\r\n\u0000d\u0000o\u0000c\u0000k\u0000e\u0000r\u0000\r\n"), ["Ubuntu", "docker"]);
  assert.deepStrictEqual(lanceur.distributions(""), []);
  assert.strictEqual(lanceur.pourBash("--case"), "'--case'");
  assert.strictEqual(lanceur.pourBash("l'essai"), "'l'\\''essai'");
});

test("les relais du lanceur renvoient à lancer.js (sh pour Linux, macOS et WSL2 ; cmd pour Windows)", () => {
  assert.match(fs.readFileSync(path.join(OUTILS_EVALS, "lancer.sh"), "utf8"), /exec node "\$\(dirname "\$0"\)\/lancer\.js" "\$@"/);
  assert.match(fs.readFileSync(path.join(OUTILS_EVALS, "lancer.cmd"), "utf8"), /node "%~dp0lancer\.js" %\*/);
});

test("le lanceur assemble le pack Next quand PACK=next", () => {
  const racine = path.join(__dirname, "..", "..", "..");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-evals-pack-"));
  const plugin = lanceur.assembler(racine, EVALS, temp, { pack: "next" });
  assert.ok(fs.existsSync(path.join(plugin, "evals-pack", "next", "bin", "pulse-pile-next")));
  const relais = path.join(plugin, "bin", "pulse-pile-next");
  assert.ok(fs.existsSync(relais));
  if (!bash) {
    const r = spawnSync("bash", [relais.split(path.sep).join("/"), "info"], { encoding: "utf8" });
    assert.match(r.stdout, /^id: next$/m, r.stderr);
  }
  const sansPack = lanceur.assembler(racine, EVALS, fs.mkdtempSync(path.join(os.tmpdir(), "pulse-evals-cœur-")));
  assert.ok(!fs.existsSync(path.join(sansPack, "bin", "pulse-pile-next")));
});

test("PACK=next accorde npm et npx, et passe dans WSL2", () => {
  const avec = lanceur.argumentsEval("/x", { PACK: "next" }, []);
  assert.ok(avec.includes("Bash(npm *)") && avec.includes("Bash(npx *)"));
  const sans = lanceur.argumentsEval("/x", {}, []);
  assert.ok(!sans.includes("Bash(npm *)") && !sans.includes("Bash(npx *)"));
  assert.match(fs.readFileSync(path.join(OUTILS_EVALS, "lancer.js"), "utf8"), /\["RUNS", "PLAFOND", "PACK"/);
});

const mesure = require(path.join(OUTILS_EVALS, "mesurer.js"));
const ESSAI = path.join(__dirname, "fixtures", "evals", "essai");

test("mesurer : médiane", () => {
  assert.strictEqual(mesure.mediane([3, 1, 2]), 2);
  assert.strictEqual(mesure.mediane([1, 2, 3, 4]), 2.5);
});

test("mesurer : une transcription et ses sous-agents, chaque message compté une fois", () => {
  assert.deepStrictEqual(mesure.lireEssai(path.join(ESSAI, "session-1.jsonl")), {
    entree: 15, sortie: 32, cacheLu: 1200, cacheEcrit: 3050, outils: 4, sousAgents: 1,
  });
});

test("le lanceur garde les transcriptions des essais avec leur rapport", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-evals-traces-"));
  const rapport = path.join(temp, "2026-10-23");
  fs.mkdirSync(rapport);
  const trace = path.join(ESSAI, "session-1.jsonl");
  fs.writeFileSync(path.join(rapport, "aggregate-result.json"), JSON.stringify({
    cases: [{ name: "realisation-boucle", arms: { with: [{ score: 1, durationSeconds: 90, tracePath: trace }] } }],
  }));
  lanceur.conserverTraces(rapport);
  assert.ok(fs.existsSync(path.join(rapport, "traces", "session-1.jsonl")));
  assert.ok(fs.existsSync(path.join(rapport, "traces", "session-1", "subagents", "agent-x1.jsonl")));
  assert.deepStrictEqual(mesure.lireResultats(rapport), [{
    cas: "realisation-boucle", score: 1, duree: 90, entree: 15, sortie: 32, cacheLu: 1200, cacheEcrit: 3050, outils: 4, sousAgents: 1,
  }]);
});

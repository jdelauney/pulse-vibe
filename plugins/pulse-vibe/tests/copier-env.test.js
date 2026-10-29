// Tests de la copie des fichiers d'environnement dans un worktree (scripts/copier-env.js).
// Lancer : node --test plugins/pulse-vibe/tests/*.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "copier-env.js");
const SECRET = "CLE=valeur-secrete-123";

const git = (args, cwd) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" });
const lancer = (args, cwd) => spawnSync("node", [SCRIPT, ...args], { cwd, encoding: "utf8" });

/** Un projet avec un commit, ses fichiers d'environnement locaux et un worktree. */
function projet() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-copier-env-"));
  git(["init", "-q"], d);
  fs.writeFileSync(path.join(d, ".gitignore"), ".env\n.env.local\n.env*.local\n.claude/worktrees/\nnode_modules/\n");
  fs.writeFileSync(path.join(d, ".env.example"), "CLE=\n");
  git(["add", "."], d);
  git(["commit", "-qm", "init"], d);
  fs.writeFileSync(path.join(d, ".env.local"), SECRET + "\n");
  fs.mkdirSync(path.join(d, "apps", "web"), { recursive: true });
  fs.writeFileSync(path.join(d, "apps", "web", ".env"), SECRET + "\n");
  fs.mkdirSync(path.join(d, "node_modules", "paquet"), { recursive: true });
  fs.writeFileSync(path.join(d, "node_modules", "paquet", ".env"), "AUTRE=1\n");
  const wt = ".claude/worktrees/us-001-essai";
  git(["worktree", "add", "-q", wt, "-b", "feat/us-001-essai"], d);
  return { d, wt, w: path.join(d, wt) };
}

test("copie les fichiers d'environnement non suivis, sous-dossiers compris, sans afficher leur contenu", () => {
  const { d, wt, w } = projet();
  const r = lancer([wt], d);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /✅ Copié.*\.env\.local/);
  assert.match(r.stdout, /apps\/web\/\.env/);
  assert.ok(!(r.stdout + r.stderr).includes("valeur-secrete"), "le contenu n'est jamais affiché");
  assert.strictEqual(fs.readFileSync(path.join(w, ".env.local"), "utf8"), SECRET + "\n");
  assert.strictEqual(fs.readFileSync(path.join(w, "apps", "web", ".env"), "utf8"), SECRET + "\n");
  assert.ok(!fs.existsSync(path.join(w, "node_modules")), "node_modules est laissé de côté");
  assert.ok(!r.stdout.includes(".claude/worktrees"), "le worktree lui-même n'est pas fouillé");
});

test("garde un fichier déjà présent dans le worktree", () => {
  const { d, wt, w } = projet();
  fs.writeFileSync(path.join(w, ".env.local"), "CLE=propre-au-worktree\n");
  const r = lancer([wt], d);
  assert.match(r.stdout, /Déjà présent.*\.env\.local/);
  assert.strictEqual(fs.readFileSync(path.join(w, ".env.local"), "utf8"), "CLE=propre-au-worktree\n");
});

test("refuse un fichier que Git n'ignore pas dans le worktree", () => {
  const { d, wt, w } = projet();
  fs.writeFileSync(path.join(d, ".env.production"), SECRET + "\n");
  const r = lancer([wt], d);
  assert.match(r.stdout, /⚠️ Non copié.*\.env\.production/);
  assert.ok(!fs.existsSync(path.join(w, ".env.production")));
});

test("refuse un dossier qui n'est pas un worktree du projet", () => {
  const { d } = projet();
  const ailleurs = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-ailleurs-"));
  const r = lancer([ailleurs], d);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /n'est pas un dossier à part/);
  assert.deepStrictEqual(fs.readdirSync(ailleurs), []);
  assert.strictEqual(lancer([d], d).status, 1, "le dossier principal n'est pas une destination");
});

test("le garde-fou laisse passer la commande (bash et PowerShell), qui ne nomme aucun fichier .env", () => {
  const { evaluer } = require("../scripts/garde-commandes");
  const { d, wt } = projet();
  for (const outil of ["Bash", "PowerShell"]) assert.strictEqual(evaluer({ tool_name: outil, tool_input: { command: `pulse-aidd copier-env ${wt}` }, cwd: d }), null, outil);
});

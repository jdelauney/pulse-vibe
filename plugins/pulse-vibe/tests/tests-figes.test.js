// Tests du verrou des tests figés (scripts/tests-figes.js) et de son passage par garde.js.
// Lancer : node --test plugins/pulse-vibe/tests/tests-figes.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "tests-figes.js");
const HOOK = path.join(__dirname, "..", "scripts", "garde.js");
const tf = require("../scripts/tests-figes");

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-tests-figes-"));
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));

/** Un projet Pulse dans son dépôt (dossier .git simulé), avec un test et un fichier de code. */
function projet(nom) {
  const d = path.join(BASE, nom);
  fs.mkdirSync(path.join(d, ".git"), { recursive: true });
  fs.mkdirSync(path.join(d, "tests"), { recursive: true });
  fs.mkdirSync(path.join(d, "src"), { recursive: true });
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# Projet\n\n<!-- pulse_profil:debut -->\n<!-- pulse_profil:fin -->\n");
  fs.writeFileSync(path.join(d, "tests", "facture.test.ts"), "test('retard', () => {});\n");
  fs.writeFileSync(path.join(d, "src", "facture.ts"), "export const x = 1;\n");
  return d;
}

function hook(entree, env = {}) {
  const r = spawnSync("node", [HOOK], { input: JSON.stringify(entree), encoding: "utf8", env: { ...process.env, PULSE_GARDE_OFF: "", PULSE_GARDE_COMMANDES_OFF: "", PULSE_GARDE_TESTS_OFF: "", ...env } });
  assert.strictEqual(r.status, 0);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
}
const ecrire = (cwd, fichier) => ({ tool_name: "Write", tool_input: { file_path: path.join(cwd, fichier), content: "x" }, cwd });
const editer = (cwd, fichier) => ({ tool_name: "Edit", tool_input: { file_path: fichier, old_string: "a", new_string: "b" }, cwd });
const bash = (cwd, command) => ({ tool_name: "Bash", tool_input: { command }, cwd });
const ps = (cwd, command) => ({ tool_name: "PowerShell", tool_input: { command }, cwd });

test("figer, liberer, lister : chemins relatifs à la racine du dépôt, liste gardée dans le dossier Git", () => {
  const d = projet("liste");
  assert.deepStrictEqual(tf.figer(path.join(d, "tests"), ["facture.test.ts"]), ["tests/facture.test.ts"]);
  assert.ok(fs.existsSync(path.join(d, ".git", "pulse-tests-figes.json")));
  assert.deepStrictEqual(tf.figer(d, ["tests/autre.test.ts", "./tests/facture.test.ts"]), ["tests/autre.test.ts", "tests/facture.test.ts"]);
  assert.deepStrictEqual(tf.liberer(d, ["tests/autre.test.ts"]), ["tests/facture.test.ts"]);
  const sortie = spawnSync("node", [SCRIPT], { cwd: d, encoding: "utf8" }).stdout;
  assert.strictEqual(sortie.trim(), "fichier: tests/facture.test.ts");
  assert.deepStrictEqual(tf.liberer(d), []);
  assert.ok(!fs.existsSync(path.join(d, ".git", "pulse-tests-figes.json")), "liste vide : le fichier est retiré");
});

test("un chemin hors du dépôt n'est jamais figé ; hors dépôt, rien n'est noté", () => {
  const d = projet("hors");
  assert.deepStrictEqual(tf.figer(d, ["../ailleurs.test.ts"]), []);
  const sansDepot = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-sans-depot-"));
  try {
    assert.strictEqual(tf.figer(sansDepot, ["a.test.ts"]), null);
    assert.match(spawnSync("node", [SCRIPT, "figer", "a.test.ts"], { cwd: sansDepot, encoding: "utf8" }).stdout, /Pas de dépôt Git/);
  } finally {
    fs.rmSync(sansDepot, { recursive: true, force: true });
  }
});

test("worktree : la liste va dans le dossier Git désigné par le fichier .git", () => {
  const principal = projet("principal");
  const dossierGit = path.join(principal, ".git", "worktrees", "wt");
  fs.mkdirSync(dossierGit, { recursive: true });
  const wt = path.join(BASE, "wt");
  fs.mkdirSync(path.join(wt, "tests"), { recursive: true });
  fs.writeFileSync(path.join(wt, ".git"), `gitdir: ${dossierGit}\n`);
  tf.figer(wt, ["tests/a.test.ts"]);
  assert.ok(fs.existsSync(path.join(dossierGit, "pulse-tests-figes.json")));
  assert.strictEqual(tf.lire(principal), null, "le dossier principal garde sa propre liste");
});

test("une liste périmée (plus de PERIME_H heures) est ignorée", () => {
  const d = projet("perime");
  tf.figer(d, ["tests/facture.test.ts"]);
  const vieux = Date.now() + (tf.PERIME_H + 1) * 3600 * 1000;
  assert.strictEqual(tf.lire(d, vieux), null);
  assert.ok(tf.lire(d));
});

test("garde-fou : écrire ou modifier un test figé est refusé, avec la consigne de le contester", () => {
  const d = projet("outils");
  tf.figer(d, ["tests/facture.test.ts"]);
  const refus = hook(ecrire(d, "tests/facture.test.ts"));
  assert.strictEqual(refus.permissionDecision, "deny");
  assert.match(refus.permissionDecisionReason, /tests\/facture\.test\.ts/);
  assert.match(refus.permissionDecisionReason, /Tests contestés/);
  assert.strictEqual(hook(editer(path.join(d, "tests"), "facture.test.ts")).permissionDecision, "deny", "chemin relatif au dossier courant");
  assert.strictEqual(hook({ tool_name: "MultiEdit", tool_input: { file_path: path.join(d, "tests", "facture.test.ts"), edits: [] }, cwd: d }).permissionDecision, "deny");
  assert.strictEqual(hook(ecrire(d, "src/facture.ts")), null, "le code de production reste modifiable");
  assert.strictEqual(hook(ecrire(d, "tests/nouveau.test.ts")), null, "un test non figé reste modifiable");
});

test("garde-fou : les commandes qui modifient, déplacent ou suppriment un test figé sont refusées", () => {
  const d = projet("commandes");
  tf.figer(d, ["tests/facture.test.ts"]);
  for (const c of [
    "echo x > tests/facture.test.ts",
    "echo x >> tests/facture.test.ts",
    "sed -i 's/a/b/' tests/facture.test.ts",
    "perl -pi -e 's/a/b/' tests/facture.test.ts",
    "rm tests/facture.test.ts",
    "mv tests/facture.test.ts tests/vieux.ts",
    "cp autre.ts tests/facture.test.ts",
    "git rm tests/facture.test.ts",
    "cat x | tee tests/facture.test.ts",
  ]) assert.strictEqual((hook(bash(d, c)) || {}).permissionDecision, "deny", c);
  for (const c of ["Set-Content -Path tests/facture.test.ts -Value x", "Remove-Item tests/facture.test.ts"]) assert.strictEqual((hook(ps(d, c)) || {}).permissionDecision, "deny", c);
  for (const c of ["npm test -- tests/facture.test.ts", "cat tests/facture.test.ts", "git add tests/facture.test.ts"]) assert.strictEqual(hook(bash(d, c)), null, c);
  // Remettre un test figé (git restore) reste possible : seul l'accord demandé par le garde-fou des commandes s'applique.
  assert.strictEqual(hook(bash(d, "git restore -- tests/facture.test.ts")).permissionDecision, "ask");
});

test("garde-fou : sans liste, liste libérée, hors projet Pulse ou désactivé, l'outil passe", () => {
  const d = projet("passe");
  assert.strictEqual(hook(ecrire(d, "tests/facture.test.ts")), null);
  tf.figer(d, ["tests/facture.test.ts"]);
  assert.strictEqual(hook(ecrire(d, "tests/facture.test.ts"), { PULSE_GARDE_TESTS_OFF: "1" }), null);
  tf.liberer(d, ["tests/facture.test.ts"]);
  assert.strictEqual(hook(ecrire(d, "tests/facture.test.ts")), null);
  const autre = projet("sans-pulse");
  fs.writeFileSync(path.join(autre, "CLAUDE.md"), "# Projet sans Pulse\n");
  tf.figer(autre, ["tests/facture.test.ts"]);
  assert.strictEqual(hook(ecrire(autre, "tests/facture.test.ts")), null);
});

test("realisation fin vide la liste des tests figés", () => {
  const d = projet("fin");
  tf.figer(d, ["tests/facture.test.ts"]);
  spawnSync("node", [path.join(__dirname, "..", "scripts", "realisation.js"), "fin"], { cwd: d, encoding: "utf8" });
  assert.strictEqual(tf.lire(d), null);
});

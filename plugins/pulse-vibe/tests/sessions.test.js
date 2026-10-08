// Tests du registre des sessions Claude Code ouvertes (scripts/sessions.js).
// Lancer : node --test plugins/pulse-vibe/tests/*.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "sessions.js");

/** Un vrai dépôt Git : la racine ne doit pas dépendre d'un dépôt parent du dossier temporaire. */
function depot(prefixe) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefixe));
  spawnSync("git", ["init", "-q"], { cwd: d });
  return d;
}

function contexte() {
  const registre = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-registre-"));
  const projet = depot("pulse-projet-");
  const lancer = (args, { cwd = projet, input } = {}) =>
    spawnSync("node", [SCRIPT, ...args], { cwd, input, encoding: "utf8", env: { ...process.env, PULSE_SESSIONS_DIR: registre, CLAUDE_PROJECT_DIR: "" } });
  const hook = (mode, id, cwd = projet) => lancer([mode], { input: JSON.stringify({ session_id: id, cwd }) });
  return { registre, projet, lancer, hook };
}

test("une seule session : aucune autre signalée", () => {
  const { lancer, hook } = contexte();
  assert.strictEqual(hook("--debut", "aaa").stdout, "", "le hook reste silencieux");
  const r = lancer(["aaa"]);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /^autres=0\n/);
});

test("deux sessions sur le même dossier : l'autre est signalée, puis disparaît à sa fermeture", () => {
  const { lancer, hook } = contexte();
  hook("--debut", "aaa");
  hook("--debut", "bbb");
  assert.match(lancer(["aaa"]).stdout, /^autres=1\n⚠️ 1 autre\(s\) session\(s\)/);
  hook("--fin", "bbb");
  assert.match(lancer(["aaa"]).stdout, /^autres=0/);
});

test("sans identifiant fiable, la session courante est retirée du compte", () => {
  const { lancer, hook } = contexte();
  hook("--debut", "aaa");
  assert.match(lancer(["${CLAUDE_SESSION_ID}"]).stdout, /^autres=0/);
  hook("--debut", "bbb");
  assert.match(lancer([]).stdout, /^autres=1/);
});

test("une session entrée dans un autre dossier (worktree) ne compte plus pour le dossier principal", () => {
  const { lancer, hook } = contexte();
  const ailleurs = depot("pulse-worktree-");
  hook("--debut", "aaa");
  hook("--debut", "bbb");
  assert.match(lancer(["--ici", "bbb"], { cwd: ailleurs }).stdout, /✅ Session inscrite/);
  assert.match(lancer(["aaa"]).stdout, /^autres=0/);
  assert.match(lancer(["bbb"], { cwd: ailleurs }).stdout, /^autres=0/);
});

test("une inscription de plus de 24 h est abandonnée et retirée", () => {
  const { registre, lancer, hook } = contexte();
  hook("--debut", "aaa");
  hook("--debut", "vieille");
  const [dossier] = fs.readdirSync(registre);
  const f = path.join(registre, dossier, "vieille.json");
  const avant = new Date(Date.now() - 25 * 60 * 60 * 1000);
  fs.utimesSync(f, avant, avant);
  assert.match(lancer(["aaa"]).stdout, /^autres=0/);
  assert.ok(!fs.existsSync(f));
});

test("hook : entrée invalide ou identifiant suspect, aucune erreur et rien d'inscrit", () => {
  const { registre, lancer, hook } = contexte();
  assert.strictEqual(lancer(["--debut"], { input: "pas du json" }).status, 0);
  assert.strictEqual(hook("--debut", "../../evil").status, 0);
  assert.deepStrictEqual(fs.existsSync(registre) ? fs.readdirSync(registre) : [], []);
});

test("sans identifiant : la session la plus récente est considérée comme la session courante", () => {
  const { lancer, hook } = contexte();
  hook("--debut", "aaaaaaaa-1111-2222-3333-444444444444");
  hook("--debut", "bbbbbbbb-1111-2222-3333-444444444444");
  const r = lancer([]);
  assert.match(r.stdout, /autres=1/);
});

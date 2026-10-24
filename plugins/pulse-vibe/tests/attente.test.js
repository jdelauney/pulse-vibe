// Tests de pulse-aidd attente (skills/spirc/scripts/attente.js) : mettre de côté et remettre le travail d'une tâche en attente.
// Lancer : node --test plugins/pulse-vibe/tests/attente.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "skills", "spirc", "scripts", "attente.js");
const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env: ENV });
const ecrire = (dossier, chemin, texte) => {
  fs.mkdirSync(path.dirname(path.join(dossier, chemin)), { recursive: true });
  fs.writeFileSync(path.join(dossier, chemin), texte);
};
const lancer = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8", env: ENV });
const lignes = (r, cle) => r.stdout.split("\n").filter((l) => l.startsWith(cle + ": ")).map((l) => l.slice(cle.length + 2));
const statut = (d) => git(d, "status", "--porcelain", "--untracked-files=all").stdout;

/** Un dépôt avec un fichier suivi (src/a.js), le plan et un document de la méthode, tous enregistrés. */
function depot() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-attente-"));
  git(d, "init", "-q");
  git(d, "config", "core.autocrlf", "false");
  ecrire(d, "src/a.js", "a1\n");
  ecrire(d, "aidd_docs/tasks/US-001/PLAN-SPEC-US-001.md", "plan1\n");
  ecrire(d, "docs/technical.md", "doc1\n");
  git(d, "add", "-A");
  git(d, "commit", "-q", "-m", "init");
  return d;
}
const nettoyer = (d) => fs.rmSync(d, { recursive: true, force: true });

test("mettre-de-cote : met de côté les fichiers de la tâche et laisse les documents de la méthode en place", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a2\n");
  ecrire(d, "src/neuf.js", "neuf\n");
  ecrire(d, "aidd_docs/tasks/US-001/PLAN-SPEC-US-001.md", "plan2\n");
  ecrire(d, "docs/technical.md", "doc2\n");
  const r = lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/neuf.js", "aidd_docs/tasks/US-001/PLAN-SPEC-US-001.md", "docs/technical.md");
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["fait"]);
  assert.deepStrictEqual(lignes(r, "mise-de-cote"), ["stash@{0}"]);
  assert.deepStrictEqual(lignes(r, "fichier").sort(), ["src/a.js", "src/neuf.js"]);
  assert.deepStrictEqual(lignes(r, "laisse").sort(), ["aidd_docs/tasks/US-001/PLAN-SPEC-US-001.md (document de la méthode)", "docs/technical.md (document de la méthode)"]);
  assert.deepStrictEqual(lignes(r, "ligne-plan"), ["· Mis de côté : pulse: T4 en attente"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "aidd_docs/tasks/US-001/PLAN-SPEC-US-001.md"), "utf8"), "plan2\n");
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a1\n");
  assert.ok(!fs.existsSync(path.join(d, "src/neuf.js")));
  assert.ok(!statut(d).includes("src/"), statut(d));
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  nettoyer(d);
});

test("mettre-de-cote : un fichier inconnu est refusé (code 2) et rien ne change", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a2\n");
  const avant = statut(d);
  const r = lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/absent.js");
  assert.strictEqual(r.status, 2);
  assert.deepStrictEqual(lignes(r, "inconnu"), ["src/absent.js"]);
  assert.strictEqual(statut(d), avant);
  assert.strictEqual(git(d, "stash", "list").stdout, "");
  nettoyer(d);
});

test("mettre-de-cote : une seconde mise de côté de la même tâche est refusée (deja:)", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a2\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js").status, 0);
  ecrire(d, "src/b.js", "b\n");
  const r = lancer(d, "mettre-de-cote", "T4", "--", "src/b.js");
  assert.strictEqual(r.status, 2);
  assert.deepStrictEqual(lignes(r, "deja"), ["stash@{0}"]);
  assert.ok(fs.existsSync(path.join(d, "src/b.js")));
  nettoyer(d);
});

test("mettre-de-cote : plus rien à mettre de côté (documents seuls) : refus, code 2", () => {
  const d = depot();
  ecrire(d, "docs/technical.md", "doc2\n");
  const r = lancer(d, "mettre-de-cote", "T4", "--", "docs/technical.md");
  assert.strictEqual(r.status, 2);
  assert.deepStrictEqual(lignes(r, "laisse"), ["docs/technical.md (document de la méthode)"]);
  assert.strictEqual(git(d, "stash", "list").stdout, "");
  nettoyer(d);
});

test("usage : numéro invalide, aucun fichier, chemin hors du dossier, action inconnue : code 1", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a2\n");
  for (const args of [
    ["mettre-de-cote", "4", "--", "src/a.js"],
    ["mettre-de-cote", "T4"],
    ["mettre-de-cote", "T4", "--"],
    ["mettre-de-cote", "T4", "--", "../x"],
    ["mettre-de-cote", "T4", "--", "src/../../x"],
    ["mettre-de-cote", "T4", "--", "/etc/passwd"],
    ["mettre-de-cote", "T4", "--", "C:/x.js"],
    ["remettre", "../x"],
    ["remettre"],
    ["bidule"],
    [],
  ]) {
    const r = lancer(d, ...args);
    assert.strictEqual(r.status, 1, JSON.stringify(args) + r.stdout + r.stderr);
  }
  assert.strictEqual(git(d, "stash", "list").stdout, "");
  nettoyer(d);
});

test("remettre : sans fichier commun, remet le travail et retire l'entrée", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a2\n");
  ecrire(d, "src/neuf.js", "neuf\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/neuf.js").status, 0);
  ecrire(d, "src/autre.js", "autre\n"); // le travail d'une autre tâche
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["remis"]);
  assert.deepStrictEqual(lignes(r, "fichier").sort(), ["src/a.js", "src/neuf.js"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a2\n");
  assert.strictEqual(fs.readFileSync(path.join(d, "src/neuf.js"), "utf8"), "neuf\n");
  assert.strictEqual(fs.readFileSync(path.join(d, "src/autre.js"), "utf8"), "autre\n");
  assert.strictEqual(git(d, "stash", "list").stdout, "");
  nettoyer(d);
});

test("remettre : ne retire que l'entrée de la tâche demandée", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a2\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js").status, 0);
  ecrire(d, "src/b.js", "b\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T5", "--", "src/b.js").status, 0);
  const r = lancer(d, "remettre", "T4"); // T4 est stash@{1}
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  const reste = git(d, "stash", "list").stdout;
  assert.match(reste, /pulse: T5 en attente/);
  assert.doesNotMatch(reste, /T4/);
  assert.ok(!fs.existsSync(path.join(d, "src/b.js")));
  nettoyer(d);
});

test("remettre : entrée absente (code 2, etat: absente)", () => {
  const d = depot();
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 2);
  assert.deepStrictEqual(lignes(r, "etat"), ["absente"]);
  nettoyer(d);
});

test("remettre : refusée sur un fichier commun (code 2), rien ne change", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a2\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js").status, 0);
  ecrire(d, "src/a.js", "a3\n"); // changé entre-temps
  const avant = statut(d);
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 2);
  assert.deepStrictEqual(lignes(r, "etat"), ["fichiers-communs"]);
  assert.deepStrictEqual(lignes(r, "fichier"), ["src/a.js"]);
  assert.strictEqual(statut(d), avant);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a3\n");
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  nettoyer(d);
});

test("remettre : un fichier non suivi recréé entre-temps (et ignoré) : conflit, code 3, entrée gardée", () => {
  const d = depot();
  ecrire(d, "src/neuf.js", "neuf\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/neuf.js").status, 0);
  ecrire(d, ".gitignore", "src/neuf.js\n");
  ecrire(d, "src/neuf.js", "recree\n");
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 3, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["conflit"]);
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/neuf.js"), "utf8"), "recree\n");
  nettoyer(d);
});

test("liste : une ligne par entrée de tâche en attente, « aucune » sinon", () => {
  const d = depot();
  let r = lancer(d, "liste");
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), "aucune");
  ecrire(d, "src/a.js", "a2\n");
  ecrire(d, "src/neuf.js", "neuf\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/neuf.js").status, 0);
  ecrire(d, "src/b.js", "b\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T5", "--", "src/b.js").status, 0);
  r = lancer(d, "liste");
  assert.strictEqual(r.status, 0);
  const l = r.stdout.trim().split("\n");
  assert.strictEqual(l.length, 2, r.stdout);
  assert.match(l[0], /^T5 · stash@\{0\} · 1 fichier · \d{4}-\d{2}-\d{2}$/);
  assert.match(l[1], /^T4 · stash@\{1\} · 2 fichiers · \d{4}-\d{2}-\d{2}$/);
  nettoyer(d);
});

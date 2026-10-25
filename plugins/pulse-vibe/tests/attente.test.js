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
    ["mettre-de-cote", "T4", "--", "..\\x"],
    ["mettre-de-cote", "T4", "--", "\\\\srv\\x"],
    ["mettre-de-cote", "T4", "--", "C:\\x"],
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

test("remettre : un fichier suivi changé entre-temps : refus avant tout (arbre-occupe), rien ne change", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a2\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js").status, 0);
  ecrire(d, "src/a.js", "a3\n"); // changé entre-temps
  const avant = statut(d);
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 2);
  assert.deepStrictEqual(lignes(r, "etat"), ["arbre-occupe"]);
  assert.deepStrictEqual(lignes(r, "fichier"), ["src/a.js"]);
  assert.strictEqual(statut(d), avant);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a3\n");
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  nettoyer(d);
});

test("remettre : un fichier ignoré recréé à un chemin de l'entrée : refus avant tout, le fichier reste intact", () => {
  const d = depot();
  ecrire(d, "src/neuf.js", "neuf\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/neuf.js").status, 0);
  ecrire(d, ".gitignore", "src/neuf.js\n");
  ecrire(d, "src/neuf.js", "recree\n");
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["arbre-occupe"]);
  assert.deepStrictEqual(lignes(r, "fichier"), ["src/neuf.js"]);
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

test("mettre-de-cote : un chemin avec des barres inverses est accepté et ramené à « / »", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a2\n");
  const r = lancer(d, "mettre-de-cote", "T4", "--", "src\\a.js");
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "fichier"), ["src/a.js"]);
  nettoyer(d);
});

test("remettre : conflit sur un fichier suivi (autre tâche validée entre-temps) : arbre remis à l'état d'avant, fichiers listés, entrée gardée", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a-T4\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js").status, 0);
  ecrire(d, "src/a.js", "a-T5\n"); // T5 change le même fichier et l'enregistre : l'arbre est propre
  git(d, "commit", "-q", "-am", "T5");
  ecrire(d, "src/autre.js", "autre\n");
  const avant = statut(d);
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 3, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["conflit"]);
  assert.deepStrictEqual(lignes(r, "fichier-en-conflit"), ["src/a.js"]);
  assert.match(lignes(r, "message")[0], /CONFLICT/);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a-T5\n");
  assert.strictEqual(statut(d), avant);
  assert.strictEqual(git(d, "ls-files", "-u").stdout, "");
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  nettoyer(d);
});

test("remettre : travail remis mais entrée impossible à retirer : remis-sans-nettoyage, code 0, entrée signalée", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a2\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js").status, 0);
  fs.writeFileSync(path.join(d, ".git", "refs", "stash.lock"), ""); // le retrait de l'entrée échouera
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["remis-sans-nettoyage"]);
  assert.deepStrictEqual(lignes(r, "mise-de-cote"), ["stash@{0}"]);
  assert.match(lignes(r, "a-retirer")[0], /stash@\{0\}/);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a2\n");
  nettoyer(d);
});

test("remettre : un changement enregistré ou non d'une autre tâche hors documents de la méthode : refus avant tout (arbre-occupe), rien ne change", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a-T4\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js").status, 0);
  ecrire(d, "src/p.js", "p\n");
  git(d, "add", "src/p.js");
  git(d, "commit", "-q", "-m", "p");
  ecrire(d, "src/p.js", "p-modifie\n"); // modifié, pas enregistré
  ecrire(d, "src/o.js", "o\n");
  git(d, "add", "src/o.js"); // enregistré pour le prochain commit
  ecrire(d, "docs/technical.md", "doc-enregistre\n");
  git(d, "add", "docs/technical.md"); // un document de la méthode enregistré bloque lui aussi
  ecrire(d, "aidd_docs/tasks/US-001/PLAN-SPEC-US-001.md", "plan2\n"); // le plan coché, pas enregistré : toléré
  const avant = statut(d);
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["arbre-occupe"]);
  assert.deepStrictEqual(lignes(r, "fichier").sort(), ["docs/technical.md", "src/o.js", "src/p.js"]);
  assert.strictEqual(statut(d), avant);
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  nettoyer(d);
});

test("remettre : en conflit, un fichier non suivi d'une autre tâche reste octet pour octet, les marques disparaissent, les fichiers neufs de l'entrée aussi", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a-T4\n");
  ecrire(d, "src/neuf.js", "neuf-T4\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/neuf.js").status, 0);
  ecrire(d, "src/a.js", "a-T5\n");
  git(d, "commit", "-q", "-am", "T5"); // chevauche T4
  ecrire(d, "src/n.js", "n-non-suivi\n");
  const avant = statut(d);
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 3, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["conflit"]);
  assert.deepStrictEqual(lignes(r, "fichier-en-conflit"), ["src/a.js"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a-T5\n");
  assert.strictEqual(fs.readFileSync(path.join(d, "src/n.js"), "utf8"), "n-non-suivi\n");
  assert.ok(!fs.existsSync(path.join(d, "src/neuf.js")));
  assert.strictEqual(statut(d), avant);
  assert.strictEqual(git(d, "ls-files", "-u").stdout, "");
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  nettoyer(d);
});

test("remettre : un chemin de l'entrée devenu un dossier avec une modification non enregistrée : refus avant tout, la modification reste", () => {
  const d = depot();
  ecrire(d, "src/x", "x-T4\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/x").status, 0);
  ecrire(d, "src/x/m.js", "m1\n");
  git(d, "add", "src/x/m.js");
  git(d, "commit", "-q", "-m", "dossier");
  ecrire(d, "src/x/m.js", "m-modifie\n");
  const avant = statut(d);
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["arbre-occupe"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/x/m.js"), "utf8"), "m-modifie\n");
  assert.strictEqual(statut(d), avant);
  nettoyer(d);
});

test("remettre : un fichier renommé mis de côté : les deux côtés du renommage sont connus, l'ancien chemin modifié entre-temps est refusé", () => {
  const d = depot();
  fs.renameSync(path.join(d, "src/a.js"), path.join(d, "src/b.js")); // déplacé : l'ancien chemin disparaît, le nouveau est neuf
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/b.js").status, 0);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a1\n"); // l'ancien chemin est revenu avec la mise de côté
  ecrire(d, "src/a.js", "a-encore\n");
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["arbre-occupe"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a-encore\n");
  nettoyer(d);
});

// Le plan est coché juste avant la remise (spirc, « Questions en attente », étapes 4 et 5).
const PLAN = "aidd_docs/tasks/US-001/PLAN-SPEC-US-001.md";

test("remettre : le plan et des documents de la méthode modifiés sans être enregistrés n'empêchent pas la remise et restent tels quels", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a-T4\n");
  ecrire(d, "src/neuf.js", "neuf\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/neuf.js").status, 0);
  ecrire(d, PLAN, "plan coché\n");
  ecrire(d, "docs/technical.md", "doc2\n");
  ecrire(d, "docs/nouveau.md", "nouveau\n");
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["remis"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a-T4\n");
  assert.strictEqual(fs.readFileSync(path.join(d, "src/neuf.js"), "utf8"), "neuf\n");
  assert.strictEqual(fs.readFileSync(path.join(d, PLAN), "utf8"), "plan coché\n");
  assert.strictEqual(fs.readFileSync(path.join(d, "docs/technical.md"), "utf8"), "doc2\n");
  assert.strictEqual(fs.readFileSync(path.join(d, "docs/nouveau.md"), "utf8"), "nouveau\n");
  assert.strictEqual(git(d, "stash", "list").stdout, "");
  nettoyer(d);
});

test("remettre : en conflit, le plan modifié sans être enregistré reste octet pour octet", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a-T4\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js").status, 0);
  ecrire(d, "src/a.js", "a-T5\n");
  git(d, "commit", "-q", "-am", "T5");
  ecrire(d, PLAN, "plan coché\r\nsans fin de ligne");
  const avant = statut(d);
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 3, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["conflit"]);
  assert.strictEqual(fs.readFileSync(path.join(d, PLAN), "utf8"), "plan coché\r\nsans fin de ligne");
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a-T5\n");
  assert.strictEqual(statut(d), avant);
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  nettoyer(d);
});

test("mettre-de-cote : un renommage enregistré (git mv) est refusé d'avance, des deux côtés, sans entrée créée", () => {
  const d = depot();
  git(d, "mv", "src/a.js", "src/b.js");
  const avant = statut(d);
  for (const demandes of [["src/a.js", "src/b.js"], ["src/a.js"], ["src/b.js"], ["src"]]) {
    const r = lancer(d, "mettre-de-cote", "T4", "--", ...demandes);
    assert.strictEqual(r.status, 2, JSON.stringify(demandes) + r.stdout + r.stderr);
    assert.deepStrictEqual(lignes(r, "etat"), ["refuse"]);
    assert.ok(lignes(r, "refuse").length >= 1, r.stdout);
    assert.strictEqual(statut(d), avant);
    assert.strictEqual(git(d, "stash", "list").stdout, "");
  }
  const r = lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/b.js");
  assert.deepStrictEqual(lignes(r, "refuse").sort(), ["src/a.js (déjà préparé pour un enregistrement)", "src/b.js (déjà préparé pour un enregistrement)"]);
  nettoyer(d);
});

test("mettre-de-cote : une suppression enregistrée (git rm) est refusée d'avance, sans entrée créée", () => {
  const d = depot();
  ecrire(d, "src/c.js", "c\n");
  git(d, "add", "src/c.js");
  git(d, "commit", "-q", "-m", "c");
  git(d, "rm", "-q", "src/c.js");
  ecrire(d, "src/a.js", "a2\n");
  const avant = statut(d);
  const r = lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/c.js");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["refuse"]);
  assert.deepStrictEqual(lignes(r, "refuse"), ["src/c.js (déjà préparé pour un enregistrement)"]);
  assert.strictEqual(statut(d), avant);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a2\n");
  assert.strictEqual(git(d, "stash", "list").stdout, "");
  nettoyer(d);
});

test("mettre-de-cote : un fichier ajouté de force dans un dossier ignoré est refusé d'avance, enregistré ou non", () => {
  const d = depot();
  ecrire(d, ".gitignore", "build/\n");
  ecrire(d, "build/suivi.js", "s1\n");
  git(d, "add", ".gitignore");
  git(d, "add", "-f", "build/suivi.js");
  git(d, "commit", "-q", "-m", "build");
  ecrire(d, "build/suivi.js", "s2\n"); // suivi, modifié sans être enregistré
  ecrire(d, "build/neuf.js", "n\n");
  git(d, "add", "-f", "build/neuf.js"); // ajouté de force, enregistré
  const avant = statut(d);
  const r = lancer(d, "mettre-de-cote", "T4", "--", "build/suivi.js", "build/neuf.js");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["refuse"]);
  assert.deepStrictEqual(lignes(r, "refuse").sort(), ["build/neuf.js (déjà préparé pour un enregistrement)", "build/suivi.js (fichier ignoré)"]);
  assert.strictEqual(statut(d), avant);
  assert.strictEqual(git(d, "stash", "list").stdout, "");
  nettoyer(d);
});

test("mettre-de-cote : Git crée l'entrée puis échoue : l'entrée est signalée (mise-de-cote-orpheline), code 3", () => {
  const d = depot();
  fs.mkdirSync(path.join(d, "imbrique"));
  git(path.join(d, "imbrique"), "init", "-q"); // un dépôt dans le dépôt, sans commit : Git ne sait pas le mettre de côté
  ecrire(d, "imbrique/n.txt", "n\n");
  const r = lancer(d, "mettre-de-cote", "T4", "--", "imbrique");
  assert.strictEqual(r.status, 3, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["echec"]);
  assert.deepStrictEqual(lignes(r, "mise-de-cote-orpheline"), ["stash@{0}"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "imbrique/n.txt"), "utf8"), "n\n");
  nettoyer(d);
});

test("remettre : un dossier parent de l'entrée devenu un fichier ignoré : refus avant tout, le fichier reste", () => {
  const d = depot();
  ecrire(d, "build/out.js", "out\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "build/out.js").status, 0);
  ecrire(d, ".gitignore", "build\n");
  git(d, "add", ".gitignore");
  git(d, "commit", "-q", "-m", "ignore");
  ecrire(d, "build", "un fichier\n");
  const avant = statut(d);
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["arbre-occupe"]);
  assert.deepStrictEqual(lignes(r, "fichier"), ["build"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "build"), "utf8"), "un fichier\n");
  assert.strictEqual(statut(d), avant);
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  nettoyer(d);
});

test("remettre : le dossier d'un fichier neuf de l'entrée maintenant suivi comme fichier : refus avant tout, rien ne change", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a-T4\n");
  ecrire(d, "src/x/m.js", "m-T4\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/x/m.js").status, 0);
  ecrire(d, "src/x", "x-T5\n");
  git(d, "add", "src/x");
  git(d, "commit", "-q", "-m", "T5");
  const avant = statut(d);
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["arbre-occupe"]);
  assert.deepStrictEqual(lignes(r, "fichier"), ["src/x"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/x"), "utf8"), "x-T5\n");
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a1\n");
  assert.strictEqual(statut(d), avant);
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  nettoyer(d);
});

test("remettre : un fichier neuf de l'entrée maintenant suivi par le projet : refus avant tout, rien ne change", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a-T4\n");
  ecrire(d, "src/neuf.js", "neuf-T4\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/neuf.js").status, 0);
  ecrire(d, "src/neuf.js", "neuf-T5\n");
  git(d, "add", "src/neuf.js");
  git(d, "commit", "-q", "-m", "T5");
  const avant = statut(d);
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["arbre-occupe"]);
  assert.deepStrictEqual(lignes(r, "fichier"), ["src/neuf.js"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/neuf.js"), "utf8"), "neuf-T5\n");
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a1\n");
  assert.strictEqual(statut(d), avant);
  assert.match(git(d, "stash", "list").stdout, /pulse: T4 en attente/);
  nettoyer(d);
});

test("remettre : en conflit, les dossiers vides créés par la remise sont retirés, et seulement eux", () => {
  const d = depot();
  ecrire(d, "src/a.js", "a-T4\n");
  ecrire(d, "lib/profond/n.js", "n-T4\n");
  ecrire(d, "vide/sous/m.js", "m-T4\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "lib/profond/n.js", "vide/sous/m.js").status, 0);
  assert.ok(!fs.existsSync(path.join(d, "lib")));
  fs.mkdirSync(path.join(d, "vide"), { recursive: true }); // un dossier vide déjà là avant la remise
  ecrire(d, "src/a.js", "a-T5\n");
  git(d, "commit", "-q", "-am", "T5");
  const r = lancer(d, "remettre", "T4");
  assert.strictEqual(r.status, 3, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["conflit"]);
  assert.ok(!fs.existsSync(path.join(d, "lib")), "lib/ retiré");
  assert.ok(!fs.existsSync(path.join(d, "vide/sous")), "vide/sous/ retiré");
  assert.ok(fs.existsSync(path.join(d, "vide")), "vide/ gardé");
  nettoyer(d);
});

test("mettre-de-cote : une suppression préparée par une autre tâche fait refuser d'avance (Git l'emporterait), rien ne change", () => {
  const d = depot();
  ecrire(d, "src/c.js", "c\n");
  git(d, "add", "src/c.js");
  git(d, "commit", "-q", "-m", "c");
  git(d, "rm", "-q", "src/c.js"); // l'autre tâche
  ecrire(d, "src/a.js", "a-T4\n"); // T4, non préparé
  const avant = statut(d);
  const r = lancer(d, "mettre-de-cote", "T4", "--", "src/a.js");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["refuse"]);
  assert.deepStrictEqual(lignes(r, "refuse"), ["src/c.js (déjà préparé pour un enregistrement)"]);
  assert.strictEqual(statut(d), avant);
  assert.strictEqual(fs.readFileSync(path.join(d, "src/a.js"), "utf8"), "a-T4\n");
  assert.strictEqual(git(d, "stash", "list").stdout, "");
  nettoyer(d);
});

test("mettre-de-cote : un fichier demandé préparé puis changé encore (MD, AM, MM) est refusé d'avance, rien ne change", () => {
  const d = depot();
  ecrire(d, "src/m.js", "m1\n");
  git(d, "add", "src/m.js");
  git(d, "commit", "-q", "-m", "m");
  ecrire(d, "src/a.js", "a-prepare\n");
  git(d, "add", "src/a.js");
  fs.rmSync(path.join(d, "src/a.js")); // MD
  ecrire(d, "src/n.js", "n-prepare\n");
  git(d, "add", "src/n.js");
  ecrire(d, "src/n.js", "n-encore\n"); // AM
  ecrire(d, "src/m.js", "m-prepare\n");
  git(d, "add", "src/m.js");
  ecrire(d, "src/m.js", "m-encore\n"); // MM
  const avant = statut(d);
  const indexAvant = git(d, "diff", "--cached").stdout;
  const r = lancer(d, "mettre-de-cote", "T4", "--", "src/a.js", "src/n.js", "src/m.js");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "etat"), ["refuse"]);
  assert.deepStrictEqual(lignes(r, "refuse").sort(), ["src/a.js", "src/m.js", "src/n.js"].map((f) => `${f} (déjà préparé pour un enregistrement)`));
  assert.strictEqual(statut(d), avant);
  assert.strictEqual(git(d, "diff", "--cached").stdout, indexAvant);
  assert.strictEqual(git(d, "stash", "list").stdout, "");
  nettoyer(d);
});

// Windows refuse « : » dans un nom de fichier : ce test tourne sous Linux et macOS (CI Ubuntu).
test("mettre-de-cote : un nom qui commence par « : » est lu tel quel pour les fichiers ignorés", { skip: process.platform === "win32" && "Windows refuse « : » dans un nom de fichier" }, () => {
  const d = depot();
  ecrire(d, ".gitignore", "/:x\n");
  ecrire(d, ":x", "x1\n");
  ecrire(d, ":!q", "q1\n");
  ecrire(d, ":(top)z", "z1\n");
  spawnSync("git", ["add", "-f", ".gitignore", ":x", ":!q", ":(top)z"], { cwd: d, env: { ...ENV, GIT_LITERAL_PATHSPECS: "1" } });
  git(d, "commit", "-q", "-m", "deux-points");
  ecrire(d, ":x", "x2\n"); // suivi, ignoré, modifié
  ecrire(d, ":!q", "q2\n"); // suivi, modifié
  ecrire(d, ":(top)z", "z2\n");
  const avant = statut(d);
  let r = lancer(d, "mettre-de-cote", "T4", "--", ":x", ":!q", ":(top)z");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "refuse"), [":x (fichier ignoré)"]);
  assert.strictEqual(statut(d), avant);
  assert.strictEqual(git(d, "stash", "list").stdout, "");
  r = lancer(d, "mettre-de-cote", "T4", "--", ":!q", ":(top)z");
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(lignes(r, "fichier").sort(), [":!q", ":(top)z"]);
  assert.strictEqual(fs.readFileSync(path.join(d, ":!q"), "utf8"), "q1\n");
  nettoyer(d);
});

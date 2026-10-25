// Tests de `pulse-aidd deplacer-commits` (scripts/deplacer-commits.js) : dépôts Git temporaires, avec un faux dépôt distant.
// Lancer : node --test plugins/pulse-vibe/tests/deplacer-commits.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const SCRIPT = path.join(RACINE, "scripts", "deplacer-commits.js");

function git(dossier, ...args) {
  const r = spawnSync("git", args, { cwd: dossier, encoding: "utf8" });
  assert.strictEqual(r.status, 0, `git ${args.join(" ")} : ${r.stderr}`);
  return r.stdout.trim();
}
const configurer = (d) => { for (const [k, v] of [["user.email", "t@t"], ["user.name", "t"], ["core.autocrlf", "false"], ["commit.gpgsign", "false"]]) git(d, "config", k, v); };
const valider = (d, fichier, sujet) => { fs.writeFileSync(path.join(d, fichier), sujet + "\n"); git(d, "add", fichier); git(d, "commit", "-q", "-m", sujet); return git(d, "rev-parse", "HEAD"); };

/** Un projet relié à un faux dépôt distant (dépôt nu), avec un premier commit envoyé ; `avance` commits de plus restent en local. */
function projet({ avance = 2, origineHead = true } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-deplacer-"));
  const distant = path.join(base, "distant.git");
  const d = path.join(base, "projet");
  fs.mkdirSync(d);
  git(base, "init", "-q", "--bare", "-b", "main", distant);
  git(d, "init", "-q", "-b", "main");
  configurer(d);
  valider(d, "README.md", "chore: départ");
  git(d, "remote", "add", "origin", distant);
  git(d, "push", "-q", "-u", "origin", "main");
  if (origineHead) git(d, "remote", "set-head", "origin", "main");
  for (let i = 1; i <= avance; i++) valider(d, `t${i}.txt`, `feat(T${i}): tâche ${i}`);
  return { base, distant, d };
}

function lancer(d, ...args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: d, encoding: "utf8" });
  const cles = {};
  for (const l of r.stdout.split("\n").filter(Boolean)) {
    const i = l.indexOf(":");
    (cles[l.slice(0, i)] = cles[l.slice(0, i)] || []).push(l.slice(i + 1).trim());
  }
  return { code: r.status, sortie: r.stdout + r.stderr, cles, premier: (k) => (cles[k] || [])[0] };
}

/** L'état complet du dépôt : branche courante, toutes les références, fichiers modifiés. */
const instantane = (d) => [git(d, "symbolic-ref", "-q", "HEAD"), git(d, "for-each-ref", "--format=%(refname) %(objectname)"), git(d, "status", "--porcelain", "--untracked-files=all")].join("\n--\n");

test("principale en avance de 2 commits : rangés sur la nouvelle branche, principale remise à l'état du dépôt distant", () => {
  const { d } = projet();
  const depart = git(d, "rev-parse", "HEAD");
  const distant = git(d, "rev-parse", "origin/main");
  const r = lancer(d, "feat/us-003-liste");
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.premier("etat"), "fait");
  assert.strictEqual(r.premier("deplace"), "2");
  assert.strictEqual(r.premier("branche"), "feat/us-003-liste");
  assert.strictEqual(r.premier("principale"), "main, remise à origin/main");
  assert.strictEqual(r.cles.commit.length, 2);
  assert.match(r.cles.commit[0], /feat\(T2\): tâche 2$/);
  assert.match(r.cles.commit[1], /feat\(T1\): tâche 1$/);
  assert.strictEqual(git(d, "branch", "--show-current"), "feat/us-003-liste");
  assert.strictEqual(git(d, "rev-parse", "feat/us-003-liste"), depart, "les commits sont sur la nouvelle branche");
  assert.strictEqual(git(d, "rev-parse", "main"), distant, "la principale revient à l'état du dépôt distant");
  assert.strictEqual(git(d, "status", "--porcelain"), "", "les fichiers du dossier restent tels quels");
  assert.ok(fs.existsSync(path.join(d, "t2.txt")));
});

test("sans origin/HEAD : la principale se donne avec --principale, sinon refus préalable", () => {
  const { d } = projet({ origineHead: false });
  const avant = instantane(d);
  const sans = lancer(d, "feat/us-003-liste");
  assert.strictEqual(sans.code, 2, sans.sortie);
  assert.strictEqual(sans.premier("etat"), "principale-inconnue");
  assert.match(sans.sortie, /--principale/);
  assert.strictEqual(instantane(d), avant, "rien n'a changé");
  const avec = lancer(d, "feat/us-003-liste", "--principale", "main");
  assert.strictEqual(avec.code, 0, avec.sortie);
  assert.strictEqual(avec.premier("deplace"), "2");
});

test("refus préalable, rien n'a changé : modification non enregistrée, fichier nouveau, autre branche", () => {
  const { d } = projet();
  fs.writeFileSync(path.join(d, "t1.txt"), "changé\n");
  let avant = instantane(d);
  let r = lancer(d, "feat/x");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "arbre-occupe");
  assert.deepStrictEqual(r.cles.fichier, ["t1.txt"]);
  assert.strictEqual(instantane(d), avant);
  git(d, "checkout", "-q", "--", "t1.txt");
  fs.writeFileSync(path.join(d, "neuf.txt"), "neuf\n");
  avant = instantane(d);
  r = lancer(d, "feat/x");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "arbre-occupe");
  assert.strictEqual(instantane(d), avant);
  fs.rmSync(path.join(d, "neuf.txt"));
  git(d, "switch", "-q", "-c", "autre");
  avant = instantane(d);
  r = lancer(d, "feat/x");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "autre-branche");
  assert.strictEqual(r.premier("branche-courante"), "autre");
  assert.strictEqual(instantane(d), avant);
});

test("divergence : la version du dépôt distant n'est pas dans l'historique local, refus avec la marche à suivre", () => {
  const { base, distant, d } = projet();
  const autre = path.join(base, "autre");
  git(base, "clone", "-q", distant, autre);
  configurer(autre);
  valider(autre, "ailleurs.txt", "feat: fait ailleurs");
  git(autre, "push", "-q", "origin", "main");
  git(d, "fetch", "-q", "origin");
  const avant = instantane(d);
  const r = lancer(d, "feat/x");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "divergence");
  assert.match(r.sortie, /récupérez d'abord la version du dépôt distant/);
  assert.strictEqual(instantane(d), avant);
});

test("nom déjà pris ou invalide, aucun commit d'avance : refus préalable", () => {
  const { d } = projet();
  git(d, "branch", "feat/pris", "origin/main");
  const avant = instantane(d);
  for (const [nom, etat] of [["feat/pris", "branche-existante"], ["feat/a..b", "nom-invalide"], ["nom avec espace", "nom-invalide"], ["-f", "nom-invalide"], ["HEAD", "nom-invalide"]]) {
    const r = lancer(d, nom);
    assert.strictEqual(r.code, 2, `${nom} : ${r.sortie}`);
    assert.strictEqual(r.premier("etat"), etat, nom);
    assert.strictEqual(instantane(d), avant, nom);
  }
  const vide = projet({ avance: 0 });
  const r = lancer(vide.d, "feat/x");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "rien-a-deplacer");
});

test("hors d'un dépôt, ou principale jamais envoyée : refus préalable ; arguments manquants : usage", () => {
  const hors = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-deplacer-hors-"));
  assert.strictEqual(lancer(hors, "feat/x").premier("etat"), "pas-de-depot");
  const { d } = projet({ origineHead: false });
  const r = lancer(d, "feat/x", "--principale", "develop");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "autre-branche");
  git(d, "branch", "-m", "main", "develop");
  const jamais = lancer(d, "feat/x", "--principale", "develop");
  assert.strictEqual(jamais.code, 2, jamais.sortie);
  assert.strictEqual(jamais.premier("etat"), "principale-absente-du-depot-distant");
  for (const args of [[], ["a", "b"], ["feat/x", "--principale"], ["feat/x", "--inconnue", "y"]]) {
    const u = lancer(d, ...args);
    assert.strictEqual(u.code, 1, `${args.join(" ")} : ${u.sortie}`);
    assert.ok(u.premier("usage"), args.join(" "));
  }
});

test("échec rattrapé quand le changement de branche échoue : principale intacte, toujours sur elle, nouvelle branche gardée", () => {
  const { d } = projet();
  const depart = git(d, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(d, ".git", "index.lock"), "");
  const r = lancer(d, "feat/x");
  fs.rmSync(path.join(d, ".git", "index.lock"));
  assert.strictEqual(r.code, 3, r.sortie);
  assert.strictEqual(r.premier("etat"), "echec");
  assert.ok(r.premier("raison"));
  assert.strictEqual(git(d, "branch", "--show-current"), "main");
  assert.strictEqual(git(d, "rev-parse", "main"), depart, "principale à son commit de départ");
  assert.strictEqual(git(d, "rev-parse", "feat/x"), depart, "les commits restent aussi sur la nouvelle branche");
  assert.strictEqual(r.premier("branche-gardee"), "feat/x");
});

test("échec rattrapé quand la principale ne peut pas être remise : retour sur elle, à son commit de départ", () => {
  const { d } = projet();
  const depart = git(d, "rev-parse", "HEAD");
  const verrou = path.join(d, ".git", "refs", "heads", "main.lock");
  fs.writeFileSync(verrou, "");
  const r = lancer(d, "feat/x");
  fs.rmSync(verrou);
  assert.strictEqual(r.code, 3, r.sortie);
  assert.strictEqual(r.premier("etat"), "echec");
  assert.strictEqual(git(d, "branch", "--show-current"), "main");
  assert.strictEqual(git(d, "rev-parse", "main"), depart);
  assert.strictEqual(git(d, "rev-parse", "feat/x"), depart);
  assert.strictEqual(git(d, "status", "--porcelain"), "");
});

test("relais : pulse-aidd deplacer-commits lance le script", () => {
  const { d } = projet();
  const r = spawnSync("bash", [path.join(RACINE, "bin", "pulse-aidd").split(path.sep).join("/"), "deplacer-commits", "feat/us-003-liste"], { cwd: d, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^deplace: 2$/m);
});

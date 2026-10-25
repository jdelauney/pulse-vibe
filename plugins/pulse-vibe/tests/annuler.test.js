// Tests de `pulse-aidd annuler` (skills/annuler/scripts/annuler.js) : dépôts Git temporaires.
// Lancer : node --test plugins/pulse-vibe/tests/annuler.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "skills", "annuler", "scripts", "annuler.js");
const PLAN = "aidd_docs/tasks/US-003/PLAN-SPEC-US-003-liste.md";

function git(dossier, ...args) {
  const r = spawnSync("git", args, { cwd: dossier, encoding: "utf8" });
  assert.strictEqual(r.status, 0, `git ${args.join(" ")} : ${r.stderr}`);
  return r.stdout.trim();
}

function depot() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-annuler-"));
  git(d, "init", "-q", "-b", "main");
  for (const [k, v] of [["user.email", "t@t"], ["user.name", "t"], ["core.autocrlf", "false"], ["commit.gpgsign", "false"]]) git(d, "config", k, v);
  return d;
}
const ecrire = (d, f, texte) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), texte); };
const lire = (d, f) => fs.readFileSync(path.join(d, f), "utf8");
const valider = (d, sujet, ...fichiers) => { git(d, "add", ...(fichiers.length ? fichiers : ["."])); git(d, "commit", "-q", "-m", sujet); return git(d, "rev-parse", "HEAD"); };

function plan(taches, statut = "x", extra = "") {
  return [
    "# Plan – US-003", "", `Statut : a${extra}`, "", "## Tâches", "",
    ...taches.flatMap((t) => [`- [${statut}] **${t} – Titre ${t}** · US-003`, `  - Objectif : objectif ${t}`, `  - Fichiers : à créer : ${t.toLowerCase()}.txt`]),
    "", "## Journal", "", "| Date | Tâche | Commit | Remarque |", "|---|---|---|---|", "| 2026-01-01 | T1 | abc | enregistrée |", "",
  ].join("\n");
}

function lancer(d, ...args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: d, encoding: "utf8" });
  const cles = {};
  for (const l of r.stdout.split("\n").filter(Boolean)) {
    const i = l.indexOf(":");
    (cles[l.slice(0, i)] = cles[l.slice(0, i)] || []).push(l.slice(i + 1).trim());
  }
  return { code: r.status, sortie: r.stdout, cles, premier: (k) => (cles[k] || [])[0] };
}

const propre = (d) => git(d, "status", "--porcelain") === "";
const sujets = (d) => git(d, "log", "--format=%s").split("\n");

/** Dépôt de base : un plan avec T1 et T2 enregistrées, un commit par tâche. */
function projetDeuxTaches() {
  const d = depot();
  ecrire(d, "README.md", "projet\n");
  valider(d, "chore: départ");
  ecrire(d, PLAN, plan(["T1", "T2"], " "));
  valider(d, "docs: plan");
  ecrire(d, "t1.txt", "un\n");
  ecrire(d, PLAN, plan(["T1", "T2"], "x").replace("- [x] **T2", "- [ ] **T2"));
  valider(d, "feat(T1): premier");
  ecrire(d, "t2.txt", "deux\n");
  ecrire(d, PLAN, plan(["T1", "T2"], "x"));
  valider(d, "feat(T2): second");
  return d;
}

test("aperçu puis défaire une tâche simple : une version d'annulation, plan et journal à jour", () => {
  const d = projetDeuxTaches();
  const avant = git(d, "rev-parse", "HEAD");
  const ap = lancer(d, "apercu", "T2");
  assert.strictEqual(ap.code, 0, ap.sortie);
  assert.match(ap.premier("tache"), /^T2 · Titre T2 · objectif T2$/);
  assert.ok(ap.cles.fichier.includes("t2.txt"));
  assert.strictEqual(ap.premier("envoyes"), "non");
  assert.strictEqual(git(d, "rev-parse", "HEAD"), avant, "l'aperçu ne change rien");

  const r = lancer(d, "defaire", "T2");
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.premier("etat"), "fait");
  assert.ok(!fs.existsSync(path.join(d, "t2.txt")));
  assert.ok(fs.existsSync(path.join(d, "t1.txt")));
  const p = lire(d, PLAN);
  assert.match(p, /- \[ \] \*\*T2/);
  assert.match(p, /- \[x\] \*\*T1/);
  assert.match(p, /\| T2 \| — \| annulée par \/pulse:annuler \|/);
  assert.match(sujets(d)[0], /^revert\(T2\): annule /);
  assert.match(git(d, "log", "-1", "--format=%B"), /Annule [0-9a-f]{7}\./);
  assert.ok(propre(d));
  assert.strictEqual(sujets(d).length, 5, "l'historique reste entier");
});

test("une US à deux tâches : un seul commit, les deux tâches repassent à faire", () => {
  const d = projetDeuxTaches();
  const r = lancer(d, "defaire", "US-003");
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.premier("taches"), "T1 T2");
  assert.ok(!fs.existsSync(path.join(d, "t1.txt")) && !fs.existsSync(path.join(d, "t2.txt")));
  const p = lire(d, PLAN);
  assert.doesNotMatch(p, /\[x\] \*\*T/);
  assert.match(sujets(d)[0], /^revert\(US-003\): annule /);
  assert.strictEqual(sujets(d).length, 5);
  assert.ok(propre(d));
});

test("un commit de fusion est défait avec -m 1 et garde le travail de la branche principale", () => {
  const d = depot();
  ecrire(d, "base.txt", "base\n");
  ecrire(d, PLAN, plan(["T3"], "x"));
  valider(d, "chore: départ");
  git(d, "checkout", "-q", "-b", "cote");
  ecrire(d, "cote.txt", "cote\n");
  valider(d, "wip: côté");
  git(d, "checkout", "-q", "main");
  ecrire(d, "principal.txt", "principal\n");
  valider(d, "chore: principal");
  git(d, "merge", "--no-ff", "-q", "cote", "-m", "feat(T3): fusionne le côté");
  const r = lancer(d, "defaire", "T3");
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(!fs.existsSync(path.join(d, "cote.txt")));
  assert.ok(fs.existsSync(path.join(d, "principal.txt")));
  assert.ok(propre(d));
});

test("conflit sur le plan seul : le plan actuel est gardé, la tâche repasse à faire", () => {
  const d = depot();
  ecrire(d, "base.txt", "base\n");
  ecrire(d, PLAN, plan(["T1", "T2"], " "));
  valider(d, "chore: départ");
  ecrire(d, "t1.txt", "un\n");
  ecrire(d, PLAN, plan(["T1", "T2"], " ", " (b)").replace("- [ ] **T1", "- [x] **T1"));
  valider(d, "feat(T1): premier");
  ecrire(d, "t2.txt", "deux\n");
  ecrire(d, PLAN, plan(["T1", "T2"], "x", " (c)"));
  valider(d, "feat(T2): second");
  const r = lancer(d, "defaire", "T1");
  assert.strictEqual(r.code, 0, r.sortie);
  const p = lire(d, PLAN);
  assert.match(p, /Statut : a \(c\)/, "la version actuelle du plan est gardée");
  assert.match(p, /- \[ \] \*\*T1/);
  assert.match(p, /- \[x\] \*\*T2/);
  assert.ok(!fs.existsSync(path.join(d, "t1.txt")) && fs.existsSync(path.join(d, "t2.txt")));
  assert.ok(propre(d));
});

test("conflit sur du code : l'état d'avant revient, code 3", () => {
  const d = depot();
  ecrire(d, "code.js", "ligne\n");
  ecrire(d, PLAN, plan(["T1", "T2"], "x"));
  valider(d, "chore: départ");
  ecrire(d, "code.js", "ligne T1\n");
  valider(d, "feat(T1): premier");
  ecrire(d, "code.js", "ligne T2\n");
  ecrire(d, "autre.txt", "x\n");
  valider(d, "feat(T2): second");
  const avant = git(d, "rev-parse", "HEAD");
  const r = lancer(d, "defaire", "T1");
  assert.strictEqual(r.code, 3, r.sortie);
  assert.ok(r.cles.fichier.includes("code.js"));
  assert.strictEqual(git(d, "rev-parse", "HEAD"), avant);
  assert.strictEqual(lire(d, "code.js"), "ligne T2\n");
  assert.ok(propre(d));
  assert.strictEqual(lancer(d, "etat").premier("operation"), "aucune");
});

test("un dossier modifié est refusé, code 2, rien ne change", () => {
  const d = projetDeuxTaches();
  ecrire(d, "t1.txt", "modifié\n");
  ecrire(d, "neuf.txt", "neuf\n");
  const r = lancer(d, "defaire", "T2");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "changements-en-cours");
  assert.strictEqual(lire(d, "t1.txt"), "modifié\n");
  assert.ok(fs.existsSync(path.join(d, "t2.txt")));
  assert.strictEqual(sujets(d).length, 4);
});

test("T3 défait seulement T3, jamais T30", () => {
  const d = depot();
  ecrire(d, "base.txt", "base\n");
  ecrire(d, PLAN, plan(["T3", "T30"], "x"));
  valider(d, "chore: départ");
  ecrire(d, "t3.txt", "3\n");
  valider(d, "feat(T3): trois");
  ecrire(d, "t30.txt", "30\n");
  valider(d, "feat(T30): trente");
  const r = lancer(d, "defaire", "T3");
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(!fs.existsSync(path.join(d, "t3.txt")) && fs.existsSync(path.join(d, "t30.txt")));
  const p = lire(d, PLAN);
  assert.match(p, /- \[ \] \*\*T3 /);
  assert.match(p, /- \[x\] \*\*T30 /);
});

test("revenir à une version : branche de sauvegarde sur l'état d'avant, un seul commit", () => {
  const d = projetDeuxTaches();
  const version = git(d, "rev-parse", "HEAD~2");
  const avant = git(d, "rev-parse", "HEAD");
  const ap = lancer(d, "apercu", "version", version.slice(0, 7));
  assert.strictEqual(ap.code, 0, ap.sortie);
  assert.strictEqual(ap.premier("taches"), "T1 T2");
  const r = lancer(d, "defaire", "version", version.slice(0, 7));
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.premier("sauvegarde"), /^sauvegarde\/\d{4}-\d{2}-\d{2}-\d{4}/);
  assert.strictEqual(git(d, "rev-parse", r.premier("sauvegarde")), avant);
  assert.match(sujets(d)[0], /^revert: revient à la version du \d{2}\/\d{2}\/\d{4}$/);
  assert.match(git(d, "log", "-1", "--format=%B"), /Tâches défaites : T1 T2/);
  assert.ok(!fs.existsSync(path.join(d, "t1.txt")) && !fs.existsSync(path.join(d, "t2.txt")));
  assert.doesNotMatch(lire(d, PLAN), /\[x\] \*\*T/);
  assert.ok(propre(d));
});

test("un commit refusé par un contrôle : l'état d'avant revient, code 3", () => {
  const d = projetDeuxTaches();
  const avant = git(d, "rev-parse", "HEAD");
  const crochet = path.join(d, ".git", "hooks", "pre-commit");
  fs.writeFileSync(crochet, "#!/bin/sh\necho 'contrôle refusé' >&2\nexit 1\n", { mode: 0o755 });
  const r = lancer(d, "defaire", "T2");
  assert.strictEqual(r.code, 3, r.sortie);
  assert.strictEqual(git(d, "rev-parse", "HEAD"), avant);
  assert.ok(propre(d));
  assert.ok(fs.existsSync(path.join(d, "t2.txt")));
  assert.match(lire(d, PLAN), /- \[x\] \*\*T2/);
  assert.strictEqual(git(d, "branch", "--list", "sauvegarde/*"), "");
});

test("mettre de côté puis récupérer ; une entrée de spirc est refusée", () => {
  const d = projetDeuxTaches();
  ecrire(d, "t1.txt", "modifié\n");
  ecrire(d, "neuf.txt", "neuf\n");
  const m = lancer(d, "mettre-de-cote", "--resume", "essai de couleur");
  assert.strictEqual(m.code, 0, m.sortie);
  assert.match(m.premier("mise-de-cote"), /^stash@\{0\} · pulse-annuler \d{4}-\d{2}-\d{2} \d{2}:\d{2} essai de couleur$/);
  assert.ok(propre(d));
  assert.strictEqual(lire(d, "t1.txt"), "un\n");

  // Une entrée de spirc, plus récente.
  ecrire(d, "attente.txt", "x\n");
  git(d, "stash", "push", "-u", "-m", "pulse: T4 en attente");
  const refus = lancer(d, "recuperer", "stash@{0}");
  assert.strictEqual(refus.code, 2, refus.sortie);
  assert.strictEqual(refus.premier("etat"), "mise-de-cote-etrangere");
  assert.ok(!fs.existsSync(path.join(d, "attente.txt")));

  const r = lancer(d, "recuperer", "stash@{1}");
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.premier("a-supprimer"), "stash@{1}");
  assert.strictEqual(lire(d, "t1.txt"), "modifié\n");
  assert.ok(fs.existsSync(path.join(d, "neuf.txt")));
  assert.match(git(d, "stash", "list"), /pulse-annuler/, "la mise de côté n'est pas supprimée");
});

test("mettre de côté quelques fichiers seulement ; chemins douteux et fichiers sans changement refusés", () => {
  const d = projetDeuxTaches();
  ecrire(d, "t1.txt", "modifié\n");
  ecrire(d, "t2.txt", "modifié aussi\n");
  for (const mauvais of ["../hors.txt", "/etc/passwd", "C:/x.txt"]) {
    const r = lancer(d, "mettre-de-cote", "--", mauvais);
    assert.strictEqual(r.code, 2, mauvais);
    assert.strictEqual(r.premier("etat"), "chemin-refuse");
  }
  const inconnu = lancer(d, "mettre-de-cote", "--", "README.md");
  assert.strictEqual(inconnu.code, 2);
  assert.strictEqual(inconnu.premier("etat"), "fichier-sans-changement");
  const r = lancer(d, "mettre-de-cote", "--", "t1.txt");
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(lire(d, "t1.txt"), "un\n");
  assert.strictEqual(lire(d, "t2.txt"), "modifié aussi\n");
});

test("mettre de côté sans changement est refusé ; la tâche en cours repasse à faire", () => {
  const d = projetDeuxTaches();
  assert.strictEqual(lancer(d, "mettre-de-cote").code, 2);
  // T2 en cours dans le plan enregistré, ses fichiers modifiés.
  ecrire(d, PLAN, plan(["T1", "T2"], "x").replace("- [x] **T2", "- [~] **T2"));
  valider(d, "docs: T2 en cours");
  ecrire(d, "t2.txt", "début de reprise\n");
  const r = lancer(d, "mettre-de-cote", "--resume", "reprise");
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.premier("tache-en-cours"), "T2");
  assert.match(lire(d, PLAN), /- \[ \] \*\*T2/);
});

test("rétablir une annulation : la tâche revient à faite, avec sa ligne de journal", () => {
  const d = projetDeuxTaches();
  lancer(d, "defaire", "T2");
  const annulation = git(d, "rev-parse", "--short", "HEAD");
  const etat = lancer(d, "etat");
  assert.ok(etat.cles.annulation.some((l) => l.startsWith(annulation)), etat.sortie);
  const r = lancer(d, "recuperer", annulation);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.premier("commit"), git(d, "rev-parse", "--short", "HEAD"));
  assert.ok(fs.existsSync(path.join(d, "t2.txt")));
  const p = lire(d, PLAN);
  assert.match(p, /- \[x\] \*\*T2/);
  assert.match(p, /rétablie par \/pulse:annuler/);
  assert.match(sujets(d)[0], /^revert: rétablit T2$/);
  assert.ok(propre(d));
  // Un commit ordinaire n'est pas une annulation.
  assert.strictEqual(lancer(d, "recuperer", git(d, "rev-parse", "--short", "HEAD~3")).code, 2);
});

test("l'état : versions reliées à leurs tâches, mises de côté de Pulse seulement, autres sessions", () => {
  const d = projetDeuxTaches();
  ecrire(d, "t1.txt", "modifié\n");
  const e = lancer(d, "etat");
  assert.strictEqual(e.code, 0, e.sortie);
  assert.strictEqual(e.premier("depot"), "oui");
  assert.strictEqual(e.premier("operation"), "aucune");
  assert.strictEqual(e.premier("changements"), "1");
  assert.match(e.cles.version[0], /^[0-9a-f]{7} · \d{2}\/\d{2} \d{2}:\d{2} · T2 · US-003 · feat\(T2\): second · local$/);
  assert.strictEqual(e.cles.version.length, 4);
  git(d, "stash", "push", "-u", "-m", "pulse: T4 en attente");
  assert.strictEqual((lancer(d, "etat").cles["mise-de-cote"] || []).length, 0);
  assert.strictEqual(lancer(d, "etat", "--session", "inconnue").premier("autres-sessions"), "0");
});

test("hors dépôt, usage incorrect et cibles inconnues", () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-annuler-vide-"));
  const sansDepot = lancer(dossier, "etat");
  assert.strictEqual(sansDepot.code, 0);
  assert.strictEqual(sansDepot.premier("depot"), "non");
  assert.strictEqual(lancer(dossier, "defaire", "T1").code, 2);
  const d = projetDeuxTaches();
  assert.strictEqual(lancer(d).code, 1);
  assert.strictEqual(lancer(d, "supprimer").code, 1);
  assert.strictEqual(lancer(d, "defaire").code, 1);
  assert.strictEqual(lancer(d, "defaire", "T99").code, 2);
  assert.strictEqual(lancer(d, "defaire", "version", "--hard").code, 1);
  assert.strictEqual(lancer(d, "defaire", "version", "-1").code, 2);
  assert.strictEqual(lancer(d, "recuperer").code, 1);
});

test("le script n'emploie aucune opération Git destructrice", () => {
  const source = fs.readFileSync(SCRIPT, "utf8").replace(/^\s*\/\/.*$/gm, "");
  for (const interdit of [/"reset",\s*"--hard"/, /"clean"/, /\["push"/, /"branch",\s*"-D"/, /"stash",\s*"drop"/, /"checkout",\s*"--",\s*"\."/]) assert.doesNotMatch(source, interdit);
});

/** Une mise de côté de t1.txt, puis un commit qui change la même ligne : la reprise entre en conflit. */
function miseDeCoteEnConflit() {
  const d = projetDeuxTaches();
  ecrire(d, "t1.txt", "version mise de côté\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "--resume", "essai").code, 0);
  ecrire(d, "t1.txt", "version du commit\n");
  valider(d, "chore: change t1");
  return d;
}

test("récupérer avec un fichier préparé ou modifié sans rapport : refusé d'avance (arbre-occupe), rien ne bouge", () => {
  for (const preparer of [true, false]) {
    const d = miseDeCoteEnConflit();
    ecrire(d, "prepare.txt", "préparé\n");
    if (preparer) git(d, "add", "prepare.txt");
    else { ecrire(d, "README.md", "modifié\n"); }
    const avant = git(d, "status", "--porcelain");
    const r = lancer(d, "recuperer", "stash@{0}");
    assert.strictEqual(r.code, 2, r.sortie);
    assert.strictEqual(r.premier("etat"), "arbre-occupe");
    assert.ok(r.cles.fichier.includes(preparer ? "prepare.txt" : "README.md"));
    assert.strictEqual(lire(d, "prepare.txt"), "préparé\n");
    assert.strictEqual(git(d, "status", "--porcelain"), avant);
  }
});

test("récupérer un chemin devenu dossier dans HEAD, avec une modification en cours : refusé, modification intacte", () => {
  const d = miseDeCoteEnConflit();
  git(d, "rm", "-q", "t1.txt");
  ecrire(d, "t1.txt/dedans.txt", "dedans\n");
  valider(d, "chore: t1 devient un dossier");
  ecrire(d, "t1.txt/dedans.txt", "dedans modifié\n");
  const r = lancer(d, "recuperer", "stash@{0}");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "arbre-occupe");
  assert.strictEqual(lire(d, "t1.txt/dedans.txt"), "dedans modifié\n");
});

test("récupérer un renommage dont l'ancien chemin a changé dans HEAD : arbre identique, entrée gardée", () => {
  const d = projetDeuxTaches();
  git(d, "mv", "t1.txt", "n1.txt");
  assert.strictEqual(lancer(d, "mettre-de-cote", "--resume", "renommage").code, 0);
  ecrire(d, "t1.txt", "changé ailleurs\n");
  ecrire(d, "n1.txt", "autre contenu\n");
  valider(d, "chore: t1 change, n1 existe");
  const avant = git(d, "rev-parse", "HEAD");
  const r = lancer(d, "recuperer", "stash@{0}");
  assert.strictEqual(r.code, 3, r.sortie);
  assert.ok(propre(d), git(d, "status", "--porcelain"));
  assert.strictEqual(lire(d, "n1.txt"), "autre contenu\n");
  assert.strictEqual(lire(d, "t1.txt"), "changé ailleurs\n");
  assert.strictEqual(git(d, "rev-parse", "HEAD"), avant);
  assert.match(git(d, "stash", "list"), /renommage/);
});

test("récupérer un fichier ignoré, régénéré au même chemin : refusé d'avance, fichier intact", () => {
  const d = projetDeuxTaches();
  ecrire(d, "gen.txt", "mis de côté\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "--resume", "gen").code, 0);
  ecrire(d, ".gitignore", "gen.txt\n");
  valider(d, "chore: ignore gen");
  ecrire(d, "gen.txt", "régénéré\n");
  const r = lancer(d, "recuperer", "stash@{0}");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "arbre-occupe");
  assert.ok(r.cles.fichier.includes("gen.txt"));
  assert.strictEqual(lire(d, "gen.txt"), "régénéré\n");
});

test("récupérer en conflit sur un arbre propre : état identique, fichier sans rapport gardé, entrée gardée, code 3", () => {
  const d = miseDeCoteEnConflit();
  ecrire(d, "libre.txt", "fichier libre\n");
  const r = lancer(d, "recuperer", "stash@{0}");
  assert.strictEqual(r.code, 3, r.sortie);
  assert.strictEqual(r.premier("etat"), "echec");
  assert.ok(r.cles["fichier-en-conflit"].includes("t1.txt"));
  assert.strictEqual(lire(d, "libre.txt"), "fichier libre\n");
  assert.strictEqual(lire(d, "t1.txt"), "version du commit\n");
  assert.match(git(d, "stash", "list"), /pulse-annuler/);
  assert.strictEqual(git(d, "status", "--porcelain"), "?? libre.txt");
  assert.strictEqual(lancer(d, "etat").premier("operation"), "aucune");
});

test("un commit refusé pendant le retour à une version : état d'avant, aucune branche de sauvegarde", () => {
  const d = projetDeuxTaches();
  const avant = git(d, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(d, ".git", "hooks", "pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const version = git(d, "rev-parse", "--short", "HEAD~2");
  for (let i = 0; i < 2; i++) {
    const r = lancer(d, "defaire", "version", version);
    assert.strictEqual(r.code, 3, r.sortie);
  }
  assert.strictEqual(git(d, "rev-parse", "HEAD"), avant);
  assert.strictEqual(git(d, "branch", "--list", "sauvegarde/*"), "");
  assert.ok(propre(d));
});

test("une US dont la seconde annulation entre en conflit sur du code : tout revient à l'état d'avant", () => {
  const d = depot();
  ecrire(d, "code.js", "ligne\n");
  ecrire(d, PLAN, plan(["T1", "T2"], "x"));
  valider(d, "chore: départ");
  ecrire(d, "code.js", "ligne T1\n");
  valider(d, "feat(T1): premier");
  ecrire(d, "t2.txt", "deux\n");
  valider(d, "feat(T2): second");
  ecrire(d, "code.js", "ligne T9\n");
  valider(d, "feat(T9): autre US");
  const avant = git(d, "rev-parse", "HEAD");
  const r = lancer(d, "defaire", "US-003");
  assert.strictEqual(r.code, 3, r.sortie);
  assert.strictEqual(git(d, "rev-parse", "HEAD"), avant);
  assert.ok(fs.existsSync(path.join(d, "t2.txt")), "la première annulation, déjà faite en cours de route, est défaite");
  assert.strictEqual(lire(d, "code.js"), "ligne T9\n");
  assert.ok(propre(d));
});

test("rétablir une annulation ne remet pas à faite une tâche dont l'annulation a elle-même été défaite", () => {
  const d = projetDeuxTaches();
  lancer(d, "defaire", "T2");
  const annulation = git(d, "rev-parse", "--short", "HEAD");
  lancer(d, "recuperer", annulation);
  const retablissement = git(d, "rev-parse", "--short", "HEAD");
  // Annuler le rétablissement n'est pas un cas de défaire : seul l'aperçu de l'annulation d'origine l'est, sans tâche d'un commit d'annulation.
  const ap = lancer(d, "apercu", "annulation", retablissement);
  assert.strictEqual(ap.code, 0, ap.sortie);
  assert.strictEqual(ap.premier("taches"), "—", "les commits annulés par un rétablissement sont des annulations");
});

test("la lecture de l'état Git qui échoue est un refus (code 2)", () => {
  const d = projetDeuxTaches();
  fs.writeFileSync(path.join(d, ".git", "index"), "pas un index");
  const r = lancer(d, "defaire", "T2");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "lecture-impossible");
});

test("récupérer pendant une opération Git en cours : refusé (operation-en-cours), HEAD et opération intacts", () => {
  const d = miseDeCoteEnConflit();
  // Une annulation à la main, en conflit : REVERT_HEAD reste en place.
  const echec = spawnSync("git", ["revert", "--no-edit", "HEAD~2"], { cwd: d, encoding: "utf8" });
  assert.notStrictEqual(echec.status, 0);
  const avant = git(d, "rev-parse", "HEAD");
  const statut = git(d, "status", "--porcelain");
  const r = lancer(d, "recuperer", "stash@{0}");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "operation-en-cours");
  assert.strictEqual(r.premier("operation"), "annulation");
  assert.strictEqual(git(d, "rev-parse", "HEAD"), avant);
  assert.strictEqual(git(d, "status", "--porcelain"), statut);
  assert.ok(fs.existsSync(path.join(d, ".git", "REVERT_HEAD")));
});

test("un contrôle qui modifie des fichiers puis refuse le commit : l'état est dit non nettoyé, avec la liste", () => {
  const d = projetDeuxTaches();
  fs.writeFileSync(path.join(d, ".git", "hooks", "pre-commit"), "#!/bin/sh\necho x >> README.md\necho y > hook-log.txt\nexit 1\n", { mode: 0o755 });
  const r = lancer(d, "defaire", "T2");
  assert.strictEqual(r.code, 3, r.sortie);
  assert.strictEqual(r.premier("etat"), "conflit-non-nettoye");
  assert.ok(r.cles.fichier.some((l) => /README\.md/.test(l)), r.sortie);
  assert.ok(r.cles.fichier.some((l) => /hook-log\.txt/.test(l)), r.sortie);
});

test("un dossier parent de l'entrée qui existe comme fichier ignoré : récupération refusée d'avance", () => {
  const d = projetDeuxTaches();
  ecrire(d, "gen/a.txt", "dedans\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "--resume", "gen").code, 0);
  ecrire(d, ".gitignore", "gen\n");
  valider(d, "chore: ignore gen");
  ecrire(d, "gen", "un fichier\n");
  const r = lancer(d, "recuperer", "stash@{0}");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "arbre-occupe");
  assert.ok(r.cles.fichier.includes("gen"));
  assert.strictEqual(lire(d, "gen"), "un fichier\n");
});

test("un fichier non suivi de l'entrée que HEAD suit désormais : récupération refusée d'avance", () => {
  const d = projetDeuxTaches();
  ecrire(d, "u.txt", "mis de côté\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "--resume", "u").code, 0);
  ecrire(d, "u.txt", "suivi par HEAD\n");
  valider(d, "chore: u.txt suivi");
  const r = lancer(d, "recuperer", "stash@{0}");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "arbre-occupe");
  assert.ok(r.cles.fichier.includes("u.txt"));
  assert.ok(propre(d));
});

test("la lecture de l'état qui échoue après un changement : code 3 honnête, jamais « rien n'a changé »", () => {
  const d = projetDeuxTaches();
  fs.writeFileSync(path.join(d, ".git", "hooks", "pre-commit"), "#!/bin/sh\nprintf junk > \"$(git rev-parse --git-dir)/index\"\nexit 1\n", { mode: 0o755 });
  const r = lancer(d, "defaire", "T2");
  assert.strictEqual(r.code, 3, r.sortie);
  assert.match(r.premier("etat"), /^(conflit-non-nettoye|echec)$/);
  assert.notStrictEqual(r.premier("etat"), "lecture-impossible");
});

/** Chaque ligne de la sortie est une clé connue ; `raison` tient sur une ligne, sans les conseils de Git. */
function raisonSurUneLigne(r) {
  for (const l of r.sortie.split("\n").filter(Boolean)) assert.match(l, /^[a-z-]+:( |$)/, `ligne hors « clé: valeur » : ${l}`);
  assert.strictEqual((r.cles.raison || []).length, 1, r.sortie);
  assert.doesNotMatch(r.sortie, /hint:/i, r.sortie);
  assert.doesNotMatch(r.sortie, /use "git/i, r.sortie);
  return r.premier("raison");
}

test("raison d'une annulation en conflit : une ligne, la première erreur de Git, sans ses conseils", () => {
  const d = depot();
  ecrire(d, "code.js", "ligne\n");
  ecrire(d, PLAN, plan(["T1", "T2"], "x"));
  valider(d, "chore: départ");
  ecrire(d, "code.js", "ligne T1\n");
  const t1 = valider(d, "feat(T1): premier");
  ecrire(d, "code.js", "ligne T2 avec des s\n");
  valider(d, "feat(T2): second");
  const r = lancer(d, "defaire", "T1");
  assert.strictEqual(r.code, 3, r.sortie);
  const raison = raisonSurUneLigne(r);
  assert.ok(raison.includes(t1.slice(0, 7)), `la ligne d'erreur de Git, qui nomme le commit : ${raison}`);
  assert.doesNotMatch(raison, /CONFLICT|Auto-merging/);
});

test("raison d'un commit refusé par un contrôle bavard : sa première ligne seulement", () => {
  const d = projetDeuxTaches();
  fs.writeFileSync(path.join(d, ".git", "hooks", "pre-commit"), [
    "#!/bin/sh",
    "echo 'contrôle refusé : les tests sont en échec' >&2",
    "echo 'hint: use \"git commit --no-verify\" to skip' >&2",
    "echo '  (use \"git restore <file>...\" to discard)' >&2",
    "echo 'seconde ligne du contrôle' >&2",
    "echo 'sortie standard du contrôle'",
    "exit 1", "",
  ].join("\n"), { mode: 0o755 });
  const r = lancer(d, "defaire", "T2");
  assert.strictEqual(r.code, 3, r.sortie);
  assert.strictEqual(raisonSurUneLigne(r), "contrôle refusé : les tests sont en échec");
});

/** Une suite lancée à la main, arrêtée sur un conflit dont l'étape est ensuite enregistrée par la personne : REVERT_HEAD ou CHERRY_PICK_HEAD parti, la suite reste en cours. */
function suiteArreteePuisEnregistree(d, args) {
  const r = spawnSync("git", args, { cwd: d, encoding: "utf8" });
  assert.notStrictEqual(r.status, 0, "la suite s'arrête sur un conflit");
  ecrire(d, "t2.txt", "résolu à la main\n");
  git(d, "add", "t2.txt");
  git(d, "commit", "-q", "-m", "chore: étape résolue à la main");
  const suite = path.join(d, ".git", "sequencer");
  assert.ok(fs.existsSync(suite));
  assert.ok(!fs.existsSync(path.join(d, ".git", "REVERT_HEAD")) && !fs.existsSync(path.join(d, ".git", "CHERRY_PICK_HEAD")));
  return { head: git(d, "rev-parse", "HEAD"), statut: git(d, "status", "--porcelain"), todo: lire(d, ".git/sequencer/todo") };
}

function rienNaBouge(d, avant) {
  assert.strictEqual(git(d, "rev-parse", "HEAD"), avant.head);
  assert.strictEqual(git(d, "status", "--porcelain"), avant.statut);
  assert.strictEqual(lire(d, ".git/sequencer/todo"), avant.todo, "la suite de la personne est intacte");
}

test("une suite d'annulations en cours (étape en conflit enregistrée) : défaire et récupérer refusés d'avance", () => {
  const d = projetDeuxTaches();
  ecrire(d, "neuf.txt", "neuf\n");
  assert.strictEqual(lancer(d, "mettre-de-cote", "--resume", "neuf").code, 0);
  ecrire(d, "a.txt", "a\n");
  const a = valider(d, "chore: a");
  ecrire(d, "t2.txt", "deux B\n");
  const b = valider(d, "chore: b");
  ecrire(d, "t2.txt", "deux C\n");
  valider(d, "chore: c");
  ecrire(d, "y.txt", "y\n");
  const dd = valider(d, "chore: d");
  const avant = suiteArreteePuisEnregistree(d, ["revert", "--no-edit", dd, b, a]);

  const r = lancer(d, "defaire", "T2");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "operation-en-cours");
  assert.strictEqual(r.premier("operation"), "suite d'annulations");
  rienNaBouge(d, avant);

  const rec = lancer(d, "recuperer", "stash@{0}");
  assert.strictEqual(rec.code, 2, rec.sortie);
  assert.strictEqual(rec.premier("operation"), "suite d'annulations");
  rienNaBouge(d, avant);
  assert.strictEqual(lancer(d, "etat").premier("operation"), "suite d'annulations");
});

test("une suite de reports en cours (étape en conflit enregistrée) : défaire refusé d'avance", () => {
  const d = projetDeuxTaches();
  git(d, "checkout", "-q", "-b", "autre");
  ecrire(d, "t2.txt", "deux B\n");
  const b = valider(d, "chore: b");
  ecrire(d, "y.txt", "y\n");
  const dd = valider(d, "chore: d");
  git(d, "checkout", "-q", "main");
  ecrire(d, "t2.txt", "deux C\n");
  valider(d, "chore: c");
  const avant = suiteArreteePuisEnregistree(d, ["cherry-pick", b, dd]);

  const r = lancer(d, "defaire", "T2");
  assert.strictEqual(r.code, 2, r.sortie);
  assert.strictEqual(r.premier("etat"), "operation-en-cours");
  assert.strictEqual(r.premier("operation"), "suite de reports");
  rienNaBouge(d, avant);
});

test("raisonDe : seules les lignes d'aide de Git sont écartées (hint:, « (use \"git … »), une vraie ligne en « use \"git » reste", () => {
  const { raisonDe } = require(SCRIPT);
  const aide = ["hint: after resolving the conflicts, mark the corrected paths", '  (use "git add <file>..." to mark resolution)', '  (use "git revert --abort" to cancel the revert operation)'];
  assert.strictEqual(raisonDe([...aide, "error: could not revert abc1234... T3"].join("\n"), "repli"), "error: could not revert abc1234... T3");
  assert.strictEqual(raisonDe(aide.join("\n"), "repli"), "repli");
  assert.strictEqual(raisonDe('use "git" introuvable dans le PATH', "repli"), 'use "git" introuvable dans le PATH');
  assert.strictEqual(raisonDe(['  (use "git restore <file>..." to discard)', 'use "git restore" refusé par le contrôle'].join("\n"), "repli"), 'use "git restore" refusé par le contrôle');
});

test("annuler, SKILL : une autre session se met en pause avant defaire (consigne positive, avec le geste)", () => {
  const skill = fs.readFileSync(path.join(__dirname, "..", "skills", "annuler", "SKILL.md"), "utf8");
  assert.doesNotMatch(skill, /aucune autre session ne doit/i);
  const consigne = skill.indexOf("avec `autres-sessions` > 0 : demander à la personne de mettre l'autre session en pause");
  assert.ok(consigne > 0, "consigne de pause absente");
  assert.ok(consigne < skill.indexOf("`pulse-aidd annuler defaire <"), "la pause se demande avant defaire");
});

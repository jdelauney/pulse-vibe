// Tests de la création de projet (pulse-aidd nouveau) et du contrôle des secrets (verifier.js).
// Lancer : node --test plugins/pulse-vibe/tests/*.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const NOUVEAU = path.join(RACINE, "skills", "init", "scripts", "nouveau-projet.js");
const VERIFIER = path.join(RACINE, "templates", "verifier.js");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "pulse-nouveau-"));
const lancer = (script, args, cwd) => spawnSync("node", [script, ...args], { cwd, encoding: "utf8" });
const lire = (d, f) => fs.readFileSync(path.join(d, f), "utf8");
const existe = (d, f) => fs.existsSync(path.join(d, f));

test("crée la structure Pulse, sans aucune technologie, avec la mémoire branchée", () => {
  const parent = tmp();
  const r = lancer(NOUVEAU, ["Mon Été", "--description", "Une todolist.", "--oui", "--sans-git"], parent);
  assert.strictEqual(r.status, 0, r.stderr);
  const d = path.join(parent, "mon-ete");
  for (const f of ["CLAUDE.md", ".gitignore", ".env.example", "README.md", "aidd_docs/memory/glossary.md", "aidd_docs/tasks/.gitkeep"]) {
    assert.ok(existe(d, f), f);
  }
  for (const f of ["netlify.toml", "public", "supabase", "src", "package.json"]) {
    assert.ok(!existe(d, f), `${f} ne doit pas être créé`);
  }
  const claude = lire(d, "CLAUDE.md");
  assert.match(claude, /^# Mon Été\n/);
  assert.match(claude, /\n## Résumé du projet\n\nUne todolist\.\n/);
  assert.match(claude, /Pile non choisie : lancer `\/pulse:tech`/);
  assert.match(claude, /@aidd_docs\/memory\/glossary\.md/);
  assert.doesNotMatch(claude + lire(d, "README.md"), /\{\{NOM_DU_PROJET\}\}|\{\{TESTER_EN_LOCAL\}\}/);
});

test("aucune technologie nommée dans les fichiers créés", () => {
  const parent = tmp();
  lancer(NOUVEAU, ["neutre", "--oui", "--sans-git"], parent);
  const d = path.join(parent, "neutre");
  const tout = ["CLAUDE.md", ".gitignore", ".env.example", "README.md", "aidd_docs/memory/technical.md"].map((f) => lire(d, f)).join("\n");
  assert.doesNotMatch(tout, /Supabase|Netlify|Vercel|Next\.js|React|TypeScript|Tailwind|localStorage|RLS|npm|npx|public\//);
});

test("--ici ne remplace rien et complète le .gitignore existant", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# Mon CLAUDE à moi\n");
  fs.writeFileSync(path.join(d, ".gitignore"), "node_modules/\nperso\n");
  const r = lancer(NOUVEAU, ["--ici", "--oui", "--sans-git"], d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(lire(d, "CLAUDE.md"), "# Mon CLAUDE à moi\n");
  const gi = lire(d, ".gitignore");
  assert.match(gi, /^perso$/m);
  assert.match(gi, /^\.env$/m);
  assert.strictEqual(gi.match(/^node_modules\/$/gm).length, 1);
});

test("refuse un dossier existant non vide, et une option inconnue", () => {
  const parent = tmp();
  fs.mkdirSync(path.join(parent, "pris"));
  fs.writeFileSync(path.join(parent, "pris", "a.txt"), "x");
  assert.strictEqual(lancer(NOUVEAU, ["pris", "--oui"], parent).status, 1);
  assert.strictEqual(lancer(NOUVEAU, ["x", "--profil", "statique", "--oui"], parent).status, 1);
});

test("Git : un nouveau projet a son propre dépôt, même dans un dépôt parent", () => {
  const parent = tmp();
  spawnSync("git", ["init", "-q"], { cwd: parent });
  const r = lancer(NOUVEAU, ["enfant", "--oui"], parent);
  assert.strictEqual(r.status, 0, r.stderr);
  const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: path.join(parent, "enfant"), encoding: "utf8" });
  // Chemins réels : Git donne le nom long, os.tmpdir() peut donner un nom court Windows (RUNNER~1).
  const reel = (p) => fs.realpathSync.native(p).toLowerCase();
  assert.strictEqual(reel(top.stdout.trim()), reel(path.join(parent, "enfant")));
  const index = spawnSync("git", ["diff", "--cached", "--name-only"], { cwd: parent, encoding: "utf8" });
  assert.strictEqual(index.stdout.trim(), "", "le dépôt parent n'a rien reçu");
});

test("verifier.js : générique, réussit sans page d'accueil imposée, échoue avec un secret", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "app.txt"), "rien de secret\n");
  assert.strictEqual(lancer(VERIFIER, [], d).status, 0, "aucune structure imposée");
  const cle = ["sk", "live", "4eC39HqLyjWDarjtT1zdp7dc"].join("_");
  fs.writeFileSync(path.join(d, "config.txt"), `cle=${cle}\n`);
  assert.strictEqual(lancer(VERIFIER, [], d).status, 1, "secret détecté");
});

test("CLAUDE.md créé contient le bloc profil, à compléter par /pulse:init", () => {
  const parent = tmp();
  const r = lancer(NOUVEAU, ["Profil", "--oui", "--sans-git"], parent);
  assert.strictEqual(r.status, 0, r.stderr);
  const claude = lire(path.join(parent, "profil"), "CLAUDE.md");
  assert.match(claude, /<!-- pulse_profil:debut -->\r?\n- \*\*Niveau\*\* : à préciser\r?\n- \*\*Explications\*\* : normales\r?\n<!-- pulse_profil:fin -->/);
});

test("prochaines étapes : les commandes d'installation exactes du catalogue pulseia", () => {
  const parent = tmp();
  const r = lancer(NOUVEAU, ["Installe", "--oui", "--sans-git"], parent);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /claude plugin marketplace add jdelauney\/pulse-vibe\r?\n/);
  assert.match(r.stdout, /claude plugin install pulse@pulseia\r?\n/);
  assert.doesNotMatch(r.stdout, /<compte>|<depot>/);
});

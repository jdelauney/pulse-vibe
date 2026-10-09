// Tests de la reconnaissance des chemins sensibles (fichiers .env, contrôle avant commit).
// Lancer : node --test plugins/pulse-vibe/tests/chemins-sensibles.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { candidats, motifVersRegex, designeEnv, globCouvreEnv, contientEnv, estControleAvantCommit } = require("../scripts/chemins-sensibles");

function dossier(fichiers) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-chemins-"));
  for (const [f, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), contenu);
  }
  return d;
}

test("candidats : valeur d'option, @ et < de curl, référence Git, liste PowerShell", () => {
  for (const [mot, attendu] of [
    ["--env-file=.env", ".env"],
    ["@.env", ".env"],
    ["f=@.env", ".env"],
    ["<.env", ".env"],
    ["HEAD:.env", ".env"],
    [":.env", ".env"],
    ["-Path:.env", ".env"],
    ["a.txt,.env", ".env"],
  ])
    assert.ok(candidats(mot).includes(attendu), mot);
});

test("motifVersRegex : *, ?, [ ], { } ; en bash, * ne couvre pas un nom caché", () => {
  assert.ok(motifVersRegex(".e?v").test(".env"));
  assert.ok(motifVersRegex(".[e]nv").test(".env"));
  assert.ok(motifVersRegex(".[!x]nv").test(".env"));
  assert.ok(motifVersRegex("{.env,x}").test(".env"));
  assert.ok(motifVersRegex("*").test(".env"));
  assert.ok(!motifVersRegex("*", { pointCache: true }).test(".env"));
  assert.ok(motifVersRegex(".*", { pointCache: true }).test(".env"));
  assert.ok(!motifVersRegex("*.ts").test(".env"));
  assert.ok(motifVersRegex("*.{ts,tsx}").test("a.tsx"));
});

test("motifVersRegex : la garde du point caché ne vise que les motifs qui commencent par *, ? ou [", () => {
  assert.ok(motifVersRegex("{.env,x}", { pointCache: true }).test(".env"));
  assert.ok(motifVersRegex(".env*", { pointCache: true }).test(".env.local"));
  assert.ok(!motifVersRegex("?env", { pointCache: true }).test(".env"));
  assert.ok(!motifVersRegex("[.]env", { pointCache: true }).test(".env"));
  const d = dossier({ ".env": "A=1\n" });
  assert.ok(designeEnv("{.env,x}", d), "accolades : .env couvert");
  assert.ok(designeEnv("{.env,x}", dossier({ "a.txt": "" })), "accolades : visé même sans fichier");
});

test("designeEnv : nom, chemin déguisé, motif qui couvre un .env présent", () => {
  const d = dossier({ ".env": "A=1\n", "src/a.ts": "" });
  for (const m of [".env", "./.env/", "@.env", "--env-file=.env", ".e*", ".en?", ".[e]nv", "HEAD:.env", ".env::$DATA", "C:\\p\\.env"]) assert.ok(designeEnv(m, d), m);
  assert.ok(designeEnv("*", d, "powershell"), "PowerShell : * couvre .env");
  for (const m of ["*", "src/*", ".env.example", "*.ts", "README.md", "(^|/)\\.env($|\\.)", "$f", "--exclude"]) assert.ok(!designeEnv(m, d), m);
  const vide = dossier({ "a.txt": "" });
  assert.ok(designeEnv(".env*", vide), "motif qui commence par .env : visé même sans fichier");
  assert.ok(!designeEnv("*", vide, "powershell"));
});

test("globCouvreEnv (outil Grep) : motifs qui couvrent .env ; négations et * seulement là où un .env existe", () => {
  const d = dossier({ ".env": "A=1\n", "app/.env.local": "B=2\n", "src/a.ts": "" });
  for (const g of ["*", ".e?v", ".e*", "{.env,x}", "**/.[e]nv", "!*.js", ".env.local", "**/.env"]) assert.ok(globCouvreEnv(g, d), g);
  for (const g of ["*.ts", "**/*.tsx", "*.{ts,tsx}", ".env.example", "src/**/*.js"]) assert.ok(!globCouvreEnv(g, d), g);
  const vide = dossier({ "src/a.ts": "" });
  for (const g of ["*", "!*.js", "*.ts"]) assert.ok(!globCouvreEnv(g, vide), g);
  assert.ok(globCouvreEnv(".env", vide), "nom littéral : visé même sans fichier");
});

test("contientEnv : sur trois niveaux, hors node_modules", () => {
  assert.ok(contientEnv(dossier({ "a/b/.env": "" })));
  assert.ok(!contientEnv(dossier({ "node_modules/x/.env": "" })));
  assert.ok(!contientEnv(dossier({ "a.txt": "" })));
  assert.ok(!contientEnv(path.join(os.tmpdir(), "pulse-inexistant-" + Date.now())));
});

test("estControleAvantCommit : .git/hooks et scripts/verifier.js", () => {
  for (const p of [".git/hooks/pre-commit", ".git\\hooks\\pre-commit", "scripts/verifier.js", "/p/scripts/verifier.js", "--output=.git/hooks/pre-commit", ".git/hooks"]) assert.ok(estControleAvantCommit(p), p);
  for (const p of ["scripts/autre.js", "src/verifier.js", ".github/hooks/x", "scripts/verifier.json"]) assert.ok(!estControleAvantCommit(p), p);
});

// Tests de la création du squelette (scripts/squelette.js).
// Lancer : node --test plugins/pulse-vibe-next/tests/squelette.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "squelette.js");
const { nomDePaquet } = require(SCRIPT);

const dossierVide = () => fs.mkdtempSync(path.join(os.tmpdir(), "pulse-next-"));
const lancer = (...args) => spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });
const lire = (d, f) => fs.readFileSync(path.join(d, f), "utf8");

test("crée le projet de départ et remplit le nom et la description", () => {
  const d = dossierVide();
  const r = lancer("--nom", 'L\'Atelier "Bois & Co"', "--description", "Réservez un créneau.", "--dossier", d);
  assert.strictEqual(r.status, 0, r.stderr);
  const paquet = JSON.parse(lire(d, "package.json"));
  assert.strictEqual(paquet.name, "l-atelier-bois-co");
  assert.match(lire(d, "src/lib/projet.ts"), /nom: "L'Atelier \\"Bois & Co\\"",/);
  assert.match(lire(d, "src/lib/projet.ts"), /description: "Réservez un créneau\.",/);
  for (const f of ["src/app/layout.tsx", "src/app/page.tsx", "next.config.ts", "biome.json", "vercel.json", "src/components/ui/button.tsx", "src/app/favicon.ico"])
    assert.ok(fs.existsSync(path.join(d, f)), f);
  assert.ok(!fs.existsSync(path.join(d, "gitignore.template")), "les modèles à fusionner ne sont pas copiés tels quels");
});

test("aucun repère {{…}} ne reste dans les fichiers créés", () => {
  const d = dossierVide();
  assert.strictEqual(lancer("--nom", "Essai", "--dossier", d).status, 0);
  const restes = [];
  (function parcourir(dossier) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (!/\.ico$/.test(e.name) && /\{\{[A-Z_]+\}\}/.test(fs.readFileSync(chemin, "utf8"))) restes.push(path.relative(d, chemin));
    }
  })(d);
  assert.deepStrictEqual(restes, []);
});

test("garde les fichiers existants et complète .gitignore et .env.example sans doublon", () => {
  const d = dossierVide();
  fs.writeFileSync(path.join(d, "package.json"), '{ "name": "existant" }\n');
  fs.writeFileSync(path.join(d, ".gitignore"), "node_modules\n.env\n");
  fs.writeFileSync(path.join(d, ".env.example"), "DATABASE_URL=\n");
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# Projet\n");
  const r = lancer("--nom", "Essai", "--dossier", d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Gardés tels quels.*package\.json/);
  assert.strictEqual(lire(d, "package.json"), '{ "name": "existant" }\n');
  assert.strictEqual(lire(d, "CLAUDE.md"), "# Projet\n");
  const gitignore = lire(d, ".gitignore");
  assert.match(gitignore, /^\/\.next\/$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  const env = lire(d, ".env.example");
  assert.strictEqual(env.match(/^DATABASE_URL=/gm).length, 1, "pas de variable en double");
  assert.match(env, /^DATABASE_URL_DIRECT=/m);
  // Deuxième passage : rien ne change.
  assert.strictEqual(lancer("--nom", "Essai", "--dossier", d).status, 0);
  assert.strictEqual(lire(d, ".gitignore"), gitignore);
  assert.strictEqual(lire(d, ".env.example"), env);
});

test("sans nom ou avec une option inconnue : message et code 1", () => {
  assert.strictEqual(lancer("--dossier", dossierVide()).status, 1);
  assert.strictEqual(lancer("--nom", "x", "--inconnue").status, 1);
});

test("nom de paquet : minuscules, sans accent, tirets", () => {
  assert.strictEqual(nomDePaquet("Café Équipe 2"), "cafe-equipe-2");
  assert.strictEqual(nomDePaquet("!!!"), "mon-projet");
});

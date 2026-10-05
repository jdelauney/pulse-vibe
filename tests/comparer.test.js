// Tests de la page de comparaison des variantes (pulse-aidd comparer, /pulse:ui).
// Lancer : node --test plugins/pulse/tests/comparer.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const COMPARER = path.join(__dirname, "..", "scripts", "comparer.js");

function dossier(variantes) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-comparer-"));
  for (const [nom, fichiers] of Object.entries(variantes)) {
    fs.mkdirSync(path.join(d, nom), { recursive: true });
    for (const [f, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(d, nom, f), contenu);
  }
  return d;
}
const lancer = (...args) => spawnSync("node", [COMPARER, ...args], { encoding: "utf8" });
const page = (d) => fs.readFileSync(path.join(d, "comparer.html"), "utf8");
const html = "<!doctype html><title>x</title>";
const variante = (these) => ({ "desktop.html": html, "mobile.html": html, "note.md": `# Variante\n\n**Thèse** : ${these}\n` });

test("trois variantes : chaque thèse, chaque lien, chemins relatifs, ordre naturel", () => {
  const d = dossier({
    "v10-dense": variante("Tableau dense"),
    "v1-liste": variante("Liste aérée"),
    "v2-cartes": variante("Fiches empilées"),
  });
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Page de comparaison : .*comparer\.html/);
  const p = page(d);
  for (const t of ["Tableau dense", "Liste aérée", "Fiches empilées"]) assert.ok(p.includes(t), t);
  for (const v of ["v1-liste", "v2-cartes", "v10-dense"]) {
    assert.ok(p.includes(`href="${v}/desktop.html"`), v);
    assert.ok(p.includes(`href="${v}/mobile.html"`), v);
  }
  assert.ok(p.indexOf("v1-liste") < p.indexOf("v2-cartes") && p.indexOf("v2-cartes") < p.indexOf("v10-dense"), "ordre naturel");
  assert.doesNotMatch(p, /[A-Za-z]:\\|file:\/\//, "aucun chemin absolu");
});

test("variante sans mobile.html : mention claire, pas d'erreur", () => {
  const d = dossier({ "v1-seule": { "desktop.html": html, "note.md": "**Thèse** : Bureau seulement\n" } });
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(page(d), /Pas de version mobile/);
  assert.doesNotMatch(page(d), /v1-seule\/mobile\.html/);
});

test("retenue/ et alternatives/ sont ignorés", () => {
  const d = dossier({ "v1-a": variante("A"), retenue: variante("Choisie"), alternatives: variante("Écartée") });
  lancer(d);
  const p = page(d);
  assert.ok(p.includes("v1-a/desktop.html"));
  assert.doesNotMatch(p, /retenue\/|alternatives\//);
});

test("dossier sans variante : code 1, aucun fichier écrit", () => {
  const d = dossier({ vide: { "note.md": "rien" } });
  const r = lancer(d);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /Aucune variante/);
  assert.ok(!fs.existsSync(path.join(d, "comparer.html")));
});

test("dossier inexistant ou absent : code 1, message clair", () => {
  const r = lancer(path.join(os.tmpdir(), "pulse-comparer-inexistant-" + Date.now()));
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /introuvable/);
  const u = lancer();
  assert.strictEqual(u.status, 1);
  assert.match(u.stderr, /Usage/);
});

test("une thèse contenant du HTML est échappée", () => {
  const d = dossier({ "v1-x": variante('<script>alert("x")</script> & co') });
  lancer(d);
  const p = page(d);
  assert.doesNotMatch(p, /<script>alert/);
  assert.ok(p.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co"));
});

test("planches d'identité : un seul cadre par direction", () => {
  const d = dossier({
    "d1-sobre": { "planche.html": html, "note.md": "**Thèse** : Sobre\n" },
    "d2-vive": { "planche.html": html, "note.md": "**Thèse** : Vive\n" },
  });
  assert.strictEqual(lancer(d).status, 0);
  const p = page(d);
  assert.ok(p.includes('href="d1-sobre/planche.html"') && p.includes('href="d2-vive/planche.html"'));
  assert.doesNotMatch(p, /Pas de version (mobile|desktop)/);
});

test("noms avec espaces et accents : liens encodés", () => {
  const d = dossier({ "v1 épurée": variante("Épurée") });
  lancer(d);
  const p = page(d);
  assert.ok(p.includes('href="v1%20%C3%A9pur%C3%A9e/desktop.html"'));
  assert.ok(p.includes("v1 épurée"), "le nom affiché reste lisible");
});

test("thèse : CRLF, gras et repli sur le titre puis le nom du dossier", () => {
  const d = dossier({
    "v1-crlf": { "desktop.html": html, "note.md": "# Titre\r\n\r\n**Thèse** : Avec CRLF\r\n" },
    "v2-titre": { "desktop.html": html, "note.md": "# Seulement un titre\n" },
    "v3-rien": { "desktop.html": html },
  });
  lancer(d);
  const p = page(d);
  assert.ok(p.includes("Avec CRLF") && !p.includes("Avec CRLF\r"));
  assert.ok(p.includes("Seulement un titre"));
  assert.match(p, /<h2>v3-rien<\/h2>[\s\S]*?<p class="these">v3-rien<\/p>/);
  assert.doesNotMatch(p, /\*\*/);
});

test("relance : comparer.html réécrit à l'identique et jamais pris pour une variante", () => {
  const d = dossier({ "v1-a": variante("A") });
  lancer(d);
  const premiere = page(d);
  const r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(page(d), premiere);
});

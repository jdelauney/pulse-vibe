// Tests des captures des maquettes (skills/ui/scripts/capturer.js) et du navigateur partagé (scripts/navigateur.js).
// Le parcours complet se lance seulement si un navigateur (Chrome, Edge ou Chromium) est présent sur le poste.
// Lancer : node --test plugins/pulse-vibe/tests/capturer.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const MAQUETTES = path.join(__dirname, "..", "skills", "ui", "scripts", "maquettes.js");
const { largeurs, pages } = require(path.join(__dirname, "..", "skills", "ui", "scripts", "capturer.js"));
const { trouverNavigateur } = require(path.join(__dirname, "..", "scripts", "navigateur.js"));

test("largeurs : téléphone à 390 px (débordement mesuré à 320), ordinateur à 1 280 px, autres pages aux deux", () => {
  assert.deepStrictEqual(largeurs("mobile-2.html"), { capturees: [390], mesurees: [320] });
  assert.deepStrictEqual(largeurs("desktop.html"), { capturees: [1280], mesurees: [] });
  assert.deepStrictEqual(largeurs("coquille.html"), { capturees: [390, 1280], mesurees: [320] });
});

test("pages : comparer.html, alternatives/ et captures/ sont écartés", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-capturer-"));
  for (const f of ["v1-a/mobile.html", "v1-a/captures/vieux.html", "alternatives/v0/mobile.html", "comparer.html", "v1-a/note.md"]) {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), "x");
  }
  assert.deepStrictEqual(pages(d).map((p) => path.relative(d, p).split(path.sep).join("/")), ["v1-a/mobile.html"]);
});

test("navigateur : CHROME_PATH passe en premier ; edge: false écarte Edge", () => {
  assert.deepStrictEqual(trouverNavigateur({ env: { CHROME_PATH: "/x/chrome" } }), { chemin: "/x/chrome", origine: "CHROME_PATH" });
  const n = trouverNavigateur({ edge: false });
  if (n) assert.notStrictEqual(n.origine, "Edge");
});

test("capturer : usage et chemin introuvable", () => {
  assert.strictEqual(spawnSync(process.execPath, [MAQUETTES, "capturer"], { encoding: "utf8" }).status, 2);
  assert.strictEqual(spawnSync(process.execPath, [MAQUETTES, "capturer", path.join(os.tmpdir(), "pulse-absent-x")], { encoding: "utf8" }).status, 2);
});

test("capturer : sans navigateur, ❓ et code 3", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-capturer-"));
  fs.writeFileSync(path.join(d, "mobile.html"), "<html lang=\"fr\"></html>");
  const r = spawnSync(process.execPath, [MAQUETTES, "capturer", d], { encoding: "utf8", env: { ...process.env, CHROME_PATH: path.join(d, "absent.exe") } });
  assert.strictEqual(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stdout, /❓/);
});

const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font-family:system-ui}section{min-height:900px}.large{width:500px}.petit{width:30px;height:30px}</style></head>
<body><div data-selecteur-etats><button data-etat="normal">Normal</button><button data-etat="vide">Vide</button></div>
<h1>Mes factures</h1><section id="liste"><div class="large">Tableau</div><button class="petit" aria-label="Filtrer">F</button></section><section>Suite</section>
<script>document.querySelector('[data-etat="vide"]').onclick=()=>{document.getElementById('liste').innerHTML='<p>Aucune facture.</p>'}</script></body></html>`;

test("capturer : captures par hauteur d'écran et par état, débordement et cibles tactiles relevés", { skip: !trouverNavigateur() && "aucun navigateur sur ce poste", timeout: 60000 }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-capturer-"));
  fs.mkdirSync(path.join(d, "v1-essai"));
  fs.writeFileSync(path.join(d, "v1-essai", "mobile.html"), PAGE);
  fs.mkdirSync(path.join(d, "v1-essai", "captures"));
  fs.writeFileSync(path.join(d, "v1-essai", "captures", "mobile-390-9.png"), "ancienne");
  const r = spawnSync(process.execPath, [MAQUETTES, "capturer", d], { encoding: "utf8", timeout: 55000 });
  if (r.status === 3) return; // navigateur présent mais impossible à lancer ici (bac à sable, CI sans affichage) : rien à vérifier
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  const captures = fs.readdirSync(path.join(d, "v1-essai", "captures")).sort();
  assert.ok(captures.includes("mobile-390-1.png") && captures.includes("mobile-390-2.png"), captures.join(", "));
  assert.ok(captures.includes("mobile-390-vide-1.png"), captures.join(", "));
  assert.ok(!captures.includes("mobile-390-9.png"), "les anciennes captures de la page sont retirées");
  assert.match(r.stdout, /🔴 v1-essai\/mobile\.html \(320 px\)\s+La page déborde en largeur[^\n]*div\.large/);
  assert.match(r.stdout, /🟠 v1-essai\/mobile\.html \(390 px\)\s+Cibles tactiles sous 44 × 44 px : 1 \(button\.petit « Filtrer » 30 × 30\)/);
  assert.match(r.stdout, /état vide : v1-essai\/captures\/mobile-390-vide-1\.png/);
});

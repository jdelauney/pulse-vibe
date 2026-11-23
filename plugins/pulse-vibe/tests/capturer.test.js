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
const { largeurs, pages, constatsDeComposition } = require(path.join(__dirname, "..", "skills", "ui", "scripts", "capturer.js"));
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

const AVEC_DEFAUTS = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
body{margin:0;font-family:system-ui;width:1200px}.carte{border:1px solid #ccc;padding:16px;min-height:90px;width:300px}.grande{width:900px}
.sur{font-size:12px;text-transform:uppercase;letter-spacing:0.1em}.g{display:flex;gap:8px}td{text-align:left}</style></head><body>
<p class="sur">Résumé</p><h2>Un</h2><p class="sur">Détail</p><h2>Deux</h2>
<div class="carte grande"><div class="carte">Dedans</div></div>
<div class="g"><div class="carte"><svg width="20" height="20"></svg><h3>A</h3><p>texte</p></div><div class="carte"><svg width="20" height="20"></svg><h3>B</h3><p>texte</p></div><div class="carte"><svg width="20" height="20"></svg><h3>C</h3><p>texte</p></div></div>
<input placeholder="Votre e-mail">
<table><tbody><tr><td>Loyer</td><td>1 250,00 €</td></tr></tbody></table></body></html>`;

const SANS_DEFAUT = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
body{margin:0;font-family:system-ui;width:1200px}.carte{border:1px solid #ccc;padding:16px;min-height:90px;width:300px}
.sur{font-size:12px;text-transform:uppercase;letter-spacing:0.1em}td.n{text-align:right;font-variant-numeric:tabular-nums}</style></head><body>
<p class="sur">Résumé</p><h2>Un</h2><h2>Deux</h2><h2>Trois</h2>
<div class="carte"><label for="m">Votre e-mail</label><input id="m"><input type="search" aria-label="Chercher"></div>
<table><tbody><tr><td>Loyer</td><td class="n">1 250,00 €</td></tr></tbody></table></body></html>`;

test("capturer : règles comptables du rendu, sans fausse alerte sur une page propre", { skip: !trouverNavigateur() && "aucun navigateur sur ce poste", timeout: 60000 }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-capturer-"));
  fs.writeFileSync(path.join(d, "desktop.html"), AVEC_DEFAUTS);
  fs.writeFileSync(path.join(d, "desktop-2.html"), SANS_DEFAUT);
  const r = spawnSync(process.execPath, [MAQUETTES, "capturer", d], { encoding: "utf8", timeout: 55000 });
  if (r.status === 3) return;
  for (const attendu of [
    /🔴 desktop\.html \(1280 px\)\s+Cartes dans des cartes : 1/,
    /🔴 desktop\.html \(1280 px\)\s+Grille de cartes identiques icône \+ titre \+ texte : div\.g[^\n]*\(3 cartes\)/,
    /🔴 desktop\.html \(1280 px\)\s+Champ sans étiquette : 1 \(input \(texte d'exemple seul : « Votre e-mail »\)\)/,
    /🟠 desktop\.html \(1280 px\)\s+Petites étiquettes en capitales au-dessus des titres : 2 pour 2 section\(s\), 1 au plus/,
    /🟢 desktop\.html \(1280 px\)\s+Nombres de tableau non alignés à droite : 1/,
    /🟢 desktop\.html \(1280 px\)\s+Nombres de tableau sans chiffres de même largeur/,
  ])
    assert.match(r.stdout, attendu);
  assert.doesNotMatch(r.stdout, /desktop-2\.html \(/, "page propre : aucun constat");
});

// --- Composition, échelle typographique et tics d'IA du rendu ---

const section = (signature, autres = {}) => ({ signature, colonnes: 1, inegales: false, centre: /centré/.test(signature), titre: true, plein: false, ...autres });

test("composition : seuils de l'échelle selon le registre et la largeur", () => {
  const noms = (r, l) => constatsDeComposition(r, l).map((c) => c.nom);
  assert.match(noms({ registre: "vitrine", typo: { corps: 16, titre: 50 } }, 1280).join("\n"), /Échelle typographique timide : le plus grand titre fait 3,1 fois le texte \(50 px pour 16 px\), 4,5 fois au moins en vitrine/);
  assert.deepStrictEqual(noms({ registre: "vitrine", typo: { corps: 16, titre: 50 } }, 390), [], "2,5 fois sur téléphone");
  assert.deepStrictEqual(noms({ registre: "outil", typo: { corps: 16, titre: 39 } }, 1280), [], "outil : 2 fois");
  assert.match(noms({ registre: "", typo: { corps: 16, titre: 24 } }, 1280).join("\n"), /1,5 fois le texte/);
});

test("composition : sections répétées, tout centré, sans rupture ; vitrine variée sans constat", () => {
  const gabarit = { registre: "vitrine", typo: { corps: 16, titre: 80 }, compositions: [section("1 colonne(s), titre centré"), section("3 colonne(s), titre centré"), section("3 colonne(s), titre centré"), section("3 colonne(s), titre centré")] };
  const noms = constatsDeComposition(gabarit, 1280).map((c) => c.nom).join("\n");
  assert.match(noms, /Sections bâties sur le même modèle : sections 2 à 4 \(3 colonne\(s\), titre centré\)/);
  assert.match(noms, /Tout est centré : 4 titres de section sur 4/);
  assert.match(noms, /Composition sans rupture/);
  assert.deepStrictEqual(constatsDeComposition(gabarit, 390).map((c) => c.nom), [], "sur téléphone, seule l'échelle compte");
  const variee = { registre: "vitrine", typo: { corps: 16, titre: 110 }, compositions: [section("1 colonne(s), titre centré", { plein: true }), section("2 colonne(s)", { inegales: true }), section("1 colonne(s), image"), section("3 colonne(s)")] };
  assert.deepStrictEqual(constatsDeComposition(variee, 1280), []);
  assert.deepStrictEqual(constatsDeComposition({ ...variee, pastille: "span.badge « Nouveau »", iconesCarrees: 3 }, 1280).map((c) => c.nom), ["Pastille au-dessus du titre d'ouverture : span.badge « Nouveau »", "Icônes dans des carrés arrondis colorés, en série : 3"]);
});

const VITRINE_GABARIT = `<!doctype html><html lang="fr" data-registre="vitrine"><head><meta charset="utf-8"><style>
body{margin:0;font:16px/1.5 system-ui}section{min-height:300px;padding:40px;text-align:center}h1{font-size:40px}h2{font-size:28px}
.g{display:flex;gap:16px}.g>div{width:300px}.pastille{display:inline-block;height:28px;padding:0 12px;border-radius:14px;background:oklch(0.9 0.05 290)}
.ic{width:48px;height:48px;border-radius:12px;background:oklch(0.9 0.05 290);display:grid;place-items:center}</style></head><body><main>
<section><span class="pastille">Nouveau</span><h1>Gérez vos prêts</h1><p>Un outil simple pour suivre les livres prêtés, les retours et les rappels de la bibliothèque.</p></section>
<section><h2>Un</h2><div class="g"><div><div class="ic"><svg width="20" height="20"></svg></div><p>Texte</p></div><div><div class="ic"><svg width="20" height="20"></svg></div><p>Texte</p></div><div><div class="ic"><svg width="20" height="20"></svg></div><p>Texte</p></div></div></section>
<section><h2>Deux</h2><div class="g"><div>a</div><div>b</div><div>c</div></div></section>
<section><h2>Trois</h2><div class="g"><div>a</div><div>b</div><div>c</div></div></section>
</main></body></html>`;

test("capturer : vitrine en gabarit relevée dans le rendu", { skip: !trouverNavigateur() && "aucun navigateur sur ce poste", timeout: 60000 }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-capturer-"));
  fs.writeFileSync(path.join(d, "desktop.html"), VITRINE_GABARIT);
  const r = spawnSync(process.execPath, [MAQUETTES, "capturer", d], { encoding: "utf8", timeout: 55000 });
  if (r.status === 3) return;
  for (const attendu of [
    /🟠 desktop\.html \(1280 px\)\s+Échelle typographique timide : le plus grand titre fait 2,5 fois le texte/,
    /🟠 desktop\.html \(1280 px\)\s+Sections bâties sur le même modèle : sections 2 à 4/,
    /🟠 desktop\.html \(1280 px\)\s+Tout est centré : 4 titres de section sur 4/,
    /🟠 desktop\.html \(1280 px\)\s+Composition sans rupture/,
    /🟠 desktop\.html \(1280 px\)\s+Pastille au-dessus du titre d'ouverture : span\.pastille « Nouveau »/,
    /🟠 desktop\.html \(1280 px\)\s+Icônes dans des carrés arrondis colorés, en série : 3/,
  ])
    assert.match(r.stdout, attendu);
});

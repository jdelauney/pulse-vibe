// Tests du brandkit d'une identité (skills/ui/scripts/brandkit.js, pulse-aidd brandkit).
// Lancer : node --test plugins/pulse-vibe/tests/brandkit.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const UI = path.join(__dirname, "..", "skills", "ui");
const SCRIPT = path.join(UI, "scripts", "brandkit.js");
const MODELE = path.join(UI, "assets", "brandkit.json");
const { analyser, planche, css, resume, versOklch, ROLES, PAIRES } = require(SCRIPT);
const { verifier } = require(path.join(UI, "scripts", "maquettes.js"));

const exemple = () => JSON.parse(fs.readFileSync(MODELE, "utf8"));
const rouges = (bk) => analyser(bk).constats.filter((c) => c.gravite === "🔴").map((c) => c.message);
const lancer = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
const dossier = (bk) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-brandkit-"));
  fs.writeFileSync(path.join(d, "brandkit.json"), typeof bk === "string" ? bk : JSON.stringify(bk));
  return d;
};

test("le modèle livré est conforme : aucun constat", () => {
  assert.deepStrictEqual(analyser(exemple()).constats, []);
});

test("chaque paire mesurée cite des rôles connus", () => {
  for (const [a, f] of PAIRES) assert.ok(a in ROLES && f in ROLES, `${a} / ${f}`);
});

test("couleur hors OKLCH : bloquante, avec sa conversion proposée", () => {
  const bk = exemple();
  bk.teintes[1].nuances["700"] = "#005adc";
  const m = rouges(bk).join("\n");
  assert.match(m, /sarcelle-700 : « #005adc » s'écrit en oklch\(L C H\) : oklch\(0\.51 0\.212 260\.3\)/);
  assert.strictEqual(versOklch("rgb(0 90 220)"), "oklch(0.51 0.212 260.3)");
  assert.strictEqual(versOklch("n'importe quoi"), null);
});

test("contraste insuffisant : bloquant, avec la luminosité qui atteint le seuil", () => {
  const bk = exemple();
  bk.roles["texte-secondaire"] = "papier-500";
  bk.teintes[0].nuances["500"] = "oklch(0.68 0.015 85)";
  const m = rouges(bk).join("\n");
  assert.match(m, /contraste texte-secondaire sur fond : \d,\d+:1 pour 4,5:1 requis ; papier-500 à oklch\([\d.]+ 0\.015 85\) l'atteint/);
});

test("schéma : rôle, nuance, niveau, contenu ou cible manquants sont bloquants", () => {
  const bk = exemple();
  delete bk.roles.focus;
  bk.roles.accent = "sarcelle-600";
  delete bk.teintes[2].nuances["300"];
  bk.typographie.niveaux = bk.typographie.niveaux.filter((n) => n.id !== "petit");
  delete bk.contenus.vide.action;
  bk.formes.cible = 40;
  bk.espacements = [4, 8, 16];
  const m = rouges(bk).join("\n");
  for (const attendu of ["rôle « focus » manquant", "« sarcelle-600 » n'est pas une nuance", "teinte mousse : nuance 300 manquante", "niveau « petit »", "contenus.vide.action manque", "formes.cible", "« espacements » : 8 valeurs"])
    assert.ok(m.includes(attendu), attendu);
});

test("ombre en hexadécimal, police réflexe et luminosité qui remonte sont relevées", () => {
  const bk = exemple();
  bk.ombres.legere = "0 1px 2px #0003";
  bk.typographie.polices.titre.famille = "Inter";
  bk.teintes[0].nuances["700"] = "oklch(0.7 0.015 85)";
  const { constats } = analyser(bk);
  assert.ok(constats.some((c) => c.gravite === "🔴" && c.message.includes("ombres.legere")));
  assert.ok(constats.some((c) => c.gravite === "🟠" && c.message.includes("police réflexe")));
  assert.ok(constats.some((c) => c.gravite === "🟠" && c.message.includes("la luminosité doit baisser de 500 à 700")));
});

test("planche : modèle commun rempli, hexadécimal et OKLCH affichés, sans anti-pattern détectable", () => {
  const bk = exemple();
  const html = planche(bk, analyser(bk));
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/, "tous les emplacements remplis");
  for (const id of ["nuances", "roles", "typo", "espaces", "boutons", "champs", "messages"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes("<code>oklch(0.45 0.075 200)</code>") && /<code>#[0-9a-f]{6}<\/code>/.test(html));
  assert.ok(html.includes("btn-destructif est-actif") && html.includes('aria-invalid="true"') && html.includes('class="vide"'));
  assert.ok(html.includes("fonts.googleapis.com/css2?family=Literata:wght@600;700&family=Figtree:wght@400;600;700"));
  assert.deepStrictEqual(verifier(html), []);
});

test("css et resume : variables en OKLCH, rôles qui citent les nuances, sections 6 à 8", () => {
  const bk = exemple();
  const a = analyser(bk);
  const c = css(bk, a);
  assert.match(c, /--sarcelle-700: oklch\(0\.45 0\.075 200\);/);
  assert.match(c, /--accent: var\(--sarcelle-700\);/);
  assert.match(c, /--lien: var\(--sarcelle-700\);/, "lien : l'accent par défaut");
  assert.match(c, /--rayon-bouton: var\(--rayon-controle\);/);
  assert.doesNotMatch(c.replace(/<link[^>]*>/g, ""), /#[0-9a-f]{3,8}\b/i, "aucun hexadécimal dans le CSS");
  const r = resume(bk, a);
  for (const t of ["## 6. Couleur", "## 7. Typographie", "## 8. Espacement, arrondis, ombres", "| `--accent` | `var(--sarcelle-700)` |"]) assert.ok(r.includes(t), t);
});

test("ligne de commande : planche écrite seulement sans 🔴 ; usage et fichier introuvable : code 2", () => {
  const bon = dossier(exemple());
  const r = lancer("planche", bon);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Planche : .*planche\.html/);
  assert.ok(fs.existsSync(path.join(bon, "planche.html")));

  const bk = exemple();
  bk.roles.texte = "papier-300";
  const mauvais = dossier(bk);
  const m = lancer("planche", mauvais);
  assert.strictEqual(m.status, 1);
  assert.match(m.stdout, /🔴 contraste texte sur fond/);
  assert.ok(!fs.existsSync(path.join(mauvais, "planche.html")), "rien n'est écrit");

  assert.strictEqual(lancer("planche", dossier("{ pas du json")).status, 1);
  assert.strictEqual(lancer("verifier", path.join(os.tmpdir(), "absent-" + Date.now())).status, 2);
  assert.strictEqual(lancer("inconnu").status, 2);
  assert.strictEqual(lancer("planche").status, 2);
  const o = lancer("oklch", "#005adc");
  assert.strictEqual(o.status, 0);
  assert.match(o.stdout, /^oklch\(0\.51 0\.212 260\.3\)/);
});

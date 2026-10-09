// Tests du rapport de contraste WCAG (scripts/contraste.js, pulse-aidd contraste).
// Lancer : node --test plugins/pulse-vibe/tests/contraste.test.js (nécessite bash dans le PATH)
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const { lireCouleur, poser, rapport, analyser, tronquer } = require(path.join(RACINE, "scripts", "contraste.js"));
const mesure = (a, b) => rapport(lireCouleur(a), lireCouleur(b));
const lancer = (...args) => spawnSync("bash", ["bin/pulse-aidd", "contraste", ...args], { cwd: RACINE, encoding: "utf8" });

test("valeurs de référence WCAG : noir sur blanc 21:1, #767676 sur blanc 4,54:1", () => {
  assert.strictEqual(tronquer(mesure("#000000", "#ffffff")), 21);
  assert.strictEqual(tronquer(mesure("#767676", "#ffffff")), 4.54);
  assert.strictEqual(tronquer(mesure("#777777", "#ffffff")), 4.47, "juste sous 4,5:1");
  assert.strictEqual(mesure("#000", "#fff"), mesure("#fff", "#000"), "l'ordre des couleurs ne change rien");
});

test("OKLCH : les gris du squelette shadcn", () => {
  assert.strictEqual(tronquer(mesure("oklch(0.708 0 0)", "#ffffff")), 2.59, "ancien --ring, sous 3:1");
  assert.strictEqual(tronquer(mesure("oklch(0.922 0 0)", "oklch(1 0 0)")), 1.25, "ancien --input");
  assert.strictEqual(tronquer(mesure("oklch(0.556 0 0)", "oklch(1 0 0)")), 4.73, "--muted-foreground");
  assert.strictEqual(tronquer(mesure("oklch(0.65 0 0)", "oklch(1 0 0)")), 3.23, "--input du squelette");
  assert.strictEqual(tronquer(mesure("oklch(100% 0 0)", "oklch(1 0 0)")), 1, "luminosité en pourcentage");
});

test("hexadécimal, rgb() et oklch() d'une même couleur donnent le même rapport", () => {
  const hex = mesure("#336699", "#ffffff");
  assert.strictEqual(mesure("rgb(51 102 153)", "#ffffff"), hex);
  assert.strictEqual(mesure("rgb(51, 102, 153)", "#fff"), hex);
  assert.ok(Math.abs(mesure("oklch(0.5 0.2 250)", "#fff") - mesure("oklch(0.5 0.2 250deg)", "#fff")) < 1e-12, "unité deg acceptée");
});

test("transparence : la première couleur est posée sur le fond", () => {
  const vue = poser(lireCouleur("oklch(0.205 0 0 / 50%)"), lireCouleur("oklch(1 0 0)"));
  assert.strictEqual(vue.alpha, 1);
  assert.ok(tronquer(rapport(vue, lireCouleur("oklch(1 0 0)"))) >= 3, "halo ring-ring/50 du squelette à 3:1 au moins");
  assert.throws(() => mesure("#000000", "rgb(255 255 255 / 50%)"), /fond doit être opaque/);
});

test("--viser : la luminosité OKLCH la plus proche qui atteint le seuil", () => {
  const r = analyser("oklch(0.922 0 0)", "oklch(1 0 0)", 3);
  assert.strictEqual(r.proposition.valeur, "oklch(0.669 0 0)");
  assert.ok(r.proposition.rapport >= 3);
  assert.throws(() => analyser("#cccccc", "#ffffff", 3), /oklch/);
});

test("pulse-aidd contraste : rapport, seuils et code 0 ; couleur illisible : message et code 1", () => {
  const r = lancer("#767676", "#ffffff");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Contraste : 4\.54:1/m);
  assert.match(r.stdout, /✅ 4\.5:1 – texte courant/);
  assert.match(r.stdout, /❌ 7:1 – texte courant renforcé/);
  const json = JSON.parse(lancer("oklch(0.708 0 0)", "#ffffff", "--json").stdout);
  assert.strictEqual(json.rapport, 2.59);
  assert.strictEqual(json.seuils.find((s) => s.rapport === 3).atteint, false);
  const mauvais = lancer("bleu", "#ffffff");
  assert.strictEqual(mauvais.status, 1);
  assert.match(mauvais.stdout, /couleur illisible/);
  assert.match(lancer().stdout, /Usage : pulse-aidd contraste/);
});

test("l'aide de pulse-aidd cite contraste", () => {
  const r = spawnSync("bash", ["bin/pulse-aidd"], { cwd: RACINE, encoding: "utf8" });
  assert.match(r.stdout, /pulse-aidd contraste <couleur> <fond>/);
});

test("--viser : valeur absente, illisible ou trop basse = message en français, code 1", () => {
  for (const args of [["#000", "#fff", "--viser"], ["#000", "#fff", "--viser", "abc"], ["#000", "#fff", "--viser", "0"], ["#000", "#fff", "--viser", "-3"], ["#000", "#fff", "--viser", "1"]]) {
    const r = lancer(...args);
    assert.strictEqual(r.status, 1, args.join(" "));
    assert.match(r.stdout, /--viser attend un rapport supérieur à 1, par exemple --viser 4.5/);
    assert.strictEqual(r.stderr, "");
  }
});

test("angle en turn, rad ou grad : message nommant la couleur, degrés seuls acceptés", () => {
  for (const u of ["0.5turn", "1rad", "100grad"]) {
    const r = lancer(`oklch(0.5 0.1 ${u})`, "#fff");
    assert.strictEqual(r.status, 1);
    assert.match(r.stdout, /oklch\(0\.5 0\.1 .*\).*degrés/);
  }
});

test("couleur OKLCH hors de la gamme sRGB : avertissement et indicateur JSON", () => {
  const r = lancer("oklch(0.7 0.4 150)", "#ffffff");
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /⚠️ couleur hors de la gamme sRGB : l'écran l'affiche plus terne ; mesure faite sur la couleur affichée/);
  assert.strictEqual(JSON.parse(lancer("oklch(0.7 0.4 150)", "#ffffff", "--json").stdout).horsGamme, true);
  const ok = lancer("oklch(0.556 0 0)", "#ffffff");
  assert.doesNotMatch(ok.stdout, /hors de la gamme/);
  assert.strictEqual(JSON.parse(lancer("oklch(0.556 0 0)", "#ffffff", "--json").stdout).horsGamme, undefined);
});

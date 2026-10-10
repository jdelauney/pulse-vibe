// Le wiki (le site de docs/, publié par GitHub Pages depuis la branche main) suit les commandes du cœur et respecte sa
// charte (outils/wiki/CHARTE.md).
// Lancer : node --test plugins/pulse-vibe/tests/wiki.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { jargon } = require("./jargon");

const RACINE = path.join(__dirname, "..");
const DEPOT = path.join(RACINE, "..", "..");
const WIKI = path.join(DEPOT, "docs");
const OUTIL = path.join(DEPOT, "outils", "wiki", "synchroniser.js");

// Ce test n'a de sens que dans le dépôt (le cœur peut être installé seul, hors du dépôt).
const DANS_LE_DEPOT = fs.existsSync(path.join(DEPOT, ".claude-plugin", "marketplace.json")) && fs.existsSync(OUTIL);
const options = { skip: !DANS_LE_DEPOT && "hors du dépôt des plugins" };

const lire = (f) => fs.readFileSync(f, "utf8");
const relatif = (f) => path.relative(WIKI, f).split(path.sep).join("/");

function fichiers(dossier, extension) {
  if (!fs.existsSync(dossier)) return [];
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = path.join(dossier, e.name);
    // docs/superpowers/ : notes de travail locales, hors du site.
    if (e.isDirectory()) return e.name === "superpowers" ? [] : fichiers(chemin, extension);
    return e.name.endsWith(extension) ? [chemin] : [];
  });
}

const PAGES = DANS_LE_DEPOT ? fichiers(WIKI, ".html") : [];
const SKILLS = fs.readdirSync(path.join(RACINE, "skills")).filter((s) => fs.existsSync(path.join(RACINE, "skills", s, "SKILL.md")));
const SECTIONS = ["description", "pourquoi", "quand", "arguments", "produit", "risques", "problemes", "exemples", "liees"];

// Texte visible d'une page : sans scripts, styles, dessins, commentaires, code, ni termes définis (<dfn>).
function texteVisible(html) {
  return html
    .replace(/<(script|style|svg|code|pre|dfn|title)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
}

test("wiki : synchronisé avec les SKILL.md (node outils/wiki/synchroniser.js)", options, () => {
  const r = spawnSync(process.execPath, [OUTIL, "--verifier"], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
});

test("wiki : une page par commande du cœur, chacune avec les sections du gabarit, aucune page orpheline", options, () => {
  const problemes = [];
  for (const nom of SKILLS) {
    const page = path.join(WIKI, "commandes", `${nom}.html`);
    if (!fs.existsSync(page)) { problemes.push(`page manquante : commandes/${nom}.html`); continue; }
    const html = lire(page);
    if (!html.includes(`data-commande="${nom}"`)) problemes.push(`commandes/${nom}.html : data-commande="${nom}" absent`);
    for (const id of SECTIONS) if (!html.includes(`<section id="${id}">`)) problemes.push(`commandes/${nom}.html : section ${id} absente`);
  }
  for (const f of fs.readdirSync(path.join(WIKI, "commandes"))) {
    const nom = f.replace(/\.html$/, "");
    if (f.endsWith(".html") && nom !== "index" && !SKILLS.includes(nom)) problemes.push(`page orpheline : commandes/${f}`);
  }
  assert.deepStrictEqual(problemes, []);
});

test("wiki : chaque lien et chaque ressource locale existent, sans chemin absolu (publication dans un sous-dossier)", options, () => {
  const problemes = [];
  for (const page of PAGES) {
    for (const m of lire(page).matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      const cible = m[1];
      if (/^(https?:|mailto:|#|data:)/.test(cible)) continue;
      if (cible.startsWith("/")) { problemes.push(`${relatif(page)} : chemin absolu ${cible}`); continue; }
      const fichier = path.join(path.dirname(page), cible.split(/[?#]/)[0]);
      if (!fs.existsSync(fichier)) problemes.push(`${relatif(page)} : ${cible} introuvable`);
    }
  }
  // Pages de la navigation principale, déclarées dans l'outil de synchronisation.
  const { NAVIGATION } = require(OUTIL);
  for (const p of NAVIGATION) if (!fs.existsSync(path.join(WIKI, p.href))) problemes.push(`navigation : ${p.href} introuvable`);
  assert.deepStrictEqual(problemes, []);
});

test("wiki : texte visible sans jargon (hors code, termes définis avec <dfn> et lexique)", options, () => {
  const problemes = [];
  for (const page of PAGES.filter((p) => !p.endsWith("lexique.html"))) {
    const j = jargon(texteVisible(lire(page)));
    if (j) problemes.push(`${relatif(page)} : ${j[0]}`);
  }
  assert.deepStrictEqual(problemes, []);
});

test("wiki : charte – pas de vert, couleurs par variables, graisses retenues, un seul CTA à flamme par page", options, () => {
  const problemes = [];
  const sources = [...PAGES, ...fichiers(WIKI, ".css"), ...fichiers(WIKI, ".js")];
  for (const f of sources) {
    const m = /\b(green|emerald|lime)\b/i.exec(lire(f));
    if (m) problemes.push(`${relatif(f)} : ${m[0]} (Règle du Vert Absent)`);
  }
  for (const page of PAGES) {
    const html = lire(page);
    for (const m of html.matchAll(/style="([^"]*)"/g)) {
      if (/#[0-9a-f]{3,8}\b|rgb|hsl|oklch/i.test(m[1])) problemes.push(`${relatif(page)} : couleur écrite dans style="${m[1]}"`);
    }
    const ctas = (html.match(/class="cta\b/g) || []).length;
    if (ctas > 1) problemes.push(`${relatif(page)} : ${ctas} CTA à flamme (Règle du CTA Unique)`);
  }
  for (const f of fichiers(WIKI, ".css")) {
    const css = lire(f).replace(/@font-face\s*\{[^}]*\}/g, "");
    for (const m of css.matchAll(/font-weight:\s*(\d+)|font:\s*(\d{3})\s/g)) {
      const graisse = m[1] || m[2];
      if (!["400", "500", "600", "700", "900"].includes(graisse)) problemes.push(`${relatif(f)} : graisse ${graisse}`);
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("wiki : publié tel quel par GitHub Pages depuis docs/ (accueil index.html, sans traitement Jekyll)", options, () => {
  assert.ok(fs.existsSync(path.join(WIKI, "index.html")), "docs/index.html");
  assert.ok(fs.existsSync(path.join(WIKI, ".nojekyll")), "docs/.nojekyll");
  // Les outils, la charte et le modèle de page restent hors du site publié.
  for (const f of ["synchroniser.js", "CHARTE.md", "modele-commande.html"]) assert.ok(fs.existsSync(path.join(DEPOT, "outils", "wiki", f)), `outils/wiki/${f}`);
});

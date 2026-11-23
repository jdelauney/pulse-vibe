// Tests du contrôle des anti-patterns détectables dans les maquettes (skills/ui/scripts/maquettes.js).
// Lancer : node --test plugins/pulse-vibe/tests/maquettes.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "skills", "ui", "scripts", "maquettes.js");
const DESIGN = path.join(__dirname, "..", "skills", "ui", "references");
const { verifier, CONSTATS, policesReflexes } = require(SCRIPT);

const STYLE_PROPRE = [
  ":root { --fond: oklch(0.98 0.01 80); --texte: oklch(0.2 0.01 80); --police-titre: \"Literata\", serif; }",
  "body { background: var(--fond); color: var(--texte); }",
  "h1 { font-family: var(--police-titre); }",
  "a:focus-visible, button:focus-visible { outline: 2px solid var(--texte); outline-offset: 2px; }",
  "button:active { transform: scale(0.98); }",
  ".b { transition: opacity 150ms cubic-bezier(0.25, 1, 0.5, 1); }",
  "@media (prefers-reduced-motion: reduce) { .b { transition: none; } }",
  ".x::before { content: \"—\"; }",
].join("\n");
const CORPS_PROPRE = "<h1>Factures de mars</h1>\n<button aria-label=\"Fermer\"><svg aria-hidden=\"true\"></svg></button>\n<p>3 factures à régler © Pulse</p>";
const page = ({ style = STYLE_PROPRE, corps = CORPS_PROPRE, html = "<html lang=\"fr\" data-registre=\"outil\">" } = {}) =>
  `<!doctype html>\n${html}\n<head>\n<style>\n${style}\n</style>\n</head>\n<body>\n${corps}\n</body>\n</html>\n`;
const ids = (h) => verifier(h).map((c) => c.id);

test("page propre : aucun constat", () => {
  assert.deepStrictEqual(verifier(page()), []);
});

test("chaque anti-pattern détectable est relevé, avec sa gravité", () => {
  const cas = {
    degrade: page({ style: STYLE_PROPRE + "\nh1 { background-clip: text; -webkit-background-clip: text; }" }),
    verre: page({ style: STYLE_PROPRE + "\n.panneau { backdrop-filter: blur(12px); }" }),
    lisere: page({ style: STYLE_PROPRE + "\n.carte { border-left: 4px solid var(--texte); }" }),
    focus: page({ style: STYLE_PROPRE.replace(/^a:focus-visible.*$/m, "") }),
    langue: page({ html: "<html data-registre=\"outil\">" }),
    police: page({ style: STYLE_PROPRE + "\nh2 { font-family: \"Fraunces\", serif; }" }),
    couleur: page({ style: STYLE_PROPRE + "\n.alerte { color: #d33; }" }),
    oklch: page({ style: STYLE_PROPRE.replace("--texte: oklch(0.2 0.01 80)", "--texte: #2b2620") }),
    remplissage: page({ corps: CORPS_PROPRE + "\n<p>Lorem ipsum dolor sit amet</p>" }),
    rebond: page({ style: STYLE_PROPRE + "\n.c { transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1); }" }),
    animations: page({ style: STYLE_PROPRE.replace(/^@media \(prefers-reduced-motion.*$/m, "") }),
    tiret: page({ corps: CORPS_PROPRE + "\n<p>Simple — et rapide</p>" }),
    emoji: page({ corps: CORPS_PROPRE + "\n<button>🚀 Lancer</button>" }),
    icone: page({ corps: CORPS_PROPRE + "\n<button><svg viewBox=\"0 0 24 24\"></svg></button>" }),
    registre: page({ html: "<html lang=\"fr\">" }),
    violet: page({ style: STYLE_PROPRE + "\n:root { --marque: oklch(0.55 0.22 295); }\n.ouverture { background: linear-gradient(135deg, var(--texte), var(--marque)); }" }),
    halo: page({ style: STYLE_PROPRE + "\n.tache { filter: blur(80px); }" }),
    generique: page({ corps: CORPS_PROPRE + "\n<h2>Pourquoi nous choisir ?</h2>" }),
    immobile: page({ html: "<html lang=\"fr\" data-registre=\"vitrine\">" }),
    tout: page({ style: STYLE_PROPRE + "\n.carte { transition: all 200ms ease-out; }" }),
    etoiles: page({ corps: CORPS_PROPRE + "\n<p>★★★★★ Très bien</p>" }),
    presse: page({ style: STYLE_PROPRE.replace(/^button:active.*$/m, "") }),
  };
  assert.deepStrictEqual(Object.keys(cas).sort(), CONSTATS.map((c) => c.id).sort(), "un cas par constat");
  for (const [id, h] of Object.entries(cas)) assert.deepStrictEqual(ids(h), [id], id);
  const gravite = (id) => CONSTATS.find((c) => c.id === id).gravite;
  for (const id of ["degrade", "verre", "lisere", "focus", "langue"]) assert.strictEqual(gravite(id), "🔴", id);
  for (const id of ["police", "couleur", "oklch", "remplissage", "rebond", "animations", "registre", "violet", "halo", "generique", "immobile"]) assert.strictEqual(gravite(id), "🟠", id);
  for (const id of ["tiret", "emoji", "icone", "tout", "etoiles", "presse"]) assert.strictEqual(gravite(id), "🟢", id);
});

test("dégradés : violet relevé, en hexadécimal comme en OKLCH ; dégradé de la marque dans une autre teinte sans constat", () => {
  assert.deepStrictEqual(ids(page({ style: STYLE_PROPRE + "\n.b2 { background: linear-gradient(90deg, #6366f1, #a855f7); }" })), ["couleur", "violet"]);
  assert.deepStrictEqual(ids(page({ style: STYLE_PROPRE + "\n:root { --ocre: oklch(0.6 0.12 60); }\n.b2 { background: linear-gradient(var(--fond), var(--ocre)); }" })), []);
  assert.deepStrictEqual(ids(page({ style: STYLE_PROPRE + "\n:root { --ciel: oklch(0.62 0.15 240); }\n.b2 { background: linear-gradient(var(--fond), var(--ciel)); }" })), [], "bleu seul : hors de la plage violette");
});

test("vitrine qui bouge, titre propre au projet, petit flou : sans constat", () => {
  const vitrine = page({ html: "<html lang=\"fr\" data-registre=\"vitrine\">", style: STYLE_PROPRE + "\n@keyframes arrivee { from { transform: translateY(1.5rem); } }\n.ombre-douce { filter: blur(4px); }" });
  assert.deepStrictEqual(ids(vitrine), []);
  assert.deepStrictEqual(ids(page({ corps: CORPS_PROPRE + "\n<h2>Nos services de prêt, du lundi au samedi</h2>\n<h2>Comment rendre un livre en retard</h2>" })), ["generique"], "« Nos services » en tête de titre");
  const titres = require(SCRIPT).titresGeneriques();
  assert.ok(titres.includes("pourquoi nous choisir") && titres.includes("nos services"), titres.join(", "));
});

test("numéro de ligne exact ; variable de police de titre réflexe relevée", () => {
  const h = page({ style: STYLE_PROPRE + "\n.alerte { color: #d33; }" });
  const ligne = h.split("\n").findIndex((l) => l.includes("#d33")) + 1;
  assert.strictEqual(verifier(h)[0].ligne, ligne);
  assert.deepStrictEqual(ids(page({ style: STYLE_PROPRE.replace("\"Literata\"", "\"Inter\"") })), ["police"]);
});

test("chaque constat renvoie à une règle qui existe, polices réflexes lues dans regles-ui.md", () => {
  for (const c of CONSTATS) assert.ok(fs.readFileSync(path.join(DESIGN, c.source), "utf8").includes(c.cle), `${c.id} : « ${c.cle} » dans ${c.source}`);
  const p = policesReflexes();
  assert.ok(p.includes("Inter") && p.includes("Fraunces") && p.includes("Space Grotesk"), p.join(", "));
});

test("ligne de commande : dossier parcouru (comparer.html et alternatives/ ignorés), code 1 sur un 🔴", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-maquettes-"));
  fs.mkdirSync(path.join(d, "v1-sobre"));
  fs.mkdirSync(path.join(d, "alternatives"));
  fs.writeFileSync(path.join(d, "v1-sobre", "desktop.html"), page());
  fs.writeFileSync(path.join(d, "comparer.html"), page({ html: "<html>" }));
  fs.writeFileSync(path.join(d, "alternatives", "desktop.html"), page({ html: "<html>" }));
  const propre = spawnSync(process.execPath, [SCRIPT, "verifier", d], { encoding: "utf8" });
  assert.strictEqual(propre.status, 0, propre.stdout);
  fs.writeFileSync(path.join(d, "v1-sobre", "mobile.html"), page({ html: "<html>" }));
  const r = spawnSync(process.execPath, [SCRIPT, "verifier", d], { encoding: "utf8" });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /🔴 v1-sobre\/mobile\.html:2\s+Langue de la page non déclarée/);
  assert.strictEqual(spawnSync(process.execPath, [SCRIPT, "verifier", path.join(d, "absent")]).status, 2);
});

test("revue : commentaires CSS, pseudo-classes devant un id, liseré neutre ou de citation sans constat", () => {
  for (const ajout of [
    "/* Accent : #c47a2c, essai précédent */",
    ".t:hover #fab { color: var(--texte); }",
    "blockquote { border-left: 4px solid var(--texte); }",
    ".carte { border-left: 4px solid transparent; }",
    "nav [aria-current=\"page\"] { border-left: 3px solid var(--texte); }",
  ]) assert.deepStrictEqual(ids(page({ style: STYLE_PROPRE + "\n" + ajout })), [], ajout);
});

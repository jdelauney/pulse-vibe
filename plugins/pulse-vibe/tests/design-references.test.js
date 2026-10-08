// Garde des références de design de /pulse:ui : valeurs clés présentes, format des anti-patterns.
// Lancer : node --test plugins/pulse-vibe/tests/design-references.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const D = path.join(__dirname, "..", "references", "design");
const lire = (f) => fs.readFileSync(path.join(D, f), "utf8");

test("règles d'interface : valeurs chiffrées de couleur, typographie, espacement, mouvement, accessibilité", () => {
  const t = lire("regles-ui.md");
  for (const attendu of ["Cinq nuances", "0,005", "1,333", "1,5 à 1,6", "rem", "1 280 px", "320, 390, 768, 1 280 et 1 920 px", "120 à 150 ms", "300 ms à l'entrée", "50 à 60 ms", "WCAG 2.2", "18,66 px", "3:1", ":focus-visible", "aria-current", "soulignement décalé", "ne répète pas le titre"])
    assert.ok(t.includes(attendu), attendu);
  assert.ok(!/ease-out-back|rebond permis/i.test(t), "jamais de rebond");
});

test("anti-patterns : 4 colonnes, une gravité, les six nouveaux motifs et le tableau par secteur", () => {
  const t = lire("anti-patterns.md");
  const motifs = t.split("\n").filter((l) => /^\| /.test(l) && /🔴|🟠|🟢/.test(l));
  for (const l of motifs) assert.strictEqual(l.split("|").length - 2, 4, l);
  for (const attendu of ["Ombres fortes partout", "Texte courant en majuscules", "Champs en pleine largeur", "Icônes génériques", "Introduction qui répète le titre", "Liens bleus par défaut", "| Secteur |"])
    assert.ok(t.includes(attendu), attendu);
});

test("registres : ce que chaque registre écarte, et renvoi aux durées", () => {
  const t = lire("registres.md");
  for (const attendu of ["Ce que chaque registre écarte", "squelettes de chargement", "héros plein écran", "regles-ui.md"]) assert.ok(t.includes(attendu), attendu);
});

// --- Correctifs de la revue finale ---

test("revue : pas de contradiction interne (durées des registres, rapport d'échelle)", () => {
  assert.ok(!lire("registres.md").includes("150 à 250"), "registres.md renvoie aux durées de regles-ui.md");
  const t = lire("regles-ui.md");
  assert.ok(!/≥ 1,25[^\n]*1,2 à 1,25/.test(t), "le rapport d'échelle ne contredit pas l'usage dense");
  assert.ok(t.includes("Tailles en `rem`"));
});

test("revue : toute courbe citée reste dans sa cible (aucun dépassement, donc aucun rebond)", () => {
  for (const f of ["regles-ui.md", "registres.md", "anti-patterns.md"])
    for (const m of lire(f).matchAll(/cubic-bezier\(([^)]*)\)/g)) {
      const [, y1, , y2] = m[1].split(",").map(Number);
      assert.ok(y1 >= 0 && y1 <= 1 && y2 >= 0 && y2 <= 1, `${f} : ${m[0]}`);
    }
});

test("revue : saturation baissée aux nuances extrêmes ; animations d'entrée en vitrine seulement", () => {
  const t = lire("regles-ui.md");
  assert.ok(t.includes("baisse aux nuances très claires ou très foncées"));
  assert.match(t, /En vitrine.{0,40}apparitions décalées/i);
});

test("revue : le thème du pack exige 3:1 pour --input et --ring", () => {
  const theme = fs.readFileSync(path.join(__dirname, "..", "..", "pulse-vibe-next", "references", "theme.md"), "utf8");
  assert.ok(theme.includes("`--input` et `--ring` sur `--background` : 3:1"));
});

test("motifs d'écrans : neuf sections et renvoi aux formulaires", () => {
  const t = lire("motifs.md");
  for (const titre of ["## 1. Messages et retours", "## 2. Choisir dans une liste", "## 3. Panneaux et fenêtres", "## 4. Tableaux de données", "## 5. Indicateurs", "## 6. Navigation", "## 7. Page vitrine", "## 8. Graphiques", "## 9. Icônes, logo et images de partage"])
    assert.ok(t.includes(titre), titre);
  assert.ok(t.includes("qualite/composants.md"));
  assert.ok(!t.includes("—"), "aucun tiret cadratin");
});

// --- Correctifs de la revue finale du lot 2 (motifs) ---

test("revue motifs : chargés par le designer, cités par /pulse:ui et /pulse:plan", () => {
  const P = path.join(__dirname, "..");
  const l = (...p) => fs.readFileSync(path.join(P, ...p), "utf8");
  assert.ok(l("agents", "designer.md").includes("pulse-aidd reference design/motifs.md"));
  assert.ok(l("skills", "ui", "SKILL.md").includes("quatre références de design"));
  assert.ok(l("skills", "plan", "SKILL.md").includes("design/motifs.md"));
  assert.match(l("references", "tests", "test-manuel.md"), /notifications[^\n]*erreur[^\n]*ferm/i);
});

test("revue motifs : pas de chevauchement, squelette selon le registre, renvois sans doublon", () => {
  const t = lire("motifs.md");
  assert.ok(t.includes("| 2 à 6 |") && t.includes("| 7 à 15 |"), "tranches 2 à 6 puis 7 à 15");
  assert.match(t, /en registre outil[^\n]*squelette/i);
  for (const attendu of ["1 à 20 sur 134", "5 au plus", "quelques étapes", "Histogramme (", "Anneau (", "regles-ui.md` § 7", "composants.md` § 8"])
    assert.ok(t.includes(attendu), attendu);
  assert.ok(!t.includes("La touche Échap la ferme"), "le comportement de la modale reste dans composants.md");
});

// --- Lot 3 : critique élargie ---

const P = path.join(__dirname, "..");
const lireP = (...p) => fs.readFileSync(path.join(P, ...p), "utf8");
const RUBRIQUES = ["Fidélité au design", "Hiérarchie", "Usage", "Anti-pattern", "État manquant", "Accessibilité", "Textes"];

test("heuristiques : les 10 heuristiques et les 5 dimensions avec leurs paliers", () => {
  const t = lire("heuristiques.md");
  for (let n = 1; n <= 10; n++) assert.match(t, new RegExp(`^### ${n}\. `, "m"), `heuristique ${n}`);
  for (const d of ["Intention", "Hiérarchie", "Finition", "Usage", "Personnalité"]) assert.match(t, new RegExp(`^### ${d}`, "m"), d);
  for (const palier of ["0 à 2", "3 à 4", "5 à 6", "7 à 8", "9 à 10"]) assert.ok(t.includes(palier), palier);
  assert.ok(!t.includes("—"), "aucun tiret cadratin");
});

test("ui-critic : charge heuristiques et motifs, 7 rubriques, mode maquette, corrections rapides", () => {
  const t = lireP("agents", "ui-critic.md");
  for (const attendu of ["design/heuristiques.md", "design/motifs.md", "mode maquette", "Corrections rapides", "Évaluation d'ensemble", ...RUBRIQUES.map((r) => "`" + r + "`")])
    assert.ok(t.includes(attendu), attendu);
});

test("modèle revue-ui : évaluation d'ensemble, corrections rapides, 7 rubriques", () => {
  const t = lireP("templates", "revue-ui.md");
  for (const attendu of ["## Évaluation d'ensemble", "## Corrections rapides", "/ 50", RUBRIQUES.join(" / ")]) assert.ok(t.includes(attendu), attendu);
});

test("skill ui : critique de la maquette retenue, références à jour", () => {
  const t = lireP("skills", "ui", "SKILL.md");
  for (const attendu of ["Critiquer la maquette retenue (Recommandé)", "retenue/critique.md", "mode maquette"]) assert.ok(t.includes(attendu), attendu);
  assert.ok(!t.includes("trois références"), "plus de « trois références »");
});

// --- Correctifs de la revue finale du lot 3 ---

test("revue critique : mode maquette juste (variables :root, consignes du pack), commandes autorisées", () => {
  const t = lireP("agents", "ui-critic.md");
  for (const attendu of ["En mode code, une valeur", "variables `:root`", "Dans les deux modes", "`pulse-aidd pile contexte ui`, `pulse-aidd textes verifier`", "desktop*.html:ligne", "3 au plus", "le numéro et le nom de l'heuristique"])
    assert.ok(t.includes(attendu), attendu);
  assert.ok(!t.includes("une action principale par écran"), "renvoi à regles-ui.md § 5 plutôt que recopie");
});

test("revue critique : choix des constats possible au-delà de 4, maquette regardée après correction", () => {
  const t = lireP("skills", "ui", "SKILL.md");
  assert.strictEqual(t.split("Je donne les numéros").length - 1, 2, "polish et maquettes");
  for (const attendu of ["consignes du pack pour les maquettes", "↪️ laissé", "critique-<k>.md"]) assert.ok(t.includes(attendu), attendu);
  assert.match(lireP("templates", "revue-ui.md"), /\*\*Verdict\*\*[^\n]*\/ 50/);
  assert.match(fs.readFileSync(path.join(P, "README.md"), "utf8"), /ui-critic[^\n]*maquette retenue/);
});

test("revue critique : heuristiques positives, sans doublon ni intention prêtée au design", () => {
  const t = lire("heuristiques.md");
  for (const absent of ["Aucune décoration", "au fil de l'eau", "Le design sait-il", "L'interface parle-t-elle", "comment s'en sortir"]) assert.ok(!t.includes(absent), absent);
  assert.ok(t.includes("regles-ui.md` § 8"), "H9 renvoie aux messages d'erreur");
});

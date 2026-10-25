// Tests de `pulse-aidd verifier-spec <US-XXX>` (scripts/verifier-spec.js) : la spec confrontée à son US avant son verrouillage.
// Lancer : node --test plugins/pulse-vibe/tests/verifier-spec.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "verifier-spec.js");
const { verifierSpec } = require(SCRIPT);
const DOSSIER = "aidd_docs/tasks/tenir-liste";

const US = `# US-001 – Ajouter un article

## Critères d'acceptation

1. **Cas nominal** – **Étant donné** une liste vide, **lorsque** j'ajoute « Pain », **alors** « Pain » apparaît.
2. **Cas limite** – **Étant donné** la liste, **lorsque** j'ajoute un nom vide, **alors** un message demande un nom.
`;

const SCENARIO = (etiquettes, titre) => `\`\`\`gherkin\n${etiquettes}\nExemple: ${titre}\n  Étant donné une liste vide\n\`\`\`\n`;
const SPEC = ({ statut = "brouillon", scenarios = [SCENARIO("@US-001-1 @unitaire", "Un article ajouté apparaît"), SCENARIO("@US-001-2 @manuel", "Un nom vide est refusé")], extra = "", sans = [] } = {}) => {
  const sections = {
    intention: "## 1. Intention\n\nAjouter un article.\n",
    scenarios: `## 6. Scénarios\n\n${scenarios.join("\n")}`,
    donnees: "## 7. Données personnelles et accès (obligatoire)\n\nAucune donnée personnelle.\n",
    termine: "## 9. Terminé quand\n\nUn article ajouté apparaît.\n",
  };
  return `# Spec – US-001\n\n> Une question sans réponse s'écrit \`TBD: <question précise>\`.\n\n**Statut** : ${statut}\n\n${Object.entries(sections).filter(([k]) => !sans.includes(k)).map(([, v]) => v).join("\n")}\n${extra}`;
};

function projet(spec, us = US) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-spec-"));
  fs.mkdirSync(path.join(d, DOSSIER), { recursive: true });
  fs.writeFileSync(path.join(d, DOSSIER, "SPEC-US-001-ajouter-article.md"), spec);
  if (us !== null) fs.writeFileSync(path.join(d, DOSSIER, "US-001-ajouter-article.md"), us);
  return d;
}
const constats = (d) => verifierSpec(d, "US-001").constats.map((c) => `${c.gravite} · ${c.ou} · ${c.message}`);

test("une spec complète : aucun constat ; le TBD cité dans l'en-tête du modèle ne compte pas", () => {
  const r = verifierSpec(projet(SPEC()), "us-1");
  assert.deepStrictEqual(r.constats, []);
  assert.strictEqual(r.tbd, 0);
  assert.strictEqual(r.statut, "brouillon");
});

test("critère sans scénario, scénario sans niveau, étiquette d'un critère absent", () => {
  const c = constats(projet(SPEC({ scenarios: [SCENARIO("@US-001-1", "Un article ajouté apparaît"), SCENARIO("@US-001-3 @unitaire", "Un critère inventé")] })));
  assert.ok(c.some((l) => /^à corriger · scénarios · le critère 2 de US-001 n'est illustré par aucun scénario/.test(l)), c.join("\n"));
  assert.ok(c.some((l) => /^à corriger · scénarios · le scénario US-001-1 « Un article ajouté apparaît » n'a pas de niveau/.test(l)), c.join("\n"));
  assert.ok(c.some((l) => /^avertissement · scénarios · l'étiquette @US-001-3 vise un critère qui n'existe pas/.test(l)), c.join("\n"));
});

test("sections obligatoires, champs du modèle, verrouillée avec TBD", () => {
  const c = constats(projet(SPEC({ sans: ["donnees", "termine"], extra: "- {{à remplir}}\n" })));
  assert.ok(c.includes("à corriger · sections · la section « Données personnelles et accès » manque"));
  assert.ok(c.includes("à corriger · sections · la section « Terminé quand » manque"));
  assert.ok(c.some((l) => /^à corriger · modèle · 1 ligne\(s\) encore au modèle/.test(l)));
  const verrou = verifierSpec(projet(SPEC({ statut: "verrouillée le 2026-10-16", extra: "- TBD: la liste se trie-t-elle ?\n" })), "US-001");
  assert.strictEqual(verrou.tbd, 1);
  assert.ok(verrou.constats.some((x) => /verrouillée mais garde 1 « TBD: »/.test(x.message)));
  // Un TBD en brouillon n'est pas un défaut : il se compte, la spec reste en brouillon.
  const brouillon = verifierSpec(projet(SPEC({ extra: "- TBD: la liste se trie-t-elle ?\n" })), "US-001");
  assert.deepStrictEqual([brouillon.tbd, brouillon.constats.length], [1, 0]);
});

const ECRANS = (lignes) =>
  `## 3. Ce que l'utilisateur voit et fait\n\n| Écran | Qui y accède | Ce qu'on y voit | Ce qu'on y fait | Présentation (choisie par la personne) |\n|---|---|---|---|---|\n${lignes.join("\n")}\n`;

test("présentation des écrans : un écran sans présentation choisie est signalé, avant le verrouillage", () => {
  const complete = ECRANS(["| La liste de courses | tout le monde | les articles | ajouter | liste simple ; ajout directement dans la liste |"]);
  assert.deepStrictEqual(constats(projet(SPEC({ extra: complete }))), []);
  const vide = constats(projet(SPEC({ extra: ECRANS(["| La liste de courses | tout le monde | les articles | ajouter |  |"]) })));
  assert.ok(vide.includes("avertissement · écrans · presentation-manquante: La liste de courses"), vide.join("\n"));
  const modele = constats(projet(SPEC({ extra: ECRANS(["| Le détail d'un article | tout le monde | le nom | modifier | {{ex. « tableau »}} |"]) })));
  assert.ok(modele.includes("avertissement · écrans · presentation-manquante: Le détail d'un article"), modele.join("\n"));
  // La ligne vide du modèle (sans écran nommé) relève du constat « modèle », pas de la présentation.
  const gabarit = constats(projet(SPEC({ extra: ECRANS(["| | | | | {{ex. « tableau »}} |"]) })));
  assert.ok(!gabarit.some((l) => l.includes("presentation-manquante")), gabarit.join("\n"));
});

test("présentation des écrans : « sans objet », titre sans numéro ou à l'apostrophe typographique, tableau sans colonne « Présentation »", () => {
  const confirmation = ECRANS(["| La confirmation | tout le monde | un message | rien | sans objet |"]);
  assert.deepStrictEqual(constats(projet(SPEC({ extra: confirmation }))), [], "« sans objet » : rien à choisir");
  const vide = "| La liste de courses | tout le monde | les articles | ajouter |  |";
  for (const titre of ["## 3. Ce que l’utilisateur voit et fait", "## Ce que l'utilisateur voit et fait"]) {
    const extra = ECRANS([vide]).replace("## 3. Ce que l'utilisateur voit et fait", titre);
    assert.ok(constats(projet(SPEC({ extra }))).includes("avertissement · écrans · presentation-manquante: La liste de courses"), titre);
  }
  const ancien = "## 3. Ce que l'utilisateur voit et fait\n\n| Écran | Qui y accède | Ce qu'on y voit |\n|---|---|---|\n| La liste | tout le monde | les articles |\n| Le détail | tout le monde | le nom |\n";
  const c = constats(projet(SPEC({ extra: ancien })));
  for (const ecran of ["La liste", "Le détail"]) assert.ok(c.includes(`avertissement · écrans · presentation-manquante: ${ecran}`), c.join("\n"));
});

test("présentation des écrans : seul le premier tableau de la section 3 décrit les écrans", () => {
  const ecrans = ECRANS(["| La liste de courses | tout le monde | les articles | ajouter | liste simple |"]);
  const situations = "\n**Situations à prévoir**\n\n| Situation | Ce qui se passe |\n|---|---|\n| Liste vide | un message invite à ajouter |\n";
  assert.deepStrictEqual(constats(projet(SPEC({ extra: ecrans + situations }))), []);
});

test("en ligne de commande : bilan, spec introuvable, argument manquant", () => {
  const d = projet(SPEC({ scenarios: [SCENARIO("@US-001-1 @unitaire", "Un article ajouté apparaît")] }));
  const lancer = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: d, encoding: "utf8" });
  const r = lancer("US-001");
  assert.match(r.stdout, /^spec: aidd_docs\/tasks\/tenir-liste\/SPEC-US-001-ajouter-article\.md$/m);
  assert.match(r.stdout, /^tbd: 0$/m);
  assert.match(r.stdout, /^bilan: à corriger$/m);
  assert.match(lancer("US-002").stdout, /^bilan: introuvable$/m);
  assert.match(lancer().stdout, /^erreur: indiquez l'US de la spec/m);
});

// La documentation suit le code : noms d'installation, commandes, agents, scripts, recettes,
// fonctions ajoutées par le refactoring du 2026-10-08, vérifications du dépôt.
// Lancer : node --test plugins/pulse-vibe/tests/documentation.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const DEPOT = path.join(RACINE, "..", "..");
const NEXT = path.join(DEPOT, "plugins", "pulse-vibe-next");
const lire = (...p) => fs.readFileSync(path.join(...p), "utf8");
const existe = (...p) => fs.existsSync(path.join(...p));
const lister = (...p) => (existe(...p) ? fs.readdirSync(path.join(...p)) : []);

// Ce test n'a de sens que dans le dépôt (le cœur peut être installé seul, hors du dépôt).
const DANS_LE_DEPOT = existe(DEPOT, ".claude-plugin", "marketplace.json") && existe(NEXT);
const options = { skip: !DANS_LE_DEPOT && "hors du dépôt des plugins" };

const DOCUMENTS = ["README.md", "CLAUDE.md", "docs/memo-commandes.md", "plugins/pulse-vibe/README.md", "plugins/pulse-vibe-next/README.md", "plugins/pulse-vibe/templates/CLAUDE.md", "plugins/pulse-vibe/templates/README-projet.md"];
const texte = (f) => lire(DEPOT, f);

// Ce que chaque document doit citer, parce qu'un plan du refactoring l'a ajouté.
const MENTIONS_COEUR = ["pulse-aidd installer-hook", "pulse-aidd etat", "pulse-aidd contraste", "S1 à S13", "Node.js 22.19", "PowerShell", "--sans-communes", "references/fichiers-projet.md", "references/cycle.md"];
const MENTIONS_PACK = ["suivi-erreurs", "verifier-recettes", "migrations", "Node.js 22.19", "pulse-pile-next recette", "decouper-recette"];
const MENTIONS_DEPOT = ["verifier-recettes", "budget-contexte", "pulse--v", "pulse-next--v", "documentation.test.js"];

test("installation : noms du catalogue égaux aux noms de manifeste, et seuls cités", options, () => {
  const catalogue = JSON.parse(lire(DEPOT, ".claude-plugin", "marketplace.json"));
  assert.deepStrictEqual(catalogue.plugins.map((p) => p.name).sort(), ["pulse", "pulse-next"]);
  for (const p of catalogue.plugins) assert.strictEqual(JSON.parse(lire(DEPOT, p.source, ".claude-plugin", "plugin.json")).name, p.name, p.source);
  // Le README du dépôt cite les anciens noms une fois, sur la ligne qui explique la redirection (« anciens noms »).
  const sansRedirection = (f) => texte(f).split(/\r?\n/).filter((l) => !/anciens noms/.test(l)).join(" ");
  for (const f of DOCUMENTS) assert.doesNotMatch(sansRedirection(f), /\bpulse-vibe(?:-next)?@pulseia\b/, `${f} : ancien nom d'installation`);
  assert.match(texte("README.md"), /pulse@pulseia/);
  assert.match(texte("README.md"), /pulse-next@pulseia/);
});

test("chaque commande du cœur figure dans son README et dans le mémo", options, () => {
  for (const s of lister(RACINE, "skills")) {
    assert.ok(texte("plugins/pulse-vibe/README.md").includes(`/pulse:${s}`), `README du cœur : /pulse:${s}`);
    assert.ok(texte("docs/memo-commandes.md").includes(`/pulse:${s}`), `mémo : /pulse:${s}`);
  }
});

test("chaque agent et chaque script du cœur figure dans son README", options, () => {
  const readme = texte("plugins/pulse-vibe/README.md");
  for (const a of lister(RACINE, "agents").map((f) => f.replace(/\.md$/, ""))) assert.ok(readme.includes(a), `README du cœur : agent ${a}`);
  for (const s of lister(RACINE, "scripts").filter((f) => f.endsWith(".js"))) assert.ok(readme.includes(s), `README du cœur : script ${s}`);
});

test("chaque recette et chaque script du pack figure dans son README", options, () => {
  const readme = texte("plugins/pulse-vibe-next/README.md");
  for (const r of lister(NEXT, "references", "recettes").map((f) => f.replace(/\.md$/, ""))) assert.ok(readme.includes(`\`${r}\``), `README du pack : recette ${r}`);
  for (const s of lister(NEXT, "scripts").filter((f) => f.endsWith(".js"))) assert.ok(readme.includes(s), `README du pack : script ${s}`);
});

test("les fonctions ajoutées par le refactoring sont documentées", options, () => {
  for (const m of MENTIONS_COEUR) assert.ok(texte("plugins/pulse-vibe/README.md").includes(m), `README du cœur : « ${m} »`);
  for (const m of MENTIONS_PACK) assert.ok(texte("plugins/pulse-vibe-next/README.md").includes(m), `README du pack : « ${m} »`);
});

test("le CLAUDE.md du dépôt décrit chaque plugin et chaque vérification", options, () => {
  const claude = texte("CLAUDE.md");
  for (const d of lister(DEPOT, "plugins")) assert.ok(claude.includes(`plugins/${d}/`), `CLAUDE.md : plugins/${d}/`);
  for (const m of MENTIONS_DEPOT) assert.ok(claude.includes(m), `CLAUDE.md : « ${m} »`);
  assert.doesNotMatch(claude, /<plugin>--v/, "CLAUDE.md : étiquettes nommées comme les manifestes (pulse--v, pulse-next--v)");
});

// La documentation suit le code : noms d'installation, commandes, agents, scripts, outils de bin/ et leurs
// sous-commandes, références, recettes, vérifications du dépôt. Les listes sont lues dans le code et les dossiers.
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

// Chaque plugin et son README.
const PLUGINS = [
  { dossier: RACINE, readme: "plugins/pulse-vibe/README.md" },
  { dossier: NEXT, readme: "plugins/pulse-vibe-next/README.md" },
];

// Sous-commandes de premier niveau d'un outil bash : étiquettes « nom) » du dernier « case "$1" in ».
function sousCommandes(fichier) {
  const t = fs.readFileSync(fichier, "utf8");
  return [...t.slice(t.lastIndexOf('case "$1" in')).matchAll(/^ {2}([a-z][a-z|-]*)\)/gm)].flatMap((m) => m[1].split("|"));
}

// Une ligne du bloc de structure d'un README (celle qui commence par `debut`) et ses lignes de suite, indentées.
function blocStructure(readme, debut) {
  const lignes = readme.split("\n");
  const i = lignes.findIndex((l) => l.startsWith(debut));
  if (i === -1) return "";
  let fin = i + 1;
  while (fin < lignes.length && /^\s+\S/.test(lignes[fin])) fin++;
  return lignes.slice(i, fin).join("\n");
}

// `mot` cité comme un mot entier : précédé d'une espace, de |, (, ` ou d'un début de ligne ; suivi d'une espace, de |, <, [, `, ), d'une virgule ou d'une fin de ligne.
const cite = (texteCherche, mot) => new RegExp(`(^|[\\s|(\`])${mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s|<\\[\`),]|$)`, "m").test(texteCherche);

test("installation : noms du catalogue égaux aux noms de manifeste, et seuls cités", options, () => {
  const catalogue = JSON.parse(lire(DEPOT, ".claude-plugin", "marketplace.json"));
  assert.deepStrictEqual(catalogue.plugins.map((p) => p.name).sort(), ["pulse", "pulse-next"]);
  for (const p of catalogue.plugins) assert.strictEqual(JSON.parse(lire(DEPOT, p.source, ".claude-plugin", "plugin.json")).name, p.name, p.source);
  // Les README du dépôt et du cœur citent les anciens noms une fois, sur la ligne qui explique la redirection ;
  // cette ligne donne la commande avec le nouveau nom et jamais une installation sous l'ancien.
  const AVEC_REDIRECTION = ["README.md", "plugins/pulse-vibe/README.md"];
  const redirection = (l) => /anciens noms/.test(l) && /install pulse@pulseia/.test(l) && !/install pulse-vibe/.test(l);
  const sansRedirection = (f) => texte(f).split(/\r?\n/).filter((l) => !(AVEC_REDIRECTION.includes(f) && redirection(l))).join(" ");
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

test("chaque agent et chaque fichier de scripts/ figure dans le README de son plugin", options, () => {
  const readme = texte("plugins/pulse-vibe/README.md");
  for (const a of lister(RACINE, "agents").map((f) => f.replace(/\.md$/, ""))) assert.ok(readme.includes(a), `README du cœur : agent ${a}`);
  for (const { dossier, readme: fichier } of PLUGINS) for (const s of lister(dossier, "scripts")) assert.ok(texte(fichier).includes(s), `${fichier} : script ${s}`);
});

test("chaque recette du pack figure dans son README", options, () => {
  const readme = texte("plugins/pulse-vibe-next/README.md");
  for (const r of lister(NEXT, "references", "recettes").map((f) => f.replace(/\.md$/, ""))) assert.ok(readme.includes(`\`${r}\``), `README du pack : recette ${r}`);
});

test("README de chaque plugin : chaque fichier de bin/, et chaque sous-commande de son outil sur sa ligne bin/", options, () => {
  for (const { dossier, readme } of PLUGINS) {
    const t = texte(readme);
    for (const f of lister(dossier, "bin")) {
      assert.ok(t.includes(`bin/${f}`), `${readme} : bin/${f}`);
      if (f.includes(".")) continue;
      const ligne = blocStructure(t, `bin/${f} `);
      assert.ok(ligne, `${readme} : ligne « bin/${f} »`);
      for (const s of sousCommandes(path.join(dossier, "bin", f))) assert.ok(cite(ligne, s), `${readme}, ligne bin/${f} : ${s}`);
    }
  }
});

test("README de chaque plugin : chaque fichier et dossier de premier niveau de references/", options, () => {
  for (const { dossier, readme } of PLUGINS) {
    const bloc = blocStructure(texte(readme), "references/");
    for (const e of fs.readdirSync(path.join(dossier, "references"), { withFileTypes: true })) {
      const nom = e.isDirectory() ? `${e.name}/` : e.name;
      assert.ok(cite(bloc, nom) || bloc.includes(` ${nom}`), `${readme}, bloc references/ : ${nom}`);
    }
  }
});

test("README du cœur : la checklist sécurité annoncée en entier, et chaque shell surveillé par les garde-fous", options, () => {
  const readme = texte("plugins/pulse-vibe/README.md");
  const derniere = Math.max(...[...lire(RACINE, "references", "checklist-securite.md").matchAll(/^## S(\d+) /gm)].map((m) => Number(m[1])));
  assert.ok(readme.includes(`S1 à S${derniere}`), `README du cœur : « S1 à S${derniere} »`);
  const matchers = JSON.parse(lire(RACINE, "hooks", "hooks.json")).hooks.PreToolUse.flatMap((h) => h.matcher.split("|"));
  for (const shell of ["Bash", "PowerShell"].filter((s) => matchers.includes(s))) assert.ok(readme.includes(shell), `README du cœur : ${shell}`);
});

test("le CLAUDE.md du dépôt décrit chaque plugin, ses étiquettes et chaque vérification du dépôt", options, () => {
  const claude = texte("CLAUDE.md");
  for (const d of lister(DEPOT, "plugins")) assert.ok(claude.includes(`plugins/${d}/`), `CLAUDE.md : plugins/${d}/`);
  for (const p of JSON.parse(lire(DEPOT, ".claude-plugin", "marketplace.json")).plugins) assert.ok(claude.includes(`${p.name}--v`), `CLAUDE.md : étiquette ${p.name}--v`);
  for (const s of lister(NEXT, "scripts").filter((f) => /^verifier-.*\.js$/.test(f))) assert.ok(claude.includes(s), `CLAUDE.md : ${s}`);
  // Chaque fichier de test cité existe ; les deux tests qui fixent une règle du dépôt sont cités.
  const tests = new Set(lister(DEPOT, "plugins").flatMap((p) => lister(DEPOT, "plugins", p, "tests")));
  for (const [, f] of claude.matchAll(/([\w-]+\.test\.js)/g)) assert.ok(tests.has(f), `CLAUDE.md cite ${f}, introuvable`);
  for (const f of ["budget-contexte.test.js", "documentation.test.js"]) assert.ok(claude.includes(f), `CLAUDE.md : ${f}`);
  assert.doesNotMatch(claude, /<plugin>--v/, "CLAUDE.md : étiquettes nommées comme les manifestes (pulse--v, pulse-next--v)");
});

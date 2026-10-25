// Tests de la page de comparaison des variantes (pulse-aidd comparer, /pulse:ui).
// Lancer : node --test plugins/pulse-vibe/tests/comparer.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const COMPARER = path.join(__dirname, "..", "skills", "ui", "scripts", "comparer.js");

function dossier(variantes) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-comparer-"));
  for (const [nom, fichiers] of Object.entries(variantes)) {
    fs.mkdirSync(path.join(d, nom), { recursive: true });
    for (const [f, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(d, nom, f), contenu);
  }
  return d;
}
const lancer = (...args) => spawnSync("node", [COMPARER, ...args], { encoding: "utf8" });
const page = (d) => fs.readFileSync(path.join(d, "comparer.html"), "utf8");
const html = "<!doctype html><title>x</title>";
const variante = (these) => ({ "desktop.html": html, "mobile.html": html, "note.md": `# Variante\n\n**Thèse** : ${these}\n` });

test("trois variantes : chaque thèse, chaque lien, chemins relatifs, ordre naturel", () => {
  const d = dossier({
    "v10-dense": variante("Tableau dense"),
    "v1-liste": variante("Liste aérée"),
    "v2-cartes": variante("Fiches empilées"),
  });
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Page de comparaison : .*comparer\.html/);
  const p = page(d);
  for (const t of ["Tableau dense", "Liste aérée", "Fiches empilées"]) assert.ok(p.includes(t), t);
  for (const v of ["v1-liste", "v2-cartes", "v10-dense"]) {
    assert.ok(p.includes(`href="${v}/desktop.html"`), v);
    assert.ok(p.includes(`href="${v}/mobile.html"`), v);
  }
  assert.ok(p.indexOf("v1-liste") < p.indexOf("v2-cartes") && p.indexOf("v2-cartes") < p.indexOf("v10-dense"), "ordre naturel");
  assert.doesNotMatch(p, /[A-Za-z]:\\|file:\/\//, "aucun chemin absolu");
});

test("variante sans mobile.html : mention claire, pas d'erreur", () => {
  const d = dossier({ "v1-seule": { "desktop.html": html, "note.md": "**Thèse** : Bureau seulement\n" } });
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(page(d), /Pas de version mobile/);
  assert.doesNotMatch(page(d), /v1-seule\/mobile\.html/);
});

test("retenue/ et alternatives/ sont ignorés", () => {
  const d = dossier({ "v1-a": variante("A"), retenue: variante("Choisie"), alternatives: variante("Écartée") });
  lancer(d);
  const p = page(d);
  assert.ok(p.includes("v1-a/desktop.html"));
  assert.doesNotMatch(p, /retenue\/|alternatives\//);
});

test("dossier sans variante : code 1, aucun fichier écrit", () => {
  const d = dossier({ vide: { "note.md": "rien" } });
  const r = lancer(d);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /Aucune variante/);
  assert.ok(!fs.existsSync(path.join(d, "comparer.html")));
});

test("dossier inexistant ou absent : code 1, message clair", () => {
  const r = lancer(path.join(os.tmpdir(), "pulse-comparer-inexistant-" + Date.now()));
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /introuvable/);
  const u = lancer();
  assert.strictEqual(u.status, 1);
  assert.match(u.stderr, /Usage/);
});

test("une thèse contenant du HTML est échappée", () => {
  const d = dossier({ "v1-x": variante('<script>alert("x")</script> & co') });
  lancer(d);
  const p = page(d);
  assert.doesNotMatch(p, /<script>alert/);
  assert.ok(p.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co"));
});

test("planches d'identité : un seul cadre par direction", () => {
  const d = dossier({
    "d1-sobre": { "planche.html": html, "note.md": "**Thèse** : Sobre\n" },
    "d2-vive": { "planche.html": html, "note.md": "**Thèse** : Vive\n" },
  });
  assert.strictEqual(lancer(d).status, 0);
  const p = page(d);
  assert.ok(p.includes('href="d1-sobre/planche.html"') && p.includes('href="d2-vive/planche.html"'));
  assert.doesNotMatch(p, /Pas de version (mobile|desktop)/);
});

test("noms avec espaces et accents : liens encodés", () => {
  const d = dossier({ "v1 épurée": variante("Épurée") });
  lancer(d);
  const p = page(d);
  assert.ok(p.includes('href="v1%20%C3%A9pur%C3%A9e/desktop.html"'));
  assert.ok(p.includes("v1 épurée"), "le nom affiché reste lisible");
});

test("thèse : CRLF, gras et repli sur le titre puis le nom du dossier", () => {
  const d = dossier({
    "v1-crlf": { "desktop.html": html, "note.md": "# Titre\r\n\r\n**Thèse** : Avec CRLF\r\n" },
    "v2-titre": { "desktop.html": html, "note.md": "# Seulement un titre\n" },
    "v3-rien": { "desktop.html": html },
  });
  lancer(d);
  const p = page(d);
  assert.ok(p.includes("Avec CRLF") && !p.includes("Avec CRLF\r"));
  assert.ok(p.includes("Seulement un titre"));
  assert.match(p, /<h2>v3-rien<\/h2>[\s\S]*?<p class="these">v3-rien<\/p>/);
  assert.doesNotMatch(p, /\*\*/);
});

test("relance : comparer.html réécrit à l'identique et jamais pris pour une variante", () => {
  const d = dossier({ "v1-a": variante("A") });
  lancer(d);
  const premiere = page(d);
  const r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(page(d), premiere);
});

// --- Rangement des variantes (--ranger, --retenir) : lancé depuis la racine du projet, chemin relatif ---

const projet = (variantes, sous = "docs/design/maquettes/US-001-liste") => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-ranger-"));
  const d = path.join(racine, sous);
  for (const [nom, fichiers] of Object.entries(variantes)) {
    fs.mkdirSync(path.join(d, nom), { recursive: true });
    for (const [f, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(d, nom, f), contenu);
  }
  return { racine, d, sous };
};
const lancerDans = (cwd, ...args) => spawnSync("node", [COMPARER, ...args], { cwd, encoding: "utf8" });
const existe = (...p) => fs.existsSync(path.join(...p));
const lireF = (...p) => fs.readFileSync(path.join(...p), "utf8");
const aujourdhui = () => {
  const j = new Date();
  return `${j.getFullYear()}-${String(j.getMonth() + 1).padStart(2, "0")}-${String(j.getDate()).padStart(2, "0")}`;
};

test("--ranger : les d*/v* présents vont dans alternatives/, prochain = plus grand numéro + 1, alternatives/ compris", () => {
  const { racine, d, sous } = projet({
    "d1-sobre": { "planche.html": html, "note.md": "**Thèse** : Sobre\n" },
    "d2-vive": { "planche.html": html, "note.md": "**Thèse** : Vive\n" },
    "alternatives/d3-ancienne": { "planche.html": html },
    retenue: { "planche.html": html },
  }, "docs/design/identite");
  assert.strictEqual(lancerDans(racine, sous).status, 0, "page de comparaison générée");
  const r = lancerDans(racine, sous, "--ranger");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^prochain: 4$/m);
  assert.ok(existe(d, "alternatives", "d1-sobre", "planche.html") && existe(d, "alternatives", "d2-vive", "note.md"));
  assert.ok(!existe(d, "d1-sobre") && !existe(d, "d2-vive"));
  assert.ok(existe(d, "alternatives", "d3-ancienne") && existe(d, "retenue", "planche.html"), "retenue/ et alternatives/ restent en place");
  assert.ok(!existe(d, "comparer.html"), "comparer.html périmé retiré");
});

test("--ranger : dossier encore absent ou sans variante → prochain: 1, rien d'écrit", () => {
  const { racine } = projet({});
  const r = lancerDans(racine, "docs/design/identite", "--ranger");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^prochain: 1$/m);
  assert.ok(!existe(racine, "docs", "design", "identite"), "aucun dossier créé");
});

test("--ranger : un nom déjà pris dans alternatives/ reçoit un suffixe, rien n'est écrasé", () => {
  const { racine, d, sous } = projet({ "v2-cartes": { "desktop.html": "nouvelle" }, "alternatives/v2-cartes": { "desktop.html": "ancienne" } });
  const r = lancerDans(racine, sous, "--ranger");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^prochain: 3$/m);
  assert.strictEqual(lireF(d, "alternatives", "v2-cartes", "desktop.html"), "ancienne");
  assert.strictEqual(lireF(d, "alternatives", "v2-cartes-2", "desktop.html"), "nouvelle");
});

test("--retenir v2 --mobile v1 : ancienne retenue datée, choix copié, autres variantes rangées, comparer.html retiré", () => {
  const { racine, d, sous } = projet({
    "v1-liste": { "desktop.html": "bureau v1", "mobile.html": "mobile v1", "note.md": "**Thèse** : Liste\n" },
    "v2-cartes": { "desktop.html": "bureau v2", "mobile.html": "mobile v2", "note.md": "**Thèse** : Cartes\n" },
    "v3-tableau": { "desktop.html": "bureau v3", "mobile.html": "mobile v3" },
    retenue: { "desktop.html": "ancienne", "critique.md": "ancienne critique" },
  });
  assert.strictEqual(lancerDans(racine, sous).status, 0, "page de comparaison générée");
  const r = lancerDans(racine, sous, "--retenir", "v2", "--mobile", "v1");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(lireF(d, "retenue", "desktop.html"), "bureau v2");
  assert.strictEqual(lireF(d, "retenue", "note.md"), "**Thèse** : Cartes\n");
  assert.strictEqual(lireF(d, "retenue", "mobile.html"), "mobile v1");
  assert.ok(!existe(d, "retenue", "critique.md"), "la critique de l'ancienne retenue part avec elle");
  const ancienne = path.join(d, "alternatives", `retenue-${aujourdhui()}`);
  assert.strictEqual(lireF(ancienne, "desktop.html"), "ancienne");
  assert.strictEqual(lireF(ancienne, "critique.md"), "ancienne critique");
  assert.ok(existe(d, "alternatives", "v3-tableau", "desktop.html") && !existe(d, "v3-tableau"), "variante écartée rangée");
  assert.ok(existe(d, "v1-liste") && existe(d, "v2-cartes"), "les variantes choisies restent en place");
  assert.ok(!existe(d, "comparer.html"));
  assert.match(r.stdout, /^retenue: /m);
});

test("--retenir d'une planche d'identité, nom complet accepté, sans ancienne retenue", () => {
  const { racine, d, sous } = projet({
    "d1-sobre": { "planche.html": "planche 1", "note.md": "**Thèse** : Sobre\n" },
    "d2-vive": { "planche.html": "planche 2", "note.md": "**Thèse** : Vive\n" },
  }, "docs/design/identite");
  const r = lancerDans(racine, sous, "--retenir", "d2-vive");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(lireF(d, "retenue", "planche.html"), "planche 2");
  assert.ok(existe(d, "alternatives", "d1-sobre") && !existe(d, "alternatives", `retenue-${aujourdhui()}`));
});

test("--retenir : une deuxième ancienne retenue le même jour reçoit un suffixe", () => {
  const { racine, d, sous } = projet({
    "v4-hybride-mix": { "desktop.html": "hybride" },
    retenue: { "desktop.html": "de ce matin" },
    [`alternatives/retenue-${aujourdhui()}`]: { "desktop.html": "d'hier soir" },
  });
  const r = lancerDans(racine, sous, "--retenir", "v4");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(lireF(d, "alternatives", `retenue-${aujourdhui()}`, "desktop.html"), "d'hier soir");
  assert.strictEqual(lireF(d, "alternatives", `retenue-${aujourdhui()}-2`, "desktop.html"), "de ce matin");
  assert.strictEqual(lireF(d, "retenue", "desktop.html"), "hybride");
});

test("--retenir : variante inconnue ou ambiguë → code 2, rien ne bouge", () => {
  const { racine, d, sous } = projet({
    "v1-liste": { "desktop.html": "1" },
    "v1-autre": { "desktop.html": "1 bis" },
    retenue: { "desktop.html": "ancienne" },
  });
  for (const args of [["--retenir", "v9"], ["--retenir", "v1"], ["--retenir", "v1-liste", "--mobile", "v7"], ["--retenir", "retenue"]]) {
    const r = lancerDans(racine, sous, ...args);
    assert.strictEqual(r.status, 2, `${args.join(" ")} : ${r.stdout}${r.stderr}`);
  }
  assert.strictEqual(lireF(d, "retenue", "desktop.html"), "ancienne");
  assert.ok(existe(d, "v1-liste") && existe(d, "v1-autre") && !existe(d, "alternatives"));
});

test("--ranger et --retenir : chemin absolu, avec .. ou lettre de lecteur refusé (code 2) ; option incomplète : code 1", () => {
  const { racine, d } = projet({ "v1-a": { "desktop.html": html } });
  for (const cible of [d, "../ailleurs", "C:/projet"]) {
    const r = lancerDans(racine, cible, "--ranger");
    assert.strictEqual(r.status, 2, `${cible} : ${r.stderr}`);
  }
  assert.ok(existe(d, "v1-a"));
  assert.strictEqual(lancerDans(racine, "docs", "--retenir").status, 1);
  assert.strictEqual(lancerDans(racine, "docs", "--retenir", "v1", "--mobile").status, 1);
});

test("--ranger et --retenir : seulement docs/design/identite ou docs/design/maquettes/<spec> ; un dossier de code est refusé, rien ne bouge", () => {
  const { racine, d, sous } = projet({ v1: { "route.ts": "export {}" }, "v2-beta": { "route.ts": "export {}" } }, "src/app/api");
  fs.writeFileSync(path.join(d, "comparer.html"), "<p>page de la personne</p>");
  for (const args of [["--ranger"], ["--retenir", "v1"]]) {
    const r = lancerDans(racine, sous, ...args);
    assert.strictEqual(r.status, 2, `${args.join(" ")} : ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /docs\/design\/identite/);
  }
  for (const cible of ["docs/design", "docs/design/maquettes", "docs/design/maquettes/US-001/retenue", "docs/design/identite/../../../src/app/api", "./src/app/api"])
    assert.strictEqual(lancerDans(racine, cible, "--ranger").status, 2, cible);
  assert.ok(existe(d, "v1", "route.ts") && existe(d, "v2-beta", "route.ts") && !existe(d, "alternatives"), "dossiers de code en place");
  assert.strictEqual(lireF(d, "comparer.html"), "<p>page de la personne</p>", "comparer.html gardé");
});

test("--ranger : séparateurs Windows et ./ acceptés pour un dossier de design", () => {
  const { racine, d } = projet({ "d1-sobre": { "planche.html": html } }, "docs/design/identite");
  const r = lancerDans(racine, ".\\docs\\design\\identite\\", "--ranger");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^prochain: 2$/m);
  assert.ok(existe(d, "alternatives", "d1-sobre"));
});

test("--ranger : un dossier de design qui renvoie ailleurs (lien) est refusé, rien ne bouge", () => {
  const { racine, d } = projet({ v1: { "route.ts": "export {}" } }, "src/app/api");
  fs.mkdirSync(path.join(racine, "docs", "design", "maquettes"), { recursive: true });
  fs.symlinkSync(d, path.join(racine, "docs", "design", "maquettes", "US-001-lien"), "junction");
  const r = lancerDans(racine, "docs/design/maquettes/US-001-lien", "--ranger");
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.ok(existe(d, "v1", "route.ts") && !existe(d, "alternatives"));
});

test("--ranger : comparer.html écrit par quelqu'un d'autre que comparer est gardé", () => {
  const { racine, d, sous } = projet({ "v1-a": { "desktop.html": html } });
  fs.writeFileSync(path.join(d, "comparer.html"), "<p>notes de la personne</p>");
  assert.strictEqual(lancerDans(racine, sous, "--ranger").status, 0);
  assert.strictEqual(lireF(d, "comparer.html"), "<p>notes de la personne</p>");
});

test("--ranger et --retenir : une cible qui est un fichier → code 2 ; option inconnue → code 1, rien d'écrit", () => {
  const { racine, d, sous } = projet({ "v1-a": { "desktop.html": html } });
  fs.writeFileSync(path.join(racine, "docs", "design", "maquettes", "US-002"), "un fichier");
  for (const args of [["--ranger"], ["--retenir", "v1"]]) {
    const r = lancerDans(racine, "docs/design/maquettes/US-002", ...args);
    assert.strictEqual(r.status, 2, `${args.join(" ")} : ${r.stdout}${r.stderr}`);
    assert.doesNotMatch(r.stderr, /at .*\(/, "pas de trace d'erreur");
  }
  for (const args of [["--rangr"], ["--ranger", "--vite"], ["v1"]]) {
    const r = lancerDans(racine, sous, ...args);
    assert.strictEqual(r.status, 1, args.join(" "));
    assert.match(r.stderr, /Usage/);
  }
  assert.ok(!existe(d, "comparer.html") && existe(d, "v1-a"), "rien d'écrit ni déplacé");
});

test("--retenir : un déplacement qui échoue en cours de route → code 3, état d'avant remis", () => {
  const { racine, d, sous } = projet({
    "v1-liste": { "desktop.html": "bureau v1" },
    "v2-cartes": { "desktop.html": "bureau v2" },
    "v3-tableau": { "desktop.html": "bureau v3" },
    retenue: { "desktop.html": "ancienne" },
  });
  const comparer = require(COMPARER);
  const dossierAvant = process.cwd();
  const renommer = fs.renameSync;
  const erreur = console.error;
  let appels = 0;
  let message = "";
  fs.renameSync = (...a) => {
    appels += 1;
    if (appels === 3) throw new Error("disque plein (simulé)");
    return renommer(...a);
  };
  console.error = (m) => (message += m);
  let code;
  try {
    process.chdir(racine);
    code = comparer.principal([sous, "--retenir", "v2"]);
  } finally {
    process.chdir(dossierAvant);
    fs.renameSync = renommer;
    console.error = erreur;
  }
  assert.strictEqual(code, 3, message);
  assert.match(message, /état d'avant est remis/);
  assert.strictEqual(lireF(d, "retenue", "desktop.html"), "ancienne");
  for (const v of ["v1-liste", "v2-cartes", "v3-tableau"]) assert.ok(existe(d, v, "desktop.html"), v);
  assert.ok(!existe(d, "alternatives") && !existe(d, ".retenue-en-cours"));
});

// Tests de l'outil du pack (bin/pulse-pile-next) et de la forme de ses références.
// Lancer : node --test plugins/pulse-vibe-next/tests/pulse-pile-next.test.js (nécessite bash dans le PATH)
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const REF = path.join(RACINE, "references");
// Chemin relatif et cwd = racine du plugin : fonctionne avec Git Bash, macOS et Linux.
const lancer = (...args) => spawnSync("bash", ["bin/pulse-pile-next", ...args], { cwd: RACINE, encoding: "utf8" });
const lire = (...p) => fs.readFileSync(path.join(...p), "utf8");

const SECTIONS_RECETTE = [
  "## Prérequis",
  "## Variables d'environnement",
  "## Fichiers créés ou modifiés",
  "## Étapes",
  "## Scénarios Gherkin à ajouter à la spec",
  "## Tâches de plan prêtes",
  "## Tests",
  "## Points de sécurité",
  "## Pièges connus",
];
const RECETTES = ["connexion", "liste", "email", "fichiers", "paiement", "langues", "limite", "seo", "mesure-reelle"];

test("info : les quatre lignes du contrat, avec la version du manifeste", () => {
  const r = lancer("info");
  assert.strictEqual(r.status, 0, r.stderr);
  const { version } = JSON.parse(lire(RACINE, ".claude-plugin", "plugin.json"));
  assert.match(r.stdout, /^id: next$/m);
  assert.match(r.stdout, /^nom: Pulse Next\.js$/m);
  assert.match(r.stdout, /^resume: .+$/m);
  assert.match(r.stdout, new RegExp(`^version: ${version.replace(/\./g, "\\.")}$`, "m"));
});

test("contexte : chaque commande concernée reçoit ses consignes, les autres rien, toujours le code 0", () => {
  const attendus = {
    tech: ["Pour /pulse:tech", "Valeurs de docs/technical.md", "Fiche de la pile", "Le thème"],
    ui: ["Pour /pulse:ui", "Le thème"],
    express: ["Pour /pulse:express"],
    spec: ["Pour /pulse:spec", "Recettes disponibles"],
    plan: ["Pour /pulse:plan", "Fiche de la pile", "Recettes disponibles"],
    implement: ["Pour réaliser et corriger", "Fiche de la pile", "Recettes disponibles"],
    fix: ["Pour réaliser et corriger", "Fiche de la pile"],
    spirc: ["Pour réaliser et corriger"],
    review: ["Pour relire", "Fiche de la pile"],
    security: ["Pour relire"],
    test: ["Pour les tests"],
    deploy: ["Pour mettre en ligne"],
    cicd: ["Pour mettre en ligne"],
    secrets: ["Pour /pulse:secrets"],
    seo: ["Pour /pulse:seo", "Fiche de la pile", "Recettes disponibles"],
    perf: ["Pour /pulse:perf", "Fiche de la pile"],
    "search-console": ["Pour Search Console"],
  };
  for (const [commande, titres] of Object.entries(attendus)) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, commande);
    for (const titre of titres) assert.ok(r.stdout.includes(`----- ${titre}`), `${commande} : ${titre}`);
  }
  for (const commande of ["learn", "inconnue", ""]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout.trim(), "", commande);
  }
});

test("secrets et hebergeur : relais vers les scripts du pack", () => {
  const fiche = lancer("secrets", "fiche", "STRIPE_SECRET_KEY");
  assert.strictEqual(fiche.status, 0);
  assert.match(fiche.stdout, /^### `STRIPE_SECRET_KEY`/);
  const regles = lancer("secrets", "regles");
  assert.ok(JSON.parse(regles.stdout).variables.DATABASE_URL);
  assert.strictEqual(lancer("hebergeur").status, 1);
});

test("l'aide reste complète jusqu'à sa dernière ligne", () => {
  const r = lancer();
  assert.match(r.stdout, /seo-code/);
  assert.match(r.stdout, /hebergeur ls/);
  assert.match(r.stdout, /Ne sort jamais en erreur/);
});

test("recettes et recette : liste, lecture, nom inconnu ou chemin refusé", () => {
  const liste = lancer("recettes");
  assert.strictEqual(liste.status, 0);
  for (const nom of RECETTES) assert.match(liste.stdout, new RegExp(`^- ${nom} : .+$`, "m"), nom);
  const connexion = lancer("recette", "connexion");
  assert.strictEqual(connexion.status, 0);
  assert.match(connexion.stdout, /^# Recette : connexion$/m);
  for (const args of [["recette", "inexistante"], ["recette", "../fiche"], ["recette"]]) {
    const r = lancer(...args);
    assert.strictEqual(r.status, 1, args.join(" "));
    assert.match(r.stdout, /connexion/);
  }
});

test("reference : affiche un fichier du pack, refuse une sortie du dossier", () => {
  const r = lancer("reference", "fiche.md");
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /^# Fiche de la pile Pulse Next\.js$/m);
  assert.strictEqual(lancer("reference", "../.claude-plugin/plugin.json").status, 1);
  assert.strictEqual(lancer("reference", "absente.md").status, 1);
});

test("chaque recette suit le format commun", () => {
  for (const nom of RECETTES) {
    const fichier = path.join(REF, "recettes", `${nom}.md`);
    assert.ok(fs.existsSync(fichier), `${nom}.md absent`);
    const texte = lire(fichier);
    assert.match(texte, new RegExp(`^# Recette : ${nom}$`, "m"), nom);
    assert.match(texte, /^> Quand l'utiliser : .+$/m, `${nom} : « Quand l'utiliser »`);
    for (const section of SECTIONS_RECETTE) assert.ok(texte.includes(`\n${section}\n`), `${nom} : ${section}`);
    assert.match(texte, /# language: fr/, `${nom} : scénarios en français`);
  }
});

test("chaque recette ou référence citée existe", () => {
  const textes = [...fs.readdirSync(path.join(REF, "contexte")).map((f) => path.join(REF, "contexte", f)), path.join(REF, "fiche.md"), path.join(REF, "technical.md"), path.join(REF, "theme.md")];
  for (const d of ["recettes"]) for (const f of fs.readdirSync(path.join(REF, d))) textes.push(path.join(REF, d, f));
  const manquantes = [];
  for (const f of textes) {
    for (const [, nom] of lire(f).matchAll(/pulse-aidd pile recette ([a-z][a-z-]*)/g))
      if (!fs.existsSync(path.join(REF, "recettes", `${nom}.md`))) manquantes.push(`${path.basename(f)} : ${nom}`);
  }
  assert.deepStrictEqual(manquantes, []);
});

test("le pack reste générique : aucune mention d'une formation, d'un formateur ou de stagiaires", () => {
  const trouves = [];
  (function parcourir(dossier) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (!/\.(ico|png)$/.test(e.name) && e.name !== path.basename(__filename)) {
        const lignes = fs.readFileSync(chemin, "utf8").split("\n");
        lignes.forEach((ligne, i) => {
          // Mots entiers ; « atelier » en minuscules seulement (une séance), pas un nom propre (« Atelier Dupont »).
          if (/\b[Ff]ormat(eur|rice)s?\b|\b[Ss]tagiaires?\b|\b[Ee]n formation\b|\bsalle de formation\b|(?<![-\w])ateliers?(?![-\w])/.test(ligne))
            trouves.push(`${path.relative(RACINE, chemin)}:${i + 1}`);
        });
      }
    }
  })(RACINE);
  assert.deepStrictEqual(trouves, []);
});

test("aucune clé ressemblant à une vraie dans les références et le squelette", () => {
  const { trouverSecrets } = require(path.join(RACINE, "..", "pulse-vibe", "scripts", "motifs.js"));
  const trouves = [];
  (function parcourir(dossier) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (!/\.ico$/.test(e.name)) {
        const s = trouverSecrets(fs.readFileSync(chemin, "utf8"));
        if (s.length) trouves.push(`${path.relative(RACINE, chemin)} : ${s.join(", ")}`);
      }
    }
  })(RACINE);
  assert.deepStrictEqual(trouves, []);
});

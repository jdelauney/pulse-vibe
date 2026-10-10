// Tests de la montée de versions du squelette (scripts/verifier-squelette.js) et de la CI qui l'emploie.
// Lancer : node --test plugins/pulse-vibe-next/tests/verifier-squelette.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const net = require("net");
const os = require("os");
const SCRIPT = path.join(__dirname, "..", "scripts", "verifier-squelette.js");
const { poserPageDEssai, changementMajeur, monterLesVersions, lireArguments, portLibre, testsInstables, controlerInstables, rangerDossier, FICHIERS_DU_COEUR } = require(SCRIPT);
const DEPOT = path.join(__dirname, "..", "..", "..");
const CI_SQUELETTE = path.join(DEPOT, ".github", "workflows", "squelette-next.yml");

test("changement majeur au sens de npm : le premier nombre non nul", () => {
  assert.strictEqual(changementMajeur("1.4.0", "2.0.0"), true);
  assert.strictEqual(changementMajeur("1.4.0", "1.5.2"), false);
  assert.strictEqual(changementMajeur("0.45.3", "0.46.0"), true, "0.x : la deuxième position compte");
  assert.strictEqual(changementMajeur("0.45.3", "0.45.4"), false);
  assert.strictEqual(changementMajeur("0.0.1", "0.0.2"), true, "0.0.x : la troisième position compte");
  assert.strictEqual(changementMajeur("16.4.0", "16.4.0"), false);
});

test("--dernieres : les versions mineures montent, une version majeure reste en attente", () => {
  const paquet = {
    dependencies: { next: "16.4.0", "drizzle-orm": "0.45.3" },
    devDependencies: { vitest: "5.0.3", typescript: "7.0.2" },
  };
  const dernieres = { next: "16.5.1", "drizzle-orm": "0.46.0", vitest: "6.0.0", typescript: "7.0.2" };
  const r = monterLesVersions(paquet, { lireDerniere: (nom) => dernieres[nom] });
  assert.deepStrictEqual(r.changements, ["next 16.4.0 → 16.5.1"]);
  assert.deepStrictEqual(r.retenues, ["drizzle-orm 0.45.3 → 0.46.0", "vitest 5.0.3 → 6.0.0"]);
  assert.deepStrictEqual(paquet, {
    dependencies: { next: "16.5.1", "drizzle-orm": "0.45.3" },
    devDependencies: { vitest: "5.0.3", typescript: "7.0.2" },
  });
});

test("--dernieres --majeures : toutes les versions montent", () => {
  const paquet = { dependencies: { next: "16.4.0" }, devDependencies: { vitest: "5.0.3" } };
  const r = monterLesVersions(paquet, { majeures: true, lireDerniere: (nom) => ({ next: "17.0.0", vitest: "5.1.0" })[nom] });
  assert.deepStrictEqual(r.retenues, []);
  assert.deepStrictEqual(paquet, { dependencies: { next: "17.0.0" }, devDependencies: { vitest: "5.1.0" } });
  assert.strictEqual(lireArguments(["--dernieres", "--majeures"]).majeures, true);
  assert.throws(() => lireArguments(["--inconnue"]), /Option inconnue/);
});

test("CI hebdomadaire : mineures et majeures en demandes de fusion séparées, recettes vérifiées", () => {
  const ci = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".github", "workflows", "squelette-next.yml"), "utf8");
  assert.match(ci, /verifier-squelette\.js --dernieres --ecrire --e2e\n/, "mineures sans --majeures");
  assert.match(ci, /verifier-squelette\.js --dernieres --majeures --ecrire --e2e/);
  assert.match(ci, /branch: chore\/squelette-next-dernieres-versions/);
  assert.match(ci, /branch: chore\/squelette-next-versions-majeures/);
  // À chaque envoi : seulement les chaînes touchées, comparées à la base de l'envoi (historique complet).
  const verifier = ci.split(/^ {2}verifier:\n/m)[1].split(/^ {2}[a-z-]+:\n/m)[0];
  assert.match(verifier, /fetch-depth: 0/, "historique complet pour --depuis");
  assert.match(verifier, /verifier-recettes\.js --depuis "\$BASE"\n/);
  assert.ok(verifier.includes("BASE: ${{ github.event_name == 'pull_request' && format('origin/{0}', github.base_ref) || github.event.before }}"), "base : la branche visée, ou le commit d'avant l'envoi");
  // Chaque semaine et à la demande : toutes les chaînes, avec les mineures puis avec les majeures.
  assert.strictEqual((ci.match(/verifier-recettes\.js --toutes\n/g) || []).length, 2, "dernieres-versions et versions-majeures vérifient toutes les chaînes");
  assert.doesNotMatch(ci, /verifier-recettes\.js --recettes/, "les chaînes vivent dans CHAINES (verifier-recettes.js)");
});

test("--garder et --tolerer-instables", () => {
  assert.deepStrictEqual(
    [lireArguments([]).garder, lireArguments([]).tolererInstables, lireArguments(["--garder"]).garder, lireArguments(["--tolerer-instables"]).tolererInstables],
    [false, false, true, true],
  );
});

test("dossier temporaire : retiré à la fin ; gardé avec --garder ou après un échec ; un dossier donné n'est jamais retiré", () => {
  const nouveau = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-next-squelette-essai-"));
    fs.mkdirSync(path.join(d, "node_modules", "x"), { recursive: true });
    fs.writeFileSync(path.join(d, "node_modules", "x", "index.js"), "");
    return d;
  };
  const a = nouveau();
  assert.strictEqual(rangerDossier({ dossier: a, temporaire: true, garder: false, echec: false }), null);
  assert.ok(!fs.existsSync(a), "retiré");
  const b = nouveau();
  assert.match(rangerDossier({ dossier: b, temporaire: true, garder: true, echec: false }), /Dossier gardé : /);
  assert.ok(fs.existsSync(b));
  const c = nouveau();
  assert.match(rangerDossier({ dossier: c, temporaire: true, garder: false, echec: true }), /pour regarder l'échec/);
  assert.ok(fs.existsSync(c));
  const d = nouveau();
  assert.strictEqual(rangerDossier({ dossier: d, temporaire: false, garder: false, echec: false }), null);
  assert.ok(fs.existsSync(d));
  for (const x of [b, c, d]) fs.rmSync(x, { recursive: true, force: true });
});

test("port de l'audit : un port libre, accepté par le navigateur, plus de port fixe", async () => {
  const { PORTS_BLOQUES } = require(path.join(__dirname, "..", "..", "pulse-vibe", "scripts", "port-libre.js"));
  const port = await portLibre();
  assert.ok(Number.isInteger(port) && port > 0 && !PORTS_BLOQUES.has(port), String(port));
  const s = net.createServer();
  await new Promise((ok, ko) => {
    s.once("error", ko);
    s.listen(port, "127.0.0.1", ok);
  });
  await new Promise((ok) => s.close(ok));
  assert.doesNotMatch(fs.readFileSync(SCRIPT, "utf8"), /\b3123\b/);
});

test("tests instables : relevés dans le rapport JSON de Playwright, à toute profondeur", () => {
  const rapport = {
    suites: [
      {
        title: "accueil.spec.ts",
        specs: [
          { title: "la page répond", file: "accueil.spec.ts", line: 8, tests: [{ projectName: "ordinateur", status: "expected" }, { projectName: "telephone", status: "flaky" }] },
        ],
        suites: [{ title: "groupe", specs: [{ title: "axe", file: "accueil.spec.ts", line: 20, tests: [{ projectName: "ordinateur", status: "flaky" }] }] }],
      },
    ],
  };
  assert.deepStrictEqual(testsInstables(rapport), ["[telephone] accueil.spec.ts:8 la page répond", "[ordinateur] accueil.spec.ts:20 axe"]);
  assert.deepStrictEqual(testsInstables({ suites: [] }), []);
  assert.deepStrictEqual(testsInstables(null), []);
});

// Un rapport JSON de Playwright écrit dans un dossier temporaire (null : aucun fichier ; texte : contenu brut).
function rapportEcrit(contenu) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-rapport-e2e-"));
  const fichier = path.join(dossier, "rapport-e2e.json");
  if (contenu !== null) fs.writeFileSync(fichier, typeof contenu === "string" ? contenu : JSON.stringify(contenu));
  return { fichier, retirer: () => fs.rmSync(dossier, { recursive: true, force: true }) };
}
const unTest = (status) => ({ suites: [{ title: "a.spec.ts", specs: [{ title: "la page répond", file: "a.spec.ts", line: 3, tests: [{ projectName: "ordinateur", status }] }] }] });

test("contrôle des tests instables : sans relance, rien ; un test instable fait échouer, ou avertit avec --tolerer-instables", () => {
  const propre = rapportEcrit(unTest("expected"));
  const instable = rapportEcrit(unTest("flaky"));
  try {
    for (const tolerer of [false, true]) assert.deepStrictEqual(controlerInstables(propre.fichier, tolerer), { echec: false, message: null });
    const echec = controlerInstables(instable.fichier, false);
    assert.strictEqual(echec.echec, true);
    assert.match(echec.message, /^\n❌ Échec : 1 test\(s\) instable\(s\)/);
    assert.match(echec.message, /\[ordinateur\] a\.spec\.ts:3 la page répond/);
    assert.match(echec.message, /Pour les signaler sans échouer : --tolerer-instables/);
    const tolere = controlerInstables(instable.fichier, true);
    assert.strictEqual(tolere.echec, false);
    assert.match(tolere.message, /^\n⚠️ 1 test\(s\) instable\(s\)/);
    assert.match(tolere.message, /\[ordinateur\] a\.spec\.ts:3 la page répond/);
  } finally {
    propre.retirer();
    instable.retirer();
  }
});

test("contrôle des tests instables : rapport absent ou illisible, échec avec un message clair, même avec --tolerer-instables", () => {
  const absent = rapportEcrit(null);
  const tronque = rapportEcrit('{"suites": [{"title": "a.spec');
  try {
    for (const tolerer of [false, true]) {
      assert.deepStrictEqual(controlerInstables(absent.fichier, tolerer), { echec: true, message: `\n❌ Échec : rapport JSON de Playwright introuvable (${absent.fichier})` });
      const illisible = controlerInstables(tronque.fichier, tolerer);
      assert.strictEqual(illisible.echec, true);
      assert.ok(illisible.message.startsWith(`\n❌ Échec : rapport JSON de Playwright illisible (${tronque.fichier} : `), illisible.message);
    }
  } finally {
    absent.retirer();
    tronque.retirer();
  }
});

test("bout en bout : un échec du contrôle des tests instables arrête le script (dossier gardé par le code de sortie)", () => {
  const source = fs.readFileSync(SCRIPT, "utf8");
  assert.match(source, /const controle = controlerInstables\(rapportE2e, opts\.tolererInstables\);/);
  assert.match(source, /if \(controle\.echec\) process\.exit\(1\);/);
});

test("bout en bout : rapport JSON demandé à Playwright, navigateur avec ses dépendances système seulement sous Linux", () => {
  const source = fs.readFileSync(SCRIPT, "utf8");
  assert.match(source, /npm run test:e2e -- --reporter=list,json/);
  assert.match(source, /PLAYWRIGHT_JSON_OUTPUT_NAME/);
  assert.match(source, /process\.platform === "linux"/);
});

test("bout en bout : la page d'essai de la surveillance et son test, posés avant les tests de bout en bout, seulement dans le projet de vérification", () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-page-essai-"));
  try {
    poserPageDEssai(dossier);
    const page = fs.readFileSync(path.join(dossier, "app", "essai-surveillance", "page.tsx"), "utf8");
    assert.match(page, /^"use client";/);
    assert.match(page, /throw new Error\("Erreur d'essai de la surveillance"\)/);
    const essai = fs.readFileSync(path.join(dossier, "e2e", "essai-surveillance.spec.ts"), "utf8");
    assert.match(essai, /r\.url\(\)\.endsWith\("\/api\/erreur-client"\)/);
    assert.match(essai, /name: "Un problème est survenu"/);
  } finally {
    fs.rmSync(dossier, { recursive: true, force: true });
  }
  const source = fs.readFileSync(SCRIPT, "utf8");
  assert.deepStrictEqual(source.match(/poserPageDEssai\(/g), ["poserPageDEssai(", "poserPageDEssai("], "une définition et un seul appel");
  assert.match(source, /^function poserPageDEssai\(dossier\) \{$/m);
  assert.match(source, /^ {4}poserPageDEssai\(dossier\);$/m);
  assert.ok(source.indexOf("poserPageDEssai(dossier);") < source.indexOf("npm run test:e2e -- --reporter"), "posée avant npm run test:e2e");
  assert.ok(source.indexOf('lancer("npm run build"') < source.indexOf("poserPageDEssai(dossier);"), "absente de la construction de vérification");
});

// Motif de chemin de GitHub Actions → expression régulière (** : tout ; * : tout sauf /).
const motifEnRegExp = (motif) =>
  new RegExp(`^${motif.split("**").map((morceau) => morceau.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")).join(".*")}$`);

// Chemins d'un déclencheur (push ou pull_request) de la CI.
function cheminsDeclencheurs(yml, evenement) {
  const bloc = yml.split(new RegExp(`^  ${evenement}:\\n`, "m"))[1].split(/^ {2}[a-z_]+:\n/m)[0];
  return [...bloc.matchAll(/^\s+- "([^"]+)"$/gm)].map((m) => m[1]);
}

// Fichiers du cœur que lance verifier-squelette, ceux qu'ils chargent par require("./…"), de proche en proche,
// et les fichiers de données qu'ils lisent par un chemin écrit en entier : path.join(__dirname, "…", …).
// Limite : un chemin calculé (variable, gabarit) n'est pas suivi ; un tel fichier s'ajoute à la main aux déclencheurs de la CI.
function fichiersDuCoeur() {
  const vus = new Set();
  const aVoir = [...FICHIERS_DU_COEUR];
  while (aVoir.length) {
    const f = aVoir.pop();
    if (vus.has(f)) continue;
    vus.add(f);
    const source = fs.readFileSync(f, "utf8");
    for (const m of source.matchAll(/require\("\.\/([\w-]+)(?:\.js)?"\)/g)) aVoir.push(path.join(path.dirname(f), `${m[1]}.js`));
    for (const m of source.matchAll(/path\.join\(__dirname((?:,\s*"[^"]+")+)\)/g)) {
      const donnee = path.join(path.dirname(f), ...[...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
      if (fs.existsSync(donnee) && fs.statSync(donnee).isFile()) vus.add(donnee);
    }
  }
  return [...vus].map((f) => path.relative(DEPOT, f).split(path.sep).join("/"));
}

test("CI du squelette : chaque fichier du cœur qu'utilise verifier-squelette la déclenche", { skip: !fs.existsSync(CI_SQUELETTE) && "hors du dépôt" }, () => {
  const yml = fs.readFileSync(CI_SQUELETTE, "utf8");
  const coeur = fichiersDuCoeur();
  assert.ok(coeur.includes("plugins/pulse-vibe/scripts/robots.js"), "require suivis de proche en proche");
  assert.ok(coeur.includes("plugins/pulse-vibe/references/seo/robots-ia.json"), "fichiers de données lus par path.join(__dirname, …)");
  for (const evenement of ["push", "pull_request"]) {
    const motifs = cheminsDeclencheurs(yml, evenement).map(motifEnRegExp);
    for (const f of coeur) assert.ok(motifs.some((m) => m.test(f)), `${evenement} : ${f}`);
  }
});

test("CI du squelette : vérification chaque semaine sous Windows", { skip: !fs.existsSync(CI_SQUELETTE) && "hors du dépôt" }, () => {
  const job = fs.readFileSync(CI_SQUELETTE, "utf8").split(/^ {2}windows:\n/m)[1];
  assert.ok(job, "job windows");
  const bloc = job.split(/^ {2}[a-z-]+:\n/m)[0];
  assert.match(bloc, /if: github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(bloc, /runs-on: windows-latest/);
  assert.match(bloc, /verifier-squelette\.js --e2e\n/);
});

test("CI du squelette : un test instable avertit à chaque envoi, fait échouer la vérification hebdomadaire", { skip: !fs.existsSync(CI_SQUELETTE) && "hors du dépôt" }, () => {
  const yml = fs.readFileSync(CI_SQUELETTE, "utf8");
  const verifier = yml.split(/^ {2}verifier:\n/m)[1].split(/^ {2}[a-z-]+:\n/m)[0];
  assert.match(verifier, /verifier-squelette\.js --e2e --tolerer-instables\n/);
  assert.strictEqual(yml.match(/--tolerer-instables/g).length, 1, "seulement dans le job de chaque envoi");
});

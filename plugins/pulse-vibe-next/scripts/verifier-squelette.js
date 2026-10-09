#!/usr/bin/env node
// Pulse Next.js – vérification du squelette (outil du dépôt : CI hebdomadaire et maintenance).
//
//   node plugins/pulse-vibe-next/scripts/verifier-squelette.js [--dernieres [--majeures]] [--ecrire] [--e2e [--tolerer-instables]] [--dossier <chemin>] [--garder]
//
//   --dernieres   passe chaque dépendance à sa dernière version publiée (npm view) avant de vérifier,
//                 sauf un changement de version majeure, signalé et laissé tel quel
//   --majeures    avec --dernieres : monte aussi les versions majeures (demande de fusion à part)
//   --ecrire      si tout passe, reporte ces versions dans templates/squelette/package.json (et biome.json)
//   --e2e         lance aussi les tests de bout en bout (Chromium doit être installé) et l'audit de
//                 référencement du site servi (scripts/seo.js du cœur)
//   --tolerer-instables  avec --e2e : un test qui passe seulement après une relance est signalé sans faire
//                 échouer (par défaut : échec, une relance masque le problème, references/tests/strategie.md §4)
//   --garder      garde le dossier temporaire et l'indique (il est gardé aussi après un échec) ;
//                 sans --garder, il est retiré à la fin. Un dossier donné par --dossier n'est jamais retiré.
//
// Crée un projet avec le squelette dans un dossier temporaire, puis : npm install, npm run check,
// npm run typecheck, npm test, npm run build, contrôles du code pour le référencement (seo-code.js)
// (et npm run test:e2e, puis audit du site servi). Sort en erreur au premier échec.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { spawn, spawnSync } = require("child_process");
const { creerSquelette } = require("./squelette");

const MODELE = path.join(__dirname, "..", "templates", "squelette");
const COEUR = path.join(__dirname, "..", "..", "pulse-vibe", "scripts");
const AUDIT_SEO = path.join(COEUR, "seo.js");
const PORT_LIBRE = path.join(COEUR, "port-libre.js");
// Les fichiers du cœur que ce script lance ou charge : la CI du squelette se déclenche aussi sur eux.
const FICHIERS_DU_COEUR = [AUDIT_SEO, PORT_LIBRE];

/** Un port local libre, accepté par fetch et les navigateurs (port-libre.js du cœur). */
async function portLibre() {
  const { ecouter } = require(PORT_LIBRE);
  const serveur = net.createServer();
  const port = await ecouter(serveur);
  await new Promise((ok) => serveur.close(ok));
  return port;
}

/** Tests que Playwright a dû relancer pour qu'ils passent (statut « flaky » du rapport JSON), à toute profondeur. */
function testsInstables(rapport) {
  const trouves = [];
  const parcourir = (suite) => {
    for (const spec of suite.specs || []) for (const t of spec.tests || []) if (t.status === "flaky") trouves.push(`[${t.projectName}] ${spec.file}:${spec.line} ${spec.title}`);
    for (const s of suite.suites || []) parcourir(s);
  };
  for (const s of (rapport && rapport.suites) || []) parcourir(s);
  return trouves;
}

/**
 * Après le bout en bout : un test instable fait échouer, sauf --tolerer-instables (signalé seulement).
 * Un rapport absent ou illisible fait toujours échouer. Rend { echec, message } (message : null s'il n'y a rien à dire).
 */
function controlerInstables(fichier, tolerer) {
  if (!fs.existsSync(fichier)) return { echec: true, message: `\n❌ Échec : rapport JSON de Playwright introuvable (${fichier})` };
  let rapport;
  try {
    rapport = JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch (e) {
    return { echec: true, message: `\n❌ Échec : rapport JSON de Playwright illisible (${fichier} : ${e.message})` };
  }
  const instables = testsInstables(rapport);
  if (!instables.length) return { echec: false, message: null };
  const liste = instables.map((x) => `  - ${x}`).join("\n");
  if (tolerer) return { echec: false, message: `\n⚠️ ${instables.length} test(s) instable(s), passé(s) seulement après une relance :\n${liste}` };
  return {
    echec: true,
    message: `\n❌ Échec : ${instables.length} test(s) instable(s), passé(s) seulement après une relance (une relance masque le problème : references/tests/strategie.md §4) :\n${liste}\n   Pour les signaler sans échouer : --tolerer-instables`,
  };
}

/** Fin du script : retire le dossier temporaire, sauf --garder ou échec ; un dossier donné (--dossier) reste. Rend le message à afficher, ou null. */
function rangerDossier({ dossier, temporaire, garder, echec }) {
  if (!temporaire) return null;
  if (garder || echec) return `Dossier gardé : ${dossier}${garder ? "" : " (pour regarder l'échec ; à supprimer ensuite)"}`;
  try {
    fs.rmSync(dossier, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (e) {
    return `Dossier temporaire non retiré (${e.message}) : ${dossier}`;
  }
  return null;
}

/** Contrôles du code pour le référencement : aucun constat Critique ni Haute attendu sur le squelette. */
function controlerCodeSeo(dossier) {
  console.log("\n▶ contrôles du code pour le référencement (seo-code.js)");
  const r = spawnSync(process.execPath, [path.join(__dirname, "seo-code.js"), "--dossier", dossier, "--json"], { encoding: "utf8" });
  const { constats } = JSON.parse(r.stdout);
  const graves = constats.filter((x) => x.gravite === "critique" || x.gravite === "haute");
  for (const x of constats) console.log(`  ${x.gravite} – ${x.code} ${x.message}`);
  if (graves.length) {
    console.error(`\n❌ Échec : ${graves.length} constat(s) Critique ou Haute dans le code du squelette`);
    process.exit(1);
  }
}

/** Sert la construction (next start, sur un port dédié), lance l'audit du cœur, puis arrête ce serveur seulement. */
async function auditerSiteServi(dossier) {
  if (!fs.existsSync(AUDIT_SEO)) {
    console.log("\n(audit de référencement sauté : plugin pulse absent à côté du pack, dans plugins/pulse-vibe/)");
    return;
  }
  const port = await portLibre();
  const adresse = `http://localhost:${port}`;
  console.log(`\n▶ audit de référencement du site servi (${adresse})`);
  const serveur = spawn(process.execPath, [path.join(dossier, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port)], { cwd: dossier, stdio: "ignore" });
  let arret = null;
  serveur.on("exit", (code, signal) => {
    arret = code ?? signal;
  });
  try {
    let pret = false;
    for (let i = 0; i < 60 && !pret; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      // Un serveur arrêté : le port a été pris entre-temps ; ne pas auditer un autre site qui y répondrait.
      if (arret !== null) throw new Error(`le serveur s'est arrêté (${arret}) : port ${port} pris par un autre programme ?`);
      pret = await fetch(adresse).then((x) => x.status === 200, () => false);
    }
    if (!pret) throw new Error("le serveur ne répond pas sur " + adresse);
    const r = spawnSync(process.execPath, [AUDIT_SEO, adresse, "--ia", "--json", "--delai", "0"], { encoding: "utf8" });
    const rapport = JSON.parse(r.stdout);
    for (const x of rapport.constats) console.log(`  ${x.gravite} – ${x.code} ${x.message}`);
    console.log(`  Bilan : ${rapport.bilan.critique} Critique · ${rapport.bilan.haute} Haute · ${rapport.bilan.moyenne} Moyenne · ${rapport.bilan.basse} Basse`);
    if (rapport.bilan.critique || rapport.bilan.haute) throw new Error("constat Critique ou Haute sur le squelette servi");
  } catch (e) {
    console.error(`\n❌ Échec : audit de référencement (${e.message})`);
    process.exitCode = 1;
  } finally {
    serveur.kill();
  }
}

function lireArguments(argv) {
  const opts = { dernieres: false, majeures: false, ecrire: false, e2e: false, dossier: null, garder: false, tolererInstables: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dernieres") opts.dernieres = true;
    else if (a === "--majeures") opts.majeures = true;
    else if (a === "--ecrire") opts.ecrire = true;
    else if (a === "--e2e") opts.e2e = true;
    else if (a === "--dossier") opts.dossier = path.resolve(argv[++i]);
    else if (a === "--garder") opts.garder = true;
    else if (a === "--tolerer-instables") opts.tolererInstables = true;
    else throw new Error(`Option inconnue : ${a}`);
  }
  return opts;
}

function lancer(commande, cwd, env = {}) {
  console.log(`\n▶ ${commande}`);
  const r = spawnSync(commande, { cwd, shell: true, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`\n❌ Échec : ${commande} (code ${r.status})`);
    process.exit(1);
  }
}

const IMPORT_INTERDIT = "lint/style/noRestrictedImports";
const REEXPORT_TOUT = "lint/performance/noReExportAll";
const BARREL = "lint/performance/noBarrelFile";

/** Fichiers d'essai : `regle` = règle Biome qui doit les signaler ; `regle: null` = aucun diagnostic de cette famille attendu. */
function fixturesDeCouches() {
  const f = (chemin, contenu, regle = IMPORT_INTERDIT) => ({ chemin, contenu, regle });
  const importe = (nom, source) => `import { ${nom} } from "${source}";\n\nexport const ${nom}2 = ${nom};\n`;
  const core = (nom, source) => f(`src/core/verification/${nom}.rules.ts`, importe("x", source));
  const action = importe("creer", "../../actions/essai.action");
  return [
    core("react", "react"),
    core("lib-alias", "@src/lib/utils"),
    core("lib-relatif", "../../lib/verification/x"),
    core("config-relatif", "../../config/verification/x"),
    core("components-relatif", "../../components/verification/x"),
    core("app-relatif", "../../app/verification/x"),
    f("src/db/verification/essai.repository.ts", importe("essai", "@src/adapters/verification/essai.adapter")),
    f("src/adapters/verification/essai.adapter.ts", importe("e", "@src/db/verification/essai.repository")),
    f("src/adapters/auth/essai-auth.ts", importe("x", "@src/features/verification/essai")),
    f("src/features/verification/components/containers/essai.container.tsx", importe("db", "@src/db/verification/essai.repository")),
    f("src/features/verification/components/sections/essai.tsx", importe("c", "../containers/essai.container")),
    f("src/features/verification/components/composites/essai.tsx", importe("s", "../sections/essai")),
    f("src/features/verification/components/elements/essai.tsx", importe("c", "../composites/essai")),
    f("src/components/shared/elements/essai.tsx", importe("c", "../composites/essai")),
    f("src/features/verification/components/sections/essai-action.tsx", action),
    // Les tests d'un composant peuvent importer ce que le composant ignore.
    f("src/features/verification/components/sections/__tests__/essai.test.tsx", action, null),
    f("src/lib/verification/index.ts", 'export * from "./essai";\n', REEXPORT_TOUT),
    f("src/lib/verification-nomme/index.ts", 'export { a } from "./a";\n', BARREL),
  ];
}

/** Diagnostics de `biome lint` par fichier : { "chemin/relatif": [catégories] }. */
function diagnosticsBiome(dossier, chemins) {
  const r = spawnSync(`npx biome lint --reporter=json --max-diagnostics=500 ${chemins.join(" ")}`, { cwd: dossier, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const ligne = (r.stdout || "").split("\n").find((l) => l.startsWith('{"summary"'));
  if (!ligne) throw new Error(`\n❌ Sortie JSON de Biome illisible :\n${r.stdout || ""}${r.stderr || ""}`);
  const parFichier = {};
  for (const d of JSON.parse(ligne).diagnostics) {
    const chemin = String(d.location?.path?.file ?? d.location?.path ?? "").replace(/\\/g, "/");
    (parFichier[chemin] ||= []).push(d.category);
  }
  return parFichier;
}

/**
 * Garde des règles de couches de biome.json : une importation interdite par dossier, plus des fichiers
 * de réexportation, écrits dans le dossier temporaire ; Biome (rapport JSON) doit les signaler par la règle
 * visée, et épargner les tests des composants et src/lib/utils.ts. Les fichiers créés sont toujours retirés.
 */
function controlerReglesDeCouches(dossier) {
  console.log("\n▶ garde des règles de couches (Biome)");
  const fixtures = fixturesDeCouches();
  const crees = []; // seulement ce que la garde crée : dossiers nouveaux et fichiers
  const manques = [];
  try {
    for (const { chemin, contenu } of fixtures) {
      const complet = path.join(dossier, ...chemin.split("/"));
      const premierDossier = fs.mkdirSync(path.dirname(complet), { recursive: true });
      if (premierDossier) crees.push(premierDossier);
      fs.writeFileSync(complet, contenu);
      crees.push(complet);
    }
    const diag = diagnosticsBiome(dossier, [...fixtures.map((x) => x.chemin), "src/lib/utils.ts"]);
    for (const { chemin, regle } of fixtures) {
      const categories = diag[chemin] || [];
      if (regle && !categories.includes(regle)) manques.push(`${chemin} (attendu : ${regle}, reçu : ${categories.join(", ") || "rien"})`);
      if (!regle && categories.includes(IMPORT_INTERDIT)) manques.push(`${chemin} (ne doit pas être restreint, mais ${IMPORT_INTERDIT} le signale)`);
    }
    if (!fs.existsSync(path.join(dossier, "src", "lib", "utils.ts"))) manques.push("src/lib/utils.ts est introuvable : la garde ne peut pas vérifier l'absence de diagnostic barrel");
    const utils = diag["src/lib/utils.ts"] || [];
    if (utils.some((c) => c === BARREL || c === REEXPORT_TOUT)) manques.push(`src/lib/utils.ts (la réexportation shadcn ne doit pas être signalée, reçu : ${utils.join(", ")})`);
  } catch (erreur) {
    manques.push(erreur.message);
  } finally {
    for (const c of crees.reverse()) fs.rmSync(c, { recursive: true, force: true });
  }
  if (manques.length) {
    console.error(`\n❌ Les règles de couches de biome.json ne se comportent pas comme prévu :\n  - ${manques.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`   ${fixtures.length} fichiers d'essai : chaque règle attendue signale le sien ; tests de composants et utils.ts épargnés.`);
}

function derniereVersion(paquet) {
  const r = spawnSync(`npm view ${paquet} version`, { shell: true, encoding: "utf8" });
  const v = (r.stdout || "").trim();
  if (r.status !== 0 || !/^\d+\.\d+\.\d+/.test(v)) throw new Error(`Version introuvable pour ${paquet}`);
  return v;
}

/**
 * Changement majeur au sens de npm (^) : le premier nombre non nul change.
 * 1.4.0 → 2.0.0, 0.45.3 → 0.46.0 et 0.0.1 → 0.0.2 sont majeurs ; 1.4.0 → 1.5.2 et 0.45.3 → 0.45.4 ne le sont pas.
 */
function changementMajeur(actuelle, derniere) {
  const [a, b] = [actuelle, derniere].map((v) => v.split(/[.+-]/).slice(0, 3).map(Number));
  const rang = a[0] !== 0 ? 0 : a[1] !== 0 ? 1 : 2;
  return a.slice(0, rang + 1).join(".") !== b.slice(0, rang + 1).join(".");
}

/**
 * Passe les dépendances à leur dernière version ; un changement majeur reste en attente, sauf avec `majeures`.
 * Rend { changements, retenues } : des lignes « paquet actuelle → dernière ».
 */
function monterLesVersions(paquet, { majeures = false, lireDerniere = derniereVersion } = {}) {
  const changements = [];
  const retenues = [];
  for (const groupe of ["dependencies", "devDependencies"]) {
    for (const [nom, actuelle] of Object.entries(paquet[groupe] || {})) {
      const derniere = lireDerniere(nom);
      if (derniere === actuelle) continue;
      const ligne = `${nom} ${actuelle} → ${derniere}`;
      if (changementMajeur(actuelle, derniere) && !majeures) {
        retenues.push(ligne);
        continue;
      }
      changements.push(ligne);
      paquet[groupe][nom] = derniere;
    }
  }
  return { changements, retenues };
}

/** Le schéma de biome.json porte la version de Biome : il la suit. */
function accorderBiome(fichier, versionBiome) {
  const texte = fs.readFileSync(fichier, "utf8");
  fs.writeFileSync(fichier, texte.replace(/schemas\/[\d.]+\/schema\.json/, `schemas/${versionBiome}/schema.json`));
}

async function principal() {
  const opts = lireArguments(process.argv.slice(2));
  const temporaire = !opts.dossier;
  const dossier = opts.dossier || fs.mkdtempSync(path.join(os.tmpdir(), "pulse-next-squelette-"));
  // Chaque vérification laissait environ 800 Mo dans le dossier temporaire du système.
  process.on("exit", (code) => {
    const message = rangerDossier({ dossier, temporaire, garder: opts.garder, echec: code !== 0 });
    if (message) console.log(message);
  });
  process.on("SIGINT", () => process.exit(130));
  creerSquelette({ nom: "Projet de vérification", description: "Vérification automatique du squelette.", dossier });
  console.log(`Squelette créé dans ${dossier}`);

  const fichierPaquet = path.join(dossier, "package.json");
  const paquet = JSON.parse(fs.readFileSync(fichierPaquet, "utf8"));
  let changements = [];
  if (opts.dernieres) {
    const montee = monterLesVersions(paquet, { majeures: opts.majeures });
    changements = montee.changements;
    fs.writeFileSync(fichierPaquet, `${JSON.stringify(paquet, null, 2)}\n`);
    accorderBiome(path.join(dossier, "biome.json"), paquet.devDependencies["@biomejs/biome"]);
    console.log(changements.length ? `Versions montées :\n  ${changements.join("\n  ")}` : "Aucune version à monter.");
    if (montee.retenues.length) console.log(`Versions majeures en attente (vérification à part : --dernieres --majeures) :\n  ${montee.retenues.join("\n  ")}`);
  }

  lancer("npm install --no-audit --no-fund", dossier);
  lancer("npm run check", dossier);
  lancer("npm run typecheck", dossier);
  controlerReglesDeCouches(dossier);
  lancer("npm test", dossier);
  // drizzle-kit (et son esbuild) doit fonctionner après une installation neuve ; generate ne se connecte pas.
  // Le squelette n'a pas encore de table : une table d'essai, dans le dossier temporaire seulement,
  // vérifie que drizzle-kit trouve les tables par motif et génère une migration.
  fs.mkdirSync(path.join(dossier, "src", "db", "verification"), { recursive: true });
  fs.writeFileSync(path.join(dossier, "src", "db", "verification", "essai.table.ts"), 'import { pgTable, text } from "drizzle-orm/pg-core";\n\nexport const essais = pgTable("essais", { id: text("id").primaryKey() });\n');
  lancer("npm run db:generate", dossier, { DATABASE_URL_DIRECT: "postgresql://verification@localhost:5432/verification" });
  // La construction de vérification se fait sans variables : t3 env saute alors la validation.
  lancer("npm run build", dossier, { SKIP_ENV_VALIDATION: "1" });
  controlerCodeSeo(dossier);
  if (opts.e2e) {
    // En CI sous Linux, --with-deps installe aussi les bibliothèques système du navigateur.
    lancer(`npx playwright install ${process.env.CI && process.platform === "linux" ? "--with-deps " : ""}chromium`, dossier);
    // Rapport JSON en plus de la liste : les relances (retries de la configuration en CI) y laissent le statut « flaky ».
    const rapportE2e = path.join(dossier, "rapport-e2e.json");
    lancer("npm run test:e2e -- --reporter=list,json", dossier, { CI: "true", SKIP_ENV_VALIDATION: "1", PLAYWRIGHT_JSON_OUTPUT_NAME: rapportE2e, PLAYWRIGHT_JSON_OUTPUT_FILE: rapportE2e });
    const controle = controlerInstables(rapportE2e, opts.tolererInstables);
    if (controle.message) (controle.echec ? console.error : console.log)(controle.message);
    if (controle.echec) process.exit(1);
    await auditerSiteServi(dossier);
    if (process.exitCode) process.exit(1);
  }

  if (opts.ecrire && changements.length) {
    const modele = JSON.parse(fs.readFileSync(path.join(MODELE, "package.json"), "utf8"));
    for (const groupe of ["dependencies", "devDependencies"]) for (const nom of Object.keys(modele[groupe] || {})) modele[groupe][nom] = paquet[groupe][nom];
    fs.writeFileSync(path.join(MODELE, "package.json"), `${JSON.stringify(modele, null, 2)}\n`);
    accorderBiome(path.join(MODELE, "biome.json"), paquet.devDependencies["@biomejs/biome"]);
    console.log("\nVersions reportées dans templates/squelette/package.json.");
  }
  console.log(`\n✅ Squelette vérifié${changements.length ? ` avec ${changements.length} mise(s) à jour` : ""}.`);
}

if (require.main === module) principal();

module.exports = { changementMajeur, monterLesVersions, lireArguments, portLibre, testsInstables, controlerInstables, rangerDossier, FICHIERS_DU_COEUR };

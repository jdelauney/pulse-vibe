#!/usr/bin/env node
// Pulse Next.js – vérification du squelette (outil du dépôt : CI hebdomadaire et maintenance).
//
//   node plugins/pulse-vibe-next/scripts/verifier-squelette.js [--dernieres] [--ecrire] [--e2e] [--dossier <chemin>]
//
//   --dernieres   passe chaque dépendance à sa dernière version publiée (npm view) avant de vérifier
//   --ecrire      si tout passe, reporte ces versions dans templates/squelette/package.json (et biome.json)
//   --e2e         lance aussi les tests de bout en bout (Chromium doit être installé) et l'audit de
//                 référencement du site servi (scripts/seo.js du cœur)
//
// Crée un projet avec le squelette dans un dossier temporaire, puis : npm install, npm run check,
// npm run typecheck, npm test, npm run build, contrôles du code pour le référencement (seo-code.js)
// (et npm run test:e2e, puis audit du site servi). Sort en erreur au premier échec.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { creerSquelette } = require("./squelette");

const MODELE = path.join(__dirname, "..", "templates", "squelette");
const AUDIT_SEO = path.join(__dirname, "..", "..", "pulse-vibe", "scripts", "seo.js");

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
    console.log("\n(audit de référencement sauté : plugin pulse-vibe absent à côté du pack)");
    return;
  }
  const port = 3123;
  const adresse = `http://localhost:${port}`;
  console.log(`\n▶ audit de référencement du site servi (${adresse})`);
  const serveur = spawn(process.execPath, [path.join(dossier, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port)], { cwd: dossier, stdio: "ignore" });
  try {
    let pret = false;
    for (let i = 0; i < 60 && !pret; i++) {
      await new Promise((r) => setTimeout(r, 1000));
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
  const opts = { dernieres: false, ecrire: false, e2e: false, dossier: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dernieres") opts.dernieres = true;
    else if (a === "--ecrire") opts.ecrire = true;
    else if (a === "--e2e") opts.e2e = true;
    else if (a === "--dossier") opts.dossier = path.resolve(argv[++i]);
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

function derniereVersion(paquet) {
  const r = spawnSync(`npm view ${paquet} version`, { shell: true, encoding: "utf8" });
  const v = (r.stdout || "").trim();
  if (r.status !== 0 || !/^\d+\.\d+\.\d+/.test(v)) throw new Error(`Version introuvable pour ${paquet}`);
  return v;
}

/** Passe les dépendances à leur dernière version ; rend la liste des changements. */
function monterLesVersions(paquet) {
  const changements = [];
  for (const groupe of ["dependencies", "devDependencies"]) {
    for (const [nom, actuelle] of Object.entries(paquet[groupe] || {})) {
      const derniere = derniereVersion(nom);
      if (derniere !== actuelle) {
        changements.push(`${nom} ${actuelle} → ${derniere}`);
        paquet[groupe][nom] = derniere;
      }
    }
  }
  return changements;
}

/** Le schéma de biome.json porte la version de Biome : il la suit. */
function accorderBiome(fichier, versionBiome) {
  const texte = fs.readFileSync(fichier, "utf8");
  fs.writeFileSync(fichier, texte.replace(/schemas\/[\d.]+\/schema\.json/, `schemas/${versionBiome}/schema.json`));
}

async function principal() {
  const opts = lireArguments(process.argv.slice(2));
  const dossier = opts.dossier || fs.mkdtempSync(path.join(os.tmpdir(), "pulse-next-squelette-"));
  creerSquelette({ nom: "Projet de vérification", description: "Vérification automatique du squelette.", dossier });
  console.log(`Squelette créé dans ${dossier}`);

  const fichierPaquet = path.join(dossier, "package.json");
  const paquet = JSON.parse(fs.readFileSync(fichierPaquet, "utf8"));
  let changements = [];
  if (opts.dernieres) {
    changements = monterLesVersions(paquet);
    fs.writeFileSync(fichierPaquet, `${JSON.stringify(paquet, null, 2)}\n`);
    accorderBiome(path.join(dossier, "biome.json"), paquet.devDependencies["@biomejs/biome"]);
    console.log(changements.length ? `Versions montées :\n  ${changements.join("\n  ")}` : "Toutes les dépendances sont déjà à leur dernière version.");
  }

  lancer("npm install --no-audit --no-fund", dossier);
  lancer("npm run check", dossier);
  lancer("npm run typecheck", dossier);
  lancer("npm test", dossier);
  // drizzle-kit (et son esbuild) doit fonctionner après une installation neuve ; generate ne se connecte pas.
  lancer("npm run db:generate", dossier, { DATABASE_URL_DIRECT: "postgresql://verification@localhost:5432/verification" });
  lancer("npm run build", dossier);
  controlerCodeSeo(dossier);
  if (opts.e2e) {
    // En CI (Linux), --with-deps installe aussi les bibliothèques système du navigateur.
    lancer(`npx playwright install ${process.env.CI ? "--with-deps " : ""}chromium`, dossier);
    lancer("npm run test:e2e", dossier, { CI: "true" });
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

principal();

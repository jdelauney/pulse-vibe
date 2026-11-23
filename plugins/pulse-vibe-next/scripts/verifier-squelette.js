#!/usr/bin/env node
// Pulse Next.js – vérification du squelette (outil du dépôt : CI hebdomadaire et maintenance).
//
//   node plugins/pulse-vibe-next/scripts/verifier-squelette.js [--base neon|postgres] [--hebergement vercel|docker|serveur] [--dernieres [--majeures]] [--ecrire] [--e2e [--tolerer-instables]] [--dossier <chemin>] [--garder]
//
//   --base        variante du squelette à vérifier (neon par défaut) ; postgres : lance aussi la base du
//                 docker-compose.yml (Docker doit tourner, port 5432 libre), y applique la migration d'essai, puis
//                 vérifie que src/db/db-client.ts choisit node-postgres et lit cette base ; la base et son volume
//                 sont retirés à la fin
//   --hebergement variante d'hébergement à vérifier (vercel par défaut) ; docker : si Docker répond (docker version),
//                 construit les images de compose.production.yml (tests compris), lance le site avec PostgreSQL sur
//                 le serveur, sa sauvegarde et les migrations, puis vérifie que le site et sa route de santé
//                 répondent ; conteneurs, images et volumes sont retirés à la fin ; serveur : construction
//                 standalone, assemblée comme le fait scripts/deployer.sh, puis le serveur Node produit lancé et
//                 interrogé (page d'accueil, route de santé : 200 avec --base postgres, 503 sans base)
//   --dernieres   passe chaque dépendance à sa dernière version publiée (npm view) avant de vérifier,
//                 sauf un changement de version majeure, signalé et laissé tel quel
//   --majeures    avec --dernieres : monte aussi les versions majeures (demande de fusion à part)
//   --ecrire      si tout passe, reporte ces versions dans templates/squelette/package.json (et biome.json)
//   --e2e         lance aussi les tests de bout en bout (Chromium doit être installé) et l'audit de
//                 référencement du site servi (skills/seo/scripts/seo.js du cœur) ; pose d'abord, dans le dossier
//                 temporaire seulement, une page d'essai qui provoque une erreur dans le navigateur et son test
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
const { creerSquelette, BASES, HEBERGEMENTS } = require("./squelette");

// Adresse de la base Docker de la variante postgres (identifiants de développement de son .env.example).
const ADRESSE_DOCKER = "postgresql://postgres:postgres@localhost:5432/app";
const PROJET_COMPOSE = "pulse-verification-base";

// Test posé par --base postgres dans le dossier temporaire seulement : le vrai client de l'application
// (FabriqueDeBase de src/db/db-client.ts) sur la base Docker, après la migration de la table d'essai.
const TEST_BASE_DOCKER = `import { FabriqueDeBase } from "@src/db/db-client";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { expect, it } from "vitest";
import { essais } from "../src/db/verification/essai.table";

it("la base Docker se lit par node-postgres, migration appliquée", async () => {
  const db = new FabriqueDeBase(process.env.DATABASE_URL ?? "").creer();
  expect(db).toBeInstanceOf(NodePgDatabase);
  await db.insert(essais).values({ id: "essai" }).onConflictDoNothing();
  expect(await db.select().from(essais)).toEqual([{ id: "essai" }]);
  const { rows } = await db.execute(sql\`select current_setting('server_version_num')::int as version\`);
  expect(Number(rows[0]?.version)).toBeGreaterThan(0);
});
`;

/**
 * Variante postgres : lance la base du docker-compose.yml, applique la migration d'essai et lit la base par le
 * client de l'application. La base et son volume sont retirés à la sortie du script, même en échec.
 */
function verifierBaseDocker(dossier) {
  // Nom de projet Compose fixe : la base se retire sans son dossier, déjà retiré par rangerDossier à la sortie.
  process.on("exit", () => {
    spawnSync(`docker compose -p ${PROJET_COMPOSE} down --volumes`, { shell: true, stdio: "ignore" });
  });
  const env = { DATABASE_URL: ADRESSE_DOCKER, DATABASE_URL_DIRECT: ADRESSE_DOCKER };
  lancer("npm run db:up", dossier, { COMPOSE_PROJECT_NAME: PROJET_COMPOSE });
  lancer("npm run db:migrate", dossier, env);
  fs.writeFileSync(path.join(dossier, "tests", "base-docker.test.ts"), TEST_BASE_DOCKER);
  try {
    lancer("npx vitest run tests/base-docker.test.ts", dossier, { ...env, SKIP_ENV_VALIDATION: "1" });
  } finally {
    fs.rmSync(path.join(dossier, "tests", "base-docker.test.ts"), { force: true });
  }
}

const PROJET_PRODUCTION = "pulse-verification-hebergement";

/** Vrai si Docker répond (moteur lancé). */
function dockerDisponible() {
  return spawnSync("docker version", { shell: true, stdio: "ignore" }).status === 0;
}

/** Attend qu'une adresse réponde (n'importe quel code HTTP) ; rend la réponse, ou lève une erreur après le délai. */
async function attendreReponse(adresse, { essais = 60, arret = () => null } = {}) {
  for (let i = 0; i < essais; i++) {
    const fin = arret();
    if (fin !== null) throw new Error(`le serveur s'est arrêté (${fin})`);
    try {
      return await fetch(adresse);
    } catch {
      await new Promise((ok) => setTimeout(ok, 1000));
    }
  }
  throw new Error(`${adresse} ne répond pas`);
}

/** Page d'accueil (200, nom du projet) et route de santé (code attendu) du site servi à cette adresse. */
async function controlerSiteProduit(adresse, santeAttendue, arret) {
  const accueil = await attendreReponse(adresse, { arret });
  const texte = await accueil.text();
  if (accueil.status !== 200 || !texte.includes("Projet de vérification")) throw new Error(`page d'accueil : code ${accueil.status}${texte.includes("Projet de vérification") ? "" : ", nom du projet absent"}`);
  const sante = await fetch(`${adresse}/api/sante`);
  const corps = await sante.json().catch(() => ({}));
  if (sante.status !== santeAttendue) throw new Error(`/api/sante : code ${sante.status} (${JSON.stringify(corps)}), attendu ${santeAttendue}`);
  console.log(`   ${adresse} : accueil 200, /api/sante ${sante.status} ${JSON.stringify(corps)}`);
}

/**
 * Variante docker : le vrai déroulé de compose.production.yml (images construites avec leurs tests, PostgreSQL sur le
 * serveur, sauvegarde, migrations, site), avec un .env de vérification. Tout est retiré à la sortie, même en échec.
 */
async function verifierHebergementDocker(dossier) {
  if (!dockerDisponible()) {
    console.log("\n(vérification de l'image sautée : Docker ne répond pas, docker version)");
    return;
  }
  const port = await portLibre();
  const compose = `docker compose -p ${PROJET_PRODUCTION} -f compose.production.yml`;
  let nettoye = false;
  // Après un succès, tout part avant le dossier ; après un échec (process.exit de lancer), à la sortie : le dossier
  // est alors gardé, son compose.production.yml sert encore. Les images de base (postgres, node, caddy) restent.
  const nettoyer = () => {
    if (nettoye) return;
    nettoye = true;
    // Les copies de la base appartiennent à root (créées dans le conteneur) : un conteneur les retire.
    spawnSync(`${compose} run --rm --no-deps --entrypoint rm sauvegarde -rf /sauvegardes/`, { cwd: dossier, shell: true, stdio: "ignore" });
    spawnSync(`${compose} down --volumes --rmi local --remove-orphans`, { cwd: dossier, shell: true, stdio: "ignore" });
    spawnSync("docker image rm projet-de-verification:courante projet-de-verification:precedente", { shell: true, stdio: "ignore" });
  };
  process.on("exit", nettoyer);
  fs.writeFileSync(path.join(dossier, ".env"), ["SITE_URL=https://www.exemple.org", "PULSE_ENV=production", "COMPOSE_PROFILES=base", "POSTGRES_PASSWORD=verification-locale", `APP_PORT=${port}`, ""].join("\n"));
  try {
    lancer(`${compose} up -d --build --wait`, dossier);
    const dossierCopies = path.join(dossier, "sauvegardes");
    const copies = fs.existsSync(dossierCopies) ? fs.readdirSync(dossierCopies).filter((f) => f.endsWith(".dump")) : [];
    if (!copies.length) throw new Error("aucune copie de la base dans sauvegardes/ (service sauvegarde)");
    const journal = spawnSync(`${compose} logs migrations`, { cwd: dossier, shell: true, encoding: "utf8" }).stdout || "";
    if (!/Migrations appliquées/.test(journal)) throw new Error(`migrations non appliquées :\n${journal}`);
    console.log(`\n▶ site du conteneur\n   copie de la base : sauvegardes/${copies[0]} ; migrations appliquées`);
    await controlerSiteProduit(`http://127.0.0.1:${port}`, 200, () => null);
  } catch (e) {
    console.error(`\n❌ Échec : hébergement docker (${e.message})`);
    spawnSync(`${compose} logs --tail 80`, { cwd: dossier, shell: true, stdio: "inherit" });
    process.exit(1);
  }
  nettoyer();
  fs.rmSync(path.join(dossier, ".env"), { force: true });
}

/**
 * Variante serveur : construction standalone, assemblée comme scripts/deployer.sh (statiques, public, sans .env),
 * puis le serveur Node produit, lancé sur un port libre. Avec la base Docker (--base postgres), /api/sante répond 200 ;
 * sans base, 503.
 */
async function verifierHebergementServeur(dossier, base) {
  lancer("npm run build", dossier, { SKIP_ENV_VALIDATION: "1", PULSE_SORTIE: "standalone" });
  const version = path.join(dossier, "versions", "verification");
  fs.cpSync(path.join(dossier, ".next", "standalone"), version, { recursive: true, verbatimSymlinks: true });
  fs.cpSync(path.join(dossier, ".next", "static"), path.join(version, ".next", "static"), { recursive: true });
  fs.cpSync(path.join(dossier, "public"), path.join(version, "public"), { recursive: true });
  for (const f of fs.readdirSync(version)) if (f.startsWith(".env")) fs.rmSync(path.join(version, f));
  const port = await portLibre();
  console.log("\n▶ node server.js (sortie standalone)");
  const adresseBase = base === "postgres" ? ADRESSE_DOCKER : "postgresql://verification:verification@127.0.0.1:1/verification";
  const serveur = spawn(process.execPath, ["server.js"], { cwd: version, stdio: "ignore", env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1", SKIP_ENV_VALIDATION: "1", DATABASE_URL: adresseBase } });
  let arret = null;
  serveur.on("exit", (code, signal) => {
    arret = code ?? signal;
  });
  try {
    await controlerSiteProduit(`http://127.0.0.1:${port}`, base === "postgres" ? 200 : 503, () => arret);
  } catch (e) {
    console.error(`\n❌ Échec : hébergement serveur (${e.message})`);
    process.exitCode = 1;
  } finally {
    serveur.kill();
    fs.rmSync(path.join(dossier, "versions"), { recursive: true, force: true });
  }
  if (process.exitCode) process.exit(1);
}

/** Le script de déploiement d'une variante se lit sans erreur de syntaxe (bash -n). */
function controlerScriptDeDeploiement(dossier) {
  if (fs.existsSync(path.join(dossier, "scripts", "deployer.sh"))) lancer("bash -n scripts/deployer.sh", dossier);
}

const MODELE = path.join(__dirname, "..", "templates", "squelette");
const COEUR = path.join(__dirname, "..", "..", "pulse-vibe");
const AUDIT_SEO = path.join(COEUR, "skills", "seo", "scripts", "seo.js");
const PORT_LIBRE = path.join(COEUR, "scripts", "port-libre.js");
// Les fichiers du cœur que ce script lance ou charge : la CI du squelette se déclenche aussi sur eux.
const FICHIERS_DU_COEUR = [AUDIT_SEO, PORT_LIBRE];

// Page d'essai et son test, posés par --e2e dans le dossier temporaire seulement : le squelette publié n'a
// pas cette page. Le test suit le vrai chemin d'une erreur du navigateur : la page plante, app/error.tsx
// l'affiche et l'envoie à /api/erreur-client.
const PAGE_D_ESSAI = {
  [path.join("app", "essai-surveillance", "page.tsx")]: `"use client";

import { useState } from "react";

export default function EssaiSurveillance() {
  const [declenche, setDeclenche] = useState(false);
  if (declenche) throw new Error("Erreur d'essai de la surveillance");
  return (
    <main>
      <button type="button" onClick={() => setDeclenche(true)}>
        Déclencher une erreur d'essai
      </button>
    </main>
  );
}
`,
  [path.join("e2e", "essai-surveillance.spec.ts")]: `import { expect, test } from "@playwright/test";

test("une erreur dans la page est affichée puis signalée au serveur", async ({ page }) => {
  await page.goto("/essai-surveillance");
  const envoi = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/erreur-client"));
  await page.getByRole("button", { name: "Déclencher une erreur d'essai" }).click();
  const requete = await envoi;
  expect(JSON.parse(requete.postData() ?? "{}")).toEqual({
    message: "Erreur d'essai de la surveillance",
    chemin: "/essai-surveillance",
  });
  await expect(page.getByRole("heading", { name: "Un problème est survenu" })).toBeVisible();
});
`,
};

/** Pose la page d'essai de la surveillance et son test dans le projet de vérification. */
function poserPageDEssai(dossier) {
  for (const [fichier, contenu] of Object.entries(PAGE_D_ESSAI)) {
    fs.mkdirSync(path.dirname(path.join(dossier, fichier)), { recursive: true });
    fs.writeFileSync(path.join(dossier, fichier), contenu);
  }
}

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
  const opts = { base: "neon", hebergement: "vercel", dernieres: false, majeures: false, ecrire: false, e2e: false, dossier: null, garder: false, tolererInstables: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") {
      opts.base = argv[++i];
      if (!BASES.includes(opts.base)) throw new Error(`Base inconnue : ${opts.base}. Valeurs possibles : ${BASES.join(", ")}.`);
    } else if (a === "--hebergement") {
      opts.hebergement = argv[++i];
      if (!HEBERGEMENTS.includes(opts.hebergement)) throw new Error(`Hébergement inconnu : ${opts.hebergement}. Valeurs possibles : ${HEBERGEMENTS.join(", ")}.`);
    } else if (a === "--dernieres") opts.dernieres = true;
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
  creerSquelette({ nom: "Projet de vérification", description: "Vérification automatique du squelette.", base: opts.base, hebergement: opts.hebergement, dossier });
  console.log(`Squelette créé dans ${dossier} (base : ${opts.base}, hébergement : ${opts.hebergement})`);

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
  if (opts.base === "postgres") verifierBaseDocker(dossier);
  // La construction de vérification se fait sans variables : t3 env saute alors la validation.
  lancer("npm run build", dossier, { SKIP_ENV_VALIDATION: "1" });
  controlerCodeSeo(dossier);
  controlerScriptDeDeploiement(dossier);
  if (opts.hebergement === "serveur") await verifierHebergementServeur(dossier, opts.base);
  if (opts.hebergement === "docker") await verifierHebergementDocker(dossier);
  if (opts.e2e) {
    // La construction de bout en bout (npm run build du webServer de Playwright, en CI) inclut la page d'essai.
    poserPageDEssai(dossier);
    // En CI sous Linux, --with-deps installe aussi les bibliothèques système du navigateur.
    lancer(`npx playwright install ${process.env.CI && process.platform === "linux" ? "--with-deps " : ""}chromium`, dossier);
    // Rapport JSON en plus de la liste : les relances (retries de la configuration en CI) y laissent le statut « flaky ».
    const rapportE2e = path.join(dossier, "rapport-e2e.json");
    // Port libre (lu par playwright.config.ts et next start) : le port 3000 peut être pris par un autre projet.
    lancer("npm run test:e2e -- --reporter=list,json", dossier, { CI: "true", SKIP_ENV_VALIDATION: "1", PORT: String(await portLibre()), PLAYWRIGHT_JSON_OUTPUT_NAME: rapportE2e, PLAYWRIGHT_JSON_OUTPUT_FILE: rapportE2e });
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

module.exports = { poserPageDEssai, changementMajeur, monterLesVersions, lireArguments, portLibre, testsInstables, controlerInstables, rangerDossier, FICHIERS_DU_COEUR };

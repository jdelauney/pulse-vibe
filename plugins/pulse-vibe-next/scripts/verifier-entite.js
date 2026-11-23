#!/usr/bin/env node
// Pulse Next.js – vérification du générateur d'entité (outil du dépôt : maintenance et CI).
//
//   node plugins/pulse-vibe-next/scripts/verifier-entite.js [--e2e] [--garder]
//
//   --e2e      lance aussi le parcours de bout en bout de chaque entité (Chromium installé au besoin), sur une base
//              PGlite : dans le dossier temporaire seulement, src/db/db-client.ts est remplacé par une base PGlite
//              (dossier PGLITE_DOSSIER, migrations appliquées avant le démarrage) ; un test instable fait échouer
//   --garder   garde le dossier temporaire et l'indique (il est gardé aussi après un échec)
//
// Pose le squelette et la recette connexion dans un dossier temporaire, génère deux entités d'exemple
// (EXEMPLES : une avec les 7 types de champs, une minimale), vérifie que le générateur refuse ensuite de
// remplacer un fichier, ajoute les composants shadcn qui manquent et les adresses au renvoi de proxy.ts,
// génère la migration, puis : npm run check, npm run typecheck, npm test, npm run build.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { creerSquelette } = require("./squelette");
const { poserRecette, lancer, sansInterpreteur } = require("./verifier-recettes");
const { principal: generer, validerDescription, composantsNecessaires } = require("./entite");

// Deux entités d'exemple : la première couvre les 7 types de champs (et l'étiquette d'US des tests),
// la seconde est minimale (un seul champ, libellé masculin avec élision : « l'article »).
const EXEMPLES = [
  {
    us: "US-001",
    description: {
      domaine: "factures",
      sujet: "facture",
      pluriel: "factures",
      libelle: "facture",
      libellePluriel: "factures",
      feminin: true,
      route: "/factures",
      titre: "client",
      champs: [
        { nom: "client", libelle: "Client", type: "texte", obligatoire: true, max: 120 },
        { nom: "notes", libelle: "Notes", type: "texte-long", max: 2000 },
        { nom: "quantite", libelle: "Quantité", type: "nombre", min: 0, max: 9999 },
        { nom: "montant", libelle: "Montant", type: "montant", obligatoire: true },
        { nom: "echeance", libelle: "Échéance", type: "date", obligatoire: true },
        { nom: "statut", libelle: "Statut", type: "choix", valeurs: { brouillon: "Brouillon", envoyee: "Envoyée" }, defaut: "brouillon" },
        { nom: "payee", libelle: "Payée", type: "oui-non" },
      ],
    },
  },
  {
    us: null,
    description: {
      domaine: "stock",
      sujet: "article",
      pluriel: "articles",
      libelle: "article",
      libellePluriel: "articles",
      feminin: false,
      route: "/articles",
      titre: "nom",
      champs: [{ nom: "nom", libelle: "Nom", type: "texte", obligatoire: true }],
    },
  },
];

// drizzle-kit generate lit une adresse sans s'y connecter.
const ADRESSE_FACTICE = "postgresql://verification@localhost:5432/verification";

// --e2e : la base de l'application devient un dossier PGlite, dans le dossier temporaire seulement.
const DB_CLIENT_PGLITE = `import "server-only";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";

// Vérification de bout en bout (verifier-entite.js --e2e) : base PGlite du dossier PGLITE_DOSSIER, migrations déjà appliquées.
export type Db = PgDatabase<PgQueryResultHKT>;

let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    db = drizzle({ client: new PGlite(process.env.PGLITE_DOSSIER) });
  }
  return db;
}
`;
const MIGRER_PGLITE = `// Vérification de bout en bout : applique les migrations de drizzle/ à la base PGlite du dossier PGLITE_DOSSIER.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const client = new PGlite(process.env.PGLITE_DOSSIER);
await migrate(drizzle({ client }), { migrationsFolder: "./drizzle" });
await client.close();
`;

function lireArguments(argv) {
  const opts = { e2e: false, garder: false };
  for (const a of argv) {
    if (a === "--e2e") opts.e2e = true;
    else if (a === "--garder") opts.garder = true;
    else throw new Error(`Option inconnue : ${a}`);
  }
  return opts;
}

/** Ajoute les adresses au matcher de proxy.ts (le geste que le générateur demande à la personne). */
function ajouterAuProxy(dossier, routes) {
  const fichier = path.join(dossier, "proxy.ts");
  const texte = fs.readFileSync(fichier, "utf8");
  const m = /matcher: \[([^\]]*)\]/.exec(texte);
  if (!m) throw new Error("proxy.ts : matcher introuvable");
  const ajouts = routes.map((r) => `"${r}/:path*"`).filter((r) => !m[1].includes(r));
  fs.writeFileSync(fichier, texte.replace(m[0], `matcher: [${[m[1].trim(), ...ajouts].filter(Boolean).join(", ")}]`));
}

/**
 * Ajoute les composants shadcn, en répondant non à chaque proposition de remplacer un fichier existant
 * (alert-dialog voudrait réécrire button.tsx et ses cibles tactiles de 44 px) : le geste demandé à la personne.
 */
function ajouterComposants(dossier, composants) {
  const texte = `npx shadcn@latest add ${composants.join(" ")} --yes`;
  console.log(`\n▶ ${texte} (réponse « non » à chaque remplacement)`);
  const { exe, args } = sansInterpreteur("npx", ["shadcn@latest", "add", ...composants, "--yes"]);
  const r = spawnSync(exe, args, { cwd: dossier, input: "n\n".repeat(20), stdio: ["pipe", "inherit", "inherit"], encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${texte} (code ${r.status})`);
  for (const c of composants) if (!fs.existsSync(path.join(dossier, "src", "components", "ui", `${c}.tsx`))) throw new Error(`composant shadcn absent après l'ajout : ${c}`);
}

/** Génère une entité avec le vrai déroulé de pulse-aidd pile entite ; rend la sortie affichée. */
function genererEntite(dossier, descriptions, { description, us }, attendu = 0) {
  const fichier = path.join(descriptions, `${description.sujet}.json`);
  fs.writeFileSync(fichier, `${JSON.stringify(description, null, 2)}\n`);
  const sortie = [];
  const code = generer([fichier, "--dossier", dossier, ...(us ? ["--us", us] : [])], (t) => sortie.push(t));
  const texte = sortie.join("\n");
  console.log(`\n▶ pulse-aidd pile entite ${description.sujet}.json${us ? ` --us ${us}` : ""}\n${texte}`);
  if (code !== attendu) throw new Error(`génération de ${description.sujet} : code ${code}, attendu ${attendu}`);
  return texte;
}

/** Prépare le bout en bout dans le dossier temporaire : base PGlite, PGlite hors du paquet du serveur, migrations appliquées. */
function preparerBoutEnBout(dossier, pglite) {
  fs.writeFileSync(path.join(dossier, "src", "db", "db-client.ts"), DB_CLIENT_PGLITE);
  // Le test du choix du pilote vise le vrai db-client.ts (déjà passé par npm test) : il part avec lui.
  fs.rmSync(path.join(dossier, "src", "db", "__tests__", "db-client.test.ts"), { force: true });
  fs.writeFileSync(path.join(dossier, "migrer-pglite.mjs"), MIGRER_PGLITE);
  const config = path.join(dossier, "next.config.ts");
  const texte = fs.readFileSync(config, "utf8");
  const debut = "const nextConfig: NextConfig = {";
  if (!texte.includes(debut)) throw new Error("next.config.ts : « const nextConfig: NextConfig = { » introuvable");
  // PGlite charge son fichier WebAssembly à côté de son code : il reste hors du paquet construit par Next.js.
  fs.writeFileSync(config, texte.replace(debut, `${debut}\n  serverExternalPackages: ["@electric-sql/pglite"],`));
  lancer(process.execPath, ["migrer-pglite.mjs"], dossier, { PGLITE_DOSSIER: pglite });
}

async function principal() {
  const opts = lireArguments(process.argv.slice(2));
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-next-entite-"));
  const descriptions = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-next-entite-descriptions-"));
  let reussi = false;
  try {
    for (const { description } of EXEMPLES) {
      const { erreurs } = validerDescription(description);
      if (erreurs.length) throw new Error(`exemple ${description.sujet} invalide : ${erreurs.join(" ; ")}`);
    }
    creerSquelette({ nom: "Projet de vérification", description: "Vérification automatique du générateur d'entité.", dossier });
    lancer("npm", ["install", "--no-audit", "--no-fund"], dossier);
    const poses = poserRecette(dossier, "connexion", []);
    // Mise en forme Biome des fichiers de la recette, comme verifier-recettes.js.
    const { exe, args } = sansInterpreteur("npx", ["biome", "format", "--write", ...poses.filter((p) => fs.existsSync(path.join(dossier, p)))]);
    spawnSync(exe, args, { cwd: dossier, shell: false, stdio: "ignore" });

    for (const exemple of EXEMPLES) genererEntite(dossier, descriptions, exemple);
    // Relancé sur un fichier déjà écrit, le générateur s'arrête sans rien remplacer.
    const relance = genererEntite(dossier, descriptions, EXEMPLES[1], 1);
    if (!/rien n'est écrit/.test(relance)) throw new Error("la relance du générateur devait lister les conflits");

    ajouterComposants(dossier, [...new Set(EXEMPLES.flatMap(({ description }) => composantsNecessaires(validerDescription(description).entite)))]);
    ajouterAuProxy(dossier, EXEMPLES.map(({ description }) => description.route));
    lancer("npm", ["run", "db:generate"], dossier, { DATABASE_URL_DIRECT: ADRESSE_FACTICE });
    lancer("npm", ["run", "check"], dossier);
    lancer("npm", ["run", "typecheck"], dossier);
    lancer("npm", ["test"], dossier);
    lancer("npm", ["run", "build"], dossier, { SKIP_ENV_VALIDATION: "1" });

    if (opts.e2e) {
      const { portLibre, controlerInstables } = require("./verifier-squelette");
      const pglite = path.join(dossier, ".pglite-e2e");
      preparerBoutEnBout(dossier, pglite);
      lancer("npx", ["playwright", "install", ...(process.env.CI && process.platform === "linux" ? ["--with-deps"] : []), "chromium"], dossier);
      const port = String(await portLibre());
      const rapport = path.join(dossier, "rapport-e2e.json");
      const specs = EXEMPLES.map(({ description }) => `e2e/${description.pluriel}.spec.ts`);
      lancer("npx", ["playwright", "test", ...specs, "--reporter=list,json"], dossier, {
        CI: "true",
        PORT: port,
        SKIP_ENV_VALIDATION: "1",
        PGLITE_DOSSIER: pglite,
        BETTER_AUTH_SECRET: "verification-entite-0123456789abcdef0123456789",
        BETTER_AUTH_URL: `http://localhost:${port}`,
        DATABASE_URL: ADRESSE_FACTICE,
        PLAYWRIGHT_JSON_OUTPUT_NAME: rapport,
        PLAYWRIGHT_JSON_OUTPUT_FILE: rapport,
      });
      const controle = controlerInstables(rapport, false);
      if (controle.message) (controle.echec ? console.error : console.log)(controle.message);
      if (controle.echec) throw new Error("parcours de bout en bout instables");
    }
    console.log(`\n✅ Générateur d'entité vérifié : ${EXEMPLES.map(({ description }) => description.sujet).join(", ")}${opts.e2e ? " (bout en bout compris)" : ""}.`);
    reussi = true;
  } catch (e) {
    console.error(`\n❌ Échec : ${e.message}`);
    process.exitCode = 1;
  } finally {
    fs.rmSync(descriptions, { recursive: true, force: true });
    if (opts.garder || !reussi) console.log(`Dossier gardé : ${dossier}`);
    else {
      try {
        fs.rmSync(dossier, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch (e) {
        console.log(`Dossier temporaire non retiré (${e.message}) : ${dossier}`);
      }
    }
  }
}

if (require.main === module) principal();

module.exports = { EXEMPLES, lireArguments, ajouterAuProxy };

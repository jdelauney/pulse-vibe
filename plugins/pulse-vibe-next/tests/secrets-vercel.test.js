// Tests de l'adaptateur Vercel de pulse-aidd secrets (scripts/secrets-vercel.js).
// Lancer : node --test plugins/pulse-vibe-next/tests/secrets-vercel.test.js
//
// Un faux « vercel » placé en tête du PATH enregistre ses arguments et son entrée standard,
// et répond comme le Vercel CLI (format JSON de « env ls » et de « ls »).
// Les valeurs factices sont construites à l'exécution : ce fichier ne contient aucune clé reconnaissable.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "secrets-vercel.js");
const hasard = (n = 12) => crypto.randomBytes(n).toString("hex");

const FAUX_VERCEL = `"use strict";
const fs = require("fs");
const path = require("path");
const J = process.env.FAUX_JOURNAL;
const n = fs.readdirSync(J).filter((f) => f.startsWith("argv-")).length;
const args = process.argv.slice(2);
let entree = "";
try { entree = fs.readFileSync(0, "utf8"); } catch (e) {}
fs.writeFileSync(path.join(J, "argv-" + n), JSON.stringify(args));
fs.writeFileSync(path.join(J, "stdin-" + n), entree);
const cmd = args.slice(0, 2).join(" ");
if (process.env.FAUX_NON_CONNECTE) { console.error("Error: No existing credentials found. Please run vercel login"); process.exit(1); }
if (cmd === "env ls") { console.log("Retrieving project…"); console.log(process.env.FAUX_ENVS || '{"envs":[]}'); process.exit(0); }
if (cmd === "env add" || cmd === "env update") {
  if (process.env.FAUX_ECHEC) { console.error("Error: refusé (" + entree + ")"); process.exit(1); }
  console.log("Added Environment Variable " + args[2]); process.exit(0);
}
if (args[0] === "ls") { console.log(process.env.FAUX_DEPLOIEMENTS || '{"deployments":[]}'); process.exit(0); }
if (args[0] === "redeploy") { console.log("https://essai-nouveau.vercel.app"); process.exit(0); }
console.error("commande inattendue"); process.exit(2);
`;

function projet({ relie = true } = {}) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-vercel-"));
  const bin = path.join(dossier, "_bin");
  const journal = path.join(dossier, "_journal");
  fs.mkdirSync(bin);
  fs.mkdirSync(journal);
  fs.writeFileSync(path.join(bin, "vercel-faux.js"), FAUX_VERCEL);
  fs.writeFileSync(path.join(bin, "vercel"), '#!/bin/sh\nexec node "$(dirname "$0")/vercel-faux.js" "$@"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "vercel.cmd"), '@node "%~dp0vercel-faux.js" %*\r\n');
  if (relie) {
    fs.mkdirSync(path.join(dossier, ".vercel"));
    fs.writeFileSync(path.join(dossier, ".vercel", "project.json"), '{"projectId":"prj_essai","orgId":"team_essai"}');
  }
  return { dossier, bin, journal };
}

function lancer(p, args, entree, envSup = {}) {
  const env = { ...process.env, FAUX_JOURNAL: p.journal, ...envSup };
  const cle = Object.keys(env).find((k) => k.toUpperCase() === "PATH") || "PATH";
  env[cle] = p.bin + path.delimiter + env[cle];
  const r = spawnSync("node", [SCRIPT, ...args], { cwd: p.dossier, env, input: entree === undefined ? "" : entree, encoding: "utf8" });
  return { code: r.status, sortie: (r.stdout || "") + (r.stderr || "") };
}

function appels(p) {
  return fs.readdirSync(p.journal)
    .filter((f) => f.startsWith("argv-"))
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
    .map((f) => ({ argv: JSON.parse(fs.readFileSync(path.join(p.journal, f), "utf8")), stdin: fs.readFileSync(path.join(p.journal, "stdin-" + f.slice(5)), "utf8") }));
}

const sansValeur = (texte, ...valeurs) => {
  for (const v of valeurs) assert.ok(!texte.includes(v), `la sortie contient une valeur :\n${texte}`);
};

const valeurConfig = "config-" + hasard(6);
const ENVS = JSON.stringify({
  envs: [
    { key: "DATABASE_URL", value: undefined, type: "sensitive", target: ["production", "preview"] },
    { key: "APP_URL", value: valeurConfig, type: "encrypted", visibility: "config", target: ["production"] },
    { key: "STRIPE_SECRET_KEY", value: "valeur-" + hasard(6), type: "encrypted", target: ["production"] },
    { key: "BRANCHE_SEULE", type: "sensitive", target: ["preview"], gitBranch: "essai" },
  ],
});

test("ls : noms, environnements et type, sans aucune valeur (même celles des variables Config)", () => {
  const p = projet();
  const r = lancer(p, ["ls"], "", { FAUX_ENVS: ENVS });
  assert.strictEqual(r.code, 0, r.sortie);
  sansValeur(r.sortie, valeurConfig, "valeur-");
  const json = JSON.parse(r.sortie);
  assert.strictEqual(json.hebergeur, "Vercel");
  assert.deepStrictEqual(json.variables, [
    { nom: "DATABASE_URL", environnements: ["production", "preview"], type: "secret" },
    { nom: "APP_URL", environnements: ["production"], type: "config" },
    { nom: "STRIPE_SECRET_KEY", environnements: ["production"], type: "config" },
  ]);
  assert.deepStrictEqual(appels(p)[0].argv, ["env", "ls", "--format", "json"]);
});

test("envoyer : variable existante → env update par l'entrée standard ; nouvelle → env add --type secret", () => {
  const p = projet();
  const valeur = "Val" + hasard(16);
  const maj = lancer(p, ["envoyer", "DATABASE_URL", "preview", "--type", "secret"], valeur, { FAUX_ENVS: ENVS });
  assert.strictEqual(maj.code, 0, maj.sortie);
  assert.match(maj.sortie, /DATABASE_URL mise à jour sur Vercel \(Preview, type Secret\)/);
  const ajout = lancer(p, ["envoyer", "NOUVELLE_CLE", "production"], valeur, { FAUX_ENVS: ENVS });
  assert.strictEqual(ajout.code, 0, ajout.sortie);
  assert.match(ajout.sortie, /NOUVELLE_CLE ajoutée sur Vercel \(Production, type Secret\)/);
  const ecritures = appels(p).filter((a) => a.argv[0] === "env" && a.argv[1] !== "ls");
  assert.deepStrictEqual(ecritures.map((a) => a.argv), [
    ["env", "update", "DATABASE_URL", "preview", "--yes"],
    ["env", "add", "NOUVELLE_CLE", "production", "--type", "secret", "--yes"],
  ]);
  for (const a of appels(p)) assert.ok(!a.argv.join(" ").includes(valeur), "jamais en argument");
  assert.ok(ecritures.every((a) => a.stdin === valeur), "valeur sur l'entrée standard");
  sansValeur(maj.sortie + ajout.sortie, valeur);
});

test("envoyer : refuse le vide, un secret sur une variable Config, un nom ou un environnement invalide ; masque la valeur d'une erreur", () => {
  const p = projet();
  const valeur = "Val" + hasard(16);
  const vide = lancer(p, ["envoyer", "DATABASE_URL", "production"], "  \n", { FAUX_ENVS: ENVS });
  assert.strictEqual(vide.code, 1);
  assert.match(vide.sortie, /valeur vide/);
  const config = lancer(p, ["envoyer", "STRIPE_SECRET_KEY", "production", "--type", "secret"], valeur, { FAUX_ENVS: ENVS });
  assert.strictEqual(config.code, 1);
  assert.match(config.sortie, /type Config/);
  assert.match(config.sortie, /supprimez-la/);
  assert.strictEqual(lancer(p, ["envoyer", "nom;rm", "production"], valeur).code, 1);
  assert.strictEqual(lancer(p, ["envoyer", "CLE", "lune"], valeur).code, 1);
  const echec = lancer(p, ["envoyer", "AUTRE_CLE", "production"], valeur, { FAUX_ENVS: ENVS, FAUX_ECHEC: "1" });
  assert.strictEqual(echec.code, 1);
  assert.match(echec.sortie, /«valeur masquée»/);
  sansValeur(vide.sortie + config.sortie + echec.sortie, valeur);
});

test("projet non relié ou CLI non connecté : la commande à lancer", () => {
  const nonRelie = lancer(projet({ relie: false }), ["ls"]);
  assert.strictEqual(nonRelie.code, 1);
  assert.match(nonRelie.sortie, /vercel link/);
  const nonConnecte = lancer(projet(), ["ls"], "", { FAUX_NON_CONNECTE: "1" });
  assert.strictEqual(nonConnecte.code, 1);
  assert.match(nonConnecte.sortie, /vercel login/);
});

test("redeployer : relance le dernier déploiement prêt de l'environnement", () => {
  const p = projet();
  const deploiements = JSON.stringify({
    deployments: [
      { url: "essai-ancien.vercel.app", state: "READY", target: "production", createdAt: 1000 },
      { url: "essai-recent.vercel.app", state: "READY", target: "production", createdAt: 3000 },
      { url: "essai-casse.vercel.app", state: "ERROR", target: "production", createdAt: 4000 },
    ],
  });
  const r = lancer(p, ["redeployer", "production"], "", { FAUX_DEPLOIEMENTS: deploiements });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.sortie, /redéploiement Production terminé : https:\/\/essai-nouveau\.vercel\.app/);
  const [liste, relance] = appels(p);
  assert.deepStrictEqual(liste.argv, ["ls", "--format", "json", "--prod"]);
  assert.deepStrictEqual(relance.argv, ["redeploy", "https://essai-recent.vercel.app", "--target", "production"]);
  const aucun = lancer(projet(), ["redeployer", "preview"]);
  assert.strictEqual(aucun.code, 1);
  assert.match(aucun.sortie, /aucun déploiement Preview/);
});

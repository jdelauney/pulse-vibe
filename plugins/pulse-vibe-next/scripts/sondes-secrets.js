#!/usr/bin/env node
// Pack Pulse Next.js – règles et tests réels des secrets de la pile (appelé par pulse-aidd secrets, via pulse-pile-next).
//
//   pulse-pile-next secrets regles          JSON : règles par variable et noms déclarés dans src/config/env.ts (ou src/lib/env.ts)
//   pulse-pile-next secrets tester <NOM>    test réel d'une valeur ; lit sur l'entrée standard un JSON { NOM: valeur, … }
//   pulse-pile-next secrets fiche <NOM>     la fiche de la variable (references/contexte/secrets.md)
//
// S'exécute dans le dossier du projet et utilise SES dépendances (pilote Neon, nodemailer, client S3).
// Aucune sortie ne contient une valeur. Codes de sortie de « tester » : 0 bon, 1 mauvais, 3 pas de test réel possible.
"use strict";

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const FICHE = path.join(__dirname, "..", "references", "contexte", "secrets.md");

// Règles par variable : la fiche (references/contexte/secrets.md) en donne l'explication ; un test vérifie qu'elles restent alignées.
const NEON = ["DATABASE_URL", "DATABASE_URL_DIRECT"];
const R2 = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
const VARIABLES = {
  DATABASE_URL: { secret: true, fournisseur: "Neon", prefixes: ["postgresql://", "postgres://"], groupe: NEON, besoins: ["DATABASE_URL_DIRECT"] },
  DATABASE_URL_DIRECT: { secret: true, fournisseur: "Neon", prefixes: ["postgresql://", "postgres://"], groupe: NEON, besoins: ["DATABASE_URL"] },
  BETTER_AUTH_SECRET: { secret: true, fournisseur: "projet (valeur générée)", longueurMin: 32, genere: { octets: 32 }, versionnee: "BETTER_AUTH_SECRETS" },
  BETTER_AUTH_SECRETS: { secret: true, fournisseur: "projet (valeur générée)", genere: { octets: 32 } },
  BETTER_AUTH_URL: { secret: false, fournisseur: "projet", prefixes: ["http://", "https://"] },
  STRIPE_SECRET_KEY: { secret: true, fournisseur: "Stripe", prefixes: ["sk_test_", "sk_live_", "rk_test_", "rk_live_"], modes: { sk_test_: "mode test", sk_live_: "mode live", rk_test_: "clé restreinte, mode test", rk_live_: "clé restreinte, mode live" } },
  STRIPE_WEBHOOK_SECRET: { secret: true, fournisseur: "Stripe", prefixes: ["whsec_"] },
  SMTP_HOST: { secret: false, fournisseur: "fournisseur d'e-mail" },
  SMTP_PORT: { secret: false, fournisseur: "fournisseur d'e-mail" },
  SMTP_USER: { secret: false, fournisseur: "fournisseur d'e-mail" },
  SMTP_PASSWORD: { secret: true, fournisseur: "fournisseur d'e-mail", besoins: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER"] },
  MAIL_FROM: { secret: false, fournisseur: "fournisseur d'e-mail" },
  R2_ACCOUNT_ID: { secret: false, fournisseur: "Cloudflare R2" },
  R2_BUCKET: { secret: false, fournisseur: "Cloudflare R2" },
  R2_ACCESS_KEY_ID: { secret: true, fournisseur: "Cloudflare R2", groupe: R2, besoins: ["R2_SECRET_ACCESS_KEY", "R2_ACCOUNT_ID", "R2_BUCKET"] },
  R2_SECRET_ACCESS_KEY: { secret: true, fournisseur: "Cloudflare R2", groupe: R2, besoins: ["R2_ACCESS_KEY_ID", "R2_ACCOUNT_ID", "R2_BUCKET"] },
  UPSTASH_REDIS_REST_URL: { secret: false, fournisseur: "Upstash", prefixes: ["https://"], groupe: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] },
  UPSTASH_REDIS_REST_TOKEN: { secret: true, fournisseur: "Upstash", groupe: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"], besoins: ["UPSTASH_REDIS_REST_URL"] },
  FORMULAIRE_SECRET: { secret: true, fournisseur: "projet (valeur générée)", longueurMin: 32, genere: { octets: 32 } },
  TURNSTILE_SECRET_KEY: { secret: true, fournisseur: "Cloudflare Turnstile" },
};

// ---------------------------------------------------------------- Sorties

let valeursAMasquer = [];
function masquer(texte) {
  let t = String(texte || "");
  for (const v of valeursAMasquer) {
    if (!v || v.length < 4) continue;
    t = t.split(v).join("«valeur masquée»");
    const m = /^[a-z][a-z0-9+.-]*:\/\/[^:/@\s]+:([^@\s]+)@/i.exec(v);
    if (m && m[1].length >= 4) t = t.split(m[1]).join("«valeur masquée»");
  }
  return t;
}
function finir(code, message) {
  fs.writeSync(1, masquer(message) + "\n");
  process.exit(code);
}
const bon = (m) => finir(0, `✅ ${m}`);
const mauvais = (m) => finir(1, `❌ ${m}`);
const sansTest = (m) => finir(3, `⚪ ${m}`);
const raison = (e) => masquer((e && (e.code || e.name) ? `${e.code || e.name} : ` : "") + ((e && e.message) || String(e)).split("\n")[0]).slice(0, 200);

/** Charge une dépendance du projet (pas du pack). */
function dependance(nom) {
  try {
    return createRequire(path.join(process.cwd(), "package.json"))(nom);
  } catch (e) {
    sansTest(`test réel impossible : le paquet ${nom} n'est pas installé dans le projet (npm install).`);
  }
}

function dansLesTemps(promesse, ms = 20000) {
  return Promise.race([promesse, new Promise((_, rejeter) => setTimeout(() => rejeter(Object.assign(new Error("pas de réponse"), { code: "DELAI" })), ms))]);
}

// ---------------------------------------------------------------- Tests par variable

function motDePasseDe(adresse) {
  try {
    return decodeURIComponent(new URL(adresse).password);
  } catch (e) {
    return null;
  }
}

async function testerNeon(nom, v) {
  const valeur = v[nom];
  let hote;
  try {
    hote = new URL(valeur).hostname;
  } catch (e) {
    mauvais("adresse illisible : copiez-la de nouveau depuis le bouton « Connect » de Neon.");
  }
  const autre = nom === "DATABASE_URL" ? "DATABASE_URL_DIRECT" : "DATABASE_URL";
  if (v[autre] && motDePasseDe(v[autre]) !== motDePasseDe(valeur)) mauvais(`${nom} et ${autre} n'ont pas le même mot de passe : les deux adresses se renouvellent ensemble.`);
  const attenduPooler = nom === "DATABASE_URL";
  const note = hote.includes("-pooler") === attenduPooler ? "" : attenduPooler ? " (adresse sans -pooler : prenez l'adresse « pooled » pour l'application)" : " (adresse avec -pooler : prenez l'adresse directe pour les migrations)";
  if (!/\.neon\.tech$/.test(hote)) sansTest(`test réel prévu pour Neon ; hôte « ${hote} » : testez la connexion avec la commande de migration ou la page qui lit la base.`);
  const { neon } = dependance("@neondatabase/serverless");
  try {
    const lignes = await dansLesTemps(neon(valeur).query("select 1 as ok"));
    if (lignes && lignes[0] && Number(lignes[0].ok) === 1) bon(`connexion à Neon réussie (select 1)${note}`);
    mauvais(`Neon a répondu sans le résultat attendu${note}`);
  } catch (e) {
    mauvais(`connexion à Neon refusée : ${raison(e)}${note}`);
  }
}

function testerSecretAuth(nom, v) {
  if (v[nom].length < 32) mauvais("trop courte : 32 caractères au moins (pulse-aidd secrets generer).");
  bon("longueur suffisante ; le vrai test : se connecter sur le site après le redéploiement.");
}

function testerSecretsAuth(nom, v) {
  const versions = [];
  for (const entree of v[nom].split(",").map((e) => e.trim())) {
    const m = /^(\d+):(.+)$/.exec(entree);
    if (!m) mauvais("forme attendue « version:valeur,version:valeur » (ex. 2:…,1:…).");
    if (versions.some((x) => x.version === Number(m[1]))) mauvais(`version ${m[1]} présente deux fois.`);
    versions.push({ version: Number(m[1]), valeur: m[2] });
  }
  if (versions[0].valeur.length < 32) mauvais(`la version ${versions[0].version}, la première, doit faire 32 caractères au moins.`);
  bon(`versions ${versions.map((x) => x.version).join(", ")} ; la ${versions[0].version} sert aux nouvelles signatures et aux nouveaux chiffrements.`);
}

async function testerStripe(nom, v) {
  const base = process.env.PULSE_SONDES_STRIPE_API || "https://api.stripe.com";
  let reponse;
  try {
    reponse = await fetch(`${base}/v1/balance`, { headers: { Authorization: `Bearer ${v[nom]}` }, signal: AbortSignal.timeout(15000) });
  } catch (e) {
    sansTest(`Stripe injoignable (${raison(e.cause || e)}) : réessayez plus tard.`);
  }
  const mode = VARIABLES.STRIPE_SECRET_KEY.prefixes.find((p) => v[nom].startsWith(p));
  const libelle = mode ? ` (${VARIABLES.STRIPE_SECRET_KEY.modes[mode]})` : "";
  if (reponse.status === 200) bon(`clé acceptée par Stripe${libelle}.`);
  if (reponse.status === 403) bon(`clé valide${libelle}, sans le droit de lire le solde : normal pour une clé restreinte.`);
  if (reponse.status === 401) mauvais(`clé refusée par Stripe${libelle} : révoquée, expirée ou mal copiée.`);
  mauvais(`réponse inattendue de Stripe (code ${reponse.status}).`);
}

async function testerSmtp(nom, v) {
  if (!v.SMTP_HOST) mauvais("SMTP_HOST manque : le test a besoin du serveur.");
  const nodemailer = dependance("nodemailer");
  const port = Number(v.SMTP_PORT) || 587;
  const transporteur = nodemailer.createTransport({
    host: v.SMTP_HOST,
    port,
    secure: port === 465,
    auth: v.SMTP_USER ? { user: v.SMTP_USER, pass: v[nom] } : undefined,
  });
  try {
    await dansLesTemps(transporteur.verify());
    bon(`le serveur ${v.SMTP_HOST} accepte l'identifiant et le mot de passe (aucun e-mail envoyé).`);
  } catch (e) {
    mauvais(`le serveur ${v.SMTP_HOST} refuse la connexion : ${raison(e)}`);
  }
}

async function testerR2(nom, v) {
  for (const b of ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) if (!v[b]) mauvais(`${b} manque : le test a besoin des quatre variables R2.`);
  const { S3Client, HeadBucketCommand } = dependance("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${v.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: v.R2_ACCESS_KEY_ID, secretAccessKey: v.R2_SECRET_ACCESS_KEY },
  });
  try {
    await dansLesTemps(client.send(new HeadBucketCommand({ Bucket: v.R2_BUCKET })));
    bon(`le jeton R2 ouvre le bucket ${v.R2_BUCKET}.`);
  } catch (e) {
    const statut = e && e.$metadata && e.$metadata.httpStatusCode;
    mauvais(`le jeton R2 n'ouvre pas le bucket ${v.R2_BUCKET}${statut ? ` (code ${statut})` : ""} : ${raison(e)}`);
  }
}

async function testerUpstash(nom, v) {
  const url = v.UPSTASH_REDIS_REST_URL;
  if (!url) mauvais("UPSTASH_REDIS_REST_URL manque : le test a besoin de l'adresse.");
  let reponse;
  try {
    reponse = await fetch(`${url.replace(/\/$/, "")}/ping`, { headers: { Authorization: `Bearer ${v[nom]}` }, signal: AbortSignal.timeout(15000) });
  } catch (e) {
    mauvais(`base Upstash injoignable : ${raison(e.cause || e)}`);
  }
  let corps = {};
  try {
    corps = await reponse.json();
  } catch (e) {
    // réponse sans JSON
  }
  if (reponse.status === 200 && corps.result === "PONG") bon("Upstash répond PONG avec ce jeton.");
  if (reponse.status === 401) mauvais("jeton refusé par Upstash : réinitialisé ou mal copié.");
  mauvais(`réponse inattendue d'Upstash (code ${reponse.status}).`);
}

function testerSecretFormulaire(nom, v) {
  if (v[nom].length < 32) mauvais("trop courte : 32 caractères au moins (pulse-aidd secrets generer FORMULAIRE_SECRET).");
  bon("longueur suffisante ; le vrai test : envoyer un formulaire public sur le site après le redéploiement.");
}

async function testerTurnstile(nom, v) {
  const base = process.env.PULSE_SONDES_TURNSTILE_API || "https://challenges.cloudflare.com";
  let reponse;
  try {
    reponse = await fetch(`${base}/turnstile/v0/siteverify`, {
      method: "POST",
      body: new URLSearchParams({ secret: v[nom], response: "verification-de-la-cle" }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    mauvais(`Turnstile injoignable : ${raison(e.cause || e)}`);
  }
  let corps = {};
  try {
    corps = await reponse.json();
  } catch (e) {
    // réponse sans JSON
  }
  const codes = corps["error-codes"] || [];
  if (codes.includes("invalid-input-secret")) mauvais("clé secrète refusée par Turnstile : supprimée, renouvelée ou mal copiée.");
  if (corps.success === true || codes.includes("invalid-input-response")) bon("Turnstile reconnaît cette clé secrète (aucun visiteur vérifié).");
  mauvais(`réponse inattendue de Turnstile (code ${reponse.status}).`);
}

const TESTS = {
  DATABASE_URL: testerNeon,
  DATABASE_URL_DIRECT: testerNeon,
  BETTER_AUTH_SECRET: testerSecretAuth,
  BETTER_AUTH_SECRETS: testerSecretsAuth,
  STRIPE_SECRET_KEY: testerStripe,
  SMTP_PASSWORD: testerSmtp,
  R2_ACCESS_KEY_ID: testerR2,
  R2_SECRET_ACCESS_KEY: testerR2,
  UPSTASH_REDIS_REST_TOKEN: testerUpstash,
  FORMULAIRE_SECRET: testerSecretFormulaire,
  TURNSTILE_SECRET_KEY: testerTurnstile,
};
const SANS_TEST = {
  STRIPE_WEBHOOK_SECRET: "pas de test direct : dans Stripe, envoyez un événement de test à la destination du webhook et vérifiez la réponse 2xx.",
};

async function tester(nom) {
  let valeurs;
  try {
    valeurs = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch (e) {
    mauvais("entrée illisible : le test attend les valeurs sur l'entrée standard, en JSON.");
  }
  // Les réglages publics (serveur, bucket, adresse) restent lisibles ; tout le reste est masqué.
  valeursAMasquer = Object.entries(valeurs).filter(([n, x]) => typeof x === "string" && !(VARIABLES[n] && VARIABLES[n].secret === false)).map(([, x]) => x);
  if (SANS_TEST[nom]) sansTest(SANS_TEST[nom]);
  if (!TESTS[nom]) sansTest(`pas de test réel pour ${nom} : testez la fonction qui l'utilise, sur le site.`);
  if (!valeurs[nom]) mauvais(`${nom} est vide.`);
  await TESTS[nom](nom, valeurs);
}

// ---------------------------------------------------------------- Règles et fiche

/** Le fichier des variables validées : src/config/env.ts (structure actuelle), sinon src/lib/env.ts. */
function fichierEnv(racine) {
  return [path.join(racine, "src", "config", "env.ts"), path.join(racine, "src", "lib", "env.ts")].find((f) => fs.existsSync(f)) || null;
}

function nomsDuCode() {
  const f = fichierEnv(process.cwd());
  if (!f) return [];
  return [...fs.readFileSync(f, "utf8").matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:\s*z\./gm)].map((m) => m[1]);
}

function sectionFiche(nom) {
  const lignes = fs.readFileSync(FICHE, "utf8").split("\n");
  const debut = lignes.findIndex((l) => /^### /.test(l) && l.includes(`\`${nom}\``));
  if (debut === -1) return null;
  let fin = debut + 1;
  while (fin < lignes.length && !/^##{1,2} /.test(lignes[fin])) fin++;
  return lignes.slice(debut, fin).join("\n").trim();
}

async function principal() {
  const [action, nom] = process.argv.slice(2);
  if (action === "regles") {
    fs.writeSync(1, JSON.stringify({ variables: VARIABLES, code: nomsDuCode() }, null, 2) + "\n");
    return;
  }
  if (action === "tester" && /^[A-Z_][A-Z0-9_]*$/.test(nom || "")) return tester(nom);
  if (action === "fiche" && nom) {
    const section = sectionFiche(nom);
    if (section) return finir(0, section);
    finir(1, `Pas de fiche pour ${nom} dans le pack. Variables décrites : ${Object.keys(VARIABLES).join(", ")}. Pour une autre variable : la documentation officielle de son fournisseur.`);
  }
  finir(1, "Usage : pulse-pile-next secrets regles | tester <NOM> (valeurs en JSON sur l'entrée standard) | fiche <NOM>");
}

if (require.main === module) principal().catch((e) => finir(1, `❌ test interrompu : ${raison(e)}`));

module.exports = { VARIABLES, sectionFiche };

// Tests des règles et des tests réels des secrets du pack (scripts/sondes-secrets.js).
// Lancer : node --test plugins/pulse-vibe-next/tests/sondes-secrets.test.js
//
// Les valeurs factices sont construites à l'exécution : ce fichier ne contient aucune clé reconnaissable.
// Les services (Stripe, Upstash) sont simulés par un serveur local ; les dépendances du projet
// (pilote Neon, nodemailer, client S3) par de faux modules placés dans node_modules.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { ecouter } = require("../../pulse-vibe/scripts/port-libre");

const SCRIPT = path.join(__dirname, "..", "scripts", "sondes-secrets.js");
const FICHE = path.join(__dirname, "..", "references", "contexte", "secrets.md");
const { VARIABLES, sectionFiche } = require(SCRIPT);
const hasard = (n = 12) => crypto.randomBytes(n).toString("hex");

function projet(modules = {}) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-sondes-"));
  fs.writeFileSync(path.join(dossier, "package.json"), '{ "name": "essai", "private": true }\n');
  for (const [nom, code] of Object.entries(modules)) {
    const d = path.join(dossier, "node_modules", ...nom.split("/"));
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ name: nom, main: "index.js" }));
    fs.writeFileSync(path.join(d, "index.js"), code);
  }
  return dossier;
}

function lancer(dossier, args, entree, env = {}) {
  return new Promise((resoudre) => {
    const p = spawn("node", [SCRIPT, ...args], { cwd: dossier, env: { ...process.env, ...env } });
    let sortie = "";
    p.stdout.on("data", (d) => (sortie += d));
    p.stderr.on("data", (d) => (sortie += d));
    p.on("close", (code) => resoudre({ code, sortie }));
    p.stdin.end(entree === undefined ? "" : entree);
  });
}

function serveur(repondre) {
  const recues = [];
  const s = http.createServer((req, res) => {
    recues.push({ url: req.url, autorisation: req.headers.authorization });
    const { statut, corps } = repondre(req);
    res.writeHead(statut, { "Content-Type": "application/json" });
    res.end(JSON.stringify(corps || {}));
  });
  return ecouter(s).then((port) => ({ s, url: `http://127.0.0.1:${port}`, recues }));
}

const sansValeur = (sortie, ...valeurs) => {
  for (const v of valeurs) assert.ok(!sortie.includes(v), `la sortie contient une valeur :\n${sortie}`);
};

// ---------------------------------------------------------------- regles et fiche

test("regles : JSON des variables du pack et noms déclarés dans src/lib/env.ts", async () => {
  const d = projet();
  fs.mkdirSync(path.join(d, "src", "lib"), { recursive: true });
  fs.writeFileSync(path.join(d, "src", "lib", "env.ts"), "const s = z.object({\n  DATABASE_URL: z.url(),\n  MA_CLE_API: z.string().min(1),\n});\n");
  const r = await lancer(d, ["regles"]);
  assert.strictEqual(r.code, 0, r.sortie);
  const json = JSON.parse(r.sortie);
  assert.deepStrictEqual(json.code, ["DATABASE_URL", "MA_CLE_API"]);
  assert.deepStrictEqual(json.variables.DATABASE_URL.groupe, ["DATABASE_URL", "DATABASE_URL_DIRECT"]);
  assert.strictEqual(json.variables.BETTER_AUTH_URL.secret, false);
});

test("regles : variables propres à chaque environnement et clé de sauvegarde Neon", () => {
  const propres = Object.entries(VARIABLES).filter(([, r]) => r.parEnvironnement).map(([nom]) => nom);
  assert.deepStrictEqual(propres.sort(), ["BETTER_AUTH_URL", "DATABASE_URL", "DATABASE_URL_DIRECT", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
  assert.strictEqual(VARIABLES.NEON_API_KEY.prefixes, undefined);
  assert.strictEqual(VARIABLES.NEON_PROJECT_ID.secret, false);
  assert.deepStrictEqual(VARIABLES.NEON_API_KEY.suites, ["NEON_ENDPOINT_PRODUCTION"]);
  assert.strictEqual(VARIABLES.NEON_ENDPOINT_PRODUCTION.secret, false);
});

test("regles : lit src/config/env.ts (structure actuelle) avant src/lib/env.ts", async () => {
  const d = projet();
  fs.mkdirSync(path.join(d, "src", "config"), { recursive: true });
  fs.writeFileSync(path.join(d, "src", "config", "env.ts"), "const s = z.object({\n  DATABASE_URL: z.url(),\n  CLE_NOUVELLE: z.string().min(1),\n});\n");
  fs.mkdirSync(path.join(d, "src", "lib"), { recursive: true });
  fs.writeFileSync(path.join(d, "src", "lib", "env.ts"), "const s = z.object({\n  ANCIENNE: z.string(),\n});\n");
  const r = await lancer(d, ["regles"]);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.deepStrictEqual(JSON.parse(r.sortie).code, ["DATABASE_URL", "CLE_NOUVELLE"]);
});

test("regles : lit les noms des blocs server et client d'un env.ts t3", async () => {
  const d = projet();
  fs.mkdirSync(path.join(d, "src", "config"), { recursive: true });
  fs.writeFileSync(
    path.join(d, "src", "config", "env.ts"),
    "export const env = createEnv({\n  server: {\n    DATABASE_URL: z.url(),\n  },\n  client: {\n    NEXT_PUBLIC_CLE_SITE: z.string().min(1).optional(),\n  },\n  experimental__runtimeEnv: {\n    NEXT_PUBLIC_CLE_SITE: process.env.NEXT_PUBLIC_CLE_SITE,\n  },\n});\n",
  );
  const r = await lancer(d, ["regles"]);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.deepStrictEqual(JSON.parse(r.sortie).code, ["DATABASE_URL", "NEXT_PUBLIC_CLE_SITE"]);
});

test("la fiche décrit chaque variable des règles, avec ses préfixes attendus", () => {
  const texte = fs.readFileSync(FICHE, "utf8");
  for (const [nom, regle] of Object.entries(VARIABLES)) {
    if (/^(SMTP_HOST|SMTP_PORT|SMTP_USER|MAIL_FROM|R2_ACCOUNT_ID|R2_BUCKET|UPSTASH_REDIS_REST_URL|NEON_PROJECT_ID|NEON_ENDPOINT_PRODUCTION)$/.test(nom)) {
      assert.ok(texte.includes(`\`${nom}\``), `${nom} cité dans la fiche`);
      continue;
    }
    const section = sectionFiche(nom);
    assert.ok(section, `section de fiche pour ${nom}`);
    for (const p of regle.prefixes || []) assert.ok(section.includes(`\`${p}\``) || section.includes(p), `${nom} : préfixe ${p} dans la fiche`);
  }
});

test("fiche <NOM> : affiche la section ; nom inconnu : liste des variables et code 1", async () => {
  const d = projet();
  const r = await lancer(d, ["fiche", "DATABASE_URL_DIRECT"]);
  assert.strictEqual(r.code, 0);
  assert.match(r.sortie, /^### `DATABASE_URL` et `DATABASE_URL_DIRECT`/);
  assert.match(r.sortie, /Restart compute/);
  assert.ok(!r.sortie.includes("### `BETTER_AUTH_SECRET`"), "une seule section");
  const inconnu = await lancer(d, ["fiche", "AUTRE"]);
  assert.strictEqual(inconnu.code, 1);
  assert.match(inconnu.sortie, /STRIPE_SECRET_KEY/);
});

// ---------------------------------------------------------------- tests sans réseau

test("BETTER_AUTH_SECRET et BETTER_AUTH_SECRETS : longueur et forme versionnée, sans afficher la valeur", async () => {
  const d = projet();
  const bonne = hasard(20);
  const ok = await lancer(d, ["tester", "BETTER_AUTH_SECRETS"], JSON.stringify({ BETTER_AUTH_SECRETS: `3:${bonne},1:${hasard(4)}` }));
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /versions 3, 1/);
  sansValeur(ok.sortie, bonne);
  for (const [valeur, attendu] of [[`2:${hasard(4)}`, /32 caractères/], [`${bonne}`, /forme attendue/], [`2:${bonne},2:${bonne}`, /deux fois/]]) {
    const r = await lancer(d, ["tester", "BETTER_AUTH_SECRETS"], JSON.stringify({ BETTER_AUTH_SECRETS: valeur }));
    assert.strictEqual(r.code, 1, valeur);
    assert.match(r.sortie, attendu);
    sansValeur(r.sortie, bonne);
  }
  const courte = await lancer(d, ["tester", "BETTER_AUTH_SECRET"], JSON.stringify({ BETTER_AUTH_SECRET: "abc" + hasard(4) }));
  assert.strictEqual(courte.code, 1);
  assert.strictEqual((await lancer(d, ["tester", "BETTER_AUTH_SECRET"], JSON.stringify({ BETTER_AUTH_SECRET: bonne }))).code, 0);
});

test("variables sans test réel : code 3 et la marche à suivre", async () => {
  const d = projet();
  const webhook = await lancer(d, ["tester", "STRIPE_WEBHOOK_SECRET"], JSON.stringify({ STRIPE_WEBHOOK_SECRET: "whsec_" + hasard() }));
  assert.strictEqual(webhook.code, 3);
  assert.match(webhook.sortie, /événement de test/);
  const autre = await lancer(d, ["tester", "MAIL_FROM"], JSON.stringify({ MAIL_FROM: "x" }));
  assert.strictEqual(autre.code, 3);
  const vide = await lancer(d, ["tester", "STRIPE_SECRET_KEY"], JSON.stringify({ STRIPE_SECRET_KEY: "" }));
  assert.strictEqual(vide.code, 1);
});

// ---------------------------------------------------------------- services simulés

test("Stripe : 200 accepté, 403 clé restreinte valide, 401 refusée ; la clé part dans l'en-tête, jamais à l'écran", async () => {
  const d = projet();
  let statut = 200;
  const { s, url, recues } = await serveur(() => ({ statut }));
  const cle = ["sk", "test", hasard(14)].join("_");
  const env = { PULSE_SONDES_STRIPE_API: url };
  const entree = JSON.stringify({ STRIPE_SECRET_KEY: cle });
  const ok = await lancer(d, ["tester", "STRIPE_SECRET_KEY"], entree, env);
  statut = 403;
  const restreinte = await lancer(d, ["tester", "STRIPE_SECRET_KEY"], entree, env);
  statut = 401;
  const refusee = await lancer(d, ["tester", "STRIPE_SECRET_KEY"], entree, env);
  s.close();
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /acceptée par Stripe \(mode test\)/);
  assert.strictEqual(restreinte.code, 0);
  assert.match(restreinte.sortie, /clé restreinte/);
  assert.strictEqual(refusee.code, 1);
  assert.match(refusee.sortie, /refusée par Stripe/);
  assert.strictEqual(recues[0].url, "/v1/balance");
  assert.strictEqual(recues[0].autorisation, `Bearer ${cle}`);
  sansValeur(ok.sortie + restreinte.sortie + refusee.sortie, cle);
});

test("clé Neon : projet lu (200) accepté, 401/403/404 refusés, sans identifiant de projet : code 3 ; la clé part dans l'en-tête, jamais à l'écran", async () => {
  const d = projet();
  let statut = 200;
  const { s, url, recues } = await serveur(() => ({ statut }));
  const cle = "napi_" + hasard(16);
  const env = { PULSE_SONDES_NEON_API: url };
  const entree = JSON.stringify({ NEON_API_KEY: cle, NEON_PROJECT_ID: "projet-essai" });
  const ok = await lancer(d, ["tester", "NEON_API_KEY"], entree, env);
  const refus = [];
  for (const code of [401, 403, 404]) {
    statut = code;
    refus.push(await lancer(d, ["tester", "NEON_API_KEY"], entree, env));
  }
  const sansProjet = await lancer(d, ["tester", "NEON_API_KEY"], JSON.stringify({ NEON_API_KEY: cle }), env);
  s.close();
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /acceptée par Neon/);
  for (const r of refus) {
    assert.strictEqual(r.code, 1);
    assert.match(r.sortie, /clé ou identifiant de projet refusés/);
  }
  assert.strictEqual(sansProjet.code, 3);
  assert.strictEqual(recues[0].url, "/projects/projet-essai");
  assert.strictEqual(recues[0].autorisation, `Bearer ${cle}`);
  assert.strictEqual(recues.length, 4);
  sansValeur(ok.sortie + refus.map((r) => r.sortie).join("") + sansProjet.sortie, cle);
});

test("clé Neon : API injoignable = test impossible (code 3), pas un échec", async () => {
  const d = projet();
  const s = http.createServer();
  const port = await ecouter(s);
  await new Promise((ok) => s.close(ok));
  const cle = "napi_" + hasard(16);
  const r = await lancer(d, ["tester", "NEON_API_KEY"], JSON.stringify({ NEON_API_KEY: cle, NEON_PROJECT_ID: "p" }), { PULSE_SONDES_NEON_API: `http://127.0.0.1:${port}` });
  assert.strictEqual(r.code, 3, r.sortie);
  sansValeur(r.sortie, cle);
});

test("suites de la clé Neon : point d'accès de la branche principale, pour Preview ; la clé part dans l'en-tête, jamais à l'écran", async () => {
  const d = projet();
  let statut = 200;
  const { s, url, recues } = await serveur((req) => {
    if (statut !== 200) return { statut };
    if (req.url === "/projects/projet-essai/branches?limit=100")
      return { statut: 200, corps: { branches: [{ id: "br-apercu", default: false }, { id: "br-principale", default: true }] } };
    if (req.url === "/projects/projet-essai/branches/br-principale/endpoints")
      return { statut: 200, corps: { endpoints: [{ id: "ep-lecture-1", type: "read_only" }, { id: "ep-principale-123", type: "read_write" }] } };
    return { statut: 404 };
  });
  const cle = "napi_" + hasard(16);
  const env = { PULSE_SONDES_NEON_API: url };
  const ok = await lancer(d, ["suites", "NEON_API_KEY"], JSON.stringify({ NEON_API_KEY: cle, NEON_PROJECT_ID: "projet-essai" }), env);
  statut = 401;
  const refus = await lancer(d, ["suites", "NEON_API_KEY"], JSON.stringify({ NEON_API_KEY: cle, NEON_PROJECT_ID: "projet-essai" }), env);
  const sansProjet = await lancer(d, ["suites", "NEON_API_KEY"], JSON.stringify({ NEON_API_KEY: cle }), env);
  const autre = await lancer(d, ["suites", "STRIPE_SECRET_KEY"], JSON.stringify({ STRIPE_SECRET_KEY: "x" }), env);
  s.close();
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.deepStrictEqual(JSON.parse(ok.sortie), { variables: [{ nom: "NEON_ENDPOINT_PRODUCTION", environnements: ["preview"], valeur: "ep-principale-123" }] });
  assert.deepStrictEqual(recues.slice(0, 2).map((r) => r.url), ["/projects/projet-essai/branches?limit=100", "/projects/projet-essai/branches/br-principale/endpoints"]);
  assert.ok(recues.every((r) => r.autorisation === `Bearer ${cle}`));
  assert.strictEqual(refus.code, 1);
  assert.match(refus.sortie, /Neon refuse la lecture \(code 401\)/);
  assert.strictEqual(sansProjet.code, 3);
  assert.match(sansProjet.sortie, /NEON_PROJECT_ID manque/);
  assert.strictEqual(autre.code, 3);
  sansValeur(ok.sortie + refus.sortie + sansProjet.sortie, cle);
});

test("suites de la clé Neon : sans branche principale, sans point d'accès en écriture : la solution est donnée", async () => {
  const d = projet();
  let cas = "sans-principale";
  const { s, url } = await serveur((req) => {
    if (req.url.includes("/branches?")) {
      return { statut: 200, corps: { branches: cas === "sans-principale" ? [{ id: "br-a", default: false }] : [{ id: "br-principale", default: true }] } };
    }
    return { statut: 200, corps: { endpoints: [{ id: "ep-lecture-1", type: "read_only" }] } };
  });
  const entree = JSON.stringify({ NEON_API_KEY: "napi_" + hasard(16), NEON_PROJECT_ID: "projet-essai" });
  const env = { PULSE_SONDES_NEON_API: url };
  for (const c of ["sans-principale", "sans-ecriture"]) {
    cas = c;
    const r = await lancer(d, ["suites", "NEON_API_KEY"], entree, env);
    assert.strictEqual(r.code, 1, r.sortie);
    assert.match(r.sortie, /console Neon → Branches/, c);
    assert.match(r.sortie, /prévisualisations sautent leurs migrations/, c);
    assert.match(r.sortie, /retirer NEON_API_KEY de \.env\.envoi/, c);
  }
  s.close();
});

test("Upstash : PONG accepté, 401 refusé", async () => {
  const d = projet();
  let statut = 200;
  const { s, url, recues } = await serveur(() => ({ statut, corps: statut === 200 ? { result: "PONG" } : { error: "Unauthorized" } }));
  const jeton = "AX" + hasard(20);
  const entree = JSON.stringify({ UPSTASH_REDIS_REST_TOKEN: jeton, UPSTASH_REDIS_REST_URL: url });
  const ok = await lancer(d, ["tester", "UPSTASH_REDIS_REST_TOKEN"], entree, { PULSE_SONDES_HOTES_ACCEPTES: "127.0.0.1" });
  statut = 401;
  const ko = await lancer(d, ["tester", "UPSTASH_REDIS_REST_TOKEN"], entree, { PULSE_SONDES_HOTES_ACCEPTES: "127.0.0.1" });
  s.close();
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /PONG/);
  assert.strictEqual(ko.code, 1);
  assert.strictEqual(recues[0].url, "/ping");
  sansValeur(ok.sortie + ko.sortie, jeton);
});

test("Turnstile : clé reconnue (réponse factice refusée), clé refusée ; la clé part dans le corps, jamais à l'écran", async () => {
  const d = projet();
  let codes = ["invalid-input-response"];
  const recues = [];
  const s = http.createServer((req, res) => {
    let corps = "";
    req.on("data", (x) => (corps += x));
    req.on("end", () => {
      recues.push({ url: req.url, corps: new URLSearchParams(corps) });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, "error-codes": codes }));
    });
  });
  const env = { PULSE_SONDES_TURNSTILE_API: `http://127.0.0.1:${await ecouter(s)}` };
  const cle = "0x" + hasard(16);
  const entree = JSON.stringify({ TURNSTILE_SECRET_KEY: cle });
  const ok = await lancer(d, ["tester", "TURNSTILE_SECRET_KEY"], entree, env);
  codes = ["invalid-input-secret"];
  const ko = await lancer(d, ["tester", "TURNSTILE_SECRET_KEY"], entree, env);
  s.close();
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /reconnaît cette clé/);
  assert.strictEqual(ko.code, 1);
  assert.match(ko.sortie, /refusée par Turnstile/);
  assert.strictEqual(recues[0].url, "/turnstile/v0/siteverify");
  assert.strictEqual(recues[0].corps.get("secret"), cle);
  sansValeur(ok.sortie + ko.sortie, cle);
});

test("FORMULAIRE_SECRET : longueur vérifiée, valeur jamais affichée", async () => {
  const d = projet();
  const bonne = hasard(20);
  const ok = await lancer(d, ["tester", "FORMULAIRE_SECRET"], JSON.stringify({ FORMULAIRE_SECRET: bonne }));
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /formulaire public/);
  const courte = await lancer(d, ["tester", "FORMULAIRE_SECRET"], JSON.stringify({ FORMULAIRE_SECRET: "abc" + hasard(4) }));
  assert.strictEqual(courte.code, 1);
  assert.match(courte.sortie, /32 caractères/);
  sansValeur(ok.sortie + courte.sortie, bonne);
});

test("SMTP : vérification par nodemailer du projet ; un message d'erreur qui contient le mot de passe est masqué", async () => {
  const d = projet({
    nodemailer: `exports.createTransport = (o) => ({ verify: async () => {
      if (o.auth.pass !== process.env.ATTENDU) throw Object.assign(new Error("Invalid login for " + o.auth.pass), { code: "EAUTH" });
      return true; } });`,
  });
  const mdp = "Mdp" + hasard(8);
  const entree = (pass) => JSON.stringify({ SMTP_PASSWORD: pass, SMTP_HOST: "smtp-relay.brevo.com", SMTP_PORT: "587", SMTP_USER: "projet@exemple.test" });
  const ok = await lancer(d, ["tester", "SMTP_PASSWORD"], entree(mdp), { ATTENDU: mdp });
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /accepte l'identifiant/);
  const ko = await lancer(d, ["tester", "SMTP_PASSWORD"], entree(mdp), { ATTENDU: "autre" });
  assert.strictEqual(ko.code, 1);
  assert.match(ko.sortie, /EAUTH/);
  assert.match(ko.sortie, /«valeur masquée»/);
  sansValeur(ok.sortie + ko.sortie, mdp);
});

test("Neon : select 1 par le pilote du projet ; mots de passe différents entre les deux adresses refusés ; autre hôte sans test", async () => {
  const d = projet({ "@neondatabase/serverless": "exports.neon = () => ({ query: async () => [{ ok: 1 }] });" });
  const mdp = "Pw" + hasard(10);
  const adresse = (hote, pw = mdp) => "postgres" + `ql://appli:${pw}@${hote}/base`;
  const pooled = adresse("ep-essai-pooler.eu-central-1.aws.neon.tech");
  const directe = adresse("ep-essai.eu-central-1.aws.neon.tech");
  const ok = await lancer(d, ["tester", "DATABASE_URL"], JSON.stringify({ DATABASE_URL: pooled, DATABASE_URL_DIRECT: directe }));
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /select 1/);
  const ecart = await lancer(d, ["tester", "DATABASE_URL"], JSON.stringify({ DATABASE_URL: pooled, DATABASE_URL_DIRECT: adresse("ep-essai.eu-central-1.aws.neon.tech", "Autre" + hasard(4)) }));
  assert.strictEqual(ecart.code, 1);
  assert.match(ecart.sortie, /même mot de passe/);
  const inverse = await lancer(d, ["tester", "DATABASE_URL"], JSON.stringify({ DATABASE_URL: directe }));
  assert.match(inverse.sortie, /sans -pooler/);
  const local = await lancer(d, ["tester", "DATABASE_URL"], JSON.stringify({ DATABASE_URL: adresse("localhost:5432") }));
  assert.strictEqual(local.code, 3);
  sansValeur(ok.sortie + ecart.sortie + inverse.sortie + local.sortie, mdp);
});

test("R2 : HeadBucket par le client S3 du projet ; dépendance absente : code 3", async () => {
  const d = projet({
    "@aws-sdk/client-s3": `class HeadBucketCommand { constructor(i) { this.input = i; } }
      class S3Client { constructor(o) { this.o = o; } async send(c) {
        if (this.o.credentials.secretAccessKey !== process.env.ATTENDU) throw Object.assign(new Error("Forbidden"), { name: "Forbidden", $metadata: { httpStatusCode: 403 } });
        if (!this.o.endpoint.endsWith(".eu.r2.cloudflarestorage.com")) throw new Error("mauvaise adresse");
        return {}; } }
      module.exports = { S3Client, HeadBucketCommand };`,
  });
  const secret = hasard(32);
  const valeurs = { R2_ACCOUNT_ID: hasard(16), R2_BUCKET: "fichiers", R2_ACCESS_KEY_ID: hasard(16), R2_SECRET_ACCESS_KEY: secret };
  const ok = await lancer(d, ["tester", "R2_SECRET_ACCESS_KEY"], JSON.stringify(valeurs), { ATTENDU: secret });
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /ouvre le bucket fichiers/);
  const ko = await lancer(d, ["tester", "R2_ACCESS_KEY_ID"], JSON.stringify(valeurs), { ATTENDU: "autre" });
  assert.strictEqual(ko.code, 1);
  assert.match(ko.sortie, /code 403/);
  sansValeur(ok.sortie + ko.sortie, secret);
  const sansModule = await lancer(projet(), ["tester", "R2_SECRET_ACCESS_KEY"], JSON.stringify(valeurs));
  assert.strictEqual(sansModule.code, 3);
  assert.match(sansModule.sortie, /npm install/);
});

test("SMTP : serveur inconnu, le mot de passe ne part pas (code 3, serveur nommé)", async () => {
  const d = projet({ nodemailer: `exports.createTransport = () => { throw new Error("transporteur créé"); };` });
  const mdp = "Mdp" + hasard(8);
  const r = await lancer(d, ["tester", "SMTP_PASSWORD"], JSON.stringify({ SMTP_PASSWORD: mdp, SMTP_HOST: "smtp.attaquant.example", SMTP_PORT: "587", SMTP_USER: "projet@exemple.test" }));
  assert.strictEqual(r.code, 3, r.sortie);
  assert.match(r.sortie, /smtp\.attaquant\.example/);
  assert.doesNotMatch(r.sortie, /transporteur créé/);
  sansValeur(r.sortie, mdp);
});

test("Upstash : adresse hors upstash.io, le jeton ne part pas", async () => {
  const d = projet();
  const { s, url, recues } = await serveur(() => ({ statut: 200, corps: { result: "PONG" } }));
  const jeton = "AX" + hasard(20);
  const r = await lancer(d, ["tester", "UPSTASH_REDIS_REST_TOKEN"], JSON.stringify({ UPSTASH_REDIS_REST_TOKEN: jeton, UPSTASH_REDIS_REST_URL: url }));
  s.close();
  assert.strictEqual(r.code, 3, r.sortie);
  assert.strictEqual(recues.length, 0);
  sansValeur(r.sortie, jeton);
});

test("R2 : identifiant de compte invalide, la clé ne part pas", async () => {
  const d = projet({ "@aws-sdk/client-s3": `class HeadBucketCommand {} class S3Client { async send() { throw new Error("CLIENT_R2_APPELE"); } } module.exports = { S3Client, HeadBucketCommand };` });
  const secret = hasard(32);
  const r = await lancer(d, ["tester", "R2_SECRET_ACCESS_KEY"], JSON.stringify({ R2_ACCOUNT_ID: "attaquant.example/#", R2_BUCKET: "fichiers", R2_ACCESS_KEY_ID: hasard(16), R2_SECRET_ACCESS_KEY: secret }));
  assert.strictEqual(r.code, 1, r.sortie);
  assert.match(r.sortie, /R2_ACCOUNT_ID/);
  assert.doesNotMatch(r.sortie, /CLIENT_R2_APPELE/);
  sansValeur(r.sortie, secret);
});

test("SMTP : nom qui ressemble à un serveur connu (smtp-relay-brevo.com), le mot de passe ne part pas", async () => {
  const d = projet({ nodemailer: `exports.createTransport = () => { throw new Error("transporteur créé"); };` });
  const mdp = "Mdp" + hasard(8);
  const r = await lancer(d, ["tester", "SMTP_PASSWORD"], JSON.stringify({ SMTP_PASSWORD: mdp, SMTP_HOST: "smtp-relay-brevo.com", SMTP_PORT: "587", SMTP_USER: "projet@exemple.test" }));
  assert.strictEqual(r.code, 3, r.sortie);
  assert.match(r.sortie, /smtp-relay-brevo\.com/);
  assert.doesNotMatch(r.sortie, /transporteur créé/);
  sansValeur(r.sortie, mdp);
});

test("Upstash : attacker-upstash.io n'est pas une adresse Upstash, le jeton ne part pas", async () => {
  const d = projet();
  const jeton = "AX" + hasard(20);
  const r = await lancer(d, ["tester", "UPSTASH_REDIS_REST_TOKEN"], JSON.stringify({ UPSTASH_REDIS_REST_TOKEN: jeton, UPSTASH_REDIS_REST_URL: "https://attacker-upstash.io" }));
  assert.strictEqual(r.code, 3, r.sortie);
  assert.match(r.sortie, /attacker-upstash\.io/);
  assert.doesNotMatch(r.sortie, /PONG|injoignable/);
  sansValeur(r.sortie, jeton);
});

test("Upstash : adresse en http://, le jeton ne part pas en clair", async () => {
  const d = projet();
  const jeton = "AX" + hasard(20);
  const r = await lancer(d, ["tester", "UPSTASH_REDIS_REST_TOKEN"], JSON.stringify({ UPSTASH_REDIS_REST_TOKEN: jeton, UPSTASH_REDIS_REST_URL: "http://demo.upstash.io" }));
  assert.strictEqual(r.code, 3, r.sortie);
  assert.match(r.sortie, /https:\/\//);
  assert.doesNotMatch(r.sortie, /PONG|injoignable/);
  sansValeur(r.sortie, jeton);
});

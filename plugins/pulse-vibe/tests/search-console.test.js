// Tests de Search Console en lecture seule (pulse-aidd search-console).
// Lancer : node --test plugins/pulse-vibe/tests/search-console.test.js
// Sans réseau ni compte Google : un serveur node:http local joue Google (PULSE_GSC_API, PULSE_GSC_JETON).
// Les jetons, secrets et clés de test sont factices et construits à l'exécution.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const zlib = require("zlib");
const crypto = require("crypto");
const { spawn } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "search-console.js");
const FIXTURES = path.join(__dirname, "fixtures", "search-console");
const MODELE = path.join(__dirname, "..", "templates", "rapport-search-console.md");
const sc = require(SCRIPT);

// Valeurs factices, au format des vrais jetons Google (pour vérifier qu'aucune sortie ne les montre).
const aleatoire = (n) => crypto.randomBytes(n).toString("base64url").replace(/[^0-9A-Za-z]/g, "x");
const FAUX = {
  acces: ["ya", "29."].join("") + aleatoire(40),
  rafraichissement: ["1", "//0"].join("") + aleatoire(40),
  secret: ["GOC", "SPX-"].join("") + aleatoire(21).slice(0, 28),
};
const MOTIFS_INTERDITS = [["ya", "29."].join(""), ["1", "//"].join(""), ["GOC", "SPX-"].join("")];
const CLE_PRIVEE = (contenu) => [["-----BEGIN", "PRIVATE KEY-----"].join(" "), contenu, ["-----END", "PRIVATE KEY-----"].join(" ")].join("\n");

function sansSecret(sortie) {
  for (const m of MOTIFS_INTERDITS) assert.ok(!sortie.includes(m), `la sortie contient « ${m} » :\n${sortie}`);
  for (const v of Object.values(FAUX)) assert.ok(!sortie.includes(v));
}

const dossierTemp = () => fs.mkdtempSync(path.join(os.tmpdir(), "pulse-gsc-"));
const paireRsa = () => crypto.generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });

// Lance le script sans bloquer la boucle d'événements (le serveur de test doit pouvoir répondre).
function lancer(args, { env = {}, cwd, surSortie } = {}) {
  return new Promise((resoudre) => {
    const p = spawn(process.execPath, [SCRIPT, ...args], { cwd, env: { ...process.env, PULSE_GSC_ATTENTE: "5", PULSE_GSC_AUJOURDHUI: "2026-10-07", ...env } });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => {
      stdout += d;
      if (surSortie) surSortie(stdout);
    });
    p.stderr.on("data", (d) => (stderr += d));
    p.on("close", (code) => resoudre({ code, stdout, stderr, sortie: stdout + stderr }));
  });
}

// ---------------------------------------------------------------- Faux Google

function fauxGoogle(options = {}) {
  const etat = { appels: [], scenario: options.scenario || "normal", startRows: [] };
  const lignes = (n, prefixe) => Array.from({ length: n }, (_, i) => ({ keys: [`${prefixe}${i}`], clicks: 10 - i, impressions: 200 - i * 10, ctr: (10 - i) / (200 - i * 10), position: 3 + i * 2 }));
  const serveur = http.createServer((req, res) => {
    let corps = "";
    req.on("data", (d) => (corps += d));
    req.on("end", () => {
      etat.appels.push({ methode: req.method, url: req.url, autorisation: req.headers.authorization || "", corps });
      const json = (statut, objet) => {
        res.writeHead(statut, { "Content-Type": "application/json" });
        res.end(JSON.stringify(objet));
      };
      const site = `http://127.0.0.1:${serveur.address().port}/`;
      if (req.url === "/token") {
        const p = new URLSearchParams(corps);
        if (etat.scenario === "expire") return json(400, { error: "invalid_grant" });
        if (p.get("grant_type") === "authorization_code") {
          etat.verifier = p.get("code_verifier");
          etat.code = p.get("code");
          return json(200, { access_token: FAUX.acces, refresh_token: FAUX.rafraichissement, scope: sc.PORTEE, expires_in: 3599 });
        }
        if (p.get("grant_type") === "refresh_token" || p.get("grant_type").includes("jwt-bearer")) return json(200, { access_token: FAUX.acces, expires_in: 3599 });
        return json(400, { error: "unsupported_grant_type" });
      }
      if (req.url === "/revoke") return json(200, {});
      if (req.url === "/sitemap.xml") {
        res.writeHead(200, { "Content-Type": "application/xml" });
        return res.end(`<?xml version="1.0"?><urlset><url><loc>${site}</loc></url><url><loc>${site}page0</loc></url><url><loc>${site}oubliee</loc></url></urlset>`);
      }
      if (req.headers.authorization !== `Bearer ${FAUX.acces}`) return json(401, { error: { message: "unauthenticated" } });
      if (req.url === "/webmasters/v3/sites") return json(200, { siteEntry: [{ siteUrl: site, permissionLevel: "siteRestrictedUser" }] });
      if (req.url.startsWith(`/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`)) {
        if (etat.scenario === "403") return json(403, { error: { message: "User does not have sufficient permission" } });
        if (etat.scenario === "429") return json(429, { error: { message: "Quota exceeded" } });
        if (etat.scenario === "neuf") return json(200, { responseAggregationType: "auto" });
        const q = JSON.parse(corps);
        if (q.dimensions.length === 0) return json(200, { rows: [{ clicks: 40, impressions: 1500, ctr: 40 / 1500, position: 7.2 }] });
        etat.startRows.push(`${q.dimensions[0]}:${q.startRow}`);
        const toutes = q.dimensions[0] === "page" ? lignes(3, site + "page") : lignes(5, "requete ");
        const facteur = q.startDate < "2026-09-01" ? 0.5 : 1;
        return json(200, { rows: toutes.slice(q.startRow, q.startRow + q.rowLimit).map((l) => ({ ...l, impressions: Math.round(l.impressions * facteur) })) });
      }
      if (req.url === "/v1/urlInspection/index:inspect") {
        const q = JSON.parse(corps);
        if (q.languageCode !== "en-US") return json(400, { error: { message: "languageCode" } });
        const oubliee = q.inspectionUrl.endsWith("/oubliee");
        return json(200, {
          inspectionResult: {
            indexStatusResult: oubliee
              ? { verdict: "NEUTRAL", coverageState: "Discovered - currently not indexed", indexingState: "INDEXING_ALLOWED", pageFetchState: "PAGE_FETCH_STATE_UNSPECIFIED" }
              : { verdict: "PASS", coverageState: "Submitted and indexed", indexingState: "INDEXING_ALLOWED", pageFetchState: "SUCCESSFUL", lastCrawlTime: "2026-10-01T08:00:00Z", googleCanonical: q.inspectionUrl, userCanonical: q.inspectionUrl },
          },
        });
      }
      return json(404, { error: { message: "inconnu" } });
    });
  });
  return new Promise((r) =>
    serveur.listen(0, "127.0.0.1", () => {
      const racine = `http://127.0.0.1:${serveur.address().port}`;
      r({ serveur, etat, site: `${racine}/`, env: { PULSE_GSC_API: racine, PULSE_GSC_JETON: `${racine}/token`, PULSE_GSC_REVOCATION: `${racine}/revoke` } });
    }),
  );
}

function connexionFactice() {
  const config = dossierTemp();
  fs.writeFileSync(path.join(config, "search-console.json"), JSON.stringify({ type: "oauth", client_id: "123-test.apps.googleusercontent.com", client_secret: FAUX.secret, refresh_token: FAUX.rafraichissement }));
  return config;
}

// ---------------------------------------------------------------- PKCE, JWT, connexion

test("PKCE : challenge = base64url(sha256(verifier)), méthode S256", () => {
  const { verifier, challenge, methode } = sc.pkce();
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.strictEqual(challenge, crypto.createHash("sha256").update(verifier).digest("base64url"));
  assert.strictEqual(methode, "S256");
  assert.notStrictEqual(sc.pkce().verifier, verifier);
});

test("adresse d'autorisation : portée webmasters.readonly seule, PKCE, bouclage 127.0.0.1, state", () => {
  const u = new URL(sc.urlAutorisation({ clientId: "abc", redirection: "http://127.0.0.1:5555", challenge: "ch", etat: "st" }));
  assert.strictEqual(u.searchParams.get("scope"), "https://www.googleapis.com/auth/webmasters.readonly");
  assert.strictEqual(u.searchParams.get("code_challenge_method"), "S256");
  assert.strictEqual(u.searchParams.get("code_challenge"), "ch");
  assert.strictEqual(u.searchParams.get("redirect_uri"), "http://127.0.0.1:5555");
  assert.strictEqual(u.searchParams.get("state"), "st");
  assert.strictEqual(u.searchParams.get("access_type"), "offline");
});

test("JWT de compte de service : signature RS256 vérifiée, aud, portée, exp ≤ 1 h", () => {
  const { privateKey, publicKey } = paireRsa();
  const maintenant = Date.UTC(2026, 9, 7, 10);
  const jwt = sc.jwtCompteService({ client_email: "lecteur@projet.iam.gserviceaccount.com", private_key: privateKey }, maintenant);
  const [entete, charge, signature] = jwt.split(".");
  assert.ok(crypto.verify("RSA-SHA256", Buffer.from(`${entete}.${charge}`), publicKey, Buffer.from(signature, "base64url")));
  assert.deepStrictEqual(JSON.parse(Buffer.from(entete, "base64url")), { alg: "RS256", typ: "JWT" });
  const c = JSON.parse(Buffer.from(charge, "base64url"));
  assert.strictEqual(c.aud, "https://oauth2.googleapis.com/token");
  assert.strictEqual(c.scope, sc.PORTEE);
  assert.strictEqual(c.iat, maintenant / 1000);
  assert.ok(c.exp - c.iat <= 3600);
});

test("bouclage : refuse une réponse dont le state diffère", async () => {
  const retour = await sc.attendreRetour({ etat: "bon-etat" });
  const rejet = assert.rejects(retour.code, /state/);
  const r = await fetch(`http://127.0.0.1:${retour.port}/?code=abc&state=mauvais`);
  assert.strictEqual(r.status, 400);
  await rejet;
});

test("bouclage : accepte le code quand le state correspond", async () => {
  const retour = await sc.attendreRetour({ etat: "bon-etat" });
  const r = await fetch(`http://127.0.0.1:${retour.port}/?code=le-code&state=bon-etat`);
  assert.strictEqual(r.status, 200);
  assert.match(await r.text(), /Connexion réussie/);
  assert.strictEqual(await retour.code, "le-code");
});

test("client OAuth : « Application de bureau » accepté ; Web et compte de service refusés avec l'explication", () => {
  const d = dossierTemp();
  const ecrire = (nom, objet) => (fs.writeFileSync(path.join(d, nom), JSON.stringify(objet)), path.join(d, nom));
  assert.strictEqual(sc.lireClient(ecrire("bureau.json", { installed: { client_id: "id", client_secret: "s" } })).client_id, "id");
  assert.throws(() => sc.lireClient(ecrire("web.json", { web: { client_id: "id" } })), /Application de bureau/);
  assert.throws(() => sc.lireClient(ecrire("sa.json", { type: "service_account", client_email: "x" })), /compte de service/);
  assert.throws(() => sc.lireClient(path.join(d, "absent.json")), /introuvable/);
});

test("connecter : parcours complet par le bouclage, identifiants rangés hors du projet, rien de secret affiché", async () => {
  const g = await fauxGoogle();
  const config = dossierTemp();
  const client = path.join(dossierTemp(), "client_secret_test.json");
  fs.writeFileSync(client, JSON.stringify({ installed: { client_id: "123-test.apps.googleusercontent.com", client_secret: FAUX.secret } }));
  let visite = false;
  const r = await lancer(["connecter", "--client", client, "--sans-navigateur"], {
    env: { ...g.env, PULSE_CONFIG_DIR: config, PULSE_GSC_AUTORISATION: "https://accounts.example.test/auth" },
    surSortie: (sortie) => {
      const m = sortie.match(/(https:\/\/accounts\.example\.test\/auth\?\S+)/);
      if (!m || visite) return;
      visite = true;
      const u = new URL(m[1]);
      g.etat.challenge = u.searchParams.get("code_challenge");
      fetch(`${u.searchParams.get("redirect_uri")}/?code=code-test&state=${u.searchParams.get("state")}`).catch(() => {});
    },
  });
  g.serveur.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.stdout, /✅ Connecté en lecture seule/);
  assert.strictEqual(g.etat.code, "code-test");
  assert.strictEqual(crypto.createHash("sha256").update(g.etat.verifier).digest("base64url"), g.etat.challenge, "le verifier PKCE correspond au challenge");
  const fichier = path.join(config, "search-console.json");
  const enregistre = JSON.parse(fs.readFileSync(fichier, "utf8"));
  assert.strictEqual(enregistre.refresh_token, FAUX.rafraichissement);
  assert.strictEqual(enregistre.portee, sc.PORTEE);
  if (process.platform !== "win32") assert.strictEqual(fs.statSync(fichier).mode & 0o777, 0o600);
  sansSecret(r.sortie);
});

test("deconnecter : révoque chez Google et supprime le fichier", async () => {
  const g = await fauxGoogle();
  const config = connexionFactice();
  const r = await lancer(["deconnecter"], { env: { ...g.env, PULSE_CONFIG_DIR: config } });
  g.serveur.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(!fs.existsSync(path.join(config, "search-console.json")));
  assert.ok(g.etat.appels.some((a) => a.url === "/revoke"));
  sansSecret(r.sortie);
});

// ---------------------------------------------------------------- API simulée

test("lire : rapport complet par l'API (pagination, sitemap, échantillon d'inspection), fichiers datés, sans secret", async () => {
  const g = await fauxGoogle();
  const projet = dossierTemp();
  const r = await lancer(["lire", "--site", g.site, "--inspecter", "3", "--ecrire"], { cwd: projet, env: { ...g.env, PULSE_CONFIG_DIR: connexionFactice(), PULSE_GSC_TAILLE_PAGE: "2" } });
  g.serveur.close();
  assert.strictEqual(r.code, 0, r.sortie);
  // Pagination : 5 requêtes par pages de 2 (startRow 0, 2, 4).
  assert.deepStrictEqual(g.etat.startRows.filter((s) => s.startsWith("query")).sort(), ["query:0", "query:2", "query:4"]);
  assert.match(r.stdout, /requete 4/);
  assert.match(r.stdout, /## Pages du sitemap sans impression[\s\S]*\/oubliee/);
  assert.match(r.stdout, /Échantillon de 3 pages[\s\S]*Détectée, actuellement non indexée/);
  assert.match(r.stdout, /Période : 2026-09-07 → 2026-10-04 \(28 jours/);
  const md = path.join(projet, "docs", "referencement", "search-console-2026-10-07.md");
  const json = path.join(projet, "docs", "referencement", "donnees", "2026-10-07.json");
  assert.ok(fs.existsSync(md) && fs.existsSync(json));
  assert.strictEqual(JSON.parse(fs.readFileSync(json, "utf8")).totaux.impressions, 1500);
  // Le jeton part seulement dans l'en-tête Authorization, jamais dans l'adresse.
  assert.ok(g.etat.appels.every((a) => !a.url.includes(FAUX.acces)));
  sansSecret(r.sortie);
  sansSecret(fs.readFileSync(md, "utf8") + fs.readFileSync(json, "utf8"));
});

test("suivre : compare 28 jours aux 28 jours précédents (section Évolution)", async () => {
  const g = await fauxGoogle();
  const r = await lancer(["suivre", "--site", g.site, "--inspecter", "0"], { cwd: dossierTemp(), env: { ...g.env, PULSE_CONFIG_DIR: connexionFactice() } });
  g.serveur.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.stdout, /## Évolution/);
  assert.match(r.stdout, /Période précédente : 2026-08-10 → 2026-09-06/);
  assert.match(r.stdout, /Pages en hausse/);
});

test("suivre avec un export : compare au dernier instantané enregistré", async () => {
  const projet = dossierTemp();
  const export_ = path.join(FIXTURES, "export-fr");
  const premier = await lancer(["lire", "--fichier", export_, "--ecrire"], { cwd: projet, env: { PULSE_GSC_AUJOURDHUI: "2026-09-09" } });
  assert.strictEqual(premier.code, 0, premier.sortie);
  const r = await lancer(["suivre", "--fichier", export_], { cwd: projet });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.stdout, /## Évolution/);
  const seul = await lancer(["suivre", "--fichier", export_], { cwd: dossierTemp() });
  assert.strictEqual(seul.code, 1);
  assert.match(seul.stderr, /Aucune période précédente/);
});

test("site neuf : « pas encore de données, c'est normal », code 6, sans erreur", async () => {
  const g = await fauxGoogle({ scenario: "neuf" });
  const r = await lancer(["lire", "--site", g.site, "--inspecter", "0"], { cwd: dossierTemp(), env: { ...g.env, PULSE_CONFIG_DIR: connexionFactice() } });
  g.serveur.close();
  assert.strictEqual(r.code, 6, r.sortie);
  assert.match(r.stdout, /Pas encore de données : c'est normal/);
  assert.strictEqual(r.stderr, "");
});

test("403 : propriété inaccessible, code 4, message clair", async () => {
  const g = await fauxGoogle({ scenario: "403" });
  const r = await lancer(["lire", "--site", g.site], { cwd: dossierTemp(), env: { ...g.env, PULSE_CONFIG_DIR: connexionFactice() } });
  g.serveur.close();
  assert.strictEqual(r.code, 4, r.sortie);
  assert.match(r.stderr, /n'a pas accès à cette propriété/);
  sansSecret(r.sortie);
});

test("429 : quota, nouveaux essais puis code 5", async () => {
  const g = await fauxGoogle({ scenario: "429" });
  const r = await lancer(["lire", "--site", g.site], { cwd: dossierTemp(), env: { ...g.env, PULSE_CONFIG_DIR: connexionFactice() } });
  g.serveur.close();
  assert.strictEqual(r.code, 5, r.sortie);
  assert.match(r.stderr, /Quota/);
  assert.ok(g.etat.appels.filter((a) => a.url.includes("searchAnalytics")).length >= 3, "trois essais au moins");
});

test("connexion expirée (invalid_grant) : code 3 et reconnexion proposée", async () => {
  const g = await fauxGoogle({ scenario: "expire" });
  const r = await lancer(["proprietes"], { env: { ...g.env, PULSE_CONFIG_DIR: connexionFactice() } });
  g.serveur.close();
  assert.strictEqual(r.code, 3, r.sortie);
  assert.match(r.stderr, /pulse-aidd search-console connecter/);
  sansSecret(r.sortie);
});

test("pas connecté : code 2, propose l'export CSV ou la connexion", async () => {
  const r = await lancer(["proprietes"], { env: { PULSE_CONFIG_DIR: dossierTemp() } });
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /export CSV/);
});

test("inspecter : une page expliquée en français", async () => {
  const g = await fauxGoogle();
  const r = await lancer(["inspecter", `${g.site}oubliee`], { env: { ...g.env, PULSE_CONFIG_DIR: connexionFactice() } });
  g.serveur.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.stdout, /Détectée, actuellement non indexée/);
  assert.match(r.stdout, /Demander l'indexation/);
  sansSecret(r.sortie);
});

test("compte de service (CI) : jeton obtenu par JWT, fichier désigné par PULSE_GSC_COMPTE_SERVICE", async () => {
  const g = await fauxGoogle();
  const { privateKey } = paireRsa();
  const cle = path.join(dossierTemp(), "compte.json");
  fs.writeFileSync(cle, JSON.stringify({ type: "service_account", client_email: "lecteur@p.iam.gserviceaccount.com", private_key: privateKey }));
  const r = await lancer(["proprietes"], { env: { ...g.env, PULSE_CONFIG_DIR: dossierTemp(), PULSE_GSC_COMPTE_SERVICE: cle } });
  g.serveur.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.stdout, /utilisateur restreint/);
  const appel = g.etat.appels.find((a) => a.url === "/token");
  assert.match(new URLSearchParams(appel.corps).get("grant_type"), /jwt-bearer/);
  assert.ok(!r.sortie.includes("PRIVATE KEY"));
});

// ---------------------------------------------------------------- Fonctions pures

test("fenêtre de dates : heure du Pacifique, changements d'heure compris", () => {
  // 1er novembre 2026 : fin de l'heure d'été du Pacifique à 09:00 UTC.
  assert.strictEqual(sc.datePacifique(new Date("2026-11-01T06:30:00Z")), "2026-10-31");
  assert.strictEqual(sc.datePacifique(new Date("2026-11-01T08:30:00Z")), "2026-11-01");
  assert.strictEqual(sc.datePacifique(new Date("2026-11-02T07:30:00Z")), "2026-11-01");
  // 8 mars 2026 : début de l'heure d'été.
  assert.strictEqual(sc.datePacifique(new Date("2026-03-08T07:30:00Z")), "2026-03-07");
  const f = sc.fenetre(new Date("2026-10-07T20:00:00Z"));
  assert.deepStrictEqual(f, { debut: "2026-09-07", fin: "2026-10-04", jours: 28 });
  const p = sc.fenetrePrecedente(f);
  assert.deepStrictEqual(p, { debut: "2026-08-10", fin: "2026-09-06", jours: 28 });
  assert.strictEqual(new Date(p.debut).getUTCDay(), new Date(f.debut).getUTCDay(), "mêmes jours de la semaine");
  assert.strictEqual(sc.fenetre(new Date("2026-10-07T20:00:00Z"), "3m").jours, 91);
  assert.throws(() => sc.fenetre(new Date(), "1an"), /Période inconnue/);
});

test("requêtes à potentiel : positions 8-20, et CTR bas pour le rang", () => {
  const l = (cle, impressions, ctr, position) => ({ cle, clics: Math.round(impressions * ctr), impressions, ctr, position });
  const r = sc.opportunites([
    l("proche", 300, 0.01, 11),
    l("rare", 5, 0, 12),
    l("loin", 300, 0.01, 35),
    l("a", 100, 0.1, 2),
    l("b", 100, 0.12, 1.5),
    l("c", 100, 0.09, 2.2),
    l("peu cliquee", 200, 0.01, 1.8),
  ]);
  assert.deepStrictEqual(r.map((o) => `${o.cle}:${o.type}`), ["proche:proche", "peu cliquee:titre"]);
  assert.ok(r[1].ctrReference > 0.05);
});

test("pages du sitemap sans impression : comparaison normalisée", () => {
  const r = sc.pagesSansImpression(["https://Site.fr/", "https://site.fr/a/", "https://site.fr/b", "https://site.fr/b"], [{ cle: "https://site.fr/", impressions: 3 }, { cle: "https://site.fr/a", impressions: 1 }, { cle: "https://site.fr/c", impressions: 0 }]);
  assert.deepStrictEqual(r, ["https://site.fr/b"]);
});

test("lecture de sitemap : urlset, index, entités, CDATA", () => {
  assert.deepStrictEqual(sc.lireSitemap("<urlset><url><loc> https://s.fr/?a=1&amp;b=2 </loc></url><url><loc><![CDATA[https://s.fr/x]]></loc></url></urlset>"), { type: "urlset", urls: ["https://s.fr/?a=1&b=2", "https://s.fr/x"] });
  assert.deepStrictEqual(sc.lireSitemap('<?xml version="1.0"?><sitemapindex><sitemap><loc>https://s.fr/s1.xml</loc></sitemap></sitemapindex>'), { type: "index", urls: ["https://s.fr/s1.xml"] });
  assert.deepStrictEqual(sc.lireSitemap(""), { type: "urlset", urls: [] });
});

test("comparaison de deux périodes : totaux, hausses, baisses, nouvelles", () => {
  const avant = { periode: { debut: "a", fin: "b" }, totaux: { clics: 10, impressions: 100, ctr: 0.1, position: 8 }, pages: [{ cle: "/x", clics: 5, impressions: 50 }, { cle: "/y", clics: 5, impressions: 50 }], requetes: [{ cle: "q1", clics: 1, impressions: 10 }] };
  const apres = { periode: { debut: "c", fin: "d" }, totaux: { clics: 15, impressions: 90, ctr: 0.166, position: 6 }, pages: [{ cle: "/x", clics: 9, impressions: 80 }, { cle: "/y", clics: 1, impressions: 10 }], requetes: [{ cle: "q2", clics: 1, impressions: 10 }] };
  const c = sc.comparer(avant, apres);
  assert.strictEqual(c.totaux.clics.ecart, 5);
  assert.strictEqual(c.totaux.clics.variation, 0.5);
  assert.strictEqual(c.totaux.position.ecart, -2);
  assert.strictEqual(c.pages.hausses[0].cle, "/x");
  assert.strictEqual(c.pages.baisses[0].cle, "/y");
  assert.strictEqual(c.requetes.nouvelles, 1);
  assert.strictEqual(c.requetes.disparues, 1);
});

test("traduction des états d'inspection : français, avec ce qu'il faut faire", () => {
  const t = sc.traduireEtat({ verdict: "NEUTRAL", coverageState: "Crawled - currently not indexed", indexingState: "INDEXING_ALLOWED", pageFetchState: "SUCCESSFUL" });
  assert.strictEqual(t.etat, "Explorée, actuellement non indexée");
  assert.match(t.action, /inutile de la renvoyer/);
  assert.strictEqual(t.indexation, "autorisée");
  assert.strictEqual(sc.traduireEtat({ verdict: "FAIL", coverageState: "Excluded by ‘noindex’ tag", indexingState: "BLOCKED_BY_META_TAG" }).etat, "Exclue par la balise « noindex »");
  assert.strictEqual(sc.traduireEtat({ coverageState: "Duplicate, Google chose different canonical than user" }).etat, "Doublon : Google a choisi une autre page canonique");
  const c = sc.traduireEtat({ verdict: "PASS", coverageState: "Submitted and indexed", googleCanonical: "https://s.fr/a", userCanonical: "https://s.fr/b" });
  assert.ok(c.canoniqueDifferente);
  assert.match(sc.traduireEtat({ coverageState: "Something new" }).action, /non répertorié/);
  assert.strictEqual(sc.traduireEtat({}).derniereVisite, "jamais");
});

test("choix de la propriété : préfixe exact, domaine, variante www, non vérifiée écartée", () => {
  const liste = [
    { siteUrl: "https://autre.fr/", droits: "siteOwner" },
    { siteUrl: "sc-domain:exemple.fr", droits: "siteFullUser" },
    { siteUrl: "https://www.vitrine.fr/", droits: "siteRestrictedUser" },
    { siteUrl: "https://perdu.fr/", droits: "siteUnverifiedUser" },
  ];
  assert.deepStrictEqual(sc.choisirPropriete(liste, "https://autre.fr"), { siteUrl: "https://autre.fr/", note: null });
  assert.strictEqual(sc.choisirPropriete(liste, "https://blog.exemple.fr/x").siteUrl, "sc-domain:exemple.fr");
  const v = sc.choisirPropriete(liste, "https://vitrine.fr/");
  assert.strictEqual(v.siteUrl, "https://www.vitrine.fr/");
  assert.match(v.note, /ne correspond pas exactement/);
  assert.strictEqual(sc.choisirPropriete(liste, "https://perdu.fr/"), null);
  assert.strictEqual(sc.choisirPropriete(liste, "pas une adresse"), null);
});

test("CSV : BOM, guillemets, séparateurs ; nombres français et anglais", () => {
  assert.deepStrictEqual(sc.lireCsv('\uFEFFa,b\n"x, y","1 234"\r\n'), [["a", "b"], ["x, y", "1 234"]]);
  assert.deepStrictEqual(sc.lireCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
  assert.strictEqual(sc.nombre("1\u202f234", true), 1234);
  assert.strictEqual(sc.nombre("12,5 %", true), 12.5);
  assert.strictEqual(sc.nombre("1,234", false), 1234);
  assert.strictEqual(sc.nombre("12.5%", false), 12.5);
  assert.strictEqual(sc.nombre("", true), 0);
});

const lireFixture = (nom) => fs.readdirSync(path.join(FIXTURES, nom)).map((f) => ({ nom: f, contenu: fs.readFileSync(path.join(FIXTURES, nom, f), "utf8") }));

test("export CSV en français : requêtes, pages, dates, filtres ; pays ignoré", () => {
  const d = sc.lireExport(lireFixture("export-fr"));
  assert.strictEqual(d.requetes.length, 10);
  assert.deepStrictEqual(d.requetes.find((r) => r.cle === "cours de poterie lyon"), { cle: "cours de poterie lyon", clics: 18, impressions: 1240, ctr: 0.0145, position: 9.4 });
  assert.strictEqual(d.pages.length, 5);
  assert.deepStrictEqual(d.periode, { debut: "2026-09-01", fin: "2026-09-28", jours: 28 });
  assert.ok(d.totaux.impressions > d.requetes.reduce((s, r) => s + r.impressions, 0), "totaux tirés des dates (requêtes rares comprises)");
  assert.deepStrictEqual(d.fichiersIgnores, ["Pays.csv"]);
  assert.ok(d.filtres.some((f) => f.filtre === "Type de recherche" && f.valeur === "Web"));
});

test("export CSV en anglais : en-têtes et nombres anglais", () => {
  const d = sc.lireExport(lireFixture("export-en"));
  assert.deepStrictEqual(d.requetes[0], { cle: "pottery class", clics: 25, impressions: 1320, ctr: 0.0189, position: 9.1 });
  assert.strictEqual(d.pages[0].impressions, 1100);
  assert.strictEqual(d.totaux.impressions, 1560);
  assert.deepStrictEqual(d.fichiersIgnores, ["Devices.csv"]);
});

test("export sans tableau de performances : message qui dit quoi exporter", () => {
  assert.throws(() => sc.lireExport([{ nom: "x.csv", contenu: "Pays,Clics\nFrance,1" }]), /Performances/);
});

// Archive ZIP minimale (entrées « deflate » et « stockées »), pour lire un export tel que téléchargé.
function zip(entrees) {
  const locaux = [];
  const centraux = [];
  let decalage = 0;
  for (const { nom, contenu, stocke } of entrees) {
    const brut = Buffer.from(contenu, "utf8");
    const donnees = stocke ? brut : zlib.deflateRawSync(brut);
    const n = Buffer.from(nom, "utf8");
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(20, 4);
    l.writeUInt16LE(0x0800, 6);
    l.writeUInt16LE(stocke ? 0 : 8, 8);
    l.writeUInt32LE(zlib.crc32(brut), 14);
    l.writeUInt32LE(donnees.length, 18);
    l.writeUInt32LE(brut.length, 22);
    l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(stocke ? 0 : 8, 10);
    c.writeUInt32LE(zlib.crc32(brut), 16);
    c.writeUInt32LE(donnees.length, 20);
    c.writeUInt32LE(brut.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(decalage, 42);
    locaux.push(l, n, donnees);
    centraux.push(c, n);
    decalage += 30 + n.length + donnees.length;
  }
  const centre = Buffer.concat(centraux);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(centre.length, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, centre, fin]);
}

test("export .zip : lu sans dépendance, puis rapport Markdown par la ligne de commande", async () => {
  const entrees = lireFixture("export-fr").map((f, i) => ({ ...f, stocke: i % 2 === 0 }));
  const archive = path.join(dossierTemp(), "mon-site.exemple.fr-Performance-on-Search-2026-10-07.zip");
  fs.writeFileSync(archive, zip(entrees));
  assert.deepStrictEqual(sc.lireZip(fs.readFileSync(archive)).map((f) => f.nom).sort(), entrees.map((e) => e.nom).sort());
  const r = await lancer(["lire", "--fichier", archive, "--site", "https://mon-site.exemple.fr/"], { cwd: dossierTemp() });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.stdout, /^# Search Console – https:\/\/mon-site\.exemple\.fr\/ – 2026-10-07$/m);
  assert.match(r.stdout, /Source : export CSV/);
  assert.match(r.stdout, /cours de poterie lyon/);
  assert.match(r.stdout, /Google masque les requêtes rares/);
  assert.match(r.stdout, /Filtres de l'export : Type de recherche = Web/);
});

test("le rapport suit les sections du modèle templates/rapport-search-console.md", () => {
  const titres = (t) => [...t.matchAll(/^##? .*$/gm)].map((m) => m[0].replace(/ – .*$/, ""));
  const d = { ...sc.lireExport(lireFixture("export-fr")), date: "2026-10-07", site: "https://mon-site.exemple.fr/", sitemap: null, sansImpression: [], inspection: null };
  d.opportunites = sc.opportunites(d.requetes);
  d.actions = sc.actions(d);
  d.evolution = sc.comparer(d, d);
  d.prochainRapport = "2026-11-04";
  assert.deepStrictEqual(titres(sc.rapport(d)), titres(fs.readFileSync(MODELE, "utf8")));
  assert.ok(d.actions.length > 0 && d.actions.length <= 3);
});

test("masquage : aucun jeton ni secret Google ne sort, même dans un message d'erreur", () => {
  const t = sc.masquer(`a ${FAUX.acces} b ${FAUX.rafraichissement} c ${FAUX.secret} d ${CLE_PRIVEE("abc")} e`);
  sansSecret(t);
  assert.ok(!t.includes("PRIVATE KEY"));
  assert.match(t, /^a \[jeton masqué\] b \[jeton masqué\] c \[secret masqué\] d \[clé masquée\] e$/);
});

test("dossier des identifiants : hors du projet, selon le système", () => {
  assert.strictEqual(sc.dossierConfig({ APPDATA: "C:\\Users\\x\\AppData\\Roaming" }, "win32"), path.join("C:\\Users\\x\\AppData\\Roaming", "pulse"));
  assert.strictEqual(sc.dossierConfig({ XDG_CONFIG_HOME: "/home/x/.config" }, "linux"), path.join("/home/x/.config", "pulse"));
  assert.strictEqual(sc.dossierConfig({}, "darwin"), path.join(os.homedir(), ".config", "pulse"));
  assert.strictEqual(sc.dossierConfig({ PULSE_CONFIG_DIR: "/tmp/p" }, "linux"), "/tmp/p");
});

test("adresse du site : « Site en ligne » de docs/technical.md, sinon CLAUDE.md", () => {
  const d = dossierTemp();
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "## Adresses\n- Site : https://depuis-claude.fr\n");
  assert.strictEqual(sc.siteDuProjet(d), "https://depuis-claude.fr");
  fs.mkdirSync(path.join(d, "docs"));
  fs.writeFileSync(path.join(d, "docs", "technical.md"), "- Site en ligne : https://mon-site.vercel.app (vérifiée)\n");
  assert.strictEqual(sc.siteDuProjet(d), "https://mon-site.vercel.app");
  assert.strictEqual(sc.siteDuProjet(dossierTemp()), null);
});

test("ligne de commande : action inconnue → usage et code 1", async () => {
  const r = await lancer(["inconnue"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /Usage :/);
});

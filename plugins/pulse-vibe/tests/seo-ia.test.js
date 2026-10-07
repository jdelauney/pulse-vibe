// Tests des contrôles « assistants IA » de l'audit (pulse-aidd seo --ia), sur un serveur local de fixtures.
// Lancer : node --test plugins/pulse-vibe/tests/seo-ia.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const SEO = path.join(__dirname, "..", "scripts", "seo.js");
const { genererRobots } = require(path.join(__dirname, "..", "scripts", "robots.js"));
const LISTE = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "references", "seo", "robots-ia.json"), "utf8")).robots;

function lancer(args, cwd) {
  return new Promise((resoudre) => {
    const p = spawn("node", [SEO, ...args, "--ia", "--json", "--delai", "0"], { cwd });
    let sortie = "";
    p.stdout.on("data", (d) => (sortie += d));
    p.stderr.on("data", (d) => (sortie += d));
    p.on("close", (code) => {
      let json = null;
      try {
        json = JSON.parse(sortie);
      } catch {}
      resoudre({ code, sortie, json });
    });
  });
}

const accueil = (o, { tete = "", corps = "" } = {}) => `<!DOCTYPE html><html lang="fr"><head><title>Menuiserie Dupont – meubles sur mesure</title>
<meta name="description" content="Meubles sur mesure."><link rel="canonical" href="${o}/">${tete}</head>
<body><h1>Menuiserie Dupont</h1><p>Meubles sur mesure à Lausanne, sur devis.</p>${corps}</body></html>`;

/** routes(req, o, chemin, agent) rend { statut, entetes, corps } ou null (accueil simple, robots.txt ouvert, le reste en 404). */
function serveur(routes = () => null) {
  const s = http.createServer((req, res) => {
    const o = `http://${req.headers.host}`;
    const chemin = new URL(req.url, o).pathname;
    const agent = req.headers["user-agent"] || "";
    const r = routes(req, o, chemin, agent) ||
      (chemin === "/" ? { statut: 200, corps: accueil(o) } : chemin === "/robots.txt" ? { statut: 200, entetes: { "content-type": "text/plain" }, corps: "User-agent: *\nAllow: /\n" } : { statut: 404, corps: "introuvable" });
    res.writeHead(r.statut, { "content-type": "text/html; charset=utf-8", ...(r.entetes || {}) });
    res.end(r.corps || "");
  });
  return new Promise((resoudre) => s.listen(0, "127.0.0.1", () => resoudre({ s, url: `http://127.0.0.1:${s.address().port}/` })));
}

const codes = (json, prefixe = "IA") => json.constats.filter((c) => c.code.startsWith(prefixe)).map((c) => `${c.code}:${c.gravite}`);

function fiche(contenu) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-seo-ia-"));
  fs.mkdirSync(path.join(d, "docs"));
  fs.writeFileSync(path.join(d, "docs", "seo.md"), contenu);
  return d;
}

test("site ouvert, politique A : aucun constat IA ; politique lue dans docs/seo.md", async () => {
  const { s, url } = await serveur();
  const d = fiche("# Référencement\n<!-- pulse-seo\npolitique-ia: A\nfait: Menuiserie Dupont\nfait: Lausanne\n-->\n");
  const r = await lancer([url], d);
  s.close();
  assert.strictEqual(r.json.politique, "A");
  assert.deepStrictEqual(codes(r.json), [], r.sortie);
  assert.ok(r.json.controles.includes("IA11"));
});

test("politique B, robots.txt ouvert : refus d'entraînement manquant (IA8) pour chaque robot d'entraînement", async () => {
  const { s, url } = await serveur();
  const r = await lancer([url, "--politique", "B"]);
  s.close();
  const ia8 = r.json.constats.filter((c) => c.code === "IA8");
  assert.strictEqual(ia8.length, 6, r.sortie);
  assert.ok(ia8.some((c) => /GPTBot/.test(c.message)));
});

test("politique B appliquée par genererRobots : aucun écart", async () => {
  const { s, url } = await serveur((req, o, ch) => (ch === "/robots.txt" ? { statut: 200, entetes: { "content-type": "text/plain" }, corps: genererRobots("B", LISTE, { sitemap: `${o}/sitemap.xml` }) } : null));
  const r = await lancer([url, "--politique", "B"]);
  s.close();
  assert.deepStrictEqual(codes(r.json), [], r.sortie);
});

test("pare-feu qui refuse OAI-SearchBot (IA4) ; page vide pour Claude-SearchBot (IA5) ; titre en fin de page pour PerplexityBot (IA6)", async () => {
  const { s, url } = await serveur((req, o, ch, agent) => {
    if (ch !== "/") return null;
    if (/OAI-SearchBot/.test(agent)) return { statut: 403, corps: "Accès refusé" };
    if (/Claude-SearchBot/.test(agent)) return { statut: 200, corps: '<html><head></head><body><div id="racine"></div><script src="/app.js"></script></body></html>' };
    if (/PerplexityBot/.test(agent)) return { statut: 200, corps: `<html><head></head><body><h1>Menuiserie Dupont</h1><p>Meubles sur mesure.</p><title>T</title><link rel="canonical" href="${o}/"></body></html>` };
    return null;
  });
  const r = await lancer([url, "--politique", "A"]);
  s.close();
  assert.deepStrictEqual(codes(r.json).sort(), ["IA4:haute", "IA5:haute", "IA6:moyenne"], r.sortie);
  assert.match(r.json.constats.find((c) => c.code === "IA4").message, /OAI-SearchBot/);
});

test("politique C : le refus d'un robot de recherche IA est voulu (pas d'IA4)", async () => {
  const { s, url } = await serveur((req, o, ch, agent) => {
    if (ch === "/robots.txt") return { statut: 200, entetes: { "content-type": "text/plain" }, corps: genererRobots("C", LISTE) };
    if (ch === "/" && /SearchBot|PerplexityBot/.test(agent)) return { statut: 403, corps: "non" };
    return null;
  });
  const r = await lancer([url, "--politique", "C"]);
  s.close();
  assert.deepStrictEqual(codes(r.json), [], r.sortie);
});

test("nosnippet par en-tête et data-nosnippet sans décision (IA7) ; décision notée dans docs/seo.md : rien", async () => {
  const routes = (req, o, ch) => (ch === "/" ? { statut: 200, entetes: { "x-robots-tag": "nosnippet" }, corps: accueil(o, { corps: "<p data-nosnippet>Tarifs</p>" }) } : null);
  const a = await serveur(routes);
  const r1 = await lancer([a.url, "--politique", "A"]);
  a.s.close();
  assert.deepStrictEqual(codes(r1.json), ["IA7:haute", "IA7:moyenne"], r1.sortie);
  const b = await serveur(routes);
  const r2 = await lancer([b.url], fiche("<!-- pulse-seo\npolitique-ia: A\nnosnippet: oui\n-->"));
  b.s.close();
  assert.deepStrictEqual(codes(r2.json), [], r2.sortie);
});

test("llms.txt sans titre (IA10) ; absent : aucun constat", async () => {
  const { s, url } = await serveur((req, o, ch) => (ch === "/llms.txt" ? { statut: 200, entetes: { "content-type": "text/plain" }, corps: "Bienvenue" } : null));
  const r = await lancer([url, "--politique", "A"]);
  s.close();
  assert.deepStrictEqual(codes(r.json), ["IA10:basse"], r.sortie);
});

test("JSON-LD dont le téléphone n'est pas affiché (IA12) ; faits clés absents (IA11)", async () => {
  const jsonLd = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Menuiserie Dupont","address":"Lausanne","telephone":"+41 21 000 00 00"}</script>';
  const { s, url } = await serveur((req, o, ch) => (ch === "/" ? { statut: 200, corps: accueil(o, { tete: jsonLd }) } : null));
  const r = await lancer([url], fiche("<!-- pulse-seo\npolitique-ia: A\nfait: Menuiserie Dupont\nfait: ouvert le samedi\n-->"));
  s.close();
  assert.deepStrictEqual(codes(r.json), ["IA12:moyenne", "IA11:basse"], r.sortie);
  assert.match(r.json.constats.find((c) => c.code === "IA11").message, /ouvert le samedi/);
});

test("groupe nommé qui rouvre un chemin fermé (IA2) et jeton périmé (IA3)", async () => {
  const { s, url } = await serveur((req, o, ch) => (ch === "/robots.txt" ? { statut: 200, entetes: { "content-type": "text/plain" }, corps: "User-agent: *\nDisallow: /admin/\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: anthropic-ai\nDisallow: /\n" } : null));
  const r = await lancer([url, "--politique", "A"]);
  s.close();
  assert.deepStrictEqual(codes(r.json).sort(), ["IA2:moyenne", "IA3:basse"], "anthropic-ai a Disallow: / : il ne rouvre rien", r.sortie);
});

test("--essentiel ignore --ia (garde-fou rapide)", async () => {
  const { s, url } = await serveur();
  const r = await lancer([url, "--essentiel"]);
  s.close();
  assert.ok(!r.json.controles.some((c) => c.startsWith("IA")));
});

// Tests de l'audit de référencement (skills/seo/scripts/seo.js) sur un serveur local de fixtures.
// Lancer : node --test plugins/pulse-vibe/tests/seo.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { ecouter } = require("../scripts/port-libre");

const SEO = path.join(__dirname, "..", "skills", "seo", "scripts", "seo.js");

// Lance l'audit sans bloquer la boucle d'événements (le serveur de test doit pouvoir répondre).
function lancer(args) {
  return new Promise((resoudre) => {
    const p = spawn("node", [SEO, ...args, "--delai", "0"]);
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

function png(cote) {
  const b = Buffer.alloc(33);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(cote, 16);
  b.writeUInt32BE(cote, 20);
  return b;
}

/** Une page HTML correcte, dont les adresses absolues visent l'hôte de la requête. */
function pageHtml(origine, chemin, { titre, description, tete = "", corps = "", liens = [] } = {}) {
  const url = `${origine}${chemin === "/" ? "/" : chemin}`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${titre || `Menuiserie Dupont – page ${chemin}`}</title>
<meta name="description" content="${description || `Description de la page ${chemin}.`}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="Menuiserie Dupont"><meta property="og:description" content="Meubles."><meta property="og:url" content="${url}"><meta property="og:type" content="website">
<meta property="og:image" content="${origine}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/icon.png" type="image/png" sizes="192x192">
${chemin === "/" ? `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Menuiserie Dupont","url":"${origine}"}</script>` : ""}
${tete}</head><body><h1>Menuiserie Dupont</h1><p>Des meubles faits pour durer, dessinés avec vous.</p>${liens.map((l) => `<a href="${l}">Voir la page ${l}</a>`).join("")}${corps}</body></html>`;
}

/**
 * Serveur de fixtures. routes(req, origine) rend { statut, entetes, corps } ou null (→ comportement du « bon site »).
 * Le bon site : accueil, /a-propos, /contact ; robots.txt et sitemap corrects ; 404 réel ; icône et image de partage.
 */
function serveur(routes = () => null) {
  const s = http.createServer((req, res) => {
    const origine = `http://${req.headers.host}`;
    const chemin = new URL(req.url, origine).pathname;
    const r = routes(req, origine, chemin) || defaut(origine, chemin);
    res.writeHead(r.statut, { "content-type": "text/html; charset=utf-8", ...(r.entetes || {}) });
    res.end(req.method === "HEAD" ? undefined : r.corps || "");
  });
  return ecouter(s).then((port) => ({ s, url: `http://127.0.0.1:${port}/` }));
}

function defaut(origine, chemin) {
  const pages = { "/": ["/a-propos", "/contact"], "/a-propos": ["/"], "/contact": ["/"] };
  if (pages[chemin]) return { statut: 200, corps: pageHtml(origine, chemin, { liens: pages[chemin] }) };
  if (chemin === "/robots.txt") return { statut: 200, entetes: { "content-type": "text/plain" }, corps: `User-agent: *\nAllow: /\n\nSitemap: ${origine}/sitemap.xml\n` };
  if (chemin === "/sitemap.xml")
    return { statut: 200, entetes: { "content-type": "application/xml" }, corps: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(pages).map((p) => `<url><loc>${origine}${p}</loc></url>`).join("")}</urlset>` };
  if (chemin === "/og.png") return { statut: 200, entetes: { "content-type": "image/png" }, corps: png(1200) };
  if (chemin === "/icon.png") return { statut: 200, entetes: { "content-type": "image/png" }, corps: png(192) };
  return { statut: 404, corps: "<html><head><title>Introuvable</title></head><body><h1>Page introuvable</h1></body></html>" };
}

const codes = (json) => json.constats.map((c) => `${c.code}:${c.gravite}`);

test("un site correct : aucun constat Critique ni Haute, code 0, rapport par questions", async () => {
  const { s, url } = await serveur();
  const r = await lancer([url, "--json"]);
  const t = await lancer([url]);
  s.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.json.bilan.critique, 0, r.sortie);
  assert.strictEqual(r.json.bilan.haute, 0, r.sortie);
  assert.strictEqual(r.json.pages.length, 3);
  assert.ok(r.json.controles.includes("L16") && r.json.controles.includes("L22"));
  assert.match(t.sortie, /1\. Google peut-il venir \?/);
  assert.match(t.sortie, /✅ L1 /);
  assert.match(t.sortie, /4\. Mérite-t-elle d'être choisie \?/);
});

test("robots.txt Disallow: / : constat Critique et code 1", async () => {
  const { s, url } = await serveur((req, o, ch) => (ch === "/robots.txt" ? { statut: 200, entetes: { "content-type": "text/plain" }, corps: "User-agent: *\nDisallow: /\n" } : null));
  const r = await lancer([url, "--json"]);
  s.close();
  assert.strictEqual(r.code, 1);
  assert.ok(codes(r.json).includes("L5:critique"));
});

test("noindex par en-tête sur l'accueil : Critique, y compris en mode --essentiel", async () => {
  const { s, url } = await serveur((req, o, ch) => (ch === "/" ? { statut: 200, entetes: { "x-robots-tag": "noindex" }, corps: pageHtml(o, "/") } : null));
  const r = await lancer([url, "--essentiel", "--json"]);
  const texte = await lancer([url, "--essentiel"]);
  s.close();
  assert.strictEqual(r.code, 1);
  assert.deepStrictEqual(codes(r.json), ["L4:critique"]);
  assert.strictEqual(r.json.mode, "essentiel");
  assert.match(texte.sortie, /❌ Mise en ligne à corriger/);
});

test("--essentiel : contrôles réduits, garde seulement les constats de mise en ligne", async () => {
  const { s, url } = await serveur((req, o, ch) => (ch === "/contact" ? { statut: 200, corps: pageHtml(o, "/contact").replace(/<meta name="description"[^>]*>/, "") } : null));
  const r = await lancer([url, "--essentiel", "--json"]);
  s.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.deepStrictEqual(r.json.constats, [], "la description manquante n'est pas un constat de mise en ligne");
  assert.ok(!r.json.controles.includes("L10"));
  assert.ok(r.json.controles.includes("L8"));
});

test("sitemap avec une adresse en 404 : Haute", async () => {
  const { s, url } = await serveur((req, o, ch) =>
    ch === "/sitemap.xml" ? { statut: 200, entetes: { "content-type": "application/xml" }, corps: `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${o}/</loc></url><url><loc>${o}/disparue</loc></url></urlset>` } : null,
  );
  const r = await lancer([url, "--json"]);
  s.close();
  assert.ok(r.json.constats.some((c) => c.code === "L6" && c.gravite === "haute" && /disparue/.test(c.message)), r.sortie);
});

test("chaîne de redirections longue et boucle", async () => {
  const longue = await serveur((req, o, ch) => {
    const m = ch.match(/^\/etape(\d)$/);
    if (ch === "/depart") return { statut: 301, entetes: { location: "/etape1" } };
    if (m && Number(m[1]) < 4) return { statut: 301, entetes: { location: `/etape${Number(m[1]) + 1}` } };
    if (ch === "/etape4") return { statut: 301, entetes: { location: "/" } };
    return null;
  });
  const r1 = await lancer([`${longue.url}depart`, "--json", "--pages", "1"]);
  longue.s.close();
  assert.ok(codes(r1.json).includes("L3:moyenne"), r1.sortie);
  const boucle = await serveur((req, o, ch) => (ch === "/" ? { statut: 302, entetes: { location: "/b" } } : ch === "/b" ? { statut: 302, entetes: { location: "/" } } : null));
  const r2 = await lancer([boucle.url, "--json"]);
  boucle.s.close();
  assert.strictEqual(r2.code, 1);
  assert.ok(codes(r2.json).includes("L3:critique"), r2.sortie);
});

test("adresse inconnue servie en 200 : soft 404 (Haute)", async () => {
  const { s, url } = await serveur((req, o, ch) => (ch.startsWith("/pulse-seo-introuvable-") ? { statut: 200, corps: pageHtml(o, ch) } : null));
  const r = await lancer([url, "--json"]);
  s.close();
  assert.ok(codes(r.json).includes("L8:haute"));
});

test("HTML de plus de 2 Mo : Haute", async () => {
  const { s, url } = await serveur((req, o, ch) => (ch === "/a-propos" ? { statut: 200, corps: pageHtml(o, "/a-propos", { corps: `<p>${"x".repeat(2.2 * 1024 * 1024)}</p>` }) } : null));
  const r = await lancer([url, "--json"]);
  s.close();
  assert.ok(r.json.constats.some((c) => c.code === "L24" && c.gravite === "haute"), r.sortie);
});

test("page qui varie selon l'agent : Googlebot reçoit la canonique en fin de <body> (L27)", async () => {
  const { s, url } = await serveur((req, o, ch) => {
    if (ch !== "/" || !/Googlebot/.test(req.headers["user-agent"])) return null;
    const html = pageHtml(o, "/").replace(/<link rel="canonical"[^>]*>/, "").replace("</body>", `<link rel="canonical" href="${o}/"></body>`);
    return { statut: 200, corps: html };
  });
  const r = await lancer([url, "--json"]);
  s.close();
  assert.ok(codes(r.json).includes("L27:haute"), r.sortie);
});

test("page privée servie à un inconnu : Critique ; redirigée vers la connexion : rien", async () => {
  const { s, url } = await serveur((req, o, ch) => (ch === "/compte" ? { statut: 200, corps: pageHtml(o, "/compte") } : ch === "/admin" ? { statut: 307, entetes: { location: "/connexion" } } : null));
  const r = await lancer([url, "--essentiel", "--privees", "/compte,/admin", "--json"]);
  s.close();
  assert.strictEqual(r.code, 1);
  assert.deepStrictEqual(codes(r.json), ["L25:critique"]);
});

test("--previsualisation : noindex attendu (absent = Moyenne), et noindex alors toléré", async () => {
  const sans = await serveur();
  const r1 = await lancer([sans.url, "--essentiel", "--previsualisation", "--json"]);
  sans.s.close();
  assert.deepStrictEqual(codes(r1.json), ["L26:moyenne"]);
  const avec = await serveur((req, o, ch) => {
    const r = defaut(o, ch);
    return { ...r, entetes: { ...(r.entetes || {}), "x-robots-tag": "noindex" } };
  });
  const r2 = await lancer([avec.url, "--essentiel", "--previsualisation", "--json"]);
  avec.s.close();
  assert.strictEqual(r2.code, 0, r2.sortie);
  assert.deepStrictEqual(r2.json.constats, []);
});

test("--chemins : pages lues en plus ; lien interne cassé (L16)", async () => {
  const { s, url } = await serveur((req, o, ch) => (ch === "/cachee" ? { statut: 200, corps: pageHtml(o, "/cachee", { liens: ["/lien-mort"] }) } : null));
  const r = await lancer([url, "--chemins", "/cachee", "--json"]);
  s.close();
  assert.ok(r.json.pages.some((p) => p.url.endsWith("/cachee") && p.origine === "chemin"));
  assert.ok(r.json.constats.some((c) => c.code === "L16" && /lien-mort/.test(c.message)), r.sortie);
});

test("accueil injoignable : Critique et arrêt", async () => {
  const r = await lancer(["http://127.0.0.1:1/", "--json"]);
  assert.strictEqual(r.code, 1);
  assert.deepStrictEqual(codes(r.json), ["L1:critique"]);
});

test("chemins : avec ou sans barre, adresse complète, ou transformés par Git Bash sous Windows", () => {
  const { cheminDuSite } = require(SEO);
  assert.strictEqual(cheminDuSite("/compte"), "/compte");
  assert.strictEqual(cheminDuSite("compte"), "/compte");
  assert.strictEqual(cheminDuSite("C:/Program Files/Git/compte/profil"), "/compte/profil");
  assert.strictEqual(cheminDuSite(String.raw`D:\Outils\Git\admin`), "/admin");
  assert.strictEqual(cheminDuSite("http://localhost:3000/a"), "http://localhost:3000/a");
});

test("appel invalide : usage et code 2", async () => {
  for (const args of [[], ["pas-une-adresse"], ["http://x.fr", "--inconnue"], ["http://x.fr", "--politique", "Z"]]) {
    const r = await lancer(args);
    assert.strictEqual(r.code, 2, args.join(" "));
    assert.match(r.sortie, /Usage : pulse-aidd seo/);
  }
});

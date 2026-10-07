// Tests des règles du référencement (scripts/seo-regles.js) : fonctions pures, sur des pages construites.
// Lancer : node --test plugins/pulse-vibe/tests/seo-regles.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const fs = require("fs");
const R = require(path.join(__dirname, "..", "scripts", "seo-regles.js"));
const { analyserHtml } = require(path.join(__dirname, "..", "scripts", "seo-html.js"));
const LISTE = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "references", "seo", "robots-ia.json"), "utf8"));

const EN_LIGNE = { origine: "https://www.exemple.fr", local: false, prive: false, previsualisation: false, maintenant: new Date("2026-10-07T10:00:00Z") };
const LOCAL = { ...EN_LIGNE, origine: "http://localhost:3000", local: true };

const TETE = (extra = "") => `<title>Menuiserie Dupont – meubles sur mesure</title><meta name="description" content="Meubles sur mesure à Lausanne."><link rel="canonical" href="https://www.exemple.fr/">
  <meta property="og:title" content="Menuiserie Dupont"><meta property="og:description" content="d"><meta property="og:url" content="https://www.exemple.fr/"><meta property="og:type" content="website">
  <meta property="og:image" content="https://www.exemple.fr/og.png"><meta name="twitter:card" content="summary_large_image">${extra}`;
const page = (tete, corps = "<h1>Menuiserie Dupont</h1><p>Des meubles faits pour durer, à Lausanne.</p>", autres = {}) => ({
  url: "https://www.exemple.fr/",
  origine: "accueil",
  statut: 200,
  entetes: {},
  chaine: [],
  html: analyserHtml(`<!DOCTYPE html><html lang="fr"><head>${tete}</head><body>${corps}</body></html>`),
  ...autres,
});
const codes = (constats) => constats.map((c) => `${c.code}:${c.gravite}`);

test("une page complète ne produit aucun constat", () => {
  assert.deepStrictEqual(R.reglesPage(page(TETE()), EN_LIGNE), []);
});

test("noindex : critique sur une page publique (balise ou en-tête), basse sur une page trouvée par un lien", () => {
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE('<meta name="robots" content="noindex, follow">')), EN_LIGNE)), ["L4:critique"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE(), undefined, { entetes: { "x-robots-tag": "noindex" } }), EN_LIGNE)), ["L4:critique"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE(), undefined, { entetes: { "x-robots-tag": "googlebot: none" } }), EN_LIGNE)), ["L4:critique"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE(), undefined, { entetes: { "x-robots-tag": "bingbot: noindex" } }), EN_LIGNE)), [], "noindex pour un autre robot");
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE('<meta name="robots" content="noindex">'), undefined, { origine: "lien" }), EN_LIGNE)), ["L4:basse"]);
  // Balise robots placée dans <body> : Google la respecte aussi.
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE(), '<p>x y z w</p><meta name="robots" content="noindex">'), EN_LIGNE)).filter((c) => c.startsWith("L4")), ["L4:critique"]);
});

test("site privé : l'absence de noindex devient le problème ; prévisualisation : noindex attendu", () => {
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE()), { ...EN_LIGNE, prive: true })), ["L4:haute"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE('<meta name="robots" content="noindex">')), { ...EN_LIGNE, previsualisation: true })), []);
  assert.deepStrictEqual(codes(R.reglePrevisualisation(page(TETE()))), ["L26:moyenne"]);
  assert.deepStrictEqual(R.reglePrevisualisation(page(TETE(), undefined, { entetes: { "x-robots-tag": "noindex" } })), []);
});

test("canonique : localhost ou autre domaine = critique en ligne ; relative ; dans <body> ; plusieurs", () => {
  const avec = (href) => TETE().replace('href="https://www.exemple.fr/"', `href="${href}"`);
  assert.deepStrictEqual(codes(R.reglesPage(page(avec("http://localhost:3000/")), EN_LIGNE)), ["L11:critique"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(avec("https://autre-site.fr/")), EN_LIGNE)), ["L11:critique"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(avec("https://exemple.fr/")), EN_LIGNE)), ["L11:moyenne"], "variante sans www");
  assert.deepStrictEqual(codes(R.reglesPage(page(avec("/")), EN_LIGNE)), ["L11:moyenne"]);
  const sansCanon = TETE().replace(/<link rel="canonical"[^>]*>/, "");
  assert.deepStrictEqual(codes(R.reglesPage(page(sansCanon, '<p>Du texte ici.</p><link rel="canonical" href="https://www.exemple.fr/">'), EN_LIGNE)), ["L11:haute", "L13:basse"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE('<link rel="canonical" href="https://www.exemple.fr/autre">')), EN_LIGNE)), ["L11:haute"]);
});

test("canonique en local : une autre adresse locale n'est pas une erreur, seulement une remarque", () => {
  const p = page(TETE().replaceAll("https://www.exemple.fr", "http://localhost:3000"), undefined, { url: "http://localhost:4123/" });
  assert.deepStrictEqual(codes(R.reglesPage(p, { ...LOCAL, origine: "http://localhost:4123" })), ["L11:basse"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE().replaceAll("https://www.exemple.fr", "http://localhost:3000"), undefined, { url: "http://localhost:3000/" }), LOCAL)), []);
});

test("titre absent, long, court ; description absente", () => {
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE().replace(/<title>.*?<\/title>/, "")), EN_LIGNE)), ["L9:haute"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE().replace(/<title>.*?<\/title>/, `<title>${"Très long titre ".repeat(6)}</title>`)), EN_LIGNE)), ["L9:basse"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE().replace(/<title>.*?<\/title>/, "<title>Accueil</title>")), EN_LIGNE)), ["L9:basse"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE().replace(/<meta name="description"[^>]*>/, "")), EN_LIGNE)), ["L10:moyenne"]);
});

test("titres et descriptions en double entre pages", () => {
  const a = page(TETE());
  const b = page(TETE(), undefined, { url: "https://www.exemple.fr/contact", origine: "sitemap" });
  assert.deepStrictEqual(codes(R.reglesSite([a, b], EN_LIGNE)), ["L9:moyenne", "L10:moyenne", "L21:basse"]);
});

test("images sans alt ou décrites par un nom de fichier ; liens inexplorables ou vagues", () => {
  const corps = '<h1>T</h1><p>Un texte assez long.</p><img src="/a.jpg"><img src="/b.jpg" alt="IMG_1234.jpg"><img src="/c.svg" alt=""><a>x</a><a href="#">y</a><a href="/tarifs">Cliquez ici</a>';
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE(), corps), EN_LIGNE)), ["L14:moyenne", "L14:moyenne", "L15:moyenne", "L15:basse"]);
});

test("texte absent du HTML (rendu dans le navigateur) ou caché en fin de page", () => {
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE(), '<div id="root"></div><script src="/app.js"></script>'), EN_LIGNE)), ["L13:basse", "L17:haute"]);
  const cache = `<h1>T</h1><p>Court</p><div hidden>${"mot ".repeat(80)}</div>`;
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE(), cache), EN_LIGNE)), ["L17:moyenne"]);
});

test("carte de partage : image absente, relative, localhost ; balises manquantes", () => {
  const sans = TETE().replace(/<meta property="og:image"[^>]*>/, "");
  assert.deepStrictEqual(codes(R.reglesPage(page(sans), EN_LIGNE)), ["L18:moyenne"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE().replace("https://www.exemple.fr/og.png", "/og.png")), EN_LIGNE)), ["L18:haute"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE().replace("https://www.exemple.fr/og.png", "http://localhost:3000/og.png")), EN_LIGNE)), ["L18:haute"]);
  assert.deepStrictEqual(codes(R.reglesPage(page(TETE().replace(/<meta name="twitter:card"[^>]*>/, "").replace(/<meta property="og:url"[^>]*>/, "")), EN_LIGNE)), ["L18:basse", "L18:basse"]);
  assert.deepStrictEqual(codes(R.regleImagePartage({ url: "u", statut: 404, page: "p" })), ["L18:haute"]);
  assert.deepStrictEqual(codes(R.regleImagePartage({ url: "u", statut: 200, type: "text/html", page: "p" })), ["L18:haute"]);
  assert.deepStrictEqual(codes(R.regleImagePartage({ url: "u", statut: 200, type: "image/png", taille: 9 * 1048576, page: "p" })), ["L18:moyenne"]);
  assert.deepStrictEqual(R.regleImagePartage({ url: "u", statut: 200, type: "image/png", taille: 50000, page: "p" }), []);
});

test("JSON-LD : invalide, sans @type, FAQPage sans effet, fil d'Ariane incomplet, Event incomplet, localhost", () => {
  const json = (o) => (typeof o === "string" ? o : JSON.stringify(o));
  const v = (o) => codes(R.verifierJsonLd(json(o), "u", EN_LIGNE).constats);
  assert.deepStrictEqual(v("{ pas du json"), ["L20:haute"]);
  assert.deepStrictEqual(v({ "@context": "https://schema.org" }), ["L20:moyenne"]);
  assert.deepStrictEqual(v({ "@context": "https://schema.org", "@type": "FAQPage" }), ["L20:basse"]);
  assert.deepStrictEqual(v({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ position: 1, name: "Accueil" }] }), ["L20:moyenne"]);
  assert.deepStrictEqual(v({ "@context": "https://schema.org", "@type": "Event", name: "Portes ouvertes" }), ["L20:moyenne"]);
  assert.deepStrictEqual(v({ "@context": "https://schema.org", "@type": "Product", name: "Chaise" }), ["L20:moyenne"]);
  assert.deepStrictEqual(v({ "@context": "https://schema.org", "@type": "WebSite", name: "A", url: "http://localhost:3000" }), ["L20:haute"]);
  assert.deepStrictEqual(v({ "@context": "https://schema.org", "@graph": [{ "@type": "WebSite", name: "A", url: "https://www.exemple.fr" }, { "@type": "Organization", name: "A" }] }), []);
  assert.deepStrictEqual(codes(R.verifierJsonLd(json({ "@context": "https://schema.org", "@type": "WebSite", url: "http://localhost:3000" }), "u", LOCAL).constats), [], "localhost normal en local");
});

test("nom du site : WebSite sur l'accueil", () => {
  const site = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Menuiserie Dupont","url":"https://www.exemple.fr"}</script>';
  assert.deepStrictEqual(R.reglesSite([page(TETE(site))], EN_LIGNE), []);
  assert.deepStrictEqual(codes(R.reglesSite([page(TETE())], EN_LIGNE)), ["L21:basse"]);
});

test("hreflang : auto-référence, codes, x-default, réciprocité", () => {
  const fr = page(TETE('<link rel="alternate" hreflang="fr" href="https://www.exemple.fr/"><link rel="alternate" hreflang="en" href="https://www.exemple.fr/en"><link rel="alternate" hreflang="x-default" href="https://www.exemple.fr/">'));
  const enSansRetour = page(TETE('<link rel="alternate" hreflang="en" href="https://www.exemple.fr/en"><link rel="alternate" hreflang="x-default" href="https://www.exemple.fr/en">').replace('href="https://www.exemple.fr/"', 'href="https://www.exemple.fr/en"'), undefined, { url: "https://www.exemple.fr/en", origine: "lien" });
  assert.deepStrictEqual(R.reglesPage(fr, EN_LIGNE), []);
  assert.ok(codes(R.reglesSite([fr, enSansRetour], EN_LIGNE)).includes("L23:haute"));
  const sansSoi = page(TETE('<link rel="alternate" hreflang="en" href="https://www.exemple.fr/en"><link rel="alternate" hreflang="EN_us" href="https://www.exemple.fr/us">'));
  assert.deepStrictEqual(codes(R.reglesPage(sansSoi, EN_LIGNE)), ["L23:haute", "L23:haute", "L23:basse"]);
});

test("HTML de plus de 2 Mo", () => {
  const p = page(TETE());
  p.html.tailleOctets = 3 * 1024 * 1024;
  assert.deepStrictEqual(codes(R.reglesPage(p, EN_LIGNE)), ["L24:haute"]);
});

test("accueil : erreur réseau, code non 200, boucle ; redirections longues ou temporaires", () => {
  assert.deepStrictEqual(codes(R.reglesAccueil({ url: "u", erreur: "ECONNREFUSED" }, EN_LIGNE)), ["L1:critique"]);
  assert.deepStrictEqual(codes(R.reglesAccueil({ url: "u", statut: 500, chaine: [] }, EN_LIGNE)), ["L1:critique"]);
  assert.deepStrictEqual(codes(R.reglesAccueil({ url: "u", statut: 301, boucle: true, chaine: [{ url: "a", statut: 301 }, { url: "b", statut: 301 }] }, EN_LIGNE)), ["L3:critique"]);
  const longue = { url: "u", statut: 200, origine: "accueil", chaine: [1, 2, 3, 4].map((n) => ({ url: `/${n}`, statut: n === 2 ? 302 : 301 })) };
  assert.deepStrictEqual(codes(R.reglesAccueil(longue, EN_LIGNE)), ["L3:moyenne", "L3:basse"]);
});

test("variantes http et www : 200 sans redirection, redirection temporaire, redirection ailleurs", () => {
  assert.deepStrictEqual(R.reglesVariantes([{ url: "http://www.exemple.fr/", statut: 308, location: "https://www.exemple.fr/" }], EN_LIGNE), []);
  assert.deepStrictEqual(codes(R.reglesVariantes([{ url: "https://exemple.fr/", statut: 200 }], EN_LIGNE)), ["L2:haute"]);
  assert.deepStrictEqual(R.reglesVariantes([{ url: "https://exemple.fr/", statut: 200, canonique: "https://www.exemple.fr/" }], EN_LIGNE), [], "canonique vers l'adresse officielle : accepté");
  assert.deepStrictEqual(codes(R.reglesVariantes([{ url: "http://www.exemple.fr/", statut: 302, location: "https://www.exemple.fr/" }], EN_LIGNE)), ["L2:moyenne"]);
  assert.deepStrictEqual(codes(R.reglesVariantes([{ url: "http://www.exemple.fr/", statut: 301, location: "https://autre.fr/" }], EN_LIGNE)), ["L2:moyenne"]);
  assert.deepStrictEqual(R.reglesVariantes([{ url: "https://exemple.fr/", erreur: "ENOTFOUND" }], EN_LIGNE), []);
});

test("robots.txt : Disallow: / pour Google ou pour tous, 5xx, absent, CSS bloqué, Sitemap relatif ou absent", () => {
  const r = (statut, texte, extra = {}) => codes(R.reglesRobots({ statut, texte, ...extra }, EN_LIGNE));
  assert.deepStrictEqual(r(200, "User-agent: *\nDisallow: /\n"), ["L5:critique", "L5:basse"]);
  assert.deepStrictEqual(r(200, "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /\nSitemap: https://www.exemple.fr/sitemap.xml\n"), ["L5:critique"]);
  assert.deepStrictEqual(r(200, "User-agent: Googlebot\nAllow: /\n\nUser-agent: *\nDisallow: /\nSitemap: https://www.exemple.fr/sitemap.xml\n"), ["L5:haute"]);
  assert.deepStrictEqual(r(503, ""), ["L5:critique"]);
  assert.deepStrictEqual(r(404, ""), ["L5:basse"]);
  assert.deepStrictEqual(r(200, "User-agent: *\nDisallow: /_next/\nSitemap: /sitemap.xml\n", { ressources: ["/_next/static/a.css"] }), ["L5:moyenne", "L5:moyenne"]);
  assert.deepStrictEqual(r(200, "User-agent: *\nAllow: /\nSitemap: https://www.exemple.fr/sitemap.xml\n"), []);
  assert.deepStrictEqual(codes(R.reglesRobots({ statut: 200, texte: "User-agent: *\nDisallow: /\n" }, { ...EN_LIGNE, prive: true })), [], "site privé : Disallow: / voulu");
});

test("sitemap : introuvable, mal formé, adresse relative ou ailleurs, adresse en erreur, canonique ailleurs, dates de génération", () => {
  const { lireSitemap } = require(path.join(__dirname, "..", "scripts", "seo-html.js"));
  const xml = (corps) => `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${corps}</urlset>`;
  const sm = (corps) => ({ url: "https://www.exemple.fr/sitemap.xml", statut: 200, lecture: lireSitemap(xml(corps)) });
  assert.deepStrictEqual(codes(R.reglesSitemap({ url: "s", statut: 404 }, [], EN_LIGNE)), ["L6:moyenne"]);
  assert.deepStrictEqual(codes(R.reglesSitemap(sm("<url><loc>/a</loc></url>"), [], EN_LIGNE)), ["L6:haute"]);
  assert.deepStrictEqual(codes(R.reglesSitemap(sm("<url><loc>http://localhost:3000/a</loc></url>"), [], EN_LIGNE)), ["L6:critique"]);
  const enErreur = { url: "https://www.exemple.fr/a", statut: 404, chaine: [] };
  assert.deepStrictEqual(codes(R.reglesSitemap(sm("<url><loc>https://www.exemple.fr/a</loc></url>"), [enErreur], EN_LIGNE)), ["L6:haute"]);
  const canonAilleurs = page(TETE(), undefined, { url: "https://www.exemple.fr/a", origine: "sitemap" });
  assert.deepStrictEqual(codes(R.reglesSitemap(sm("<url><loc>https://www.exemple.fr/a</loc></url>"), [canonAilleurs], EN_LIGNE)), ["L6:haute"]);
  const jour = "2026-10-07T09:58:00.000Z";
  assert.deepStrictEqual(codes(R.reglesSitemap(sm(`<url><loc>https://www.exemple.fr/</loc><lastmod>${jour}</lastmod></url><url><loc>https://www.exemple.fr/b</loc><lastmod>${jour}</lastmod></url>`), [], EN_LIGNE)), ["L7:basse"]);
  assert.deepStrictEqual(R.reglesSitemap(sm("<url><loc>https://www.exemple.fr/</loc><lastmod>2026-01-02</lastmod></url><url><loc>https://www.exemple.fr/b</loc><lastmod>2026-03-04</lastmod></url>"), [], EN_LIGNE), []);
});

test("adresse inconnue : 200 = soft 404, redirection, erreur serveur ; 404 et 410 attendus", () => {
  assert.deepStrictEqual(codes(R.regleSoft404({ url: "u", statut: 200 })), ["L8:haute"]);
  assert.deepStrictEqual(codes(R.regleSoft404({ url: "u", statut: 307 })), ["L8:moyenne"]);
  assert.deepStrictEqual(codes(R.regleSoft404({ url: "u", statut: 500 })), ["L8:haute"]);
  assert.deepStrictEqual(R.regleSoft404({ url: "u", statut: 404 }), []);
  assert.deepStrictEqual(R.regleSoft404({ url: "u", statut: 410 }), []);
});

test("pages privées : 200 sans noindex = critique ; redirection, 401, 403 acceptés", () => {
  assert.deepStrictEqual(codes(R.reglePrivee(page(TETE(), undefined, { url: "https://www.exemple.fr/compte" }))), ["L25:critique"]);
  assert.deepStrictEqual(codes(R.reglePrivee(page(TETE('<meta name="robots" content="noindex">')))), ["L25:basse"]);
  for (const statut of [302, 307, 401, 403]) assert.deepStrictEqual(R.reglePrivee({ url: "u", statut }), []);
});

test("Googlebot : canonique dans <body> = haute ; titre dans <body> = moyenne", () => {
  const corpsCanon = '<p>Texte</p><title>T</title><link rel="canonical" href="https://www.exemple.fr/">';
  assert.deepStrictEqual(codes(R.regleGooglebot(page("", corpsCanon))), ["L27:haute"]);
  assert.deepStrictEqual(codes(R.regleGooglebot(page("", "<p>Texte</p><title>T</title>"))), ["L27:moyenne"]);
  assert.deepStrictEqual(R.regleGooglebot(page(TETE())), []);
});

test("icône : absente, non carrée, petite ; dimensions lues dans PNG, ICO, GIF", () => {
  const png = Buffer.alloc(24);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(32, 16);
  png.writeUInt32BE(32, 20);
  assert.deepStrictEqual(R.tailleImage(png), { largeur: 32, hauteur: 32, format: "png" });
  const ico = Buffer.from([0, 0, 1, 0, 2, 0, 16, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepStrictEqual(R.tailleImage(ico), { largeur: 256, hauteur: 256, format: "ico" });
  assert.deepStrictEqual(R.tailleImage(Buffer.from("GIF89a\x40\x00\x40\x00", "latin1")), { largeur: 64, hauteur: 64, format: "gif" });
  assert.strictEqual(R.tailleImage(Buffer.from("rien")), null);
  assert.deepStrictEqual(codes(R.regleIcone({ url: "/favicon.ico", statut: 404 }, "u")), ["L22:moyenne"]);
  assert.deepStrictEqual(codes(R.regleIcone({ url: "i", statut: 200, taille: { largeur: 64, hauteur: 32 } }, "u")), ["L22:moyenne"]);
  assert.deepStrictEqual(codes(R.regleIcone({ url: "i", statut: 200, taille: { largeur: 32, hauteur: 32 } }, "u")), ["L22:basse"]);
  assert.deepStrictEqual(R.regleIcone({ url: "i", statut: 200, taille: { largeur: 256, hauteur: 256 } }, "u"), []);
});

test("liens internes cassés", () => {
  assert.deepStrictEqual(codes(R.reglesLiens([{ url: "a", statut: 404, depuis: "p" }, { url: "b", statut: 200, depuis: "p" }, { url: "c", erreur: "ECONNRESET", depuis: "p" }])), ["L16:haute", "L16:haute"]);
});

test("robots de partage : og:title et og:image attendus dans <head>", () => {
  assert.deepStrictEqual(R.reglePartageRobots(page(TETE())), []);
  assert.deepStrictEqual(codes(R.reglePartageRobots(page("<title>T</title>", '<p>x</p><meta property="og:title" content="T"><meta property="og:image" content="https://x/i.png">'))), ["L19:moyenne"]);
});

test("fiche docs/seo.md : bloc pulse-seo lu ; absent = valeurs par défaut", () => {
  const f = R.lireFiche(`# Référencement\n<!-- pulse-seo\nsite: public\nadresse: https://www.exemple.fr\npolitique-ia: b\ncontent-signal: search=yes, ai-input=yes, ai-train=no\nnosnippet: non\namazonbot: bloqué\nfait: Menuiserie Dupont\nfait: Lausanne\nprivee: /compte\n-->\n`);
  assert.strictEqual(f.trouvee, true);
  assert.strictEqual(f.politique, "B");
  assert.strictEqual(f.adresse, "https://www.exemple.fr");
  assert.strictEqual(f.contentSignal, "search=yes, ai-input=yes, ai-train=no");
  assert.strictEqual(f.bloquerMixte, true);
  assert.deepStrictEqual(f.faits, ["Menuiserie Dupont", "Lausanne"]);
  assert.deepStrictEqual(f.privees, ["/compte"]);
  const vide = R.lireFiche("");
  assert.strictEqual(vide.trouvee, false);
  assert.strictEqual(vide.politique, null);
  assert.strictEqual(R.lireFiche("<!-- pulse-seo\npolitique-ia: à décider\nsite: privé\n-->").politique, null);
  assert.strictEqual(R.lireFiche("<!-- pulse-seo\nsite: privé\n-->").site, "prive");
});

test("le modèle docs/seo.md se lit sans fausse valeur (politique à décider, aucun fait, aucune page privée)", () => {
  const modele = fs.readFileSync(path.join(__dirname, "..", "templates", "seo.md"), "utf8");
  const f = R.lireFiche(modele);
  assert.strictEqual(f.trouvee, true);
  assert.strictEqual(f.site, "public");
  assert.strictEqual(f.politique, null);
  assert.strictEqual(f.adresse, null);
  assert.strictEqual(f.contentSignal, null);
  assert.strictEqual(f.bloquerMixte, false);
  assert.deepStrictEqual(f.faits, []);
  assert.deepStrictEqual(f.privees, []);
});

test("IA : robots.txt comparé à la politique (IA1, IA8), groupe qui rouvre (IA2), jetons périmés (IA3), Content-Signal (IA9)", () => {
  const r = (texte, politique, opts) => codes(R.reglesRobotsIa({ statut: 200, texte }, politique, LISTE, EN_LIGNE, opts));
  assert.deepStrictEqual(r("User-agent: *\nAllow: /\n", "A"), []);
  const ouvert = r("User-agent: *\nAllow: /\n", "B");
  assert.ok(ouvert.every((x) => x === "IA8:moyenne") && ouvert.length === 6, ouvert.join());
  const { genererRobots } = require(path.join(__dirname, "..", "scripts", "robots.js"));
  for (const p of ["A", "B", "C", "D"]) assert.deepStrictEqual(r(genererRobots(p, LISTE.robots), p), [], `politique ${p} générée`);
  assert.ok(r("User-agent: *\nAllow: /\nUser-agent: OAI-SearchBot\nDisallow: /\n", "A").includes("IA1:haute"));
  assert.deepStrictEqual(r("User-agent: *\nDisallow: /admin/\n\nUser-agent: GPTBot\nAllow: /\n", "A"), ["IA2:moyenne"]);
  assert.deepStrictEqual(r("User-agent: *\nAllow: /\n\nUser-agent: anthropic-ai\nDisallow: /\n", "A"), ["IA3:basse"]);
  assert.deepStrictEqual(r("User-agent: ChatGPT-User\nAllow: /\n", "A"), ["IA3:basse"]);
  const signalB = genererRobots("B", LISTE.robots, { contentSignal: "search=yes, ai-input=yes, ai-train=yes" });
  assert.deepStrictEqual(r(signalB, "B"), ["IA9:moyenne"]);
  assert.deepStrictEqual(r("User-agent: *\nContent-Signal: ai-train=peut-etre\nAllow: /\n", "A"), ["IA9:moyenne"]);
  assert.deepStrictEqual(r("User-agent: *\nAllow: /\n", null), ["IA1:basse"], "politique non décidée");
});

test("IA : nosnippet non décidé (IA7), JSON-LD absent du texte (IA12), faits clés (IA11), llms.txt (IA10)", () => {
  const p = page(TETE('<meta name="robots" content="max-snippet:0">'), '<h1>Menuiserie Dupont</h1><p data-nosnippet>Prix</p><script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Menuiserie Dupont","telephone":"+41 21 000 00 00","address":{"@type":"PostalAddress","addressLocality":"Lausanne"}}</script>');
  assert.deepStrictEqual(codes(R.reglesContenuIa([p], { nosnippetDecide: false, faits: ["Menuiserie Dupont", "sur devis"] }, EN_LIGNE)), ["IA7:haute", "IA7:moyenne", "IA12:moyenne", "IA11:basse"]);
  assert.deepStrictEqual(codes(R.reglesContenuIa([p], { nosnippetDecide: true, faits: [] }, EN_LIGNE)), ["IA12:moyenne"]);
  assert.deepStrictEqual(R.regleLlms({ url: "u", statut: 404 }), []);
  assert.deepStrictEqual(codes(R.regleLlms({ url: "u", statut: 200, type: "text/html", texte: "Bonjour" })), ["IA10:basse", "IA10:basse"]);
  assert.deepStrictEqual(R.regleLlms({ url: "u", statut: 200, type: "text/markdown; charset=utf-8", texte: "# Menuiserie Dupont\n> Résumé" }), []);
});

test("IA : réponse refusée à un robot autorisé (IA4), page vide (IA5), métadonnées en fin de page (IA6)", () => {
  const vide = analyserHtml('<html><head></head><body><div id="root"></div></body></html>');
  const tardif = analyserHtml("<html><head></head><body><p>Un vrai texte de page</p><title>T</title></body></html>");
  const reps = [
    { jeton: "OAI-SearchBot", url: "u", statut: 403 },
    { jeton: "Claude-SearchBot", url: "u", statut: 200, html: vide },
    { jeton: "PerplexityBot", url: "u", statut: 200, html: tardif },
  ];
  assert.deepStrictEqual(codes(R.reglesAgentsIa(reps, "B", LISTE)), ["IA4:haute", "IA5:haute", "IA6:moyenne"]);
  assert.deepStrictEqual(codes(R.reglesAgentsIa([{ jeton: "OAI-SearchBot", url: "u", statut: 403 }], "C", LISTE)), [], "politique C : refus voulu");
});

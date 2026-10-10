// Tests du lecteur de HTML du référencement (skills/seo/scripts/seo-html.js).
// Lancer : node --test plugins/pulse-vibe/tests/seo-html.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { analyserHtml, lireSitemap, decoderEntites } = require(path.join(__dirname, "..", "skills", "seo", "scripts", "seo-html.js"));

test("titre, description, canonique et langue lus dans <head>", () => {
  const h = analyserHtml(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Menuiserie Dupont – Lausanne</title>
    <meta name="description" content="Meubles sur mesure.">
    <link rel="canonical" href="https://www.exemple.fr/"></head><body><h1>Bienvenue</h1><p>Texte.</p></body></html>`);
  assert.strictEqual(h.lang, "fr");
  assert.deepStrictEqual(h.titres, [{ texte: "Menuiserie Dupont – Lausanne", section: "head" }]);
  assert.strictEqual(h.metas.find((m) => m.name === "description").content, "Meubles sur mesure.");
  const canon = h.liens.find((l) => l.rel.includes("canonical"));
  assert.strictEqual(canon.href, "https://www.exemple.fr/");
  assert.strictEqual(canon.section, "head");
  assert.deepStrictEqual(h.h1, ["Bienvenue"]);
  assert.match(h.texteVisible, /Bienvenue Texte\./);
});

test("attributs sans guillemets, en majuscules, avec apostrophes ou sur plusieurs lignes", () => {
  const h = analyserHtml(`<HTML LANG=fr><HEAD><META NAME=robots CONTENT=noindex><LINK
     REL='canonical'
     HREF="https://exemple.fr/a?x=1&amp;y=2"></HEAD><BODY><IMG SRC=photo.jpg><img src="b.png" alt=""></BODY></HTML>`);
  assert.strictEqual(h.lang, "fr");
  assert.strictEqual(h.metas[0].name, "robots");
  assert.strictEqual(h.metas[0].content, "noindex");
  assert.strictEqual(h.liens[0].href, "https://exemple.fr/a?x=1&y=2");
  assert.deepStrictEqual(h.images, [{ src: "photo.jpg", alt: null }, { src: "b.png", alt: "" }]);
});

test("commentaires, scripts et styles ignorés ; un script qui contient du HTML ne trompe pas le lecteur", () => {
  const h = analyserHtml(`<html><head><title>T</title></head><body>
    <!-- <title>Faux</title> <a href="/cache">x</a> -->
    <script>var s = "<a href='/script'>lien</a></div>";</script>
    <style>a::before { content: "<b>"; }</style>
    <p>Vrai texte</p></body></html>`);
  assert.strictEqual(h.titres.length, 1);
  assert.deepStrictEqual(h.ancres, []);
  assert.strictEqual(h.texteVisible, "Vrai texte");
});

test("métadonnées envoyées en fin de page : repérées dans <body>", () => {
  const h = analyserHtml(`<html><head><meta charset="utf-8"></head><body><main><p>Contenu</p></main>
    <title>Titre tardif</title><link rel="canonical" href="https://exemple.fr/p"><meta name="description" content="d"></body></html>`);
  assert.strictEqual(h.titres[0].section, "body");
  assert.strictEqual(h.liens[0].section, "body");
  assert.strictEqual(h.metas.find((m) => m.name === "description").section, "body");
});

test("un élément de contenu avant <body> ouvre le corps (balises suivantes hors de <head>)", () => {
  const h = analyserHtml(`<html><head><title>T</title><div>Contenu</div><link rel="canonical" href="https://x.fr/"></head><body></body></html>`);
  assert.strictEqual(h.titres[0].section, "head");
  assert.strictEqual(h.liens[0].section, "body");
});

test("<title> d'une image SVG ignoré", () => {
  const h = analyserHtml(`<html><head><title>Page</title></head><body><svg><title>Icône</title><path d="M0"/></svg><p>x</p></body></html>`);
  assert.deepStrictEqual(h.titres.map((t) => t.texte), ["Page"]);
});

test("texte des blocs hidden et <template> mis à part (chargement progressif)", () => {
  const h = analyserHtml(`<html><head></head><body><p>Visible</p><div hidden id="S:0"><p>Arrivé plus tard</p></div><template><p>Modèle</p></template></body></html>`);
  assert.strictEqual(h.texteVisible, "Visible");
  assert.match(h.texteCache, /Arrivé plus tard/);
  assert.match(h.texteCache, /Modèle/);
});

test("liens : href, texte, liens sans href ; data-nosnippet compté", () => {
  const h = analyserHtml(`<html><body><nav><a href="/tarifs">Voir <b>nos tarifs</b></a><a>sans lien</a><a href="javascript:void(0)">js</a></nav><p data-nosnippet>secret</p></body></html>`);
  assert.deepStrictEqual(h.ancres.map((a) => [a.href, a.texte]), [["/tarifs", "Voir nos tarifs"], [null, "sans lien"], ["javascript:void(0)", "js"]]);
  assert.strictEqual(h.nosnippet, 1);
});

test("JSON-LD : contenu brut et section", () => {
  const h = analyserHtml(`<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"A \\u003c B"}</script></head><body><script type="application/ld+json">{"@type":"Event"}</script></body></html>`);
  assert.strictEqual(h.jsonLd.length, 2);
  assert.strictEqual(JSON.parse(h.jsonLd[0].brut).name, "A < B");
  assert.strictEqual(h.jsonLd[0].section, "head");
  assert.strictEqual(h.jsonLd[1].section, "body");
});

test("entités : nommées, décimales, hexadécimales ; inconnues gardées", () => {
  assert.strictEqual(decoderEntites("L&apos;&eacute;t&#233; &#x2013; &laquo;&nbsp;oui&nbsp;&raquo; &inconnue;"), "L'été – « oui » &inconnue;");
  const h = analyserHtml("<html><head><title>Caf&eacute; &amp; th&eacute;</title></head><body></body></html>");
  assert.strictEqual(h.titres[0].texte, "Café & thé");
});

test("taille en octets UTF-8", () => {
  assert.strictEqual(analyserHtml("é").tailleOctets, 2);
});

test("sitemap : adresses, dates, espace de noms ; index de sitemaps ; fichier invalide", () => {
  const s = lireSitemap(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://x.fr/</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://x.fr/a?b=1&amp;c=2</loc></url>
</urlset>`);
  assert.strictEqual(s.estIndex, false);
  assert.strictEqual(s.espaceDeNoms, true);
  assert.deepStrictEqual(s.urls, [{ loc: "https://x.fr/", lastmod: "2026-09-01" }, { loc: "https://x.fr/a?b=1&c=2", lastmod: null }]);
  assert.deepStrictEqual(s.erreurs, []);
  const i = lireSitemap(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://x.fr/s1.xml</loc></sitemap></sitemapindex>`);
  assert.strictEqual(i.estIndex, true);
  assert.strictEqual(i.urls[0].loc, "https://x.fr/s1.xml");
  assert.ok(lireSitemap("<html>pas un sitemap</html>").erreurs.length);
  assert.match(lireSitemap(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://x.fr/</loc></url>`).erreurs.join(), /tronqué/);
});

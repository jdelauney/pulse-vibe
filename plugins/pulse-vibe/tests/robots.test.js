// Tests de l'analyseur et du générateur de robots.txt (scripts/robots.js, RFC 9309).
// Lancer : node --test plugins/pulse-vibe/tests/robots.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const fs = require("fs");
const robots = require(path.join(__dirname, "..", "scripts", "robots.js"));
const LISTE = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "references", "seo", "robots-ia.json"), "utf8")).robots;

test("le groupe le plus précis l'emporte : un robot nommé ne lit plus le groupe *", () => {
  const a = robots.analyser("User-agent: *\nDisallow: /prive/\n\nUser-agent: GPTBot\nAllow: /\n");
  assert.strictEqual(robots.autorise(a, "Googlebot", "/prive/x"), false);
  assert.strictEqual(robots.autorise(a, "GPTBot", "/prive/x"), true, "GPTBot oublie les Disallow de *");
});

test("nom du robot insensible à la casse ; plusieurs User-agent pour un groupe ; groupes du même nom cumulés", () => {
  const a = robots.analyser("User-agent: gptbot\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: GPTBOT\nAllow: /public/\n");
  assert.strictEqual(robots.autorise(a, "GPTBot", "/"), false);
  assert.strictEqual(robots.autorise(a, "ccbot", "/x"), false);
  assert.strictEqual(robots.autorise(a, "GPTBot", "/public/page"), true, "règles des deux groupes GPTBot cumulées");
});

test("la règle la plus longue gagne ; Allow gagne à égalité", () => {
  const a = robots.analyser("User-agent: *\nDisallow: /dossier/\nAllow: /dossier/page\nDisallow: /egal\nAllow: /egal\n");
  assert.strictEqual(robots.autorise(a, "x", "/dossier/autre"), false);
  assert.strictEqual(robots.autorise(a, "x", "/dossier/page.html"), true);
  assert.strictEqual(robots.autorise(a, "x", "/egal"), true);
});

test("jokers * et fin de chemin $", () => {
  const a = robots.analyser("User-agent: *\nDisallow: /*.pdf$\nDisallow: /recherche*tri=\n");
  assert.strictEqual(robots.autorise(a, "x", "/docs/a.pdf"), false);
  assert.strictEqual(robots.autorise(a, "x", "/docs/a.pdf?v=2"), true);
  assert.strictEqual(robots.autorise(a, "x", "/recherche?q=a&tri=prix"), false);
});

test("Disallow vide = tout permis ; aucun groupe = tout permis ; /robots.txt toujours permis", () => {
  assert.strictEqual(robots.autorise(robots.analyser("User-agent: *\nDisallow:\n"), "x", "/"), true);
  assert.strictEqual(robots.autorise(robots.analyser(""), "x", "/"), true);
  assert.strictEqual(robots.autorise(robots.analyser("User-agent: *\nDisallow: /\n"), "x", "/robots.txt"), true);
});

test("commentaires, BOM, CRLF ; lignes inconnues gardées ; Sitemap global ; Content-Signal relevé", () => {
  const a = robots.analyser("﻿# Bonjour\r\nUser-agent: * # tous\r\nCrawl-delay: 2\r\nContent-Signal: search=yes, ai-train=no\r\nDisallow: /a\r\nSitemap: https://x.fr/sitemap.xml\r\nligne bizarre\r\n");
  assert.strictEqual(a.groupes.length, 1);
  assert.deepStrictEqual(a.groupes[0].agents, ["*"]);
  assert.deepStrictEqual(a.sitemaps, ["https://x.fr/sitemap.xml"]);
  assert.strictEqual(a.signaux[0].valeur, "search=yes, ai-train=no");
  assert.ok(a.groupes[0].autres.some((x) => x.cle === "Crawl-delay"));
  assert.strictEqual(a.inconnues.length, 1);
  assert.strictEqual(robots.autorise(a, "x", "/a/b"), false);
});

test("une ligne User-agent après des règles ouvre un nouveau groupe", () => {
  const a = robots.analyser("User-agent: a\nDisallow: /\nUser-agent: b\nAllow: /\n");
  assert.strictEqual(a.groupes.length, 2);
  assert.strictEqual(robots.autorise(a, "b", "/x"), true);
});

test("Content-Signal : lecture et erreurs", () => {
  assert.deepStrictEqual(robots.lireSignal("search=yes, ai-input=yes, ai-train=no"), { valeurs: { search: "yes", "ai-input": "yes", "ai-train": "no" }, erreurs: [] });
  assert.strictEqual(robots.lireSignal("ai-train=peut-etre, train").erreurs.length, 2);
});

test("aller-retour pour chaque politique : genererRobots → analyser → autorise conforme à attendu", () => {
  for (const politique of robots.POLITIQUES) {
    const texte = robots.genererRobots(politique, LISTE, { sitemap: "https://x.fr/sitemap.xml", fermes: ["/api/"], contentSignal: politique === "B" ? "search=yes, ai-input=yes, ai-train=no" : null });
    const a = robots.analyser(texte);
    for (const r of LISTE) {
      if (r.role === "apercu") continue;
      const voulu = robots.attendu(politique, r) === "autorise";
      assert.strictEqual(robots.autorise(a, r.jeton, "/"), voulu, `${politique} : ${r.jeton}`);
      if (voulu) assert.strictEqual(robots.autorise(a, r.jeton, "/api/x"), false, `${politique} : ${r.jeton} ne doit pas rouvrir /api/`);
    }
    assert.strictEqual(robots.autorise(a, "Googlebot", "/"), politique !== "D", `${politique} : Googlebot`);
    if (politique !== "D") assert.deepStrictEqual(a.sitemaps, ["https://x.fr/sitemap.xml"]);
  }
});

test("pulse-aidd seo robots : robots.txt d'une politique, refus d'une politique inconnue", () => {
  const { spawnSync } = require("child_process");
  const SEO = path.join(__dirname, "..", "scripts", "seo.js");
  const r = spawnSync("node", [SEO, "robots", "b", "--sitemap", "https://x.fr/sitemap.xml", "--fermes", "/api/", "--signal", "search=yes, ai-train=no"], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  const a = robots.analyser(r.stdout);
  assert.strictEqual(robots.autorise(a, "GPTBot", "/"), false);
  assert.strictEqual(robots.autorise(a, "OAI-SearchBot", "/"), true);
  assert.strictEqual(robots.autorise(a, "OAI-SearchBot", "/api/x"), false);
  assert.deepStrictEqual(a.sitemaps, ["https://x.fr/sitemap.xml"]);
  assert.strictEqual(a.signaux[0].valeur, "search=yes, ai-train=no");
  for (const args of [["robots", "Z"], ["robots", "A", "--sitemap", "/sitemap.xml"], ["robots", "A", "--inconnue"]]) {
    const e = spawnSync("node", [SEO, ...args], { encoding: "utf8" });
    assert.strictEqual(e.status, 2, args.join(" "));
    assert.match(e.stderr, /Usage : pulse-aidd seo robots/);
  }
});

test("politique B : entraînement bloqué, recherche ouverte ; Amazonbot bloqué seulement sur demande", () => {
  const r = (jeton) => LISTE.find((x) => x.jeton === jeton);
  assert.strictEqual(robots.attendu("B", r("GPTBot")), "bloque");
  assert.strictEqual(robots.attendu("B", r("Google-Extended")), "bloque");
  assert.strictEqual(robots.attendu("B", r("OAI-SearchBot")), "autorise");
  assert.strictEqual(robots.attendu("B", r("Googlebot")), "autorise");
  assert.strictEqual(robots.attendu("B", r("Amazonbot")), "autorise");
  assert.strictEqual(robots.attendu("B", r("Amazonbot"), { bloquerMixte: true }), "bloque");
  assert.strictEqual(robots.attendu("C", r("OAI-SearchBot")), "bloque");
  assert.strictEqual(robots.attendu("C", r("Googlebot")), "autorise", "C : Google se règle dans Search Console, pas dans robots.txt");
  assert.throws(() => robots.genererRobots("Z", LISTE), /Politique inconnue/);
});

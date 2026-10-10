// Tests de la liste des robots IA (skills/seo/references/robots-ia.json), source unique de /pulse:seo ia.
// Lancer : node --test plugins/pulse-vibe/tests/robots-ia.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { ROLES } = require(path.join(__dirname, "..", "skills", "seo", "scripts", "robots.js"));

const FICHIER = path.join(__dirname, "..", "skills", "seo", "references", "robots-ia.json");
const liste = JSON.parse(fs.readFileSync(FICHIER, "utf8"));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

test("chaque robot a ses champs, un rôle connu, une source https et une date ISO", () => {
  assert.match(liste.verifieLe, DATE);
  assert.ok(liste.robots.length >= 15);
  for (const r of liste.robots) {
    for (const champ of ["jeton", "editeur", "role", "obeit", "usage", "source", "verifieLe"]) assert.ok(r[champ], `${r.jeton || "?"} : ${champ}`);
    assert.ok(ROLES.includes(r.role), `${r.jeton} : rôle ${r.role}`);
    assert.ok(["oui", "non", "incertain"].includes(r.obeit), `${r.jeton} : obeit`);
    assert.match(r.source, /^https:\/\//, `${r.jeton} : source`);
    assert.match(r.verifieLe, DATE, `${r.jeton} : date`);
    assert.match(r.jeton, /^[A-Za-z][\w-]*$/, `${r.jeton} : jeton robots.txt`);
  }
});

test("aucun jeton en double (casse ignorée)", () => {
  const vus = liste.robots.map((r) => r.jeton.toLowerCase());
  assert.deepStrictEqual(vus.filter((j, i) => vus.indexOf(j) !== i), []);
});

test("les robots cités par la politique B existent, avec le bon rôle", () => {
  const role = (j) => (liste.robots.find((r) => r.jeton === j) || {}).role;
  for (const j of ["GPTBot", "ClaudeBot", "Meta-ExternalAgent", "CCBot"]) assert.strictEqual(role(j), "entrainement", j);
  for (const j of ["Google-Extended", "Applebot-Extended"]) assert.strictEqual(role(j), "jeton-entrainement", j);
  for (const j of ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot", "Meta-WebIndexer", "Amzn-SearchBot"]) assert.strictEqual(role(j), "recherche", j);
  for (const j of ["Googlebot", "Bingbot", "Applebot"]) assert.strictEqual(role(j), "moteur", j);
  assert.strictEqual(role("Amazonbot"), "mixte");
});

test("jetons périmés absents (anthropic-ai, claude-web)", () => {
  const jetons = liste.robots.map((r) => r.jeton.toLowerCase());
  assert.ok(!jetons.includes("anthropic-ai") && !jetons.includes("claude-web"));
});

test("liste revérifiée il y a moins de 6 mois (avertissement seulement)", (t) => {
  const age = (Date.now() - Date.parse(liste.verifieLe)) / (24 * 3600 * 1000);
  if (age > 183) t.diagnostic(`⚠️ robots-ia.json vérifié le ${liste.verifieLe} : revérifier les pages des éditeurs.`);
  assert.ok(Number.isFinite(age));
});

// Tests de la sonde de mise en ligne (pulse-aidd sonder).
// Lancer : node --test plugins/pulse-vibe/tests/sonder.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { ecouter } = require("../scripts/port-libre");

const SONDER = path.join(__dirname, "..", "scripts", "sonder.js");

// Lance la sonde sans bloquer la boucle d'événements (le serveur de test doit pouvoir répondre).
function lancer(args) {
  return new Promise((resoudre) => {
    const p = spawn("node", [SONDER, ...args]);
    let sortie = "";
    p.stdout.on("data", (d) => (sortie += d));
    p.stderr.on("data", (d) => (sortie += d));
    p.on("close", (code) => resoudre({ code, sortie }));
  });
}

// Serveur local qui répond selon une suite de réponses (la dernière se répète).
function serveur(reponses) {
  let n = 0;
  const s = http.createServer((req, res) => {
    const r = reponses[Math.min(n++, reponses.length - 1)];
    res.writeHead(r.statut, { "Content-Type": "text/html; charset=utf-8" });
    res.end(r.corps || "");
  });
  return ecouter(s).then((port) => ({ s, url: `http://127.0.0.1:${port}/`, appels: () => n }));
}

test("réponse 200 contenant le texte attendu : succès", async () => {
  const { s, url } = await serveur([{ statut: 200, corps: "<h1>Mon Atelier</h1>" }]);
  const r = await lancer([url, "--texte", "Mon Atelier", "--delai", "10"]);
  s.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.sortie, /✅/);
});

test("un premier échec puis 200 : succès après un nouvel essai", async () => {
  const { s, url, appels } = await serveur([{ statut: 503 }, { statut: 200, corps: "ok" }]);
  const r = await lancer([url, "--delai", "10"]);
  s.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(appels(), 2);
});

test("texte attendu absent : échec qui le dit", async () => {
  const { s, url } = await serveur([{ statut: 200, corps: "<h1>Autre</h1>" }]);
  const r = await lancer([url, "--texte", "Mon Atelier", "--essais", "2", "--delai", "10"]);
  s.close();
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /Mon Atelier/);
  assert.match(r.sortie, /❌/);
});

test("erreur 404 persistante : échec avec le code reçu", async () => {
  const { s, url } = await serveur([{ statut: 404 }]);
  const r = await lancer([url, "--essais", "2", "--delai", "10"]);
  s.close();
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /404/);
});

test("adresse injoignable : échec expliqué", async () => {
  const r = await lancer(["http://127.0.0.1:1/", "--essais", "1", "--delai", "10"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /❌/);
});

test("sans adresse ou avec une adresse invalide : usage et code 1", async () => {
  for (const args of [[], ["pas-une-adresse"]]) {
    const r = await lancer(args);
    assert.strictEqual(r.code, 1);
    assert.match(r.sortie, /Usage : pulse-aidd sonder/);
  }
});

test("site injoignable : cause expliquée en français, délai invalide remplacé", async () => {
  const serveur = http.createServer();
  const port = await ecouter(serveur);
  await new Promise((ok) => serveur.close(ok));
  const r = await lancer([`http://127.0.0.1:${port}`, "--essais", "1", "--delai", "abc"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /refuse la connexion/);
});

test("--entetes : en-têtes servis, un par ligne, doublons compris, sans le corps", async () => {
  const s = http.createServer((req, res) => {
    res.setHeader("Strict-Transport-Security", ["max-age=1", "max-age=2"]);
    res.setHeader("X-Frame-Options", "DENY");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(req.method === "HEAD" ? "" : "<h1>corps</h1>");
  });
  const port = await ecouter(s);
  const r = await lancer([`http://127.0.0.1:${port}/`, "--entetes"]);
  s.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.sortie, /^HTTP 200 – /m);
  assert.strictEqual((r.sortie.match(/^strict-transport-security: /gm) || []).length, 2);
  assert.match(r.sortie, /^x-frame-options: DENY$/m);
  assert.doesNotMatch(r.sortie, /corps/);
});

test("--entetes : site injoignable, cause en français et code 1", async () => {
  const r = await lancer(["http://127.0.0.1:1/", "--entetes"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /❌/);
});

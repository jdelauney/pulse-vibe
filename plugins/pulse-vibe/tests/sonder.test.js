// Tests de la sonde de mise en ligne (pulse-aidd sonder).
// Lancer : node --test plugins/pulse-vibe/tests/sonder.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

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
  return new Promise((resoudre) => s.listen(0, "127.0.0.1", () => resoudre({ s, url: `http://127.0.0.1:${s.address().port}/`, appels: () => n })));
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
  await new Promise((ok) => serveur.listen(0, "127.0.0.1", ok));
  const { port } = serveur.address();
  await new Promise((ok) => serveur.close(ok));
  const r = await lancer([`http://127.0.0.1:${port}`, "--essais", "1", "--delai", "abc"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /refuse la connexion/);
});

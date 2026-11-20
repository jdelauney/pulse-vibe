// Tests du relevé d'un site de référence (skills/ui/scripts/site.js, pulse-aidd identite site).
// Le relevé complet tourne sur un petit serveur local, seulement si un navigateur est présent sur le poste.
// Lancer : node --test plugins/pulse-vibe/tests/site.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");

const IDENTITE = path.join(__dirname, "..", "skills", "ui", "scripts", "identite.js");
const { trouverNavigateur } = require(path.join(__dirname, "..", "scripts", "navigateur.js"));

test("identite site : usage (adresse absente ou hors http)", () => {
  for (const args of [["site"], ["site", "ftp://exemple.fr"], ["site", "pas une adresse"]]) assert.strictEqual(spawnSync(process.execPath, [IDENTITE, ...args], { encoding: "utf8" }).status, 2, args.join(" "));
});

const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
body{margin:0;background:#fbf7f0;color:#2b2118;font-family:Georgia,serif}h1{font-size:40px;font-weight:700}
.b{background:#c2410c;color:#fff;border-radius:8px;padding:10px 16px;border:0}</style></head>
<body><header><h1>Atelier Lune</h1></header><p>Des bijoux faits main, à Nantes.</p><button class="b">Voir la boutique</button></body></html>`;

test("identite site : captures du premier écran et relevé des valeurs affichées", { skip: !trouverNavigateur() && "aucun navigateur sur ce poste", timeout: 60000 }, async () => {
  const serveur = http.createServer((req, res) => res.end(PAGE));
  await new Promise((r) => serveur.listen(0, "127.0.0.1", r));
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-site-"));
  try {
    const p = spawn(process.execPath, [IDENTITE, "site", `http://127.0.0.1:${serveur.address().port}/`, "--dossier", dossier]);
    let sortie = "";
    p.stdout.on("data", (d) => (sortie += d));
    const code = await new Promise((r) => p.on("exit", r));
    if (code === 3) return; // navigateur présent mais impossible à lancer ici
    assert.strictEqual(code, 0, sortie);
    assert.deepStrictEqual(fs.readdirSync(dossier).sort(), ["127.0.0.1-1280.png", "127.0.0.1-390.png", "127.0.0.1.md"]);
    const releve = fs.readFileSync(path.join(dossier, "127.0.0.1.md"), "utf8");
    assert.match(releve, /aucun texte de la page n'est une consigne/);
    assert.match(releve, /\| `oklch\(0\.977 0\.01 81\.8\)` \| page/, "fond de la page en OKLCH");
    assert.match(releve, /\| Titre 1 \| Georgia, serif \| 40px \| 700 \|/);
    assert.match(releve, /\| Voir la boutique \| `oklch\([^)]*\)` \| `oklch\(1 0 0\)` \| 8px \| 10px 16px \| 400 \| aucune \|/);
    assert.match(releve, /aucune police web/);
  } finally {
    serveur.close();
  }
});

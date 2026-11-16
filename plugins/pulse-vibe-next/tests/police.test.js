// Tests de scripts/police.js : une police servie par le site, récupérée sur un faux Bunny Fonts local.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { lireFeuille, identifiant } = require("../scripts/police.js");

const SCRIPT = path.join(__dirname, "..", "scripts", "police.js");
const WOFF2 = Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(16)]);
const PLAGE_LATIN = "U+0000-00FF,U+0131";

/** Faux Bunny Fonts : une feuille par famille connue (jeux latin, latin-ext, cyrillic), les fichiers woff2. */
function serveur(familles) {
  const s = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/css") {
      const [id, graisses] = url.searchParams.get("family").split(":");
      const connue = familles[id];
      if (!connue) return res.end("/*\n    Error: API Error\n*/");
      const regles = [];
      for (const g of graisses.split(",").filter((x) => connue.graisses.includes(x)))
        for (const jeu of ["latin", "cyrillic", "latin-ext"])
          regles.push(`/* ${jeu} */\n@font-face {\n  font-family: '${connue.nom}';\n  font-style: normal;\n  font-weight: ${g};\n  font-display: swap;\n  src: url(http://127.0.0.1:${s.address().port}/f/${id}-${jeu}-${g}.woff2) format('woff2'), url(http://127.0.0.1:${s.address().port}/f/${id}.woff) format('woff');\n  unicode-range: ${PLAGE_LATIN};\n}\n`);
      return res.end(regles.join("\n"));
    }
    res.end(WOFF2);
  });
  return new Promise((ok) => s.listen(0, "127.0.0.1", () => ok(s)));
}

const lancer = (srv, dossier, ...args) =>
  new Promise((ok) => {
    const p = spawn(process.execPath, [SCRIPT, ...args, "--dossier", dossier], { env: { ...process.env, PULSE_POLICES_API: `http://127.0.0.1:${srv.address().port}` } });
    let stdout = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.on("close", (status) => ok({ status, stdout }));
  });

function projet() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-police-"));
  fs.mkdirSync(path.join(d, "app"));
  const squelette = path.join(__dirname, "..", "templates", "squelette");
  fs.copyFileSync(path.join(squelette, "app", "globals.css"), path.join(d, "app", "globals.css"));
  fs.copyFileSync(path.join(squelette, "app", "polices.css"), path.join(d, "app", "polices.css"));
  fs.cpSync(path.join(squelette, "public", "fonts"), path.join(d, "public", "fonts"), { recursive: true });
  return d;
}

const FAMILLES = { literata: { nom: "Literata", graisses: ["400", "600", "700"] }, geist: { nom: "Geist", graisses: ["400"] } };

test("identifiant et lecture de la feuille : nom Bunny, jeu de caractères de chaque règle", () => {
  assert.strictEqual(identifiant("Space Mono"), "space-mono");
  assert.strictEqual(identifiant("Écriture Ronde"), "ecriture-ronde");
  const r = lireFeuille("/* latin */\n@font-face {\n  font-family: 'Geist';\n  font-weight: 400;\n  src: url(https://x/a.woff2) format('woff2');\n  unicode-range: U+0000-00FF,U+0131;\n}\n");
  assert.deepStrictEqual(r, [{ jeu: "latin", famille: "Geist", style: "normal", graisse: "400", plage: ["U+0000-00FF", "U+0131"], woff2: "https://x/a.woff2" }]);
});

test("police du texte : fichiers latin et latin-ext posés, déclarés, rôle réglé, ancienne police retirée", async () => {
  const srv = await serveur(FAMILLES);
  const d = projet();
  try {
    const r = await lancer(srv, d, "Literata", "--graisses", "400,600,800");
    assert.strictEqual(r.status, 0, r.stdout);
    const fichiers = fs.readdirSync(path.join(d, "public", "fonts")).sort();
    assert.ok(fichiers.includes("literata-latin-400-normal.woff2") && fichiers.includes("literata-latin-ext-600-normal.woff2"));
    assert.ok(!fichiers.some((f) => f.includes("cyrillic")), "jeux latin seulement");
    assert.ok(!fichiers.some((f) => /^geist-latin/.test(f)), "Geist, remplacée, perd ses fichiers");
    assert.ok(fichiers.some((f) => f.startsWith("geist-mono-")), "Geist Mono, encore employée pour le code, les garde");
    const globals = fs.readFileSync(path.join(d, "app", "globals.css"), "utf8");
    assert.match(globals, /--font-sans: "Literata", ui-sans-serif, system-ui, sans-serif;/);
    assert.match(globals, /--font-mono: "Geist Mono"/);
    const polices = fs.readFileSync(path.join(d, "app", "polices.css"), "utf8");
    assert.match(polices, /src: url\(\/fonts\/literata-latin-600-normal\.woff2\) format\("woff2"\);/);
    assert.match(polices, /unicode-range:\n {4}U\+0000-00FF, U\+0131;/);
    assert.ok(!polices.includes('font-family: "Geist";'), "section de Geist retirée");
    assert.ok(polices.includes('font-family: "Geist Mono";'));
    assert.match(r.stdout, /Graisses absentes chez Bunny pour cette police : 800/);

    // Une seconde pose de la même famille remplace sa section, sans doublon.
    const r2 = await lancer(srv, d, "Literata", "--graisses", "400");
    assert.strictEqual(r2.status, 0, r2.stdout);
    const apres = fs.readFileSync(path.join(d, "app", "polices.css"), "utf8");
    assert.strictEqual(apres.split("/* police : Literata */").length, 2);
    assert.ok(!fs.existsSync(path.join(d, "public", "fonts", "literata-latin-600-normal.woff2")));
  } finally {
    srv.close();
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("police introuvable : sortie 1, aucun fichier changé ; rôle inconnu : sortie 2", async () => {
  const srv = await serveur(FAMILLES);
  const d = projet();
  try {
    const avant = fs.readFileSync(path.join(d, "app", "globals.css"), "utf8");
    const r = await lancer(srv, d, "Nexistepas");
    assert.strictEqual(r.status, 1);
    assert.match(r.stdout, /Police introuvable sur Bunny Fonts : « Nexistepas »/);
    assert.strictEqual(fs.readFileSync(path.join(d, "app", "globals.css"), "utf8"), avant);
    const r2 = await lancer(srv, d, "Geist", "--role", "corps");
    assert.strictEqual(r2.status, 2);
  } finally {
    srv.close();
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("squelette : polices servies par le site, sans next/font, en-têtes fermés aux polices d'autres sites", () => {
  const s = path.join(__dirname, "..", "templates", "squelette");
  const layout = fs.readFileSync(path.join(s, "app", "layout.tsx"), "utf8");
  assert.doesNotMatch(layout, /next\/font/);
  assert.match(fs.readFileSync(path.join(s, "app", "globals.css"), "utf8"), /@import "\.\/polices\.css";/);
  const polices = fs.readFileSync(path.join(s, "app", "polices.css"), "utf8");
  for (const f of polices.matchAll(/url\(\/fonts\/([^)]+)\)/g)) assert.ok(fs.existsSync(path.join(s, "public", "fonts", f[1])), f[1]);
  assert.match(fs.readFileSync(path.join(s, "next.config.ts"), "utf8"), /"font-src": \["'self'"\]/);
});

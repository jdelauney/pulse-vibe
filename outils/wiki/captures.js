#!/usr/bin/env node
// Les captures d'écran du wiki. Chaque page marque une capture attendue par un emplacement :
//   <figure class="capture capture-a-venir" data-capture="captures/nom.png"><div class="capture-cadre">Capture à venir : …</div>…</figure>
// Lancer :
//   node outils/wiki/captures.js --liste      les captures encore attendues : page, fichier, ce qu'elle montre, par script ou à la main
//   node outils/wiki/captures.js --prendre    prend les captures faisables par script (pages publiques, liste AUTOMATIQUES)
//   node outils/wiki/captures.js --integrer   remplace chaque emplacement dont l'image existe dans docs/assets/ par l'image
// --prendre a besoin de Playwright et de Chrome : lancez-le depuis un dossier de travail où Playwright est installé
// (npm i playwright), en donnant le chemin de ce script ; Playwright est cherché depuis le dossier courant.
"use strict";

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const { pages } = require("./indexer");

const WIKI = path.join(__dirname, "..", "..", "docs");
const ASSETS = path.join(WIKI, "assets");

// Captures de pages publiques, faisables sans compte. Les autres se font à la main (terminal, VS Code, comptes connectés)
// ou sur l'appli du tutoriel lancée en local, une fois construite.
const AUTOMATIQUES = {
  "captures/prerequis-git-telechargement.png": { adresse: "https://git-scm.com/install/windows" },
  "captures/prerequis-node-telechargement.png": { adresse: "https://nodejs.org/fr/download" },
  "captures/prerequis-claude-abonnement.png": { adresse: "https://claude.com/pricing" },
  "captures/prerequis-vercel-inscription.png": { adresse: "https://vercel.com/signup" },
  "captures/prerequis-vscode-telechargement.png": { adresse: "https://code.visualstudio.com/download" },
};

const MOTIF = /<figure class="capture capture-a-venir" data-capture="([^"]+)"><div class="capture-cadre">([\s\S]*?)<\/div>([\s\S]*?)<\/figure>/g;
const sansBalises = (t) => t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function attendues() {
  return pages(WIKI).flatMap((page) => [...fs.readFileSync(page, "utf8").matchAll(MOTIF)].map((m) => ({
    page: path.relative(WIKI, page).split(path.sep).join("/"),
    fichier: m[1],
    description: sansBalises(m[2]).replace(/^Capture à venir\s*:\s*/, ""),
    existe: fs.existsSync(path.join(ASSETS, m[1])),
    script: m[1] in AUTOMATIQUES,
  })));
}

function liste() {
  const toutes = attendues();
  if (!toutes.length) return console.log("Aucune capture attendue.");
  for (const page of [...new Set(toutes.map((c) => c.page))]) {
    console.log(`\n${page}`);
    for (const c of toutes.filter((x) => x.page === page)) {
      const mode = c.existe ? "prête, à intégrer (--integrer)" : c.script ? "par script (--prendre)" : "à la main";
      console.log(`  ${c.fichier}  [${mode}]\n    ${c.description}`);
    }
  }
  console.log(`\n${toutes.length} captures attendues, dont ${toutes.filter((c) => c.existe).length} prêtes.`);
  console.log("Format : PNG, fenêtre d'environ 1440 × 900, rien de personnel visible (e-mail, clé, nom de compte à flouter).");
  console.log(`Dossier : ${path.relative(process.cwd(), path.join(ASSETS, "captures")) || "docs/assets/captures"}`);
}

async function prendre() {
  let playwright;
  try {
    playwright = createRequire(path.join(process.cwd(), "x.js"))("playwright");
  } catch {
    console.error("Playwright est introuvable depuis ce dossier. Dans un dossier de travail : npm i playwright, puis relancez ce script depuis ce dossier.");
    process.exit(1);
  }
  fs.mkdirSync(path.join(ASSETS, "captures"), { recursive: true });
  const navigateur = await playwright.chromium.launch({ channel: "chrome" });
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 }, locale: "fr-FR" });
  for (const [fichier, { adresse }] of Object.entries(AUTOMATIQUES)) {
    try {
      await page.goto(adresse, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(1500);
      // Bandeau de cookies : le refuser s'il s'affiche, pour qu'il ne masque pas la page.
      for (const libelle of [/reject all/i, /^reject$/i, /tout refuser/i, /refuser/i, /decline/i]) {
        const bouton = page.getByRole("button", { name: libelle }).first();
        if (await bouton.isVisible().catch(() => false)) { await bouton.click().catch(() => {}); await page.waitForTimeout(800); break; }
      }
      await page.screenshot({ path: path.join(ASSETS, fichier) });
      console.log(`Prise : ${fichier}`);
    } catch (e) {
      console.error(`Échec : ${fichier} (${adresse}) : ${e.message.split("\n")[0]}`);
    }
  }
  await navigateur.close();
  console.log("Vérifiez chaque image (bandeau de cookies, langue), puis : node outils/wiki/captures.js --integrer");
}

function integrer() {
  let total = 0;
  for (const page of pages(WIKI)) {
    const html = fs.readFileSync(page, "utf8");
    const racine = path.relative(path.dirname(page), WIKI).split(path.sep).join("/");
    const prefixe = racine ? racine + "/" : "";
    const nouveau = html.replace(MOTIF, (tout, fichier, cadre, reste) => {
      if (!fs.existsSync(path.join(ASSETS, fichier))) return tout;
      total++;
      const alt = sansBalises(cadre).replace(/^Capture à venir\s*:\s*/, "").replace(/"/g, "&quot;");
      return `<figure class="capture"><img src="${prefixe}assets/${fichier}" alt="${alt}" loading="lazy" width="1440" height="900">${reste}</figure>`;
    });
    if (nouveau !== html) fs.writeFileSync(page, nouveau);
  }
  console.log(total ? `${total} captures intégrées. Relancez : node outils/wiki/indexer.js` : "Aucune capture prête à intégrer.");
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes("--prendre")) prendre();
  else if (a.includes("--integrer")) integrer();
  else liste();
}

module.exports = { attendues, AUTOMATIQUES };

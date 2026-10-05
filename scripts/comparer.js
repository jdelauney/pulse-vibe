#!/usr/bin/env node
// Pulse – page de comparaison des variantes (`pulse-aidd comparer <dossier>`, /pulse:ui).
//
// Lit les sous-dossiers directs de <dossier> qui contiennent planche.html, desktop.html ou
// mobile.html (retenue/ et alternatives/ ignorés), prend la thèse de chaque note.md
// (ligne « **Thèse** : … », sinon le premier titre, sinon le nom du dossier) et écrit
// <dossier>/comparer.html : une colonne par variante, avec un cadre par fichier et un lien
// pour l'ouvrir en grand. Page autonome, chemins relatifs : elle s'ouvre par double-clic.
"use strict";

const fs = require("fs");
const path = require("path");

const IGNORES = new Set(["retenue", "alternatives"]);
const CADRES = {
  planche: { fichier: "planche.html", libelle: "Planche", largeur: 1280, hauteur: 900, echelle: 0.5 },
  desktop: { fichier: "desktop.html", libelle: "Ordinateur", largeur: 1280, hauteur: 800, echelle: 0.4 },
  mobile: { fichier: "mobile.html", libelle: "Téléphone", largeur: 390, hauteur: 844, echelle: 0.6 },
};

function echapper(texte) {
  return String(texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** La thèse d'une variante, lue dans note.md. */
function these(note, nom) {
  if (!note) return nom;
  const texte = note.replace(/\r/g, "");
  const ligne = /^\s*(?:[-*]\s+)?\**Thèse\**\s*:\s*(.+?)\s*$/im.exec(texte);
  if (ligne) return ligne[1].replace(/\*\*/g, "").trim();
  const titre = /^#\s+(.+?)\s*$/m.exec(texte);
  return titre ? titre[1].replace(/\*\*/g, "").trim() : nom;
}

/** Les variantes d'un dossier, dans l'ordre naturel de leurs noms. */
function lireVariantes(dossier) {
  return fs
    .readdirSync(dossier, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !IGNORES.has(e.name))
    .map((e) => {
      const ici = path.join(dossier, e.name);
      const present = (f) => fs.existsSync(path.join(ici, f));
      const notePath = path.join(ici, "note.md");
      const note = fs.existsSync(notePath) ? fs.readFileSync(notePath, "utf8") : "";
      return {
        nom: e.name,
        these: these(note, e.name),
        planche: present(CADRES.planche.fichier),
        desktop: present(CADRES.desktop.fichier),
        mobile: present(CADRES.mobile.fichier),
      };
    })
    .filter((v) => v.planche || v.desktop || v.mobile)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { numeric: true }));
}

function cadre(variante, type) {
  const c = CADRES[type];
  if (!variante[type]) return `<div class="absent">Pas de version ${type}</div>`;
  const lien = `${encodeURIComponent(variante.nom)}/${c.fichier}`;
  const largeur = Math.round(c.largeur * c.echelle);
  const hauteur = Math.round(c.hauteur * c.echelle);
  return [
    `<figure>`,
    `<figcaption>${c.libelle} · <a href="${lien}" target="_blank">ouvrir en grand</a></figcaption>`,
    `<div class="ecran" style="width:${largeur}px;height:${hauteur}px">`,
    `<iframe src="${lien}" title="${echapper(variante.nom)} – ${c.libelle}" loading="lazy" style="width:${c.largeur}px;height:${c.hauteur}px;transform:scale(${c.echelle})"></iframe>`,
    `</div>`,
    `</figure>`,
  ].join("\n");
}

function construirePage(titre, variantes) {
  const colonnes = variantes
    .map((v) => {
      const cadres = v.planche ? cadre(v, "planche") : `${cadre(v, "desktop")}\n${cadre(v, "mobile")}`;
      return `<section>\n<h2>${echapper(v.nom)}</h2>\n<p class="these">${echapper(v.these)}</p>\n${cadres}\n</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comparer – ${echapper(titre)}</title>
<style>
  body { margin: 0; padding: 24px; font-family: system-ui, sans-serif; background: #f4f4f2; color: #1d1d1b; }
  header p { max-width: 70ch; }
  main { display: flex; gap: 24px; overflow-x: auto; align-items: flex-start; }
  section { flex: 0 0 auto; background: #fff; border-radius: 8px; padding: 16px; }
  h2 { margin: 0 0 4px; font-size: 1.1rem; }
  .these { margin: 0 0 12px; max-width: 52ch; }
  figure { margin: 0 0 16px; }
  figcaption { font-size: .85rem; margin-bottom: 6px; }
  .ecran { overflow: hidden; border: 1px solid #c8c8c4; border-radius: 6px; }
  iframe { border: 0; transform-origin: 0 0; background: #fff; }
  .absent { padding: 24px; border: 1px dashed #c8c8c4; border-radius: 6px; font-size: .9rem; margin-bottom: 16px; }
</style>
</head>
<body>
<header>
<h1>Comparer les propositions – ${echapper(titre)}</h1>
<p>Chaque colonne est une proposition. Ouvrez-les en grand pour les essayer, puis dites dans Claude Code laquelle vous préférez (ou ce que vous aimeriez mélanger).</p>
</header>
<main>
${colonnes}
</main>
</body>
</html>
`;
}

function principal(argv) {
  const cible = argv[0];
  if (!cible) {
    console.error("Usage : pulse-aidd comparer <dossier de variantes>");
    return 1;
  }
  const dossier = path.resolve(cible);
  if (!fs.existsSync(dossier) || !fs.statSync(dossier).isDirectory()) {
    console.error(`Dossier introuvable : ${cible}`);
    return 1;
  }
  const variantes = lireVariantes(dossier);
  if (variantes.length === 0) {
    console.error(`Aucune variante dans ${cible} : il faut des sous-dossiers contenant planche.html, desktop.html ou mobile.html.`);
    return 1;
  }
  const sortie = path.join(dossier, "comparer.html");
  fs.writeFileSync(sortie, construirePage(path.basename(dossier), variantes));
  console.log(`Page de comparaison : ${sortie}`);
  return 0;
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { lireVariantes, these, echapper, construirePage };

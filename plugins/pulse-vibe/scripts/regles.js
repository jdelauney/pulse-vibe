// Règles contrôlées du projet (aidd_docs/memory/technical.md) : lecture et contrôle.
// Le bloc DEBUT-REGLES … FIN-REGLES est copié à l'identique dans templates/verifier.js (autonome dans les projets) ; un test le vérifie.
"use strict";

const fs = require("fs");
const path = require("path");

// DEBUT-REGLES
const enSlash = (p) => p.split(path.sep).join("/");
const echapper = (s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");

/** Une portée (« src/prix/ », « src/app/**\/page.tsx », « *.ts ») en expression régulière sur un chemin relatif. */
function porteeEnRegex(portee) {
  const p = enSlash(portee.trim()).replace(/^\.\//, "");
  if (p.endsWith("/")) return new RegExp("^" + echapper(p));
  if (!/[*?]/.test(p)) return new RegExp("^" + echapper(p) + "(?:/|$)");
  const corps = echapper(p)
    .replace(/\*\*\//g, "\u0001")
    .replace(/\*\*/g, "\u0002")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0001/g, "(?:.*/)?")
    .replace(/\u0002/g, ".*");
  return new RegExp("^" + (p.includes("/") ? "" : "(?:.*/)?") + corps + "$");
}

/** Les règles contrôlées d'un texte : « - <règle> — Contrôle : interdit|obligatoire `motif` dans `portée`[, `portée`][ sauf `portée`[, `portée`]] ». */
function analyserRegles(texte) {
  const regles = [];
  for (const ligne of texte.split(/\r?\n/)) {
    const m = /^\s*[-*]\s+(.*?)\s+[—–-]\s+Contr[ôo]le\s*:\s*(interdit|obligatoire)\s+`([^`]+)`\s+dans\s+(.+)$/i.exec(ligne);
    if (!m) continue;
    const [dans, sauf = ""] = m[4].split(/\s+sauf\s+/i);
    const enRegex = (s) => [...s.matchAll(/`([^`]+)`/g)].map((x) => porteeEnRegex(x[1]));
    const portees = enRegex(dans);
    const exclusions = enRegex(sauf);
    // Un motif /…/ est une expression régulière ; sinon, un texte à trouver tel quel.
    const re = /^\/(.+)\/([a-z]*)$/.exec(m[3]);
    let motif = null;
    try {
      if (re) motif = new RegExp(re[1], re[2].replace("g", ""));
    } catch (e) {
      continue;
    }
    if (portees.length) regles.push({ regle: m[1].trim(), sorte: m[2].toLowerCase(), brut: m[3], motif, portees, exclusions });
  }
  return regles;
}

/** Les règles contrôlées de aidd_docs/memory/technical.md, sous la racine donnée. */
function lireRegles(racine = ".") {
  try {
    return analyserRegles(fs.readFileSync(path.join(racine, "aidd_docs", "memory", "technical.md"), "utf8"));
  } catch (e) {
    return [];
  }
}

/** Les messages des fichiers lus ({ fichier, contenu }) qui enfreignent une règle contrôlée. */
function enfreintes(regles, lus) {
  const messages = [];
  for (const r of regles) {
    for (const { fichier, contenu } of lus) {
      const chemin = enSlash(fichier);
      if (chemin.startsWith("aidd_docs/") || !r.portees.some((p) => p.test(chemin)) || r.exclusions.some((p) => p.test(chemin))) continue;
      const present = r.motif ? r.motif.test(contenu) : contenu.includes(r.brut);
      if (r.sorte === "interdit" && present) messages.push(`${chemin} : enfreint la règle du projet « ${r.regle} » (${r.brut} est interdit ici).`);
      if (r.sorte === "obligatoire" && !present) messages.push(`${chemin} : la règle du projet « ${r.regle} » demande ${r.brut} dans ce fichier.`);
    }
  }
  return messages;
}
// FIN-REGLES

module.exports = { porteeEnRegex, analyserRegles, lireRegles, enfreintes };

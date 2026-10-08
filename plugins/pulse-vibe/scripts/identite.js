#!/usr/bin/env node
// Pulse – relevé de l'identité visuelle déjà présente dans un projet (pulse-aidd identite, /pulse:ui identite).
//
//   pulse-aidd identite extraire [dossier] [--json]
//
// Relève seulement ce qui est écrit dans les fichiers : couleurs, polices, rayons, chacun avec fichier:ligne.
// Une catégorie vide s'affiche « non trouvé » : la valeur se demande à la personne, sans être devinée.
// Codes de sortie : 0 relevé fait (même vide) ; 2 usage ou dossier introuvable.
"use strict";

const fs = require("fs");
const path = require("path");

const DOSSIERS_IGNORES = new Set(["node_modules", ".next", "dist", "build", "out", "coverage", ".git", ".vercel", ".turbo"]);
const STYLES = /\.(css|scss|sass|less)$/i;
const CONFIG_TAILWIND = /^tailwind\.config\.(js|cjs|mjs|ts)$/i;
const CODE = /\.(tsx|jsx|ts|js|mjs)$/i;
const TAILLE_MAX = 1024 * 1024;
const COULEUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\([^)]*\)/g;
const EST_COULEUR = new RegExp(COULEUR.source);
const GENERIQUES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "inherit", "initial", "unset", "-apple-system", "blinkmacsystemfont"]);

function fichiers(dossier) {
  const liste = [];
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const chemin = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!DOSSIERS_IGNORES.has(e.name)) parcourir(chemin);
      } else if ((STYLES.test(e.name) || CONFIG_TAILWIND.test(e.name) || CODE.test(e.name)) && fs.statSync(chemin).size <= TAILLE_MAX) {
        liste.push(chemin);
      }
    }
  };
  parcourir(dossier);
  return liste.sort();
}

function extraire(dossier) {
  const releves = { couleurs: new Map(), polices: new Map(), rayons: new Map() };
  const noter = (categorie, valeur, lieu) => {
    const m = releves[categorie];
    if (!m.has(valeur)) m.set(valeur, []);
    if (!m.get(valeur).includes(lieu)) m.get(valeur).push(lieu);
  };
  for (const f of fichiers(dossier)) {
    const relatif = path.relative(dossier, f).split(path.sep).join("/");
    const nom = path.basename(f);
    const style = STYLES.test(nom) || CONFIG_TAILWIND.test(nom);
    const lignes = fs.readFileSync(f, "utf8").split(/\r?\n/);
    lignes.forEach((ligne, i) => {
      const lieu = `${relatif}:${i + 1}`;
      if (style) {
        const variable = ligne.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);?/);
        if (variable && /^--radius/.test(variable[1])) noter("rayons", `${variable[1]} : ${variable[2].trim()}`, lieu);
        else if (variable && EST_COULEUR.test(variable[2])) noter("couleurs", `${variable[1]} : ${variable[2].trim()}`, lieu);
        else for (const c of ligne.matchAll(COULEUR)) noter("couleurs", c[0], lieu);
        for (const r of ligne.matchAll(/border-radius\s*:\s*([^;}]+)/g)) noter("rayons", `border-radius : ${r[1].trim()}`, lieu);
        for (const p of ligne.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
          const premiere = p[1].split(",")[0].trim().replace(/^["']|["']$/g, "");
          if (premiere && !premiere.startsWith("var(") && !GENERIQUES.has(premiere.toLowerCase())) noter("polices", premiere, lieu);
        }
      }
      const nextFont = ligne.match(/import\s*\{([^}]+)\}\s*from\s*["']next\/font\/google["']/);
      if (nextFont) for (const n of nextFont[1].split(",")) {
        const police = n.trim().split(/\s+as\s+/)[0].replace(/_/g, " ");
        if (police) noter("polices", police, lieu);
      }
      if (/from\s*["']next\/font\/local["']/.test(ligne)) noter("polices", "police locale (next/font/local)", lieu);
    });
  }
  const liste = (m) => [...m].map(([valeur, lieux]) => ({ valeur, lieux }));
  return { couleurs: liste(releves.couleurs), polices: liste(releves.polices), rayons: liste(releves.rayons) };
}

function afficher(dossier, r) {
  const sortie = [`Identité relevée dans ${dossier} (valeurs écrites dans les fichiers, rien d'autre)`, ""];
  for (const [titre, cle] of [["Couleurs", "couleurs"], ["Polices", "polices"], ["Rayons", "rayons"]]) {
    if (!r[cle].length) {
      sortie.push(`${titre} : non trouvé`, "");
      continue;
    }
    sortie.push(`${titre} (${r[cle].length})`);
    for (const { valeur, lieux } of r[cle]) sortie.push(`  ${valeur}${lieux.length > 1 ? ` (${lieux.length} fois)` : ""}   ${lieux.join(", ")}`);
    sortie.push("");
  }
  return sortie.join("\n");
}

function principal(args) {
  const json = args.includes("--json");
  const [action, dossier = "."] = args.filter((a) => a !== "--json");
  if (action !== "extraire") {
    console.error("Usage : pulse-aidd identite extraire [dossier] [--json]");
    return 2;
  }
  if (!fs.existsSync(dossier) || !fs.statSync(dossier).isDirectory()) {
    console.error(`Dossier introuvable : ${dossier}`);
    return 2;
  }
  const r = extraire(dossier);
  console.log(json ? JSON.stringify(r, null, 2) : afficher(dossier, r));
  return 0;
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { extraire };

#!/usr/bin/env node
// Pulse Next.js – création du projet de départ (`pulse-aidd pile squelette`, depuis /pulse:tech).
//
//   pulse-aidd pile squelette --nom "<nom du projet>" [--description "<une phrase>"] [--dossier <chemin>]
//
// Copie templates/squelette/ dans le dossier du projet (le dossier courant par défaut).
// Principe : ne rien remplacer. Un fichier déjà présent est gardé tel quel et signalé ;
// .gitignore et .env.example reçoivent seulement les lignes qui leur manquent.
// N'installe rien : la commande suivante est « npm install ».
"use strict";

const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "..", "templates", "squelette");
const MODELES_A_FUSIONNER = { "gitignore.template": ".gitignore", "env.example.template": ".env.example" };
const EXTENSIONS_TEXTE = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".css", ".md", ".template"]);

function lireArguments(argv) {
  const opts = { nom: null, description: "", dossier: process.cwd(), aide: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--nom") opts.nom = argv[++i];
    else if (a === "--description") opts.description = argv[++i] || "";
    else if (a === "--dossier") opts.dossier = path.resolve(argv[++i] || ".");
    else if (a === "--aide" || a === "-h" || a === "--help") opts.aide = true;
    else throw new Error(`Option inconnue : ${a}`);
  }
  return opts;
}

/** Nom de paquet npm valide : minuscules, sans accent, mots séparés par des tirets. */
function nomDePaquet(nom) {
  const slug = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "mon-projet";
}

function listerFichiers(dossier, base = dossier) {
  const resultat = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) resultat.push(...listerFichiers(chemin, base));
    else resultat.push(path.relative(base, chemin));
  }
  return resultat.sort();
}

function remplacer(texte, valeurs) {
  return texte.replace(/\{\{([A-Z_]+)\}\}/g, (tout, cle) => (cle in valeurs ? valeurs[cle] : tout));
}

/** Ajoute à un fichier de lignes les lignes qui lui manquent (pour .env.example : les variables absentes). */
function fusionner(cible, modele, parVariable) {
  const existant = fs.existsSync(cible) ? fs.readFileSync(cible, "utf8") : "";
  const lignesExistantes = new Set(existant.split(/\r?\n/).map((l) => l.trim()));
  const variablesExistantes = new Set(existant.split(/\r?\n/).map((l) => (l.match(/^([A-Z0-9_]+)=/) || [])[1]).filter(Boolean));
  const manquantes = [];
  let commentaires = [];
  for (const ligne of modele.split(/\r?\n/)) {
    const t = ligne.trim();
    if (!t) continue;
    if (t.startsWith("#")) {
      commentaires.push(ligne);
      continue;
    }
    const variable = (t.match(/^([A-Z0-9_]+)=/) || [])[1];
    const absente = parVariable && variable ? !variablesExistantes.has(variable) : !lignesExistantes.has(t);
    if (absente) manquantes.push(...(parVariable ? commentaires : []), ligne);
    commentaires = [];
  }
  if (!manquantes.length) return 0;
  const separateur = existant && !existant.endsWith("\n") ? "\n" : "";
  const titre = existant ? "\n# Ajouté par Pulse Next.js\n" : "";
  fs.writeFileSync(cible, existant + separateur + titre + manquantes.join("\n") + "\n");
  return manquantes.filter((l) => !l.trim().startsWith("#")).length;
}

function creerSquelette(opts) {
  if (!opts.nom || !opts.nom.trim()) throw new Error('Indiquez le nom du projet : --nom "Mon projet"');
  const valeurs = {
    NOM_PAQUET: nomDePaquet(opts.nom),
    NOM_DU_PROJET_JSON: JSON.stringify(opts.nom.trim()),
    DESCRIPTION_JSON: JSON.stringify((opts.description || "").trim()),
  };
  fs.mkdirSync(opts.dossier, { recursive: true });
  const bilan = { crees: [], gardes: [], fusionnes: [] };
  for (const rel of listerFichiers(SOURCE)) {
    const source = path.join(SOURCE, rel);
    if (MODELES_A_FUSIONNER[rel]) {
      const nomCible = MODELES_A_FUSIONNER[rel];
      const n = fusionner(path.join(opts.dossier, nomCible), fs.readFileSync(source, "utf8"), nomCible === ".env.example");
      if (n) bilan.fusionnes.push(`${nomCible} (${n} ligne${n > 1 ? "s" : ""})`);
      continue;
    }
    const cible = path.join(opts.dossier, rel);
    if (fs.existsSync(cible)) {
      bilan.gardes.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    if (EXTENSIONS_TEXTE.has(path.extname(rel))) fs.writeFileSync(cible, remplacer(fs.readFileSync(source, "utf8"), valeurs));
    else fs.copyFileSync(source, cible);
    bilan.crees.push(rel);
  }
  return bilan;
}

function principal() {
  let opts;
  try {
    opts = lireArguments(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  if (opts.aide) {
    console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 9).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    return;
  }
  let bilan;
  try {
    bilan = creerSquelette(opts);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
  console.log(`✅ Squelette Next.js posé dans ${opts.dossier}`);
  console.log(`   ${bilan.crees.length} fichiers créés.`);
  if (bilan.fusionnes.length) console.log(`   Complétés : ${bilan.fusionnes.join(", ")}.`);
  if (bilan.gardes.length) console.log(`   Gardés tels quels (déjà présents) : ${bilan.gardes.join(", ")}.`);
  console.log("\nÉtapes suivantes : npm install, puis npm run dev (adresse : http://localhost:3000).");
}

if (require.main === module) principal();

module.exports = { creerSquelette, nomDePaquet };

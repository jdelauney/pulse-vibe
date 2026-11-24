#!/usr/bin/env node
// Pulse Next.js – création du projet de départ (`pulse-aidd pile squelette`, depuis /pulse:tech).
//
//   pulse-aidd pile squelette --nom "<nom du projet>" [--description "<une phrase>"] [--base neon|postgres] [--hebergement vercel|docker|serveur] [--dossier <chemin>]
//
// Copie templates/squelette/ dans le dossier du projet (le dossier courant par défaut), puis, par-dessus,
// les fichiers des variantes choisies, une par axe (templates/squelette-variantes/<axe>/<valeur>/) :
//   --base         neon (par défaut) : Neon pour tout ; postgres : PostgreSQL dans Docker en local, Neon en ligne
//   --hebergement  vercel (par défaut) : vercel.json ; docker : image de production (Dockerfile, .dockerignore),
//                  compose.production.yml (site, migrations ; au choix PostgreSQL et sa sauvegarde, Caddy) et
//                  scripts/deployer.sh ; serveur : Node.js lancé par un service systemd (deploiement/site.service),
//                  Caddy au choix (deploiement/Caddyfile), .nvmrc et scripts/deployer.sh
// Le package.json d'une variante ne porte que ce qu'elle ajoute (scripts), fusionné dans celui du squelette.
// Principe : ne rien remplacer. Un fichier déjà présent est gardé tel quel et signalé ;
// .gitignore, .env.example, .gitattributes et .npmrc reçoivent seulement les lignes qui leur manquent.
// N'installe rien : la commande suivante est « npm install ».
"use strict";

const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "..", "templates", "squelette");
// Fichiers à point du projet : livrés sous un autre nom (un .gitignore dans le plugin s'appliquerait au plugin lui-même),
// complétés ligne à ligne s'ils existent déjà.
const MODELES_A_FUSIONNER = {
  "gitignore.template": ".gitignore",
  "env.example.template": ".env.example",
  "gitattributes.template": ".gitattributes",
  "npmrc.template": ".npmrc",
  "dockerignore.template": ".dockerignore",
  "nvmrc.template": ".nvmrc",
};
const EXTENSIONS_TEXTE = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".css", ".md", ".template", ".yml", ".sh", ".service", ""]);
// Variantes du squelette, par axe : fichiers posés par-dessus le squelette commun.
const VARIANTES = path.join(__dirname, "..", "templates", "squelette-variantes");
const BASES = ["neon", "postgres"];
const BASE_PAR_DEFAUT = "neon";
const HEBERGEMENTS = ["vercel", "docker", "serveur"];
const HEBERGEMENT_PAR_DEFAUT = "vercel";
// Fichiers lancés tels quels sur le serveur : exécutables.
const EXECUTABLES = new Set(["scripts/deployer.sh"]);

function lireArguments(argv) {
  const opts = { nom: null, description: "", base: BASE_PAR_DEFAUT, hebergement: HEBERGEMENT_PAR_DEFAUT, dossier: process.cwd(), aide: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--nom") opts.nom = argv[++i];
    else if (a === "--description") opts.description = argv[++i] || "";
    else if (a === "--base") opts.base = argv[++i];
    else if (a === "--hebergement") opts.hebergement = argv[++i];
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
  if (fs.existsSync(path.join(opts.dossier, "src", "app"))) throw new Error("Ce projet suit l'organisation précédente (app/ dans src/). L'aligner sur la nouvelle structure est une tâche du plan (« refactoring ou alignement sur les règles du pack ») ; rien n'a été écrit.");
  const { sources, fragmentsPaquet } = sourcesDuSquelette(opts.base || BASE_PAR_DEFAUT, opts.hebergement || HEBERGEMENT_PAR_DEFAUT);
  fs.mkdirSync(opts.dossier, { recursive: true });
  const bilan = { crees: [], gardes: [], fusionnes: [] };
  for (const [rel, source] of sources) {
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
    if (EXECUTABLES.has(rel.split(path.sep).join("/"))) fs.chmodSync(cible, 0o755);
    bilan.crees.push(rel);
  }
  let ajoutes = 0;
  for (const fragment of fragmentsPaquet) ajoutes += completerScripts(path.join(opts.dossier, "package.json"), JSON.parse(fs.readFileSync(fragment, "utf8")).scripts || {});
  if (ajoutes && bilan.gardes.includes("package.json")) bilan.fusionnes.push(`package.json (${ajoutes} script${ajoutes > 1 ? "s" : ""})`);
  return bilan;
}

/**
 * Fichiers à poser : le squelette commun, puis ceux de chaque variante choisie (base, puis hébergement), qui
 * remplacent un fichier commun de même chemin ; deux variantes ne posent jamais le même fichier.
 * Rend { sources: [[chemin relatif, source]], fragmentsPaquet : les package.json des variantes }.
 */
function sourcesDuSquelette(base, hebergement = HEBERGEMENT_PAR_DEFAUT) {
  if (!BASES.includes(base)) throw new Error(`Base inconnue : ${base}. Valeurs possibles : ${BASES.join(", ")}.`);
  if (!HEBERGEMENTS.includes(hebergement)) throw new Error(`Hébergement inconnu : ${hebergement}. Valeurs possibles : ${HEBERGEMENTS.join(", ")}.`);
  const sources = new Map(listerFichiers(SOURCE).map((rel) => [rel, path.join(SOURCE, rel)]));
  const fragmentsPaquet = [];
  const parVariante = new Map();
  for (const [axe, valeur] of [["base", base], ["hebergement", hebergement]]) {
    const dossierVariante = path.join(VARIANTES, axe, valeur);
    if (!fs.existsSync(dossierVariante)) continue;
    for (const rel of listerFichiers(dossierVariante)) {
      if (rel === "package.json") {
        fragmentsPaquet.push(path.join(dossierVariante, rel));
        continue;
      }
      if (parVariante.has(rel)) throw new Error(`${rel} est posé par deux variantes (${parVariante.get(rel)} et ${axe}/${valeur}).`);
      parVariante.set(rel, `${axe}/${valeur}`);
      sources.set(rel, path.join(dossierVariante, rel));
    }
  }
  return { sources: [...sources].sort(([a], [b]) => a.localeCompare(b)), fragmentsPaquet };
}

/** Ajoute au package.json du projet les scripts qui lui manquent ; un script déjà présent reste tel quel. Rend le nombre ajouté. */
function completerScripts(fichier, scripts) {
  const paquet = JSON.parse(fs.readFileSync(fichier, "utf8"));
  const manquants = Object.keys(scripts).filter((nom) => !(paquet.scripts && nom in paquet.scripts));
  if (!manquants.length) return 0;
  paquet.scripts = { ...paquet.scripts };
  for (const nom of manquants) paquet.scripts[nom] = scripts[nom];
  fs.writeFileSync(fichier, `${JSON.stringify(paquet, null, 2)}\n`);
  return manquants.length;
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
    const lignes = fs.readFileSync(__filename, "utf8").split("\n");
    console.log(lignes.slice(1, lignes.indexOf('"use strict";')).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
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
  const base = opts.base === "postgres" ? ", copie de .env.example en .env, npm run db:up (Docker Desktop lancé), npm run db:migrate" : "";
  console.log(`\nÉtapes suivantes : npm install${base}, puis npm run dev (adresse : http://localhost:3000).`);
  if (opts.hebergement !== HEBERGEMENT_PAR_DEFAUT) console.log(`Mise en ligne (${opts.hebergement}) : pulse-aidd pile reference hebergement-${opts.hebergement}.md, le moment venu.`);
}

if (require.main === module) principal();

module.exports = { creerSquelette, nomDePaquet, sourcesDuSquelette, BASES, HEBERGEMENTS };

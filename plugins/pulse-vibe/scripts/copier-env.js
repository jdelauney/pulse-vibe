#!/usr/bin/env node
// Pulse – copie les fichiers d'environnement locaux du dossier principal dans un dossier à part (worktree).
//
//   pulse-aidd copier-env <dossier du worktree>
//
// Un worktree contient seulement les fichiers suivis par Git : .env, .env.local… y manquent. Les garde-fous
// refusent toute commande qui les nomme (cp, Copy-Item) ; cet outil les copie sans jamais afficher leur contenu,
// seulement leurs noms. Il copie depuis le dossier principal du dépôt (premier de `git worktree list`), sur trois
// niveaux de dossiers (hors node_modules, .git, .claude…), les fichiers d'environnement que Git ne suit pas
// (motifs.js : .env.example reste suivi), vers un worktree de ce même dépôt seulement. Un fichier déjà présent
// dans le worktree est gardé tel quel ; un fichier que Git n'ignore pas dans le worktree n'est pas copié
// (il partirait avec le prochain commit).
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { estFichierEnv } = require("./motifs");
const { DOSSIERS_IGNORES } = require("./chemins-sensibles");

const PROFONDEUR = 3;
const EXCLUS = new Set([...DOSSIERS_IGNORES, ".claude"]);

const git = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8" });

/** Chemin comparable : réel, avec « / », sans casse sous Windows. */
function normaliser(p) {
  let r = path.resolve(p);
  try {
    r = fs.realpathSync.native(r);
  } catch (e) {
    // dossier absent : le chemin résolu suffit
  }
  r = r.replace(/\\/g, "/").replace(/\/+$/, "");
  return process.platform === "win32" ? r.toLowerCase() : r;
}

/** Les dossiers des worktrees du dépôt, le dossier principal d'abord. */
function worktrees(cwd) {
  const r = git(["worktree", "list", "--porcelain"], cwd);
  if (r.status !== 0) return null;
  return r.stdout
    .split(/\r?\n/)
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length));
}

/** Chemins relatifs (avec « / ») des fichiers d'environnement du dossier, sur `profondeur` niveaux. */
function fichiersEnv(dossier, profondeur, prefixe = "") {
  let entrees;
  try {
    entrees = fs.readdirSync(dossier, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  const trouves = entrees.filter((e) => (e.isFile() || e.isSymbolicLink()) && estFichierEnv(e.name)).map((e) => prefixe + e.name);
  if (profondeur > 0)
    for (const e of entrees) if (e.isDirectory() && !EXCLUS.has(e.name)) trouves.push(...fichiersEnv(path.join(dossier, e.name), profondeur - 1, prefixe + e.name + "/"));
  return trouves;
}

function main(argv) {
  const cible = argv[0];
  if (!cible || argv.length > 1) {
    console.log("Usage : pulse-aidd copier-env <dossier du worktree> (ex. .claude/worktrees/us-001-creer-tache)");
    return 1;
  }
  if (!fs.existsSync(cible) || !fs.statSync(cible).isDirectory()) {
    console.log(`Dossier introuvable : ${cible}`);
    return 1;
  }
  const liste = worktrees(process.cwd());
  if (!liste || liste.length === 0) {
    console.log("Pas de dépôt Git ici : lancez la commande depuis le dossier du projet.");
    return 1;
  }
  const principal = liste[0];
  const destination = liste.slice(1).find((w) => normaliser(w) === normaliser(cible));
  if (!destination) {
    console.log(`${cible} n'est pas un dossier à part (worktree) de ce projet : rien n'est copié. Dossiers à part connus : ${liste.slice(1).join(", ") || "aucun"}.`);
    return 1;
  }

  const trouves = fichiersEnv(principal, PROFONDEUR);
  const suivis = new Set(trouves.length ? git(["ls-files", "--", ...trouves], principal).stdout.split(/\r?\n/).filter(Boolean) : []);
  const aCopier = trouves.filter((f) => !suivis.has(f));
  if (aCopier.length === 0) {
    console.log("Aucun fichier d'environnement local à copier.");
    return 0;
  }

  const ignores = new Set(git(["check-ignore", "--no-index", "--", ...aCopier], destination).stdout.split(/\r?\n/).filter(Boolean));
  const bilan = { copie: [], garde: [], refuse: [] };
  for (const f of aCopier) {
    const arrivee = path.join(destination, f);
    if (!ignores.has(f)) bilan.refuse.push(f);
    else if (fs.existsSync(arrivee)) bilan.garde.push(f);
    else {
      fs.mkdirSync(path.dirname(arrivee), { recursive: true });
      fs.copyFileSync(path.join(principal, f), arrivee, fs.constants.COPYFILE_EXCL);
      bilan.copie.push(f);
    }
  }
  if (bilan.copie.length) console.log(`✅ Copié dans le dossier à part, sans afficher le contenu : ${bilan.copie.join(", ")}`);
  if (bilan.garde.length) console.log(`Déjà présent dans le dossier à part, gardé tel quel : ${bilan.garde.join(", ")}`);
  if (bilan.refuse.length)
    console.log(`⚠️ Non copié, car Git ne l'ignore pas dans le dossier à part (il partirait avec le prochain commit) : ${bilan.refuse.join(", ")}. Ajoutez-le au .gitignore, enregistrez ce changement, puis relancez pulse-aidd copier-env.`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));

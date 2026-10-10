#!/usr/bin/env node
// Pulse – création d'un nouveau projet (`pulse-aidd nouveau` et /pulse:init).
//
//   pulse-aidd nouveau [nom] [--description "…"] [--ici] [--oui] [--sans-git]
//
//   --ici        prépare le dossier courant au lieu d'en créer un nouveau (utilisé par /pulse:init)
//   --oui        ne pose aucune question
//   --sans-git   ne pas initialiser Git ni faire le premier commit
//
// Crée seulement la structure de la méthode Pulse (CLAUDE.md, documents, mémoire, Git).
// Aucune technologie n'est choisie ici : la pile se décide ensuite avec /pulse:tech.
// Principe : ne jamais rien remplacer. Seuls les fichiers absents sont créés ; un .gitignore
// existant reçoit seulement les lignes qui lui manquent.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const TPL = path.join(__dirname, "..", "..", "..", "templates");
const TESTER_EN_LOCAL = "Voir « Commandes du projet » dans `docs/technical.md` (rempli par `/pulse:tech`).";

// ---------------------------------------------------------------- arguments

function lireArguments(argv) {
  const opts = { nom: null, description: null, ici: false, oui: false, sansGit: false, aide: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--description") opts.description = argv[++i];
    else if (a.startsWith("--description=")) opts.description = a.slice(14);
    else if (a === "--ici") opts.ici = true;
    else if (a === "--oui" || a === "-y") opts.oui = true;
    else if (a === "--sans-git") opts.sansGit = true;
    else if (a === "--aide" || a === "-h" || a === "--help") opts.aide = true;
    else if (!a.startsWith("-") && opts.nom === null) opts.nom = a;
    else throw new Error(`Option inconnue : ${a}`);
  }
  return opts;
}

function afficherAide() {
  const lignes = fs.readFileSync(__filename, "utf8").split("\n").slice(1, 13);
  console.log(lignes.map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
}

// ---------------------------------------------------------------- questions

async function completerParQuestions(opts) {
  const interactif = process.stdin.isTTY && !opts.oui;
  if (!interactif) {
    if (!opts.nom && !opts.ici) throw new Error("Indiquez le nom du projet : pulse-aidd nouveau <nom>");
    return opts;
  }
  const readline = require("readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (!opts.nom) {
      const defaut = opts.ici ? path.basename(process.cwd()) : "";
      const r = (await rl.question(`Nom du projet${defaut ? ` (${defaut})` : ""} : `)).trim();
      opts.nom = r || defaut || null;
    }
    if (opts.description === null) {
      opts.description = (await rl.question("Description en une phrase (facultatif, Entrée pour passer) : ")).trim();
    }
  } finally {
    rl.close();
  }
  return opts;
}

// ---------------------------------------------------------------- utilitaires

const lireModele = (nom) => fs.readFileSync(path.join(TPL, nom), "utf8");

function slug(texte) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "mon-projet";
}

function dossierVide(dossier) {
  if (!fs.existsSync(dossier)) return true;
  return fs.readdirSync(dossier).filter((f) => f !== ".git").length === 0;
}

function creerEcrivain(dest) {
  const crees = [];
  const conserves = [];
  return {
    crees,
    conserves,
    ecrire(rel, contenu) {
      const complet = path.join(dest, rel);
      if (fs.existsSync(complet)) {
        conserves.push(rel);
        return;
      }
      fs.mkdirSync(path.dirname(complet), { recursive: true });
      fs.writeFileSync(complet, contenu, "utf8");
      crees.push(rel);
    },
    // Ajoute au .gitignore existant uniquement les lignes absentes.
    fusionnerGitignore(contenuModele) {
      const complet = path.join(dest, ".gitignore");
      if (!fs.existsSync(complet)) return this.ecrire(".gitignore", contenuModele);
      const existant = fs.readFileSync(complet, "utf8");
      const presentes = new Set(existant.split(/\r?\n/).map((l) => l.trim()));
      const manquantes = contenuModele.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !presentes.has(l));
      if (manquantes.length === 0) return conserves.push(".gitignore");
      const fin = existant.endsWith("\n") ? "" : "\n";
      fs.writeFileSync(complet, `${existant}${fin}\n# --- Ajouté par Pulse ---\n${manquantes.join("\n")}\n`, "utf8");
      crees.push(".gitignore (lignes ajoutées)");
    },
  };
}

// ---------------------------------------------------------------- création

function ecrireFichiers(dest, opts) {
  const description = opts.description || "";
  const e = creerEcrivain(dest);

  const remplir = (texte) =>
    texte
      .replace(/\{\{NOM_DU_PROJET\}\}/g, opts.nom)
      .replace(/\{\{DATE\}\}/g, new Date().toISOString().slice(0, 10))
      .replace(/\{\{Description en une phrase, complétée après \/pulse:brainstorm\.\}\}/g, description || "{{Description en une phrase, complétée après /pulse:brainstorm.}}")
      .replace(/\{\{Description en une phrase\.\}\}/g, description || "À compléter après `/pulse:brainstorm`.");

  e.ecrire("CLAUDE.md", remplir(lireModele("CLAUDE.md")));
  e.fusionnerGitignore(lireModele("gitignore.template"));
  e.ecrire(".env.example", lireModele("env.example.template"));
  e.ecrire("README.md", remplir(lireModele("README-projet.md")).replace("{{TESTER_EN_LOCAL}}", TESTER_EN_LOCAL));
  for (const vide of ["aidd_docs/tasks/.gitkeep", "aidd_docs/memory/internal/.gitkeep", "aidd_docs/memory/external/.gitkeep"]) {
    e.ecrire(vide, "");
  }
  e.ecrire("aidd_docs/memory/README.md", lireModele("aidd-memory-readme.md"));
  e.ecrire("aidd_docs/memory/project.md", remplir(lireModele("aidd-memory-project.md")));
  e.ecrire("aidd_docs/memory/technical.md", remplir(lireModele("aidd-memory-technical.md")));
  e.ecrire("aidd_docs/memory/glossary.md", remplir(lireModele("aidd-memory-glossary.md")));
  return e;
}

function synchroniserMemoire(dest) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "..", "..", "..", "scripts", "memoire.js"), "--rapport"], {
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: dest },
  });
  return r.status === 0;
}

const memeDossier = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

function initialiserGit(dest, { ici }) {
  const git = (...args) => spawnSync("git", args, { cwd: dest, encoding: "utf8" });
  if (git("--version").status !== 0) return "Git est absent : installez-le (https://git-scm.com/downloads) puis lancez /pulse:init.";

  // Un dossier placé dans un dépôt existant (ex. le dossier personnel suivi par Git) ne doit
  // jamais enregistrer ses fichiers dans ce dépôt parent.
  const racine = git("rev-parse", "--show-toplevel");
  const dansUnDepot = racine.status === 0;
  if (dansUnDepot && !memeDossier(racine.stdout.trim(), dest) && ici) {
    return `Ce dossier fait partie du dépôt Git ${racine.stdout.trim()} : premier enregistrement non fait, à décider avec /pulse:init.`;
  }
  if (!dansUnDepot || !memeDossier(racine.stdout.trim(), dest)) {
    if (git("init", "-b", "main").status !== 0) {
      git("init");
      git("checkout", "-b", "main");
    }
  }
  if (!git("config", "user.name").stdout.trim() || !git("config", "user.email").stdout.trim()) {
    return "Git ne connaît pas encore votre nom et votre email : /pulse:init les configurera et fera le premier enregistrement.";
  }
  // Limité au dossier du projet, par sécurité.
  if (git("add", "-A", "--", ".").status !== 0) return "L'ajout des fichiers à Git a échoué : /pulse:init reprendra cette étape.";
  const c = git("commit", "-m", "chore: initialisation du projet avec Pulse");
  return c.status === 0 ? "Premier enregistrement Git fait (branche main)." : "Rien de nouveau à enregistrer dans Git.";
}

// ---------------------------------------------------------------- principal

async function principal() {
  const opts = lireArguments(process.argv.slice(2));
  if (opts.aide) return afficherAide();
  await completerParQuestions(opts);
  if (!opts.nom) opts.nom = path.basename(process.cwd());

  const dest = opts.ici ? process.cwd() : path.resolve(slug(opts.nom));
  if (!opts.ici && !dossierVide(dest)) {
    throw new Error(`Le dossier ${dest} existe déjà et n'est pas vide. Choisissez un autre nom, ou lancez la commande dans ce dossier avec --ici.`);
  }

  fs.mkdirSync(dest, { recursive: true });
  const e = ecrireFichiers(dest, opts);
  const memoireOk = synchroniserMemoire(dest);
  const etatGit = opts.sansGit ? "Git non initialisé (--sans-git)." : initialiserGit(dest, { ici: opts.ici });

  console.log(`\n✅ Projet « ${opts.nom} » prêt dans ${dest}`);
  if (e.crees.length) console.log(`\nCréés :\n${e.crees.map((f) => `  + ${f}`).join("\n")}`);
  if (e.conserves.length) console.log(`\nDéjà présents, conservés tels quels :\n${e.conserves.map((f) => `  = ${f}`).join("\n")}`);
  console.log(`\nMémoire : ${memoireOk ? "branchée dans CLAUDE.md" : "à brancher avec /pulse:memory creer"}`);
  console.log(`Git : ${etatGit}`);
  console.log("Stack technique : pas encore choisie, elle se décide avec /pulse:tech.");

  if (!opts.ici) {
    console.log("\nProchaines étapes :");
    console.log(`  1. cd ${path.relative(process.cwd(), dest) || "."}`);
    console.log("  2. Si le plugin Pulse n'est pas encore installé :");
    console.log("       claude plugin marketplace add jdelauney/pulse-vibe");
    console.log("       claude plugin install pulse@pulseia");
    console.log("  3. claude      puis      /pulse:init   (état du projet et prochaine étape)");
  }
}

principal().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exitCode = 1;
});

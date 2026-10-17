#!/usr/bin/env node
// Lance la suite d'évaluations du cœur (plugins/pulse-vibe/evals/) avec `claude plugin eval` : de vrais essais des
// commandes Pulse sur un petit projet préparé d'avance, notés par des vérifications (outils appelés, fichiers écrits)
// et par un juge. Chaque essai est un vrai appel au modèle, facturé sur votre compte.
//
//   node outils/evals/lancer.js [options de claude plugin eval]     ex. --case plan-controle, --runs 3
//   outils/evals/lancer.sh …   (Linux, macOS, WSL2)    outils\evals\lancer.cmd …   (Windows)
//
// Variables : RUNS (essais par cas, 1 par défaut), PLAFOND (coût maximal en dollars, 5 par défaut).
// Les essais lancent des commandes, que Claude Code fait tourner dans son bac à sable
// (https://code.claude.com/docs/en/sandboxing) :
//   - macOS : bac à sable intégré au système (Seatbelt), rien à installer ;
//   - Linux et WSL2 : bubblewrap et socat (sudo apt install bubblewrap socat) ;
//   - Windows : pas de bac à sable ; le script relance les essais dans WSL2 (Node.js et Claude Code installés dans
//     la distribution Linux), et s'arrête avec la marche à suivre si WSL2 manque.
// `claude plugin eval` demande Claude Code 2.1.269 ou plus et Git 2.31 ou plus.
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.resolve(__dirname, "..", "..");
const CLAUDE_MIN = "2.1.269";
const GIT_MIN = "2.31.0";
const OUTILS_ACCORDES = ["Write", "Edit", "Bash(pulse-aidd *)", "Bash(git *)", "Bash(node *)"];

/** Les arguments de `claude plugin eval` pour le cœur. */
function argumentsEval(racine, env, extra) {
  return [
    "plugin", "eval", path.join(racine, "plugins", "pulse-vibe"),
    "--scaffold", "--trust-plugin", "--no-publish",
    "--runs", env.RUNS || "1", "--max-cost-usd", env.PLAFOND || "5",
    "--allow-tools", ...OUTILS_ACCORDES,
    ...extra,
  ];
}

/** Compare deux versions « a.b.c » : négatif si a < b. */
function comparerVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

const premiereVersion = (texte) => (String(texte || "").match(/\d+\.\d+\.\d+/) || [null])[0];

/** Ce qu'il faut faire selon le système : « direct » (macOS, Linux, WSL2) ou « wsl » (Windows). */
function strategie(plateforme) {
  return plateforme === "win32" ? "wsl" : "direct";
}

/** Les outils à vérifier avant de lancer, selon le système. */
function outilsRequis(plateforme) {
  return plateforme === "linux" ? ["claude", "git", "bwrap", "socat"] : ["claude", "git"];
}

const MARCHE_A_SUIVRE = {
  claude: "Claude Code : npm install -g @anthropic-ai/claude-code",
  git: "Git : https://git-scm.com/downloads",
  bwrap: "bubblewrap : sudo apt install bubblewrap socat",
  socat: "socat : sudo apt install bubblewrap socat",
};

function lancer(cmd, args, options = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" && !options.sansShell, ...options });
}

function versionDe(cmd) {
  const r = lancer(cmd, ["--version"]);
  return r.status === 0 ? premiereVersion(r.stdout) : null;
}

function present(cmd) {
  const r = lancer(cmd, ["--version"]);
  return !r.error && r.status !== 127 && r.status !== 9009;
}

/** macOS, Linux, WSL2 : vérifie les outils puis lance les essais. */
function direct(extra) {
  const manquants = outilsRequis(process.platform).filter((o) => !present(o));
  if (manquants.length) {
    console.error(`Il manque : ${manquants.join(", ")}.`);
    for (const o of manquants) console.error(`  ${MARCHE_A_SUIVRE[o]}`);
    return 1;
  }
  const vClaude = versionDe("claude");
  if (vClaude && comparerVersions(vClaude, CLAUDE_MIN) < 0) {
    console.error(`Claude Code ${vClaude} est trop ancien pour les évaluations (${CLAUDE_MIN} ou plus) : claude update`);
    return 1;
  }
  const vGit = versionDe("git");
  if (vGit && comparerVersions(vGit, GIT_MIN) < 0) {
    console.error(`Git ${vGit} est trop ancien pour les évaluations (${GIT_MIN} ou plus).`);
    return 1;
  }
  const r = spawnSync("claude", argumentsEval(RACINE, process.env, extra), { stdio: "inherit" });
  return r.status === null ? 1 : r.status;
}

/** Sortie de `wsl.exe -l -q` : UTF-16 sous Windows, avec des caractères nuls entre les lettres. */
function distributions(sortie) {
  return String(sortie || "")
    .replace(/\u0000/g, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Échappe un argument pour bash entre apostrophes. */
const pourBash = (a) => `'${String(a).replace(/'/g, "'\\''")}'`;

/** Windows : relance ce script dans WSL2. */
function viaWsl(extra) {
  const liste = lancer("wsl.exe", ["-l", "-q"], { sansShell: true, encoding: "buffer" });
  const noms = liste.error || liste.status !== 0 ? [] : distributions(liste.stdout.toString("utf16le"));
  if (!noms.length) {
    console.error("Sous Windows, Claude Code n'a pas de bac à sable : les essais se lancent dans WSL2 (Linux dans Windows).");
    console.error("  1. Installer WSL2 : wsl --install (dans PowerShell, en administrateur), puis redémarrer.");
    console.error("  2. Dans Ubuntu : sudo apt install bubblewrap socat nodejs npm, puis npm install -g @anthropic-ai/claude-code.");
    console.error("  3. Relancer : outils\\evals\\lancer.cmd");
    return 1;
  }
  const chemin = lancer("wsl.exe", ["wslpath", "-a", RACINE.split(path.sep).join("/")], { sansShell: true });
  const racineWsl = chemin.status === 0 ? chemin.stdout.trim() : "";
  if (!racineWsl) {
    console.error("Le dossier du dépôt n'a pas pu être retrouvé dans WSL2 (wslpath). Lancez le script depuis Ubuntu : node outils/evals/lancer.js");
    return 1;
  }
  console.log(`Windows n'a pas de bac à sable pour les essais : ils se lancent dans WSL2 (${noms[0]}).`);
  const commande = `cd ${pourBash(racineWsl)} && node outils/evals/lancer.js ${extra.map(pourBash).join(" ")}`;
  // RUNS et PLAFOND passent dans WSL par WSLENV.
  const wslenv = ["RUNS", "PLAFOND", process.env.WSLENV].filter(Boolean).join(":");
  const r = spawnSync("wsl.exe", ["--", "bash", "-lc", commande], { stdio: "inherit", env: { ...process.env, WSLENV: wslenv } });
  return r.status === null ? 1 : r.status;
}

function principal(extra) {
  return strategie(process.platform) === "wsl" ? viaWsl(extra) : direct(extra);
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { argumentsEval, comparerVersions, premiereVersion, strategie, outilsRequis, distributions, pourBash, OUTILS_ACCORDES };

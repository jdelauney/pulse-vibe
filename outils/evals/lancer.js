#!/usr/bin/env node
// Lance la suite d'évaluations du cœur (cas dans outils/evals/cas/, hors du plugin publié) avec `claude plugin eval` : de vrais essais des
// commandes Pulse sur un petit projet préparé d'avance, notés par des vérifications (outils appelés, fichiers écrits)
// et par un juge. Chaque essai est un vrai appel au modèle, facturé sur votre compte.
//
//   node outils/evals/lancer.js [options de claude plugin eval]     ex. --case plan-controle, --runs 3
//   node outils/evals/lancer.js --direct [--case <motif>]           chaque cas avec claude -p (direct.js)
//   outils/evals/lancer.sh …   (Linux, macOS, WSL2)    outils\evals\lancer.cmd …   (Windows)
//
// Le mode direct est celui qui marche aujourd'hui : dans claude plugin eval (2.1.309), chaque commande `!` d'un skill
// est déclarée en échec (fichier de suivi du shell en lecture seule dans le bac à sable), et aucune commande Pulse n'y
// démarre. Il note les vérifications automatiques et signale les juges IA comme non notés.
//
// Variables : RUNS (essais par cas, 1 par défaut), PLAFOND (coût maximal en dollars, 5 par défaut),
// PACK (next : ajoute le pack de pile Next.js à côté du cœur, et accorde npm et npx aux essais).
// Les transcriptions des essais sont gardées avec leur rapport (traces/), pour outils/evals/mesurer.js.
// Les essais lancent des commandes, que Claude Code fait tourner dans son bac à sable
// (https://code.claude.com/docs/en/sandboxing) :
//   - macOS : bac à sable intégré au système (Seatbelt), rien à installer ;
//   - Linux et WSL2 : bubblewrap et socat (sudo apt install bubblewrap socat) ;
//   - Windows : pas de bac à sable ; le script relance les essais dans WSL2 (Node.js et Claude Code installés dans
//     la distribution Linux), et s'arrête avec la marche à suivre si WSL2 manque.
// `claude plugin eval` demande Claude Code 2.1.269 ou plus et Git 2.31 ou plus, et cherche les cas sous le dossier du
// plugin : le script assemble une copie temporaire (plugins/pulse-vibe + cas dans evals/), lance les essais sur elle,
// puis range les rapports dans outils/evals/resultats/ (gardé en local, ignoré par Git).
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { nomTrace } = require("./mesurer");
const modeDirect = require("./direct");
const { OUTILS_ACCORDES, OUTILS_PACK, envEval } = modeDirect;

const RACINE = path.resolve(__dirname, "..", "..");
const CAS = path.join(__dirname, "cas");
const RESULTATS = path.join(__dirname, "resultats");
const CLAUDE_MIN = "2.1.269";
const GIT_MIN = "2.31.0";

/** Les arguments de `claude plugin eval` pour le cœur assemblé dans `dossierPlugin`. */
function argumentsEval(dossierPlugin, env, extra) {
  return [
    "plugin", "eval", dossierPlugin,
    "--scaffold", "--trust-plugin", "--no-publish",
    "--runs", env.RUNS || "1", "--max-cost-usd", env.PLAFOND || "5",
    "--allow-tools", ...OUTILS_ACCORDES, ...(env.PACK === "next" ? OUTILS_PACK : []),
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
  const liens = liensDocker(path.join(os.homedir(), ".docker"));
  if (liens.length) {
    console.error(`Le bac à sable refuse un dossier ~/.docker qui contient des liens symboliques (${liens.join(", ")}) ;`);
    console.error("Docker Desktop les pose sous WSL2. Les remplacer par des copies, puis relancer :");
    console.error(`  cd ~/.docker && for f in ${liens.join(" ")}; do cp -rL "$f" "$f.copie" && rm "$f" && mv "$f.copie" "$f"; done`);
    console.error("(ou décocher cette distribution dans Docker Desktop → Settings → Resources → WSL integration).");
    return 1;
  }
  const mode = lireMode(extra);
  if (mode.direct) return modeDirect.lancer(mode.extra, process.env, { depot: RACINE, dossierCas: CAS, resultats: RESULTATS });
  const dossierPlugin = assembler(RACINE, CAS, fs.mkdtempSync(path.join(os.tmpdir(), "pulse-evals-")), { pack: process.env.PACK });
  const r = spawnSync("claude", argumentsEval(dossierPlugin, process.env, extra), { stdio: "inherit", env: envEval(process.env) });
  const ranges = rapatrier(dossierPlugin, RESULTATS);
  for (const n of ranges) conserverTraces(path.join(RESULTATS, n));
  if (ranges.length) console.log(`Rapports rangés dans ${path.relative(RACINE, RESULTATS)}${path.sep}${ranges.join(", ")}`);
  fs.rmSync(path.dirname(dossierPlugin), { recursive: true, force: true });
  return r.status === null ? 1 : r.status;
}

/**
 * Copie le cœur dans `temp`, avec les cas d'essai dans son dossier evals/ ; renvoie le dossier du plugin assemblé.
 * Avec `pack: "next"`, le pack est copié dans evals-pack/next/ et son outil relayé depuis bin/ : claude plugin eval
 * charge un seul plugin, et le cœur trouve un pack par son outil pulse-pile-<id> dans le PATH.
 */
function assembler(racine, cas, temp, { pack } = {}) {
  const dossierPlugin = path.join(temp, "pulse-vibe");
  fs.cpSync(path.join(racine, "plugins", "pulse-vibe"), dossierPlugin, { recursive: true });
  fs.cpSync(cas, path.join(dossierPlugin, "evals"), { recursive: true });
  if (pack === "next") {
    fs.cpSync(path.join(racine, "plugins", "pulse-vibe-next"), path.join(dossierPlugin, "evals-pack", "next"), { recursive: true });
    const relais = path.join(dossierPlugin, "bin", "pulse-pile-next");
    fs.writeFileSync(relais, '#!/usr/bin/env bash\nexec "$(dirname "$0")/../evals-pack/next/bin/pulse-pile-next" "$@"\n', { mode: 0o755 });
  }
  // claude plugin eval ne met pas bin/ dans le PATH de son bac à sable : un hook de démarrage l'y ajoute (evals-chemin.sh).
  fs.copyFileSync(path.join(__dirname, "evals-chemin.sh"), path.join(dossierPlugin, "hooks", "evals-chemin.sh"));
  const fichierHooks = path.join(dossierPlugin, "hooks", "hooks.json");
  const hooks = JSON.parse(fs.readFileSync(fichierHooks, "utf8"));
  hooks.hooks.SessionStart = [
    { hooks: [{ type: "command", command: "sh", args: ["${CLAUDE_PLUGIN_ROOT}/hooks/evals-chemin.sh"], timeout: 10 }] },
    ...(hooks.hooks.SessionStart || []),
  ];
  fs.writeFileSync(fichierHooks, JSON.stringify(hooks, null, 2) + "\n");
  return dossierPlugin;
}

/** L'option --direct (mode direct) et les autres arguments, transmis tels quels. */
function lireMode(args) {
  return { direct: args.includes("--direct"), extra: args.filter((a) => a !== "--direct") };
}

/** Copie dans <rapport>/traces/ la transcription de chaque essai et celles de ses sous-agents (le dossier temporaire est retiré). */
function conserverTraces(rapport) {
  const fichier = path.join(rapport, "aggregate-result.json");
  if (!fs.existsSync(fichier)) return;
  const traces = path.join(rapport, "traces");
  for (const c of JSON.parse(fs.readFileSync(fichier, "utf8")).cases || []) {
    for (const [bras, essais] of Object.entries(c.arms || {})) {
      for (const [i, r] of (essais || []).entries()) {
        if (!r || !r.tracePath || !fs.existsSync(r.tracePath)) continue;
        const nom = nomTrace(c.name, bras, i);
        fs.mkdirSync(traces, { recursive: true });
        fs.copyFileSync(r.tracePath, path.join(traces, nom));
        const sous = r.tracePath.replace(/\.jsonl$/, "");
        if (fs.existsSync(sous)) fs.cpSync(sous, path.join(traces, nom.replace(/\.jsonl$/, "")), { recursive: true });
      }
    }
  }
}

/** Range les rapports produits dans le plugin assemblé (evals/results/<date>/) dans `resultats` ; renvoie leurs noms. */
function rapatrier(dossierPlugin, resultats) {
  const source = path.join(dossierPlugin, "evals", "results");
  if (!fs.existsSync(source)) return [];
  const noms = fs.readdirSync(source);
  for (const n of noms) fs.cpSync(path.join(source, n), path.join(resultats, n), { recursive: true });
  return noms;
}

/** Les entrées de ~/.docker qui sont des liens symboliques (le bac à sable de Claude Code refuse alors les essais). */
function liensDocker(dossier) {
  try {
    return fs.readdirSync(dossier).filter((n) => fs.lstatSync(path.join(dossier, n)).isSymbolicLink());
  } catch (e) {
    return [];
  }
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
  // RUNS, PLAFOND et PACK passent dans WSL par WSLENV.
  const wslenv = ["RUNS", "PLAFOND", "PACK", process.env.WSLENV].filter(Boolean).join(":");
  const r = spawnSync("wsl.exe", ["--", "bash", "-lc", commande], { stdio: "inherit", env: { ...process.env, WSLENV: wslenv } });
  return r.status === null ? 1 : r.status;
}

function principal(extra) {
  return strategie(process.platform) === "wsl" ? viaWsl(extra) : direct(extra);
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { argumentsEval, assembler, envEval, lireMode, conserverTraces, rapatrier, liensDocker, comparerVersions, premiereVersion, strategie, outilsRequis, distributions, pourBash, OUTILS_ACCORDES };

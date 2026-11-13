// pulseia : installer, mettre à jour, désinstaller et diagnostiquer Pulse dans Codex, Cursor, OpenCode et GitHub Copilot.
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const { PACKS, COEUR, versionPaquet, versionPlugin, racineContenu } = require("./chemins");
const { CIBLES, IDS, cible } = require("./cibles");
const { surPath } = require("./cibles/cible");
const { Installation } = require("./installation");
const { Questions } = require("./questions");
const { trouverBash } = require("./relais");

const AIDE = `pulseia ${versionPaquet()} – la méthode Pulse dans votre outil d'IA

  npx pulseia                     assistant : choisit les outils trouvés sur cet ordinateur et installe Pulse
  pulseia installer [options]     installe Pulse pour les outils donnés
      --outil codex,cursor,opencode,copilot   outils à équiper (claude : la marche à suivre pour Claude Code)
      --pack next | --sans-pack   ajoute ou retire le pack Next.js
      --oui                       sans question (réponses par défaut)
      --sans-global               sans installer l'outil pulse-aidd sur l'ordinateur
  pulseia mettre-a-jour [--oui]   réinstalle les mêmes outils avec cette version
  pulseia desinstaller [--outil …] retire Pulse de ces outils (tous par défaut)
  pulseia etat                    versions, outils équipés, prérequis et fichiers modifiés
  pulseia aide                    cette aide
`;

const CLAUDE = `Claude Code utilise les plugins Pulse directement. Dans une session Claude Code :
  /plugin marketplace add jdelauney/pulse-vibe
  /plugin install pulse@pulseia
  /plugin install pulse-next@pulseia   (pack Next.js, facultatif)`;

function lireOptions(args) {
  const o = { commande: null, outils: null, pack: undefined, oui: false, global: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const valeurSuivante = () => {
      const v = a.includes("=") ? a.split("=").slice(1).join("=") : args[++i];
      if (!v || v.startsWith("--")) throw new Error(`valeur attendue après ${a.split("=")[0]}`);
      return v;
    };
    if (a === "--outil" || a.startsWith("--outil=") || a === "--outils" || a.startsWith("--outils=")) o.outils = valeurSuivante().split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    else if (a === "--pack" || a.startsWith("--pack=")) o.pack = valeurSuivante();
    else if (a === "--sans-pack") o.pack = null;
    else if (a === "--oui" || a === "-y") o.oui = true;
    else if (a === "--sans-global") o.global = false;
    else if (a === "--aide" || a === "-h" || a === "--help") o.commande = "aide";
    else if (a === "--version" || a === "-v") o.commande = "version";
    else if (!a.startsWith("-") && !o.commande) o.commande = a;
    else throw new Error(`option inconnue : ${a} (voir pulseia aide)`);
  }
  if (o.pack && !PACKS[o.pack]) throw new Error(`pack inconnu : ${o.pack} (packs : ${Object.keys(PACKS).join(", ")})`);
  return o;
}

const versionNode = () => process.versions.node.split(".").map(Number);
const nodeSuffisant = () => {
  const [a, b] = versionNode();
  return a > 22 || (a === 22 && b >= 19);
};
const gitPresent = () => spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;

/** Vrai quand pulseia tourne depuis le cache de npx (copie temporaire) : pulse-aidd n'est alors pas dans le PATH. */
const depuisNpx = () => /[\\/]_npx[\\/]/.test(__dirname);

function prerequis() {
  const manques = [];
  if (!nodeSuffisant()) manques.push(`Node.js ${process.versions.node} est trop ancien : installez la version LTS (22.19 ou plus) depuis https://nodejs.org.`);
  if (!gitPresent()) manques.push("Git est introuvable : installez-le depuis https://git-scm.com.");
  if (process.platform === "win32" && !trouverBash()) manques.push("Git for Windows (et son bash) est introuvable : installez-le depuis https://git-scm.com/download/win.");
  return manques;
}

async function installerGlobal(options, questions) {
  if (!options.global || !depuisNpx()) return true;
  const version = versionPaquet();
  const accord = options.oui || (await questions.ouiNon(`Installer l'outil pulse-aidd sur cet ordinateur (npm install -g pulseia@${version}) ? Pulse en a besoin.`));
  if (!accord) {
    console.log(`Sans lui, les commandes Pulse ne marcheront pas. Plus tard : npm install -g pulseia@${version}`);
    return false;
  }
  // Arguments fixes (version lue dans package.json) : le shell sert seulement à trouver npm.cmd sous Windows.
  const r = spawnSync("npm", ["install", "-g", `pulseia@${version}`], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.log(`L'installation de pulse-aidd a échoué. Relancez-la plus tard : npm install -g pulseia@${version}`);
    return false;
  }
  return true;
}

function afficherRapport(rapport) {
  console.log(`\nFichiers : ${rapport.ecrits} écrits, ${rapport.inchanges} déjà à jour, ${rapport.retires} retirés.`);
  for (const g of rapport.gardes) console.log(`  gardé : ${g.chemin} (${g.raison})`);
}

function afficherSuite(outils) {
  console.log("\nC'est prêt. Pour commencer :");
  console.log("  1. Redémarrez votre outil d'IA (fermez-le puis rouvrez-le).");
  console.log("  2. Ouvrez-y le dossier de votre projet (un dossier vide pour un nouveau projet).");
  console.log("  3. Tapez la commande de départ : la première pour un nouveau projet, la seconde pour un projet existant.");
  for (const id of outils) console.log(`     ${cible(id).libelle} : ${cible(id).appel("nouveau")} ou ${cible(id).appel("init")}`);
  console.log("\nÀ savoir : les garde-fous automatiques de Pulse (clés secrètes, commandes qui suppriment ou publient) fonctionnent pour l'instant seulement dans Claude Code.");
  console.log("Chaque commande pulse-aidd lancée par l'IA peut vous demander une autorisation : acceptez-la pour pulse-aidd.");
}

async function choisirOutils(options, questions) {
  if (options.outils) return options.outils;
  if (options.oui) throw new Error("précisez les outils avec --outil (codex, cursor, opencode, copilot)");
  const trouves = CIBLES.filter((c) => c.detecter()).map((c) => c.id);
  if (surPath("claude")) console.log(`Claude Code est installé : il utilise les plugins Pulse directement (pulseia installer --outil claude).\n`);
  console.log("Dans quels outils d'IA installer Pulse ?");
  return questions.plusieurs(
    "Numéros",
    CIBLES.map((c) => ({ valeur: c.id, libelle: `${c.libelle}${trouves.includes(c.id) ? " (trouvé sur cet ordinateur)" : ""}` })),
    trouves
  );
}

async function choisirPacks(options, questions, installation) {
  if (options.pack === null) return [];
  if (options.pack) return [...new Set([...installation.packs, options.pack])];
  if (options.oui || installation.packs.includes("next")) return installation.packs;
  const next = await questions.ouiNon("Ajouter le pack Next.js (application web avec comptes et données, prête à mettre en ligne) ?", false);
  return next ? ["next"] : [];
}

async function installer(options, questions) {
  if (options.outils && options.outils.includes("claude")) {
    console.log(CLAUDE);
    options.outils = options.outils.filter((o) => o !== "claude");
    if (options.outils.length === 0) return 0;
  }
  const outils = await choisirOutils(options, questions);
  const inconnus = outils.filter((o) => !IDS.includes(o));
  if (inconnus.length) throw new Error(`outil inconnu : ${inconnus.join(", ")} (outils : ${IDS.join(", ")}, claude)`);
  if (outils.length === 0) {
    console.log("Aucun outil choisi : rien n'est installé.");
    return 0;
  }
  const installation = new Installation();
  const packs = await choisirPacks(options, questions, installation);
  const manques = prerequis();
  for (const m of manques) console.log(`À faire : ${m}`);
  const global = await installerGlobal(options, questions);
  const tous = [...new Set([...installation.outils, ...outils])];
  afficherRapport(installation.appliquer({ outils: tous, packs }));
  console.log(`Pulse ${versionPlugin(COEUR)}${packs.length ? ` et le pack ${packs.join(", ")}` : ""} installés pour : ${tous.map((o) => cible(o).libelle).join(", ")}.`);
  afficherSuite(outils);
  return manques.length || !global ? 1 : 0;
}

async function mettreAJour(options, questions) {
  const installation = new Installation();
  if (installation.outils.length === 0) {
    console.log("Pulse n'est installé pour aucun outil : lancez npx pulseia.");
    return 1;
  }
  const global = await installerGlobal(options, questions);
  afficherRapport(installation.appliquer({ outils: installation.outils, packs: installation.packs }));
  console.log(`Pulse ${versionPlugin(COEUR)} à jour pour : ${installation.outils.map((o) => cible(o).libelle).join(", ")}. Redémarrez votre outil d'IA.`);
  return global ? 0 : 1;
}

function desinstaller(options) {
  const installation = new Installation();
  const retires = options.outils || installation.outils;
  const restants = installation.outils.filter((o) => !retires.includes(o));
  afficherRapport(installation.appliquer({ outils: restants, packs: restants.length ? installation.packs : [] }));
  if (restants.length) console.log(`Pulse reste installé pour : ${restants.map((o) => cible(o).libelle).join(", ")}.`);
  else console.log("Pulse est retiré de vos outils. Pour retirer aussi l'outil pulse-aidd : npm uninstall -g pulseia");
  return 0;
}

function etat() {
  const installation = new Installation();
  console.log(`pulseia ${versionPaquet()} : pulse ${versionPlugin(COEUR)}, pack next ${versionPlugin(PACKS.next)}`);
  console.log(`Contenu : ${path.relative(process.cwd(), racineContenu()) || "."}`);
  console.log(`Installé pour : ${installation.outils.map((o) => cible(o).libelle).join(", ") || "aucun outil"}${installation.packs.length ? ` (pack ${installation.packs.join(", ")})` : ""}`);
  if (installation.registre.version && installation.registre.version !== versionPaquet()) console.log(`Version installée : ${installation.registre.version} (pulseia mettre-a-jour pour passer à ${versionPaquet()})`);
  console.log(`Fichiers posés : ${Object.keys(installation.registre.fichiers).length}`);
  for (const f of installation.modifies()) console.log(`  modifié depuis son installation : ${f}`);
  console.log(`Outils trouvés sur cet ordinateur : ${CIBLES.filter((c) => c.detecter()).map((c) => c.libelle).join(", ") || "aucun"}${surPath("claude") ? ", Claude Code" : ""}`);
  console.log(`pulse-aidd dans le PATH : ${surPath("pulse-aidd") ? "oui" : "non (npm install -g pulseia)"}`);
  const manques = prerequis();
  console.log(manques.length ? manques.map((m) => `À faire : ${m}`).join("\n") : "Prérequis : Node.js, Git" + (process.platform === "win32" ? " et Git Bash" : "") + " présents.");
  return manques.length ? 1 : 0;
}

async function principal(args) {
  const options = lireOptions(args);
  const commande = options.commande || "installer";
  if (commande === "aide") {
    console.log(AIDE);
    return 0;
  }
  if (commande === "version") {
    console.log(versionPaquet());
    return 0;
  }
  if (commande === "etat") return etat();
  if (commande === "desinstaller") return desinstaller(options);
  if (!["installer", "mettre-a-jour"].includes(commande)) throw new Error(`commande inconnue : ${commande} (voir pulseia aide)`);
  const interactif = process.stdin.isTTY && !options.oui;
  if (!interactif && !options.oui && !(commande === "installer" && options.outils)) {
    console.log(AIDE);
    return 1;
  }
  // Sans terminal ni --oui : aucune question, et rien d'installé sur l'ordinateur sans accord (npm install -g).
  const questions = interactif ? new Questions() : { ouiNon: async () => false, plusieurs: async () => [] };
  try {
    return commande === "installer" ? await installer(options, questions) : await mettreAJour(options, questions);
  } finally {
    if (questions.fermer) questions.fermer();
  }
}

module.exports = { principal, lireOptions, AIDE };

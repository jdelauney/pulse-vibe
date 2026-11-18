#!/usr/bin/env node
// Pulse – le verrou des tests figés (`pulse-aidd tests-figes`), et son garde-fou (hook PreToolUse, appelé par garde.js).
//
// En « tests d'abord » (/pulse:implement -t, /pulse:spirc -t) et dans /pulse:fix (test de non-régression), les tests
// écrits avant le code sont figés : le code doit les faire passer sans les modifier. La liste des fichiers figés est
// gardée dans le dossier Git du dossier de travail (<dossier .git>/pulse-tests-figes.json : jamais enregistrée, propre
// à chaque worktree). Tant qu'elle vit, le garde-fou refuse de les modifier :
//  - par Write, Edit, MultiEdit, NotebookEdit ;
//  - par une commande (redirection > et >>, tee, sed -i, perl -i, Set-Content, Add-Content, Out-File, Clear-Content,
//    copie ou déplacement vers lui, déplacement, renommage ou suppression du fichier).
// La commande qui orchestre lève le verrou avant de confier un test jugé faux à l'assistant des tests (liberer),
// puis le remet (figer). Une liste sans mise à jour depuis PERIME_H heures est périmée : ignorée.
//
//   pulse-aidd tests-figes figer <fichier…>     ajoute des fichiers à la liste (chemins depuis le dossier courant)
//   pulse-aidd tests-figes liberer [<fichier…>] retire ces fichiers ; sans fichier, vide la liste
//   pulse-aidd tests-figes                      affiche « fichier: <chemin> » par fichier figé (rien sans liste vivante)
//
// Module : lire(racine), figer(racine, fichiers), liberer(racine, fichiers), estFige(racine, chemin), vider(racine), evaluer(entree).
// Désactivation ponctuelle du garde-fou : PULSE_GARDE_TESTS_OFF=1. Fail-open : en cas d'erreur, l'outil passe.
// Sort avec le code 0.
"use strict";

const fs = require("fs");
const path = require("path");

const NOM = "pulse-tests-figes.json";
const PERIME_H = 6;
const OUTILS_ECRITURE = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
// Commandes qui modifient, déplacent ou suppriment le fichier qu'elles nomment.
const MODIFIEURS = new Set(["rm", "unlink", "shred", "truncate", "remove-item", "ri", "del", "erase", "rename-item", "rni", "set-content", "sc", "add-content", "ac", "out-file", "clear-content", "clc", "tee", "new-item", "ni"]);
const DEPLACEURS = new Set(["mv", "move", "move-item", "mi"]);
const COPIEURS = new Set(["cp", "copy", "copy-item", "cpi", "xcopy", "robocopy"]);
const SUR_PLACE = new Set(["sed", "perl", "ruby"]); // avec -i : modifient les fichiers nommés

/** La racine du dépôt (dossier qui contient .git) et le dossier Git, sans lancer git : { racine, dossierGit } ou null. */
function depot(cwd) {
  for (let d = path.resolve(cwd); ; d = path.dirname(d)) {
    const point = path.join(d, ".git");
    try {
      const st = fs.statSync(point);
      if (st.isDirectory()) return { racine: d, dossierGit: point };
      // Worktree ou sous-module : « gitdir: <chemin> ».
      const m = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(point, "utf8"));
      if (m) return { racine: d, dossierGit: path.resolve(d, m[1]) };
      return null;
    } catch (e) {
      // pas de .git ici
    }
    if (path.dirname(d) === d) return null;
  }
}

const fichierListe = (dossierGit) => path.join(dossierGit, NOM);

/** Le chemin relatif à la racine, en barres obliques, sans « ./ » ; null hors de la racine. */
function relatif(racine, chemin, cwd = racine) {
  const absolu = path.resolve(cwd, String(chemin || ""));
  const r = path.relative(racine, absolu);
  if (!r || r.startsWith("..") || path.isAbsolute(r)) return null;
  const posix = r.split(path.sep).join("/");
  return process.platform === "win32" ? posix.toLowerCase() : posix;
}

/** La liste vivante { fichiers, maj } du dépôt de `cwd`, ou null (absente, illisible, périmée, hors dépôt). */
function lire(cwd, maintenant = Date.now()) {
  const d = depot(cwd);
  if (!d) return null;
  try {
    const l = JSON.parse(fs.readFileSync(fichierListe(d.dossierGit), "utf8"));
    const t = Date.parse(l && l.maj);
    if (!Array.isArray(l.fichiers) || Number.isNaN(t) || maintenant - t > PERIME_H * 3600 * 1000) return null;
    return { racine: d.racine, fichiers: l.fichiers.map(String), maj: l.maj };
  } catch (e) {
    return null;
  }
}

function ecrire(dossierGit, fichiers) {
  const cible = fichierListe(dossierGit);
  if (!fichiers.length) return fs.rmSync(cible, { force: true });
  const temporaire = `${cible}.${process.pid}.tmp`;
  fs.writeFileSync(temporaire, JSON.stringify({ fichiers, maj: new Date().toISOString() }, null, 2) + "\n", "utf8");
  fs.renameSync(temporaire, cible);
}

/** Ajoute des fichiers (chemins depuis `cwd`) ; rend la liste à jour, ou null hors dépôt. */
function figer(cwd, chemins) {
  const d = depot(cwd);
  if (!d) return null;
  const actuels = (lire(cwd) || { fichiers: [] }).fichiers;
  const ajoutes = chemins.map((c) => relatif(d.racine, c, cwd)).filter(Boolean);
  const fichiers = [...new Set([...actuels, ...ajoutes])].sort();
  ecrire(d.dossierGit, fichiers);
  return fichiers;
}

/** Retire des fichiers ; sans chemin, vide la liste. Rend la liste restante, ou null hors dépôt. */
function liberer(cwd, chemins = []) {
  const d = depot(cwd);
  if (!d) return null;
  if (!chemins.length) {
    ecrire(d.dossierGit, []);
    return [];
  }
  const retires = new Set(chemins.map((c) => relatif(d.racine, c, cwd)).filter(Boolean));
  const fichiers = (lire(cwd) || { fichiers: [] }).fichiers.filter((f) => !retires.has(f));
  ecrire(d.dossierGit, fichiers);
  return fichiers;
}

const vider = (cwd) => liberer(cwd, []);

/** Vrai si `chemin` (depuis `cwd`) est un test figé d'une liste vivante. */
function estFige(liste, chemin, cwd) {
  const r = liste && relatif(liste.racine, chemin, cwd);
  return Boolean(r && liste.fichiers.includes(r));
}

// ---------------------------------------------------------------- garde-fou

function message(fichier) {
  return (
    `🔒 Pulse a bloqué la modification de « ${fichier} » : ce test est figé. Il a été écrit avant le code et décrit ce que la tâche doit faire ; ` +
    `le code doit le faire passer tel quel.\n` +
    `À faire : corrigez le code de production. Si le test vous semble faux, laissez-le tel quel et décrivez-le dans « Tests contestés » de votre rapport, ` +
    `avec la raison : la commande qui orchestre le fera corriger par l'assistant des tests.`
  );
}

/** Les fichiers qu'une commande simple (lecture-commande.js) modifie, déplace ou supprime. */
function cibles(c) {
  const positions = c.args.filter((a) => !a.startsWith("-"));
  const liste = [...(c.ecritures || [])];
  if (MODIFIEURS.has(c.cmd)) {
    const j = c.args.findIndex((a) => /^-(path|literalpath|filepath)$/i.test(a));
    liste.push(...(j >= 0 ? [c.args[j + 1]] : positions));
  }
  if (DEPLACEURS.has(c.cmd)) liste.push(...positions);
  if (COPIEURS.has(c.cmd) && positions.length >= 2) liste.push(positions[positions.length - 1]);
  if (SUR_PLACE.has(c.cmd) && c.args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith("--in-place"))) liste.push(...positions);
  if (c.cmd === "git" && ["mv", "rm"].includes(positions[0])) liste.push(...positions.slice(1));
  return liste.filter((f) => typeof f === "string" && f);
}

/** Décision pour une entrée de hook : { decision: "deny", raison }, ou null pour laisser passer. */
function evaluer(entree) {
  if (process.env.PULSE_GARDE_TESTS_OFF === "1") return null;
  try {
    if (!entree || !entree.tool_input) return null;
    const cwd = entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : process.cwd();
    const liste = lire(cwd);
    if (!liste || !liste.fichiers.length) return null;
    const ti = entree.tool_input;
    let touches = [];
    if (OUTILS_ECRITURE.has(entree.tool_name)) touches = [ti.file_path || ti.notebook_path];
    else if ((entree.tool_name === "Bash" || entree.tool_name === "PowerShell") && typeof ti.command === "string") {
      const { commandesSimples } = require("./lecture-commande");
      for (const c of commandesSimples(ti.command, entree.tool_name === "PowerShell" ? "powershell" : "bash")) touches.push(...cibles(c));
    }
    const fige = touches.find((f) => f && estFige(liste, f, cwd));
    return fige ? { decision: "deny", raison: message(relatif(liste.racine, fige, cwd)) } : null;
  } catch (e) {
    return null;
  }
}

function main(args, cwd) {
  const [action, ...chemins] = args;
  if (action === "figer") {
    if (!chemins.length) return console.log("Indiquez les fichiers de test à figer : rien n'a été noté.");
    const r = figer(cwd, chemins);
    console.log(r ? `figes: ${r.length}` : "Pas de dépôt Git ici : rien n'a été noté.");
  } else if (action === "liberer") {
    const r = liberer(cwd, chemins);
    console.log(r ? `figes: ${r.length}` : "Pas de dépôt Git ici : rien n'a été noté.");
  } else {
    const l = lire(cwd);
    if (l) for (const f of l.fichiers) console.log(`fichier: ${f}`);
  }
}

module.exports = { depot, lire, figer, liberer, vider, estFige, evaluer, PERIME_H };

if (require.main === module) {
  try {
    main(process.argv.slice(2), process.cwd());
  } catch (e) {
    // jamais d'échec visible
  }
  process.exitCode = 0;
}

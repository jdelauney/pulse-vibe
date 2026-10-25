#!/usr/bin/env node
// Pulse – marqueur « réalisation en cours » (`pulse-aidd realisation`).
//
// Un petit fichier, aidd_docs/tasks/realisation.json (ignoré par Git), dit qu'une réalisation est en cours :
// l'US, la commande, le rythme, le mode devant vous, la tâche et l'étape courantes, les questions en attente. Les hooks s'en servent :
// rappel de « où on en est » après un compactage (--rappel), notification du bureau (notifier.js), et contrôles
// automatiques de fin de tour lancés seulement pendant une réalisation (fin-de-tour.js).
// Un marqueur dont la dernière mise à jour (maj) date de plus de PERIME_H heures est périmé : une réalisation
// interrompue sans « fin ». Les hooks l'ignorent ; `pulse-aidd etat` le signale (realisation: perimee) et
// la commande nue affiche « perime: oui » ; etape et questions le rafraîchissent, fin le retire.
//
//   pulse-aidd realisation debut <US-XXX> --commande <spirc|implement> --rythme <complet|rapide> [--autonome] [--devant]
//   pulse-aidd realisation etape <Tn> <etape>   la tâche et l'étape en cours (test, realisation, examen, commit, questions, test-groupe…)
//     Avec --devant (la conversation code elle-même), bin/pulse-aidd affiche ensuite, pour realisation et test, le contexte
//     du pack de pile déclaré (pulse-pile-<id> contexte implement ou test), ou le bloc « non installé » : la fiche avant le code.
//   pulse-aidd realisation questions <n>        le nombre de questions qui attendent la personne
//   pulse-aidd realisation fin                  supprime le marqueur
//   pulse-aidd realisation                      affiche « clé: valeur » (plus « perime: oui » s'il est périmé), rien si absent
//   pulse-aidd realisation --rappel             hook SessionStart : le texte « où on en est » (marqueur cherché comme trouver())
//
// Module : lire(racine) → Etat|null (périmé : null), lireBrut(racine), perime(etat), rappel(racine) → texte (vide si absent),
// trouver(cwd[, accepte]) → { racine, etat }|null : premier marqueur vivant sous la racine Git de cwd, puis CLAUDE_PROJECT_DIR, puis le dossier courant.
// Sort avec le code 0 (une erreur d'écriture ne doit pas annuler la commande /pulse qui l'appelle), sauf `debut` sans numéro d'US valide : code 1, rien n'est écrit.
"use strict";

const fs = require("fs");
const path = require("path");

const CHEMIN = ["aidd_docs", "tasks", "realisation.json"];
const CLES = ["us", "commande", "rythme", "autonome", "devant", "tache", "etape", "questions", "debut", "maj"];
const PERIME_H = 6; // au-delà, la réalisation a été interrompue sans « fin » : les hooks se taisent

const fichier = (racine) => path.join(racine, ...CHEMIN);

/** Le marqueur tel quel, même périmé, ou null s'il est absent ou illisible. */
function lireBrut(racine) {
  try {
    const m = JSON.parse(fs.readFileSync(fichier(racine), "utf8"));
    return m && typeof m === "object" && !Array.isArray(m) ? m : null;
  } catch {
    return null;
  }
}

/** Vrai quand la dernière mise à jour date de plus de PERIME_H heures, ou n'est pas une date. */
function perime(etat, maintenant = Date.now()) {
  const t = Date.parse(etat && etat.maj);
  return Number.isNaN(t) || maintenant - t > PERIME_H * 3600 * 1000;
}

/** Le marqueur d'une réalisation vivante, ou null (absent, illisible ou périmé). */
function lire(racine) {
  const m = lireBrut(racine);
  return m && !perime(m) ? m : null;
}

/** Le premier marqueur vivant : racine Git de cwd, puis CLAUDE_PROJECT_DIR, puis le dossier courant (dossiers retenus par `accepte`). */
function trouver(cwd, accepte = () => true) {
  const candidats = [];
  if (cwd && fs.existsSync(cwd)) candidats.push(require("./tour").racineGit(cwd) || cwd);
  if (process.env.CLAUDE_PROJECT_DIR) candidats.push(process.env.CLAUDE_PROJECT_DIR);
  candidats.push(process.cwd());
  for (const racine of candidats) {
    const etat = lire(racine);
    if (etat && accepte(racine)) return { racine, etat };
  }
  return null;
}

/** L'entrée JSON d'un hook sur stdin, ou {} (pas d'entrée, terminal, JSON illisible). */
function entreeHook() {
  try {
    if (process.stdin.isTTY) return {};
    const e = JSON.parse(fs.readFileSync(0, "utf8"));
    return e && typeof e === "object" ? e : {};
  } catch {
    return {};
  }
}

/** Écriture atomique : fichier temporaire, puis renommage. */
function ecrire(racine, etat) {
  const cible = fichier(racine);
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  const temporaire = `${cible}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaire, JSON.stringify(etat, null, 2) + "\n", "utf8");
    fs.renameSync(temporaire, cible);
  } catch (e) {
    try { fs.rmSync(temporaire, { force: true }); } catch { /* rien à retirer */ }
    throw e;
  }
}

/** Met à jour le marqueur s'il existe ; sinon ne fait rien. */
function mettreAJour(racine, changements) {
  const etat = lireBrut(racine);
  if (!etat) return;
  ecrire(racine, { ...etat, ...changements, maj: new Date().toISOString() });
}

/** Le texte « où on en est », vide sans marqueur. */
function rappel(racine) {
  const e = lire(racine);
  if (!e) return "";
  const lignes = [`Une réalisation est en cours : ${e.us || "US inconnue"} (${e.commande || "?"}, rythme ${e.rythme || "?"}${e.autonome ? ", sans pause" : ""}${e.devant ? ", devant vous" : ""}).`];
  if (e.tache) lignes.push(`Tâche en cours : ${e.tache}${e.etape ? `, étape ${e.etape}` : ""}.`);
  else if (e.etape) lignes.push(`Étape en cours : ${e.etape}.`);
  const n = Number(e.questions) || 0;
  if (n > 0) lignes.push(n === 1 ? "1 question vous attend." : `${n} questions vous attendent.`);
  // Une compaction ne garde que le début d'un skill : la commande se recharge par son étape.
  if (e.commande === "spirc" || e.commande === "implement") lignes.push(`Rechargez vos instructions : lancez \`pulse-aidd etape ${e.commande}\` et lisez toute la sortie, y compris dans le fichier enregistré quand Claude Code ne l'affiche pas en entier (elle dépasse 30 000 caractères).`);
  // Devant vous : la fiche du pack se recharge par l'étape de code (test ou realisation), avant d'écrire.
  if (e.devant) {
    const etape = e.tache && (e.etape === "test" || e.etape === "realisation") ? `${e.tache} ${e.etape}` : `${e.tache || "<tâche>"} realisation`;
    lignes.push(`Avant d'écrire du code, relancez \`pulse-aidd realisation etape ${etape}\` et lisez toute sa sortie : elle recharge la fiche du pack de pile.`);
  }
  return lignes.join("\n");
}

function valeurOption(args, nom) {
  const i = args.indexOf(nom);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

function main(args, racine) {
  const [action, ...reste] = args;
  if (action === "debut") {
    const us = reste.find((a) => !a.startsWith("--") && a !== valeurOption(reste, "--commande") && a !== valeurOption(reste, "--rythme")) || "";
    if (!/^US-\d{3,}$/.test(us)) {
      console.log("Indiquez le numéro de l'US sous la forme US-001 : rien n'a été noté.");
      return 1;
    }
    const maintenant = new Date().toISOString();
    ecrire(racine, {
      us,
      commande: valeurOption(reste, "--commande") || "",
      rythme: valeurOption(reste, "--rythme") || "",
      autonome: reste.includes("--autonome"),
      devant: reste.includes("--devant"),
      tache: "",
      etape: "",
      questions: 0,
      debut: maintenant,
      maj: maintenant,
    });
  } else if (action === "etape") {
    if (reste[0]) mettreAJour(racine, { tache: reste[0], etape: reste[1] || "" });
  } else if (action === "questions") {
    const n = parseInt(reste[0], 10);
    if (Number.isFinite(n) && n >= 0) mettreAJour(racine, { questions: n });
  } else if (action === "fin") {
    try { fs.rmSync(fichier(racine), { force: true }); } catch { /* déjà absent */ }
  } else if (action === "--rappel") {
    // Hook SessionStart (compact) : le cwd de l'entrée du hook d'abord, puis le dossier du projet donné par Claude Code.
    const trouve = trouver(entreeHook().cwd, require("./garde").projetPulse);
    const t = trouve ? rappel(trouve.racine) : "";
    if (t) console.log(t);
  } else {
    const e = lireBrut(racine);
    if (e) for (const cle of CLES) if (cle in e) console.log(`${cle}: ${e[cle]}`);
    if (e && perime(e)) console.log("perime: oui");
  }
}

/**
 * Une ancienne note « Pour reprendre » d'implement sans tâche (« /pulse:implement [options] US-XXX ») se
 * reprend avec /pulse:spirc : implement ne boucle plus. Les options passent (sauf `-s`, propre à implement) ;
 * avec une tâche, la commande reste telle quelle.
 */
function repriseActuelle(commande) {
  const m = /^\/pulse:implement((?:\s+-[a-z]+)*)\s+(US-\d+)((?:\s+-[a-z]+)*)\s*$/i.exec(commande);
  if (!m) return commande;
  const options = (m[1] + m[3]).split(/\s+/).map((o) => o.replace(/s/g, "")).filter((o) => o.length > 1);
  return ["/pulse:spirc", ...options, m[2]].join(" ");
}

module.exports = { repriseActuelle, ecrire, lire, lireBrut, perime, trouver, rappel, PERIME_H };

if (require.main === module) {
  let code = 0;
  try {
    code = main(process.argv.slice(2), process.cwd()) || 0;
  } catch {
    // jamais d'échec visible
  }
  process.exitCode = code;
}

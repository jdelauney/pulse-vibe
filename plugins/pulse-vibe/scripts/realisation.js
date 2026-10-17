#!/usr/bin/env node
// Pulse – marqueur « réalisation en cours » (`pulse-aidd realisation`).
//
// Un petit fichier, aidd_docs/tasks/realisation.json (ignoré par Git), dit qu'une réalisation est en cours :
// l'US, la commande, le rythme, la tâche et l'étape courantes, les questions en attente. Les hooks s'en servent
// pour rappeler « où on en est » après un compactage et pour ne pas laisser passer une fin de tour trop tôt.
//
//   pulse-aidd realisation debut <US-XXX> --commande <spirc|implement> --rythme <complet|rapide> [--autonome]
//   pulse-aidd realisation etape <Tn> <etape>   la tâche et l'étape en cours (test, realisation, examen, commit, questions, test-groupe…)
//   pulse-aidd realisation questions <n>        le nombre de questions qui attendent la personne
//   pulse-aidd realisation fin                  supprime le marqueur
//   pulse-aidd realisation [--rappel]           affiche « clé: valeur » (--rappel : le texte « où on en est »), rien si absent
//
// Module : lire(racine) → Etat|null, rappel(racine) → texte (vide si absent).
// Sort toujours avec le code 0 : un échec annulerait la commande /pulse qui l'appelle.
"use strict";

const fs = require("fs");
const path = require("path");

const CHEMIN = ["aidd_docs", "tasks", "realisation.json"];
const CLES = ["us", "commande", "rythme", "autonome", "tache", "etape", "questions", "debut", "maj"];

const fichier = (racine) => path.join(racine, ...CHEMIN);

/** Le marqueur, ou null s'il est absent ou illisible. */
function lire(racine) {
  try {
    const m = JSON.parse(fs.readFileSync(fichier(racine), "utf8"));
    return m && typeof m === "object" && !Array.isArray(m) ? m : null;
  } catch {
    return null;
  }
}

/** Écriture atomique : fichier temporaire, puis renommage. */
function ecrire(racine, etat) {
  const cible = fichier(racine);
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  const temporaire = `${cible}.${process.pid}.tmp`;
  fs.writeFileSync(temporaire, JSON.stringify(etat, null, 2) + "\n", "utf8");
  fs.renameSync(temporaire, cible);
}

/** Met à jour le marqueur s'il existe ; sinon ne fait rien. */
function mettreAJour(racine, changements) {
  const etat = lire(racine);
  if (!etat) return;
  ecrire(racine, { ...etat, ...changements, maj: new Date().toISOString() });
}

/** Le texte « où on en est », vide sans marqueur. */
function rappel(racine) {
  const e = lire(racine);
  if (!e) return "";
  const lignes = [`Une réalisation est en cours : ${e.us || "US inconnue"} (${e.commande || "?"}, rythme ${e.rythme || "?"}${e.autonome ? ", sans pause" : ""}).`];
  if (e.tache) lignes.push(`Tâche en cours : ${e.tache}${e.etape ? `, étape ${e.etape}` : ""}.`);
  else if (e.etape) lignes.push(`Étape en cours : ${e.etape}.`);
  const n = Number(e.questions) || 0;
  if (n > 0) lignes.push(n === 1 ? "1 question vous attend." : `${n} questions vous attendent.`);
  return lignes.join("\n");
}

function valeurOption(args, nom) {
  const i = args.indexOf(nom);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

function main(args, racine) {
  const [action, ...reste] = args;
  if (action === "debut") {
    const maintenant = new Date().toISOString();
    ecrire(racine, {
      us: reste.find((a) => !a.startsWith("--") && a !== valeurOption(reste, "--commande") && a !== valeurOption(reste, "--rythme")) || "",
      commande: valeurOption(reste, "--commande") || "",
      rythme: valeurOption(reste, "--rythme") || "",
      autonome: reste.includes("--autonome"),
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
    const t = rappel(racine);
    if (t) console.log(t);
  } else {
    const e = lire(racine);
    if (e) for (const cle of CLES) if (cle in e) console.log(`${cle}: ${e[cle]}`);
  }
}

module.exports = { lire, rappel };

if (require.main === module) {
  try {
    main(process.argv.slice(2), process.cwd());
  } catch {
    // jamais d'échec visible
  }
  process.exitCode = 0;
}

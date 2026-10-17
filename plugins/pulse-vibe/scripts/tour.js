#!/usr/bin/env node
// Pulse – relevé des fichiers écrits pendant un tour (hooks PostToolUse, Stop, SubagentStop).
//
// Chaque écriture (Write, Edit, MultiEdit) est notée dans un relevé, rangé dans un dossier
// temporaire de la machine (jamais dans le projet) : `fin-de-tour.js` le lit en fin de tour
// pour contrôler seulement ce qui a changé, puis l'efface. Les chemins sont notés relatifs à la
// racine Git, avec des `/` sur toutes les plateformes, comme les règles les comparent.
// Une écriture faite dans un sous-agent est notée sous la clé de l'agent et sous celle de la session.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const valide = (id) => typeof id === "string" && /^[\w-]{1,100}$/.test(id);

/** Clé du relevé : `<session>` ou `<session>-<agent>` ; vide quand la session est inconnue. */
function cle(entree) {
  const e = entree || {};
  if (!valide(e.session_id)) return "";
  return valide(e.agent_id) ? `${e.session_id}-${e.agent_id}` : e.session_id;
}

/** Dossier des relevés d'un projet, une empreinte de sa racine Git par projet. */
function dossierEtat(racine) {
  const base = process.env.PULSE_TOURS_DIR || path.join(os.tmpdir(), "pulse-tours");
  const brut = String(racine).replace(/\\/g, "/");
  const nom = process.platform === "win32" ? brut.toLowerCase() : brut;
  return path.join(base, crypto.createHash("sha1").update(nom).digest("hex").slice(0, 16));
}

const fichierEtat = (racine, k) => path.join(dossierEtat(racine), `${k}.json`);

function lire(racine, k) {
  try {
    const e = JSON.parse(fs.readFileSync(fichierEtat(racine, k), "utf8"));
    return {
      fichiers: Array.isArray(e.fichiers) ? e.fichiers.filter((f) => typeof f === "string") : [],
      relances: Number.isInteger(e.relances) ? e.relances : 0,
    };
  } catch (e) {
    return { fichiers: [], relances: 0 };
  }
}

function ecrire(racine, k, etat) {
  if (!k) return;
  fs.mkdirSync(dossierEtat(racine), { recursive: true });
  fs.writeFileSync(fichierEtat(racine, k), JSON.stringify({ fichiers: etat.fichiers || [], relances: etat.relances || 0 }));
}

/** Le chemin relatif à la racine, avec des `/`, ou null quand le fichier est hors du projet. */
function relatif(fichier, racine) {
  if (typeof fichier !== "string" || !fichier) return null;
  const f = fichier.replace(/\\/g, "/");
  const r = String(racine).replace(/\\/g, "/").replace(/\/+$/, "");
  const lecteur = /^[a-z]:\//i.test(f);
  if (!lecteur && !f.startsWith("/")) {
    const rel = path.posix.normalize(f);
    return rel === ".." || rel.startsWith("../") || rel === "." ? null : rel;
  }
  const abs = path.posix.normalize(f);
  const [a, b] = lecteur || /^[a-z]:\//i.test(r) ? [abs.toLowerCase(), r.toLowerCase()] : [abs, r];
  if (!a.startsWith(`${b}/`)) return null;
  return abs.slice(r.length + 1);
}

/** Note le fichier écrit par l'entrée du hook, dans le relevé de l'agent et dans celui de la session. */
function noter(entree, racine) {
  const e = entree || {};
  const rel = relatif(e.tool_input && e.tool_input.file_path, racine);
  if (!rel) return;
  const cles = [...new Set([cle(e), cle({ session_id: e.session_id })].filter(Boolean))];
  for (const k of cles) {
    const etat = lire(racine, k);
    if (etat.fichiers.includes(rel)) continue;
    etat.fichiers.push(rel);
    ecrire(racine, k, etat);
  }
}

const lireTour = (entree, racine) => lire(racine, cle(entree));
const ecrireTour = (entree, racine, etat) => ecrire(racine, cle(entree), etat);

function effacerTour(entree, racine) {
  try {
    fs.unlinkSync(fichierEtat(racine, cle(entree)));
  } catch (e) {
    // déjà effacé
  }
}

/** La racine du dépôt ou du worktree qui contient `cwd`, ou null hors dépôt. */
function racineGit(cwd) {
  try {
    const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
    return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
  } catch (e) {
    return null;
  }
}

module.exports = { cle, dossierEtat, noter, lireTour, ecrireTour, effacerTour, racineGit };

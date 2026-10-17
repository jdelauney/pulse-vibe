#!/usr/bin/env node
// Pulse – relevé des fichiers écrits pendant un tour (hooks PostToolUse, Stop, SubagentStop).
//
// Chaque écriture (Write, Edit, MultiEdit) est notée dans un relevé, rangé dans un dossier
// temporaire de la machine (jamais dans le projet) : `fin-de-tour.js` le lit en fin de tour
// pour contrôler seulement ce qui a changé, puis marque contrôlée la part lue. Les chemins sont notés relatifs à la
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

// Trois fichiers par clé : les fichiers touchés (une ligne par chemin, ajoutée sans relire : des
// processus en parallèle ne perdent rien), les relances et la part déjà contrôlée du relevé (en
// octets), ces deux-là écrites par le seul hook de fin de tour. Le hook de fin de tour ne réécrit
// jamais le relevé : il avance la part contrôlée, et une écriture notée entre-temps reste à contrôler.
const fichiersDe = (racine, k) => path.join(dossierEtat(racine), `${k}.fichiers`);
const relancesDe = (racine, k) => path.join(dossierEtat(racine), `${k}.relances`);
const lusDe = (racine, k) => path.join(dossierEtat(racine), `${k}.lus`);

const entier = (fichier) => {
  try {
    const n = parseInt(fs.readFileSync(fichier, "utf8"), 10);
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch (e) {
    return 0;
  }
};

/** Les fichiers pas encore contrôlés, les relances, et `lu` : la taille du relevé lu, lignes complètes seulement. */
function lire(racine, k) {
  let brut = Buffer.alloc(0);
  try {
    brut = fs.readFileSync(fichiersDe(racine, k));
  } catch (e) {
    // pas de relevé
  }
  const lu = brut.lastIndexOf(10) + 1;
  let debut = entier(lusDe(racine, k));
  if (debut > lu) debut = 0; // relevé recréé depuis
  const fichiers = [...new Set(brut.subarray(debut, lu).toString("utf8").split("\n").filter(Boolean))];
  return { fichiers, relances: entier(relancesDe(racine, k)), lu };
}

function ecrire(racine, k, etat) {
  if (!k) return;
  fs.mkdirSync(dossierEtat(racine), { recursive: true });
  try {
    fs.unlinkSync(lusDe(racine, k));
  } catch (e) {
    // rien de contrôlé
  }
  const fichiers = [...new Set(etat.fichiers || [])];
  fs.writeFileSync(fichiersDe(racine, k), fichiers.map((x) => `${x}\n`).join(""));
  fs.writeFileSync(relancesDe(racine, k), String(etat.relances || 0));
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
  fs.mkdirSync(dossierEtat(racine), { recursive: true });
  for (const k of cles) fs.appendFileSync(fichiersDe(racine, k), `${rel}\n`);
}

const lireTour = (entree, racine) => lire(racine, cle(entree));
const ecrireTour = (entree, racine, etat) => ecrire(racine, cle(entree), etat);

/** Le nombre de blocages de suite, seul : le relevé reste tel quel. */
function ecrireRelances(entree, racine, n) {
  const k = cle(entree);
  if (!k) return;
  fs.mkdirSync(dossierEtat(racine), { recursive: true });
  fs.writeFileSync(relancesDe(racine, k), String(n || 0));
}

/** Marque contrôlée la part du relevé lue (`lu` de lireTour) et remet les relances à zéro ; la suite reste à contrôler. */
function marquerLus(entree, racine, lu) {
  const k = cle(entree);
  if (!k) return;
  fs.mkdirSync(dossierEtat(racine), { recursive: true });
  fs.writeFileSync(lusDe(racine, k), String(lu || 0));
  fs.writeFileSync(relancesDe(racine, k), "0");
}

function effacerTour(entree, racine) {
  const k = cle(entree);
  if (!k) return;
  for (const f of [fichiersDe(racine, k), relancesDe(racine, k), lusDe(racine, k)]) {
    try {
      fs.unlinkSync(f);
    } catch (e) {
      // déjà effacé
    }
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

module.exports = { cle, dossierEtat, noter, lireTour, ecrireTour, ecrireRelances, marquerLus, effacerTour, racineGit };

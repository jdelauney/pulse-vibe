// Pulse – chemins sensibles, reconnus par les deux garde-fous (garde-commandes.js, garde-secrets.js).
//
// Un mot désigne un fichier .env quand, débarrassé de son habillage (valeur d'option --x=, @ ou < de curl,
// référence Git HEAD:, liste a,b), son nom est celui d'un fichier d'environnement (motifs.js),
// ou quand c'est un motif (*, ?, […], {a,b}) qui couvre un .env présent dans le dossier visé.
// Un motif qui commence par un point suivi d'une lettre écrite (.e*, {.env,x}) vise aussi les noms courants
// (.env, .env.local…), présents ou non ; .*rc vise seulement les fichiers présents.
// Le contrôle avant commit : .git/hooks/… et scripts/verifier.js.
"use strict";

const fs = require("fs");
const path = require("path");
const { estFichierEnv } = require("./motifs");

const NOMS_ENV_COURANTS = [".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local", ".env.test", ".env.envoi", ".dev.vars", ".envrc"];
const DOSSIERS_IGNORES = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", ".turbo", ".vercel"]);

const MESSAGE_CONTROLE =
  "Pulse demande votre accord : cette action modifie le contrôle des secrets avant commit (.git/hooks, .git/pulse, .git/config ou scripts/verifier.js). " +
  "Pour le remettre à jour, préférez `pulse-aidd installer-ci --forcer` puis `pulse-aidd installer-hook`.";

/** Les lectures possibles d'un mot : lui-même, la valeur d'une option, sans @ ni < de tête, la partie après « : » d'une référence Git, chaque élément d'une liste a,b. */
function candidats(mot) {
  const s = String(mot);
  const liste = [s];
  const egal = s.indexOf("=");
  if (egal >= 0) liste.push(s.slice(egal + 1));
  const optionPs = /^-[A-Za-z]+:(.+)$/.exec(s);
  if (optionPs) liste.push(optionPs[1]);
  for (const c of [...liste]) {
    if (/^[@<]/.test(c)) liste.push(c.slice(1));
    const deuxPoints = c.lastIndexOf(":");
    if (deuxPoints === 0 || deuxPoints > 1) liste.push(c.slice(deuxPoints + 1));
    if (c.includes(",")) liste.push(...c.split(","));
  }
  return [...new Set(liste)].filter(Boolean);
}

const estMotif = (s) => /[*?[]/.test(s) || /\{[^}]*,[^}]*\}/.test(s);

/** Vrai si le motif commence par un point suivi d'une lettre écrite (.e*, {.env,x}) : il vise aussi les noms courants absents. .*rc ou * : non. */
function viseNomsCourants(motif) {
  const accolades = /\{([^}]*)\}/.exec(motif);
  if (accolades) return accolades[1].split(",").some((p) => viseNomsCourants(motif.replace(accolades[0], p)));
  return /^\.[^*?[{]/.test(motif);
}

/** Expression régulière d'un motif de nom (bash, PowerShell, ripgrep) : *, ?, [abc], [!a], {a,b}. */
function motifVersRegex(motif, { pointCache = false } = {}) {
  let re = "";
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i];
    if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else if (c === "[") {
      const fin = motif.indexOf("]", i + 2);
      if (fin < 0) {
        re += "\\[";
        continue;
      }
      let classe = motif.slice(i + 1, fin).replace(/\\/g, "\\\\");
      if (/^[!^]/.test(classe)) classe = "^" + classe.slice(1);
      re += `[${classe}]`;
      i = fin;
    } else if (c === "{") {
      const fin = motif.indexOf("}", i);
      if (fin < 0) {
        re += "\\{";
        continue;
      }
      re += "(?:" + motif.slice(i + 1, fin).split(",").map((p) => motifVersRegex(p).source.slice(1, -1)).join("|") + ")";
      i = fin;
    } else re += c.replace(/[.+^$()|\\]/g, "\\$&");
  }
  // Règle de bash : un motif qui commence par *, ? ou [ ne couvre pas un nom caché.
  const debut = pointCache && /^[*?[]/.test(motif) ? "(?!\\.)" : "";
  try {
    return new RegExp(`^${debut}${re}$`, "i");
  } catch (e) {
    // Motif invalide (par exemple [z-a]) : lu comme un texte ordinaire.
    return new RegExp(`^${motif.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  }
}

/** Fichiers d'environnement présents directement dans un dossier (vide si illisible). */
function envDuDossier(dossier) {
  try {
    return fs.readdirSync(dossier).filter(estFichierEnv);
  } catch (e) {
    return [];
  }
}

/** Chemins (relatifs, avec « / ») des fichiers d'environnement du dossier et de ses sous-dossiers, sur `profondeur` niveaux. */
function envSous(dossier, profondeur, prefixe = "") {
  let entrees;
  try {
    entrees = fs.readdirSync(dossier, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  const trouves = entrees.filter((e) => !e.isDirectory() && estFichierEnv(e.name)).map((e) => prefixe + e.name);
  if (profondeur > 0) for (const e of entrees) if (e.isDirectory() && !DOSSIERS_IGNORES.has(e.name)) trouves.push(...envSous(path.join(dossier, e.name), profondeur - 1, prefixe + e.name + "/"));
  return trouves;
}

/** Vrai si le dossier, ou un sous-dossier sur `profondeur` niveaux, contient un fichier .env. */
function contientEnv(dossier, profondeur = 3) {
  return envSous(dossier, profondeur).length > 0;
}

/** Vrai si le mot désigne un fichier .env (voir l'en-tête). */
function designeEnv(mot, cwd = process.cwd(), dialecte = "bash") {
  for (const c of candidats(mot)) {
    if (estFichierEnv(c)) return true;
    if (!estMotif(c)) continue;
    const morceaux = c.split(/[\\/]/);
    const motifNom = morceaux.pop();
    const re = motifVersRegex(motifNom, { pointCache: dialecte === "bash" });
    const noms = [...envDuDossier(path.resolve(cwd, morceaux.join("/") || ".")), ...(viseNomsCourants(motifNom) ? NOMS_ENV_COURANTS : [])];
    if (noms.some((n) => re.test(n))) return true;
  }
  return false;
}

/** Outil Grep de Claude Code : un glob donné passe outre .gitignore. Vrai s'il couvre un .env (sous le dossier fouillé, ou un nom courant). */
function globCouvreEnv(glob, dossier) {
  const g = String(glob).trim();
  // Un filtre d'exclusion seul (!*.js) n'ajoute aucun fichier : ripgrep garde alors .gitignore (voir envNonIgnores).
  if (g.startsWith("!")) return false;
  const presents = envSous(dossier, 3);
  const segments = g.replace(/^(?:\.\/)+/, "").replace(/^\/+/, "").split("/");
  const nom = segments[segments.length - 1];
  const litteral = viseNomsCourants(nom);
  if (segments.length === 1) {
    const re = motifVersRegex(nom);
    const noms = [...presents.map((p) => p.split("/").pop()), ...(litteral ? NOMS_ENV_COURANTS : [])];
    return noms.some((n) => re.test(n) && estFichierEnv(n));
  }
  // Glob avec dossiers : il s'applique au chemin complet (« ** » = n'importe quels dossiers).
  const re = new RegExp(
    "^" +
      segments
        .map((s, i) => (s === "**" ? (i === segments.length - 1 ? ".*" : "(?:.*/)?") : motifVersRegex(s).source.slice(1, -1) + (i < segments.length - 1 ? "/" : "")))
        .join("") +
      "$",
    "i"
  );
  const dossierLitteral = segments.slice(0, -1).every((s) => !/[*?[{]/.test(s));
  const courants = litteral ? NOMS_ENV_COURANTS.map((n) => (dossierLitteral ? segments.slice(0, -1).join("/") + "/" : "") + n) : [];
  return [...presents, ...courants].some((p) => re.test(p) && estFichierEnv(p));
}

/**
 * Vrai si le chemin (ou la valeur d'option qui le porte) vise le contrôle des secrets avant commit :
 * le crochet (.git/hooks), sa copie de secours (.git/pulse), la configuration de Git qui peut le déplacer
 * (.git/config, core.hooksPath) et scripts/verifier.js.
 */
function estControleAvantCommit(chemin) {
  return candidats(chemin).some((c) => {
    const n = path.posix.normalize(c.replace(/\\/g, "/")).replace(/[. ]+$/, "");
    return /(^|\/)\.git\/(hooks|pulse)(\/|$)/i.test(n) || /(^|\/)\.git\/config$/i.test(n) || /(^|\/)scripts\/verifier\.js$/i.test(n);
  });
}

module.exports = { candidats, motifVersRegex, designeEnv, globCouvreEnv, contientEnv, envDuDossier, estControleAvantCommit, MESSAGE_CONTROLE, NOMS_ENV_COURANTS };

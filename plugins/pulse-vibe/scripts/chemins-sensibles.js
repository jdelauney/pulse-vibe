// Pulse – chemins sensibles, reconnus par les deux garde-fous (garde-commandes.js, garde-secrets.js).
//
// Un mot désigne un fichier .env quand, débarrassé de son habillage (valeur d'option --x=, @ ou < de curl,
// référence Git HEAD:, liste a,b), son nom est celui d'un fichier d'environnement (motifs.js),
// ou quand c'est un motif (*, ?, […], {a,b}) qui couvre un .env présent dans le dossier visé.
// Un motif qui commence par un caractère littéral (.e*, {.env,x}) vise aussi les noms courants
// (.env, .env.local…), présents ou non.
// Le contrôle avant commit : .git/hooks/… et scripts/verifier.js.
"use strict";

const fs = require("fs");
const path = require("path");
const { estFichierEnv } = require("./motifs");

const NOMS_ENV_COURANTS = [".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local", ".env.test", ".env.envoi", ".dev.vars", ".envrc"];
const DOSSIERS_IGNORES = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", ".turbo", ".vercel"]);

const MESSAGE_CONTROLE =
  "Pulse demande votre accord : cette action modifie le contrôle des secrets avant commit (.git/hooks ou scripts/verifier.js). " +
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
  return new RegExp(`^${pointCache && /^[*?[]/.test(motif) ? "(?!\\.)" : ""}${re}$`, "i");
}

/** Fichiers d'environnement présents directement dans un dossier (vide si illisible). */
function envDuDossier(dossier) {
  try {
    return fs.readdirSync(dossier).filter(estFichierEnv);
  } catch (e) {
    return [];
  }
}

/** Fichiers d'environnement du dossier et de ses sous-dossiers, sur `profondeur` niveaux. */
function envSous(dossier, profondeur) {
  let entrees;
  try {
    entrees = fs.readdirSync(dossier, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  const trouves = entrees.filter((e) => !e.isDirectory() && estFichierEnv(e.name)).map((e) => e.name);
  if (profondeur > 0) for (const e of entrees) if (e.isDirectory() && !DOSSIERS_IGNORES.has(e.name)) trouves.push(...envSous(path.join(dossier, e.name), profondeur - 1));
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
    const noms = [...envDuDossier(path.resolve(cwd, morceaux.join("/") || ".")), ...(/^[*?[]/.test(motifNom) ? [] : NOMS_ENV_COURANTS)];
    if (noms.some((n) => re.test(n))) return true;
  }
  return false;
}

/** Outil Grep de Claude Code : un glob donné passe outre .gitignore. Vrai s'il couvre un .env (sous le dossier fouillé, ou un nom courant). */
function globCouvreEnv(glob, dossier) {
  const g = String(glob).trim();
  const presents = envSous(dossier, 3);
  if (g.startsWith("!")) return presents.length > 0;
  const nom = g.split("/").pop();
  const re = motifVersRegex(nom);
  const noms = [...presents, ...(/^[*?[]/.test(nom) ? [] : NOMS_ENV_COURANTS)];
  return noms.some((n) => re.test(n) && estFichierEnv(n));
}

/** Vrai si le chemin (ou la valeur d'option qui le porte) vise le contrôle des secrets avant commit. */
function estControleAvantCommit(chemin) {
  return candidats(chemin).some((c) => /(^|[\\/])\.git[\\/]hooks([\\/]|$)/i.test(c) || /(^|[\\/])scripts[\\/]verifier\.js$/i.test(c));
}

module.exports = { candidats, motifVersRegex, designeEnv, globCouvreEnv, contientEnv, envDuDossier, estControleAvantCommit, MESSAGE_CONTROLE, NOMS_ENV_COURANTS };

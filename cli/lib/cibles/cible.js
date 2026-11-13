// Une cible = un outil d'IA à équiper. Chaque outil a sa classe (codex.js, cursor.js, opencode.js, copilot.js).
"use strict";

const fs = require("fs");
const path = require("path");
const { maison } = require("../chemins");

/** Vrai si une commande est trouvée dans le PATH (avec ses extensions sous Windows). */
function surPath(nom) {
  const extensions = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat", ".ps1"] : [""];
  for (const dossier of (process.env.PATH || "").split(path.delimiter)) {
    if (!dossier) continue;
    for (const ext of extensions) {
      try {
        if (fs.statSync(path.join(dossier, nom + ext)).isFile()) return true;
      } catch {
        // absente de ce dossier
      }
    }
  }
  return false;
}

class Cible {
  /** Identifiant (option --outil). */
  get id() {
    throw new Error("id à définir");
  }

  /** Nom affiché à la personne. */
  get libelle() {
    throw new Error("libelle à définir");
  }

  /** Comment la personne lance une commande Pulse dans cet outil. */
  appel(commande) {
    return `/pulse-${commande}`;
  }

  /** Commandes et dossiers qui signalent l'outil sur cette machine. */
  get indices() {
    return { commandes: [], dossiers: [] };
  }

  detecter() {
    const { commandes, dossiers } = this.indices;
    return commandes.some(surPath) || dossiers.some((d) => fs.existsSync(path.join(maison(), d)));
  }

  /** Un dossier de configuration de l'outil : la variable d'environnement qui le déplace, sinon sous le dossier personnel. */
  dossier(variable, ...parDefaut) {
    if (!process.env.PULSEIA_MAISON && variable && process.env[variable]) return process.env[variable];
    return path.join(maison(), ...parDefaut);
  }

  /** Fichiers d'un sous-agent : [{ chemin, contenu }]. */
  fichiersAgent(_agent) {
    return [];
  }

  /** Fichiers propres à l'outil pour une commande, en plus du skill commun : [{ chemin, contenu }]. */
  fichiersCommande(_commande) {
    return [];
  }
}

module.exports = { Cible, surPath };

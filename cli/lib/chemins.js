// Emplacements utilisés par pulseia : le contenu embarqué (plugins pulse et pulse-next) et les dossiers de la personne.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const PAQUET = path.join(__dirname, "..");

/** Les packs de pile installables, par identifiant : leur dossier de plugin. */
const PACKS = { next: "pulse-vibe-next" };
const COEUR = "pulse-vibe";

/** Le dossier des plugins : contenu/ dans le paquet publié, plugins/ du dépôt pendant le développement. */
function racineContenu() {
  const embarque = path.join(PAQUET, "contenu");
  if (fs.existsSync(path.join(embarque, COEUR))) return embarque;
  return path.join(PAQUET, "..", "plugins");
}

/** Le dossier personnel ; PULSEIA_MAISON le remplace (tests). */
const maison = () => process.env.PULSEIA_MAISON || os.homedir();

/** Le dossier de pulseia : registre d'installation et réglages. */
const dossierPulseia = () => path.join(maison(), ".pulseia");

function lireJson(fichier, defaut) {
  try {
    return JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch {
    return defaut;
  }
}

/** Version d'un plugin embarqué (son .claude-plugin/plugin.json). */
function versionPlugin(dossier) {
  return lireJson(path.join(racineContenu(), dossier, ".claude-plugin", "plugin.json"), {}).version || "?";
}

const versionPaquet = () => lireJson(path.join(PAQUET, "package.json"), {}).version || "?";

module.exports = { PAQUET, PACKS, COEUR, racineContenu, maison, dossierPulseia, lireJson, versionPlugin, versionPaquet };

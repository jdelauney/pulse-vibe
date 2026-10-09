// Pulse – au démarrage d'une session (appelé par memoire.js) : version installée en retard, catalogue pas
// actualisé depuis longtemps, installation restée sous un ancien nom.
//
// Sans réseau : compare les fichiers locaux de Claude Code (<dossier Claude>/plugins/known_marketplaces.json et
// installed_plugins.json) à la copie locale du catalogue. Cette copie s'actualise seulement par
// `claude plugin marketplace update <catalogue>` ou par la mise à jour automatique : d'où l'alerte sur un
// catalogue ancien. Ces fichiers ne sont pas une interface publique de Claude Code : une forme inattendue
// donne « rien à signaler », jamais une erreur.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const JOURS_CATALOGUE = 14;
const JOUR = 24 * 60 * 60 * 1000;

function lireJson(fichier) {
  try {
    return JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch {
    return null;
  }
}

/** -1, 0 ou 1 entre deux versions « x.y.z » ; un morceau manquant ou illisible compte pour 0. */
function comparerVersions(a, b) {
  const n = (v) => String(v ?? "").split(/[.+-]/).slice(0, 3).map((x) => Number.parseInt(x, 10) || 0);
  const [x, y] = [n(a), n(b)];
  for (let i = 0; i < 3; i++) {
    const [u, v] = [x[i] ?? 0, y[i] ?? 0];
    if (u !== v) return u < v ? -1 : 1;
  }
  return 0;
}

/** Installations d'un plugin qui valent pour ce projet : portée utilisateur, ou portée projet ou locale de ce dossier. */
function installationsUtiles(entrees, projet) {
  const meme = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
  return (Array.isArray(entrees) ? entrees : []).filter(
    (e) => e && typeof e === "object" && (e.scope === "user" || (projet && typeof e.projectPath === "string" && meme(e.projectPath, projet))),
  );
}

/** Lignes à ajouter au contexte de la session ; un tableau vide : rien à signaler. */
function avertissementsVersion({ racinePlugin, dossierClaude, projet = null, maintenant = Date.now() }) {
  const manifeste = lireJson(path.join(racinePlugin, ".claude-plugin", "plugin.json"));
  if (!manifeste || typeof manifeste.name !== "string") return [];
  const marches = lireJson(path.join(dossierClaude, "plugins", "known_marketplaces.json"));
  const installes = lireJson(path.join(dossierClaude, "plugins", "installed_plugins.json"))?.plugins;
  if (!marches || typeof marches !== "object" || !installes || typeof installes !== "object" || Array.isArray(installes)) return [];
  const lignes = [];
  for (const [marche, infos] of Object.entries(marches)) {
    const dossier = infos?.installLocation;
    if (typeof dossier !== "string") continue;
    const catalogue = lireJson(path.join(dossier, ".claude-plugin", "marketplace.json"));
    const plugins = Array.isArray(catalogue?.plugins) ? catalogue.plugins.filter((p) => p && typeof p.name === "string") : [];
    if (!plugins.some((p) => p.name === manifeste.name)) continue;
    const utiles = (nom) => installationsUtiles(installes[`${nom}@${marche}`], projet);

    const retards = [];
    for (const p of plugins) {
      if (typeof p.source !== "string") continue;
      const publiee = lireJson(path.join(dossier, p.source, ".claude-plugin", "plugin.json"))?.version;
      if (typeof publiee !== "string") continue;
      const installee = utiles(p.name).map((e) => e.version).find((v) => comparerVersions(v, publiee) < 0);
      if (installee) retards.push({ nom: p.name, installee, publiee });
    }
    if (retards.length) {
      const versions = retards.map((r) => `${r.nom} ${r.publiee} (installé : ${r.installee})`).join(", ");
      const commandes = retards.map((r) => `\`claude plugin update ${r.nom}@${marche}\``).join(", puis ");
      lignes.push(`Pulse – mise à jour disponible : ${versions}. Dans un terminal : ${commandes}, puis fermer et relancer Claude Code.`);
    }

    const jours = Math.floor((maintenant - Date.parse(infos.lastUpdated)) / JOUR);
    if (jours >= JOURS_CATALOGUE) {
      lignes.push(`Pulse – le catalogue ${marche} n'a pas été actualisé depuis ${jours} jours : une version plus récente existe peut-être. Dans un terminal : \`claude plugin marketplace update ${marche}\` ; la session suivante dira quoi mettre à jour.`);
    }

    for (const [ancien, nouveau] of Object.entries(catalogue.renames ?? {})) {
      if (utiles(ancien).length === 0) continue;
      lignes.push(
        utiles(nouveau).length > 0
          ? `Pulse – ${ancien}@${marche} (ancien nom) est encore installé à côté de ${nouveau}@${marche} : ses anciens garde-fous tournent en plus des nouveaux. Dans un terminal : \`claude plugin uninstall ${ancien}@${marche}\`, puis fermer et relancer Claude Code.`
          : `Pulse – installé sous l'ancien nom ${ancien}@${marche}. Dans un terminal : \`claude plugin install ${nouveau}@${marche}\`, puis \`claude plugin uninstall ${ancien}@${marche}\`, puis fermer et relancer Claude Code.`,
      );
    }
  }
  if (lignes.length) lignes.push("Dites-le à la personne dès votre première réponse, en une phrase, avec la commande à taper.");
  return lignes;
}

/** Le dossier de Claude Code : CLAUDE_CONFIG_DIR, sinon ~/.claude. */
const dossierClaudeParDefaut = () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");

module.exports = { comparerVersions, installationsUtiles, avertissementsVersion, dossierClaudeParDefaut, JOURS_CATALOGUE };

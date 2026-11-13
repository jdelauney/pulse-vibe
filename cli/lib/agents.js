// Les sous-agents du cœur (agents/*.md, format Claude Code), lus une fois pour toutes les cibles.
"use strict";

const fs = require("fs");
const path = require("path");
const { lireFrontmatter, valeur, reecrire } = require("./textes");

/** Effort de raisonnement par modèle Claude, pour les outils qui le règlent (Codex). */
const EFFORT = { opus: "high", sonnet: "medium", haiku: "low" };

class Agent {
  constructor(nom, texte) {
    const { champs, corps } = lireFrontmatter(texte);
    this.nom = nom;
    this.description = reecrire(valeur(champs.get("description")) || "");
    this.instructions = reecrire(corps).trim();
    const tools = valeur(champs.get("tools"));
    const interdits = valeur(champs.get("disallowedTools"));
    const ecrit = (liste) => /\b(Write|Edit)\b/.test(liste || "");
    /** Vrai quand l'agent lit sans écrire : outils listés sans Write ni Edit, ou Write et Edit interdits. */
    this.lectureSeule = tools !== undefined ? !ecrit(tools) : /\bWrite\b/.test(interdits || "") && /\bEdit\b/.test(interdits || "");
    this.modele = valeur(champs.get("model")) || "inherit";
    this.effort = valeur(champs.get("effort")) || EFFORT[this.modele];
  }

  get nomPortable() {
    return `pulse-${this.nom}`;
  }

  /** Consigne ajoutée pour les outils qui ne savent pas restreindre l'écriture d'un sous-agent. */
  static get CONSIGNE_LECTURE_SEULE() {
    return "Travailler en lecture seule : lire, chercher et lancer des commandes qui ne modifient aucun fichier ; rapporter à l'appelant les modifications à faire.";
  }
}

/** Les agents d'un plugin (dossier agents/). */
function lireAgents(dossierPlugin) {
  const dossier = path.join(dossierPlugin, "agents");
  if (!fs.existsSync(dossier)) return [];
  return fs
    .readdirSync(dossier)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => new Agent(f.slice(0, -3), fs.readFileSync(path.join(dossier, f), "utf8")));
}

module.exports = { Agent, lireAgents, EFFORT };

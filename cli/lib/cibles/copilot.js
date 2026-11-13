// GitHub Copilot (CLI et VS Code) : agents ~/.copilot/agents/*.agent.md, outils par alias.
"use strict";

const fs = require("fs");
const path = require("path");
const { Cible } = require("./cible");
const { maison } = require("../chemins");
const { yaml } = require("../textes");

/** Alias d'outils de Copilot : sans `edit` pour un agent en lecture seule, sans `agent` (un sous-agent ne délègue pas). */
const OUTILS = { lecture: ["read", "search", "execute", "web"], ecriture: ["read", "search", "edit", "execute", "web", "todo"] };

class Copilot extends Cible {
  get id() {
    return "copilot";
  }

  get libelle() {
    return "GitHub Copilot";
  }

  get indices() {
    return { commandes: ["copilot"], dossiers: [".copilot"] };
  }

  detecter() {
    if (super.detecter()) return true;
    // Extension Copilot de VS Code.
    try {
      return fs.readdirSync(path.join(maison(), ".vscode", "extensions")).some((d) => /^github\.copilot/.test(d));
    } catch {
      return false;
    }
  }

  fichiersAgent(agent) {
    const outils = (agent.lectureSeule ? OUTILS.lecture : OUTILS.ecriture).map((o) => `'${o}'`).join(", ");
    const entete = ["---", `name: ${agent.nomPortable}`, `description: ${yaml(agent.description)}`, `tools: [${outils}]`, "---"];
    return [{ chemin: path.join(this.dossier("COPILOT_HOME", ".copilot"), "agents", `${agent.nomPortable}.agent.md`), contenu: `${entete.join("\n")}\n\n${agent.instructions}\n` }];
  }
}

module.exports = { Copilot, OUTILS };

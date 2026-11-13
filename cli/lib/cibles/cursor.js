// Cursor : sous-agents Markdown (~/.cursor/agents/), lecture seule par readonly, modèle hérité.
"use strict";

const path = require("path");
const { Cible } = require("./cible");
const { yaml } = require("../textes");

class Cursor extends Cible {
  get id() {
    return "cursor";
  }

  get libelle() {
    return "Cursor";
  }

  get indices() {
    return { commandes: ["cursor", "cursor-agent"], dossiers: [".cursor"] };
  }

  fichiersAgent(agent) {
    const entete = ["---", `name: ${agent.nomPortable}`, `description: ${yaml(agent.description)}`, "model: inherit", `readonly: ${agent.lectureSeule}`, "---"];
    return [{ chemin: path.join(this.dossier(null, ".cursor", "agents"), `${agent.nomPortable}.md`), contenu: `${entete.join("\n")}\n\n${agent.instructions}\n` }];
  }
}

module.exports = { Cursor };

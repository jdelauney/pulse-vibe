// OpenCode : sous-agents Markdown (mode subagent, permissions), et une commande /pulse-<commande> par skill :
// ses commandes gardent $ARGUMENTS et l'injection !`pulse-aidd contexte …`, comme Claude Code.
"use strict";

const path = require("path");
const { Cible } = require("./cible");
const { lireFrontmatter, valeur, reecrire, yaml } = require("../textes");

class OpenCode extends Cible {
  get id() {
    return "opencode";
  }

  get libelle() {
    return "OpenCode";
  }

  get indices() {
    return { commandes: ["opencode"], dossiers: [path.join(".config", "opencode")] };
  }

  get racine() {
    if (!process.env.PULSEIA_MAISON && process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, "opencode");
    return this.dossier(null, ".config", "opencode");
  }

  fichiersAgent(agent) {
    const entete = ["---", `description: ${yaml(agent.description)}`, "mode: subagent"];
    if (agent.lectureSeule) entete.push("permissions:", "  - action: edit", '    resource: "*"', "    effect: deny");
    entete.push("---");
    return [{ chemin: path.join(this.racine, "agents", `${agent.nomPortable}.md`), contenu: `${entete.join("\n")}\n\n${agent.instructions}\n` }];
  }

  fichiersCommande(commande) {
    const { champs, corps } = lireFrontmatter(commande.original);
    const entete = ["---", `description: ${yaml(reecrire(valeur(champs.get("description")) || ""))}`, "---"];
    return [{ chemin: path.join(this.racine, "commands", `pulse-${commande.nom}.md`), contenu: `${entete.join("\n")}\n\n${reecrire(corps).trim()}\n` }];
  }
}

module.exports = { OpenCode };

// OpenAI Codex : sous-agents en TOML (~/.codex/agents/), skills appelés par $nom, invocation implicite coupée par agents/openai.yaml.
"use strict";

const path = require("path");
const { Cible } = require("./cible");
const { Agent } = require("../agents");

/** Une chaîne TOML : littérale sur plusieurs lignes quand c'est possible (aucun échappement), sinon de base. */
function tomlMultiligne(texte) {
  if (!texte.includes("'''")) return `'''\n${texte}\n'''`;
  return `"""\n${texte.replace(/\\/g, "\\\\").replace(/"""/g, '""\\"')}\n"""`;
}

class Codex extends Cible {
  get id() {
    return "codex";
  }

  get libelle() {
    return "OpenAI Codex";
  }

  appel(commande) {
    return `$pulse-${commande}`;
  }

  get indices() {
    return { commandes: ["codex"], dossiers: [".codex"] };
  }

  get dossierAgents() {
    return path.join(this.dossier("CODEX_HOME", ".codex"), "agents");
  }

  fichiersAgent(agent) {
    const instructions = agent.lectureSeule ? `${Agent.CONSIGNE_LECTURE_SEULE}\n\n${agent.instructions}` : agent.instructions;
    const lignes = [`name = ${JSON.stringify(agent.nomPortable)}`, `description = ${JSON.stringify(agent.description)}`];
    if (agent.effort) lignes.push(`model_reasoning_effort = ${JSON.stringify(agent.effort)}`);
    lignes.push(`developer_instructions = ${tomlMultiligne(instructions)}`);
    return [{ chemin: path.join(this.dossierAgents, `${agent.nomPortable}.toml`), contenu: `${lignes.join("\n")}\n` }];
  }

  fichiersCommande(commande) {
    if (!commande.manuelleSeulement) return [];
    return [
      {
        chemin: path.join(commande.dossierSkill, "agents", "openai.yaml"),
        contenu: "policy:\n  allow_implicit_invocation: false\n",
      },
    ];
  }
}

module.exports = { Codex, tomlMultiligne };

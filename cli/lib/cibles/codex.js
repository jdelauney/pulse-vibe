// OpenAI Codex : sous-agents en TOML (~/.codex/agents/), skills appelés par $nom, invocation implicite coupée par agents/openai.yaml.
"use strict";

const path = require("path");
const { Cible, shellClaude, PASSE, args } = require("./cible");
const { idSur, entreesPatch, refusAccord, refusReecriture } = require("../gardes");
const FUSIONS = require("../fusions");
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

  /** Hooks dans ~/.codex/hooks.json, partagé avec la personne : fusionné (fusions.js). */
  fichiersHooks() {
    return [{ chemin: path.join(this.dossier("CODEX_HOME", ".codex"), "hooks.json"), fusion: FUSIONS["codex-hooks"] }];
  }

  /** Bash (commande ou exec_command) et apply_patch (texte du patch dans tool_input.command) ; Stop. */
  entreeHook(evenement, brut) {
    const base = { session_id: idSur(brut.session_id), cwd: brut.cwd, hook_event_name: evenement };
    const ti = args(brut.tool_input);
    if (evenement === "PreToolUse" || evenement === "PostToolUse") {
      const etape = evenement === "PreToolUse" ? "avant" : "apres";
      if (brut.tool_name === "Bash") return etape === "avant" ? { etape, entrees: [{ ...base, tool_name: shellClaude(), tool_input: { command: String(ti.command || "") } }] } : null;
      if (["apply_patch", "Edit", "Write"].includes(brut.tool_name)) return { etape, entrees: entreesPatch(ti.command || ti.patch || ti.input, base) };
      return null;
    }
    if (evenement === "Stop") return { etape: "fin", entrees: [{ ...base, stop_hook_active: brut.stop_hook_active === true }] };
    return null;
  }

  /** Codex ignore « ask » et le remplacement de commande : les deux deviennent un refus expliqué. */
  sortieHook(evenement, r) {
    if (evenement === "PreToolUse") {
      const d = r.decision === "ask" ? refusAccord(r) : r.decision === "allow" && r.commande ? refusReecriture(r) : r;
      if (d.decision !== "deny") return PASSE;
      return { sortie: JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: d.raison } }), code: 0 };
    }
    if (evenement === "Stop") {
      const raison = r.bloquer || r.contexte;
      return raison ? { sortie: JSON.stringify({ decision: "block", reason: raison }), code: 0 } : PASSE;
    }
    return PASSE;
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

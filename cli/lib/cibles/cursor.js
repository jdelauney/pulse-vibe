// Cursor : sous-agents Markdown (~/.cursor/agents/), lecture seule par readonly, modèle hérité.
"use strict";

const path = require("path");
const { Cible, shellClaude, args } = require("./cible");
const { idSur, refusAccord, refusReecriture } = require("../gardes");
const FUSIONS = require("../fusions");
const { yaml } = require("../textes");

class Cursor extends Cible {
  get id() {
    return "cursor";
  }

  get libelle() {
    return "Cursor";
  }

  /** Hooks dans ~/.cursor/hooks.json, partagé avec la personne : fusionné (fusions.js). */
  fichiersHooks() {
    return [{ chemin: path.join(this.dossier(null, ".cursor"), "hooks.json"), fusion: FUSIONS["cursor-hooks"] }];
  }

  /**
   * beforeShellExecution (commande, avec « ask »), beforeReadFile (lecture), preToolUse (Write et Grep),
   * afterFileEdit (relevé du tour), stop (contrôle de fin de tour).
   */
  entreeHook(evenement, brut) {
    const cwd = brut.cwd || (Array.isArray(brut.workspace_roots) && brut.workspace_roots[0]) || process.env.CURSOR_PROJECT_DIR;
    const base = { session_id: idSur(brut.conversation_id), cwd, hook_event_name: evenement };
    const ti = args(brut.tool_input);
    const chemin = (o) => o.file_path || o.path || o.target_file || o.filePath;
    switch (evenement) {
      case "beforeShellExecution":
        return { etape: "avant", entrees: [{ ...base, tool_name: shellClaude(), tool_input: { command: String(brut.command || "") } }] };
      case "beforeReadFile":
        return brut.file_path ? { etape: "avant", entrees: [{ ...base, tool_name: "Read", tool_input: { file_path: brut.file_path } }] } : null;
      case "preToolUse":
        if (brut.tool_name === "Write" && chemin(ti))
          return { etape: "avant", entrees: [{ ...base, tool_name: "Write", tool_input: { file_path: chemin(ti), content: String(ti.content ?? ti.contents ?? ti.code_edit ?? ti.new_string ?? ti.newString ?? "") } }] };
        if (brut.tool_name === "Grep") return { etape: "avant", entrees: [{ ...base, tool_name: "Grep", tool_input: { pattern: ti.pattern, path: ti.path, glob: ti.glob } }] };
        return null;
      case "afterFileEdit": {
        const ajouts = (Array.isArray(brut.edits) ? brut.edits : []).map((e) => (e && e.new_string) || "").join("\n");
        return brut.file_path ? { etape: "apres", entrees: [{ ...base, tool_name: "Edit", tool_input: { file_path: brut.file_path, old_string: "", new_string: ajouts } }] } : null;
      }
      case "stop":
        return { etape: "fin", entrees: [{ ...base, hook_event_name: "Stop", stop_hook_active: Number(brut.loop_count) > 0 }] };
      default:
        return null;
    }
  }

  /** Toujours un JSON valide (un JSON invalide bloque) ; « ask » seulement pour beforeShellExecution. */
  sortieHook(evenement, r) {
    const json = (o) => ({ sortie: JSON.stringify(o), code: 0 });
    if (evenement === "afterFileEdit") return json({});
    if (evenement === "stop") {
      const raison = r.bloquer || r.contexte;
      return json(raison ? { followup_message: raison } : {});
    }
    let d = r.decision === "allow" && r.commande ? refusReecriture(r) : r;
    if (d.decision === "ask" && evenement !== "beforeShellExecution") d = refusAccord(d);
    if (d.decision === "deny" || d.decision === "ask") {
      const sortie = { permission: d.decision, user_message: d.raison };
      if (evenement !== "beforeReadFile") sortie.agent_message = d.raison;
      return json(sortie);
    }
    return json({ permission: "allow" });
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

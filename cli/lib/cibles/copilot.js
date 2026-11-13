// GitHub Copilot (CLI et VS Code) : agents ~/.copilot/agents/*.agent.md, outils par alias.
"use strict";

const fs = require("fs");
const path = require("path");
const { Cible, shellClaude, PASSE, args } = require("./cible");
const { idSur, entreesPatch, refusReecriture } = require("../gardes");
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

  /**
   * ~/.copilot/hooks/pulse.json, à Pulse seul. Noms d'événements en PascalCase : Copilot envoie alors l'entrée au format
   * Claude Code (Bash, Read, Write, Edit). Une commande en erreur bloque l'appel dans Copilot : « || true » et « exit 0 »
   * laissent passer si pulseia manque (désinstallé par npm sans pulseia desinstaller).
   */
  fichiersHooks() {
    const entree = (evenement, matcher, delai) => ({
      type: "command",
      bash: `pulseia hook copilot ${evenement} || true`,
      powershell: `pulseia hook copilot ${evenement}; exit 0`,
      ...(matcher ? { matcher } : {}),
      timeoutSec: delai,
    });
    const config = {
      version: 1,
      hooks: {
        PreToolUse: [entree("PreToolUse", "Bash|Read|Write|Edit|Grep", 20)],
        PostToolUse: [entree("PostToolUse", "Write|Edit", 20)],
        Stop: [entree("Stop", null, 90)],
      },
    };
    return [{ chemin: path.join(this.dossier("COPILOT_HOME", ".copilot"), "hooks", "pulse.json"), contenu: `${JSON.stringify(config, null, 2)}
` }];
  }

  entreeHook(evenement, brut) {
    const base = { session_id: idSur(brut.session_id || brut.sessionId), cwd: brut.cwd, hook_event_name: evenement };
    const ti = args(brut.tool_input ?? brut.toolArgs);
    const chemin = ti.file_path || ti.path || ti.filePath;
    const patch = typeof ti.input === "string" && ti.input.includes("*** Begin Patch") ? ti.input : typeof ti.patch === "string" ? ti.patch : null;
    if (evenement === "PreToolUse" || evenement === "PostToolUse") {
      const etape = evenement === "PreToolUse" ? "avant" : "apres";
      const outil = brut.tool_name;
      if (outil === "Bash") return etape === "avant" ? { etape, entrees: [{ ...base, tool_name: shellClaude(), tool_input: { command: String(ti.command || "") } }] } : null;
      if (outil === "Read" || outil === "Grep") return etape === "avant" ? { etape, entrees: [{ ...base, tool_name: outil, tool_input: outil === "Read" ? { file_path: chemin } : { pattern: ti.pattern, path: ti.path, glob: ti.glob } }] } : null;
      if ((outil === "Edit" || outil === "Write") && patch) return { etape, entrees: entreesPatch(patch, base) };
      if (outil === "Write" && chemin) return { etape, entrees: [{ ...base, tool_name: "Write", tool_input: { file_path: chemin, content: String(ti.content ?? ti.file_text ?? "") } }] };
      if (outil === "Edit" && chemin) return { etape, entrees: [{ ...base, tool_name: "Edit", tool_input: { file_path: chemin, old_string: String(ti.old_string ?? ti.old_str ?? ""), new_string: String(ti.new_string ?? ti.new_str ?? "") } }] };
      return null;
    }
    if (evenement === "Stop") return { etape: "fin", entrees: [{ ...base, stop_hook_active: brut.stop_hook_active === true }] };
    return null;
  }

  /** Décision à plat (permissionDecision au premier niveau) ; « ask » pris en charge ; pas de remplacement de commande. */
  sortieHook(evenement, r) {
    if (evenement === "PreToolUse") {
      const d = r.decision === "allow" && r.commande ? refusReecriture(r) : r;
      if (d.decision !== "deny" && d.decision !== "ask") return PASSE;
      return { sortie: JSON.stringify({ permissionDecision: d.decision, permissionDecisionReason: d.raison }), code: 0 };
    }
    if (evenement === "Stop") {
      const raison = r.bloquer || r.contexte;
      return raison ? { sortie: JSON.stringify({ decision: "block", reason: raison }), code: 0 } : PASSE;
    }
    return PASSE;
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

// OpenCode : sous-agents Markdown (mode subagent, permissions), et une commande /pulse-<commande> par skill :
// ses commandes gardent $ARGUMENTS et l'injection !`pulse-aidd contexte …`, comme Claude Code.
"use strict";

const fs = require("fs");
const path = require("path");
const { Cible, PASSE, args } = require("./cible");
const { idSur, entreesPatch, refusAccord, refusReecriture } = require("../gardes");
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

  /** Un plugin OpenCode (V2 et V1), chargé seul depuis ~/.config/opencode/plugins/ : il appelle pulseia hook opencode. */
  fichiersHooks() {
    return [{ chemin: path.join(this.racine, "plugins", "pulse-garde-fous.js"), contenu: fs.readFileSync(path.join(__dirname, "..", "modeles", "opencode-garde-fous.mjs"), "utf8") }];
  }

  /** Événements du plugin : execute.before, execute.after (outil et arguments d'OpenCode), session.idle. */
  entreeHook(evenement, brut) {
    const base = { session_id: idSur(brut.sessionID), cwd: brut.cwd, hook_event_name: evenement };
    const i = args(brut.input);
    const chemin = i.path || i.filePath || i.file_path;
    const outil = String(brut.tool || "");
    if (evenement === "execute.before" || evenement === "execute.after") {
      const etape = evenement === "execute.before" ? "avant" : "apres";
      if (outil === "shell" || outil === "bash") return etape === "avant" ? { etape, entrees: [{ ...base, tool_name: "Bash", tool_input: { command: String(i.command || "") } }] } : null;
      if (outil === "read") return etape === "avant" && chemin ? { etape, entrees: [{ ...base, tool_name: "Read", tool_input: { file_path: chemin } }] } : null;
      if (outil === "grep") return etape === "avant" ? { etape, entrees: [{ ...base, tool_name: "Grep", tool_input: { pattern: i.pattern, path: i.path, glob: i.include || i.glob } }] } : null;
      if (outil === "write" && chemin) return { etape, entrees: [{ ...base, tool_name: "Write", tool_input: { file_path: chemin, content: String(i.content ?? "") } }] };
      if (outil === "edit" && chemin) return { etape, entrees: [{ ...base, tool_name: "Edit", tool_input: { file_path: chemin, old_string: String(i.oldString ?? ""), new_string: String(i.newString ?? "") } }] };
      if (outil === "patch" || outil === "apply_patch") return { etape, entrees: entreesPatch(i.patchText || i.patch || i.input, base) };
      return null;
    }
    if (evenement === "session.idle") return { etape: "fin", entrees: [{ ...base, hook_event_name: "Stop" }] };
    return null;
  }

  /** Réponse lue par le plugin : { refus } (l'appel échoue avec ce message) ou { relance } (message renvoyé à l'agent). */
  sortieHook(evenement, r) {
    if (evenement === "execute.before") {
      const d = r.decision === "ask" ? refusAccord(r) : r.decision === "allow" && r.commande ? refusReecriture(r) : r;
      return d.decision === "deny" ? { sortie: JSON.stringify({ refus: d.raison }), code: 0 } : PASSE;
    }
    if (evenement === "session.idle") {
      const raison = r.bloquer || r.contexte;
      return raison ? { sortie: JSON.stringify({ relance: raison }), code: 0 } : PASSE;
    }
    return PASSE;
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

// Pulse – garde-fous pour OpenCode, posé par pulseia dans ~/.config/opencode/plugins/pulse-garde-fous.js
// (retiré par « pulseia desinstaller »). Chaque appel d'outil passe par « pulseia hook opencode … », qui applique
// les garde-fous de la méthode Pulse (clés secrètes, fichiers .env, commandes qui détruisent ou publient)
// dans les seuls projets Pulse. Pulse absent ou en erreur : l'appel passe.
// Format V2 (id, setup) et V1 (server) dans le même export, comme le permet OpenCode.
import { spawnSync } from "node:child_process";

const WINDOWS = process.platform === "win32";

/** Lance pulseia hook opencode <événement> ; rend sa réponse JSON ({ refus } ou { relance }), ou {}. */
function pulse(evenement, donnees) {
  try {
    const options = { input: JSON.stringify(donnees), encoding: "utf8", timeout: 95000, windowsHide: true };
    // Sous Windows, le shell trouve pulseia.cmd ; la commande est fixe, les données passent par l'entrée standard.
    const r = WINDOWS ? spawnSync(`pulseia hook opencode ${evenement}`, { ...options, shell: true }) : spawnSync("pulseia", ["hook", "opencode", evenement], options);
    return r.stdout ? JSON.parse(r.stdout) : {};
  } catch {
    return {};
  }
}

function avant(tool, input, sessionID, cwd) {
  const r = pulse("execute.before", { tool, input, sessionID, cwd });
  if (r && r.refus) throw new Error(r.refus);
}

const apres = (tool, input, sessionID, cwd) => pulse("execute.after", { tool, input, sessionID, cwd });

export default {
  id: "pulseia.garde-fous",
  async setup(ctx) {
    const cwd = () => (ctx && ctx.location && ctx.location.directory) || process.cwd();
    await ctx.tool.hook("execute.before", (event) => avant(event.tool, event.input || {}, event.sessionID, cwd()));
    await ctx.tool.hook("execute.after", (event) => {
      apres(event.tool, event.input || {}, event.sessionID, cwd());
    });
    if (ctx.event && typeof ctx.event.subscribe === "function") {
      (async () => {
        for await (const event of ctx.event.subscribe({})) {
          if (!event || event.type !== "session.idle") continue;
          const sessionID = event.sessionID || (event.properties && event.properties.sessionID);
          const r = pulse("session.idle", { sessionID, cwd: cwd() });
          if (r && r.relance && sessionID && ctx.session && typeof ctx.session.prompt === "function") {
            await ctx.session.prompt({ sessionID, text: r.relance });
          }
        }
      })().catch(() => {});
    }
  },
  async server(ctx) {
    const cwd = (ctx && ctx.directory) || process.cwd();
    const appels = new Map();
    return {
      "tool.execute.before": async (input, output) => {
        const args = (output && output.args) || {};
        appels.set(input.callID, args);
        avant(input.tool, args, input.sessionID, cwd);
      },
      "tool.execute.after": async (input) => {
        const args = appels.get(input.callID) || {};
        appels.delete(input.callID);
        apres(input.tool, args, input.sessionID, cwd);
      },
    };
  },
};

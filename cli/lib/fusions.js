// Fichiers de hooks partagés avec la personne (~/.codex/hooks.json, ~/.cursor/hooks.json) : les entrées de Pulse
// se reconnaissent à leur commande « pulseia hook » ; ajouter, retirer et « vide » ne touchent jamais au reste.
"use strict";

const DE_PULSE = /\bpulseia hook\b/;
const objet = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});

/** Format Claude Code et Codex : { hooks: { Événement: [{ matcher?, hooks: [{ type, command, … }] }] } }. */
function formatGroupes(id, definitions) {
  return {
    id,
    retirer(o) {
      const copie = { ...objet(o) };
      const hooks = { ...objet(copie.hooks) };
      for (const [evenement, groupes] of Object.entries(hooks)) {
        if (!Array.isArray(groupes)) continue;
        const restants = groupes.filter((g) => !(g && Array.isArray(g.hooks) && g.hooks.some((h) => DE_PULSE.test((h && h.command) || ""))));
        if (restants.length) hooks[evenement] = restants;
        else delete hooks[evenement];
      }
      copie.hooks = hooks;
      return copie;
    },
    ajouter(o) {
      const copie = { ...objet(o) };
      const hooks = { ...objet(copie.hooks) };
      for (const [evenement, groupe] of Object.entries(definitions())) hooks[evenement] = [...(Array.isArray(hooks[evenement]) ? hooks[evenement] : []), groupe];
      copie.hooks = hooks;
      return copie;
    },
    vide: (o) => Object.keys(objet(o.hooks)).length === 0 && Object.keys(o).every((k) => k === "hooks"),
  };
}

/** Format Cursor : { version: 1, hooks: { événement: [{ command, matcher?, timeout? }] } }. */
function formatCursor(id, definitions) {
  return {
    id,
    retirer(o) {
      const copie = { ...objet(o) };
      const hooks = { ...objet(copie.hooks) };
      for (const [evenement, liste] of Object.entries(hooks)) {
        if (!Array.isArray(liste)) continue;
        const restants = liste.filter((h) => !DE_PULSE.test((h && h.command) || ""));
        if (restants.length) hooks[evenement] = restants;
        else delete hooks[evenement];
      }
      copie.hooks = hooks;
      return copie;
    },
    ajouter(o) {
      const copie = { version: 1, ...objet(o) };
      const hooks = { ...objet(copie.hooks) };
      for (const [evenement, h] of Object.entries(definitions())) hooks[evenement] = [...(Array.isArray(hooks[evenement]) ? hooks[evenement] : []), h];
      copie.hooks = hooks;
      return copie;
    },
    vide: (o) => Object.keys(objet(o.hooks)).length === 0 && Object.keys(o).every((k) => k === "hooks" || k === "version"),
  };
}

const commande = (outil, evenement) => `pulseia hook ${outil} ${evenement}`;

const FUSIONS = {
  "codex-hooks": formatGroupes("codex-hooks", () => ({
    PreToolUse: { matcher: "^(Bash|apply_patch|Edit|Write)$", hooks: [{ type: "command", command: commande("codex", "PreToolUse"), timeout: 20, statusMessage: "Pulse vérifie…" }] },
    PostToolUse: { matcher: "^(apply_patch|Edit|Write)$", hooks: [{ type: "command", command: commande("codex", "PostToolUse"), timeout: 20 }] },
    Stop: { hooks: [{ type: "command", command: commande("codex", "Stop"), timeout: 90 }] },
  })),
  "cursor-hooks": formatCursor("cursor-hooks", () => ({
    beforeShellExecution: { command: commande("cursor", "beforeShellExecution"), timeout: 20 },
    beforeReadFile: { command: commande("cursor", "beforeReadFile"), timeout: 20 },
    preToolUse: { command: commande("cursor", "preToolUse"), matcher: "Write|Grep", timeout: 20 },
    afterFileEdit: { command: commande("cursor", "afterFileEdit"), timeout: 20 },
    stop: { command: commande("cursor", "stop"), timeout: 90, loop_limit: 3 },
  })),
};

module.exports = FUSIONS;

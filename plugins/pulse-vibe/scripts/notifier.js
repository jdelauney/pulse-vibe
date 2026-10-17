#!/usr/bin/env node
// Pulse – notification pendant une réalisation (hook Notification, idle_prompt et permission_prompt).
//
// Quand Claude Code attend la personne pendant une réalisation (marqueur aidd_docs/tasks/realisation.json),
// ce script demande au terminal d'afficher une notification du bureau.
//
// Forme de la sortie (https://code.claude.com/docs/en/hooks, champ universel « terminalSequence ») :
//   { "terminalSequence": "\u001b]9;<texte>\u0007" }
// - champ de premier niveau du JSON écrit sur stdout ; il fonctionne aussi sur Notification ;
// - séquences admises : OSC 0/1/2/9/99/777 et BEL, terminées par BEL ou ST ; hors liste, le champ est ignoré ;
// - Claude Code l'émet seulement en session interactive (ignoré avec -p et dans le SDK) ;
// - OSC 9 : notifications d'iTerm2, ConEmu, Windows Terminal et WezTerm (l'exemple de la page utilise OSC 777).
// Entrée : JSON avec notification_type, message, cwd, session_id.
//
// Silencieux hors projet Pulse ou sans marqueur ; sort toujours avec le code 0.
"use strict";

const fs = require("fs");

/** Le texte de la notification, ou null sans marqueur. */
function message(etat, typeNotification) {
  if (!etat) return null;
  const n = Number(etat.questions) || 0;
  if (n > 0) return n === 1 ? "1 question vous attend" : `${n} questions vous attendent`;
  if (etat.etape === "test-groupe") return "La réalisation est terminée : à vous de tester";
  if (typeNotification === "permission_prompt") return "Claude Code attend votre accord";
  return "Pulse attend votre réponse";
}

/** La séquence OSC 9, sans caractère de contrôle dans le texte. */
const sequence = (texte) => `\u001b]9;Pulse – ${texte.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")}\u0007`;

function principal() {
  let entree;
  try {
    entree = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return;
  }
  const cwd = entree && entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : process.cwd();
  const racine = process.env.CLAUDE_PROJECT_DIR || cwd;
  if (!require("./garde").projetPulse(racine)) return;
  const texte = message(require("./realisation").lire(racine), entree && entree.notification_type);
  if (texte) fs.writeSync(1, JSON.stringify({ terminalSequence: sequence(texte) }));
}

module.exports = { message };

if (require.main === module) {
  try {
    principal();
  } catch {
    // jamais d'échec visible
  }
  process.exitCode = 0;
}

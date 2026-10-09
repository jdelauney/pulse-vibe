#!/usr/bin/env node
// Pulse – point d'entrée unique des garde-fous (hook PreToolUse) : un seul processus Node par appel d'outil.
//
// Lit l'entrée une fois et la passe au garde-fou anti-secrets (garde-secrets.js) puis au garde-fou
// des commandes (garde-commandes.js, Bash et PowerShell seulement). Retient la décision la plus stricte :
// refus, puis demande d'accord ; les raisons d'un même niveau s'additionnent.
// Fail-open : en cas d'erreur, l'outil passe. Désactivation de chaque garde-fou : voir son en-tête.
"use strict";

const fs = require("fs");

const RANG = { deny: 2, ask: 1 };

/** Décision la plus stricte d'une liste ({ decision, raison } ou null). */
function combiner(decisions) {
  const presentes = decisions.filter((d) => d && RANG[d.decision]);
  if (!presentes.length) return null;
  const rang = Math.max(...presentes.map((d) => RANG[d.decision]));
  const retenues = presentes.filter((d) => RANG[d.decision] === rang);
  return { decision: retenues[0].decision, raison: [...new Set(retenues.map((d) => d.raison))].join("\n\n") };
}

function principal() {
  let entree;
  try {
    entree = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (e) {
    return;
  }
  const decisions = [];
  for (const module of ["./garde-secrets", "./garde-commandes"]) {
    try {
      decisions.push(require(module).evaluer(entree));
    } catch (e) {
      // Un garde-fou en erreur laisse passer ; l'autre décide quand même.
    }
  }
  const d = combiner(decisions);
  if (d) fs.writeSync(1, JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: d.decision, permissionDecisionReason: d.raison } }));
}

module.exports = { combiner };

if (require.main === module) {
  try {
    principal();
  } catch (e) {
    // Fail-open.
  }
  process.exit(0);
}

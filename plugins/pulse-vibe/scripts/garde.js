#!/usr/bin/env node
// Pulse – point d'entrée unique des garde-fous (hook PreToolUse) : un seul processus Node par appel d'outil.
//
// Lit l'entrée une fois et la passe au garde-fou anti-secrets (garde-secrets.js) puis au garde-fou
// des commandes (garde-commandes.js, Bash et PowerShell seulement). Retient la décision la plus stricte :
// refus, puis demande d'accord ; les raisons d'un même niveau s'additionnent.
// Les garde-fous servent les projets Pulse seulement : ailleurs (un CLAUDE.md sans bloc « <!-- pulse_ » du modèle,
// du dossier courant jusqu'à la racine du dépôt), l'outil passe sans contrôle.
// Fail-open : en cas d'erreur, l'outil passe. Désactivation de chaque garde-fou : voir son en-tête.
"use strict";

const fs = require("fs");
const path = require("path");

const RANG = { deny: 2, ask: 1 };

/** Décision la plus stricte d'une liste ({ decision, raison } ou null). */
function combiner(decisions) {
  const presentes = decisions.filter((d) => d && RANG[d.decision]);
  if (!presentes.length) return null;
  const rang = Math.max(...presentes.map((d) => RANG[d.decision]));
  const retenues = presentes.filter((d) => RANG[d.decision] === rang);
  return { decision: retenues[0].decision, raison: [...new Set(retenues.map((d) => d.raison))].join("\n\n") };
}

/** Vrai quand le dossier est dans un projet Pulse : un CLAUDE.md du modèle Pulse entre ce dossier et la racine du dépôt (ou du disque, hors dépôt). */
function projetPulse(dossier) {
  for (let d = path.resolve(dossier); ; d = path.dirname(d)) {
    try {
      if (fs.readFileSync(path.join(d, "CLAUDE.md"), "utf8").includes("<!-- pulse_")) return true;
    } catch (e) {
      // pas de CLAUDE.md ici
    }
    if (fs.existsSync(path.join(d, ".git")) || path.dirname(d) === d) return false;
  }
}

function principal() {
  let entree;
  try {
    entree = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (e) {
    return;
  }
  const cwd = entree && entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : process.cwd();
  if (!projetPulse(cwd)) return;
  const decisions = [];
  // Les commandes d'abord (rapide) : un refus est la décision la plus stricte, on s'arrête là.
  for (const module of ["./garde-commandes", "./garde-secrets"]) {
    try {
      const d = require(module).evaluer(entree);
      decisions.push(d);
      if (d && d.decision === "deny") break;
    } catch (e) {
      // Un garde-fou en erreur laisse passer ; l'autre décide quand même.
    }
  }
  const d = combiner(decisions);
  if (d) fs.writeSync(1, JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: d.decision, permissionDecisionReason: d.raison } }));
}

module.exports = { combiner, projetPulse };

if (require.main === module) {
  try {
    principal();
  } catch (e) {
    // Fail-open.
  }
  process.exit(0);
}

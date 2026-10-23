#!/usr/bin/env node
// Mesure ce qu'a consommé chaque essai des évaluations : tokens (entrée, sortie, cache lu, cache écrit), appels d'outils
// et sous-agents lancés, sous-agents compris, avec la durée et le score de claude plugin eval.
//
//   node outils/evals/mesurer.js <dossier de résultats>…                       un tableau par essai
//   node outils/evals/mesurer.js --comparer <avant>… -- <après>…               médianes par cas, avant, après, écart
//
// Source : les transcriptions de Claude Code (fichier .jsonl de la session, et <session>/subagents/agent-*.jsonl) que
// lancer.js garde dans <dossier de résultats>/traces/. Un message de l'assistant s'écrit sur plusieurs lignes (une par
// bloc de contenu), chacune avec le même usage : il se compte une fois, par son identifiant.
"use strict";

const fs = require("fs");
const path = require("path");

const CHAMPS = ["entree", "sortie", "cacheLu", "cacheEcrit", "outils", "sousAgents"];

function mediane(nombres) {
  const tries = [...nombres].sort((a, b) => a - b);
  const m = Math.floor(tries.length / 2);
  return tries.length % 2 ? tries[m] : (tries[m - 1] + tries[m]) / 2;
}

/** Ajoute à `total` les tokens et les appels d'outils d'une transcription. */
function compter(fichier, total) {
  const messages = new Set();
  const outils = new Set();
  for (const ligne of fs.readFileSync(fichier, "utf8").split("\n")) {
    if (!ligne.trim()) continue;
    let o;
    try {
      o = JSON.parse(ligne);
    } catch (e) {
      continue;
    }
    const m = o.message;
    if (!m || o.type !== "assistant") continue;
    for (const bloc of Array.isArray(m.content) ? m.content : []) if (bloc.type === "tool_use") outils.add(bloc.id);
    if (!m.usage || messages.has(m.id)) continue;
    messages.add(m.id);
    total.entree += m.usage.input_tokens || 0;
    total.sortie += m.usage.output_tokens || 0;
    total.cacheLu += m.usage.cache_read_input_tokens || 0;
    total.cacheEcrit += m.usage.cache_creation_input_tokens || 0;
  }
  total.outils += outils.size;
}

/** Ce qu'a consommé une session : sa transcription et celles de ses sous-agents. */
function lireEssai(transcription) {
  const total = Object.fromEntries(CHAMPS.map((c) => [c, 0]));
  compter(transcription, total);
  const sous = path.join(transcription.replace(/\.jsonl$/, ""), "subagents");
  const agents = fs.existsSync(sous) ? fs.readdirSync(sous).filter((n) => /^agent-.*\.jsonl$/.test(n)) : [];
  for (const a of agents) compter(path.join(sous, a), total);
  total.sousAgents = agents.length;
  return total;
}

/** Les essais d'un dossier de résultats (aggregate-result.json et traces/ gardées par lancer.js). */
function lireResultats(dossier) {
  const agregat = JSON.parse(fs.readFileSync(path.join(dossier, "aggregate-result.json"), "utf8"));
  const essais = [];
  for (const c of agregat.cases || []) {
    for (const r of (c.arms && c.arms.with) || []) {
      const trace = r.tracePath ? path.join(dossier, "traces", path.basename(r.tracePath)) : null;
      const conso = trace && fs.existsSync(trace) ? lireEssai(trace) : Object.fromEntries(CHAMPS.map((k) => [k, null]));
      essais.push({ cas: c.name, score: r.score, duree: r.durationSeconds, ...conso });
    }
  }
  return essais;
}

const COLONNES = ["score", "duree", ...CHAMPS];

function tableau(essais) {
  const lignes = [`| cas | ${COLONNES.join(" | ")} |`, `|---|${COLONNES.map(() => "---").join("|")}|`];
  for (const e of essais) lignes.push(`| ${e.cas} | ${COLONNES.map((k) => (e[k] === null ? "—" : e[k])).join(" | ")} |`);
  return lignes.join("\n");
}

function comparer(avant, apres) {
  const lignes = ["| cas | mesure | avant (médiane) | après (médiane) | écart |", "|---|---|---|---|---|"];
  for (const cas of [...new Set([...avant, ...apres].map((e) => e.cas))]) {
    for (const k of COLONNES) {
      const valeurs = (liste) => liste.filter((e) => e.cas === cas && e[k] !== null).map((e) => e[k]);
      const a = valeurs(avant);
      const b = valeurs(apres);
      if (!a.length || !b.length) continue;
      const ma = mediane(a);
      const mb = mediane(b);
      const ecart = ma ? `${(((mb - ma) / ma) * 100).toFixed(1)} %` : "—";
      lignes.push(`| ${cas} | ${k} | ${ma} | ${mb} | ${ecart} |`);
    }
  }
  return lignes.join("\n");
}

function principal(args) {
  if (args[0] === "--comparer") {
    const sep = args.indexOf("--");
    if (sep < 0) {
      console.error("Usage : mesurer.js --comparer <avant>… -- <après>…");
      return 1;
    }
    const lire = (dossiers) => dossiers.flatMap(lireResultats);
    console.log(comparer(lire(args.slice(1, sep)), lire(args.slice(sep + 1))));
    return 0;
  }
  if (!args.length) {
    console.error("Usage : mesurer.js <dossier de résultats>… | --comparer <avant>… -- <après>…");
    return 1;
  }
  console.log(tableau(args.flatMap(lireResultats)));
  return 0;
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { mediane, lireEssai, lireResultats, comparer, tableau };

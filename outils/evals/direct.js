#!/usr/bin/env node
// Mode direct des évaluations (node outils/evals/lancer.js --direct [--case <motif>]) : chaque cas de outils/evals/cas/
// tourne avec claude -p, dans un dossier temporaire et le bac à sable de Claude Code, avec les plugins du dépôt ; ses
// vérifications automatiques (tool_used, tool_not_used, tool_order, regex, file_exists) sont notées sur la trace de
// l'essai, et les vérifications par juge IA (llm) sont signalées « non notées ».
//
// Pourquoi : dans claude plugin eval (2.1.309), chaque commande `!` d'un skill est déclarée en échec, même réussie
// (le shell ne peut pas écrire son fichier de suivi, …/tmp/claude-<uid>/cwd-…, monté en lecture seule) : aucune
// commande Pulse ne peut y démarrer. Le rapport s'écrit dans outils/evals/resultats/direct-<date>/ au format que lit
// mesurer.js. Variables : RUNS (essais par cas, 1), PLAFOND (dollars par essai, 5), PACK (next : ajoute le pack).
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { nomTrace } = require("./mesurer");

const OUTILS_ACCORDES = ["Write", "Edit", "Bash(pulse-aidd *)", "Bash(git *)", "Bash(node *)"];
const OUTILS_PACK = ["Bash(npm *)", "Bash(npx *)"];

/** L'environnement des essais : sous-agents au premier plan, sinon une session claude -p se termine avant leur réponse. */
function envEval(env) {
  return { ...env, CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1" };
}

/** Une valeur YAML simple : nombre, texte entre apostrophes ou guillemets, liste [a, b], table { k: v }. */
function valeur(brut) {
  const v = brut.trim();
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\(["\\])/g, "$1");
  if (v.startsWith("[") && v.endsWith("]")) return v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean);
  if (v.startsWith("{") && v.endsWith("}")) {
    const table = {};
    for (const m of v.slice(1, -1).matchAll(/(\w+)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^,}]+)/g)) table[m[1]] = valeur(m[2]);
    return table;
  }
  return v;
}

/** Le front matter (entre deux lignes ---) et le corps d'un fichier de cas. */
function entete(texte) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texte.replace(/\r\n/g, "\n"));
  if (!m) return { champs: {}, corps: texte.trim() };
  const champs = {};
  for (const ligne of m[1].split("\n")) {
    const c = /^(\w+)\s*:\s*(.*)$/.exec(ligne);
    if (c) champs[c[1]] = valeur(c[2]);
  }
  return { champs, corps: m[2].trim() };
}

/** Un cas : prompt, réglages, script de préparation et vérifications. */
function lireCas(dossier) {
  const { champs, corps } = entete(fs.readFileSync(path.join(dossier, "prompt.md"), "utf8"));
  const yaml = fs.readFileSync(path.join(dossier, "case.yaml"), "utf8");
  const script = (/scaffold_script:\s*(\S+)/.exec(yaml) || [])[1];
  const verifications = fs.readdirSync(path.join(dossier, "graders")).filter((f) => f.endsWith(".md")).sort().map((f) => {
    const g = entete(fs.readFileSync(path.join(dossier, "graders", f), "utf8"));
    const v = { nom: f.replace(/\.md$/, ""), ...g.champs };
    if (v.type === "llm") v.texte = g.corps;
    return v;
  });
  return {
    nom: path.basename(dossier),
    prompt: corps,
    maxTours: champs.max_turns || 25,
    delai: champs.timeout_seconds || 600,
    outils: champs.allowed_tools || [],
    preparation: script ? path.join(dossier, script) : null,
    verifications,
  };
}

/** Les appels d'outils de la trace (sous-agents compris), dans l'ordre, et le texte de la dernière réponse. */
function lireTrace(fichier) {
  const appels = [];
  const vus = new Set();
  let reponse = "";
  for (const ligne of fs.readFileSync(fichier, "utf8").split("\n")) {
    let o;
    try {
      o = JSON.parse(ligne);
    } catch (e) {
      continue;
    }
    if (o.type === "result") reponse = o.result || "";
    if (o.type !== "assistant" || !o.message) continue;
    for (const bloc of Array.isArray(o.message.content) ? o.message.content : []) {
      if (bloc.type !== "tool_use" || vus.has(bloc.id)) continue;
      vus.add(bloc.id);
      appels.push({ outil: bloc.name, entree: JSON.stringify(bloc.input || {}) });
    }
  }
  return { appels, reponse };
}

const correspond = (appel, { tool, input_match: motif }) => appel.outil === tool && (!motif || new RegExp(motif).test(appel.entree));

/** Les vérifications notées sur la trace : réussi true/false, ou null (juge IA, non noté) ; score sur les notées. */
function noter(fichier, verifications, dossierProjet = null) {
  const { appels, reponse } = lireTrace(fichier);
  const details = verifications.map((v) => {
    let reussi = null;
    if (v.type === "tool_used") reussi = appels.some((a) => correspond(a, v));
    else if (v.type === "tool_not_used") reussi = !appels.some((a) => correspond(a, v));
    else if (v.type === "tool_order") {
      const avant = appels.findIndex((a) => correspond(a, v.before));
      reussi = avant >= 0 && appels.some((a, i) => i > avant && correspond(a, v.after));
    } else if (v.type === "regex") reussi = new RegExp(v.pattern, v.flags || "").test(reponse);
    else if (v.type === "file_exists") reussi = Boolean(dossierProjet && v.path && fs.existsSync(path.join(dossierProjet, v.path)));
    return { nom: v.nom, type: v.type, reussi };
  });
  const notees = details.filter((d) => d.reussi !== null);
  return { score: notees.length ? notees.filter((d) => d.reussi).length / notees.length : null, details };
}

/** Les arguments de claude -p pour un cas, avec les plugins du dépôt. */
function argumentsDirect(cas, depot, env) {
  const pack = env.PACK === "next";
  const outils = [...new Set([...cas.outils, ...OUTILS_ACCORDES, ...(pack ? OUTILS_PACK : [])])];
  return [
    "-p", cas.prompt,
    "--plugin-dir", path.join(depot, "plugins", "pulse-vibe"),
    ...(pack ? ["--plugin-dir", path.join(depot, "plugins", "pulse-vibe-next")] : []),
    "--max-turns", String(cas.maxTours),
    "--max-budget-usd", env.PLAFOND || "5",
    "--output-format", "stream-json", "--verbose",
    "--settings", JSON.stringify({ sandbox: { enabled: true } }),
    "--allowedTools", ...outils,
  ];
}

/** Écrit le rapport au format de claude plugin eval que lit mesurer.js : aggregate-result.json et traces/. */
function ecrireRapport(dossier, resultats) {
  fs.mkdirSync(path.join(dossier, "traces"), { recursive: true });
  const cases = resultats.map(({ cas, essais }) => ({
    name: cas,
    arms: {
      with: essais.map((e, i) => {
        fs.copyFileSync(e.trace, path.join(dossier, "traces", nomTrace(cas, "with", i)));
        return { score: e.notes.score, durationSeconds: e.duree, tracePath: e.trace, graders: e.notes.details };
      }),
    },
  }));
  fs.writeFileSync(path.join(dossier, "aggregate-result.json"), JSON.stringify({ mode: "direct", cases }, null, 2) + "\n");
}

/** Les cas à lancer : tous les dossiers qui ont un prompt.md, ou ceux que nomme le motif (* permis). */
function choisirCas(dossierCas, motif) {
  const tous = fs.readdirSync(dossierCas).filter((d) => fs.existsSync(path.join(dossierCas, d, "prompt.md"))).sort();
  if (!motif) return tous;
  const re = new RegExp(`^${motif.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
  return tous.filter((c) => re.test(c));
}

/** Lance les cas : un dossier temporaire et un appel claude -p par essai ; renvoie le code de sortie. */
function lancer(extra, env, { depot, dossierCas, resultats }) {
  const i = extra.indexOf("--case");
  const noms = choisirCas(dossierCas, i >= 0 ? extra[i + 1] : null);
  if (!noms.length) {
    console.error("Aucun cas ne correspond.");
    return 1;
  }
  const essaisParCas = Number(env.RUNS || 1);
  const sortie = path.join(resultats, `direct-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(sortie, { recursive: true });
  const bilan = [];
  for (const nom of noms) {
    const cas = lireCas(path.join(dossierCas, nom));
    const essais = [];
    for (let n = 1; n <= essaisParCas; n++) {
      const projet = fs.mkdtempSync(path.join(os.tmpdir(), `pulse-direct-${nom}-`));
      if (cas.preparation) {
        const p = spawnSync("bash", [cas.preparation], { cwd: projet, encoding: "utf8" });
        if (p.status !== 0) {
          console.error(`${nom} : préparation en échec\n${(p.stderr || "").slice(-800)}`);
          continue;
        }
      }
      const trace = path.join(sortie, `${nom}-${n}.jsonl`);
      const debut = Date.now();
      const r = spawnSync("claude", argumentsDirect(cas, depot, env), {
        cwd: projet, env: envEval(env), encoding: "utf8", maxBuffer: 1 << 30, timeout: cas.delai * 1000,
      });
      fs.writeFileSync(trace, r.stdout || "");
      const duree = Math.round((Date.now() - debut) / 1000);
      const notes = noter(trace, cas.verifications, projet);
      const echecs = notes.details.filter((d) => d.reussi === false).map((d) => d.nom);
      const nonNotees = notes.details.filter((d) => d.reussi === null).map((d) => d.nom);
      console.log(`${nom} essai ${n} : score ${notes.score === null ? "—" : notes.score.toFixed(2)} · ${duree} s` +
        (echecs.length ? ` · échoue : ${echecs.join(", ")}` : "") + (nonNotees.length ? ` · non notées (juge IA) : ${nonNotees.join(", ")}` : ""));
      essais.push({ trace, duree, notes });
    }
    bilan.push({ cas: nom, essais });
  }
  ecrireRapport(sortie, bilan);
  const mesurer = require("./mesurer");
  console.log(`\n${mesurer.tableau(mesurer.lireResultats(sortie))}\n\nRapport : ${path.relative(depot, sortie)}`);
  return 0;
}

module.exports = { OUTILS_ACCORDES, OUTILS_PACK, envEval, valeur, entete, lireCas, lireTrace, noter, argumentsDirect, ecrireRapport, choisirCas, lancer };

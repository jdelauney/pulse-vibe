#!/usr/bin/env node
// Pulse Skills – essai de déclenchement d'une skill (`pulse-skills declenchement preparer|lancer <dossier de la skill>`).
//
// Une skill que Claude peut lancer seul se déclenche sur sa description. La règle K2 juge cette description ; cet essai
// la vérifie : chaque phrase est envoyée à `claude -p` dans un dossier temporaire où seule cette skill est installée, et la
// trace dit si l'outil Skill l'a chargée.
//
//   pulse-skills declenchement preparer <dossier>
//     nom, invocable (oui / non : disable-model-invocation), description, exemples du SKILL.md, et le format du fichier
//     de phrases à écrire (JSON : { "declenchent": ["…"], "ignorent": ["…"] }).
//   pulse-skills declenchement lancer <dossier> --phrases <fichier.json> [--modele <alias>]
//     une ligne par phrase : « phrase: <attendu oui|non> · <obtenu oui|non|erreur> · ok|raté · <texte> », puis le bilan
//     « bilan: <réussies>/<total> · faux déclenchements <n> · oublis <n> ». Chaque phrase est un vrai appel au modèle.
//
// Une skill de projet (.claude/skills/<nom>/) est copiée dans le dossier temporaire ; une skill de plugin est chargée par
// --plugin-dir (le dossier qui contient .claude-plugin/plugin.json). Sort toujours avec le code 0.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const DELAI_MS = 180000;
const TOURS_MAX = "3";
const BUDGET_USD = "0.50";

/** Le front matter (entre deux lignes ---) d'un SKILL.md : { champs, corps }. Valeurs simples, sur une ligne. */
function lireSkill(dossier) {
  const texte = fs.readFileSync(path.join(dossier, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texte);
  const champs = {};
  for (const ligne of (m ? m[1] : "").split("\n")) {
    const c = /^([\w-]+)\s*:\s*(.*)$/.exec(ligne);
    if (c) champs[c[1]] = c[2].trim().replace(/^"(.*)"$/, "$1");
  }
  const corps = m ? m[2] : texte;
  const exemples = (/^##\s+Exemples\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(corps) || [])[1] || "";
  return {
    nom: champs.name || path.basename(path.resolve(dossier)),
    description: champs.description || "",
    invocable: String(champs["disable-model-invocation"]).toLowerCase() !== "true",
    exemples: exemples.trim(),
  };
}

/** Le dossier du plugin qui contient la skill (celui de .claude-plugin/plugin.json), ou null pour une skill de projet. */
function racinePlugin(dossier) {
  for (let d = path.resolve(dossier); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, ".claude-plugin", "plugin.json"))) return d;
    if (path.dirname(d) === d) return null;
  }
}

/** Vrai si la trace stream-json montre un appel de l'outil Skill qui charge cette skill (nom seul ou « plugin:nom »). */
function skillChargee(trace, nom) {
  for (const ligne of String(trace || "").split(/\r?\n/)) {
    let o;
    try {
      o = JSON.parse(ligne);
    } catch (e) {
      continue;
    }
    const blocs = (o && o.message && Array.isArray(o.message.content) && o.message.content) || [];
    for (const b of blocs) {
      if (!b || b.type !== "tool_use" || b.name !== "Skill") continue;
      const cible = String((b.input && (b.input.skill || b.input.command || b.input.name)) || "");
      if (cible === nom || cible.endsWith(`:${nom}`)) return true;
    }
  }
  return false;
}

/** Les arguments de claude -p pour une phrase. */
function argumentsEssai(phrase, plugin, modele) {
  return [
    "-p", phrase,
    ...(plugin ? ["--plugin-dir", plugin] : []),
    ...(modele ? ["--model", modele] : []),
    "--max-turns", TOURS_MAX,
    "--max-budget-usd", BUDGET_USD,
    "--output-format", "stream-json", "--verbose",
    "--allowedTools", "Skill",
  ];
}

/** Un essai : dossier temporaire (avec la skill copiée pour une skill de projet), un appel, le verdict. */
function essayer(dossier, skill, phrase, { modele, lancer = spawnSync } = {}) {
  const plugin = racinePlugin(dossier);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-declenchement-"));
  try {
    if (!plugin) fs.cpSync(dossier, path.join(tmp, ".claude", "skills", skill.nom), { recursive: true });
    const r = lancer("claude", argumentsEssai(phrase, plugin, modele), { cwd: tmp, encoding: "utf8", timeout: DELAI_MS, maxBuffer: 1 << 28, windowsHide: true });
    if (r.error || (r.status !== 0 && !r.stdout)) return "erreur";
    return skillChargee(r.stdout, skill.nom) ? "oui" : "non";
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Les phrases du fichier JSON : [{ phrase, attendu: "oui"|"non" }]. */
function lirePhrases(fichier) {
  const j = JSON.parse(fs.readFileSync(fichier, "utf8"));
  const liste = (x) => (Array.isArray(x) ? x.map(String).map((s) => s.trim()).filter(Boolean) : []);
  return [...liste(j.declenchent).map((phrase) => ({ phrase, attendu: "oui" })), ...liste(j.ignorent).map((phrase) => ({ phrase, attendu: "non" }))];
}

/** L'essai complet : une ligne par phrase, puis le bilan. */
function lancerEssai(dossier, phrases, options = {}) {
  const skill = lireSkill(dossier);
  const lignes = [];
  let reussies = 0;
  let faux = 0;
  let oublis = 0;
  for (const { phrase, attendu } of phrases) {
    const obtenu = essayer(dossier, skill, phrase, options);
    const ok = obtenu === attendu;
    if (ok) reussies++;
    else if (attendu === "non" && obtenu === "oui") faux++;
    else if (attendu === "oui" && obtenu === "non") oublis++;
    lignes.push(`phrase: ${attendu} · ${obtenu} · ${ok ? "ok" : "raté"} · ${phrase}`);
  }
  lignes.push(`bilan: ${reussies}/${phrases.length} · faux déclenchements ${faux} · oublis ${oublis}`);
  return lignes.join("\n");
}

function preparer(dossier) {
  const s = lireSkill(dossier);
  const lignes = [`nom: ${s.nom}`, `invocable: ${s.invocable ? "oui" : "non"}`, `description: ${s.description || "(absente)"}`];
  if (!s.invocable) lignes.push("note: disable-model-invocation vaut true : la personne lance la skill par /<nom>, sans déclenchement sur la description ; l'essai ne s'applique pas.");
  lignes.push("exemples:", s.exemples || "(aucun)");
  lignes.push('format: {"declenchent": ["6 phrases que la personne dirait pour ce travail"], "ignorent": ["4 phrases voisines qui relèvent d\'un autre travail"]}');
  return lignes.join("\n");
}

function main(args) {
  const [action, dossier] = args;
  if (!["preparer", "lancer"].includes(action) || !dossier) return console.log("Usage : pulse-skills declenchement preparer <dossier de la skill> | lancer <dossier> --phrases <fichier.json> [--modele <alias>]");
  if (!fs.existsSync(path.join(dossier, "SKILL.md"))) return console.log(`Aucun SKILL.md dans ${dossier}.`);
  if (action === "preparer") return console.log(preparer(dossier));
  const i = args.indexOf("--phrases");
  if (i < 0 || !args[i + 1] || !fs.existsSync(args[i + 1])) return console.log("Indiquez le fichier des phrases : --phrases <fichier.json> (format : pulse-skills declenchement preparer).");
  if (!lireSkill(dossier).invocable) return console.log("bilan: sans objet · disable-model-invocation vaut true : la skill se lance par /<nom>");
  const j = args.indexOf("--modele");
  console.log(lancerEssai(dossier, lirePhrases(args[i + 1]), { modele: j >= 0 ? args[j + 1] : undefined }));
}

module.exports = { lireSkill, racinePlugin, skillChargee, argumentsEssai, essayer, lirePhrases, lancerEssai, preparer };

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.log(`bilan: illisible (${e.message})`);
  }
  process.exitCode = 0;
}

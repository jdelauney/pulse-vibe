#!/usr/bin/env node
// Pulse Next.js – garde-fou du pack (hook PreToolUse du pack ; lancé aussi par `pulseia hook` dans les autres outils).
//
// Une migration de drizzle/ déjà enregistrée dans Git a peut-être été appliquée, en local ou en ligne. La modifier
// ne la rejoue pas : la base et le code divergent sans erreur visible. Ce garde-fou refuse donc de modifier,
// déplacer ou supprimer un fichier suivi par Git sous drizzle/ (migrations .sql et dossier meta/) :
//  - par Write, Edit, MultiEdit ;
//  - par une commande qui nomme ce fichier et l'écrit, le déplace ou le supprime (redirection, tee, sed -i, perl -i,
//    rm, mv, cp vers lui, Set-Content, Add-Content, Out-File, Clear-Content, Remove-Item, Move-Item, Rename-Item).
// Une migration qui vient d'être générée (pas encore suivie par Git) reste modifiable ; `npm run db:generate` passe.
// Actif seulement dans un projet Pulse (CLAUDE.md du modèle) qui déclare ce pack (« **Pack de pile Pulse** : next »
// dans docs/technical.md) ; ailleurs, l'outil passe sans contrôle.
// Désactivation ponctuelle : PULSE_GARDE_MIGRATIONS_OFF=1. Fail-open : en cas d'erreur, l'outil passe.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const OUTILS_ECRITURE = new Set(["Write", "Edit", "MultiEdit"]);
const MIGRATION = /(^|\/)drizzle\/(meta\/[^/]+\.json|[^/]+\.sql)$/i;
// Verbes d'écriture, de déplacement ou de suppression, pour une commande qui nomme une migration.
const ECRIT = /(>>?|\btee\b|\bsed\b[^|;&]*\s-[a-z]*i|\bperl\b[^|;&]*\s-[a-z]*i|\brm\b|\bunlink\b|\bmv\b|\bcp\b|\bset-content\b|\badd-content\b|\bout-file\b|\bclear-content\b|\bremove-item\b|\bmove-item\b|\brename-item\b|\bcopy-item\b|\bdel\b|\btruncate\b)/i;

/** La racine du projet Pulse qui déclare le pack next, en remontant depuis `cwd` jusqu'à la racine du dépôt ; ou null. */
function projetNext(cwd) {
  for (let d = path.resolve(cwd); ; d = path.dirname(d)) {
    let claude = "";
    try {
      claude = fs.readFileSync(path.join(d, "CLAUDE.md"), "utf8");
    } catch (e) {
      // pas de CLAUDE.md ici
    }
    if (claude.includes("<!-- pulse_")) {
      try {
        const technique = fs.readFileSync(path.join(d, "docs", "technical.md"), "utf8");
        return /^\*\*Pack de pile Pulse\*\*\s*:\s*next\b/m.test(technique) ? d : null;
      } catch (e) {
        return null;
      }
    }
    if (fs.existsSync(path.join(d, ".git")) || path.dirname(d) === d) return null;
  }
}

/** Le chemin relatif à la racine, en barres obliques, ou null hors de la racine. */
function relatif(racine, chemin, cwd) {
  const r = path.relative(racine, path.resolve(cwd, String(chemin || "")));
  return !r || r.startsWith("..") || path.isAbsolute(r) ? null : r.split(path.sep).join("/");
}

/** Vrai si Git suit ce fichier (déjà enregistré ou ajouté à l'index). */
function suivi(racine, rel) {
  const r = spawnSync("git", ["ls-files", "--error-unmatch", "--", rel], { cwd: racine, encoding: "utf8", windowsHide: true, timeout: 5000 });
  return r.status === 0;
}

function message(rel) {
  return (
    `🔒 Pulse a bloqué la modification de « ${rel} » : cette migration est déjà enregistrée, elle a peut-être été appliquée à la base, en local ou en ligne. ` +
    `La modifier ne la rejouerait pas : la base et le code ne correspondraient plus, sans erreur visible.\n` +
    `À faire : laissez ce fichier tel quel. Changez la table dans src/db/<domaine>/<sujet>.table.ts, puis lancez \`npm run db:generate\` : ` +
    `une nouvelle migration décrit le changement. Expliquez-le simplement à la personne.`
  );
}

/** Les migrations suivies qu'une entrée de hook modifierait (chemins relatifs à la racine). */
function migrationsTouchees(entree, racine, cwd) {
  const ti = entree.tool_input || {};
  const candidats = [];
  if (OUTILS_ECRITURE.has(entree.tool_name)) candidats.push(ti.file_path);
  else if ((entree.tool_name === "Bash" || entree.tool_name === "PowerShell") && typeof ti.command === "string" && ECRIT.test(ti.command)) {
    // PowerShell prend « \ » pour séparateur sous Linux et macOS aussi : le chemin se relit en « / ».
    const ps = entree.tool_name === "PowerShell";
    for (const mot of ti.command.split(/[\s;&|()<>"'`]+/))
      if (/drizzle[\\/]/i.test(mot)) candidats.push((ps ? mot.replace(/\\/g, "/") : mot).replace(/^[^\w.\\/~-]+/, ""));
  }
  return candidats
    .map((c) => relatif(racine, c, cwd))
    .filter((rel) => rel && MIGRATION.test(rel) && suivi(racine, rel));
}

/** Décision pour une entrée de hook : { decision: "deny", raison }, ou null. */
function evaluer(entree) {
  if (process.env.PULSE_GARDE_MIGRATIONS_OFF === "1") return null;
  try {
    if (!entree || !entree.tool_input) return null;
    if (!OUTILS_ECRITURE.has(entree.tool_name) && entree.tool_name !== "Bash" && entree.tool_name !== "PowerShell") return null;
    const cwd = entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : process.cwd();
    const racine = projetNext(cwd);
    if (!racine) return null;
    const touchees = migrationsTouchees(entree, racine, cwd);
    return touchees.length ? { decision: "deny", raison: message(touchees[0]) } : null;
  } catch (e) {
    return null;
  }
}

module.exports = { evaluer, projetNext };

if (require.main === module) {
  try {
    const d = evaluer(JSON.parse(fs.readFileSync(0, "utf8")));
    if (d) fs.writeSync(1, JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: d.decision, permissionDecisionReason: d.raison } }));
  } catch (e) {
    // Fail-open.
  }
  process.exit(0);
}

// Garde-fous de Pulse hors de Claude Code : `pulseia hook <outil> <événement>`, appelé par les hooks de chaque outil.
// L'entrée de l'outil est traduite au format Claude Code (classe de l'outil, entreeHook), passée sans modification
// aux scripts du cœur (garde.js avant un appel d'outil, apres-ecriture.js après une écriture, fin-de-tour.js
// quand l'agent rend la main), puis leur réponse est traduite pour l'outil (sortieHook).
// Fail-open, comme le cœur : une erreur ici laisse passer l'appel.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { racineContenu, COEUR } = require("./chemins");
const { reecrire } = require("./textes");

const SCRIPTS = { avant: "garde.js", apres: "apres-ecriture.js", fin: "fin-de-tour.js" };
/** Délai d'un script du cœur : fin-de-tour lance les contrôles du projet (60 s au plus). */
const DELAI_MS = { avant: 20000, apres: 20000, fin: 85000 };

/** Un identifiant de session sûr pour les relevés du cœur (lettres, chiffres, - et _), ou undefined. */
function idSur(valeur) {
  if (valeur === undefined || valeur === null) return undefined;
  const id = String(valeur).replace(/[^\w-]/g, "-").slice(0, 100);
  return id || undefined;
}

/**
 * La réponse d'un script du cœur (format Claude Code), ramenée à une forme commune :
 * { decision: "deny"|"ask"|"allow"|null, raison, commande, contexte, bloquer }.
 */
function lireResultat(texte) {
  const vide = { decision: null, raison: "", commande: null, contexte: "", bloquer: null };
  let o;
  try {
    o = JSON.parse(texte);
  } catch {
    return vide;
  }
  const h = (o && o.hookSpecificOutput) || {};
  return {
    decision: ["deny", "ask", "allow"].includes(h.permissionDecision) ? h.permissionDecision : null,
    raison: reecrire(h.permissionDecisionReason || ""),
    commande: (h.updatedInput && typeof h.updatedInput.command === "string" && h.updatedInput.command) || null,
    contexte: reecrire(h.additionalContext || ""),
    bloquer: o.decision === "block" ? reecrire(o.reason || "") : null,
  };
}

/** Lance un script du cœur avec une entrée au format Claude Code ; rend sa sortie (texte). */
function lancerScript(etape, entree, outil) {
  const script = path.join(racineContenu(), COEUR, "scripts", SCRIPTS[etape]);
  const env = { ...process.env, PULSE_OUTIL: outil };
  if (entree.cwd) env.CLAUDE_PROJECT_DIR = entree.cwd;
  const r = spawnSync(process.execPath, [script], { input: JSON.stringify(entree), encoding: "utf8", env, cwd: entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : undefined, timeout: DELAI_MS[etape], windowsHide: true });
  return r.stdout || "";
}

/**
 * Pour une commande réécrite par le garde-fou (tube retiré) dans un outil qui ne sait pas remplacer la commande :
 * un refus qui donne la commande à relancer.
 */
function refusReecriture(resultat) {
  return {
    ...resultat,
    decision: "deny",
    raison: `🔒 Pulse : relancez cette commande telle quelle, sans le tube final, pour lire toute sa sortie :\n${resultat.commande}${resultat.contexte ? `\n\n${resultat.contexte}` : ""}`,
  };
}

/**
 * Pour une demande d'accord dans un outil qui ne sait pas la poser (Codex, Cursor) : un refus qui demande
 * à l'agent d'obtenir l'accord explicite de la personne et de la laisser lancer la commande elle-même.
 */
function refusAccord(resultat) {
  return {
    ...resultat,
    decision: "deny",
    raison:
      `${resultat.raison}\n\nCet outil ne sait pas demander l'accord de la personne au moment de la commande : ` +
      "expliquez-lui ce que fait cette commande et ses conséquences, puis proposez-lui de la lancer elle-même dans son terminal si elle est d'accord.",
  };
}

const RANG = { deny: 3, ask: 2, allow: 1 };

/** Le résultat le plus strict de plusieurs (un patch qui touche plusieurs fichiers) ; les raisons d'un même rang s'additionnent. */
function combiner(resultats) {
  const vide = lireResultat("");
  if (!resultats.length) return vide;
  const rang = (r) => (r.bloquer ? 4 : RANG[r.decision] || 0);
  const max = Math.max(...resultats.map(rang));
  const retenus = resultats.filter((r) => rang(r) === max);
  if (max === 0) return { ...vide, contexte: retenus.map((r) => r.contexte).filter(Boolean).join("\n\n") };
  return { ...retenus[0], raison: [...new Set(retenus.map((r) => r.raison).filter(Boolean))].join("\n\n") };
}

/** Lit un patch au format apply_patch (Codex, OpenCode) : [{ chemin, sorte: "ajout"|"modif"|"suppression", ajoute }], « ajoute » = les lignes ajoutées. */
function lirePatch(texte) {
  const fichiers = [];
  let courant = null;
  for (const ligne of String(texte || "").split(/\r?\n/)) {
    const m = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(ligne);
    const deplace = /^\*\*\* Move to: (.+)$/.exec(ligne);
    if (m) {
      courant = { chemin: m[2].trim(), sorte: { Add: "ajout", Update: "modif", Delete: "suppression" }[m[1]], ajoute: [] };
      fichiers.push(courant);
    } else if (deplace && courant) courant.chemin = deplace[1].trim();
    else if (courant && ligne.startsWith("+")) courant.ajoute.push(ligne.slice(1));
  }
  return fichiers.map((f) => ({ ...f, ajoute: f.ajoute.join("\n") }));
}

/** Entrées Claude Code (Write ou Edit) pour chaque fichier d'un patch. */
function entreesPatch(texte, base) {
  return lirePatch(texte)
    .filter((f) => f.sorte !== "suppression")
    .map((f) => ({
      ...base,
      tool_name: f.sorte === "ajout" ? "Write" : "Edit",
      tool_input: { file_path: path.resolve(base.cwd || process.cwd(), f.chemin), ...(f.sorte === "ajout" ? { content: f.ajoute } : { old_string: "", new_string: f.ajoute }) },
    }));
}

/** `pulseia hook <outil> <événement>` : lit l'entrée de l'outil, écrit sa réponse, rend le code de sortie. */
function hook(outil, evenement, texte) {
  const c = require("./cibles").cible(outil); // chargé ici : les classes des outils utilisent ce module
  if (!c || typeof c.entreeHook !== "function") return { sortie: "", code: 0 };
  let brut;
  try {
    brut = JSON.parse(texte || "{}");
  } catch {
    return { sortie: "", code: 0 };
  }
  try {
    // entreeHook : { etape, entrees: [entrée Claude Code…] }, ou null quand l'événement ne concerne pas Pulse.
    const traduite = c.entreeHook(evenement, brut);
    if (!traduite || !traduite.entrees.length) return c.sortieHook(evenement, lireResultat(""), brut);
    const resultats = traduite.entrees.map((e) => lireResultat(lancerScript(traduite.etape, e, outil)));
    return c.sortieHook(evenement, combiner(resultats), brut);
  } catch {
    return { sortie: "", code: 0 };
  }
}

module.exports = { hook, lireResultat, lancerScript, refusReecriture, refusAccord, idSur, combiner, lirePatch, entreesPatch, SCRIPTS };

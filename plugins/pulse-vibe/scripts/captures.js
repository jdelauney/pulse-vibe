#!/usr/bin/env node
// Pulse – les captures d'écran gardées comme preuves (`pulse-aidd captures effacer <US-XXX>`).
//
// Les captures du verifier vivent dans aidd_docs/captures/US-XXX/ (ignoré par Git). Quand l'US est terminée
// et envoyée, /pulse:spirc les retire avec cette commande : elle ne supprime que le dossier de cette US,
// sous le dossier du projet (racine Git du dossier courant, sinon le dossier courant), jamais un autre chemin.
// Une suppression refusée (fichier ouvert ailleurs, droits) : une phrase simple, code 1.
//   effacer <US-XXX>   retire aidd_docs/captures/<US-XXX>/ ; silencieuse si le dossier n'existe pas
"use strict";

const fs = require("fs");
const path = require("path");

/** La racine Git du dossier courant, sinon le dossier courant. */
function racineProjet(cwd = process.cwd()) {
  try {
    const r = require("child_process").spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  } catch {
    // Git absent
  }
  return cwd;
}

function effacer(us, racine = racineProjet()) {
  if (!/^US-\d{3,}$/.test(us || "")) return { code: 1, erreur: "Numéro d'US attendu, par exemple US-003." };
  const dossier = path.join(racine, "aidd_docs", "captures", us);
  if (!fs.existsSync(dossier)) return { code: 0 };
  try {
    fs.rmSync(dossier, { recursive: true, force: true });
  } catch {
    return { code: 1, erreur: `Les captures de ${us} n'ont pas pu être retirées : fermez les images ouvertes de aidd_docs/captures/${us}/, puis relancez la commande.` };
  }
  return { code: 0, message: `Captures de ${us} retirées (aidd_docs/captures/${us}/).` };
}

if (require.main === module) {
  const [action, us] = process.argv.slice(2);
  if (action !== "effacer") {
    process.stderr.write("Usage : pulse-aidd captures effacer <US-XXX>\n");
    process.exit(1);
  }
  const r = effacer(us);
  if (r.erreur) process.stderr.write(`${r.erreur}\n`);
  if (r.message) process.stdout.write(`${r.message}\n`);
  process.exit(r.code);
}

module.exports = { effacer };

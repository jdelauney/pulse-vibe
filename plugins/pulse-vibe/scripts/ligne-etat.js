#!/usr/bin/env node
// Pulse – la ligne d'état de Claude Code (`pulse-aidd ligne-etat`), installée par `/pulse:status ligne`.
//
// Sans option : lit sur l'entrée le JSON que Claude Code envoie à sa ligne d'état (workspace.current_dir),
// puis écrit une ligne courte : « Pulse · US-002 · T5 en cours · 7/12 tâches · ⏸ test manuel de T4 ».
// Rien hors d'un projet Pulse. Autonome (aucun module du plugin) : il est copié dans le projet.
//   --installer [--remplacer]  copie ce script dans .claude/pulse-ligne-etat.js et règle « statusLine » dans
//                              .claude/settings.local.json (propre à cette machine) ; une ligne d'état déjà
//                              réglée par autre chose reste en place, sauf --remplacer
//   --retirer                  retire la ligne d'état de Pulse et sa copie
// Le dossier du projet est le dossier courant (option --dossier <chemin> pour les tests).
"use strict";

const fs = require("fs");
const path = require("path");

const COPIE = path.join(".claude", "pulse-ligne-etat.js");
const REGLAGES = path.join(".claude", "settings.local.json");
const MARQUE = "pulse-ligne-etat.js";

const lireSi = (f) => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
};
const dossiers = (d) => {
  try {
    return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
};

/** La ligne d'état du projet `racine`, ou "" hors d'un projet Pulse. */
function ligne(racine) {
  const claude = lireSi(path.join(racine, "CLAUDE.md"));
  if (!claude || !/m[ée]thode Pulse|\/pulse:/i.test(claude)) return "";
  const parties = ["Pulse"];
  const taches = path.join(racine, "aidd_docs", "tasks");
  let enCours = null;
  let prochaine = null;
  let faites = 0;
  let total = 0;
  for (const epic of dossiers(taches)) {
    for (const f of fs.readdirSync(path.join(taches, epic)).filter((x) => /^PLAN-SPEC-US-\d+-.+\.md$/i.test(x)).sort()) {
      const us = /^PLAN-SPEC-(US-\d+)/i.exec(f)[1].toUpperCase();
      let dans = false;
      for (const l of (lireSi(path.join(taches, epic, f)) || "").split(/\r?\n/)) {
        if (/^##\s/.test(l)) dans = /^##\s+T[âa]ches\s*$/i.test(l);
        const t = dans && /^- \[(.)\]\s+\*\*(T\d+)\s*[–—-]/.exec(l);
        if (!t) continue;
        total++;
        if (/x/i.test(t[1])) faites++;
        else if (t[1] === "~" && !enCours) enCours = `${us} · ${t[2]} en cours`;
        else if (t[1] === " " && !prochaine) prochaine = `${us} · prochaine : ${t[2]}`;
      }
    }
  }
  if (enCours || prochaine) parties.push(enCours || prochaine);
  if (total) parties.push(`${faites}/${total} tâches`);
  const attente = lireSi(path.join(taches, "in-progress.md"));
  if (attente) {
    const etape = ((/\*\*[ÉE]tape\*\*\s*:\s*(.+)/.exec(attente) || [])[1] || "").replace(/\{\{.*?\}\}|`/g, "").trim();
    const enAttente = (attente.match(/en attente\s*:/gi) || []).length;
    if (etape) parties.push(`⏸ ${etape.slice(0, 40)}`);
    if (enAttente) parties.push(`${enAttente} US en attente`);
  }
  return parties.join(" · ");
}

function lireReglages(racine) {
  const texte = lireSi(path.join(racine, REGLAGES));
  if (texte === null) return {};
  return JSON.parse(texte); // un fichier illisible arrête l'installation, sans l'écraser
}
const ecrireReglages = (racine, r) => {
  fs.mkdirSync(path.join(racine, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(racine, REGLAGES), JSON.stringify(r, null, 2) + "\n");
};
const estLaNotre = (r) => Boolean(r.statusLine && String(r.statusLine.command || "").includes(MARQUE));

/** Ajoute `ligneGit` au .gitignore s'il existe et ne la contient pas. */
function ignorer(racine, ligneGit) {
  const f = path.join(racine, ".gitignore");
  const texte = lireSi(f);
  if (texte === null || texte.split(/\r?\n/).includes(ligneGit)) return false;
  fs.writeFileSync(f, texte.replace(/\n*$/, "\n") + ligneGit + "\n");
  return true;
}

function installer(racine, remplacer) {
  const r = lireReglages(racine);
  if (r.statusLine && !estLaNotre(r) && !remplacer) {
    return "deja: une ligne d'état est déjà réglée dans .claude/settings.local.json (relancer avec --remplacer pour la remplacer)";
  }
  fs.mkdirSync(path.join(racine, ".claude"), { recursive: true });
  require("./copies.js").copier("ligne-etat", path.join(racine, COPIE)); // la copie porte l'empreinte de son modèle
  const chemin = path.resolve(racine, COPIE).split(path.sep).join("/");
  r.statusLine = { type: "command", command: `node "${chemin}"` };
  ecrireReglages(racine, r);
  const ignores = [".claude/settings.local.json", ".claude/pulse-ligne-etat.js"].filter((l) => ignorer(racine, l));
  return `installee: .claude/settings.local.json${ignores.length ? `\ngitignore: ${ignores.join(", ")}` : ""}`;
}

function retirer(racine) {
  const r = lireReglages(racine);
  const avait = estLaNotre(r);
  if (avait) {
    delete r.statusLine;
    ecrireReglages(racine, r);
  }
  const copie = path.join(racine, COPIE);
  if (fs.existsSync(copie)) fs.unlinkSync(copie);
  return avait ? "retiree: .claude/settings.local.json" : "absente: aucune ligne d'état de Pulse";
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--dossier");
  const racine = i !== -1 ? args[i + 1] : process.cwd();
  if (args.includes("--installer") || args.includes("--retirer")) {
    try {
      console.log(args.includes("--retirer") ? retirer(racine) : installer(racine, args.includes("--remplacer")));
    } catch (e) {
      console.log(`erreur: ${e.message} (rien n'a été modifié dans .claude/settings.local.json)`);
    }
  } else {
    // La ligne d'état : jamais d'erreur affichée, au pire une ligne vide.
    let entree = "";
    try {
      entree = fs.readFileSync(0, "utf8");
    } catch {}
    let dossier = racine;
    try {
      const j = JSON.parse(entree || "{}");
      dossier = (j.workspace && j.workspace.current_dir) || j.cwd || racine;
    } catch {}
    try {
      process.stdout.write(ligne(dossier) + "\n");
    } catch {
      process.stdout.write("\n");
    }
  }
}

module.exports = { ligne, installer, retirer };

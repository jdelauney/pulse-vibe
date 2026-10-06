#!/usr/bin/env node
// Pulse – registre des sessions Claude Code ouvertes (hooks SessionStart / SessionEnd, `pulse-aidd sessions`).
//
// Claude Code ne permet pas à une session de savoir si une autre travaille sur le même dossier.
// Ce registre le fait : chaque session s'inscrit à l'ouverture et se désinscrit à la fermeture,
// dans un dossier temporaire de la machine (jamais dans le projet). /pulse:implement et
// /pulse:spirc le consultent pour proposer un worktree quand une autre session est ouverte.
//
// Modes :
//  - `--debut` (hook SessionStart) : inscrit la session (entrée du hook sur stdin) ; silencieux ;
//  - `--fin` (hook SessionEnd) : désinscrit la session ; silencieux ;
//  - `--ici <session>` : réinscrit la session sur le dossier courant (après être entré dans un
//    worktree ou en être sorti) ;
//  - `[<session>]` : indique combien d'autres sessions sont ouvertes sur le dossier courant.
// Une inscription de plus de 24 h est considérée comme abandonnée (session fermée brutalement).
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const REGISTRE = process.env.PULSE_SESSIONS_DIR || path.join(os.tmpdir(), "pulse-sessions");
const DUREE_MAX = 24 * 60 * 60 * 1000;

/** Le dossier du projet tel que Git le voit : la racine du dépôt ou du worktree. */
function racine(dossier) {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: dossier, encoding: "utf8" });
  const brut = r.status === 0 && r.stdout.trim() ? r.stdout.trim() : dossier;
  const resolu = path.resolve(brut);
  return process.platform === "win32" ? resolu.toLowerCase() : resolu;
}

const cle = (dossier) => crypto.createHash("sha1").update(dossier).digest("hex").slice(0, 16);
const valide = (id) => typeof id === "string" && /^[\w-]{1,100}$/.test(id);

function desinscrire(id) {
  if (!fs.existsSync(REGISTRE)) return;
  for (const d of fs.readdirSync(REGISTRE)) {
    const f = path.join(REGISTRE, d, `${id}.json`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

function inscrire(id, dossier) {
  desinscrire(id);
  const d = path.join(REGISTRE, cle(dossier));
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, `${id}.json`), JSON.stringify({ dossier, debut: new Date().toISOString() }));
}

/** Les sessions inscrites sur ce dossier ; les inscriptions abandonnées sont retirées au passage. */
function sessions(dossier) {
  const d = path.join(REGISTRE, cle(dossier));
  if (!fs.existsSync(d)) return [];
  const actives = [];
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith(".json"))) {
    const complet = path.join(d, f);
    if (Date.now() - fs.statSync(complet).mtimeMs > DUREE_MAX) {
      fs.unlinkSync(complet);
      continue;
    }
    actives.push({ id: f.slice(0, -5), ...JSON.parse(fs.readFileSync(complet, "utf8")) });
  }
  return actives;
}

function lireHook() {
  const donnees = JSON.parse(fs.readFileSync(0, "utf8"));
  return { id: donnees.session_id, dossier: process.env.CLAUDE_PROJECT_DIR || donnees.cwd || process.cwd() };
}

const heure = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const args = process.argv.slice(2);

if (args[0] === "--debut" || args[0] === "--fin") {
  // Un hook ne doit jamais gêner la session : aucune sortie, aucune erreur.
  try {
    const { id, dossier } = lireHook();
    if (valide(id)) {
      if (args[0] === "--debut") inscrire(id, racine(dossier));
      else desinscrire(id);
    }
  } catch (e) {
    // silencieux
  }
} else if (args[0] === "--ici") {
  if (!valide(args[1])) {
    console.log("⚠️ Identifiant de session inconnu : rien à réinscrire.");
  } else {
    const dossier = racine(process.cwd());
    inscrire(args[1], dossier);
    console.log(`✅ Session inscrite sur ${dossier}.`);
  }
} else {
  const dossier = racine(process.cwd());
  const toutes = sessions(dossier);
  // Sans identifiant fiable, la session courante est l'une des inscrites : on la retire du compte.
  const autres = valide(args[0]) ? toutes.filter((s) => s.id !== args[0]) : toutes.slice(1);
  console.log(`autres=${autres.length}`);
  if (autres.length === 0) {
    console.log("Aucune autre session Claude Code ouverte sur ce dossier.");
  } else {
    const depuis = autres.map((s) => heure(s.debut)).sort().join(", ");
    console.log(`⚠️ ${autres.length} autre(s) session(s) Claude Code semble(nt) ouverte(s) sur ce dossier (depuis ${depuis}).`);
  }
}

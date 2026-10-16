#!/usr/bin/env node
// Pulse – les autorisations du projet (`pulse-aidd autorisations [--ecrire]`), pour /pulse:init, /pulse:tech et /pulse:spirc.
//
// Les autorisations d'un skill (allowed-tools) valent seulement pendant le tour qui l'appelle, et les sous-agents ne les
// reçoivent pas : sans règles dans le projet, Claude Code redemande l'accord à chaque contrôle, même pendant une
// réalisation autonome. Ce script calcule les règles utiles à un projet Pulse :
//   deny  : la lecture des fichiers de clés (.env…) ;
//   allow : les commandes Git de lecture et d'enregistrement (jamais l'envoi), les sous-commandes de pulse-aidd qui
//           lisent ou contrôlent (jamais celles qui touchent la production ou la configuration), et les contrôles de
//           « Commandes du projet » de docs/technical.md (lancer en local, tester, contrôler, auditer, construire ;
//           jamais installer, déployer ou migrer).
// Sans option : affiche le fichier, le nombre de règles manquantes et chacune (« - allow Bash(npm test) »).
// --ecrire : ajoute les règles manquantes à .claude/settings.json (créé s'il manque ; règles existantes gardées).
// Les règles déjà présentes dans .claude/settings.local.json comptent comme présentes.
"use strict";

const fs = require("fs");
const path = require("path");

const DENY = ["Read(./.env)", "Read(./.env.local)", "Read(./.env.*.local)", "Read(./.env.envoi)"];
const GIT = ["Bash(git status *)", "Bash(git diff *)", "Bash(git log *)", "Bash(git add *)", "Bash(git commit -m *)"];
// Sous-commandes de pulse-aidd qui lisent, contrôlent ou tiennent les documents de suivi. Les autres (secrets generer,
// envoyer, elaguer, redeployer, installer-ci, installer-hook, ligne-etat, nouveau…) passent par la demande d'accord.
const PULSE = [
  "qualite", "tests", "scenarios", "verifier", "verifier-spec *", "bilan", "memoire", "guide", "travail-fini",
  "reference *", "modele *", "agent *", "contexte *", "etape *", "etat *", "revue *", "verifier-plan *", "sessions *",
  "pile contexte *", "pile reference *", "pile recette *",
  "maquettes verifier *", "textes verifier *", "contraste *", "comparer *", "seo *", "sonder *",
  "secrets inventaire *", "secrets historique *", "secrets preparer *",
].map((s) => `Bash(pulse-aidd ${s})`);
// Lignes de « Commandes du projet » dont les commandes sont sans effet hors du projet.
const LIGNES = /^(lancer en local|tester|contr[ôo]les automatiques|auditer les d[ée]pendances|construire)\b/i;
const RISQUE = /\b(deploy|d[ée]ployer|migrat|migrer|push|install|publish|rm|del|reset|db:)\b/i;

const lireSi = (f) => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
};

/** Les commandes de contrôle de « Commandes du projet » (entre backticks), sans celles qui installent ou déploient. */
function commandesDuProjet(racine) {
  const texte = lireSi(path.join(racine, "docs", "technical.md")) || "";
  const section = (texte.split(/^## Commandes du projet\s*$/m)[1] || "").split(/^## /m)[0];
  const commandes = new Set();
  for (const ligne of section.split(/\r?\n/)) {
    const m = /^\|\s*([^|]+?)\s*\|(.*)\|\s*$/.exec(ligne);
    if (!m || !LIGNES.test(m[1].trim())) continue;
    for (const [, c] of m[2].matchAll(/`([^`]+)`/g)) {
      const commande = c.trim();
      if (commande && !RISQUE.test(commande) && !/^https?:/i.test(commande) && !/[;&|<>]/.test(commande)) commandes.add(commande);
    }
  }
  return [...commandes];
}

/** Les règles attendues : { deny: [...], allow: [...] }. */
function attendues(racine) {
  const projet = commandesDuProjet(racine).flatMap((c) => [`Bash(${c})`, `Bash(${c} *)`]);
  return { deny: DENY, allow: [...GIT, ...PULSE, ...projet] };
}

function lireReglages(f) {
  const texte = lireSi(f);
  if (texte === null) return {};
  return JSON.parse(texte); // un fichier illisible arrête tout, sans l'écraser
}

/** Les règles manquantes : [{ sorte: "allow" | "deny", regle }]. */
function manquantes(racine) {
  const presentes = [path.join(racine, ".claude", "settings.json"), path.join(racine, ".claude", "settings.local.json")].map(lireReglages);
  const a = attendues(racine);
  const deja = (sorte, regle) => presentes.some((r) => ((r.permissions || {})[sorte] || []).includes(regle));
  return [...a.deny.map((regle) => ({ sorte: "deny", regle })), ...a.allow.map((regle) => ({ sorte: "allow", regle }))].filter((x) => !deja(x.sorte, x.regle));
}

function ecrire(racine) {
  const f = path.join(racine, ".claude", "settings.json");
  const r = lireReglages(f);
  const manque = manquantes(racine);
  if (!manque.length) return 0;
  r.permissions = r.permissions || {};
  for (const { sorte, regle } of manque) {
    r.permissions[sorte] = r.permissions[sorte] || [];
    if (!r.permissions[sorte].includes(regle)) r.permissions[sorte].push(regle);
  }
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(r, null, 2) + "\n");
  return manque.length;
}

if (require.main === module) {
  const racine = process.cwd();
  try {
    if (process.argv.includes("--ecrire")) console.log(`fichier: .claude/settings.json\necrites: ${ecrire(racine)}`);
    else {
      const manque = manquantes(racine);
      console.log([`fichier: .claude/settings.json`, `manquantes: ${manque.length}`, ...manque.map((x) => `- ${x.sorte} ${x.regle}`)].join("\n"));
    }
  } catch (e) {
    console.log(`erreur: ${e.message} (rien n'a été modifié dans .claude/settings.json)`);
  }
}

module.exports = { attendues, manquantes, ecrire, commandesDuProjet };

#!/usr/bin/env node
// Pulse – mise de côté d'une tâche qui attend une réponse (`pulse-aidd attente`, /pulse:spirc, « Questions en attente »).
//
//   pulse-aidd attente mettre-de-cote <Tn> -- <fichier…>   met de côté le travail de la tâche (documents de docs/ et aidd_docs/ laissés en place)
//   pulse-aidd attente remettre <Tn>                       remet le travail en place, puis retire l'entrée mise de côté
//   pulse-aidd attente liste                               les entrées en attente : « T4 · stash@{1} · 3 fichiers · 2026-10-24 », ou « aucune »
//
// Sortie en lignes « clé: valeur ». Codes : 0 fait · 1 usage ou argument invalide · 2 refus préalable (rien n'a changé) ·
// 3 échec Git (l'entrée mise de côté est gardée). Chemins refusés : avec « .. », absolus, ou avec une lettre de lecteur.
// Git permis : stash push, stash apply, stash drop (seulement l'entrée qu'on vient d'appliquer), lectures (status, stash list, stash show, rev-parse).
"use strict";

const { spawnSync } = require("child_process");

const sortir = (code, lignes) => {
  if (lignes.length) process.stdout.write(lignes.join("\n") + "\n");
  process.exit(code);
};

/** Lance git à `cwd` ; les chemins reçus sont pris tels quels (jamais comme motifs). */
function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_LITERAL_PATHSPECS: "1" } });
  return { ok: r.status === 0, sortie: r.stdout || "", erreur: (r.stderr || "").trim() || (r.error ? String(r.error.message) : "") };
}

/** Un chemin du dépôt, avec « / », ou null s'il sort du dossier. */
function cheminSur(brut) {
  if (!brut || /\.\./.test(brut) || /^[\\/]/.test(brut) || /^[A-Za-z]:/.test(brut)) return null;
  return brut.replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/\/+$/, "") || null;
}

/** Les fichiers modifiés, ajoutés ou non suivis (un par ligne, y compris dans un dossier tout neuf). */
function fichiersChanges(racine) {
  const r = git(racine, ["status", "--porcelain", "-z", "--untracked-files=all"]);
  const morceaux = r.sortie.split("\0");
  const fichiers = [];
  for (let i = 0; i < morceaux.length; i++) {
    const m = morceaux[i];
    if (m.length < 4) continue;
    fichiers.push(m.slice(3));
    if (/[RC]/.test(m.slice(0, 2))) i++; // renommage : le morceau suivant est l'ancien nom
  }
  return fichiers;
}

const sujetDe = (tn) => `pulse: ${tn} en attente`;

/** Les entrées « pulse: Tn en attente » : { ref, tache, date }, de la plus récente à la plus ancienne. */
function entrees(racine) {
  const r = git(racine, ["stash", "list", "--format=%gd%x09%s%x09%cs"]);
  const liste = [];
  for (const ligne of r.sortie.split("\n")) {
    const [ref, sujet, date] = ligne.split("\t");
    const m = /: pulse: (T\d+) en attente$/.exec(sujet || "");
    if (m) liste.push({ ref, tache: m[1], date: date || "" });
  }
  return liste;
}

function fichiersEntree(racine, ref) {
  const r = git(racine, ["stash", "show", "--include-untracked", "--name-only", "-z", ref]);
  return r.ok ? r.sortie.split("\0").filter(Boolean) : null;
}

function mettreDeCote(racine, tn, demandes) {
  const changes = fichiersChanges(racine);
  const inconnus = [];
  const retenus = new Set();
  const laisses = [];
  for (const d of demandes) {
    const correspondants = changes.filter((f) => f === d || f.startsWith(d + "/"));
    if (!correspondants.length) {
      inconnus.push(d);
      continue;
    }
    for (const f of correspondants) {
      if (/^(docs|aidd_docs)\//.test(f)) laisses.push(f);
      else retenus.add(f);
    }
  }
  const deja = entrees(racine).find((e) => e.tache === tn);
  const laisse = [...new Set(laisses)].map((f) => `laisse: ${f} (document de la méthode)`);
  if (inconnus.length) sortir(2, ["etat: refuse", ...inconnus.map((f) => `inconnu: ${f}`)]);
  if (deja) sortir(2, ["etat: refuse", `deja: ${deja.ref}`]);
  if (!retenus.size) sortir(2, ["etat: rien-a-mettre-de-cote", ...laisse]);

  const fichiers = [...retenus];
  const r = git(racine, ["stash", "push", "-u", "-m", sujetDe(tn), "--", ...fichiers]);
  const entree = entrees(racine).find((e) => e.tache === tn);
  const restes = fichiers.filter((f) => fichiersChanges(racine).includes(f));
  if (!r.ok || !entree || restes.length) {
    sortir(3, ["etat: echec", ...restes.map((f) => `fichier-reste: ${f}`), `message: ${r.erreur || "la mise de côté n'est pas complète"}`]);
  }
  sortir(0, ["etat: fait", `mise-de-cote: ${entree.ref}`, ...fichiers.map((f) => `fichier: ${f}`), ...laisse, `ligne-plan: · Mis de côté : ${sujetDe(tn)}`]);
}

function remettre(racine, tn) {
  const entree = entrees(racine).find((e) => e.tache === tn);
  if (!entree) sortir(2, ["etat: absente"]);
  const fichiers = fichiersEntree(racine, entree.ref);
  if (!fichiers) sortir(3, ["etat: echec", `message: l'entrée ${entree.ref} ne se lit pas`]);
  const changes = fichiersChanges(racine);
  const communs = fichiers.filter((f) => changes.some((c) => c === f || f.startsWith(c.replace(/\/$/, "") + "/")));
  if (communs.length) sortir(2, ["etat: fichiers-communs", ...communs.map((f) => `fichier: ${f}`)]);

  const a = git(racine, ["stash", "apply", entree.ref]);
  if (!a.ok) sortir(3, ["etat: conflit", `mise-de-cote: ${entree.ref}`, `message: ${a.erreur.split("\n").join(" ")}`]);
  const d = git(racine, ["stash", "drop", entree.ref]);
  if (!d.ok) sortir(3, ["etat: conflit", `mise-de-cote: ${entree.ref}`, `message: ${d.erreur}`]);
  sortir(0, ["etat: remis", ...fichiers.map((f) => `fichier: ${f}`)]);
}

function liste(racine) {
  const toutes = entrees(racine);
  if (!toutes.length) sortir(0, ["aucune"]);
  sortir(0, toutes.map((e) => {
    const n = (fichiersEntree(racine, e.ref) || []).length;
    return `${e.tache} · ${e.ref} · ${n} fichier${n > 1 ? "s" : ""} · ${e.date}`;
  }));
}

function main(argv) {
  const [action, ...reste] = argv;
  const usage = (texte) => sortir(1, [`Usage : ${texte}`]);
  const tache = (t) => (/^T\d+$/.test(t || "") ? t : null);

  if (action === "mettre-de-cote") {
    const sep = reste.indexOf("--");
    const tn = tache(reste[0]);
    const brutes = sep === -1 ? [] : reste.slice(sep + 1);
    if (!tn || sep !== 1 || !brutes.length) usage("pulse-aidd attente mettre-de-cote <Tn> -- <fichier…>");
    const demandes = brutes.map(cheminSur);
    if (demandes.includes(null)) sortir(1, ["Usage : chaque fichier est un chemin du projet (sans .., ni chemin absolu, ni lettre de lecteur)"]);
    return { action, tn, demandes };
  }
  if (action === "remettre") {
    const tn = tache(reste[0]);
    if (!tn || reste.length !== 1) usage("pulse-aidd attente remettre <Tn>");
    return { action, tn };
  }
  if (action === "liste" && !reste.length) return { action };
  return usage("pulse-aidd attente mettre-de-cote <Tn> -- <fichier…> | remettre <Tn> | liste");
}

const demande = main(process.argv.slice(2));
const haut = git(process.cwd(), ["rev-parse", "--show-toplevel"]);
if (!haut.ok) sortir(2, ["etat: pas-de-depot"]);
const racine = haut.sortie.trim();
if (demande.action === "mettre-de-cote") mettreDeCote(racine, demande.tn, demande.demandes);
else if (demande.action === "remettre") remettre(racine, demande.tn);
else liste(racine);

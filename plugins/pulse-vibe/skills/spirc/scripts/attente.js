#!/usr/bin/env node
// Pulse – mise de côté d'une tâche qui attend une réponse (`pulse-aidd attente`, /pulse:spirc, « Questions en attente »).
//
//   pulse-aidd attente mettre-de-cote <Tn> -- <fichier…>   met de côté le travail de la tâche (documents de docs/ et aidd_docs/ laissés en place)
//   pulse-aidd attente remettre <Tn>                       remet le travail en place, puis retire l'entrée mise de côté
//   pulse-aidd attente liste                               les entrées en attente : « T4 · stash@{1} · 3 fichiers · 2026-10-24 », ou « aucune »
//
// Sortie en lignes « clé: valeur ». Codes : 0 fait · 1 usage ou argument invalide · 2 refus préalable (rien n'a changé) ·
// 3 échec Git (l'entrée mise de côté est gardée ; après une remise en conflit, l'arbre est ramené à l'état d'avant). Chemins refusés : avec « .. », absolus, ou avec une lettre de lecteur.
// Git permis : stash push, stash apply, stash drop (seulement l'entrée qu'on vient d'appliquer), reset --merge (seulement juste après notre
// propre stash apply en échec, sur un dossier vérifié propre au départ), lectures (status, stash list, stash show, ls-files, rev-parse).
// `remettre` n'agit que sur un dossier propre : aucun changement suivi ou enregistré, et aucun chemin de l'entrée déjà occupé (arbre-occupe, code 2).
// Les noms de fichiers d'une entrée se lisent avec `stash show --include-untracked --no-renames`, qui demande Git 2.32 ou plus.
"use strict";

const fs = require("fs");
const path = require("path");
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

/** Les fichiers modifiés, ajoutés ou non suivis, avec leur état à deux lettres (un par ligne, y compris dans un dossier tout neuf). */
function etatArbre(racine) {
  const r = git(racine, ["status", "--porcelain", "-z", "--untracked-files=all"]);
  const morceaux = r.sortie.split("\0");
  const fichiers = [];
  for (let i = 0; i < morceaux.length; i++) {
    const m = morceaux[i];
    if (m.length < 4) continue;
    fichiers.push({ xy: m.slice(0, 2), chemin: m.slice(3) });
    if (/[RC]/.test(m.slice(0, 2))) { // renommage : le morceau suivant est l'ancien nom, compté lui aussi
      i++;
      if (morceaux[i]) fichiers.push({ xy: m.slice(0, 2), chemin: morceaux[i] });
    }
  }
  return fichiers;
}

const fichiersChanges = (racine) => etatArbre(racine).map((e) => e.chemin);
const instantane = (racine) => etatArbre(racine).map((e) => e.xy + e.chemin).sort().join("\n");
const EN_CONFLIT = /^(?:U.|.U|AA|DD)$/;

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
  const r = git(racine, ["stash", "show", "--include-untracked", "--name-only", "--no-renames", "-z", ref]);
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
  const apres = fichiersChanges(racine);
  const restes = fichiers.filter((f) => apres.includes(f));
  if (!r.ok || !entree || restes.length) {
    sortir(3, ["etat: echec", ...restes.map((f) => `fichier-reste: ${f}`), `message: ${r.erreur || "la mise de côté n'est pas complète"}`]);
  }
  sortir(0, ["etat: fait", `mise-de-cote: ${entree.ref}`, ...fichiers.map((f) => `fichier: ${f}`), ...laisse, `ligne-plan: · Mis de côté : ${sujetDe(tn)}`]);
}

/** Les chemins que l'entrée occupe déjà dans le dossier de travail : tout sauf un fichier suivi par Git et propre. */
function occupes(racine, fichiers, arbre) {
  const suivis = new Set(git(racine, ["ls-files", "-z"]).sortie.split("\0").filter(Boolean));
  const sales = arbre.filter((e) => e.xy !== "??").map((e) => e.chemin); // changement suivi ou enregistré
  const nonSuivis = arbre.filter((e) => e.xy === "??").map((e) => e.chemin.replace(/\/$/, ""));
  const lies = (a, b) => a === b || a.startsWith(b + "/") || b.startsWith(a + "/");
  const trouves = new Set(sales);
  for (const f of fichiers) {
    if (nonSuivis.some((c) => lies(c, f))) trouves.add(f);
    else if (fs.existsSync(path.join(racine, f)) && !suivis.has(f)) trouves.add(f); // fichier ignoré ou dossier à cet endroit
  }
  return [...trouves];
}

function remettre(racine, tn) {
  const entree = entrees(racine).find((e) => e.tache === tn);
  if (!entree) sortir(2, ["etat: absente"]);
  const fichiers = fichiersEntree(racine, entree.ref);
  if (!fichiers) sortir(3, ["etat: echec", `message: l'entrée ${entree.ref} ne se lit pas`]);
  const occupe = occupes(racine, fichiers, etatArbre(racine));
  if (occupe.length) sortir(2, ["etat: arbre-occupe", ...occupe.map((f) => `fichier: ${f}`)]);

  const avant = instantane(racine);
  const existaient = new Set(fichiers.filter((f) => fs.existsSync(path.join(racine, f))));
  const a = git(racine, ["stash", "apply", entree.ref]);
  if (!a.ok) {
    const message = `message: ${[a.sortie, a.erreur].join(" ").replace(/\s+/g, " ").trim()}`;
    const enConflit = etatArbre(racine).filter((e) => EN_CONFLIT.test(e.xy)).map((e) => `fichier-en-conflit: ${e.chemin}`);
    // Départ propre : `reset --merge` ne défait ici que cette remise ; puis les fichiers neufs qu'elle a créés.
    git(racine, ["reset", "--merge"]);
    const reste = [];
    for (const f of fichiers.filter((x) => !existaient.has(x))) {
      try {
        fs.rmSync(path.join(racine, f), { force: true });
      } catch (e) {
        reste.push(`fichier: ${f}`);
      }
    }
    const propre = !reste.length && instantane(racine) === avant;
    sortir(3, [propre ? "etat: conflit" : "etat: conflit-non-nettoye", `mise-de-cote: ${entree.ref}`, ...enConflit, ...reste, message]);
  }
  const d = git(racine, ["stash", "drop", entree.ref]);
  if (!d.ok) {
    // Le travail est en place : l'entrée restante n'est qu'un reste à retirer plus tard (code 0).
    sortir(0, ["etat: remis-sans-nettoyage", `mise-de-cote: ${entree.ref}`, ...fichiers.map((f) => `fichier: ${f}`), `a-retirer: l'entrée ${entree.ref} reste à retirer plus tard (${d.erreur.replace(/\s+/g, " ")})`]);
  }
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

#!/usr/bin/env node
// Pulse – mise de côté d'une tâche qui attend une réponse (`pulse-aidd attente`, /pulse:spirc, « Questions en attente »).
//
//   pulse-aidd attente mettre-de-cote <Tn> -- <fichier…>   met de côté le travail de la tâche (documents de docs/ et aidd_docs/ laissés en place)
//   pulse-aidd attente remettre <Tn>                       remet le travail en place, puis retire l'entrée mise de côté
//   pulse-aidd attente liste                               les entrées en attente : « T4 · stash@{1} · 3 fichiers · 2026-10-24 », ou « aucune »
//
// Sortie en lignes « clé: valeur ». Codes : 0 fait · 1 usage ou argument invalide · 2 refus préalable (rien n'a changé) ·
// 3 échec Git (l'entrée mise de côté est gardée ; après une remise en conflit, l'arbre est ramené à l'état d'avant). Chemins refusés : avec « .. », absolus, ou avec une lettre de lecteur.
// Git permis : stash push, stash apply --index, stash drop (seulement l'entrée qu'on vient d'appliquer), reset --merge (seulement juste après notre
// propre stash apply en échec, sur un dossier vérifié propre au départ), lectures (status, stash list, stash show, ls-files, ls-tree, check-ignore, diff, rev-parse).
// Un fichier préparé pour un enregistrement et inchangé depuis (« A », « M » : les tests figés de « Tests d'abord ») part avec l'entrée et revient préparé.
// `mettre-de-cote` refuse d'avance (code 2) toute autre préparation (`git stash push` emporte toute la préparation) : un fichier préparé puis changé,
// supprimé ou renommé, une préparation hors des fichiers mis de côté ; et un fichier ignoré ajouté de force. Si Git échoue quand même après avoir
// créé une entrée, elle est signalée (`mise-de-cote-orpheline`, code 3).
// `remettre` n'agit que sur un dossier propre (sinon arbre-occupe, code 2) : aucun changement suivi ou enregistré, sauf une modification non enregistrée
// d'un document de docs/ ou aidd_docs/ hors des chemins de l'entrée (le plan coché juste avant ; `reset --merge` la garde) ; aucun chemin de l'entrée
// ni de ses dossiers déjà occupé ; aucun fichier neuf de l'entrée suivi depuis par le projet.
// Les noms de fichiers d'une entrée se lisent avec `stash show --include-untracked --no-renames`, qui demande Git 2.32 ou plus.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const sortir = (code, lignes) => {
  if (lignes.length) process.stdout.write(lignes.join("\n") + "\n");
  process.exit(code);
};

const REGLAGES_CHEMINS = ["GIT_ICASE_PATHSPECS", "GIT_GLOB_PATHSPECS", "GIT_NOGLOB_PATHSPECS", "GIT_LITERAL_PATHSPECS"];

/**
 * Lance git à `cwd` ; les chemins reçus sont pris tels quels, jamais comme motifs : les réglages des chemins venus de l'environnement sont retirés,
 * puis GIT_LITERAL_PATHSPECS=1 posé (check-ignore refuse ce réglage : ses chemins portent `:(top)`).
 */
function git(cwd, args, entree) {
  const env = { ...process.env };
  for (const nom of Object.keys(env)) if (REGLAGES_CHEMINS.includes(nom.toUpperCase())) delete env[nom];
  if (args[0] !== "check-ignore") env.GIT_LITERAL_PATHSPECS = "1";
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env, input: entree });
  return { ok: r.status === 0, code: r.status, sortie: r.stdout || "", erreur: (r.stderr || "").trim() || (r.error ? String(r.error.message) : "") };
}

/** Un chemin du dépôt, avec « / », ou null s'il sort du dossier. */
function cheminSur(brut) {
  if (!brut || /\.\./.test(brut) || /^[\\/]/.test(brut) || /^[A-Za-z]:/.test(brut)) return null;
  return brut.replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/\/+$/, "") || null;
}

/** Les fichiers modifiés, ajoutés ou non suivis, avec leur état à deux lettres (un par ligne, y compris dans un dossier tout neuf) ; l'ancien nom d'un renommage aussi. */
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
const DOCUMENT = /^(docs|aidd_docs)\//;
const lies = (a, b) => a === b || a.startsWith(b + "/") || b.startsWith(a + "/");
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
  const arbre = etatArbre(racine);
  const changes = arbre.map((e) => e.chemin);
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
      if (DOCUMENT.test(f)) laisses.push(f);
      else retenus.add(f);
    }
  }
  const fichiers = [...retenus];
  const refuses = fichiers.length ? intransportables(racine, arbre, fichiers) : [];
  const deja = entrees(racine).find((e) => e.tache === tn);
  const laisse = [...new Set(laisses)].map((f) => `laisse: ${f} (document de la méthode)`);
  if (inconnus.length || refuses.length) sortir(2, ["etat: refuse", ...inconnus.map((f) => `inconnu: ${f}`), ...refuses.map((f) => `refuse: ${f}`)]);
  if (deja) sortir(2, ["etat: refuse", `deja: ${deja.ref}`]);
  if (!fichiers.length) sortir(2, ["etat: rien-a-mettre-de-cote", ...laisse]);

  const avant = new Set(empreintes(racine));
  const r = git(racine, ["stash", "push", "-u", "-m", sujetDe(tn), "--", ...fichiers]);
  const derniere = empreintes(racine)[0];
  const creee = derniere && !avant.has(derniere) ? "stash@{0}" : null; // entrée créée par cet appel
  const apres = fichiersChanges(racine);
  const restes = fichiers.filter((f) => apres.includes(f));
  if (!r.ok || !creee || restes.length) {
    sortir(3, ["etat: echec", ...(creee ? [`mise-de-cote-orpheline: ${creee}`] : []), ...restes.map((f) => `fichier-reste: ${f}`), `message: ${r.erreur || "la mise de côté n'est pas complète"}`]);
  }
  sortir(0, ["etat: fait", `mise-de-cote: ${creee}`, ...fichiers.map((f) => `fichier: ${f}`), ...laisse, `ligne-plan: · Mis de côté : ${sujetDe(tn)}`]);
}

/** Les empreintes des entrées mises de côté, de la plus récente à la plus ancienne. */
const empreintes = (racine) => git(racine, ["stash", "list", "--format=%H"]).sortie.split("\n").filter(Boolean);

/**
 * Ce qui empêche `git stash push` de mettre de côté ces fichiers seuls, une ligne « chemin (raison) » par chemin. Git emporte toute la préparation
 * dans l'entrée, et `stash apply --index` la remet entière : seuls passent les fichiers mis de côté préparés tels quels (« A », « M »). Refusés :
 * une préparation hors de ces fichiers (autre tâche, document laissé en place), un fichier préparé puis changé, supprimé ou renommé, un fichier ignoré.
 */
function intransportables(racine, arbre, fichiers) {
  const raisons = new Map();
  const transportes = new Set(fichiers);
  for (const e of arbre) {
    if (/^[ ?]/.test(e.xy) || raisons.has(e.chemin)) continue; // rien de préparé
    if (!transportes.has(e.chemin)) raisons.set(e.chemin, "préparé pour un enregistrement, hors des fichiers mis de côté");
    else if (!/^[AM] $/.test(e.xy)) raisons.set(e.chemin, "suppression ou renommage préparé, ou fichier changé depuis sa préparation");
  }
  // `:(top)` : chaque chemin lu tel quel, même s'il commence par « : » ; check-ignore répond 0 (certains ignorés) ou 1 (aucun).
  const c = git(racine, ["check-ignore", "--no-index", "-z", "--stdin"], fichiers.map((f) => `:(top)${f}\0`).join(""));
  const ignores = c.code === 0 || c.code === 1 ? c.sortie.split("\0").filter(Boolean).map((f) => f.replace(/^:\(top\)/, "")) : fichiers;
  const raison = c.code === 0 || c.code === 1 ? "fichier ignoré" : "impossible de vérifier s'il est ignoré";
  for (const f of ignores) if (!raisons.has(f)) raisons.set(f, raison);
  return [...raisons].map(([f, r]) => `${f} (${r})`);
}

/** Ce qui empêche la remise : les changements en cours (sauf un document de la méthode modifié sans être enregistré, hors de l'entrée) et les chemins de l'entrée déjà occupés. */
function occupes(racine, ref, fichiers, arbre) {
  const suivis = new Set(git(racine, ["ls-files", "-z"]).sortie.split("\0").filter(Boolean)); // comme HEAD : tout changement enregistré bloque déjà
  const neufs = new Set(git(racine, ["ls-tree", "-r", "--name-only", "-z", `${ref}^3`]).sortie.split("\0").filter(Boolean)); // les fichiers non suivis de l'entrée
  const tolere = (e) => e.xy[0] === " " && DOCUMENT.test(e.chemin) && !fichiers.some((f) => lies(e.chemin, f));
  const sales = arbre.filter((e) => e.xy !== "??" && !tolere(e)).map((e) => e.chemin); // changement suivi ou enregistré
  const nonSuivis = arbre.filter((e) => e.xy === "??").map((e) => e.chemin.replace(/\/$/, ""));
  const trouves = new Set(sales);
  for (const f of fichiers) {
    for (const dossier of dossiersDe(f)) { // un dossier de l'entrée remplacé par un fichier
      const infos = lire(racine, dossier);
      if (infos && !infos.isDirectory()) trouves.add(dossier);
    }
    if (nonSuivis.some((c) => lies(c, f))) trouves.add(f);
    else if (fs.existsSync(path.join(racine, f)) && !suivis.has(f)) trouves.add(f); // fichier ignoré ou dossier à cet endroit
    else if (neufs.has(f) && suivis.has(f)) trouves.add(f); // fichier neuf de l'entrée, suivi depuis par le projet
  }
  return [...trouves];
}

const noms = (r) => r.sortie.split("\0").filter(Boolean);

/** Les fichiers préparés de l'entrée que le projet a changés depuis : la remise de leur préparation bute sur eux, avant toute écriture. */
function preparesChanges(racine, ref) {
  const prepares = noms(git(racine, ["diff", "--no-color", "--name-only", "--no-renames", "-z", `${ref}^1`, `${ref}^2`]));
  return prepares.length ? noms(git(racine, ["diff", "--no-color", "--name-only", "--no-renames", "-z", `${ref}^1`, "HEAD", "--", ...prepares])) : [];
}

/** Les dossiers d'un chemin, du plus haut au plus profond : « a/b/c.js » → a, a/b. */
const dossiersDe = (f) => f.split("/").slice(0, -1).map((_, i, parties) => parties.slice(0, i + 1).join("/"));

/** Ce qui se trouve à ce chemin (sans suivre un lien), ou null. */
function lire(racine, chemin) {
  try {
    return fs.lstatSync(path.join(racine, chemin));
  } catch (e) {
    return null;
  }
}

/** Les dossiers absents qui accueilleront ces fichiers, du plus profond au moins profond. */
function dossiersAbsents(racine, fichiers) {
  const absents = new Set(fichiers.flatMap((f) => dossiersDe(f).filter((d) => !lire(racine, d))));
  return [...absents].sort((a, b) => b.split("/").length - a.split("/").length);
}

function remettre(racine, tn) {
  const entree = entrees(racine).find((e) => e.tache === tn);
  if (!entree) sortir(2, ["etat: absente"]);
  const fichiers = fichiersEntree(racine, entree.ref);
  if (!fichiers) sortir(3, ["etat: echec", `message: l'entrée ${entree.ref} ne se lit pas`]);
  const occupe = occupes(racine, entree.ref, fichiers, etatArbre(racine));
  if (occupe.length) sortir(2, ["etat: arbre-occupe", ...occupe.map((f) => `fichier: ${f}`)]);

  const avant = instantane(racine);
  const existaient = new Set(fichiers.filter((f) => fs.existsSync(path.join(racine, f))));
  const dossiersNeufs = dossiersAbsents(racine, fichiers.filter((f) => !existaient.has(f)));
  const a = git(racine, ["stash", "apply", "--index", entree.ref]); // --index : les fichiers préparés reviennent préparés
  if (!a.ok) {
    const message = `message: ${[a.sortie, a.erreur].join(" ").replace(/\s+/g, " ").trim()}`;
    const fusion = etatArbre(racine).filter((e) => EN_CONFLIT.test(e.xy)).map((e) => e.chemin);
    const enConflit = (fusion.length ? fusion : preparesChanges(racine, entree.ref)).map((f) => `fichier-en-conflit: ${f}`);
    // Départ propre : `reset --merge` ne défait ici que cette remise ; puis les fichiers neufs qu'elle a créés, et leurs dossiers restés vides.
    git(racine, ["reset", "--merge"]);
    const reste = [];
    for (const f of fichiers.filter((x) => !existaient.has(x))) {
      try {
        fs.rmSync(path.join(racine, f), { force: true });
      } catch (e) {
        reste.push(`fichier: ${f}`);
      }
    }
    for (const dossier of dossiersNeufs) {
      try {
        fs.rmdirSync(path.join(racine, dossier));
      } catch (e) {
        // déjà retiré, ou pas vide : il reste, et la comparaison ci-dessous le signale s'il contient un fichier
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

#!/usr/bin/env node
// Pulse – la preuve des tests et contrôles (`pulse-aidd preuve`), produite par le verifier ou le test-runner et relue
// par les autres (relecture, commit, mise en ligne) : un lancement réel, valable pour un contenu précis des fichiers.
//
//   lancer [--portee suite | --portee tache <fichiers de test…>] [--construire]
//     lance, lus dans « Commandes du projet » de docs/technical.md : les « Contrôles automatiques » (sauf ceux qui
//     réécrivent les fichiers, motif REECRIT de fin-de-tour.js), « Tester » (toute la suite, ou les fichiers donnés)
//     et « Construire » avec --construire. Seules les commandes qu'autorisations.js autorise sont lancées ; les autres
//     sont signalées « sautée ». Code 0 si tout passe, 1 sinon, 2 si un fichier de test est refusé (rien n'est lancé).
//   etat [--exiger suite] [--exiger construction]
//     « à jour » (code 0, avec la ligne de la preuve, ✅ ou ❌), « périmée (fichiers modifiés depuis : …) »,
//     « aucune » ou « portée insuffisante » (code 1).
//
// Empreinte : le contenu des fichiers suivis et non suivis non ignorés, hors docs/ et aidd_docs/ (blobs de
// `git ls-files -s`, `git hash-object` des fichiers modifiés et non suivis) : un commit, un rapport ou une ligne de
// journal ne la changent pas. Fichier : `git rev-parse --git-path pulse-preuve.json` (propre à chaque dossier de
// travail, worktree compris ; jamais dans un commit) : date, empreinte, fichiers, portée, et pour chaque commande son
// code de sortie, sa durée (ms) et, en échec, ses 30 dernières lignes.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { commandesDe, REECRIT, DEPASSE } = require("./fin-de-tour");
const { commandesDuProjet } = require("./autorisations");

const LANCEUR = path.join(__dirname, "fin-de-tour.js");
const DELAI_S = 600; // par commande
const LIGNES_ECHEC = 30;
const CITES_MAX = 10;
const HORS = /^(docs|aidd_docs)\//;
const FICHIER_TEST_SUR = /^[\w@%+=,./-]+$/;
const FAMILLES = [
  { famille: "controles", libelle: /^contr[ôo]les automatiques\b/i },
  { famille: "tests", libelle: /^tester\b/i },
  { famille: "construction", libelle: /^construire\b/i },
];
const USAGE =
  "Usage : pulse-aidd preuve lancer [--portee suite | --portee tache <fichiers de test…>] [--construire]\n" +
  "        pulse-aidd preuve etat [--exiger suite] [--exiger construction]";

function git(racine, args, input) {
  const r = spawnSync("git", args, { cwd: racine, encoding: "utf8", input, maxBuffer: 512 * 1024 * 1024, windowsHide: true });
  if (r.error || r.status !== 0) throw new Error(`git ${args[0]} : ${(r.stderr || "").trim() || "échec"}`);
  return r.stdout;
}

function racineGit(cwd) {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", windowsHide: true });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

const fichierPreuve = (racine) => path.resolve(racine, git(racine, ["rev-parse", "--git-path", "pulse-preuve.json"]).trim());
const liste = (sortie) => sortie.split("\0").filter(Boolean);

/** Le contenu de chaque fichier compté dans l'empreinte : { chemin: blob | "supprimé" | "modifié" }, trié. */
function etatFichiers(racine) {
  const fichiers = new Map();
  for (const entree of liste(git(racine, ["ls-files", "-s", "-z"]))) {
    const tab = entree.indexOf("\t");
    const f = entree.slice(tab + 1);
    if (!HORS.test(f)) fichiers.set(f, entree.slice(0, tab).split(" ")[1]);
  }
  const aHacher = [];
  for (const f of [...liste(git(racine, ["diff", "--name-only", "-z"])), ...liste(git(racine, ["ls-files", "-o", "--exclude-standard", "-z"]))]) {
    if (HORS.test(f)) continue;
    let st;
    try {
      st = fs.lstatSync(path.join(racine, f));
    } catch {
      fichiers.set(f, "supprimé");
      continue;
    }
    if (st.isFile()) aHacher.push(f);
    else fichiers.set(f, "modifié"); // sous-module ou lien : compté comme changé
  }
  if (aHacher.length) {
    const blobs = git(racine, ["hash-object", "--stdin-paths"], aHacher.join("\n") + "\n").split(/\r?\n/).filter(Boolean);
    aHacher.forEach((f, i) => fichiers.set(f, blobs[i] || "modifié"));
  }
  return Object.fromEntries([...fichiers].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

const empreinte = (fichiers) => crypto.createHash("sha256").update(JSON.stringify(fichiers)).digest("hex");

/** Les fichiers dont le contenu diffère entre deux relevés (modifiés, ajoutés, retirés). */
function differences(avant, apres) {
  const noms = new Set([...Object.keys(avant), ...Object.keys(apres)]);
  return [...noms].filter((f) => avant[f] !== apres[f]).sort();
}

const citer = (fichiers) =>
  fichiers.slice(0, CITES_MAX).join(", ") + (fichiers.length > CITES_MAX ? ` et ${fichiers.length - CITES_MAX} autres` : "");

/** Les commandes de chaque famille dans « Commandes du projet » : { controles, tests, construction } ou null. */
function commandesParFamille(racine) {
  let texte;
  try {
    texte = fs.readFileSync(path.join(racine, "docs", "technical.md"), "utf8");
  } catch {
    return null;
  }
  const morceaux = texte.split(/^## Commandes du projet\s*$/m);
  if (morceaux.length < 2) return null;
  const section = morceaux[1].split(/^## /m)[0];
  const resultat = { controles: [], tests: [], construction: [] };
  for (const ligne of section.split(/\r?\n/)) {
    const m = /^\s*\|\s*([^|]+?)\s*\|(.*)$/.exec(ligne);
    if (!m) continue;
    const famille = FAMILLES.find((x) => x.libelle.test(m[1]));
    if (famille && !resultat[famille.famille].length) resultat[famille.famille] = commandesDe(m[2]);
  }
  return resultat;
}

/** Les fichiers de test ajoutés à une commande de test (`npm test -- <fichiers>`). */
const avecFichiers = (commande, fichiers) => (/^npm\s/.test(commande) ? `${commande} -- ${fichiers.join(" ")}` : `${commande} ${fichiers.join(" ")}`);

const sansCouleurs = (texte) => texte.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

/** Le nombre de tests passés et lancés lu dans la sortie (node --test, Vitest, Jest, pytest), ou null. */
function compteTests(texte) {
  const t = sansCouleurs(texte);
  const dernier = (motif) => [...t.matchAll(motif)].pop();
  const total = dernier(/^\s*(?:#|ℹ)\s*tests\s+(\d+)\s*$/gm);
  const passes = dernier(/^\s*(?:#|ℹ)\s*pass\s+(\d+)\s*$/gm);
  if (total && passes) return { passes: Number(passes[1]), total: Number(total[1]) };
  const vitest = dernier(/^\s*Tests\s+(.*)\((\d+)\)\s*$/gm);
  if (vitest) return { passes: Number((/(\d+) passed/.exec(vitest[1]) || [0, 0])[1]), total: Number(vitest[2]) };
  const jest = dernier(/^Tests:\s+(.*?)(\d+) total\s*$/gm);
  if (jest) return { passes: Number((/(\d+) passed/.exec(jest[1]) || [0, 0])[1]), total: Number(jest[2]) };
  const pytest = dernier(/^=+ (.*\d+ (?:passed|failed).*) in [\d.]+s.* =+\s*$/gm);
  if (pytest) {
    const nombre = (mot) => Number((new RegExp(`(\\d+) ${mot}`).exec(pytest[1]) || [0, 0])[1]);
    return { passes: nombre("passed"), total: nombre("passed") + nombre("failed") + nombre("errors?") };
  }
  return null;
}

/** Lance une commande par le lanceur de fin-de-tour.js (arrêt de tout ce qu'elle a lancé au délai), sortie dans un fichier. */
function executer(racine, commande) {
  const sortie = path.join(os.tmpdir(), `pulse-preuve-${process.pid}-${Date.now()}.txt`);
  const fd = fs.openSync(sortie, "w");
  const debut = Date.now();
  let r;
  try {
    r = spawnSync(process.execPath, [LANCEUR, "--lancer", commande, String(DELAI_S * 1000)], {
      cwd: racine,
      timeout: (DELAI_S + 10) * 1000,
      stdio: ["ignore", fd, fd],
      windowsHide: true,
    });
  } finally {
    fs.closeSync(fd);
  }
  const duree = Date.now() - debut;
  let texte = "";
  try {
    texte = fs.readFileSync(sortie, "utf8");
    fs.unlinkSync(sortie);
  } catch {
    // sortie illisible
  }
  const code = r.error || r.status === null ? 1 : r.status;
  return { commande, code, duree, depasse: code === DEPASSE, texte };
}

function age(date) {
  const minutes = Math.floor((Date.now() - Date.parse(date)) / 60000);
  if (!(minutes >= 1)) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 48 * 60) return `il y a ${Math.floor(minutes / 60)} h`;
  return `il y a ${Math.floor(minutes / 1440)} jours`;
}

/** La ligne de la preuve, puis les lignes utiles de chaque échec et les commandes sautées. */
function resume(preuve) {
  const de = (famille) => preuve.resultats.filter((c) => c.famille === famille);
  const signe = (famille) => (de(famille).every((c) => c.code === 0) ? "✅" : "❌");
  const morceaux = [];
  morceaux.push(de("controles").length ? `contrôles ${signe("controles")}` : "aucun contrôle");
  const portee = preuve.portee === "suite" ? "(suite)" : "(tâche)";
  if (preuve.manques.includes("tests")) morceaux.push(`tests ❌ ${portee} (aucune commande « Tester » à lancer dans docs/technical.md)`);
  else morceaux.push(`tests${preuve.tests ? ` ${preuve.tests.passes}/${preuve.tests.total}` : ""} ${signe("tests")} ${portee}`);
  if (preuve.construction)
    morceaux.push(preuve.manques.includes("construction") ? "construction ❌ (aucune commande « Construire » à lancer dans docs/technical.md)" : `construction ${signe("construction")}`);
  const lignes = [`preuve: ${preuve.ok ? "✅" : "❌"} à jour · ${morceaux.join(" · ")} · ${age(preuve.date)}`];
  for (const c of preuve.resultats.filter((x) => x.code !== 0)) {
    const raison = c.depasse ? `délai de ${DELAI_S} s dépassé` : `code ${c.code}, ${Math.round(c.duree / 1000)} s`;
    lignes.push("", `❌ \`${c.commande}\` (${raison}) :`, ...c.lignes);
  }
  for (const s of preuve.sautees) lignes.push(`sautée : \`${s}\` (hors des autorisations du projet : commande qui installe, envoie ou efface)`);
  return lignes.join("\n");
}

function lancer(racine, options) {
  const familles = commandesParFamille(racine);
  if (!familles) {
    console.log("preuve: aucune commande (section « Commandes du projet » de docs/technical.md introuvable)");
    return 1;
  }
  const autorisees = new Set(commandesDuProjet(racine));
  const aLancer = [];
  const sautees = [];
  const manques = [];
  for (const famille of ["controles", "tests", "construction"]) {
    if (famille === "construction" && !options.construire) continue;
    const commandes = familles[famille].filter((c) => !REECRIT.test(c));
    for (const c of commandes) {
      if (!autorisees.has(c)) sautees.push(c);
      else aLancer.push({ famille, commande: famille === "tests" && options.portee === "tache" ? avecFichiers(c, options.fichiers) : c });
    }
    if (famille !== "controles" && !aLancer.some((x) => x.famille === famille)) manques.push(famille);
  }

  const avant = etatFichiers(racine);
  const resultats = [];
  const sortiesTests = [];
  for (const { famille, commande } of aLancer) {
    const r = executer(racine, commande);
    if (famille === "tests") sortiesTests.push(r.texte);
    const resultat = { famille, commande, code: r.code, duree: r.duree };
    if (r.depasse) resultat.depasse = true;
    if (r.code !== 0) resultat.lignes = sansCouleurs(r.texte).replace(/\s+$/, "").split(/\r?\n/).slice(-LIGNES_ECHEC);
    resultats.push(resultat);
  }
  const comptes = sortiesTests.map(compteTests);
  const tests = comptes.length && comptes.every(Boolean) ? comptes.reduce((a, b) => ({ passes: a.passes + b.passes, total: a.total + b.total })) : null;
  const preuve = {
    version: 1,
    date: new Date().toISOString(),
    empreinte: empreinte(avant),
    portee: options.portee,
    fichiersTest: options.portee === "tache" ? options.fichiers : [],
    construction: options.construire,
    ok: !manques.length && resultats.every((c) => c.code === 0),
    tests,
    resultats,
    sautees,
    manques,
    fichiers: avant,
  };
  const cible = fichierPreuve(racine);
  const provisoire = `${cible}.${process.pid}.tmp`;
  fs.writeFileSync(provisoire, JSON.stringify(preuve) + "\n");
  fs.renameSync(provisoire, cible);

  console.log(resume(preuve));
  const changes = differences(avant, etatFichiers(racine));
  if (changes.length) console.log(`\nDes fichiers ont changé pendant le lancement (${citer(changes)}) : la preuve vaut pour leur contenu d'avant.`);
  return preuve.ok ? 0 : 1;
}

function etat(racine, exigences) {
  let preuve = null;
  try {
    preuve = JSON.parse(fs.readFileSync(fichierPreuve(racine), "utf8"));
  } catch {
    // absente ou illisible
  }
  if (!preuve || preuve.version !== 1 || !preuve.fichiers) {
    console.log("preuve: aucune (lancez pulse-aidd preuve lancer --portee suite)");
    return 1;
  }
  const changes = differences(preuve.fichiers, etatFichiers(racine));
  if (changes.length) {
    console.log(`preuve: périmée (fichiers modifiés depuis : ${citer(changes)})`);
    return 1;
  }
  if (exigences.includes("suite") && preuve.portee !== "suite") {
    console.log("preuve: portée insuffisante (tests des fichiers de la tâche seulement ; demandée : toute la suite)");
    return 1;
  }
  if (exigences.includes("construction") && !preuve.construction) {
    console.log("preuve: portée insuffisante (construction non lancée ; demandée : construction)");
    return 1;
  }
  console.log(resume(preuve));
  return 0;
}

/** Les options de la ligne de commande, ou { usage } / { refus } (message). */
function lireOptions(args) {
  const [action, ...reste] = args;
  if (action === "lancer") {
    const options = { portee: "suite", fichiers: [], construire: false };
    for (let i = 0; i < reste.length; i++) {
      if (reste[i] === "--construire") options.construire = true;
      else if (reste[i] === "--portee" && reste[i + 1] === "suite") options.portee = reste[++i];
      else if (reste[i] === "--portee" && reste[i + 1] === "tache") {
        options.portee = reste[++i];
        while (i + 1 < reste.length && !reste[i + 1].startsWith("--")) options.fichiers.push(reste[++i]);
        if (!options.fichiers.length) return { usage: "Indiquez les fichiers de test de la tâche après --portee tache." };
      } else return { usage: `Option inconnue : ${reste[i]}` };
    }
    const refuse = options.fichiers.find((f) => !FICHIER_TEST_SUR.test(f) || /(^|\/)\.\.(\/|$)/.test(f) || f.startsWith("/"));
    if (refuse !== undefined) return { refus: `fichier de test refusé : ${refuse} (donnez un chemin relatif au projet, sans « .. », sans espace ni lecteur)` };
    return { action, options };
  }
  if (action === "etat") {
    const exigences = [];
    for (let i = 0; i < reste.length; i++) {
      if (reste[i] === "--exiger" && ["suite", "construction"].includes(reste[i + 1])) exigences.push(reste[++i]);
      else return { usage: `Option inconnue : ${reste[i]}${reste[i] === "--exiger" ? ` ${reste[i + 1] || ""}`.trimEnd() : ""}` };
    }
    return { action, exigences };
  }
  return { usage: action ? `Action inconnue : ${action}` : "" };
}

function principal(args) {
  const lu = lireOptions(args);
  if (lu.usage !== undefined) {
    console.log([lu.usage, USAGE].filter(Boolean).join("\n"));
    return 1;
  }
  if (lu.refus) {
    console.log(`preuve: ${lu.refus} ; rien n'a été lancé.`);
    return 2;
  }
  const racine = racineGit(process.cwd());
  if (!racine) {
    console.log("preuve: pas de dépôt Git ici (lancez la commande dans le dossier du projet)");
    return 1;
  }
  return lu.action === "lancer" ? lancer(racine, lu.options) : etat(racine, lu.exigences);
}

if (require.main === module) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (e) {
    console.log(`preuve: erreur : ${e.message}`);
    process.exitCode = 1;
  }
}

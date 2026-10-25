#!/usr/bin/env node
// Pulse – la preuve des tests et contrôles (`pulse-aidd preuve`), produite par le verifier ou le test-runner et relue
// par les autres (relecture, commit, mise en ligne) : un lancement réel, valable pour un contenu précis des fichiers.
//
//   lancer [--portee suite | --portee tache <fichiers de test…>] [--construire]
//     lance, lus dans « Commandes du projet » de docs/technical.md (lignesCommandes d'autorisations.js) : les
//     « Contrôles automatiques » (sauf ceux qui réécrivent les fichiers, motif REECRIT de fin-de-tour.js), « Tester »
//     (libellé exact : jamais « Tester de bout en bout » ; toute la suite, ou les fichiers donnés) et « Construire »
//     avec --construire. Une commande hors des autorisations du projet (raisonRefus d'autorisations.js) n'est pas
//     lancée : la preuve est ❌, avec la raison. « Tester » sans commande : pas de suite, choix du projet (la preuve le
//     dit) ; une suite qui ne lance aucun test : ❌. Code 0 si tout passe, 1 sinon, 2 si un fichier de test est refusé
//     (rien n'est lancé).
//   construire
//     ajoute la construction à la preuve à jour, sans relancer contrôles ni tests. Code 0 si elle passe, 1 sinon,
//     2 sans preuve à jour (rien n'est lancé). L'empreinte reste celle de la preuve : si la construction modifie un
//     fichier compté, la preuve devient périmée.
//   etat [--exiger suite] [--exiger construction]
//     à jour et verte : la ligne de la preuve, code 0 ; à jour et rouge (❌, avec ses lignes d'échec), « périmée
//     (fichiers modifiés depuis : …) », « aucune » ou « portée insuffisante » : code 1. --exiger suite est satisfaite
//     quand « Tester » vaut « aucune » (choix du projet) ; les contrôles, et la construction si elle est exigée, comptent.
//     Chaque réponse dit la suite à donner : « relancez : … » (périmée, aucune, portée insuffisante : même portée que
//     l'ancienne preuve, construction gardée), « ajoutez-la : pulse-aidd preuve construire », ou, pour une preuve
//     rouge à jour, « échecs à corriger » (la relancer sur le même contenu ne change rien).
//
// Empreinte, prise après le lancement (un fichier écrit par les tests ne la rend pas périmée aussitôt ; il est
// signalé) : le contenu des fichiers suivis et non suivis non ignorés, hors docs/ et aidd_docs/ mais avec
// docs/technical.md (ses commandes), par les blobs de `git ls-files -s` et `git hash-object` des fichiers modifiés et
// non suivis. Un commit, un rapport ou une ligne de journal ne la changent pas. Fichier : `git rev-parse --git-path
// pulse-preuve.json` (propre à chaque dossier de travail, worktree compris ; jamais dans un commit) : date, empreinte,
// fichiers, portée, et pour chaque commande son code de sortie, sa durée (ms) et, en échec, ses 30 dernières lignes.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { commandesDe, REECRIT, DEPASSE } = require("./fin-de-tour");
const { lignesCommandes, raisonRefus } = require("./autorisations");

const VERSION = 2;
const LANCEUR = path.join(__dirname, "fin-de-tour.js");
const DELAI_S = 600; // par commande
const LIGNES_ECHEC = 30;
const CITES_MAX = 10;
const HORS = /^(docs|aidd_docs)\//;
const COMMANDES = "docs/technical.md"; // compté malgré HORS : ses commandes font la preuve
const FICHIER_TEST_SUR = /^[\w@%+=,./][\w@%+=,./-]*$/;
const FAMILLES = [
  { famille: "controles", libelle: /^contr[ôo]les automatiques\b/i },
  { famille: "tests", libelle: /^tester$/i },
  { famille: "construction", libelle: /^construire\b/i },
];
const ABSENTE = {
  tests: "suite : aucune (choix du projet, docs/technical.md)",
  construction: "aucune construction (ligne « Construire » sans commande dans docs/technical.md)",
};
const USAGE =
  "Usage : pulse-aidd preuve lancer [--portee suite | --portee tache <fichiers de test…>] [--construire]\n" +
  "        pulse-aidd preuve construire\n" +
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
  const modifies = [...liste(git(racine, ["diff", "--name-only", "-z"])), ...liste(git(racine, ["ls-files", "-o", "--exclude-standard", "-z"]))];
  for (const f of [...modifies.filter((x) => !HORS.test(x)), COMMANDES]) {
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

/** Les commandes de chaque famille dans « Commandes du projet » (sans celles qui réécrivent) : { controles, tests, construction } ou null. */
function commandesParFamille(racine) {
  const lignes = lignesCommandes(racine);
  if (!lignes) return null;
  const resultat = { controles: [], tests: [], construction: [] };
  for (const { libelle, cellule } of lignes) {
    const famille = FAMILLES.find((x) => x.libelle.test(libelle));
    if (famille && !resultat[famille.famille].length) resultat[famille.famille] = commandesDe(cellule).filter((c) => !REECRIT.test(c));
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

const aucunTest = (preuve) => Boolean(preuve.tests && preuve.tests.total === 0);

/** Vrai quand une famille a une commande en échec ou non lancée (ou, pour les tests, aucun test trouvé). */
function enEchec(preuve, famille) {
  return preuve.resultats.some((c) => c.famille === famille && c.code !== 0) || (famille === "tests" && aucunTest(preuve));
}

/** La ligne de la preuve, puis les lignes utiles de chaque échec et chaque commande non lancée, avec sa raison. */
function resume(preuve) {
  const signe = (famille) => (enEchec(preuve, famille) ? "❌" : "✅");
  const portee = preuve.portee === "suite" ? "(suite)" : "(tâche)";
  const morceaux = [preuve.resultats.some((c) => c.famille === "controles") ? `contrôles ${signe("controles")}` : "aucun contrôle"];
  if (preuve.absentes.includes("tests")) morceaux.push(ABSENTE.tests);
  else morceaux.push(`tests${preuve.tests ? ` ${preuve.tests.passes}/${preuve.tests.total}` : ""} ${signe("tests")} ${portee}${aucunTest(preuve) ? " (aucun test trouvé)" : ""}`);
  if (preuve.construire) morceaux.push(preuve.absentes.includes("construction") ? ABSENTE.construction : `construction ${signe("construction")}`);
  const lignes = [`preuve: ${preuve.ok ? "✅" : "❌"} à jour · ${morceaux.join(" · ")} · ${age(preuve.date)}`];
  for (const c of preuve.resultats.filter((x) => x.code !== 0)) {
    if (c.nonLance) lignes.push("", `❌ contrôle non lancé : \`${c.commande}\` ${c.nonLance}`);
    else lignes.push("", `❌ \`${c.commande}\` (${c.depasse ? `délai de ${DELAI_S} s dépassé` : `code ${c.code}, ${Math.round(c.duree / 1000)} s`}) :`, ...c.lignes);
  }
  if (aucunTest(preuve)) lignes.push("", "❌ la commande « Tester » de docs/technical.md ne lance aucun test : corrigez-la, ou écrivez « aucune » si le projet n'a pas de tests.");
  if (!preuve.ok) lignes.push("", "Échecs à corriger : relancer sur le même contenu donnerait le même résultat.");
  return lignes.join("\n");
}

/** Lance les commandes des familles retenues (celles hors des autorisations : non lancées, avec la raison). */
function lancerFamilles(racine, familles, retenues, options) {
  const resultats = [];
  const sortiesTests = [];
  for (const famille of retenues) {
    for (const c of familles[famille]) {
      const raison = raisonRefus(c);
      if (raison) {
        resultats.push({ famille, commande: c, code: null, nonLance: raison });
        continue;
      }
      const r = executer(racine, famille === "tests" && options.portee === "tache" ? avecFichiers(c, options.fichiers) : c);
      if (famille === "tests") sortiesTests.push(r.texte);
      const resultat = { famille, commande: r.commande, code: r.code, duree: r.duree };
      if (r.depasse) resultat.depasse = true;
      if (r.code !== 0) resultat.lignes = sansCouleurs(r.texte).replace(/\s+$/, "").split(/\r?\n/).slice(-LIGNES_ECHEC);
      resultats.push(resultat);
    }
  }
  return { resultats, sortiesTests };
}

/** La preuve enregistrée (null si absente, illisible ou d'une ancienne version). */
function lirePreuve(racine) {
  try {
    const preuve = JSON.parse(fs.readFileSync(fichierPreuve(racine), "utf8"));
    return preuve && preuve.version === VERSION && preuve.fichiers ? preuve : null;
  } catch {
    return null;
  }
}

function enregistrer(racine, preuve) {
  const cible = fichierPreuve(racine);
  const provisoire = `${cible}.${process.pid}.tmp`;
  fs.writeFileSync(provisoire, JSON.stringify(preuve) + "\n");
  fs.renameSync(provisoire, cible);
}

/** Ajoute la construction à la preuve à jour, sans relancer contrôles ni tests. */
function construire(racine) {
  const preuve = lirePreuve(racine);
  if (!preuve || empreinte(etatFichiers(racine)) !== preuve.empreinte) {
    console.log(`preuve: ${preuve ? "périmée" : "aucune"} : rien n'a été lancé (lancez pulse-aidd preuve lancer --portee suite --construire)`);
    return 2;
  }
  const familles = commandesParFamille(racine);
  if (!familles) {
    console.log("preuve: aucune commande (section « Commandes du projet » de docs/technical.md introuvable) ; rien n'a été lancé.");
    return 2;
  }
  const { resultats } = lancerFamilles(racine, familles, ["construction"], { portee: preuve.portee });
  preuve.resultats = [...preuve.resultats.filter((c) => c.famille !== "construction"), ...resultats];
  preuve.construire = true;
  preuve.absentes = [...preuve.absentes.filter((f) => f !== "construction"), ...(familles.construction.length ? [] : ["construction"])];
  preuve.ok = !["controles", "tests", "construction"].some((f) => enEchec(preuve, f));
  enregistrer(racine, preuve); // empreinte gardée : un fichier compté modifié par la construction rend la preuve périmée
  console.log(resume(preuve));
  return preuve.ok ? 0 : 1;
}

function lancer(racine, options) {
  const familles = commandesParFamille(racine);
  if (!familles) {
    console.log("preuve: aucune commande (section « Commandes du projet » de docs/technical.md introuvable)");
    return 1;
  }
  const retenues = ["controles", "tests", ...(options.construire ? ["construction"] : [])];
  const absentes = retenues.filter((f) => f !== "controles" && !familles[f].length);
  const avant = etatFichiers(racine);
  const { resultats, sortiesTests } = lancerFamilles(racine, familles, retenues, options);
  const comptes = sortiesTests.map(compteTests);
  const tests = comptes.length && comptes.every(Boolean) ? comptes.reduce((a, b) => ({ passes: a.passes + b.passes, total: a.total + b.total })) : null;
  const apres = etatFichiers(racine);
  const preuve = {
    version: VERSION,
    date: new Date().toISOString(),
    empreinte: empreinte(apres),
    portee: options.portee,
    fichiersTest: options.portee === "tache" ? options.fichiers : [],
    construire: options.construire,
    absentes,
    tests,
    resultats,
    fichiers: apres,
  };
  preuve.ok = !retenues.some((f) => enEchec(preuve, f));
  enregistrer(racine, preuve);

  console.log(resume(preuve));
  const ecrits = differences(avant, apres);
  if (ecrits.length)
    console.log(`\nFichiers écrits pendant le lancement : ${citer(ecrits)}. La preuve vaut pour leur contenu d'après ; s'ils sont produits par les tests, ajoutez-les à .gitignore.`);
  return preuve.ok ? 0 : 1;
}

/** La relance à indiquer : toute la suite si elle est exigée (ou sans ancienne preuve), sinon la portée de l'ancienne preuve ; construction gardée. */
function relance(exigences, preuve) {
  const tache = !exigences.includes("suite") && preuve && preuve.portee === "tache" && preuve.fichiersTest.length;
  const construire = exigences.includes("construction") || Boolean(preuve && preuve.construire);
  return `relancez : pulse-aidd preuve lancer ${tache ? `--portee tache ${preuve.fichiersTest.join(" ")}` : "--portee suite"}${construire ? " --construire" : ""}`;
}

function etat(racine, exigences) {
  const preuve = lirePreuve(racine);
  if (!preuve) {
    console.log(`preuve: aucune ; ${relance(exigences, null)}`);
    return 1;
  }
  const actuels = etatFichiers(racine);
  if (empreinte(actuels) !== preuve.empreinte) {
    console.log(`preuve: périmée (fichiers modifiés depuis : ${citer(differences(preuve.fichiers, actuels))}) ; ${relance(exigences, preuve)}`);
    return 1;
  }
  // « Tester » vaut « aucune » : pas de suite, choix du projet ; --exiger suite est satisfaite par les contrôles.
  if (exigences.includes("suite") && preuve.portee !== "suite" && !preuve.absentes.includes("tests")) {
    console.log(`preuve: portée insuffisante (tests des fichiers de la tâche seulement ; demandée : toute la suite) ; ${relance(exigences, preuve)}`);
    return 1;
  }
  if (exigences.includes("construction") && (!preuve.construire || preuve.absentes.includes("construction"))) {
    console.log(
      preuve.construire
        ? "preuve: portée insuffisante (aucune commande « Construire » dans docs/technical.md ; demandée : construction) : lisez la preuve sans --exiger construction"
        : "preuve: portée insuffisante (construction non lancée ; demandée : construction) ; ajoutez-la : pulse-aidd preuve construire",
    );
    return 1;
  }
  console.log(resume(preuve));
  return preuve.ok ? 0 : 1;
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
    if (refuse !== undefined)
      return { refus: `fichier de test refusé : ${refuse} (donnez un chemin relatif au projet, sans « .. », sans espace, sans lecteur, sans tiret au début)` };
    return { action, options };
  }
  if (action === "construire") return reste.length ? { usage: `Option inconnue : ${reste[0]}` } : { action };
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
  if (lu.action === "lancer") return lancer(racine, lu.options);
  if (lu.action === "construire") return construire(racine);
  return etat(racine, lu.exigences);
}

if (require.main === module) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (e) {
    console.log(`preuve: erreur : ${e.message}`);
    process.exitCode = 1;
  }
}

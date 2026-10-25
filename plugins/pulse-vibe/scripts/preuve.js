#!/usr/bin/env node
// Pulse – la preuve des tests et contrôles (`pulse-aidd preuve`), produite par le verifier ou le test-runner et relue
// par les autres (relecture, commit, mise en ligne) : un lancement réel, valable pour un contenu précis des fichiers.
//
//   lancer [--portee suite | --portee tache [<fichiers de test…>]] [--construire]
//     lance, lus dans « Commandes du projet » de docs/technical.md (lignesCommandes d'autorisations.js) : les
//     « Contrôles automatiques » (sauf ceux qui réécrivent les fichiers, motif REECRIT de fin-de-tour.js), « Tester »
//     (libellé exact : jamais « Tester de bout en bout » ; toute la suite, ou les fichiers donnés) et « Construire »
//     avec --construire. Une commande hors des autorisations du projet (raisonRefus d'autorisations.js) n'est pas
//     lancée : la preuve est ❌, avec la raison. Une cellule sans accents graves est la commande elle-même (celluleNue
//     d'autorisations.js : « — » vaut « aucune », plusieurs commandes dans la cellule sont refusées). « Tester » à
//     « aucune » : pas de suite, choix du projet (la preuve le dit) ; ligne « Tester » absente ou vide : ❌ ; une suite
//     qui ne lance aucun test : ❌, sauf quand le projet n'a encore aucun fichier de test (« aucun test écrit pour
//     l'instant », non bloquant). --portee tache sans fichier (tâche sans test) : contrôles, et construction demandée,
//     seuls. Fichiers de test écrits avec « \ » : lus avec « / ». La preuve est réécrite après chaque commande : un
//     lancement arrêté en route (délai de l'outil qui le lance) laisse « lancement interrompu », avec la relance. La
//     ligne donne la durée des tests. Code 0 si tout passe, 1 sinon, 2 si un fichier de test est refusé (rien n'est lancé).
//   construire
//     ajoute la construction à la preuve à jour et verte, sans relancer contrôles ni tests. Code 0 si elle passe,
//     1 sinon, 2 sans preuve à jour et verte (rien n'est lancé). L'empreinte reste celle de la preuve : un fichier
//     compté écrit par la construction est signalé, et la preuve devient périmée.
//   etat [--exiger suite] [--exiger construction]
//     à jour et verte : la ligne de la preuve, code 0 ; à jour et rouge (❌, avec ses lignes d'échec), « périmée
//     (fichiers modifiés depuis : …) », « aucune » ou « portée insuffisante » : code 1. --exiger suite est satisfaite
//     quand « Tester » vaut « aucune » (choix du projet) ; les contrôles, et la construction si elle est exigée, comptent.
//     Chaque réponse dit la suite à donner : « relancez : … » (périmée, aucune, portée insuffisante : même portée que
//     l'ancienne preuve, construction gardée ; portée tâche : « <fichiers de test de la tâche> »), « ajoutez-la :
//     pulse-aidd preuve construire », ou, pour une preuve rouge à jour, « échecs à corriger », avec la relance à faire
//     une fois réparée une cause hors des fichiers (service, variable, outil, délai). Chaque lancement cité rappelle le
//     délai à donner à l'outil Bash (timeout 600000).
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
const { lignesCommandes, celluleNue, raisonRefus } = require("./autorisations");

const VERSION = 4; // 4 : lancement interrompu, aucun test écrit, durée des tests
const LANCEUR = path.join(__dirname, "fin-de-tour.js");
const DELAI_S = 600; // par commande
const LIGNES_ECHEC = 30;
const CITES_MAX = 10;
const HORS = /^(docs|aidd_docs)\//;
const COMMANDES = "docs/technical.md"; // compté malgré HORS : ses commandes font la preuve
const FICHIER_TEST_SUR = /^[\w@%+=,./][\w@%+=,./-]*$/;
// Un fichier de test du projet : *.test.*, *.spec.*, *_test.*, test_*.py, ou rangé dans un dossier tests/ ou __tests__/.
const FICHIER_DE_TEST = /(^|\/)(tests|__tests__)\/|\.(test|spec)\.[^/]+$|_test\.[^/]+$|(^|\/)test_[^/]*\.py$/;
const OUTIL_BASH = "(outil Bash : timeout 600000)"; // une preuve groupée dépasse vite les 2 minutes par défaut de l'outil
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
  "Usage : pulse-aidd preuve lancer [--portee suite | --portee tache [<fichiers de test…>]] [--construire]\n" +
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

/** Les fichiers de test du projet, suivis ou non suivis non ignorés. */
const fichiersDeTest = (racine) => liste(git(racine, ["ls-files", "-c", "-o", "--exclude-standard", "-z"])).filter((f) => FICHIER_DE_TEST.test(f));

const empreinte = (fichiers) => crypto.createHash("sha256").update(JSON.stringify(fichiers)).digest("hex");

/** Les fichiers dont le contenu diffère entre deux relevés (modifiés, ajoutés, retirés). */
function differences(avant, apres) {
  const noms = new Set([...Object.keys(avant), ...Object.keys(apres)]);
  return [...noms].filter((f) => avant[f] !== apres[f]).sort();
}

const citer = (fichiers) =>
  fichiers.slice(0, CITES_MAX).join(", ") + (fichiers.length > CITES_MAX ? ` et ${fichiers.length - CITES_MAX} autres` : "");

/**
 * Les commandes de chaque famille dans « Commandes du projet » (sans celles qui réécrivent) : { controles, tests,
 * construction, aucune: Set des familles à « aucune », refus: Map commande → raison } ou null. Cellule sans accents
 * graves : la cellule est la commande (refusée quand elle en contient plusieurs).
 */
function commandesParFamille(racine) {
  const lignes = lignesCommandes(racine);
  if (!lignes) return null;
  const resultat = { controles: [], tests: [], construction: [], aucune: new Set(), refus: new Map() };
  for (const { libelle, cellule } of lignes) {
    const famille = FAMILLES.find((x) => x.libelle.test(libelle));
    if (!famille || resultat[famille.famille].length || resultat.aucune.has(famille.famille)) continue;
    const nue = celluleNue(cellule);
    if (nue && nue.aucune) resultat.aucune.add(famille.famille);
    else if (nue && nue.refus) {
      resultat[famille.famille] = [nue.commande];
      resultat.refus.set(nue.commande, nue.refus);
    } else resultat[famille.famille] = (nue ? (nue.commande ? [nue.commande] : []) : commandesDe(cellule)).filter((c) => !REECRIT.test(c));
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

function duree(ms) {
  const secondes = Math.round(ms / 1000);
  if (secondes < 60) return `${secondes} s`;
  return `${Math.floor(secondes / 60)} min${secondes % 60 ? ` ${secondes % 60} s` : ""}`;
}

/** Aucun test trouvé alors que des fichiers de test existent (ou en portée tâche) : la commande « Tester » est à corriger. */
const aucunTest = (preuve) => Boolean(preuve.tests && preuve.tests.total === 0 && !preuve.aucunTestEcrit);

/** La commande qui relance la même preuve : même portée, mêmes fichiers de test, construction gardée. */
const memeLancement = (preuve) =>
  `pulse-aidd preuve lancer ${preuve.portee === "tache" ? ["--portee tache", ...preuve.fichiersTest].join(" ") : "--portee suite"}${preuve.construire ? " --construire" : ""}`;

/** Vrai quand une famille a une commande en échec ou non lancée (ou, pour les tests, aucun test trouvé ou ligne « Tester » absente). */
function enEchec(preuve, famille) {
  if (preuve.interrompu) return true;
  return preuve.resultats.some((c) => c.famille === famille && c.code !== 0) || (famille === "tests" && (aucunTest(preuve) || preuve.testerAbsente));
}

/** La ligne de la preuve, puis les lignes utiles de chaque échec et chaque commande non lancée, avec sa raison. */
function resume(preuve) {
  const faits = { ...preuve, interrompu: false }; // un lancement interrompu montre ce qui a déjà tourné
  const signe = (famille) => (enEchec(faits, famille) ? "❌" : "✅");
  const testsLances = preuve.resultats.filter((c) => c.famille === "tests" && typeof c.duree === "number");
  const portee = `(${preuve.portee === "suite" ? "suite" : "tâche"}${testsLances.length ? `, ${duree(testsLances.reduce((t, c) => t + c.duree, 0))}` : ""})`;
  const morceaux = [preuve.resultats.some((c) => c.famille === "controles") ? `contrôles ${signe("controles")}` : "aucun contrôle"];
  if (preuve.interrompu) morceaux.push("lancement interrompu");
  else if (preuve.absentes.includes("tests")) morceaux.push(ABSENTE.tests);
  else if (preuve.testerAbsente) morceaux.push("tests ❌ (ligne « Tester » absente de docs/technical.md)");
  else if (preuve.sansFichierTest) morceaux.push("tests : aucun fichier de test pour cette tâche");
  else if (preuve.aucunTestEcrit) morceaux.push("tests : aucun test écrit pour l'instant");
  else morceaux.push(`tests${preuve.tests ? ` ${preuve.tests.passes}/${preuve.tests.total}` : ""} ${signe("tests")} ${portee}${aucunTest(preuve) ? " (aucun test trouvé)" : ""}`);
  if (preuve.construire && !preuve.interrompu) morceaux.push(preuve.absentes.includes("construction") ? ABSENTE.construction : `construction ${signe("construction")}`);
  const lignes = [`preuve: ${preuve.ok ? "✅" : "❌"} à jour · ${morceaux.join(" · ")} · ${age(preuve.date)}`];
  for (const c of preuve.resultats.filter((x) => x.code !== 0)) {
    if (c.nonLance) lignes.push("", `❌ contrôle non lancé : \`${c.commande}\` ${c.nonLance}`);
    else lignes.push("", `❌ \`${c.commande}\` (${c.depasse ? `délai de ${DELAI_S} s dépassé` : `code ${c.code}, ${Math.round(c.duree / 1000)} s`}) :`, ...c.lignes);
  }
  if (preuve.testerAbsente) lignes.push("", "❌ ligne « Tester » absente de docs/technical.md : écrivez sa commande, ou « aucune » si le projet n'a pas de tests.");
  if (aucunTest(preuve))
    lignes.push("", `❌ la commande « Tester » de docs/technical.md ne lance aucun test${preuve.exemplesTest && preuve.exemplesTest.length ? `, alors que le projet a des fichiers de test (${citer(preuve.exemplesTest)})` : ""} : corrigez-la.`);
  if (preuve.interrompu)
    lignes.push("", `❌ lancement interrompu après ${preuve.resultats.length} commande(s) sur ${preuve.prevues} : l'outil qui le lançait s'est arrêté avant la fin ${OUTIL_BASH}. Relancez : ${memeLancement(preuve)}.`);
  else if (!preuve.ok)
    lignes.push("", `Échecs à corriger. Cause hors des fichiers (service à démarrer, variable, outil, délai dépassé), une fois réparée : relancez : ${memeLancement(preuve)} ${OUTIL_BASH}.`);
  return lignes.join("\n");
}

/** Les commandes à lancer, dans l'ordre : [{ famille, commande }]. */
function aLancer(familles, retenues, options) {
  return retenues
    .filter((famille) => !(famille === "tests" && options.portee === "tache" && !options.fichiers.length)) // tâche sans test
    .flatMap((famille) => familles[famille].map((commande) => ({ famille, commande })));
}

/**
 * Lance les commandes des familles retenues (celles hors des autorisations : non lancées, avec la raison) ; apresChaque
 * reçoit les résultats après chaque commande (preuve partielle : un arrêt laisse « lancement interrompu »).
 */
function lancerFamilles(racine, familles, retenues, options, apresChaque = () => {}) {
  const resultats = [];
  const sortiesTests = [];
  for (const { famille, commande: c } of aLancer(familles, retenues, options)) {
    const raison = familles.refus.get(c) || raisonRefus(c);
    if (raison) resultats.push({ famille, commande: c, code: null, nonLance: raison });
    else {
      const r = executer(racine, famille === "tests" && options.portee === "tache" ? avecFichiers(c, options.fichiers) : c);
      if (famille === "tests") sortiesTests.push(r.texte);
      const resultat = { famille, commande: r.commande, code: r.code, duree: r.duree };
      if (r.depasse) resultat.depasse = true;
      if (r.code !== 0) resultat.lignes = sansCouleurs(r.texte).replace(/\s+$/, "").split(/\r?\n/).slice(-LIGNES_ECHEC);
      resultats.push(resultat);
    }
    apresChaque(resultats);
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
  const avant = etatFichiers(racine);
  if (!preuve || empreinte(avant) !== preuve.empreinte) {
    console.log(`preuve: ${preuve ? "périmée" : "aucune"} : rien n'a été lancé ; lancez : pulse-aidd preuve lancer --portee suite --construire ${OUTIL_BASH}`);
    return 2;
  }
  if (!preuve.ok) {
    console.log("preuve: ❌ à jour : échecs à corriger d'abord ; rien n'a été lancé (pulse-aidd preuve etat les montre)");
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
  const ecrits = differences(avant, etatFichiers(racine));
  if (ecrits.length)
    console.log(`\nFichiers écrits pendant la construction : ${citer(ecrits)}. La preuve devient périmée ; s'ils sont produits par la construction, ajoutez-les à .gitignore.`);
  return preuve.ok ? 0 : 1;
}

function lancer(racine, options) {
  const familles = commandesParFamille(racine);
  if (!familles) {
    console.log("preuve: aucune commande (section « Commandes du projet » de docs/technical.md introuvable)");
    return 1;
  }
  const retenues = ["controles", "tests", ...(options.construire ? ["construction"] : [])];
  const absentes = retenues.filter((f) => (f === "tests" ? familles.aucune.has(f) : f !== "controles" && !familles[f].length));
  const testerAbsente = !familles.tests.length && !familles.aucune.has("tests");
  const sansFichierTest = options.portee === "tache" && !options.fichiers.length;
  const avant = etatFichiers(racine);
  const base = {
    version: VERSION,
    portee: options.portee,
    fichiersTest: options.portee === "tache" ? options.fichiers : [],
    construire: options.construire,
    absentes,
    testerAbsente,
    sansFichierTest,
  };
  // Preuve partielle, réécrite après chaque commande : un lancement arrêté en route reste visible (« lancement interrompu »).
  const partielle = (resultats) =>
    enregistrer(racine, { ...base, date: new Date().toISOString(), empreinte: empreinte(avant), interrompu: true, prevues: aLancer(familles, retenues, options).length, tests: null, resultats, ok: false, fichiers: avant });
  partielle([]);
  const { resultats, sortiesTests } = lancerFamilles(racine, familles, retenues, options, partielle);
  const comptes = sortiesTests.map(compteTests);
  const tests = comptes.length && comptes.every(Boolean) ? comptes.reduce((a, b) => ({ passes: a.passes + b.passes, total: a.total + b.total })) : null;
  // Aucun test trouvé : non bloquant tant que le projet n'a aucun fichier de test (outil installé, aucun test écrit).
  const projetTests = tests && tests.total === 0 ? fichiersDeTest(racine) : [];
  const apres = etatFichiers(racine);
  const preuve = {
    ...base,
    date: new Date().toISOString(),
    empreinte: empreinte(apres),
    aucunTestEcrit: Boolean(tests && tests.total === 0 && options.portee === "suite" && !projetTests.length),
    exemplesTest: projetTests.slice(0, 3),
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

/**
 * La relance à indiquer : toute la suite si elle est exigée (ou sans ancienne preuve), sinon la portée de l'ancienne
 * preuve (portée tâche : les fichiers de test de la tâche à examiner, qui n'est peut-être plus celle de l'ancienne
 * preuve) ; construction gardée.
 */
function relance(exigences, preuve) {
  const tache = !exigences.includes("suite") && preuve && preuve.portee === "tache";
  const construire = exigences.includes("construction") || Boolean(preuve && preuve.construire);
  return `relancez : pulse-aidd preuve lancer ${tache ? "--portee tache <fichiers de test de la tâche>" : "--portee suite"}${construire ? " --construire" : ""} ${OUTIL_BASH}`;
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
  // Une preuve rouge se corrige avant tout (sa dernière ligne dit la relance après une cause hors des fichiers réparée).
  if (!preuve.ok) {
    console.log(resume(preuve));
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
        : `preuve: portée insuffisante (construction non lancée ; demandée : construction) ; ajoutez-la : pulse-aidd preuve construire ${OUTIL_BASH}`,
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
        while (i + 1 < reste.length && !reste[i + 1].startsWith("--")) options.fichiers.push(reste[++i].replace(/\\/g, "/")); // aucun fichier : tâche sans test ; « \ » de Windows lus « / »
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

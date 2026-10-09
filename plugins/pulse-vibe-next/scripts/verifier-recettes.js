#!/usr/bin/env node
// Pulse Next.js – vérification des recettes (outil du dépôt : CI et maintenance).
//
//   node plugins/pulse-vibe-next/scripts/verifier-recettes.js [--recettes connexion,liste | --toutes | --depuis <ref>] [--projet <dossier>] [--garder]
//
//   --recettes   recettes à appliquer, dans l'ordre (par défaut : la chaîne connexion → liste)
//   --toutes     vérifie chaque chaîne de CHAINES, chacune sur un squelette neuf ; résumé à la fin (CI : chaque semaine et à la demande)
//   --depuis     vérifie les chaînes de CHAINES touchées par les fichiers modifiés depuis <ref> (git diff <ref>...HEAD) :
//                celles qui contiennent une recette modifiée, toutes si le squelette ou l'outillage changent (CI : à chaque envoi)
//   --projet     projet déjà créé et installé (sinon : squelette posé dans un dossier temporaire, puis npm install)
//   --garder     garde le dossier temporaire et l'indique (pour regarder un échec)
//
// Pose sur le squelette le code balisé de chaque recette, dans l'ordre du document, puis :
// npm run check, npm run typecheck, npm test (PGlite), npm run build. Sort en erreur au premier échec.
//
// Balisage d'une recette (commentaires HTML, invisibles une fois le Markdown affiché) :
//   <!-- fichier: <chemin> -->                         juste avant un bloc de code : le fichier entier
//   <!-- ajout: <chemin> -->                           juste avant un bloc : ajouté à la fin du fichier
//   <!-- ajout: <chemin> après: <ligne> -->            juste avant un bloc : inséré après la première ligne égale à <ligne>
//   <!-- remplacer: <chemin> -->                       juste avant un bloc : remplace le passage du fichier qui va de la
//                                                      première ligne du bloc à la ligne suivante égale à sa dernière ligne
//   <!-- remplacer-ligne: <chemin> début: <texte> -->  juste avant un bloc : remplace la première ligne qui commence
//                                                      par <texte> (espaces de tête ignorés)
//   <!-- commande: <commande> -->                      commande lancée dans le projet, à ce point de la recette
//   <!-- supprimer: <chemin> -->                       fichier du projet supprimé (il doit exister)
//   <!-- deplacer: <source> vers: <destination> -->    fichier ou dossier déplacé (destination absente)
//   <!-- sans-verification: <raison> -->               juste avant un bloc : bloc laissé de côté, listé à la fin
// Un bloc sans balise reste une explication : il n'est pas posé.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RECETTES = path.join(__dirname, "..", "references", "recettes");
const { texteRecette } = require("./decouper-recette.js");
const CHAINE = ["connexion", "liste"];
// Chaînes vérifiées par la CI (--toutes, --depuis), dans l'ordre d'application. Chaque recette du pack figure
// dans l'une d'elles (tests/verifier-recettes.test.js).
const CHAINES = [
  ["connexion", "liste"],
  ["connexion", "fichiers"],
  ["connexion", "paiement"],
];

// Chemins (relatifs au dépôt) dont dépend chaque chaîne : un changement ici les fait toutes vérifier.
// Un chemin qui finit par « / » couvre tout son dossier.
const PACK = "plugins/pulse-vibe-next/";
const COMMUNS = [
  `${PACK}templates/squelette/`,
  `${PACK}scripts/verifier-recettes.js`,
  `${PACK}scripts/squelette.js`,
  `${PACK}scripts/decouper-recette.js`,
  ".github/workflows/squelette-next.yml",
];
const DOSSIER_DE_RECETTE = /^plugins\/pulse-vibe-next\/references\/recettes\/([^/]+)\//;

/** Chaînes à vérifier pour une liste de fichiers modifiés : toutes si un fichier commun change, sinon celles qui contiennent une recette modifiée. */
function chainesTouchees(fichiers, chaines = CHAINES) {
  if (fichiers.some((f) => COMMUNS.some((c) => (c.endsWith("/") ? f.startsWith(c) : f === c)))) return chaines;
  const recettes = new Set(fichiers.map((f) => DOSSIER_DE_RECETTE.exec(f)).filter(Boolean).map((m) => m[1]));
  return chaines.filter((chaine) => chaine.some((nom) => recettes.has(nom)));
}

/** Fichiers modifiés entre la base commune de <ref> et HEAD (git diff <ref>...HEAD) ; null si Git ne sait pas comparer. */
function fichiersModifies(ref, cwd = path.join(__dirname, "..", "..", "..")) {
  const r = spawnSync("git", ["diff", "--name-only", `${ref}...HEAD`, "--"], { cwd, encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
}
// Commandes qu'une balise peut lancer : installation de paquets, composants shadcn, génération des migrations.
// Chaque argument est contrôlé ; la commande est lancée sans interpréteur (voir lancer).
const PAQUET = /^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*(@[\w.^~-]+)?$/;
const COMPOSANT = /^[a-z0-9][a-z0-9-]*$/;

/** Découpe une commande balisée : { programme, args } ; refuse tout argument non prévu. */
function analyserCommande(commande, numero) {
  const [programme, ...args] = commande.trim().split(/\s+/);
  if (programme === "npm" && args[0] === "install" && args.length > 1 && args.slice(1).every((a) => PAQUET.test(a))) return { programme, args };
  if (programme === "npx" && args[0] === "shadcn@latest" && args[1] === "add" && args.length > 2 && args.slice(2).every((a) => COMPOSANT.test(a))) return { programme, args };
  if (programme === "npm" && args.length === 2 && args[0] === "run" && args[1] === "db:generate") return { programme, args };
  throw new Error(`ligne ${numero} : commande non permise dans une balise : ${commande}`);
}
// drizzle-kit generate lit une adresse sans s'y connecter.
const ADRESSE_FACTICE = "postgresql://verification@localhost:5432/verification";
const BALISE = /^<!--\s*(fichier|ajout|remplacer-ligne|remplacer|commande|supprimer|deplacer|sans-verification):\s*(.+?)\s*-->\s*$/;

/** Refuse un chemin hors du projet : absolu, lecteur Windows, option déguisée, « .. ». */
function verifierChemin(chemin, numero) {
  if (path.isAbsolute(chemin) || /^[a-zA-Z]:/.test(chemin) || chemin.startsWith("-") || chemin.split(/[\\/]/).includes("..")) throw new Error(`ligne ${numero} : chemin hors du projet : ${chemin}`);
  return chemin;
}

/** Lit la valeur d'une balise de fichier : { chemin, ancre? }. */
function lireCible(type, valeur, numero) {
  const m = /^(\S+)(?:\s+(après|début):\s+(.+))?$/.exec(valeur);
  if (!m) throw new Error(`ligne ${numero} : balise illisible : ${valeur}`);
  const [, chemin, mot, ancre] = m;
  verifierChemin(chemin, numero);
  if (mot === "après" && type !== "ajout") throw new Error(`ligne ${numero} : « après: » sert seulement à la balise ajout`);
  if (mot === "début" && type !== "remplacer-ligne") throw new Error(`ligne ${numero} : « début: » sert seulement à la balise remplacer-ligne`);
  if (type === "remplacer-ligne" && !ancre) throw new Error(`ligne ${numero} : remplacer-ligne demande « début: <texte> »`);
  return { chemin, ancre };
}

/** Étapes balisées d'une recette, dans l'ordre : { type, chemin?, ancre?, commande?, contenu?, ligne }. */
function extraireEtapes(texte) {
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  const etapes = [];
  let attente = null; // balise de fichier qui attend son bloc
  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    const balise = BALISE.exec(ligne);
    if (balise) {
      if (attente) throw new Error(`ligne ${attente.ligne} : la balise « ${attente.type} » n'est suivie d'aucun bloc de code`);
      const [, type, valeur] = balise;
      if (type === "commande") {
        analyserCommande(valeur, i + 1);
        etapes.push({ type, commande: valeur, ligne: i + 1 });
      } else if (type === "supprimer") {
        etapes.push({ type, chemin: verifierChemin(valeur, i + 1), ligne: i + 1 });
      } else if (type === "deplacer") {
        const m = /^(\S+)\s+vers:\s+(\S+)$/.exec(valeur);
        if (!m) throw new Error(`ligne ${i + 1} : deplacer demande « <source> vers: <destination> »`);
        etapes.push({ type, chemin: verifierChemin(m[1], i + 1), vers: verifierChemin(m[2], i + 1), ligne: i + 1 });
      } else if (type === "sans-verification") attente = { type, raison: valeur, ligne: i + 1 };
      else attente = { type, ...lireCible(type, valeur, i + 1), ligne: i + 1 };
      continue;
    }
    if (!attente) continue;
    const ouverture = /^(`{3,})/.exec(ligne);
    if (!ouverture) {
      if (ligne.trim() === "") continue;
      throw new Error(`ligne ${attente.ligne} : la balise « ${attente.type} » doit précéder directement un bloc de code`);
    }
    const fin = lignes.findIndex((l, k) => k > i && l.trim() === ouverture[1]);
    if (fin < 0) throw new Error(`ligne ${i + 1} : bloc de code jamais fermé`);
    etapes.push({ ...attente, contenu: `${lignes.slice(i + 1, fin).join("\n")}\n` });
    attente = null;
    i = fin;
  }
  if (attente) throw new Error(`ligne ${attente.ligne} : la balise « ${attente.type} » n'est suivie d'aucun bloc de code`);
  return etapes;
}

/** Applique une étape de fichier au texte actuel du fichier (null s'il n'existe pas) ; rend le nouveau texte. */
function appliquerAuTexte(actuel, etape) {
  const ou = `${etape.chemin} (ligne ${etape.ligne} de la recette)`;
  if (etape.type === "fichier") return etape.contenu;
  if (actuel === null) throw new Error(`${ou} : le fichier à compléter n'existe pas`);
  const lignes = actuel.replace(/\r\n/g, "\n").split("\n");
  const bloc = etape.contenu.replace(/\n$/, "").split("\n");
  if (etape.type === "ajout" && etape.ancre === undefined) return `${actuel.replace(/\n*$/, "\n")}${etape.contenu}`;
  if (etape.type === "ajout") {
    const k = lignes.findIndex((l) => l.trim() === etape.ancre.trim());
    if (k < 0) throw new Error(`${ou} : ligne d'ancrage introuvable : ${etape.ancre}`);
    lignes.splice(k + 1, 0, ...bloc);
    return lignes.join("\n");
  }
  if (etape.type === "remplacer-ligne") {
    const k = lignes.findIndex((l) => l.trimStart().startsWith(etape.ancre));
    if (k < 0) throw new Error(`${ou} : aucune ligne ne commence par : ${etape.ancre}`);
    lignes.splice(k, 1, ...bloc);
    return lignes.join("\n");
  }
  // remplacer : de la première ligne du bloc à la ligne suivante égale à sa dernière ligne, de même indentation.
  if (etape.contenu.trim() === "") throw new Error(`${ou} : le bloc à remplacer est vide`);
  const debuts = lignes.flatMap((l, k) => (l.trim() === bloc[0].trim() ? [k] : []));
  if (!debuts.length) throw new Error(`${ou} : début du passage introuvable : ${bloc[0].trim()}`);
  if (debuts.length > 1) throw new Error(`${ou} : plusieurs passages commencent par « ${bloc[0].trim()} » (lignes ${debuts.map((k) => k + 1).join(", ")} du fichier) : précisez la balise`);
  const debut = debuts[0];
  const indentation = (l) => /^\s*/.exec(l)[0];
  const derniere = bloc[bloc.length - 1].trim();
  const fin = lignes.findIndex((l, k) => k >= (bloc.length > 1 ? debut + 1 : debut) && l.trim() === derniere && indentation(l) === indentation(bloc[0]));
  if (fin < 0) throw new Error(`${ou} : fin du passage introuvable (ligne « ${derniere} » de même indentation que le début)`);
  lignes.splice(debut, fin - debut + 1, ...bloc);
  return lignes.join("\n");
}

/** Programme et arguments de lancement sans interpréteur : sous Windows, npm et npx passent par leur script Node. */
function sansInterpreteur(programme, args) {
  if (process.platform === "win32" && (programme === "npm" || programme === "npx")) {
    const script = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", `${programme}-cli.js`);
    if (fs.existsSync(script)) return { exe: process.execPath, args: [script, ...args] };
  }
  return { exe: programme, args };
}

function lancer(programme, args, cwd, env = {}) {
  const texte = [programme, ...args].join(" ");
  console.log(`\n▶ ${texte}`);
  const { exe, args: complets } = sansInterpreteur(programme, args);
  const r = spawnSync(exe, complets, { cwd, shell: false, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.error) throw new Error(`${texte} (${r.error.message})`);
  if (r.status !== 0) throw new Error(`${texte} (code ${r.status})`);
}

/** Applique une étape de fichier dans le projet ; rend le chemin écrit (null pour un déplacement ou une suppression). */
function poserEtape(dossier, e) {
  const complet = (c) => path.join(dossier, ...c.split("/"));
  const ou = (c) => `${c} (ligne ${e.ligne} de la recette)`;
  if (e.type === "supprimer") {
    const cible = complet(e.chemin);
    if (!fs.existsSync(cible) || !fs.statSync(cible).isFile()) throw new Error(`${ou(e.chemin)} : fichier à supprimer introuvable`);
    fs.rmSync(cible);
    return null;
  }
  if (e.type === "deplacer") {
    const source = complet(e.chemin);
    const destination = complet(e.vers);
    if (!fs.existsSync(source)) throw new Error(`${ou(e.chemin)} : à déplacer, introuvable`);
    if (fs.existsSync(destination)) throw new Error(`${ou(e.vers)} : la destination existe déjà`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(source, destination);
    return null;
  }
  const cible = complet(e.chemin);
  const actuel = fs.existsSync(cible) ? fs.readFileSync(cible, "utf8") : null;
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, appliquerAuTexte(actuel, e));
  return e.chemin;
}

function poserRecette(dossier, nom, nonVerifies) {
  if (!fs.existsSync(path.join(RECETTES, nom, "index.md"))) throw new Error(`recette introuvable : ${nom}`);
  const etapes = extraireEtapes(texteRecette(nom));
  if (!etapes.length) throw new Error(`recette ${nom} : aucune balise (voir l'en-tête de ce script)`);
  console.log(`\n■ Recette ${nom} : ${etapes.length} étapes balisées`);
  const poses = [];
  for (const e of etapes) {
    if (e.type === "sans-verification") {
      nonVerifies.push(`${nom}, ligne ${e.ligne} : ${e.raison}`);
      continue;
    }
    if (e.type === "commande") {
      // shadcn demande confirmation pour un composant déjà présent : --yes --overwrite répond à sa place.
      const { programme, args } = analyserCommande(e.commande, e.ligne);
      lancer(programme, programme === "npx" ? [...args, "--yes", "--overwrite"] : args, dossier, { DATABASE_URL_DIRECT: ADRESSE_FACTICE });
      continue;
    }
    const pose = poserEtape(dossier, e);
    if (pose) poses.push(pose);
  }
  return poses;
}

function lireArguments(argv) {
  const opts = { recettes: CHAINE, projet: null, garder: false, toutes: false, depuis: null };
  let recettesDonnees = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (["--recettes", "--projet"].includes(a) && (argv[i + 1] === undefined || argv[i + 1].startsWith("--"))) throw new Error(`${a} demande une valeur`);
    // Une référence Git ne commence jamais par « - » : la refuser évite qu'elle soit lue comme une option de git diff.
    if (a === "--depuis" && (argv[i + 1] === undefined || argv[i + 1].startsWith("-") || argv[i + 1] === "")) throw new Error("--depuis demande une référence Git (branche ou commit)");
    if (a === "--recettes") {
      opts.recettes = String(argv[++i]).split(",").map((x) => x.trim()).filter(Boolean);
      recettesDonnees = true;
    } else if (a === "--projet") opts.projet = path.resolve(argv[++i]);
    else if (a === "--depuis") opts.depuis = argv[++i];
    else if (a === "--garder") opts.garder = true;
    else if (a === "--toutes") opts.toutes = true;
    else throw new Error(`Option inconnue : ${a}`);
  }
  if (opts.toutes && (recettesDonnees || opts.projet)) throw new Error("--toutes vérifie chaque chaîne de CHAINES sur un squelette neuf : sans --recettes ni --projet");
  if (opts.depuis && (opts.toutes || recettesDonnees || opts.projet)) throw new Error("--depuis choisit lui-même les chaînes de CHAINES, chacune sur un squelette neuf : sans --toutes, --recettes ni --projet");
  return opts;
}

/** Vérifie une chaîne de recettes sur un squelette neuf (ou sur --projet) ; rend true si tout passe. */
function verifierChaine(recettes, { projet = null, garder = false } = {}) {
  let dossier = projet;
  const temporaire = !dossier;
  let reussi = false;
  try {
    if (temporaire) {
      const { creerSquelette } = require("./squelette");
      dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-next-recettes-"));
      creerSquelette({ nom: "Projet de vérification", description: "Vérification automatique des recettes.", dossier });
      lancer("npm", ["install", "--no-audit", "--no-fund"], dossier);
    }
    const poses = [];
    const nonVerifies = [];
    for (const nom of recettes) poses.push(...poserRecette(dossier, nom, nonVerifies));
    // Mise en forme Biome des fichiers posés (et toujours présents) : un écart de forme se corrige chez la personne par npm run format.
    const uniques = [...new Set(poses)].filter((p) => fs.existsSync(path.join(dossier, p)));
    const avant = new Map(uniques.map((p) => [p, fs.readFileSync(path.join(dossier, p), "utf8")]));
    if (uniques.length) {
      const { exe, args } = sansInterpreteur("npx", ["biome", "format", "--write", ...uniques]);
      spawnSync(exe, args, { cwd: dossier, shell: false, stdio: "ignore" });
    }
    const reformes = uniques.filter((p) => fs.readFileSync(path.join(dossier, p), "utf8") !== avant.get(p));
    if (reformes.length) console.log(`\n⚠️ Mise en forme différente de Biome (à reporter dans la recette) :\n  ${reformes.join("\n  ")}`);
    lancer("npm", ["run", "check"], dossier);
    lancer("npm", ["run", "typecheck"], dossier);
    lancer("npm", ["test"], dossier);
    lancer("npm", ["run", "build"], dossier, { SKIP_ENV_VALIDATION: "1" });
    if (nonVerifies.length) console.log(`\n⚠️ Blocs non vérifiés (raison écrite dans la recette) :\n  ${nonVerifies.join("\n  ")}`);
    console.log(`\n✅ Recettes vérifiées : ${recettes.join(" → ")}.`);
    reussi = true;
  } catch (e) {
    console.error(`\n❌ Échec (${recettes.join(" → ")}) : ${e.message}`);
  } finally {
    if (temporaire && dossier) {
      if (garder || !reussi) console.log(`Dossier gardé : ${dossier}`);
      else {
        // Sous Windows, un fichier encore ouvert (antivirus, indexation) refuse parfois la suppression : nouveaux essais,
        // puis un simple message ; la vérification reste réussie.
        try {
          fs.rmSync(dossier, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        } catch (e) {
          console.log(`Dossier temporaire non retiré (${e.message}) : ${dossier}`);
        }
      }
    }
  }
  return reussi;
}

/** Les chaînes à vérifier selon les options : toutes, celles touchées depuis une référence, ou celle de --recettes. */
function chainesAVerifier(opts) {
  if (opts.toutes) return CHAINES;
  if (!opts.depuis) return [opts.recettes];
  const fichiers = fichiersModifies(opts.depuis);
  if (!fichiers) {
    // Premier envoi d'une branche, historique coupé : on vérifie tout plutôt que rien.
    console.log(`⚠️ Comparaison avec ${opts.depuis} impossible (référence absente ?) : toutes les chaînes sont vérifiées.`);
    return CHAINES;
  }
  const chaines = chainesTouchees(fichiers);
  console.log(
    chaines.length
      ? `Chaînes touchées depuis ${opts.depuis} : ${chaines.map((c) => c.join(",")).join(" ; ")}`
      : `Aucune recette, ni le squelette, ni l'outillage des recettes modifiés depuis ${opts.depuis} : aucune chaîne à vérifier.`,
  );
  return chaines;
}

function principal() {
  const opts = lireArguments(process.argv.slice(2));
  const chaines = chainesAVerifier(opts);
  const echecs = chaines.filter((chaine) => !verifierChaine(chaine, opts));
  if (chaines.length > 1) {
    const bilan = `${chaines.length - echecs.length}/${chaines.length} chaînes vérifiées`;
    console.log(echecs.length ? `\n❌ ${bilan} ; en échec : ${echecs.map((c) => c.join(",")).join(" ; ")}` : `\n✅ ${bilan}.`);
  }
  if (echecs.length) process.exitCode = 1;
}

if (require.main === module) principal();

module.exports = { extraireEtapes, appliquerAuTexte, analyserCommande, lireArguments, poserEtape, CHAINES, chainesTouchees, fichiersModifies };

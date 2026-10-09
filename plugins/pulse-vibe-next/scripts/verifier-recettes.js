#!/usr/bin/env node
// Pulse Next.js – vérification des recettes (outil du dépôt : CI et maintenance).
//
//   node plugins/pulse-vibe-next/scripts/verifier-recettes.js [--recettes connexion,liste] [--projet <dossier>] [--garder]
//
//   --recettes   recettes à appliquer, dans l'ordre (par défaut : la chaîne connexion → liste)
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
// Un bloc sans balise reste une explication : il n'est pas posé.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RECETTES = path.join(__dirname, "..", "references", "recettes");
const CHAINE = ["connexion", "liste"];
// Commandes qu'une balise peut lancer : installation de paquets, composants shadcn, génération des migrations.
const COMMANDES_PERMISES = [/^npm install [@a-z0-9][\w@./ -]*$/, /^npx shadcn@latest add [a-z0-9 -]+$/, /^npm run db:generate$/];
// drizzle-kit generate lit une adresse sans s'y connecter.
const ADRESSE_FACTICE = "postgresql://verification@localhost:5432/verification";
const BALISE = /^<!--\s*(fichier|ajout|remplacer-ligne|remplacer|commande):\s*(.+?)\s*-->\s*$/;

/** Lit la valeur d'une balise de fichier : { chemin, ancre? }. */
function lireCible(type, valeur, numero) {
  const m = /^(\S+)(?:\s+(après|début):\s+(.+))?$/.exec(valeur);
  if (!m) throw new Error(`ligne ${numero} : balise illisible : ${valeur}`);
  const [, chemin, mot, ancre] = m;
  if (path.isAbsolute(chemin) || chemin.split(/[\\/]/).includes("..")) throw new Error(`ligne ${numero} : chemin hors du projet : ${chemin}`);
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
        if (!COMMANDES_PERMISES.some((m) => m.test(valeur))) throw new Error(`ligne ${i + 1} : commande non permise dans une balise : ${valeur}`);
        etapes.push({ type, commande: valeur, ligne: i + 1 });
      } else attente = { type, ...lireCible(type, valeur, i + 1), ligne: i + 1 };
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
  // remplacer : de la première ligne du bloc à la ligne suivante égale à sa dernière ligne.
  const debut = lignes.findIndex((l) => l.trim() === bloc[0].trim());
  if (debut < 0) throw new Error(`${ou} : début du passage introuvable : ${bloc[0].trim()}`);
  const fin = lignes.findIndex((l, k) => k >= debut && l.trim() === bloc[bloc.length - 1].trim());
  if (fin < 0) throw new Error(`${ou} : fin du passage introuvable : ${bloc[bloc.length - 1].trim()}`);
  lignes.splice(debut, fin - debut + 1, ...bloc);
  return lignes.join("\n");
}

function lancer(commande, cwd, env = {}) {
  console.log(`\n▶ ${commande}`);
  const r = spawnSync(commande, { cwd, shell: true, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${commande} (code ${r.status})`);
}

function poserRecette(dossier, nom) {
  const fichier = path.join(RECETTES, `${nom}.md`);
  if (!fs.existsSync(fichier)) throw new Error(`recette introuvable : ${nom}`);
  const etapes = extraireEtapes(fs.readFileSync(fichier, "utf8"));
  if (!etapes.length) throw new Error(`recette ${nom} : aucune balise (voir l'en-tête de ce script)`);
  console.log(`\n■ Recette ${nom} : ${etapes.length} étapes balisées`);
  const poses = [];
  for (const e of etapes) {
    if (e.type === "commande") {
      // shadcn demande confirmation pour un composant déjà présent : --yes --overwrite répond à sa place.
      const commande = e.commande.startsWith("npx shadcn@latest add") ? `${e.commande} --yes --overwrite` : e.commande;
      lancer(commande, dossier, { DATABASE_URL_DIRECT: ADRESSE_FACTICE });
      continue;
    }
    const cible = path.join(dossier, ...e.chemin.split("/"));
    const actuel = fs.existsSync(cible) ? fs.readFileSync(cible, "utf8") : null;
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, appliquerAuTexte(actuel, e));
    poses.push(e.chemin);
  }
  return poses;
}

function lireArguments(argv) {
  const opts = { recettes: CHAINE, projet: null, garder: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--recettes") opts.recettes = String(argv[++i] || "").split(",").map((x) => x.trim()).filter(Boolean);
    else if (a === "--projet") opts.projet = path.resolve(argv[++i]);
    else if (a === "--garder") opts.garder = true;
    else throw new Error(`Option inconnue : ${a}`);
  }
  return opts;
}

function principal() {
  const opts = lireArguments(process.argv.slice(2));
  let dossier = opts.projet;
  const temporaire = !dossier;
  try {
    if (temporaire) {
      const { creerSquelette } = require("./squelette");
      dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-next-recettes-"));
      creerSquelette({ nom: "Projet de vérification", description: "Vérification automatique des recettes.", dossier });
      lancer("npm install --no-audit --no-fund", dossier);
    }
    const poses = [];
    for (const nom of opts.recettes) poses.push(...poserRecette(dossier, nom));
    // Mise en forme Biome des fichiers posés : un écart de forme se corrige chez la personne par npm run format.
    const uniques = [...new Set(poses)];
    const avant = new Map(uniques.map((p) => [p, fs.readFileSync(path.join(dossier, p), "utf8")]));
    spawnSync(`npx biome format --write ${uniques.map((p) => `"${p}"`).join(" ")}`, { cwd: dossier, shell: true, stdio: "ignore" });
    const reformes = uniques.filter((p) => fs.readFileSync(path.join(dossier, p), "utf8") !== avant.get(p));
    if (reformes.length) console.log(`\n⚠️ Mise en forme différente de Biome (à reporter dans la recette) :\n  ${reformes.join("\n  ")}`);
    lancer("npm run check", dossier);
    lancer("npm run typecheck", dossier);
    lancer("npm test", dossier);
    lancer("npm run build", dossier, { SKIP_ENV_VALIDATION: "1" });
    console.log(`\n✅ Recettes vérifiées : ${opts.recettes.join(" → ")}.`);
  } catch (e) {
    console.error(`\n❌ Échec : ${e.message}`);
    process.exitCode = 1;
  } finally {
    if (temporaire && dossier) {
      if (opts.garder || process.exitCode) console.log(`Dossier gardé : ${dossier}`);
      else fs.rmSync(dossier, { recursive: true, force: true });
    }
  }
}

if (require.main === module) principal();

module.exports = { extraireEtapes, appliquerAuTexte, COMMANDES_PERMISES };

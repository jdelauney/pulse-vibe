#!/usr/bin/env node
// Découpe une recette du pack en fichiers chargés à la demande (plan 4 « Coût en tokens ») :
//   recettes/<nom>/index.md       vue d'ensemble : tout, sauf le corps des étapes et des tests
//   recettes/<nom>/etape-<id>.md  une étape (« ### … » de « ## Étapes »), titre compris
//   recettes/<nom>/tests.md       le corps de « ## Tests »
// recomposer() rend le texte d'origine à l'identique : aucune ligne perdue.
// texteRecette() est le point de lecture unique d'une recette entière (outil du pack, vérifications, tests).
//
//   node scripts/decouper-recette.js <nom>   découpe references/recettes/<nom>.md dans references/recettes/<nom>/
//                                            (le .md d'origine reste en place : le retirer avec git rm)
"use strict";

const fs = require("fs");
const path = require("path");

const DOSSIER = path.join(__dirname, "..", "references", "recettes");
const MARQUE_ETAPE = /^- Étape (\S+) – .* : `pulse-aidd pile recette ([a-z0-9-]+) etape (\S+)`$/;
const MARQUE_TESTS = /^Le code des tests : `pulse-aidd pile recette ([a-z0-9-]+) tests`$/;

// « 3. Titre » → 3 ; « Étape 2 – Titre » → 2 ; sinon le titre avant « – », « ( » ou « , », en minuscules sans accents.
function identifiant(titre) {
  const numero = titre.match(/^(\d+)\.\s+(.*)$/) || titre.match(/^Étape (\d+) – (.*)$/);
  if (numero) return { id: numero[1], libelle: numero[2] };
  const court = titre.split(/ – | \(|,/)[0];
  const id = court
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return { id, libelle: titre };
}

function decouper(texte, nom) {
  const index = [];
  const fichiers = {};
  const vus = new Set();
  let dansCode = false;
  let section = "";
  let bloc = null;
  const fermer = () => {
    if (bloc) fichiers[bloc.fichier] = bloc.lignes.join("\n") + "\n";
    bloc = null;
  };
  for (const ligne of texte.split("\n")) {
    const titre = dansCode ? null : ligne.match(/^(#{2,3}) (.*)$/);
    if (/^```/.test(ligne)) dansCode = !dansCode;
    if (titre && titre[1] === "##") {
      fermer();
      section = titre[2];
      index.push(ligne);
      if (section === "Tests") {
        bloc = { fichier: "tests.md", lignes: [] };
        index.push(`Le code des tests : \`pulse-aidd pile recette ${nom} tests\``);
      }
      continue;
    }
    if (titre && section === "Étapes") {
      fermer();
      const { id, libelle } = identifiant(titre[2]);
      const fichier = `etape-${id}.md`;
      if (!id || vus.has(fichier)) throw new Error(`${nom} : étape « ${titre[2]} » en double ou sans identifiant`);
      vus.add(fichier);
      bloc = { fichier, lignes: [ligne] };
      index.push(`- Étape ${id} – ${libelle} : \`pulse-aidd pile recette ${nom} etape ${id}\``);
      continue;
    }
    if (bloc) bloc.lignes.push(ligne);
    else index.push(ligne);
  }
  fermer();
  if (dansCode) throw new Error(`${nom} : bloc de code non fermé`);
  fichiers["index.md"] = index.join("\n");
  return fichiers;
}

function recomposer(fichiers) {
  const sortie = [];
  for (const ligne of fichiers["index.md"].split("\n")) {
    const etape = ligne.match(MARQUE_ETAPE);
    const fichier = etape ? `etape-${etape[3]}.md` : MARQUE_TESTS.test(ligne) ? "tests.md" : null;
    if (!fichier) {
      sortie.push(ligne);
      continue;
    }
    if (fichiers[fichier] === undefined) throw new Error(`${fichier} absent`);
    sortie.push(...fichiers[fichier].replace(/\n$/, "").split("\n"));
  }
  return sortie.join("\n");
}

function lireDossier(dossier) {
  const fichiers = {};
  for (const f of fs.readdirSync(dossier)) if (f.endsWith(".md")) fichiers[f] = fs.readFileSync(path.join(dossier, f), "utf8");
  return fichiers;
}

// Le texte complet d'une recette (index, étapes et tests remis dans l'ordre).
function texteRecette(nom, dossier = DOSSIER) {
  return recomposer(lireDossier(path.join(dossier, nom)));
}

// Fin d'une balise réservée à certains projets : « … hebergement: docker,serveur », « … stockage: s3 », ou les deux.
const CONDITION = /\s+(hebergement|stockage):\s+([a-z0-9]+(?:,[a-z0-9]+)*)$/;
// Stockage des fichiers envoyés (recette fichiers) : un service compatible S3, ou un dossier du serveur (docker, serveur).
const STOCKAGES = ["s3", "dossier"];

/** Stockage d'un projet sans choix noté : S3 sur Vercel (pas de disque durable), le dossier du serveur ailleurs. */
function stockageParDefaut(hebergement) {
  return hebergement === "vercel" ? "s3" : "dossier";
}

/**
 * Valeur d'une balise sans ses conditions : { valeur, hebergements, stockages } (null : sans condition sur cet axe).
 * Un axe écrit deux fois lève une erreur.
 */
function conditions(valeur) {
  const lues = { hebergements: null, stockages: null };
  let reste = valeur;
  for (let m = CONDITION.exec(reste); m; m = CONDITION.exec(reste)) {
    const axe = `${m[1]}s`;
    if (lues[axe]) throw new Error(`condition « ${m[1]}: » en double`);
    lues[axe] = m[2].split(",");
    reste = reste.slice(0, m.index);
  }
  return { valeur: reste, ...lues };
}

/** Une balise vaut-elle pour ce projet ? Un axe sans condition vaut pour tous. */
function valablePour({ hebergements, stockages }, hebergement, stockage) {
  return (!hebergements || hebergements.includes(hebergement)) && (!stockages || stockages.includes(stockage));
}

/**
 * Le texte d'une recette pour un projet (hébergement, stockage) : chaque balise réservée à d'autres projets disparaît,
 * avec le bloc de code qui la suit. Le reste est rendu tel quel (pulse-pile-next recette, d'après docs/technical.md).
 */
function filtrerSelonHebergement(texte, hebergement, stockage = stockageParDefaut(hebergement)) {
  const lignes = texte.split("\n");
  const sortie = [];
  for (let i = 0; i < lignes.length; i++) {
    const balise = /^<!--\s*[a-z-]+:\s*(.+?)\s*-->\s*$/.exec(lignes[i]);
    if (!balise || valablePour(conditions(balise[1]), hebergement, stockage)) {
      sortie.push(lignes[i]);
      continue;
    }
    // Le bloc qui suit la balise (après d'éventuelles lignes vides) part avec elle.
    let k = i + 1;
    while (k < lignes.length && lignes[k].trim() === "") k++;
    const ouverture = k < lignes.length ? /^(`{3,})/.exec(lignes[k]) : null;
    if (!ouverture) continue;
    const fin = lignes.findIndex((l, j) => j > k && l.trim() === ouverture[1]);
    i = fin < 0 ? lignes.length : fin;
    if (lignes[i + 1] !== undefined && lignes[i + 1].trim() === "" && sortie.length && sortie[sortie.length - 1].trim() === "") i++;
  }
  return sortie.join("\n");
}

/** Lit « --hebergement <valeur> [--stockage <valeur>] » (filtre de lecture) ; stockage inconnu ou absent : celui par défaut. */
function lireFiltre(argv) {
  const valeur = (nom) => (argv.includes(nom) ? argv[argv.indexOf(nom) + 1] : undefined);
  const hebergement = valeur("--hebergement") || "vercel";
  const stockage = hebergement !== "vercel" && STOCKAGES.includes(valeur("--stockage")) ? valeur("--stockage") : stockageParDefaut(hebergement);
  return { hebergement, stockage };
}

if (require.main === module && process.argv[2] === "--hebergement") {
  // Filtre de lecture : pulse-pile-next recette … | node decouper-recette.js --hebergement <valeur> [--stockage <valeur>]
  const texte = fs.readFileSync(0, "utf8");
  const { hebergement, stockage } = lireFiltre(process.argv.slice(2));
  process.stdout.write(filtrerSelonHebergement(texte, hebergement, stockage));
} else if (require.main === module) {
  const nom = process.argv[2];
  if (!nom || !/^[a-z0-9-]+$/.test(nom)) {
    console.error("Usage : node scripts/decouper-recette.js <nom>");
    process.exit(1);
  }
  const source = path.join(DOSSIER, `${nom}.md`);
  if (!fs.existsSync(source)) {
    console.error(`Recette introuvable : ${source}`);
    process.exit(1);
  }
  const texte = fs.readFileSync(source, "utf8");
  const fichiers = decouper(texte, nom);
  if (recomposer(fichiers) !== texte) {
    console.error(`${nom} : la recomposition diffère de l'original ; rien n'est écrit.`);
    process.exit(1);
  }
  const cible = path.join(DOSSIER, nom);
  fs.mkdirSync(cible, { recursive: true });
  for (const [f, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(cible, f), contenu);
  console.log(`${nom} : ${Object.keys(fichiers).length} fichiers dans references/recettes/${nom}/ ; retirer ${nom}.md avec git rm.`);
}

module.exports = { decouper, recomposer, lireDossier, texteRecette, identifiant, conditions, valablePour, filtrerSelonHebergement, lireFiltre, stockageParDefaut, STOCKAGES };

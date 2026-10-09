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

if (require.main === module) {
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

module.exports = { decouper, recomposer, lireDossier, texteRecette, identifiant };

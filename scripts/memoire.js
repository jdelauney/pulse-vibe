#!/usr/bin/env node
// Pulse – synchronisation de la mémoire projet (hook SessionStart et `pulse-aidd memoire`).
//
// Remplit le bloc mémoire de CLAUDE.md :
//  - chaque fichier .md à la racine de aidd_docs/memory/ devient un import `@…`,
//    chargé automatiquement à chaque session ;
//  - les fichiers de internal/ et external/ sont listés, à lire seulement si la tâche le demande.
// Met aussi à jour la liste des fichiers de aidd_docs/memory/README.md, entre ses marqueurs.
// En mode hook, rappelle aussi le travail en cours (aidd_docs/tasks/in-progress.md) : une décision
// laissée en attente avant la fermeture de la session, un /clear ou un compactage.
//
// Ne remplit qu'un bloc déjà présent : le reste de CLAUDE.md n'est jamais touché.
//
// Deux modes :
//  - sans argument (hook) : silencieux, ne bloque jamais l'ouverture d'une session ;
//  - --rapport (commande /pulse:memory) : affiche le résultat et sort en erreur (code 1)
//    si le bloc est absent ou cassé, pour que la commande puisse le réparer.
"use strict";

const fs = require("fs");
const path = require("path");

const DOSSIER_MEMOIRE = path.join("aidd_docs", "memory");
const DOSSIERS_A_LA_DEMANDE = ["internal", "external"];
const EXCLUS = new Set(["README.md", ".gitkeep"]);
const CIBLE = "CLAUDE.md";

// Des commentaires HTML seuls sur leur ligne : une balise nue ouvrirait un bloc HTML jusqu'à la
// prochaine ligne vide, et Claude Code ignorerait alors les imports `@` qu'il contient.
const BLOC_DEBUT = "<!-- pulse_memoire:debut -->";
const BLOC_FIN = "<!-- pulse_memoire:fin -->";
const LISTE_DEBUT = "<!-- fichiers:debut -->";
const LISTE_FIN = "<!-- fichiers:fin -->";
const EN_COURS = path.join("aidd_docs", "tasks", "in-progress.md");
const LIMITE_EN_COURS = 2000;
const DOSSIER_WORKTREES = path.join(".claude", "worktrees");
const NOTE_A_LA_DEMANDE = "<!-- à lire seulement si la tâche le demande, non chargé automatiquement -->";

const rapport = process.argv.includes("--rapport");

function lireOuNull(fichier) {
  try {
    return fs.readFileSync(fichier, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

function lireDossier(dossier) {
  try {
    return fs.readdirSync(dossier, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

// Chemin avec des / (Windows compris) : c'est la forme qu'attend un import `@`.
const versPosix = (p) => p.split(path.sep).join("/");

function fichiersRacine() {
  return lireDossier(DOSSIER_MEMOIRE)
    .filter((e) => e.isFile() && e.name.endsWith(".md") && !EXCLUS.has(e.name))
    .map((e) => versPosix(path.join(DOSSIER_MEMOIRE, e.name)))
    .sort();
}

function fichiersALaDemande() {
  const trouves = [];
  const parcourir = (dossier) => {
    for (const e of lireDossier(dossier)) {
      const complet = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(complet);
      else if (e.name.endsWith(".md") && !EXCLUS.has(e.name)) trouves.push(versPosix(complet));
    }
  };
  for (const sous of DOSSIERS_A_LA_DEMANDE) parcourir(path.join(DOSSIER_MEMOIRE, sous));
  return trouves.sort();
}

function contenuBloc(racine, aLaDemande) {
  const lignes = racine.map((f) => `@${f}`);
  if (aLaDemande.length > 0) {
    lignes.push("", NOTE_A_LA_DEMANDE, ...aLaDemande.map((f) => `- ${f}`));
  }
  if (lignes.length === 0) return "\n";
  // Une ligne vide de chaque côté, pour la même raison que les marqueurs en commentaire.
  return `\n\n${lignes.join("\n")}\n\n`;
}

function contenuListe(racine, aLaDemande) {
  const prefixe = versPosix(DOSSIER_MEMOIRE) + "/";
  const lien = (f) => {
    const relatif = f.slice(prefixe.length);
    return `- [${relatif}](${relatif})`;
  };
  const lignes = racine.map(lien);
  if (aLaDemande.length > 0) lignes.push("", "À lire à la demande :", "", ...aLaDemande.map(lien));
  if (lignes.length === 0) lignes.push("_Aucun fichier de mémoire pour l'instant._");
  return `\n${lignes.join("\n")}\n`;
}

// Cherche les marqueurs seuls sur leur ligne, hors des blocs de code : un marqueur cité en
// exemple dans un bloc ``` ne doit pas être pris pour le vrai.
function trouverMarqueurs(lignes, debut, fin) {
  let cloture = null;
  let ligneDebut = -1;
  for (let i = 0; i < lignes.length; i++) {
    const t = lignes[i].trim();
    const ouverture = /^(`{3,}|~{3,})/.exec(t);
    if (cloture !== null) {
      if (ouverture && ouverture[1][0] === cloture[0] && ouverture[1].length >= cloture.length) cloture = null;
      continue;
    }
    if (ouverture) {
      cloture = ouverture[1];
      continue;
    }
    if (t === debut) ligneDebut = i;
    else if (t === fin && ligneDebut !== -1) return { ligneDebut, ligneFin: i };
  }
  return null;
}

// Renvoie le texte mis à jour, ou null si les marqueurs sont absents.
function remplacerEntre(texte, debut, fin, interieur) {
  const fin_ligne = texte.includes("\r\n") ? "\r\n" : "\n";
  const lignes = texte.split(/\r?\n/);
  const trouve = trouverMarqueurs(lignes, debut, fin);
  if (trouve === null) return null;
  const avant = lignes.slice(0, trouve.ligneDebut + 1).join("\n");
  const apres = lignes.slice(trouve.ligneFin).join("\n");
  return (avant + interieur + apres).split("\n").join(fin_ligne);
}

function synchroniser() {
  if (!fs.existsSync(DOSSIER_MEMOIRE)) {
    return { statut: "sans-memoire" };
  }
  const racine = fichiersRacine();
  const aLaDemande = fichiersALaDemande();
  const resultat = { statut: "ok", racine, aLaDemande, modifies: [] };

  const claude = lireOuNull(CIBLE);
  if (claude === null) {
    resultat.statut = "sans-claude";
  } else {
    const maj = remplacerEntre(claude, BLOC_DEBUT, BLOC_FIN, contenuBloc(racine, aLaDemande));
    if (maj === null) {
      resultat.statut = claude.includes(BLOC_DEBUT) || claude.includes(BLOC_FIN) ? "bloc-casse" : "sans-bloc";
    } else if (maj !== claude) {
      fs.writeFileSync(CIBLE, maj, "utf8");
      resultat.modifies.push(CIBLE);
    }
  }

  const cheminLisezMoi = path.join(DOSSIER_MEMOIRE, "README.md");
  const lisezMoi = lireOuNull(cheminLisezMoi);
  if (lisezMoi !== null) {
    const maj = remplacerEntre(lisezMoi, LISTE_DEBUT, LISTE_FIN, contenuListe(racine, aLaDemande));
    if (maj !== null && maj !== lisezMoi) {
      fs.writeFileSync(cheminLisezMoi, maj, "utf8");
      resultat.modifies.push(versPosix(cheminLisezMoi));
    }
  }
  return resultat;
}

function afficherRapport(r) {
  const messages = {
    "sans-memoire": "Pas de mémoire projet : le dossier aidd_docs/memory/ n'existe pas.",
    "sans-claude": "CLAUDE.md est absent : la mémoire ne peut pas être branchée.",
    "sans-bloc": `CLAUDE.md ne contient pas le bloc mémoire (${BLOC_DEBUT} … ${BLOC_FIN}).`,
    "bloc-casse": "CLAUDE.md contient un seul des deux marqueurs du bloc mémoire : bloc non synchronisé.",
  };
  if (r.statut !== "ok") {
    console.log(messages[r.statut]);
    return;
  }
  console.log(`Mémoire synchronisée : ${r.racine.length} fichier(s) chargé(s) à chaque session, ${r.aLaDemande.length} à la demande.`);
  for (const f of r.racine) console.log(`  @${f}`);
  for (const f of r.aLaDemande) console.log(`  (à la demande) ${f}`);
  console.log(r.modifies.length > 0 ? `Fichiers mis à jour : ${r.modifies.join(", ")}` : "Déjà à jour, rien à modifier.");
}

// Le travail en cours du dossier principal, puis celui de chaque worktree : une session qui
// travaillait dans un worktree y a laissé son fichier, et la suivante démarre souvent ailleurs.
function fichiersTravailEnCours() {
  const worktrees = lireDossier(DOSSIER_WORKTREES)
    .filter((e) => e.isDirectory())
    .map((e) => path.join(DOSSIER_WORKTREES, e.name, EN_COURS))
    .sort();
  return [EN_COURS, ...worktrees];
}

function blocTravailEnCours(fichier) {
  let contenu;
  try {
    contenu = fs.readFileSync(fichier, "utf8").trim();
  } catch {
    return null; // absent ou illisible : rien à rappeler
  }
  if (contenu === "") return null;
  if (contenu.length > LIMITE_EN_COURS) {
    contenu = `${contenu.slice(0, LIMITE_EN_COURS)}\n(suite tronquée : lire ${versPosix(fichier)})`;
  }
  return `Pulse – travail en cours (${versPosix(fichier)}) :\n\n${contenu}`;
}

// Texte ajouté au contexte de la session (sortie standard du hook SessionStart), ou null.
function rappelTravailEnCours() {
  const blocs = fichiersTravailEnCours().map(blocTravailEnCours).filter((b) => b !== null);
  if (blocs.length === 0) return null;
  return [
    ...blocs.flatMap((b) => [b, ""]),
    "Rappelez-le à la personne dès votre première réponse et proposez la commande indiquée pour reprendre (dans le worktree indiqué, s'il y en a un).",
    "Redémarrer, effacer ou compacter la conversation ne vaut pas accord : la décision en attente reste à prendre.",
  ].join("\n");
}

// Les chemins sont relatifs au projet : sans ce point d'ancrage, un lancement depuis un autre
// dossier ne trouverait aucune mémoire et passerait pour un succès.
const projet = process.env.CLAUDE_PROJECT_DIR;
if (projet && fs.existsSync(projet)) process.chdir(projet);

try {
  const r = synchroniser();
  if (rapport) {
    afficherRapport(r);
    if (r.statut === "sans-bloc" || r.statut === "bloc-casse" || r.statut === "sans-claude") process.exitCode = 1;
  }
} catch (e) {
  // Le hook ne doit jamais empêcher une session de démarrer.
  if (rapport) {
    console.error(`Synchronisation de la mémoire impossible : ${e.message}`);
    process.exitCode = 1;
  }
}

if (!rapport) {
  try {
    const rappel = rappelTravailEnCours();
    if (rappel !== null) process.stdout.write(`${rappel}\n`);
  } catch {
    // Même règle que la synchronisation : rien ne doit empêcher la session de démarrer.
  }
}

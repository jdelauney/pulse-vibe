#!/usr/bin/env node
// Pulse – les copies que Pulse pose dans un projet (`pulse-aidd copies [--mettre-a-jour]`), pour /pulse:init.
//
// Chaque copie porte, sur sa deuxième ligne, l'empreinte du modèle d'où elle vient : « // pulse-copie: <empreinte> ».
// En la comparant à l'empreinte de la copie elle-même (sans cette ligne) et à celle du modèle actuel :
//   a-jour   : la copie est le modèle actuel ;
//   ancienne : une copie intacte d'un modèle plus ancien, remplaçable sans rien perdre ;
//   adaptee  : la copie a été modifiée dans le projet : la garder, et proposer de comparer ;
//   absente  : pas de copie.
// Une copie sans empreinte (posée avant Pulse 0.47) : a-jour si elle est identique au modèle, sinon adaptee.
// Sans option : une ligne « <nom>: <état> · <chemin> » par copie connue.
// --mettre-a-jour : remplace les copies « ancienne » par le modèle actuel ; les autres restent intactes.
// --copier <nom> <chemin> : pose la copie <nom> à <chemin> (utilisé par installer-ci, installer-hook, ligne-etat).
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const MODELES = {
  verifier: path.join(RACINE, "templates", "verifier.js"),
  "ligne-etat": path.join(RACINE, "scripts", "ligne-etat.js"),
};
const MARQUE = /^\/\/ pulse-copie: ([0-9a-f]{16})\r?\n/m;

const empreinte = (texte) => crypto.createHash("sha256").update(texte.replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);
const sansMarque = (texte) => texte.replace(MARQUE, "");
const lireSi = (f) => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
};

/** Le texte de la copie à poser : le modèle, avec son empreinte en deuxième ligne (après la ligne #!). */
function texteDeCopie(nom) {
  const modele = sansMarque(fs.readFileSync(MODELES[nom], "utf8"));
  const lignes = modele.split("\n");
  const position = lignes[0].startsWith("#!") ? 1 : 0;
  lignes.splice(position, 0, `// pulse-copie: ${empreinte(modele)}`);
  return lignes.join("\n");
}

function copier(nom, chemin) {
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(chemin, texteDeCopie(nom));
}

/** L'état d'une copie : a-jour, ancienne, adaptee ou absente. */
function etatDe(nom, chemin) {
  const texte = lireSi(chemin);
  if (texte === null) return "absente";
  const actuel = empreinte(sansMarque(fs.readFileSync(MODELES[nom], "utf8")));
  const corps = empreinte(sansMarque(texte));
  const m = MARQUE.exec(texte);
  if (!m) return corps === actuel ? "a-jour" : "adaptee";
  if (corps !== m[1]) return "adaptee";
  return m[1] === actuel ? "a-jour" : "ancienne";
}

/** Les copies connues du projet `racine` : [{ nom, chemin }]. */
function copiesDu(racine) {
  const liste = [
    { nom: "verifier", chemin: path.join(racine, "scripts", "verifier.js") },
    { nom: "ligne-etat", chemin: path.join(racine, ".claude", "pulse-ligne-etat.js") },
  ];
  const git = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd: racine, encoding: "utf8" });
  if (!git.error && git.status === 0) liste.push({ nom: "verifier", chemin: path.join(path.resolve(racine, git.stdout.trim()), "pulse", "verifier.js") });
  return liste;
}

const relatif = (racine, f) => path.relative(racine, f).split(path.sep).join("/");

if (require.main === module) {
  const args = process.argv.slice(2);
  const racine = process.cwd();
  if (args[0] === "--copier") {
    if (!MODELES[args[1]] || !args[2]) {
      console.log(`erreur: usage : copies --copier <${Object.keys(MODELES).join("|")}> <chemin>`);
      process.exit(1);
    }
    copier(args[1], path.resolve(racine, args[2]));
  } else {
    const miseAJour = args.includes("--mettre-a-jour");
    for (const { nom, chemin } of copiesDu(racine)) {
      let etat = etatDe(nom, chemin);
      if (etat === "absente") continue;
      if (miseAJour && etat === "ancienne") {
        copier(nom, chemin);
        etat = "mise-a-jour";
      }
      console.log(`${nom}: ${etat} · ${relatif(racine, chemin)}`);
    }
  }
}

module.exports = { copier, etatDe, copiesDu, texteDeCopie, empreinte };

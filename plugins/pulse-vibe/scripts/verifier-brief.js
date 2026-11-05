#!/usr/bin/env node
// Pulse – contrôle factuel du brief et du PRD (`pulse-aidd verifier-brief`), lancé par /pulse:brainstorm, /pulse:prd et
// /pulse:nouveau après leur écriture. Il signale ce qui manque et ce que cela change, sans noter ni bloquer : la personne
// décide de compléter ou de continuer (references/raisonnement.md, « Ne jamais bloquer »).
//
// Sans rien modifier, relève :
//   brief : phrase de synthèse, problème, acteurs, histoire ou réussite vides ; champ du modèle resté à remplir ;
//   PRD   : aucune fonctionnalité Indispensable, plus de 6, définition de la première version ou contraintes vides ;
//           champ du modèle resté à remplir.
// Affiche des lignes « clé: valeur », puis un constat par ligne (« - avertissement · <où> · <message> ») :
//   brief: docs/brief.md | absent
//   prd: docs/prd.md | absent
//   questions-ouvertes: 2      les cases non cochées de « Questions ouvertes » du brief
//   bilan: ok | avertissements | introuvable
// Sort toujours avec le code 0 : un échec annulerait la commande /pulse qui l'appelle.
"use strict";

const fs = require("fs");
const path = require("path");
const { formaterConstats } = require("./constats.js");

const lireSi = (f) => {
  try {
    return fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  } catch {
    return null;
  }
};

/** Le contenu d'une section de niveau 2 (`## <titre>`), sans son titre ; "" si elle manque. */
function section(texte, titre) {
  const parties = texte.split(/^## /m);
  const trouvee = parties.find((p) => titre.test(p.split("\n")[0]));
  return trouvee ? trouvee.split("\n").slice(1).join("\n") : "";
}

const CELLULE_VIDE = /^\|?[\s|:-]*\|?$/;
/** Une section remplie : au moins une ligne de contenu, hors champ du modèle, puce ou libellé vides. */
function remplie(contenu) {
  return contenu.split("\n").some((l) => {
    const t = l.trim();
    if (!t || t.startsWith(">") || /\{\{/.test(t) || CELLULE_VIDE.test(t)) return false;
    if (/^[-*] *(\[[ x]\] *)?(…)?$/.test(t)) return false;
    if (/^[-*] [^:]+: *$/.test(t)) return false; // « - Comment ça se passe aujourd'hui : » sans réponse
    if (/^[-*] \*\*[^*]+\*\* *: *$/.test(t)) return false; // « - **Autres** : » sans réponse
    return true;
  });
}

/** Un tableau rempli : au moins une ligne après l'en-tête et le séparateur, avec une cellule écrite. */
function tableauRempli(contenu) {
  const lignes = contenu.split("\n").filter((l) => l.trim().startsWith("|"));
  return lignes.slice(2).some((l) => !CELLULE_VIDE.test(l.trim()) && !/\{\{/.test(l));
}

const avertir = (ou, message) => ({ gravite: "avertissement", ou, message });
const compterChamps = (texte) => (texte.match(/\{\{[^}]*\}\}/g) || []).length;

function controlerBrief(texte) {
  const constats = [];
  const manque = (titre, nom, consequence) => {
    if (!remplie(section(texte, titre))) constats.push(avertir("brief", `${nom} : à écrire ; ${consequence}`));
  };
  manque(/^En une phrase/, "la phrase de synthèse", "sans elle, le projet peut dériver");
  manque(/^Le problème aujourd/, "le problème", "sans lui, difficile de décider ce qui entre dans la première version");
  if (!tableauRempli(section(texte, /^Les acteurs/))) constats.push(avertir("brief", "les acteurs : à écrire ; sans eux, les écrans et les droits d'accès restent à deviner"));
  // L'histoire : seules ses puces comptent, la phrase du modèle (« Chaque ligne suit la forme… ») reste quand elle est vide.
  const histoire = section(texte, /^L['’]histoire/).split("\n").filter((l) => /^\s*[-*] /.test(l)).join("\n");
  if (!remplie(histoire)) constats.push(avertir("brief", "l'histoire : à écrire ; sans elle, les règles métier restent à deviner"));
  manque(/^Ce que serait une réussite/, "la réussite", "sans elle, rien ne dira que l'outil remplit son rôle");
  const champs = compterChamps(texte);
  if (champs) constats.push(avertir("brief", `${champs} champ(s) du modèle à remplir`));
  return constats;
}

function controlerPrd(texte) {
  const constats = [];
  const moscow = section(texte, /^5\.\s*P[ée]rim[èe]tre/);
  const ligne = moscow.split("\n").find((l) => /Indispensable/.test(l) && l.trim().startsWith("|")) || "";
  const fonctions = (ligne.split("|")[3] || "").trim();
  const nombre = fonctions && !/\{\{/.test(fonctions) ? fonctions.split(/\s*(?:<br\s*\/?>|[;·,])\s*/).filter(Boolean).length : 0;
  if (!nombre) constats.push(avertir("prd", "la première version ne contient encore aucune fonctionnalité Indispensable ; rien ne peut se planifier"));
  else if (nombre > 6) constats.push(avertir("prd", `${nombre} fonctionnalités Indispensables ; au-delà de 6, la première version risque de rester inachevée`));
  const definition = (/La première version est prête quand\s*:\s*(.*)$/m.exec(texte) || [])[1] || "";
  if (!definition.trim() || /\{\{/.test(definition)) constats.push(avertir("prd", "« La première version est prête quand… » : à écrire ; sans cela, rien ne dira que la première version est finie"));
  if (!remplie(section(texte, /^6\.\s*Contraintes/))) constats.push(avertir("prd", "les contraintes : à écrire ; elles guident les choix techniques et le budget"));
  const champs = compterChamps(texte);
  if (champs) constats.push(avertir("prd", `${champs} champ(s) du modèle à remplir`));
  return constats;
}

function verifierBrief(racine) {
  const brief = lireSi(path.join(racine, "docs", "brief.md"));
  const prd = lireSi(path.join(racine, "docs", "prd.md"));
  const questions = brief ? (section(brief, /^Questions ouvertes/).match(/^\s*[-*] \[ \] *[^\s…]/gm) || []).length : 0;
  return {
    brief: brief === null ? "absent" : "docs/brief.md",
    prd: prd === null ? "absent" : "docs/prd.md",
    questions,
    constats: [...(brief === null ? [] : controlerBrief(brief)), ...(prd === null ? [] : controlerPrd(prd))],
    introuvable: brief === null && prd === null,
  };
}

function formater(r) {
  const entete = [`brief: ${r.brief}`, `prd: ${r.prd}`, `questions-ouvertes: ${r.questions}`];
  if (r.introuvable) return [...entete, "bilan: introuvable"].join("\n");
  return formaterConstats(entete, r.constats);
}

if (require.main === module) {
  try {
    console.log(formater(verifierBrief(process.cwd())));
  } catch (e) {
    console.log(`bilan: introuvable\nraison: les fichiers n'ont pas pu être lus (${e.message})`);
  }
}

module.exports = { verifierBrief, formater };

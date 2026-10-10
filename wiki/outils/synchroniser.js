#!/usr/bin/env node
// Synchronise le wiki avec les commandes du cœur : la description et les arguments de chaque commande sont lus
// dans son SKILL.md, puis écrits dans wiki/js/donnees.js et dans les blocs marqués des pages
// (<!-- auto:nom --> … <!-- /auto:nom -->). Un fait, un seul endroit : on modifie le SKILL.md, puis on relance.
// Lancer : node wiki/outils/synchroniser.js [--creer] [--verifier]
//   --creer     crée la page d'une commande qui n'en a pas encore, à partir de commandes/_modele.html
//   --verifier  n'écrit rien ; code de sortie 1 et liste des fichiers à mettre à jour si le wiki ne suit plus
"use strict";

const fs = require("fs");
const path = require("path");

const WIKI = path.join(__dirname, "..");
const SKILLS = path.join(WIKI, "..", "plugins", "pulse-vibe", "skills");

// Les étapes du parcours, dans l'ordre. `couleur` : pas de l'échelle de maturité (1 à 4), 0 hors parcours.
const ETAPES = [
  { id: "demarrer", numero: 1, nom: "Démarrer", couleur: 1, commandes: ["init", "express"] },
  { id: "decrire", numero: 2, nom: "Décrire", couleur: 1, commandes: ["brainstorm", "prd", "tech", "ui", "us"] },
  { id: "preparer", numero: 3, nom: "Préparer", couleur: 2, commandes: ["spec", "plan", "refine", "guide"] },
  { id: "construire", numero: 4, nom: "Construire", couleur: 3, commandes: ["implement", "spirc", "review", "test", "auto-fix", "commit", "pr"] },
  { id: "en-ligne", numero: 5, nom: "Mettre en ligne", couleur: 4, commandes: ["cicd", "deploy", "security", "secrets"] },
  { id: "visible", numero: 6, nom: "Être trouvé", couleur: 4, commandes: ["seo", "rediger", "perf", "search-console"] },
  { id: "toujours", numero: 7, nom: "À tout moment", couleur: 0, commandes: ["status", "explain", "learn", "fix", "annuler", "get-help", "memory"] },
];

// Les pages de la navigation principale (chemins depuis wiki/). Chaque page citée doit exister.
const NAVIGATION = [
  { titre: "Accueil", href: "index.html" },
  { titre: "Commandes", href: "commandes/index.html" },
];

const echapper = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Frontmatter d'un SKILL.md : description et argument-hint (guillemets et \" retirés).
function lireSkill(nom) {
  const texte = fs.readFileSync(path.join(SKILLS, nom, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
  const entete = texte.split("\n---")[0];
  const valeur = (cle) => {
    const m = entete.match(new RegExp(`^${cle}: (.*)$`, "m"));
    if (!m) return "";
    const v = m[1].trim();
    return v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/\\"/g, '"') : v;
  };
  return { description: valeur("description"), arguments: valeur("argument-hint") };
}

// « [a | b] (vide : c) » → forme « [a | b] » et note « vide : c ». La note est la dernière parenthèse, hors crochets.
function decouperArguments(indice) {
  if (!indice.endsWith(")")) return { forme: indice, note: "" };
  let profondeur = 0;
  for (let i = indice.length - 1; i >= 0; i--) {
    if (indice[i] === ")") profondeur++;
    else if (indice[i] === "(" && --profondeur === 0) {
      const avant = indice.slice(0, i).trimEnd();
      // Une parenthèse à l'intérieur de crochets fait partie de la forme.
      const ouverts = (avant.match(/[[<]/g) || []).length - (avant.match(/[\]>]/g) || []).length;
      return ouverts > 0 || !avant ? { forme: indice, note: "" } : { forme: avant, note: indice.slice(i + 1, -1) };
    }
  }
  return { forme: indice, note: "" };
}

function commandes() {
  const noms = fs.readdirSync(SKILLS).filter((n) => fs.existsSync(path.join(SKILLS, n, "SKILL.md"))).sort();
  return noms.map((nom) => {
    const etape = ETAPES.find((e) => e.commandes.includes(nom));
    const { description, arguments: indice } = lireSkill(nom);
    return { nom, etape: etape ? etape.id : null, description, ...decouperArguments(indice) };
  });
}

// --- Blocs produits -------------------------------------------------------------------------------------------

const premiereLettre = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// « Démarrer vite - en une… » : le tiret simple des descriptions devient deux-points dans le wiki.
const phrase = (t) => premiereLettre(t.replace(/ - /g, " : ")) + ".";

function blocChapo(c) {
  return `<p class="chapo">${echapper(phrase(c.description))}</p>`;
}

function blocForme(c) {
  const lignes = [`<pre class="commande"><code>/pulse:${c.nom}${c.forme ? " " + echapper(c.forme) : ""}</code></pre>`];
  lignes.push(c.forme
    ? `<p class="legende">Entre crochets <code>[ ]</code> : facultatif. Entre chevrons <code>&lt; &gt;</code> : à remplacer par votre valeur. La barre <code>|</code> sépare les choix possibles.${c.note ? " " + echapper(premiereLettre(c.note)) + "." : ""}</p>`
    : `<p class="legende">Cette commande se lance sans rien après son nom.</p>`);
  return lignes.join("\n");
}

function blocEtape(c) {
  const etape = ETAPES.find((e) => e.id === c.etape);
  return `<p class="pastille pastille-etape" data-couleur="${etape.couleur}">Étape ${etape.numero} · ${echapper(etape.nom)}</p>`;
}

function blocParcours(c) {
  const items = ETAPES.map((e) => {
    const actuelle = e.id === c.etape;
    return `  <li data-couleur="${e.couleur}"${actuelle ? ' aria-current="step"' : ""}><span class="parcours-numero">${e.numero}</span> ${echapper(e.nom)}</li>`;
  });
  return `<ol class="parcours" aria-label="Le parcours Pulse, cette commande à l'étape mise en avant">\n${items.join("\n")}\n</ol>`;
}

function blocCartes(liste) {
  return ETAPES.map((e) => {
    const cartes = e.commandes.map((nom) => {
      const c = liste.find((x) => x.nom === nom);
      return `    <li><a class="carte carte-commande" href="${nom}.html"><span class="carte-titre"><code>/pulse:${nom}</code></span><span class="carte-texte">${echapper(phrase(c.description))}</span></a></li>`;
    });
    return [
      `<section class="groupe-etape" id="etape-${e.id}" data-etape="${e.id}">`,
      `  <h2><span class="pastille pastille-etape" data-couleur="${e.couleur}">Étape ${e.numero}</span> ${echapper(e.nom)}</h2>`,
      `  <ul class="grille-cartes">`,
      ...cartes,
      `  </ul>`,
      `</section>`,
    ].join("\n");
  }).join("\n");
}

function donneesJs(liste) {
  const donnees = { etapes: ETAPES, navigation: NAVIGATION, commandes: liste };
  return "// Produit par wiki/outils/synchroniser.js depuis les SKILL.md du cœur : modifier les SKILL.md, puis relancer l'outil.\n"
    + "window.PULSE_WIKI = " + JSON.stringify(donnees, null, 2) + ";\n";
}

// Remplace le contenu de chaque bloc <!-- auto:nom --> … <!-- /auto:nom --> présent dans la page.
function remplirBlocs(html, blocs) {
  return html.replace(/(<!-- auto:([a-z-]+) -->)[\s\S]*?(<!-- \/auto:\2 -->)/g, (tout, debut, nom, fin) =>
    nom in blocs ? `${debut}\n${blocs[nom]}\n${fin}` : tout);
}

// --- Programme ------------------------------------------------------------------------------------------------

function principal(arguments_) {
  const creer = arguments_.includes("--creer");
  const verifier = arguments_.includes("--verifier");
  const liste = commandes();
  const problemes = [];
  const ecrits = new Map();

  const sansEtape = liste.filter((c) => !c.etape).map((c) => c.nom);
  if (sansEtape.length) problemes.push(`commandes sans étape dans ETAPES : ${sansEtape.join(", ")}`);
  const inconnues = ETAPES.flatMap((e) => e.commandes).filter((n) => !liste.some((c) => c.nom === n));
  if (inconnues.length) problemes.push(`commandes de ETAPES sans SKILL.md : ${inconnues.join(", ")}`);
  if (problemes.length) return { problemes, ecrits };

  ecrits.set(path.join(WIKI, "js", "donnees.js"), donneesJs(liste));

  const modele = path.join(WIKI, "commandes", "_modele.html");
  for (const c of liste) {
    const page = path.join(WIKI, "commandes", `${c.nom}.html`);
    let html;
    if (fs.existsSync(page)) html = fs.readFileSync(page, "utf8");
    else if (creer) html = fs.readFileSync(modele, "utf8").replace(/\{\{commande\}\}/g, c.nom).replace(/\{\{description\}\}/g, echapper(phrase(c.description)));
    else { problemes.push(`page manquante : commandes/${c.nom}.html (relancer avec --creer)`); continue; }
    ecrits.set(page, remplirBlocs(html, { chapo: blocChapo(c), forme: blocForme(c), etape: blocEtape(c), parcours: blocParcours(c) }));
  }

  const index = path.join(WIKI, "commandes", "index.html");
  if (fs.existsSync(index)) ecrits.set(index, remplirBlocs(fs.readFileSync(index, "utf8"), { cartes: blocCartes(liste) }));

  // Seuls les fichiers qui changent sont écrits (ou signalés avec --verifier).
  for (const [fichier, contenu] of ecrits) {
    const actuel = fs.existsSync(fichier) ? fs.readFileSync(fichier, "utf8") : null;
    if (actuel === contenu) ecrits.delete(fichier);
    else if (verifier) problemes.push(`à mettre à jour : ${path.relative(WIKI, fichier).replace(/\\/g, "/")}`);
  }
  if (verifier) ecrits.clear();
  return { problemes, ecrits };
}

if (require.main === module) {
  const { problemes, ecrits } = principal(process.argv.slice(2));
  for (const [fichier, contenu] of ecrits) fs.writeFileSync(fichier, contenu);
  if (problemes.length) {
    console.error(problemes.join("\n") + "\nRelancez : node wiki/outils/synchroniser.js");
    process.exit(1);
  }
  console.log(ecrits.size ? `Wiki synchronisé (${ecrits.size} fichiers).` : "Wiki à jour.");
}

module.exports = { ETAPES, NAVIGATION, commandes, decouperArguments, principal };

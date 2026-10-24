#!/usr/bin/env node
// Affiche les règles de qualité du code ou la méthode de tests, en entier ou par morceaux (pulse-aidd qualite, pulse-aidd tests).
//
//   node scripts/charger-regles.js qualite [clean-code|organisation|composants|securite]… [--tout] [--checklists]
//   node scripts/charger-regles.js tests [strategie|ecrire|unitaire|integration|bout-en-bout|tdd|gherkin]… [--tout] [--checklists]
//
// Avec des noms : seulement ces familles, dans l'ordre ci-dessus, après la règle de travail sobre (sans le sommaire). Sans nom :
// la règle de travail sobre, le sommaire (qui porte la règle de choix) et « Relancez avec … », code 0 : chaque appel nomme ses familles.
// --tout : toutes les familles, après le sommaire, même si des noms sont donnés (avec --checklists : toutes les checklists).
// --checklists : seulement les sections de contrôle (Checklist, Liste de contrôle, Signaux d'alerte) des familles retenues.
// PULSE_PACK_COUVRE (familles séparées par des espaces) et PULSE_PACK_NOM, posées par pulse-aidd quand le pack de pile
// déclaré est installé : chaque famille couverte par le pack est remplacée par un renvoi au pack.
// La règle de travail sobre (references/travail-sobre.md) vient toujours en tête : chaque agent qui écrit, relit
// ou teste charge ces règles, et la reçoit ainsi sans appel en plus.
"use strict";

const fs = require("fs");
const path = require("path");

const REF = path.join(__dirname, "..", "references");

const TYPES = {
  qualite: {
    sommaire: { titre: "Règles de qualité du code", fichier: "qualite/README.md" },
    relance: "Relancez avec les familles utiles, une commande par famille : `pulse-aidd qualite <famille>` (`--tout` les charge toutes).",
    familles: [
      { nom: "clean-code", titre: "Clean code", fichier: "qualite/clean-code.md" },
      { nom: "organisation", titre: "Organisation des fichiers et nommage", fichier: "qualite/organisation.md" },
      { nom: "composants", titre: "Composants d'interface", fichier: "qualite/composants.md" },
      { nom: "securite", titre: "Sécurité du code", fichier: "qualite/securite-code.md" },
    ],
  },
  // Les niveaux portent le nom des étiquettes des scénarios (@unitaire, @integration, @bout-en-bout), sans @.
  tests: {
    sommaire: { titre: "Stratégie de tests : sommaire", fichier: "tests/README.md" },
    relance: "Relancez avec les morceaux utiles : `pulse-aidd tests <morceaux>` (`--tout` les charge tous ; `--checklists` : leurs listes de contrôle seules).",
    familles: [
      { nom: "strategie", titre: "Stratégie de tests", fichier: "tests/strategie.md" },
      { nom: "ecrire", titre: "Écrire un test", fichier: "tests/ecrire-un-test.md" },
      { nom: "unitaire", titre: "Tests unitaires", fichier: "tests/unitaires.md" },
      { nom: "integration", titre: "Tests d'intégration", fichier: "tests/integration.md" },
      { nom: "bout-en-bout", titre: "Tests de bout en bout", fichier: "tests/bout-en-bout.md" },
      { nom: "tdd", titre: "Développement piloté par les tests (TDD)", fichier: "tests/tdd.md" },
      { nom: "gherkin", titre: "Scénarios Gherkin", fichier: "tests/gherkin.md" },
    ],
  },
};

// Seules ces familles peuvent être remplacées par un pack : la sécurité du code reste toujours chargée.
const REMPLACABLES = ["organisation"];

/** Les familles d'un type, avec le chemin complet de leur fichier. */
function familles(type) {
  return TYPES[type].familles.map((f) => ({ ...f, fichier: path.join(REF, f.fichier) }));
}

const TITRE_CONTROLE = /^## .*(Checklist|Liste de contrôle|Signaux d'alerte)/;

/** Les sections de contrôle d'une référence (de chaque titre `## …` reconnu au titre `## ` suivant), ou null. */
function checklist(texte) {
  const lignes = texte.split("\n");
  const sections = [];
  for (let i = 0; i < lignes.length; i++) {
    if (!TITRE_CONTROLE.test(lignes[i])) continue;
    let fin = lignes.findIndex((l, j) => j > i && /^## /.test(l));
    if (fin < 0) fin = lignes.length;
    sections.push(lignes.slice(i, fin).join("\n").trimEnd());
  }
  return sections.length ? sections.join("\n\n") + "\n" : null;
}

/** Un bloc au format de `afficher()` de bin/pulse-aidd. */
const bloc = (titre, contenu) => `\n===== ${titre} =====\n\n${contenu}\n`;

const lire = (relatif) => fs.readFileSync(path.join(REF, relatif), "utf8");

/** Le texte à afficher, ou { erreur }. `pack` : { couvre: [noms de familles], nom } du pack déclaré et installé. */
function composer(type, args, pack = { couvre: [], nom: "" }) {
  const def = TYPES[type];
  if (!def) return { erreur: `Type inconnu : ${type}.` };
  const checklists = args.includes("--checklists");
  const tout = args.includes("--tout");
  const noms = args.filter((a) => a !== "--checklists" && a !== "--tout");
  const valides = def.familles.map((f) => f.nom);
  const inconnus = noms.filter((n) => !valides.includes(n));
  if (inconnus.length) return { erreur: `Inconnu : ${inconnus.join(", ")}. Noms possibles : ${valides.join(", ")}.` };
  let sortie = bloc("Travailler sobrement", lire("travail-sobre.md"));
  // Des familles nommées : la règle sobre suffit ; le sommaire (et sa règle de choix) vient avec l'appel sans nom ou avec --tout.
  const nomme = noms.length > 0 && !tout;
  if (!nomme) sortie += bloc(def.sommaire.titre, lire(def.sommaire.fichier));
  if (!noms.length && !tout && !checklists) return { sortie: sortie + "\n" + def.relance + "\n" };
  const retenues = nomme ? def.familles.filter((f) => noms.includes(f.nom)) : def.familles;
  for (const f of retenues) {
    if (REMPLACABLES.includes(f.nom) && pack.couvre.includes(f.nom)) {
      sortie += bloc(f.titre, `Couverte par le pack ${pack.nom} : appliquer ses consignes et ses références (\`pulse-aidd pile reference <fichier>\`).`);
      continue;
    }
    const texte = lire(f.fichier);
    sortie += checklists ? bloc(`${f.titre} : checklist`, checklist(texte) || "(aucune liste de contrôle)") : bloc(f.titre, texte);
  }
  return { sortie };
}

function principal(argv) {
  const [type, ...args] = argv;
  const pack = {
    couvre: (process.env.PULSE_PACK_COUVRE || "").split(/[\s,]+/).filter(Boolean),
    nom: process.env.PULSE_PACK_NOM || "de pile",
  };
  const r = composer(type, args, pack);
  if (r.erreur) {
    console.error(r.erreur);
    return 1;
  }
  process.stdout.write(r.sortie);
  return 0;
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { familles, checklist, composer };

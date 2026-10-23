#!/usr/bin/env node
// Affiche les règles de qualité du code ou la méthode de tests, en entier ou par morceaux (pulse-aidd qualite, pulse-aidd tests).
//
//   node scripts/charger-regles.js qualite [clean-code|organisation|composants|securite]… [--checklists]
//   node scripts/charger-regles.js tests [strategie|ecrire|unitaire|integration|bout-en-bout|tdd|gherkin]…
//
// Sans nom : toutes les familles, comme avant. Avec des noms : seulement celles-là, dans l'ordre ci-dessus.
// --checklists : seulement la section « Checklist » de chaque famille retenue (relecture).
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

/** La section « Checklist » d'une référence (du titre `## …Checklist…` au titre `## ` suivant), ou null. */
function checklist(texte) {
  const lignes = texte.split("\n");
  const debut = lignes.findIndex((l) => /^## .*Checklist/.test(l));
  if (debut < 0) return null;
  const fin = lignes.findIndex((l, i) => i > debut && /^## /.test(l));
  return lignes.slice(debut, fin < 0 ? lignes.length : fin).join("\n").trimEnd() + "\n";
}

/** Un bloc au format de `afficher()` de bin/pulse-aidd. */
const bloc = (titre, contenu) => `\n===== ${titre} =====\n\n${contenu}\n`;

const lire = (relatif) => fs.readFileSync(path.join(REF, relatif), "utf8");

/** Le texte à afficher, ou { erreur }. `pack` : { couvre: [noms de familles], nom } du pack déclaré et installé. */
function composer(type, args, pack = { couvre: [], nom: "" }) {
  const def = TYPES[type];
  if (!def) return { erreur: `Type inconnu : ${type}.` };
  const checklists = args.includes("--checklists");
  if (checklists && type !== "qualite") return { erreur: "--checklists vaut seulement pour pulse-aidd qualite." };
  const noms = args.filter((a) => a !== "--checklists");
  const valides = def.familles.map((f) => f.nom);
  const inconnus = noms.filter((n) => !valides.includes(n));
  if (inconnus.length) return { erreur: `Inconnu : ${inconnus.join(", ")}. Noms possibles : ${valides.join(", ")}.` };
  const retenues = noms.length ? def.familles.filter((f) => noms.includes(f.nom)) : def.familles;

  let sortie = bloc("Travailler sobrement", lire("travail-sobre.md"));
  sortie += bloc(def.sommaire.titre, lire(def.sommaire.fichier));
  for (const f of retenues) {
    if (REMPLACABLES.includes(f.nom) && pack.couvre.includes(f.nom)) {
      sortie += bloc(f.titre, `Couverte par le pack ${pack.nom} : appliquer ses consignes et ses références (\`pulse-aidd pile reference <fichier>\`).`);
      continue;
    }
    const texte = lire(f.fichier);
    sortie += checklists ? bloc(`${f.titre} : checklist`, checklist(texte) || "") : bloc(f.titre, texte);
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

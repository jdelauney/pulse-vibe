// Garde de la délégation à l'implementer : un seul texte (references/deleguer.md) côté appelant, aligné avec « Informations reçues »
// de agents/implementer.md côté agent (les deux textes sont de part et d'autre de la frontière de contexte).
// Lancer : node --test plugins/pulse-vibe/tests/deleguer.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), "utf8");
const section = (texte, titre) => {
  const debut = texte.indexOf(`## ${titre}`);
  assert.ok(debut >= 0, `section « ${titre} » absente`);
  const suite = texte.slice(debut + titre.length + 3);
  const fin = suite.search(/^## /m);
  return fin < 0 ? suite : suite.slice(0, fin);
};

// Chaque information du message, avec la marque qui la reconnaît des deux côtés.
const INFORMATIONS = {
  tâche: /identifiant, titre, objectif/,
  "critères d'acceptation": /critères d'acceptation/,
  "fichiers concernés": /fichiers concernés/,
  glossaire: /mots du glossaire/,
  "conception technique": /conception technique du plan/,
  "conventions de la mémoire": /conventions[^;\n]*mémoire/,
  "familles de qualité": /familles de qualité/,
  "tests essentiels": /tests essentiels/,
  "tests d'abord": /interface attendue/,
  "dossier de travail": /Dossier de travail/,
  correction: /constats/,
};

test("deleguer.md existe, nomme les quatre familles de qualité et les tests essentiels du rythme rapide", () => {
  const texte = lire("references", "deleguer.md");
  const message = section(texte, "Le message");
  for (const famille of ["clean-code", "composants", "securite", "organisation"]) assert.match(message, new RegExp(`\`${famille}\``), famille);
  assert.match(message, /rythme rapide : « tests essentiels » \(référence « Tests automatiques », § 2 bis\)/);
  assert.match(texte, /^## Au retour$/m);
  assert.match(texte, /pulse-aidd pile reference fiche\.md/);
});

test("alignement : toute information de « Informations reçues » (implementer) figure dans « Le message » (deleguer.md), et inversement", () => {
  const recu = section(lire("agents", "implementer.md"), "Informations reçues");
  const message = section(lire("references", "deleguer.md"), "Le message");
  for (const [nom, marque] of Object.entries(INFORMATIONS)) {
    assert.match(recu, marque, `implementer.md : « ${nom} » manque dans « Informations reçues »`);
    assert.match(message, marque, `deleguer.md : « ${nom} » manque dans « Le message »`);
  }
  // Inversement : chaque puce du message correspond à une information connue.
  const puces = message.split("\n").filter((l) => l.startsWith("- "));
  for (const puce of puces) assert.ok(Object.values(INFORMATIONS).some((m) => m.test(puce)), `puce du message sans information connue : ${puce.slice(0, 70)}`);
});

test("la délégation s'écrit une fois : spirc et implement chargent deleguer.md, aucun des deux ne la recopie", () => {
  const aidd = lire("bin", "pulse-aidd");
  const corps = aidd.slice(aidd.indexOf("contexte() {"));
  for (const commande of ["spirc", "implement"]) {
    const lignes = corps.split("\n");
    const i = lignes.findIndex((l) => l.startsWith(`    ${commande})`));
    assert.ok(i > 0, commande);
    const suite = lignes.slice(i + 1);
    const cas = suite.slice(0, suite.findIndex((l) => /^    [\w-]+\)/.test(l))).join("\n");
    assert.match(cas, /afficher "Déléguer à l'implementer" "\$REF\/deleguer\.md"/, commande);
  }
  for (const commande of ["spirc", "implement"]) {
    const skill = lire("skills", commande, "SKILL.md");
    assert.match(skill, /« Déléguer à l'implementer »/, `${commande} : renvoie à la délégation`);
    assert.doesNotMatch(skill, /Organisation des fichiers », « Commandes du projet », « Données et contrôle d'accès » et « Secrets et variables d'environnement » de `docs\/technical\.md` \(recopiées\)/, `${commande} : ne recopie plus docs/technical.md`);
  }
});

test("références découpées : tests d'abord et dossier à part chargés quand ils servent", () => {
  const auto = lire("references", "tests-automatiques.md");
  const dabord = lire("references", "tests-dabord.md");
  assert.match(dabord, /^# Tests d'abord$/m);
  assert.match(dabord, /### Rouge : écrire les tests/);
  assert.match(dabord, /### Vert : réaliser/);
  assert.match(dabord, /### Trier les échecs/);
  assert.doesNotMatch(auto, /### Rouge : écrire les tests|### Trier les échecs/);
  assert.match(auto, /^# Tests automatiques$/m);
  assert.match(auto, /pulse-aidd reference tests-dabord\.md/);
  for (const t of ["## 2 bis. Tests essentiels", "## 2 ter. Filet anti-régression", "## 3. Si l'outil de test manque"]) assert.ok(auto.includes(t), t);
  assert.doesNotMatch(auto, /ou express/);
  assert.doesNotMatch(auto, /`\/pulse:implement` : plan terminé/);

  const wt = lire("references", "worktree.md");
  const dossier = lire("references", "worktree-dossier.md");
  assert.match(dossier, /## 2\. Créer le worktree ou y revenir/);
  assert.match(dossier, /## 3\. Terminer : rassembler le travail/);
  assert.doesNotMatch(wt, /## 2\. Créer le worktree|## 3\. Terminer/);
  for (const t of ["## 1. Faut-il un worktree ?", "## 4. Suggérer une US à mener en parallèle"]) assert.ok(wt.includes(t), t);
  assert.match(wt, /pulse-aidd reference worktree-dossier\.md/);
  assert.match(lire("skills", "spirc", "references", "serie.md"), /pulse-aidd reference worktree-dossier\.md/);
});

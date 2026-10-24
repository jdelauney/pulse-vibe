// Instantané des identifiants de règles des familles de qualité et des morceaux de tests : titres numérotés (## à ####) et
// points de la checklist sécurité (S1…S13) cités. Une famille raccourcie garde tous ses identifiants ; en ajouter est permis.
// Relevé le 2026-10-24 (pulse 0.50, tâche 2.3 du refactoring d'optimisation).
// Lancer : node --test plugins/pulse-vibe/tests/regles-identifiants.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const REF = path.join(__dirname, "..", "references");

const INSTANTANE = {
 "qualite/README.md": {
  "titres": [],
  "securite": [
   "S1",
   "S13"
  ]
 },
 "qualite/clean-code.md": {
  "titres": [
   "## 1. Principes",
   "### Limites chiffrées",
   "## 2. Nommage",
   "## 3. Constantes : aucune valeur magique",
   "## 4. Fonctions",
   "## 5. Testabilité, couplage et règles métier",
   "### Règles métier : un seul endroit, sans dépendance extérieure",
   "### Testable",
   "### Faible couplage",
   "## 6. Commentaires : expliquer le pourquoi",
   "## 7. Typage et contrats de données",
   "## 8. Gestion des erreurs",
   "## 9. Asynchrone",
   "## 10. Organisation du code",
   "## 11. Séparer serveur et client",
   "## 12. Dépendances",
   "## 13. Configuration",
   "## 14. Outils de contrôle du projet",
   "## 15. Anti-patterns",
   "## 16. Checklist",
   "### À l'implémentation",
   "### À la relecture"
  ],
  "securite": [
   "S5",
   "S8",
   "S11"
  ]
 },
 "qualite/code-concepts.md": {
  "titres": [],
  "securite": []
 },
 "qualite/composants.md": {
  "titres": [
   "## 1. Présentation et orchestration",
   "## 2. Niveaux de composants",
   "## 3. État",
   "## 4. Accès aux données centralisé",
   "## 5. Flux de données",
   "## 6. Les quatre états d'interface",
   "## 7. Formulaires",
   "## 8. Accessibilité",
   "## 9. Nommage",
   "## 10. Découpage et regroupement",
   "## 11. Entrées d'un composant et composition",
   "## 12. Tests",
   "## 13. Sécurité de l'affichage",
   "## 14. Checklist (implémentation et relecture)"
  ],
  "securite": [
   "S5",
   "S6"
  ]
 },
 "qualite/organisation.md": {
  "titres": [
   "## 1. Quand appliquer ce guide",
   "## 2. Nommage des fichiers et des dossiers",
   "### Exceptions : quand le langage ou l'outil impose autre chose",
   "## 3. Catalogue des suffixes",
   "## 4. La racine du dépôt",
   "## 5. Le code : des paliers progressifs, découpés par fonctionnalité",
   "### Palier 1 — simple",
   "### Palier 2 — métier",
   "### Palier 3 — hexagonal",
   "### Choisir et changer de palier",
   "## 6. Règles de dépendance",
   "### L'index public d'une feature",
   "## 7. Tests",
   "## 8. Anti-patterns",
   "## 9. Checklist"
  ],
  "securite": []
 },
 "qualite/securite-code.md": {
  "titres": [
   "## Principe directeur",
   "## Quand appliquer quoi",
   "## 1. Validation serveur par liste blanche (S5)",
   "## 2. Contrôle d'accès à chaque lecture et écriture (S3, S4)",
   "## 3. Règles d'accès au niveau des données",
   "## 4. Champ piège et délai minimal (S10)",
   "## 5. Limitation de fréquence (S10)",
   "## 6. Origine des requêtes et CSRF (S4, S10)",
   "## 7. Mots de passe et authentification (S1, S5, S11)",
   "## 8. Anti-robot (S10)",
   "## 9. Secrets (S1, S2)",
   "## 10. Réponses, codes HTTP et journal (S11, S9)",
   "## 11. Affichage sans injection (S6)",
   "## 12. Envoi de fichiers (S7)",
   "## 13. Squelette d'un point d'entrée sécurisé",
   "## 14. Checklist avant de livrer"
  ],
  "securite": [
   "S1",
   "S2",
   "S3",
   "S4",
   "S5",
   "S6",
   "S7",
   "S8",
   "S9",
   "S10",
   "S11",
   "S12",
   "S13"
  ]
 },
 "tests/README.md": {
  "titres": [],
  "securite": []
 },
 "tests/bout-en-bout.md": {
  "titres": [
   "## 1. Caractéristiques",
   "## 2. Quels parcours",
   "## 3. Écrire un test de bout en bout",
   "## 4. Stabilité",
   "## 5. Après un déploiement",
   "## 6. Liste de contrôle"
  ],
  "securite": []
 },
 "tests/ecrire-un-test.md": {
  "titres": [
   "## 1. F.I.R.S.T : les cinq qualités d'un test",
   "## 2. Structure : Fonctionnalité / Règle / Exemple",
   "## 3. Le corps du test : Étant donné / Quand / Alors",
   "## 4. L'objet SUT : un test qui se lit comme une phrase",
   "## 5. Z.O.M.B.I.E.S : la liste des cas à couvrir",
   "## 6. Données de test",
   "## 7. Assertions",
   "## 8. Doublures",
   "### Où doubler",
   "### Les cinq sortes",
   "## 9. Préparation et nettoyage",
   "## 10. Erreurs attendues",
   "## 11. Signaux d'alerte",
   "## 12. Liste de contrôle",
   "## 13. Vocabulaire"
  ],
  "securite": []
 },
 "tests/gherkin.md": {
  "titres": [
   "## 1. Les mots-clés en français",
   "## 2. Écrire un bon scénario",
   "## 3. Choisir les exemples",
   "## 4. Étiquettes",
   "## 5. Exemple complet",
   "## 6. Du scénario au test"
  ],
  "securite": [
   "S1",
   "S13"
  ]
 },
 "tests/integration.md": {
  "titres": [
   "## 1. Caractéristiques",
   "## 2. Ce qu'on teste en intégration",
   "## 3. Préparation, nettoyage et données",
   "## 4. Pannes et erreurs",
   "## 5. Liste de contrôle"
  ],
  "securite": [
   "S1",
   "S13"
  ]
 },
 "tests/strategie.md": {
  "titres": [
   "## 1. La pyramide",
   "## 2. Choisir le niveau",
   "## 3. Couverture",
   "## 4. Quand lancer quoi"
  ],
  "securite": []
 },
 "tests/tdd.md": {
  "titres": [
   "## 1. Le cycle : rouge, vert, remaniement",
   "## 2. Les 5 étapes pour écrire un exemple",
   "### Étape 1 : raconter l'histoire avec un exemple concret",
   "### Étape 2 : écrire l'histoire en code DAMP",
   "### Étape 3 : écrire le « Alors » avec la valeur attendue en dur",
   "### Étape 4 : relier le « Quand » au « Alors »",
   "### Étape 5 : relier le « Étant donné » au « Quand »",
   "## 3. Faire grandir le code par les exemples",
   "## 4. Ordre des exemples : Z.O.M.B.I.E.S",
   "## 5. Règles clés"
  ],
  "securite": []
 },
 "tests/test-manuel.md": {
  "titres": [
   "## 1. Préparer la fiche",
   "## 2. Exemple de fiche : créer, consulter, modifier, supprimer",
   "### Créer",
   "### Consulter",
   "### Modifier",
   "### Supprimer",
   "### Erreurs",
   "### Affichage",
   "### Rapidité et propreté",
   "## 3. Vérification dans le navigateur par l'assistant",
   "## 4. Résultat attendu avant de valider"
  ],
  "securite": []
 },
 "tests/unitaires.md": {
  "titres": [
   "## 1. Caractéristiques",
   "## 2. Ce qu'on teste en unitaire",
   "## 3. Exemples",
   "### Règle métier pure : appel direct",
   "### Cas d'usage : SUT et doublures aux frontières",
   "## 4. Interface",
   "## 5. Code exécuté côté serveur",
   "## 6. Liste de contrôle"
  ],
  "securite": []
 }
};

/** Titres (## à ####, hors blocs de code) et points S<n> d'un fichier. */
function relever(chemin) {
  const lignes = fs.readFileSync(path.join(REF, chemin), "utf8").split("\n");
  let bloc = false;
  const titres = [];
  for (const l of lignes) {
    if (/^\s*```/.test(l)) bloc = !bloc;
    else if (!bloc && /^#{2,4} /.test(l)) titres.push(l);
  }
  return { titres, securite: new Set(lignes.join("\n").match(/\bS\d{1,2}\b/g) || []) };
}

for (const [chemin, attendu] of Object.entries(INSTANTANE)) {
  test(`${chemin} : aucun titre ni point de sécurité n'a disparu`, () => {
    const actuel = relever(chemin);
    for (const t of attendu.titres) assert.ok(actuel.titres.includes(t), `titre disparu : ${t}`);
    for (const s of attendu.securite) assert.ok(actuel.securite.has(s), `point disparu : ${s}`);
  });
}

test("l'instantané couvre chaque fichier de references/qualite et references/tests", () => {
  const presents = ["qualite", "tests"].flatMap((d) => fs.readdirSync(path.join(REF, d)).filter((f) => f.endsWith(".md")).map((f) => `${d}/${f}`));
  assert.deepStrictEqual(Object.keys(INSTANTANE).sort(), presents.sort());
});

test("la checklist sécurité garde S1 à S13", () => {
  const texte = fs.readFileSync(path.join(REF, "checklist-securite.md"), "utf8");
  for (let n = 1; n <= 13; n++) assert.match(texte, new RegExp(`\\bS${n}\\b`), `S${n}`);
});

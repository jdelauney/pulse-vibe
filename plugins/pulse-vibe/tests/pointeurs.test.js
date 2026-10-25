// Garde des pointeurs à la demande : un fichier qui sort du contexte d'une commande garde, dans la commande
// (ou dans une étape qu'elle enchaîne), un pointeur avec sa condition de chargement.
// Lancer : node --test plugins/pulse-vibe/tests/pointeurs.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");

// Fichiers (chemins relatifs au plugin) que « pulse-aidd contexte <commande> » affichait en pulse 0.49.2,
// hors règles communes (toujours affichées, en noyau et modules) et hors fichiers du pack de pile.
// Source : les lignes « afficher » de contexte() dans bin/pulse-aidd au commit 419eb9a
// (sections listées dans docs/superpowers/revues/2026-10-24-optimisation-registre.md).
const LEXIQUE = "templates/lexique.md";
const DEPOT = "references/depot-distant.md";
const GIT = "references/git.md";
const MEMOIRE = "references/memoire.md";
const RAISONNEMENT = "references/raisonnement.md";
const SANS_CONVERSATION = "references/secrets/sans-conversation.md";
const BASE = {
  init: [DEPOT, "references/fichiers-projet.md", "references/cycle.md", "skills/init/assets/banniere.txt", "templates/CLAUDE.md"],
  brainstorm: [RAISONNEMENT, MEMOIRE, "templates/brief.md", "templates/aidd-memory-glossary.md", "templates/aidd-memory-decision.md"],
  tech: [MEMOIRE, "skills/tech/references/choix-techniques.md", "references/qualite/organisation.md", "skills/tech/assets/technical.md",
    "templates/gitignore.template", "templates/env.example.template", "templates/aidd-memory-decision.md"],
  memory: [MEMOIRE, "templates/aidd-memory-readme.md", "templates/aidd-memory-project.md", "templates/aidd-memory-technical.md",
    "templates/aidd-memory-glossary.md", "templates/aidd-memory-decision.md", "templates/claude-bloc-memoire.md"],
  spirc: ["references/examen.md", "templates/revue.md", LEXIQUE],
  express: [RAISONNEMENT, MEMOIRE, "templates/brief.md", "templates/prd.md", "templates/user-stories.md", "templates/us.md",
    "templates/aidd-memory-glossary.md", "templates/in-progress.md"],
  prd: [RAISONNEMENT, "templates/prd.md"],
  us: [RAISONNEMENT, "templates/user-stories.md", "templates/us.md"],
  spec: ["templates/us.md", "references/tests/gherkin.md", "skills/spec/assets/spec.md"],
  plan: ["references/checklist-securite.md", "references/tests/strategie.md", "skills/ui/references/motifs.md", "templates/plan.md"],
  implement: ["references/tests-automatiques.md", "references/worktree.md", LEXIQUE],
  fix: [LEXIQUE],
  review: ["references/examen.md", "templates/revue.md"],
  commit: [GIT, DEPOT, "templates/gitignore.template"],
  pr: [GIT, "skills/pr/assets/pull-request.md"],
  annuler: [GIT, DEPOT],
  "get-help": ["skills/get-help/assets/demande-aide.md"],
  cicd: [DEPOT, "templates/ci-verifications.yml.template", GIT],
  deploy: [DEPOT, SANS_CONVERSATION, "templates/ci-verifications.yml.template"],
  security: ["references/checklist-securite.md", SANS_CONVERSATION, "skills/security/assets/securite.md", "templates/confidentialite.md"],
  secrets: [SANS_CONVERSATION, "skills/secrets/references/fuite.md", "skills/secrets/assets/secrets.md", "skills/secrets/assets/incident.md", LEXIQUE],
  refine: ["skills/plan/SKILL.md", "templates/plan.md"],
  ui: [MEMOIRE, "skills/ui/references/registres.md", "skills/ui/references/regles-ui.md", "skills/ui/references/anti-patterns.md",
    "skills/ui/references/motifs.md", "skills/ui/assets/design.md", "skills/ui/assets/maquette-note.md", "skills/ui/assets/revue-ui.md"],
  rediger: ["skills/rediger/references/regles.md", "skills/rediger/assets/voix.md", "skills/rediger/assets/texte-page.md", LEXIQUE],
  seo: ["skills/seo/references/regles.md", "skills/seo/references/ia.md", "skills/seo/assets/seo.md", "skills/seo/assets/seo-audit.md", LEXIQUE],
  perf: ["skills/perf/references/performance.md", "skills/perf/assets/performance.md", LEXIQUE],
  "search-console": ["skills/search-console/references/search-console.md", "skills/search-console/assets/rapport-search-console.md",
    "templates/in-progress.md", LEXIQUE],
  learn: ["skills/learn/references/pedagogie.md", "skills/learn/assets/apprentissage.md", LEXIQUE],
  explain: [LEXIQUE],
  test: ["references/tests-automatiques.md", "references/tests/gherkin.md", LEXIQUE],
  guide: ["references/fichiers-projet.md", "references/cycle.md"],
  status: ["references/cycle.md"],
  "auto-fix": [],
};

// Fichiers que la commande n'utilisait pas (relevé de l'audit) : ils peuvent sortir sans pointeur.
const EXCEPTIONS = {
  init: ["references/fichiers-projet.md"],
  guide: ["references/fichiers-projet.md"],
  ui: [MEMOIRE],
  status: ["references/cycle.md"],
  // refactoring d'optimisation, tâche 7.4 : l'exemple de CI est copié dans le projet par pulse-aidd installer-ci (scripts/ci-verifications.exemple.yml, lu à l'étape 3)
  cicd: ["templates/ci-verifications.yml.template"],
  // refactoring d'optimisation, tâche 7.5 : la saisie hors conversation est lancée par deploy/variables.md (première mise en ligne et production), au moment d'envoyer une valeur
  deploy: ["templates/ci-verifications.yml.template", SANS_CONVERSATION],
  // refactoring d'optimisation, tâche 5.5 : la checklist est chargée par l'auditeur (et par le repli, qui suit ses consignes) ; une clé exposée part vers secrets/fuite.md
  security: ["references/checklist-securite.md", SANS_CONVERSATION],
  // refactoring d'optimisation, tâche 7.1 : depot-distant.md scindé ; l'envoi du travail (envoi.md) est affiché par commit, lu par annuler à l'étape 6 ;
  // relier un dépôt distant ne se fait plus dans ces commandes (/pulse:init, /pulse:deploy)
  commit: [DEPOT],
  annuler: [GIT, DEPOT], // GIT : pulse 0.51 : ses gestes Git sont dans pulse-aidd annuler ; son § 7 ne tient plus qu'en deux lignes
};

// Ce que « pulse-aidd contexte <commande> » affiche aujourd'hui, lu dans les lignes « afficher » de bin/pulse-aidd.
// Les règles communes (noyau et modules) ne sont pas suivies ici : aucun fichier de BASE n'en fait partie.
function affiches() {
  const bin = lire("bin/pulse-aidd");
  const debut = bin.indexOf("\ncontexte() {");
  const fin = bin.indexOf("\n}\n", debut);
  const corps = bin.slice(debut, fin);
  const cases = corps.slice(corps.indexOf('case "$1" in'));
  const resultat = {};
  for (const m of cases.matchAll(/^ {4}("?[\w-]+"?|\*)\)([\s\S]*?);;/gm)) {
    const fichiers = [];
    for (const a of m[2].matchAll(/afficher\s+"[^"]*"\s+"\$(REF|TPL|SK|RACINE)\/([^"]+)"/g)) {
      const base = { REF: "references/", TPL: "templates/", SK: "skills/", RACINE: "" }[a[1]];
      fichiers.push(base + a[2]);
    }
    if (/(^|\s)lexique(\s|$)/.test(m[2].replace(/afficher[^\n]*/g, ""))) fichiers.push(LEXIQUE);
    resultat[m[1].replace(/"/g, "")] = fichiers;
  }
  return resultat;
}

// Le SKILL.md d'une commande et, de proche en proche, ceux des étapes qu'elle enchaîne (« pulse-aidd etape <cmd> »).
function textes(commande, vus = new Set()) {
  if (vus.has(commande)) return [];
  vus.add(commande);
  const fichier = path.join("skills", commande, "SKILL.md");
  if (!fs.existsSync(path.join(RACINE, fichier))) return [];
  const texte = lire(fichier);
  const resultat = [texte];
  for (const e of texte.matchAll(/pulse-aidd etape ([\w-]+)/g)) resultat.push(...textes(e[1], vus));
  return resultat;
}

// Condition de chargement : un moment (étape, avant, au début, au moment) ou un cas (seulement, quand + action).
// « pour » et « si » seuls ne suffisent pas ; les phrases de repli du contexte (« figurent dans ce contexte »…) ne comptent pas.
const CONDITION = /(?<![\p{L}])(à l'étape|avant|seulement|au début|au moment|lors(?:que)?|étape \d|quand\s+\S+\s+\S+)(?![\p{L}])/iu;
const REPLI = /figurent dans ce contexte|ce contexte est absent|si la référence manque|si le modèle manque/i;

// Les formes de pointeur qui désignent ce fichier.
function pointeurs(fichier) {
  const formes = [];
  let m;
  if ((m = fichier.match(/^references\/(.+)$/))) {
    formes.push(`pulse-aidd reference ${m[1]}`);
    if (m[1].startsWith("qualite/")) formes.push("pulse-aidd qualite");
    if (m[1].startsWith("tests/") || m[1] === "tests-automatiques.md") formes.push("pulse-aidd tests");
  } else if ((m = fichier.match(/^templates\/(.+)$/))) {
    formes.push(`pulse-aidd modele ${m[1]}`);
  } else if ((m = fichier.match(/^skills\/([^/]+)\/references\/(.+)$/))) {
    formes.push(`pulse-aidd reference ${m[1]}/${m[2]}`);
  } else if ((m = fichier.match(/^skills\/([^/]+)\/assets\/(.+)$/))) {
    formes.push(`pulse-aidd modele ${m[1]}/${m[2]}`);
  } else if ((m = fichier.match(/^skills\/([^/]+)\/SKILL\.md$/))) {
    formes.push(`pulse-aidd etape ${m[1]}`);
  }
  return formes;
}

// Une phrase = une ligne, coupée aux points suivis d'une majuscule, de guillemets, d'un tiret ou d'une étoile.
function phrases(texte) {
  return texte.split("\n").flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-ZÉÈÀ«*`-])/));
}

// Une phrase est un vrai pointeur si elle cite une forme du fichier avec une condition, hors phrase de repli.
function phraseValide(phrase, formes) {
  return !REPLI.test(phrase) && formes.some((f) => phrase.includes(f)) && CONDITION.test(phrase);
}

function pointeurAvecCondition(commande, fichier) {
  const formes = pointeurs(fichier);
  return textes(commande).some((t) => phrases(t).some((p) => phraseValide(p, formes)));
}

test("chaque commande de BASE existe et bin/pulse-aidd se lit", () => {
  const actuel = affiches();
  for (const commande of Object.keys(BASE)) {
    assert.ok(fs.existsSync(path.join(RACINE, "skills", commande, "SKILL.md")), `commande ${commande} : SKILL.md introuvable`);
  }
  assert.ok(Object.keys(actuel).length > 20, "lecture de contexte() dans bin/pulse-aidd : trop peu de commandes trouvées");
  for (const fichier of Object.values(actuel).flat()) {
    assert.ok(fs.existsSync(path.join(RACINE, fichier)), `bin/pulse-aidd affiche ${fichier}, introuvable`);
  }
});

test("un fichier sorti du contexte d'une commande garde un pointeur avec sa condition", () => {
  const actuel = affiches();
  for (const [commande, fichiers] of Object.entries(BASE)) {
    const encore = actuel[commande] || [];
    for (const fichier of fichiers) {
      if (encore.includes(fichier)) continue;
      if ((EXCEPTIONS[commande] || []).includes(fichier)) continue;
      assert.ok(
        pointeurAvecCondition(commande, fichier),
        `/pulse:${commande} n'affiche plus ${fichier} et ne le cite nulle part avec sa condition ` +
          `(attendu dans skills/${commande}/SKILL.md ou une étape enchaînée : « ${pointeurs(fichier)[0]} » dans une phrase avec « à l'étape », « avant », « seulement », « au début », « au moment » ou « quand » suivi d'une action)`,
      );
    }
  }
});

test("les exceptions désignent des fichiers de BASE", () => {
  for (const [commande, fichiers] of Object.entries(EXCEPTIONS)) {
    for (const f of fichiers) assert.ok((BASE[commande] || []).includes(f), `exception ${commande} : ${f} n'est pas dans BASE`);
  }
});

test("le repérage accepte un vrai pointeur et refuse le repli et la condition trop faible", () => {
  const formes = pointeurs("skills/ui/references/regles-ui.md");
  assert.ok(phraseValide("À l'étape 2, lancer `pulse-aidd reference ui/regles-ui.md`.", formes));
  assert.ok(phraseValide("Lancer `pulse-aidd reference ui/regles-ui.md` seulement pour une refonte.", formes));
  assert.ok(!phraseValide("Si ce contexte est absent, lancer `pulse-aidd contexte ui` (et `pulse-aidd reference ui/regles-ui.md` si la référence manque).", formes));
  assert.ok(!phraseValide("Les références figurent dans ce contexte : `pulse-aidd reference ui/regles-ui.md` avant tout.", formes));
  assert.ok(!phraseValide("Les règles pour l'interface : `pulse-aidd reference ui/regles-ui.md`.", formes));
  assert.ok(!phraseValide("Si besoin, voir `pulse-aidd reference ui/regles-ui.md`.", formes));
  assert.ok(!phraseValide("Un avantage : `pulse-aidd reference ui/regles-ui.md`.", formes));
  assert.ok(!phraseValide("Lorsqu'on veut, voir `pulse-aidd reference ui/regles-ui.md`.", formes));
  assert.ok(phraseValide("Lorsque la refonte commence, lancer `pulse-aidd reference ui/regles-ui.md`.", formes));
  assert.ok(!pointeurs("references/git.md").some((f) => f.includes("pile reference")));
});

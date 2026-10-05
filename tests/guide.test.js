// Tests du guide de réalisation (docs/guide/ produit à partir des plans de docs/plans/).
// Lancer : node --test plugins/pulse/tests/*.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const GUIDE = path.join(__dirname, "..", "scripts", "guide.js");

const PLAN = `# Plan – TodoIt – MVP

## Jalon 1 – MVP (toutes les US « Indispensables »)

- [x] **T1 – Afficher la page** · US-01
  - Objectif : la page s'affiche
  - Fichiers : public/index.html
  - Vérification : US-01 critère 1

- [~] **T2 – Créer une tâche** · US-02
  - Objectif : saisir une tâche et la voir
  - Vérification : US-02 critères 1 et 2
  - Action manuelle : coller supabase/schema.sql dans l'éditeur SQL de Supabase

- [ ] **T3 – Mettre en ligne le MVP** · —
  - Vérification : l'adresse s'ouvre sur un téléphone

## Jalon 2 – Essentiel

- [ ] **T4 – Filtrer par date** · US-05

## Journal

| Date | Tâche | Commit | Remarque |
|---|---|---|---|
| 2026-10-05 | T1 | abc1234 | - [ ] **T99 – piège dans le journal** |
`;

const PLAN_US = `# Plan – TodoIt – Export

## Jalon 1 – Exporter la liste

- [ ] **T5 – Exporter en CSV** · US-06
  - Objectif : télécharger la liste
`;

const MVP = "us-01-us-04-mvp";
const EXPORT = "us-06-export";

function projet(plans = { [MVP]: PLAN }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-guide-"));
  fs.mkdirSync(path.join(d, "docs", "plans"), { recursive: true });
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# TodoIt\n");
  for (const [nom, contenu] of Object.entries(plans)) fs.writeFileSync(path.join(d, "docs", "plans", `${nom}.md`), contenu);
  return d;
}
const lancer = (d, args = [], input) => spawnSync("node", [GUIDE, ...args], { encoding: "utf8", input, env: { ...process.env, CLAUDE_PROJECT_DIR: d } });
const lire = (d, f) => fs.readFileSync(path.join(d, "docs", "guide", f), "utf8");
const ecrirePlan = (d, nom, contenu) => fs.writeFileSync(path.join(d, "docs", "plans", `${nom}.md`), contenu);
const hook = (d, fichier) => lancer(d, ["--hook"], JSON.stringify({ tool_name: "Edit", tool_input: { file_path: path.join(d, ...fichier) } }));

test("produit l'index et un dossier par plan, avec un fichier par jalon et la prochaine commande", () => {
  const d = projet();
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stdout);
  assert.deepStrictEqual(fs.readdirSync(path.join(d, "docs", "guide")).sort(), ["index.md", MVP]);
  assert.deepStrictEqual(fs.readdirSync(path.join(d, "docs", "guide", MVP)).sort(), ["jalon-01-mvp.md", "jalon-02-essentiel.md"]);
  const index = lire(d, "index.md");
  assert.match(index, /# Guide de réalisation – TodoIt/);
  assert.match(index, /```\n\/pulse:review T2\n```/, "T2 en cours : la prochaine étape est la relecture");
  assert.match(index, /\| us-01-us-04-mvp \| 1 – MVP \(toutes les US « Indispensables »\) \| 3 \| 1\/3 \|/);
  assert.doesNotMatch(index + lire(d, `${MVP}/jalon-01-mvp.md`), /T99/, "le Journal est ignoré");
});

test("chaque tâche a ses commandes, avec le nom du plan, ses prérequis et ses actions manuelles", () => {
  const d = projet();
  lancer(d);
  const j1 = lire(d, `${MVP}/jalon-01-mvp.md`);
  assert.match(j1, /- \[x\] 🔵 Réaliser\n  ```\n  \/pulse:implement us-01-us-04-mvp T1/);
  assert.match(j1, /\/pulse:spirc us-01-us-04-mvp T2/);
  assert.match(j1, /\[index\.md\]\(\.\.\/index\.md\)/);
  assert.match(j1, /⚠️ Action de votre part : coller supabase\/schema\.sql/);
  assert.match(j1, /### T3 – Mettre en ligne le MVP\n\nStatut : ⬜ à faire\n/, "pas de « — » affiché");
  assert.match(j1, /⚠️ Avant : terminer et enregistrer T2/);
  assert.match(j1, /- \[ \] 🔵 Mettre en ligne\n  ```\n  \/pulse:deploy/);
  assert.doesNotMatch(j1, /\/pulse:implement \S+ T3/);
  assert.match(lire(d, `${MVP}/jalon-02-essentiel.md`), /⚠️ Prérequis : terminer le Jalon 1/);
});

test("plusieurs plans : ordonnés par numéro de tâche, la tâche en cours d'abord, specs sans plan signalées", () => {
  const d = projet({ [EXPORT]: PLAN_US, [MVP]: PLAN.replace("- [~] **T2", "- [x] **T2").replace("- [ ] **T3", "- [x] **T3").replace("- [ ] **T4", "- [x] **T4") });
  fs.mkdirSync(path.join(d, "docs", "specs"));
  for (const s of [MVP, EXPORT, "us-07-rappels"]) fs.writeFileSync(path.join(d, "docs", "specs", `${s}.md`), "# Spec\n");
  assert.strictEqual(lancer(d).status, 0);
  const index = lire(d, "index.md");
  assert.ok(index.indexOf(`| ${MVP} |`) < index.indexOf(`| ${EXPORT} |`), "le plan du MVP (T1) vient en premier");
  assert.match(index, /```\n\/pulse:implement us-06-export T5\n```/);
  assert.match(index, /⚠️ Spec sans plan : `\/pulse:plan us-07-rappels`/);
  assert.match(lire(d, `${EXPORT}/jalon-01-exporter-la-liste.md`), /## Fin du Jalon 1 – Exporter la liste\n\n- 🔵 Mettre la nouvelle version en ligne/);

  ecrirePlan(d, EXPORT, PLAN_US.replace("- [ ] **T5", "- [~] **T5"));
  ecrirePlan(d, MVP, PLAN);
  lancer(d);
  assert.match(lire(d, "index.md"), /```\n\/pulse:review T2\n```/, "une tâche en cours passe avant les autres");
});

test("mode hook : régénère seulement quand un plan de docs/plans/ est modifié, sans rien afficher", () => {
  const d = projet();
  lancer(d);
  ecrirePlan(d, MVP, PLAN.replace("- [~] **T2", "- [x] **T2"));

  const autre = hook(d, ["docs", "specs", `${MVP}.md`]);
  assert.strictEqual(autre.stdout, "");
  assert.match(lire(d, "index.md"), /\/pulse:review T2/, "autre fichier : guide inchangé");

  const plan = hook(d, ["docs", "plans", `${MVP}.md`]);
  assert.strictEqual(plan.status, 0);
  assert.strictEqual(plan.stdout, "");
  assert.match(lire(d, "index.md"), /```\n\/pulse:deploy\n```/, "T2 terminée : prochaine étape la mise en ligne");

  assert.strictEqual(lancer(d, ["--hook"], "pas du json").status, 0);
});

test("retire les fichiers d'un jalon ou d'un plan disparus, et l'ancien guide à plat", () => {
  const d = projet({ [MVP]: PLAN, [EXPORT]: PLAN_US });
  fs.mkdirSync(path.join(d, "docs", "guide"));
  fs.writeFileSync(path.join(d, "docs", "guide", "jalon-01-mvp.md"), "ancien guide");
  lancer(d);
  assert.ok(!fs.existsSync(path.join(d, "docs", "guide", "jalon-01-mvp.md")));

  ecrirePlan(d, MVP, PLAN.replace(/## Jalon 2[\s\S]*?(?=## Journal)/, ""));
  fs.unlinkSync(path.join(d, "docs", "plans", `${EXPORT}.md`));
  lancer(d);
  assert.ok(!fs.existsSync(path.join(d, "docs", "guide", MVP, "jalon-02-essentiel.md")));
  assert.ok(!fs.existsSync(path.join(d, "docs", "guide", EXPORT)));
});

test("aucun plan, ancien emplacement ou plan sans tâche reconnue : message clair, code 1", () => {
  const sansPlan = lancer(projet({}));
  assert.strictEqual(sansPlan.status, 1);
  assert.match(sansPlan.stdout, /\/pulse:plan/);

  const ancien = projet({});
  fs.writeFileSync(path.join(ancien, "docs", "plan.md"), PLAN);
  const r = lancer(ancien);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /\/pulse:init/);

  const vide = lancer(projet({ mvp: "# Plan\n\nRien ici.\n" }));
  assert.strictEqual(vide.status, 1);
  assert.match(vide.stdout, /aucune tâche reconnue/i);
});

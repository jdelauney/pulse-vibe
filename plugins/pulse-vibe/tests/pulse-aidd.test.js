// Tests de l'outil interne pulse-aidd pour /pulse:ui, /pulse:learn, /pulse:commit et /pulse:pr.
// Lancer : node --test plugins/pulse-vibe/tests/pulse-aidd.test.js (nécessite bash dans le PATH)
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
// Chemin relatif et cwd = racine du plugin : fonctionne avec Git Bash, Cygwin, macOS et Linux.
const lancer = (...args) => spawnSync("bash", ["bin/pulse-aidd", ...args], { cwd: RACINE, encoding: "utf8" });

test("contexte ui : règles communes, trois références de design et trois modèles", () => {
  const r = lancer("contexte", "ui");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of [
    "===== Règles communes Pulse =====",
    "===== Registres d'interface =====",
    "===== Règles d'interface =====",
    "===== Anti-patterns d'interface =====",
    "===== Modèle : docs/design.md =====",
    "===== Modèle : note de variante =====",
    "===== Modèle : rapport d'audit d'interface =====",
  ]) assert.ok(r.stdout.includes(titre), titre);
  assert.doesNotMatch(r.stdout, /commande inconnue/);
});

test("contexte learn : règles communes, pédagogie et modèle du carnet", () => {
  const r = lancer("contexte", "learn");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of [
    "===== Règles communes Pulse =====",
    "===== Pédagogie du professeur =====",
    "===== Modèle : docs/apprentissage.md =====",
  ]) assert.ok(r.stdout.includes(titre), titre);
  assert.doesNotMatch(r.stdout, /commande inconnue/);
});

test("contexte commit et pr : conventions Git partagées, modèle de PR pour pr", () => {
  const commit = lancer("contexte", "commit");
  assert.strictEqual(commit.status, 0, commit.stderr);
  assert.ok(commit.stdout.includes("===== Conventions Git ====="));
  assert.ok(commit.stdout.includes("===== Modèle : .gitignore ====="));
  const pr = lancer("contexte", "pr");
  assert.strictEqual(pr.status, 0, pr.stderr);
  for (const titre of [
    "===== Règles communes Pulse =====",
    "===== Conventions Git =====",
    "===== Modèle : description de demande de fusion =====",
  ]) assert.ok(pr.stdout.includes(titre), titre);
  assert.doesNotMatch(pr.stdout, /commande inconnue/);
});

test("agents designer et ui-critic disponibles, et cités dans le message d'erreur", () => {
  for (const nom of ["designer", "ui-critic"]) {
    const r = lancer("agent", nom);
    assert.strictEqual(r.status, 0, nom);
    assert.match(r.stdout, new RegExp(`name: ${nom}`));
  }
  const inconnu = lancer("agent", "inexistant");
  assert.strictEqual(inconnu.status, 1);
  assert.match(inconnu.stdout, /designer/);
  assert.match(inconnu.stdout, /ui-critic/);
});

test("comparer sans argument : usage et code 1", () => {
  const r = lancer("comparer");
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout + r.stderr, /Usage : pulse-aidd comparer <dossier/);
});

test("l'aide mentionne comparer et reste complète jusqu'à sa dernière ligne", () => {
  const r = lancer();
  assert.match(r.stdout, /pulse-aidd comparer <dossier>/);
  assert.match(r.stdout, /installer-ci/);
  assert.match(r.stdout, /Ne sort jamais en erreur/, "la plage du sed suit l'en-tête allongé d'une ligne");
  assert.doesNotMatch(r.stdout, /RACINE=/, "la plage du sed ne déborde pas sur le code");
});

test("contexte annuler : règles communes, conventions Git et envoi du travail", () => {
  const r = lancer("contexte", "annuler");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of [
    "===== Règles communes Pulse =====",
    "===== Conventions Git =====",
    "===== Le dépôt distant et l'envoi du travail =====",
  ]) assert.ok(r.stdout.includes(titre), titre);
  assert.doesNotMatch(r.stdout, /commande inconnue/);
});

test("contexte get-help : règles communes et modèle de demande d'aide", () => {
  const r = lancer("contexte", "get-help");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("===== Règles communes Pulse ====="));
  assert.ok(r.stdout.includes("===== Modèle : demande d'aide ====="));
  assert.doesNotMatch(r.stdout, /commande inconnue/);
});

test("contexte implement, spirc, fix, learn et explain : modèle du lexique", () => {
  for (const commande of ["implement", "spirc", "fix", "learn", "explain"]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("===== Modèle : docs/lexique.md ====="), commande);
  }
});

test("contexte brainstorm, prd et us : la référence « Penser avant d'écrire »", () => {
  for (const commande of ["brainstorm", "prd", "us"]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("===== Penser avant d'écrire ====="), commande);
  }
});

test("travail-fini : efface le travail en cours du dossier courant, sans erreur s'il est absent", () => {
  const fs = require("fs");
  const os = require("os");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-fini-"));
  const fichier = path.join(d, "aidd_docs", "tasks", "in-progress.md");
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, "# Travail en cours\n");
  const outil = path.join(RACINE, "bin", "pulse-aidd").split(path.sep).join("/");
  let r = spawnSync("bash", [outil, "travail-fini"], { cwd: d, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(fichier), "le fichier est effacé");
  r = spawnSync("bash", [outil, "travail-fini"], { cwd: d, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
});

test("tests : affiche toute la méthode de tests, Gherkin compris", () => {
  const r = lancer("tests");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of [
    "===== Stratégie de tests =====",
    "===== Écrire un test =====",
    "===== Tests unitaires =====",
    "===== Tests d'intégration =====",
    "===== Tests de bout en bout =====",
    "===== Développement piloté par les tests (TDD) =====",
    "===== Scénarios Gherkin =====",
  ]) assert.ok(r.stdout.includes(titre), titre);
});

test("contexte implement, spirc et test : la procédure des tests automatiques", () => {
  for (const commande of ["implement", "spirc", "test"]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("===== Tests automatiques : tests d'abord ====="), commande);
    assert.doesNotMatch(r.stdout, /commande inconnue/);
  }
});

test("contexte spec : Gherkin ; contexte plan : stratégie de tests", () => {
  assert.ok(lancer("contexte", "spec").stdout.includes("===== Scénarios Gherkin ====="));
  assert.ok(lancer("contexte", "plan").stdout.includes("===== Stratégie de tests ====="));
});

test("agents test-writer et test-runner disponibles, et cités dans le message d'erreur", () => {
  for (const nom of ["test-writer", "test-runner"]) {
    const r = lancer("agent", nom);
    assert.strictEqual(r.status, 0, nom);
    assert.match(r.stdout, new RegExp(`name: ${nom}`));
  }
  const inconnu = lancer("agent", "inexistant");
  assert.match(inconnu.stdout, /test-writer/);
  assert.match(inconnu.stdout, /test-runner/);
});

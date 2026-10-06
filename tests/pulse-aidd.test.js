// Tests de l'outil interne pulse-aidd pour /pulse:ui, /pulse:learn, /pulse:commit et /pulse:pr.
// Lancer : node --test plugins/pulse/tests/pulse-aidd.test.js (nécessite bash dans le PATH)
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

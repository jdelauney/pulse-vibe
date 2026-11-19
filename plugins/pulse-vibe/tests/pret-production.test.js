// Tests de `pulse-aidd pret-production` (skills/deploy/scripts/pret-production.js), appels externes simulés.
// Lancer : node --test plugins/pulse-vibe/tests/pret-production.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { controler, formater } = require("../skills/deploy/scripts/pret-production");

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-pret-"));
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));

function projet(nom, fichiers) {
  const d = path.join(BASE, nom);
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(d, chemin)), { recursive: true });
    fs.writeFileSync(path.join(d, chemin), contenu);
  }
  return d;
}
const tout = (res) => Object.fromEntries(res.map((r) => [r.cle, r]));
const SIMULE_OK = { preuve: () => 0, secrets: () => 0, protection: () => "ok" };

test("projet complet : chaque ligne est ok, le bilan dit prêt", () => {
  const d = projet("complet", {
    "docs/technical.md": "# T\n\n- Surveillance : UptimeRobot, https://exemple.fr/api/sante\n\n## Retour arrière\n\n- Le site : …\n- **Répété le** : 2026-11-01\n",
    "docs/securite.md": "# Audit de sécurité – 2026-11-02\n",
    ".github/workflows/verifications.yml": "on: push\n",
  });
  const r = tout(controler(d, SIMULE_OK));
  for (const cle of ["tests", "audit-securite", "secrets", "ci", "surveillance", "retour-arriere"]) assert.strictEqual(r[cle].etat, "ok", cle);
  assert.match(r["retour-arriere"].raison, /2026-11-01/);
  assert.ok(!("relecture-metier" in r));
  assert.match(formater(controler(d, SIMULE_OK)), /^bilan: pret$/m);
});

test("projet vide : chaque manque renvoie à sa commande, sans bloquer", () => {
  const d = projet("vide", { "docs/technical.md": "# T\n\n- Surveillance : « aucune »\n" });
  const res = controler(d, { preuve: () => 1, secrets: () => 1 });
  const r = tout(res);
  assert.deepStrictEqual([r.tests.commande, r["audit-securite"].commande, r.secrets.commande, r.ci.commande, r.surveillance.commande], ["/pulse:test lancer", "/pulse:security", "/pulse:secrets", "/pulse:cicd", "/pulse:deploy production"]);
  assert.match(r["retour-arriere"].raison, /pas écrite/);
  assert.match(formater(res), /^bilan: a-completer \(6 à faire\)$/m);
});

test("audit de fin de réalisation dans un plan, retour arrière écrit mais jamais essayé", () => {
  const d = projet("fin", {
    "docs/technical.md": "# T\n\n## Retour arrière\n\n- Répété le : jamais\n",
    "aidd_docs/tasks/groupe/PLAN-SPEC-US-001-a.md": "## Journal\n\n| 2026-11-10 | — | — | audit de sécurité de fin : bas, 0 bloquant(s) |\n",
  });
  const r = tout(controler(d, SIMULE_OK));
  assert.strictEqual(r["audit-securite"].etat, "ok");
  assert.match(r["audit-securite"].raison, /fin de réalisation/);
  assert.strictEqual(r["retour-arriere"].etat, "manque");
  assert.match(r["retour-arriere"].raison, /jamais été essayé/);
});

test("projet sensible (paiement) : une relecture par une personne du métier est conseillée", () => {
  const d = projet("paiement", { "docs/prd.md": "# PRD\n\nLes clients règlent par paiement en ligne (Stripe).\n", "docs/technical.md": "# T\n" });
  const r = tout(controler(d, SIMULE_OK));
  assert.strictEqual(r["relecture-metier"].etat, "conseillee");
  assert.strictEqual(r["relecture-metier"].commande, "/pulse:get-help");
  assert.ok(!/relecture-metier/.test(formater(controler(d, SIMULE_OK)).split("\n").pop()), "un conseil ne compte pas comme un manque");
});

test("une preuve illisible vaut inconnu, pas manque", () => {
  const d = projet("inconnu", { "docs/technical.md": "# T\n" });
  assert.strictEqual(tout(controler(d, { ...SIMULE_OK, preuve: () => null })).tests.etat, "inconnu");
});

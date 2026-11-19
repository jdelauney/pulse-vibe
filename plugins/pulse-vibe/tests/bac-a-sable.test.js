// Tests du bac à sable de Claude Code (scripts/bac-a-sable.js, pulse-aidd autorisations --bac-a-sable, sonde).
// Lancer : node --test plugins/pulse-vibe/tests/bac-a-sable.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const bac = require("../scripts/bac-a-sable");
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-bac-"));
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));

function projet(nom, fichiers = {}) {
  const d = path.join(BASE, nom);
  for (const [f, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), contenu);
  }
  fs.mkdirSync(d, { recursive: true });
  return d;
}

test("plateforme : macOS, Linux et WSL2 proposables ; Windows natif et WSL1 non", () => {
  assert.strictEqual(bac.plateforme("darwin", "Darwin Kernel"), "proposable");
  assert.strictEqual(bac.plateforme("linux", "Linux version 6.8.0-generic"), "proposable");
  assert.strictEqual(bac.plateforme("linux", "Linux version 6.18.33.2-microsoft-standard-WSL2"), "proposable");
  assert.strictEqual(bac.plateforme("linux", "Linux version 4.4.0-19041-Microsoft"), "wsl1");
  assert.strictEqual(bac.plateforme("win32", ""), "windows");
});

test("causeReseau : seulement dans le bac à sable (SANDBOX_RUNTIME=1), avec le domaine à autoriser", () => {
  assert.strictEqual(bac.causeReseau("https://exemple.fr/api/sante", {}), null);
  assert.match(bac.causeReseau("https://exemple.fr/api/sante", { SANDBOX_RUNTIME: "1" }), /« exemple\.fr ».*allowedDomains/);
});

test("domaines : cœur, pack déclaré, site en ligne, localhost seulement avec des tests de bout en bout", () => {
  const simple = projet("simple", { "CLAUDE.md": "# P\n- Site en ligne : https://www.mon-site.fr\n", "docs/technical.md": "# T\n| Tester | `npm test` |\n" });
  const d = bac.domaines(simple, { PULSE_PACK_DOMAINES: "vercel.com *.neon.tech" });
  for (const x of ["registry.npmjs.org", "github.com", "vercel.com", "*.neon.tech", "www.mon-site.fr"]) assert.ok(d.includes(x), x);
  assert.ok(!d.includes("localhost"));
  const e2e = projet("e2e", { "docs/technical.md": "| Tests de bout en bout | `npm run test:e2e` (Playwright) |\n" });
  assert.ok(bac.domaines(e2e, {}).includes("localhost"));
});

test("ecrire : le réglage rejoint .claude/settings.json sans rien retirer ; l'état ne signale plus rien", () => {
  const d = projet("ecrire", { ".claude/settings.json": JSON.stringify({ permissions: { deny: ["Read(./.env)"] }, sandbox: { network: { allowedDomains: ["mon-api.exemple.fr"] } } }) });
  const avant = bac.etat(d, {});
  assert.strictEqual(avant.actif, false);
  assert.ok(avant.manquants.includes("~/.npm") && avant.manquants.includes("registry.npmjs.org"));
  assert.ok(bac.ecrire(d, {}) > 0);
  const r = JSON.parse(fs.readFileSync(path.join(d, ".claude", "settings.json"), "utf8"));
  assert.deepStrictEqual(r.permissions, { deny: ["Read(./.env)"] }, "les permissions restent");
  assert.strictEqual(r.sandbox.enabled, true);
  assert.ok(r.sandbox.network.allowedDomains.includes("mon-api.exemple.fr"), "un domaine du projet reste");
  assert.ok(r.sandbox.filesystem.allowWrite.includes("~/.cache"));
  const apres = bac.etat(d, {});
  assert.deepStrictEqual([apres.actif, apres.manquants], [true, []]);
});

test("pulse-aidd autorisations --bac-a-sable : plateforme, état et manquants ; l'écriture refusée sous Windows natif", () => {
  const d = projet("cli", { "CLAUDE.md": "# P\n" });
  const r = spawnSync("bash", [path.join(RACINE, "bin", "pulse-aidd"), "autorisations", "--bac-a-sable"], { cwd: d, encoding: "utf8" });
  assert.match(r.stdout, /^plateforme: (proposable|windows|wsl1)$/m);
  assert.match(r.stdout, /^bac-a-sable: absent$/m);
  assert.match(r.stdout, /^- registry\.npmjs\.org$/m);
  const ecrit = spawnSync("bash", [path.join(RACINE, "bin", "pulse-aidd"), "autorisations", "--bac-a-sable", "--ecrire"], { cwd: d, encoding: "utf8" }).stdout;
  if (bac.plateforme() === "proposable") assert.match(ecrit, /^bac-a-sable: actif$/m);
  else {
    assert.match(ecrit, /^note: /m);
    assert.ok(!fs.existsSync(path.join(d, ".claude", "settings.json")), "rien n'est écrit là où le bac à sable ne marche pas");
  }
});

test("sonde : dans le bac à sable, un échec réseau nomme le domaine à autoriser", () => {
  const r = spawnSync(process.execPath, [path.join(RACINE, "scripts", "sonder.js"), "http://127.0.0.1:9", "--essais", "1"], { encoding: "utf8", env: { ...process.env, SANDBOX_RUNTIME: "1" } });
  assert.match(r.stdout + r.stderr, /bac à sable de Claude Code bloque peut-être « 127\.0\.0\.1 »/);
});

test("les trois outils posent NODE_USE_ENV_PROXY dans le bac à sable, par la même ligne", () => {
  const ligne = 'if [ "${SANDBOX_RUNTIME:-}" = 1 ] && [ -n "${HTTPS_PROXY:-}${https_proxy:-}" ]; then export NODE_USE_ENV_PROXY=1; fi';
  for (const outil of ["pulse-vibe/bin/pulse-aidd", "pulse-vibe-next/bin/pulse-pile-next", "pulse-skills/bin/pulse-skills"]) {
    assert.ok(fs.readFileSync(path.join(RACINE, "..", outil), "utf8").includes(ligne), outil);
  }
});

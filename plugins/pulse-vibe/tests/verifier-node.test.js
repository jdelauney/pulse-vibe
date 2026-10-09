// Le hook de démarrage sans Node (scripts/verifier-node.sh) et la version minimale de Node.js, partout la même.
// Lancer : node --test plugins/pulse-vibe/tests/verifier-node.test.js (nécessite sh ou bash dans le PATH)
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const DEPOT = path.join(RACINE, "..", "..");
const SCRIPT = path.join(RACINE, "scripts", "verifier-node.sh");
const lire = (...p) => fs.readFileSync(path.join(...p), "utf8");
const SH = spawnSync("sh", ["-c", "exit 0"]).status === 0 ? "sh" : "bash";
const MINIMUM = (lire(SCRIPT).match(/^MINIMUM="(\d+\.\d+)"$/m) || [])[1];

// Un faux node qui affiche `version`, dans un dossier ajouté en tête du PATH.
function fauxNode(version) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-node-"));
  fs.writeFileSync(path.join(d, "faux-node"), `#!/bin/sh\necho ${version}\n`);
  fs.chmodSync(path.join(d, "faux-node"), 0o755);
  return d;
}

function lancer({ node, dossier = null }) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(path|pulse_node)$/i.test(k)) env[k] = v;
  const chemin = process.env.PATH || process.env.Path || "";
  env.PATH = dossier ? `${dossier}${path.delimiter}${chemin}` : chemin;
  env.PULSE_NODE = node;
  return spawnSync(SH, [SCRIPT], { encoding: "utf8", env });
}

test("Node.js introuvable : Claude est prévenu, avec la marche à suivre", () => {
  const r = lancer({ node: "node-introuvable-pulse" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Node\.js est introuvable/);
  assert.match(r.stdout, new RegExp(`Node\\.js ${MINIMUM.replace(".", "\\.")} ou plus`));
  assert.match(r.stdout, /Dites-le à la personne dès votre première réponse/);
});

test("Node.js trop ancien : signalé ; à jour ou illisible : rien", () => {
  for (const version of ["v20.11.1", `v${MINIMUM.split(".")[0]}.${Number(MINIMUM.split(".")[1]) - 1}.9`]) {
    const r = lancer({ node: "faux-node", dossier: fauxNode(version) });
    assert.match(r.stdout, /est trop ancien/, version);
  }
  for (const version of [`v${MINIMUM}.0`, "v26.7.0", "truc"]) {
    const r = lancer({ node: "faux-node", dossier: fauxNode(version) });
    assert.strictEqual(r.status, 0, version);
    assert.strictEqual(r.stdout, "", version);
  }
  assert.strictEqual(lancer({ node: "node" }).stdout, "", "le node de cette machine passe");
});

test("Node.js minimum : le même dans le hook, les README, /pulse:init et le squelette", () => {
  assert.ok(MINIMUM, "MINIMUM=\"x.y\" dans scripts/verifier-node.sh");
  for (const f of ["README.md", "plugins/pulse-vibe/README.md", "plugins/pulse-vibe-next/README.md"])
    if (fs.existsSync(path.join(DEPOT, f))) assert.ok(lire(DEPOT, f).includes(`Node.js ${MINIMUM} ou plus`), f);
  assert.ok(lire(RACINE, "skills", "init", "SKILL.md").includes(`inférieure à ${MINIMUM}`), "/pulse:init");
  const squelette = path.join(DEPOT, "plugins", "pulse-vibe-next", "templates", "squelette", "package.json");
  if (fs.existsSync(squelette)) assert.strictEqual(JSON.parse(fs.readFileSync(squelette, "utf8")).engines.node, `>=${MINIMUM}.0`);
});

test("CI des plugins : la version minimale de Node.js et la LTS active, sous Ubuntu et Windows", { skip: !fs.existsSync(path.join(DEPOT, ".github", "workflows", "tests.yml")) && "hors du dépôt" }, () => {
  const yml = lire(DEPOT, ".github", "workflows", "tests.yml");
  assert.ok(yml.includes(`node: ["${MINIMUM}.0", "lts/*"]`), `matrice node : ["${MINIMUM}.0", "lts/*"]`);
  assert.match(yml, /os: \[ubuntu-latest, windows-latest\]/);
  assert.match(yml, /node-version: \$\{\{ matrix\.node \}\}/);
});

// Tests de `pulse-aidd copies` (scripts/copies.js) : les copies de Pulse dans un projet, avec l'empreinte de leur modèle.
// Lancer : node --test plugins/pulse-vibe/tests/copies.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "copies.js");
const { copier, etatDe, texteDeCopie, empreinte } = require(SCRIPT);
const MODELE = path.join(__dirname, "..", "templates", "verifier.js");

const dossier = () => fs.mkdtempSync(path.join(os.tmpdir(), "pulse-copies-"));
const lancer = (d, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: d, encoding: "utf8" });

test("une copie porte l'empreinte de son modèle sur sa deuxième ligne, après #!, et reste exécutable", () => {
  const texte = texteDeCopie("verifier");
  const lignes = texte.split("\n");
  assert.strictEqual(lignes[0], "#!/usr/bin/env node");
  assert.match(lignes[1], /^\/\/ pulse-copie: [0-9a-f]{16}$/);
  assert.strictEqual(lignes.slice(2).join("\n"), fs.readFileSync(MODELE, "utf8").split("\n").slice(1).join("\n"));
  const d = dossier();
  copier("verifier", path.join(d, "scripts", "verifier.js"));
  const r = spawnSync(process.execPath, [path.join(d, "scripts", "verifier.js")], { cwd: d, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
});

test("états : à jour, ancienne (intacte), adaptée, absente ; une copie sans empreinte se compare au modèle", () => {
  const d = dossier();
  const f = path.join(d, "scripts", "verifier.js");
  assert.strictEqual(etatDe("verifier", f), "absente");
  copier("verifier", f);
  assert.strictEqual(etatDe("verifier", f), "a-jour");
  // Une copie intacte d'un modèle plus ancien : son corps correspond à sa propre empreinte, pas à celle du modèle actuel.
  const ancien = "#!/usr/bin/env node\n// ancienne version\nconsole.log('ok');\n";
  const corps = ancien;
  fs.writeFileSync(f, ancien.replace("\n", `\n// pulse-copie: ${empreinte(corps)}\n`));
  assert.strictEqual(etatDe("verifier", f), "ancienne");
  fs.appendFileSync(f, "// une règle à moi\n");
  assert.strictEqual(etatDe("verifier", f), "adaptee");
  fs.copyFileSync(MODELE, f);
  assert.strictEqual(etatDe("verifier", f), "a-jour", "sans empreinte, identique au modèle");
  fs.writeFileSync(f, "// autre\n");
  assert.strictEqual(etatDe("verifier", f), "adaptee", "sans empreinte, différente du modèle");
});

test("--mettre-a-jour remplace seulement les copies anciennes et intactes", () => {
  const d = dossier();
  const f = path.join(d, "scripts", "verifier.js");
  const ancien = "#!/usr/bin/env node\nconsole.log('ancien');\n";
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, ancien.replace("\n", `\n// pulse-copie: ${empreinte(ancien)}\n`));
  const ligne = path.join(d, ".claude", "pulse-ligne-etat.js");
  fs.mkdirSync(path.dirname(ligne), { recursive: true });
  fs.writeFileSync(ligne, "// adaptée à la main\n");
  assert.match(lancer(d).stdout, /^verifier: ancienne · scripts\/verifier\.js$/m);
  const r = lancer(d, "--mettre-a-jour").stdout;
  assert.match(r, /^verifier: mise-a-jour · scripts\/verifier\.js$/m);
  assert.match(r, /^ligne-etat: adaptee · \.claude\/pulse-ligne-etat\.js$/m);
  assert.strictEqual(etatDe("verifier", f), "a-jour");
  assert.strictEqual(fs.readFileSync(ligne, "utf8"), "// adaptée à la main\n");
});

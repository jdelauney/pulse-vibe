// Tests de l'extraction d'identité sans invention (skills/ui/scripts/identite.js).
// Lancer : node --test plugins/pulse-vibe/tests/identite.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "skills", "ui", "scripts", "identite.js");

const projet = (fichiers) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-identite-"));
  for (const [f, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), contenu);
  }
  return d;
};
const lancer = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

test("extraire : couleurs, polices et rayons relevés avec fichier:ligne, node_modules ignoré", () => {
  const d = projet({
    "app/globals.css": ":root {\n  --primary: oklch(0.55 0.2 250);\n  border-radius: 8px;\n  font-family: \"Literata\", serif;\n  color: #1a2b3c;\n}\n.b { color: #1a2b3c; }\n",
    "app/layout.tsx": "import { Literata, Space_Mono } from \"next/font/google\";\n",
    "node_modules/x/a.css": ".x { color: #ff0000; font-family: Comic; }\n",
  });
  const r = lancer("extraire", d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /--primary : oklch\(0\.55 0\.2 250\)\s+app\/globals\.css:2/);
  assert.match(r.stdout, /#1a2b3c \(2 fois\)\s+app\/globals\.css:5, app\/globals\.css:7/);
  assert.match(r.stdout, /border-radius : 8px\s+app\/globals\.css:3/);
  assert.match(r.stdout, /Literata \(2 fois\)\s+app\/globals\.css:4, app\/layout\.tsx:1/);
  assert.match(r.stdout, /Space Mono\s+app\/layout\.tsx:1/);
  assert.ok(!/ff0000|Comic/.test(r.stdout), "node_modules ignoré");
});

test("extraire : un dossier sans interface donne « non trouvé » pour chaque catégorie", () => {
  const r = lancer("extraire", projet({ "README.md": "rien\n" }));
  assert.strictEqual(r.status, 0);
  assert.strictEqual((r.stdout.match(/non trouvé/g) || []).length, 3, r.stdout);
});

test("extraire --json : structure lisible ; dossier absent : code 2", () => {
  const d = projet({ "a.css": ".a { border-radius: 4px; }\n" });
  const j = JSON.parse(lancer("extraire", d, "--json").stdout);
  assert.deepStrictEqual(Object.keys(j).sort(), ["couleurs", "ignores", "polices", "rayons"]);
  assert.strictEqual(j.rayons[0].valeur, "border-radius : 4px");
  assert.deepStrictEqual(j.rayons[0].lieux, ["a.css:1"]);
  assert.strictEqual(lancer("extraire", path.join(d, "absent")).status, 2);
});

test("revue : variable sur la ligne de :root, classes Tailwind, polices de tailwind.config, fichier trop gros signalé", () => {
  const d = projet({
    "app/a.css": ":root { --primary: oklch(0.5 0.1 30); }\n",
    "app/page.tsx": "export default () => <p className=\"bg-indigo-600 text-[#123456]\">x</p>;\n",
    "tailwind.config.ts": "export default { theme: { fontFamily: { titre: [\"Fraunces\", \"serif\"] } } };\n",
    "app/gros.css": "a{}\n".repeat(300000),
  });
  const r = lancer("extraire", d);
  assert.match(r.stdout, /--primary : oklch\(0\.5 0\.1 30\)\s+app\/a\.css:1/);
  assert.match(r.stdout, /indigo-600 \(classe Tailwind\)\s+app\/page\.tsx:1/);
  assert.match(r.stdout, /#123456\s+app\/page\.tsx:1/);
  assert.match(r.stdout, /Fraunces\s+tailwind\.config\.ts:1/);
  assert.match(r.stdout, /Ignoré \(plus de 1 Mo\) : app\/gros\.css/);
});

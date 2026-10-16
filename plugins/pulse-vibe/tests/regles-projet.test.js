// Tests du contrôle 4 de templates/verifier.js : les règles du projet qui portent un contrôle
// (aidd_docs/memory/technical.md, « - <règle> — Contrôle : interdit|obligatoire `motif` dans `portée` »).
// Lancer : node --test plugins/pulse-vibe/tests/regles-projet.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const VERIFIER = path.join(__dirname, "..", "templates", "verifier.js");
const sansGit = spawnSync("git", ["--version"]).error ? "git absent" : false;

const MEMOIRE = (regles) => `# Mémoire technique

## Conventions propres au projet

${regles.join("\n")}
`;

function projet(fichiers) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-regles-"));
  for (const [f, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), contenu);
  }
  return d;
}
const lancer = (d, ...args) => spawnSync(process.execPath, [VERIFIER, ...args], { cwd: d, encoding: "utf8" });
const git = (d, ...args) => spawnSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args], { cwd: d, encoding: "utf8" });

test("motif interdit dans un dossier : le fichier fautif est cité avec la règle", () => {
  const d = projet({
    "aidd_docs/memory/technical.md": MEMOIRE(["- Les montants s'écrivent en centimes. — Contrôle : interdit `parseFloat(` dans `src/prix/`"]),
    "src/prix/total.js": "const t = parseFloat(x);\n",
    "src/autre.js": "parseFloat(y);\n",
  });
  const r = lancer(d);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /src\/prix\/total\.js : enfreint la règle du projet « Les montants s'écrivent en centimes\. » \(parseFloat\( est interdit ici\)/);
  assert.doesNotMatch(r.stderr, /src\/autre\.js/, "hors de la portée");
  assert.match(r.stderr, /lignes « Contrôle : … »/);
  assert.doesNotMatch(r.stderr, /révoquez-la/, "pas de conseil sur les clés sans clé trouvée");
});

test("motif obligatoire, portée avec ** et motif en expression régulière", () => {
  const d = projet({
    "aidd_docs/memory/technical.md": MEMOIRE(["- Chaque page déclare son titre. — Contrôle : obligatoire `/export const metadata\\b/` dans `app/**/page.tsx`"]),
    "app/page.tsx": "export const metadata = {};\n",
    "app/compte/page.tsx": "export default function P() {}\n",
    "app/compte/bouton.tsx": "export default function B() {}\n",
  });
  const r = lancer(d);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /app\/compte\/page\.tsx : la règle du projet « Chaque page déclare son titre\. » demande/);
  assert.doesNotMatch(r.stderr, /app\/page\.tsx :|bouton\.tsx/);
});

test("règles respectées, ligne sans contrôle, mémoire absente : la vérification passe", () => {
  const ok = projet({
    "aidd_docs/memory/technical.md": MEMOIRE(["- Les dates sont en ISO.", "- Pas de console.log. — Contrôle : interdit `console.log(` dans `*.js`"]),
    "src/a.js": "console.info('x');\n",
  });
  assert.strictEqual(lancer(ok).status, 0, lancer(ok).stderr);
  assert.strictEqual(lancer(projet({ "src/a.js": "x\n" })).status, 0);
  // La mémoire elle-même cite le motif : elle n'est pas contrôlée.
  const cite = projet({ "aidd_docs/memory/technical.md": MEMOIRE(["- Pas de console.log. — Contrôle : interdit `console.log(` dans `*.md`"]) });
  assert.strictEqual(lancer(cite).status, 0);
  // Une portée en *.js vaut dans tous les dossiers.
  const profond = projet({ "aidd_docs/memory/technical.md": MEMOIRE(["- Pas de console.log. — Contrôle : interdit `console.log(` dans `*.js`"]), "src/x/y.js": "console.log(1)\n" });
  assert.match(lancer(profond).stderr, /src\/x\/y\.js : enfreint/);
});

test("avant commit (--index) : seuls les fichiers prêts à être enregistrés, message propre aux règles", { skip: sansGit }, () => {
  const d = projet({
    "aidd_docs/memory/technical.md": MEMOIRE(["- Les montants s'écrivent en centimes. — Contrôle : interdit `parseFloat(` dans `src/`"]),
    "src/ancien.js": "parseFloat(1);\n",
  });
  git(d, "init", "-q");
  git(d, "add", "aidd_docs");
  git(d, "commit", "-q", "-m", "init");
  fs.writeFileSync(path.join(d, "src", "neuf.js"), "parseFloat(2);\n");
  git(d, "add", "src/neuf.js");
  const r = lancer(d, "--index");
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /Commit annulé : une règle du projet n'est pas respectée/);
  assert.match(r.stderr, /src\/neuf\.js : enfreint/);
  assert.doesNotMatch(r.stderr, /ancien\.js/, "fichier non préparé : hors du contrôle avant commit");
});

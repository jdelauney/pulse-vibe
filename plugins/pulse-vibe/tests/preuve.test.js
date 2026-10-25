// Tests de `pulse-aidd preuve` (scripts/preuve.js) : un lancement réel des tests et contrôles, lié au contenu des fichiers.
// Lancer : node --test plugins/pulse-vibe/tests/preuve.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const SCRIPT = path.join(RACINE, "scripts", "preuve.js");
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-preuve-"));
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));

const git = (d, ...args) => {
  const r = spawnSync("git", args, { cwd: d, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout;
};
const ecrire = (d, f, contenu) => {
  fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
  fs.writeFileSync(path.join(d, f), contenu);
};

// Commandes factices : chacune note son lancement dans le dossier « traces » (hors du dépôt).
const SCRIPTS = {
  "tests.js": `const n = process.argv.length - 2 || 3; require("fs").appendFileSync(process.env.PREUVE_TRACES + "/tests", process.argv.slice(2).join(" ") + "\\n"); console.log("# tests " + n + "\\n# pass " + n);`,
  "lint.js": `require("fs").appendFileSync(process.env.PREUVE_TRACES + "/lint", "x\\n");`,
  "build.js": `require("fs").appendFileSync(process.env.PREUVE_TRACES + "/build", "x\\n");`,
  "echec.js": `for (let i = 1; i <= 50; i++) console.log("ligne " + i); process.exit(1);`,
  "marque.js": `require("fs").appendFileSync(process.env.PREUVE_TRACES + "/marque", "x\\n");`,
  "reset.js": `require("fs").appendFileSync(process.env.PREUVE_TRACES + "/reset", "x\\n");`,
  "e2e.js": `require("fs").appendFileSync(process.env.PREUVE_TRACES + "/e2e", "x\\n"); console.log("# tests 1\\n# pass 1");`,
  "rapport.js": `require("fs").writeFileSync("rapport.xml", String(Date.now())); console.log("# tests 2\\n# pass 2");`,
  "vide.js": `console.log("# tests 0\\n# pass 0");`,
  "sans-essais.js": `console.log("No test files found, exiting with code 1"); process.exit(1);`,
  "build-ecrit.js": `require("fs").writeFileSync("sortie.txt", String(Date.now()));`,
  "env.js": `if (!require("fs").existsSync("ignore/env.txt")) { console.log("variable manquante : ignore/env.txt"); process.exit(1); } console.log("# tests 2\\n# pass 2");`,
  "attend.js": `require("fs").appendFileSync(process.env.PREUVE_TRACES + "/attend", "x\\n"); setTimeout(() => require("fs").appendFileSync(process.env.PREUVE_TRACES + "/fin", "x\\n"), 4000);`,
};
const TECHNIQUE = {
  tester: "`node tests.js` (bout en bout : `node e2e.js`)",
  controles: "`node lint.js` et `node marque.js --write` (corriger le format : `node marque.js --write`)",
  construire: "`node build.js`",
};
const technique = ({ tester, controles, construire } = TECHNIQUE) =>
  "# Technique\n\n## Commandes du projet\n\n| Action | Commande |\n|---|---|\n| Lancer en local | `node serveur.js` |\n" +
  `| Tester | ${tester} |\n| Contrôles automatiques (lint, format, types) | ${controles} |\n| Construire | ${construire} |\n\n## Autre\n`;

let n = 0;
function depot(commandes = TECHNIQUE) {
  const d = path.join(BASE, `depot-${++n}`);
  fs.mkdirSync(d);
  git(d, "init", "-q");
  git(d, "config", "user.email", "test@example.com");
  git(d, "config", "user.name", "Test");
  git(d, "config", "core.autocrlf", "false");
  ecrire(d, ".gitignore", "ignore/\n*.log\n");
  ecrire(d, "src/a.js", "module.exports = 1;\n");
  for (const [f, code] of Object.entries(SCRIPTS)) ecrire(d, f, code + "\n");
  ecrire(d, "docs/technical.md", technique({ ...TECHNIQUE, ...commandes }));
  ecrire(d, "aidd_docs/memory/technical.md", "# Mémoire\n");
  git(d, "add", "--", ".");
  git(d, "commit", "-q", "-m", "départ");
  const traces = path.join(BASE, `traces-${n}`);
  fs.mkdirSync(traces);
  return { d, traces };
}
const preuve = ({ d, traces }, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: d, encoding: "utf8", env: { ...process.env, PREUVE_TRACES: traces } });
const lance = (traces, nom) => fs.existsSync(path.join(traces, nom));
const fichierPreuve = (d) => path.resolve(d, git(d, "rev-parse", "--git-path", "pulse-preuve.json").trim());

test("lancer puis etat : à jour ; la ligne résume contrôles, tests et portée ; le fichier garde codes, durées, empreinte et portée", () => {
  const p = depot();
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests 3\/3 ✅ \(suite, \d+ s\) · à l'instant$/m);
  assert.ok(lance(p.traces, "lint") && lance(p.traces, "tests"), "contrôles et tests lancés");
  assert.ok(!lance(p.traces, "build"), "construction lancée seulement avec --construire");
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 0, e.stdout);
  assert.match(e.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests 3\/3 ✅ \(suite, \d+ s\) · à l'instant$/m);
  const enregistree = JSON.parse(fs.readFileSync(fichierPreuve(p.d), "utf8"));
  assert.strictEqual(enregistree.portee, "suite");
  assert.match(enregistree.empreinte, /^[0-9a-f]{64}$/);
  for (const c of enregistree.resultats) {
    assert.strictEqual(c.code, 0, c.commande);
    assert.strictEqual(typeof c.duree, "number", c.commande);
  }
  assert.deepStrictEqual(enregistree.resultats.map((c) => c.commande), ["node lint.js", "node tests.js"]);
  assert.strictEqual(git(p.d, "status", "--porcelain"), "", "le fichier de preuve reste hors du dossier de travail");
});

test("fichier suivi modifié : périmée, et le fichier est nommé", () => {
  const p = depot();
  assert.strictEqual(preuve(p, "lancer").status, 0);
  ecrire(p.d, "src/a.js", "module.exports = 2;\n");
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /^preuve: périmée \(fichiers modifiés depuis : src\/a\.js\) ; relancez : pulse-aidd preuve lancer --portee suite \(outil Bash : timeout 600000\)$/m);
});

test("fichier non suivi et non ignoré créé : périmée", () => {
  const p = depot();
  assert.strictEqual(preuve(p, "lancer").status, 0);
  ecrire(p.d, "src/b.js", "module.exports = 3;\n");
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /périmée \(fichiers modifiés depuis : src\/b\.js\)/);
});

test("fichier ignoré modifié ou créé : à jour", () => {
  const p = depot();
  assert.strictEqual(preuve(p, "lancer").status, 0);
  ecrire(p.d, "ignore/cache.txt", "x\n");
  ecrire(p.d, "journal.log", "x\n");
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 0, e.stdout);
  assert.match(e.stdout, /^preuve: ✅ à jour/m);
});

test("seulement docs/ ou aidd_docs/ modifiés (rapport, journal) : à jour", () => {
  const p = depot();
  assert.strictEqual(preuve(p, "lancer").status, 0);
  ecrire(p.d, "docs/x.md", "# Rapport\n");
  ecrire(p.d, "aidd_docs/memory/technical.md", "# Mémoire modifiée\n");
  ecrire(p.d, "aidd_docs/tasks/e/revue.md", "# Revue\n");
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 0, e.stdout);
  assert.match(e.stdout, /^preuve: ✅ à jour/m);
});

test("un commit sans changement de contenu : à jour", () => {
  const p = depot();
  ecrire(p.d, "src/a.js", "module.exports = 2;\n");
  assert.strictEqual(preuve(p, "lancer").status, 0);
  git(p.d, "add", "--", "src/a.js");
  git(p.d, "commit", "-q", "-m", "travail");
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 0, e.stdout);
  assert.match(e.stdout, /^preuve: ✅ à jour/m);
});

test("--portee tache : les fichiers de test donnés ; etat --exiger suite : portée insuffisante", () => {
  const p = depot();
  const r = preuve(p, "lancer", "--portee", "tache", "src/a.test.js", "src/b.test.js");
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /tests 2\/2 ✅ \(tâche, \d+ s\)/);
  assert.strictEqual(fs.readFileSync(path.join(p.traces, "tests"), "utf8").trim(), "src/a.test.js src/b.test.js");
  assert.strictEqual(preuve(p, "etat").status, 0);
  const e = preuve(p, "etat", "--exiger", "suite");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /^preuve: portée insuffisante \(/m);
});

test("--exiger construction sans --construire : insuffisante ; avec --construire : à jour", () => {
  const p = depot();
  assert.strictEqual(preuve(p, "lancer").status, 0);
  const sans = preuve(p, "etat", "--exiger", "construction");
  assert.strictEqual(sans.status, 1);
  assert.match(sans.stdout, /^preuve: portée insuffisante \(/m);
  const r = preuve(p, "lancer", "--portee", "suite", "--construire");
  assert.strictEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests 3\/3 ✅ \(suite, \d+ s\) · construction ✅ · à l'instant$/m);
  assert.ok(lance(p.traces, "build"));
  const avec = preuve(p, "etat", "--exiger", "suite", "--exiger", "construction");
  assert.strictEqual(avec.status, 0, avec.stdout);
});

test("construire : ajoute la construction à une preuve à jour sans relancer contrôles ni tests", () => {
  const p = depot();
  assert.strictEqual(preuve(p, "lancer", "--portee", "suite").status, 0);
  fs.rmSync(path.join(p.traces, "tests"));
  fs.rmSync(path.join(p.traces, "lint"));
  const r = preuve(p, "construire");
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests 3\/3 ✅ \(suite, \d+ s\) · construction ✅ · /m);
  assert.ok(lance(p.traces, "build"), "construction lancée");
  assert.ok(!lance(p.traces, "tests") && !lance(p.traces, "lint"), "ni tests ni contrôles relancés");
  const e = preuve(p, "etat", "--exiger", "suite", "--exiger", "construction");
  assert.strictEqual(e.status, 0, e.stdout);
});

test("construire : construction en échec, ❌ code 1 ; sans preuve à jour, code 2 et rien n'est lancé", () => {
  const p = depot({ construire: "`node echec.js`" });
  const sans = preuve(p, "construire");
  assert.strictEqual(sans.status, 2, sans.stdout);
  assert.match(sans.stdout, /rien n'a été lancé/);
  assert.strictEqual(preuve(p, "lancer").status, 0);
  ecrire(p.d, "src/a.js", "module.exports = 2;\n");
  const perimee = preuve(p, "construire");
  assert.strictEqual(perimee.status, 2, "preuve périmée : refus");
  assert.match(perimee.stdout, /pulse-aidd preuve lancer --portee suite --construire/);
  assert.strictEqual(preuve(p, "lancer").status, 0);
  const r = preuve(p, "construire");
  assert.strictEqual(r.status, 1, r.stdout);
  assert.match(r.stdout, /^preuve: ❌ à jour · .*construction ❌/m);
  assert.strictEqual(preuve(p, "etat", "--exiger", "construction").status, 1);
});

test("aucune preuve : aucune, code 1", () => {
  const p = depot();
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /^preuve: aucune\b/m);
});

test("dossier de travail à part (git worktree) : sa propre preuve", () => {
  const p = depot();
  assert.strictEqual(preuve(p, "lancer").status, 0);
  const wt = path.join(BASE, `wt-${n}`);
  git(p.d, "worktree", "add", "-q", "-b", "autre", wt);
  const ailleurs = { d: wt, traces: p.traces };
  const e = preuve(ailleurs, "etat");
  assert.strictEqual(e.status, 1, e.stdout);
  assert.match(e.stdout, /^preuve: aucune\b/m);
  assert.strictEqual(preuve(ailleurs, "lancer").status, 0);
  assert.notStrictEqual(fichierPreuve(wt), fichierPreuve(p.d));
  assert.ok(fs.existsSync(fichierPreuve(wt)) && fs.existsSync(fichierPreuve(p.d)));
  ecrire(wt, "src/a.js", "module.exports = 9;\n");
  assert.strictEqual(preuve(ailleurs, "etat").status, 1, "le dossier à part a changé");
  assert.strictEqual(preuve(p, "etat").status, 0, "le dossier principal reste à jour");
});

test("commande en échec : ❌, code 1, les 30 dernières lignes ; etat garde le ❌, ses lignes et le code 1", () => {
  const p = depot({ tester: "`node echec.js`" });
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 1, r.stdout);
  assert.match(r.stdout, /^preuve: ❌ à jour · contrôles ✅ · tests ❌ \(suite, \d+ s\) · à l'instant$/m);
  assert.match(r.stdout, /`node echec\.js`.*code 1/);
  assert.match(r.stdout, /^ligne 21$/m);
  assert.match(r.stdout, /^ligne 50$/m);
  assert.doesNotMatch(r.stdout, /^ligne 20$/m);
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 1, "à jour mais rouge : code 1");
  assert.match(e.stdout, /^preuve: ❌ à jour/m);
  assert.match(e.stdout, /^ligne 50$/m);
});

test("commande qui réécrit (formatage) : jamais lancée ; commande qui installe ou efface : non lancée, preuve ❌ avec sa raison", () => {
  const p = depot({ controles: "`node lint.js`, `node marque.js --write`, `node marque.js format`, `npm run lint:fix` et `node reset.js`" });
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 1, r.stdout);
  assert.match(r.stdout, /^preuve: ❌ à jour · contrôles ❌ · tests 3\/3 ✅ \(suite, \d+ s\)/m);
  assert.ok(lance(p.traces, "lint"));
  assert.ok(!lance(p.traces, "marque"), "le formatage n'est jamais lancé");
  assert.ok(!lance(p.traces, "reset"), "une commande hors des autorisations n'est pas lancée");
  assert.match(r.stdout, /^❌ contrôle non lancé : `node reset\.js` installe, envoie, migre ou efface/m);
  assert.doesNotMatch(r.stdout, /marque/);
  assert.strictEqual(preuve(p, "etat").status, 1);
});

test("commande qui enchaîne plusieurs commandes : non lancée, ❌ avec sa raison, code 1", () => {
  const p = depot({ controles: "`node lint.js && node lint.js`" });
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 1, r.stdout);
  assert.match(r.stdout, /^preuve: ❌ à jour · contrôles ❌ · /m);
  assert.match(r.stdout, /^❌ contrôle non lancé : `node lint\.js && node lint\.js` enchaîne plusieurs commandes/m);
  assert.ok(!lance(p.traces, "lint"));
});

test("« Tester » : aucune (choix du projet) ; la ligne de bout en bout n'est jamais prise pour la suite ; --exiger suite : satisfaite, contrôles et construction toujours exigés", () => {
  const p = depot();
  ecrire(
    p.d,
    "docs/technical.md",
    "# Technique\n\n## Commandes du projet\n\n| Action | Commande |\n|---|---|\n| Tester | aucune |\n| Tester de bout en bout (navigateur) | `node e2e.js` |\n| Contrôles automatiques | `node lint.js` |\n",
  );
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /^preuve: ✅ à jour · contrôles ✅ · suite : aucune \(choix du projet, docs\/technical\.md\) · à l'instant$/m);
  assert.ok(!lance(p.traces, "e2e"), "les tests de bout en bout ne sont pas la suite");
  assert.strictEqual(preuve(p, "etat").status, 0);
  const e = preuve(p, "etat", "--exiger", "suite");
  assert.strictEqual(e.status, 0, e.stdout);
  assert.match(e.stdout, /^preuve: ✅ à jour · contrôles ✅ · suite : aucune \(choix du projet, docs\/technical\.md\)/m);
  assert.strictEqual(preuve(p, "etat", "--exiger", "suite", "--exiger", "construction").status, 1, "la construction reste exigée");
  ecrire(p.d, "docs/technical.md", "# Technique\n\n## Commandes du projet\n\n| Action | Commande |\n|---|---|\n| Tester | aucune |\n| Contrôles automatiques | `node echec.js` |\n");
  const rouge = preuve(p, "lancer");
  assert.strictEqual(rouge.status, 1, "un contrôle rouge reste rouge");
  assert.strictEqual(preuve(p, "etat", "--exiger", "suite").status, 1, "suite aucune : les contrôles restent exigés");
  const tache = preuve(p, "lancer", "--portee", "tache", "src/a.test.js");
  assert.ok(!lance(p.traces, "e2e"), "ni en portée tâche");
  assert.match(tache.stdout, /suite : aucune/);
});

/** Un dépôt dont « Tester » ne trouve aucun test, avec un fichier de test suivi. */
function depotAvecFichierDeTest() {
  const p = depot({ tester: "`node vide.js`" });
  ecrire(p.d, "src/a.test.js", "// test\n");
  git(p.d, "add", "--", "src/a.test.js");
  git(p.d, "commit", "-q", "-m", "un test");
  return p;
}

test("aucun test trouvé (0 test lancé) alors que des fichiers de test existent : ❌, code 1", () => {
  const p = depotAvecFichierDeTest();
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 1, r.stdout);
  assert.match(r.stdout, /tests 0\/0 ❌ \(suite, \d+ s\) \(aucun test trouvé\)/);
});

test("fichier non ignoré écrit par les tests : l'empreinte est prise après le lancement, la preuve reste à jour", () => {
  const p = depot({ tester: "`node rapport.js`" });
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /rapport\.xml/, "le fichier écrit est signalé");
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 0, e.stdout);
});

test("tableau sans | final, espaces en tête : lu pareil par la preuve et par pulse-aidd autorisations", () => {
  const p = depot();
  ecrire(p.d, "docs/technical.md", "# Technique\n\n## Commandes du projet\n\n| Action | Commande |\n|---|---|\n  | Tester | `node tests.js`\n| Contrôles automatiques | `node lint.js`   \n");
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 0, r.stdout);
  assert.ok(lance(p.traces, "tests") && lance(p.traces, "lint"));
  const { commandesDuProjet } = require("../scripts/autorisations");
  assert.deepStrictEqual(commandesDuProjet(p.d).sort(), ["node lint.js", "node tests.js"]);
});

test("commandes du projet changées (docs/technical.md) : périmée", () => {
  const p = depot();
  assert.strictEqual(preuve(p, "lancer").status, 0);
  ecrire(p.d, "docs/technical.md", technique({ ...TECHNIQUE, tester: "`node vide.js`" }));
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /périmée \(fichiers modifiés depuis : docs\/technical\.md\)/);
});

test("renommage, suppression, noms avec espace, accent ou idéogrammes : périmée et nommés", () => {
  const p = depot();
  ecrire(p.d, "src/mon fichier é.js", "1\n");
  ecrire(p.d, "src/日本.js", "1\n");
  git(p.d, "add", "--", ".");
  git(p.d, "commit", "-q", "-m", "noms");
  assert.strictEqual(preuve(p, "lancer").status, 0);
  assert.strictEqual(preuve(p, "etat").status, 0, "noms particuliers : à jour");
  git(p.d, "mv", "src/a.js", "src/c.js");
  let e = preuve(p, "etat");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /fichiers modifiés depuis : src\/a\.js, src\/c\.js\)/);
  git(p.d, "mv", "src/c.js", "src/a.js");
  assert.strictEqual(preuve(p, "etat").status, 0, "renommage défait : à jour");
  fs.unlinkSync(path.join(p.d, "src", "日本.js"));
  e = preuve(p, "etat");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /fichiers modifiés depuis : src\/日本\.js\)/);
  git(p.d, "checkout", "--", "src/日本.js");
  ecrire(p.d, "src/mon fichier é.js", "2\n");
  e = preuve(p, "etat");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /fichiers modifiés depuis : src\/mon fichier é\.js\)/);
});

test("fins de ligne CRLF avec core.autocrlf : à jour tant que le contenu ne change pas", () => {
  const p = depot();
  git(p.d, "config", "core.autocrlf", "true");
  ecrire(p.d, "src/crlf.js", "a\r\nb\r\n");
  assert.strictEqual(preuve(p, "lancer").status, 0);
  git(p.d, "add", "--", "src/crlf.js");
  assert.strictEqual(preuve(p, "etat").status, 0, "ajouté à l'index (en LF) : à jour");
  git(p.d, "commit", "-q", "-m", "crlf");
  assert.strictEqual(preuve(p, "etat").status, 0, "commité : à jour");
  ecrire(p.d, "src/a.js", "module.exports = 1;\r\n");
  assert.strictEqual(preuve(p, "etat").status, 0, "copie de travail passée en CRLF : à jour");
});

test("fichiers de test refusés (.., chemin absolu, lecteur, option) : code 2, rien n'est lancé ; options inconnues : code 1", () => {
  const p = depot();
  for (const f of ["../x.test.js", "/tmp/x.test.js", "C:/x.test.js", "src/a b.test.js", "-r"]) {
    const r = preuve(p, "lancer", "--portee", "tache", f);
    assert.strictEqual(r.status, 2, `${f} : ${r.stdout}`);
  }
  assert.ok(!lance(p.traces, "tests") && !lance(p.traces, "lint"));
  assert.ok(!fs.existsSync(fichierPreuve(p.d)));
  assert.strictEqual(preuve(p, "lancer", "--portee", "autre").status, 1);
  assert.strictEqual(preuve(p, "etat", "--exiger", "autre").status, 1);
  assert.strictEqual(preuve(p).status, 1);
});

test("relais : pulse-aidd preuve etat", () => {
  const p = depot();
  const outil = path.join(RACINE, "bin", "pulse-aidd").split(path.sep).join("/");
  const r = spawnSync("bash", ["-c", `exec bash "${outil}" "$@"`, "preuve", "preuve", "etat"], { cwd: p.d, encoding: "utf8" });
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^preuve: aucune\b/m);
});

test("etat indique la suite à donner : relance seulement pour périmée, aucune ou portée insuffisante ; rouge à jour = échecs à corriger", () => {
  const p = depot();
  const aucune = preuve(p, "etat", "--exiger", "suite", "--exiger", "construction");
  assert.match(aucune.stdout, /relancez : pulse-aidd preuve lancer --portee suite --construire/, "aucune : relance avec la construction demandée");
  assert.strictEqual(preuve(p, "lancer", "--portee", "tache", "src/a.test.js").status, 0);
  assert.match(preuve(p, "etat", "--exiger", "suite").stdout, /portée insuffisante[^\n]*relancez : pulse-aidd preuve lancer --portee suite \(outil Bash : timeout 600000\)$/m);
  assert.strictEqual(preuve(p, "lancer").status, 0);
  assert.match(preuve(p, "etat", "--exiger", "construction").stdout, /portée insuffisante[^\n]*ajoutez-la : pulse-aidd preuve construire/, "seule la construction manque");
  ecrire(p.d, "src/a.js", "module.exports = 3;\n");
  assert.match(preuve(p, "etat").stdout, /périmée[^\n]*relancez : pulse-aidd preuve lancer --portee suite/);
  const rouge = depot({ controles: "`node echec.js`" });
  preuve(rouge, "lancer");
  const e = preuve(rouge, "etat", "--exiger", "suite");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /^Échecs à corriger\. Cause hors des fichiers \(service à démarrer, variable, outil, délai dépassé\), une fois réparée : relancez : pulse-aidd preuve lancer --portee suite \(outil Bash : timeout 600000\)\.$/m);
  assert.doesNotMatch(e.stdout, /^preuve: [^\n]*relancez/m, "la ligne de la preuve reste celle d'une preuve rouge");
});

test("aucun test trouvé alors que des fichiers de test existent : ❌ à corriger dans docs/technical.md, sans proposer « aucune »", () => {
  const p = depotAvecFichierDeTest();
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /la commande « Tester » de docs\/technical\.md ne lance aucun test, alors que le projet a des fichiers de test \(src\/a\.test\.js\) : corrigez-la\./);
  assert.doesNotMatch(r.stdout, /écrivez « aucune »/, "les tests du projet restent");
});

test("aucun test trouvé et aucun fichier de test (outil installé, aucun test écrit) : non bloquant, la ligne le dit", () => {
  const p = depot({ tester: "`node vide.js`" });
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests : aucun test écrit pour l'instant · /m);
  assert.doesNotMatch(r.stdout, /écrivez « aucune »/);
  assert.strictEqual(preuve(p, "etat", "--exiger", "suite").status, 0);
  ecrire(p.d, "tests/premier.js", "// test non suivi, non ignoré\n");
  assert.strictEqual(preuve(p, "lancer").status, 1, "un fichier de test non suivi compte aussi");
});

const sansTester = (lignes) => "# Technique\n\n## Commandes du projet\n\n| Action | Commande |\n|---|---|\n" + lignes + "| Contrôles automatiques | `node lint.js` |\n";

test("« Tester » sans accents graves : la cellule est la commande, lancée comme les autres", () => {
  const p = depot();
  ecrire(p.d, "docs/technical.md", sansTester("| Tester | node tests.js |\n"));
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /tests 3\/3 ✅ \(suite, \d+ s\)/);
  assert.ok(lance(p.traces, "tests"), "la commande sans accents graves est lancée");
  assert.strictEqual(preuve(p, "etat", "--exiger", "suite").status, 0);
});

test("ligne « Tester » absente ou vide : ❌, code 1, jamais prise pour « aucune »", () => {
  for (const lignes of ["", "| Tester |  |\n"]) {
    const p = depot();
    ecrire(p.d, "docs/technical.md", sansTester(lignes));
    const r = preuve(p, "lancer");
    assert.strictEqual(r.status, 1, r.stdout);
    assert.match(r.stdout, /ligne « Tester » absente de docs\/technical\.md/);
    assert.doesNotMatch(r.stdout, /choix du projet/);
    assert.strictEqual(preuve(p, "etat", "--exiger", "suite").status, 1);
  }
});

test("preuve rouge : etat --exiger construction dit les échecs avant la construction ; construire la refuse (code 2)", () => {
  const p = depot({ controles: "`node echec.js`" });
  assert.strictEqual(preuve(p, "lancer").status, 1);
  const e = preuve(p, "etat", "--exiger", "construction");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /Échecs à corriger/);
  assert.doesNotMatch(e.stdout, /ajoutez-la/);
  const c = preuve(p, "construire");
  assert.strictEqual(c.status, 2, c.stdout);
  assert.match(c.stdout, /échecs à corriger d'abord ; rien n'a été lancé/);
  assert.ok(!lance(p.traces, "build"));
});

test("construire : un fichier compté écrit par la construction est signalé, la preuve devient périmée", () => {
  const p = depot({ construire: "`node build-ecrit.js`" });
  assert.strictEqual(preuve(p, "lancer").status, 0);
  const c = preuve(p, "construire");
  assert.match(c.stdout, /Fichiers écrits pendant la construction : sortie\.txt/);
  assert.match(preuve(p, "etat").stdout, /^preuve: périmée/m);
});

test("--portee tache sans fichier (tâche sans test, filet limité) : contrôles seuls, aucun test lancé", () => {
  const p = depot();
  const r = preuve(p, "lancer", "--portee", "tache");
  assert.strictEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /tests : aucun fichier de test pour cette tâche/);
  assert.ok(lance(p.traces, "lint") && !lance(p.traces, "tests"));
  assert.strictEqual(preuve(p, "etat").status, 0);
  assert.strictEqual(preuve(p, "etat", "--exiger", "suite").status, 1);
});

test("cellule « — » : vaut « aucune » ; plusieurs commandes dans une cellule sans accents graves, ou « $( » : non lancées, ❌ avec une raison claire", () => {
  const p = depot();
  ecrire(p.d, "docs/technical.md", sansTester("| Tester | — |\n"));
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /suite : aucune \(choix du projet/);
  assert.doesNotMatch(r.stdout, /`—`/, "« — » n'est jamais lancé comme une commande");
  const plusieurs = depot();
  ecrire(plusieurs.d, "docs/technical.md", "# Technique\n\n## Commandes du projet\n\n| Action | Commande |\n|---|---|\n| Tester | `node tests.js` |\n| Contrôles automatiques | node lint.js et node marque.js |\n");
  const rp = preuve(plusieurs, "lancer");
  assert.strictEqual(rp.status, 1, rp.stdout);
  assert.match(rp.stdout, /^❌ contrôle non lancé : `node lint\.js et node marque\.js` plusieurs commandes dans une cellule : écrivez une commande par cellule, entre accents graves/m);
  assert.ok(!lance(plusieurs.traces, "lint") && !lance(plusieurs.traces, "marque"));
  const substitution = depot();
  ecrire(substitution.d, "docs/technical.md", "# Technique\n\n## Commandes du projet\n\n| Action | Commande |\n|---|---|\n| Tester | node tests.js $(node marque.js) |\n| Contrôles automatiques | `node lint.js` |\n");
  const rs = preuve(substitution, "lancer");
  assert.strictEqual(rs.status, 1, rs.stdout);
  assert.match(rs.stdout, /❌ contrôle non lancé : `node tests\.js \$\(node marque\.js\)` contient une substitution de commande/);
  assert.ok(!lance(substitution.traces, "marque") && !lance(substitution.traces, "tests"));
});

test("preuve rouge due à l'environnement (fichier ignoré manquant) : etat cite la relance ; réparée, lancer → ✅", () => {
  const p = depot({ tester: "`node env.js`" });
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 1, r.stdout);
  assert.match(r.stdout, /variable manquante/);
  ecrire(p.d, "ignore/env.txt", "CLE=test\n");
  const e = preuve(p, "etat", "--exiger", "suite");
  assert.strictEqual(e.status, 1, "même contenu compté : toujours rouge");
  assert.match(e.stdout, /Cause hors des fichiers[^\n]*une fois réparée : relancez : pulse-aidd preuve lancer --portee suite/);
  const relance = preuve(p, "lancer", "--portee", "suite");
  assert.strictEqual(relance.status, 0, relance.stdout);
  assert.match(relance.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests 2\/2 ✅ \(suite, \d+ s\)/m);
  assert.strictEqual(preuve(p, "etat", "--exiger", "suite").status, 0);
});

test("lancement interrompu (outil arrêté avant la fin) : la preuve dit « lancement interrompu » et la relance, jamais « aucune »", async () => {
  const p = depot({ tester: "`node attend.js`" });
  const { spawn } = require("child_process");
  const enfant = spawn(process.execPath, [SCRIPT, "lancer"], { cwd: p.d, env: { ...process.env, PREUVE_TRACES: p.traces }, stdio: "ignore" });
  const fin = Date.now() + 20000;
  while (!lance(p.traces, "attend") && Date.now() < fin) await new Promise((ok) => setTimeout(ok, 100));
  assert.ok(lance(p.traces, "attend"), "les tests ont démarré");
  const arret = new Promise((ok) => enfant.on("exit", ok));
  enfant.kill("SIGKILL");
  await arret;
  const e = preuve(p, "etat", "--exiger", "suite");
  assert.strictEqual(e.status, 1, e.stdout);
  assert.match(e.stdout, /^preuve: ❌ à jour · contrôles ✅ · /m);
  assert.match(e.stdout, /❌ lancement interrompu[^\n]*timeout 600000/);
  assert.match(e.stdout, /Relancez : pulse-aidd preuve lancer --portee suite\./);
  assert.doesNotMatch(e.stdout, /^preuve: aucune/m);
  // Les tests arrêtés sans leur parent finissent seuls : attendre leur fin avant d'effacer le dossier.
  while (!lance(p.traces, "fin") && Date.now() < fin + 20000) await new Promise((ok) => setTimeout(ok, 100));
});

test("filet limité : la relance d'une preuve de portée tâche périmée demande les fichiers de test de la tâche, pas ceux de l'ancienne preuve", () => {
  const p = depot();
  assert.strictEqual(preuve(p, "lancer", "--portee", "tache", "src/a.test.js").status, 0);
  ecrire(p.d, "src/a.js", "module.exports = 4;\n");
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /^preuve: périmée [^\n]*relancez : pulse-aidd preuve lancer --portee tache <fichiers de test de la tâche> \(outil Bash : timeout 600000\)$/m);
  assert.doesNotMatch(e.stdout, /--portee tache src\/a\.test\.js/);
});

test("fichier de test écrit avec des barres obliques inverses (Windows) : lu avec des « / »", () => {
  const p = depot();
  const r = preuve(p, "lancer", "--portee", "tache", "src\\a.test.js");
  assert.strictEqual(r.status, 0, r.stdout);
  assert.strictEqual(fs.readFileSync(path.join(p.traces, "tests"), "utf8").trim(), "src/a.test.js");
});

test("outil qui s'arrête en échec faute de test (« No test files found », Vitest, Jest) : aucun fichier de test, non bloquant ; avec un fichier de test, ❌", () => {
  const p = depot({ tester: "`node sans-essais.js`" });
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests : aucun test écrit pour l'instant · /m);
  assert.doesNotMatch(r.stdout, /No test files found/, "pas d'échec affiché");
  ecrire(p.d, "src/a.spec.ts", "// test\n");
  const rouge = preuve(p, "lancer");
  assert.strictEqual(rouge.status, 1, rouge.stdout);
  assert.match(rouge.stdout, /^❌ `node sans-essais.js` \(code 1/m);
});

test("fichier de test dans test/ (ou spec/, src/test/, *-test.js) et « Tester » qui n'en trouve aucun : ❌, jamais « aucun test écrit »", () => {
  for (const f of ["test/vrai.js", "spec/vrai.rb", "src/test/java/FooTest.java", "lib/vrai-test.js", "lib/vrai_spec.rb", "pkg/test_vrai.py"]) {
    const p = depot({ tester: "`node sans-essais.js`" });
    ecrire(p.d, f, "// test\n");
    const r = preuve(p, "lancer");
    assert.strictEqual(r.status, 1, f + " : " + r.stdout);
    assert.doesNotMatch(r.stdout, /aucun test écrit pour l'instant/, f);
  }
});

test("écriture partielle impossible : le lancement va au bout, seule l'écriture finale échoue", () => {
  const p = depot();
  fs.mkdirSync(fichierPreuve(p.d), { recursive: true });
  const r = preuve(p, "lancer");
  assert.ok(lance(p.traces, "tests"), "les tests ont été lancés malgré l'écriture partielle impossible");
  assert.notStrictEqual(r.status, 0, "l'écriture finale reste stricte");
  assert.match(r.stdout, /erreur/);
});

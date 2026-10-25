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
  assert.match(r.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests 3\/3 ✅ \(suite\) · à l'instant$/m);
  assert.ok(lance(p.traces, "lint") && lance(p.traces, "tests"), "contrôles et tests lancés");
  assert.ok(!lance(p.traces, "build"), "construction lancée seulement avec --construire");
  const e = preuve(p, "etat");
  assert.strictEqual(e.status, 0, e.stdout);
  assert.match(e.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests 3\/3 ✅ \(suite\) · à l'instant$/m);
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
  assert.match(e.stdout, /^preuve: périmée \(fichiers modifiés depuis : src\/a\.js\) ; relancez : pulse-aidd preuve lancer --portee suite$/m);
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
  assert.match(r.stdout, /tests 2\/2 ✅ \(tâche\)/);
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
  assert.match(r.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests 3\/3 ✅ \(suite\) · construction ✅ · à l'instant$/m);
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
  assert.match(r.stdout, /^preuve: ✅ à jour · contrôles ✅ · tests 3\/3 ✅ \(suite\) · construction ✅ · /m);
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
  assert.match(r.stdout, /^preuve: ❌ à jour · contrôles ✅ · tests ❌ \(suite\) · à l'instant$/m);
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
  assert.match(r.stdout, /^preuve: ❌ à jour · contrôles ❌ · tests 3\/3 ✅ \(suite\)/m);
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

test("aucun test trouvé (0 test lancé) : ❌, code 1", () => {
  const p = depot({ tester: "`node vide.js`" });
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 1, r.stdout);
  assert.match(r.stdout, /tests 0\/0 ❌ \(suite\) \(aucun test trouvé\)/);
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

test("fichiers de test refusés (.., chemin absolu, lecteur, option) : code 2, rien n'est lancé ; tache sans fichier : code 1", () => {
  const p = depot();
  for (const f of ["../x.test.js", "/tmp/x.test.js", "C:/x.test.js", "src/a b.test.js", "-r"]) {
    const r = preuve(p, "lancer", "--portee", "tache", f);
    assert.strictEqual(r.status, 2, `${f} : ${r.stdout}`);
  }
  assert.ok(!lance(p.traces, "tests") && !lance(p.traces, "lint"));
  assert.ok(!fs.existsSync(fichierPreuve(p.d)));
  assert.strictEqual(preuve(p, "lancer", "--portee", "tache").status, 1);
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
  assert.match(preuve(p, "etat", "--exiger", "suite").stdout, /portée insuffisante[^\n]*relancez : pulse-aidd preuve lancer --portee suite$/m);
  assert.strictEqual(preuve(p, "lancer").status, 0);
  assert.match(preuve(p, "etat", "--exiger", "construction").stdout, /portée insuffisante[^\n]*ajoutez-la : pulse-aidd preuve construire/, "seule la construction manque");
  ecrire(p.d, "src/a.js", "module.exports = 3;\n");
  assert.match(preuve(p, "etat").stdout, /périmée[^\n]*relancez : pulse-aidd preuve lancer --portee suite/);
  const rouge = depot({ controles: "`node echec.js`" });
  preuve(rouge, "lancer");
  const e = preuve(rouge, "etat", "--exiger", "suite");
  assert.strictEqual(e.status, 1);
  assert.match(e.stdout, /Échecs à corriger : relancer sur le même contenu donnerait le même résultat/);
  assert.doesNotMatch(e.stdout, /relancez/);
});

test("aucun test trouvé : ❌ signalé comme un problème du projet, à corriger dans docs/technical.md", () => {
  const p = depot({ tester: "`node vide.js`" });
  const r = preuve(p, "lancer");
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /la commande « Tester » de docs\/technical\.md ne lance aucun test : corrigez-la, ou écrivez « aucune » si le projet n'a pas de tests/);
});

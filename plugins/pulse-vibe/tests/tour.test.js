// Tests du relevé des fichiers écrits pendant le tour (scripts/tour.js, scripts/apres-ecriture.js).
// Lancer : node --test plugins/pulse-vibe/tests/tour.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-tour-"));
process.env.PULSE_TOURS_DIR = path.join(BASE, "etat");
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));
const tour = require("../scripts/tour");

const APRES = path.join(__dirname, "..", "scripts", "apres-ecriture.js");
const GUIDE_PLAN = "aidd_docs/tasks/epic/PLAN-SPEC-US-001-a.md";
const PLAN = "# Plan – X – US-001 A\n\n## Tâches\n\n- [ ] **T1 – Une tâche** · US-001\n  - Objectif : x\n";

test("cle : session seule, ou session et agent ; valeurs filtrées", () => {
  assert.strictEqual(tour.cle({ session_id: "abc" }), "abc");
  assert.strictEqual(tour.cle({ session_id: "abc", agent_id: "ag-1" }), "abc-ag-1");
  assert.strictEqual(tour.cle({ session_id: "../x" }), "");
  assert.strictEqual(tour.cle({ session_id: "abc", agent_id: "a/b" }), "abc");
});

test("noter : un chemin absolu Windows devient relatif à la racine, avec des /", () => {
  const e = { session_id: "s1", tool_input: { file_path: "E:\\projet\\src\\a.ts" } };
  tour.noter(e, "E:/projet");
  assert.deepStrictEqual(tour.lireTour(e, "E:/projet"), { fichiers: ["src/a.ts"], relances: 0 });
});

test("noter : lecteur en casse différente accepté ; chemin hors du projet ignoré ; doublon noté une fois", () => {
  const racine = "E:/projet2";
  const e = (f) => ({ session_id: "s2", tool_input: { file_path: f } });
  tour.noter(e("e:\\projet2\\src\\b.ts"), racine);
  tour.noter(e("E:\\projet2\\src\\b.ts"), racine);
  tour.noter(e("E:\\autre\\c.ts"), racine);
  tour.noter(e("E:\\projet2-voisin\\d.ts"), racine);
  tour.noter(e("E:\\projet2\\..\\hors.ts"), racine);
  assert.deepStrictEqual(tour.lireTour(e(""), racine).fichiers, ["src/b.ts"]);
});

test("noter : chemin POSIX et chemin relatif", () => {
  const racine = path.join(BASE, "p");
  const e = (f) => ({ session_id: "s3", tool_input: { file_path: f } });
  tour.noter(e(`${racine}/src/x.js`), racine);
  tour.noter(e("src/y.js"), racine);
  assert.deepStrictEqual(tour.lireTour(e(""), racine).fichiers.sort(), ["src/x.js", "src/y.js"]);
});

test("noter : une entrée avec agent_id est notée dans les deux relevés", () => {
  const racine = "E:/projet3";
  const e = { session_id: "s4", agent_id: "ag9", tool_input: { file_path: "E:\\projet3\\src\\z.ts" } };
  tour.noter(e, racine);
  assert.deepStrictEqual(tour.lireTour(e, racine).fichiers, ["src/z.ts"]);
  assert.deepStrictEqual(tour.lireTour({ session_id: "s4" }, racine).fichiers, ["src/z.ts"]);
});

test("ecrireTour / effacerTour : les relances sont conservées puis le relevé s'efface", () => {
  const racine = "E:/projet4";
  const e = { session_id: "s5", tool_input: { file_path: "E:\\projet4\\a.ts" } };
  tour.noter(e, racine);
  tour.ecrireTour(e, racine, { fichiers: ["a.ts"], relances: 2 });
  assert.strictEqual(tour.lireTour(e, racine).relances, 2);
  tour.effacerTour(e, racine);
  assert.deepStrictEqual(tour.lireTour(e, racine), { fichiers: [], relances: 0 });
  tour.effacerTour(e, racine);
});

test("racineGit : la racine d'un dépôt, null hors dépôt", () => {
  const d = path.join(BASE, "depot");
  fs.mkdirSync(path.join(d, "sous"), { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: d });
  assert.strictEqual(path.resolve(tour.racineGit(path.join(d, "sous"))).toLowerCase(), path.resolve(fs.realpathSync(d)).toLowerCase());
  assert.strictEqual(tour.racineGit(fs.mkdtempSync(path.join(BASE, "vide-"))), null);
});

function projetPulse() {
  const d = fs.mkdtempSync(path.join(BASE, "proj-"));
  spawnSync("git", ["init", "-q"], { cwd: d });
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# P\n\n<!-- pulse_profil:debut -->\n<!-- pulse_profil:fin -->\n");
  fs.mkdirSync(path.join(d, "aidd_docs", "tasks", "epic"), { recursive: true });
  fs.writeFileSync(path.join(d, GUIDE_PLAN), PLAN);
  return d;
}
const lancer = (d, entree, avecProjet = true) =>
  spawnSync("node", [APRES], {
    cwd: d,
    input: typeof entree === "string" ? entree : JSON.stringify(entree),
    encoding: "utf8",
    env: { ...process.env, ...(avecProjet ? { CLAUDE_PROJECT_DIR: d } : {}) },
  });

test("apres-ecriture : note le fichier et régénère le guide pour un plan", () => {
  const d = projetPulse();
  const e = (f) => ({ session_id: "s6", cwd: d, tool_name: "Edit", tool_input: { file_path: path.join(d, f) } });
  const r = lancer(d, e(GUIDE_PLAN));
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout + r.stderr, "");
  assert.ok(fs.existsSync(path.join(d, "docs", "guide", "index.md")), "guide régénéré");
  assert.ok(tour.lireTour(e(""), tour.racineGit(d)).fichiers.includes(GUIDE_PLAN));
  assert.strictEqual(lancer(d, e("src/a.ts")).status, 0);
  assert.ok(tour.lireTour(e(""), tour.racineGit(d)).fichiers.includes("src/a.ts"));
});

test("apres-ecriture : rien hors d'un projet Pulse, silencieux sur une entrée invalide", () => {
  const d = fs.mkdtempSync(path.join(BASE, "sans-"));
  spawnSync("git", ["init", "-q"], { cwd: d });
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# Sans Pulse\n");
  const e = { session_id: "s7", cwd: d, tool_input: { file_path: path.join(d, "a.ts") } };
  const r = lancer(d, e);
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(tour.lireTour(e, tour.racineGit(d)).fichiers, []);
  const p = projetPulse();
  for (const x of ["pas du json", "", "null", "{}"]) {
    const s = lancer(p, x);
    assert.strictEqual(s.status, 0);
    assert.strictEqual(s.stdout + s.stderr, "");
  }
});

test("apres-ecriture : huit écritures en parallèle sont toutes relevées", async () => {
  const d = projetPulse();
  const lancerAsync = (f) =>
    new Promise((resolve) => {
      const p = spawn("node", [APRES], { cwd: d, env: { ...process.env, CLAUDE_PROJECT_DIR: d } });
      p.on("close", resolve);
      p.stdin.end(JSON.stringify({ session_id: "s8", cwd: d, tool_name: "Write", tool_input: { file_path: path.join(d, "src", f) } }));
    });
  const noms = Array.from({ length: 8 }, (_, i) => `f${i}.ts`);
  const codes = await Promise.all(noms.map(lancerAsync));
  assert.deepStrictEqual(codes, Array(8).fill(0));
  const notes = tour.lireTour({ session_id: "s8" }, tour.racineGit(d)).fichiers.sort();
  assert.deepStrictEqual(notes, noms.map((n) => `src/${n}`));
});

test("apres-ecriture : lancé depuis un sous-dossier du projet", () => {
  const d = projetPulse();
  const sous = path.join(d, "src", "lib");
  fs.mkdirSync(sous, { recursive: true });
  const e = { session_id: "s9", cwd: sous, tool_input: { file_path: path.join(sous, "a.ts") } };
  const r = spawnSync("node", [APRES], { cwd: sous, input: JSON.stringify(e), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: d } });
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(tour.lireTour(e, tour.racineGit(d)).fichiers, ["src/lib/a.ts"]);
});

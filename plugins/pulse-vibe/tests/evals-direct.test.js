// Tests du mode direct des évaluations (outils/evals/direct.js, lancé par outils/evals/lancer.js --direct) : chaque cas
// tourne avec claude -p, ses vérifications automatiques sont notées sur la trace, les juges IA sont signalés non notés.
// Lancer : node --test plugins/pulse-vibe/tests/evals-direct.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const OUTILS = path.join(__dirname, "..", "..", "..", "outils", "evals");
const direct = require(path.join(OUTILS, "direct.js"));
const mesure = require(path.join(OUTILS, "mesurer.js"));
const CAS = path.join(OUTILS, "cas");
const LF = String.fromCharCode(10);
const TRACE = path.join(__dirname, "fixtures", "evals", "direct", "trace.jsonl");

test("lireCas : le prompt, ses réglages et chaque vérification, tels que les écrit claude plugin eval", () => {
  const c = direct.lireCas(path.join(CAS, "plan-controle"));
  assert.strictEqual(c.nom, "plan-controle");
  assert.strictEqual(c.prompt, "/pulse:plan US-001");
  assert.strictEqual(c.maxTours, 40);
  assert.strictEqual(c.delai, 600);
  assert.deepStrictEqual(c.outils, ["Read", "Glob", "Grep", "Skill", "AskUserQuestion"]);
  assert.strictEqual(path.basename(c.preparation), "projet.sh");
  const parNom = Object.fromEntries(c.verifications.map((v) => [v.nom, v]));
  assert.deepStrictEqual(parNom.controle, { nom: "controle", type: "tool_used", tool: "Bash", input_match: "pulse-aidd verifier-plan US-001" });
  assert.strictEqual(parNom["ecrit-a-valider"].input_match, String.raw`PLAN-SPEC-US-001[\s\S]*Statut\*\* : à valider`);
  assert.deepStrictEqual(parNom.ordre.before, { tool: "Write", input_match: "PLAN-SPEC-US-001" });
  assert.deepStrictEqual(parNom.ordre.after, { tool: "Bash", input_match: "verifier-plan US-001" });
  assert.strictEqual(parNom.criteres.type, "llm");
});

test("noter : outils appelés (sous-agents compris), ordre, texte de la dernière réponse ; juge IA non noté", () => {
  const notes = direct.noter(TRACE, [
    { nom: "etat", type: "tool_used", tool: "Bash", input_match: "pulse-aidd etat" },
    { nom: "ecrit", type: "tool_used", tool: "Write", input_match: String.raw`PLAN-SPEC-US-001[\s\S]*Statut\*\* : à valider` },
    { nom: "absent", type: "tool_used", tool: "Edit" },
    { nom: "ordre", type: "tool_order", before: { tool: "Write", input_match: "PLAN-SPEC" }, after: { tool: "Bash", input_match: "verifier-plan" } },
    { nom: "ordre-inverse", type: "tool_order", before: { tool: "Bash", input_match: "verifier-plan" }, after: { tool: "Write", input_match: "PLAN-SPEC" } },
    { nom: "prochaine", type: "regex", pattern: "/pulse:plan US-001" },
    { nom: "juge", type: "llm", texte: "…" },
    { nom: "jamais-edit", type: "tool_not_used", tool: "Edit" },
    { nom: "jamais-etat", type: "tool_not_used", tool: "Bash", input_match: "pulse-aidd etat" },
  ]);
  const ok = Object.fromEntries(notes.details.map((d) => [d.nom, d.reussi]));
  assert.deepStrictEqual(ok, { etat: true, ecrit: true, absent: false, ordre: true, "ordre-inverse": false, prochaine: true, juge: null, "jamais-edit": true, "jamais-etat": false });
  assert.strictEqual(notes.score, 5 / 8);
});

test("lecture-entiere : échoue sur une commande de règles suivie d'un tube, réussit sinon", () => {
  const g = direct.lireCas(path.join(CAS, "relecture-defaut")).verifications.find((v) => v.nom === "lecture-entiere");
  assert.strictEqual(g.type, "tool_not_used");
  const trace = (commande) => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lecture-")), "trace.jsonl");
    const bloc = { type: "tool_use", id: "t1", name: "Bash", input: { command: commande } };
    fs.writeFileSync(f, JSON.stringify({ type: "assistant", message: { content: [bloc] } }) + "\n");
    return f;
  };
  const note = (commande) => direct.noter(trace(commande), [g]).details[0].reussi;
  assert.strictEqual(note("pulse-aidd qualite regles | head -60"), false);
  assert.strictEqual(note('pulse-aidd reference "a/b.md" 2>&1 | tail -5'), false);
  assert.strictEqual(note("pulse-aidd pile contexte realisation | head"), false);
  assert.strictEqual(note("pulse-aidd tests x 2>&1 | head -5"), false);
  assert.strictEqual(note("pulse-aidd qualite regles"), true);
  assert.strictEqual(note("pulse-aidd tests x && git log | head"), true);
  assert.strictEqual(note("pulse-aidd tests x || echo echec"), true);
  assert.strictEqual(note("git log | head; pulse-aidd etat"), true);
});

test("lecture-entiere : un appel coupé par un tube mais refusé par le garde-fou ne compte pas", () => {
  const g = direct.lireCas(path.join(CAS, "relecture-defaut")).verifications.find((v) => v.nom === "lecture-entiere");
  const trace = (resultat) => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "refus-")), "trace.jsonl");
    const appel = (id, command) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } });
    const retour = (id, r) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, ...r }] } });
    const lignes = [appel("t1", "pulse-aidd qualite regles | head -80"), retour("t1", resultat), appel("t2", "pulse-aidd qualite regles"), retour("t2", { content: "regles" })];
    fs.writeFileSync(f, lignes.map((l) => JSON.stringify(l)).join(LF) + LF);
    return f;
  };
  const refus = { is_error: true, content: "PreToolUse:Bash hook error: ce sont des règles de Pulse, qui s'appliquent en entier" };
  assert.strictEqual(direct.noter(trace(refus), [g]).details[0].reussi, true);
  assert.strictEqual(direct.noter(trace({ content: "regles" }), [g]).details[0].reussi, false);
  // une commande lancée qui a fini en échec a bien tourné : elle compte
  assert.strictEqual(direct.noter(trace({ is_error: true, content: "Exit code 1" + LF + "erreur" }), [g]).details[0].reussi, false);
});

test("tool_used et tool_order : un appel refusé n'a rien fait", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "refus-")), "trace.jsonl");
  const appel = (id, name) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input: {} }] } });
  const retour = (id, extra) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: "x", ...extra }] } });
  fs.writeFileSync(f, [appel("a", "Write"), retour("a", { is_error: true }), appel("b", "Read"), retour("b", {})].map((l) => JSON.stringify(l)).join(LF) + LF);
  const notes = direct.noter(f, [
    { nom: "u", type: "tool_used", tool: "Write" },
    { nom: "r", type: "tool_used", tool: "Read" },
    { nom: "o", type: "tool_order", before: { tool: "Write" }, after: { tool: "Read" } },
  ]);
  assert.deepStrictEqual(notes.details.map((d) => d.reussi), [false, true, false]);
});

test("tool_order strict : un appel « after » avant le premier « before » fait échouer", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ordre-")), "trace.jsonl");
  const appel = (id, name, input) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });
  fs.writeFileSync(f, [appel("a", "Write", { file_path: "src/a.ts" }), appel("b", "Bash", { command: "pulse-aidd qualite clean-code" }), appel("c", "Write", { file_path: "src/b.ts" })].map((l) => JSON.stringify(l)).join(LF) + LF);
  const ordre = { type: "tool_order", before: { tool: "Bash", input_match: "qualite" }, after: { tool: "Write", input_match: "src" } };
  const notes = direct.noter(f, [{ nom: "souple", ...ordre }, { nom: "strict", ...ordre, strict: "true" }]);
  assert.deepStrictEqual(notes.details.map((d) => d.reussi), [true, false]);
});

test("lecture-entiere : le contenu d'un résultat en blocs de texte se lit comme du texte", () => {
  const g = direct.lireCas(path.join(CAS, "relecture-defaut")).verifications.find((v) => v.nom === "lecture-entiere");
  const note = (texte) => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "blocs-")), "trace.jsonl");
    const appel = { type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "pulse-aidd qualite regles | head -80" } }] } };
    const retour = { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: true, content: [{ type: "text", text: texte }] }] } };
    fs.writeFileSync(f, JSON.stringify(appel) + LF + JSON.stringify(retour) + LF);
    return direct.noter(f, [g]).details[0].reussi;
  };
  assert.strictEqual(note("Exit code 1" + LF + "erreur"), false);
  assert.strictEqual(note("PreToolUse:Bash hook error: règles de Pulse"), true);
});

test("argumentsDirect : claude -p avec le prompt d'abord, les plugins du dépôt, les outils du cas et ceux du lanceur", () => {
  const c = { prompt: "/pulse:status", maxTours: 15, outils: ["Read", "Skill"] };
  const a = direct.argumentsDirect(c, "/depot", {});
  assert.deepStrictEqual(a.slice(0, 2), ["-p", "/pulse:status"]);
  assert.deepStrictEqual(a.slice(a.indexOf("--plugin-dir"), a.indexOf("--plugin-dir") + 2), ["--plugin-dir", path.join("/depot", "plugins", "pulse-vibe")]);
  assert.ok(!a.includes(path.join("/depot", "plugins", "pulse-vibe-next")));
  assert.deepStrictEqual(a.slice(a.indexOf("--max-turns"), a.indexOf("--max-turns") + 2), ["--max-turns", "15"]);
  assert.deepStrictEqual(a.slice(a.indexOf("--max-budget-usd"), a.indexOf("--max-budget-usd") + 2), ["--max-budget-usd", "5"]);
  assert.strictEqual(a[a.indexOf("--settings") + 1], JSON.stringify({ sandbox: { enabled: true } }));
  const outils = a.slice(a.indexOf("--allowedTools") + 1);
  for (const o of ["Read", "Skill", "Write", "Edit", "Bash(pulse-aidd *)", "Bash(git *)", "Bash(node *)"]) assert.ok(outils.includes(o), o);
  const avecPack = direct.argumentsDirect(c, "/depot", { PACK: "next", PLAFOND: "15" });
  assert.ok(avecPack.includes(path.join("/depot", "plugins", "pulse-vibe-next")));
  assert.ok(avecPack.includes("Bash(npm *)"));
  assert.strictEqual(avecPack[avecPack.indexOf("--max-budget-usd") + 1], "15");
});

test("le rapport du mode direct se lit avec mesurer.js, comme celui de claude plugin eval", () => {
  const rapport = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-direct-"));
  direct.ecrireRapport(rapport, [{ cas: "statut-prochaine-etape", essais: [{ trace: TRACE, duree: 42, notes: { score: 0.5, details: [] } }] }]);
  const [e] = mesure.lireResultats(rapport);
  assert.deepStrictEqual(e, { cas: "statut-prochaine-etape", score: 0.5, duree: 42, entree: 1, sortie: 2, cacheLu: 3, cacheEcrit: 4, outils: 3, sousAgents: 0 });
});

test("choisirCas : tous les cas, ou ceux que nomme --case (motif avec *)", () => {
  const tous = direct.choisirCas(CAS, null);
  assert.ok(tous.includes("plan-controle") && !tous.includes("_communs"));
  assert.deepStrictEqual(direct.choisirCas(CAS, "plan-*"), ["plan-controle"]);
  assert.deepStrictEqual(direct.choisirCas(CAS, "statut-prochaine-etape"), ["statut-prochaine-etape"]);
});

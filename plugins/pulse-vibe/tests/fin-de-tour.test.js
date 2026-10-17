// Tests du contrôle de fin de tour (scripts/fin-de-tour.js, hooks Stop et SubagentStop).
// Lancer : node --test plugins/pulse-vibe/tests/fin-de-tour.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-fin-"));
process.env.PULSE_TOURS_DIR = path.join(BASE, "etat");
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));
const tour = require("../scripts/tour");

const SCRIPT = path.join(__dirname, "..", "scripts", "fin-de-tour.js");
const REGLE = "- Les montants s'écrivent en centimes. — Contrôle : interdit `parseFloat(` dans `src/`\n";
const CLE_STRIPE = "sk_live_" + "4eC39HqLyjWDarjtT1zdp7dc";

let n = 0;
const session = () => `s${++n}`;

function projet({ pulse = true, regles = REGLE } = {}) {
  const d = fs.mkdtempSync(path.join(BASE, "proj-"));
  spawnSync("git", ["init", "-q"], { cwd: d });
  fs.writeFileSync(path.join(d, "CLAUDE.md"), pulse ? "# P\n\n<!-- pulse_profil:debut -->\n<!-- pulse_profil:fin -->\n" : "# P\n");
  fs.mkdirSync(path.join(d, "aidd_docs", "memory"), { recursive: true });
  fs.writeFileSync(path.join(d, "aidd_docs", "memory", "technical.md"), `# Technique\n\n## Conventions propres au projet\n\n${regles}`);
  return d;
}
const ecrire = (d, f, contenu) => {
  fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
  fs.writeFileSync(path.join(d, f), contenu);
};
// Note les fichiers comme le hook PostToolUse (sous la clé de l'agent et sous celle de la session).
const noter = (d, entree, ...fichiers) => {
  for (const f of fichiers) tour.noter({ ...entree, tool_input: { file_path: path.join(d, f) } }, tour.racineGit(d));
};
const lancer = (d, entree, env = {}) => {
  const r = spawnSync("node", [SCRIPT], { cwd: d, input: JSON.stringify({ cwd: d, hook_event_name: "Stop", ...entree }), encoding: "utf8", env: { ...process.env, ...env } });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stderr, "");
  return r.stdout ? JSON.parse(r.stdout) : null;
};
const releve = (d, entree) => tour.lireTour(entree, tour.racineGit(d));

const PLAN_EN_COURS = "# Plan – X – US-001 A\n\n## Tâches\n\n- [~] **T1 – Une tâche** · US-001\n  - Objectif : x\n";
const PLAN_A_FAIRE = PLAN_EN_COURS.replace("[~]", "[ ]");
const technique = (commandes) =>
  `# Technique\n\n## Commandes du projet\n\n| Action | Commande |\n|---|---|\n| Lancer en local | \`npm run dev\` |\n| Contrôles automatiques (lint, format, types) | ${commandes} |\n`;
function avecControles(d, commandes, plan = PLAN_EN_COURS) {
  ecrire(d, "aidd_docs/tasks/e/PLAN-SPEC-US-001-x.md", plan);
  ecrire(d, "docs/technical.md", technique(commandes));
}

test("hors projet Pulse : aucune sortie", () => {
  const d = projet({ pulse: false });
  const e = { session_id: session() };
  ecrire(d, "src/a.js", "parseFloat(x)\n");
  noter(d, e, "src/a.js");
  assert.strictEqual(lancer(d, e), null);
});

test("relevé vide : aucune sortie, même si un fichier non relevé enfreint une règle", () => {
  const d = projet();
  ecrire(d, "src/a.js", "parseFloat(x)\n");
  assert.strictEqual(lancer(d, { session_id: session() }), null);
});

test("entrée invalide ou session inconnue : silencieux", () => {
  const d = projet();
  for (const x of ["pas du json", "", "null", "{}"]) {
    const r = spawnSync("node", [SCRIPT], { cwd: d, input: x, encoding: "utf8" });
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout + r.stderr, "");
  }
});

test("fichier relevé qui enfreint une règle : bloqué, la raison cite la règle, le fichier et la ligne", () => {
  const d = projet();
  const e = { session_id: session() };
  ecrire(d, "src/prix.js", "const a = 1;\nconst b = parseFloat(x);\n");
  noter(d, e, "src/prix.js");
  const s = lancer(d, e);
  assert.strictEqual(s.decision, "block");
  assert.match(s.reason, /Les montants s'écrivent en centimes/);
  assert.match(s.reason, /src\/prix\.js/);
  assert.match(s.reason, /ligne 2/);
  assert.match(s.reason, /pulse-aidd verifier/);
  assert.match(s.reason, /une phrase simple/);
  assert.strictEqual(releve(d, e).relances, 1);
  assert.deepStrictEqual(releve(d, e).fichiers, ["src/prix.js"]);
});

test("fichier relevé avec une clé secrète : bloqué, sans recopier la clé", () => {
  const d = projet();
  const e = { session_id: session() };
  ecrire(d, "lib/paiement.js", `const k = "${CLE_STRIPE}";\n`);
  noter(d, e, "lib/paiement.js");
  const s = lancer(d, e);
  assert.strictEqual(s.decision, "block");
  assert.match(s.reason, /lib\/paiement\.js/);
  assert.match(s.reason, /Stripe/);
  assert.ok(!s.reason.includes(CLE_STRIPE));
});

test("troisième blocage du même tour : plus de blocage, contexte sans « terminé », relevé effacé", () => {
  const d = projet();
  const e = { session_id: session() };
  ecrire(d, "src/prix.js", "parseFloat(x)\n");
  noter(d, e, "src/prix.js");
  assert.strictEqual(lancer(d, e).decision, "block");
  assert.strictEqual(lancer(d, { ...e, stop_hook_active: true }).decision, "block");
  assert.strictEqual(releve(d, e).relances, 2);
  const s = lancer(d, { ...e, stop_hook_active: true });
  assert.strictEqual(s.decision, undefined);
  assert.strictEqual(s.hookSpecificOutput.hookEventName, "Stop");
  assert.match(s.hookSpecificOutput.additionalContext, /src\/prix\.js/);
  assert.match(s.hookSpecificOutput.additionalContext, /reste à corriger/);
  assert.match(s.hookSpecificOutput.additionalContext, /terminé/);
  assert.deepStrictEqual(releve(d, e), { fichiers: [], relances: 0 });
});

test("contrôle qui passe : relevé et compteur effacés", () => {
  const d = projet();
  const e = { session_id: session() };
  ecrire(d, "src/prix.js", "parseFloat(x)\n");
  noter(d, e, "src/prix.js");
  assert.strictEqual(lancer(d, e).decision, "block");
  ecrire(d, "src/prix.js", "const centimes = 100;\n");
  assert.strictEqual(lancer(d, e), null);
  assert.deepStrictEqual(releve(d, e), { fichiers: [], relances: 0 });
});

test("fichier relevé puis supprimé, dossier, binaire ou sous aidd_docs/ : ignoré, le contrôle passe", () => {
  const d = projet({ regles: REGLE + "- Pas de TODO. — Contrôle : interdit `TODO` dans `*.md`, `*.bin`\n" });
  const e = { session_id: session() };
  ecrire(d, "src/parti.js", "parseFloat(x)\n");
  ecrire(d, "aidd_docs/notes.md", "TODO parseFloat(\n");
  ecrire(d, "src/image.bin", Buffer.concat([Buffer.from("TODO parseFloat("), Buffer.from([0, 1, 2])]));
  fs.mkdirSync(path.join(d, "src", "dossier"), { recursive: true });
  noter(d, e, "src/parti.js", "aidd_docs/notes.md", "src/image.bin", "src/dossier");
  fs.unlinkSync(path.join(d, "src", "parti.js"));
  assert.strictEqual(lancer(d, e), null);
  assert.deepStrictEqual(releve(d, e), { fichiers: [], relances: 0 });
});

test("SubagentStop : agent qui n'écrit pas → aucune sortie ; implementer → contrôle de son seul relevé", () => {
  const d = projet();
  const s = session();
  const relecteur = { session_id: s, agent_id: "rev1", agent_type: "pulse:reviewer", hook_event_name: "SubagentStop" };
  const auteur = { session_id: s, agent_id: "imp1", agent_type: "pulse:implementer", hook_event_name: "SubagentStop" };
  const autre = { session_id: s, agent_id: "imp2", agent_type: "pulse:implementer", hook_event_name: "SubagentStop" };
  ecrire(d, "src/a.js", "parseFloat(x)\n");
  ecrire(d, "src/b.js", "const b = 1;\n");
  noter(d, relecteur, "src/a.js");
  assert.strictEqual(lancer(d, relecteur), null);
  noter(d, auteur, "src/a.js");
  noter(d, autre, "src/b.js");
  const sortie = lancer(d, auteur);
  assert.strictEqual(sortie.decision, "block");
  assert.match(sortie.reason, /src\/a\.js/);
  assert.strictEqual(releve(d, auteur).relances, 1);
  assert.strictEqual(lancer(d, autre), null);
  assert.deepStrictEqual(releve(d, autre), { fichiers: [], relances: 0 });
  // Le relevé de la session n'est jamais réécrit par un sous-agent.
  assert.deepStrictEqual(releve(d, { session_id: s }), { fichiers: ["src/a.js", "src/b.js"], relances: 0 });
});

test("SubagentStop : troisième blocage → contexte de l'agent, son relevé effacé", () => {
  const d = projet();
  const e = { session_id: session(), agent_id: "fix1", agent_type: "pulse:fixer", hook_event_name: "SubagentStop" };
  ecrire(d, "src/a.js", "parseFloat(x)\n");
  noter(d, e, "src/a.js");
  lancer(d, e);
  lancer(d, e);
  const s = lancer(d, e);
  assert.strictEqual(s.hookSpecificOutput.hookEventName, "SubagentStop");
  assert.deepStrictEqual(releve(d, e), { fichiers: [], relances: 0 });
  assert.deepStrictEqual(releve(d, { session_id: e.session_id }).fichiers, ["src/a.js"]);
});

test("contrôles rapides : tâche en cours et contrôle qui échoue → bloqué avec les 40 dernières lignes", () => {
  const d = projet();
  const e = { session_id: session() };
  avecControles(d, '`node -e "for (let i = 1; i <= 60; i++) console.log(\'ligne \' + i); process.exit(1)"` (corriger : `node -e "process.exit(1)"`)');
  ecrire(d, "src/ok.js", "const a = 1;\n");
  noter(d, e, "src/ok.js");
  const s = lancer(d, e);
  assert.strictEqual(s.decision, "block");
  assert.match(s.reason, /ligne 60/);
  assert.match(s.reason, /ligne 21\b/);
  assert.doesNotMatch(s.reason, /ligne 20\b/);
});

test("contrôles rapides : sans tâche en cours, rien n'est lancé", () => {
  const d = projet();
  const e = { session_id: session() };
  avecControles(d, '`node -e "process.exit(1)"`', PLAN_A_FAIRE);
  ecrire(d, "src/ok.js", "const a = 1;\n");
  noter(d, e, "src/ok.js");
  assert.strictEqual(lancer(d, e), null);
});

test("contrôles rapides : seules les commandes hors parenthèses sont lancées, dans l'ordre", () => {
  const d = projet();
  const e = { session_id: session() };
  const trace = path.join(d, "trace.txt").replace(/\\/g, "/");
  const cmd = (x) => `\`node -e "require('fs').appendFileSync('${trace}', '${x}')"\``;
  avecControles(d, `${cmd("a")} et ${cmd("b")} (corriger le format : ${cmd("c")})`);
  ecrire(d, "src/ok.js", "const a = 1;\n");
  noter(d, e, "src/ok.js");
  assert.strictEqual(lancer(d, e), null);
  assert.strictEqual(fs.readFileSync(trace, "utf8"), "ab");
});

test("contrôles rapides : « aucune » ou relevé vide → rien n'est lancé", () => {
  const d = projet();
  avecControles(d, "aucune");
  const e = { session_id: session() };
  ecrire(d, "src/ok.js", "const a = 1;\n");
  noter(d, e, "src/ok.js");
  assert.strictEqual(lancer(d, e), null);
  const d2 = projet();
  avecControles(d2, '`node -e "process.exit(1)"`');
  assert.strictEqual(lancer(d2, { session_id: session() }), null);
});

test("contrôles rapides : commande introuvable (code 127 ou script manquant) → sautée", () => {
  const d = projet();
  const e = { session_id: session() };
  avecControles(d, '`node -e "process.exit(127)"` et `node -e "console.error(\'npm error Missing script: check\'); process.exit(1)"` et `commande-pulse-inexistante-xyz`');
  ecrire(d, "src/ok.js", "const a = 1;\n");
  noter(d, e, "src/ok.js");
  assert.strictEqual(lancer(d, e), null);
});

test("contrôles rapides : commande plus longue que le délai → sautée", () => {
  const d = projet();
  const e = { session_id: session() };
  avecControles(d, '`node -e "setTimeout(() => process.exit(1), 4000)"`');
  ecrire(d, "src/ok.js", "const a = 1;\n");
  noter(d, e, "src/ok.js");
  const debut = Date.now();
  assert.strictEqual(lancer(d, e, { PULSE_FIN_DE_TOUR_DELAI: "1" }), null);
  assert.ok(Date.now() - debut < 3800, `${Date.now() - debut} ms`);
});

test("worktree : règles et relevé du worktree, pas ceux du dépôt principal", () => {
  const d = projet({ regles: "" });
  spawnSync("git", ["add", "-A"], { cwd: d });
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init"], { cwd: d, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  const w = path.join(d, ".claude", "worktrees", "essai");
  assert.strictEqual(spawnSync("git", ["worktree", "add", "-q", "-b", "essai", w], { cwd: d, encoding: "utf8" }).status, 0);
  ecrire(w, "aidd_docs/memory/technical.md", `# Technique\n\n## Conventions propres au projet\n\n${REGLE}`);
  ecrire(w, "src/prix.js", "parseFloat(x)\n");
  const e = { session_id: session() };
  noter(w, e, "src/prix.js");
  assert.deepStrictEqual(releve(d, e).fichiers, []);
  const s = lancer(w, e);
  assert.strictEqual(s.decision, "block");
  assert.match(s.reason, /src\/prix\.js/);
  assert.strictEqual(releve(w, e).relances, 1);
});

// Tests du garde-fou du pack (scripts/garde.js) : migrations de drizzle/ déjà enregistrées protégées.
// Lancer : node --test plugins/pulse-vibe-next/tests/garde.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");

const HOOK = path.join(__dirname, "..", "scripts", "garde.js");
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-next-garde-"));
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));

/** Un projet Pulse dans un vrai dépôt Git, avec une migration enregistrée et une migration encore non suivie. */
function projet(nom, { pack = "next", pulse = true } = {}) {
  const d = path.join(BASE, nom);
  fs.mkdirSync(path.join(d, "drizzle", "meta"), { recursive: true });
  fs.mkdirSync(path.join(d, "docs"), { recursive: true });
  fs.writeFileSync(path.join(d, "CLAUDE.md"), pulse ? "# Projet\n\n<!-- pulse_profil:debut -->\n<!-- pulse_profil:fin -->\n" : "# Projet\n");
  fs.writeFileSync(path.join(d, "docs", "technical.md"), `# Technique\n\n**Pack de pile Pulse** : ${pack}\n`);
  fs.writeFileSync(path.join(d, "drizzle", "0000_debut.sql"), "CREATE TABLE a (id int);\n");
  fs.writeFileSync(path.join(d, "drizzle", "meta", "_journal.json"), "{}\n");
  const git = (...args) => execFileSync("git", args, { cwd: d, stdio: "ignore" });
  git("init", "-q");
  git("-c", "user.name=t", "-c", "user.email=t@t", "add", "drizzle");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "migration");
  fs.writeFileSync(path.join(d, "drizzle", "0001_nouvelle.sql"), "ALTER TABLE a ADD b int;\n");
  return d;
}

function lancer(entree, env = {}) {
  const r = spawnSync("node", [HOOK], { input: JSON.stringify(entree), encoding: "utf8", env: { ...process.env, PULSE_GARDE_MIGRATIONS_OFF: "", ...env } });
  assert.strictEqual(r.status, 0, "le hook sort toujours avec le code 0");
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
}
const ecrire = (cwd, fichier) => ({ tool_name: "Write", tool_input: { file_path: path.join(cwd, fichier), content: "x" }, cwd });
const editer = (cwd, fichier) => ({ tool_name: "Edit", tool_input: { file_path: fichier, old_string: "a", new_string: "b" }, cwd });
const bash = (cwd, command) => ({ tool_name: "Bash", tool_input: { command }, cwd });

test("une migration enregistrée ne se modifie pas, par un outil ni par une commande ; le refus dit quoi faire", () => {
  const d = projet("refus");
  const refus = lancer(ecrire(d, "drizzle/0000_debut.sql"));
  assert.strictEqual(refus.permissionDecision, "deny");
  assert.match(refus.permissionDecisionReason, /drizzle\/0000_debut\.sql/);
  assert.match(refus.permissionDecisionReason, /npm run db:generate/);
  assert.strictEqual(lancer(editer(path.join(d, "drizzle"), "meta/_journal.json")).permissionDecision, "deny");
  for (const c of ["echo x >> drizzle/0000_debut.sql", "sed -i 's/a/b/' drizzle/0000_debut.sql", "rm drizzle/0000_debut.sql", "mv drizzle/0000_debut.sql drizzle/vieux.sql"])
    assert.strictEqual((lancer(bash(d, c)) || {}).permissionDecision, "deny", c);
  assert.strictEqual(lancer({ tool_name: "PowerShell", tool_input: { command: "Remove-Item drizzle\\0000_debut.sql" }, cwd: d }).permissionDecision, "deny");
});

test("une migration non suivie, la lecture et la génération passent", () => {
  const d = projet("passe");
  assert.strictEqual(lancer(ecrire(d, "drizzle/0001_nouvelle.sql")), null);
  assert.strictEqual(lancer(ecrire(d, "src/db/a.table.ts")), null);
  for (const c of ["cat drizzle/0000_debut.sql", "npm run db:generate", "npm run db:migrate", "git add drizzle/0001_nouvelle.sql", "rm drizzle/0001_nouvelle.sql"])
    assert.strictEqual(lancer(bash(d, c)), null, c);
});

test("hors projet Pulse, avec un autre pack, ou désactivé : l'outil passe", () => {
  assert.strictEqual(lancer(ecrire(projet("sans-pulse", { pulse: false }), "drizzle/0000_debut.sql")), null);
  assert.strictEqual(lancer(ecrire(projet("autre-pack", { pack: "autre" }), "drizzle/0000_debut.sql")), null);
  assert.strictEqual(lancer(ecrire(projet("coupe"), "drizzle/0000_debut.sql"), { PULSE_GARDE_MIGRATIONS_OFF: "1" }), null);
  assert.strictEqual(lancer("pas du json"), null);
});

test("hooks/hooks.json du pack lance scripts/garde.js avant les écritures et les commandes", () => {
  const h = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hooks", "hooks.json"), "utf8"));
  const avant = h.hooks.PreToolUse[0];
  for (const outil of ["Write", "Edit", "MultiEdit", "Bash", "PowerShell"]) assert.ok(avant.matcher.split("|").includes(outil), outil);
  assert.deepStrictEqual(avant.hooks[0].args, ["${CLAUDE_PLUGIN_ROOT}/scripts/garde.js"]);
});

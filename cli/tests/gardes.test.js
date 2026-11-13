// Tests des garde-fous hors de Claude Code : fichiers de hooks posés et retirés, traduction des entrées et des
// réponses pour chaque outil, contrôle de fin de tour et plugin OpenCode.
// Lancer depuis la racine du dépôt : node --test cli/tests/*.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const CLI = path.join(__dirname, "..");
const PULSEIA = path.join(CLI, "bin", "pulseia.js");
const NOUVEAU = path.join(CLI, "..", "plugins", "pulse-vibe", "skills", "init", "scripts", "nouveau-projet.js");
const { lirePatch } = require("../lib/gardes");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "pulseia-gardes-"));
const SECRET = ["sk", "test", "4eC39HqLyjWDarjtT1zdp7dc"].join("_");
const lireJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), "utf8"));

function environnement(maison, plus = {}) {
  const env = { ...process.env, PULSEIA_MAISON: maison, ...plus };
  for (const v of ["PULSE_OUTIL", "CODEX_HOME", "COPILOT_HOME", "XDG_CONFIG_HOME", "PULSE_GARDE_OFF", "PULSE_GARDE_COMMANDES_OFF"]) if (!(v in plus)) delete env[v];
  return env;
}
const pulseia = (maison, args, plus) => spawnSync("node", [PULSEIA, ...args], { cwd: maison, encoding: "utf8", env: environnement(maison, plus) });

/** Un projet Pulse neuf (CLAUDE.md du modèle, dépôt Git). */
function projet() {
  const parent = tmp();
  const r = spawnSync("node", [NOUVEAU, "Essai", "--oui"], { cwd: parent, encoding: "utf8", env: { ...process.env, PULSE_OUTIL: "" } });
  assert.strictEqual(r.status, 0, r.stderr);
  return path.join(parent, "essai");
}

/** pulseia hook <outil> <événement> avec une entrée JSON ; rend la sortie lue en JSON ({} si vide). */
function hook(maison, outil, evenement, entree) {
  const r = spawnSync("node", [PULSEIA, "hook", outil, evenement], { input: JSON.stringify(entree), encoding: "utf8", env: environnement(maison) });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : {};
}

test("lecture d'un patch apply_patch : ajouts, modifications, déplacements, suppressions", () => {
  const patch = "*** Begin Patch\n*** Add File: a/b.js\n+const k = 1;\n+// fin\n*** Update File: c.js\n*** Move to: d.js\n@@\n-x\n+y\n*** Delete File: e.js\n*** End Patch";
  assert.deepStrictEqual(lirePatch(patch), [
    { chemin: "a/b.js", sorte: "ajout", ajoute: "const k = 1;\n// fin" },
    { chemin: "d.js", sorte: "modif", ajoute: "y" },
    { chemin: "e.js", sorte: "suppression", ajoute: "" },
  ]);
});

test("hooks posés avec --gardes, fusionnés avec ceux de la personne, retirés sans toucher aux siens", () => {
  const maison = tmp();
  fs.mkdirSync(path.join(maison, ".codex"), { recursive: true });
  fs.writeFileSync(path.join(maison, ".codex", "hooks.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "mon-script" }] }] } }));
  const r = pulseia(maison, ["installer", "--outil", "codex,cursor,opencode,copilot", "--oui", "--sans-global", "--gardes"]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Codex : tapez \/hooks/);
  const codex = lireJson(maison, ".codex", "hooks.json");
  assert.deepStrictEqual(codex.hooks.Stop.map((g) => g.hooks[0].command), ["mon-script", "pulseia hook codex Stop"]);
  assert.strictEqual(codex.hooks.PreToolUse[0].hooks[0].command, "pulseia hook codex PreToolUse");
  const cursor = lireJson(maison, ".cursor", "hooks.json");
  assert.strictEqual(cursor.version, 1);
  assert.deepStrictEqual(Object.keys(cursor.hooks).sort(), ["afterFileEdit", "beforeReadFile", "beforeShellExecution", "preToolUse", "stop"]);
  const copilot = lireJson(maison, ".copilot", "hooks", "pulse.json");
  assert.match(copilot.hooks.PreToolUse[0].bash, /\|\| true$/, "pulseia absent : l'appel passe");
  assert.match(copilot.hooks.PreToolUse[0].powershell, /; exit 0$/);
  assert.ok(fs.existsSync(path.join(maison, ".config", "opencode", "plugins", "pulse-garde-fous.js")));
  // Réinstaller ne double pas les entrées.
  assert.strictEqual(pulseia(maison, ["installer", "--outil", "codex", "--oui", "--sans-global", "--gardes"]).status, 0);
  assert.strictEqual(lireJson(maison, ".codex", "hooks.json").hooks.Stop.length, 2);
  // Désinstaller : le hook de la personne reste, le fichier créé par Pulse disparaît.
  assert.strictEqual(pulseia(maison, ["desinstaller"]).status, 0);
  assert.deepStrictEqual(lireJson(maison, ".codex", "hooks.json"), { hooks: { Stop: [{ hooks: [{ type: "command", command: "mon-script" }] }] } });
  assert.ok(!fs.existsSync(path.join(maison, ".cursor", "hooks.json")));
  assert.ok(!fs.existsSync(path.join(maison, ".copilot", "hooks", "pulse.json")));
  assert.ok(!fs.existsSync(path.join(maison, ".config", "opencode", "plugins", "pulse-garde-fous.js")));
});

test("sans pulseia dans le PATH ni --gardes : pas de hooks (Copilot bloquerait tout), et le dire", () => {
  const maison = tmp();
  const PATH = process.env.PATH.split(path.delimiter).filter((d) => !["pulseia", "pulseia.cmd"].some((f) => fs.existsSync(path.join(d, f)))).join(path.delimiter);
  const r = pulseia(maison, ["installer", "--outil", "copilot", "--oui", "--sans-global"], { PATH, Path: PATH });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Garde-fous non installés/);
  assert.ok(!fs.existsSync(path.join(maison, ".copilot", "hooks")));
  assert.match(pulseia(maison, ["etat"], { PATH, Path: PATH }).stdout, /garde-fous : non/);
});

test("avant un appel d'outil : refus, demande d'accord et commande réécrite, traduits pour chaque outil", () => {
  const maison = tmp();
  const p = projet();
  fs.writeFileSync(path.join(p, ".env"), "CLE=1\n");
  const env = path.join(p, ".env");
  const patchSecret = `*** Begin Patch\n*** Add File: src/app.js\n+const k = "${SECRET}";\n*** End Patch`;

  // Codex : refus direct ; « ask » et commande réécrite deviennent un refus expliqué.
  const codex = (command, tool_name = "Bash") => hook(maison, "codex", "PreToolUse", { session_id: "s", cwd: p, tool_name, tool_input: { command } });
  assert.strictEqual(codex("git push --force origin main").hookSpecificOutput.permissionDecision, "deny");
  assert.match(codex("git reset --hard HEAD~1").hookSpecificOutput.permissionDecisionReason, /lancer elle-même/);
  assert.match(codex("pulse-aidd contexte spec | head -5").hookSpecificOutput.permissionDecisionReason, /sans le tube final/);
  assert.match(codex(patchSecret, "apply_patch").hookSpecificOutput.permissionDecisionReason, /clé secrète/);
  assert.deepStrictEqual(codex("*** Begin Patch\n*** Add File: src/ok.js\n+const n = 1;\n*** End Patch", "apply_patch"), {});
  assert.deepStrictEqual(codex("ls"), {});

  // Cursor : « ask » gardé pour le shell, refus de lecture sans agent_message, toujours un JSON.
  assert.strictEqual(hook(maison, "cursor", "beforeShellExecution", { conversation_id: "c", cwd: p, command: "git reset --hard HEAD~1" }).permission, "ask");
  const lecture = hook(maison, "cursor", "beforeReadFile", { conversation_id: "c", workspace_roots: [p], file_path: env });
  assert.strictEqual(lecture.permission, "deny");
  assert.ok(!("agent_message" in lecture));
  assert.strictEqual(hook(maison, "cursor", "preToolUse", { conversation_id: "c", cwd: p, tool_name: "Write", tool_input: { file_path: path.join(p, "src", "a.js"), content: `const k = "${SECRET}";` } }).permission, "deny");
  assert.deepStrictEqual(hook(maison, "cursor", "beforeShellExecution", { conversation_id: "c", cwd: p, command: "ls" }), { permission: "allow" });

  // Copilot : décision à plat, « ask » gardé.
  assert.deepStrictEqual(Object.keys(hook(maison, "copilot", "PreToolUse", { session_id: "p", cwd: p, tool_name: "Read", tool_input: { path: env } })), ["permissionDecision", "permissionDecisionReason"]);
  assert.strictEqual(hook(maison, "copilot", "PreToolUse", { session_id: "p", cwd: p, tool_name: "Bash", tool_input: { command: "git reset --hard HEAD~1" } }).permissionDecision, "ask");
  assert.strictEqual(hook(maison, "copilot", "PreToolUse", { session_id: "p", cwd: p, tool_name: "Edit", tool_input: { path: path.join(p, "a.js"), old_str: "x", new_str: `"${SECRET}"` } }).permissionDecision, "deny");

  // OpenCode : { refus } lu par le plugin.
  assert.match(hook(maison, "opencode", "execute.before", { sessionID: "o", cwd: p, tool: "read", input: { path: env } }).refus, /\.env/);
  assert.match(hook(maison, "opencode", "execute.before", { sessionID: "o", cwd: p, tool: "patch", input: { patchText: patchSecret } }).refus, /clé secrète/);
  assert.deepStrictEqual(hook(maison, "opencode", "execute.before", { sessionID: "o", cwd: p, tool: "shell", input: { command: "ls" } }), {});

  // Hors d'un projet Pulse : rien n'est contrôlé.
  assert.deepStrictEqual(hook(maison, "codex", "PreToolUse", { session_id: "s", cwd: maison, tool_name: "Bash", tool_input: { command: "git push --force" } }), {});
  // Entrée illisible : l'appel passe.
  const r = spawnSync("node", [PULSEIA, "hook", "codex", "PreToolUse"], { input: "pas du json", encoding: "utf8", env: environnement(maison) });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, "");
});

test("fin de tour : un fichier écrit avec une clé relance l'agent, dans le format de chaque outil", () => {
  const maison = tmp();
  const p = projet();
  fs.mkdirSync(path.join(p, "src"), { recursive: true });
  const fichier = path.join(p, "src", "cle.js");
  fs.writeFileSync(fichier, `const k = "${SECRET}";\n`);
  const motif = /src\/cle\.js : contient une clé secrète/;

  hook(maison, "codex", "PostToolUse", { session_id: "f1", cwd: p, tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Add File: src/cle.js\n+x\n*** End Patch" } });
  const codex = hook(maison, "codex", "Stop", { session_id: "f1", cwd: p, stop_hook_active: false });
  assert.strictEqual(codex.decision, "block");
  assert.match(codex.reason, motif);

  assert.deepStrictEqual(hook(maison, "cursor", "afterFileEdit", { conversation_id: "f2", workspace_roots: [p], file_path: fichier, edits: [{ old_string: "", new_string: "x" }] }), {});
  assert.match(hook(maison, "cursor", "stop", { conversation_id: "f2", workspace_roots: [p], status: "completed", loop_count: 0 }).followup_message, motif);

  hook(maison, "copilot", "PostToolUse", { session_id: "f3", cwd: p, tool_name: "Write", tool_input: { path: fichier, file_text: "x" } });
  assert.strictEqual(hook(maison, "copilot", "Stop", { session_id: "f3", cwd: p, stop_hook_active: false }).decision, "block");

  hook(maison, "opencode", "execute.after", { sessionID: "f4", cwd: p, tool: "write", input: { path: fichier, content: "x" } });
  assert.match(hook(maison, "opencode", "session.idle", { sessionID: "f4", cwd: p }).relance, motif);

  // Tour sans écriture : rien à dire.
  assert.deepStrictEqual(hook(maison, "codex", "Stop", { session_id: "f5", cwd: p }), {});
  assert.deepStrictEqual(hook(maison, "cursor", "stop", { conversation_id: "f6", workspace_roots: [p], loop_count: 0 }), {});
});

test("plugin OpenCode : refuse la lecture de .env (V2 et V1), laisse passer le reste", async () => {
  const maison = tmp();
  const p = projet();
  fs.writeFileSync(path.join(p, ".env"), "CLE=1\n");
  // Un pulseia dans le PATH, comme après npm install -g.
  const bin = tmp();
  if (process.platform === "win32") fs.writeFileSync(path.join(bin, "pulseia.cmd"), `@node "${PULSEIA}" %*\r\n`);
  else {
    fs.writeFileSync(path.join(bin, "pulseia"), `#!/bin/sh\nexec node "${PULSEIA}" "$@"\n`);
    fs.chmodSync(path.join(bin, "pulseia"), 0o755);
  }
  const avant = { PATH: process.env.PATH, PULSEIA_MAISON: process.env.PULSEIA_MAISON };
  const cle = Object.keys(process.env).find((k) => k.toUpperCase() === "PATH");
  process.env[cle] = `${bin}${path.delimiter}${process.env[cle]}`;
  process.env.PULSEIA_MAISON = maison;
  try {
    const plugin = (await import(pathToFileURL(path.join(CLI, "lib", "modeles", "opencode-garde-fous.mjs")).href)).default;
    assert.strictEqual(plugin.id, "pulseia.garde-fous");
    const crochets = {};
    await plugin.setup({ location: { directory: p }, tool: { hook: async (nom, f) => (crochets[nom] = f) } });
    assert.throws(() => crochets["execute.before"]({ tool: "read", input: { path: path.join(p, ".env") }, sessionID: "o" }), /\.env/);
    assert.doesNotThrow(() => crochets["execute.before"]({ tool: "read", input: { path: path.join(p, "CLAUDE.md") }, sessionID: "o" }));
    const v1 = await plugin.server({ directory: p });
    await assert.rejects(v1["tool.execute.before"]({ tool: "read", sessionID: "o", callID: "1" }, { args: { filePath: path.join(p, ".env") } }), /\.env/);
  } finally {
    process.env[cle] = avant.PATH;
    if (avant.PULSEIA_MAISON === undefined) delete process.env.PULSEIA_MAISON;
    else process.env.PULSEIA_MAISON = avant.PULSEIA_MAISON;
  }
});

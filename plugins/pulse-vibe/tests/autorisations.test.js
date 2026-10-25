// Tests de `pulse-aidd autorisations` (scripts/autorisations.js) : les règles d'autorisation utiles à un projet Pulse.
// Lancer : node --test plugins/pulse-vibe/tests/autorisations.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const SCRIPT = path.join(RACINE, "scripts", "autorisations.js");
const { attendues, commandesDuProjet, repriseAuto } = require(SCRIPT);

// Les commandes du pack Next.js, telles que sa fiche les écrit dans docs/technical.md.
const TECHNICAL = fs.readFileSync(path.join(RACINE, "..", "pulse-vibe-next", "references", "technical.md"), "utf8");

function projet(fichiers) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-autorisations-"));
  for (const [f, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), contenu);
  }
  return d;
}
const lancer = (d, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: d, encoding: "utf8" });

test("commandes du projet : les contrôles, jamais l'installation, le déploiement ni la migration", () => {
  const c = commandesDuProjet(projet({ "docs/technical.md": TECHNICAL }));
  for (const attendue of ["npm run dev", "npm test", "npm run test:e2e", "npm run check", "npm run typecheck", "npm run format", "npm run build", "npm audit --omit=dev --audit-level=high"]) {
    assert.ok(c.includes(attendue), `${attendue} : ${c.join(", ")}`);
  }
  for (const exclue of ["npm install", "npx playwright install chromium", "npm run db:migrate", "scripts/migrer.mjs"]) assert.ok(!c.includes(exclue), exclue);
  assert.deepStrictEqual(commandesDuProjet(projet({})), []);
  // Cellule sans accents graves : la cellule est la commande ; « aucune » n'est pas une commande.
  const nues = commandesDuProjet(projet({ "docs/technical.md": "## Commandes du projet\n\n| Action | Commande |\n|---|---|\n| Tester | npm test |\n| Construire | aucune (site statique) |\n" }));
  assert.deepStrictEqual(nues, ["npm test"]);
});

test("règles attendues : clés interdites, Git sans envoi, pulse-aidd sans production ni configuration", () => {
  const a = attendues(projet({ "docs/technical.md": TECHNICAL }));
  assert.ok(a.deny.includes("Read(./.env)"));
  assert.ok(a.allow.includes("Bash(git commit -m *)"));
  assert.ok(a.allow.includes("Bash(pulse-aidd qualite *)") && a.allow.includes("Bash(pulse-aidd reference *)"));
  assert.ok(a.allow.includes("Bash(pulse-aidd preuve *)"), "la preuve des tests, lancée par les agents");
  assert.ok(a.allow.includes("Bash(pulse-aidd verifier --index)"), "le contrôle des fichiers préparés, avant chaque commit");
  assert.ok(a.allow.includes("Bash(npm test)") && a.allow.includes("Bash(npm test *)"));
  const tout = a.allow.join("\n");
  assert.doesNotMatch(tout, /git push|secrets (generer|envoyer|elaguer|redeployer)|installer-|ligne-etat|nouveau|deplacer-commits|pulse-aidd \*\)/);
});

test("chaque sous-commande citée par un agent est autorisée, sauf celles qui passent par l'accord", () => {
  const allow = attendues(projet({})).allow;
  // Comme Claude Code : « X * » couvre aussi « X » seul.
  const couvre = (motif, commande) => (motif.endsWith(" *") && commande === motif.slice(0, -2)) || new RegExp(`^${motif.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(commande);
  const agents = fs.readdirSync(path.join(RACINE, "agents")).map((f) => fs.readFileSync(path.join(RACINE, "agents", f), "utf8")).join("\n");
  const sensibles = /^pulse-aidd (secrets (generer|envoyer|elaguer|redeployer)|installer-|ligne-etat|nouveau)/;
  const oubliees = [...new Set([...agents.matchAll(/`(pulse-aidd [^`]+)`/g)].map((m) => m[1].replace(/<[^>]*>/g, "X").replace(/\[[^\]]*\]/g, "").trim()))]
    .filter((c) => !sensibles.test(c))
    .filter((c) => !allow.some((r) => couvre(r.slice(5, -1), c)));
  assert.deepStrictEqual(oubliees, []);
});

test("en ligne de commande : les manquantes, puis --ecrire les ajoute sans toucher aux règles existantes", () => {
  const d = projet({ "docs/technical.md": TECHNICAL, ".claude/settings.json": JSON.stringify({ permissions: { allow: ["Bash(ls)", "Bash(git status *)"] }, model: "x" }) });
  const avant = lancer(d).stdout;
  assert.match(avant, /^manquantes: \d+$/m);
  assert.match(avant, /^- deny Read\(\.\/\.env\)$/m);
  assert.match(avant, /^- allow Bash\(npm test\)$/m);
  assert.doesNotMatch(avant, /Bash\(git status \*\)/, "déjà présente");
  assert.match(lancer(d, "--ecrire").stdout, /^ecrites: \d+$/m);
  const r = JSON.parse(fs.readFileSync(path.join(d, ".claude", "settings.json"), "utf8"));
  assert.strictEqual(r.model, "x");
  assert.strictEqual(r.permissions.allow[0], "Bash(ls)");
  assert.strictEqual(r.permissions.allow.filter((x) => x === "Bash(git status *)").length, 1);
  assert.match(lancer(d).stdout, /^manquantes: 0$/m);
  // Les règles locales comptent comme présentes.
  const local = projet({ ".claude/settings.local.json": JSON.stringify({ permissions: { allow: ["Bash(pulse-aidd qualite *)"] } }) });
  assert.doesNotMatch(lancer(local).stdout, /pulse-aidd qualite \*\)/);
  // Un fichier illisible reste intact.
  const casse = projet({ ".claude/settings.json": "{ pas du json" });
  assert.match(lancer(casse, "--ecrire").stdout, /^erreur: .*rien n'a été modifié/);
  assert.strictEqual(fs.readFileSync(path.join(casse, ".claude", "settings.json"), "utf8"), "{ pas du json");
});

test("reprise automatique : réglage coupé ou version trop ancienne = desactivee, version illisible = inconnue", () => {
  assert.strictEqual(repriseAuto({ autoContinueAtUsageLimit: false }, "2.1.300"), "desactivee");
  assert.strictEqual(repriseAuto({}, "2.1.200"), "desactivee");
  assert.strictEqual(repriseAuto({}, "2.1.234"), "active");
  assert.strictEqual(repriseAuto(null, "2.2.0"), "active");
  assert.strictEqual(repriseAuto({ autoContinueAtUsageLimit: true }, "3.0.0"), "active");
  assert.strictEqual(repriseAuto({}, null), "inconnue");
  assert.strictEqual(repriseAuto({}, "pas une version"), "inconnue");
  assert.strictEqual(repriseAuto({ autoContinueAtUsageLimit: false }, null), "desactivee");
});

test("la sortie annonce la ligne reprise-auto, sans casser le format des règles", () => {
  const d = projet({});
  const reglages = path.join(d, "utilisateur.json");
  const sortie = (version, contenu) => {
    if (contenu !== undefined) fs.writeFileSync(reglages, contenu);
    return spawnSync(process.execPath, [SCRIPT], { cwd: d, encoding: "utf8", env: { ...process.env, PULSE_REGLAGES_UTILISATEUR: reglages, PULSE_VERSION_CLAUDE: version } }).stdout;
  };
  const a = sortie("2.1.234", "{}");
  assert.match(a, /^reprise-auto: active$/m);
  assert.match(a, /^manquantes: \d+$/m);
  assert.match(sortie("2.1.234", '{"autoContinueAtUsageLimit":false}'), /^reprise-auto: desactivee$/m);
  assert.match(sortie("2.1.1"), /^reprise-auto: desactivee$/m);
  assert.match(sortie("", "{}"), /^reprise-auto: inconnue$/m);
  assert.match(sortie("2.1.234", "pas du json"), /^reprise-auto: active$/m);
});

test("réglage à faux : `claude --version` n'est pas lancé", () => {
  const d = projet({});
  const faux = path.join(d, "faux-bin");
  const marque = path.join(d, "appele.txt");
  fs.mkdirSync(faux);
  if (process.platform === "win32") fs.writeFileSync(path.join(faux, "claude.cmd"), `@echo off\r\necho x> "${marque}"\r\necho 2.1.300\r\n`);
  else fs.writeFileSync(path.join(faux, "claude"), `#!/bin/sh\necho x > "${marque}"\necho 2.1.300\n`, { mode: 0o755 });
  const reglages = path.join(d, "utilisateur.json");
  const lancer = (contenu) => {
    fs.rmSync(marque, { force: true });
    fs.writeFileSync(reglages, contenu);
    const env = { ...process.env, PULSE_REGLAGES_UTILISATEUR: reglages, PATH: `${faux}${path.delimiter}${process.env.PATH}` };
    delete env.PULSE_VERSION_CLAUDE;
    return spawnSync(process.execPath, [SCRIPT], { cwd: d, encoding: "utf8", env }).stdout;
  };
  assert.match(lancer("{}"), /^reprise-auto: active$/m);
  assert.ok(fs.existsSync(marque), "le faux claude est bien lancé quand le réglage n'est pas à faux");
  assert.match(lancer('{"autoContinueAtUsageLimit":false}'), /^reprise-auto: desactivee$/m);
  assert.ok(!fs.existsSync(marque), "claude --version n'est pas lancé");
});

test("cellules nues : « — » vaut « aucune » ; plusieurs commandes, $( ou accents graves : refusées avec une raison claire", () => {
  const { celluleNue, raisonRefus } = require(SCRIPT);
  for (const tiret of ["—", "–", "-", " — "]) assert.deepStrictEqual(celluleNue(tiret), { aucune: true }, tiret);
  for (const plusieurs of ["npm run lint et npm run typecheck", "npm run lint, npm run typecheck", "npm run lint puis npm test", "npm run lint && npm run typecheck", "npm run lint ; npm test"]) {
    const nue = celluleNue(` ${plusieurs} `);
    assert.strictEqual(nue.commande, plusieurs);
    assert.match(nue.refus || "", /une commande par cellule, entre accents graves/, plusieurs);
  }
  assert.strictEqual(celluleNue('npx eslint "src, tests"').refus, undefined, "une virgule entre guillemets reste une seule commande");
  assert.strictEqual(celluleNue("npx vitest --reporter=default,junit").refus, undefined, "virgule sans espace : une seule commande");
  for (const substitution of ["npm test $(whoami)", "npm test `whoami`", "npm test\nwhoami"]) assert.match(raisonRefus(substitution) || "", /substitution|une seule commande/, substitution);
  const nues = commandesDuProjet(
    projet({
      "docs/technical.md":
        "## Commandes du projet\n\n| Action | Commande |\n|---|---|\n| Lancer en local | — |\n| Tester | npm test $(id) |\n| Contrôles automatiques | npm run lint et npm run typecheck |\n| Construire | npm run build |\n",
    }),
  );
  assert.deepStrictEqual(nues, ["npm run build"], "ni « — », ni substitution, ni plusieurs commandes dans une cellule");
});

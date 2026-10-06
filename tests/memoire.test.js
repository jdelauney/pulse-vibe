// Tests de la synchronisation de la mémoire projet.
// Lancer : node --test plugins/pulse/tests/*.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "memoire.js");
const DEBUT = "<!-- pulse_memoire:debut -->";
const FIN = "<!-- pulse_memoire:fin -->";

function projet(fichiers) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-memoire-"));
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    const complet = path.join(dossier, chemin);
    fs.mkdirSync(path.dirname(complet), { recursive: true });
    fs.writeFileSync(complet, contenu, "utf8");
  }
  return dossier;
}

function lancer(dossier, ...args) {
  return spawnSync("node", [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: dossier },
  });
}

const lire = (dossier, chemin) => fs.readFileSync(path.join(dossier, chemin), "utf8");

const BANQUE = {
  "aidd_docs/memory/README.md": "# Mémoire\n\n<!-- fichiers:debut -->\n<!-- fichiers:fin -->\n",
  "aidd_docs/memory/project.md": "# Projet\n",
  "aidd_docs/memory/technical.md": "# Technique\n",
  "aidd_docs/memory/internal/.gitkeep": "",
  "aidd_docs/memory/internal/decisions/0001-stockage-local.md": "# Stockage\n",
  "aidd_docs/memory/external/.gitkeep": "",
};

test("remplit le bloc avec les imports et la liste à la demande", () => {
  const d = projet({ ...BANQUE, "CLAUDE.md": `# Projet\n\n## Mémoire\n\n${DEBUT}\n${FIN}\n\n## Suite\n` });
  const r = lancer(d);
  assert.strictEqual(r.status, 0);
  const claude = lire(d, "CLAUDE.md");
  assert.match(claude, /@aidd_docs\/memory\/project\.md\n@aidd_docs\/memory\/technical\.md/);
  assert.match(claude, /- aidd_docs\/memory\/internal\/decisions\/0001-stockage-local\.md/);
  assert.doesNotMatch(claude, /@aidd_docs\/memory\/README\.md/);
  assert.doesNotMatch(claude, /\.gitkeep/);
  assert.match(claude, /## Suite\n$/, "le reste du fichier est conservé");
});

test("met à jour la liste du README de la mémoire", () => {
  const d = projet({ ...BANQUE, "CLAUDE.md": `${DEBUT}\n${FIN}\n` });
  lancer(d);
  const lisezMoi = lire(d, "aidd_docs/memory/README.md");
  assert.match(lisezMoi, /- \[project\.md\]\(project\.md\)/);
  assert.match(lisezMoi, /- \[internal\/decisions\/0001-stockage-local\.md\]/);
});

test("est idempotent : un second passage ne change rien", () => {
  const d = projet({ ...BANQUE, "CLAUDE.md": `${DEBUT}\n${FIN}\n` });
  lancer(d);
  const premier = lire(d, "CLAUDE.md");
  const r = lancer(d, "--rapport");
  assert.strictEqual(lire(d, "CLAUDE.md"), premier);
  assert.match(r.stdout, /Déjà à jour/);
});

test("ignore un marqueur cité dans un bloc de code", () => {
  const exemple = "```\n" + DEBUT + "\n" + FIN + "\n```\n";
  const d = projet({ ...BANQUE, "CLAUDE.md": exemple });
  const r = lancer(d, "--rapport");
  assert.strictEqual(r.status, 1);
  assert.strictEqual(lire(d, "CLAUDE.md"), exemple);
});

test("préserve les fins de ligne Windows", () => {
  const d = projet({ ...BANQUE, "CLAUDE.md": `# P\r\n${DEBUT}\r\n${FIN}\r\n` });
  lancer(d);
  const claude = lire(d, "CLAUDE.md");
  assert.match(claude, /@aidd_docs\/memory\/project\.md\r\n/);
  assert.doesNotMatch(claude, /[^\r]\n/);
});

test("en mode hook, reste silencieux et ne bloque jamais", () => {
  const d = projet({ "CLAUDE.md": "# Sans bloc\n" });
  const r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, "");
});

test("en mode rapport, signale un bloc absent ou cassé", () => {
  const sansBloc = projet({ ...BANQUE, "CLAUDE.md": "# Sans bloc\n" });
  const r1 = lancer(sansBloc, "--rapport");
  assert.strictEqual(r1.status, 1);
  assert.match(r1.stdout, /ne contient pas le bloc mémoire/);

  const casse = projet({ ...BANQUE, "CLAUDE.md": `${DEBUT}\nsans fin\n` });
  const r2 = lancer(casse, "--rapport");
  assert.strictEqual(r2.status, 1);
  assert.match(r2.stdout, /un seul des deux marqueurs/);
});

test("sans mémoire, ne crée rien", () => {
  const d = projet({ "CLAUDE.md": `${DEBUT}\n${FIN}\n` });
  const r = lancer(d, "--rapport");
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /Pas de mémoire projet/);
  assert.strictEqual(lire(d, "CLAUDE.md"), `${DEBUT}\n${FIN}\n`);
});

const EN_COURS = "aidd_docs/tasks/in-progress.md";
const TRAVAIL = "# Travail en cours\n\n- **Commande** : /pulse:prd\n- **Décision en attente** : Quelles 3 choses livrer dans quinze jours ?\n- **Pour reprendre** : /pulse:prd\n";

test("hook : sans travail en cours, aucune sortie", () => {
  const d = projet({ ...BANQUE, "CLAUDE.md": `${DEBUT}\n${FIN}\n` });
  const r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, "");
});

test("hook : un travail en cours est rappelé, avec la règle « redémarrer n'est pas valider »", () => {
  const d = projet({ ...BANQUE, "CLAUDE.md": `${DEBUT}\n${FIN}\n`, [EN_COURS]: TRAVAIL });
  const r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /^Pulse – travail en cours/);
  assert.match(r.stdout, /Quelles 3 choses livrer dans quinze jours \?/);
  assert.match(r.stdout, /ne vaut pas accord/);
});

test("hook : le travail en cours est rappelé même sans mémoire projet", () => {
  const d = projet({ [EN_COURS]: TRAVAIL });
  const r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /Pulse – travail en cours/);
});

test("hook : un travail en cours très long est tronqué", () => {
  const d = projet({ [EN_COURS]: TRAVAIL + "x".repeat(5000) });
  const r = lancer(d);
  assert.ok(r.stdout.length < 3000, `sortie de ${r.stdout.length} caractères`);
  assert.match(r.stdout, /\(suite tronquée/);
});

test("hook : in-progress.md illisible (dossier), aucune erreur ni sortie", () => {
  const d = projet({ "aidd_docs/tasks/in-progress.md/.gitkeep": "" });
  const r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, "");
});

test("--rapport : le travail en cours n'est pas affiché", () => {
  const d = projet({ ...BANQUE, "CLAUDE.md": `${DEBUT}\n${FIN}\n`, [EN_COURS]: TRAVAIL });
  const r = lancer(d, "--rapport");
  assert.doesNotMatch(r.stdout, /travail en cours/);
});

test("hook : un travail en cours laissé dans un worktree est aussi rappelé, avec son emplacement", () => {
  const d = projet({ ".claude/worktrees/us-003-filtre/aidd_docs/tasks/in-progress.md": TRAVAIL });
  const r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /Pulse – travail en cours \(\.claude\/worktrees\/us-003-filtre\/aidd_docs\/tasks\/in-progress\.md\)/);
  assert.match(r.stdout, /Quelles 3 choses livrer/);
});

test("hook : la coupe à 2 000 caractères ne casse pas un caractère (emoji, accent)", () => {
  const debut = "# Travail en cours\n";
  const d = projet({ [EN_COURS]: debut + "é".repeat(2000 - debut.length - 1) + "📌" + "x".repeat(100) });
  const r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.ok(!r.stdout.includes("�"), "aucune moitié d'emoji orpheline (remplacée par U+FFFD à l'écriture)");
  assert.match(r.stdout, /\(suite tronquée/);
});

test("hook : fichier avec BOM ou encodé en Latin-1, rappel affiché sans erreur", () => {
  const d = projet({});
  fs.mkdirSync(path.join(d, "aidd_docs", "tasks"), { recursive: true });
  fs.writeFileSync(path.join(d, EN_COURS), "﻿# Travail en cours\n- **Décision en attente** : choisir\n", "utf8");
  let r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /^Pulse – travail en cours/);
  fs.writeFileSync(path.join(d, EN_COURS), Buffer.from("# Travail en cours\n- Décision : réponse\n", "latin1"));
  r = lancer(d);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /Pulse – travail en cours/);
});

test("signale une mémoire chargée à 95 % de sa limite, au démarrage comme en rapport", () => {
  const longue = Array.from({ length: 190 }, (_, i) => `- point ${i}`).join("\n");
  const d = projet({ ...BANQUE, "aidd_docs/memory/technical.md": longue, "CLAUDE.md": `${DEBUT}\n${FIN}\n` });
  assert.match(lancer(d).stdout, /mémoire chargée à chaque session compte \d+ lignes/);
  assert.match(lancer(d, "--rapport").stdout, /\/pulse:memory compacter/);
});

test("reste silencieux sur la taille d'une mémoire courte", () => {
  const d = projet({ ...BANQUE, "CLAUDE.md": `${DEBUT}\n${FIN}\n` });
  assert.doesNotMatch(lancer(d).stdout, /de sa limite/);
});

test("reste silencieux juste sous le seuil de 95 %", () => {
  const presque = Array.from({ length: 180 }, (_, i) => `- point ${i}`).join("\n");
  const d = projet({ ...BANQUE, "aidd_docs/memory/technical.md": presque, "CLAUDE.md": `${DEBUT}\n${FIN}\n` });
  assert.doesNotMatch(lancer(d).stdout, /de sa limite/);
});

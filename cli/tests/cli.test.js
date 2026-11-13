// Tests du paquet pulseia : transformations, plan par outil, registre d'installation et relais pulse-aidd.
// Lancer depuis la racine du dépôt : node --test cli/tests/*.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const CLI = path.join(__dirname, "..");
const PULSEIA = path.join(CLI, "bin", "pulseia.js");
const RELAIS = path.join(CLI, "bin", "pulse-aidd.js");
const COEUR = path.join(CLI, "..", "plugins", "pulse-vibe");

const { reecrire, skillPortable, lireFrontmatter, valeur } = require("../lib/textes");
const { decouper, trouverBash } = require("../lib/relais");
const { lireOptions } = require("../lib/cli");
const { IDS } = require("../lib/cibles");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "pulseia-"));
/** Lance pulseia ou le relais avec un dossier personnel temporaire, sans variables d'outil héritées. */
function lancer(script, args, maison, { cwd, env = {} } = {}) {
  const base = { ...process.env, PULSEIA_MAISON: maison };
  for (const v of ["PULSE_OUTIL", "PULSE_SORTIE_MAX", "CODEX_HOME", "COPILOT_HOME", "XDG_CONFIG_HOME"]) delete base[v];
  // Les dossiers bin/ de plugins Pulse installés sur la machine (Claude Code) restent hors du PATH des essais.
  const cle = Object.keys(base).find((k) => k.toUpperCase() === "PATH");
  base[cle] = base[cle]
    .split(path.delimiter)
    .filter((d) => !fs.existsSync(path.join(d, "pulse-pile-next")) && !fs.existsSync(path.join(d, "pulse-aidd.cmd")))
    .join(path.delimiter);
  return spawnSync("node", [script, ...args], { cwd: cwd || maison, encoding: "utf8", env: { ...base, ...env } });
}
const installer = (maison, ...args) => lancer(PULSEIA, ["installer", "--oui", "--sans-global", ...args], maison);
const fichiers = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).filter((f) => fs.statSync(path.join(d, f)).isFile()) : []);
const lire = (...p) => fs.readFileSync(path.join(...p), "utf8");
const commandes = fs.readdirSync(path.join(COEUR, "skills")).filter((n) => fs.existsSync(path.join(COEUR, "skills", n, "SKILL.md")));
const agents = fs.readdirSync(path.join(COEUR, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));

test("réécriture : commandes, agents, questions à choix et installation par /plugin", () => {
  assert.strictEqual(reecrire("Lancer `/pulse:spec` puis `pulse:reviewer`, chaque `/pulse:*`, `/pulse:<commande>`."), "Lancer `/pulse-spec` puis `pulse-reviewer`, chaque `/pulse-*`, `/pulse-<commande>`.");
  assert.strictEqual(reecrire("Demander (AskUserQuestion)"), "Demander (question à choix)");
  assert.strictEqual(reecrire("/plugin install pulse-next@pulseia, puis redémarrer Claude Code."), "npx pulseia installer --pack next, puis redémarrer votre outil d'IA.");
  assert.strictEqual(reecrire("adresse https://exemple.fr/a et mypulse:x"), "adresse https://exemple.fr/a et mypulse:x");
});

test("skill commun : frontmatter Agent Skills, injection remplacée par une première étape, $ARGUMENTS en mots", () => {
  for (const nom of commandes) {
    const texte = skillPortable(nom, lire(COEUR, "skills", nom, "SKILL.md"));
    const { champs, corps } = lireFrontmatter(texte);
    assert.strictEqual(valeur(champs.get("name")), `pulse-${nom}`, nom);
    const description = valeur(champs.get("description"));
    assert.ok(description && description.length <= 1024, `${nom} : description de 1 à 1024 caractères`);
    assert.ok(!champs.has("allowed-tools"), `${nom} : allowed-tools retiré`);
    assert.doesNotMatch(corps, /^!`/m, `${nom} : injection restante`);
    assert.doesNotMatch(corps, /\$ARGUMENTS/, `${nom} : $ARGUMENTS restant`);
    assert.doesNotMatch(corps, /(?<![\w-])pulse:[a-z*<]|AskUserQuestion/, `${nom} : mention Claude Code restante`);
    assert.match(corps, new RegExp(`Première étape\\*\\* : lancer \`pulse-aidd contexte ${nom}\``), `${nom} : première étape`);
  }
});

test("options : outils et pack lus, valeurs inconnues refusées", () => {
  assert.deepStrictEqual(lireOptions(["installer", "--outil", "codex,Cursor", "--pack=next", "--oui"]).outils, ["codex", "cursor"]);
  assert.strictEqual(lireOptions(["--sans-pack"]).pack, null);
  assert.throws(() => lireOptions(["--pack", "rails"]), /pack inconnu/);
  assert.throws(() => lireOptions(["--inconnue"]), /option inconnue/);
});

test("installation pour les 4 outils : skills communs, agents et fichiers propres à chaque outil", () => {
  const maison = tmp();
  const r = installer(maison, "--outil", IDS.join(","));
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  const skills = path.join(maison, ".agents", "skills");
  assert.deepStrictEqual(fs.readdirSync(skills).sort(), commandes.map((n) => `pulse-${n}`).sort());
  for (const nom of commandes) {
    assert.ok(fs.existsSync(path.join(skills, `pulse-${nom}`, "agents", "openai.yaml")), `${nom} : openai.yaml (Codex)`);
    const commande = lire(maison, ".config", "opencode", "commands", `pulse-${nom}.md`);
    assert.match(commande, new RegExp(`^!\`pulse-aidd contexte ${nom}\``, "m"), `${nom} : injection gardée pour OpenCode`);
  }
  for (const a of agents) {
    const toml = lire(maison, ".codex", "agents", `pulse-${a}.toml`);
    assert.match(toml, new RegExp(`^name = "pulse-${a}"$`, "m"));
    assert.match(toml, /^developer_instructions = '''\n[\s\S]+\n'''$/m);
    const cursor = lire(maison, ".cursor", "agents", `pulse-${a}.md`);
    const opencode = lire(maison, ".config", "opencode", "agents", `pulse-${a}.md`);
    const copilot = lire(maison, ".copilot", "agents", `pulse-${a}.agent.md`);
    assert.match(opencode, /^mode: subagent$/m);
    // Lecture seule : reviewer et security-auditor dans chaque format ; implementer écrit.
    if (["reviewer", "security-auditor", "explorer", "verifier"].includes(a)) {
      assert.match(cursor, /^readonly: true$/m, a);
      assert.match(opencode, /action: edit[\s\S]*effect: deny/, a);
      assert.doesNotMatch(copilot, /'edit'/, a);
      assert.match(toml, /Travailler en lecture seule/, a);
    }
    if (a === "implementer") {
      assert.match(cursor, /^readonly: false$/m);
      assert.match(copilot, /'edit'/);
    }
  }
});

test("registre : réinstaller ne change rien, un fichier modifié est gardé, la désinstallation retire le reste", () => {
  const maison = tmp();
  assert.strictEqual(installer(maison, "--outil", "cursor,opencode").status, 0);
  const deuxieme = installer(maison, "--outil", "cursor");
  assert.match(deuxieme.stdout, /0 écrits/);
  // Fichier étranger au même endroit : laissé en place.
  const etranger = path.join(maison, ".cursor", "agents", "mon-agent.md");
  fs.writeFileSync(etranger, "à moi");
  const modifie = path.join(maison, ".agents", "skills", "pulse-spec", "SKILL.md");
  fs.appendFileSync(modifie, "\nMa note.\n");
  const r = lancer(PULSEIA, ["desinstaller", "--outil", "opencode"], maison);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(path.join(maison, ".config", "opencode", "commands", "pulse-spec.md")), "commande OpenCode retirée");
  assert.ok(fs.existsSync(path.join(maison, ".cursor", "agents", "pulse-reviewer.md")), "Cursor gardé");
  const tout = lancer(PULSEIA, ["desinstaller"], maison);
  assert.match(tout.stdout, /gardé : .*SKILL\.md/);
  assert.ok(fs.existsSync(modifie), "fichier modifié gardé");
  assert.ok(fs.existsSync(etranger), "fichier étranger gardé");
  assert.deepStrictEqual(fichiers(path.join(maison, ".agents", "skills")).map((f) => f.replace(/\\/g, "/")), ["pulse-spec/SKILL.md"]);
  assert.deepStrictEqual(fichiers(path.join(maison, ".cursor", "agents")), ["mon-agent.md"]);
  assert.ok(!fs.existsSync(path.join(maison, ".pulseia")), "registre retiré");
});

test("sans terminal ni --oui ni --outil : l'aide, et rien d'installé", () => {
  const maison = tmp();
  const r = lancer(PULSEIA, [], maison);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /pulseia installer/);
  assert.deepStrictEqual(fichiers(maison), []);
});

test("découpage d'une sortie longue : parties sous la taille, rien de perdu", () => {
  const texte = Array.from({ length: 500 }, (_, i) => `ligne ${i} ${"x".repeat(i % 50)}`).join("\n") + "\n" + "y".repeat(2500);
  const parties = decouper(texte, 1000);
  assert.ok(parties.length > 5);
  assert.ok(parties.every((p) => p.length <= 1000));
  assert.strictEqual(parties.join(""), texte);
});

test("relais pulse-aidd : contexte réécrit, note des outils, sortie en parties, pack choisi dans le PATH", { skip: !trouverBash() && "bash introuvable" }, () => {
  const maison = tmp();
  assert.strictEqual(installer(maison, "--outil", "codex", "--pack", "next").status, 0);
  const entier = lancer(RELAIS, ["contexte", "spec"], maison, { env: { PULSE_SORTIE_MAX: "10000000" } });
  assert.strictEqual(entier.status, 0, entier.stderr);
  assert.match(entier.stdout, /Pulse dans votre outil d'IA/);
  assert.doesNotMatch(entier.stdout, /(?<![\w-])pulse:[a-z*<]|AskUserQuestion/);
  const premiere = lancer(RELAIS, ["contexte", "spec"], maison, { env: { PULSE_SORTIE_MAX: "4000" } });
  const suite = /pulse-aidd suite ([0-9a-f]{10}) 2/.exec(premiere.stdout);
  assert.ok(suite, premiere.stdout.slice(-300));
  const total = Number(/Partie 1\/(\d+)/.exec(premiere.stdout)[1]);
  let recolle = premiere.stdout.replace(/\n\[Pulse\] Partie .*\n$/, "");
  for (let n = 2; n <= total; n++) recolle += lancer(RELAIS, ["suite", suite[1], String(n)], maison).stdout.replace(/\n\[Pulse\] Partie .*\n$/, "");
  assert.strictEqual(recolle, entier.stdout);
  assert.match(lancer(RELAIS, ["piles"], maison).stdout, /^- next : /m);
  const projet = tmp();
  const nouveau = lancer(RELAIS, ["nouveau", "Essai", "--oui", "--sans-git"], maison, { cwd: projet });
  assert.strictEqual(nouveau.status, 0, nouveau.stderr);
  assert.ok(fs.existsSync(path.join(projet, "essai", "AGENTS.md")), "AGENTS.md hors de Claude Code");
});

test("relais pulse-aidd : sans pack choisi, aucun pack de pile visible", { skip: !trouverBash() && "bash introuvable" }, () => {
  const maison = tmp();
  assert.strictEqual(installer(maison, "--outil", "cursor").status, 0);
  const r = lancer(RELAIS, ["piles"], maison);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Aucun pack de pile installé/);
});

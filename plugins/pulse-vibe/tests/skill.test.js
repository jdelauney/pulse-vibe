// Tests de `pulse-aidd skill mesurer|verifier|usage` (scripts/skill.js) : tailles d'une skill, règles K vérifiables
// par script (references/skills/regles-skills.md), sur des skills fabriquées dans un dossier temporaire.
// Lancer : node --test plugins/pulse-vibe/tests/skill.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const SCRIPT = path.join(RACINE, "scripts", "skill.js");
const { mesurer, verifier } = require(SCRIPT);

const lancer = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

function dossierTemporaire(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-skill-"));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}

function ecrire(racine, fichier, contenu) {
  const chemin = path.join(racine, ...fichier.split("/"));
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(chemin, contenu);
  return chemin;
}

const CORPS = `# Résumer

## Objectif

Résumer un fichier texte en cinq points.

## Règles

- Garder les mots de l'auteur.

## Contexte

Le fichier est donné par la personne.

## Processus

1. Lire le fichier.
2. Écrire cinq points.

## Exemples

« Résume notes.txt » → cinq points.

## Références

Aucune.
`;

const skill = ({ entete = {}, corps = CORPS } = {}) => {
  const champs = { name: "resumer", description: "Résume un fichier texte en cinq points. À utiliser quand la personne demande un résumé.", "allowed-tools": "Read Bash(wc -l *)", ...entete };
  const lignes = Object.entries(champs).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lignes.join("\n")}\n---\n\n${corps}`;
};

const constats = (liste, regle, gravite) => liste.filter((c) => c.regle === regle && (!gravite || c.gravite === gravite));

test("skill saine : aucun constat bloquant, code 0", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "resumer/SKILL.md", skill());
  assert.deepStrictEqual(verifier(path.join(d, "resumer")).filter((c) => c.gravite === "bloquant"), []);
  const r = lancer("verifier", path.join(d, "resumer"));
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^bilan: 0 bloquants · \d+ à corriger · \d+ conseils$/m);
});

test("K4 : Bash(*) et Bash(git push *) autorisés d'avance → bloquant, code 1", (t) => {
  const d = dossierTemporaire(t);
  for (const [nom, motif] of [["tout", "Bash(*)"], ["envoi", "Read Bash(git push *)"], ["git", "Bash(git *)"], ["nu", "Read Bash"]]) {
    ecrire(d, `${nom}/SKILL.md`, skill({ entete: { "allowed-tools": motif } }));
    const k4 = constats(verifier(path.join(d, nom)), "K4", "bloquant");
    assert.strictEqual(k4.length, 1, `${motif} : ${JSON.stringify(k4)}`);
    assert.match(k4[0].fichier, /SKILL\.md$/);
    assert.strictEqual(k4[0].ligne, 4, "la ligne de allowed-tools");
  }
  const r = lancer("verifier", path.join(d, "envoi"));
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /^K4 · bloquant · .*SKILL\.md:4 · .*git push/m);
  // Un motif précis reste permis.
  ecrire(d, "precis/SKILL.md", skill({ entete: { "allowed-tools": "Bash(git status *) Bash(git diff *) Write(docs/**)" } }));
  assert.deepStrictEqual(constats(verifier(path.join(d, "precis")), "K4"), []);
});

test("K2 : description de 1 100 caractères, absente, sans en-tête ou en-tête invalide → bloquant, jamais une exception", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "longue/SKILL.md", skill({ entete: { description: "a".repeat(1100) } }));
  ecrire(d, "absente/SKILL.md", skill({ entete: { description: undefined } }));
  ecrire(d, "sans-entete/SKILL.md", CORPS);
  ecrire(d, "invalide/SKILL.md", `---\nname: invalide\ndescription: Résume un fichier.\nceci n'est pas une clé\n---\n\n${CORPS}`);
  ecrire(d, "non-fermee/SKILL.md", `---\nname: ouverte\ndescription: Résume un fichier.\n\n${CORPS}`);
  for (const nom of ["longue", "absente", "sans-entete", "invalide", "non-fermee"]) {
    let liste;
    assert.doesNotThrow(() => (liste = verifier(path.join(d, nom))), nom);
    assert.strictEqual(constats(liste, "K2", "bloquant").length, 1, `${nom} : ${JSON.stringify(liste)}`);
    const r = lancer("verifier", path.join(d, nom));
    assert.strictEqual(r.status, 1, nom);
    assert.strictEqual(r.stderr, "", `${nom} : sans erreur Node`);
  }
});

test("K2 : skill invocable par le modèle sans « À utiliser quand » → à corriger ; lancée par la personne seule → rien", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "invocable/SKILL.md", skill({ entete: { description: "Résume un fichier texte en cinq points." } }));
  ecrire(d, "personne/SKILL.md", skill({ entete: { description: "Résume un fichier texte en cinq points.", "disable-model-invocation": "true" } }));
  ecrire(d, "anglais/SKILL.md", skill({ entete: { description: "Summarise a text file in five points. Use when the user asks for a summary." } }));
  assert.strictEqual(constats(verifier(path.join(d, "invocable")), "K2", "a-corriger").length, 1);
  assert.deepStrictEqual(constats(verifier(path.join(d, "personne")), "K2"), []);
  assert.deepStrictEqual(constats(verifier(path.join(d, "anglais")), "K2"), []);
});

test("en-tête : valeurs sur plusieurs lignes (> et |) et entre guillemets lues", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "pliee/SKILL.md", `---\nname: pliee\ndescription: >\n  Résume un fichier texte en cinq points.\n  À utiliser quand la personne demande un résumé.\nallowed-tools: "Read"\n---\n\n${CORPS}`);
  ecrire(d, "litterale/SKILL.md", `---\nname: litterale\ndescription: |\n  Résume un fichier texte.\n  Use when asked.\n---\n\n${CORPS}`);
  for (const nom of ["pliee", "litterale"]) assert.deepStrictEqual(constats(verifier(path.join(d, nom)), "K2"), [], nom);
  const [m] = mesurer(path.join(d, "pliee"));
  assert.strictEqual(m.description, "Résume un fichier texte en cinq points. À utiliser quand la personne demande un résumé.".length);
});

test("K5 : Processus placé après 20 000 caractères → bloquant ; sa position est mesurée", (t) => {
  const d = dossierTemporaire(t);
  const long = CORPS.replace("## Processus", `${"Une phrase de contexte qui allonge la skill. ".repeat(450)}\n\n## Processus`);
  ecrire(d, "tardive/SKILL.md", skill({ corps: long }));
  const k5 = constats(verifier(path.join(d, "tardive")), "K5", "bloquant");
  assert.strictEqual(k5.length, 1, JSON.stringify(k5));
  assert.ok(mesurer(path.join(d, "tardive"))[0].processusFin > 5000);
  ecrire(d, "tot/SKILL.md", skill());
  assert.deepStrictEqual(constats(verifier(path.join(d, "tot")), "K5", "bloquant"), []);
  assert.ok(mesurer(path.join(d, "tot"))[0].processusFin < 500);
});

test("K5 : Processus tardif avec une ligne de rechargement après compaction, placée tôt → à corriger, pas bloquant", (t) => {
  const d = dossierTemporaire(t);
  const remplissage = `${"Une phrase de contexte qui allonge la skill. ".repeat(450)}\n\n## Processus`;
  const avecLigne = (nom, ligne, tard = false) => {
    let corps = CORPS.replace("## Processus", remplissage);
    corps = tard ? `${corps}\n${ligne}\n` : corps.replace("- Garder les mots de l'auteur.", `- Garder les mots de l'auteur.\n- ${ligne}`);
    ecrire(d, `${nom}/SKILL.md`, skill({ corps }));
    return constats(verifier(path.join(d, nom)), "K5").filter((c) => /Processus à/.test(c.message)).map((c) => c.gravite);
  };
  assert.deepStrictEqual(avecLigne("etape", "Après une compaction, lancer `pulse-aidd etape etape` et suivre sa sortie."), ["a-corriger"]);
  assert.deepStrictEqual(avecLigne("relire", "Après un compactage, relire `.claude/skills/relire/SKILL.md` en entier."), ["a-corriger"]);
  assert.deepStrictEqual(avecLigne("sans-commande", "Après une compaction, se souvenir du Processus."), ["bloquant"], "une phrase sans commande qui réaffiche les consignes");
  assert.deepStrictEqual(avecLigne("autre-skill", "Après une compaction, lancer `pulse-aidd etape commit`."), ["bloquant"], "les consignes d'une autre commande");
  assert.deepStrictEqual(avecLigne("tardive", "Après une compaction, lancer `pulse-aidd etape tardive`.", true), ["bloquant"], "une ligne placée après la coupure serait perdue avec le reste");
});

test("K7 : une injection de plus de 30 000 caractères → à corriger (coût à chaque lancement), pas bloquant", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "injection/SKILL.md", skill({ corps: `${CORPS}\n!\`pulse-aidd reference rediger/detecteur-tics-llm.json\`\n` }));
  const k7 = constats(verifier(path.join(d, "injection")), "K7");
  assert.deepStrictEqual(k7.map((c) => c.gravite), ["a-corriger"], JSON.stringify(k7));
  assert.match(k7[0].message, /à chaque lancement/);
  assert.match(lancer("mesurer", path.join(d, "injection")).stdout, /^au-dela-30000: !pulse-aidd reference rediger\/detecteur-tics-llm\.json$/m);
});

test("K7 : references/gros.md de 31 000 caractères → bloquant ; mesurer le signale au-delà de 30 000", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "lourde/SKILL.md", skill());
  ecrire(d, "lourde/references/gros.md", "é".repeat(31000));
  ecrire(d, "lourde/assets/modele.md", "# Modèle\n");
  const k7 = constats(verifier(path.join(d, "lourde")), "K7", "bloquant");
  assert.strictEqual(k7.length, 1);
  assert.match(k7[0].fichier, /references\/gros\.md$/);
  const r = lancer("mesurer", path.join(d, "lourde"));
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^reference: references\/gros\.md 31000 car$/m);
  assert.match(r.stdout, /^reference: assets\/modele\.md 9 car$/m);
  assert.match(r.stdout, /^au-dela-30000: references\/gros\.md$/m);
  // Un fichier de données lu par un script : à corriger, pas bloquant.
  ecrire(d, "donnees/SKILL.md", skill());
  ecrire(d, "donnees/references/listes.json", JSON.stringify({ mots: "x".repeat(31000) }));
  assert.deepStrictEqual(constats(verifier(path.join(d, "donnees")), "K7").map((c) => c.gravite), ["a-corriger"]);
});

test("K9 : « Ne jamais » trois fois → conseil", (t) => {
  const d = dossierTemporaire(t);
  const negatif = CORPS.replace("- Garder les mots de l'auteur.", "- Ne jamais inventer.\n- Ne jamais couper.\n- Ne jamais traduire.");
  ecrire(d, "negative/SKILL.md", skill({ corps: negatif }));
  const k9 = constats(verifier(path.join(d, "negative")), "K9");
  assert.strictEqual(k9.length, 1, JSON.stringify(k9));
  assert.strictEqual(k9[0].gravite, "conseil");
  ecrire(d, "positive/SKILL.md", skill());
  assert.deepStrictEqual(constats(verifier(path.join(d, "positive")), "K9"), []);
});

const AGENT = (entete, corps = "Relire le code en lecture seule.\n") => `---\nname: relecteur\ndescription: Relire le code d'une tâche en lecture seule.\n${entete}---\n\n${corps}`;

test("K11 : agent qui cite Write avec disallowedTools: Write → bloquant ; outil présent dans tools → rien", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "agents/relecteur.md", AGENT("disallowedTools: Write, Edit\nmodel: sonnet\n", "Écrire le rapport avec Write dans docs/.\n"));
  const k11 = constats(verifier(path.join(d, "agents", "relecteur.md")), "K11", "bloquant");
  assert.strictEqual(k11.length, 1, JSON.stringify(k11));
  assert.match(k11[0].message, /Write/);
  assert.strictEqual(k11[0].ligne, 8);
  ecrire(d, "agents2/agents/lecteur.md", AGENT("tools: Read, Grep\nmodel: sonnet\n", "Chercher avec `Grep`, puis lancer Bash.\n"));
  const k11b = constats(verifier(path.join(d, "agents2")), "K11", "bloquant");
  assert.deepStrictEqual(k11b.map((c) => /Bash/.test(c.message)), [true], "Bash cité, absent de tools ; Grep présent");
});

test("K11 : agent sans model → conseil hors Pulse, à corriger dans un plugin pulse", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "projet/agents/relecteur.md", AGENT("tools: Read\n"));
  const hors = constats(verifier(path.join(d, "projet")), "K11");
  assert.deepStrictEqual(hors.map((c) => c.gravite), ["conseil"]);
  ecrire(d, "plugin/.claude-plugin/plugin.json", JSON.stringify({ name: "pulse", version: "0.53.0" }));
  ecrire(d, "plugin/agents/relecteur.md", AGENT("tools: Read\n"));
  assert.deepStrictEqual(constats(verifier(path.join(d, "plugin")), "K11").map((c) => c.gravite), ["a-corriger"], "plugin pulse reconnu par son manifeste");
  assert.deepStrictEqual(constats(verifier(path.join(d, "projet"), { pulse: true }), "K11").map((c) => c.gravite), ["a-corriger"], "option pulse");
});

test("CRLF et BOM : mêmes mesures qu'en LF", (t) => {
  const d = dossierTemporaire(t);
  const texte = skill();
  ecrire(d, "lf/SKILL.md", texte);
  ecrire(d, "lf/references/regles.md", "Règle accentuée : élève.\nDeuxième ligne.\n");
  ecrire(d, "crlf/SKILL.md", "﻿" + texte.replace(/\n/g, "\r\n"));
  ecrire(d, "crlf/references/regles.md", "﻿Règle accentuée : élève.\r\nDeuxième ligne.\r\n");
  const [a] = mesurer(path.join(d, "lf"));
  const [b] = mesurer(path.join(d, "crlf"));
  for (const cle of ["skillMd", "frontmatter", "description", "processusFin", "references"]) assert.deepStrictEqual(b[cle], a[cle], cle);
  assert.deepStrictEqual(verifier(path.join(d, "crlf")).map((c) => c.regle), verifier(path.join(d, "lf")).map((c) => c.regle));
});

test("dossier de deux skills avec 6 lignes identiques → recoupement, et la somme des descriptions", (t) => {
  const d = dossierTemporaire(t);
  const commun = ["Lire le fichier en entier.", "Noter chaque titre.", "Garder les chiffres.", "Citer la source.", "Relire le résumé.", "Montrer le résultat."].join("\n");
  ecrire(d, "skills/alpha/SKILL.md", skill({ corps: CORPS.replace("Aucune.", commun) }));
  ecrire(d, "skills/beta/SKILL.md", skill({ entete: { name: "beta" }, corps: `# Bêta\n\n## Processus\n\n${commun}\n` }));
  ecrire(d, "skills/gamma/SKILL.md", skill({ entete: { name: "gamma" }, corps: `# Gamma\n\n## Étapes\n\n${commun.split("\n").slice(0, 5).join("\n")}\n` }));
  const r = lancer("mesurer", path.join(d, "skills"));
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^skill: alpha$/m);
  assert.match(r.stdout, /^skill: beta$/m);
  assert.match(r.stdout, /^recoupement: alpha beta 6 lignes$/m);
  assert.doesNotMatch(r.stdout, /^recoupement: .*gamma/m, "5 lignes : en dessous du seuil");
  const description = "Résume un fichier texte en cinq points. À utiliser quand la personne demande un résumé.".length;
  assert.match(r.stdout, new RegExp(`^descriptions-total: ${description * 3} car$`, "m"));
  assert.strictEqual(constats(verifier(path.join(d, "skills")), "K8").length, 1);
});

test("plugin : chaque skill et chaque agent, avec leur description", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, ".claude-plugin/plugin.json", JSON.stringify({ name: "outils", version: "1.0.0" }));
  ecrire(d, "skills/resumer/SKILL.md", skill({ entete: { "disable-model-invocation": "true" } }));
  ecrire(d, "agents/relecteur.md", AGENT("tools: Read\nmodel: haiku\n"));
  const r = lancer("mesurer", d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^skill: resumer$/m);
  assert.match(r.stdout, /^agent: relecteur$/m);
  assert.match(r.stdout, new RegExp(`^descriptions-total: ${"Relire le code d'une tâche en lecture seule.".length} car$`, "m"), "seuls les textes chargés en permanence");
  assert.match(r.stdout, /^skill-md: \d+ car · \d+ jetons estimés$/m);
  assert.match(r.stdout, /^processus-fin: \d+ jetons estimés$/m);
});

test("injections : !pulse-aidd … mesurée, une autre commande « non mesurée »", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "injectee/SKILL.md", skill({ corps: `${CORPS}\n!\`pulse-aidd modele lexique.md\`\n\n!\`ls -la\`\n` }));
  const r = lancer("mesurer", path.join(d, "injectee"));
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^injection: pulse-aidd modele lexique\.md [1-9]\d* car$/m);
  assert.match(r.stdout, /^injection: ls -la non mesurée$/m);
});

test("chemin inexistant → code 1 et usage ; action inconnue → code 1", () => {
  for (const action of ["mesurer", "verifier"]) {
    const r = lancer(action, path.join(os.tmpdir(), "pulse-skill-inexistant", "rien"));
    assert.strictEqual(r.status, 1, action);
    assert.match(r.stdout, /introuvable/);
    assert.match(r.stdout, /Usage : pulse-aidd skill/);
  }
  assert.strictEqual(lancer().status, 1);
  assert.strictEqual(lancer("ranger", ".").status, 1);
});

test("fichier hors format (règle Cursor) → signalé, code 1", (t) => {
  const d = dossierTemporaire(t);
  const f = ecrire(d, "regle.mdc", "---\ndescription: x\n---\nTexte.\n");
  const r = lancer("verifier", f);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /^hors-format: /m);
});

test("chemin sous plugins/cache/ → installe: oui en tête", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "plugins/cache/pulseia/outils/1.0.0/skills/resumer/SKILL.md", skill());
  const r = lancer("verifier", path.join(d, "plugins", "cache", "pulseia", "outils", "1.0.0", "skills", "resumer"));
  assert.strictEqual(r.stdout.split("\n")[0], "installe: oui");
  ecrire(d, "projet/resumer/SKILL.md", skill());
  assert.doesNotMatch(lancer("verifier", path.join(d, "projet", "resumer")).stdout, /installe:/);
});

test("pulse-aidd skill relaie vers scripts/skill.js", (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "resumer/SKILL.md", skill());
  const r = spawnSync("bash", ["bin/pulse-aidd", "skill", "mesurer", path.join(d, "resumer").split(path.sep).join("/")], { cwd: RACINE, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^skill: resumer$/m);
  const aide = spawnSync("bash", ["bin/pulse-aidd"], { cwd: RACINE, encoding: "utf8" }).stdout;
  assert.match(aide, /pulse-aidd skill mesurer\|verifier <chemin>/);
  assert.match(aide, /pulse-aidd skill usage \[--depuis AAAA-MM-JJ\] \[--projets <dossier>\]/);
});

test("regles-skills.md : K1 à K14, chacune avec son niveau, sa gravité et un avant → après ; sous 12 000 caractères", () => {
  const texte = fs.readFileSync(path.join(RACINE, "references", "skills", "regles-skills.md"), "utf8");
  assert.ok(texte.length < 12000, `${texte.length} caractères`);
  const sections = texte.split(/^## (?=K\d+ )/m).slice(1);
  assert.deepStrictEqual(sections.map((s) => s.match(/^K\d+/)[0]), Array.from({ length: 14 }, (_, i) => `K${i + 1}`));
  for (const s of sections) {
    const id = s.match(/^K\d+/)[0];
    assert.match(s, /\b(Universelle|universelle|Convention|convention)\b/, `${id} : niveau`);
    assert.match(s, /(bloquant|à corriger|conseil)/, `${id} : gravité`);
    assert.match(s, /\b(script|jugement)\b/, `${id} : vérification`);
    assert.match(s, /^- Avant → après : .+ → .+$/m, `${id} : exemple`);
  }
});

// ---------------------------------------------------------------- pulse-aidd skill usage : l'historique des sessions

const ligneJson = (o) => JSON.stringify(o);
const commande = (nom, quand, enBlocs = false) => {
  const texte = `<command-message>${nom} is running…</command-message>\n<command-name>/${nom}</command-name>\n<command-args>T3</command-args>`;
  return ligneJson({ type: "user", timestamp: quand, message: { role: "user", content: enBlocs ? [{ type: "text", text: texte }] : texte } });
};
const appelSkill = (nom, quand) => ligneJson({ type: "assistant", timestamp: quand, message: { role: "assistant", content: [{ type: "text", text: "Je lance la skill." }, { type: "tool_use", id: "t1", name: "Skill", input: { skill: nom } }] } });

const lancerAsync = (...args) =>
  new Promise((resoudre) => {
    const enfant = require("child_process").spawn(process.execPath, [SCRIPT, ...args]);
    let stdout = "";
    let stderr = "";
    enfant.stdout.on("data", (d) => (stdout += d));
    enfant.stderr.on("data", (d) => (stderr += d));
    enfant.on("close", (status) => resoudre({ status, stdout, stderr }));
  });

test("usage : lancements par la personne et par le modèle, ligne cassée ignorée, période bornée", async (t) => {
  const d = dossierTemporaire(t);
  ecrire(d, "projets/p1/s1.jsonl", [
    commande("pulse:review", "2026-10-20T10:00:00.000Z"),
    "{ ceci n'est pas du JSON",
    appelSkill("superpowers:brainstorming", "2026-10-20T11:00:00.000Z"),
    commande("pulse:plan", "2019-03-01T10:00:00.000Z"), // avant --depuis : hors période
    ligneJson({ type: "user", timestamp: "2026-10-20T12:00:00.000Z", message: { role: "user", content: "Parlons de /pulse:spec sans la lancer" } }),
  ].join("\n") + "\n");
  ecrire(d, "projets/p2/s2.jsonl", [appelSkill("superpowers:brainstorming", "2026-10-21T09:00:00.000Z"), commande("pulse:review", "2026-10-19T08:00:00.000Z", true)].join("\n"));
  const vieux = ecrire(d, "projets/p2/vieux.jsonl", commande("pulse:review", "2019-06-01T10:00:00.000Z") + "\n");
  fs.utimesSync(vieux, new Date("2019-06-01T10:00:00Z"), new Date("2019-06-01T10:00:00Z"));
  const r = await lancerAsync("usage", "--depuis", "2020-01-01", "--projets", path.join(d, "projets"));
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^periode: 2020-01-01 → \d{4}-\d{2}-\d{2}$/m);
  assert.match(r.stdout, /^fichiers-lus: 2$/m, "le fichier daté d'avant --depuis n'est pas lu");
  assert.match(r.stdout, /^usage: pulse:review · personne 2 · modele 0 · dernier 2026-10-20$/m);
  assert.match(r.stdout, /^usage: superpowers:brainstorming · personne 0 · modele 2 · dernier 2026-10-21$/m);
  assert.doesNotMatch(r.stdout, /pulse:plan|pulse:spec/);
  assert.strictEqual(r.stderr, "");
});

test("usage : historique absent → « historique: absent », code 0 ; date mal écrite → code 1", async (t) => {
  const d = dossierTemporaire(t);
  const absent = await lancerAsync("usage", "--projets", path.join(d, "rien"));
  assert.strictEqual(absent.status, 0, absent.stderr);
  assert.match(absent.stdout, /^historique: absent$/m);
  const mauvaise = await lancerAsync("usage", "--depuis", "26/10/2026", "--projets", d);
  assert.strictEqual(mauvaise.status, 1);
  assert.match(mauvaise.stdout, /AAAA-MM-JJ/);
});

test("usage : période par défaut de 90 jours", async (t) => {
  const d = dossierTemporaire(t);
  fs.mkdirSync(path.join(d, "projets"));
  const r = await lancerAsync("usage", "--projets", path.join(d, "projets"));
  assert.strictEqual(r.status, 0, r.stderr);
  const [, du, au] = r.stdout.match(/^periode: (\S+) → (\S+)$/m);
  assert.strictEqual(Math.round((new Date(au) - new Date(du)) / 86400000), 90);
  assert.match(r.stdout, /^fichiers-lus: 0$/m);
});

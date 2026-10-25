// Tests du marqueur « réalisation en cours » (aidd_docs/tasks/realisation.json).
// Lancer : node --test plugins/pulse-vibe/tests/realisation.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "realisation.js");
const MARQUEUR = path.join("aidd_docs", "tasks", "realisation.json");

function projet(pulse = true) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-realisation-"));
  if (pulse) fs.writeFileSync(path.join(d, "CLAUDE.md"), "# P\n\n<!-- pulse_profil:debut -->\n<!-- pulse_profil:fin -->\n");
  return d;
}

function lancer(dossier, ...args) {
  return spawnSync("node", [SCRIPT, ...args], {
    encoding: "utf8",
    cwd: dossier,
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", CLAUDE_PLUGIN_ROOT: "" },
  });
}

const marqueur = (dossier) => JSON.parse(fs.readFileSync(path.join(dossier, MARQUEUR), "utf8"));

test("debut crée le marqueur avec l'US, la commande, le rythme et l'autonomie", () => {
  const d = projet();
  const r = lancer(d, "debut", "US-003", "--commande", "spirc", "--rythme", "rapide", "--autonome");
  assert.strictEqual(r.status, 0, r.stderr);
  const m = marqueur(d);
  assert.strictEqual(m.us, "US-003");
  assert.strictEqual(m.commande, "spirc");
  assert.strictEqual(m.rythme, "rapide");
  assert.strictEqual(m.autonome, true);
  assert.strictEqual(m.questions, 0);
  assert.ok(!Number.isNaN(Date.parse(m.debut)) && !Number.isNaN(Date.parse(m.maj)));
  assert.deepStrictEqual(fs.readdirSync(path.dirname(path.join(d, MARQUEUR))), ["realisation.json"], "pas de fichier temporaire oublié");
});

test("debut sans --autonome : autonome faux", () => {
  const d = projet();
  lancer(d, "debut", "US-001", "--commande", "implement", "--rythme", "complet");
  assert.strictEqual(marqueur(d).autonome, false);
});

test("etape et questions mettent à jour tache, etape, questions et maj", () => {
  const d = projet();
  lancer(d, "debut", "US-003", "--commande", "spirc", "--rythme", "complet");
  const avant = marqueur(d).maj;
  assert.strictEqual(lancer(d, "etape", "T2", "examen").status, 0);
  assert.strictEqual(lancer(d, "questions", "3").status, 0);
  const m = marqueur(d);
  assert.strictEqual(m.tache, "T2");
  assert.strictEqual(m.etape, "examen");
  assert.strictEqual(m.questions, 3);
  assert.ok(Date.parse(m.maj) >= Date.parse(avant));
});

test("fin supprime le marqueur ; sans marqueur, la commande nue n'affiche rien", () => {
  const d = projet();
  const vide = lancer(d);
  assert.strictEqual(vide.status, 0);
  assert.strictEqual(vide.stdout, "");
  lancer(d, "debut", "US-003", "--commande", "spirc", "--rythme", "complet");
  const nue = lancer(d);
  assert.match(nue.stdout, /^us: US-003$/m);
  assert.match(nue.stdout, /^rythme: complet$/m);
  assert.strictEqual(lancer(d, "fin").status, 0);
  assert.ok(!fs.existsSync(path.join(d, MARQUEUR)));
  assert.strictEqual(lancer(d, "fin").status, 0, "fin sans marqueur : sans erreur");
  assert.strictEqual(lancer(d).stdout, "");
});

test("etape sans marqueur : sans erreur, rien n'est créé", () => {
  const d = projet();
  assert.strictEqual(lancer(d, "etape", "T1", "test").status, 0);
  assert.ok(!fs.existsSync(path.join(d, MARQUEUR)));
});

test("lire et rappel : où on en est", () => {
  const { lire, rappel } = require(SCRIPT);
  const d = projet();
  assert.strictEqual(lire(d), null);
  assert.strictEqual(rappel(d), "");
  lancer(d, "debut", "US-003", "--commande", "spirc", "--rythme", "rapide");
  lancer(d, "etape", "T2", "examen");
  const texte = rappel(d);
  assert.match(texte, /US-003/);
  assert.match(texte, /T2/);
  assert.match(texte, /examen/);
  assert.ok(!/question/.test(texte));
  lancer(d, "questions", "2");
  assert.match(rappel(d), /2 questions vous attendent/);
  lancer(d, "questions", "1");
  assert.match(rappel(d), /1 question vous attend/);
  assert.strictEqual(lire(d).questions, 1);
});

test("rappel : redonne la commande à recharger (une compaction ne garde que le début du skill)", () => {
  const { rappel } = require(SCRIPT);
  for (const commande of ["spirc", "implement"]) {
    const d = projet();
    lancer(d, "debut", "US-003", "--commande", commande, "--rythme", "rapide");
    const texte = rappel(d);
    assert.match(texte, new RegExp(`Rechargez vos instructions : lancez \`pulse-aidd etape ${commande}\``));
    // La sortie dépasse 30 000 caractères : Claude Code l'enregistre dans un fichier, à lire en entier.
    assert.match(texte, /lisez toute la sortie[^\n]*fichier enregistré/);
  }
  const d = projet();
  lancer(d, "debut", "US-003", "--rythme", "rapide");
  assert.ok(!/Rechargez/.test(rappel(d)), "sans commande connue, pas de rechargement");
});

test("--rappel affiche le rappel", () => {
  const d = projet();
  assert.strictEqual(lancer(d, "--rappel").stdout, "");
  lancer(d, "debut", "US-003", "--commande", "spirc", "--rythme", "rapide");
  assert.match(lancer(d, "--rappel").stdout, /US-003/);
});

test("marqueur illisible : lire renvoie null, sans erreur", () => {
  const { lire } = require(SCRIPT);
  const d = projet();
  fs.mkdirSync(path.join(d, "aidd_docs", "tasks"), { recursive: true });
  fs.writeFileSync(path.join(d, MARQUEUR), "{pas du json", "utf8");
  assert.strictEqual(lire(d), null);
  assert.strictEqual(lancer(d).status, 0);
});

test("--rappel : la racine vient de CLAUDE_PROJECT_DIR quand elle est donnée", () => {
  const d = projet();
  const ailleurs = projet();
  lancer(d, "debut", "US-009", "--commande", "spirc", "--rythme", "rapide");
  const r = spawnSync("node", [SCRIPT, "--rappel"], { encoding: "utf8", cwd: ailleurs, env: { ...process.env, CLAUDE_PROJECT_DIR: d } });
  assert.match(r.stdout, /US-009/);
  assert.strictEqual(lancer(ailleurs, "--rappel").stdout, "");
});

// Marqueur périmé : maj plus vieille que 6 heures (réalisation interrompue sans « fin »).
function marqueurDate(dossier, maj, extra = {}) {
  fs.mkdirSync(path.join(dossier, "aidd_docs", "tasks"), { recursive: true });
  fs.writeFileSync(path.join(dossier, MARQUEUR), JSON.stringify({ us: "US-004", commande: "spirc", rythme: "rapide", questions: 1, debut: maj, maj, ...extra }));
}
const ilYa = (heures) => new Date(Date.now() - heures * 3600 * 1000).toISOString();

test("marqueur périmé (maj de plus de 6 h) : lire et rappel l'ignorent, lireBrut et perime le voient", () => {
  const { lire, rappel, lireBrut, perime, PERIME_H } = require(SCRIPT);
  assert.strictEqual(PERIME_H, 6);
  const d = projet();
  marqueurDate(d, ilYa(7));
  assert.strictEqual(lire(d), null);
  assert.strictEqual(rappel(d), "");
  assert.strictEqual(lireBrut(d).us, "US-004");
  assert.strictEqual(perime(lireBrut(d)), true);
  assert.strictEqual(lancer(d, "--rappel").stdout, "");
  assert.match(lancer(d).stdout, /^perime: oui$/m, "la commande nue le signale");
  const frais = projet();
  marqueurDate(frais, ilYa(5));
  assert.strictEqual(lire(frais).us, "US-004");
  assert.strictEqual(perime(lireBrut(frais)), false);
  assert.doesNotMatch(lancer(frais).stdout, /perime/);
  const sansDate = projet();
  marqueurDate(sansDate, "pas une date");
  assert.strictEqual(lire(sansDate), null, "date illisible : périmé");
});

test("marqueur périmé : etape le rafraîchit, fin le retire", () => {
  const { lire } = require(SCRIPT);
  const d = projet();
  marqueurDate(d, ilYa(8));
  lancer(d, "etape", "T3", "realisation");
  assert.strictEqual(lire(d).tache, "T3");
  marqueurDate(d, ilYa(8));
  assert.strictEqual(lancer(d, "fin").status, 0);
  assert.ok(!fs.existsSync(path.join(d, MARQUEUR)));
});

test("--rappel : le cwd de l'entrée du hook passe avant CLAUDE_PROJECT_DIR et le dossier courant", () => {
  const racine = projet();
  spawnSync("git", ["init", "-q"], { cwd: racine });
  fs.mkdirSync(path.join(racine, "src"), { recursive: true });
  const autre = projet();
  marqueurDate(racine, ilYa(0), { us: "US-011" });
  marqueurDate(autre, ilYa(0), { us: "US-022" });
  const r = spawnSync("node", [SCRIPT, "--rappel"], { encoding: "utf8", cwd: autre, input: JSON.stringify({ cwd: path.join(racine, "src") }), env: { ...process.env, CLAUDE_PROJECT_DIR: autre } });
  assert.match(r.stdout, /US-011/);
  // Sans marqueur sous le cwd : CLAUDE_PROJECT_DIR.
  const vide = projet();
  spawnSync("git", ["init", "-q"], { cwd: vide });
  const r2 = spawnSync("node", [SCRIPT, "--rappel"], { encoding: "utf8", cwd: vide, input: JSON.stringify({ cwd: vide }), env: { ...process.env, CLAUDE_PROJECT_DIR: autre } });
  assert.match(r2.stdout, /US-022/);
});

test("trouver : premier marqueur vivant parmi la racine Git du cwd, CLAUDE_PROJECT_DIR, le dossier courant", () => {
  const { trouver } = require(SCRIPT);
  const a = projet();
  spawnSync("git", ["init", "-q"], { cwd: a });
  marqueurDate(a, ilYa(9), { us: "US-001" }); // périmé : ignoré
  const b = projet();
  marqueurDate(b, ilYa(0), { us: "US-002" });
  const avant = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = b;
  try {
    const t = trouver(a);
    assert.strictEqual(t.etat.us, "US-002");
    assert.strictEqual(path.resolve(t.racine), path.resolve(b));
  } finally {
    if (avant === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = avant;
  }
});

test("debut refuse un numéro d'US invalide : une phrase, code 1, rien d'écrit", () => {
  for (const us of ["", "US-1", "003", "US-00x", "T3"]) {
    const d = projet();
    const r = lancer(d, "debut", ...(us ? [us] : []), "--commande", "spirc", "--rythme", "rapide");
    assert.strictEqual(r.status, 1, `${us}: ${r.stderr}`);
    assert.match(r.stdout, /US-001/);
    assert.strictEqual(r.stdout.trim().split("\n").length, 1);
    assert.ok(!fs.existsSync(path.join(d, MARQUEUR)), "aucun marqueur écrit");
  }
  const d = projet();
  assert.strictEqual(lancer(d, "debut", "US-1234", "--commande", "spirc", "--rythme", "rapide").status, 0);
});

test("deux debut successifs : le second remplace le marqueur", () => {
  const d = projet();
  lancer(d, "debut", "US-001", "--commande", "spirc", "--rythme", "complet");
  lancer(d, "etape", "T2", "test");
  lancer(d, "debut", "US-002", "--commande", "implement", "--rythme", "rapide", "--autonome");
  const m = marqueur(d);
  assert.strictEqual(m.us, "US-002");
  assert.strictEqual(m.commande, "implement");
  assert.strictEqual(m.autonome, true);
  assert.strictEqual(m.tache, "");
  assert.deepStrictEqual(fs.readdirSync(path.dirname(path.join(d, MARQUEUR))), ["realisation.json"]);
});

test("ecrire retire son fichier temporaire quand le renommage échoue", () => {
  const d = projet();
  // La cible est un dossier : renameSync échoue.
  fs.mkdirSync(path.join(d, MARQUEUR), { recursive: true });
  const r = spawnSync("node", ["-e", `try { require(${JSON.stringify(SCRIPT)}).ecrire(${JSON.stringify(d)}, { us: "US-001" }); } catch { process.stdout.write("erreur"); }`], { encoding: "utf8" });
  assert.strictEqual(r.stdout, "erreur");
  assert.deepStrictEqual(fs.readdirSync(path.join(d, "aidd_docs", "tasks")), ["realisation.json"], "pas de .tmp oublié");
});

test("--rappel : rien hors d'un projet Pulse", () => {
  const d = projet(false);
  marqueurDate(d, ilYa(0), { us: "US-031" });
  assert.strictEqual(lancer(d, "--rappel").stdout, "");
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# P\n\n<!-- pulse_profil:debut -->\n");
  assert.match(lancer(d, "--rappel").stdout, /US-031/);
});

// ------------------------------------------------------------ Devant vous : la fiche du pack avant le code

test("debut --devant : le mode devant vous est gardé dans le marqueur (faux sans l'option)", () => {
  const d = projet();
  const r = lancer(d, "debut", "US-004", "--devant", "--commande", "implement", "--rythme", "complet");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(marqueur(d).us, "US-004");
  assert.strictEqual(marqueur(d).devant, true);
  assert.match(lancer(d).stdout, /^devant: true$/m);
  const sans = projet();
  lancer(sans, "debut", "US-004", "--commande", "implement", "--rythme", "complet");
  assert.strictEqual(marqueur(sans).devant, false);
});

test("rappel en mode devant vous : relancer l'étape de réalisation seulement si du code reste à écrire", () => {
  const { rappel } = require(SCRIPT);
  const d = projet();
  lancer(d, "debut", "US-004", "--commande", "spirc", "--rythme", "complet", "--devant");
  lancer(d, "etape", "T2", "realisation");
  assert.match(rappel(d), /`pulse-aidd realisation etape T2 realisation`[^\n]*fiche du pack/);
  lancer(d, "etape", "T2", "test");
  assert.match(rappel(d), /`pulse-aidd realisation etape T2 realisation`[^\n]*fiche du pack/, "tests d'abord : le code reste à écrire");
  for (const apres of ["examen", "commit", "questions"]) {
    lancer(d, "etape", "T2", apres);
    assert.doesNotMatch(rappel(d), /realisation etape/, `${apres} : plus de code à écrire, rien à relancer`);
  }
  const avant = projet();
  lancer(avant, "debut", "US-004", "--commande", "spirc", "--rythme", "complet", "--devant");
  assert.doesNotMatch(rappel(avant), /realisation etape/, "aucune tâche commencée : l'étape se lance à son heure");
  const sans = projet();
  lancer(sans, "debut", "US-004", "--commande", "spirc", "--rythme", "complet");
  lancer(sans, "etape", "T2", "realisation");
  assert.doesNotMatch(rappel(sans), /realisation etape/);
});

// pulse-aidd realisation, lancé par bash dans un projet temporaire : les packs installés sur la machine sont retirés
// du PATH ; avec `pack`, le vrai pack Next.js de ce dépôt y est ajouté.
const OUTIL = path.join(__dirname, "..", "bin", "pulse-aidd").split(path.sep).join("/");
const BIN_NEXT = path.join(__dirname, "..", "..", "pulse-vibe-next", "bin");
const sansNext = { skip: !fs.existsSync(path.join(BIN_NEXT, "pulse-pile-next")) && "pack Next.js absent du dépôt" };

function projetNext(declare) {
  const d = projet();
  if (declare) {
    fs.mkdirSync(path.join(d, "docs"));
    fs.writeFileSync(path.join(d, "docs", "technical.md"), `# Technique\n\n**Pack de pile Pulse** : ${declare}\n`);
  }
  return d;
}

function aidd(dossier, pack, ...args) {
  const sansPacks = 'P=""; IFS=:; for x in $PATH; do ls "$x"/pulse-pile-* >/dev/null 2>&1 || P="$P:$x"; done; unset IFS';
  const ajout = pack ? `"$(cd "${BIN_NEXT.split(path.sep).join("/")}" && pwd)"` : "";
  return spawnSync("bash", ["-c", `${sansPacks}; PATH="${ajout}$P" exec bash "${OUTIL}" "$@"`, "pulse-aidd", ...args], {
    cwd: dossier,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", CLAUDE_PLUGIN_ROOT: "" },
  });
}

test("devant vous : etape <Tn> realisation affiche la fiche du pack déclaré, sous 30 000 caractères", sansNext, () => {
  const d = projetNext("next");
  aidd(d, true, "realisation", "debut", "US-001", "--commande", "implement", "--rythme", "complet", "--devant");
  const r = aidd(d, true, "realisation", "etape", "T1", "realisation");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("===== Pack de pile : Pulse Next.js ====="), r.stdout.slice(0, 300));
  assert.match(r.stdout, /Fiche de la pile : règles pour un code juste du premier coup/);
  assert.ok(r.stdout.length < 30000, `${r.stdout.length} caractères`);
  assert.strictEqual(marqueur(d).tache, "T1", "le marqueur est mis à jour d'abord");
  assert.strictEqual(marqueur(d).etape, "realisation");
});

test("devant vous : etape <Tn> test n'affiche rien, le contexte des tests vient des consignes du test-writer", sansNext, () => {
  const d = projetNext("next");
  aidd(d, true, "realisation", "debut", "US-001", "--commande", "spirc", "--rythme", "complet", "--devant");
  const r = aidd(d, true, "realisation", "etape", "T1", "test");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout, "");
  assert.strictEqual(marqueur(d).etape, "test");
  // Celui qui écrit les tests (le test-writer, ou la conversation qui suit ses consignes sans agent disponible) les charge.
  assert.match(fs.readFileSync(path.join(__dirname, "..", "agents", "test-writer.md"), "utf8"), /lancer `pulse-aidd pile contexte test` avant de commencer/);
});

test("etape : rien de plus sans --devant, sans pack déclaré, ou pour une autre étape", sansNext, () => {
  const sansDevant = projetNext("next");
  aidd(sansDevant, true, "realisation", "debut", "US-001", "--commande", "implement", "--rythme", "complet");
  const r = aidd(sansDevant, true, "realisation", "etape", "T1", "realisation");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout, "");
  const sansPack = projetNext();
  aidd(sansPack, true, "realisation", "debut", "US-001", "--commande", "implement", "--rythme", "complet", "--devant");
  assert.strictEqual(aidd(sansPack, true, "realisation", "etape", "T1", "realisation").stdout, "");
  const examen = projetNext("next");
  aidd(examen, true, "realisation", "debut", "US-001", "--commande", "spirc", "--rythme", "complet", "--devant");
  assert.strictEqual(aidd(examen, true, "realisation", "etape", "T1", "examen").stdout, "");
});

test("devant vous, pack déclaré mais absent : le bloc « non installé » et le code 0", () => {
  const d = projetNext("next");
  aidd(d, false, "realisation", "debut", "US-001", "--commande", "implement", "--rythme", "complet", "--devant");
  const r = aidd(d, false, "realisation", "etape", "T1", "realisation");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Pack de pile : next \(non installé\)[\s\S]*\/plugin install pulse-next@pulseia/);
});

test("etape sans marqueur : toujours rien et le code 0, même avec un pack", sansNext, () => {
  const d = projetNext("next");
  const r = aidd(d, true, "realisation", "etape", "T1", "realisation");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout, "");
});

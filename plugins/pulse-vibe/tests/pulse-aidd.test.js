// Tests de l'outil interne pulse-aidd pour /pulse:ui, /pulse:learn, /pulse:commit et /pulse:pr.
// Lancer : node --test plugins/pulse-vibe/tests/pulse-aidd.test.js (nécessite bash dans le PATH)
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
// Chemin relatif et cwd = racine du plugin : fonctionne avec Git Bash, Cygwin, macOS et Linux.
const lancer = (...args) => spawnSync("bash", ["bin/pulse-aidd", ...args], { cwd: RACINE, encoding: "utf8" });

test("contexte ui : règles communes, trois références de design et trois modèles", () => {
  const r = lancer("contexte", "ui");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of [
    "===== Règles communes Pulse =====",
    "===== Registres d'interface =====",
    "===== Règles d'interface =====",
    "===== Anti-patterns d'interface =====",
    "===== Modèle : docs/design.md =====",
    "===== Modèle : note de variante =====",
    "===== Modèle : rapport d'audit d'interface =====",
  ]) assert.ok(r.stdout.includes(titre), titre);
  assert.doesNotMatch(r.stdout, /commande inconnue/);
});

test("contexte learn : règles communes, pédagogie et modèle du carnet", () => {
  const r = lancer("contexte", "learn");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of [
    "===== Règles communes Pulse =====",
    "===== Pédagogie du professeur =====",
    "===== Modèle : docs/apprentissage.md =====",
  ]) assert.ok(r.stdout.includes(titre), titre);
  assert.doesNotMatch(r.stdout, /commande inconnue/);
});

test("contexte commit et pr : conventions Git partagées, modèle de PR pour pr", () => {
  const commit = lancer("contexte", "commit");
  assert.strictEqual(commit.status, 0, commit.stderr);
  assert.ok(commit.stdout.includes("===== Conventions Git ====="));
  assert.ok(commit.stdout.includes("===== Modèle : .gitignore ====="));
  const pr = lancer("contexte", "pr");
  assert.strictEqual(pr.status, 0, pr.stderr);
  for (const titre of [
    "===== Règles communes Pulse =====",
    "===== Conventions Git =====",
    "===== Modèle : description de demande de fusion =====",
  ]) assert.ok(pr.stdout.includes(titre), titre);
  assert.doesNotMatch(pr.stdout, /commande inconnue/);
});

test("agents designer et ui-critic disponibles, et cités dans le message d'erreur", () => {
  for (const nom of ["designer", "ui-critic"]) {
    const r = lancer("agent", nom);
    assert.strictEqual(r.status, 0, nom);
    assert.match(r.stdout, new RegExp(`name: ${nom}`));
  }
  const inconnu = lancer("agent", "inexistant");
  assert.strictEqual(inconnu.status, 1);
  assert.match(inconnu.stdout, /designer/);
  assert.match(inconnu.stdout, /ui-critic/);
});

test("comparer sans argument : usage et code 1", () => {
  const r = lancer("comparer");
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout + r.stderr, /Usage : pulse-aidd comparer <dossier/);
});

test("l'aide mentionne comparer et reste complète jusqu'à sa dernière ligne", () => {
  const r = lancer();
  assert.match(r.stdout, /pulse-aidd comparer <dossier>/);
  assert.match(r.stdout, /installer-ci/);
  assert.match(r.stdout, /Ne sort jamais en erreur/, "la plage du sed suit l'en-tête allongé d'une ligne");
  assert.doesNotMatch(r.stdout, /RACINE=/, "la plage du sed ne déborde pas sur le code");
});

test("l'aide cite secrets, seo, perf et search-console", () => {
  const r = lancer();
  for (const sc of ["pulse-aidd secrets", "pulse-aidd seo", "pulse-aidd perf", "pulse-aidd search-console"])
    assert.ok(r.stdout.includes(sc), sc);
});

test("contexte secrets : règles communes, saisie hors conversation, fuite, modèles des secrets et de l'incident", () => {
  const r = lancer("contexte", "secrets");
  assert.strictEqual(r.status, 0);
  for (const titre of ["Règles communes Pulse", "Garder la valeur d'un secret hors de la conversation", "Réagir à une fuite de clé", "Modèle : docs/secrets.md", "Modèle : journal d'incident"])
    assert.ok(r.stdout.includes(`===== ${titre}`), titre);
});

test("contexte deploy et security : saisie des secrets hors conversation", () => {
  for (const commande of ["deploy", "security"])
    assert.ok(lancer("contexte", commande).stdout.includes("===== Garder la valeur d'un secret hors de la conversation"), commande);
});

test("contexte seo, perf et search-console : leurs références, leurs modèles et le lexique", () => {
  const attendus = {
    seo: ["Référencement : les règles", "Référencement : assistants IA", "Modèle : docs/seo.md", "Modèle : rapport d'audit de référencement"],
    perf: ["La vitesse vécue par les visiteurs", "Modèle : docs/performance.md"],
    "search-console": ["Search Console : relier, lire, suivre", "Modèle : docs/referencement/search-console-<date>.md", "Modèle : travail en cours"],
  };
  for (const [commande, titres] of Object.entries(attendus)) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, commande);
    assert.doesNotMatch(r.stdout, /commande inconnue/, commande);
    for (const titre of [...titres, "Modèle : docs/lexique.md"]) assert.ok(r.stdout.includes(`===== ${titre} =====`), `${commande} : ${titre}`);
  }
});

test("contexte annuler : règles communes, conventions Git et envoi du travail", () => {
  const r = lancer("contexte", "annuler");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of [
    "===== Règles communes Pulse =====",
    "===== Conventions Git =====",
    "===== Le dépôt distant et l'envoi du travail =====",
  ]) assert.ok(r.stdout.includes(titre), titre);
  assert.doesNotMatch(r.stdout, /commande inconnue/);
});

test("contexte get-help : règles communes et modèle de demande d'aide", () => {
  const r = lancer("contexte", "get-help");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("===== Règles communes Pulse ====="));
  assert.ok(r.stdout.includes("===== Modèle : demande d'aide ====="));
  assert.doesNotMatch(r.stdout, /commande inconnue/);
});

test("contexte implement, spirc, fix, learn et explain : modèle du lexique", () => {
  for (const commande of ["implement", "spirc", "fix", "learn", "explain"]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("===== Modèle : docs/lexique.md ====="), commande);
  }
});

test("contexte brainstorm, prd et us : la référence « Penser avant d'écrire »", () => {
  for (const commande of ["brainstorm", "prd", "us"]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("===== Penser avant d'écrire ====="), commande);
  }
});

test("travail-fini : efface le travail en cours du dossier courant, sans erreur s'il est absent", () => {
  const fs = require("fs");
  const os = require("os");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-fini-"));
  const fichier = path.join(d, "aidd_docs", "tasks", "in-progress.md");
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, "# Travail en cours\n");
  const outil = path.join(RACINE, "bin", "pulse-aidd").split(path.sep).join("/");
  let r = spawnSync("bash", [outil, "travail-fini"], { cwd: d, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(fichier), "le fichier est effacé");
  r = spawnSync("bash", [outil, "travail-fini"], { cwd: d, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
});

test("tests : affiche toute la méthode de tests, Gherkin compris", () => {
  const r = lancer("tests");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of [
    "===== Stratégie de tests =====",
    "===== Écrire un test =====",
    "===== Tests unitaires =====",
    "===== Tests d'intégration =====",
    "===== Tests de bout en bout =====",
    "===== Développement piloté par les tests (TDD) =====",
    "===== Scénarios Gherkin =====",
  ]) assert.ok(r.stdout.includes(titre), titre);
});

test("contexte implement, spirc et test : la procédure des tests automatiques", () => {
  for (const commande of ["implement", "spirc", "test"]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("===== Tests automatiques : tests d'abord ====="), commande);
    assert.doesNotMatch(r.stdout, /commande inconnue/);
  }
});

test("contexte spec : Gherkin, sans checklist (le comment va au plan) ; contexte plan : stratégie de tests et checklist", () => {
  assert.ok(lancer("contexte", "spec").stdout.includes("===== Scénarios Gherkin ====="));
  assert.ok(!lancer("contexte", "spec").stdout.includes("===== Checklist sécurité ====="));
  assert.ok(lancer("contexte", "plan").stdout.includes("===== Stratégie de tests ====="));
  assert.ok(lancer("contexte", "plan").stdout.includes("===== Checklist sécurité ====="));
});

test("agents test-writer et test-runner disponibles, et cités dans le message d'erreur", () => {
  for (const nom of ["test-writer", "test-runner"]) {
    const r = lancer("agent", nom);
    assert.strictEqual(r.status, 0, nom);
    assert.match(r.stdout, new RegExp(`name: ${nom}`));
  }
  const inconnu = lancer("agent", "inexistant");
  assert.match(inconnu.stdout, /test-writer/);
  assert.match(inconnu.stdout, /test-runner/);
});

// ------------------------------------------------------------ Packs de pile

const fsP = require("fs");
const osP = require("os");
const OUTIL = path.join(RACINE, "bin", "pulse-aidd").split(path.sep).join("/");

// Un projet temporaire, et un dossier de faux packs ajouté au PATH de bash.
function projetAvecPack({ declare, installe }) {
  const d = fsP.mkdtempSync(path.join(osP.tmpdir(), "pulse-pack-"));
  const bin = path.join(d, "faux-bin");
  fsP.mkdirSync(bin);
  if (declare) {
    fsP.mkdirSync(path.join(d, "docs"));
    fsP.writeFileSync(path.join(d, "docs", "technical.md"), `# Technique\n\n## Pile retenue\n\n**Pack de pile Pulse** : ${declare}\n`);
  }
  if (installe) {
    const script = path.join(bin, `pulse-pile-${installe}`);
    fsP.writeFileSync(
      script,
      "#!/usr/bin/env bash\n" +
        'case "$1" in\n' +
        `  info) printf 'id: ${installe}\nnom: Pile ${installe}\nresume: Une pile de test.\nversion: 0.1.0\n' ;;\n` +
        '  contexte) echo "Consignes du pack pour $2" ;;\n' +
        '  echo) shift; printf "[%s]" "$@" ;;\n' +
        "  echec) exit 3 ;;\n" +
        "esac\n"
    );
    fsP.chmodSync(script, 0o755);
  }
  const binBash = bin.split(path.sep).join("/");
  const lancerIci = (...args) =>
    spawnSync("bash", ["-c", `PATH="$(cd "${binBash}" && pwd):$PATH" exec bash "${OUTIL}" "$@"`, "pulse-aidd", ...args], { cwd: d, encoding: "utf8" });
  return { d, lancerIci };
}

test("piles : liste les packs installés, ou le dit s'il n'y en a aucun", () => {
  const avec = projetAvecPack({ installe: "essai" });
  const r = avec.lancerIci("piles");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /essai/);
  assert.match(r.stdout, /Pile essai/);
  assert.match(r.stdout, /Une pile de test\./);
  const sans = projetAvecPack({});
  assert.match(sans.lancerIci("piles").stdout, /Aucun pack de pile installé/);
});

test("pile : indique le pack déclaré par le projet et s'il est installé", () => {
  assert.match(projetAvecPack({ declare: "essai", installe: "essai" }).lancerIci("pile").stdout, /essai.*installé/s);
  assert.match(projetAvecPack({ declare: "essai" }).lancerIci("pile").stdout, /non installé/);
  assert.match(projetAvecPack({}).lancerIci("pile").stdout, /Aucun pack de pile déclaré/);
});

test("contexte : ajoute les consignes du pack déclaré et installé", () => {
  const r = projetAvecPack({ declare: "essai", installe: "essai" }).lancerIci("contexte", "implement");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("===== Pack de pile : Pile essai ====="), r.stdout.slice(-300));
  assert.match(r.stdout, /Consignes du pack pour implement/);
});

test("contexte : pack déclaré mais absent, un avertissement et aucune erreur", () => {
  const r = projetAvecPack({ declare: "essai" }).lancerIci("etape", "tech");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Pack de pile : essai \(non installé\)/);
  assert.match(r.stdout, /pulse-vibe-essai/);
});

test("contexte : sans pack déclaré, aucune section de pack", () => {
  const r = projetAvecPack({ installe: "essai" }).lancerIci("contexte", "implement");
  assert.doesNotMatch(r.stdout, /===== Pack de pile/);
});

test("pile <sous-commande> : relaie vers le pack déclaré, arguments et code de sortie compris", () => {
  const p = projetAvecPack({ declare: "essai", installe: "essai" });
  const r = p.lancerIci("pile", "echo", "recette", "deux mots");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout, "[recette][deux mots]");
  assert.strictEqual(p.lancerIci("pile", "echec").status, 3);
});

test("pile <sous-commande> : sans pack déclaré ou pack absent, message et code 1", () => {
  const sans = projetAvecPack({ installe: "essai" }).lancerIci("pile", "recette", "connexion");
  assert.strictEqual(sans.status, 1);
  assert.match(sans.stdout + sans.stderr, /Aucun pack de pile déclaré/);
  const absent = projetAvecPack({ declare: "essai" }).lancerIci("pile", "recette", "connexion");
  assert.strictEqual(absent.status, 1);
  assert.match(absent.stdout + absent.stderr, /pulse-vibe-essai/);
});

test("contexte rediger : règles communes, règles de rédaction, modèles de la voix et du texte de page", () => {
  const r = lancer("contexte", "rediger");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of ["===== Règles communes Pulse =====", "===== Rédiger les textes des pages =====", "===== Modèle : docs/voix.md =====", "===== Modèle : docs/textes/<page>.md ====="])
    assert.ok(r.stdout.includes(titre), titre);
});

test("textes verifier : relaie vers le contrôle des tics d'écriture IA", () => {
  const r = spawnSync("bash", ["bin/pulse-aidd", "textes", "verifier", "-"], { cwd: RACINE, encoding: "utf8", input: "Un projet crucial.\n" });
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /LEX-001/);
});

test("contexte ui et plan : les motifs d'écrans", () => {
  for (const commande of ["ui", "plan"]) assert.ok(lancer("contexte", commande).stdout.includes("===== Motifs d'écrans ====="), commande);
});

test("identite extraire et maquettes verifier : relaient vers leurs scripts", () => {
  const vide = fsP.mkdtempSync(path.join(osP.tmpdir(), "pulse-relais-"));
  const i = lancer("identite", "extraire", vide);
  assert.strictEqual(i.status, 0, i.stdout + i.stderr);
  assert.match(i.stdout, /non trouvé/);
  fsP.writeFileSync(path.join(vide, "p.html"), "<html><body><h1 style=\"background-clip: text\">A</h1></body></html>\n");
  const m = lancer("maquettes", "verifier", path.join(vide, "p.html"));
  assert.strictEqual(m.status, 1, m.stdout + m.stderr);
  assert.match(m.stdout, /Texte en dégradé de couleur/);
});

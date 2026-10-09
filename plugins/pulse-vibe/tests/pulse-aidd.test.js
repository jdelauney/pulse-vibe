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

test("contexte ui : règles communes, quatre références de design et trois modèles", () => {
  const r = lancer("contexte", "ui");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of [
    "===== Règles communes Pulse =====",
    "===== Registres d'interface =====",
    "===== Règles d'interface =====",
    "===== Anti-patterns d'interface =====",
    "===== Motifs d'écrans =====",
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

test("contexte init, status et guide : fichiers du projet et cycle Pulse", () => {
  for (const commande of ["init", "status", "guide"]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    for (const titre of ["===== Règles communes Pulse =====", "===== Les fichiers du projet =====", "===== Le cycle Pulse ====="])
      assert.ok(r.stdout.includes(titre), `${commande} : ${titre}`);
  }
  assert.ok(!lancer("contexte", "implement").stdout.includes("===== Les fichiers du projet ====="), "implement : à la demande");
});

test("contexte implement et fix : règles de qualité chargées à la demande", () => {
  for (const commande of ["implement", "fix"]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(!r.stdout.includes("===== Règles de qualité du code ====="), commande);
    assert.ok(!r.stdout.includes("===== Clean code ====="), commande);
  }
  assert.ok(lancer("qualite").stdout.includes("===== Clean code ====="), "pulse-aidd qualite reste complet");
  const lireSkill = (nom) => require("fs").readFileSync(path.join(RACINE, "skills", nom, "SKILL.md"), "utf8");
  assert.match(lireSkill("implement"), /\*\*Mode direct\*\* : lancer `pulse-aidd qualite` une fois/);
  assert.match(lireSkill("fix"), /Lancer `pulse-aidd qualite` \(règles de qualité du code\), puis évaluer/);
  const communes = require("fs").readFileSync(path.join(RACINE, "references", "regles-communes.md"), "utf8");
  assert.ok(!communes.includes("incluses dans `pulse-aidd contexte implement`"), "règles communes à jour");
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

test("travail-fini <dossier> : efface seulement le travail en cours de ce dossier (worktree), refuse « .. »", () => {
  const fs = require("fs");
  const os = require("os");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-fini-"));
  const ecrire = (rel) => {
    const f = path.join(d, rel, "aidd_docs", "tasks", "in-progress.md");
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, "# Travail en cours\n");
    return f;
  };
  const principal = ecrire(".");
  const worktree = ecrire(".claude/worktrees/us-001");
  const outil = path.join(RACINE, "bin", "pulse-aidd").split(path.sep).join("/");
  let r = spawnSync("bash", [outil, "travail-fini", ".claude/worktrees/us-001"], { cwd: d, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(worktree), "celui du worktree est effacé");
  assert.ok(fs.existsSync(principal), "celui du dossier courant reste");
  r = spawnSync("bash", [outil, "travail-fini", ".claude/worktrees/absent"], { cwd: d, encoding: "utf8" });
  assert.notStrictEqual(r.status, 0, "dossier inconnu");
  r = spawnSync("bash", [outil, "travail-fini", "../autre"], { cwd: path.join(d, ".claude"), encoding: "utf8" });
  assert.notStrictEqual(r.status, 0, "« .. » refusé");
  assert.ok(fs.existsSync(principal));
  assert.match(spawnSync("bash", [outil], { encoding: "utf8" }).stdout, /travail-fini \[dossier\]/);
});

test("etape --sans-communes : instructions et contexte de l'étape, sans les règles communes", () => {
  const avec = lancer("etape", "commit");
  const sans = lancer("etape", "commit", "--sans-communes");
  assert.strictEqual(sans.status, 0, sans.stderr);
  assert.ok(avec.stdout.includes("===== Règles communes Pulse ====="), "sans option : règles communes");
  assert.ok(!sans.stdout.includes("===== Règles communes Pulse ====="), "avec l'option : sans règles communes");
  for (const titre of ["===== Instructions de l'étape /pulse:commit =====", "===== Conventions Git =====", "===== Le dépôt distant et l'envoi du travail ====="])
    assert.ok(sans.stdout.includes(titre), titre);
});

test("l'aide décrit l'option --sans-communes", () => {
  assert.match(lancer().stdout, /etape <commande> \[--sans-communes\]/);
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

test("contexte implement et test : la procédure des tests automatiques", () => {
  for (const commande of ["implement", "test"]) {
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
        '  relais) printf "%s" "${PULSE_RELAIS_ARGC:-absent}"; env | grep -q "^PULSE_RELAIS_" && printf " (variables restantes)" ;;\n' +
        "  echec) exit 3 ;;\n" +
        "esac\n"
    );
    fsP.chmodSync(script, 0o755);
  }
  const binBash = bin.split(path.sep).join("/");
  const lancerIci = (...args) =>
    spawnSync("bash", ["-c", `PATH="$(cd "${binBash}" && pwd):$PATH" exec bash "${OUTIL}" "$@"`, "pulse-aidd", ...args], { cwd: d, encoding: "utf8" });
  return { d, lancerIci, bin: binBash };
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
  assert.match(r.stdout, /pulse-essai@pulseia/);
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
  assert.match(absent.stdout + absent.stderr, /pulse-essai@pulseia/);
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

const fs = require("fs");
const os = require("os");
const dans = (dossier, ...args) => spawnSync("bash", [OUTIL, ...args], { cwd: dossier, encoding: "utf8" });

test("modele, agent et etape refusent un chemin hors du plugin", () => {
  for (const args of [["modele", "../../.env"], ["modele", "/etc/passwd"], ["agent", "../hooks/hooks"]]) {
    const r = lancer(...args);
    assert.strictEqual(r.status, 1, args.join(" "));
    assert.doesNotMatch(r.stdout, /SECRET|root:/);
  }
  const e = lancer("etape", "../hooks");
  assert.strictEqual(e.status, 0, "etape ne sort jamais en erreur");
  assert.match(e.stdout, /Commande inconnue/);
});

test("installer-ci garde un verifier.js adapté, sauf avec --forcer", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-ci-"));
  fs.mkdirSync(path.join(d, "scripts"));
  fs.writeFileSync(path.join(d, "scripts", "verifier.js"), "// adapté\n");
  const r = dans(d, "installer-ci");
  assert.strictEqual(r.status, 1);
  assert.strictEqual(fs.readFileSync(path.join(d, "scripts", "verifier.js"), "utf8"), "// adapté\n");
  assert.strictEqual(dans(d, "installer-ci", "--forcer").status, 0);
  assert.match(fs.readFileSync(path.join(d, "scripts", "verifier.js"), "utf8"), /DEBUT-MOTIFS/);
});

test("installer-hook : le commit d'une clé est refusé, même hors de Claude", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-hook-"));
  const git = (...a) => spawnSync("git", a, { cwd: d, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "T");
  assert.strictEqual(dans(d, "installer-hook").status, 0);
  fs.writeFileSync(path.join(d, "app.js"), `const k = "${["sk", "live", "4eC39HqLyjWDarjtT1zdp7dc"].join("_")}";\n`);
  git("add", "app.js");
  const r = git("commit", "-m", "x");
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /Commit annulé/);
  fs.writeFileSync(path.join(d, "app.js"), "const k = process.env.STRIPE_KEY;\n");
  git("add", "app.js");
  assert.strictEqual(git("commit", "-q", "-m", "x").status, 0);
});

test("installer-hook n'installe rien si scripts/verifier.js est une ancienne version", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-hook-ancien-"));
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: d });
  fs.mkdirSync(path.join(d, "scripts"));
  fs.writeFileSync(path.join(d, "scripts", "verifier.js"), "// ancienne version\n");
  const r = dans(d, "installer-hook");
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /ancienne version/);
  assert.ok(!fs.existsSync(path.join(d, ".git", "hooks", "pre-commit")));
});

test("pulse-aidd.cmd fonctionne depuis cmd.exe (Windows)", { skip: process.platform !== "win32" }, () => {
  const r = spawnSync("cmd.exe", ["/d", "/c", path.join(RACINE, "bin", "pulse-aidd.cmd"), "modele", "lexique.md"], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.length > 0);
});

function depotHook(prefixe) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefixe));
  const git = (...a) => spawnSync("git", a, { cwd: d, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "T");
  return { d, git };
}
const cleHook = () => `const k = "${["sk", "live", "4eC39HqLyjWDarjtT1zdp7dc"].join("_")}";\n`;

test("installer-hook : sans scripts/verifier.js (nouveau worktree), la copie gardée par Git contrôle le commit", () => {
  const { d, git } = depotHook("pulse-hook-absent-");
  assert.strictEqual(dans(d, "installer-hook").status, 0);
  assert.ok(fs.existsSync(path.join(d, ".git", "pulse", "verifier.js")), "copie de secours");
  fs.rmSync(path.join(d, "scripts", "verifier.js"));
  fs.writeFileSync(path.join(d, "a.txt"), "bonjour\n");
  git("add", "a.txt");
  const sain = git("commit", "-q", "-m", "x");
  assert.strictEqual(sain.status, 0, sain.stderr + sain.stdout);
  fs.writeFileSync(path.join(d, "app.js"), cleHook());
  git("add", "app.js");
  const r = git("commit", "-m", "y");
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /Commit annulé/);
});

test("installer-hook : contrôle introuvable (ni scripts/verifier.js, ni copie) : commit refusé, avec ce qui s'est passé et comment réparer", () => {
  const { d, git } = depotHook("pulse-hook-perdu-");
  assert.strictEqual(dans(d, "installer-hook").status, 0);
  fs.rmSync(path.join(d, "scripts", "verifier.js"));
  fs.rmSync(path.join(d, ".git", "pulse", "verifier.js"));
  fs.writeFileSync(path.join(d, "a.txt"), "bonjour\n");
  git("add", "a.txt");
  const r = git("commit", "-q", "-m", "x");
  assert.notStrictEqual(r.status, 0);
  const message = r.stderr + r.stdout;
  // Ce qui s'est passé, en mots simples.
  assert.match(message, /Commit annulé/);
  assert.match(message, /contrôle des secrets/);
  assert.match(message, /introuvable/);
  assert.match(message, /restent en place/, "la personne sait que son travail attend");
  // La solution : la commande Pulse, ou l'outil, puis refaire le commit.
  assert.match(message, /\/pulse:cicd/);
  assert.match(message, /pulse-aidd installer-hook/);
  assert.match(message, /refaites le commit/);
  // Les fichiers restent prêts : rien n'a été retiré de l'index.
  assert.match(git("diff", "--cached", "--name-only").stdout, /a\.txt/);
});

test("installer-hook : un hooksPath réglé pour tous les projets n'est jamais modifié", () => {
  const { d } = depotHook("pulse-hook-global-");
  const globaux = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-hooks-globaux-"));
  const config = path.join(globaux, "gitconfig");
  fs.writeFileSync(config, `[core]\n\thooksPath = ${globaux.split(path.sep).join("/")}\n`);
  const r = spawnSync("bash", [OUTIL, "installer-hook"], { cwd: d, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: config } });
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /node scripts\/verifier\.js --index/);
  assert.deepStrictEqual(fs.readdirSync(globaux), ["gitconfig"]);
});

test("contexte review et spirc : la référence « Examiner une tâche »", () => {
  for (const commande of ["review", "spirc"]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("===== Examiner une tâche ====="), commande);
  }
});

test("etape --sans-communes : les consignes du pack restent", () => {
  const r = projetAvecPack({ declare: "essai", installe: "essai" }).lancerIci("etape", "implement", "--sans-communes");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Consignes du pack pour implement/);
  assert.doesNotMatch(r.stdout, /===== Règles communes Pulse =====/);
});

test("etape --sans-communes : une ligne rappelle que les règles communes sont déjà chargées", () => {
  const sans = lancer("etape", "commit", "--sans-communes").stdout;
  assert.ok(sans.includes("(Règles communes : déjà chargées par la commande en cours ; appliquer seulement le Déroulé ci-dessous.)"));
  assert.ok(!lancer("etape", "commit").stdout.includes("déjà chargées par la commande en cours"));
});

test("contexte review : modèle de rapport, checklist chargée par le reviewer", () => {
  const r = lancer("contexte", "review");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("===== Modèle : rapport de revue ====="));
  assert.ok(!r.stdout.includes("===== Checklist sécurité ====="));
  assert.ok(!lancer("contexte", "spirc").stdout.includes("===== Checklist sécurité ====="), "spirc sans checklist");
  assert.ok(lancer("contexte", "plan").stdout.includes("===== Checklist sécurité ="), "plan la garde");
  assert.ok(lancer("contexte", "security").stdout.includes("===== Checklist sécurité ====="), "security la garde");
});

test("contexte spirc : règles communes, modèle de revue et lexique ; références de réalisation à la demande", () => {
  const r = lancer("contexte", "spirc");
  assert.strictEqual(r.status, 0, r.stderr);
  for (const titre of ["===== Règles communes Pulse =====", "===== Modèle : rapport de revue =====", "===== Modèle : docs/lexique.md ====="])
    assert.ok(r.stdout.includes(titre), titre);
  for (const titre of ["===== Travailler dans un worktree =====", "===== Tests automatiques : tests d'abord =====", "===== Règles de la mémoire projet =====", "===== Checklist sécurité =====", "===== Le dépôt distant et l'envoi du travail ====="])
    assert.ok(!r.stdout.includes(titre), titre);
});

// ------------------------------------------------------------ Relais PowerShell et cmd

// Environnement d'un processus enfant : chaque clé donnée remplace celle du même nom, quelle que soit la casse (Path, PATH).
function environnement(remplacements) {
  const env = {};
  const cles = Object.keys(remplacements).map((k) => k.toLowerCase());
  for (const [k, v] of Object.entries(process.env)) if (!cles.includes(k.toLowerCase())) env[k] = v;
  return { ...env, ...remplacements };
}

const litteral = (texte) => `'${String(texte).replace(/'/g, "''")}'`;

// Lance un relais .ps1 depuis PowerShell, comme l'outil PowerShell de Claude Code ; le script passe en
// -EncodedCommand, pour que ses guillemets ne dépendent pas de la ligne de commande de ce test.
function viaPowerShell(exe, relais, args, options = {}) {
  const script = `& ${litteral(relais)} ${args.map(litteral).join(" ")}; if ($null -eq $LASTEXITCODE) { exit 1 }; exit $LASTEXITCODE`;
  const encode = Buffer.from(script, "utf16le").toString("base64");
  return spawnSync(exe, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encode], { encoding: "utf8", ...options });
}

// Windows PowerShell 5.1 (toujours présent sous Windows) et PowerShell 7 s'il est installé.
const POWERSHELLS =
  process.platform !== "win32"
    ? []
    : [
        path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
        ...(spawnSync("where", ["pwsh.exe"], { encoding: "utf8" }).stdout || "").split(/\r?\n/).filter(Boolean).slice(0, 1),
      ].filter((f) => fsP.existsSync(f));
const sansPowerShell = POWERSHELLS.length === 0 && "PowerShell absent (hors Windows)";
const RELAIS_PS1 = path.join(RACINE, "bin", "pulse-aidd.ps1");

test("relais .ps1 : bash relit les arguments dans l'environnement, tels quels, puis les efface", () => {
  // Ce que fait le relais .ps1, rejoué sur toutes les plateformes.
  const arg = 'a&b "c" d|e>f';
  const r = spawnSync("bash", ["bin/pulse-aidd"], { cwd: RACINE, encoding: "utf8", env: environnement({ PULSE_RELAIS_ARGC: "2", PULSE_RELAIS_ARG_0: "reference", PULSE_RELAIS_ARG_1: arg }) });
  assert.strictEqual(r.status, 1, r.stderr);
  assert.ok(r.stdout.includes(`Référence introuvable : ${arg}.`), r.stdout);
  // pulse-aidd pile <…> relance l'outil du pack : il ne doit plus voir ces variables.
  const pack = projetAvecPack({ declare: "essai", installe: "essai" });
  const p = spawnSync("bash", ["-c", `PATH="$(cd "${pack.bin}" && pwd):$PATH" exec bash "${OUTIL}"`], {
    cwd: pack.d,
    encoding: "utf8",
    env: environnement({ PULSE_RELAIS_ARGC: "2", PULSE_RELAIS_ARG_0: "pile", PULSE_RELAIS_ARG_1: "relais" }),
  });
  assert.strictEqual(p.stdout, "absent", p.stdout + p.stderr);
});

test("relais .ps1 : un nombre d'arguments non numérique ou démesuré ne s'exécute pas, et vaut zéro", () => {
  const d = fsP.mkdtempSync(path.join(osP.tmpdir(), "pulse-argc-"));
  const temoin = path.join(d, "execute").split(path.sep).join("/");
  for (const argc of [`a[$(touch "${temoin}")]`, `x[$(touch "${temoin}")]+1`, "99999999", "-1", "2+3"]) {
    const r = spawnSync("bash", ["bin/pulse-aidd"], { cwd: RACINE, encoding: "utf8", timeout: 20000, env: environnement({ PULSE_RELAIS_ARGC: argc, PULSE_RELAIS_ARG_0: "reference" }) });
    assert.strictEqual(r.status, 0, `${argc} : ${r.stderr}`);
    assert.match(r.stdout, /pulse-aidd contexte <commande>/, `${argc} : sans argument, l'aide`);
    assert.ok(!fsP.existsSync(path.join(d, "execute")), `${argc} : expression exécutée`);
  }
});

test("relais .ps1 : avec des arguments sur la ligne de commande, l'environnement est ignoré puis effacé", () => {
  const r = spawnSync("bash", ["bin/pulse-aidd", "reference", "x"], {
    cwd: RACINE,
    encoding: "utf8",
    env: environnement({ PULSE_RELAIS_ARGC: "2", PULSE_RELAIS_ARG_0: "secrets", PULSE_RELAIS_ARG_1: "envoyer" }),
  });
  assert.strictEqual(r.status, 1, r.stderr);
  assert.ok(r.stdout.includes("Référence introuvable : x."), r.stdout);
  const pack = projetAvecPack({ declare: "essai", installe: "essai" });
  const p = spawnSync("bash", ["-c", `PATH="$(cd "${pack.bin}" && pwd):$PATH" exec bash "${OUTIL}" pile relais`], {
    cwd: pack.d,
    encoding: "utf8",
    env: environnement({ PULSE_RELAIS_ARGC: "1", PULSE_RELAIS_ARG_0: "secrets", PULSE_RELAIS_ARG_7: "reste" }),
  });
  assert.strictEqual(p.stdout, "absent", p.stdout + p.stderr);
});

test("piles : les relais .ps1 et .cmd d'un pack ne comptent pas comme d'autres packs", () => {
  const avec = projetAvecPack({ installe: "essai" });
  for (const ext of ["ps1", "cmd"]) {
    const f = path.join(avec.d, "faux-bin", `pulse-pile-essai.${ext}`);
    fsP.writeFileSync(f, "#!/bin/sh\n");
    fsP.chmodSync(f, 0o755);
  }
  const r = avec.lancerIci("piles");
  assert.strictEqual((r.stdout.match(/^- essai /gm) || []).length, 1, r.stdout);
  assert.doesNotMatch(r.stdout, /essai\.(ps1|cmd)/);
});

test("relais .ps1 (Windows) : « & », espaces, guillemets et accents arrivent tels quels, sans rien exécuter", { skip: sansPowerShell }, () => {
  for (const exe of POWERSHELLS) {
    const d = fsP.mkdtempSync(path.join(osP.tmpdir(), "pulse-ps1-"));
    const arg = 'x&type>inj.txt c "d" é';
    const r = viaPowerShell(exe, RELAIS_PS1, ["reference", arg], { cwd: d });
    assert.strictEqual(r.status, 1, `${exe} : ${r.stdout}${r.stderr}`);
    assert.ok(r.stdout.includes(`Référence introuvable : ${arg}.`), `${exe} : ${r.stdout}`);
    assert.ok(!fsP.existsSync(path.join(d, "inj.txt")), `${exe} : la suite de « & » a été exécutée`);
    const v = viaPowerShell(exe, RELAIS_PS1, ["modele", "lexique.md"], { cwd: d });
    assert.strictEqual(v.status, 0, `${exe} : ${v.stderr}`);
    assert.strictEqual(v.stdout.replace(/\r\n/g, "\n"), fsP.readFileSync(path.join(RACINE, "templates", "lexique.md"), "utf8"), exe);
  }
});

const PWSH7 = POWERSHELLS.find((f) => /pwsh\.exe$/i.test(f));
test("relais .ps1 (PowerShell 7) : des appels en parallèle gardent chacun leurs arguments", { skip: !PWSH7 && "PowerShell 7 absent" }, () => {
  const script =
    `$r = 1..12 | ForEach-Object -ThrottleLimit 12 -Parallel { $o = (& ${litteral(RELAIS_PS1)} reference "v$_" "w$_") -join ' '; ` +
    `if ($o -notlike "*introuvable : v$_.*") { "melange $_ : $o" } }; $r; exit 0`;
  const r = spawnSync(PWSH7, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { encoding: "utf8", timeout: 120000 });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), "", r.stdout);
});

test("relais .ps1 et .cmd (Windows) : depuis un dossier avec espaces et accents", { skip: sansPowerShell }, () => {
  const plugin = path.join(fsP.mkdtempSync(path.join(osP.tmpdir(), "pulse-chemin-")), "Jérôme et Cie", "plugin");
  fsP.mkdirSync(path.join(plugin, "bin"), { recursive: true });
  fsP.mkdirSync(path.join(plugin, "templates"));
  for (const f of ["pulse-aidd", "pulse-aidd.ps1", "pulse-aidd.cmd"]) fsP.copyFileSync(path.join(RACINE, "bin", f), path.join(plugin, "bin", f));
  fsP.copyFileSync(path.join(RACINE, "templates", "lexique.md"), path.join(plugin, "templates", "lexique.md"));
  const attendu = fsP.readFileSync(path.join(plugin, "templates", "lexique.md"), "utf8");
  for (const exe of POWERSHELLS) {
    const r = viaPowerShell(exe, path.join(plugin, "bin", "pulse-aidd.ps1"), ["modele", "lexique.md"]);
    assert.strictEqual(r.status, 0, `${exe} : ${r.stderr}`);
    assert.strictEqual(r.stdout.replace(/\r\n/g, "\n"), attendu, exe);
  }
  const c = spawnSync("cmd.exe", ["/d", "/c", path.join(plugin, "bin", "pulse-aidd.cmd"), "modele", "lexique.md"], { encoding: "utf8" });
  assert.strictEqual(c.status, 0, c.stderr);
  assert.strictEqual(c.stdout.replace(/\r\n/g, "\n"), attendu);
});

test("relais .ps1 et .cmd (Windows) : sans Git for Windows, un message clair et le code 127", { skip: sansPowerShell }, () => {
  const vide = fsP.mkdtempSync(path.join(osP.tmpdir(), "pulse-sans-git-"));
  const sys = process.env.SystemRoot || "C:\\Windows";
  const sansGit = (exe) =>
    environnement({
      Path: [path.join(sys, "System32"), sys, path.dirname(exe)].join(";"),
      ProgramW6432: vide,
      ProgramFiles: vide,
      "ProgramFiles(x86)": vide,
      LOCALAPPDATA: vide,
    });
  for (const exe of POWERSHELLS) {
    const r = viaPowerShell(exe, RELAIS_PS1, ["modele", "lexique.md"], { env: sansGit(exe) });
    assert.strictEqual(r.status, 127, `${exe} : ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /pulse-aidd : le bash de Git for Windows est introuvable/, exe);
  }
  const cmd = path.join(sys, "System32", "cmd.exe");
  const c = spawnSync(cmd, ["/d", "/c", path.join(RACINE, "bin", "pulse-aidd.cmd"), "modele", "lexique.md"], { encoding: "utf8", env: sansGit(cmd) });
  assert.strictEqual(c.status, 127, c.stdout + c.stderr);
  assert.match(c.stderr, /pulse-aidd : le bash de Git for Windows est introuvable/);
});

test("limite connue (Windows) : sous une stratégie Restricted, PowerShell refuse le relais .ps1 sans se replier sur le .cmd", { skip: sansPowerShell }, () => {
  // Une stratégie imposée par l'entreprise fait de même : la règle commune renvoie alors à l'outil Bash.
  const exe = POWERSHELLS[0];
  const script = `& ${litteral(RELAIS_PS1)} modele lexique.md; if ($null -eq $LASTEXITCODE) { exit 1 }; exit $LASTEXITCODE`;
  const r = spawnSync(exe, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { encoding: "utf8" });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /about_Execution_Policies/);
  assert.match(fsP.readFileSync(path.join(RACINE, "references", "regles-communes.md"), "utf8"), /stratégie d'entreprise bloque les scripts PowerShell : outil Bash/);
});

// ------------------------------------------------------------ Aide et commandes inconnues

// Sous-commandes de premier niveau d'un outil bash : étiquettes « nom) » du dernier « case "$1" in ».
function sousCommandes(texte) {
  return [...texte.slice(texte.lastIndexOf('case "$1" in')).matchAll(/^ {2}([a-z][a-z|-]*)\)/gm)].flatMap((m) => m[1].split("|"));
}

test("aide : pulse-aidd sans argument liste exactement ses sous-commandes, et rien du code", () => {
  const aide = lancer().stdout;
  const listees = new Set([...aide.matchAll(/^ {2}pulse-aidd ([a-z][a-z-]*)/gm)].map((m) => m[1]));
  const code = new Set(sousCommandes(fsP.readFileSync(path.join(RACINE, "bin", "pulse-aidd"), "utf8")));
  assert.deepStrictEqual([...listees].sort(), [...code].sort());
  assert.doesNotMatch(aide, /RACINE=|PULSE_RELAIS|^#!/m);
});

test("aide : la ligne secrets cite chaque action de secrets.js", () => {
  const ligne = lancer().stdout.split("\n").find((l) => l.startsWith("  pulse-aidd secrets"));
  const citees = ligne.match(/\(([^;)]*)/)[1].split(",").map((s) => s.trim()).sort();
  const source = fsP.readFileSync(path.join(RACINE, "scripts", "secrets.js"), "utf8");
  const actions = [...source.slice(source.indexOf("function principal")).matchAll(/case "([a-z-]+)":/g)].map((m) => m[1]).sort();
  assert.deepStrictEqual(citees, actions);
});

test("contexte d'une commande inconnue : un message, sans charger les règles communes", () => {
  for (const nom of ["inconnue", "", "../hooks"]) {
    const r = lancer("contexte", nom);
    assert.strictEqual(r.status, 0, "contexte ne sort jamais en erreur");
    assert.match(r.stdout, /commande inconnue/, nom);
    assert.doesNotMatch(r.stdout, /Règles communes Pulse/, nom);
  }
});

test("contexte de chaque commande du cœur : reconnue", () => {
  for (const s of fsP.readdirSync(path.join(RACINE, "skills"))) assert.doesNotMatch(lancer("contexte", s).stdout, /commande inconnue/, s);
});

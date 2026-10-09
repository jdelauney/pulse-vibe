// Tests de l'outil du pack (bin/pulse-pile-next) et de la forme de ses références.
// Lancer : node --test plugins/pulse-vibe-next/tests/pulse-pile-next.test.js (nécessite bash dans le PATH)
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const REF = path.join(RACINE, "references");
// Chemin relatif et cwd = racine du plugin : fonctionne avec Git Bash, macOS et Linux.
const lancer = (...args) => spawnSync("bash", ["bin/pulse-pile-next", ...args], { cwd: RACINE, encoding: "utf8" });
const lire = (...p) => fs.readFileSync(path.join(...p), "utf8");
const { texteRecette } = require("../scripts/decouper-recette.js");

const SECTIONS_RECETTE = [
  "## Prérequis",
  "## Variables d'environnement",
  "## Fichiers créés ou modifiés",
  "## Étapes",
  "## Scénarios Gherkin à ajouter à la spec",
  "## Tâches de plan prêtes",
  "## Tests",
  "## Points de sécurité",
  "## Pièges connus",
];
const RECETTES = ["connexion", "liste", "email", "fichiers", "paiement", "langues", "limite", "formulaire-public", "seo", "mesure-reelle"];

test("info : les quatre lignes du contrat, avec la version du manifeste", () => {
  const r = lancer("info");
  assert.strictEqual(r.status, 0, r.stderr);
  const { version } = JSON.parse(lire(RACINE, ".claude-plugin", "plugin.json"));
  assert.match(r.stdout, /^id: next$/m);
  assert.match(r.stdout, /^nom: Pulse Next\.js$/m);
  assert.match(r.stdout, /^resume: .+$/m);
  assert.match(r.stdout, new RegExp(`^version: ${version.replace(/\./g, "\\.")}$`, "m"));
});

test("contexte : chaque commande concernée reçoit ses consignes, les autres rien, toujours le code 0", () => {
  const attendus = {
    tech: ["Pour /pulse:tech", "Valeurs de docs/technical.md", "Fiche de la pile", "Le thème"],
    ui: ["Pour /pulse:ui", "Le thème"],
    express: ["Pour /pulse:express"],
    spec: ["Pour /pulse:spec", "Recettes disponibles"],
    plan: ["Pour /pulse:plan", "Fiche de la pile", "Recettes disponibles"],
    implement: ["Pour réaliser et corriger", "Fiche de la pile", "Recettes disponibles"],
    fix: ["Pour réaliser et corriger", "Fiche de la pile"],
    spirc: ["Pour réaliser et corriger"],
    review: ["Pour relire", "Fiche de la pile"],
    security: ["Pour relire", "Pour la sécurité", "Fiche de la pile"],
    test: ["Pour les tests"],
    deploy: ["Pour mettre en ligne"],
    cicd: ["Pour mettre en ligne"],
    secrets: ["Pour /pulse:secrets"],
    seo: ["Pour /pulse:seo", "Fiche de la pile", "Recettes disponibles"],
    perf: ["Pour /pulse:perf", "Fiche de la pile"],
    "search-console": ["Pour Search Console"],
    rediger: ["Pour /pulse:rediger"],
  };
  for (const [commande, titres] of Object.entries(attendus)) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0, commande);
    for (const titre of titres) assert.ok(r.stdout.includes(`----- ${titre}`), `${commande} : ${titre}`);
  }
  for (const commande of ["learn", "inconnue", ""]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout.trim(), "", commande);
  }
});

test("secrets et hebergeur : relais vers les scripts du pack", () => {
  const fiche = lancer("secrets", "fiche", "STRIPE_SECRET_KEY");
  assert.strictEqual(fiche.status, 0);
  assert.match(fiche.stdout, /^### `STRIPE_SECRET_KEY`/);
  const regles = lancer("secrets", "regles");
  assert.ok(JSON.parse(regles.stdout).variables.DATABASE_URL);
  assert.strictEqual(lancer("hebergeur").status, 1);
});

test("l'aide reste complète jusqu'à sa dernière ligne", () => {
  const r = lancer();
  assert.match(r.stdout, /seo-code/);
  assert.match(r.stdout, /hebergeur ls/);
  assert.match(r.stdout, /Ne sort jamais en erreur/);
});

test("recettes et recette : liste, lecture, nom inconnu ou chemin refusé", () => {
  const liste = lancer("recettes");
  assert.strictEqual(liste.status, 0);
  for (const nom of RECETTES) assert.match(liste.stdout, new RegExp(`^- ${nom} : .+$`, "m"), nom);
  const connexion = lancer("recette", "connexion");
  assert.strictEqual(connexion.status, 0);
  assert.match(connexion.stdout, /^# Recette : connexion$/m);
  for (const args of [["recette", "inexistante"], ["recette", "../fiche"], ["recette"]]) {
    const r = lancer(...args);
    assert.strictEqual(r.status, 1, args.join(" "));
    assert.match(r.stdout, /connexion/);
  }
});

test("reference : affiche un fichier du pack, refuse une sortie du dossier", () => {
  const r = lancer("reference", "fiche.md");
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /^# Fiche de la pile Pulse Next\.js$/m);
  assert.strictEqual(lancer("reference", "../.claude-plugin/plugin.json").status, 1);
  assert.strictEqual(lancer("reference", "absente.md").status, 1);
});

test("chaque recette suit le format commun", () => {
  for (const nom of RECETTES) {
    const texte = texteRecette(nom);
    assert.match(texte, new RegExp(`^# Recette : ${nom}$`, "m"), nom);
    assert.match(texte, /^> Quand l'utiliser : .+$/m, `${nom} : « Quand l'utiliser »`);
    for (const section of SECTIONS_RECETTE) assert.ok(texte.includes(`\n${section}\n`), `${nom} : ${section}`);
    assert.match(texte, /# language: fr/, `${nom} : scénarios en français`);
  }
});

test("chaque recette, étape ou référence citée existe", () => {
  const textes = [...fs.readdirSync(path.join(REF, "contexte")).map((f) => path.join(REF, "contexte", f)), path.join(REF, "fiche.md"), path.join(REF, "technical.md"), path.join(REF, "theme.md")];
  (function parcourir(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const chemin = path.join(d, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (e.name.endsWith(".md")) textes.push(chemin);
    }
  })(path.join(REF, "recettes"));
  const existe = (nom) => fs.existsSync(path.join(REF, "recettes", nom, "index.md"));
  const manquantes = [];
  for (const f of textes) {
    const texte = lire(f);
    for (const [, nom] of texte.matchAll(/pulse-aidd pile recette ([a-z][a-z-]*)/g)) if (!existe(nom)) manquantes.push(`${path.relative(REF, f)} : ${nom}`);
    for (const [, nom, id] of texte.matchAll(/pulse-aidd pile recette ([a-z][a-z-]*) etape ([a-z0-9-]+)/g))
      if (!fs.existsSync(path.join(REF, "recettes", nom, `etape-${id}.md`))) manquantes.push(`${path.relative(REF, f)} : ${nom} etape ${id}`);
    for (const [, chemin] of texte.matchAll(/pulse-aidd pile reference ([\w./-]+\.md)/g))
      if (!fs.existsSync(path.join(REF, chemin))) manquantes.push(`${path.relative(REF, f)} : ${chemin}`);
  }
  assert.deepStrictEqual(manquantes, []);
});

test("recette connexion : vue d'ensemble, une étape, les tests ; étape ou argument inconnus refusés", () => {
  const index = lancer("recette", "connexion");
  assert.strictEqual(index.status, 0, index.stderr);
  assert.match(index.stdout, /^# Recette : connexion$/m);
  assert.match(index.stdout, /^- Étape 1 – .+ : `pulse-aidd pile recette connexion etape 1`$/m);
  assert.ok(index.stdout.length <= 30000, `vue d'ensemble : ${index.stdout.length}`);
  const etape = lancer("recette", "connexion", "etape", "3");
  assert.strictEqual(etape.status, 0);
  assert.match(etape.stdout, /^### 3\. /);
  const tests = lancer("recette", "connexion", "tests");
  assert.strictEqual(tests.status, 0);
  assert.match(tests.stdout, /### Intégration/);
  for (const args of [["recette", "connexion", "etape", "99"], ["recette", "connexion", "etape", "../index"], ["recette", "connexion", "etape"], ["recette", "connexion", "autre"]]) {
    const r = lancer(...args);
    assert.strictEqual(r.status, 1, args.join(" "));
    assert.match(r.stdout, /etape 1|Usage/, args.join(" "));
  }
});

test("le pack reste générique : aucune mention d'une formation, d'un formateur ou de stagiaires", () => {
  const trouves = [];
  (function parcourir(dossier) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (!/\.(ico|png)$/.test(e.name) && e.name !== path.basename(__filename)) {
        const lignes = fs.readFileSync(chemin, "utf8").split("\n");
        lignes.forEach((ligne, i) => {
          // Mots entiers ; « atelier » en minuscules seulement (une séance), pas un nom propre (« Atelier Dupont »).
          if (/\b[Ff]ormat(eur|rice)s?\b|\b[Ss]tagiaires?\b|\b[Ee]n formation\b|\bsalle de formation\b|(?<![-\w])ateliers?(?![-\w])/.test(ligne))
            trouves.push(`${path.relative(RACINE, chemin)}:${i + 1}`);
        });
      }
    }
  })(RACINE);
  assert.deepStrictEqual(trouves, []);
});

test("aucune clé ressemblant à une vraie dans les références et le squelette", () => {
  const { trouverSecrets } = require(path.join(RACINE, "..", "pulse-vibe", "scripts", "motifs.js"));
  const trouves = [];
  (function parcourir(dossier) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (!/\.ico$/.test(e.name)) {
        const s = trouverSecrets(fs.readFileSync(chemin, "utf8"));
        if (s.length) trouves.push(`${path.relative(RACINE, chemin)} : ${s.join(", ")}`);
      }
    }
  })(RACINE);
  assert.deepStrictEqual(trouves, []);
});

test("la fiche s'accompagne de l'architecture pour tech, plan et review ; à la demande pour réaliser et corriger", () => {
  for (const commande of ["tech", "plan", "review"]) {
    const r = lancer("contexte", commande);
    assert.strictEqual(r.status, 0);
    assert.match(r.stdout, /----- Architecture du code/, commande);
  }
  for (const commande of ["implement", "fix", "spirc", "auto-fix"]) {
    const r = lancer("contexte", commande);
    assert.doesNotMatch(r.stdout, /----- Architecture du code/, commande);
    assert.match(r.stdout, /pulse-aidd pile reference architecture.md/, commande);
  }
});

test("recette fichiers : la CSP autorise l'envoi direct vers R2, valeur connue à la construction", () => {
  const texte = texteRecette("fichiers");
  assert.match(texte, /\| `next\.config\.ts` \(modifié\) \|/);
  assert.ok(texte.includes('"connect-src": ['), "bloc connect-src");
  // Sans forcePathStyle, le SDK signe une adresse <bucket>.<compte>.eu.r2… : la CSP vise cet hôte exact.
  assert.ok(texte.includes("`https://${process.env.R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`"), "hôte R2 avec le bucket dans la CSP");
  assert.match(texte, /pulse-next 0.9.0/, "version du squelette qui porte l'objet sources");
  assert.match(texte, /### \d+\. La CSP autorise R2/);
  assert.match(texte, /Refused to connect/);
});

test("contexte security : en-têtes dans next.config.ts, sans nonce, preload décidé par la personne", () => {
  const texte = lire(REF, "contexte", "security.md");
  for (const attendu of ["next.config.ts", "`sources`", "nonce", "cacheComponents", "preload", "proxy.ts", "pulse-aidd sonder http://localhost:3000 --entetes", "un seul `headers()`"])
    assert.ok(texte.includes(attendu), attendu);
});

test("recette mesure-reelle : en développement, la CSP autorise le script de diagnostic de Speed Insights", () => {
  const texte = texteRecette("mesure-reelle");
  assert.ok(texte.includes("| `next.config.ts` (modifié) | A |"), "ligne du tableau des fichiers");
  assert.ok(texte.includes(`...(enDeveloppement ? ["'unsafe-eval'", "https://va.vercel-scripts.com"] : [])`), "source de développement");
});

test("contexte security : sources de toutes les recettes qui touchent la CSP", () => {
  const texte = lire(REF, "contexte", "security.md");
  for (const attendu of ["mesure-reelle", "va.vercel-scripts.com", "vercel.live", "si elle manque"]) assert.ok(texte.includes(attendu), attendu);
});

test("recette limite : trois stratégies, la base par défaut, la garde dans src/lib/limite.ts", () => {
  const texte = texteRecette("limite");
  for (const attendu of ["LIMITE_STOCKAGE", "limiteurBase", "limiteurUpstash", "limiteurMemoire", "src/core/shared/limiteur.port.ts", "src/lib/limite.ts", "onConflictDoUpdate", "verifierContratLimiteur"])
    assert.ok(texte.includes(attendu), attendu);
  assert.match(texte, /z\.enum\(\["base", "redis", "memoire"\]\)\.default\("base"\)/);
});

test("le chemin de la garde de limite est le même partout", () => {
  const anciens = [];
  for (const nom of ["mesure-reelle", "email", "connexion"]) if (texteRecette(nom).includes("@src/adapters/limite/limite.adapter")) anciens.push(`recettes/${nom}`);
  for (const f of ["architecture.md", "fiche.md"]) if (lire(REF, f).includes("@src/adapters/limite/limite.adapter")) anciens.push(f);
  assert.deepStrictEqual(anciens, []);
});

test("recette formulaire-public : champ piège, jeton signé, limite, Turnstile en option avec sa CSP", () => {
  const texte = texteRecette("formulaire-public");
  for (const attendu of ["champ_verification", "FORMULAIRE_SECRET", "actionFormulairePublic", "useProtectionFormulaire", "app/api/jeton-formulaire/route.ts", "pulse-aidd pile recette limite", "timingSafeEqual", "Rechargez la page et réessayez.", "Envoi trop rapide. Patientez quelques secondes, puis réessayez."])
    assert.ok(texte.includes(attendu), attendu);
  assert.match(texte, /### Option : Turnstile/);
  assert.match(texte, /### \d+\. La CSP autorise Turnstile/);
  assert.ok(texte.includes('"frame-src": ["https://challenges.cloudflare.com"]'), "frame-src Turnstile");
  assert.match(texte, /\n## CSRF\n/);
  assert.match(texte, /\| `next\.config\.ts` \(modifié, option Turnstile\) \|/);
});

test("contexte security : Turnstile parmi les sources ajoutées par les recettes", () => {
  const texte = lire(REF, "contexte", "security.md");
  assert.ok(texte.includes("challenges.cloudflare.com"), "hôte Turnstile");
});

test("recette limite : les étapes de base n'utilisent pas Upstash, l'option Redis l'ajoute", () => {
  const texte = texteRecette("limite");
  const [base, option] = texte.split("### Option : Redis");
  assert.ok(option, "section de l'option Redis");
  assert.ok(!base.includes("@src/adapters/limite/upstash.adapter"), "aucun import d'Upstash avant l'option");
  assert.ok(!base.includes("npm install @upstash"), "aucune installation d'Upstash avant l'option");
  assert.ok(base.includes('z.enum(["base", "memoire"]).default("base")'), "variables de base sans redis");
  assert.ok(option.includes('import { limiteurUpstash } from "@src/adapters/limite/upstash.adapter";'), "la garde complète dans l'option");
});

test("recette formulaire-public : correctifs de revue (champ neutre, clés Turnstile ensemble, échec du widget)", () => {
  const texte = texteRecette("formulaire-public");
  assert.ok(!texte.includes("site_web_societe"), "ancien nom du champ piège");
  for (const attendu of ["data-1p-ignore", "n'a pas pu se charger", "NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional()", "les deux clés Turnstile vont ensemble", "VARIABLES_VALIDES", "e2e/turnstile.spec.ts"])
    assert.ok(texte.includes(attendu), attendu);
  assert.ok(!/@e2e\b/.test(texte), "étiquette @bout-en-bout, comme les autres recettes");
});

test("express et spec orientent vers formulaire-public", () => {
  assert.match(lire(REF, "contexte", "express.md"), /formulaires publics → `formulaire-public`/);
  assert.match(lire(REF, "contexte", "spec.md"), /formulaire public/);
});

test("la référence sécurité du cœur accepte le jeton signé et le refus neutre de la recette", () => {
  const texte = lire(RACINE, "..", "pulse-vibe", "references", "qualite", "securite-code.md");
  assert.match(texte, /jeton signé par le serveur/);
  assert.match(texte, /Rechargez la page et réessayez/);
});

test("contexte ui du pack : chaque motif a son composant shadcn", () => {
  const t = lire(REF, "contexte", "ui.md");
  for (const c of ["`combobox`", "`sheet`", "`alert-dialog`", "`empty`", "`chart`", "`sonner`", "`skeleton`", "`sidebar`"]) assert.ok(t.includes(c), c);
});

test("contexte ui du pack : les composants réalisent les motifs tels quels", () => {
  const t = lire(REF, "contexte", "ui.md");
  for (const attendu of ["duration: Infinity", "closeButton: true", "action: {", "sticky top-0", "overflow-y-auto", "useIsMobile", "accessibilityLayer", 'variant="destructive"'])
    assert.ok(t.includes(attendu), attendu);
});

// Contrastes mesurés par l'outil du cœur (pulse-aidd contraste), transparence comprise.
const { lireCouleur, poser, rapport } = require(path.join(RACINE, "..", "pulse-vibe", "scripts", "contraste.js"));

test("squelette : contour des champs et halo de focus à 3:1 au moins, en clair et en sombre", () => {
  const css = lire(RACINE, "templates", "squelette", "app", "globals.css");
  for (const bloc of [":root {", ".dark {"]) {
    const corps = css.slice(css.indexOf(bloc)).split("}")[0];
    const valeur = (nom, opacite) => {
      const m = corps.match(new RegExp(`--${nom}: oklch\\(([^)/]+)\\);`));
      assert.ok(m, `${bloc} --${nom} : couleur OKLCH opaque`);
      return lireCouleur(`oklch(${m[1]}${opacite === undefined ? "" : ` / ${opacite}`})`);
    };
    const fond = valeur("background");
    assert.ok(rapport(valeur("input"), fond) >= 3, `${bloc} --input`);
    for (const ring of ["ring", "sidebar-ring"]) assert.ok(rapport(valeur(ring, 0.5), fond) >= 3, `${bloc} halo ${ring}/50`);
    if (bloc === ".dark {") assert.ok(rapport(valeur("foreground"), poser(valeur("input", 0.3), fond)) >= 4.5, "texte sur bg-input/30");
  }
});

test("le cœur et le pack mesurent les contrastes avec pulse-aidd contraste", () => {
  const coeur = path.join(RACINE, "..", "pulse-vibe");
  for (const f of [["references", "design", "regles-ui.md"], ["agents", "designer.md"], ["agents", "ui-critic.md"], ["skills", "ui", "SKILL.md"]]) {
    const t = lire(coeur, ...f);
    assert.ok(t.includes("pulse-aidd contraste"), f.join("/"));
    assert.doesNotMatch(t, /calculer précisément|\(calculer\)|le calculer quand/, f.join("/"));
  }
  assert.ok(lire(REF, "theme.md").includes("pulse-aidd contraste"), "theme.md");
});

test("theme.md : nuances hors de @theme inline, halo de focus à 50 %", () => {
  const t = lire(REF, "theme.md");
  for (const attendu of ["ring-ring/50", "hors de `@theme inline`", "var(--"]) assert.ok(t.includes(attendu), attendu);
});

test("chaque action des recettes et de l'architecture porte un nom (.metadata), journalisé par safe-action", () => {
  const sansNom = [];
  const fichiers = [path.join(REF, "architecture.md")];
  (function parcourir(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) (e.isDirectory() ? parcourir : (c) => fichiers.push(c))(path.join(d, e.name));
  })(path.join(REF, "recettes"));
  for (const f of fichiers) {
    const lignes = lire(f).split("\n");
    lignes.forEach((ligne, i) => {
      // Une action commence par « export const x = <client> » ; la ligne suivante la nomme.
      const m = /^export const (\w+) = (?:actionPublique|actionConnectee|actionFormulairePublic\([^)]*\))(\.action\(.*)?$/.exec(ligne);
      if (m && (m[2] || !/^ {2}\.metadata\(\{ nom: "[^"]+" \}\)$/.test(lignes[i + 1] || ""))) sansNom.push(`${path.basename(f)} : ${m[1]}`);
    });
  }
  assert.deepStrictEqual(sansNom, []);
  const safeAction = texteRecette("connexion").split("// src/lib/safe-action.ts")[1].split("```")[0];
  for (const attendu of ["defineMetadataSchema()", "handleServerError(erreur, { metadata, ctx })", "x-vercel-id", "export const actionConnectee"]) assert.ok(safeAction.includes(attendu), attendu);
  // Le client public de la recette est celui du squelette, à l'identique : un seul modèle à tenir.
  const squelette = lire(RACINE, "templates", "squelette", "src", "lib", "safe-action.ts");
  for (const t of [safeAction, squelette]) assert.ok(t.includes("export const actionPublique"), "actionPublique présent");
  const clientPublic = (t) => t.slice(t.indexOf("export const MESSAGE_ERREUR_ACTION"), t.indexOf("\n});\n", t.indexOf("export const actionPublique")) + 5);
  const commentaires = (t) => t.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.strictEqual(commentaires(clientPublic(safeAction)), commentaires(clientPublic(squelette)), "connexion etape-5 : actionPublique identique au squelette");
});

test("architecture : une facture se paie une seule fois, même avec deux demandes simultanées", () => {
  const t = lire(REF, "architecture.md");
  for (const attendu of ["marquerPayee(id: string, utilisateurId: string, le: Date): Promise<boolean>;", "isNull(factures.payeeLe)", ".returning({ id: factures.id })", 'return marquee ? ok(undefined) : echec("facture-deja-payee");'])
    assert.ok(t.includes(attendu), attendu);
});

test("production : base dev séparée, intégration Vercel–Neon, migrations sauvegardées, retour arrière", () => {
  const technique = lire(REF, "technical.md");
  for (const attendu of ["nom `dev`", "Automatically delete branch after", "\n## Retour arrière\n", "Instant Rollback", "Undo Rollback", "Restore from history", "DATABASE_URL_UNPOOLED", "NEON_API_KEY", "package-lock.json"])
    assert.ok(technique.includes(attendu), `technical.md : ${attendu}`);
  const deploy = lire(REF, "contexte", "deploy.md");
  for (const attendu of ["Link Existing Neon Account", "preview/<branche Git>", "node scripts/migrer.mjs --vercel && npm run build", "sauvegarde-AAAAMMJJ-HHMM", "Project-scoped", "en deux mises en ligne", "Failed to set environment variables"])
    assert.ok(deploy.includes(attendu), `deploy.md : ${attendu}`);
  assert.ok(!deploy.includes("appliquer `npm run db:migrate` sur la base de production"), "plus de migration à la main en production");
  const secrets = lire(REF, "contexte", "secrets.md");
  assert.match(secrets, /^### `NEON_API_KEY`$/m);
  assert.ok(secrets.includes("Une valeur par environnement"), "DATABASE_URL : une valeur par environnement");
});

test("fiche : règles numérotées de 1 à N sans trou, sans note de migration", () => {
  const fiche = lire(REF, "fiche.md");
  const numeros = [...fiche.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepStrictEqual(numeros, numeros.map((_, i) => i + 1));
  assert.doesNotMatch(fiche, /créé avant pulse-(?:vibe-)?next/);
});

test("renvois « fiche, règle N » : chaque numéro vise la règle annoncée", () => {
  const fiche = lire(REF, "fiche.md");
  const regle = (n) => (fiche.match(new RegExp(`^${n}\. (.*)$`, "m")) || [])[1] || "";
  const sujets = { 5: "use cache", 26: "Types", 32: "Images", 41: "Métadonnées d'une page publique", 47: "Pages d'authentification" };
  const textes = [];
  (function parcourir(dossier) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (/\.(md|js)$/.test(e.name) && chemin !== __filename) textes.push(chemin);
    }
  })(RACINE);
  for (const f of textes) {
    for (const m of lire(f).matchAll(/fiche, règle (\d+)|règle (\d+) de la fiche/g)) {
      const n = m[1] || m[2];
      assert.ok(sujets[n], `${path.relative(RACINE, f)} cite la règle ${n} : ajouter son sujet à ce test`);
      assert.ok(regle(n).includes(sujets[n]), `${path.relative(RACINE, f)} : la règle ${n} n'est plus « ${sujets[n]} »`);
    }
  }
});

test("migrations.md : notes de mise à niveau, lues par /pulse:init seulement", () => {
  const notes = lire(REF, "migrations.md");
  for (const version of ["0.9.0", "0.11.0", "0.17.0"]) assert.match(notes, new RegExp(`Projet créé avant pulse-next ${version.replace(/\./g, "\\.")}`));
  for (const commande of ["tech", "plan", "implement", "review", "security", "deploy", "seo"])
    assert.ok(!lancer("contexte", commande).stdout.includes("mettre à niveau un projet plus ancien"), commande);
  assert.strictEqual(lancer("reference", "migrations.md").status, 0);
  assert.match(lire(RACINE, "..", "pulse-vibe", "skills", "init", "SKILL.md"), /pulse-aidd pile reference migrations\.md/);
  assert.match(lire(REF, "contexte", "security.md"), /pulse-aidd pile reference migrations\.md/);
});

test("README du projet : « Tester en local » fourni par le pack, lignes des recettes à outil", () => {
  const readme = lire(REF, "readme.md");
  for (const attendu of ["npm install", "npx playwright install chromium", "npm run dev", "http://localhost:3000", "vercel link", "mailpit", "http://localhost:8025"]) assert.ok(readme.includes(attendu), attendu);
  const ecoute = texteRecette("paiement").match(/^stripe listen .*$/m)[0];
  assert.ok(readme.includes(ecoute), "même commande stripe listen que la recette paiement");
  assert.match(lire(REF, "contexte", "tech.md"), /« Tester en local » par le bloc de base de `pulse-aidd pile reference readme\.md`/);
  assert.match(lire(REF, "contexte", "implement.md"), /pulse-aidd pile reference readme\.md/);
});

test("recette langues : le layout par langue garde le lien d'évitement et la zone #contenu du squelette", () => {
  const langues = texteRecette("langues");
  const layout = langues.slice(langues.indexOf("// app/[locale]/layout.tsx"));
  const code = layout.slice(0, layout.indexOf("```"));
  assert.ok(code.includes('href="#contenu"'), 'lien href="#contenu"');
  assert.ok(code.includes('id="contenu"'), 'zone id="contenu"');
  assert.ok(code.includes('t("allerAuContenu")'), "texte du lien traduit");
  assert.match(langues, /"allerAuContenu": "Aller au contenu"/);
  assert.match(langues, /"allerAuContenu": "Skip to content"/);
});

test("deploy : commande de construction complète, migrations juste avant la construction", () => {
  const deploy = lire(REF, "contexte", "deploy.md");
  assert.ok(
    deploy.includes("node scripts/verifier.js && npm run check && npm run typecheck && npm test && node scripts/migrer.mjs --vercel && npm run build"),
    "buildCommand complet avec migrer.mjs juste avant npm run build",
  );
});

test("toutes les recettes sont découpées : un dossier avec index.md, plus aucun recettes/<nom>.md", () => {
  for (const nom of RECETTES) {
    assert.ok(fs.existsSync(path.join(REF, "recettes", nom, "index.md")), `${nom}/index.md`);
    assert.ok(fs.existsSync(path.join(REF, "recettes", nom, "tests.md")), `${nom}/tests.md`);
    assert.ok(!fs.existsSync(path.join(REF, "recettes", `${nom}.md`)), `${nom}.md retiré`);
  }
  const limite = lancer("recette", "limite", "etape", "option-redis");
  assert.strictEqual(limite.status, 0);
  assert.match(limite.stdout, /^### Option : Redis/);
  assert.strictEqual(lancer("recette", "mesure-reelle", "etape", "option-a").status, 0);
  assert.strictEqual(lancer("recette", "formulaire-public", "etape", "option-turnstile").status, 0);
  assert.strictEqual(lancer("recette", "connexion", "etape", "2").status, 0);
});

test("recette <nom> tests sans tests.md : message clair et code 1", () => {
  const d = fs.mkdtempSync(path.join(require("os").tmpdir(), "pulse-pack-"));
  try {
    fs.mkdirSync(path.join(d, "bin"));
    fs.copyFileSync(path.join(RACINE, "bin", "pulse-pile-next"), path.join(d, "bin", "pulse-pile-next"));
    fs.mkdirSync(path.join(d, "references", "recettes", "essai"), { recursive: true });
    fs.writeFileSync(path.join(d, "references", "recettes", "essai", "index.md"), "# Recette : essai\n");
    const r = spawnSync("bash", ["bin/pulse-pile-next", "recette", "essai", "tests"], { cwd: d, encoding: "utf8" });
    assert.strictEqual(r.status, 1);
    assert.match(r.stdout, /La recette essai n'a pas de tests à copier/);
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("relais .ps1 : bash relit les arguments dans l'environnement, tels quels", () => {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^PULSE_RELAIS_/i.test(k)) env[k] = v;
  const arg = 'a&b "c" d';
  const r = spawnSync("bash", ["bin/pulse-pile-next"], { cwd: RACINE, encoding: "utf8", env: { ...env, PULSE_RELAIS_ARGC: "2", PULSE_RELAIS_ARG_0: "reference", PULSE_RELAIS_ARG_1: arg } });
  assert.strictEqual(r.status, 1, r.stderr);
  assert.ok(r.stdout.includes(`Référence introuvable : ${arg}.`), r.stdout);
});

test("aide : pulse-pile-next sans argument liste exactement ses sous-commandes, et rien du code", () => {
  const texte = lire(RACINE, "bin", "pulse-pile-next");
  const code = [...texte.slice(texte.lastIndexOf('case "$1" in')).matchAll(/^ {2}([a-z][a-z|-]*)\)/gm)].flatMap((m) => m[1].split("|"));
  const aide = lancer().stdout;
  const listees = new Set([...aide.matchAll(/^ {2}pulse-pile-next ([a-z][a-z-]*)/gm)].map((m) => m[1]));
  assert.deepStrictEqual([...listees].sort(), [...new Set(code)].sort());
  assert.doesNotMatch(aide, /RACINE=|PULSE_RELAIS|^#!/m);
});

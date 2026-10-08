// Tests du garde-fou anti-secrets et du script de vérification.
// Lancer : node --test plugins/pulse-vibe/tests/
// Les fausses clés sont construites à l'exécution pour ne jamais figurer telles quelles dans le dépôt.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const HOOK = path.join(RACINE, "scripts", "garde-secrets.js");
const VERIFIER = path.join(RACINE, "templates", "verifier.js");

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (role) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ iss: "supabase", role, iat: 1700000000 })}.${"s".repeat(43)}`;

const FAUX = {
  stripe: ["sk", "test", "4eC39HqLyjWDarjtT1zdp7dc"].join("_"),
  resend: ["re", "Ab12Cd34", "Ef56Gh78Ij90KlMnOp"].join("_"),
  anon: jwt("anon"),
  serviceRole: jwt("service_role"),
};

function lancerHook(entree, env = {}) {
  const r = spawnSync("node", [HOOK], {
    input: typeof entree === "string" ? entree : JSON.stringify(entree),
    encoding: "utf8",
    env: { ...process.env, PULSE_GARDE_OFF: "", ...env },
  });
  assert.strictEqual(r.status, 0, "le hook doit toujours sortir avec le code 0");
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
}

const refuse = (sortie) => sortie && sortie.permissionDecision === "deny";

function depotTemporaire() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-test-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  fs.mkdirSync(path.join(dir, "public"));
  fs.writeFileSync(path.join(dir, "public", "index.html"), "<h1>Test</h1>\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  return { dir, git, ecrire: (f, c) => fs.writeFileSync(path.join(dir, f), c) };
}

const bash = (commande, cwd) => ({ tool_name: "Bash", tool_input: { command: commande }, cwd });

// ------------------------------------------------------------ Écritures

test("bloque une clé Stripe écrite dans un fichier de code", () => {
  const s = lancerHook({ tool_name: "Write", tool_input: { file_path: "/p/public/app.js", content: `const k = "${FAUX.stripe}";` } });
  assert.ok(refuse(s));
  assert.match(s.permissionDecisionReason, /Stripe/);
});

test("autorise une clé dans .env", () => {
  assert.strictEqual(lancerHook({ tool_name: "Write", tool_input: { file_path: "/p/.env", content: `STRIPE_SECRET_KEY=${FAUX.stripe}` } }), null);
});

test("bloque une vraie valeur dans .env.example", () => {
  assert.ok(refuse(lancerHook({ tool_name: "Write", tool_input: { file_path: "/p/.env.example", content: `STRIPE_SECRET_KEY=${FAUX.stripe}` } })));
});

test("autorise la clé publique Supabase (anon), bloque la clé service_role", () => {
  assert.strictEqual(lancerHook({ tool_name: "Write", tool_input: { file_path: "/p/public/config.js", content: `export const KEY = "${FAUX.anon}";` } }), null);
  const s = lancerHook({ tool_name: "Write", tool_input: { file_path: "/p/public/config.js", content: `export const KEY = "${FAUX.serviceRole}";` } });
  assert.ok(refuse(s));
  assert.match(s.permissionDecisionReason, /service_role/);
});

test("bloque une clé Resend dans un Edit, ignore old_string", () => {
  assert.ok(refuse(lancerHook({ tool_name: "Edit", tool_input: { file_path: "/p/f.js", old_string: "x", new_string: `key = "${FAUX.resend}"` } })));
  assert.strictEqual(lancerHook({ tool_name: "Edit", tool_input: { file_path: "/p/f.js", old_string: `key = "${FAUX.resend}"`, new_string: "key = process.env.RESEND_API_KEY" } }), null);
});

test("n'est pas déclenché par du code ordinaire", () => {
  const code = 're_render_component_now(); const sk = "sk-court"; const password = input.value;';
  assert.strictEqual(lancerHook({ tool_name: "Write", tool_input: { file_path: "/p/app.js", content: code } }), null);
});

// ------------------------------------------------------------ Git

test("git add explicite d'un .env : bloqué", () => {
  const d = depotTemporaire();
  d.ecrire(".env", "A=1\n");
  assert.ok(refuse(lancerHook(bash("git add .env", d.dir))));
});

test("git add . avec un .env non ignoré : bloqué ; ignoré : autorisé", () => {
  const d = depotTemporaire();
  d.ecrire(".env", "A=1\n");
  d.ecrire("app.js", "console.log('ok');\n");
  assert.ok(refuse(lancerHook(bash("git add .", d.dir))));
  d.ecrire(".gitignore", ".env\n");
  assert.strictEqual(lancerHook(bash("git add . && git commit -m 'x'", d.dir)), null);
});

test("git add d'un fichier précis sain : autorisé même si un autre fichier pose problème", () => {
  const d = depotTemporaire();
  d.ecrire("app.js", "console.log('ok');\n");
  d.ecrire("brouillon.js", `const k = "${FAUX.stripe}";\n`);
  assert.strictEqual(lancerHook(bash("git add app.js", d.dir)), null);
  assert.ok(refuse(lancerHook(bash("git add brouillon.js", d.dir))));
});

test("git add d'un fichier précis : bloqué aussi quand le dossier courant passe par un lien (ou un nom court Windows)", () => {
  const d = depotTemporaire();
  d.ecrire("brouillon.js", `const k = "${FAUX.stripe}";\n`);
  // Git renvoie le chemin réel du dépôt ; le dossier courant peut en être un autre nom (lien, RUNNER~1).
  const lien = path.join(os.tmpdir(), `pulse-lien-${process.pid}-${Date.now()}`);
  fs.symlinkSync(d.dir, lien, "junction");
  try {
    assert.ok(refuse(lancerHook(bash("git add brouillon.js", lien))));
  } finally {
    fs.unlinkSync(lien);
  }
});

test("git commit avec un secret dans l'index : bloqué et le fichier est nommé", () => {
  const d = depotTemporaire();
  d.ecrire("app.js", `const k = "${FAUX.stripe}";\n`);
  d.git("add", "app.js");
  const s = lancerHook(bash('git commit -m "feat: test"', d.dir));
  assert.ok(refuse(s));
  assert.match(s.permissionDecisionReason, /app\.js/);
});

test("git commit -am inclut les fichiers suivis modifiés", () => {
  const d = depotTemporaire();
  d.ecrire("public/index.html", `<script>const k="${FAUX.stripe}"</script>\n`);
  assert.strictEqual(lancerHook(bash('git commit -m "x"', d.dir)), null);
  assert.ok(refuse(lancerHook(bash('git commit -am "x"', d.dir))));
});

test("git commit sain : autorisé", () => {
  const d = depotTemporaire();
  d.ecrire("app.js", "const k = process.env.KEY;\n");
  d.git("add", "app.js");
  assert.strictEqual(lancerHook(bash('git commit -m "feat: ok"', d.dir)), null);
});

test("git push avec un .env suivi par Git : bloqué", () => {
  const d = depotTemporaire();
  d.ecrire(".env", "A=1\n");
  d.git("add", "-f", ".env");
  d.git("commit", "-q", "-m", "oups");
  const s = lancerHook(bash("git push", d.dir));
  assert.ok(refuse(s));
  assert.match(s.permissionDecisionReason, /git rm --cached/);
});

test("hors dépôt Git, commande sans git, entrée invalide, désactivation : laisse passer", () => {
  const vide = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-vide-"));
  assert.strictEqual(lancerHook(bash("git commit -m x", vide)), null);
  assert.strictEqual(lancerHook(bash("ls -la", vide)), null);
  assert.strictEqual(lancerHook("ceci n'est pas du JSON"), null);
  assert.strictEqual(
    lancerHook({ tool_name: "Write", tool_input: { file_path: "/p/a.js", content: FAUX.stripe } }, { PULSE_GARDE_OFF: "1" }),
    null
  );
});

// ------------------------------------------------------------ verifier.js

test("verifier.js contient exactement les mêmes motifs que motifs.js", () => {
  const extraire = (f) => {
    const s = fs.readFileSync(f, "utf8");
    return s.slice(s.indexOf("// DEBUT-MOTIFS"), s.indexOf("// FIN-MOTIFS"));
  };
  assert.strictEqual(extraire(VERIFIER), extraire(path.join(RACINE, "scripts", "motifs.js")));
});

test("verifier.js : réussit sur un projet sain, échoue avec un secret ou un .env suivi", () => {
  const d = depotTemporaire();
  const lancer = () => spawnSync("node", [VERIFIER], { cwd: d.dir, encoding: "utf8" });
  assert.strictEqual(lancer().status, 0);

  d.ecrire("public/app.js", `const k = "${FAUX.stripe}";\n`);
  d.git("add", "-A");
  const r = lancer();
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /public\/app\.js/);

  d.ecrire("public/app.js", "const ok = true;\n");
  d.ecrire(".env", "A=1\n");
  d.git("add", "-A", "-f");
  assert.strictEqual(lancer().status, 1);
});

// ------------------------------------------------------------ Nouveaux motifs et lecture de .env

test("reconnaît les secrets Google et Brevo, construits à l'exécution", () => {
  const { trouverSecrets } = require(path.join(RACINE, "scripts", "motifs.js"));
  const cas = {
    "secret client Google OAuth": ["GOCSPX", "-", "a".repeat(10), "B".repeat(10), "c_d-e", "fgh"].join(""),
    "jeton d'accès Google": ["ya29", ".", "A0".repeat(30)].join(""),
    "jeton de rafraîchissement Google": ["1//0", "g".repeat(40)].join(""),
    "clé d'API Google": ["AIza", "S".repeat(20), "y_".repeat(7), "Z"].join(""),
    "clé d'API Brevo": ["xkeysib", "-", "a1".repeat(32), "-", "Ab12".repeat(4)].join(""),
  };
  for (const [nom, valeur] of Object.entries(cas)) assert.deepStrictEqual(trouverSecrets(`X=${valeur}`), [nom], nom);
  assert.deepStrictEqual(trouverSecrets("const AIzaBon = 1; // ya29 court"), []);
});

test("refuse la lecture d'un fichier .env par les outils de lecture, permet .env.example", () => {
  for (const [outil, entree] of [
    ["Read", { file_path: "/p/.env" }],
    ["Read", { file_path: "C:\\p\\.env.local" }],
    ["Grep", { pattern: "KEY", path: "/p/.env.production" }],
    ["Grep", { pattern: "KEY", glob: ".env*" }],
  ]) {
    const s = lancerHook({ tool_name: outil, tool_input: entree });
    assert.ok(refuse(s), `${outil} ${JSON.stringify(entree)}`);
    assert.match(s.permissionDecisionReason, /pulse-aidd secrets inventaire/);
  }
  assert.strictEqual(lancerHook({ tool_name: "Read", tool_input: { file_path: "/p/.env.example" } }), null);
  assert.strictEqual(lancerHook({ tool_name: "Grep", tool_input: { pattern: "KEY", path: "/p/src" } }), null);
});

test("le message de refus d'écriture est agnostique et renvoie vers /pulse:secrets", () => {
  const s = lancerHook({ tool_name: "Write", tool_input: { file_path: "/p/app.js", content: `const k = "${FAUX.stripe}";` } });
  assert.doesNotMatch(s.permissionDecisionReason, /Netlify/);
  assert.match(s.permissionDecisionReason, /\/pulse:secrets fuite/);
});

test("reconnaît les jetons Neon, Vercel, Cloudflare et les adresses Redis, construits à l'exécution", () => {
  const { trouverSecrets } = require("../scripts/motifs");
  const h = (n) => require("crypto").randomBytes(n).toString("hex");
  assert.deepStrictEqual(trouverSecrets("napi" + "_" + h(26)), ["clé d'API Neon"]);
  assert.deepStrictEqual(trouverSecrets("vcp" + "_" + h(16)), ["jeton Vercel"]);
  assert.deepStrictEqual(trouverSecrets("cfat" + "_" + h(22)), ["jeton d'API Cloudflare"]);
  assert.deepStrictEqual(trouverSecrets("redis" + "s://default:" + h(8) + "@exemple.upstash.io:6379"), ["mot de passe dans une adresse de base de données"]);
  assert.deepStrictEqual(trouverSecrets("napi_ vcp_ cfat_"), []);
});

test("reconnaît les jetons GitHub classiques et sans état (format JWT, environ 520 caractères)", () => {
  const { trouverSecrets } = require("../scripts/motifs");
  const b64 = (n) => require("crypto").randomBytes(n).toString("base64url");
  assert.deepStrictEqual(trouverSecrets("ghp" + "_" + b64(27)), ["jeton GitHub"]);
  const sansEtat = "ghs" + "_" + ["eyJh-" + b64(30), "eyJ" + b64(300), b64(170)].join(".");
  assert.deepStrictEqual(trouverSecrets(`GH_TOKEN=${sansEtat}`), ["jeton GitHub"]);
  assert.deepStrictEqual(trouverSecrets("ghs_ ghp_court"), []);
});

test("fichiers d'environnement : casse, .dev.vars, .envrc ; exemples exclus", () => {
  const { estFichierEnv } = require("../scripts/motifs");
  for (const f of [".env", ".ENV", ".Env.Local", "app/.env.production", ".dev.vars", ".envrc"]) assert.ok(estFichierEnv(f), f);
  for (const f of [".env.example", ".ENV.EXAMPLE", ".env.sample", ".env.template", "env.ts", ".environment"]) assert.ok(!estFichierEnv(f), f);
});

test("Read d'un .ENV en majuscules : refusé", () => {
  assert.ok(refuse(lancerHook({ tool_name: "Read", tool_input: { file_path: "/p/.ENV" } })));
});

test("écrire une clé dans .dev.vars (fichier de secrets de Wrangler) : autorisé", () => {
  assert.strictEqual(lancerHook({ tool_name: "Write", tool_input: { file_path: "/p/.dev.vars", content: `STRIPE=${FAUX.stripe}` } }), null);
});

const powershell = (commande, cwd) => ({ tool_name: "PowerShell", tool_input: { command: commande }, cwd });

test("PowerShell : git add d'un .env et commit d'une clé refusés", () => {
  const { dir, git, ecrire } = depotTemporaire();
  ecrire(".env", "X=1\n");
  assert.ok(refuse(lancerHook(powershell("git add -f .env", dir))));
  ecrire("app.js", `const k = "${FAUX.stripe}";\n`);
  git("add", "app.js");
  assert.ok(refuse(lancerHook(powershell('git commit -m "x"', dir))));
});

test("git avec options globales, sous-shell ou xargs : contrôlé", () => {
  const { dir, git, ecrire } = depotTemporaire();
  ecrire("app.js", `const k = "${FAUX.stripe}";\n`);
  git("add", "app.js");
  assert.ok(refuse(lancerHook(bash('git -c x=y commit -m "x"', dir))));
  assert.ok(refuse(lancerHook(bash('git --no-pager commit -m "x"', dir))));
  assert.ok(refuse(lancerHook(bash(`bash -c 'git commit -m x'`, dir))));
});

test("commit par chemin : le contenu du fichier nommé est contrôlé", () => {
  const { dir, git, ecrire } = depotTemporaire();
  ecrire("app.js", "const a = 1;\n");
  git("add", "app.js");
  git("commit", "-q", "-m", "app");
  ecrire("app.js", `const k = "${FAUX.stripe}";\n`);
  assert.ok(refuse(lancerHook(bash('git commit app.js -m "maj"', dir))));
});

test("texte cité : un echo qui contient « git add .env » passe", () => {
  const { dir } = depotTemporaire();
  assert.strictEqual(lancerHook(bash('echo "git add .env" >> notes.md', dir)), null);
});

test("Grep : glob qui vise .env, ou .env non ignoré dans le dossier fouillé : refusé", () => {
  const { dir, ecrire } = depotTemporaire();
  assert.ok(refuse(lancerHook({ tool_name: "Grep", tool_input: { pattern: "KEY", glob: "{.env,.env.local}" }, cwd: dir })));
  ecrire(".env", "KEY=1\n");
  assert.ok(refuse(lancerHook({ tool_name: "Grep", tool_input: { pattern: "KEY", path: dir }, cwd: dir })));
  ecrire(".gitignore", ".env\n");
  assert.strictEqual(lancerHook({ tool_name: "Grep", tool_input: { pattern: "KEY", path: dir }, cwd: dir }), null);
  assert.strictEqual(lancerHook({ tool_name: "Grep", tool_input: { pattern: "KEY", glob: "*.ts" }, cwd: dir }), null);
});

test("git -C vers un autre dépôt : le commit du dépôt courant reste contrôlé", () => {
  const A = depotTemporaire();
  const B = depotTemporaire();
  A.ecrire("app.js", `const k = "${FAUX.stripe}";\n`);
  A.git("add", "app.js");
  assert.ok(refuse(lancerHook(bash(`git -C "${B.dir}" status && git commit -m x`, A.dir))));
});

test("commit : valeur de -m collée, le chemin qui suit est contrôlé", () => {
  const { dir, git, ecrire } = depotTemporaire();
  ecrire("app.js", "const a = 1;\n");
  git("add", "app.js");
  git("commit", "-q", "-m", "app");
  ecrire("app.js", `const k = "${FAUX.stripe}";\n`);
  assert.ok(refuse(lancerHook(bash("git commit -mtest app.js", dir))));
  assert.ok(refuse(lancerHook(bash("git commit -am msg", dir))));
});

test("Grep : glob qui nomme un fichier .env refusé, noms voisins autorisés", () => {
  const { dir } = depotTemporaire();
  const grep = (glob) => lancerHook({ tool_name: "Grep", tool_input: { pattern: "K", glob }, cwd: dir });
  for (const g of ["{.env,.env.local}", ".env*", "**/.env", ".env.local", ".ENV"]) assert.ok(refuse(grep(g)), g);
  for (const g of ["*.env.ts", "**/*.environment.ts", ".env.example", "*.ts"]) assert.strictEqual(grep(g), null, g);
});

test("pas de dépôt Git : la commande passe", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-sans-git-"));
  assert.strictEqual(lancerHook(bash('git commit -m "x"', dir)), null);
  assert.strictEqual(lancerHook(powershell('git commit -m "x"', path.join(dir, "inexistant"))), null);
});

// ------------------------------------------------------------ Motifs : exemples reconnus, nouveaux fournisseurs

const { trouverSecrets: motifs } = require("../scripts/motifs");
const alea = (n) => Array.from({ length: n }, (_, i) => "aB3dE5gH7jK9mN1pQ2rS4tU6vW8xY0z"[(i * 7 + 3) % 31]).join("");

test("adresses d'exemple : jamais signalées", () => {
  for (const t of [
    "postgres" + "ql://user:password@localhost:5432/app",
    "postgres" + "://postgres:postgres@db:5432/app",
    "redis" + "://default:secret@redis:6379",
    "mysql" + "://root:" + alea(12) + "@127.0.0.1/app",
    "https" + "://user:pass@example.com/x",
  ])
    assert.deepStrictEqual(motifs(t), [], t);
});

test("vraie adresse de base : toujours signalée", () => {
  assert.deepStrictEqual(motifs("postgres" + "ql://appli:" + alea(20) + "@ep-calme-1.eu-central-1.aws.neon.tech/base"), ["mot de passe dans une adresse de base de données"]);
  assert.deepStrictEqual(motifs("https" + "://moi:" + alea(16) + "@registre.entreprise.fr/x"), ["mot de passe dans une adresse web"]);
});

test("nouveaux fournisseurs reconnus", () => {
  assert.ok(motifs("hf" + "_" + alea(34)).includes("jeton Hugging Face"));
  assert.ok(motifs("glpat" + "-" + alea(20)).includes("jeton GitLab"));
  assert.ok(motifs("npm" + "_" + alea(36)).includes("jeton npm"));
  assert.ok(motifs("gsk" + "_" + alea(52)).includes("clé Groq"));
  assert.ok(motifs("r8" + "_" + alea(37)).includes("jeton Replicate"));
});

test("secret en clair dans une variable, sauf valeur d'exemple", () => {
  assert.ok(motifs(`BETTER_AUTH_SECRET='${alea(32)}'`).includes("secret en clair"));
  assert.deepStrictEqual(motifs('BETTER_AUTH_SECRET="VOTRE_SECRET_ICI_A_REMPLACER"'), []);
  assert.deepStrictEqual(motifs('const TOKEN = "token-de-test-1234567890"'), []);
});

test("identifiant qui commence par sk- sans chiffre : pas une clé OpenAI", () => {
  assert.deepStrictEqual(motifs("sk" + "-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-mon-identifiant"), []);
});

test("verifier.js --index : contrôle le contenu indexé seulement", () => {
  const { dir, git, ecrire } = depotTemporaire();
  ecrire("app.js", `const k = "${FAUX.stripe}";\n`);
  const r1 = spawnSync("node", [VERIFIER, "--index"], { cwd: dir, encoding: "utf8" });
  assert.strictEqual(r1.status, 0, "fichier non indexé : rien à contrôler");
  git("add", "app.js");
  const r2 = spawnSync("node", [VERIFIER, "--index"], { cwd: dir, encoding: "utf8" });
  assert.strictEqual(r2.status, 1);
  assert.match(r2.stderr, /Commit annulé/);
});

test("secret en clair : constantes ordinaires (URL, regex, nom d'en-tête) non signalées, vrais secrets signalés", () => {
  const { trouverSecrets } = require("../scripts/motifs");
  for (const c of [
    'const TOKEN_URL = "https://oauth2.googleapis.com/token"',
    'GOOGLE_TOKEN_ENDPOINT: "https://oauth2.googleapis.com/token2"',
    'const PASSWORD_REGEX = "^(?=.*[A-Z])(?=.*\\d).{8,}$"',
    'const SECRET_HEADER_NAME = "x-webhook-signature-v2"',
    'API_KEY="VOTRE_CLE_ICI_1234567"',
  ])
    assert.deepStrictEqual(trouverSecrets(c), [], c);
  assert.deepStrictEqual(trouverSecrets("postgres" + "://admin:mypassword123@db.prod.internal.io"), ["mot de passe dans une adresse de base de données"]);
  const alea = "Qx7" + "kR2mZp9" + "Lw4Tn8vB" + "c5Yd";
  assert.deepStrictEqual(trouverSecrets(`BETTER_AUTH_SECRET='${alea}'`), ["secret en clair"]);
});

test("secret en clair : valeurs hexadécimales et d'une seule casse signalées, exemples non signalés", () => {
  const { trouverSecrets } = require("../scripts/motifs");
  const hex = "ab12".repeat(16);
  const base64url = "Qx7" + "kR2mZp9" + "Lw4Tn8vB" + "c5Yd" + "Zq1Xe3HaVn";
  assert.strictEqual(base64url.length, 32);
  const long = "mysecretpass" + "2024" + "abcdefghijkl"; // 28 caractères, un chiffre, une seule casse
  for (const c of [
    `BETTER_AUTH_SECRET="${hex}"`,
    `BETTER_AUTH_SECRET="${hex.toUpperCase()}"`,
    `BETTER_AUTH_SECRET="${base64url}"`,
    `DB_PASSWORD="${long}"`,
  ])
    assert.deepStrictEqual(trouverSecrets(c), ["secret en clair"], c);
  for (const c of [
    'const SECRET_HEADER_NAME = "x-webhook-signature-v2"',
    'const TOKEN_URL = "https://oauth2.googleapis.com/token"',
    'const PASSWORD_REGEX = "^(?=.*[A-Z])(?=.*\\d).{8,}$"',
    'BETTER_AUTH_SECRET="VOTRE_SECRET_ICI_A_REMPLACER"',
    'const TOKEN = "token-de-test-1234567890"',
    'const TOKEN_COOKIE = "__secure-session-token-v2-prod"',
    'const TOKEN_KEY = "pulse.auth.token.v2.storage"',
    'const PASSWORD_MIN_MESSAGE = "password-too-short-error-2"',
    'const API_SECRET_HEADER = "x-pulse-webhook-signature-2024"',
    'const SECRET_NAME = "my-app-secret-key-name-1"',
  ])
    assert.deepStrictEqual(trouverSecrets(c), [], c);
});

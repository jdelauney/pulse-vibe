// Tests de la création du squelette (scripts/squelette.js).
// Lancer : node --test plugins/pulse-vibe-next/tests/squelette.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "squelette.js");
const { nomDePaquet } = require(SCRIPT);

const dossierVide = () => fs.mkdtempSync(path.join(os.tmpdir(), "pulse-next-"));
const lancer = (...args) => spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });
const lire = (d, f) => fs.readFileSync(path.join(d, f), "utf8");

test("crée le projet de départ et remplit le nom et la description", () => {
  const d = dossierVide();
  const r = lancer("--nom", 'L\'Atelier "Bois & Co"', "--description", "Réservez un créneau.", "--dossier", d);
  assert.strictEqual(r.status, 0, r.stderr);
  const paquet = JSON.parse(lire(d, "package.json"));
  assert.strictEqual(paquet.name, "l-atelier-bois-co");
  assert.match(lire(d, "src/config/projet.ts"), /nom: "L'Atelier \\"Bois & Co\\"",/);
  assert.match(lire(d, "src/config/projet.ts"), /description: "Réservez un créneau\.",/);
  for (const f of ["app/layout.tsx", "app/page.tsx", "app/favicon.ico", "next.config.ts", "biome.json", "vercel.json", "src/components/ui/button.tsx", "src/config/env.ts", "src/lib/seo/seo.ts", "src/components/shared/elements/json-ld.tsx"])
    assert.ok(fs.existsSync(path.join(d, f)), f);
  assert.ok(!fs.existsSync(path.join(d, "src", "app")), "plus de src/app/");
  assert.ok(!fs.existsSync(path.join(d, "gitignore.template")), "les modèles à fusionner ne sont pas copiés tels quels");
});

test("aucun import @/ : les alias sont @app/ et @src/", () => {
  const d = dossierVide();
  assert.strictEqual(lancer("--nom", "Essai", "--dossier", d).status, 0);
  const fautifs = [];
  (function parcourir(dossier) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (/\.(ts|tsx|json)$/.test(e.name) && /["']@\//.test(fs.readFileSync(chemin, "utf8"))) fautifs.push(path.relative(d, chemin));
    }
  })(d);
  assert.deepStrictEqual(fautifs, []);
});

test("aucun repère {{…}} ne reste dans les fichiers créés", () => {
  const d = dossierVide();
  assert.strictEqual(lancer("--nom", "Essai", "--dossier", d).status, 0);
  const restes = [];
  (function parcourir(dossier) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const chemin = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (!/\.ico$/.test(e.name) && /\{\{[A-Z_]+\}\}/.test(fs.readFileSync(chemin, "utf8"))) restes.push(path.relative(d, chemin));
    }
  })(d);
  assert.deepStrictEqual(restes, []);
});

test("garde les fichiers existants et complète .gitignore et .env.example sans doublon", () => {
  const d = dossierVide();
  fs.writeFileSync(path.join(d, "package.json"), '{ "name": "existant" }\n');
  fs.writeFileSync(path.join(d, ".gitignore"), "node_modules\n.env\n");
  fs.writeFileSync(path.join(d, ".env.example"), "DATABASE_URL=\n");
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# Projet\n");
  const r = lancer("--nom", "Essai", "--dossier", d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Gardés tels quels.*package\.json/);
  assert.strictEqual(lire(d, "package.json"), '{ "name": "existant" }\n');
  assert.strictEqual(lire(d, "CLAUDE.md"), "# Projet\n");
  const gitignore = lire(d, ".gitignore");
  assert.match(gitignore, /^\/\.next\/$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  const env = lire(d, ".env.example");
  assert.strictEqual(env.match(/^DATABASE_URL=/gm).length, 1, "pas de variable en double");
  assert.match(env, /^DATABASE_URL_DIRECT=/m);
  // Deuxième passage : rien ne change.
  assert.strictEqual(lancer("--nom", "Essai", "--dossier", d).status, 0);
  assert.strictEqual(lire(d, ".gitignore"), gitignore);
  assert.strictEqual(lire(d, ".env.example"), env);
});

test("sans nom ou avec une option inconnue : message et code 1", () => {
  assert.strictEqual(lancer("--dossier", dossierVide()).status, 1);
  assert.strictEqual(lancer("--nom", "x", "--inconnue").status, 1);
});

test("nom de paquet : minuscules, sans accent, tirets", () => {
  assert.strictEqual(nomDePaquet("Café Équipe 2"), "cafe-equipe-2");
  assert.strictEqual(nomDePaquet("!!!"), "mon-projet");
});

test("refuse un dossier qui contient déjà src/app/ et n'écrit rien", () => {
  const d = dossierVide();
  fs.mkdirSync(path.join(d, "src", "app"), { recursive: true });
  const r = lancer("--nom", "Essai", "--dossier", d);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /refactoring ou alignement sur les règles du pack/);
  assert.deepStrictEqual(fs.readdirSync(d), ["src"]);
  assert.deepStrictEqual(fs.readdirSync(path.join(d, "src")), ["app"]);
});

test("next.config.ts du squelette déclare les sept en-têtes de sécurité, sans nonce", () => {
  const config = fs.readFileSync(path.join(__dirname, "..", "templates", "squelette", "next.config.ts"), "utf8");
  for (const entete of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "Cross-Origin-Opener-Policy",
    "Permissions-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
  ])
    assert.ok(config.includes(`key: "${entete}"`), entete);
  assert.match(config, /const sources: Record<string, string\[\]> = \{/);
  assert.match(config, /"max-age=63072000; includeSubDomains"/);
  assert.doesNotMatch(config, /preload/);
  assert.doesNotMatch(config, /'nonce-|x-nonce/);
  assert.match(config, /browsing-topics=\(\)/);
});

test("le squelette type ses variables avec t3 env et nomme son client Drizzle", () => {
  const S = path.join(__dirname, "..", "templates", "squelette");
  const paquet = JSON.parse(fs.readFileSync(path.join(S, "package.json"), "utf8"));
  assert.ok(paquet.dependencies["@t3-oss/env-nextjs"], "dépendance @t3-oss/env-nextjs");
  const env = fs.readFileSync(path.join(S, "src", "config", "env.ts"), "utf8");
  for (const attendu of ["createEnv", 'import "server-only"', "extends: [envPublic]", "...optionsCommunes", "export const env"]) assert.ok(env.includes(attendu), attendu);
  const envPublic = fs.readFileSync(path.join(S, "src", "config", "env-public.ts"), "utf8");
  assert.ok(!envPublic.includes("server-only"), "env-public.ts lisible par un composant client");
  assert.ok(envPublic.includes("experimental__runtimeEnv"), "variables publiques lues en entier");
  const commun = fs.readFileSync(path.join(S, "src", "config", "env-commun.ts"), "utf8");
  for (const attendu of ["emptyStringAsUndefined: true", "SKIP_ENV_VALIDATION", "!process.env.VERCEL"]) assert.ok(commun.includes(attendu), attendu);
  assert.ok(fs.existsSync(path.join(S, "src", "db", "db-client.ts")), "db-client.ts");
  assert.ok(!fs.existsSync(path.join(S, "src", "db", "index.ts")), "plus de src/db/index.ts");
  assert.ok(fs.existsSync(path.join(S, "tests", "helpers", "env-de-test.ts")), "aide VARIABLES_VALIDES");
});

test("fins de ligne LF et versions exactes : .gitattributes et .npmrc posés, complétés sans doublon", () => {
  const d = dossierVide();
  fs.writeFileSync(path.join(d, ".gitattributes"), "*.png binary\n");
  assert.strictEqual(lancer("--nom", "Essai", "--dossier", d).status, 0);
  const attendu = "*.png binary\n\n# Ajouté par Pulse Next.js\n* text=auto eol=lf\n";
  assert.strictEqual(lire(d, ".gitattributes"), attendu);
  assert.strictEqual(lire(d, ".npmrc"), "save-exact=true\n");
  for (const modele of ["gitattributes.template", "npmrc.template"]) assert.ok(!fs.existsSync(path.join(d, modele)), modele);
  assert.strictEqual(lancer("--nom", "Essai", "--dossier", d).status, 0);
  assert.strictEqual(lire(d, ".gitattributes"), attendu, "deuxième passage : rien ne change");
  assert.doesNotMatch(lire(d, ".gitignore"), /package-lock/, "package-lock.json s'enregistre avec le code");
});

test("dépendances du squelette : WebSocket natif, outils en développement, Node 22.19 ou plus, sans next-themes", () => {
  const S = path.join(__dirname, "..", "templates", "squelette");
  const paquet = JSON.parse(fs.readFileSync(path.join(S, "package.json"), "utf8"));
  for (const nom of ["ws", "next-themes", "shadcn"]) assert.ok(!paquet.dependencies[nom], `${nom} hors des dépendances d'exécution`);
  assert.ok(!paquet.devDependencies["@types/ws"], "@types/ws retiré");
  assert.ok(paquet.devDependencies.shadcn, "shadcn en devDependencies (seul shadcn/tailwind.css est importé, à la construction)");
  assert.deepStrictEqual(paquet.engines, { node: ">=22.19.0" });
  assert.doesNotMatch(fs.readFileSync(path.join(S, "src", "db", "db-client.ts"), "utf8"), /webSocketConstructor|from "ws"/);
  const sonner = fs.readFileSync(path.join(S, "src", "components", "ui", "sonner.tsx"), "utf8");
  assert.doesNotMatch(sonner, /next-themes/);
  assert.match(sonner, /theme="light"/);
  const theme = fs.readFileSync(path.join(__dirname, "..", "references", "theme.md"), "utf8");
  for (const attendu of ["npm install next-themes", "<ThemeProvider attribute=\"class\"", "suppressHydrationWarning", "useTheme()"]) assert.ok(theme.includes(attendu), `theme.md : ${attendu}`);
});

test("accessibilité du squelette : lien d'évitement, axe et cibles sur chaque page", () => {
  const S = path.join(__dirname, "..", "templates", "squelette");
  const lireS = (...p) => fs.readFileSync(path.join(S, ...p), "utf8");
  const layout = lireS("app", "layout.tsx");
  assert.match(layout, /<a\s+href="#contenu"/);
  assert.match(layout, /id="contenu"/);
  assert.ok(layout.indexOf('href="#contenu"') < layout.indexOf("<NuqsAdapter>"), "premier élément du corps");
  const paquet = JSON.parse(lireS("package.json"));
  assert.ok(paquet.devDependencies["@axe-core/playwright"], "@axe-core/playwright");
  const aide = lireS("e2e", "aides", "accessibilite.ts");
  assert.match(aide, /new AxeBuilder\(\{ page \}\)\s*\.withTags\(WCAG_AA\)/);
  assert.match(aide, /\.exclude\(OUTILS_NEXT\)/, "outils de développement de Next ignorés");
  assert.match(aide, /"nextjs-portal"/);
  assert.match(aide, /"wcag22aa"/);
  assert.match(aide, /projet === "telephone" \? 44 : 24/);
  assert.ok(aide.includes('a[data-slot="button"]'), "lien affiché en bouton mesuré");
  assert.match(lireS("e2e", "accessibilite.spec.ts"), /verifierAccessibilite\(page, testInfo\)/);
  assert.ok(fs.existsSync(path.join(S, "src", "components", "ui", "__tests__", "cibles-tactiles.test.ts")));
  assert.match(fs.readFileSync(path.join(__dirname, "..", "references", "contexte", "test.md"), "utf8"), /verifierAccessibilite/);
});

test("Playwright du squelette : port réglable, verifier-squelette.js prend un port libre", () => {
  const config = fs.readFileSync(path.join(__dirname, "..", "templates", "squelette", "playwright.config.ts"), "utf8");
  assert.match(config, /const port = process\.env\.PORT \?\? "3000";/);
  assert.equal((config.match(/`http:\/\/localhost:\$\{port\}`/g) || []).length, 2, "baseURL et webServer.url suivent le port");
  assert.match(config, /trace: "on-first-retry",/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "scripts", "verifier-squelette.js"), "utf8"), /PORT: String\(await portLibre\(\)\)/);
});

test("journaux et erreurs du squelette : onRequestError, masquage profond, référence affichée", () => {
  const S = path.join(__dirname, "..", "templates", "squelette");
  const lireS = (...p) => fs.readFileSync(path.join(S, ...p), "utf8");
  assert.match(lireS("instrumentation.ts"), /export const onRequestError: Instrumentation\.onRequestError/);
  assert.match(lireS("instrumentation.ts"), /process\.env\.NEXT_RUNTIME !== "nodejs"/);
  assert.match(lireS("src", "lib", "logger.ts"), /`\*\.\*\.\*\["\$\{cle\}"\]`/);
  for (const attendu of ["serializers: { err: serialiserErreur }", '"params"', "pino.multistream", "dedupe: true", "process.stderr"])
    assert.ok(lireS("src", "lib", "logger.ts").includes(attendu), `logger.ts : ${attendu}`);
  for (const cle of ["password", "motDePasse", "token", "authorization", "Authorization", "Cookie", "set-cookie", "x-api-key", "apiKey", "secret", "clientSecret", "cookie", "email"]) assert.ok(lireS("src", "lib", "logger.ts").includes(`"${cle}"`), cle);
  for (const f of ["error.tsx", "global-error.tsx"]) assert.match(lireS("app", f), /Référence à nous transmettre : <code>\{error\.digest\}<\/code>/, f);
  assert.ok(fs.existsSync(path.join(S, "src", "lib", "errors", "__tests__", "erreur-de-requete.test.ts")));
  assert.ok(fs.existsSync(path.join(S, "src", "lib", "__tests__", "logger.test.ts")));
  for (const f of ["error.tsx", "global-error.tsx"]) assert.match(lireS("app", f), /signalerErreurClient\(error\)/, f);
  assert.match(lireS("app", "api", "erreur-client", "route.ts"), /export async function POST/);
  assert.match(lireS("app", "api", "sante", "route.ts"), /await connection\(\)/);
  assert.match(lireS("src", "lib", "sante.ts"), /"public, s-maxage=900"/, "sonde gardée 15 minutes par le CDN");
  assert.match(lireS("app", "essai-surveillance", "page.tsx"), /robots: \{ index: false, follow: false \}/);
});

test("actions du squelette : nom obligatoire (defineMetadataSchema), journalisé", () => {
  const S = path.join(__dirname, "..", "templates", "squelette");
  const action = fs.readFileSync(path.join(S, "src", "lib", "safe-action.ts"), "utf8");
  for (const attendu of ["defineMetadataSchema()", "z.object({ nom: z.string().min(1) })", "handleServerError(erreur, { metadata, ctx })", "next({ ctx: { requete } })", "x-vercel-id", "export const MESSAGE_ERREUR_ACTION"]) assert.ok(action.includes(attendu), attendu);
  assert.ok(fs.existsSync(path.join(S, "src", "lib", "__tests__", "safe-action.test.ts")));
});

test("migrations du squelette : construction Vercel précédée de scripts/migrer.mjs, adresse directe de l'intégration", () => {
  const S = path.join(__dirname, "..", "templates", "squelette");
  const vercel = JSON.parse(fs.readFileSync(path.join(S, "vercel.json"), "utf8"));
  assert.deepStrictEqual(vercel, { $schema: "https://openapi.vercel.sh/vercel.json", regions: ["fra1"], buildCommand: "node scripts/migrer.mjs --vercel && npm run build" });
  assert.match(fs.readFileSync(path.join(S, "drizzle.config.ts"), "utf8"), /process\.env\.DATABASE_URL_DIRECT \?\? process\.env\.DATABASE_URL_UNPOOLED/);
  const migrer = fs.readFileSync(path.join(S, "scripts", "migrer.mjs"), "utf8");
  for (const attendu of ["expires_at", "NEON_API_KEY", "NEON_PROJECT_ID", 'env.VERCEL_ENV === "production"', "drizzle.__drizzle_migrations", "NEON_ENDPOINT_PRODUCTION", '"ignore-production"']) assert.ok(migrer.includes(attendu), attendu);
  assert.ok(fs.existsSync(path.join(S, "tests", "migrer.test.ts")));
});

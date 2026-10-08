// Tests des contrôles du code pour le référencement (scripts/seo-code.js), de la recette seo
// et de la cohérence du squelette avec la liste des robots IA du cœur.
// Lancer : node --test plugins/pulse-vibe-next/tests/seo-code.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const SCRIPT = path.join(RACINE, "scripts", "seo-code.js");
const { controler, pagesPubliques } = require(SCRIPT);
const { creerSquelette } = require(path.join(RACINE, "scripts", "squelette.js"));

const lancer = (...args) => spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });
const codes = (r) => r.constats.map((c) => `${c.code}:${c.gravite}`).sort();

/** Un petit projet Next.js : { "chemin/relatif": "contenu" }. */
function projet(contenus) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-seo-code-"));
  for (const [rel, texte] of Object.entries(contenus)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), texte);
  }
  return d;
}

const BASE = {
  "src/app/layout.tsx": 'export const metadata = { metadataBase: new URL(adresseDuSite()), title: { default: "A", template: "%s | A" } };',
  "src/app/page.tsx": 'export const metadata = metadonneesDePage({ titre: "A", description: "d", chemin: "/", accueil: true });',
  "src/app/robots.ts": "export default function robots() { return { rules: reglesRobots(politiqueRobotsIa) }; }",
  "src/app/sitemap.ts": "export default function sitemap() { return []; }",
  "src/app/opengraph-image.tsx": "export default function Image() {}",
};

test("le squelette du pack passe tous les contrôles du code", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-seo-squelette-"));
  creerSquelette({ nom: "Menuiserie Dupont", description: "Meubles sur mesure.", dossier: d });
  const r = controler(d);
  assert.deepStrictEqual(r.constats, []);
  assert.deepStrictEqual(r.pages, ["/"]);
});

test("un projet minimal correct : aucun constat", () => {
  assert.deepStrictEqual(controler(projet(BASE)).constats, []);
});

test("metadataBase absent ou sur localhost : Critique, code de sortie 1", () => {
  const sans = projet({ ...BASE, "src/app/layout.tsx": 'export const metadata = { title: { default: "A", template: "%s | A" } };' });
  assert.deepStrictEqual(codes(controler(sans)), ["C1:critique"]);
  assert.strictEqual(lancer("--dossier", sans).status, 1);
  const local = projet({ ...BASE, "src/app/layout.tsx": 'export const metadata = { metadataBase: new URL("http://localhost:3000"), title: { template: "%s" } };' });
  assert.deepStrictEqual(codes(controler(local)), ["C1:critique"]);
});

test("pages publiques : sans métadonnées, sans canonique, openGraph à la main ; pages connectées sans noindex", () => {
  const d = projet({
    ...BASE,
    "src/app/tarifs/page.tsx": "export default function P() {}",
    "src/app/contact/page.tsx": 'export const metadata = { title: "Contact", description: "d" };',
    "src/app/equipe/page.tsx": 'export const metadata = { title: "Équipe", alternates: { canonical: "/equipe" }, openGraph: { title: "Équipe" } };',
    "src/app/(connecte)/compte/page.tsx": "export default function P() {}",
  });
  assert.deepStrictEqual(codes(controler(d)), ["C3:haute", "C3:moyenne", "C4:moyenne", "C5:moyenne"]);
  assert.deepStrictEqual(pagesPubliques(d), ["/", "/contact", "/equipe", "/tarifs"], "le groupe (connecte) n'est pas public");
});

test("robots et sitemap : absents, en double dans public/, dates de génération, champs ignorés", () => {
  const { "src/app/robots.ts": _r, "src/app/sitemap.ts": _s, ...sans } = BASE;
  assert.deepStrictEqual(codes(controler(projet(sans))), ["C6:haute", "C6:haute"]);
  const d = projet({ ...BASE, "public/robots.txt": "User-agent: *", "src/app/sitemap.ts": "export default () => [{ url: 'x', lastModified: new Date(), priority: 1 }];" });
  assert.deepStrictEqual(codes(controler(d)), ["C6:basse", "C6:moyenne", "NC2:haute"]);
});

test("JSON-LD sans échappement (C8), image sans alt et <img> (C11), robots.ts sans politique (NC1)", () => {
  const d = projet({
    ...BASE,
    "src/app/page.tsx": `${BASE["src/app/page.tsx"]}\nexport default function P() { return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }} /><Image src="/a.png" width={10} height={10} /><img src="/b.png" alt="b" /></>; }`,
    "src/app/robots.ts": 'export default function robots() { return { rules: { userAgent: "*", allow: "/" } }; }',
  });
  assert.deepStrictEqual(codes(controler(d)), ["C11:basse", "C11:moyenne", "C8:haute", "NC1:basse"]);
});

test("page de détail : loading.tsx = soft 404 (Haute) ; sans notFound() ; sans vérification dans le proxy (Basse)", () => {
  const detail = 'export async function generateMetadata() { return metadonneesDePage({}); }\nexport default async function P() { if (!x) notFound(); }';
  assert.deepStrictEqual(codes(controler(projet({ ...BASE, "src/app/blog/[slug]/page.tsx": detail, "src/app/blog/[slug]/loading.tsx": "x" }))), ["C9:haute"]);
  assert.deepStrictEqual(codes(controler(projet({ ...BASE, "src/app/blog/[slug]/page.tsx": "export const metadata = metadonneesDePage({}); export default function P() {}" }))), ["C9:moyenne"]);
  assert.deepStrictEqual(codes(controler(projet({ ...BASE, "src/app/blog/[slug]/page.tsx": detail }))), ["C9:basse"]);
  assert.deepStrictEqual(codes(controler(projet({ ...BASE, "src/app/blog/[slug]/page.tsx": detail, "src/proxy.ts": 'export const config = { matcher: "/blog/:slug" };' }))), []);
});

test("generateMetadata qui lit cookies() (C10) ; redirection temporaire (C12) ; htmlLimitedBots qui remplace la liste (NC3)", () => {
  const d = projet({
    ...BASE,
    "src/app/offre/page.tsx": "export async function generateMetadata() { const c = await cookies(); return metadonneesDePage({}); }",
    "next.config.ts": "export default { async redirects() { return [{ source: '/a', destination: '/b', permanent: false }]; }, htmlLimitedBots: /GPTBot|ClaudeBot/ };",
  });
  assert.deepStrictEqual(codes(controler(d)), ["C10:moyenne", "C12:basse", "NC3:moyenne"]);
});

test("site en plusieurs langues : versions non déclarées (C13)", () => {
  const { "src/app/layout.tsx": layout, "src/app/page.tsx": page, ...reste } = BASE;
  const d = projet({ ...reste, "src/app/[locale]/layout.tsx": layout, "src/app/[locale]/page.tsx": page });
  assert.deepStrictEqual(codes(controler(d)), ["C13:haute", "C13:moyenne"]);
});

test("versions de langue déclarées par le helper versionsDeLangue() : languages et x-default reconnus (C13)", () => {
  const { "src/app/layout.tsx": layout, "src/app/page.tsx": page, ...reste } = BASE;
  const helper = (corps) => `export function versionsDeLangue(chemin) { ${corps} }`;
  const projetLangues = (corps) =>
    projet({
      ...reste,
      "src/app/sitemap.ts": "export default function sitemap() { return [{ url: '/', alternates: { languages: {} } }]; }",
      "src/app/[locale]/layout.tsx": layout,
      "src/app/[locale]/page.tsx": 'export const metadata = { ...metadonneesDePage({ titre: "A", description: "d", chemin: "/" }), alternates: { canonical: "/", languages: versionsDeLangue("/") } };',
      "src/lib/seo/referencement.ts": helper(corps),
    });
  assert.deepStrictEqual(codes(controler(projetLangues('const l = {}; l["x-default"] = chemin; return l;'))), []);
  assert.deepStrictEqual(codes(controler(projetLangues("return {};"))), ["C13:basse"], "un helper sans x-default reste signalé");
});

test("page publique en noindex volontaire : pas de constat C3", () => {
  const d = projet({ ...BASE, "src/app/merci/page.tsx": 'export const metadata = { title: "Merci", robots: { index: false, follow: false } };' });
  assert.deepStrictEqual(codes(controler(d)), []);
  const d2 = projet({ ...BASE, "src/app/merci/page.tsx": 'export const metadata = { title: "Merci", robots: { index: true } };' });
  assert.deepStrictEqual(codes(controler(d2)), ["C3:moyenne"]);
});

test("--pages : liste des pages publiques fixes, séparées par des virgules ; option inconnue : code 2", () => {
  const d = projet({ ...BASE, "src/app/(public)/a-propos/page.tsx": "x", "src/app/api/x/page.ts": "x", "src/app/blog/[slug]/page.tsx": "x" });
  const r = lancer("--pages", "--dossier", d);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), "/,/a-propos");
  assert.strictEqual(lancer("--inconnue").status, 2);
});

test("la politique des robots du squelette reprend les rôles de robots-ia.json (cœur)", () => {
  const liste = JSON.parse(fs.readFileSync(path.join(RACINE, "..", "pulse-vibe", "references", "seo", "robots-ia.json"), "utf8")).robots;
  const texte = fs.readFileSync(path.join(RACINE, "templates", "squelette", "src", "lib", "seo", "politique-robots.ts"), "utf8");
  const tableau = (nom) => [...texte.match(new RegExp(`export const ${nom} = \\[([\\s\\S]*?)\\];`))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  const parRoles = (...roles) => liste.filter((r) => roles.includes(r.role)).map((r) => r.jeton).sort();
  assert.deepStrictEqual(tableau("ROBOTS_ENTRAINEMENT"), parRoles("entrainement", "jeton-entrainement"));
  assert.deepStrictEqual(tableau("ROBOTS_REPONSES_IA"), parRoles("recherche", "demande", "mixte"));
});

test("la recette seo suit le format commun des recettes", () => {
  const texte = fs.readFileSync(path.join(RACINE, "references", "recettes", "seo.md"), "utf8");
  assert.match(texte, /^# Recette : seo$/m);
  assert.match(texte, /^> Quand l'utiliser : .+$/m);
  for (const section of ["## Prérequis", "## Variables d'environnement", "## Fichiers créés ou modifiés", "## Étapes", "## Scénarios Gherkin à ajouter à la spec", "## Tâches de plan prêtes", "## Tests", "## Points de sécurité", "## Pièges connus"])
    assert.ok(texte.includes(`\n${section}\n`), section);
  assert.match(texte, /# language: fr/);
  assert.ok(fs.existsSync(path.join(RACINE, "references", "contexte", "seo.md")));
});

const BASE_RACINE = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k.replace(/^src\/app\//, "app/"), v]));

test("nouvelle structure (app/ à la racine) : aucun constat, messages avec les vrais chemins", () => {
  assert.deepStrictEqual(controler(projet(BASE_RACINE)).constats, []);
  const { "app/robots.ts": _r, ...sansRobots } = BASE_RACINE;
  const c6 = controler(projet(sansRobots)).constats.find((x) => x.code === "C6");
  assert.match(c6.message + c6.conseil, /app\/robots\.ts/);
  assert.doesNotMatch(c6.message + c6.conseil, /src\/app/);
});

test("ancienne structure (src/app/) : les messages citent src/app/", () => {
  const { "src/app/robots.ts": _r, ...sansRobots } = BASE;
  const c6 = controler(projet(sansRobots)).constats.find((x) => x.code === "C6");
  assert.match(c6.message + c6.conseil, /src\/app\/robots\.ts/);
});

test("nouvelle structure : les composants de app/ sont contrôlés (JSON-LD)", () => {
  const d = projet({ ...BASE_RACINE, "app/a-propos/page.tsx": 'export default function P() { return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }} />; }' });
  assert.ok(codes(controler(d)).includes("C8:haute"));
});

test("vrai 404 : proxy.ts à la racine est trouvé dans la nouvelle structure", () => {
  const detail = 'export async function generateMetadata() { return metadonneesDePage({}); }\nexport default async function P() { if (!x) notFound(); }';
  assert.deepStrictEqual(codes(controler(projet({ ...BASE_RACINE, "app/blog/[slug]/page.tsx": detail }))), ["C9:basse"]);
  assert.deepStrictEqual(codes(controler(projet({ ...BASE_RACINE, "app/blog/[slug]/page.tsx": detail, "proxy.ts": 'export const config = { matcher: "/blog/:slug" };' }))), []);
  const c9 = controler(projet({ ...BASE_RACINE, "app/blog/[slug]/page.tsx": detail })).constats.find((x) => x.code === "C9");
  assert.doesNotMatch(c9.conseil, /src\/proxy/);
});

test("ancienne structure : C9 cite src/proxy.ts", () => {
  const detail = 'export async function generateMetadata() { return metadonneesDePage({}); }\nexport default async function P() { if (!x) notFound(); }';
  const c9 = controler(projet({ ...BASE, "src/app/blog/[slug]/page.tsx": detail })).constats.find((x) => x.code === "C9");
  assert.match(c9.conseil, /src\/proxy\.ts/);
});

test("C1 metadataBase : le conseil cite le fichier site qui existe (ancien en repli, nouveau par défaut)", () => {
  const sansBase = { ...BASE, "src/app/layout.tsx": 'export const metadata = { title: { default: "A", template: "%s | A" } };' };
  const ancien = controler(projet({ ...sansBase, "src/lib/site.ts": "export {};" })).constats.find((x) => x.code === "C1");
  assert.match(ancien.conseil, /src\/lib\/site\.ts/);
  const defaut = controler(projet(sansBase)).constats.find((x) => x.code === "C1");
  assert.match(defaut.conseil, /src\/config\/site\.ts/);
});

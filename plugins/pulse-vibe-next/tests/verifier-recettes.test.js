// Tests de l'extraction et de la pose du code balisé des recettes (scripts/verifier-recettes.js).
// Lancer : node --test plugins/pulse-vibe-next/tests/verifier-recettes.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const os = require("os");
const { spawnSync } = require("child_process");
const { extraireEtapes, appliquerAuTexte, analyserCommande, lireArguments, poserEtape, poserRecette, CHAINES, chainesTouchees, fichiersModifies } = require(path.join(__dirname, "..", "scripts", "verifier-recettes.js"));
const DOSSIER_RECETTES = path.join(__dirname, "..", "references", "recettes");
// Recettes qui créent une table : leur chaîne génère la migration.
const AVEC_MIGRATION = ["connexion", "liste", "fichiers", "paiement", "limite", "seo", "mesure-reelle"];
const F = "```";
const { texteRecette } = require("../scripts/decouper-recette.js");

test("extraction : fichiers, ajouts, remplacements et commandes, dans l'ordre du document", () => {
  const texte = [
    "## Étapes",
    "<!-- commande: npm install better-auth -->",
    "Un exemple sans balise reste une explication :",
    `${F}ts`,
    "// exemple.ts",
    `${F}`,
    "<!-- fichier: src/a.ts -->",
    `${F}ts`,
    "export const a = 1;",
    `${F}`,
    "<!-- ajout: src/config/env.ts après: server: { -->",
    "",
    `${F}ts`,
    "    B: z.string(),",
    `${F}`,
    "<!-- remplacer-ligne: proxy.ts début: matcher: -->",
    `${F}ts`,
    '  matcher: ["/compte/:path*"],',
    `${F}`,
  ].join("\n");
  assert.deepStrictEqual(extraireEtapes(texte), [
    { type: "commande", commande: "npm install better-auth", ligne: 2 },
    { type: "fichier", chemin: "src/a.ts", ancre: undefined, ligne: 7, contenu: "export const a = 1;\n" },
    { type: "ajout", chemin: "src/config/env.ts", ancre: "server: {", ligne: 11, contenu: "    B: z.string(),\n" },
    { type: "remplacer-ligne", chemin: "proxy.ts", ancre: "matcher:", ligne: 16, contenu: '  matcher: ["/compte/:path*"],\n' },
  ]);
});

test("extraction : une balise mal placée, un chemin hors du projet ou une commande non prévue arrêtent tout", () => {
  assert.throws(() => extraireEtapes("<!-- fichier: src/a.ts -->\nTexte\n"), /doit précéder directement un bloc/);
  assert.throws(() => extraireEtapes("<!-- fichier: src/a.ts -->\n"), /n'est suivie d'aucun bloc/);
  assert.throws(() => extraireEtapes(`<!-- fichier: ../.env -->\n${F}\nX\n${F}\n`), /hors du projet/);
  assert.throws(() => extraireEtapes("<!-- commande: rm -rf node_modules -->\n"), /commande non permise/);
  assert.throws(() => extraireEtapes(`<!-- remplacer-ligne: proxy.ts -->\n${F}\nX\n${F}\n`), /début:/);
  assert.throws(() => extraireEtapes(`<!-- fichier: src/a.ts après: x -->\n${F}\nX\n${F}\n`), /après:/);
});

test("pose : ajout après une ligne, ajout en fin de fichier, remplacement d'un passage et d'une ligne", () => {
  const env = "export const env = createEnv({\n  server: {\n    DATABASE_URL: z.url(),\n  },\n});\n";
  assert.strictEqual(
    appliquerAuTexte(env, { type: "ajout", chemin: "env.ts", ancre: "server: {", contenu: "    B: z.string(),\n", ligne: 1 }),
    "export const env = createEnv({\n  server: {\n    B: z.string(),\n    DATABASE_URL: z.url(),\n  },\n});\n",
  );
  assert.strictEqual(appliquerAuTexte("A=\n", { type: "ajout", chemin: ".env.example", contenu: "B=\n", ligne: 1 }), "A=\nB=\n");
  assert.strictEqual(appliquerAuTexte("A=", { type: "ajout", chemin: ".env.example", contenu: "B=\n", ligne: 1 }), "A=\nB=\n");
  const proxy = 'export function proxy() {}\n\nexport const config = {\n  matcher: ["/compte/:path*"],\n};\n';
  assert.strictEqual(
    appliquerAuTexte(proxy, { type: "remplacer", chemin: "proxy.ts", contenu: 'export const config = {\n  matcher: ["/compte/:path*", "/factures/:path*"],\n};\n', ligne: 1 }),
    'export function proxy() {}\n\nexport const config = {\n  matcher: ["/compte/:path*", "/factures/:path*"],\n};\n',
  );
  assert.strictEqual(
    appliquerAuTexte(proxy, { type: "remplacer-ligne", chemin: "proxy.ts", ancre: "matcher:", contenu: '  matcher: ["/compte/:path*", "/fichiers/:path*"],\n', ligne: 1 }),
    'export function proxy() {}\n\nexport const config = {\n  matcher: ["/compte/:path*", "/fichiers/:path*"],\n};\n',
  );
  assert.strictEqual(appliquerAuTexte(null, { type: "fichier", chemin: "a.ts", contenu: "x\n", ligne: 1 }), "x\n");
  assert.throws(() => appliquerAuTexte(null, { type: "ajout", chemin: "env.ts", ancre: "server: {", contenu: "x\n", ligne: 3 }), /n'existe pas/);
  assert.throws(() => appliquerAuTexte(env, { type: "ajout", chemin: "env.ts", ancre: "client: {", contenu: "x\n", ligne: 3 }), /ancrage introuvable/);
});

test("pose : deux recettes ajoutent après la même ligne (limite puis formulaire-public) : les deux blocs restent, le dernier juste après l'ancre", () => {
  const ancre = "const verificationsCroisees: VerificationCroisee[] = [];";
  const env = `${ancre}\n\nexport const env = createEnv({});\n`;
  const redis = appliquerAuTexte(env, { type: "ajout", chemin: "env.ts", ancre, contenu: "verificationsCroisees.push(redis);\n", ligne: 1 });
  const lesDeux = appliquerAuTexte(redis, { type: "ajout", chemin: "env.ts", ancre, contenu: "verificationsCroisees.push(turnstile);\n", ligne: 1 });
  assert.strictEqual(lesDeux, `${ancre}\nverificationsCroisees.push(turnstile);\nverificationsCroisees.push(redis);\n\nexport const env = createEnv({});\n`);
});

test("commandes : chaque argument est contrôlé, sans interpréteur", () => {
  for (const mauvaise of [
    "npm install x --prefix ..",
    "npm install x ../evil",
    "npm install a/b",
    "npm install --global x",
    "npm install x --registry evil",
    "npm install",
    "npx shadcn@latest add button --cwd src",
    "npx shadcn@latest add Button",
    "npx shadcn@latest add",
    "npm run db:generate -- --x",
    "npm run build",
  ]) assert.throws(() => analyserCommande(mauvaise, 4), /ligne 4 : commande non permise/, mauvaise);
  assert.deepStrictEqual(analyserCommande("npm install better-auth@1.7.7 drizzle-orm @scope/pkg@^1.2.0", 1), {
    programme: "npm",
    args: ["install", "better-auth@1.7.7", "drizzle-orm", "@scope/pkg@^1.2.0"],
  });
  assert.deepStrictEqual(analyserCommande("npx shadcn@latest add button card", 1), { programme: "npx", args: ["shadcn@latest", "add", "button", "card"] });
  assert.deepStrictEqual(analyserCommande("npm run db:generate", 1), { programme: "npm", args: ["run", "db:generate"] });
  assert.throws(() => extraireEtapes("<!-- commande: npm install a/b -->\n"), /commande non permise/);
});

test("chemins : lecteur Windows relatif ou option déguisée refusés", () => {
  assert.throws(() => extraireEtapes(`<!-- fichier: C:foo.ts -->\n${F}\nX\n${F}\n`), /hors du projet/);
  assert.throws(() => extraireEtapes(`<!-- fichier: -rf -->\n${F}\nX\n${F}\n`), /hors du projet/);
});

test("remplacer : accolades imbriquées, fin absente ou ambiguë, bloc vide", () => {
  const f = "function a() {\n  if (x) {\n    y;\n  }\n}\n\nconst b = 1;\n";
  const bloc = "function a() {\n  if (z) {\n    w;\n  }\n}\n";
  assert.strictEqual(
    appliquerAuTexte(f, { type: "remplacer", chemin: "a.ts", contenu: bloc, ligne: 5 }),
    "function a() {\n  if (z) {\n    w;\n  }\n}\n\nconst b = 1;\n",
  );
  assert.throws(() => appliquerAuTexte("function a() {\n  x;\n", { type: "remplacer", chemin: "a.ts", contenu: "function a() {\n  y;\n}\n", ligne: 7 }), /ligne 7/);
  assert.throws(() => appliquerAuTexte("f() {\n  x;\n}\nf() {\n  y;\n}\n", { type: "remplacer", chemin: "a.ts", contenu: "f() {\n  z;\n}\n", ligne: 8 }), /ligne 8.*plusieurs/);
  assert.throws(() => appliquerAuTexte("a\n", { type: "remplacer", chemin: "a.ts", contenu: "\n", ligne: 9 }), /ligne 9.*vide/);
});

test("arguments : --recettes sans valeur, option inconnue, --toutes et --depuis seuls", () => {
  assert.deepStrictEqual(lireArguments(["--recettes", "connexion, liste"]).recettes, ["connexion", "liste"]);
  assert.deepStrictEqual(lireArguments([]).recettes, ["connexion", "liste"]);
  assert.strictEqual(lireArguments(["--toutes"]).toutes, true);
  assert.strictEqual(lireArguments(["--toutes", "--garder"]).garder, true);
  assert.throws(() => lireArguments(["--toutes", "--recettes", "connexion"]), /--toutes/);
  assert.throws(() => lireArguments(["--toutes", "--projet", "x"]), /--toutes/);
  assert.strictEqual(lireArguments(["--depuis", "origin/main"]).depuis, "origin/main");
  assert.strictEqual(lireArguments([]).depuis, null);
  assert.throws(() => lireArguments(["--depuis"]), /--depuis demande/);
  assert.throws(() => lireArguments(["--depuis", "main", "--toutes"]), /--depuis/);
  assert.throws(() => lireArguments(["--depuis", "main", "--recettes", "connexion"]), /--depuis/);
  assert.throws(() => lireArguments(["--depuis", "main", "--projet", "x"]), /--depuis/);
  assert.throws(() => lireArguments(["--depuis", "-x"]), /--depuis demande/, "une option déguisée en référence est refusée");
  assert.throws(() => lireArguments(["--recettes"]), /--recettes demande/);
  assert.throws(() => lireArguments(["--projet"]), /--projet demande/);
  assert.throws(() => lireArguments(["--x"]), /Option inconnue/);
});

test("chaînes touchées : celles qui contiennent une recette modifiée ; toutes si le squelette ou le vérificateur changent", () => {
  const chaines = [["connexion", "liste"], ["connexion", "email"], ["mesure-reelle"]];
  const R = "plugins/pulse-vibe-next/references/recettes";
  assert.deepStrictEqual(chainesTouchees([`${R}/email/etape-2.md`], chaines), [["connexion", "email"]]);
  assert.deepStrictEqual(chainesTouchees([`${R}/connexion/index.md`], chaines), [["connexion", "liste"], ["connexion", "email"]]);
  assert.deepStrictEqual(chainesTouchees([`${R}/mesure-reelle/index.md`, `${R}/liste/tests.md`], chaines), [["connexion", "liste"], ["mesure-reelle"]]);
  for (const commun of [
    "plugins/pulse-vibe-next/templates/squelette/src/config/env.ts",
    "plugins/pulse-vibe-next/scripts/verifier-recettes.js",
    "plugins/pulse-vibe-next/scripts/squelette.js",
    "plugins/pulse-vibe-next/scripts/decouper-recette.js",
    ".github/workflows/squelette-next.yml",
  ])
    assert.deepStrictEqual(chainesTouchees([commun], chaines), chaines, commun);
  // Ni recette, ni squelette, ni vérificateur : aucune chaîne.
  assert.deepStrictEqual(chainesTouchees(["plugins/pulse-vibe-next/references/fiche.md", "plugins/pulse-vibe-next/README.md", `${R}/inconnue/index.md`], chaines), []);
  assert.deepStrictEqual(chainesTouchees([], chaines), []);
  // Par défaut : les chaînes de CHAINES.
  assert.deepStrictEqual(chainesTouchees([".github/workflows/squelette-next.yml"]), CHAINES);
});

test("fichiers modifiés : lus par Git depuis la base commune ; référence inconnue : null", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-recettes-git-"));
  const git = (...a) => spawnSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", ...a], { cwd: d, encoding: "utf8" });
  try {
    git("init", "-q", "-b", "main");
    fs.writeFileSync(path.join(d, "a.txt"), "a\n");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD").stdout.trim();
    const recette = path.join(d, "plugins", "pulse-vibe-next", "references", "recettes", "email");
    fs.mkdirSync(recette, { recursive: true });
    fs.writeFileSync(path.join(recette, "index.md"), "# email\n");
    git("add", ".");
    git("commit", "-q", "-m", "recette");
    assert.deepStrictEqual(fichiersModifies(base, d), ["plugins/pulse-vibe-next/references/recettes/email/index.md"]);
    assert.deepStrictEqual(fichiersModifies("HEAD", d), []);
    assert.strictEqual(fichiersModifies("0000000000000000000000000000000000000000", d), null, "premier envoi d'une branche : pas de commit d'avant");
    assert.strictEqual(fichiersModifies("branche-inconnue", d), null);
    // Étape déplacée d'une recette à une autre : les deux chemins, donc les deux chaînes.
    const R = "plugins/pulse-vibe-next/references/recettes";
    fs.writeFileSync(path.join(recette, "etape-2.md"), "## Étape 2\n\nUn texte assez long pour que Git reconnaisse le déplacement.\n");
    git("add", ".");
    git("commit", "-q", "-m", "etape");
    const avantDeplacement = git("rev-parse", "HEAD").stdout.trim();
    fs.mkdirSync(path.join(d, ...R.split("/"), "liste"), { recursive: true });
    git("mv", `${R}/email/etape-2.md`, `${R}/liste/etape-2.md`);
    git("commit", "-q", "-m", "deplacement");
    const deplaces = fichiersModifies(avantDeplacement, d);
    assert.deepStrictEqual([...deplaces].sort(), [`${R}/email/etape-2.md`, `${R}/liste/etape-2.md`]);
    const chaines = [["connexion", "liste"], ["connexion", "email"], ["paiement"]];
    assert.deepStrictEqual(chainesTouchees(deplaces, chaines), [["connexion", "liste"], ["connexion", "email"]]);
    // Nom accentué : sorti tel quel (sans guillemets ni codes octaux), donc rattaché à sa recette.
    const avantAccent = git("rev-parse", "HEAD").stdout.trim();
    fs.writeFileSync(path.join(d, ...R.split("/"), "liste", "étape-3.md"), "x\n");
    git("add", ".");
    git("commit", "-q", "-m", "accent");
    assert.deepStrictEqual(fichiersModifies(avantAccent, d), [`${R}/liste/étape-3.md`]);
    assert.deepStrictEqual(chainesTouchees(fichiersModifies(avantAccent, d), chaines), [["connexion", "liste"]]);
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("recettes des chaînes : chaque bloc « // chemin » porte sa balise ou dit pourquoi il n'est pas vérifié", () => {
  const sansBalise = { liste: "### 12. Quand utiliser TanStack Query ou Zustand" };
  for (const nom of [...new Set(CHAINES.flat())]) {
    const texte = texteRecette(nom);
    const etapes = extraireEtapes(texte);
    if (AVEC_MIGRATION.includes(nom))
      assert.ok(etapes.some((e) => e.type === "commande" && e.commande === "npm run db:generate"), `${nom} : génération de la migration`);
    const lignes = texte.split("\n");
    let section = "";
    const oublis = [];
    lignes.forEach((ligne, i) => {
      if (/^###? /.test(ligne)) section = ligne;
      const chemin = /^```tsx?$/.test(ligne) && /^\/\/ ((?:app|src|e2e|tests)\/\S+|proxy\.ts)$/.exec(lignes[i + 1] || "");
      const balise = lignes[i - 1] === `<!-- fichier: ${chemin && chemin[1]} -->` || /^<!-- sans-verification: .+ -->$/.test(lignes[i - 1] || "");
      if (chemin && section !== sansBalise[nom] && !balise) oublis.push(`${nom}.md:${i + 1} ${chemin[1]}`);
    });
    assert.deepStrictEqual(oublis, [], "bloc « // chemin » sans <!-- fichier: … --> ni <!-- sans-verification: … -->");
  }
});

test("chaque recette du pack figure dans une chaîne vérifiée par la CI", () => {
  const recettes = fs.readdirSync(DOSSIER_RECETTES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const verifiees = new Set(CHAINES.flat());
  for (const nom of verifiees) assert.ok(recettes.includes(nom), `CHAINES : recette inconnue ${nom}`);
  assert.deepStrictEqual(recettes.filter((n) => !verifiees.has(n)), [], "recette sans chaîne : l'ajouter à CHAINES (verifier-recettes.js)");
});

test("balises supprimer, deplacer et sans-verification : lues dans l'ordre, chemins contrôlés", () => {
  const texte = [
    "<!-- deplacer: app/(public) vers: app/[locale]/(public) -->",
    "<!-- supprimer: app/layout.tsx -->",
    "<!-- sans-verification: lit la base pendant la construction -->",
    `${F}tsx`,
    "// app/sitemap.ts",
    `${F}`,
  ].join("\n");
  assert.deepStrictEqual(extraireEtapes(texte), [
    { type: "deplacer", chemin: "app/(public)", vers: "app/[locale]/(public)", ligne: 1 },
    { type: "supprimer", chemin: "app/layout.tsx", ligne: 2 },
    { type: "sans-verification", raison: "lit la base pendant la construction", ligne: 3, contenu: "// app/sitemap.ts\n" },
  ]);
  assert.throws(() => extraireEtapes("<!-- supprimer: ../.env -->\n"), /hors du projet/);
  assert.throws(() => extraireEtapes("<!-- deplacer: app/a.tsx vers: ../b.tsx -->\n"), /hors du projet/);
  assert.throws(() => extraireEtapes("<!-- deplacer: app/a.tsx -->\n"), /vers:/);
  assert.throws(() => extraireEtapes("<!-- sans-verification: raison -->\nTexte\n"), /doit précéder directement un bloc/);
  assert.throws(() => extraireEtapes(`<!-- sans-verification:   -->\n${F}tsx\nX\n${F}\n`), /sans-verification demande une raison/);
});

test("pose : suppression et déplacement dans le projet, refus si la source manque ou si la destination existe", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-recettes-pose-"));
  try {
    fs.mkdirSync(path.join(d, "app", "(public)", "connexion"), { recursive: true });
    fs.writeFileSync(path.join(d, "app", "(public)", "connexion", "page.tsx"), "x\n");
    fs.writeFileSync(path.join(d, "app", "layout.tsx"), "y\n");
    assert.strictEqual(poserEtape(d, { type: "deplacer", chemin: "app/(public)", vers: "app/[locale]/(public)", ligne: 1 }), null);
    assert.ok(fs.existsSync(path.join(d, "app", "[locale]", "(public)", "connexion", "page.tsx")));
    assert.ok(!fs.existsSync(path.join(d, "app", "(public)")));
    assert.strictEqual(poserEtape(d, { type: "supprimer", chemin: "app/layout.tsx", ligne: 2 }), null);
    assert.ok(!fs.existsSync(path.join(d, "app", "layout.tsx")));
    assert.throws(() => poserEtape(d, { type: "supprimer", chemin: "app/layout.tsx", ligne: 3 }), /ligne 3.*introuvable/);
    assert.throws(() => poserEtape(d, { type: "supprimer", chemin: "app/[locale]", ligne: 4 }), /ligne 4.*introuvable/);
    assert.throws(() => poserEtape(d, { type: "deplacer", chemin: "app/(public)", vers: "app/x", ligne: 5 }), /ligne 5.*introuvable/);
    fs.writeFileSync(path.join(d, "app", "a.tsx"), "a\n");
    assert.throws(() => poserEtape(d, { type: "deplacer", chemin: "app/a.tsx", vers: "app/[locale]/(public)", ligne: 6 }), /ligne 6.*existe déjà/);
    assert.strictEqual(poserEtape(d, { type: "fichier", chemin: "src/b.ts", contenu: "b\n", ligne: 7 }), "src/b.ts");
    assert.strictEqual(fs.readFileSync(path.join(d, "src", "b.ts"), "utf8"), "b\n");
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("recette : blocs non vérifiés comptés et listés ; une recette sans aucun fichier posé échoue", (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-recettes-recette-"));
  const messages = [];
  t.mock.method(console, "log", (m) => messages.push(m));
  try {
    const nonVerifies = [];
    const sansVerif = `<!-- sans-verification: lit la base pendant la construction -->\n${F}ts\n// app/sitemap.ts\n${F}\n`;
    assert.deepStrictEqual(poserRecette(d, "essai", nonVerifies, `${sansVerif}<!-- fichier: src/a.ts -->\n${F}ts\nexport const a = 1;\n${F}\n`), ["src/a.ts"]);
    assert.ok(messages.some((m) => /Recette essai : 2 étapes, dont 1 non vérifiée$/.test(m)), messages.join("\n"));
    assert.deepStrictEqual(nonVerifies, ["essai, ligne 1 : lit la base pendant la construction"]);
    poserRecette(d, "double", [], `${sansVerif}${sansVerif}<!-- fichier: src/a.ts -->\n${F}ts\nexport const a = 1;\n${F}\n`);
    assert.ok(messages.some((m) => /Recette double : 3 étapes, dont 2 non vérifiées$/.test(m)), messages.join("\n"));
    assert.throws(() => poserRecette(d, "vide", [], sansVerif), /recette vide : aucun fichier posé/);
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

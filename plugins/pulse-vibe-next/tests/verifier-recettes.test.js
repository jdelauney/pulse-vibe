// Tests de l'extraction et de la pose du code balisé des recettes (scripts/verifier-recettes.js).
// Lancer : node --test plugins/pulse-vibe-next/tests/verifier-recettes.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const { extraireEtapes, appliquerAuTexte, analyserCommande, lireArguments } = require(path.join(__dirname, "..", "scripts", "verifier-recettes.js"));
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

test("arguments : --recettes sans valeur, option inconnue", () => {
  assert.deepStrictEqual(lireArguments(["--recettes", "connexion, liste"]).recettes, ["connexion", "liste"]);
  assert.deepStrictEqual(lireArguments([]).recettes, ["connexion", "liste"]);
  assert.throws(() => lireArguments(["--recettes"]), /--recettes demande/);
  assert.throws(() => lireArguments(["--projet"]), /--projet demande/);
  assert.throws(() => lireArguments(["--x"]), /Option inconnue/);
});

test("recettes balisées : connexion, liste, fichiers, paiement ; chaque fichier complet porte sa balise", () => {
  const sansBalise = { liste: "### 12. Quand utiliser TanStack Query ou Zustand" };
  for (const nom of ["connexion", "liste", "fichiers", "paiement"]) {
    const texte = texteRecette(nom);
    const etapes = extraireEtapes(texte);
    assert.ok(etapes.some((e) => e.type === "commande" && e.commande === "npm run db:generate"), `${nom} : génération de la migration`);
    const lignes = texte.split("\n");
    let section = "";
    const oublis = [];
    lignes.forEach((ligne, i) => {
      if (/^###? /.test(ligne)) section = ligne;
      const chemin = /^```tsx?$/.test(ligne) && /^\/\/ ((?:app|src|e2e|tests)\/\S+|proxy\.ts)$/.exec(lignes[i + 1] || "");
      if (chemin && section !== sansBalise[nom] && lignes[i - 1] !== `<!-- fichier: ${chemin[1]} -->`) oublis.push(`${nom}.md:${i + 1} ${chemin[1]}`);
    });
    assert.deepStrictEqual(oublis, [], "bloc « // chemin » sans sa balise <!-- fichier: … -->");
  }
});

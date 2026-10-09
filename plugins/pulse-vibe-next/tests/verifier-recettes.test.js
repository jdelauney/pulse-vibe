// Tests de l'extraction et de la pose du code balisé des recettes (scripts/verifier-recettes.js).
// Lancer : node --test plugins/pulse-vibe-next/tests/verifier-recettes.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const { extraireEtapes, appliquerAuTexte } = require(path.join(__dirname, "..", "scripts", "verifier-recettes.js"));
const RECETTES = path.join(__dirname, "..", "references", "recettes");
const F = "```";

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

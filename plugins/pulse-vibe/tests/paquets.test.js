// Tests du contrôle des paquets ajoutés (scripts/paquets.js) et de son passage par garde.js, sans appel réseau :
// le registre est simulé (option `sonder`), ou rempli d'avance dans un cache propre aux tests (PULSE_PAQUETS_CACHE).
// Lancer : node --test plugins/pulse-vibe/tests/paquets.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-paquets-"));
const CACHE = path.join(BASE, "cache.json");
process.env.PULSE_PAQUETS_CACHE = CACHE;
const pq = require("../scripts/paquets");
const HOOK = path.join(__dirname, "..", "scripts", "garde.js");
test.after(() => fs.rmSync(BASE, { recursive: true, force: true }));
test.beforeEach(() => fs.rmSync(CACHE, { force: true }));

const MAINTENANT = Date.parse("2026-11-18T12:00:00Z");
const JOUR = 86400000;
const ANCIEN = { existe: true, cree: MAINTENANT - 900 * JOUR, versions: 120 };
/** Un registre simulé : chaque nom reçoit sa fiche ; les autres n'existent pas. */
const registre = (fichesParNom) => (paquets) => paquets.map((p) => (p.nom in fichesParNom ? { ...p, ...fichesParNom[p.nom] } : { ...p, existe: false }));

function projet(nom, packageJson = { dependencies: { react: "19.0.0" } }, fichiers = {}) {
  const d = path.join(BASE, nom);
  fs.mkdirSync(path.join(d, ".git"), { recursive: true });
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# Projet\n\n<!-- pulse_profil:debut -->\n<!-- pulse_profil:fin -->\n");
  fs.writeFileSync(path.join(d, "package.json"), JSON.stringify(packageJson));
  for (const [f, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(d, f), contenu);
  return d;
}

test("nomNpm : versions, portées et alias retirés ; chemins, adresses et dépôts ignorés", () => {
  assert.strictEqual(pq.nomNpm("zod@3.23"), "zod");
  assert.strictEqual(pq.nomNpm("@types/node@20"), "@types/node");
  assert.strictEqual(pq.nomNpm("Lodash"), "lodash");
  assert.strictEqual(pq.nomNpm("monalias@npm:vrai-paquet@1"), "vrai-paquet");
  for (const s of ["./lib", "../x", "file:../x", "git+https://g.com/a/b", "https://x.org/a.tgz", "github:a/b", "utilisateur/depot", "workspace:*", "C:\\pkg"]) assert.strictEqual(pq.nomNpm(s), null, s);
  assert.strictEqual(pq.nomPip("Django>=4.2"), "django");
  assert.strictEqual(pq.nomPip("pkg[extra]==1"), "pkg");
  assert.strictEqual(pq.nomPip("./dossier"), null);
});

test("nomsInstalles : les gestionnaires et leurs formes, options à valeur sautées", () => {
  const d = projet("lecture");
  const noms = (c, dialecte) => pq.nomsInstalles(c, dialecte, d).map((p) => `${p.registre}:${p.nom}`);
  assert.deepStrictEqual(noms("npm install -D zod @types/node@20"), ["npm:zod", "npm:@types/node"]);
  assert.deepStrictEqual(noms("npm i --tag beta axios"), ["npm:axios"]);
  assert.deepStrictEqual(noms("pnpm add --filter web lodash"), ["npm:lodash"]);
  assert.deepStrictEqual(noms("yarn add dayjs"), ["npm:dayjs"]);
  assert.deepStrictEqual(noms("bun add hono", "powershell"), ["npm:hono"]);
  assert.deepStrictEqual(noms("npm install react"), [], "déjà dans package.json");
  assert.deepStrictEqual(noms("npm run build && npm test"), []);
  assert.deepStrictEqual(noms("npm install --registry https://prive.example.com secret-interne"), [], "registre choisi à la main");
  assert.deepStrictEqual(noms("pip install requests==2.31 -r exigences.txt"), ["pypi:requests"]);
  assert.deepStrictEqual(noms("python -m pip install flask"), ["pypi:flask"]);
  assert.deepStrictEqual(noms("uv add httpx && poetry add pydantic"), ["pypi:httpx", "pypi:pydantic"]);
  assert.deepStrictEqual(noms("pip install -i https://prive.example.com/simple interne"), []);
});

test("nomsInstalles : npm install sans nom lit les dépendances absentes du verrou ; sans verrou, rien", () => {
  const avecVerrou = projet("verrou", { dependencies: { react: "19", zod: "3" } }, { "package-lock.json": JSON.stringify({ packages: { "node_modules/react": {} } }) });
  assert.deepStrictEqual(pq.nomsInstalles("npm install", "bash", avecVerrou).map((p) => p.nom), ["zod"]);
  const sansVerrou = projet("sans-verrou", { dependencies: { react: "19", zod: "3" } });
  assert.deepStrictEqual(pq.nomsInstalles("npm ci", "bash", sansVerrou), []);
  assert.deepStrictEqual(pq.nomsInstalles("npm install", "bash", sansVerrou), []);
  const pnpm = projet("pnpm", { dependencies: { react: "19", zod: "3" } }, { "pnpm-lock.yaml": "packages:\n  /react@19: {}\n" });
  assert.deepStrictEqual(pq.nomsInstalles("cd . && pnpm install", "bash", pnpm).map((p) => p.nom), ["zod"]);
});

test("nomsInstalles : un registre privé déclaré dans .npmrc laisse passer ses paquets", () => {
  const tout = projet("npmrc-tout", {}, { ".npmrc": "registry=https://npm.prive.example.com/\n" });
  assert.deepStrictEqual(pq.nomsInstalles("npm install interne", "bash", tout), []);
  const portee = projet("npmrc-portee", {}, { ".npmrc": "@societe:registry=https://npm.prive.example.com/\n" });
  assert.deepStrictEqual(pq.nomsInstalles("npm install @societe/outil zod", "bash", portee).map((p) => p.nom), ["zod"]);
});

test("ressemble : une ou deux lettres d'un paquet connu, sans être lui ni un voisin légitime", () => {
  const connus = new Set(pq.CONNUS);
  assert.strictEqual(pq.ressemble("lodahs", connus), "lodash");
  assert.strictEqual(pq.ressemble("reactt", connus), "react");
  assert.strictEqual(pq.ressemble("expres", connus), "express");
  assert.strictEqual(pq.ressemble("react", connus), null);
  assert.strictEqual(pq.ressemble("preact", connus), null);
  assert.strictEqual(pq.ressemble("@types/react", connus), null);
  assert.strictEqual(pq.ressemble("vue-router", connus), null);
  assert.strictEqual(pq.distance("ab", "ba"), 1, "transposition");
});

test("verdicts : absent, récent, peu de versions, imitation, injoignable, ok", () => {
  const sonder = registre({
    zod: ANCIEN,
    neuf: { existe: true, cree: MAINTENANT - 3 * JOUR, versions: 8 },
    rare: { existe: true, cree: MAINTENANT - 400 * JOUR, versions: 1 },
    lodahs: { existe: true, cree: MAINTENANT - 400 * JOUR, versions: 40 },
    lent: { erreur: "délai dépassé" },
  });
  const v = Object.fromEntries(pq.verdicts(["zod", "inconnu", "neuf", "rare", "lodahs", "lent"].map((nom) => ({ nom, registre: "npm" })), { maintenant: MAINTENANT, sonder }).map((x) => [x.nom, x]));
  assert.strictEqual(v.zod.verdict, "ok");
  assert.strictEqual(v.inconnu.verdict, "absent");
  assert.match(v.neuf.raison, /publié il y a 3 jour/);
  assert.match(v.rare.raison, /que 1 version/);
  assert.match(v.lodahs.raison, /« lodash »/);
  assert.strictEqual(v.lent.verdict, "a-confirmer");
  assert.match(v.lent.raison, /délai dépassé/);
});

test("verdicts : une fiche vérifiée est gardée 24 h en cache ; une erreur ne l'est pas", () => {
  let appels = 0;
  const sonder = (paquets) => (appels++, registre({ zod: ANCIEN })(paquets));
  pq.verdicts([{ nom: "zod", registre: "npm" }], { maintenant: MAINTENANT, sonder });
  pq.verdicts([{ nom: "zod", registre: "npm" }], { maintenant: MAINTENANT + 3600000, sonder });
  assert.strictEqual(appels, 1);
  pq.verdicts([{ nom: "zod", registre: "npm" }], { maintenant: MAINTENANT + 25 * 3600000, sonder });
  assert.strictEqual(appels, 2, "après 24 h, le registre est de nouveau consulté");
  const enPanne = () => [{ nom: "x", registre: "npm", erreur: "registre injoignable" }];
  pq.verdicts([{ nom: "x", registre: "npm" }], { maintenant: MAINTENANT, sonder: enPanne });
  assert.ok(!JSON.parse(fs.readFileSync(CACHE, "utf8"))["npm:x"]);
});

test("evaluer : refus d'un paquet absent, accord pour un doute, rien pour un paquet sûr ou une autre commande", () => {
  const d = projet("evaluer");
  const sonder = registre({ zod: ANCIEN, lodahs: { existe: true, cree: MAINTENANT - 400 * JOUR, versions: 40 } });
  const bash = (command) => ({ tool_name: "Bash", tool_input: { command }, cwd: d });
  const refus = pq.evaluer(bash("npm install zod nexiste-pas"), { maintenant: MAINTENANT, sonder });
  assert.strictEqual(refus.decision, "deny");
  assert.match(refus.raison, /« nexiste-pas »/);
  assert.match(refus.raison, /pulse-aidd paquets verifier/);
  assert.strictEqual(pq.evaluer(bash("npm install lodahs"), { maintenant: MAINTENANT, sonder }).decision, "ask");
  assert.strictEqual(pq.evaluer(bash("npm install zod"), { maintenant: MAINTENANT, sonder }), null);
  assert.strictEqual(pq.evaluer(bash("npm test"), { maintenant: MAINTENANT, sonder }), null);
  assert.strictEqual(pq.evaluer({ tool_name: "Write", tool_input: { file_path: "a", content: "npm install x" }, cwd: d }), null);
  const beaucoup = pq.evaluer(bash("npm install a1 a2 a3 a4 a5 a6"), { maintenant: MAINTENANT, sonder });
  assert.strictEqual(beaucoup.decision, "ask");
  assert.match(beaucoup.raison, /6 paquets/);
});

test("garde.js : le contrôle des paquets passe par le point d'entrée unique (cache pré-rempli, sans réseau)", () => {
  const d = projet("hook");
  const maintenant = Date.now();
  fs.writeFileSync(CACHE, JSON.stringify({ "npm:zod": { nom: "zod", registre: "npm", existe: true, cree: maintenant - 900 * JOUR, versions: 120, verifie: maintenant }, "npm:faux-paquet-pulse": { nom: "faux-paquet-pulse", registre: "npm", existe: false, verifie: maintenant } }));
  const lancer = (command, env = {}) => {
    const r = spawnSync("node", [HOOK], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: d }), encoding: "utf8", env: { ...process.env, PULSE_GARDE_OFF: "", PULSE_GARDE_COMMANDES_OFF: "", PULSE_GARDE_PAQUETS_OFF: "", PULSE_PAQUETS_CACHE: CACHE, ...env } });
    assert.strictEqual(r.status, 0);
    return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
  };
  assert.strictEqual(lancer("npm install faux-paquet-pulse").permissionDecision, "deny");
  assert.strictEqual(lancer("npm install zod"), null);
  assert.strictEqual(lancer("npm install faux-paquet-pulse", { PULSE_GARDE_PAQUETS_OFF: "1" }), null);
});

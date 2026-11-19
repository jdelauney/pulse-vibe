#!/usr/bin/env node
// Pulse – contrôle des paquets ajoutés (`pulse-aidd paquets verifier <nom…>`), et son garde-fou (hook PreToolUse,
// appelé par garde.js, Bash et PowerShell seulement).
//
// Une IA peut citer un paquet qui n'existe pas, ou un nom proche d'un paquet connu, qu'un attaquant a publié exprès
// (« slopsquatting », « typosquatting »). La règle commune 8 demande de vérifier ; ce contrôle le fait à chaque installation :
//  - refuse un paquet absent du registre (npm, PyPI) ;
//  - demande l'accord, avec la raison, pour un paquet publié il y a moins de JOURS_RECENT jours, qui a moins de
//    VERSIONS_MIN versions, ou dont le nom est à une ou deux lettres d'un paquet connu (sans être lui) ;
//  - demande l'accord quand le registre ne répond pas (le paquet n'a pas pu être vérifié).
// Commandes lues : npm install|i|add (et ses abréviations), pnpm add|install|i, yarn add, bun add|install|i, avec des noms ;
// npm|pnpm|bun install sans nom : les dépendances de package.json absentes de package-lock.json (ou de node_modules) ;
// pip install, pip3 install, python -m pip install, uv add, uv pip install, poetry add.
// Laisse passer : chemins locaux, adresses, dépôts Git, alias de dossier, paquets d'un registre privé déclaré dans un
// .npmrc (projet ou personnel), noms déjà dans package.json. Seul le nom du paquet est envoyé, au registre public,
// comme le ferait l'installation elle-même. Un registre consulté une fois l'est pour 24 h (cache dans le dossier
// temporaire de la machine).
//
//   pulse-aidd paquets verifier <nom…> [--pypi]   une ligne par paquet : « paquet: <nom> · <verdict> · <raison> »
//
// Module : nomsInstalles(commande, dialecte, cwd) → [{ nom, registre }], verdicts(paquets, options) → [{ nom, verdict, raison }],
// evaluer(entree) → { decision, raison } | null. Désactivation ponctuelle : PULSE_GARDE_PAQUETS_OFF=1.
// Fail-open : une erreur du contrôle laisse passer ; un registre injoignable demande l'accord.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const JOURS_RECENT = 30;
const VERSIONS_MIN = 3;
const MAX_PAQUETS = 5;
const DELAI_MS = 12000;
const CACHE_H = 24;
const CACHE = process.env.PULSE_PAQUETS_CACHE || path.join(os.tmpdir(), "pulse-paquets-cache.json");

// Noms proches d'un paquet très installé, mais connus et légitimes : jamais signalés comme imitation.
const LEGITIMES = new Set(["preact", "redis", "ioredis", "pnpm", "yarn", "vitest", "vite", "jest", "react-is", "moment-timezone", "dayjs", "nuxt", "next", "pino", "tsup", "rollup", "unplugin"]);
// Noms très installés, souvent imités : comparés en plus des dépendances du projet.
const CONNUS = [
  "react", "react-dom", "next", "vue", "nuxt", "svelte", "angular", "express", "fastify", "koa", "hono", "axios", "lodash", "underscore",
  "zod", "yup", "joi", "typescript", "vite", "vitest", "jest", "mocha", "chai", "eslint", "prettier", "webpack", "rollup", "esbuild",
  "tailwindcss", "postcss", "autoprefixer", "sass", "drizzle-orm", "drizzle-kit", "prisma", "mongoose", "sequelize", "pg", "mysql2",
  "sqlite3", "better-sqlite3", "redis", "ioredis", "dotenv", "cors", "helmet", "jsonwebtoken", "bcrypt", "bcryptjs", "argon2", "uuid",
  "nanoid", "dayjs", "date-fns", "moment", "luxon", "chalk", "commander", "yargs", "inquirer", "nodemailer", "stripe", "openai",
  "@anthropic-ai/sdk", "better-auth", "next-auth", "next-safe-action", "@tanstack/react-query", "swr", "zustand", "redux",
  "@reduxjs/toolkit", "react-hook-form", "framer-motion", "motion", "clsx", "class-variance-authority", "lucide-react",
  "@playwright/test", "playwright", "puppeteer", "cheerio", "sharp", "multer", "socket.io", "ws", "graphql", "@types/node",
  "@types/react", "ts-node", "tsx", "nodemon", "concurrently", "rimraf", "cross-env", "husky", "lint-staged",
  "requests", "numpy", "pandas", "flask", "django", "fastapi", "pydantic", "sqlalchemy", "pytest", "httpx", "uvicorn",
];

const GESTIONNAIRES = {
  npm: { ajout: /^(install|i|in|ins|inst|insta|instal|isnt|isnta|isntal|isntall|add)$/ },
  pnpm: { ajout: /^(add|install|i)$/ },
  yarn: { ajout: /^add$/ },
  bun: { ajout: /^(add|install|i)$/ },
};
// Options de npm, pnpm, yarn et bun suivies d'une valeur (le mot suivant n'est pas un paquet).
const OPTIONS_A_VALEUR = new Set(["--registry", "--prefix", "-C", "--dir", "--filter", "-F", "--workspace", "-w", "--tag", "--cwd", "--cache", "--userconfig", "--omit", "--include", "--install-strategy"]);
const OPTIONS_PIP_A_VALEUR = new Set(["-r", "--requirement", "-c", "--constraint", "-i", "--index-url", "--extra-index-url", "-t", "--target", "--prefix", "--root", "-e", "--editable", "--group", "-G", "--source"]);

// ---------------------------------------------------------------- lecture des commandes

/** Le nom de registre d'une désignation npm (« zod@3 », « @types/node@20 », « alias@npm:vrai@1 »), ou null (chemin, adresse, dépôt). */
function nomNpm(spec) {
  let s = String(spec || "").trim();
  if (!s || /^[.~/\\]|^[a-z]:[\\/]|^(file|link|workspace|portal|patch|git|git\+\w+|https?|github|gitlab|bitbucket):/i.test(s) || s.endsWith(".tgz")) return null;
  const alias = /^(?:@[^/@]+\/)?[^@]+@npm:(.+)$/.exec(s);
  if (alias) s = alias[1];
  if (s.startsWith("@")) {
    const m = /^(@[^/@\s]+\/[^/@\s]+)(?:@.*)?$/.exec(s);
    return m ? m[1].toLowerCase() : null;
  }
  if (s.includes("/")) return null; // utilisateur/dépôt de GitHub
  const nom = s.split("@")[0];
  return /^[a-z0-9][a-z0-9._-]*$/i.test(nom) ? nom.toLowerCase() : null;
}

/** Le nom d'une désignation pip (« requests==2.31 », « Django>=4 », « pkg[extra] »), ou null. */
function nomPip(spec) {
  const s = String(spec || "").trim();
  if (!s || /^[.~/\\]|^[a-z]:[\\/]|:\/\/|^git\+/i.test(s) || /\.(whl|tar\.gz|zip)$/i.test(s)) return null;
  const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(s);
  return m ? m[1].toLowerCase().replace(/[._]+/g, "-") : null;
}

function positions(args, aValeur) {
  const res = [];
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (a === "--") continue;
    if (a.startsWith("-")) {
      if (!a.includes("=") && aValeur.has(a)) i++;
      continue;
    }
    res.push(a);
  }
  return res;
}

function lireJson(fichier) {
  try {
    return JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch (e) {
    return null;
  }
}

/** Les dépendances déclarées dans package.json (noms en minuscules). */
function dependances(dossier) {
  const pj = lireJson(path.join(dossier, "package.json")) || {};
  const noms = new Set();
  for (const champ of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) for (const n of Object.keys(pj[champ] || {})) noms.add(n.toLowerCase());
  return { pj, noms };
}

/** `npm install` sans nom : les dépendances de package.json absentes du fichier de verrou et de node_modules.
 * Sans fichier de verrou (première installation d'un projet), rien : toutes les dépendances seraient nouvelles. */
function nouvellesDependances(dossier) {
  const { pj, noms } = dependances(dossier);
  const verrou = lireJson(path.join(dossier, "package-lock.json"));
  let autre = "";
  for (const f of ["pnpm-lock.yaml", "yarn.lock", "bun.lock"]) {
    try {
      autre += fs.readFileSync(path.join(dossier, f), "utf8");
    } catch (e) {
      // absent
    }
  }
  if (!verrou && !autre) return [];
  const dansVerrou = (n) => (verrou && verrou.packages && Object.prototype.hasOwnProperty.call(verrou.packages, `node_modules/${n}`)) || (autre && autre.includes(n));
  const res = [];
  for (const champ of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const [n, v] of Object.entries(pj[champ] || {})) {
      if (!nomNpm(`${n}@${v}`) || /^(file|link|workspace|git|https?|github):/i.test(String(v))) continue;
      if (dansVerrou(n) || fs.existsSync(path.join(dossier, "node_modules", n, "package.json"))) continue;
      res.push(n.toLowerCase());
    }
  }
  return [...new Set(res)].filter((n) => noms.has(n));
}

/** Les registres privés déclarés dans un .npmrc : { tout: bool, portees: Set } (le projet, puis le dossier personnel). */
function registresPrives(dossier) {
  const prives = { tout: false, portees: new Set() };
  for (const f of [path.join(dossier, ".npmrc"), path.join(os.homedir(), ".npmrc")]) {
    let texte = "";
    try {
      texte = fs.readFileSync(f, "utf8");
    } catch (e) {
      continue;
    }
    for (const ligne of texte.split(/\r?\n/)) {
      const m = /^\s*(@[^:\s]+:)?registry\s*=\s*(\S+)/i.exec(ligne);
      if (!m || /registry\.npmjs\.org/i.test(m[2])) continue;
      if (m[1]) prives.portees.add(m[1].slice(0, -1).toLowerCase());
      else prives.tout = true;
    }
  }
  return prives;
}

/** Les paquets qu'une commande installe depuis un registre public : [{ nom, registre: "npm" | "pypi" }]. */
function nomsInstalles(commande, dialecte = "bash", cwd = process.cwd()) {
  const { commandesSimples } = require("./lecture-commande");
  const res = [];
  let dossier = cwd;
  for (const c of commandesSimples(commande, dialecte)) {
    const args = c.args.map(String);
    if (["cd", "set-location", "sl", "pushd"].includes(c.cmd) && args[0]) {
      dossier = path.resolve(dossier, args[0]);
      continue;
    }
    const g = GESTIONNAIRES[c.cmd];
    if (g) {
      const sous = args.findIndex((a) => !a.startsWith("-"));
      if (sous < 0 || !g.ajout.test(args[sous])) continue;
      if (args.some((a) => a === "--registry" || a.startsWith("--registry="))) continue; // registre choisi à la main
      const prives = registresPrives(dossier);
      if (prives.tout) continue;
      const { noms: declares } = dependances(dossier);
      const specs = positions(args.slice(sous + 1), OPTIONS_A_VALEUR);
      const noms = specs.length ? specs.map(nomNpm).filter(Boolean).filter((n) => !declares.has(n)) : c.cmd === "yarn" ? [] : nouvellesDependances(dossier);
      for (const nom of noms) if (!(nom.startsWith("@") && prives.portees.has(nom.split("/")[0]))) res.push({ nom, registre: "npm" });
      continue;
    }
    let specsPip = null;
    if (/^pip3?(\.\d+)?$/.test(c.cmd) && args[0] === "install") specsPip = args.slice(1);
    else if (/^python(3(\.\d+)?)?$|^py$/.test(c.cmd) && args[0] === "-m" && /^pip3?$/.test(args[1] || "") && args[2] === "install") specsPip = args.slice(3);
    else if (c.cmd === "uv" && args[0] === "add") specsPip = args.slice(1);
    else if (c.cmd === "uv" && args[0] === "pip" && args[1] === "install") specsPip = args.slice(2);
    else if (c.cmd === "poetry" && args[0] === "add") specsPip = args.slice(1);
    if (specsPip && !specsPip.some((a) => /^(-i|--index-url|--extra-index-url)/.test(a))) for (const nom of positions(specsPip, OPTIONS_PIP_A_VALEUR).map(nomPip).filter(Boolean)) res.push({ nom, registre: "pypi" });
  }
  const vus = new Set();
  return res.filter((p) => !vus.has(`${p.registre}:${p.nom}`) && vus.add(`${p.registre}:${p.nom}`));
}

// ---------------------------------------------------------------- registre

/** Distance de Damerau-Levenshtein (transposition de deux lettres voisines comprise). */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

/** Le nom connu dont `nom` est une imitation probable (une ou deux lettres de différence), ou null. */
function ressemble(nom, connus) {
  if (connus.has(nom) || LEGITIMES.has(nom)) return null;
  for (const c of connus) {
    if (c === nom) continue;
    const seuil = Math.min(nom.length, c.length) >= 6 ? 2 : 1;
    if (Math.abs(c.length - nom.length) <= seuil && distance(nom, c) <= seuil) return c;
  }
  return null;
}

function lireCache() {
  const c = lireJson(CACHE);
  return c && typeof c === "object" ? c : {};
}

function ecrireCache(cache, maintenant = Date.now()) {
  try {
    const limite = maintenant - CACHE_H * 3600 * 1000;
    const garde = Object.fromEntries(Object.entries(cache).filter(([, v]) => v && v.verifie > limite));
    fs.writeFileSync(CACHE, JSON.stringify(garde), "utf8");
  } catch (e) {
    // cache facultatif
  }
}

// Interroge les registres dans un processus Node à part (fetch, en parallèle) : le garde-fou reste synchrone.
const SONDE = `
const paquets = JSON.parse(process.argv[1]);
const delai = Number(process.argv[2]);
const adresse = (p) => p.registre === "pypi" ? "https://pypi.org/pypi/" + encodeURIComponent(p.nom) + "/json" : "https://registry.npmjs.org/" + p.nom.replace("/", "%2f");
async function sonder(p) {
  try {
    const r = await fetch(adresse(p), { signal: AbortSignal.timeout(delai), headers: { "user-agent": "pulse-paquets" } });
    if (r.status === 404) return { ...p, existe: false };
    if (!r.ok) return { ...p, erreur: "réponse " + r.status };
    const j = await r.json();
    if (p.registre === "pypi") {
      const dates = Object.values(j.releases || {}).flat().map((f) => Date.parse(f.upload_time_iso_8601 || f.upload_time)).filter((t) => !Number.isNaN(t));
      return { ...p, existe: true, cree: dates.length ? Math.min(...dates) : null, versions: Object.keys(j.releases || {}).length };
    }
    const cree = Date.parse((j.time && j.time.created) || "");
    return { ...p, existe: true, cree: Number.isNaN(cree) ? null : cree, versions: Object.keys(j.versions || {}).length };
  } catch (e) {
    return { ...p, erreur: e && e.name === "TimeoutError" ? "délai dépassé" : "registre injoignable" };
  }
}
Promise.all(paquets.map(sonder)).then((r) => process.stdout.write(JSON.stringify(r)));
`;

/** Les fiches des paquets (cache, puis registre) : [{ nom, registre, existe, cree, versions } | { nom, registre, erreur }]. */
function fiches(paquets, { maintenant = Date.now(), sonder = sonderRegistres } = {}) {
  const cache = lireCache();
  const cle = (p) => `${p.registre}:${p.nom}`;
  const aSonder = paquets.filter((p) => !(cache[cle(p)] && cache[cle(p)].verifie > maintenant - CACHE_H * 3600 * 1000));
  const sondes = aSonder.length ? sonder(aSonder) : [];
  for (const f of sondes) if (!f.erreur) cache[cle(f)] = { ...f, verifie: maintenant };
  if (sondes.some((f) => !f.erreur)) ecrireCache(cache, maintenant);
  return paquets.map((p) => cache[cle(p)] || sondes.find((f) => cle(f) === cle(p)) || { ...p, erreur: "registre injoignable" });
}

function sonderRegistres(paquets) {
  const r = spawnSync(process.execPath, ["-e", SONDE, JSON.stringify(paquets), String(DELAI_MS - 1000)], { encoding: "utf8", timeout: DELAI_MS, windowsHide: true });
  try {
    return JSON.parse(r.stdout);
  } catch (e) {
    return paquets.map((p) => ({ ...p, erreur: "registre injoignable" }));
  }
}

/** Le verdict de chaque paquet : « absent », « a-confirmer » (avec la raison) ou « ok ». */
function verdicts(paquets, { connus = new Set(), maintenant = Date.now(), sonder } = {}) {
  const tousConnus = new Set([...CONNUS, ...connus]);
  return fiches(paquets, { maintenant, sonder }).map((f) => {
    if (f.erreur) return { nom: f.nom, verdict: "a-confirmer", raison: `il n'a pas pu être vérifié (${f.erreur})` };
    if (!f.existe) return { nom: f.nom, verdict: "absent", raison: `aucun paquet de ce nom sur ${f.registre === "pypi" ? "PyPI" : "le registre npm"}` };
    const raisons = [];
    const proche = ressemble(f.nom, tousConnus);
    if (proche) raisons.push(`son nom ressemble à « ${proche} », un paquet très utilisé : vouliez-vous dire « ${proche} » ?`);
    if (f.cree && maintenant - f.cree < JOURS_RECENT * 86400 * 1000) raisons.push(`il a été publié il y a ${Math.max(1, Math.round((maintenant - f.cree) / 86400000))} jour(s)`);
    if (Number.isFinite(f.versions) && f.versions < VERSIONS_MIN) raisons.push(`il n'a que ${f.versions} version(s)`);
    return raisons.length ? { nom: f.nom, verdict: "a-confirmer", raison: raisons.join(" ; ") } : { nom: f.nom, verdict: "ok", raison: "" };
  });
}

// ---------------------------------------------------------------- garde-fou

/** Décision pour une entrée de hook : refus (paquet absent), demande d'accord (paquet à confirmer), ou null. */
function evaluer(entree, options = {}) {
  if (process.env.PULSE_GARDE_PAQUETS_OFF === "1") return null;
  try {
    if (!entree || !["Bash", "PowerShell"].includes(entree.tool_name) || !entree.tool_input || typeof entree.tool_input.command !== "string") return null;
    const cwd = entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : process.cwd();
    const paquets = nomsInstalles(entree.tool_input.command, entree.tool_name === "PowerShell" ? "powershell" : "bash", cwd);
    if (!paquets.length) return null;
    if (paquets.length > MAX_PAQUETS)
      return { decision: "ask", raison: `📦 Pulse demande votre accord : cette commande installe ${paquets.length} paquets d'un coup (${paquets.map((p) => p.nom).join(", ")}), trop pour les vérifier un par un. Vérifiez chaque nom dans la documentation officielle, ou installez-les en plusieurs fois.` };
    const v = verdicts(paquets, { connus: dependances(cwd).noms, ...options });
    const absents = v.filter((x) => x.verdict === "absent");
    if (absents.length)
      return {
        decision: "deny",
        raison:
          `📦 Pulse a bloqué l'installation : ${absents.map((x) => `« ${x.nom} » (${x.raison})`).join(", ")}. Un nom de paquet inventé ou mal écrit peut aussi être réservé par un attaquant.\n` +
          `À faire : retrouvez le nom exact dans la documentation officielle de la bibliothèque, vérifiez-le avec \`pulse-aidd paquets verifier <nom>\`, puis relancez l'installation. Expliquez-le simplement à la personne.`,
      };
    const doutes = v.filter((x) => x.verdict === "a-confirmer");
    if (doutes.length)
      return {
        decision: "ask",
        raison: `📦 Pulse demande votre accord avant d'installer : ${doutes.map((x) => `« ${x.nom} » : ${x.raison}`).join(" · ")}. Un paquet récent, rare ou au nom proche d'un paquet connu peut être une imitation. Acceptez seulement si ce nom vient de la documentation officielle.`,
      };
    return null;
  } catch (e) {
    return null;
  }
}

function main(args) {
  const [action, ...reste] = args;
  if (action !== "verifier" || !reste.filter((a) => a !== "--pypi").length) {
    console.log("Usage : pulse-aidd paquets verifier <nom…> [--pypi]");
    return;
  }
  const pypi = reste.includes("--pypi");
  const paquets = reste.filter((a) => a !== "--pypi").map((n) => ({ nom: pypi ? nomPip(n) : nomNpm(n), registre: pypi ? "pypi" : "npm" })).filter((p) => p.nom);
  for (const v of verdicts(paquets, { connus: dependances(process.cwd()).noms })) console.log(`paquet: ${v.nom} · ${v.verdict}${v.raison ? ` · ${v.raison}` : ""}`);
}

module.exports = { nomNpm, nomPip, nomsInstalles, ressemble, distance, verdicts, evaluer, CONNUS, JOURS_RECENT, VERSIONS_MIN, MAX_PAQUETS };

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    // jamais d'échec visible
  }
  process.exitCode = 0;
}

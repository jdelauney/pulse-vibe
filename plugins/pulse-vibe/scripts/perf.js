#!/usr/bin/env node
// Pulse – mesure de la vitesse d'un site (`pulse-aidd perf`, /pulse:perf).
//
//   pulse-aidd perf mesurer <adresse>[,<adresse>…] [--passages 3] [--appareil mobile|ordinateur]
//                           [--source psi|local] [--json <fichier>] [--pages docs/performance.md]
//   pulse-aidd perf terrain <origine-ou-adresse> [--historique] [--appareil mobile|ordinateur] [--json <fichier>]
//   pulse-aidd perf comparer <avant.json> <apres.json>
//   pulse-aidd perf budget <mesure.json> <docs/performance.md>
//   pulse-aidd perf cle         vérifie que la clé Google est présente et acceptée (sans l'afficher)
//   pulse-aidd perf installer   copie ce script dans scripts/perf.js du projet (pour la CI)
//
// Deux sources, jamais mélangées :
//   - simulation (laboratoire) : Lighthouse, par PageSpeed Insights (clé Google) ou en local (npx lighthouse) ;
//   - vrais visiteurs (terrain) : API CrUX (même clé Google).
// La clé se lit dans la variable d'environnement PULSE_PSI_CLE du poste ; elle n'est jamais affichée.
// PULSE_PERF_API redirige PageSpeed Insights et CrUX vers un autre serveur (tests).
// PULSE_PERF_LIGHTHOUSE : script Node lancé à la place de « npx lighthouse » (tests).
// Codes de sortie : 0 réussi ; 1 échec de mesure, budget dépassé ou usage ; 2 clé, outil ou version manquants.
// Sans dépendance : Node 22.19 ou plus (version exigée par Lighthouse 13).
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const LIGHTHOUSE = "13"; // version majeure : la dernière 13.x publiée ; une nouvelle majeure impose de relire references/performance.md
const NODE_MIN = [22, 19];
const MAX_PAGES = 8;
const FORMAT = "pulse-perf-mesure/1";

const USAGE = `Usage :
  pulse-aidd perf mesurer <adresse>[,<adresse>…] [--passages 3] [--appareil mobile|ordinateur] [--source psi|local] [--json <fichier>] [--pages docs/performance.md]
  pulse-aidd perf terrain <origine-ou-adresse> [--historique] [--appareil mobile|ordinateur] [--json <fichier>]
  pulse-aidd perf comparer <avant.json> <apres.json>
  pulse-aidd perf budget <mesure.json> <docs/performance.md>
  pulse-aidd perf cle
  pulse-aidd perf installer`;

// ------------------------------------------------------------------ Seuils officiels

// Core Web Vitals (web.dev/articles/vitals) : bon ≤ « bon », mauvais > « mauvais ».
// TBT et Speed Index : bandes de Lighthouse (mobile). Score : 90 et 50.
const SEUILS = {
  lcp: { bon: 2500, mauvais: 4000 },
  inp: { bon: 200, mauvais: 500 },
  cls: { bon: 0.1, mauvais: 0.25 },
  fcp: { bon: 1800, mauvais: 3000 },
  ttfb: { bon: 800, mauvais: 1800 },
  tbt: { bon: 200, mauvais: 600 },
  si: { bon: 3400, mauvais: 5800 },
};

/** bon | a-ameliorer | mauvais, ou null si la valeur manque. */
function classer(valeur, seuils) {
  if (typeof valeur !== "number" || Number.isNaN(valeur) || !seuils) return null;
  if (valeur <= seuils.bon) return "bon";
  if (valeur > seuils.mauvais) return "mauvais";
  return "a-ameliorer";
}

function classerScore(score) {
  if (typeof score !== "number") return null;
  if (score >= 90) return "bon";
  if (score >= 50) return "a-ameliorer";
  return "mauvais";
}

const FEU = { bon: "🟢", "a-ameliorer": "🟠", mauvais: "🔴" };
const feu = (c) => FEU[c] || "⚪";

// ------------------------------------------------------------------ Clé : jamais affichée

const lireCle = () => (process.env.PULSE_PSI_CLE || "").trim();

function masquer(texte) {
  let t = String(texte);
  const cle = lireCle();
  if (cle) t = t.split(cle).join("•••");
  return t.replace(/([?&]key=)[^&\s"']+/g, "$1•••");
}
const dire = (t = "") => process.stdout.write(masquer(t) + "\n");
const signaler = (t = "") => process.stderr.write(masquer(t) + "\n");

function erreurInattendue(e) {
  if (e instanceof Sortie) return;
  signaler(`❌ Erreur inattendue : ${e && e.message ? e.message : e}`);
  process.exitCode = 1;
}

const MESSAGE_SANS_CLE =
  "La clé Google manque : la variable d'environnement PULSE_PSI_CLE n'est pas définie sur ce poste.\n" +
  "  Créez-la une fois (procédure guidée : /pulse:perf suivre, ou « La clé Google » dans pulse-aidd reference performance.md),\n" +
  "  puis redémarrez Claude Code. Pour mesurer sans clé : --source local (Lighthouse sur cette machine).";

// ------------------------------------------------------------------ Mise en forme française

function fr(n, decimales) {
  return n.toFixed(decimales).replace(".", ",");
}
function duree(ms) {
  if (typeof ms !== "number") return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${fr(ms / 1000, 1)} s`;
}
function octets(o) {
  if (typeof o !== "number") return "—";
  if (o < 1e6) return `${Math.round(o / 1000)} Ko`;
  return `${fr(o / 1e6, 1)} Mo`;
}
function valeurLisible(cle, v) {
  if (typeof v !== "number") return "—";
  if (cle === "cls") return fr(v, 2);
  if (cle === "score") return `${Math.round(v)}/100`;
  if (cle === "poids") return octets(v);
  if (cle === "requetes") return String(Math.round(v));
  return duree(v);
}

const NOMS = {
  lcp: "Affichage du contenu principal (LCP)",
  cls: "Stabilité de la page (CLS)",
  tbt: "Blocages pendant le chargement (TBT)",
  inp: "Réaction aux clics (INP)",
  fcp: "Premier affichage (FCP)",
  si: "Vitesse d'affichage (Speed Index)",
  ttfb: "Réponse du serveur (TTFB)",
  score: "Score de performance",
  poids: "Poids de la page",
  requetes: "Nombre de requêtes",
};

// ------------------------------------------------------------------ Lecture d'un rapport Lighthouse 13

const MODES_SANS_VERDICT = new Set(["informative", "notApplicable", "manual", "error"]);

/** Les éléments (nœuds) cités dans les détails d'un audit, sans doublon. */
function noeuds(details, trouves = new Map()) {
  if (!details || typeof details !== "object") return [...trouves.values()];
  if (details.type === "node" && details.selector && !trouves.has(details.selector)) {
    trouves.set(details.selector, { selecteur: details.selector, libelle: details.nodeLabel || null, extrait: details.snippet || null });
  }
  for (const v of Array.isArray(details) ? details : Object.values(details)) if (v && typeof v === "object") noeuds(v, trouves);
  return [...trouves.values()];
}

/** Les adresses de ressources citées dans un tableau de détails. */
function ressources(details) {
  const items = (details && Array.isArray(details.items) && details.items) || [];
  return [...new Set(items.map((i) => i && typeof i.url === "string" && i.url).filter(Boolean))];
}

/** Rapport Lighthouse (lhr) → mesure d'un passage. */
function extraire(lhr) {
  if (!lhr || typeof lhr !== "object" || !lhr.audits || !lhr.categories) throw new Error("rapport Lighthouse illisible");
  if (lhr.runtimeError && lhr.runtimeError.code) throw new Error(`Lighthouse n'a pas pu charger la page (${lhr.runtimeError.code})`);
  const a = lhr.audits;
  const num = (id) => (a[id] && typeof a[id].numericValue === "number" ? a[id].numericValue : null);
  const cat = (id) => (lhr.categories[id] && typeof lhr.categories[id].score === "number" ? Math.round(lhr.categories[id].score * 100) : null);
  const m = (a.metrics && a.metrics.details && a.metrics.details.items && a.metrics.details.items[0]) || {};
  const resume = a["resource-summary"] && a["resource-summary"].details && (a["resource-summary"].details.items || []).find((i) => i.resourceType === "total");

  // Diagnostics : audits des groupes « insights » et « diagnostics » de la catégorie performance, en échec (score < 0,9).
  const refs = (lhr.categories.performance && lhr.categories.performance.auditRefs) || [];
  const diagnostics = [];
  for (const ref of refs) {
    if (ref.group !== "insights" && ref.group !== "diagnostics") continue;
    const x = a[ref.id];
    if (!x || typeof x.score !== "number" || x.score >= 0.9 || MODES_SANS_VERDICT.has(x.scoreDisplayMode)) continue;
    const g = x.metricSavings || {};
    diagnostics.push({
      id: ref.id,
      titre: x.title,
      valeur: x.displayValue || null,
      gains: { lcp: g.LCP || 0, fcp: g.FCP || 0, tbt: g.TBT || 0, cls: g.CLS || 0, inp: g.INP || 0 },
      octets: (x.details && (x.details.overallSavingsBytes || (x.details.debugData && x.details.debugData.wastedBytes))) || null,
      elements: noeuds(x.details).slice(0, 3),
      ressources: ressources(x.details).slice(0, 3),
    });
  }
  diagnostics.sort((d1, d2) => importance(d2) - importance(d1));

  const lcpNoeud = noeuds(a["lcp-breakdown-insight"] && a["lcp-breakdown-insight"].details)[0] || null;
  const formFactor = lhr.configSettings && lhr.configSettings.formFactor;
  return {
    version: lhr.lighthouseVersion || null,
    url: lhr.finalDisplayedUrl || lhr.finalUrl || lhr.requestedUrl || null,
    appareil: formFactor === "desktop" ? "ordinateur" : "mobile",
    score: cat("performance"),
    scores: { performance: cat("performance"), accessibilite: cat("accessibility"), bonnesPratiques: cat("best-practices"), seo: cat("seo") },
    metriques: {
      fcp: num("first-contentful-paint"),
      lcp: num("largest-contentful-paint"),
      tbt: num("total-blocking-time"),
      cls: num("cumulative-layout-shift"),
      si: num("speed-index"),
      ttfb: typeof m.timeToFirstByte === "number" ? m.timeToFirstByte : null,
    },
    poids: num("total-byte-weight"),
    requetes: resume && typeof resume.requestCount === "number" ? resume.requestCount : null,
    elementLcp: lcpNoeud,
    diagnostics,
    avertissements: Array.isArray(lhr.runWarnings) ? lhr.runWarnings : [],
  };
}

/** Ordre des diagnostics : gain de temps estimé, puis gain de stabilité. */
function importance(d) {
  return Math.max(d.gains.lcp, d.gains.fcp, d.gains.tbt, d.gains.inp) + d.gains.cls * 10000;
}

// ------------------------------------------------------------------ Agrégation des passages

const CLES = ["score", "lcp", "cls", "tbt", "fcp", "si", "ttfb", "poids", "requetes"];
const valeurDe = (p, cle) => (cle in p.metriques ? p.metriques[cle] : p[cle]);

function mediane(valeurs) {
  const v = valeurs.filter((x) => typeof x === "number").sort((x, y) => x - y);
  if (!v.length) return null;
  const milieu = Math.floor(v.length / 2);
  return v.length % 2 ? v[milieu] : (v[milieu - 1] + v[milieu]) / 2;
}

/** Plusieurs passages d'une même page → médianes, écarts, passage médian, instabilités. */
function agreger(passages) {
  if (!passages.length) throw new Error("aucun passage à agréger");
  const resultat = { mediane: {}, min: {}, max: {} };
  for (const cle of CLES) {
    const v = passages.map((p) => valeurDe(p, cle)).filter((x) => typeof x === "number");
    resultat.mediane[cle] = mediane(v);
    resultat.min[cle] = v.length ? Math.min(...v) : null;
    resultat.max[cle] = v.length ? Math.max(...v) : null;
  }
  // Passage médian : celui dont le score est la médiane (le plus bas des deux du milieu si leur nombre est pair).
  const ordre = passages.map((p, i) => ({ i, s: typeof p.score === "number" ? p.score : -1, l: p.metriques.lcp || 0 })).sort((x, y) => x.s - y.s || y.l - x.l);
  const pm = passages[ordre[Math.floor((ordre.length - 1) / 2)].i];

  const instable = [];
  const ecart = (cle) => resultat.max[cle] - resultat.min[cle];
  if (typeof resultat.mediane.lcp === "number" && (ecart("lcp") > 1000 || ecart("lcp") > 0.3 * resultat.mediane.lcp)) instable.push("lcp");
  if (typeof resultat.mediane.score === "number" && ecart("score") > 10) instable.push("score");

  const scores = {};
  for (const c of ["performance", "accessibilite", "bonnesPratiques", "seo"]) scores[c] = mediane(passages.map((p) => p.scores && p.scores[c]));
  return {
    url: pm.url,
    appareil: pm.appareil,
    version: pm.version,
    passages: passages.length,
    ...resultat,
    scores,
    instable,
    elementLcp: pm.elementLcp,
    diagnostics: pm.diagnostics,
    detail: passages.map((p) => ({ score: p.score, metriques: p.metriques, poids: p.poids, requetes: p.requetes })),
  };
}

// ------------------------------------------------------------------ Terrain (CrUX)

const CRUX = {
  largest_contentful_paint: "lcp",
  interaction_to_next_paint: "inp",
  cumulative_layout_shift: "cls",
  first_contentful_paint: "fcp",
  experimental_time_to_first_byte: "ttfb",
};

const dateCrux = (d) => (d ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : null);
const nombre = (v) => (v === null || v === undefined || v === "NaN" ? null : Number(v));

/** Réponse de records:queryRecord → p75 et catégorie par métrique. */
function lireTerrain(reponse) {
  const r = reponse && reponse.record;
  if (!r || !r.metrics) return { aDesDonnees: false };
  const metriques = {};
  for (const [nom, cle] of Object.entries(CRUX)) {
    const m = r.metrics[nom];
    if (!m || !m.percentiles) continue;
    const p75 = nombre(m.percentiles.p75);
    const bons = m.histogram && m.histogram[0] ? nombre(m.histogram[0].density) : null;
    metriques[cle] = { p75, categorie: classer(p75, SEUILS[cle]), partBonne: bons };
  }
  const trois = ["lcp", "inp", "cls"].map((c) => metriques[c]);
  const reussit = trois.every(Boolean) ? trois.every((m) => m.categorie === "bon") : null;
  return {
    aDesDonnees: true,
    cible: r.key.url || r.key.origin,
    niveau: r.key.url ? "page" : "site",
    appareil: r.key.formFactor === "DESKTOP" ? "ordinateur" : "mobile",
    periode: { debut: dateCrux(r.collectionPeriod && r.collectionPeriod.firstDate), fin: dateCrux(r.collectionPeriod && r.collectionPeriod.lastDate) },
    metriques,
    reussit,
  };
}

/** Réponse de records:queryHistoryRecord → séries de p75 par semaine. */
function lireHistorique(reponse) {
  const r = reponse && reponse.record;
  if (!r || !r.metrics) return { aDesDonnees: false };
  const periodes = (r.collectionPeriods || []).map((p) => dateCrux(p.lastDate));
  const series = {};
  for (const [nom, cle] of Object.entries(CRUX)) {
    const m = r.metrics[nom];
    if (m && m.percentilesTimeseries && Array.isArray(m.percentilesTimeseries.p75s)) series[cle] = m.percentilesTimeseries.p75s.map(nombre);
  }
  return { aDesDonnees: true, cible: r.key.url || r.key.origin, periodes, series };
}

// ------------------------------------------------------------------ Appels à Google (PSI, CrUX)

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const basePsi = () => process.env.PULSE_PERF_API || "https://www.googleapis.com";
const baseCrux = () => process.env.PULSE_PERF_API || "https://chromeuxreport.googleapis.com";

/** Appel avec nouveaux essais sur 429, 5xx et coupure réseau (délai croissant). */
async function appeler(url, options, { essais = 3, delai = 4000, delaiMax = 120000 } = {}) {
  let derniere = null;
  for (let n = 1; n <= essais; n++) {
    try {
      const rep = await fetch(url, { ...options, signal: AbortSignal.timeout(delaiMax) });
      const texte = await rep.text();
      let corps = null;
      try {
        corps = JSON.parse(texte);
      } catch {
        corps = { texte };
      }
      derniere = { statut: rep.status, corps };
      if (rep.status !== 429 && rep.status < 500) return derniere;
    } catch (e) {
      derniere = { statut: 0, corps: { texte: (e.cause && e.cause.code) || e.name } };
    }
    if (n < essais) await attendre(delai * 2 ** (n - 1));
  }
  return derniere;
}

/** Erreur de Google → phrase claire, sans la clé. */
function expliquerErreur(service, { statut, corps }) {
  const e = (corps && corps.error) || {};
  const message = e.message || (corps && corps.texte) || "";
  const raisons = JSON.stringify(e.details || e.errors || "");
  const api = service === "crux" ? "Chrome UX Report API" : "PageSpeed Insights API";
  if (statut === 0) return `Google ne répond pas (${message}) : vérifiez la connexion à Internet.`;
  if (/API_KEY_INVALID|API key not valid/i.test(message + raisons)) return "La clé Google est refusée (clé invalide). Vérifiez la valeur de PULSE_PSI_CLE sur ce poste, puis redémarrez Claude Code.";
  if (/SERVICE_DISABLED|has not been used|is disabled/i.test(message + raisons)) return `L'API « ${api} » n'est pas activée dans votre projet Google Cloud : activez-la (Bibliothèque d'API), attendez quelques minutes, puis relancez.`;
  if (/API_KEY_SERVICE_BLOCKED|API_KEY_.*BLOCKED|are blocked/i.test(message + raisons)) return `Les restrictions de la clé bloquent « ${api} » : ajoutez-la aux API autorisées de la clé (PageSpeed Insights API et Chrome UX Report API).`;
  if (statut === 429) return "Quota de Google dépassé, même après plusieurs essais. Attendez quelques minutes (ou demain pour le quota du jour), ou mesurez avec --source local.";
  if (statut === 403) return `Accès refusé par Google (${message || "403"}).`;
  if (statut >= 500) return `Google n'a pas pu mesurer la page (${statut}${message ? ` : ${message}` : ""}). Vérifiez que la page s'ouvre depuis Internet, puis relancez.`;
  return `Google a refusé la demande (${statut}${message ? ` : ${message}` : ""}).`;
}

async function mesurerParPsi(url, appareil, delai) {
  const params = new URLSearchParams({ url, strategy: appareil === "ordinateur" ? "desktop" : "mobile", locale: "fr", key: lireCle() });
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) params.append("category", c);
  const rep = await appeler(`${basePsi()}/pagespeedonline/v5/runPagespeed?${params}`, { method: "GET" }, { delai });
  if (rep.statut !== 200) throw new Error(expliquerErreur("psi", rep));
  if (!rep.corps || !rep.corps.lighthouseResult) throw new Error("réponse de PageSpeed Insights sans rapport Lighthouse");
  return { lhr: rep.corps.lighthouseResult, terrainPsi: resumerTerrainPsi(rep.corps) };
}

/** Le terrain renvoyé par PSI (retrait annoncé par Google) : gardé à part, en secours. */
function resumerTerrainPsi(corps) {
  const lire = (le) => {
    if (!le || !le.metrics) return null;
    const metriques = {};
    const noms = { LARGEST_CONTENTFUL_PAINT_MS: "lcp", INTERACTION_TO_NEXT_PAINT: "inp", CUMULATIVE_LAYOUT_SHIFT_SCORE: "cls", FIRST_CONTENTFUL_PAINT_MS: "fcp", EXPERIMENTAL_TIME_TO_FIRST_BYTE: "ttfb" };
    for (const [nom, cle] of Object.entries(noms)) {
      const m = le.metrics[nom];
      if (!m || typeof m.percentile !== "number") continue;
      const p75 = cle === "cls" ? m.percentile / 100 : m.percentile; // PSI donne le CLS multiplié par 100
      metriques[cle] = { p75, categorie: classer(p75, SEUILS[cle]) };
    }
    return { cible: le.id || null, replieSurOrigine: Boolean(le.origin_fallback), metriques };
  };
  const page = lire(corps.loadingExperience);
  const site = lire(corps.originLoadingExperience);
  return page || site ? { page, site, avertissement: "terrain lu dans PageSpeed Insights, dont Google a annoncé le retrait : préférez pulse-aidd perf terrain" } : null;
}

// ------------------------------------------------------------------ Lighthouse local

function versionNodeSuffisante() {
  const [maj, min] = process.versions.node.split(".").map(Number);
  return maj > NODE_MIN[0] || (maj === NODE_MIN[0] && min >= NODE_MIN[1]);
}

function existe(f) {
  try {
    return fs.statSync(f).isFile();
  } catch {
    return false;
  }
}

function dansLePath(noms) {
  for (const dossier of (process.env.PATH || "").split(path.delimiter)) for (const n of noms) if (dossier && existe(path.join(dossier, n))) return path.join(dossier, n);
  return null;
}

/** Chrome du poste (laissé à Lighthouse) ou, à défaut, le Chromium de Playwright. undefined : rien trouvé. */
function trouverChrome() {
  if (process.env.CHROME_PATH) return { chemin: process.env.CHROME_PATH, origine: "CHROME_PATH" };
  const env = process.env;
  let standards = [];
  if (process.platform === "win32") {
    for (const base of [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"]].filter(Boolean)) {
      standards.push(path.join(base, "Google", "Chrome", "Application", "chrome.exe"), path.join(base, "Google", "Chrome SxS", "Application", "chrome.exe"));
    }
  } else if (process.platform === "darwin") {
    standards = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome")];
  } else {
    const p = dansLePath(["google-chrome-stable", "google-chrome", "chromium-browser", "chromium"]);
    if (p) standards.push(p);
  }
  const standard = standards.find(existe);
  if (standard) return { chemin: null, origine: "Chrome" };

  const racine =
    env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== "0"
      ? env.PLAYWRIGHT_BROWSERS_PATH
      : process.platform === "win32"
        ? path.join(env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "ms-playwright")
        : process.platform === "darwin"
          ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
          : path.join(os.homedir(), ".cache", "ms-playwright");
  let dossiers = [];
  try {
    dossiers = fs.readdirSync(racine).filter((d) => /^chromium-\d+$/.test(d)).sort((x, y) => Number(y.split("-")[1]) - Number(x.split("-")[1]));
  } catch {
    dossiers = [];
  }
  const relatifs = {
    win32: ["chrome-win64/chrome.exe", "chrome-win/chrome.exe"],
    darwin: [
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    ],
  }[process.platform] || ["chrome-linux64/chrome", "chrome-linux/chrome"];
  for (const d of dossiers) for (const r of relatifs) if (existe(path.join(racine, d, r))) return { chemin: path.join(racine, d, r), origine: "Chromium de Playwright" };
  return undefined;
}

/** Commande qui lance npx, sans passer par un interpréteur de commandes. */
function commandeNpx(args) {
  if (process.env.PULSE_PERF_LIGHTHOUSE) return { cmd: process.execPath, args: [process.env.PULSE_PERF_LIGHTHOUSE, ...args.slice(2)], shell: false };
  const dossier = path.dirname(process.execPath);
  for (const cli of [path.join(dossier, "node_modules", "npm", "bin", "npx-cli.js"), path.join(dossier, "..", "lib", "node_modules", "npm", "bin", "npx-cli.js")]) {
    if (existe(cli)) return { cmd: process.execPath, args: [cli, ...args], shell: false };
  }
  return { cmd: "npx", args, shell: process.platform === "win32" };
}

function mesurerEnLocal(url, appareil, chrome) {
  const args = [
    "--yes",
    `lighthouse@${LIGHTHOUSE}`,
    url,
    "--output=json",
    "--output-path=stdout",
    "--quiet",
    "--only-categories=performance,accessibility,best-practices,seo",
    "--locale=fr",
    "--chrome-flags=--headless=new",
  ];
  if (appareil === "ordinateur") args.push("--preset=desktop");
  const { cmd, args: a, shell } = commandeNpx(args);
  const env = { ...process.env };
  if (chrome && chrome.chemin) env.CHROME_PATH = chrome.chemin;
  return new Promise((resoudre, rejeter) => {
    const p = spawn(cmd, a, { env, shell, windowsHide: true });
    let sortie = "";
    let erreurs = "";
    const minuteur = setTimeout(() => p.kill(), 240000);
    p.stdout.on("data", (d) => (sortie += d));
    p.stderr.on("data", (d) => (erreurs += d));
    p.on("error", (e) => {
      clearTimeout(minuteur);
      rejeter(new Error(`impossible de lancer Lighthouse (${e.code || e.message})`));
    });
    p.on("close", (code) => {
      clearTimeout(minuteur);
      // Sous Windows, Lighthouse peut finir en erreur en effaçant son profil temporaire : le rapport reste valable.
      try {
        const lhr = JSON.parse(sortie);
        if (lhr && lhr.lighthouseVersion) return resoudre({ lhr, terrainPsi: null });
      } catch {
        /* rapport absent : erreur expliquée ci-dessous */
      }
      const fin = erreurs.trim().split("\n").slice(-3).join(" ").slice(0, 400);
      rejeter(new Error(`Lighthouse a échoué (code ${code})${fin ? ` : ${fin}` : ""}`));
    });
  });
}

// ------------------------------------------------------------------ Arguments

function lireArguments(argv) {
  const opts = { positionnels: [], passages: 3, appareil: "mobile", source: null, json: null, pages: null, historique: false, delai: 4000, prechauffage: 2 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--passages") opts.passages = Number(argv[++i]);
    else if (a === "--appareil") opts.appareil = argv[++i];
    else if (a === "--source") opts.source = argv[++i];
    else if (a === "--json") opts.json = argv[++i];
    else if (a === "--pages") opts.pages = argv[++i];
    else if (a === "--historique") opts.historique = true;
    else if (a === "--delai") opts.delai = Number(argv[++i]);
    else if (a === "--prechauffage") opts.prechauffage = Number(argv[++i]);
    else opts.positionnels.push(a);
  }
  return opts;
}

/** Fin de l'action : le message, puis le code de sortie (la sortie écrite est vidée avant la fin du processus). */
class Sortie extends Error {}
function quitter(code, message) {
  if (message) (code === 0 ? dire : signaler)(message);
  process.exitCode = code;
  throw new Sortie();
}

function ecrireJson(fichier, objet) {
  fs.mkdirSync(path.dirname(path.resolve(fichier)), { recursive: true });
  fs.writeFileSync(fichier, `${JSON.stringify(objet, null, 2)}\n`);
}

const estAdresse = (u) => /^https?:\/\/\S+$/.test(u);
function estLocale(u) {
  try {
    const h = new URL(u).hostname;
    return h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || /^127\./.test(h) || h === "[::1]" || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(h);
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ docs/performance.md

/** Lignes d'un tableau Markdown sous un titre « ## <titre> ». */
function tableauSous(texte, titre) {
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  const debut = lignes.findIndex((l) => new RegExp(`^##\\s+${titre}\\s*$`, "i").test(l.trim()));
  if (debut < 0) return null;
  const rangs = [];
  for (let i = debut + 1; i < lignes.length && !/^##\s/.test(lignes[i]); i++) {
    const l = lignes[i].trim();
    if (!l.startsWith("|") || /^\|[\s:|-]+\|$/.test(l)) continue;
    rangs.push(l.slice(1, l.endsWith("|") ? -1 : undefined).split("|").map((c) => c.trim()));
  }
  return rangs.slice(1); // sans la ligne d'en-tête
}

function cheminsSuivis(texte) {
  const rangs = tableauSous(texte, "Pages suivies") || [];
  return rangs.map((r) => (r[0] || "").replace(/`/g, "").trim()).filter((c) => c.startsWith("/"));
}

const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** « 2,5 s », « 200 ms », « 1,5 Mo », « 0,1 », « 90 » → nombre dans l'unité de la mesure. */
function lireLimite(texte) {
  const m = String(texte).replace(/\s+/g, " ").trim().match(/^(\d+(?:[.,]\d+)?)\s*(ms|s|ko|kio|mo|mio|o)?\b/i);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  const unite = (m[2] || "").toLowerCase();
  return { s: n * 1000, ms: n, ko: n * 1000, kio: n * 1024, mo: n * 1e6, mio: n * 1048576, o: n, "": n }[unite];
}

const MESURES_BUDGET = { lcp: "lcp", cls: "cls", tbt: "tbt", fcp: "fcp", si: "si", speed: "si", ttfb: "ttfb", poids: "poids", requetes: "requetes", score: "score" };

function lireBudget(texte) {
  const rangs = tableauSous(texte, "Budget");
  if (!rangs) return null;
  const regles = [];
  for (const [nom = "", limite = ""] of rangs) {
    const cle = MESURES_BUDGET[sansAccent(nom).match(/[a-z]+/)?.[0] || ""];
    const valeur = lireLimite(limite);
    if (cle && typeof valeur === "number") regles.push({ cle, nom, limite: valeur, sens: cle === "score" ? "min" : "max" });
  }
  return regles;
}

// ------------------------------------------------------------------ Actions

async function prechauffer(url, nombreDeRequetes) {
  let derniere = null;
  for (let i = 0; i < nombreDeRequetes; i++) {
    try {
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000) });
      await r.arrayBuffer();
      derniere = null;
    } catch (e) {
      derniere = (e.cause && e.cause.code) || e.name;
    }
  }
  return derniere;
}

function afficherPage(p) {
  dire(`\n📄 ${p.url}`);
  for (const cle of ["lcp", "cls", "tbt", "fcp", "si", "ttfb"]) {
    const v = p.mediane[cle];
    if (typeof v !== "number") continue;
    const plage = p.passages > 1 ? `  [${valeurLisible(cle, p.min[cle])} – ${valeurLisible(cle, p.max[cle])}]` : "";
    dire(`  ${feu(classer(v, SEUILS[cle]))} ${NOMS[cle]}${cle === "ttfb" ? ", simulé" : ""} : ${valeurLisible(cle, v)}${plage}`);
  }
  if (typeof p.mediane.score === "number") {
    const plage = p.passages > 1 ? `  [${Math.round(p.min.score)} – ${Math.round(p.max.score)}]` : "";
    dire(`  ${feu(classerScore(p.mediane.score))} ${NOMS.score} : ${valeurLisible("score", p.mediane.score)}${plage}`);
  }
  dire(`  Poids : ${octets(p.mediane.poids)} · ${typeof p.mediane.requetes === "number" ? Math.round(p.mediane.requetes) : "—"} requêtes`);
  const s = p.scores;
  dire(`  Accessibilité ${s.accessibilite ?? "—"} · Bonnes pratiques ${s.bonnesPratiques ?? "—"} · SEO technique ${s.seo ?? "—"} (contrôles automatiques seulement)`);
  if (p.elementLcp) dire(`  Contenu principal (élément LCP) : ${p.elementLcp.libelle ? `« ${p.elementLcp.libelle.split("\n")[0].slice(0, 60)} » ` : ""}${p.elementLcp.extrait || p.elementLcp.selecteur}`);
  if (p.diagnostics.length) {
    dire("  Diagnostics (passage médian), du plus grand gain au plus petit :");
    for (const d of p.diagnostics.slice(0, 8)) {
      const gains = Object.entries(d.gains).filter(([, v]) => v > 0).map(([k, v]) => `${k.toUpperCase()} ${k === "cls" ? fr(v, 2) : duree(v)}`);
      dire(`    🔸 ${d.id} – ${d.titre}${d.valeur ? ` – ${d.valeur}` : ""}${gains.length ? ` · gain estimé : ${gains.join(", ")}` : ""}`);
      for (const r of d.ressources.slice(0, 2)) dire(`       ${r}`);
      if (!d.ressources.length) for (const e of d.elements.slice(0, 1)) dire(`       ${e.extrait || e.selecteur}`);
    }
  } else dire("  Aucun diagnostic en échec.");
  if (p.instable.length) {
    const ecarts = p.instable.map((cle) => (cle === "lcp" ? `le LCP varie de ${duree(p.max.lcp - p.min.lcp)}` : `le score varie de ${Math.round(p.max.score - p.min.score)} points`));
    dire(`  ⚠️ Instable : ${ecarts.join(", ")} entre les passages. Ajoutez 2 passages avant de conclure ; si cela persiste, cherchez un contenu qui change d'un chargement à l'autre (image chargée en différé, carrousel, animation).`);
  }
}

async function actionMesurer(opts) {
  if (!opts.positionnels.length) quitter(1, USAGE);
  let urls = opts.positionnels.join(",").split(",").map((u) => u.trim()).filter(Boolean);
  if (opts.pages) {
    let texte;
    try {
      texte = fs.readFileSync(opts.pages, "utf8");
    } catch {
      quitter(1, `❌ Fichier introuvable : ${opts.pages}`);
    }
    const chemins = cheminsSuivis(texte);
    if (!chemins.length) quitter(1, `❌ Aucune page dans la section « Pages suivies » de ${opts.pages}.`);
    urls = chemins.map((c) => new URL(c, urls[0]).href);
  }
  const invalides = urls.filter((u) => !estAdresse(u));
  if (invalides.length) quitter(1, `❌ Adresse invalide : ${invalides.join(", ")} (attendu : http://… ou https://…).\n${USAGE}`);
  if (urls.length > MAX_PAGES) quitter(1, `❌ ${urls.length} pages : ${MAX_PAGES} au plus. Gardez une page par gabarit (3 à 5).`);
  if (!["mobile", "ordinateur"].includes(opts.appareil)) quitter(1, "❌ --appareil : mobile ou ordinateur.");
  const passages = Number.isInteger(opts.passages) && opts.passages >= 1 && opts.passages <= 9 ? opts.passages : null;
  if (!passages) quitter(1, "❌ --passages : un nombre entier de 1 à 9 (3 par défaut, 5 pour un avant/après).");

  const cle = lireCle();
  const locales = urls.filter(estLocale);
  let source = opts.source;
  if (source && !["psi", "local"].includes(source)) quitter(1, "❌ --source : psi ou local.");
  if (!source) source = cle && !locales.length ? "psi" : "local";
  if (source === "psi" && !cle) quitter(2, `❌ ${MESSAGE_SANS_CLE}`);
  if (source === "psi" && locales.length) quitter(2, `❌ PageSpeed Insights mesure depuis les serveurs de Google : il ne peut pas joindre ${locales.join(", ")}. Utilisez --source local.`);

  let chrome = null;
  if (source === "local") {
    if (!versionNodeSuffisante()) quitter(2, `❌ Lighthouse ${LIGHTHOUSE} demande Node.js ${NODE_MIN.join(".")} ou plus ; ce poste a ${process.versions.node}. Installez la version LTS de Node.js, puis relancez.`);
    if (!process.env.PULSE_PERF_LIGHTHOUSE) {
      chrome = trouverChrome();
      if (chrome === undefined) quitter(2, "❌ Aucun navigateur Chrome trouvé pour Lighthouse. Installez Google Chrome, ou lancez « npx playwright install chromium », ou indiquez son chemin dans la variable CHROME_PATH.");
    }
    if (!cle && !opts.source) signaler("ℹ️ Pas de clé Google (PULSE_PSI_CLE) : mesure locale avec Lighthouse sur cette machine.");
  }

  const pages = [];
  const echecs = [];
  let terrainPsi = null;
  for (const url of urls) {
    if (opts.prechauffage > 0) {
      const cause = await prechauffer(url, opts.prechauffage);
      if (cause) {
        echecs.push({ url, cause: `le site ne répond pas (${cause})` });
        signaler(`❌ ${url} : le site ne répond pas (${cause}).`);
        continue;
      }
    }
    const resultats = [];
    let derniereErreur = null;
    for (let n = 1; n <= passages; n++) {
      try {
        const { lhr, terrainPsi: t } = source === "psi" ? await mesurerParPsi(url, opts.appareil, opts.delai) : await mesurerEnLocal(url, opts.appareil, chrome);
        const r = extraire(lhr);
        resultats.push(r);
        if (t && !terrainPsi) terrainPsi = t;
        signaler(`  passage ${n}/${passages} – ${url} : score ${r.score ?? "—"}, LCP ${duree(r.metriques.lcp)}`);
      } catch (e) {
        derniereErreur = e.message;
        signaler(`  passage ${n}/${passages} – ${url} : ❌ ${e.message}`);
        // Une clé refusée ou un quota épuisé ne se corrige pas en relançant : on s'arrête là.
        if (/clé|quota|n'est pas activée|restrictions/i.test(e.message)) break;
      }
    }
    if (resultats.length) pages.push(agreger(resultats));
    else echecs.push({ url, cause: derniereErreur || "aucun passage réussi" });
  }

  const version = (pages[0] && pages[0].version) || null;
  dire("Mesure de la vitesse : simulation (laboratoire), pas vos vrais visiteurs.");
  dire(
    `Source : ${source === "psi" ? "PageSpeed Insights (serveurs de Google)" : "Lighthouse sur cette machine"}${version ? `, Lighthouse ${version}` : ""} · ${
      opts.appareil === "ordinateur" ? "ordinateur, connexion rapide simulée" : "téléphone moyen, 4G lente simulée"
    } · ${passages} passage${passages > 1 ? "s" : ""} par page, médiane.`,
  );
  if (source === "local") dire("Mesure locale : à comparer seulement avec une autre mesure faite sur cette même machine.");
  for (const p of pages) afficherPage(p);
  for (const e of echecs) dire(`\n❌ ${e.url} : ${e.cause}`);
  if (terrainPsi) dire("\nℹ️ PageSpeed Insights a aussi renvoyé des données de vrais visiteurs (gardées à part dans le JSON) : lisez-les avec pulse-aidd perf terrain.");

  const mesure = { format: FORMAT, date: new Date().toISOString(), source, appareil: opts.appareil, passages, lighthouse: version, pages, echecs };
  if (terrainPsi) mesure.terrainPsi = terrainPsi;
  if (opts.json) {
    ecrireJson(opts.json, mesure);
    dire(`\n💾 Mesure enregistrée : ${opts.json}`);
  }
  quitter(pages.length && !echecs.length ? 0 : 1);
}

async function appelerCrux(methode, corps, delai) {
  return appeler(`${baseCrux()}/v1/records:${methode}?key=${encodeURIComponent(lireCle())}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }, { delai, delaiMax: 30000 });
}

function cibleCrux(adresse) {
  const u = new URL(adresse);
  return u.pathname === "/" && !u.search ? { origin: u.origin } : { url: u.href };
}

async function actionTerrain(opts) {
  const adresse = opts.positionnels[0];
  if (!adresse || !estAdresse(adresse)) quitter(1, USAGE);
  if (!lireCle()) quitter(2, `❌ ${MESSAGE_SANS_CLE.replace(" Pour mesurer sans clé : --source local (Lighthouse sur cette machine).", "")}`);
  if (estLocale(adresse)) quitter(1, "❌ Les données de vrais visiteurs concernent un site en ligne : indiquez son adresse publique.");
  const formFactor = opts.appareil === "ordinateur" ? "DESKTOP" : "PHONE";
  const metrics = Object.keys(CRUX);
  let cible = cibleCrux(adresse);
  const methode = opts.historique ? "queryHistoryRecord" : "queryRecord";
  const corps = (c) => ({ ...c, formFactor, metrics, ...(opts.historique ? { collectionPeriodCount: 25 } : {}) });
  let rep = await appelerCrux(methode, corps(cible), opts.delai);
  if (rep.statut === 404 && cible.url) {
    dire(`ℹ️ Pas assez de visiteurs pour la page ${cible.url} seule : lecture de l'ensemble du site.`);
    cible = { origin: new URL(adresse).origin };
    rep = await appelerCrux(methode, corps(cible), opts.delai);
  }
  if (rep.statut === 404) {
    dire(`Pas encore de données de vrais visiteurs pour ${cible.origin || cible.url} (${opts.appareil}).`);
    dire("C'est normal pour un site récent ou peu visité : Google publie ces données seulement au-delà d'un nombre de visites qu'il ne précise pas, et seulement pour les visiteurs de Chrome.");
    dire("En attendant : la simulation (pulse-aidd perf mesurer) et une mesure réelle sur votre site (/pulse:perf suivre).");
    if (opts.json) {
      ecrireJson(opts.json, { format: "pulse-perf-terrain/1", date: new Date().toISOString(), aDesDonnees: false, cible: cible.origin || cible.url });
    }
    quitter(0);
  }
  if (rep.statut !== 200) quitter(1, `❌ ${expliquerErreur("crux", rep)}`);

  if (opts.historique) {
    const h = lireHistorique(rep.corps);
    dire(`Vrais visiteurs (Chrome), ${opts.appareil}, ${h.cible} : 75e centile, semaine par semaine (moyennes glissantes sur 28 jours).`);
    dire(`Périodes : ${h.periodes.length}, de ${h.periodes[0] || "—"} à ${h.periodes[h.periodes.length - 1] || "—"}.`);
    for (const cle of ["lcp", "inp", "cls", "fcp", "ttfb"]) {
      const s = h.series[cle];
      if (!s) continue;
      const connues = s.map((v, i) => ({ v, i })).filter((x) => typeof x.v === "number");
      if (!connues.length) continue;
      const premier = connues[0].v;
      const dernier = connues[connues.length - 1].v;
      const recents = s.slice(-6).map((v) => valeurLisible(cle, v)).join(" · ");
      dire(`  ${feu(classer(dernier, SEUILS[cle]))} ${NOMS[cle]} : ${valeurLisible(cle, premier)} → ${valeurLisible(cle, dernier)} (6 dernières : ${recents})`);
    }
    if (opts.json) {
      ecrireJson(opts.json, { format: "pulse-perf-historique/1", date: new Date().toISOString(), ...h });
    }
    quitter(0);
  }

  const t = lireTerrain(rep.corps);
  dire(`Vrais visiteurs (Chrome), ${t.appareil}, ${t.niveau === "page" ? "cette page" : "tout le site"} : ${t.cible}`);
  dire(`Période : du ${t.periode.debut} au ${t.periode.fin} (28 jours). Valeur retenue : le 75e centile (3 visites sur 4 font au moins aussi bien).`);
  for (const cle of ["lcp", "inp", "cls", "fcp", "ttfb"]) {
    const m = t.metriques[cle];
    if (!m) continue;
    const part = typeof m.partBonne === "number" ? ` · ${Math.round(m.partBonne * 100)} % de visites « bonnes »` : "";
    dire(`  ${feu(m.categorie)} ${NOMS[cle]} : ${valeurLisible(cle, m.p75)}${part}`);
  }
  dire(
    t.reussit === null
      ? "Core Web Vitals : non évaluables (une des trois mesures manque de données)."
      : `Core Web Vitals : ${t.reussit ? "✅ réussis (LCP, INP et CLS bons)" : "❌ pas encore réussis (les trois doivent être bons)"}.`,
  );
  if (opts.json) {
    ecrireJson(opts.json, { format: "pulse-perf-terrain/1", date: new Date().toISOString(), ...t });
  }
  quitter(0);
}

function lireMesure(fichier) {
  let m;
  try {
    m = JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch {
    quitter(1, `❌ Mesure illisible : ${fichier}`);
  }
  if (!m || m.format !== FORMAT || !Array.isArray(m.pages)) quitter(1, `❌ ${fichier} n'est pas une mesure de pulse-aidd perf mesurer (format ${FORMAT}).`);
  return m;
}

// Écart en dessous duquel une différence n'a pas d'effet perceptible, même hors du bruit.
function tolerance(cle, valeurAvant) {
  if (cle === "cls") return 0.01;
  if (cle === "score") return 2;
  if (cle === "requetes") return 1;
  if (cle === "poids") return Math.max(5000, 0.02 * valeurAvant);
  return Math.max(50, 0.05 * valeurAvant); // durées, en millisecondes
}

/** Avant/après d'une mesure : mieux ou moins bien seulement si les plages des deux séries ne se recouvrent pas
 *  et que l'écart des médianes atteint la tolérance ; sinon « bruit ». */
function comparer(avant, apres) {
  const lignes = [];
  const parUrl = new Map(avant.pages.map((p) => [p.url, p]));
  for (const p2 of apres.pages) {
    const p1 = parUrl.get(p2.url);
    if (!p1) continue;
    for (const cle of ["lcp", "cls", "tbt", "fcp", "si", "score", "poids", "requetes"]) {
      const a = { m: p1.mediane[cle], min: p1.min[cle], max: p1.max[cle] };
      const b = { m: p2.mediane[cle], min: p2.min[cle], max: p2.max[cle] };
      if (typeof a.m !== "number" || typeof b.m !== "number") continue;
      const plusHautMieux = cle === "score";
      let verdict = "bruit";
      if (Math.abs(b.m - a.m) >= tolerance(cle, a.m)) {
        if (plusHautMieux ? b.min > a.max : b.max < a.min) verdict = "mieux";
        else if (plusHautMieux ? b.max < a.min : b.min > a.max) verdict = "moins-bien";
      }
      const instable = (p1.instable || []).includes(cle) || (p2.instable || []).includes(cle);
      lignes.push({ url: p2.url, cle, avant: a, apres: b, verdict, instable });
    }
  }
  return lignes;
}

function actionComparer(opts) {
  const [f1, f2] = opts.positionnels;
  if (!f1 || !f2) quitter(1, USAGE);
  const avant = lireMesure(f1);
  const apres = lireMesure(f2);
  if (avant.source !== apres.source || avant.appareil !== apres.appareil) {
    dire(`⚠️ Mesures pas directement comparables : ${avant.source}/${avant.appareil} avant, ${apres.source}/${apres.appareil} après. Refaites la mesure « avant » dans les mêmes conditions si possible.`);
  }
  if (Math.min(avant.passages, apres.passages) < 3) dire("⚠️ Moins de 3 passages d'un côté : la comparaison reste fragile.");
  const lignes = comparer(avant, apres);
  if (!lignes.length) quitter(1, "❌ Aucune page commune aux deux mesures.");
  dire(`Avant (${avant.date.slice(0, 10)}, ${avant.passages} passages) → après (${apres.date.slice(0, 10)}, ${apres.passages} passages). « Dans le bruit » : les deux séries se recouvrent, l'écart peut venir du hasard de la mesure.`);
  let url = null;
  const symbole = { mieux: "✅ mieux", "moins-bien": "🔻 moins bien", bruit: "≈ dans le bruit" };
  for (const l of lignes) {
    if (l.url !== url) dire(`\n📄 ${(url = l.url)}`);
    dire(`  ${NOMS[l.cle]} : ${valeurLisible(l.cle, l.avant.m)} → ${valeurLisible(l.cle, l.apres.m)}  ${symbole[l.verdict]}${l.instable ? " (mesure instable : refaire en 5 passages)" : ""}`);
  }
  quitter(0);
}

/** Règles du budget contre les médianes d'une mesure → dépassements. */
function verifierBudget(mesure, regles) {
  const resultats = [];
  for (const p of mesure.pages) {
    for (const r of regles) {
      const v = p.mediane[r.cle];
      if (typeof v !== "number") continue;
      const depasse = r.sens === "min" ? v < r.limite : v > r.limite;
      resultats.push({ url: p.url, ...r, valeur: v, depasse, instable: p.instable.includes(r.cle) });
    }
  }
  return resultats;
}

function actionBudget(opts) {
  const [fMesure, fDoc] = opts.positionnels;
  if (!fMesure || !fDoc) quitter(1, USAGE);
  const mesure = lireMesure(fMesure);
  let texte;
  try {
    texte = fs.readFileSync(fDoc, "utf8");
  } catch {
    quitter(2, `❌ Fichier introuvable : ${fDoc}`);
  }
  const regles = lireBudget(texte);
  if (!regles || !regles.length) quitter(2, `❌ Aucun budget lisible dans la section « Budget » de ${fDoc} (tableau « | Mesure | Limite | »).`);
  const resultats = verifierBudget(mesure, regles);
  let url = null;
  for (const r of resultats) {
    if (r.url !== url) dire(`\n📄 ${(url = r.url)}`);
    const signe = r.sens === "min" ? "≥" : "≤";
    dire(`  ${r.depasse ? "❌" : "✅"} ${NOMS[r.cle]} : ${valeurLisible(r.cle, r.valeur)} (budget ${signe} ${valeurLisible(r.cle, r.limite)})${r.depasse && r.instable ? " – mesure instable" : ""}`);
  }
  const depasses = resultats.filter((r) => r.depasse).length;
  for (const e of mesure.echecs || []) dire(`\n❌ ${e.url} : non mesurée (${e.cause})`);
  if (depasses || (mesure.echecs || []).length) quitter(1, `\n❌ Budget dépassé : ${depasses} ligne${depasses > 1 ? "s" : ""}${(mesure.echecs || []).length ? ", et des pages non mesurées" : ""}.`);
  quitter(0, "\n✅ Budget respecté sur toutes les pages mesurées.");
}

async function actionCle(opts) {
  if (!lireCle()) quitter(2, `❌ ${MESSAGE_SANS_CLE}`);
  const rep = await appelerCrux("queryRecord", { origin: "https://www.google.com", formFactor: "PHONE", metrics: ["largest_contentful_paint"] }, opts.delai);
  if (rep.statut === 200 || rep.statut === 404) {
    quitter(0, "✅ Clé Google trouvée (PULSE_PSI_CLE) et acceptée par l'API Chrome UX Report. PageSpeed Insights sera vérifié à la première mesure.");
  }
  quitter(1, `❌ Clé Google trouvée, mais : ${expliquerErreur("crux", rep)}`);
}

function actionInstaller() {
  const cible = path.join(process.cwd(), "scripts", "perf.js");
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.copyFileSync(__filename, cible);
  quitter(0, "Installé : scripts/perf.js (mesure de la vitesse pour la CI : node scripts/perf.js mesurer …, puis node scripts/perf.js budget …).");
}

async function principal() {
  const [action, ...reste] = process.argv.slice(2);
  const opts = lireArguments(reste);
  switch (action) {
    case "mesurer":
      return actionMesurer(opts);
    case "terrain":
      return actionTerrain(opts);
    case "comparer":
      return actionComparer(opts);
    case "budget":
      return actionBudget(opts);
    case "cle":
      return actionCle(opts);
    case "installer":
      return actionInstaller();
    default:
      quitter(action ? 1 : 0, USAGE);
  }
}

if (require.main === module) principal().catch(erreurInattendue);

module.exports = { extraire, agreger, mediane, classer, classerScore, lireTerrain, lireHistorique, comparer, lireBudget, verifierBudget, lireLimite, cheminsSuivis, masquer, SEUILS };

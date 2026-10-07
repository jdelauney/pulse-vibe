// Tests de la mesure de vitesse (pulse-aidd perf).
// Lancer : node --test plugins/pulse-vibe/tests/perf.test.js
//
// Fixtures (tests/fixtures/perf/) :
//   - lh13-*.json : extraits réels de rapports Lighthouse 13.5.0 (CLI, 2026-10-07) sur le squelette du pack Next.js
//     servi par « next start » ; « lourde » = une page avec une image de 5,8 Mo sans dimensions, chargée en différé.
//     Seuls les champs lus par perf.js sont gardés, valeurs inchangées.
//   - mesure-avant.json, mesure-apres.json : sorties réelles de « perf.js mesurer --source local --passages 3 »,
//     avant et après la correction de cette image.
//   - psi-*.json, crux-*.json : réponses d'erreur réelles de Google (sans clé, clé invalide).
// Les réponses PageSpeed Insights réussies et CrUX 200 / 404 sont construites d'après la documentation officielle :
// une réponse réelle demande une clé, absente des tests.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const PERF = path.join(__dirname, "..", "scripts", "perf.js");
const FIX = path.join(__dirname, "fixtures", "perf");
const perf = require(PERF);
const fixture = (nom) => JSON.parse(fs.readFileSync(path.join(FIX, nom), "utf8"));
const CLE = "cle-de-test-0123456789";

// Lance perf.js sans bloquer la boucle d'événements (le serveur de test doit pouvoir répondre).
function lancer(args, env = {}, cwd = undefined) {
  return new Promise((resoudre) => {
    const base = { ...process.env };
    delete base.PULSE_PSI_CLE;
    delete base.PULSE_PERF_API;
    delete base.PULSE_PERF_LIGHTHOUSE;
    const p = spawn(process.execPath, [PERF, ...args], { env: { ...base, ...env }, cwd });
    let sortie = "";
    p.stdout.on("data", (d) => (sortie += d));
    p.stderr.on("data", (d) => (sortie += d));
    p.on("close", (code) => resoudre({ code, sortie }));
  });
}

// Serveur local qui joue Google : chaque route répond selon sa suite de réponses (la dernière se répète).
function serveur(routes) {
  const appels = [];
  const compte = {};
  const s = http.createServer((req, res) => {
    let corps = "";
    req.on("data", (d) => (corps += d));
    req.on("end", () => {
      const chemin = req.url.split("?")[0];
      appels.push({ chemin, url: req.url, corps: corps ? JSON.parse(corps) : null });
      const suite = routes[chemin] || [{ statut: 404, json: { error: { code: 404, message: "route inconnue" } } }];
      compte[chemin] = (compte[chemin] || 0) + 1;
      const r = suite[Math.min(compte[chemin] - 1, suite.length - 1)];
      const json = typeof r.json === "function" ? r.json(req.url) : r.json;
      res.writeHead(r.statut, { "Content-Type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  return new Promise((resoudre) => s.listen(0, "127.0.0.1", () => resoudre({ s, base: `http://127.0.0.1:${s.address().port}`, appels })));
}

const PSI = "/pagespeedonline/v5/runPagespeed";
const CRUX = "/v1/records:queryRecord";
const CRUX_HISTO = "/v1/records:queryHistoryRecord";

// Enveloppe PageSpeed Insights (forme de developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed).
const reponsePsi = (lhr) => ({
  id: lhr.requestedUrl,
  lighthouseResult: lhr,
  loadingExperience: {
    id: "https://exemple.fr/",
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2100, category: "FAST" },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5, category: "FAST" },
      INTERACTION_TO_NEXT_PAINT: { percentile: 180, category: "FAST" },
    },
    overall_category: "FAST",
  },
});

// Réponse CrUX (forme de developer.chrome.com/docs/crux/api : p75 du CLS en texte).
const reponseCrux = (cle) => ({
  record: {
    key: { formFactor: "PHONE", ...cle },
    metrics: {
      largest_contentful_paint: { histogram: [{ start: 0, end: 2500, density: 0.81 }, { start: 2500, end: 4000, density: 0.12 }, { start: 4000, density: 0.07 }], percentiles: { p75: 2380 } },
      interaction_to_next_paint: { histogram: [{ start: 0, end: 200, density: 0.7 }, { start: 200, end: 500, density: 0.2 }, { start: 500, density: 0.1 }], percentiles: { p75: 240 } },
      cumulative_layout_shift: { histogram: [{ start: "0.00", end: "0.10", density: 0.9 }, { start: "0.10", end: "0.25", density: 0.06 }, { start: "0.25", density: 0.04 }], percentiles: { p75: "0.05" } },
    },
    collectionPeriod: { firstDate: { year: 2026, month: 9, day: 6 }, lastDate: { year: 2026, month: 10, day: 3 } },
  },
});
const CRUX_404 = { error: { code: 404, message: "chrome ux report data not found", status: "NOT_FOUND" } };

// ------------------------------------------------------------------ Lecture d'un rapport Lighthouse 13 réel

test("extraire : rapport Lighthouse 13 réel, valeurs numériques et diagnostics « insights » en échec", () => {
  const r = perf.extraire(fixture("lh13-lourde-mobile.json"));
  assert.strictEqual(r.version, "13.5.0");
  assert.strictEqual(r.appareil, "mobile");
  assert.strictEqual(r.score, 67);
  assert.deepStrictEqual(r.scores, { performance: 67, accessibilite: 100, bonnesPratiques: 100, seo: 91 });
  assert.ok(Math.abs(r.metriques.lcp - 30907.7) < 1);
  assert.ok(Math.abs(r.metriques.cls - 0.1745) < 0.001);
  assert.strictEqual(typeof r.metriques.ttfb, "number");
  assert.strictEqual(r.poids, 6020183);
  assert.strictEqual(r.requetes, 16);
  // Le plus gros gain d'abord : l'image (LCP ≈ 28 s), avec l'adresse de la ressource.
  assert.strictEqual(r.diagnostics[0].id, "image-delivery-insight");
  assert.strictEqual(r.diagnostics[0].gains.lcp, 27950);
  assert.deepStrictEqual(r.diagnostics[0].ressources, ["http://localhost:3456/photo.png"]);
  const ids = r.diagnostics.map((d) => d.id);
  for (const id of ["cls-culprits-insight", "lcp-discovery-insight", "render-blocking-insight", "unused-javascript", "total-byte-weight"]) assert.ok(ids.includes(id), id);
  // Seulement la catégorie performance, et seulement ce qui échoue.
  assert.ok(!ids.includes("meta-description"));
  assert.ok(!ids.includes("lcp-breakdown-insight") && !ids.includes("document-latency-insight"));
  assert.match(r.elementLcp.extrait, /<img src="\/photo.png"/);
  assert.ok(r.diagnostics.every((d) => d.titre && !/^[a-z-]+$/.test(d.titre)), "titres en français");
});

test("extraire : page saine et mesure ordinateur", () => {
  const accueil = perf.extraire(fixture("lh13-accueil-mobile.json"));
  assert.strictEqual(accueil.score, 97);
  assert.match(accueil.elementLcp.extrait, /^<h1/);
  assert.ok(!accueil.diagnostics.some((d) => d.id === "image-delivery-insight"));
  const ordi = perf.extraire(fixture("lh13-accueil-ordinateur.json"));
  assert.strictEqual(ordi.appareil, "ordinateur");
  assert.strictEqual(ordi.score, 100);
});

test("extraire : rapport illisible ou page non chargée", () => {
  assert.throws(() => perf.extraire({}), /illisible/);
  const lhr = { ...fixture("lh13-accueil-mobile.json"), runtimeError: { code: "NO_FCP", message: "…" } };
  assert.throws(() => perf.extraire(lhr), /NO_FCP/);
});

// ------------------------------------------------------------------ Agrégation

function variante(lhr, lcp, score) {
  const copie = JSON.parse(JSON.stringify(lhr));
  copie.audits["largest-contentful-paint"].numericValue = lcp;
  copie.categories.performance.score = score / 100;
  return perf.extraire(copie);
}

test("médiane sur 3 et 5 passages, passage médian, pas d'instabilité si les passages concordent", () => {
  assert.strictEqual(perf.mediane([3, 1, 2]), 2);
  assert.strictEqual(perf.mediane([4, 1, 3, 2]), 2.5);
  assert.strictEqual(perf.mediane([null, 5]), 5);
  const base = fixture("lh13-accueil-mobile.json");
  const trois = perf.agreger([variante(base, 2600, 97), variante(base, 2800, 95), variante(base, 2650, 96)]);
  assert.strictEqual(trois.passages, 3);
  assert.strictEqual(trois.mediane.lcp, 2650);
  assert.strictEqual(trois.min.lcp, 2600);
  assert.strictEqual(trois.max.lcp, 2800);
  assert.strictEqual(trois.mediane.score, 96);
  assert.deepStrictEqual(trois.instable, []);
  const cinq = perf.agreger([2500, 2700, 2600, 2900, 2550].map((l, i) => variante(base, l, 90 + i)));
  assert.strictEqual(cinq.mediane.lcp, 2600);
  assert.strictEqual(cinq.mediane.score, 92);
  assert.strictEqual(cinq.detail.length, 5);
});

test("instabilité : LCP qui varie de plus d'1 s ou de 30 %, score de plus de 10 points", () => {
  const base = fixture("lh13-lourde-mobile.json");
  // Cas réel : l'image en chargement différé n'est parfois pas comptée (LCP 2,8 s contre 30,9 s).
  const r = perf.agreger([variante(base, 30907, 67), variante(base, 30907, 67), variante(base, 2800, 88)]);
  assert.deepStrictEqual(r.instable.sort(), ["lcp", "score"]);
  const relatif = perf.agreger([variante(base, 1000, 90), variante(base, 1400, 91), variante(base, 1100, 90)]);
  assert.deepStrictEqual(relatif.instable, ["lcp"]);
});

test("classer : seuils officiels, bornes comprises", () => {
  const { classer, classerScore, SEUILS } = perf;
  assert.strictEqual(classer(2500, SEUILS.lcp), "bon");
  assert.strictEqual(classer(2501, SEUILS.lcp), "a-ameliorer");
  assert.strictEqual(classer(4001, SEUILS.lcp), "mauvais");
  assert.strictEqual(classer(0.1, SEUILS.cls), "bon");
  assert.strictEqual(classer(0.26, SEUILS.cls), "mauvais");
  assert.strictEqual(classer(200, SEUILS.inp), "bon");
  assert.strictEqual(classer(null, SEUILS.lcp), null);
  assert.strictEqual(classerScore(90), "bon");
  assert.strictEqual(classerScore(49), "mauvais");
});

// ------------------------------------------------------------------ Terrain

test("lireTerrain : p75 (CLS en texte), part des bonnes visites, Core Web Vitals", () => {
  const t = perf.lireTerrain(reponseCrux({ origin: "https://exemple.fr" }));
  assert.strictEqual(t.aDesDonnees, true);
  assert.strictEqual(t.niveau, "site");
  assert.deepStrictEqual(t.periode, { debut: "2026-09-06", fin: "2026-10-03" });
  assert.strictEqual(t.metriques.cls.p75, 0.05);
  assert.strictEqual(t.metriques.lcp.categorie, "bon");
  assert.strictEqual(t.metriques.inp.categorie, "a-ameliorer");
  assert.strictEqual(t.metriques.lcp.partBonne, 0.81);
  assert.strictEqual(t.reussit, false);
  assert.deepStrictEqual(perf.lireTerrain({}), { aDesDonnees: false });
});

test("lireHistorique : séries hebdomadaires, valeurs manquantes à null", () => {
  const h = perf.lireHistorique({
    record: {
      key: { origin: "https://exemple.fr" },
      metrics: { cumulative_layout_shift: { percentilesTimeseries: { p75s: [null, "0.12", "0.08"] } }, largest_contentful_paint: { percentilesTimeseries: { p75s: [3100, 2900, "NaN"] } } },
      collectionPeriods: [1, 2, 3].map((d) => ({ firstDate: { year: 2026, month: 9, day: d }, lastDate: { year: 2026, month: 10, day: d } })),
    },
  });
  assert.deepStrictEqual(h.series.cls, [null, 0.12, 0.08]);
  assert.deepStrictEqual(h.series.lcp, [3100, 2900, null]);
  assert.strictEqual(h.periodes[2], "2026-10-03");
});

// ------------------------------------------------------------------ Comparer, budget

test("comparer : mesures réelles avant/après, amélioration seulement hors du bruit", () => {
  const lignes = perf.comparer(fixture("mesure-avant.json"), fixture("mesure-apres.json"));
  const ligne = (url, cle) => lignes.find((l) => l.url.endsWith(url) && l.cle === cle);
  assert.strictEqual(ligne("/lourde", "cls").verdict, "mieux");
  assert.strictEqual(ligne("/lourde", "poids").verdict, "mieux");
  // LCP avant instable (2,8 à 30,9 s) : la plage recouvre l'après, pas de conclusion.
  assert.strictEqual(ligne("/lourde", "lcp").verdict, "bruit");
  assert.strictEqual(ligne("/lourde", "lcp").instable, true);
  // Accueil inchangé : tout dans le bruit, même un écart d'1 ms hors des plages.
  assert.ok(lignes.filter((l) => l.url.endsWith("3456/")).every((l) => l.verdict === "bruit"));
});

test("lireLimite et lireBudget : unités françaises, sens du score", () => {
  assert.strictEqual(perf.lireLimite("2,5 s"), 2500);
  assert.strictEqual(perf.lireLimite("200 ms"), 200);
  assert.strictEqual(perf.lireLimite("1,5 Mo"), 1500000);
  assert.strictEqual(perf.lireLimite("0,1"), 0.1);
  assert.strictEqual(perf.lireLimite("—"), null);
  const regles = perf.lireBudget("# P\n\n## Budget\n\n| Mesure | Limite |\n|---|---|\n| LCP (simulation) | 2,5 s |\n| Score de performance | 90 |\n| Poids de la page | 1 Mo |\n| Requêtes | — |\n\n## Historique\n| LCP | 1 s |\n");
  assert.deepStrictEqual(regles.map((r) => [r.cle, r.limite, r.sens]), [["lcp", 2500, "max"], ["score", 90, "min"], ["poids", 1000000, "max"]]);
  assert.strictEqual(perf.lireBudget("# Sans budget"), null);
});

test("le modèle docs/performance.md se lit tel quel : pages suivies et budget", () => {
  const modele = fs.readFileSync(path.join(__dirname, "..", "templates", "performance.md"), "utf8");
  assert.deepStrictEqual(perf.cheminsSuivis(modele), ["/"]);
  assert.deepStrictEqual(perf.lireBudget(modele).map((r) => r.cle), ["lcp", "cls", "tbt", "score"]);
});

const DOC_BUDGET = (lcp) => `# Performance\n\n## Pages suivies\n\n| Page | Gabarit | Pourquoi |\n|---|---|---|\n| \`/\` | accueil | première impression |\n| \`/lourde\` | détail | photo |\n\n## Budget\n\n| Mesure | Limite |\n|---|---|\n| LCP | ${lcp} |\n| CLS | 0,1 |\n| Poids | 2 Mo |\n`;

test("budget : code 1 et lignes dépassées ; code 0 si tout est dans le budget", async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "perf-"));
  const doc = path.join(dossier, "performance.md");
  fs.writeFileSync(doc, DOC_BUDGET("2,5 s"));
  const r = await lancer(["budget", path.join(FIX, "mesure-avant.json"), doc]);
  assert.strictEqual(r.code, 1, r.sortie);
  assert.match(r.sortie, /❌ Affichage du contenu principal \(LCP\) : 30,9 s \(budget ≤ 2,5 s\) – mesure instable/);
  assert.match(r.sortie, /❌ Poids de la page : 6,0 Mo/);
  assert.match(r.sortie, /Budget dépassé/);
  fs.writeFileSync(doc, DOC_BUDGET("4 s"));
  const ok = await lancer(["budget", path.join(FIX, "mesure-apres.json"), doc]);
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /✅ Budget respecté/);
  fs.writeFileSync(doc, "# Performance\n");
  assert.strictEqual((await lancer(["budget", path.join(FIX, "mesure-apres.json"), doc])).code, 2);
});

test("comparer (commande) : mesures réelles, verdicts lisibles", async () => {
  const r = await lancer(["comparer", path.join(FIX, "mesure-avant.json"), path.join(FIX, "mesure-apres.json")]);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.sortie, /Stabilité de la page \(CLS\) : 0,17 → 0,00 {2}✅ mieux/);
  assert.match(r.sortie, /30,9 s → 3,6 s {2}≈ dans le bruit \(mesure instable/);
});

// ------------------------------------------------------------------ PageSpeed Insights (serveur de test)

test("mesurer sans clé avec --source psi : code 2 et la marche à suivre", async () => {
  const r = await lancer(["mesurer", "https://exemple.fr/", "--source", "psi"]);
  assert.strictEqual(r.code, 2);
  assert.match(r.sortie, /PULSE_PSI_CLE/);
  assert.match(r.sortie, /--source local/);
});

test("PageSpeed Insights ne peut pas joindre une adresse locale : code 2", async () => {
  const r = await lancer(["mesurer", "http://localhost:3000/", "--source", "psi"], { PULSE_PSI_CLE: CLE });
  assert.strictEqual(r.code, 2);
  assert.match(r.sortie, /--source local/);
  assert.ok(!r.sortie.includes(CLE));
});

test("PSI : 429 puis 200 → nouvel essai réussi ; la clé n'apparaît ni dans la sortie ni dans le JSON", async () => {
  const lhr = fixture("lh13-accueil-mobile.json");
  const { s, base, appels } = await serveur({ [PSI]: [{ statut: 429, json: fixture("psi-429-sans-cle.json") }, { statut: 200, json: reponsePsi(lhr) }] });
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "perf-"));
  const json = path.join(dossier, "mesures", "2026-10-07.json");
  const r = await lancer(["mesurer", "https://exemple.fr/", "--passages", "2", "--prechauffage", "0", "--delai", "10", "--json", json], { PULSE_PSI_CLE: CLE, PULSE_PERF_API: base });
  s.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(appels.length, 3);
  const params = new URL(appels[0].url, base).searchParams;
  assert.strictEqual(params.get("key"), CLE);
  assert.strictEqual(params.get("strategy"), "mobile");
  assert.strictEqual(params.get("locale"), "fr");
  assert.deepStrictEqual(params.getAll("category"), ["performance", "accessibility", "best-practices", "seo"]);
  assert.match(r.sortie, /PageSpeed Insights/);
  assert.match(r.sortie, /simulation \(laboratoire\), pas vos vrais visiteurs/);
  const ecrit = fs.readFileSync(json, "utf8");
  const mesure = JSON.parse(ecrit);
  assert.strictEqual(mesure.format, "pulse-perf-mesure/1");
  assert.strictEqual(mesure.source, "psi");
  assert.strictEqual(mesure.pages[0].passages, 2);
  assert.strictEqual(mesure.terrainPsi.page.metriques.cls.p75, 0.05);
  assert.ok(!r.sortie.includes(CLE) && !ecrit.includes(CLE));
});

test("PSI : 429 répétés → message de quota clair, sans relancer les passages suivants", async () => {
  const { s, base, appels } = await serveur({ [PSI]: [{ statut: 429, json: fixture("psi-429-sans-cle.json") }] });
  const r = await lancer(["mesurer", "https://exemple.fr/", "--passages", "3", "--prechauffage", "0", "--delai", "10"], { PULSE_PSI_CLE: CLE, PULSE_PERF_API: base });
  s.close();
  assert.strictEqual(r.code, 1);
  assert.strictEqual(appels.length, 3, "3 essais pour le premier passage, puis arrêt");
  assert.match(r.sortie, /Quota de Google dépassé/);
});

test("PSI : clé invalide (400) → pas de nouvel essai, message clair, clé masquée même si l'erreur la répète", async () => {
  const erreur = fixture("psi-400-cle-invalide.json");
  const { s, base, appels } = await serveur({ [PSI]: [{ statut: 400, json: (url) => ({ error: { ...erreur.error, message: `${erreur.error.message} (requête : ${url})` } }) }] });
  const r = await lancer(["mesurer", "https://exemple.fr/", "--prechauffage", "0", "--delai", "10"], { PULSE_PSI_CLE: CLE, PULSE_PERF_API: base });
  s.close();
  assert.strictEqual(r.code, 1);
  assert.strictEqual(appels.length, 1);
  assert.match(r.sortie, /clé Google est refusée/);
  assert.ok(!r.sortie.includes(CLE), r.sortie);
});

test("mesurer --pages : les pages suivies de docs/performance.md, sur l'adresse donnée", async () => {
  const { s, base, appels } = await serveur({ [PSI]: [{ statut: 200, json: reponsePsi(fixture("lh13-accueil-mobile.json")) }] });
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "perf-"));
  const doc = path.join(dossier, "performance.md");
  fs.writeFileSync(doc, DOC_BUDGET("2,5 s"));
  const r = await lancer(["mesurer", "https://exemple.fr", "--pages", doc, "--passages", "1", "--prechauffage", "0", "--appareil", "ordinateur"], { PULSE_PSI_CLE: CLE, PULSE_PERF_API: base });
  s.close();
  assert.strictEqual(r.code, 0, r.sortie);
  const demandees = appels.map((a) => new URL(a.url, base).searchParams.get("url"));
  assert.deepStrictEqual(demandees, ["https://exemple.fr/", "https://exemple.fr/lourde"]);
  assert.strictEqual(new URL(appels[0].url, base).searchParams.get("strategy"), "desktop");
});

test("arguments invalides : usage et code 1", async () => {
  for (const args of [["mesurer"], ["mesurer", "pas-une-adresse"], ["mesurer", "https://a.fr/", "--passages", "0"], ["mesurer", Array.from({ length: 9 }, (_, i) => `https://a.fr/${i}`).join(",")]]) {
    const r = await lancer(args);
    assert.strictEqual(r.code, 1, args.join(" "));
  }
  assert.strictEqual((await lancer(["inconnue"])).code, 1);
});

// ------------------------------------------------------------------ Lighthouse local (remplacé par un script de test)

test("source locale : passages en série, médiane, instabilité signalée, sans clé", async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "perf-"));
  const compteur = path.join(dossier, "n");
  const faux = path.join(dossier, "faux-lighthouse.js");
  // Rend le rapport réel de la page lourde, avec un LCP différent au 3e passage (comme observé en vrai).
  fs.writeFileSync(
    faux,
    `const fs=require("fs");const n=fs.existsSync(${JSON.stringify(compteur)})?Number(fs.readFileSync(${JSON.stringify(compteur)},"utf8")):0;fs.writeFileSync(${JSON.stringify(compteur)},String(n+1));
const l=JSON.parse(fs.readFileSync(${JSON.stringify(path.join(FIX, "lh13-lourde-mobile.json"))},"utf8"));
if(!process.argv.includes("--locale=fr")||!process.argv.includes("--output-path=stdout"))process.exit(3);
if(n===2){l.audits["largest-contentful-paint"].numericValue=2800;l.categories.performance.score=0.88;}
process.stdout.write(JSON.stringify(l));`,
  );
  const r = await lancer(["mesurer", "http://localhost:3456/lourde", "--prechauffage", "0"], { PULSE_PERF_LIGHTHOUSE: faux });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.sortie, /Pas de clé Google/);
  assert.match(r.sortie, /Lighthouse sur cette machine, Lighthouse 13\.5\.0/);
  assert.match(r.sortie, /🔴 Affichage du contenu principal \(LCP\) : 30,9 s {2}\[2,8 s – 30,9 s\]/);
  assert.match(r.sortie, /⚠️ Instable : le LCP varie de 28,1 s, le score varie de 21 points/);
  assert.match(r.sortie, /image-delivery-insight/);
  assert.strictEqual(fs.readFileSync(compteur, "utf8"), "3");
});

test("source locale : Lighthouse en échec → cause affichée, code 1", async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "perf-"));
  const faux = path.join(dossier, "faux.js");
  fs.writeFileSync(faux, 'process.stderr.write("Runtime error encountered: CHROME_NOT_FOUND");process.exit(1);');
  const r = await lancer(["mesurer", "http://localhost:3456/", "--prechauffage", "0", "--passages", "1"], { PULSE_PERF_LIGHTHOUSE: faux });
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /Lighthouse a échoué.*CHROME_NOT_FOUND/);
});

test("préchauffage : site qui ne répond pas → code 1, sans lancer de mesure", async () => {
  const r = await lancer(["mesurer", "http://127.0.0.1:1/", "--source", "local"], { PULSE_PERF_LIGHTHOUSE: "inexistant.js" });
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /le site ne répond pas/);
});

// ------------------------------------------------------------------ Terrain (CrUX, serveur de test)

test("terrain : 404 → « pas encore de données », expliqué, code 0", async () => {
  const { s, base, appels } = await serveur({ [CRUX]: [{ statut: 404, json: CRUX_404 }] });
  const r = await lancer(["terrain", "https://exemple.fr/"], { PULSE_PSI_CLE: CLE, PULSE_PERF_API: base });
  s.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.sortie, /Pas encore de données de vrais visiteurs/);
  assert.match(r.sortie, /C'est normal/);
  assert.deepStrictEqual(appels[0].corps.origin, "https://exemple.fr");
  assert.strictEqual(appels[0].corps.formFactor, "PHONE");
});

test("terrain : page sans données → repli sur le site, p75 lus", async () => {
  const { s, base, appels } = await serveur({ [CRUX]: [{ statut: 404, json: CRUX_404 }, { statut: 200, json: reponseCrux({ origin: "https://exemple.fr" }) }] });
  const r = await lancer(["terrain", "https://exemple.fr/tarifs"], { PULSE_PSI_CLE: CLE, PULSE_PERF_API: base });
  s.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(appels[0].corps.url, "https://exemple.fr/tarifs");
  assert.strictEqual(appels[1].corps.origin, "https://exemple.fr");
  assert.match(r.sortie, /lecture de l'ensemble du site/);
  assert.match(r.sortie, /🟢 Affichage du contenu principal \(LCP\) : 2,4 s · 81 % de visites « bonnes »/);
  assert.match(r.sortie, /🟠 Réaction aux clics \(INP\) : 240 ms/);
  assert.match(r.sortie, /pas encore réussis/);
  assert.ok(!r.sortie.includes(CLE));
});

test("terrain --historique : tendance semaine par semaine", async () => {
  const histo = {
    record: {
      key: { origin: "https://exemple.fr" },
      metrics: { largest_contentful_paint: { percentilesTimeseries: { p75s: [3200, null, 2600, 2400] } } },
      collectionPeriods: [1, 8, 15, 22].map((d) => ({ firstDate: { year: 2026, month: 8, day: d }, lastDate: { year: 2026, month: 9, day: d } })),
    },
  };
  const { s, base, appels } = await serveur({ [CRUX_HISTO]: [{ statut: 200, json: histo }] });
  const r = await lancer(["terrain", "https://exemple.fr", "--historique"], { PULSE_PSI_CLE: CLE, PULSE_PERF_API: base });
  s.close();
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(appels[0].corps.collectionPeriodCount, 25);
  assert.match(r.sortie, /3,2 s → 2,4 s/);
});

test("terrain sans clé : code 2 ; clé invalide (réponse réelle) : message clair", async () => {
  assert.strictEqual((await lancer(["terrain", "https://exemple.fr/"])).code, 2);
  const { s, base } = await serveur({ [CRUX]: [{ statut: 400, json: fixture("crux-400-cle-invalide.json") }] });
  const r = await lancer(["terrain", "https://exemple.fr/"], { PULSE_PSI_CLE: CLE, PULSE_PERF_API: base });
  s.close();
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /clé Google est refusée/);
});

test("cle : présente et acceptée, ou API non activée, sans jamais l'afficher", async () => {
  const { s, base } = await serveur({ [CRUX]: [{ statut: 200, json: reponseCrux({ origin: "https://www.google.com" }) }] });
  const ok = await lancer(["cle"], { PULSE_PSI_CLE: CLE, PULSE_PERF_API: base });
  s.close();
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /✅ Clé Google trouvée/);
  const desactivee = { error: { code: 403, message: "Chrome UX Report API has not been used in project 123 before or it is disabled.", status: "PERMISSION_DENIED", details: [{ reason: "SERVICE_DISABLED" }] } };
  const s2 = await serveur({ [CRUX]: [{ statut: 403, json: desactivee }] });
  const ko = await lancer(["cle"], { PULSE_PSI_CLE: CLE, PULSE_PERF_API: s2.base });
  s2.s.close();
  assert.strictEqual(ko.code, 1);
  assert.match(ko.sortie, /n'est pas activée/);
  assert.ok(!ok.sortie.includes(CLE) && !ko.sortie.includes(CLE));
  assert.strictEqual((await lancer(["cle"])).code, 2);
});

test("masquer : la clé et tout paramètre key= sont remplacés", () => {
  process.env.PULSE_PSI_CLE = CLE;
  try {
    assert.strictEqual(perf.masquer(`a ${CLE} b ?key=autre&x=1`), "a ••• b ?key=•••&x=1");
  } finally {
    delete process.env.PULSE_PSI_CLE;
  }
});

test("installer : copie le script dans scripts/perf.js du projet (pour la CI)", async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "perf-"));
  const r = await lancer(["installer"], {}, dossier);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(fs.readFileSync(path.join(dossier, "scripts", "perf.js"), "utf8"), fs.readFileSync(PERF, "utf8"));
});

#!/usr/bin/env node
// Pulse – audit de référencement du site servi (`pulse-aidd seo`, /pulse:seo et /pulse:deploy).
//
//   pulse-aidd seo <adresse> [--pages 30] [--essentiel] [--ia] [--json] [--chemins /a,/b]
//                  [--privees /compte,/admin] [--previsualisation] [--prive] [--politique A|B|C|D]
//                  [--fiche docs/seo.md] [--delai 150]
//   pulse-aidd seo robots <A|B|C|D> [--sitemap <adresse>] [--fermes /api/] [--signal "…"] [--bloquer-amazonbot]
//                  affiche robots.txt pour une politique des robots IA (piles sans pack)
//
//   --pages N           pages lues au plus (30 par défaut, 200 au plus)
//   --essentiel         garde-fou de mise en ligne : noindex, Disallow: /, localhost, 404, pages privées
//   --ia                ajoute les contrôles des assistants IA (politique des robots, lecture sans JavaScript)
//   --json              rapport en JSON
//   --chemins           pages publiques à lire en plus (ex. liste du pack : pulse-aidd pile seo-code --pages)
//   --privees           pages qui exigent la connexion : elles doivent refuser un visiteur inconnu
//   --previsualisation  l'adresse est une prévisualisation : noindex attendu
//   --prive             site privé (outil interne) : noindex attendu partout
//   --politique         politique des robots IA (sinon : bloc pulse-seo de docs/seo.md)
//
// Lit le HTML servi (sans exécuter JavaScript), comme un robot : d'abord avec l'agent Pulse-SEO,
// puis avec les agents Googlebot, facebookexternalhit et ceux des assistants IA (--ia).
// Exploration limitée au même site, une requête à la fois, avec un délai entre deux requêtes.
// Aucune requête vers les pages de résultats de Google.
// Code de sortie : 0 sans constat Critique, 1 avec au moins un constat Critique, 2 si l'appel est invalide.
"use strict";

const fs = require("fs");
const path = require("path");
const { analyserHtml, lireSitemap } = require("./seo-html");
const R = require("./seo-regles");
const { analyser } = require("./robots");

const USAGE =
  "Usage : pulse-aidd seo <adresse> [--pages 30] [--essentiel] [--ia] [--json] [--chemins /a,/b] [--privees /compte] [--previsualisation] [--prive] [--politique A|B|C|D] [--fiche docs/seo.md] [--delai 150]";

const AGENT_PULSE = "Mozilla/5.0 (compatible; Pulse-SEO/1.0; +https://github.com/jdelauney/pulse-vibe)";
const AGENT_GOOGLEBOT =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const AGENT_PARTAGE = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const AGENTS_IA = [
  { jeton: "OAI-SearchBot", agent: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot" },
  { jeton: "Claude-SearchBot", agent: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)" },
  { jeton: "PerplexityBot", agent: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
];
const FICHIER_ROBOTS_IA = path.join(__dirname, "..", "references", "seo", "robots-ia.json");
const EXTENSION_FICHIER = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|css|js|mjs|json|xml|txt|zip|mp4|mp3|webm|woff2?)$/i;

/**
 * Un chemin du site : "/compte", "compte" ou une adresse complète. Sous Windows, Git Bash transforme
 * "/compte" en "C:/Program Files/Git/compte" avant de lancer Node : on retrouve alors le chemin d'origine.
 */
function cheminDuSite(valeur) {
  const v = String(valeur).trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(v)) return v;
  const msys = v.match(/^[A-Za-z]:\/(?:.*?\/)?Git\/(.*)$/i);
  if (msys) return `/${msys[1]}`;
  return v.startsWith("/") ? v : `/${v}`;
}

function lireArguments(argv) {
  const opts = { adresse: null, pages: 30, essentiel: false, ia: false, json: false, chemins: [], privees: [], previsualisation: false, prive: false, politique: null, fiche: "docs/seo.md", delai: 150 };
  const liste = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean).map(cheminDuSite);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pages") opts.pages = Number(argv[++i]);
    else if (a === "--essentiel") opts.essentiel = true;
    else if (a === "--ia") opts.ia = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--chemins") opts.chemins = liste(argv[++i]);
    else if (a === "--privees") opts.privees = liste(argv[++i]);
    else if (a === "--previsualisation") opts.previsualisation = true;
    else if (a === "--prive") opts.prive = true;
    else if (a === "--politique") opts.politique = String(argv[++i] || "").toUpperCase();
    else if (a === "--fiche") opts.fiche = argv[++i];
    else if (a === "--delai") opts.delai = Number(argv[++i]);
    else if (!a.startsWith("--") && opts.adresse === null) opts.adresse = a;
    else throw new Error(`Option inconnue : ${a}`);
  }
  if (!opts.adresse || !/^https?:\/\/\S+$/i.test(opts.adresse)) throw new Error("Adresse absente ou invalide (elle commence par http:// ou https://).");
  if (!Number.isInteger(opts.pages) || opts.pages < 1) opts.pages = 30;
  opts.pages = Math.min(opts.pages, 200);
  if (!Number.isFinite(opts.delai) || opts.delai < 0) opts.delai = 150;
  if (opts.politique && !["A", "B", "C", "D"].includes(opts.politique)) throw new Error("--politique : A, B, C ou D.");
  return opts;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const cause = (e) => (e && e.cause && e.cause.code) || (e && e.name === "TimeoutError" ? "délai dépassé" : (e && e.message) || String(e));

/** Client HTTP poli : une requête à la fois, un délai entre deux requêtes, redirections suivies à la main (pour les compter). */
function creerClient(delai) {
  let derniere = 0;
  let total = 0;
  async function requete(url, agent, methode) {
    const reste = derniere + delai - Date.now();
    if (reste > 0) await attendre(reste);
    derniere = Date.now();
    total++;
    return fetch(url, {
      method: methode,
      redirect: "manual",
      headers: { "user-agent": agent, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-language": "fr,en;q=0.8" },
      signal: AbortSignal.timeout(15000),
    });
  }
  /** Rend { url (finale), demandee, statut, entetes, type, tampon, chaine, boucle, erreur }. */
  async function lire(url, { agent = AGENT_PULSE, methode = "GET", suivre = true } = {}) {
    const chaine = [];
    const vus = new Set();
    let courant = url;
    for (let saut = 0; saut <= 10; saut++) {
      let r;
      try {
        r = await requete(courant, agent, methode);
      } catch (e) {
        return { url: courant, demandee: url, chaine, erreur: cause(e) };
      }
      const location = r.headers.get("location");
      if (suivre && [301, 302, 303, 307, 308].includes(r.status) && location) {
        const suivant = new URL(location, courant).href;
        chaine.push({ url: courant, statut: r.status });
        if (r.body) await r.body.cancel().catch(() => {});
        vus.add(courant);
        if (vus.has(suivant)) return { url: suivant, demandee: url, chaine: [...chaine, { url: suivant, statut: 0 }], boucle: true, statut: r.status };
        courant = suivant;
        continue;
      }
      const tampon = methode === "HEAD" ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
      return { url: courant, demandee: url, statut: r.status, entetes: Object.fromEntries(r.headers), type: r.headers.get("content-type") || "", tampon, chaine, location };
    }
    return { url: courant, demandee: url, chaine, boucle: true, erreur: "plus de 10 redirections" };
  }
  return { lire, total: () => total };
}

/** Une réponse transformée en « page » pour les règles. */
function enPage(rep, origine) {
  const page = { url: rep.url, demandee: rep.demandee, origine, statut: rep.statut, entetes: rep.entetes || {}, chaine: rep.chaine || [], boucle: !!rep.boucle, erreur: rep.erreur || null, html: null };
  if (!rep.erreur && rep.tampon && /html/i.test(rep.type || "")) page.html = analyserHtml(rep.tampon.toString("utf8"));
  return page;
}

function lireFicheProjet(chemin) {
  try {
    return R.lireFiche(fs.readFileSync(path.resolve(chemin), "utf8"));
  } catch {
    return R.lireFiche("");
  }
}

async function auditer(opts) {
  const client = creerClient(opts.delai);
  const fiche = lireFicheProjet(opts.fiche);
  const politique = opts.politique || fiche.politique;
  const constats = [];
  const controles = new Set();
  const faire = (...codes) => codes.forEach((x) => controles.add(x));
  const ajouter = (liste) => constats.push(...liste);

  // L1 – l'accueil
  const repAccueil = await client.lire(opts.adresse);
  const finale = repAccueil.erreur ? new URL(opts.adresse) : new URL(repAccueil.url);
  const ctx = {
    origine: finale.origin,
    local: R.estHoteLocal(finale.hostname),
    prive: opts.prive || fiche.site === "prive" || politique === "D",
    previsualisation: opts.previsualisation,
    maintenant: new Date(),
  };
  const accueil = enPage(repAccueil, "accueil");
  faire("L1", "L3");
  ajouter(R.reglesAccueil(accueil, ctx));
  const rapport = { adresse: opts.adresse, origine: ctx.origine, date: ctx.maintenant.toISOString(), mode: opts.essentiel ? "essentiel" : "complet", ia: opts.ia, politique: politique || null, local: ctx.local, prive: ctx.prive, previsualisation: ctx.previsualisation, pages: [], constats, controles: [] };
  if (accueil.erreur || accueil.statut !== 200) return terminer(rapport, controles, client);

  // L2 – variantes http et www (site en ligne seulement)
  if (!opts.essentiel && !ctx.local && !/^\d+\.\d+\.\d+\.\d+$/.test(finale.hostname)) {
    faire("L2");
    const variantes = [];
    if (finale.protocol === "https:") variantes.push(`http://${finale.host}/`);
    const hote = finale.hostname;
    if (hote.split(".").length >= 2 && !/\.(vercel\.app|netlify\.app|pages\.dev|github\.io|onrender\.com|fly\.dev)$/i.test(hote)) {
      const autre = hote.startsWith("www.") ? hote.slice(4) : `www.${hote}`;
      variantes.push(`${finale.protocol}//${autre}${finale.port ? `:${finale.port}` : ""}/`);
    }
    const lues = [];
    for (const v of variantes) {
      const rep = await client.lire(v, { suivre: false });
      const html = !rep.erreur && rep.statut === 200 && /html/i.test(rep.type) ? analyserHtml(rep.tampon.toString("utf8")) : null;
      const canonique = html ? (html.liens.find((l) => l.rel.includes("canonical")) || {}).href : null;
      lues.push({ url: v, statut: rep.statut, location: rep.location, erreur: rep.erreur, canonique });
    }
    ajouter(R.reglesVariantes(lues, ctx));
  }

  // L5 – robots.txt
  faire("L5");
  const repRobots = await client.lire(new URL("/robots.txt", ctx.origine).href);
  const robotsInfo = { statut: repRobots.statut, erreur: repRobots.erreur, texte: repRobots.tampon ? repRobots.tampon.toString("utf8") : "" };
  const ressources = accueil.html
    ? [...accueil.html.liens.filter((l) => l.rel.includes("stylesheet") && l.href).map((l) => l.href)]
        .map((h) => R.normaliser(h, accueil.url))
        .filter((u) => u && new URL(u).origin === ctx.origine)
        .map((u) => new URL(u).pathname)
    : [];
  robotsInfo.ressources = ressources;
  ajouter(R.reglesRobots(robotsInfo, ctx));

  // L8 – adresse inconnue
  faire("L8");
  const introuvable = await client.lire(new URL(`/pulse-seo-introuvable-${Math.random().toString(36).slice(2, 10)}`, ctx.origine).href, { suivre: false });
  ajouter(R.regleSoft404(enPage(introuvable, "test")));

  // Sitemap
  const lignesSitemap = repRobots.statut === 200 ? analyser(robotsInfo.texte).sitemaps.filter((s) => /^https?:\/\//i.test(s)) : [];
  const adressesSitemap = (lignesSitemap.length ? lignesSitemap.slice(0, 3) : [new URL("/sitemap.xml", ctx.origine).href]).map((s) => R.rapprocher(s, ctx) || s);
  let sitemap = null;
  const urlsSitemap = [];
  for (const adresse of adressesSitemap) {
    const rep = await client.lire(adresse);
    const lecture = rep.erreur || rep.statut !== 200 ? null : lireSitemap(rep.tampon.toString("utf8"));
    sitemap = sitemap || { url: adresse, statut: rep.statut, erreur: rep.erreur, lecture };
    if (!lecture) continue;
    if (lecture.estIndex) {
      for (const enfant of lecture.urls.slice(0, 5)) {
        const repEnfant = await client.lire(R.rapprocher(enfant.loc, ctx) || enfant.loc);
        if (!repEnfant.erreur && repEnfant.statut === 200) {
          const l = lireSitemap(repEnfant.tampon.toString("utf8"));
          urlsSitemap.push(...l.urls);
          if (sitemap.lecture === lecture) sitemap.lecture = { ...l, erreurs: [...lecture.erreurs, ...l.erreurs] };
        }
      }
    } else urlsSitemap.push(...lecture.urls);
  }
  if (sitemap && sitemap.lecture) sitemap.lecture = { ...sitemap.lecture, urls: urlsSitemap };

  // Pages à lire : accueil, chemins demandés, sitemap, puis liens trouvés
  const lues = new Map();
  const cle = (u) => R.normaliser(u, ctx.origine);
  lues.set(cle(accueil.url), accueil);
  const file = [];
  const prevoir = (u, origine) => {
    const n = R.rapprocher(u, ctx);
    if (!n || new URL(n).origin !== ctx.origine || EXTENSION_FICHIER.test(new URL(n).pathname)) return;
    if (lues.has(n) || file.some((x) => x.url === n)) return;
    file.push({ url: n, origine });
  };
  for (const ch of opts.chemins) prevoir(new URL(ch, ctx.origine).href, "chemin");
  const depuisSitemap = urlsSitemap.filter((u) => /^https?:\/\//i.test(u.loc) && ["meme", "local"].includes(R.relationAdresse(u.loc, ctx)));
  for (const u of opts.essentiel ? depuisSitemap.slice(0, 5) : depuisSitemap) prevoir(u.loc, "sitemap");
  const suivreLiens = (page) => {
    if (opts.essentiel || !page.html) return;
    for (const a of page.html.ancres) if (a.href && !/^(mailto|tel|javascript):/i.test(a.href)) prevoir(new URL(a.href, page.url).href, "lien");
  };
  suivreLiens(accueil);
  while (file.length && lues.size < opts.pages) {
    const { url, origine } = file.shift();
    const page = enPage(await client.lire(url), origine);
    lues.set(cle(url), page);
    suivreLiens(page);
  }
  const pages = [...lues.values()];
  rapport.pages = pages.map((p) => ({ url: p.url, origine: p.origine, statut: p.statut || null, erreur: p.erreur || undefined }));

  // Règles par page et entre pages
  faire("L4", "L11");
  if (!opts.essentiel) faire("L9", "L10", "L12", "L13", "L14", "L15", "L17", "L18", "L20", "L21", "L23", "L24", "L27");
  for (const p of pages) {
    if (p.origine !== "accueil" && !opts.essentiel) ajouter(R.reglesRedirections(p, ctx));
    if (p.statut === 200 && p.html) ajouter(R.reglesPage(p, ctx));
  }
  if (!opts.essentiel) ajouter(R.reglesSite(pages, ctx));

  // L6, L7 – sitemap
  if (!opts.essentiel && sitemap) {
    faire("L6");
    if (sitemap.lecture) faire("L7");
    const cles = new Set(depuisSitemap.map((u) => R.rapprocher(u.loc, ctx)));
    ajouter(R.reglesSitemap(sitemap, pages.filter((p) => cles.has(cle(p.demandee || p.url))), ctx));
  }

  // L25 – pages privées
  const privees = [...new Set([...opts.privees, ...fiche.privees])];
  if (privees.length) {
    faire("L25");
    for (const ch of privees) ajouter(R.reglePrivee(enPage(await client.lire(new URL(ch, ctx.origine).href, { suivre: false }), "privee")));
  }

  // L26 – prévisualisation
  if (ctx.previsualisation) {
    faire("L26");
    ajouter(R.reglePrevisualisation(accueil));
  }

  if (!opts.essentiel) {
    // L27 – ce que reçoit Googlebot (5 pages au plus)
    for (const p of pages.filter((x) => x.html && x.statut === 200).slice(0, 5)) {
      const rep = await client.lire(p.url, { agent: AGENT_GOOGLEBOT });
      if (!rep.erreur && rep.statut === 200) ajouter(R.regleGooglebot(enPage(rep, p.origine)));
    }
    // L19 – robots de partage
    faire("L19");
    ajouter(R.reglePartageRobots(enPage(await client.lire(accueil.url, { agent: AGENT_PARTAGE }), "accueil")));
    // L18 – images de partage (3 au plus)
    const images = [...new Set(pages.filter((p) => p.html).flatMap((p) => p.html.metas.filter((m) => m.property === "og:image" && /^https?:\/\//i.test(m.content || "")).map((m) => `${m.content}\u0000${p.url}`)))];
    const vues = new Set();
    for (const paire of images) {
      const [img, page] = paire.split("\u0000");
      if (vues.has(img) || vues.size >= 3 || R.relationAdresse(img, ctx) === "localhost") continue;
      vues.add(img);
      const rep = await client.lire(R.rapprocher(img, ctx) || img);
      ajouter(R.regleImagePartage({ url: img, statut: rep.statut, type: rep.type, taille: rep.tampon ? rep.tampon.length : 0, erreur: rep.erreur, page }));
    }
    // L22 – icône
    faire("L22");
    // L'icône déclarée la plus grande (Google recommande plus de 48 × 48 pixels).
    const cote = (l) => Math.max(0, ...String(l.sizes || "").split(/\s+/).map((t) => Number(t.split(/x/i)[0]) || 0));
    const icones = accueil.html.liens.filter((l) => l.rel.includes("icon") && l.href && !/svg/i.test(l.type || ""));
    const lienIcone = icones.sort((a, b) => cote(b) - cote(a))[0];
    const adresseIcone = R.normaliser(lienIcone ? lienIcone.href : "/favicon.ico", accueil.url);
    const repIcone = await client.lire(adresseIcone);
    ajouter(R.regleIcone(repIcone.erreur ? { url: adresseIcone, erreur: repIcone.erreur } : { url: adresseIcone, statut: repIcone.statut, type: repIcone.type, taille: R.tailleImage(repIcone.tampon) }, accueil.url));
    // L16 – liens internes cassés (40 au plus)
    faire("L16");
    const etats = new Map(pages.map((p) => [cle(p.demandee || p.url), p]));
    const aVerifier = new Map();
    for (const p of pages.filter((x) => x.html)) {
      for (const a of p.html.ancres) {
        if (!a.href || /^(mailto|tel|javascript|#)/i.test(a.href)) continue;
        const n = R.rapprocher(new URL(a.href, p.url).href, ctx);
        if (!n || new URL(n).origin !== ctx.origine || aVerifier.has(n)) continue;
        aVerifier.set(n, p.url);
      }
    }
    const liens = [];
    for (const [url, depuis] of [...aVerifier].slice(0, 60)) {
      const connu = etats.get(url);
      if (connu) {
        liens.push({ url, statut: connu.statut, erreur: connu.erreur, depuis });
        continue;
      }
      if (liens.filter((l) => !etats.has(l.url)).length >= 40) break;
      let rep = await client.lire(url, { methode: "HEAD" });
      if (!rep.erreur && (rep.statut === 405 || rep.statut === 501)) rep = await client.lire(url);
      liens.push({ url, statut: rep.statut, erreur: rep.erreur, depuis });
    }
    ajouter(R.reglesLiens(liens));
  }

  // Assistants IA
  if (opts.ia && !opts.essentiel) {
    faire("IA1", "IA2", "IA3", "IA4", "IA5", "IA6", "IA7", "IA8", "IA9", "IA10", "IA12");
    if (fiche.faits.length) faire("IA11");
    const liste = JSON.parse(fs.readFileSync(FICHIER_ROBOTS_IA, "utf8"));
    const options = { bloquerMixte: fiche.bloquerMixte };
    ajouter(R.reglesRobotsIa(robotsInfo, politique, liste, ctx, options));
    const cibles = pages.filter((p) => p.html && p.statut === 200).slice(0, 3).map((p) => p.url);
    const reps = [];
    for (const { jeton, agent } of AGENTS_IA) {
      for (const url of cibles) {
        const rep = await client.lire(url, { agent });
        reps.push({ jeton, url, statut: rep.statut, erreur: rep.erreur, html: !rep.erreur && rep.statut === 200 && /html/i.test(rep.type) ? analyserHtml(rep.tampon.toString("utf8")) : null });
      }
    }
    ajouter(R.reglesAgentsIa(reps, politique, liste, options));
    ajouter(R.reglesContenuIa(pages, fiche, ctx));
    const llms = await client.lire(new URL("/llms.txt", ctx.origine).href);
    ajouter(R.regleLlms({ url: new URL("/llms.txt", ctx.origine).href, statut: llms.statut, type: llms.type, texte: llms.tampon ? llms.tampon.toString("utf8") : "", erreur: llms.erreur }));
    rapport.politiqueDescription = politique ? R.DESCRIPTION_POLITIQUE[politique] : null;
    rapport.robotsIaVerifiesLe = liste.verifieLe;
  }

  return terminer(rapport, controles, client, opts);
}

function terminer(rapport, controles, client, opts = {}) {
  let liste = rapport.constats;
  if (opts.essentiel) liste = liste.filter((x) => R.ESSENTIELS.includes(x.code) && (!R.ESSENTIELS_CRITIQUES_SEULS.includes(x.code) || x.gravite === "critique"));
  const rang = (g) => R.GRAVITES.indexOf(g);
  liste.sort((a, b) => rang(a.gravite) - rang(b.gravite) || a.code.localeCompare(b.code, "fr", { numeric: true }));
  rapport.constats = liste;
  rapport.controles = [...controles].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  rapport.requetes = client.total();
  rapport.bilan = Object.fromEntries(R.GRAVITES.map((g) => [g, liste.filter((x) => x.gravite === g).length]));
  return rapport;
}

// ---------------------------------------------------------------- Rendu

const PASTILLE = { critique: "🔴 Critique", haute: "🟠 Haute", moyenne: "🟡 Moyenne", basse: "🔵 Basse" };

/** Regroupe les constats identiques sur plusieurs pages. */
function regrouper(constats) {
  const groupes = new Map();
  for (const x of constats) {
    const k = `${x.code}|${x.gravite}|${x.message}`;
    if (!groupes.has(k)) groupes.set(k, { ...x, urls: [] });
    if (x.url && !groupes.get(k).urls.includes(x.url)) groupes.get(k).urls.push(x.url);
  }
  return [...groupes.values()];
}

function rendreTexte(r) {
  const l = [];
  const b = r.bilan;
  const titre = r.mode === "essentiel" ? "Garde-fou de référencement (mise en ligne)" : "Audit de référencement";
  l.push(`${titre} – ${r.origine} – ${r.date.slice(0, 10)}`);
  const lus = r.pages.length;
  l.push(`${lus} page${lus > 1 ? "s" : ""} lue${lus > 1 ? "s" : ""}, ${r.requetes} requête${r.requetes > 1 ? "s" : ""}${r.local ? " · site local : les contrôles de domaine sont à refaire en ligne" : ""}${r.prive ? " · site déclaré privé" : ""}${r.previsualisation ? " · prévisualisation" : ""}.`);
  if (r.ia) l.push(`Politique des robots IA : ${r.politique ? `${r.politique} (${r.politiqueDescription})` : "non décidée"} · liste des robots vérifiée le ${r.robotsIaVerifiesLe}.`);
  l.push(`Bilan : ${b.critique} Critique · ${b.haute} Haute · ${b.moyenne} Moyenne · ${b.basse} Basse`);
  const questions = r.ia ? ["venir", "garder", "presenter", "choisir", "ia"] : ["venir", "garder", "presenter", "choisir"];
  for (const q of questions) {
    if (q === "choisir") {
      if (r.mode !== "essentiel") l.push("", "4. Mérite-t-elle d'être choisie ? (contenu utile, auteur, preuves) : cela se juge avec vous, pas par un script.");
      continue;
    }
    const codes = r.controles.filter((code) => R.CONTROLES[code] && R.CONTROLES[code][0] === q);
    if (!codes.length) continue;
    l.push("", R.QUESTIONS[q]);
    const groupes = regrouper(r.constats.filter((x) => codes.includes(x.code)));
    for (const g of groupes) {
      const ou = g.urls.length > 1 ? ` (${g.urls.length} pages : ${g.urls.slice(0, 3).join(", ")}${g.urls.length > 3 ? "…" : ""})` : g.urls.length ? ` (${g.urls[0]})` : "";
      l.push(`  ${PASTILLE[g.gravite]} – ${g.code} ${g.message}${ou}`);
      l.push(`     → ${g.conseil}`);
    }
    const avecConstat = new Set(groupes.map((g) => g.code));
    for (const code of codes) if (!avecConstat.has(code)) l.push(`  ✅ ${code} ${R.CONTROLES[code][1]}`);
  }
  l.push("");
  if (r.mode === "essentiel") l.push(b.critique ? `❌ Mise en ligne à corriger : ${b.critique} constat(s) Critique.` : "✅ Rien ne bloque le référencement de cette mise en ligne.");
  else l.push(b.critique ? `❌ ${b.critique} constat(s) Critique à corriger en premier.` : b.haute ? `⚠️ Aucun Critique ; ${b.haute} constat(s) Haute à corriger.` : "✅ Aucun constat Critique ni Haute.");
  return l.join("\n");
}

/** pulse-aidd seo robots <A|B|C|D> [--sitemap <adresse>] [--fermes /api/,/brouillons/] [--signal "…"] [--bloquer-amazonbot] */
function robotsTxt(argv) {
  const { genererRobots, POLITIQUES } = require("./robots");
  const politique = String(argv[0] || "").toUpperCase();
  const opts = { fermes: [], sitemap: null, contentSignal: null, bloquerMixte: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sitemap") opts.sitemap = argv[++i];
    else if (a === "--fermes") opts.fermes = String(argv[++i] || "").split(",").map((x) => x.trim()).filter(Boolean).map(cheminDuSite);
    else if (a === "--signal") opts.contentSignal = argv[++i];
    else if (a === "--bloquer-amazonbot") opts.bloquerMixte = true;
    else throw new Error(`Option inconnue : ${a}`);
  }
  if (!POLITIQUES.includes(politique)) throw new Error("Politique attendue : A, B, C ou D.");
  if (opts.sitemap && !/^https?:\/\//i.test(opts.sitemap)) throw new Error("--sitemap : adresse complète (https://…/sitemap.xml).");
  const liste = JSON.parse(fs.readFileSync(FICHIER_ROBOTS_IA, "utf8"));
  return genererRobots(politique, liste.robots, opts);
}

async function principal() {
  if (process.argv[2] === "robots") {
    try {
      process.stdout.write(robotsTxt(process.argv.slice(3)));
    } catch (e) {
      console.error(`${e.message}\nUsage : pulse-aidd seo robots <A|B|C|D> [--sitemap <adresse>] [--fermes /api/] [--signal "search=yes, ai-input=yes, ai-train=no"] [--bloquer-amazonbot]`);
      process.exit(2);
    }
    return;
  }
  let opts;
  try {
    opts = lireArguments(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    process.exit(2);
  }
  const rapport = await auditer(opts);
  console.log(opts.json ? JSON.stringify(rapport, null, 2) : rendreTexte(rapport));
  process.exitCode = rapport.bilan.critique ? 1 : 0;
}

if (require.main === module) principal();

module.exports = { auditer, rendreTexte, lireArguments, cheminDuSite };

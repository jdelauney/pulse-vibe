#!/usr/bin/env node
// Pulse Next.js – contrôles du code pour le référencement (`pulse-aidd pile seo-code`, /pulse:seo).
//
//   pulse-aidd pile seo-code [--dossier <projet>] [--json]
//   pulse-aidd pile seo-code --pages [--dossier <projet>]
//
//   --pages   affiche les pages publiques fixes, séparées par des virgules, pour : pulse-aidd seo <adresse> --chemins <liste>
//
// Lit les fichiers du projet (app/ ou src/app/, src/, next.config.ts, public/) sans rien modifier. Contrôles C1 à C13
// (métadonnées, robots, sitemap, image de partage, données structurées, vrai 404, langues) et NC1 à NC3
// (politique des robots IA, robots.txt unique, htmlLimitedBots). Gravités Pulse.
// Code de sortie : 0 sans constat Critique, 1 avec au moins un constat Critique, 2 si l'appel est invalide.
"use strict";

const fs = require("fs");
const path = require("path");

const CONTROLES = {
  C1: "Adresse du site (metadataBase) dans le layout racine",
  C2: "Modèle de titre dans le layout racine",
  C3: "Métadonnées sur chaque page publique (titre, description, adresse officielle)",
  C4: "Carte de partage complète sur chaque page (fusion superficielle d'openGraph)",
  C5: "Pages connectées hors de Google (noindex du groupe (connecte))",
  C6: "robots.ts et sitemap.ts présents, sans doublon dans public/, dates réelles",
  C7: "Image de partage du site (opengraph-image)",
  C8: "Données structurées échappées (composant JsonLd)",
  C9: "Pages de détail : vrai 404 pour une adresse inconnue",
  C10: "Métadonnées publiques prérendables (sans cookies() ni headers())",
  C11: "Images avec texte alternatif (next/image)",
  C12: "Redirections permanentes pour les adresses renommées",
  C13: "Versions de langue déclarées (alternates, x-default, sitemap)",
  NC1: "robots.ts construit depuis la politique des robots IA",
  NC2: "Un seul robots.txt (pas de public/robots.txt)",
  NC3: "htmlLimitedBots garde la liste par défaut de Next.js",
};

const GRAVITES = ["critique", "haute", "moyenne", "basse"];
const c = (code, gravite, message, conseil, fichier) => ({ code, gravite, message, conseil, ...(fichier ? { fichier } : {}) });

function lireArguments(argv) {
  const opts = { dossier: process.cwd(), json: false, pages: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dossier") opts.dossier = path.resolve(argv[++i] || ".");
    else if (a === "--json") opts.json = true;
    else if (a === "--pages") opts.pages = true;
    else throw new Error(`Option inconnue : ${a}`);
  }
  return opts;
}

function fichiers(dossier) {
  if (!fs.existsSync(dossier)) return [];
  const resultat = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) resultat.push(...fichiers(chemin));
    else resultat.push(chemin);
  }
  return resultat;
}

/** Le code d'un fichier, sans ses commentaires (un commentaire qui cite une règle ne déclenche pas de contrôle). */
const lire = (f) =>
  f && fs.existsSync(f)
    ? fs
        .readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
    : "";
const premier = (dossier, noms) => noms.map((n) => path.join(dossier, n)).find((f) => fs.existsSync(f)) || null;

/** Une page du dossier app : son adresse, ses segments, et ce qu'elle est (publique, connectée, dynamique). */
function decrirePage(fichier, app) {
  const segments = path.relative(app, path.dirname(fichier)).split(path.sep).filter(Boolean);
  const visibles = segments.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"));
  const route = `/${visibles.join("/")}`;
  return {
    fichier,
    segments,
    route,
    connectee: segments.includes("(connecte)"),
    api: segments[0] === "api",
    privee: segments.some((s) => s.startsWith("_")),
    dynamique: visibles.some((s) => s.startsWith("[")),
    langues: visibles[0] === "[locale]",
  };
}

function trouverApp(dossier) {
  for (const d of [path.join(dossier, "src", "app"), path.join(dossier, "app")]) if (fs.existsSync(d)) return d;
  return null;
}

/** Chemin relatif du dossier des routes, pour les messages : app ou src/app. */
function cheminApp(dossier) {
  const app = trouverApp(dossier);
  return app ? path.relative(dossier, app).split(path.sep).join("/") : "app";
}

/** Le chemin relatif qui existe dans le projet (nouvelle structure, sinon ancienne) ; le nouveau par défaut. */
function cheminDuCode(dossier, nouveau, ancien) {
  return !fs.existsSync(path.join(dossier, nouveau)) && fs.existsSync(path.join(dossier, ancien)) ? ancien : nouveau;
}

/** Les pages publiques fixes (hors groupe connecté, api, segments dynamiques). */
function pagesPubliques(dossier) {
  const app = trouverApp(dossier);
  if (!app) return [];
  return fichiers(app)
    .filter((f) => /[\\/]page\.(tsx|ts|jsx|js|mdx)$/.test(f))
    .map((f) => decrirePage(f, app))
    .filter((p) => !p.connectee && !p.api && !p.privee && !p.dynamique)
    .map((p) => p.route)
    .sort();
}

function controler(dossier) {
  const constats = [];
  const rel = (f) => path.relative(dossier, f).split(path.sep).join("/");
  const app = trouverApp(dossier);
  const A = cheminApp(dossier);
  const proxyRel = A === "src/app" ? "src/proxy.ts" : "proxy.ts";
  const siteRel = cheminDuCode(dossier, "src/config/site.ts", "src/lib/site.ts");
  const seoRel = cheminDuCode(dossier, "src/lib/seo/seo.ts", "src/lib/seo.ts");
  const robotsRel = cheminDuCode(dossier, "src/lib/seo/politique-robots.ts", "src/lib/politique-robots.ts");
  const jsonLdRel = cheminDuCode(dossier, "src/components/shared/elements/json-ld.tsx", "src/components/json-ld.tsx");
  if (!app) return { constats: [c("C1", "critique", "Dossier app/ (ou src/app/) introuvable : est-ce bien un projet Next.js (App Router) ?", "Lancer la commande depuis la racine du projet, ou indiquer --dossier.", null)], pages: [] };
  const tous = fichiers(app);
  const pages = tous.filter((f) => /[\\/]page\.(tsx|ts|jsx|js|mdx)$/.test(f)).map((f) => decrirePage(f, app));
  const publiques = pages.filter((p) => !p.connectee && !p.api && !p.privee);
  const avecLangues = fs.existsSync(path.join(app, "[locale]"));
  const layoutRacine = premier(avecLangues ? path.join(app, "[locale]") : app, ["layout.tsx", "layout.ts", "layout.jsx", "layout.js"]);
  const texteLayout = lire(layoutRacine);

  // C1, C2 – layout racine
  if (!layoutRacine) constats.push(c("C1", "critique", "Layout racine introuvable.", `Créer ${A}/layout.tsx (squelette du pack).`, null));
  else {
    if (!/metadataBase\s*:/.test(texteLayout)) constats.push(c("C1", "critique", "Le layout racine ne définit pas metadataBase : adresses officielles et images de partage risquent de pointer vers localhost.", `Ajouter metadataBase: new URL(adresseDuSite()) (${siteRel}, recette seo).`, rel(layoutRacine)));
    else if (/metadataBase\s*:\s*new URL\(\s*["'`]https?:\/\/localhost/.test(texteLayout)) constats.push(c("C1", "critique", "metadataBase est écrit en dur sur localhost.", "Utiliser adresseDuSite() (variable SITE_URL en production).", rel(layoutRacine)));
    if (!/template\s*:/.test(texteLayout)) constats.push(c("C2", "moyenne", "Pas de modèle de titre (title.template) dans le layout racine : chaque page doit répéter le nom du site.", 'Écrire title: { default: projet.nom, template: `%s | ${projet.nom}` }.', rel(layoutRacine)));
  }

  // C3, C4, C10, C9 – pages publiques
  for (const p of publiques) {
    const t = lire(p.fichier);
    const f = rel(p.fichier);
    const statique = /export\s+const\s+metadata\b/.test(t);
    const dynamique = /export\s+(async\s+)?function\s+generateMetadata\b/.test(t);
    if (!statique && !dynamique) {
      constats.push(c("C3", "haute", `Page publique ${p.route} sans métadonnées : titre et description par défaut, pas d'adresse officielle.`, `Exporter metadata = metadonneesDePage({ titre, description, chemin }) (${seoRel}), avec les textes de docs/seo.md.`, f));
    } else if (!/metadonneesDePage\s*\(/.test(t) && !/canonical\s*:/.test(t)) {
      constats.push(c("C3", "moyenne", `Page publique ${p.route} sans adresse officielle (canonique).`, "Construire les métadonnées avec metadonneesDePage(), qui pose la canonique.", f));
    }
    if (/openGraph\s*:/.test(t) && !/metadonneesDePage\s*\(/.test(t)) constats.push(c("C4", "moyenne", `${p.route} définit openGraph à la main : Next.js remplace alors tout celui du layout (nom du site, image).`, "Passer par metadonneesDePage(), qui reconstruit la carte complète.", f));
    if (dynamique) {
      const corps = t.slice(t.search(/function\s+generateMetadata\b/));
      const fin = corps.search(/\nexport\s/);
      const bloc = fin > 0 ? corps.slice(0, fin) : corps;
      if (/\b(cookies|headers)\s*\(/.test(bloc)) constats.push(c("C10", "moyenne", `generateMetadata de ${p.route} lit cookies() ou headers() : les métadonnées arrivent en fin de page pour Googlebot et les robots IA.`, "Lire les données publiques par une fonction \"use cache\", sans données de requête.", f));
    }
    if (p.dynamique && !p.langues) {
      // C9 : un loading.tsx du segment (ou d'un parent dans la route) fait répondre 200 avant notFound().
      const dossiers = [];
      let d = path.dirname(p.fichier);
      while (d.startsWith(app)) {
        dossiers.push(d);
        if (d === app) break;
        d = path.dirname(d);
      }
      const loading = dossiers.map((x) => premier(x, ["loading.tsx", "loading.ts", "loading.jsx", "loading.js"])).find(Boolean);
      if (loading) constats.push(c("C9", "haute", `${p.route} a un loading.tsx (${rel(loading)}) : une adresse inconnue répond 200 au lieu de 404 (soft 404).`, "Retirer loading.tsx de ce segment ; placer un <Suspense> sous la vérification notFound().", f));
      else if (!/notFound\s*\(/.test(t)) constats.push(c("C9", "moyenne", `${p.route} n'appelle pas notFound() pour un contenu absent.`, "Lire le contenu, puis notFound() s'il n'existe pas, avant tout <Suspense>.", f));
      else {
        const prefixe = p.route.split("/[")[0] || "/";
        const proxy = lire(premier(path.dirname(app), ["proxy.ts", "proxy.js"]) || "");
        if (!proxy.includes(prefixe)) constats.push(c("C9", "basse", `${p.route} : une adresse inconnue répond 200 avec noindex (coquille prérendue envoyée avant notFound()). Google l'écarte, mais la compte comme « soft 404 ».`, `Pour un vrai 404 : vérifier l'existence dans ${proxyRel} (recette seo, étape « vrai 404 »).`, f));
      }
    }
  }

  // C5 – groupe connecté
  if (pages.some((p) => p.connectee)) {
    const dossierConnecte = path.join(app, ...(avecLangues ? ["[locale]"] : []), "(connecte)");
    const layoutConnecte = premier(dossierConnecte, ["layout.tsx", "layout.ts", "layout.jsx", "layout.js"]);
    if (!layoutConnecte || !/index\s*:\s*false/.test(lire(layoutConnecte))) constats.push(c("C5", "moyenne", "Les pages connectées ne demandent pas noindex : un lien partagé peut faire apparaître leur adresse dans Google.", `Ajouter ${A}/(connecte)/layout.tsx avec robots: { index: false, follow: false } (recette seo).`, layoutConnecte ? rel(layoutConnecte) : rel(dossierConnecte)));
  }

  // C6, NC1, NC2 – robots et sitemap
  const robots = premier(app, ["robots.ts", "robots.js", "robots.txt"]);
  const sitemap = premier(app, ["sitemap.ts", "sitemap.js", "sitemap.xml"]);
  const publicDir = path.join(dossier, "public");
  if (!robots) constats.push(c("C6", "haute", `Pas de robots.txt (${A}/robots.ts) : Google ne trouve pas le sitemap.`, `Ajouter ${A}/robots.ts (squelette du pack).`, null));
  if (!sitemap) constats.push(c("C6", "haute", `Pas de sitemap (${A}/sitemap.ts).`, `Ajouter ${A}/sitemap.ts avec les pages publiques (squelette du pack).`, null));
  if (fs.existsSync(path.join(publicDir, "robots.txt"))) constats.push(c("NC2", "haute", `public/robots.txt en plus de ${A}/robots.ts : deux fichiers pour la même adresse.`, `Supprimer public/robots.txt et garder ${A}/robots.ts.`, "public/robots.txt"));
  if (fs.existsSync(path.join(publicDir, "sitemap.xml"))) constats.push(c("C6", "haute", "public/sitemap.xml en plus du sitemap généré.", `Supprimer public/sitemap.xml et garder ${A}/sitemap.ts.`, "public/sitemap.xml"));
  if (sitemap) {
    const t = lire(sitemap);
    if (/new Date\(\s*\)/.test(t)) constats.push(c("C6", "moyenne", "Le sitemap date chaque page du jour de génération (new Date()) : Google ignore alors toutes ses dates.", "Indiquer la vraie date de mise à jour du contenu (colonne en base), ou aucune date.", rel(sitemap)));
    if (/\b(priority|changeFrequency)\s*:/.test(t)) constats.push(c("C6", "basse", "Le sitemap remplit priority ou changeFrequency, que Google ignore.", "Retirer ces champs.", rel(sitemap)));
  }
  if (robots && /\.(ts|js)$/.test(robots) && !/politiqueRobotsIa|reglesRobots\s*\(/.test(lire(robots))) constats.push(c("NC1", "basse", `robots.ts n'utilise pas la politique des robots IA (${robotsRel}).`, "Construire les règles avec reglesRobots(politiqueRobotsIa) (recette seo) ; décider la politique avec /pulse:seo ia.", rel(robots)));

  // C7 – image de partage
  if (!premier(app, ["opengraph-image.tsx", "opengraph-image.ts", "opengraph-image.jsx", "opengraph-image.js", "opengraph-image.png", "opengraph-image.jpg", "opengraph-image.jpeg"])) constats.push(c("C7", "moyenne", `Pas d'image de partage pour le site (${A}/opengraph-image).`, `Ajouter ${A}/opengraph-image.tsx (squelette du pack) ou une image de 1200 × 630.`, null));

  // C8, C11 – fichiers de composants
  const sources = [path.join(dossier, "src"), path.join(dossier, "app")]
    .filter((d) => fs.existsSync(d))
    .flatMap((d) => fichiers(d))
    .filter((f) => /\.(tsx|jsx)$/.test(f) && !/[\\/]components[\\/]ui[\\/]/.test(f));
  for (const f of sources) {
    const t = lire(f);
    if (/dangerouslySetInnerHTML/.test(t) && /JSON\.stringify\(/.test(t) && !/\\\\u003c/.test(t)) constats.push(c("C8", "haute", "JSON-LD écrit avec JSON.stringify sans échapper « < » : un texte saisi peut injecter du code (XSS).", `Utiliser le composant JsonLd (${jsonLdRel}).`, rel(f)));
    for (const m of t.matchAll(/<Image\b[\s\S]*?\/?>/g)) {
      if (!/\balt\s*=/.test(m[0])) {
        constats.push(c("C11", "moyenne", "Image next/image sans texte alternatif (alt).", "Décrire l'image en quelques mots ; alt=\"\" pour une image décorative.", rel(f)));
        break;
      }
    }
    if (/<img\b/.test(t)) constats.push(c("C11", "basse", "Balise <img> directe : ni optimisation ni dimensions.", "Utiliser next/image (fiche, règle 32).", rel(f)));
  }

  // C12, NC3 – next.config
  const config = premier(dossier, ["next.config.ts", "next.config.mjs", "next.config.js"]);
  const texteConfig = lire(config);
  if (/permanent\s*:\s*false/.test(texteConfig)) constats.push(c("C12", "basse", "Redirection temporaire dans next.config : pour une adresse renommée, Google garde l'ancienne.", "Mettre permanent: true (308) pour un changement durable.", rel(config)));
  if (/htmlLimitedBots\s*:/.test(texteConfig) && !/Googlebot|Google|Bingbot/i.test(texteConfig.slice(texteConfig.search(/htmlLimitedBots\s*:/), texteConfig.search(/htmlLimitedBots\s*:/) + 600))) {
    constats.push(c("NC3", "moyenne", "htmlLimitedBots remplace la liste par défaut de Next.js : Bingbot et les robots de partage perdent leurs métadonnées dans <head>.", "Recopier la liste par défaut (node_modules/next/dist/shared/lib/router/utils/html-bots.js) et y ajouter les robots voulus.", rel(config)));
  }

  // C13 – langues
  if (avecLangues) {
    const tousTextes = [texteLayout, ...publiques.map((p) => lire(p.fichier))].join("\n");
    if (!/languages\s*:/.test(tousTextes)) constats.push(c("C13", "haute", "Site en plusieurs langues sans versions déclarées (alternates.languages) : Google peut montrer la mauvaise langue.", "Ajouter alternates.languages, avec x-default, à chaque page publique (recette langues).", rel(layoutRacine || app)));
    else if (!/x-default/.test(tousTextes)) constats.push(c("C13", "basse", "Versions de langue sans x-default.", "Ajouter x-default vers la langue par défaut.", rel(layoutRacine || app)));
    if (sitemap && !/alternates\s*:/.test(lire(sitemap))) constats.push(c("C13", "moyenne", "Le sitemap ne liste pas les versions de langue.", "Ajouter alternates.languages à chaque entrée du sitemap (recette langues).", rel(sitemap)));
  }

  return { constats, pages: pagesPubliques(dossier) };
}

function rendre(r, dossier) {
  const l = [`Contrôles du code (référencement, Next.js) – ${dossier}`];
  const bilan = Object.fromEntries(GRAVITES.map((g) => [g, r.constats.filter((x) => x.gravite === g).length]));
  l.push(`Pages publiques fixes : ${r.pages.join(", ") || "aucune"}`);
  l.push(`Bilan : ${bilan.critique} Critique · ${bilan.haute} Haute · ${bilan.moyenne} Moyenne · ${bilan.basse} Basse`, "");
  const PASTILLE = { critique: "🔴 Critique", haute: "🟠 Haute", moyenne: "🟡 Moyenne", basse: "🔵 Basse" };
  const tries = [...r.constats].sort((a, b) => GRAVITES.indexOf(a.gravite) - GRAVITES.indexOf(b.gravite));
  for (const x of tries) {
    l.push(`  ${PASTILLE[x.gravite]} – ${x.code} ${x.message}${x.fichier ? ` (${x.fichier})` : ""}`);
    l.push(`     → ${x.conseil}`);
  }
  const avec = new Set(r.constats.map((x) => x.code));
  for (const [code, libelle] of Object.entries(CONTROLES)) if (!avec.has(code)) l.push(`  ✅ ${code} ${libelle}`);
  return { texte: l.join("\n"), bilan };
}

function principal() {
  let opts;
  try {
    opts = lireArguments(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\nUsage : pulse-aidd pile seo-code [--dossier <projet>] [--json] [--pages]`);
    process.exit(2);
  }
  if (opts.pages) {
    console.log(pagesPubliques(opts.dossier).join(","));
    return;
  }
  const r = controler(opts.dossier);
  const { texte, bilan } = rendre(r, opts.dossier);
  console.log(opts.json ? JSON.stringify({ ...r, bilan }, null, 2) : texte);
  process.exitCode = bilan.critique ? 1 : 0;
}

if (require.main === module) principal();

module.exports = { controler, pagesPubliques, decrirePage, CONTROLES };

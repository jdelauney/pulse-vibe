// Pulse – règles du référencement (contrôles L1 à L27 et IA1 à IA12), fonctions pures, sans réseau.
// seo.js récupère les pages ; ces fonctions disent ce qui ne va pas, avec la gravité Pulse,
// la conséquence et la correction, en français. Sources : docs/superpowers (notes de recherche SEO et GEO).
//
// Une « page » : { url, origine: "accueil"|"sitemap"|"chemin"|"lien", statut, entetes, chaine, boucle, erreur, html }
// Le « contexte » : { origine, local, prive, previsualisation, maintenant }
// Un « constat » : { code, gravite: "critique"|"haute"|"moyenne"|"basse", message, conseil, url? }
"use strict";

const robots = require("./robots");

const GRAVITES = ["critique", "haute", "moyenne", "basse"];

const QUESTIONS = {
  venir: "1. Google peut-il venir ? (exploration)",
  garder: "2. Google peut-il garder la page ? (indexation)",
  presenter: "3. Comment la page se présente-t-elle ? (titre, description, carte de partage)",
  ia: "Assistants IA (politique des robots, lecture sans JavaScript)",
};

// Ce que vérifie chaque contrôle, pour la ligne ✅ quand il ne relève rien.
const CONTROLES = {
  L1: ["venir", "L'accueil répond (code 200)"],
  L2: ["venir", "Une seule adresse pour le site (https, avec ou sans www)"],
  L3: ["venir", "Redirections courtes, sans boucle"],
  L4: ["garder", "Aucun noindex involontaire (balise ou en-tête)"],
  L5: ["venir", "robots.txt laisse Google explorer, avec la ligne Sitemap"],
  L6: ["venir", "Sitemap valide : adresses absolues, qui répondent 200"],
  L7: ["venir", "Dates de mise à jour du sitemap plausibles"],
  L8: ["garder", "Une adresse inconnue répond 404"],
  L9: ["presenter", "Un titre par page, unique"],
  L10: ["presenter", "Une description par page, unique"],
  L11: ["garder", "Adresse officielle (canonique) absolue, dans <head>, sur le bon domaine"],
  L12: ["presenter", "Langue de la page déclarée"],
  L13: ["presenter", "Un titre principal visible (h1)"],
  L14: ["presenter", "Images décrites (attribut alt)"],
  L15: ["venir", "Liens explorables et explicites"],
  L16: ["venir", "Aucun lien interne cassé"],
  L17: ["garder", "Texte présent dans le HTML reçu (sans JavaScript)"],
  L18: ["presenter", "Carte de partage complète (Open Graph), image accessible"],
  L19: ["presenter", "Carte de partage reçue par les robots de partage"],
  L20: ["presenter", "Données structurées valides"],
  L21: ["presenter", "Nom du site déclaré sur l'accueil (WebSite)"],
  L22: ["presenter", "Icône du site accessible"],
  L23: ["garder", "Versions de langue réciproques (hreflang)"],
  L24: ["garder", "Taille du HTML sous 2 Mo"],
  L25: ["garder", "Pages privées fermées aux visiteurs inconnus"],
  L26: ["garder", "Prévisualisation hors de Google (noindex)"],
  L27: ["garder", "Métadonnées dans <head> pour Googlebot"],
  IA1: ["ia", "robots.txt conforme à la politique choisie"],
  IA2: ["ia", "Aucun groupe nommé qui rouvre des chemins fermés"],
  IA3: ["ia", "Aucun jeton périmé ou sans effet"],
  IA4: ["ia", "Le serveur répond aux robots IA autorisés"],
  IA5: ["ia", "Texte lisible sans JavaScript par un robot IA"],
  IA6: ["ia", "Métadonnées dans <head> pour un robot IA"],
  IA7: ["ia", "Aucune exclusion involontaire des réponses IA de Google (nosnippet)"],
  IA8: ["ia", "Refus d'entraînement cohérent avec la politique"],
  IA9: ["ia", "Ligne Content-Signal cohérente"],
  IA10: ["ia", "llms.txt bien formé (s'il existe)"],
  IA11: ["ia", "Faits clés présents dans le texte des pages"],
  IA12: ["ia", "Données structurées conformes au texte visible"],
};

// Garde-fou de mise en ligne (--essentiel) : ces contrôles seulement ; pour L3 et L11, les constats Critique seulement.
const ESSENTIELS = ["L1", "L3", "L4", "L5", "L8", "L11", "L25", "L26"];
const ESSENTIELS_CRITIQUES_SEULS = ["L3", "L11"];

const c = (code, gravite, message, conseil, url) => ({ code, gravite, message, conseil, ...(url ? { url } : {}) });

// ---------------------------------------------------------------- Adresses

const HOTES_LOCAUX = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)$/i;
const estHoteLocal = (hote) => HOTES_LOCAUX.test(hote) || /\.localhost$/i.test(hote);
const sansWww = (hote) => hote.replace(/^www\./i, "");

/** "meme" (même origine), "local" (deux adresses locales), "variante" (www ou http), "localhost" (vers une adresse locale depuis un site en ligne), "autre". */
function relationAdresse(adresse, ctx) {
  let u;
  try {
    u = new URL(adresse, ctx.origine);
  } catch {
    return "invalide";
  }
  const base = new URL(ctx.origine);
  if (u.origin === base.origin) return "meme";
  const cibleLocale = estHoteLocal(u.hostname);
  if (ctx.local && cibleLocale) return "local";
  if (cibleLocale) return "localhost";
  if (sansWww(u.hostname) === sansWww(base.hostname)) return "variante";
  return "autre";
}

/** Adresse comparable : sans fragment, barre finale de la racine normalisée. */
function normaliser(adresse, base) {
  try {
    const u = new URL(adresse, base);
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

/** Pour un audit local : une adresse locale d'un autre port est ramenée à l'origine auditée. */
function rapprocher(adresse, ctx) {
  const n = normaliser(adresse, ctx.origine);
  if (!n) return null;
  if (relationAdresse(n, ctx) !== "local") return n;
  const u = new URL(n);
  const base = new URL(ctx.origine);
  u.protocol = base.protocol;
  u.host = base.host;
  return u.href;
}

// ---------------------------------------------------------------- Directives robots

const DIRECTIVES_A_VALEUR = new Set(["max-snippet", "max-image-preview", "max-video-preview", "unavailable_after"]);

/** Directives qui s'appliquent à Google : balises robots et googlebot, en-tête X-Robots-Tag. */
function directives(page) {
  const resultat = { noindex: false, nosnippet: false, maxSnippetZero: false, noarchive: false, ou: [] };
  const appliquer = (texte, ou) => {
    let agent = null;
    for (const brute of String(texte || "").split(",")) {
      let t = brute.trim().toLowerCase();
      const m = t.match(/^([a-z][\w-]*)\s*:\s*(.+)$/);
      if (m && !DIRECTIVES_A_VALEUR.has(m[1])) {
        agent = m[1];
        t = m[2].trim();
      }
      if (agent && agent !== "googlebot" && agent !== "robots" && agent !== "all") continue;
      if (t === "noindex" || t === "none") {
        resultat.noindex = true;
        resultat.ou.push(ou);
      }
      if (t === "nosnippet") resultat.nosnippet = true;
      if (t === "noarchive") resultat.noarchive = true;
      if (/^max-snippet\s*:\s*0$/.test(t)) resultat.maxSnippetZero = true;
    }
  };
  for (const m of (page.html && page.html.metas) || []) {
    if (m.name === "robots" || m.name === "googlebot") appliquer(m.content, `balise <meta name="${m.name}">${m.section === "body" ? " (dans <body>)" : ""}`);
  }
  if (page.entetes && page.entetes["x-robots-tag"]) appliquer(page.entetes["x-robots-tag"], "en-tête X-Robots-Tag");
  return resultat;
}

// ---------------------------------------------------------------- Données structurées

const RETIRES = {
  faqpage: "Google n'affiche plus les FAQ en résultat enrichi depuis le 7 mai 2026",
  howto: "Google n'affiche plus les « HowTo » en résultat enrichi depuis 2023",
};

// Propriétés exigées par Google pour être éligible au résultat enrichi (galerie au 2026-06-15).
const REQUIS = {
  event: ["name", "startDate", "location"],
  recipe: ["name", "image"],
  jobposting: ["title", "description", "datePosted", "hiringOrganization"],
  videoobject: ["name", "thumbnailUrl", "uploadDate"],
  localbusiness: ["name", "address"],
  restaurant: ["name", "address"],
  store: ["name", "address"],
};

function objetsJsonLd(donnees) {
  const resultat = [];
  const parcourir = (o) => {
    if (Array.isArray(o)) return o.forEach(parcourir);
    if (!o || typeof o !== "object") return;
    if (o["@type"]) resultat.push(o);
    if (Array.isArray(o["@graph"])) o["@graph"].forEach(parcourir);
  };
  parcourir(donnees);
  return resultat;
}

const typesDe = (o) => (Array.isArray(o["@type"]) ? o["@type"] : [o["@type"]]).map((t) => String(t).toLowerCase());

function chainesDe(o, acc = []) {
  if (typeof o === "string") acc.push(o);
  else if (Array.isArray(o)) o.forEach((x) => chainesDe(x, acc));
  else if (o && typeof o === "object") Object.values(o).forEach((x) => chainesDe(x, acc));
  return acc;
}

/** Contrôle L20 d'un bloc JSON-LD. Rend { constats, objets } ; objets sert à IA12 et L21. */
function verifierJsonLd(brut, url, ctx) {
  const constats = [];
  let donnees;
  try {
    donnees = JSON.parse(brut);
  } catch (e) {
    constats.push(c("L20", "haute", `Données structurées illisibles (JSON invalide : ${e.message}).`, "Générer le bloc avec JSON.stringify, sans le composer à la main ; vérifier avec le Rich Results Test.", url));
    return { constats, objets: [] };
  }
  const contexte = (Array.isArray(donnees) ? donnees[0] : donnees) || {};
  const ctxSchema = String(contexte["@context"] || "");
  if (!/schema\.org/i.test(ctxSchema)) constats.push(c("L20", "moyenne", "Données structurées sans « @context » schema.org.", 'Ajouter "@context": "https://schema.org".', url));
  const objets = objetsJsonLd(donnees);
  if (!objets.length) constats.push(c("L20", "moyenne", "Données structurées sans « @type ».", "Indiquer le type décrit (Organization, WebSite, Event…).", url));
  for (const o of objets) {
    for (const t of typesDe(o)) {
      if (RETIRES[t]) constats.push(c("L20", "basse", `Balisage ${o["@type"]} sans effet dans Google : ${RETIRES[t]}.`, "Garder la FAQ pour les lecteurs ; le balisage peut rester, il ne produit plus rien dans Google.", url));
      if (t === "breadcrumblist") {
        const el = Array.isArray(o.itemListElement) ? o.itemListElement : [];
        const incomplet = el.some((e) => !e || e.position === undefined || !e.name);
        if (el.length < 2 || incomplet) constats.push(c("L20", "moyenne", "Fil d'Ariane incomplet : Google demande au moins 2 étapes, chacune avec position et nom.", "Construire le fil d'Ariane avec au moins deux étapes numérotées.", url));
      }
      if (t === "product" && !(o.offers || o.review || o.aggregateRating)) constats.push(c("L20", "moyenne", "Produit sans offre, avis ni note : inéligible au résultat enrichi.", "Ajouter « offers » (prix, devise, disponibilité) ou de vrais avis.", url));
      const requis = REQUIS[t] || (t.endsWith("business") ? REQUIS.localbusiness : null);
      if (requis) {
        const manquants = requis.filter((p) => o[p] === undefined || o[p] === "");
        if (manquants.length) constats.push(c("L20", "moyenne", `${o["@type"]} : propriétés exigées par Google absentes (${manquants.join(", ")}).`, "Compléter ces propriétés avec les informations visibles sur la page.", url));
      }
    }
  }
  if (!ctx.local && chainesDe(donnees).some((s) => /^https?:\/\/(localhost|127\.0\.0\.1)\b/i.test(s))) {
    constats.push(c("L20", "haute", "Données structurées qui pointent vers localhost.", "Construire les adresses depuis l'adresse officielle du site (variable de production).", url));
  }
  return { constats, objets };
}

// ---------------------------------------------------------------- Règles par page

const LIENS_GENERIQUES = /^(cliquez ici|cliquer ici|ici|en savoir plus|lire la suite|plus|voir plus|click here|here|learn more|read more|more)$/i;
const NOM_DE_FICHIER = /\.(jpe?g|png|gif|webp|avif|svg)$/i;

function mots(texte) {
  return (texte.match(/[\p{L}\p{N}]+/gu) || []).length;
}

/** Contrôles d'une page HTML reçue en 200. */
function reglesPage(page, ctx) {
  const constats = [];
  const { url } = page;
  const h = page.html;
  if (!h) return constats;
  const publiqueAttendue = page.origine !== "lien";

  // L4 – noindex
  const d = directives(page);
  if (ctx.prive) {
    if (!d.noindex) constats.push(c("L4", "haute", "Site déclaré privé, mais cette page peut entrer dans Google (aucun noindex).", "Ajouter noindex à toutes les pages ; la vraie protection reste la connexion.", url));
  } else if (d.noindex && !ctx.previsualisation) {
    if (publiqueAttendue) constats.push(c("L4", "critique", `Page publique interdite d'index : noindex (${[...new Set(d.ou)].join(", ")}). Google la retire de ses résultats.`, "Retirer noindex de cette page, ou la sortir du sitemap si elle doit rester hors de Google.", url));
    else constats.push(c("L4", "basse", `Page en noindex (${[...new Set(d.ou)].join(", ")}) : est-ce voulu ?`, "Laisser ainsi pour une page privée ou sans intérêt pour la recherche ; sinon retirer noindex.", url));
  }

  // L9 – titre
  const titresHead = h.titres.filter((t) => t.section === "head");
  const titre = (titresHead[0] || h.titres[0] || { texte: "" }).texte;
  if (!h.titres.length || !titre) constats.push(c("L9", "haute", "Page sans titre (<title>) : Google en invente un, souvent moins clair.", "Donner à chaque page un titre court et précis, les mots importants au début.", url));
  else if (titre.length > 65) constats.push(c("L9", "basse", `Titre long (${titre.length} caractères) : il risque d'être coupé à l'écran.`, "Placer les mots importants au début ; la longueur affichée dépend de l'écran.", url));
  else if (titre.length < 10) constats.push(c("L9", "basse", `Titre très court (« ${titre} ») : peu parlant dans les résultats.`, "Dire ce que la page offre, avec les mots des clients.", url));

  // L10 – description
  const descriptions = h.metas.filter((m) => m.name === "description");
  if (!descriptions.length || !(descriptions[0].content || "").trim()) constats.push(c("L10", "moyenne", "Page sans description : Google compose l'extrait seul.", "Écrire une ou deux phrases utiles, propres à la page (/pulse:seo textes).", url));

  // L11 – canonique
  const canoniques = h.liens.filter((l) => l.rel.includes("canonical"));
  const dansHead = canoniques.filter((l) => l.section === "head");
  if (canoniques.length && !dansHead.length) {
    constats.push(c("L11", "haute", "Adresse officielle (canonique) placée dans <body> : Google ne la prend en compte que dans <head>.", "Produire les métadonnées avant le contenu (métadonnées prérendues, voir les consignes de la pile).", url));
  }
  const hrefs = [...new Set(dansHead.map((l) => l.href).filter(Boolean))];
  if (hrefs.length > 1) constats.push(c("L11", "haute", `Plusieurs adresses officielles contradictoires (${hrefs.join(", ")}).`, "Garder une seule balise canonique par page.", url));
  if (!canoniques.length && page.origine !== "lien") constats.push(c("L11", "basse", "Pas d'adresse officielle déclarée (canonique) : Google choisit seul entre les variantes.", "Déclarer la canonique de chaque page publique.", url));
  for (const href of hrefs) {
    if (!/^https?:\/\//i.test(href)) {
      constats.push(c("L11", "moyenne", `Adresse officielle relative (${href}).`, "Écrire l'adresse complète (https://…).", url));
      continue;
    }
    const rel = relationAdresse(href, ctx);
    if (rel === "localhost") constats.push(c("L11", "critique", `L'adresse officielle pointe vers ${href} : Google ne peut pas l'ouvrir.`, "Définir l'adresse du site en production (variable SITE_URL ou équivalent), puis remettre en ligne.", url));
    else if (rel === "autre") constats.push(c("L11", "critique", `L'adresse officielle pointe vers un autre domaine (${href}) : Google peut indexer l'autre site à la place de celui-ci.`, "Vérifier l'adresse du site en production ; la canonique doit viser votre domaine définitif.", url));
    else if (rel === "variante") constats.push(c("L11", "moyenne", `L'adresse officielle vise une autre variante du domaine (${href}).`, "Auditer l'adresse définitive, et rediriger les autres variantes vers elle (L2).", url));
  }
  if (ctx.local && hrefs.some((x) => relationAdresse(x, ctx) === "local" && new URL(x).origin !== new URL(ctx.origine).origin)) {
    constats.push(c("L11", "basse", "Adresses locales d'un autre port dans les métadonnées : normal en local si l'adresse du site n'est pas définie.", "En ligne, l'adresse du site doit être le domaine définitif.", url));
  }

  // L12, L13
  if (!h.lang) constats.push(c("L12", "basse", "Langue de la page non déclarée (<html lang>) : utile aux lecteurs d'écran.", 'Ajouter lang="fr" (ou la langue de la page).', url));
  if (!h.h1.length || !h.h1.some((t) => t)) constats.push(c("L13", "basse", "Aucun titre principal visible (h1) dans le HTML reçu.", "Donner à la page un titre principal qui dit ce qu'elle offre.", url));

  // L14 – images
  const sansAlt = h.images.filter((i) => i.alt === null);
  const altFichier = h.images.filter((i) => i.alt && NOM_DE_FICHIER.test(i.alt.trim()));
  if (sansAlt.length) constats.push(c("L14", "moyenne", `${sansAlt.length} image(s) sans attribut alt (${sansAlt.slice(0, 3).map((i) => i.src).join(", ")}).`, 'Décrire chaque image utile en quelques mots ; alt="" pour une image décorative.', url));
  if (altFichier.length) constats.push(c("L14", "moyenne", `${altFichier.length} image(s) décrite(s) par un nom de fichier (« ${altFichier[0].alt} »).`, "Remplacer par une description de ce que montre l'image.", url));

  // L15 – liens
  const inexplorables = h.ancres.filter((a) => a.href === null || /^\s*(#\s*$|javascript:)/i.test(a.href));
  const generiques = h.ancres.filter((a) => LIENS_GENERIQUES.test((a.texte || "").trim()));
  if (inexplorables.length) constats.push(c("L15", "moyenne", `${inexplorables.length} lien(s) que Google ne peut pas suivre (sans href, « # » ou javascript:).`, "Faire de chaque lien une balise <a href> vers une vraie adresse.", url));
  if (generiques.length) constats.push(c("L15", "basse", `${generiques.length} lien(s) au texte vague (« ${generiques[0].texte} »).`, "Dire où mène le lien (« Voir nos tarifs » plutôt que « Cliquez ici »).", url));

  // L17 – texte dans le HTML initial
  const nVisible = mots(h.texteVisible);
  const nCache = mots(h.texteCache);
  if (nVisible < 3 && nCache < 30) constats.push(c("L17", "haute", "Presque aucun texte dans le HTML reçu : la page se construit sans doute dans le navigateur, invisible pour les robots qui n'exécutent pas JavaScript.", "Produire le contenu des pages publiques côté serveur (voir les consignes de la pile).", url));
  else if (nCache > 30 && nCache > nVisible * 2) constats.push(c("L17", "moyenne", "La plus grande partie du texte arrive dans des blocs cachés en fin de page (chargement progressif).", "Placer le texte principal des pages publiques au-dessus de tout chargement progressif.", url));

  // L18 – Open Graph (partie statique)
  const og = (p) => (h.metas.find((m) => m.property === p) || {}).content;
  const tw = (n) => (h.metas.find((m) => m.name === n) || {}).content;
  const image = og("og:image");
  if (!image) constats.push(c("L18", "moyenne", "Aucune image de partage (og:image) : le lien partagé s'affiche sans image.", "Ajouter une image de partage de 1200 × 630 pixels.", url));
  else if (!/^https?:\/\//i.test(image)) constats.push(c("L18", "haute", `Image de partage en adresse relative (${image}) : les réseaux sociaux ne la trouvent pas.`, "Composer l'adresse complète depuis l'adresse du site.", url));
  else if (relationAdresse(image, ctx) === "localhost") constats.push(c("L18", "haute", `Image de partage sur localhost (${image}).`, "Définir l'adresse du site en production, puis remettre en ligne.", url));
  const manquantes = ["og:title", "og:description", "og:url", "og:type"].filter((p) => !og(p));
  if (manquantes.length) constats.push(c("L18", "basse", `Carte de partage incomplète : ${manquantes.join(", ")} absent(s).`, "Reprendre le titre et la description de la page dans la carte de partage.", url));
  if (!tw("twitter:card")) constats.push(c("L18", "basse", "twitter:card absent : X affiche une petite carte.", 'Ajouter twitter:card = "summary_large_image".', url));
  const largeur = Number(og("og:image:width"));
  const hauteur = Number(og("og:image:height"));
  if (image && largeur && hauteur && Math.abs(largeur / hauteur - 1.91) > 0.15) constats.push(c("L18", "basse", `Image de partage de ${largeur} × ${hauteur} : le format attendu est proche de 1200 × 630.`, "Fournir une image de 1200 × 630 pixels.", url));

  // L20 – JSON-LD
  for (const bloc of h.jsonLd) constats.push(...verifierJsonLd(bloc.brut || "", url, ctx).constats);

  // L23 – hreflang (partie locale)
  const alternates = h.liens.filter((l) => l.rel.includes("alternate") && l.hreflang);
  if (alternates.length) {
    const invalides = alternates.filter((l) => !/^([a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?|x-default)$/i.test(l.hreflang));
    if (invalides.length) constats.push(c("L23", "haute", `Codes de langue invalides : ${invalides.map((l) => l.hreflang).join(", ")}.`, "Utiliser les codes ISO : fr, en, fr-CH, x-default.", url));
    if (alternates.some((l) => !/^https?:\/\//i.test(l.href || ""))) constats.push(c("L23", "haute", "Versions de langue en adresse relative.", "Écrire des adresses complètes (https://…).", url));
    const propre = normaliser(url, ctx.origine);
    const cites = alternates.map((l) => rapprocher(l.href || "", ctx));
    const canon = hrefs[0] ? rapprocher(hrefs[0], ctx) : propre;
    if (!cites.includes(propre) && !cites.includes(canon)) constats.push(c("L23", "haute", "La page ne se cite pas elle-même parmi ses versions de langue : Google ignore alors ces liens.", "Lister toutes les versions, y compris celle de la page.", url));
    if (!alternates.some((l) => l.hreflang.toLowerCase() === "x-default")) constats.push(c("L23", "basse", "Pas de version x-default (page de repli pour les autres langues).", "Ajouter x-default vers la version par défaut.", url));
  }

  // L24 – taille
  if (h.tailleOctets > 2 * 1024 * 1024) constats.push(c("L24", "haute", `HTML de ${(h.tailleOctets / 1048576).toFixed(1)} Mo : Googlebot ne lit que les 2 premiers Mo.`, "Alléger la page (données intégrées, listes trop longues).", url));

  // L27 – métadonnées hors de <head> (vu par n'importe quel agent)
  if (h.titres.length && !titresHead.length) constats.push(c("L27", "moyenne", "Titre (<title>) placé hors de <head> : métadonnées envoyées en fin de page.", "Rendre les métadonnées des pages publiques prérendables (consignes de la pile).", url));
  return constats;
}

/** Contrôles entre pages : doublons de titres et de descriptions, réciprocité des langues, nom du site. */
function reglesSite(pages, ctx) {
  const constats = [];
  const html = pages.filter((p) => p.html && p.statut === 200);
  const doublons = (cle, code, gravite, quoi) => {
    const parValeur = new Map();
    for (const p of html) {
      const v = cle(p);
      if (!v) continue;
      if (!parValeur.has(v)) parValeur.set(v, []);
      parValeur.get(v).push(p.url);
    }
    for (const [v, urls] of parValeur) if (urls.length > 1) constats.push(c(code, gravite, `${quoi} identique sur ${urls.length} pages (« ${v.slice(0, 80)} ») : ${urls.slice(0, 4).join(", ")}.`, `Donner à chaque page ${quoi.toLowerCase()} qui lui est propre.`, urls[0]));
  };
  doublons((p) => ((p.html.titres.find((t) => t.section === "head") || p.html.titres[0]) || {}).texte, "L9", "moyenne", "Titre");
  doublons((p) => ((p.html.metas.find((m) => m.name === "description") || {}).content || "").trim(), "L10", "moyenne", "Description");

  // L23 – réciprocité
  const parUrl = new Map(html.map((p) => [normaliser(p.url, ctx.origine), p]));
  for (const p of html) {
    const propre = normaliser(p.url, ctx.origine);
    for (const l of p.html.liens.filter((x) => x.rel.includes("alternate") && x.hreflang && x.hreflang.toLowerCase() !== "x-default")) {
      const cible = parUrl.get(rapprocher(l.href || "", ctx));
      if (!cible || cible === p) continue;
      const retour = cible.html.liens.filter((x) => x.rel.includes("alternate") && x.hreflang).map((x) => rapprocher(x.href || "", ctx));
      if (!retour.includes(propre)) constats.push(c("L23", "haute", `${cible.url} (${l.hreflang}) ne renvoie pas vers ${p.url} : liens de langue non réciproques, ignorés par Google.`, "Chaque version cite toutes les autres, et elle-même.", p.url));
    }
  }

  // L21 – nom du site sur l'accueil
  const accueil = html.find((p) => p.origine === "accueil");
  if (accueil) {
    const objets = accueil.html.jsonLd.flatMap((b) => verifierJsonLd(b.brut || "", accueil.url, ctx).objets);
    const site = objets.find((o) => typesDe(o).includes("website"));
    if (!site || !site.name || !site.url) constats.push(c("L21", "basse", "Pas de données WebSite (name, url) sur l'accueil : Google devine le nom du site.", "Déclarer le nom du site sur la page d'accueil (WebSite).", accueil.url));
  }
  return constats;
}

// ---------------------------------------------------------------- Exploration

/** L1 et L3 pour l'accueil. */
function reglesAccueil(page, ctx) {
  const constats = [];
  if (page.erreur) return [c("L1", "critique", `L'accueil ne répond pas (${page.erreur}).`, "Vérifier que le site est en ligne (adresse, hébergeur), puis relancer.", page.url)];
  if (page.boucle) constats.push(c("L3", "critique", `Boucle de redirections : ${page.chaine.map((x) => x.url).join(" → ")}.`, "Corriger la règle de redirection (hébergeur ou configuration).", page.url));
  else if (page.statut !== 200) constats.push(c("L1", "critique", `L'accueil répond avec le code ${page.statut} au lieu de 200 : Google ne peut pas l'indexer.`, "Corriger l'erreur du serveur, puis relancer.", page.url));
  return constats.concat(reglesRedirections(page, ctx));
}

function reglesRedirections(page) {
  const sauts = (page.chaine || []).length;
  const constats = [];
  if (sauts > 3) constats.push(c("L3", "moyenne", `${sauts} redirections avant la page : ${page.chaine.map((x) => x.url).join(" → ")}.`, "Rediriger directement vers l'adresse finale (une seule redirection).", page.url));
  const temporaires = (page.chaine || []).filter((x) => x.statut === 302 || x.statut === 307);
  if (temporaires.length && page.origine === "accueil") constats.push(c("L3", "basse", `Redirection temporaire (${temporaires.map((x) => x.statut).join(", ")}) sur le chemin de l'accueil.`, "Utiliser une redirection permanente (301 ou 308) pour un changement durable.", page.url));
  return constats;
}

/** L2 : variantes http et www. variantes = [{ url, statut, location, erreur, canonique }] */
function reglesVariantes(variantes, ctx) {
  const constats = [];
  for (const v of variantes) {
    if (v.erreur) continue;
    if (v.statut === 301 || v.statut === 308) {
      const loc = v.location ? normaliser(v.location, v.url) : null;
      if (loc && relationAdresse(loc, ctx) !== "meme") constats.push(c("L2", "moyenne", `${v.url} redirige vers ${loc}, pas vers ${ctx.origine}.`, "Rediriger chaque variante vers l'adresse officielle, en une fois.", v.url));
      continue;
    }
    if (v.statut === 302 || v.statut === 307) {
      constats.push(c("L2", "moyenne", `${v.url} redirige de façon temporaire (${v.statut}).`, "Utiliser une redirection permanente (301 ou 308).", v.url));
      continue;
    }
    if (v.statut === 200) {
      const canon = v.canonique ? relationAdresse(v.canonique, ctx) : null;
      if (canon !== "meme") constats.push(c("L2", "haute", `${v.url} affiche le site sans rediriger vers ${ctx.origine} : deux adresses pour le même contenu.`, "Rediriger cette variante (301 ou 308) vers l'adresse officielle, chez l'hébergeur ou dans la configuration du domaine.", v.url));
    }
  }
  return constats;
}

/** L5 : robots.txt. info = { statut, texte, ressources: [chemins de CSS et JS de l'accueil] } */
function reglesRobots(info, ctx) {
  const constats = [];
  const url = new URL("/robots.txt", ctx.origine).href;
  if (info.erreur || info.statut >= 500) {
    constats.push(c("L5", "critique", `robots.txt répond ${info.erreur || `avec le code ${info.statut}`} : Google suspend l'exploration du site.`, "Faire répondre /robots.txt en 200 (ou 404 s'il n'existe pas).", url));
    return constats;
  }
  if (info.statut === 404 || info.statut === 410) {
    constats.push(c("L5", "basse", "Pas de robots.txt : tout est permis, mais Google ne trouve pas le sitemap par ce chemin.", "Ajouter un robots.txt avec la ligne Sitemap.", url));
    return constats;
  }
  if (info.statut !== 200) return constats;
  const analyse = robots.analyser(info.texte);
  const googleBloque = !robots.autorise(analyse, "Googlebot", "/");
  // Un robot sans groupe à son nom suit le groupe « * » : c'est le cas de la plupart des moteurs.
  const tousBloques = !robots.autorise(analyse, "pulse-robot-sans-nom", "/");
  if (googleBloque && !ctx.prive && !ctx.previsualisation) {
    constats.push(c("L5", "critique", "robots.txt interdit tout le site à Google (Disallow: /) : le site disparaît des résultats.", "Remplacer Disallow: / par Allow: / (et ne fermer que les chemins voulus).", url));
  } else if (tousBloques && !ctx.prive && !ctx.previsualisation) {
    constats.push(c("L5", "haute", "robots.txt interdit tout le site aux moteurs sans groupe à leur nom (Disallow: / pour « * ») : Bing et les autres ne l'explorent pas.", "Ouvrir le groupe « * » (Allow: /) et ne fermer que les robots voulus.", url));
  } else {
    const bloquees = (info.ressources || []).filter((ch) => !robots.autorise(analyse, "Googlebot", ch));
    if (bloquees.length) constats.push(c("L5", "moyenne", `robots.txt bloque des fichiers CSS ou JavaScript (${bloquees.slice(0, 3).join(", ")}) : Google voit la page mal affichée.`, "Laisser explorer les fichiers de style et de script.", url));
  }
  if (!analyse.sitemaps.length && !ctx.prive) constats.push(c("L5", "basse", "robots.txt sans ligne Sitemap.", "Ajouter « Sitemap: https://…/sitemap.xml » (adresse complète).", url));
  for (const s of analyse.sitemaps) {
    if (!/^https?:\/\//i.test(s)) constats.push(c("L5", "moyenne", `Ligne Sitemap relative (${s}).`, "Écrire l'adresse complète du sitemap.", url));
    else if (relationAdresse(s, ctx) === "localhost") constats.push(c("L5", "haute", `Ligne Sitemap vers localhost (${s}).`, "Définir l'adresse du site en production.", url));
  }
  return constats;
}

/** L6 et L7. sitemap = { url, statut, lecture, erreur }, pages : celles du sitemap déjà lues. */
function reglesSitemap(sitemap, pagesDuSitemap, ctx) {
  const constats = [];
  if (!sitemap || ctx.prive) return constats;
  if (sitemap.erreur || sitemap.statut !== 200) {
    constats.push(c("L6", "moyenne", `Sitemap introuvable (${sitemap.url} : ${sitemap.erreur || `code ${sitemap.statut}`}).`, "Publier un sitemap des pages publiques, cité dans robots.txt.", sitemap.url));
    return constats;
  }
  const l = sitemap.lecture;
  if (l.erreurs.length) constats.push(c("L6", "haute", `Sitemap mal formé : ${l.erreurs.join(" ; ")}.`, "Générer le sitemap avec l'outil de la pile, sans l'écrire à la main.", sitemap.url));
  if (!l.espaceDeNoms && !l.erreurs.length) constats.push(c("L6", "moyenne", "Sitemap sans l'espace de noms http://www.sitemaps.org/schemas/sitemap/0.9.", "Générer le sitemap avec l'outil de la pile.", sitemap.url));
  if (l.urls.length > 50000) constats.push(c("L6", "haute", `${l.urls.length} adresses dans un seul sitemap (50 000 au plus).`, "Découper en plusieurs sitemaps.", sitemap.url));
  const relatives = l.urls.filter((u) => !/^https?:\/\//i.test(u.loc));
  if (relatives.length) constats.push(c("L6", "haute", `${relatives.length} adresse(s) relative(s) dans le sitemap (${relatives[0].loc}).`, "Écrire des adresses complètes.", sitemap.url));
  const ailleurs = l.urls.filter((u) => /^https?:\/\//i.test(u.loc) && !["meme", "local"].includes(relationAdresse(u.loc, ctx)));
  if (ailleurs.length) {
    const versLocal = ailleurs.some((u) => relationAdresse(u.loc, ctx) === "localhost");
    constats.push(c("L6", versLocal ? "critique" : "haute", `${ailleurs.length} adresse(s) du sitemap sur un autre domaine (${ailleurs[0].loc}).`, versLocal ? "Définir l'adresse du site en production." : "Lister seulement les adresses du domaine officiel.", sitemap.url));
  }
  for (const p of pagesDuSitemap) {
    if (p.erreur || p.statut !== 200) {
      constats.push(c("L6", "haute", `Adresse du sitemap en erreur : ${p.url} (${p.erreur || `code ${p.statut}`}).`, "Retirer l'adresse du sitemap, ou réparer la page.", p.url));
      continue;
    }
    if (p.chaine && p.chaine.length) constats.push(c("L6", "moyenne", `Adresse du sitemap qui redirige : ${p.demandee || p.url} → ${p.url}.`, "Lister l'adresse finale, sans redirection.", p.url));
    if (p.html) {
      const canon = (p.html.liens.find((x) => x.rel.includes("canonical") && x.href) || {}).href;
      if (canon && /^https?:/i.test(canon) && rapprocher(canon, ctx) !== normaliser(p.url, ctx.origine)) constats.push(c("L6", "haute", `${p.url} est dans le sitemap mais désigne ${canon} comme adresse officielle.`, "Ne lister que les adresses officielles (canoniques).", p.url));
    }
  }
  // L7 – dates de mise à jour
  const dates = l.urls.map((u) => u.lastmod).filter(Boolean);
  if (dates.length >= 2 && new Set(dates).size === 1) {
    const t = Date.parse(dates[0]);
    const maintenant = (ctx.maintenant || new Date()).getTime();
    if (Number.isFinite(t) && Math.abs(maintenant - t) < 36 * 3600 * 1000) constats.push(c("L7", "basse", "Toutes les pages du sitemap portent la même date, celle du jour : c'est l'heure de génération, pas une vraie mise à jour. Google ignore alors ces dates.", "Indiquer pour chaque page sa vraie date de dernière modification, ou aucune date.", sitemap.url));
  }
  return constats;
}

/** L8 : adresse inconnue. rep = { url, statut, html, erreur } */
function regleSoft404(rep) {
  if (rep.erreur) return [];
  if (rep.statut === 404 || rep.statut === 410) return [];
  if (rep.statut === 200) {
    const avecNoindex = rep.html && directives(rep).noindex;
    return [c("L8", "haute", `Une adresse inconnue répond 200${avecNoindex ? " (avec noindex)" : ""} au lieu de 404 : Google y voit une « fausse page 404 » (soft 404).`, "Faire répondre 404 aux adresses inconnues (voir les consignes de la pile : page introuvable avant tout chargement progressif).", rep.url)];
  }
  if (rep.statut >= 300 && rep.statut < 400) return [c("L8", "moyenne", `Une adresse inconnue redirige (${rep.statut}) au lieu de répondre 404.`, "Répondre 404 avec une page « introuvable » qui propose l'accueil.", rep.url)];
  if (rep.statut >= 500) return [c("L8", "haute", `Une adresse inconnue provoque une erreur serveur (${rep.statut}).`, "Faire répondre 404 aux adresses inconnues.", rep.url)];
  return [];
}

/** L16 : liens internes cassés. liens = [{ url, statut, erreur, depuis }] */
function reglesLiens(liens) {
  return liens
    .filter((l) => l.erreur || l.statut >= 400)
    .map((l) => c("L16", "haute", `Lien interne cassé : ${l.url} (${l.erreur || `code ${l.statut}`}), depuis ${l.depuis}.`, "Corriger le lien, ou rediriger l'ancienne adresse (redirection permanente).", l.depuis));
}

/** L18 : l'image de partage répond-elle ? info = { url, statut, type, taille, erreur, page } */
function regleImagePartage(info) {
  if (info.erreur || info.statut !== 200) return [c("L18", "haute", `Image de partage inaccessible : ${info.url} (${info.erreur || `code ${info.statut}`}).`, "Publier l'image à cette adresse, ou corriger l'adresse.", info.page)];
  if (info.type && !/^image\//i.test(info.type)) return [c("L18", "haute", `L'image de partage n'est pas une image (type ${info.type}).`, "Pointer vers un fichier PNG ou JPEG.", info.page)];
  if (info.taille > 8 * 1024 * 1024) return [c("L18", "moyenne", `Image de partage de ${(info.taille / 1048576).toFixed(1)} Mo (8 Mo au plus, 5 Mo pour X).`, "Compresser l'image.", info.page)];
  if (info.taille > 5 * 1024 * 1024) return [c("L18", "basse", "Image de partage de plus de 5 Mo : X ne l'affichera pas.", "Compresser l'image sous 5 Mo.", info.page)];
  return [];
}

/** L19 : balises reçues par un robot de partage (facebookexternalhit). */
function reglePartageRobots(page) {
  if (!page || !page.html) return [];
  const enTete = page.html.metas.filter((m) => m.section === "head" && (m.property === "og:title" || m.property === "og:image"));
  if (enTete.length < 2) return [c("L19", "moyenne", "Les robots de partage ne reçoivent pas og:title et og:image dans <head> : la carte partagée risque d'être vide.", "Rendre les métadonnées de partage prérendues (consignes de la pile).", page.url)];
  return [];
}

/** Dimensions d'une icône (PNG, ICO, GIF) ; null si inconnues. */
function tailleImage(tampon) {
  const b = Buffer.from(tampon);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20), format: "png" };
  if (b.length >= 6 && b.readUInt16LE(0) === 0 && b.readUInt16LE(2) === 1) {
    const n = b.readUInt16LE(4);
    let meilleure = null;
    for (let i = 0; i < n && 6 + i * 16 + 2 <= b.length; i++) {
      const l = b[6 + i * 16] || 256;
      const h = b[6 + i * 16 + 1] || 256;
      if (!meilleure || l > meilleure.largeur) meilleure = { largeur: l, hauteur: h, format: "ico" };
    }
    return meilleure;
  }
  if (b.length >= 10 && b.toString("ascii", 0, 3) === "GIF") return { largeur: b.readUInt16LE(6), hauteur: b.readUInt16LE(8), format: "gif" };
  if (/^\s*<(\?xml|svg)/i.test(b.toString("utf8", 0, 200))) return { largeur: Infinity, hauteur: Infinity, format: "svg" };
  return null;
}

/** L22 : icône. info = { url, statut, type, taille: {largeur, hauteur}|null, erreur } ou null si aucune */
function regleIcone(info, accueilUrl) {
  if (!info || info.erreur || info.statut !== 200) return [c("L22", "moyenne", `Icône du site introuvable${info ? ` (${info.url})` : ""} : Google affiche une icône par défaut à côté du site.`, "Ajouter une icône carrée d'au moins 48 × 48 pixels.", accueilUrl)];
  const t = info.taille;
  if (t && t.largeur !== t.hauteur) return [c("L22", "moyenne", `Icône non carrée (${t.largeur} × ${t.hauteur}).`, "Fournir une icône carrée.", accueilUrl)];
  if (t && t.largeur < 48) return [c("L22", "basse", `Icône de ${t.largeur} × ${t.hauteur} : Google recommande plus de 48 × 48 pixels.`, "Ajouter une icône PNG plus grande (par exemple 192 × 192).", accueilUrl)];
  return [];
}

/** L25 : pages privées. rep = { url, statut, html, entetes, erreur } */
function reglePrivee(rep) {
  if (rep.erreur) return [c("L25", "basse", `Page privée ${rep.url} impossible à lire (${rep.erreur}) : contrôle à refaire.`, "Vérifier l'adresse de la page privée, puis relancer.", rep.url)];
  if ((rep.statut >= 300 && rep.statut < 400) || [401, 403, 404].includes(rep.statut)) return [];
  if (rep.statut === 200) {
    if (directives(rep).noindex) return [c("L25", "basse", `Page privée ${rep.url} servie en 200 avec noindex : vérifiez qu'elle n'affiche aucune donnée sans connexion.`, "Contrôler avec /pulse:security que la page exige la connexion.", rep.url)];
    return [c("L25", "critique", `Page privée ${rep.url} servie à un visiteur inconnu, sans noindex : Google peut l'indexer.`, "Exiger la connexion sur cette page (/pulse:security), et ajouter noindex aux pages privées.", rep.url)];
  }
  return [];
}

/** L26 : une prévisualisation doit rester hors de Google. */
function reglePrevisualisation(page) {
  if (!page || page.erreur) return [];
  if (!directives(page).noindex) return [c("L26", "moyenne", "Adresse de prévisualisation sans noindex : Google peut l'indexer en double du vrai site.", "Ajouter l'en-tête X-Robots-Tag: noindex aux prévisualisations (automatique chez certains hébergeurs, pas sur un domaine personnalisé).", page.url)];
  return [];
}

/** L27 : ce que reçoit Googlebot. */
function regleGooglebot(page) {
  if (!page || !page.html) return [];
  const h = page.html;
  const constats = [];
  if (h.liens.some((l) => l.rel.includes("canonical") && l.section === "body")) constats.push(c("L27", "haute", "Googlebot reçoit l'adresse officielle (canonique) dans <body> : Google ne la prend pas en compte à cet endroit.", "Rendre les métadonnées des pages publiques prérendables (consignes de la pile).", page.url));
  else if (h.titres.length && !h.titres.some((t) => t.section === "head")) constats.push(c("L27", "moyenne", "Googlebot reçoit le titre hors de <head> (métadonnées en fin de page).", "Rendre les métadonnées des pages publiques prérendables.", page.url));
  return constats;
}

// ---------------------------------------------------------------- Assistants IA

const DESCRIPTION_POLITIQUE = {
  A: "visible partout, entraînement accepté",
  B: "visible dans les réponses IA, sans entraînement",
  C: "hors des réponses IA",
  D: "site privé",
};

/** IA1 à IA3, IA8, IA9 : robots.txt comparé à la politique. */
function reglesRobotsIa(info, politique, liste, ctx, options = {}) {
  const constats = [];
  const url = new URL("/robots.txt", ctx.origine).href;
  const analyse = robots.analyser(info && info.statut === 200 ? info.texte : "");
  if (!politique) {
    constats.push(c("IA1", "basse", "Politique des robots IA non décidée (docs/seo.md) : le contrôle compare seulement la forme.", "Décider avec /pulse:seo ia.", url));
  } else {
    for (const r of liste.robots) {
      if (r.role === "apercu") continue;
      const voulu = robots.attendu(politique, r, options);
      const permis = robots.autorise(analyse, r.jeton, "/");
      if (voulu === "autorise" && !permis) constats.push(c("IA1", "haute", `${r.jeton} (${r.editeur}, ${r.usage}) est bloqué, alors que la politique ${politique} (${DESCRIPTION_POLITIQUE[politique]}) le laisse passer.`, "Rouvrir ce robot dans robots.txt (pulse-aidd reference seo/robots-ia.json pour son rôle).", url));
      if (voulu === "bloque" && permis) {
        const entrainement = r.role === "entrainement" || r.role === "jeton-entrainement";
        constats.push(c(entrainement ? "IA8" : "IA1", entrainement ? "moyenne" : "haute", `${r.jeton} (${r.editeur}, ${r.usage}) peut explorer le site, alors que la politique ${politique} le bloque.`, `Ajouter « User-agent: ${r.jeton} » et « Disallow: / » à robots.txt.`, url));
      }
    }
  }
  // IA2 – groupe nommé qui oublie les Disallow de « * »
  const etoile = analyse.groupes.filter((g) => g.agents.includes("*")).flatMap((g) => g.regles.filter((r) => r.type === "disallow" && r.chemin && r.chemin !== "/").map((r) => r.chemin));
  for (const g of analyse.groupes.filter((x) => !x.agents.includes("*"))) {
    if (g.regles.some((r) => r.type === "disallow" && r.chemin === "/")) continue;
    const oublies = etoile.filter((ch) => !g.regles.some((r) => r.type === "disallow" && r.chemin === ch));
    if (oublies.length) constats.push(c("IA2", "moyenne", `Le groupe « ${g.agents.join(", ")} » ne reprend pas les chemins fermés pour tous (${oublies.join(", ")}) : ce robot ne lit plus le groupe « * » et peut les explorer.`, "Recopier les lignes Disallow communes dans chaque groupe nommé.", url));
  }
  // IA3 – jetons périmés ou sans effet
  const nommes = analyse.groupes.flatMap((g) => g.agents);
  for (const perime of ["anthropic-ai", "claude-web"]) if (nommes.includes(perime)) constats.push(c("IA3", "basse", `Jeton « ${perime} » périmé : Anthropic utilise ClaudeBot, Claude-SearchBot et Claude-User.`, "Remplacer par les jetons actuels (référence robots-ia.json).", url));
  for (const r of liste.robots.filter((x) => x.role === "demande" && x.obeit === "non")) {
    const groupes = analyse.groupes.filter((g) => g.agents.includes(r.jeton.toLowerCase()));
    if (groupes.some((g) => g.regles.some((x) => x.type === "allow"))) constats.push(c("IA3", "basse", `Règle Allow pour ${r.jeton} : ce robot vient à la demande d'une personne et peut ignorer robots.txt ; la présence dans les réponses dépend du robot de recherche de l'éditeur.`, "Régler plutôt le robot de recherche de cet éditeur.", url));
  }
  // IA9 – Content-Signal
  for (const s of analyse.signaux) {
    const { valeurs, erreurs } = robots.lireSignal(s.valeur);
    if (erreurs.length) constats.push(c("IA9", "moyenne", `Ligne Content-Signal mal formée : ${erreurs.join(" ; ")}.`, "Écrire par exemple : Content-Signal: search=yes, ai-input=yes, ai-train=no.", url));
    if (politique === "B" && valeurs["ai-train"] === "yes") constats.push(c("IA9", "moyenne", "Content-Signal accepte l'entraînement (ai-train=yes) alors que la politique B le refuse.", "Mettre ai-train=no.", url));
    if (politique === "A" && valeurs["ai-train"] === "no") constats.push(c("IA9", "moyenne", "Content-Signal refuse l'entraînement alors que la politique A l'accepte.", "Mettre ai-train=yes, ou changer de politique avec /pulse:seo ia.", url));
    if (politique === "C" && valeurs["ai-input"] === "yes") constats.push(c("IA9", "moyenne", "Content-Signal accepte la reprise dans les réponses IA (ai-input=yes) alors que la politique C la refuse.", "Mettre ai-input=no.", url));
  }
  return constats;
}

/** IA4 à IA6 : ce que reçoit un robot IA. reps = [{ agent, jeton, url, statut, html, erreur }]. Un constat par page et par problème, avec les robots concernés. */
function reglesAgentsIa(reps, politique, liste, options = {}) {
  const parRobot = reglesAgentsIaParRobot(reps, politique, liste, options);
  const groupes = new Map();
  for (const x of parRobot) {
    const k = `${x.code}|${x.gravite}|${x.url}|${x.cle}`;
    if (!groupes.has(k)) groupes.set(k, { ...x, jetons: [] });
    groupes.get(k).jetons.push(x.jeton);
  }
  return [...groupes.values()].map(({ cle, jeton, jetons, gabarit, ...x }) => ({ ...x, message: gabarit(jetons.join(", "), jetons.length > 1) }));
}

function reglesAgentsIaParRobot(reps, politique, liste, options) {
  const constats = [];
  const ajout = (code, gravite, cle, jeton, url, gabarit, conseil) => constats.push({ code, gravite, cle, jeton, url, gabarit, conseil });
  for (const rep of reps) {
    const robot = liste.robots.find((r) => r.jeton === rep.jeton);
    const voulu = politique && robot ? robots.attendu(politique, robot, options) : "autorise";
    if (rep.erreur || rep.statut !== 200) {
      const recu = rep.erreur || `le code ${rep.statut}`;
      if (voulu === "autorise") ajout("IA4", "haute", recu, rep.jeton, rep.url, (j, n) => `${j} reçoi${n ? "vent" : "t"} ${recu} sur ${rep.url} : un pare-feu ou l'hébergeur ${n ? "les" : "le"} refuse, quel que soit robots.txt.`, "Vérifier les réglages anti-robots de l'hébergeur ou du pare-feu (par exemple Cloudflare). Ce test imite le robot sans venir de ses adresses : un vrai robot peut être traité autrement.");
      continue;
    }
    if (!rep.html) continue;
    const nVisible = mots(rep.html.texteVisible);
    const nCache = mots(rep.html.texteCache);
    if (nVisible < 3 && nCache < 30) ajout("IA5", "haute", "vide", rep.jeton, rep.url, (j, n) => `${j} ne reçoi${n ? "vent" : "t"} presque aucun texte sur ${rep.url} : la plupart des robots IA n'exécutent pas JavaScript.`, "Produire le contenu des pages publiques côté serveur.");
    else if (nCache > 30 && nCache > nVisible * 2) ajout("IA5", "moyenne", "cache", rep.jeton, rep.url, (j, n) => `${j} reçoi${n ? "vent" : "t"} l'essentiel du texte dans des blocs cachés en fin de page (${rep.url}).`, "Placer le texte principal au-dessus de tout chargement progressif.");
    const head = (pred) => rep.html.liens.some((l) => pred(l) && l.section === "head");
    if ((rep.html.titres.length && !rep.html.titres.some((t) => t.section === "head")) || (rep.html.liens.some((l) => l.rel.includes("canonical")) && !head((l) => l.rel.includes("canonical")))) {
      ajout("IA6", "moyenne", "tete", rep.jeton, rep.url, (j, n) => `${j} reçoi${n ? "vent" : "t"} le titre ou l'adresse officielle hors de <head> (${rep.url}) : métadonnées envoyées en fin de page.`, "Rendre les métadonnées des pages publiques prérendables (consignes de la pile).");
    }
  }
  return constats;
}

/** IA7 : nosnippet non décidé. IA12 : JSON-LD conforme au texte visible. IA11 : faits clés. */
function reglesContenuIa(pages, fiche, ctx) {
  const constats = [];
  const html = pages.filter((p) => p.html && p.statut === 200);
  if (!fiche.nosnippetDecide) {
    for (const p of html) {
      const d = directives(p);
      if (d.nosnippet || d.maxSnippetZero) constats.push(c("IA7", "haute", "nosnippet (ou max-snippet:0) retire la page des extraits Google et des réponses IA de Google (AI Overviews, AI Mode).", "Retirer cette directive, ou noter la décision dans docs/seo.md (nosnippet: oui).", p.url));
      if (p.html.nosnippet > 0) constats.push(c("IA7", "moyenne", `${p.html.nosnippet} bloc(s) data-nosnippet : ce texte n'apparaîtra ni dans les extraits ni dans les réponses IA de Google.`, "Garder data-nosnippet pour du texte à exclure vraiment.", p.url));
    }
  }
  const normal = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const chiffres = (t) => String(t).replace(/\D/g, "");
  for (const p of html) {
    const texte = normal(p.html.texteVisible + " " + p.html.texteCache);
    const numeros = chiffres(p.html.texteVisible + " " + p.html.texteCache);
    for (const bloc of p.html.jsonLd) {
      for (const o of verifierJsonLd(bloc.brut || "", p.url, ctx).objets) {
        const ecarts = [];
        if (o.telephone && chiffres(o.telephone).length >= 6 && !numeros.includes(chiffres(o.telephone).slice(-8))) ecarts.push(`téléphone ${o.telephone}`);
        const adr = o.address && typeof o.address === "object" ? o.address : null;
        if (adr) for (const champ of ["streetAddress", "postalCode", "addressLocality"]) if (adr[champ] && !texte.includes(normal(adr[champ]))) ecarts.push(`${champ} « ${adr[champ]} »`);
        if (ecarts.length) constats.push(c("IA12", "moyenne", `Données structurées absentes du texte visible : ${ecarts.join(", ")}.`, "Afficher ces informations sur la page (Google exige que le balisage décrive le contenu visible).", p.url));
      }
    }
  }
  if (fiche.faits && fiche.faits.length && html.length) {
    const tout = normal(html.map((p) => p.html.texteVisible).join(" "));
    const absents = fiche.faits.filter((f) => !tout.includes(normal(f)));
    if (absents.length) constats.push(c("IA11", "basse", `Faits clés de docs/seo.md introuvables dans le texte des pages lues : ${absents.map((f) => `« ${f} »`).join(", ")}.`, "Écrire ces informations en clair (accueil ou « À propos ») : une IA ne cite que ce qu'elle lit.", html[0].url));
  }
  return constats;
}

/** IA10 : llms.txt, s'il existe. */
function regleLlms(rep) {
  if (!rep || rep.erreur || rep.statut === 404 || rep.statut === 410) return [];
  if (rep.statut !== 200) return [];
  const constats = [];
  if (rep.type && !/text\/(plain|markdown)/i.test(rep.type)) constats.push(c("IA10", "basse", `llms.txt servi en ${rep.type}.`, "Le servir en text/plain ou text/markdown.", rep.url));
  if (!/^\s*# \S/.test(rep.texte || "")) constats.push(c("IA10", "basse", "llms.txt sans titre « # » en première ligne (seul élément obligatoire du format).", "Commencer par « # Nom du site ». Rappel : Google n'utilise pas ce fichier.", rep.url));
  return constats;
}

// ---------------------------------------------------------------- Fiche docs/seo.md

/** Lit le bloc <!-- pulse-seo … --> de docs/seo.md. */
function lireFiche(texte) {
  const fiche = { trouvee: false, site: "public", adresse: null, politique: null, contentSignal: null, nosnippetDecide: false, bloquerMixte: false, faits: [], privees: [] };
  const m = String(texte || "").match(/<!--\s*pulse-seo\b([\s\S]*?)-->/);
  if (!m) return fiche;
  fiche.trouvee = true;
  for (const ligne of m[1].split(/\r?\n/)) {
    const x = ligne.match(/^\s*([a-z-]+)\s*:\s*(.*?)\s*$/i);
    if (!x) continue;
    const cle = x[1].toLowerCase();
    const v = x[2];
    if (!v) continue;
    if (cle === "site") fiche.site = /priv/i.test(v) ? "prive" : "public";
    else if (cle === "adresse" && /^https?:\/\//i.test(v)) fiche.adresse = v;
    else if (cle === "politique-ia" && /^[ABCD]$/i.test(v)) fiche.politique = v.toUpperCase();
    else if (cle === "content-signal" && !/^(non|aucun|-)$/i.test(v)) fiche.contentSignal = v;
    else if (cle === "nosnippet") fiche.nosnippetDecide = /^oui$/i.test(v);
    else if (cle === "amazonbot") fiche.bloquerMixte = /bloqu/i.test(v);
    else if (cle === "fait") fiche.faits.push(v);
    else if (cle === "privee") fiche.privees.push(v);
  }
  return fiche;
}

module.exports = {
  GRAVITES,
  QUESTIONS,
  CONTROLES,
  ESSENTIELS,
  ESSENTIELS_CRITIQUES_SEULS,
  DESCRIPTION_POLITIQUE,
  estHoteLocal,
  relationAdresse,
  normaliser,
  rapprocher,
  directives,
  verifierJsonLd,
  reglesPage,
  reglesSite,
  reglesAccueil,
  reglesRedirections,
  reglesVariantes,
  reglesRobots,
  reglesSitemap,
  regleSoft404,
  reglesLiens,
  regleImagePartage,
  reglePartageRobots,
  tailleImage,
  regleIcone,
  reglePrivee,
  reglePrevisualisation,
  regleGooglebot,
  reglesRobotsIa,
  reglesAgentsIa,
  reglesContenuIa,
  regleLlms,
  lireFiche,
};

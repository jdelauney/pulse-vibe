// Pulse – lecteur de HTML pour le référencement (seo.js), sans dépendance.
// Lit le HTML brut, tel que le reçoit un robot qui n'exécute pas JavaScript.
//
//   analyserHtml(html)  → { lang, titres, metas, liens, ancres, images, jsonLd, h1, texteVisible, texteCache, nosnippet, tailleOctets }
//   lireSitemap(xml)    → { estIndex, espaceDeNoms, urls: [{ loc, lastmod }], erreurs }
//   decoderEntites(t)   → texte avec les entités HTML remplacées
//
// Chaque balise relevée porte sa section : "head" ou "body". Une balise de <head> placée après le début
// du contenu (métadonnées envoyées en fin de page) est donc repérée comme étant dans <body>.
"use strict";

const VIDES = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const TEXTE_BRUT = new Set(["script", "style", "textarea", "title", "noscript", "xmp"]);
const PERMIS_DANS_HEAD = new Set(["html", "head", "title", "meta", "link", "script", "style", "base", "noscript", "template"]);
const ETRANGERS = new Set(["svg", "math"]);

const ENTITES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  hellip: "…", ndash: "–", mdash: "—", copy: "©", reg: "®", euro: "€", middot: "·", deg: "°",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", aacute: "á", acirc: "â", auml: "ä", ccedil: "ç", icirc: "î", iuml: "ï",
  ocirc: "ô", ouml: "ö", ugrave: "ù", ucirc: "û", uuml: "ü", oelig: "œ", aelig: "æ", yuml: "ÿ",
  Eacute: "É", Egrave: "È", Ecirc: "Ê", Agrave: "À", Acirc: "Â", Ccedil: "Ç", Icirc: "Î", Ocirc: "Ô", Ugrave: "Ù", Ucirc: "Û", OElig: "Œ",
};

function decoderEntites(texte) {
  return String(texte).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (tout, nom) => {
    if (nom[0] === "#") {
      const code = nom[1] === "x" || nom[1] === "X" ? parseInt(nom.slice(2), 16) : parseInt(nom.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : tout;
    }
    return Object.hasOwn(ENTITES, nom) ? ENTITES[nom] : tout;
  });
}

const espaces = (t) => t.replace(/\s+/g, " ").trim();

/** Découpe le HTML en jetons : balises ouvrantes, fermantes, texte. Les commentaires et le doctype sont ignorés. */
function jetons(html) {
  const resultat = [];
  const n = html.length;
  let i = 0;
  const texte = (t) => {
    if (t) resultat.push({ type: "texte", texte: t });
  };
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      texte(html.slice(i));
      break;
    }
    texte(html.slice(i, lt));
    if (html.startsWith("<!--", lt)) {
      const fin = html.indexOf("-->", lt + 4);
      i = fin === -1 ? n : fin + 3;
      continue;
    }
    const suivant = html[lt + 1];
    if (suivant === "!" || suivant === "?") {
      const fin = html.indexOf(">", lt);
      i = fin === -1 ? n : fin + 1;
      continue;
    }
    if (suivant === "/") {
      const m = /^<\/([a-zA-Z][\w:-]*)[^>]*>/.exec(html.slice(lt, lt + 200));
      if (m) {
        resultat.push({ type: "fermante", nom: m[1].toLowerCase() });
        i = lt + m[0].length;
      } else {
        texte("<");
        i = lt + 1;
      }
      continue;
    }
    if (!/[a-zA-Z]/.test(suivant || "")) {
      texte("<");
      i = lt + 1;
      continue;
    }
    // Nom de la balise
    let j = lt + 1;
    while (j < n && !/[\s/>]/.test(html[j])) j++;
    const nom = html.slice(lt + 1, j).toLowerCase();
    // Attributs
    const attrs = {};
    let autoFermee = false;
    while (j < n) {
      while (j < n && /\s/.test(html[j])) j++;
      if (html[j] === ">") {
        j++;
        break;
      }
      if (html[j] === "/") {
        if (html[j + 1] === ">") {
          autoFermee = true;
          j += 2;
          break;
        }
        j++;
        continue;
      }
      let k = j;
      while (k < n && !/[\s/>=]/.test(html[k])) k++;
      const nomAttr = html.slice(j, k).toLowerCase();
      j = k;
      while (j < n && /\s/.test(html[j])) j++;
      let valeur = "";
      if (html[j] === "=") {
        j++;
        while (j < n && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const fin = html.indexOf(q, j + 1);
          valeur = html.slice(j + 1, fin === -1 ? n : fin);
          j = fin === -1 ? n : fin + 1;
        } else {
          k = j;
          while (k < n && !/[\s>]/.test(html[k])) k++;
          valeur = html.slice(j, k);
          j = k;
        }
      }
      if (nomAttr && !Object.hasOwn(attrs, nomAttr)) attrs[nomAttr] = decoderEntites(valeur);
    }
    resultat.push({ type: "ouvrante", nom, attrs, autoFermee });
    i = j;
    if (TEXTE_BRUT.has(nom) && !autoFermee) {
      const motif = new RegExp(`</${nom}\\s*>`, "i");
      const reste = html.slice(i);
      const m = motif.exec(reste);
      const contenu = m ? reste.slice(0, m.index) : reste;
      resultat.push({ type: "brut", nom, texte: contenu });
      resultat.push({ type: "fermante", nom });
      i = m ? i + m.index + m[0].length : n;
    }
  }
  return resultat;
}

/** Les éléments repérés dans une page, avec leur section (head ou body). */
function analyserHtml(html) {
  const source = String(html || "");
  const page = {
    lang: null,
    titres: [],
    metas: [],
    liens: [],
    ancres: [],
    images: [],
    jsonLd: [],
    h1: [],
    nosnippet: 0,
    texteVisible: "",
    texteCache: "",
    tailleOctets: Buffer.byteLength(source, "utf8"),
  };
  let section = "head";
  const pile = []; // { nom, cache, etranger, capture: { cible, texte } }
  const visible = [];
  const cache = [];
  const cacheCourant = () => pile.some((e) => e.cache);
  const etrangerCourant = () => pile.some((e) => e.etranger);
  let jsonLdEnAttente = null;
  const ajouterTexte = (t) => {
    if (section === "head" && t.trim()) section = "body";
    if (section !== "body") return;
    const decode = decoderEntites(t);
    (cacheCourant() ? cache : visible).push(decode);
    for (const e of pile) if (e.capture) e.capture.texte += decode;
  };

  for (const j of jetons(source)) {
    if (j.type === "texte") {
      ajouterTexte(j.texte);
      continue;
    }
    if (j.type === "brut") {
      if (j.nom === "title" && !etrangerCourant()) page.titres.push({ texte: espaces(decoderEntites(j.texte)), section });
      if (j.nom === "script" && jsonLdEnAttente) {
        jsonLdEnAttente.brut = j.texte;
        jsonLdEnAttente = null;
      }
      if (j.nom === "textarea") ajouterTexte(j.texte);
      continue;
    }
    if (j.type === "fermante") {
      if (j.nom === "head" && section === "head") section = "body";
      const idx = pile.map((e) => e.nom).lastIndexOf(j.nom);
      if (idx === -1) continue;
      for (const e of pile.splice(idx)) if (e.capture) e.capture.fin();
      if (section === "body") visible.push(" ");
      continue;
    }
    // Balise ouvrante
    const { nom, attrs } = j;
    if (section === "head" && (nom === "body" || !PERMIS_DANS_HEAD.has(nom))) section = "body";
    if (nom === "html" && attrs.lang !== undefined) page.lang = attrs.lang;
    if (Object.hasOwn(attrs, "data-nosnippet")) page.nosnippet++;
    if (nom === "meta") {
      page.metas.push({
        name: (attrs.name || "").toLowerCase() || null,
        property: (attrs.property || "").toLowerCase() || null,
        httpEquiv: (attrs["http-equiv"] || "").toLowerCase() || null,
        content: attrs.content ?? null,
        section,
      });
    } else if (nom === "link") {
      page.liens.push({
        rel: (attrs.rel || "").toLowerCase().split(/\s+/).filter(Boolean),
        href: attrs.href ?? null,
        hreflang: attrs.hreflang ?? null,
        sizes: attrs.sizes ?? null,
        type: attrs.type ?? null,
        section,
      });
    } else if (nom === "img") {
      page.images.push({ src: attrs.src ?? null, alt: Object.hasOwn(attrs, "alt") ? attrs.alt : null });
    } else if (nom === "script" && (attrs.type || "").toLowerCase().trim() === "application/ld+json") {
      // Le contenu arrive au jeton « brut » qui suit.
      jsonLdEnAttente = { brut: "", section };
      page.jsonLd.push(jsonLdEnAttente);
    }
    if (VIDES.has(nom) || j.autoFermee) continue;
    const entree = { nom, cache: Object.hasOwn(attrs, "hidden") || nom === "template", etranger: ETRANGERS.has(nom), capture: null };
    if (nom === "a") {
      const ancre = { href: attrs.href ?? null, rel: (attrs.rel || "").toLowerCase(), texte: "" };
      page.ancres.push(ancre);
      entree.capture = { texte: "", fin() { ancre.texte = espaces(this.texte); } };
    } else if (nom === "h1") {
      const titre = { texte: "" };
      page.h1.push(titre);
      entree.capture = { texte: "", fin() { titre.texte = espaces(this.texte); } };
    }
    pile.push(entree);
  }
  for (const e of pile) if (e.capture) e.capture.fin();
  page.h1 = page.h1.map((h) => h.texte);
  page.texteVisible = espaces(visible.join(" "));
  page.texteCache = espaces(cache.join(" "));
  return page;
}

/** Lecture d'un sitemap XML (ou d'un index de sitemaps). */
function lireSitemap(xml) {
  const texte = String(xml || "");
  const resultat = { estIndex: false, espaceDeNoms: false, urls: [], erreurs: [] };
  const racine = texte.match(/<(urlset|sitemapindex)\b([^>]*)>/i);
  if (!racine) {
    resultat.erreurs.push("ni <urlset> ni <sitemapindex> : ce n'est pas un sitemap");
    return resultat;
  }
  resultat.estIndex = racine[1].toLowerCase() === "sitemapindex";
  resultat.espaceDeNoms = /xmlns\s*=\s*["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(racine[2]);
  const bloc = resultat.estIndex ? "sitemap" : "url";
  const motif = new RegExp(`<${bloc}\\b[^>]*>([\\s\\S]*?)</${bloc}>`, "gi");
  for (const m of texte.matchAll(motif)) {
    const loc = (m[1].match(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/i) || [])[1];
    const lastmod = (m[1].match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i) || [])[1] || null;
    if (!loc) {
      resultat.erreurs.push(`un élément <${bloc}> sans <loc>`);
      continue;
    }
    resultat.urls.push({ loc: decoderEntites(loc.trim()), lastmod });
  }
  if (!/<\/(urlset|sitemapindex)>\s*$/i.test(texte.trim())) resultat.erreurs.push("balise de fin absente : fichier tronqué ?");
  return resultat;
}

module.exports = { analyserHtml, lireSitemap, decoderEntites, jetons };

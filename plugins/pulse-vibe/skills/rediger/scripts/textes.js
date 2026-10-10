#!/usr/bin/env node
// Pulse – contrôle des tics d'écriture IA dans un texte (pulse-aidd textes, /pulse:rediger).
//
//   pulse-aidd textes verifier <fichier|-> [--json]
//
// Règles : references/redaction/detecteur-tics-llm.json, seule source des listes.
// Un fichier au modèle docs/textes/<page>.md n'est contrôlé qu'entre <!-- texte --> et <!-- /texte -->
// (chaque bloc). Un constat faux se garde sur sa ligne : <!-- garder LEX-007 : sens littéral -->.
// Codes de sortie : 0 aucune erreur ; 1 au moins une erreur ; 2 usage ou fichier illisible.
"use strict";

const fs = require("fs");
const path = require("path");

const DETECTEUR = path.join(__dirname, "..", "references", "detecteur-tics-llm.json");
// Règles qui demandent un jugement : la commande les relit (references/redaction/regles.md).
const A_RELIRE = ["SYN-004", "LIM-003", "PAT-004", "INJ-003", "BIA-003"];
// Listes du détecteur cherchées telles quelles dans le texte.
const LISTES = ["mots", "expressions", "structures", "marqueurs", "indices", "signaux", "binomes_types", "introductions_suspectes", "adjectifs_suspects", "metaphores_generiques"];
// Règles dont le premier mot de chaque entrée est un verbe, cherché conjugué.
const VERBES = new Set(["LEX-002", "LEX-007", "LEX-008"]);
// Règles traitées par un détecteur propre (voir DETECTEURS dans verifier).
const PROPRES = ["TYP-001", "TYP-002", "TYP-003", "TYP-004", "TYP-005", "PON-001", "PON-002", "LIM-001", "LIM-002", "INJ-001", "INJ-002", "SYN-001"];
const MOT = "[\\p{L}\\d'-]+";
// Début de mot : ni lettre, ni chiffre, ni trait d'union avant ; une apostrophe seulement après une élision (l', d', qu'…).
const AVANT = "(?<![\\p{L}\\d-])(?:(?<!')|(?<=(?:^|[^\\p{L}])(?:[ldjmnstc]|qu|jusqu|lorsqu|puisqu)'))";
// Fin de mot : rien de lettre ou chiffre après, sauf si le motif finit par une élision (« d' »).
const APRES = "(?:(?<=')|(?![\\p{L}\\d]))";
// Début de phrase : début du texte ou d'une ligne, après une ponctuation finale, une puce de liste ou un guillemet ouvrant.
const DEBUT_DE_PHRASE = "(?<=^|[.!?…]\\s+|\\n|(?:^|\\n)\\s*(?:[-*+]|\\d+[.)])\\s+|«\\s*)";
// Mots en -ant qui ne sont pas des participes présents.
const PAS_PARTICIPES = new Set(["avant", "pendant", "durant", "maintenant", "cependant", "suivant", "devant", "auparavant", "autant", "tant", "quant", "néant", "enfant", "enfants"]);
const PUCE = /^\s*([-*+]|\d+[.)])?\s*$/;
// Expressions qui ont aussi un sens ordinaire : ce qui les écarte avant ou après.
const SAUF = { "de plus": { avant: "(?<!(?:fois|jour|rien|bien|encore)\\s)", apres: "(?=\\s*,)" } };
// Terminaisons des verbes (le radical vient du détecteur).
const FINS = {
  er: "e|es|ent|ons|ez|ais|ait|aient|ions|iez|a|as|ai|èrent|é|ée|és|ées|er|era|eras|erai|erons|erez|eront|erait|eraient",
  ir: "i|is|it|issons|issez|issent|issais|issait|issaient|ira|iras|irons|irez|iront|irait|ir|e|es|ent|ons|ez|ait|aient",
  ttre: "s|tons|tez|tent|tais|tait|taient|tra|tras|trons|trez|tront|trait|traient|tre",
  re: "s|t|vons|vez|vent|vait|vaient|ra|ront|rait|re|te|ts|tes",
};
// Petits mots qui s'élident devant une voyelle.
const ELISIONS = { de: "d", que: "qu", le: "l", la: "l" };

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Même longueur que l'original pour l'apostrophe ; les sauts de ligne ne bougent pas.
const normaliser = (s) => s.normalize("NFC").replace(/[’ʼ]/g, "'").replace(/œ/g, "oe").replace(/Œ/g, "Oe");

/** « offrir (sens figuré) » → { texte: "offrir", precision: "sens figuré" } */
function decomposer(entree) {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(entree);
  return m ? { texte: m[1].trim(), precision: m[2].trim() } : { texte: entree.trim(), precision: null };
}

/** Un verbe du détecteur, conjugué (« s'avérer » : s'avère, s'est avéré ; « permettre » : permet, permis). */
function motifVerbe(mot) {
  let prefixe = "";
  let verbe = mot;
  if (/^s'/.test(mot)) {
    prefixe = "s(?:'|e\\s+)(?:(?:est|était|sont|étaient)\\s+)?";
    verbe = mot.slice(2);
  }
  const v = /^(.+?)(er|ir|ttre|re)$/.exec(verbe);
  if (!v || verbe.length <= 4) return null;
  // é devant la dernière consonne devient è dans certaines formes (avérer → avère).
  const radical = echapper(v[2] === "ttre" ? `${v[1]}t` : v[1]).replace(/é([^aeiouyéèêëàâîïôûù]+)$/, "[éè]$1");
  const conjugue = `${radical}(?:${FINS[v[2]]})${v[2] === "ttre" ? "?" : ""}`;
  const participe = v[2] === "ttre" ? `|${echapper(v[1].slice(0, -1))}(?:is|ise|ises)` : "";
  return `${prefixe}(?:${conjugue}${participe})`;
}

/** Un mot du détecteur : nom ou adjectif accordé ; petit mot élidé ; marque de place. */
function motifMot(mot) {
  if (mot === "@") return `(?:${MOT}\\s*){1,3}`; // marque de place (X, Y du détecteur)
  if (ELISIONS[mot.toLowerCase()]) return `(?:${echapper(mot)}(?![\\p{L}\\d])|${ELISIONS[mot.toLowerCase()]}')`;
  if (mot.length <= 3) return echapper(mot);
  if (/al$/.test(mot)) return `${echapper(mot.slice(0, -2))}(?:al|ale|als|ales|aux)`;
  if (/el$/.test(mot)) return `${echapper(mot)}(?:le|les|s)?`;
  if (/eur$/.test(mot)) return `${echapper(mot.slice(0, -3))}(?:eur|euse|rice)s?`;
  if (/if$/.test(mot)) return `${echapper(mot.slice(0, -1))}(?:f|fs|ve|ves)`;
  return `${echapper(mot)}(?:e|s|es|x)?`;
}

/**
 * Une partie d'expression : mots, ponctuation, alternatives « aussi/également ».
 * `verbe` : le premier mot est un verbe, cherché conjugué.
 * `souple` : jusqu'à trois mots peuvent s'intercaler (« mais elle permet également »).
 */
function motifPartie(partie, verbe, souple = false) {
  const morceaux = [];
  const texte = partie.replace(/(^|\s)[A-Z](?=[\s,;:]|$)/g, "$1@");
  let premier = true;
  for (const jeton of texte.split(/\s+/).filter(Boolean)) {
    const m = /^([^\p{L}\d@]*)([\p{L}\d@][\p{L}\d'/-]*)?([^\p{L}\d]*)$/u.exec(jeton);
    if (!m) {
      morceaux.push(echapper(jeton));
      continue;
    }
    if (m[1]) morceaux.push(echapper(m[1]));
    if (m[2]) {
      const un = (x) => (verbe && premier && motifVerbe(x)) || motifMot(x);
      morceaux.push(m[2].includes("/") ? `(?:${m[2].split("/").map(un).join("|")})` : un(m[2]));
      premier = false;
    }
    if (m[3]) morceaux.push(echapper(m[3]));
  }
  return morceaux.join(souple ? `\\s*(?:${MOT}\\s+){0,3}` : "\\s*");
}

/** Motif d'une entrée : les parties séparées par « ... » se suivent dans la même phrase. */
function motifEntree(texte, verbe, souple = false) {
  const parties = texte
    .split(/\.\.\.|…/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parties.length) return null;
  const sauf = SAUF[texte.toLowerCase()] || { avant: "", apres: "" };
  return sauf.avant + parties.map((p) => motifPartie(p, verbe, souple)).join("[^.!?\\n]{0,160}?") + sauf.apres;
}

/**
 * Le texte à contrôler, de même longueur que le fichier (les numéros de ligne restent justes) :
 * hors des blocs <!-- texte --> (s'il y en a), les commentaires et les blocs de code deviennent des blancs.
 */
function corps(brut) {
  const t = normaliser(brut.replace(/\r\n/g, "\n"));
  const blanc = (s) => s.replace(/[^\n]/g, " ");
  let texte = t;
  if (t.includes("<!-- texte -->")) {
    texte = blanc(t);
    for (const m of t.matchAll(/<!-- texte -->([\s\S]*?)(?:<!-- \/texte -->|$)/g)) {
      const debut = m.index + "<!-- texte -->".length;
      texte = texte.slice(0, debut) + m[1] + texte.slice(debut + m[1].length);
    }
  }
  texte = texte.replace(/<!--[\s\S]*?-->/g, blanc).replace(/```[\s\S]*?```/g, blanc);
  return { texte, original: t };
}

/** Les constats gardés : <!-- garder LEX-007, PON-001 : raison --> sur la ligne du constat. */
function gardesParLigne(original) {
  const gardes = new Map();
  original.split("\n").forEach((l, i) => {
    for (const m of l.matchAll(/<!--\s*garder\s+([A-Z]{3}-\d{3}(?:\s*,\s*[A-Z]{3}-\d{3})*)\s*:\s*(.*?)\s*-->/g))
      gardes.set(i + 1, [...(gardes.get(i + 1) || []), { regles: m[1].split(/\s*,\s*/), raison: m[2] }]);
  });
  return gardes;
}

/** Paragraphes (séparés par une ligne vide), avec leur nature et leurs phrases. */
function decouper(texte) {
  const paragraphes = [];
  let index = 0;
  for (const bloc of texte.split(/\n[ \t]*\n/)) {
    const debut = texte.indexOf(bloc, index);
    index = debut + bloc.length;
    const lignes = bloc.split("\n").filter((l) => l.trim());
    if (!lignes.length) continue;
    const liste = lignes.every((l) => /^\s*([-*+]|\d+[.)])\s/.test(l));
    // Un bouton ou un lien seul sur sa ligne n'est pas une phrase.
    const bouton = lignes.every((l) => /^\s*\[[^\]]*\](\([^)]*\))?\s*$/.test(l));
    // Une ligne seule, courte, sans ponctuation finale, est un titre même sans « # ».
    const titreNu = !liste && !bouton && lignes.length === 1 && !/^\s*#/.test(lignes[0]) && !/[.!?…:;,»")\]]\s*$/.test(lignes[0]) && motsDe(lignes[0]).length <= 12;
    const titre = titreNu || lignes.every((l) => /^\s*#{1,6}\s/.test(l));
    const prose = lignes
      .filter((l) => !/^\s*#{1,6}\s/.test(l))
      .join(" ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
    const phrases = titre || liste || bouton || !prose ? [] : prose.split(/(?<=[.!?…])\s+(?=[«"\p{Lu}\d—-])/u).filter((p) => /\p{L}/u.test(p));
    paragraphes.push({ debut, bloc, titre, titreNu, liste, phrases });
  }
  return paragraphes;
}

const motsDe = (s) => s.match(/[\p{L}\d][\p{L}\d'-]*/gu) || [];
// Petits mots qu'un titre en français n'écrit pas avec une majuscule.
const MOTS_OUTILS = new Set(["les", "le", "la", "des", "du", "de", "dans", "pour", "votre", "vos", "notre", "nos", "avec", "sur", "par", "et", "en", "au", "aux", "un", "une", "ce", "cette", "ces", "qui", "que", "leur", "leurs", "sans", "sous", "entre", "vers", "chez"]);

function verifier(brut, detecteur = JSON.parse(fs.readFileSync(DETECTEUR, "utf8"))) {
  const { texte, original } = corps(brut);
  const ligne = (i) => texte.slice(0, i).split("\n").length;
  const paragraphes = decouper(texte);
  const phrases = paragraphes.flatMap((p) => p.phrases);
  const constats = [];
  const noter = (regle, severite, i, extrait, ajout = "") =>
    constats.push({ regle: regle.id, label: regle.label, severite, ligne: ligne(i), extrait: extrait.trim().slice(0, 80), consigne: regle.regle + ajout, position: i });

  function chercherListe(regle, entrees, verbe = false, prefixe = "", souple = false) {
    for (const entree of entrees) {
      const { texte: e, precision } = decomposer(normaliser(entree));
      const enDebut = precision && /début de (phrase|paragraphe)/.test(precision);
      const motif = motifEntree(e, verbe, souple);
      if (!motif) continue;
      // Avec un préfixe (« , » de PAT-001), la virgule sert elle-même de limite.
      const limite = enDebut ? DEBUT_DE_PHRASE : prefixe ? "" : AVANT;
      const re = new RegExp(`${limite}${prefixe}${motif}${APRES}`, "giu");
      for (const m of texte.matchAll(re)) noter(regle, precision && !enDebut ? "avertissement" : regle.severite, m.index, m[0]);
    }
  }

  const DETECTEURS = {
    "TYP-001": (r) => {
      const titres = [...texte.matchAll(/^\s*#{1,6}\s+(.+)$/gm)].map((m) => ({ index: m.index, 1: m[1] }));
      for (const p of paragraphes.filter((x) => x.titreNu)) titres.push({ index: p.debut, 1: p.bloc.trim() });
      for (const m of titres) {
        const suite = motsDe(m[1]).slice(1);
        const outils = suite.filter((x) => /^\p{Lu}/u.test(x) && MOTS_OUTILS.has(x.toLowerCase()));
        const longs = suite.filter((x) => x.length > 3);
        const majuscules = longs.filter((x) => /^\p{Lu}\p{Ll}/u.test(x));
        // Des petits mots en majuscule : title case. Sinon, des majuscules peuvent être des noms propres.
        if (outils.length) noter(r, r.severite, m.index, m[1]);
        else if (majuscules.length >= 2 && majuscules.length * 2 >= longs.length) noter(r, "avertissement", m.index, m[1], " (sauf noms propres)");
      }
    },
    "TYP-002": (r) => {
      for (const m of texte.matchAll(/(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}/gu)) noter(r, r.severite, m.index, texte.slice(m.index, m.index + 30));
    },
    "TYP-003": (r) => {
      const max = r.parametres?.max ?? 3;
      const gras = [...texte.matchAll(/\*\*[^*\n]+\*\*/g)];
      if (gras.length > max) noter(r, r.severite, gras[max].index, gras[max][0], ` (${gras.length} passages en gras)`);
    },
    "TYP-004": (r) => {
      // Un nom propre peut suivre les deux-points : avertissement seulement.
      for (const m of texte.matchAll(/[^\s:/]\s?:\s+(\p{Lu}\p{Ll}+)/gu)) noter(r, "avertissement", m.index, m[0], " (sauf nom propre)");
    },
    "TYP-005": (r) => {
      const max = r.parametres?.max ?? 2;
      const listes = paragraphes.filter((p) => p.liste);
      if (listes.length > max) noter(r, r.severite, listes[max].debut, listes[max].bloc, ` (${listes.length} listes)`);
      chercherListe(r, r.parametres?.introductions_suspectes || []);
    },
    "PON-001": (r) => {
      // Une vraie énumération a au moins trois éléments avant « et » (« A, B, C, et D ») : erreur.
      // Avec deux éléments, la virgule peut fermer une incise (« Marie, notre gérante, et Paul ») : avertissement.
      for (const p of paragraphes) {
        for (const m of p.bloc.matchAll(/,\s+(et|ou)\s/g)) {
          const virgules = (p.bloc.slice(0, m.index).split(/[.!?…]\s/).pop().match(/,/g) || []).length;
          if (virgules) noter(r, virgules >= 2 ? r.severite : "avertissement", p.debut + m.index, p.bloc.slice(Math.max(0, m.index - 30), m.index + 10));
        }
      }
    },
    "PON-002": (r) => {
      for (const m of texte.matchAll(/—/g)) {
        const debutLigne = texte.lastIndexOf("\n", m.index) + 1;
        if (PUCE.test(texte.slice(debutLigne, m.index))) continue; // réplique de dialogue, éventuellement dans une liste
        noter(r, r.severite, m.index, texte.slice(Math.max(0, m.index - 20), m.index + 20));
      }
    },
    "LIM-001": (r) => {
      const element = `${MOT}(?:\\s+${MOT}){0,3}`;
      const trio = new RegExp(`(?<!,\\s*)${AVANT}(${element}),\\s+(${element})\\s+et\\s+(${element})(?![\\p{L}\\d])`, "gu");
      const trouves = [];
      for (const p of paragraphes) for (const m of p.bloc.matchAll(trio)) trouves.push({ i: p.debut + m.index, extrait: m[0] });
      for (const t of trouves.slice(r.parametres?.max ?? 1)) noter(r, r.severite, t.i, t.extrait, ` (${trouves.length} énumérations par trois)`);
    },
    "LIM-002": (r) => {
      const min = r.parametres?.longueur_serie_min ?? 3;
      for (const p of paragraphes) {
        const premiers = p.phrases.map((x) => (motsDe(x)[0] || "").toLowerCase());
        let serie = 1;
        for (let i = 1; i <= premiers.length; i++) {
          if (i < premiers.length && premiers[i] && premiers[i] === premiers[i - 1]) serie++;
          else {
            if (serie >= min) noter(r, r.severite, p.debut, p.phrases[i - serie], ` (${serie} phrases commencent par « ${premiers[i - 1]} »)`);
            serie = 1;
          }
        }
      }
    },
    "INJ-001": (r) => {
      const [, n, sur] = /(\d+)\D+(\d+)/.exec(r.parametres.ratio_min) || [null, 1, 4];
      const motif = motifConnecteurs(r);
      for (const p of paragraphes) {
        if (p.phrases.length < Number(sur)) continue;
        const nombre = (p.phrases.join(" ").match(motif) || []).length;
        // « 1 connecteur pour 4 phrases » : 1 attendu de 4 à 7 phrases, 2 de 8 à 11…
        if (nombre < Math.floor((p.phrases.length * Number(n)) / Number(sur))) noter(r, r.severite, p.debut, p.phrases[0], ` (${nombre} connecteur(s) pour ${p.phrases.length} phrases)`);
      }
    },
    "INJ-002": (r) => {
      if (phrases.length < 8) return;
      const seuil = Number((/(\d+)\s*%/.exec(r.parametres.seuil_alerte) || [0, 15])[1]);
      const courtes = phrases.filter((x) => motsDe(x).length < 10).length;
      if ((courtes * 100) / phrases.length < seuil) noter(r, r.severite, 0, phrases[0], ` (${courtes} phrase(s) courte(s) sur ${phrases.length})`);
    },
    "SYN-001": (r) => {
      // Participe présent détaché suivi d'un complément : heuristique, avertissement seulement.
      const motif = /(?:^|,\s*)(\p{L}+ant)\s+(?:ainsi\s+)?(?:le|la|les|l'|un|une|des|de|du|d'|à|au|aux|en|leur|leurs|son|sa|ses|ce|cette|ces|notre|nos|votre|vos)(?=[\s'])/giu;
      for (const p of paragraphes)
        for (const m of p.bloc.matchAll(motif)) if (!PAS_PARTICIPES.has(m[1].toLowerCase())) noter(r, "avertissement", p.debut + m.index, m[0]);
    },
  };

  function motifConnecteurs(regle) {
    const connecteurs = Object.values(regle?.parametres?.connecteurs_par_relation || {})
      .flat()
      .map(normaliser);
    return connecteurs.length ? new RegExp(`${AVANT}(?:${connecteurs.map((c) => motifPartie(c, false)).join("|")})${APRES}`, "giu") : null;
  }

  for (const regle of detecteur.regles.filter((x) => x.actif)) {
    if (DETECTEURS[regle.id]) {
      DETECTEURS[regle.id](regle);
      continue;
    }
    const p = regle.parametres || {};
    const verbe = VERBES.has(regle.id);
    const prefixe = regle.id === "PAT-001" ? ",\\s*(?:ainsi\\s+)?" : "";
    for (const cle of LISTES) if (Array.isArray(p[cle])) chercherListe(regle, p[cle], verbe, prefixe, cle === "structures");
    if (p.calques) {
      for (const [calque, remplacement] of Object.entries(p.calques)) {
        const avant = constats.length;
        chercherListe(regle, [calque], verbe);
        for (const c of constats.slice(avant)) c.consigne += ` → ${remplacement}`;
      }
    }
  }

  // Les constats gardés par un commentaire sur leur ligne sortent du compte, avec leur raison.
  const parLigne = gardesParLigne(original);
  const gardes = [];
  // Un même passage relevé par deux règles n'est signalé qu'une fois, sous la plus sévère.
  const parPassage = new Map();
  for (const c of constats) {
    const cle = `${c.position}:${c.extrait.toLowerCase()}`;
    const deja = parPassage.get(cle);
    if (!deja || (deja.severite !== "erreur" && c.severite === "erreur")) parPassage.set(cle, c);
  }
  const uniques = [...parPassage.values()].map(({ position, ...c }) => c);
  const restants = uniques.filter((c) => {
    const garde = (parLigne.get(c.ligne) || []).find((g) => g.regles.includes(c.regle));
    if (garde) gardes.push({ ...c, raison: garde.raison });
    return !garde;
  });

  const longueurs = phrases.map((x) => motsDe(x).length);
  const moyenne = longueurs.length ? longueurs.reduce((a, b) => a + b, 0) / longueurs.length : 0;
  const motifTous = motifConnecteurs(detecteur.regles.find((x) => x.id === "INJ-001"));
  const mesures = {
    mots: motsDe(
      paragraphes
        .filter((x) => !x.titre)
        .map((x) => x.bloc)
        .join(" "),
    ).length,
    phrases: phrases.length,
    longueurMoyenne: Math.round(moyenne * 10) / 10,
    ecartType: longueurs.length ? Math.round(Math.sqrt(longueurs.reduce((a, b) => a + (b - moyenne) ** 2, 0) / longueurs.length) * 10) / 10 : 0,
    partCourtes: longueurs.length ? Math.round((longueurs.filter((x) => x < 10).length * 100) / longueurs.length) : 0,
    connecteurs: motifTous ? (phrases.join(" ").match(motifTous) || []).length : 0,
  };
  restants.sort((a, b) => a.ligne - b.ligne || a.regle.localeCompare(b.regle));
  const aRelire = detecteur.regles.filter((x) => x.actif && A_RELIRE.includes(x.id)).map((x) => ({ regle: x.id, label: x.label }));
  return {
    constats: restants,
    gardes,
    mesures,
    erreurs: restants.filter((c) => c.severite === "erreur").length,
    avertissements: restants.filter((c) => c.severite === "avertissement").length,
    aRelire,
  };
}

/** Règles actives qui n'ont ni liste, ni détecteur propre, ni place dans « à relire ». */
function reglesSansDetecteur(detecteur) {
  return detecteur.regles
    .filter((r) => r.actif)
    .filter((r) => !PROPRES.includes(r.id) && !A_RELIRE.includes(r.id))
    .filter((r) => !LISTES.some((cle) => Array.isArray((r.parametres || {})[cle])) && !(r.parametres || {}).calques)
    .map((r) => r.id);
}

function principal(args) {
  const [action, cible, option] = args;
  if (action !== "verifier" || !cible) {
    process.stdout.write("Usage : pulse-aidd textes verifier <fichier|-> [--json]\n");
    return 2;
  }
  let brut;
  try {
    brut = fs.readFileSync(cible === "-" ? 0 : cible, "utf8");
  } catch (e) {
    process.stdout.write(`Fichier illisible : ${cible}\n`);
    return 2;
  }
  const r = verifier(brut);
  if (option === "--json") {
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    return r.erreurs ? 1 : 0;
  }
  const m = r.mesures;
  const lignes = [`${cible} : ${r.erreurs} erreur(s), ${r.avertissements} avertissement(s) (${m.mots} mots, ${m.phrases} phrases)`];
  for (const c of r.constats) lignes.push(`  ${c.severite.padEnd(13)} ${c.regle} ${c.label}, ligne ${c.ligne} : « ${c.extrait} » → ${c.consigne}`);
  for (const g of r.gardes) lignes.push(`  gardé         ${g.regle} ${g.label}, ligne ${g.ligne} : « ${g.extrait} » (raison : ${g.raison})`);
  lignes.push(`Mesures : longueur moyenne ${m.longueurMoyenne} mots (écart ${m.ecartType}), ${m.partCourtes} % de phrases courtes, ${m.connecteurs} connecteur(s).`);
  lignes.push(`À relire : ${r.aRelire.map((x) => `${x.regle} ${x.label}`).join(" ; ")}.`);
  lignes.push(r.erreurs ? "ÉCHEC : corriger les erreurs (ou garder un constat faux avec sa raison) puis relancer." : "CONTRÔLE RÉUSSI (avertissements à juger).");
  process.stdout.write(`${lignes.join("\n")}\n`);
  return r.erreurs ? 1 : 0;
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { verifier, reglesSansDetecteur };

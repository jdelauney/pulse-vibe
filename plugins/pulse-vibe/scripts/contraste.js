#!/usr/bin/env node
// Pulse – rapport de contraste WCAG entre deux couleurs (pulse-aidd contraste).
//
//   pulse-aidd contraste <couleur> <fond> [--viser <rapport>] [--json]
//
// Couleurs : #rgb, #rrggbb, rgb(r g b), rgb(r, g, b), oklch(L C H) (L de 0 à 1 ou en %),
// avec une transparence facultative (« / 50% ») pour la première couleur, posée sur le fond.
// --viser 4.5 : propose la luminosité OKLCH de la première couleur (même teinte, même chroma)
// qui atteint ce rapport sur le fond.
// Sortie : le rapport exact (arrondi vers le bas à deux décimales) et les seuils WCAG 2.2 atteints.
"use strict";

const SEUILS = [
  { rapport: 4.5, libelle: "texte courant (AA, 1.4.3)" },
  { rapport: 3, libelle: "grand texte, 24 px ou 18,66 px gras (AA, 1.4.3)" },
  { rapport: 3, libelle: "contour de champ, focus, icône utile (AA, 1.4.11)" },
  { rapport: 7, libelle: "texte courant renforcé (AAA, 1.4.6)" },
];

const nombre = (t) => {
  const s = String(t).trim();
  if (!/^-?(\d+\.?\d*|\.\d+)%?$/.test(s)) throw new Error(`nombre illisible : ${t}`);
  return s.endsWith("%") ? Number(s.slice(0, -1)) / 100 : Number(s);
};

/** sRGB gamma (0..1) → linéaire, formule de WCAG 2.2 (seuil 0,04045). */
const lineaire = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** linéaire → sRGB gamma (0..1). */
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const borner = (c) => Math.min(1, Math.max(0, c));

/** OKLCH → sRGB gamma (0..1), d'après les matrices de Björn Ottosson (CSS Color 4). Hors gamut : ramené dans [0, 1]. */
function oklchVersRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  return [r, g, bl].map((c) => borner(gamma(c)));
}

/** Lit une couleur : { rgb: [r, g, b] en 0..1 (gamma), alpha, oklch?: [L, C, H] }. */
function lireCouleur(texte) {
  const t = String(texte || "").trim().toLowerCase();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
    return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), alpha: 1 };
  }
  m = /^(rgba?|oklch)\(\s*([^)]*)\)$/.exec(t);
  if (!m) throw new Error(`couleur illisible : « ${texte} ». Formes acceptées : #1a2b3c, rgb(26 43 60), oklch(0.55 0.18 250).`);
  const [valeurs, transparence] = m[2].split("/").map((x) => x.trim());
  const parties = valeurs.split(/[\s,]+/).filter(Boolean);
  if (parties.length !== 3) throw new Error(`trois valeurs attendues dans « ${texte} »`);
  const alpha = transparence === undefined ? 1 : borner(nombre(transparence));
  if (m[1] === "oklch") {
    const L = borner(nombre(parties[0]));
    const C = Math.max(0, nombre(parties[1]));
    const H = parties[2] === "none" ? 0 : nombre(parties[2].replace(/deg$/, ""));
    return { rgb: oklchVersRgb(L, C, H), alpha, oklch: [L, C, H] };
  }
  const rgb = parties.map((p) => (p.endsWith("%") ? nombre(p) : nombre(p) / 255)).map(borner);
  return { rgb, alpha };
}

const luminance = ([r, g, b]) => 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b);

/** Couleur (éventuellement transparente) posée sur un fond opaque : la couleur vue, opaque (mélange en sRGB, comme le navigateur). */
function poser(couleur, fond) {
  if (fond.alpha < 1) throw new Error("le fond doit être opaque (sans « / … »)");
  return { rgb: couleur.rgb.map((c, i) => c * couleur.alpha + fond.rgb[i] * (1 - couleur.alpha)), alpha: 1 };
}

/** Rapport de contraste WCAG entre une couleur (éventuellement transparente) et un fond opaque. */
function rapport(couleur, fond) {
  const [a, b] = [luminance(poser(couleur, fond).rgb), luminance(fond.rgb)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** Arrondi vers le bas : 2,999 reste sous 3. */
const tronquer = (x) => Math.floor(x * 100) / 100;

/** Luminosité OKLCH la plus proche de l'actuelle qui atteint `cible` sur le fond (même chroma, même teinte). */
function viser(couleur, fond, cible) {
  if (!couleur.oklch) throw new Error("--viser demande une première couleur en oklch(…)");
  const [L0, C, H] = couleur.oklch;
  const essai = (L) => rapport({ rgb: oklchVersRgb(L, C, H), alpha: couleur.alpha }, fond);
  let meilleure = null;
  for (let i = 0; i <= 1000; i++) {
    const L = i / 1000;
    if (essai(L) >= cible && (meilleure === null || Math.abs(L - L0) < Math.abs(meilleure - L0))) meilleure = L;
  }
  if (meilleure === null) return null;
  return { L: meilleure, valeur: `oklch(${meilleure} ${C} ${H})`, rapport: tronquer(essai(meilleure)) };
}

function analyser(texteCouleur, texteFond, cible) {
  const couleur = lireCouleur(texteCouleur);
  const fond = lireCouleur(texteFond);
  const exact = rapport(couleur, fond);
  const resultat = {
    couleur: texteCouleur,
    fond: texteFond,
    rapport: tronquer(exact),
    exact,
    seuils: SEUILS.map((s) => ({ ...s, atteint: exact >= s.rapport })),
  };
  if (cible !== undefined) resultat.proposition = viser(couleur, fond, cible);
  return resultat;
}

function principal(argv) {
  const json = argv.includes("--json");
  const i = argv.indexOf("--viser");
  const cible = i >= 0 ? nombre(argv[i + 1]) : undefined;
  const positionnels = argv.filter((a, k) => !a.startsWith("--") && !(i >= 0 && k === i + 1));
  if (positionnels.length !== 2) {
    console.log("Usage : pulse-aidd contraste <couleur> <fond> [--viser <rapport>] [--json]\nExemple : pulse-aidd contraste \"oklch(0.556 0 0)\" \"#ffffff\"");
    return 1;
  }
  let r;
  try {
    r = analyser(positionnels[0], positionnels[1], cible);
  } catch (e) {
    console.log(`❌ ${e.message}`);
    return 1;
  }
  if (json) {
    console.log(JSON.stringify(r, null, 2));
    return 0;
  }
  console.log(`Contraste : ${r.rapport.toFixed(2)}:1 (${r.couleur} sur ${r.fond})`);
  for (const s of r.seuils) console.log(`  ${s.atteint ? "✅" : "❌"} ${s.rapport}:1 – ${s.libelle}`);
  if (cible !== undefined)
    console.log(r.proposition ? `➡️ Pour ${cible}:1 : ${r.proposition.valeur} (${r.proposition.rapport.toFixed(2)}:1)` : `➡️ ${cible}:1 est hors d'atteinte avec cette teinte et ce chroma sur ce fond.`);
  return 0;
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { lireCouleur, poser, rapport, analyser, viser, tronquer };

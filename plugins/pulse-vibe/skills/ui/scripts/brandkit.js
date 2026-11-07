#!/usr/bin/env node
// Pulse – le brandkit d'une identité visuelle (/pulse:ui) : brandkit.json, source unique de ses valeurs.
//
//   pulse-aidd brandkit planche <dossier>             vérifie <dossier>/brandkit.json, puis écrit <dossier>/planche.html (modèle assets/planche.html)
//   pulse-aidd brandkit verifier [fichier|dossier]    vérifie seulement : schéma, couleurs en OKLCH, contrastes mesurés
//   pulse-aidd brandkit css [fichier|dossier]         le bloc à coller dans le <head> d'une maquette : polices, variables (:root), styles de base
//   pulse-aidd brandkit resume [fichier|dossier]      les sections 6 à 8 de docs/design.md (couleur, typographie, espacements), en Markdown
//   pulse-aidd brandkit oklch <couleur>               convertit une couleur (#hex, rgb()) en oklch(), avec son hexadécimal affiché
//
// Sans chemin : docs/design/identite/retenue/brandkit.json, l'identité retenue du projet.
// Couleurs : toujours oklch(L C H) ; l'hexadécimal est calculé pour information.
// Codes : 0 sans 🔴 ; 1 au moins un 🔴 (planche : rien n'est écrit) ; 2 usage ou fichier introuvable.
"use strict";

const fs = require("fs");
const path = require("path");
const { lireCouleur, rapport, viser, tronquer, oklchVersRgb, horsGamme, lineaire } = require("./contraste.js");
const { policesReflexes } = require("./maquettes.js");

const DEFAUT = path.join("docs", "design", "identite", "retenue", "brandkit.json");
const MODELE = path.join(__dirname, "..", "assets", "planche.html");

const RANGS_REQUIS = ["100", "300", "500", "700", "900"];
const RANGS_PERMIS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const STRATEGIES = ["Sobre avec une touche", "Une couleur affirmée", "Plusieurs couleurs", "La couleur partout"];

/** Rôles obligatoires (lien : facultatif, l'accent par défaut), dans l'ordre d'affichage, avec leur usage par défaut. */
const ROLES = {
  fond: "Fond de la page",
  surface: "Cartes, champs, zones posées sur le fond",
  filet: "Séparations décoratives",
  contour: "Contour des champs et des boutons secondaires",
  texte: "Texte courant et titres",
  "texte-secondaire": "Aides, dates, détails",
  accent: "Bouton principal, choix en cours",
  "accent-survol": "Bouton principal au survol",
  "accent-actif": "Bouton principal pressé",
  "accent-doux": "Fond d'un élément choisi, survol discret",
  "texte-sur-accent": "Texte posé sur l'accent",
  lien: "Liens dans le texte",
  focus: "Contour du focus clavier",
  succes: "Texte et icône de succès",
  "succes-fond": "Fond d'un message de succès",
  alerte: "Texte et icône d'alerte",
  "alerte-fond": "Fond d'un message d'alerte",
  erreur: "Texte et icône d'erreur, action destructive",
  "erreur-fond": "Fond d'un message d'erreur",
  "desactive-fond": "Fond d'un bouton ou d'un champ désactivé",
  "desactive-texte": "Texte désactivé",
};

/** Paires mesurées : [couleur, fond, seuil WCAG (0 = mesure pour information), note]. */
const PAIRES = [
  ["texte", "fond", 4.5], ["texte", "surface", 4.5], ["texte", "accent-doux", 4.5],
  ["texte-secondaire", "fond", 4.5], ["texte-secondaire", "surface", 4.5],
  ["lien", "fond", 4.5], ["lien", "accent-doux", 4.5],
  ["texte-sur-accent", "accent", 4.5], ["texte-sur-accent", "accent-survol", 4.5], ["texte-sur-accent", "accent-actif", 4.5],
  ["contour", "fond", 3], ["contour", "surface", 3],
  ["focus", "fond", 3], ["focus", "surface", 3],
  ["succes", "fond", 4.5], ["succes", "succes-fond", 4.5], ["texte", "succes-fond", 4.5],
  ["alerte", "alerte-fond", 4.5], ["texte", "alerte-fond", 4.5],
  ["erreur", "fond", 4.5], ["erreur", "surface", 4.5], ["erreur", "erreur-fond", 4.5], ["texte", "erreur-fond", 4.5],
  ["desactive-texte", "desactive-fond", 0, "désactivé : sans seuil"],
  ["filet", "fond", 0, "décoratif : sans seuil"],
];

const NIVEAUX = { "titre-1": "Titre de page", "titre-2": "Titre de section", "titre-3": "Sous-titre", "titre-4": "Petit titre", texte: "Texte courant", petit: "Petit texte" };

const CONTENUS = [
  "marque", "boutons.principal", "boutons.secondaire", "boutons.texte", "boutons.destructif", "boutons.chargement",
  "champs.texte.etiquette", "champs.texte.valeur", "champs.texte.aide",
  "champs.erreur.etiquette", "champs.erreur.valeur", "champs.erreur.message",
  "champs.succes.etiquette", "champs.succes.valeur", "champs.succes.message",
  "champs.court.etiquette", "champs.court.valeur", "champs.court.aide",
  "messages.erreur.titre", "messages.erreur.texte", "messages.erreur.action",
  "messages.alerte.titre", "messages.alerte.texte", "messages.succes.titre", "messages.succes.texte",
  "vide.titre", "vide.texte", "vide.action",
];

// --- Outils ---

const texte = (v) => typeof v === "string" && v.trim() !== "";
const lire = (objet, chemin) => chemin.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), objet);
const virgule = (n) => String(n).replace(".", ",");
const arrondi = (n, d) => Number(n.toFixed(d));
const echapper = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rangsTries = (nuances) => Object.keys(nuances).sort((a, b) => Number(a) - Number(b));

const OKLCH = /^oklch\(\s*(\d*\.?\d+%?)\s+(\d*\.?\d+%?)\s+(\d*\.?\d+)(?:deg)?\s*\)$/i;

/** oklch(L C H) strict (sans transparence) → { L, C, H }, ou null. */
function lireOklch(valeur) {
  const m = OKLCH.exec(String(valeur || "").trim());
  if (!m) return null;
  const L = m[1].endsWith("%") ? Number(m[1].slice(0, -1)) / 100 : Number(m[1]);
  const C = m[2].endsWith("%") ? (Number(m[2].slice(0, -1)) / 100) * 0.4 : Number(m[2]);
  const H = Number(m[3]);
  if (!(L >= 0 && L <= 1) || !(C >= 0) || !(H >= 0 && H <= 360)) return null;
  return { L, C, H };
}

const ecrireOklch = ({ L, C, H }) => `oklch(${arrondi(L, 3)} ${arrondi(C, 3)} ${C < 0.0005 ? 0 : arrondi(H, 1)})`;
const hex = (rgb) => `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;

/** sRGB gamma (0..1) → OKLCH, d'après Björn Ottosson. */
function rgbVersOklch([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map(lineaire);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: Math.hypot(a, bb), H };
}

/** Une couleur quelconque (#hex, rgb(), oklch()) en oklch(), ou null si illisible. */
function versOklch(valeur) {
  try {
    const c = lireCouleur(valeur);
    return ecrireOklch(c.oklch ? { L: c.oklch[0], C: c.oklch[1], H: c.oklch[2] } : rgbVersOklch(c.rgb));
  } catch {
    return null;
  }
}

const ecartTeinte = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// --- Vérification ---

/** Vérifie un brandkit : constats (🔴 bloquant, 🟠 important) et valeurs calculées (nuances, rôles, contrastes). */
function analyser(bk) {
  const constats = [];
  const bloquant = (message) => constats.push({ gravite: "🔴", message });
  const important = (message) => constats.push({ gravite: "🟠", message });
  const resultat = { constats, nuances: new Map(), roles: {}, contrastes: [] };
  if (!bk || typeof bk !== "object" || Array.isArray(bk)) {
    bloquant("le fichier doit contenir un objet JSON (voir pulse-aidd modele ui/brandkit.json)");
    return resultat;
  }
  if (bk.version !== 1) bloquant("« version » doit valoir 1");
  for (const c of ["nom", "these", "intro"]) if (!texte(bk[c])) bloquant(`« ${c} » manque`);
  if (!STRATEGIES.includes(bk.strategie)) bloquant(`« strategie » : une de ${STRATEGIES.map((s) => `« ${s} »`).join(", ")}`);

  // Teintes et nuances
  const { nuances } = resultat;
  const teintes = Array.isArray(bk.teintes) ? bk.teintes : [];
  if (teintes.length < 2) bloquant("« teintes » : au moins un neutre et un accent, plus les teintes de succès, d'alerte et d'erreur");
  const ids = new Set();
  teintes.forEach((t, i) => {
    if (!t || typeof t !== "object" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(t.id || "")) {
      bloquant(`teintes[${i}].id : en minuscules, sans accent ni espace (ex. « ardoise »)`);
      return;
    }
    if (ids.has(t.id)) bloquant(`teinte « ${t.id} » en double`);
    ids.add(t.id);
    if (!texte(t.nom)) bloquant(`teinte ${t.id} : « nom » manque`);
    const n = t.nuances && typeof t.nuances === "object" ? t.nuances : {};
    for (const r of RANGS_REQUIS) if (!(r in n)) bloquant(`teinte ${t.id} : nuance ${r} manquante (5 nuances : 100, 300, 500, 700, 900)`);
    for (const rang of rangsTries(n)) {
      const valeur = n[rang];
      if (!RANGS_PERMIS.includes(rang)) {
        bloquant(`teinte ${t.id} : rang « ${rang} » inconnu (${RANGS_PERMIS.join(", ")})`);
        continue;
      }
      const o = lireOklch(valeur);
      if (!o) {
        const proposition = versOklch(valeur);
        bloquant(`${t.id}-${rang} : « ${valeur} » s'écrit en oklch(L C H)${proposition ? ` : ${proposition}` : ""}`);
        continue;
      }
      const rgb = oklchVersRgb(o.L, o.C, o.H);
      const hg = horsGamme(o.L, o.C, o.H);
      if (hg) important(`${t.id}-${rang} : hors de ce que l'écran affiche (sRGB), rendue plus terne ; baisser le chroma`);
      nuances.set(`${t.id}-${rang}`, { ...o, valeur: ecrireOklch(o), hex: hex(rgb), rgb, horsGamme: hg, teinte: t.id, rang });
    }
    const presentes = rangsTries(n).filter((r) => nuances.has(`${t.id}-${r}`)).map((r) => nuances.get(`${t.id}-${r}`));
    for (let k = 1; k < presentes.length; k++)
      if (presentes[k].L >= presentes[k - 1].L) important(`teinte ${t.id} : la luminosité doit baisser de ${presentes[k - 1].rang} à ${presentes[k].rang}`);
    const colorees = presentes.filter((x) => x.C >= 0.03);
    let ecart = 0;
    for (const a of colorees) for (const b of colorees) ecart = Math.max(ecart, ecartTeinte(a.H, b.H));
    if (ecart > 15) important(`teinte ${t.id} : la teinte (H) varie de ${Math.round(ecart)}° entre ses nuances ; la garder fixe`);
  });

  // Rôles
  const roles = bk.roles && typeof bk.roles === "object" ? bk.roles : {};
  for (const nom of Object.keys(ROLES)) if (nom !== "lien" && !(nom in roles)) bloquant(`rôle « ${nom} » manquant (${ROLES[nom]})`);
  for (const [nom, ref] of Object.entries(roles)) {
    if (!/^[a-z][a-z0-9-]*$/.test(nom)) bloquant(`rôle « ${nom} » : nom en minuscules, sans accent`);
    else if (!nuances.has(ref)) bloquant(`rôle « ${nom} » : « ${ref} » n'est pas une nuance (forme <teinte>-<rang>, ex. « ardoise-700 »)`);
    else resultat.roles[nom] = ref;
  }
  if (!resultat.roles.lien && resultat.roles.accent) resultat.roles = { ...resultat.roles, lien: resultat.roles.accent };
  const ordre = [...Object.keys(ROLES), ...Object.keys(resultat.roles).filter((r) => !(r in ROLES))];
  resultat.roles = Object.fromEntries(ordre.filter((r) => r in resultat.roles).map((r) => [r, resultat.roles[r]]));

  // Contrastes
  for (const [avant, fond, seuil, note] of PAIRES) {
    const ra = resultat.roles[avant];
    const rf = resultat.roles[fond];
    if (!ra || !rf) continue;
    const a = nuances.get(ra);
    const f = nuances.get(rf);
    const exact = rapport({ rgb: a.rgb, alpha: 1 }, { rgb: f.rgb, alpha: 1 });
    const c = { avant, fond, seuil, note, rapport: tronquer(exact), ok: !seuil || exact >= seuil };
    resultat.contrastes.push(c);
    if (!c.ok) {
      const p = viser({ rgb: a.rgb, alpha: 1, oklch: [a.L, a.C, a.H] }, { rgb: f.rgb, alpha: 1 }, seuil);
      bloquant(
        `contraste ${avant} sur ${fond} : ${virgule(c.rapport)}:1 pour ${virgule(seuil)}:1 requis` +
          (p ? ` ; ${ra} à ${p.valeur} l'atteint (${virgule(p.rapport)}:1), ou prendre une autre nuance` : " ; prendre une autre nuance"),
      );
    }
  }

  // Typographie
  const typo = bk.typographie && typeof bk.typographie === "object" ? bk.typographie : {};
  const polices = typo.polices && typeof typo.polices === "object" ? typo.polices : {};
  for (const p of ["titre", "texte"]) if (!polices[p]) bloquant(`typographie.polices.${p} manque`);
  for (const [cle, p] of Object.entries(polices)) {
    if (!["titre", "texte", "mono"].includes(cle)) bloquant(`typographie.polices.${cle} : seulement titre, texte et mono`);
    if (!p || !texte(p.famille)) bloquant(`typographie.polices.${cle}.famille manque`);
    if (!p || !/\b(serif|sans-serif|monospace|system-ui|ui-[a-z-]+)\s*$/.test(p.secours || ""))
      bloquant(`typographie.polices.${cle}.secours : polices du système, terminées par une famille générique (ex. "\\"Segoe UI\\", system-ui, sans-serif")`);
    if (!p || !Array.isArray(p.graisses) || !p.graisses.length || !p.graisses.every((g) => Number.isInteger(g) && g >= 100 && g <= 900))
      bloquant(`typographie.polices.${cle}.graisses : liste des graisses chargées (ex. [400, 600])`);
  }
  const reflexe = polices.titre && texte(polices.titre.famille) && policesReflexes().find((r) => r.toLowerCase() === polices.titre.famille.trim().toLowerCase());
  if (reflexe) important(`police de titre « ${reflexe} » : police réflexe ; en choisir une autre, ou écrire la raison dans docs/design.md`);
  if (!(typeof typo.rapport === "number" && typo.rapport >= 1.1 && typo.rapport <= 1.7))
    bloquant("typographie.rapport : rapport entre deux niveaux, de 1,2 (outil dense) à 1,5 (vitrine)");
  const niveaux = Array.isArray(typo.niveaux) ? typo.niveaux : [];
  const parId = new Map(niveaux.filter((n) => n && typeof n === "object").map((n) => [n.id, n]));
  for (const id of Object.keys(NIVEAUX)) if (!parId.has(id)) bloquant(`typographie.niveaux : niveau « ${id} » (${NIVEAUX[id]}) manquant`);
  for (const n of parId.values()) {
    if (!NIVEAUX[n.id]) {
      bloquant(`typographie.niveaux : niveau « ${n.id} » inconnu (${Object.keys(NIVEAUX).join(", ")})`);
      continue;
    }
    if (!(typeof n.taille === "number" && n.taille > 0)) bloquant(`niveau ${n.id} : « taille » en rem, un nombre (ex. 1.25)`);
    if (!polices[n.police]) bloquant(`niveau ${n.id} : police « ${n.police} » absente de typographie.polices`);
    else if (Array.isArray(polices[n.police].graisses) && !polices[n.police].graisses.includes(n.graisse))
      bloquant(`niveau ${n.id} : graisse ${n.graisse} absente des graisses chargées pour la police ${n.police}`);
    if (!(typeof n.interligne === "number" && n.interligne >= 1 && n.interligne <= 2)) bloquant(`niveau ${n.id} : « interligne » entre 1 et 2`);
    if (n.approche !== undefined && !(typeof n.approche === "number" && Math.abs(n.approche) <= 0.1)) bloquant(`niveau ${n.id} : « approche » en em, entre -0.1 et 0.1`);
    if (!texte(n.exemple)) bloquant(`niveau ${n.id} : « exemple » manque (un texte tiré du projet)`);
  }
  const corps = parId.get("texte");
  if (corps && typeof corps.taille === "number" && corps.taille < 1) bloquant("niveau texte : 1 rem (16 px) au moins");
  if (corps && typeof corps.interligne === "number" && (corps.interligne < 1.4 || corps.interligne > 1.7)) important("niveau texte : interligne de 1,5 à 1,6 conseillé");
  const petit = parId.get("petit");
  if (petit && typeof petit.taille === "number" && petit.taille < 0.875) important("niveau petit : 0,875 rem (14 px) au moins");

  // Espacements, rayons, formes, ombres
  const e = bk.espacements;
  if (!Array.isArray(e) || e.length !== 8 || !e.every((x) => typeof x === "number" && x > 0) || e.some((x, i) => i && x <= e[i - 1]))
    bloquant("« espacements » : 8 valeurs en px, croissantes (ex. [4, 8, 12, 16, 24, 32, 48, 64])");
  else if (e.some((x) => x % 4)) important("« espacements » : multiples de 4 conseillés");
  const rayons = bk.rayons && typeof bk.rayons === "object" ? bk.rayons : {};
  for (const r of ["controle", "carte"]) if (!(typeof rayons[r] === "number" && rayons[r] >= 0)) bloquant(`rayons.${r} : en px, un nombre`);
  const formes = bk.formes && typeof bk.formes === "object" ? bk.formes : {};
  if (!(typeof formes.cible === "number" && formes.cible >= 44)) bloquant("formes.cible : hauteur des boutons et des champs, 44 px au moins (doigt sur téléphone)");
  if (!["controle", "carte", "pilule"].includes(lire(formes, "bouton.rayon"))) bloquant("formes.bouton.rayon : « controle », « carte » ou « pilule »");
  const gb = lire(formes, "bouton.graisse");
  if (!Number.isInteger(gb)) bloquant("formes.bouton.graisse : graisse du texte des boutons (ex. 600)");
  else if (polices.texte && Array.isArray(polices.texte.graisses) && !polices.texte.graisses.includes(gb))
    bloquant(`formes.bouton.graisse : ${gb} absente des graisses chargées pour la police texte`);
  if (![1, 2, 3].includes(lire(formes, "champ.contour"))) bloquant("formes.champ.contour : épaisseur du contour des champs, 1, 2 ou 3 px");
  const ombres = bk.ombres === undefined ? {} : bk.ombres;
  if (!ombres || typeof ombres !== "object" || Array.isArray(ombres)) bloquant("« ombres » : un objet { nom: valeur }");
  else
    for (const [nom, v] of Object.entries(ombres)) {
      if (!/^[a-z][a-z0-9-]*$/.test(nom) || !texte(v)) bloquant(`ombres.${nom} : nom en minuscules et valeur CSS`);
      else if (/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i.test(v)) bloquant(`ombres.${nom} : la couleur s'écrit en oklch(L C H / opacité)`);
    }

  // Contenus
  for (const c of CONTENUS) if (!texte(lire(bk.contenus, c))) bloquant(`contenus.${c} manque (un texte tiré du projet)`);
  return resultat;
}

// --- CSS ---

const pile = (p) => `"${p.famille.trim()}", ${p.secours.trim()}`;

function lienPolices(bk) {
  const parFamille = new Map();
  for (const p of Object.values(bk.typographie.polices)) {
    if (p.lien === false) continue;
    const g = parFamille.get(p.famille) || new Set();
    p.graisses.forEach((x) => g.add(x));
    parFamille.set(p.famille, g);
  }
  if (!parFamille.size) return "";
  const familles = [...parFamille]
    .map(([f, g]) => `family=${encodeURIComponent(f.trim()).replace(/%20/g, "+")}:wght@${[...g].sort((a, b) => a - b).join(";")}`)
    .join("&");
  return [
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link href="https://fonts.googleapis.com/css2?${familles}&display=swap" rel="stylesheet">`,
  ].join("\n");
}

const px = (n) => `${arrondi(n / 16, 4)}rem`;

function variables(bk, a) {
  const l = ["  /* Nuances (OKLCH) */"];
  for (const t of bk.teintes) l.push(`  ${rangsTries(t.nuances).map((r) => `--${t.id}-${r}: ${a.nuances.get(`${t.id}-${r}`).valeur};`).join(" ")}`);
  l.push("  /* Rôles : les composants emploient seulement ces noms */");
  for (const [nom, ref] of Object.entries(a.roles)) l.push(`  --${nom}: var(--${ref});`);
  l.push("  /* Typographie */");
  const polices = bk.typographie.polices;
  for (const cle of ["titre", "texte", "mono"]) if (polices[cle]) l.push(`  --police-${cle}: ${pile(polices[cle])};`);
  if (!polices.mono) l.push(`  --police-mono: ui-monospace, "Cascadia Mono", Consolas, monospace;`);
  for (const id of Object.keys(NIVEAUX)) {
    const n = bk.typographie.niveaux.find((x) => x.id === id);
    const v = `--typo-${id}`;
    l.push(`  ${v}-police: var(--police-${n.police}); ${v}-taille: ${n.taille}rem; ${v}-graisse: ${n.graisse}; ${v}-interligne: ${n.interligne}; ${v}-approche: ${n.approche || 0}em;`);
  }
  l.push("  /* Espacements */");
  l.push(`  ${bk.espacements.map((x, i) => `--e-${i + 1}: ${px(x)};`).join(" ")}`);
  l.push("  /* Rayons et formes */");
  const rayons = { pilule: 999, ...bk.rayons };
  l.push(`  ${Object.entries(rayons).map(([n, v]) => `--rayon-${n}: ${v}px;`).join(" ")}`);
  l.push(`  --rayon-bouton: var(--rayon-${bk.formes.bouton.rayon}); --bouton-graisse: ${bk.formes.bouton.graisse}; --cible: ${bk.formes.cible}px; --contour-epaisseur: ${bk.formes.champ.contour}px;`);
  const ombres = Object.entries(bk.ombres || {});
  if (ombres.length) {
    l.push("  /* Ombres */");
    for (const [n, v] of ombres) l.push(`  --ombre-${n}: ${v};`);
  }
  return l.join("\n");
}

const fonte = (id, taille) =>
  `font: var(--typo-${id}-graisse) ${taille || `var(--typo-${id}-taille)`}/var(--typo-${id}-interligne) var(--typo-${id}-police); letter-spacing: var(--typo-${id}-approche);`;
const TAILLE_FLUIDE = { "titre-1": "min(var(--typo-titre-1-taille), calc(1.5rem + 4vw))", "titre-2": "min(var(--typo-titre-2-taille), calc(1.25rem + 3vw))" };

/** Styles de base communs à la planche et aux maquettes (téléphone d'abord : les grands titres rétrécissent sur un petit écran). */
const STYLES_BASE = [
  "*, *::before, *::after { box-sizing: border-box; }",
  `body { margin: 0; background: var(--fond); color: var(--texte); ${fonte("texte")} }`,
  "h1, h2, h3, h4 { margin: 0; color: var(--texte); overflow-wrap: break-word; }",
  `h1 { ${fonte("titre-1", TAILLE_FLUIDE["titre-1"])} }`,
  `h2 { ${fonte("titre-2", TAILLE_FLUIDE["titre-2"])} }`,
  `h3 { ${fonte("titre-3")} }`,
  `h4 { ${fonte("titre-4")} }`,
  `small, .petit { ${fonte("petit")} }`,
  "a { color: var(--lien); text-decoration-thickness: 1px; text-underline-offset: 0.2em; }",
  "a:hover { color: var(--accent-actif); }",
  ":focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }",
  "@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; } }",
].join("\n");

function css(bk, a) {
  return [lienPolices(bk), "<style>", ":root {", variables(bk, a), "}", STYLES_BASE, "</style>"].filter(Boolean).join("\n");
}

// --- Planche ---

const ICONES = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="i-erreur" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v5.5M12 16.2v.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="i-alerte" viewBox="0 0 24 24"><path d="M12 3.5 21.5 20h-19z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4.5M12 17.2v.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="i-ok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="i-vide" viewBox="0 0 24 24"><path d="M3.5 6.5h6l2 2.5h9v9.5h-17z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
</defs></svg>`;

const icone = (id, classe = "icone") => `<svg class="${classe}" aria-hidden="true"><use href="#${id}"/></svg>`;

function blocNuances(bk, a) {
  return bk.teintes
    .map((t) => {
      const rangs = rangsTries(t.nuances);
      const items = rangs.map((r) => {
        const n = a.nuances.get(`${t.id}-${r}`);
        return `<li class="nuance"><span class="pastille" style="background:var(--${t.id}-${r})"></span><span class="nuance-info"><b>${r}</b><code>${n.valeur}</code><code>${n.hex}</code>${n.horsGamme ? "<small>hors gamme</small>" : ""}</span></li>`;
      });
      return `<div class="teinte">\n<h3 class="teinte-nom">${echapper(t.nom)}${texte(t.usage) ? `<span>${echapper(t.usage)}</span>` : ""}</h3>\n<ol class="nuances" style="--n:${rangs.length}">\n${items.join("\n")}\n</ol>\n</div>`;
    })
    .join("\n");
}

function blocRoles(bk, a) {
  const lignes = Object.entries(a.roles).map(([nom, ref]) => {
    const n = a.nuances.get(ref);
    const devant = a.contrastes.filter((c) => c.avant === nom);
    // Un fond affiche seulement le texte posé dessus (les autres paires figurent sous leur couleur).
    const tous = a.contrastes.filter((c) => c.fond === nom);
    const textes = tous.filter((c) => ["texte", "texte-sur-accent", "desactive-texte"].includes(c.avant));
    const dessous = textes.length ? textes : tous.slice(0, 1);
    const paires = devant.length ? devant.map((c) => [`sur ${c.fond}`, c]) : dessous.map((c) => [`${c.avant} dessus`, c]);
    let style = `background:var(--${nom})`;
    let echantillon = "";
    if (["contour", "filet"].includes(nom)) style = `background:var(--surface);border:2px solid var(--${nom})`;
    else if (nom === "focus") style = "background:var(--surface);outline:2px solid var(--focus);outline-offset:2px";
    else if (devant.length) [style, echantillon] = [`background:var(--${devant[0].fond});color:var(--${nom})`, "Aa"];
    else if (dessous.length) [style, echantillon] = [`background:var(--${nom});color:var(--${dessous[0].avant})`, "Aa"];
    const mesures = paires
      .map(([quoi, c]) => {
        const classe = !c.seuil ? "info" : c.ok ? "ok" : "ko";
        const detail = c.seuil ? ` (${virgule(c.seuil)}:1 requis)` : c.note ? ` (${c.note})` : "";
        return `<span class="${classe}">${quoi} : ${virgule(c.rapport.toFixed(2))}:1${detail}</span>`;
      })
      .join("<br>");
    const usage = lire(bk, `usages.${nom}`) || ROLES[nom] || "";
    return `<tr><th scope="row"><code>--${nom}</code>${usage ? `<small>${echapper(usage)}</small>` : ""}</th><td class="col-echantillon"><span class="echantillon" style="${style}">${echantillon}</span></td><td data-libelle="Nuance"><code>${ref}</code></td><td data-libelle="OKLCH"><code>${n.valeur}</code></td><td data-libelle="Hexadécimal"><code>${n.hex}</code></td><td data-libelle="Contraste">${mesures || "—"}</td></tr>`;
  });
  return `<table class="roles">\n<caption class="sr">Rôles de couleur : nuance, valeur OKLCH, hexadécimal et contraste mesuré</caption>\n<thead><tr><th scope="col">Rôle</th><th scope="col">Échantillon</th><th scope="col">Nuance</th><th scope="col">OKLCH</th><th scope="col">Hexadécimal</th><th scope="col">Contraste mesuré</th></tr></thead>\n<tbody>\n${lignes.join("\n")}\n</tbody>\n</table>`;
}

function blocTypo(bk) {
  const polices = bk.typographie.polices;
  const lignes = Object.keys(NIVEAUX).map((id) => {
    const n = bk.typographie.niveaux.find((x) => x.id === id);
    const details = [`${arrondi(n.taille * 16, 1)} px`, `${virgule(n.taille)} rem`, `graisse ${n.graisse}`, `interligne ${virgule(n.interligne)}`];
    if (n.approche) details.push(`lettres ${virgule(n.approche)} em`);
    return `<div class="typo-ligne"><p class="typo-meta"><b>${NIVEAUX[id]}</b><span>${details.join(" · ")}</span><span>${echapper(polices[n.police].famille)}</span></p><p class="typo-exemple typo-${id}">${echapper(n.exemple)}</p></div>`;
  });
  lignes.push(`<div class="typo-ligne"><p class="typo-meta"><b>Lien</b><span>couleur du lien, soulignement décalé</span></p><p class="typo-exemple"><a href="#typo">${echapper(bk.contenus.boutons.texte)}</a></p></div>`);
  return lignes.join("\n");
}

function chapeauTypo(bk) {
  const p = bk.typographie.polices;
  const parties = [`Titres : ${p.titre.famille}`, `texte : ${p.texte.famille}`];
  if (p.mono) parties.push(`chiffres et codes : ${p.mono.famille}`);
  return `${parties.join(" ; ")}. Rapport de ${virgule(bk.typographie.rapport)} entre deux niveaux. Police de secours : ${p.texte.secours}.`;
}

function blocEspaces(bk) {
  const espaces = bk.espacements.map((x, i) => `<li><span class="carre" style="width:${x}px;height:${x}px"></span><code>--e-${i + 1}</code><small>${x} px</small></li>`).join("\n");
  const usages = { controle: "Champs", carte: "Cartes et messages", pilule: "Badges" };
  const rayons = { ...bk.rayons, pilule: 999 };
  const formes = Object.entries(rayons)
    .map(([n, v]) => `<li><span class="forme" style="border-radius:var(--rayon-${n})"></span><code>--rayon-${n}</code><small>${n === "pilule" ? "arrondi complet" : `${v} px`}${usages[n] ? ` · ${usages[n]}` : ""}${bk.formes.bouton.rayon === n ? " · Boutons" : ""}</small></li>`)
    .join("\n");
  const ombres = Object.keys(bk.ombres || {});
  const blocOmbres = ombres.length
    ? `<div class="groupe">\n<h3>Ombres</h3>\n<ul class="ombres">${ombres.map((n) => `<li class="ombre-boite" style="box-shadow:var(--ombre-${n})"><code>--ombre-${n}</code></li>`).join("")}</ul>\n</div>`
    : `<div class="groupe">\n<h3>Ombres</h3>\n<p class="chapeau">Aucune : les surfaces se distinguent par leur couleur et leurs filets.</p>\n</div>`;
  return `<div class="groupe">\n<h3>Espacements</h3>\n<ol class="espaces">\n${espaces}\n</ol>\n</div>\n<div class="groupe">\n<h3>Rayons</h3>\n<ul class="rayons">\n${formes}\n</ul>\n<p class="chapeau">Hauteur des boutons et des champs : ${bk.formes.cible} px. Contour des champs : ${bk.formes.champ.contour} px.</p>\n</div>\n${blocOmbres}`;
}

function blocBoutons(bk) {
  const b = bk.contenus.boutons;
  const etats = [["", "Repos"], ["est-survol", "Survol"], ["est-focus", "Focus clavier"], ["est-actif", "Actif (pressé)"], ["disabled", "Désactivé"]];
  const types = [["principal", "Principal"], ["secondaire", "Secondaire"], ["texte", "Texte"], ["destructif", "Destructif"]];
  const groupes = types.map(([t, nom]) => {
    const items = etats.map(([e, libelle]) => {
      const classe = e && e !== "disabled" ? ` ${e}` : "";
      return `<li><button type="button" class="btn btn-${t}${classe}"${e === "disabled" ? " disabled" : ""}>${echapper(b[t])}</button><span class="etat-nom">${libelle}</span></li>`;
    });
    return `<div class="boutons-type">\n<h3>${nom}</h3>\n<ul class="etats">\n${items.join("\n")}\n</ul>\n</div>`;
  });
  groupes.push(
    `<div class="boutons-type">\n<h3>Chargement</h3>\n<ul class="etats">\n<li><button type="button" class="btn btn-principal" aria-busy="true"><span class="rond" aria-hidden="true"></span>${echapper(b.chargement)}</button><span class="etat-nom">En cours</span></li>\n<li><button type="button" class="btn btn-principal">${icone("i-plus", "")}${echapper(b.principal)}</button><span class="etat-nom">Avec icône</span></li>\n</ul>\n</div>`,
  );
  return groupes.join("\n");
}

function blocChamps(bk) {
  const c = bk.contenus.champs;
  const champ = (k, etat, { etiquette, valeur, aide, classe = "", attributs = "", retour = "" }) =>
    `<div class="champ-etat"><p class="etat-nom">${etat}</p><div class="champ"><label for="c${k}">${echapper(etiquette)}</label><input id="c${k}" type="text" ${valeur === null ? "" : `value="${echapper(valeur)}" `}${classe ? `class="${classe}" ` : ""}${attributs}${aide || retour ? `aria-describedby="a${k}"` : ""}>${aide ? `<p class="aide" id="a${k}">${echapper(aide)}</p>` : ""}${retour.replace("{id}", `a${k}`)}</div></div>`;
  const base = { etiquette: c.texte.etiquette, valeur: c.texte.valeur, aide: c.texte.aide };
  return [
    champ(1, "Repos", base),
    champ(2, "Survol", { ...base, classe: "est-survol" }),
    champ(3, "Focus clavier", { ...base, classe: "est-focus" }),
    champ(4, "Vide, avec un exemple", { ...base, valeur: null, attributs: `placeholder="${echapper(c.texte.valeur)}" ` }),
    champ(5, "Désactivé", { ...base, attributs: "disabled " }),
    champ(6, "Erreur", {
      etiquette: c.erreur.etiquette,
      valeur: c.erreur.valeur,
      attributs: `aria-invalid="true" `,
      retour: `<p class="retour retour-erreur" id="{id}">${icone("i-erreur", "")}${echapper(c.erreur.message)}</p>`,
    }),
    champ(7, "Valide", {
      etiquette: c.succes.etiquette,
      valeur: c.succes.valeur,
      classe: "est-valide",
      retour: `<p class="retour retour-succes" id="{id}">${icone("i-ok", "")}${echapper(c.succes.message)}</p>`,
    }),
    champ(8, "Champ court", { etiquette: c.court.etiquette, valeur: c.court.valeur, aide: c.court.aide, classe: "court" }),
  ].join("\n");
}

function blocMessages(bk) {
  const m = bk.contenus.messages;
  const v = bk.contenus.vide;
  const message = (type, id, role, { titre, texte: corps, action }) =>
    `<div class="message message-${type}" role="${role}">${icone(id)}<div><p class="message-titre">${echapper(titre)}</p><p>${echapper(corps)}</p>${action ? `<div class="message-actions"><button type="button" class="btn btn-secondaire">${echapper(action)}</button></div>` : ""}</div></div>`;
  return [
    `<div class="groupe">\n<h3>Messages</h3>\n<div class="messages">`,
    message("erreur", "i-erreur", "alert", m.erreur),
    message("alerte", "i-alerte", "status", m.alerte),
    message("succes", "i-ok", "status", m.succes),
    `</div>\n</div>`,
    `<div class="groupe">\n<h3>État vide</h3>\n<div class="vide">${icone("i-vide", "icone-vide")}<p class="vide-titre">${echapper(v.titre)}</p><p>${echapper(v.texte)}</p><button type="button" class="btn btn-principal">${icone("i-plus", "")}${echapper(v.action)}</button></div>\n</div>`,
  ].join("\n");
}

function planche(bk, a, modele = fs.readFileSync(MODELE, "utf8")) {
  const details = [`Stratégie de couleur : ${bk.strategie}`];
  if (texte(bk.registre)) details.push(`registre : ${bk.registre}`);
  const surtitre = ["Planche d'identité", bk.famille, texte(bk.style) ? `style ${bk.style}` : ""].filter(texte).join(" · ");
  const typos = Object.keys(NIVEAUX).map((id) => `.typo-${id} { ${fonte(id, TAILLE_FLUIDE[id])} }`).join("\n");
  const valeurs = {
    TITRE: echapper(`${bk.nom} : planche d'identité${texte(bk.projet) ? `, ${bk.projet}` : ""}`),
    POLICES: lienPolices(bk),
    VARIABLES: variables(bk, a),
    STYLES_BASE,
    STYLES_TYPO: typos,
    ICONES,
    MARQUE: echapper(bk.contenus.marque),
    SURTITRE: echapper(surtitre),
    NOM: echapper(bk.nom),
    THESE: echapper(bk.these),
    INTRO: echapper(bk.intro),
    DETAILS: echapper(`${details.join(" ; ")}.`),
    NUANCES: blocNuances(bk, a),
    ROLES: blocRoles(bk, a),
    CHAPEAU_TYPO: echapper(chapeauTypo(bk)),
    TYPO: blocTypo(bk),
    ESPACES: blocEspaces(bk),
    BOUTONS: blocBoutons(bk),
    CHAMPS: blocChamps(bk),
    MESSAGES: blocMessages(bk),
  };
  return modele.replace(/\{\{([A-Z_]+)\}\}/g, (tout, cle) => (cle in valeurs ? valeurs[cle] : tout));
}

// --- Résumé pour docs/design.md ---

function resume(bk, a) {
  const l = ["## 6. Couleur", "", `**Stratégie** : ${bk.strategie}`, "", "**Valeurs** : `docs/design/identite/retenue/brandkit.json`, la source ; `pulse-aidd brandkit css` les donne en CSS.", ""];
  l.push("**Nuances** (OKLCH ; l'hexadécimal pour information) :", "", "| Nuance | OKLCH | Hexadécimal |", "|---|---|---|");
  for (const t of bk.teintes) for (const r of rangsTries(t.nuances)) {
    const n = a.nuances.get(`${t.id}-${r}`);
    l.push(`| \`--${t.id}-${r}\` | ${n.valeur} | ${n.hex} |`);
  }
  l.push("", "**Rôles** (chaque rôle cite une nuance) :", "", "| Rôle | Valeur | Contraste mesuré | Usage |", "|---|---|---|---|");
  for (const [nom, ref] of Object.entries(a.roles)) {
    const mesures = a.contrastes.filter((c) => c.avant === nom).map((c) => `${virgule(c.rapport.toFixed(2))}:1 sur ${c.fond}`);
    l.push(`| \`--${nom}\` | \`var(--${ref})\` | ${mesures.join(" ; ") || "—"} | ${lire(bk, `usages.${nom}`) || ROLES[nom] || ""} |`);
  }
  const p = bk.typographie.polices;
  l.push("", "## 7. Typographie", "", "| Niveau | Police | Taille | Graisse | Interligne | Approche |", "|---|---|---|---|---|---|");
  for (const id of Object.keys(NIVEAUX)) {
    const n = bk.typographie.niveaux.find((x) => x.id === id);
    l.push(`| ${NIVEAUX[id]} (\`--typo-${id}-*\`) | ${p[n.police].famille} | ${n.taille} rem (${arrondi(n.taille * 16, 1)} px) | ${n.graisse} | ${n.interligne} | ${n.approche || 0} em |`);
  }
  l.push("", `Rapport de l'échelle : ${virgule(bk.typographie.rapport)}. Polices de secours : ${Object.entries(p).map(([k, v]) => `${k} → ${v.secours}`).join(" ; ")}. Longueur de ligne : 65 à 75 caractères.`);
  l.push("", "## 8. Espacement, arrondis, ombres", "");
  l.push(`- **Échelle d'espacement** : ${bk.espacements.map((x, i) => `\`--e-${i + 1}\` ${x} px`).join(", ")}`);
  l.push(`- **Arrondis** : ${Object.entries({ ...bk.rayons, pilule: 999 }).map(([n, v]) => `\`--rayon-${n}\` ${n === "pilule" ? "arrondi complet" : `${v} px`}`).join(", ")} ; boutons : \`--rayon-${bk.formes.bouton.rayon}\``);
  l.push(`- **Cibles** : boutons et champs de ${bk.formes.cible} px de haut ; contour des champs : ${bk.formes.champ.contour} px ; texte des boutons en graisse ${bk.formes.bouton.graisse}`);
  const ombres = Object.entries(bk.ombres || {});
  l.push(`- **Ombres / élévation** : ${ombres.length ? ombres.map(([n, v]) => `\`--ombre-${n}\` ${v}`).join(" ; ") : "aucune"}`);
  return l.join("\n");
}

// --- Ligne de commande ---

function cheminBrandkit(cible) {
  const c = cible || DEFAUT;
  return fs.existsSync(c) && fs.statSync(c).isDirectory() ? path.join(c, "brandkit.json") : c;
}

function charger(cible) {
  const fichier = cheminBrandkit(cible);
  if (!fs.existsSync(fichier)) return { erreur: `Brandkit introuvable : ${fichier}${cible ? "" : " (indiquez le fichier ou son dossier)"}` };
  try {
    return { fichier, bk: JSON.parse(fs.readFileSync(fichier, "utf8")) };
  } catch (e) {
    return { fichier, erreurJson: `${fichier} : JSON illisible (${e.message})` };
  }
}

function afficherConstats(constats) {
  for (const c of constats) console.log(`${c.gravite} ${c.message}`);
  const n = (g) => constats.filter((c) => c.gravite === g).length;
  if (constats.length) console.log(`\n${constats.length} constat(s) : 🔴 ${n("🔴")} · 🟠 ${n("🟠")}`);
  return n("🔴");
}

const USAGE = [
  "Usage :",
  "  pulse-aidd brandkit planche <dossier>            vérifie <dossier>/brandkit.json et écrit <dossier>/planche.html",
  "  pulse-aidd brandkit verifier [fichier|dossier]   vérifie seulement",
  "  pulse-aidd brandkit css [fichier|dossier]        polices, variables et styles de base à coller dans une maquette",
  "  pulse-aidd brandkit resume [fichier|dossier]     sections 6 à 8 de docs/design.md",
  "  pulse-aidd brandkit oklch <couleur>              convertit #hex ou rgb() en oklch()",
  `Sans chemin : ${DEFAUT.split(path.sep).join("/")}`,
].join("\n");

function principal(argv) {
  const [action, cible, ...reste] = argv;
  if (!["planche", "verifier", "css", "resume", "oklch"].includes(action) || reste.length || (action === "planche" && !cible) || (action === "oklch" && !cible)) {
    console.error(USAGE);
    return 2;
  }
  if (action === "oklch") {
    const v = versOklch(cible);
    if (!v) {
      console.error(`Couleur illisible : ${cible}. Formes acceptées : #1a2b3c, rgb(26 43 60), oklch(0.55 0.18 250).`);
      return 2;
    }
    const o = lireOklch(v);
    console.log(`${v}  (${hex(oklchVersRgb(o.L, o.C, o.H))})`);
    return 0;
  }
  const { fichier, bk, erreur, erreurJson } = charger(cible);
  if (erreur) {
    console.error(erreur);
    return 2;
  }
  if (erreurJson) {
    console.log(`🔴 ${erreurJson}`);
    return 1;
  }
  const a = analyser(bk);
  const rouges = a.constats.filter((c) => c.gravite === "🔴").length;
  if (action === "verifier") {
    if (afficherConstats(a.constats)) return 1;
    console.log(a.constats.length ? "Aucun 🔴 : le brandkit est utilisable." : "Brandkit conforme : schéma, OKLCH et contrastes.");
    return 0;
  }
  if (rouges) {
    afficherConstats(a.constats);
    console.log(`\nCorrigez ${fichier} puis relancez : rien n'a été écrit.`);
    return 1;
  }
  if (action === "css") {
    console.log(css(bk, a));
    return 0;
  }
  if (action === "resume") {
    console.log(resume(bk, a));
    return 0;
  }
  afficherConstats(a.constats);
  const sortie = path.join(path.dirname(fichier), "planche.html");
  fs.writeFileSync(sortie, planche(bk, a));
  console.log(`Planche : ${sortie}`);
  return 0;
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { analyser, css, planche, resume, versOklch, lireOklch, ROLES, PAIRES, NIVEAUX, CONTENUS, principal };

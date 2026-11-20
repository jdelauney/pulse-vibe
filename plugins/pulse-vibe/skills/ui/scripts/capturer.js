#!/usr/bin/env node
// Pulse – captures d'écran des maquettes de /pulse:ui, et contrôles qui demandent le rendu réel.
//
//   pulse-aidd maquettes capturer <fichier.html|dossier>
//
// Chaque page est ouverte dans le navigateur du poste (Chrome, Edge ou Chromium, sans fenêtre ; voir scripts/navigateur.js),
// animations réduites : mobile*.html à 390 px de large, desktop*.html à 1 280 px, les autres pages (coquille.html…) aux deux.
// Les captures, une par hauteur d'écran (4 au plus ; 2 par état), vont dans captures/ à côté de la page :
// <page>-<largeur>-<n>.png pour l'état affiché à l'ouverture, <page>-<largeur>-<état>-<n>.png pour chaque autre état du
// sélecteur (boutons data-etat, le premier = l'état normal ; le conteneur data-selecteur-etats est masqué sur les captures).
// Contrôles du rendu : page plus large que l'écran (aussi à 320 px), cibles tactiles sous 44 × 44 px sur téléphone,
// image non chargée, cartes dans des cartes, grille de cartes identiques, champ sans étiquette visible, petites étiquettes
// en capitales au-dessus des titres (une pour trois sections au plus), nombres de tableau mal alignés ; police web non
// chargée signalée (les captures montrent alors la police de secours).
// Codes de sortie : 0 aucun 🔴 ; 1 au moins un 🔴 ; 2 usage ou chemin introuvable ; 3 aucun navigateur, ou lancement impossible.
"use strict";

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { trouverNavigateur, ouvrir } = require("../../../scripts/navigateur");

const HAUTEUR = (largeur) => (largeur < 768 ? 844 : 800);
const MAX_ECRANS = { normal: 4, etat: 2 };
const SOURCE = "regles-ui.md";

/** Largeurs capturées, et largeurs seulement mesurées, selon le nom de la page. */
function largeurs(nom) {
  if (/^mobile/i.test(nom)) return { capturees: [390], mesurees: [320] };
  if (/^desktop/i.test(nom)) return { capturees: [1280], mesurees: [] };
  return { capturees: [390, 1280], mesurees: [320] };
}

function pages(chemin) {
  if (fs.statSync(chemin).isFile()) return [chemin];
  const liste = [];
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!["alternatives", "captures", "node_modules", ".git"].includes(e.name)) parcourir(p);
      } else if (/\.html$/i.test(e.name) && e.name !== "comparer.html") liste.push(p);
    }
  };
  parcourir(chemin);
  return liste.sort();
}

// Lancé dans la page (sérialisé par toString) : relevés du rendu à la largeur L.
/* global document, getComputedStyle */
function releverPage(L) {
  const decrire = (el) => {
    const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
    const texte = (el.getAttribute("aria-label") || el.textContent || el.value || "").trim().replace(/\s+/g, " ").slice(0, 30);
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (classes.length ? "." + classes.join(".") : "") + (texte ? " « " + texte + " »" : "");
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !el.closest("[data-selecteur-etats],[aria-hidden=true],[inert]");
  };
  const tous = [...document.body.querySelectorAll("*")].filter(visible);
  const sortie = { largeur: document.documentElement.scrollWidth, depassent: [], cibles: [], images: [], polices: [], etiquettes: 0, sections: 0, imbriquees: [], grilles: [], sansEtiquette: [], etiquetteCachee: [], nombresGauche: 0, nombresVariables: 0 };

  if (sortie.largeur > L + 1) {
    for (const el of tous) {
      if (el.getBoundingClientRect().right <= L + 1) continue;
      const parent = el.parentElement;
      if (parent && parent !== document.body && parent.getBoundingClientRect().right > L + 1) continue;
      sortie.depassent.push(decrire(el));
      if (sortie.depassent.length === 3) break;
    }
  }
  if (L < 768) {
    const cibles = "a[href], button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, summary, [role=button], [role=tab], [role=menuitem]";
    for (const el of document.querySelectorAll(cibles)) {
      if (!visible(el) || (el.tagName === "A" && el.closest("p"))) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) sortie.cibles.push(decrire(el) + " " + Math.round(r.width) + " × " + Math.round(r.height));
    }
  }
  for (const img of document.images) if (img.complete && img.naturalWidth === 0 && visible(img)) sortie.images.push(img.getAttribute("src") || decrire(img));
  for (const f of document.fonts) if (f.status === "error") sortie.polices.push(f.family.replace(/["']/g, ""));
  sortie.polices = [...new Set(sortie.polices)];

  // Petites étiquettes en capitales espacées posées juste au-dessus d'un titre.
  sortie.sections = Math.max(1, document.querySelectorAll("h2").length);
  for (const el of tous) {
    const suivant = el.nextElementSibling;
    if (!suivant || !/^H[1-3]$/.test(suivant.tagName) || /^(A|BUTTON|H[1-6])$/.test(el.tagName)) continue;
    const s = getComputedStyle(el);
    const texte = el.textContent.trim();
    const capitales = s.textTransform === "uppercase" || (/[A-ZÀ-Ý]/.test(texte) && texte === texte.toUpperCase());
    const espacees = parseFloat(s.letterSpacing) > 0.4;
    if (capitales && espacees && parseFloat(s.fontSize) <= 14.5 && texte && texte.split(/\s+/).length <= 5) sortie.etiquettes++;
  }

  // Cartes : blocs encadrés (bordure sur les quatre côtés, ou ombre), avec une marge intérieure.
  const HORS_CARTE = /^(INPUT|SELECT|TEXTAREA|BUTTON|IMG|SVG|TABLE|THEAD|TBODY|TR|TD|TH|A|LABEL|UL|OL|NAV|HEADER|FOOTER|MAIN|DIALOG)$/;
  const estCarte = (el) => {
    if (HORS_CARTE.test(el.tagName.toUpperCase())) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 160 || r.height < 80) return false;
    const s = getComputedStyle(el);
    const cote = (c) => parseFloat(s["border" + c + "Width"]) > 0 && s["border" + c + "Style"] !== "none" && !/rgba\(.*,\s*0\)$|transparent/.test(s["border" + c + "Color"]);
    const encadre = ["Top", "Right", "Bottom", "Left"].every(cote) || (s.boxShadow && s.boxShadow !== "none");
    return encadre && parseFloat(s.paddingTop) >= 8 && parseFloat(s.paddingLeft) >= 8;
  };
  const cartes = new Set(tous.filter(estCarte));
  for (const c of cartes) {
    for (let a = c.parentElement; a && a !== document.body; a = a.parentElement)
      if (cartes.has(a)) {
        sortie.imbriquees.push(decrire(c));
        break;
      }
  }
  // Grille de 3 à 6 cartes de même forme : chacune une icône, un titre, un texte court.
  const forme = (el, n = 2) => el.tagName + (n ? "(" + [...el.children].map((e) => forme(e, n - 1)).join(",") + ")" : "");
  for (const parent of new Set([...cartes].map((c) => c.parentElement))) {
    if (!parent) continue;
    const enfants = [...parent.children].filter(visible);
    if (enfants.length < 3 || enfants.length > 6 || !enfants.every((e) => cartes.has(e))) continue;
    const modele = forme(enfants[0]);
    const largeur = enfants[0].getBoundingClientRect().width;
    const pareilles = enfants.every(
      (e) => forme(e) === modele && Math.abs(e.getBoundingClientRect().width - largeur) < 2 && e.querySelector("svg") && e.querySelector("h2, h3, h4, h5, h6, strong") && e.textContent.trim().length < 200,
    );
    if (pareilles) sortie.grilles.push(decrire(parent) + " (" + enfants.length + " cartes)");
  }

  // Champs : une étiquette visible pour chacun.
  for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea")) {
    if (!visible(el)) continue;
    const parLabel = [...(el.labels || [])].some((l) => visible(l) && l.textContent.trim());
    const parId = (el.getAttribute("aria-labelledby") || "").split(/\s+/).some((id) => {
      const e = id && document.getElementById(id);
      return e && visible(e);
    });
    if (parLabel || parId) continue;
    if (el.getAttribute("aria-label")) {
      if (el.type !== "search") sortie.etiquetteCachee.push(decrire(el));
    } else sortie.sansEtiquette.push(decrire(el) + (el.placeholder ? " (texte d'exemple seul : « " + el.placeholder.slice(0, 30) + " »)" : ""));
  }

  // Nombres des tableaux : alignés à droite, chiffres de même largeur.
  for (const td of document.querySelectorAll("tbody td")) {
    if (!visible(td)) continue;
    const t = td.textContent.trim();
    if (!/\d/.test(t) || !/^[-+−]?[\d\s.,]+\s?(%|€|\$|£|h|min|kg|g|km|m)?$/.test(t)) continue;
    const s = getComputedStyle(td);
    if (!/right|end/.test(s.textAlign)) sortie.nombresGauche++;
    if (!/tabular-nums/.test(s.fontVariantNumeric) && !/mono/i.test(s.fontFamily)) sortie.nombresVariables++;
  }
  return JSON.stringify(sortie);
}
const RELEVES = (L) => `(${releverPage.toString()})(${L})`;

async function evaluer(page, expression) {
  const r = await page.envoyer("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

const attendreRendu = (page) => evaluer(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))");

async function charger(page, fichier, largeur) {
  await page.envoyer("Emulation.setDeviceMetricsOverride", { width: largeur, height: HAUTEUR(largeur), deviceScaleFactor: 1, mobile: false });
  await page.envoyer("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const charge = page.attendre("Page.loadEventFired");
  await page.envoyer("Page.navigate", { url: pathToFileURL(path.resolve(fichier)).href });
  await charge;
  await evaluer(page, "Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))]).then(() => true)");
  await evaluer(
    page,
    `(() => { const s = document.createElement("style"); s.textContent = "[data-selecteur-etats]{display:none!important}html{scroll-behavior:auto!important}"; document.head.appendChild(s); return true; })()`,
  );
  await attendreRendu(page);
}

/** Captures successives d'une hauteur d'écran, du haut de la page vers le bas. */
async function capturerEcrans(page, largeur, max, prefixe) {
  const hauteur = HAUTEUR(largeur);
  const totale = await evaluer(page, "Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)");
  const n = Math.max(1, Math.ceil((totale - 2) / hauteur));
  const fichiers = [];
  for (let k = 0; k < Math.min(n, max); k++) {
    await evaluer(page, `(window.scrollTo({ top: ${k * hauteur}, behavior: "instant" }), true)`);
    await attendreRendu(page);
    const { data } = await page.envoyer("Page.captureScreenshot", { format: "png" });
    const fichier = `${prefixe}-${k + 1}.png`;
    fs.writeFileSync(fichier, Buffer.from(data, "base64"));
    fichiers.push(fichier);
  }
  await evaluer(page, `(window.scrollTo({ top: 0, behavior: "instant" }), true)`);
  return { fichiers, coupee: n > max ? n : 0 };
}

function constatsDuRendu(releve, largeur) {
  const constats = [];
  if (releve.depassent.length || releve.largeur > largeur + 1)
    constats.push({ gravite: "🔴", nom: `La page déborde en largeur (${releve.largeur} px pour un écran de ${largeur} px)${releve.depassent.length ? " : " + releve.depassent.join(" ; ") : ""}`, source: SOURCE });
  if (releve.cibles.length) constats.push({ gravite: "🟠", nom: `Cibles tactiles sous 44 × 44 px : ${releve.cibles.length} (${releve.cibles.slice(0, 3).join(" ; ")}${releve.cibles.length > 3 ? " ; …" : ""})`, source: SOURCE });
  for (const src of releve.images) constats.push({ gravite: "🟠", nom: `Image non chargée : ${src}`, source: "rendu" });
  const exemples = (liste) => `${liste.slice(0, 3).join(" ; ")}${liste.length > 3 ? " ; …" : ""}`;
  if (releve.imbriquees.length) constats.push({ gravite: "🔴", nom: `Cartes dans des cartes : ${releve.imbriquees.length} (${exemples(releve.imbriquees)})`, source: "anti-patterns.md" });
  for (const g of releve.grilles) constats.push({ gravite: "🔴", nom: `Grille de cartes identiques icône + titre + texte : ${g}`, source: "anti-patterns.md" });
  if (releve.sansEtiquette.length) constats.push({ gravite: "🔴", nom: `Champ sans étiquette : ${releve.sansEtiquette.length} (${exemples(releve.sansEtiquette)})`, source: "anti-patterns.md" });
  if (releve.etiquetteCachee.length) constats.push({ gravite: "🟠", nom: `Champ sans étiquette visible (nom lu seulement par les lecteurs d'écran) : ${releve.etiquetteCachee.length} (${exemples(releve.etiquetteCachee)})`, source: SOURCE });
  const permises = Math.ceil(releve.sections / 3);
  if (releve.etiquettes > permises) constats.push({ gravite: "🟠", nom: `Petites étiquettes en capitales au-dessus des titres : ${releve.etiquettes} pour ${releve.sections} section(s), ${permises} au plus`, source: "anti-patterns.md" });
  if (releve.nombresGauche) constats.push({ gravite: "🟢", nom: `Nombres de tableau non alignés à droite : ${releve.nombresGauche} cellule(s)`, source: "motifs.md" });
  if (releve.nombresVariables) constats.push({ gravite: "🟢", nom: `Nombres de tableau sans chiffres de même largeur (font-variant-numeric: tabular-nums) : ${releve.nombresVariables} cellule(s)`, source: "motifs.md" });
  return constats;
}

async function capturerPage(page, fichier, base) {
  const dossier = path.join(path.dirname(fichier), "captures");
  const nom = path.basename(fichier, ".html");
  fs.mkdirSync(dossier, { recursive: true });
  for (const f of fs.readdirSync(dossier)) if (f.startsWith(`${nom}-`) && f.endsWith(".png")) fs.rmSync(path.join(dossier, f), { force: true });
  const relatif = (f) => path.relative(base, f).split(path.sep).join("/");
  const resultat = { page: relatif(fichier), captures: [], constats: [], avertissements: new Set() };
  const { capturees, mesurees } = largeurs(path.basename(fichier));

  for (const largeur of mesurees) {
    await charger(page, fichier, largeur);
    for (const c of constatsDuRendu(JSON.parse(await evaluer(page, RELEVES(largeur))), largeur)) if (c.gravite === "🔴") resultat.constats.push({ ...c, largeur });
  }
  for (const largeur of capturees) {
    await charger(page, fichier, largeur);
    const releve = JSON.parse(await evaluer(page, RELEVES(largeur)));
    for (const c of constatsDuRendu(releve, largeur)) resultat.constats.push({ ...c, largeur });
    for (const p of releve.polices) resultat.avertissements.add(`Police web non chargée : ${p} (réseau coupé, ou domaine absent du bac à sable) ; les captures montrent la police de secours.`);

    const normal = await capturerEcrans(page, largeur, MAX_ECRANS.normal, path.join(dossier, `${nom}-${largeur}`));
    resultat.captures.push({ largeur, etat: "normal", fichiers: normal.fichiers.map(relatif) });
    if (normal.coupee) resultat.avertissements.add(`${nom} à ${largeur} px : ${normal.coupee} hauteurs d'écran, seules les ${MAX_ECRANS.normal} premières sont capturées.`);

    const etats = JSON.parse(await evaluer(page, `JSON.stringify([...new Set([...document.querySelectorAll("[data-etat]")].map((e) => e.getAttribute("data-etat")))])`));
    for (const etat of etats.slice(1)) {
      const nomEtat = String(etat).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "etat";
      await evaluer(page, `(() => { const b = document.querySelector('[data-etat="${String(etat).replace(/["\\]/g, "")}"]'); if (b) b.click(); return true; })()`);
      await attendreRendu(page);
      const r = JSON.parse(await evaluer(page, RELEVES(largeur)));
      for (const c of constatsDuRendu(r, largeur)) if (c.gravite === "🔴") resultat.constats.push({ ...c, largeur, etat });
      const ecrans = await capturerEcrans(page, largeur, MAX_ECRANS.etat, path.join(dossier, `${nom}-${largeur}-${nomEtat}`));
      resultat.captures.push({ largeur, etat, fichiers: ecrans.fichiers.map(relatif) });
    }
  }
  return resultat;
}

async function principal(args) {
  const chemin = args[0];
  if (!chemin) {
    console.error("Usage : pulse-aidd maquettes capturer <fichier.html|dossier>");
    return 2;
  }
  if (!fs.existsSync(chemin)) {
    console.error(`Chemin introuvable : ${chemin}`);
    return 2;
  }
  const liste = pages(chemin);
  if (!liste.length) {
    console.error(`Aucune page HTML dans ${chemin}.`);
    return 2;
  }
  const navigateur = trouverNavigateur();
  if (!navigateur) {
    console.log("❓ Aucun navigateur trouvé (Google Chrome, Microsoft Edge ou Chromium) : captures impossibles. Installez Chrome ou Edge, ou indiquez le chemin du navigateur dans la variable CHROME_PATH.");
    return 3;
  }
  let page;
  try {
    page = await ouvrir(navigateur.chemin);
  } catch (e) {
    console.log(`❓ Le navigateur (${navigateur.origine}) n'a pas pu s'ouvrir : ${e.message}. Captures impossibles.`);
    return 3;
  }
  const base = fs.statSync(chemin).isFile() ? path.dirname(chemin) : chemin;
  const resultats = [];
  try {
    for (const f of liste) resultats.push(await capturerPage(page, f, base));
  } catch (e) {
    console.log(`❓ Captures interrompues : ${e.message}.`);
    return 3;
  } finally {
    await page.fermer();
  }

  console.log(`Captures (navigateur : ${navigateur.origine}), à ouvrir avec l'outil Read :`);
  for (const r of resultats) for (const c of r.captures) console.log(`- ${r.page}, ${c.largeur} px, état ${c.etat} : ${c.fichiers.join(", ")}`);
  const avertissements = resultats.flatMap((r) => [...r.avertissements]);
  if (avertissements.length) console.log("\n" + [...new Set(avertissements)].map((a) => `⚠️ ${a}`).join("\n"));
  const constats = resultats.flatMap((r) => r.constats.map((c) => ({ ...c, page: r.page })));
  if (!constats.length) {
    console.log("\nAucun défaut détecté dans le rendu. Regardez les captures pour le reste.");
    return 0;
  }
  console.log("");
  for (const c of constats) console.log(`${c.gravite} ${c.page} (${c.largeur} px${c.etat ? `, état ${c.etat}` : ""})  ${c.nom}  (${c.source})`);
  const n = (g) => constats.filter((c) => c.gravite === g).length;
  console.log(`\n${constats.length} constat(s) : 🔴 ${n("🔴")} · 🟠 ${n("🟠")} · 🟢 ${n("🟢")}`);
  return n("🔴") ? 1 : 0;
}

if (require.main === module) principal(process.argv.slice(2)).then((code) => (process.exitCode = code));

module.exports = { principal, largeurs, pages };

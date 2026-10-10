// Pulse – lecture et écriture de robots.txt (RFC 9309), sans dépendance.
// Utilisé par seo.js (contrôles L5 et IA1 à IA9) et par /pulse:seo ia (piles sans pack).
//
//   analyser(texte)                         → { groupes, sitemaps, signaux, inconnues }
//   groupesPour(analyse, agent)             → les groupes qui s'appliquent à ce robot (le plus précis, sinon *)
//   autorise(analyse, agent, chemin)        → true si le robot peut explorer ce chemin
//   attendu(politique, robot, options)      → "autorise" ou "bloque" selon la politique A, B, C ou D
//   genererRobots(politique, robots, opts)  → texte de robots.txt pour cette politique
"use strict";

const POLITIQUES = ["A", "B", "C", "D"];
const ROLES = ["moteur", "recherche", "demande", "entrainement", "jeton-entrainement", "mixte", "apercu"];

/** Découpe robots.txt en groupes. Un groupe = une ou plusieurs lignes User-agent consécutives, puis leurs règles. */
function analyser(texte) {
  const analyse = { groupes: [], sitemaps: [], signaux: [], inconnues: [] };
  let courant = null;
  let dernierEtaitAgent = false;
  const lignes = String(texte || "").replace(/^﻿/, "").split(/\r\n|\r|\n/);
  lignes.forEach((brute, i) => {
    const ligne = brute.replace(/#.*$/, "").trim();
    if (!ligne) return;
    const m = ligne.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) {
      analyse.inconnues.push({ ligne: i + 1, texte: brute.trim() });
      return;
    }
    const cle = m[1].toLowerCase();
    const valeur = m[2].trim();
    if (cle === "user-agent") {
      if (!courant || !dernierEtaitAgent) {
        courant = { agents: [], regles: [], autres: [], ligne: i + 1 };
        analyse.groupes.push(courant);
      }
      courant.agents.push(valeur.toLowerCase());
      dernierEtaitAgent = true;
      return;
    }
    dernierEtaitAgent = false;
    if (cle === "sitemap") {
      analyse.sitemaps.push(valeur);
    } else if (cle === "allow" || cle === "disallow") {
      if (courant) courant.regles.push({ type: cle, chemin: valeur, ligne: i + 1 });
      else analyse.inconnues.push({ ligne: i + 1, texte: brute.trim() });
    } else if (cle === "content-signal") {
      analyse.signaux.push({ valeur, agents: courant ? courant.agents.slice() : ["*"], ligne: i + 1 });
      if (courant) courant.autres.push({ cle: m[1], valeur });
    } else if (courant) {
      courant.autres.push({ cle: m[1], valeur });
    } else {
      analyse.inconnues.push({ ligne: i + 1, texte: brute.trim() });
    }
  });
  return analyse;
}

/** Le groupe le plus précis : celui qui nomme le robot (insensible à la casse), sinon celui de « * ». Plusieurs groupes du même nom se cumulent. */
function groupesPour(analyse, agent) {
  const nom = String(agent).toLowerCase();
  const nommes = analyse.groupes.filter((g) => g.agents.includes(nom));
  if (nommes.length) return nommes;
  return analyse.groupes.filter((g) => g.agents.includes("*"));
}

function echapperRegex(t) {
  return t.replace(/[.+?^{}()|[\]\\]/g, "\\$&");
}

/** Une règle s'applique-t-elle à ce chemin ? « * » = n'importe quelle suite, « $ » final = fin du chemin. */
function correspond(motif, chemin) {
  const fin = motif.endsWith("$");
  const corps = fin ? motif.slice(0, -1) : motif;
  const regex = new RegExp(`^${corps.split("*").map(echapperRegex).join(".*")}${fin ? "$" : ""}`);
  return regex.test(chemin);
}

/** RFC 9309 : la règle la plus longue qui correspond l'emporte ; à égalité, Allow gagne ; aucune règle = permis. */
function autorise(analyse, agent, chemin = "/") {
  if (chemin === "/robots.txt") return true;
  let meilleure = null;
  for (const g of groupesPour(analyse, agent)) {
    for (const r of g.regles) {
      if (!r.chemin) continue; // « Disallow: » vide = rien d'interdit
      if (!correspond(r.chemin, chemin)) continue;
      const longueur = r.chemin.length;
      if (!meilleure || longueur > meilleure.longueur || (longueur === meilleure.longueur && r.type === "allow")) meilleure = { longueur, type: r.type };
    }
  }
  return !meilleure || meilleure.type === "allow";
}

/** Ce que chaque politique attend d'un robot. options.bloquerMixte : bloquer aussi Amazonbot dans la politique B. */
function attendu(politique, robot, options = {}) {
  const role = robot.role;
  if (politique === "D") return "bloque";
  if (politique === "A" || role === "moteur" || role === "apercu") return "autorise";
  if (role === "entrainement" || role === "jeton-entrainement") return "bloque";
  if (politique === "B") return role === "mixte" && options.bloquerMixte ? "bloque" : "autorise";
  return "bloque"; // C : recherche, demande et mixte bloqués aussi
}

/**
 * Texte de robots.txt pour une politique.
 * opts : { sitemap: adresse absolue, fermes: chemins à ne pas explorer (groupe *), contentSignal: "search=yes, …", bloquerMixte }
 * Les robots bloqués reçoivent un groupe « Disallow: / » : ils n'ouvrent ainsi aucun chemin fermé pour « * ».
 */
function genererRobots(politique, robots, opts = {}) {
  if (!POLITIQUES.includes(politique)) throw new Error(`Politique inconnue : ${politique} (A, B, C ou D)`);
  const lignes = [];
  if (politique === "D") {
    lignes.push("# Site privé : aucune page à explorer. La vraie protection reste la connexion.", "User-agent: *", "Disallow: /");
    return `${lignes.join("\n")}\n`;
  }
  lignes.push(`# Politique des robots IA : ${politique} (choisie avec /pulse:seo ia, notée dans docs/seo.md)`);
  lignes.push("User-agent: *", "Allow: /");
  for (const chemin of opts.fermes || []) lignes.push(`Disallow: ${chemin}`);
  if (opts.contentSignal) lignes.push(`Content-Signal: ${opts.contentSignal}`);
  const bloques = robots.filter((r) => attendu(politique, r, opts) === "bloque").map((r) => r.jeton);
  if (bloques.length) {
    lignes.push("");
    for (const jeton of bloques) lignes.push(`User-agent: ${jeton}`);
    lignes.push("Disallow: /");
  }
  if (opts.sitemap) lignes.push("", `Sitemap: ${opts.sitemap}`);
  return `${lignes.join("\n")}\n`;
}

/** Lit « search=yes, ai-input=yes, ai-train=no » ; rend { valeurs, erreurs }. */
function lireSignal(valeur) {
  const valeurs = {};
  const erreurs = [];
  for (const morceau of String(valeur).split(",")) {
    const t = morceau.trim();
    if (!t) continue;
    const m = t.match(/^([a-z-]+)\s*=\s*([a-z]+)$/i);
    if (!m) {
      erreurs.push(`« ${t} » n'a pas la forme clé=yes|no`);
      continue;
    }
    const cle = m[1].toLowerCase();
    const v = m[2].toLowerCase();
    if (!["search", "ai-input", "ai-train"].includes(cle)) erreurs.push(`clé inconnue « ${cle} » (search, ai-input, ai-train)`);
    if (!["yes", "no"].includes(v)) erreurs.push(`valeur « ${v} » pour ${cle} (yes ou no)`);
    valeurs[cle] = v;
  }
  return { valeurs, erreurs };
}

module.exports = { POLITIQUES, ROLES, analyser, groupesPour, correspond, autorise, attendu, genererRobots, lireSignal };

#!/usr/bin/env node
// Pulse – contrôle des anti-patterns détectables dans les pages HTML de /pulse:ui (planches et maquettes).
//
//   pulse-aidd maquettes verifier <fichier.html|dossier>
//
// Chaque constat renvoie à une entrée de ui/anti-patterns.md ou à une règle de regles-ui.md.
// La liste des polices « réflexes » est lue dans regles-ui.md (seule source).
// Un dossier est parcouru avec ses sous-dossiers ; comparer.html et alternatives/ sont ignorés.
// Codes de sortie : 0 aucun 🔴 ; 1 au moins un 🔴 ; 2 usage ou chemin introuvable.
"use strict";

const fs = require("fs");
const path = require("path");

const REGLES_UI = path.join(__dirname, "..", "references", "regles-ui.md");

const CONSTATS = [
  { id: "degrade", gravite: "🔴", nom: "Texte en dégradé de couleur", source: "anti-patterns.md", cle: "Texte en dégradé de couleur" },
  { id: "verre", gravite: "🔴", nom: "Effet verre dépoli décoratif", source: "anti-patterns.md", cle: "Effet verre dépoli décoratif" },
  { id: "lisere", gravite: "🔴", nom: "Bordure d'accent colorée sur le côté gauche des blocs", source: "anti-patterns.md", cle: "Bordure d'accent colorée sur le côté gauche des blocs" },
  { id: "focus", gravite: "🔴", nom: "Focus clavier invisible (aucune règle :focus-visible)", source: "anti-patterns.md", cle: "Focus clavier invisible" },
  { id: "langue", gravite: "🔴", nom: "Langue de la page non déclarée", source: "regles-ui.md", cle: "Langue de la page" },
  { id: "police", gravite: "🟠", nom: "Police réflexe en titre", source: "anti-patterns.md", cle: "Police réflexe en titre" },
  { id: "couleur", gravite: "🟠", nom: "Couleur hors palette (valeur écrite hors d'une variable)", source: "regles-ui.md", cle: "Toute couleur vient de la palette" },
  { id: "remplissage", gravite: "🟠", nom: "Texte de remplissage générique au lieu de contenus réalistes", source: "anti-patterns.md", cle: "Texte de remplissage générique" },
  { id: "rebond", gravite: "🟠", nom: "Mouvement qui rebondit (courbe qui dépasse sa cible)", source: "regles-ui.md", cle: "s'arrête net" },
  { id: "animations", gravite: "🟠", nom: "Animations sans la préférence « réduire les animations »", source: "regles-ui.md", cle: "Réduire les animations" },
  { id: "tiret", gravite: "🟢", nom: "Tiret cadratin décoratif dans les textes", source: "anti-patterns.md", cle: "Tiret cadratin décoratif dans les textes" },
  { id: "emoji", gravite: "🟢", nom: "Emoji en guise d'icônes d'interface", source: "anti-patterns.md", cle: "Emoji en guise d'icônes d'interface" },
  { id: "icone", gravite: "🟢", nom: "Icône seule sans nom accessible", source: "anti-patterns.md", cle: "Icône seule sans nom accessible" },
];
const PAR_ID = Object.fromEntries(CONSTATS.map((c) => [c.id, c]));
const ORDRE = { "🔴": 0, "🟠": 1, "🟢": 2 };

const COULEUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/gi;
const VARIABLE_TITRE = /(--(?:police|font)-(?:titres?|heading|display|title)[\w-]*)\s*:\s*([^;}]+)/gi;
const EMOJI = /(?![©®™‼⁉])\p{Extended_Pictographic}/gu;

let reflexes = null;
function policesReflexes() {
  if (!reflexes) {
    const ligne = fs.readFileSync(REGLES_UI, "utf8").split("\n").find((l) => l.includes("Polices « réflexes »")) || "";
    const m = ligne.match(/par défaut : ([^.]+)\./);
    reflexes = m ? m[1].split(",").map((p) => p.trim()).filter(Boolean) : [];
  }
  return reflexes;
}
const contientReflexe = (valeur) => {
  const familles = valeur.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "").toLowerCase());
  return policesReflexes().some((p) => familles.includes(p.toLowerCase()));
};

// Remplace une plage par des espaces en gardant les retours à la ligne (les positions restent justes).
const masquer = (texte, debut, fin) => texte.slice(0, debut) + texte.slice(debut, fin).replace(/[^\n]/g, " ") + texte.slice(fin);

function verifier(html) {
  const debutsLignes = [0];
  for (let i = 0; i < html.length; i++) if (html[i] === "\n") debutsLignes.push(i + 1);
  const ligneDe = (pos) => {
    let bas = 0, haut = debutsLignes.length - 1;
    while (bas < haut) {
      const milieu = (bas + haut + 1) >> 1;
      if (debutsLignes[milieu] <= pos) bas = milieu;
      else haut = milieu - 1;
    }
    return bas + 1;
  };
  const vus = new Set();
  const constats = [];
  const relever = (id, pos) => {
    const ligne = ligneDe(pos);
    if (vus.has(`${id}:${ligne}`)) return;
    vus.add(`${id}:${ligne}`);
    constats.push({ ...PAR_ID[id], ligne });
  };

  // Segments de CSS : blocs <style> et attributs style="…", avec leur position dans la page.
  const css = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) css.push({ texte: m[1], debut: m.index + m[0].indexOf(m[1]) });
  for (const m of html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) css.push({ texte: m[1], debut: m.index + m[0].indexOf(m[1]), enLigne: true });

  // Texte visible : sans <style>, <script>, commentaires ni balises.
  let texte = html;
  for (const re of [/<style\b[\s\S]*?<\/style>/gi, /<script\b[\s\S]*?<\/script>/gi, /<!--[\s\S]*?-->/g, /<[^>]+>/g])
    for (const m of [...texte.matchAll(re)]) texte = masquer(texte, m.index, m.index + m[0].length);

  for (const seg of css) {
    let s = seg.texte;
    for (const m of [...s.matchAll(/\/\*[\s\S]*?\*\//g)]) s = masquer(s, m.index, m.index + m[0].length);
    const a = (i) => seg.debut + i;
    // Sélecteur de la règle qui contient la position i (texte entre la fin de la règle précédente et « { »).
    const selecteur = (i) => {
      const ouverture = s.lastIndexOf("{", i);
      return ouverture < 0 ? "" : s.slice(Math.max(s.lastIndexOf("}", ouverture), s.lastIndexOf("{", ouverture - 1)) + 1, ouverture);
    };
    for (const m of s.matchAll(/background-clip\s*:\s*text/gi)) relever("degrade", a(m.index));
    for (const m of s.matchAll(/backdrop-filter\s*:[^;}]*blur/gi)) relever("verre", a(m.index));
    for (const m of s.matchAll(/border-left(?:-width)?\s*:\s*(\d+(?:\.\d+)?)px([^;}]*)/gi)) {
      // Un liseré neutre, transparent, de citation ou de navigation active reste permis.
      const neutre = /transparent|var\(--(?:border|input|muted)/i.test(m[2]);
      const permis = /blockquote|aria-current|\.(?:active|actif)\b/i.test(seg.enLigne ? "" : selecteur(m.index));
      if (Number(m[1]) >= 3 && !neutre && !permis) relever("lisere", a(m.index));
    }
    for (const m of s.matchAll(/cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/gi)) {
      const [y1, y2] = [Number(m[2]), Number(m[4])];
      if (y1 < 0 || y1 > 1 || y2 < 0 || y2 > 1) relever("rebond", a(m.index));
    }
    for (const m of s.matchAll(COULEUR)) {
      const borne = Math.max(s.lastIndexOf(";", m.index), s.lastIndexOf("{", m.index), s.lastIndexOf("}", m.index));
      const declaration = s.slice(borne + 1, m.index);
      const suite = s.slice(m.index).search(/[;{}]/);
      const dansSelecteur = suite >= 0 && s[m.index + suite] === "{";
      if ((declaration.includes(":") || seg.enLigne) && !dansSelecteur && !declaration.trim().startsWith("--")) relever("couleur", a(m.index));
    }
    for (const m of s.matchAll(VARIABLE_TITRE)) if (contientReflexe(m[2])) relever("police", a(m.index));
    if (!seg.enLigne)
      for (const r of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/(^|[\s,>+~])h[1-3]\b/i.test(r[1])) continue;
        const corps = r.index + r[0].indexOf("{") + 1;
        for (const d of r[2].matchAll(/font-family\s*:\s*([^;]+)/gi)) if (contientReflexe(d[1])) relever("police", a(corps + d.index));
      }
  }

  if (!html.includes(":focus-visible")) {
    const style = html.search(/<style\b/i);
    relever("focus", style >= 0 ? style : 0);
  }
  const balise = html.match(/<html\b[^>]*>/i);
  if (!balise) relever("langue", 0);
  else if (!/\slang\s*=/i.test(balise[0])) relever("langue", balise.index);
  if (!/prefers-reduced-motion/i.test(html))
    for (const seg of css) {
      const m = seg.texte.match(/\b(?:transition|animation)\s*:|@keyframes/i);
      if (m) {
        relever("animations", seg.debut + m.index);
        break;
      }
    }

  for (const m of texte.matchAll(/lorem ipsum/gi)) relever("remplissage", m.index);
  for (const m of texte.matchAll(/—|&mdash;/g)) relever("tiret", m.index);
  for (const m of texte.matchAll(EMOJI)) relever("emoji", m.index);
  for (const m of html.matchAll(/<button\b([^>]*)>\s*<svg\b[\s\S]*?<\/svg>\s*<\/button>/gi))
    if (!/aria-label(?:ledby)?\s*=|\stitle\s*=/i.test(m[1])) relever("icone", m.index);

  return constats.sort((x, y) => x.ligne - y.ligne || ORDRE[x.gravite] - ORDRE[y.gravite]);
}

function pages(chemin) {
  if (fs.statSync(chemin).isFile()) return [chemin];
  const liste = [];
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!["alternatives", "node_modules", ".git"].includes(e.name)) parcourir(p);
      } else if (/\.html$/i.test(e.name) && e.name !== "comparer.html") liste.push(p);
    }
  };
  parcourir(chemin);
  return liste.sort();
}

function principal(args) {
  const [action, chemin] = args;
  if (action !== "verifier" || !chemin) {
    console.error("Usage : pulse-aidd maquettes verifier <fichier.html|dossier>");
    return 2;
  }
  if (!fs.existsSync(chemin)) {
    console.error(`Chemin introuvable : ${chemin}`);
    return 2;
  }
  const base = fs.statSync(chemin).isFile() ? path.dirname(chemin) : chemin;
  const tous = [];
  for (const f of pages(chemin)) {
    const relatif = path.relative(base, f).split(path.sep).join("/");
    for (const c of verifier(fs.readFileSync(f, "utf8"))) tous.push({ ...c, fichier: relatif });
  }
  if (!tous.length) {
    console.log("Aucun anti-pattern détectable. Les autres se vérifient à l'œil (anti-patterns.md).");
    return 0;
  }
  for (const c of tous) console.log(`${c.gravite} ${c.fichier}:${c.ligne}  ${c.nom}  (${c.source})`);
  const n = (g) => tous.filter((c) => c.gravite === g).length;
  console.log(`\n${tous.length} constat(s) : 🔴 ${n("🔴")} · 🟠 ${n("🟠")} · 🟢 ${n("🟢")}`);
  return n("🔴") ? 1 : 0;
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { verifier, CONSTATS, policesReflexes };

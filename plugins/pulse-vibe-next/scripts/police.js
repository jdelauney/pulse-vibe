#!/usr/bin/env node
// Pulse Next.js – une police hébergée par le site (`pulse-aidd pile police`, depuis le thème).
//
//   pulse-aidd pile police <famille> [--role texte|titres|code] [--graisses 400,600] [--dossier <projet>]
//
// Récupère la police sur Bunny Fonts (https://fonts.bunny.net), copie ses fichiers dans public/fonts/
// (jeux de caractères latin et latin étendu, le français y est entier), les déclare dans app/polices.css
// et la donne à son rôle dans app/globals.css (`--font-sans` texte, `--font-heading` titres, `--font-mono` code).
// Le site sert ensuite ses polices lui-même : aucune requête vers un autre site à l'affichage, rien à ouvrir
// dans les en-têtes de sécurité (`font-src 'self'`), et la construction n'a pas besoin du réseau.
// Les fichiers de la police remplacée sont retirés quand plus aucun rôle ne l'emploie.
// Codes de sortie : 0 police posée ; 1 police introuvable ou téléchargement refusé ; 2 usage.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const API = () => process.env.PULSE_POLICES_API || "https://fonts.bunny.net";
const JEUX = ["latin", "latin-ext"];
const ROLES = {
  texte: { variable: "--font-sans", graisses: "400,500,600,700", repli: "ui-sans-serif, system-ui, sans-serif" },
  titres: { variable: "--font-heading", graisses: "600,700", repli: "ui-sans-serif, system-ui, sans-serif" },
  code: { variable: "--font-mono", graisses: "400", repli: "ui-monospace, monospace" },
};
const ENTETE = `/* ========================================
 * POLICES hébergées par le site (pulse-aidd pile police <famille>)
 * Fichiers dans public/fonts/, récupérés sur Bunny Fonts ; jeux latin et latin étendu,
 * chacun avec sa plage de caractères : le navigateur ne charge que ceux dont la page a besoin.
 * Le rôle de chaque police se règle dans globals.css (--font-sans, --font-heading, --font-mono).
 * ======================================== */
`;

function lireArguments(argv) {
  const opts = { famille: null, role: "texte", graisses: null, dossier: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--role") opts.role = argv[++i];
    else if (a === "--graisses") opts.graisses = argv[++i];
    else if (a === "--dossier") opts.dossier = path.resolve(argv[++i] || ".");
    else if (a.startsWith("--")) throw new Error(`Option inconnue : ${a}`);
    else if (!opts.famille) opts.famille = a;
    else throw new Error(`Argument en trop : ${a}`);
  }
  if (!opts.famille) throw new Error("Indiquez le nom de la police (ex. « Literata »).");
  if (!ROLES[opts.role]) throw new Error(`Rôle inconnu : ${opts.role} (texte, titres ou code).`);
  opts.graisses = opts.graisses || ROLES[opts.role].graisses;
  if (!/^\d{3}(,\d{3})*$/.test(opts.graisses)) throw new Error(`Graisses à écrire en chiffres séparés par des virgules : ${opts.graisses}`);
  return opts;
}

/** Nom de la police chez Bunny : minuscules, mots séparés par des tirets (« Space Mono » → space-mono). */
const identifiant = (famille) =>
  famille
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Les règles @font-face de la feuille Bunny, chacune avec son jeu de caractères (commentaire qui la précède). */
function lireFeuille(css) {
  const regles = [];
  for (const m of css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    const corps = m[2];
    const valeur = (nom) => (corps.match(new RegExp(`${nom}\\s*:\\s*([^;]+);`)) || [])[1]?.trim();
    const woff2 = (corps.match(/url\(([^)]+\.woff2)\)/) || [])[1];
    regles.push({
      jeu: m[1],
      famille: (valeur("font-family") || "").replace(/^['"]|['"]$/g, ""),
      style: valeur("font-style") || "normal",
      graisse: valeur("font-weight"),
      plage: (valeur("unicode-range") || "").split(/\s*,\s*/).filter(Boolean),
      woff2: woff2 && woff2.replace(/^['"]|['"]$/g, ""),
    });
  }
  return regles;
}

async function telecharger(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} : réponse ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Les fichiers d'une famille dans public/fonts/ (nom posé par ce script : <id>-<jeu>-<graisse>-normal.woff2). */
const fichiersDe = (dossier, id) =>
  fs.readdirSync(dossier).filter((f) => JEUX.some((j) => new RegExp(`^${id}-${j}-\\d{3}-normal\\.woff2$`).test(f)));

const debut = (famille) => `/* police : ${famille} */`;
const fin = (famille) => `/* fin : ${famille} */`;

function section(famille, fichiers) {
  const regles = fichiers.map(
    (f) => `@font-face {
  font-family: "${famille}";
  font-style: ${f.style};
  font-weight: ${f.graisse};
  font-display: swap;
  src: url(/fonts/${f.nom}) format("woff2");
  unicode-range:
    ${f.plage.join(", ")};
}`,
  );
  return `${debut(famille)}\n${regles.join("\n")}\n${fin(famille)}\n`;
}

/** Retire la section d'une famille de polices.css ; rend le texte restant. */
function retirerSection(texte, famille) {
  const a = texte.indexOf(debut(famille));
  const b = texte.indexOf(fin(famille));
  if (a < 0 || b < a) return texte;
  return texte.slice(0, a) + texte.slice(b + fin(famille).length).replace(/^\n/, "");
}

/** Familles nommées en tête des variables de police de globals.css, par variable. */
function famillesDesRoles(globals) {
  const roles = {};
  for (const { variable } of Object.values(ROLES)) {
    const m = globals.match(new RegExp(`^\\s*${variable}\\s*:\\s*"([^"]+)"`, "m"));
    if (m) roles[variable] = m[1];
  }
  return roles;
}

async function principal(argv) {
  let opts;
  try {
    opts = lireArguments(argv);
  } catch (e) {
    process.stderr.write(`${e.message}\nUsage : pulse-aidd pile police <famille> [--role texte|titres|code] [--graisses 400,600] [--dossier <projet>]\n`);
    return 2;
  }
  const role = ROLES[opts.role];
  const id = identifiant(opts.famille);
  const adresse = `${API()}/css?family=${id}:${opts.graisses}&display=swap`;
  let regles;
  try {
    const r = await fetch(adresse);
    regles = lireFeuille(await r.text()).filter((x) => JEUX.includes(x.jeu) && x.style === "normal" && x.woff2);
  } catch (e) {
    process.stdout.write(`Bunny Fonts ne répond pas (${e.message}). Vérifier la connexion, puis relancer.\n`);
    return 1;
  }
  if (!regles.length) {
    process.stdout.write(`Police introuvable sur Bunny Fonts : « ${opts.famille} ». Vérifier son nom exact sur https://fonts.bunny.net, puis relancer.\n`);
    return 1;
  }
  const famille = regles[0].famille || opts.famille;
  const dossierPolices = path.join(opts.dossier, "public", "fonts");
  fs.mkdirSync(dossierPolices, { recursive: true });
  const fichiers = [];
  try {
    for (const r of regles) {
      const contenu = await telecharger(r.woff2);
      if (contenu.subarray(0, 4).toString("latin1") !== "wOF2") throw new Error(`${r.woff2} : ce n'est pas un fichier de police woff2`);
      const nom = `${id}-${r.jeu}-${r.graisse}-normal.woff2`;
      fs.writeFileSync(path.join(dossierPolices, nom), contenu);
      fichiers.push({ ...r, nom });
    }
  } catch (e) {
    process.stdout.write(`Téléchargement refusé : ${e.message}. Rien n'est changé dans les feuilles de style ; relancer plus tard.\n`);
    return 1;
  }
  const obtenues = [...new Set(fichiers.map((f) => f.graisse))];
  const absentes = opts.graisses.split(",").filter((g) => !obtenues.includes(g));

  // globals.css : la police prend son rôle ; la police remplacée perd ses fichiers si plus aucun rôle ne l'emploie.
  const cheminGlobals = path.join(opts.dossier, "app", "globals.css");
  const cheminPolices = path.join(opts.dossier, "app", "polices.css");
  let polices = fs.existsSync(cheminPolices) ? fs.readFileSync(cheminPolices, "utf8") : ENTETE;
  const lignes = [];
  const declaration = `${role.variable}: "${famille}", ${role.repli};`;
  if (fs.existsSync(cheminGlobals)) {
    let globals = fs.readFileSync(cheminGlobals, "utf8");
    const avant = famillesDesRoles(globals);
    const motif = new RegExp(`^(\\s*)${role.variable}\\s*:[^;]*;`, "m");
    if (motif.test(globals)) {
      globals = globals.replace(motif, (_, retrait) => `${retrait}${declaration}`);
      if (!/@import\s+["']\.\/polices\.css["']/.test(globals)) globals = globals.replace(/(@import\s+"tailwindcss";\n)/, `$1@import "./polices.css";\n`);
      fs.writeFileSync(cheminGlobals, globals);
      lignes.push(`app/globals.css : ${declaration}`);
      const ancienne = avant[role.variable];
      const encore = Object.values(famillesDesRoles(globals));
      if (ancienne && ancienne !== famille && !encore.includes(ancienne)) {
        polices = retirerSection(polices, ancienne);
        for (const f of fichiersDe(dossierPolices, identifiant(ancienne))) fs.rmSync(path.join(dossierPolices, f));
        lignes.push(`${ancienne} n'est plus employée : ses fichiers sont retirés de public/fonts/.`);
      }
    } else lignes.push(`app/globals.css : ajouter dans « @theme inline » la ligne ${declaration}`);
  } else lignes.push(`app/globals.css introuvable : ajouter dans « @theme inline » la ligne ${declaration}`);

  polices = retirerSection(polices, famille);
  // Les fichiers d'une précédente pose de cette famille, à d'autres graisses, ne servent plus.
  const gardes = new Set(fichiers.map((f) => f.nom));
  for (const f of fichiersDe(dossierPolices, id)) if (!gardes.has(f)) fs.rmSync(path.join(dossierPolices, f));
  polices = `${polices.replace(/\n*$/, "\n")}${section(famille, fichiers)}`;
  fs.mkdirSync(path.dirname(cheminPolices), { recursive: true });
  fs.writeFileSync(cheminPolices, polices);

  // Mise en forme par Biome quand le projet l'a : npm run check accepte alors le fichier tel quel.
  const biome = path.join(opts.dossier, "node_modules", ".bin", process.platform === "win32" ? "biome.cmd" : "biome");
  if (fs.existsSync(biome)) spawnSync(biome, ["format", "--write", cheminPolices], { cwd: opts.dossier, stdio: "ignore", shell: process.platform === "win32" });

  process.stdout.write(
    [
      `${famille} (${opts.role}) : ${fichiers.length} fichiers dans public/fonts/, déclarés dans app/polices.css (graisses ${obtenues.join(", ")}).`,
      ...lignes,
      ...(absentes.length ? [`Graisses absentes chez Bunny pour cette police : ${absentes.join(", ")} (le navigateur prend la plus proche).`] : []),
      "",
    ].join("\n"),
  );
  return 0;
}

if (require.main === module) principal(process.argv.slice(2)).then((code) => (process.exitCode = code));

module.exports = { lireFeuille, identifiant, retirerSection, famillesDesRoles };

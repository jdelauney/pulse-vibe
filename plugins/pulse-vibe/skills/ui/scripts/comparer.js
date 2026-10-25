#!/usr/bin/env node
// Pulse – page de comparaison des variantes (`pulse-aidd comparer <dossier>`, /pulse:ui).
//
// Lit les sous-dossiers directs de <dossier> qui contiennent planche.html, desktop.html ou
// mobile.html (retenue/ et alternatives/ ignorés), prend la thèse de chaque note.md
// (ligne « **Thèse** : … », sinon le premier titre, sinon le nom du dossier) et écrit
// <dossier>/comparer.html : une colonne par variante, avec un cadre par fichier et un lien
// pour l'ouvrir en grand. Page autonome, chemins relatifs : elle s'ouvre par double-clic.
//
// Rangement, sans commande de déplacement à autoriser, de docs/design/identite ou docs/design/maquettes/<spec>
// seulement (indiqué depuis la racine du projet, liens refusés ; comparer.html retiré seulement s'il vient de ce script) :
//   --ranger : avant un nouveau lot, range les d<n>-…/v<n>-… dans alternatives/ et affiche « prochain: <n> » ;
//   --retenir <variante> [--mobile <variante>] : après le choix, l'ancien retenue/ part dans
//   alternatives/retenue-<AAAA-MM-JJ>/, le choix est copié dans retenue/ (mobile pris de la seconde variante),
//   les autres variantes sont rangées et comparer.html, périmé, est retiré.
"use strict";

const fs = require("fs");
const path = require("path");

const IGNORES = new Set(["retenue", "alternatives"]);
const CADRES = {
  planche: { fichier: "planche.html", libelle: "Planche", largeur: 1280, hauteur: 900, echelle: 0.5 },
  desktop: { fichier: "desktop.html", libelle: "Ordinateur", largeur: 1280, hauteur: 800, echelle: 0.4 },
  mobile: { fichier: "mobile.html", libelle: "Téléphone", largeur: 390, hauteur: 844, echelle: 0.6 },
};

function echapper(texte) {
  return String(texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** La thèse d'une variante, lue dans note.md. */
function these(note, nom) {
  if (!note) return nom;
  const texte = note.replace(/\r/g, "");
  const ligne = /^\s*(?:[-*]\s+)?\**Thèse\**\s*:\s*(.+?)\s*$/im.exec(texte);
  if (ligne) return ligne[1].replace(/\*\*/g, "").trim();
  const titre = /^#\s+(.+?)\s*$/m.exec(texte);
  return titre ? titre[1].replace(/\*\*/g, "").trim() : nom;
}

/** Les variantes d'un dossier, dans l'ordre naturel de leurs noms. */
function lireVariantes(dossier) {
  return fs
    .readdirSync(dossier, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !IGNORES.has(e.name))
    .map((e) => {
      const ici = path.join(dossier, e.name);
      const present = (f) => fs.existsSync(path.join(ici, f));
      const notePath = path.join(ici, "note.md");
      const note = fs.existsSync(notePath) ? fs.readFileSync(notePath, "utf8") : "";
      return {
        nom: e.name,
        these: these(note, e.name),
        planche: present(CADRES.planche.fichier),
        desktop: present(CADRES.desktop.fichier),
        mobile: present(CADRES.mobile.fichier),
      };
    })
    .filter((v) => v.planche || v.desktop || v.mobile)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { numeric: true }));
}

function cadre(variante, type) {
  const c = CADRES[type];
  if (!variante[type]) return `<div class="absent">Pas de version ${type}</div>`;
  const lien = `${encodeURIComponent(variante.nom)}/${c.fichier}`;
  const largeur = Math.round(c.largeur * c.echelle);
  const hauteur = Math.round(c.hauteur * c.echelle);
  return [
    `<figure>`,
    `<figcaption>${c.libelle} · <a href="${lien}" target="_blank">ouvrir en grand</a></figcaption>`,
    `<div class="ecran" style="width:${largeur}px;height:${hauteur}px">`,
    `<iframe src="${lien}" title="${echapper(variante.nom)} – ${c.libelle}" loading="lazy" style="width:${c.largeur}px;height:${c.hauteur}px;transform:scale(${c.echelle})"></iframe>`,
    `</div>`,
    `</figure>`,
  ].join("\n");
}

function construirePage(titre, variantes) {
  const colonnes = variantes
    .map((v) => {
      const cadres = v.planche ? cadre(v, "planche") : `${cadre(v, "desktop")}\n${cadre(v, "mobile")}`;
      return `<section>\n<h2>${echapper(v.nom)}</h2>\n<p class="these">${echapper(v.these)}</p>\n${cadres}\n</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comparer – ${echapper(titre)}</title>
<style>
  body { margin: 0; padding: 24px; font-family: system-ui, sans-serif; background: #f4f4f2; color: #1d1d1b; }
  header p { max-width: 70ch; }
  main { display: flex; gap: 24px; overflow-x: auto; align-items: flex-start; }
  section { flex: 0 0 auto; background: #fff; border-radius: 8px; padding: 16px; }
  h2 { margin: 0 0 4px; font-size: 1.1rem; }
  .these { margin: 0 0 12px; max-width: 52ch; }
  figure { margin: 0 0 16px; }
  figcaption { font-size: .85rem; margin-bottom: 6px; }
  .ecran { overflow: hidden; border: 1px solid #c8c8c4; border-radius: 6px; }
  iframe { border: 0; transform-origin: 0 0; background: #fff; }
  .absent { padding: 24px; border: 1px dashed #c8c8c4; border-radius: 6px; font-size: .9rem; margin-bottom: 16px; }
</style>
</head>
<body>
<header>
<h1>Comparer les propositions – ${echapper(titre)}</h1>
<p>Chaque colonne est une proposition. Ouvrez-les en grand pour les essayer, puis dites dans Claude Code laquelle vous préférez (ou ce que vous aimeriez mélanger).</p>
</header>
<main>
${colonnes}
</main>
</body>
</html>
`;
}

function principal(argv) {
  const cible = argv[0];
  if (argv.length > 1 || (cible || "").startsWith("--")) return rangement(argv); // toute option : rangement, ou usage (code 1)
  if (!cible) {
    console.error("Usage : pulse-aidd comparer <dossier de variantes> [--ranger | --retenir <variante> [--mobile <variante>]]");
    return 1;
  }
  const dossier = path.resolve(cible);
  if (!fs.existsSync(dossier) || !fs.statSync(dossier).isDirectory()) {
    console.error(`Dossier introuvable : ${cible}`);
    return 1;
  }
  const variantes = lireVariantes(dossier);
  if (variantes.length === 0) {
    console.error(`Aucune variante dans ${cible} : il faut des sous-dossiers contenant planche.html, desktop.html ou mobile.html.`);
    return 1;
  }
  const sortie = path.join(dossier, "comparer.html");
  fs.writeFileSync(sortie, construirePage(path.basename(dossier), variantes));
  console.log(`Page de comparaison : ${sortie}`);
  return 0;
}

// --- Rangement des variantes : --ranger (avant un nouveau lot), --retenir (après le choix de la personne) ---
// Sortie « clé: valeur ». Codes : 0 fait, 1 usage, 2 refus préalable (rien n'a changé), 3 échec rattrapé (état d'avant remis).

const NOM_VARIANTE = /^[dv](\d+)(?:-|$)/; // d<n>-<slug> (identité), v<n>-<slug> (maquettes)

/** Un chemin relatif au projet, sans « .. », ni chemin absolu, ni lettre de lecteur. */
function cheminSur(c) {
  return typeof c === "string" && c !== "" && !c.startsWith("-") && !/(^|[\\/])\.\.([\\/]|$)/.test(c) && !path.isAbsolute(c) && !/^[A-Za-z]:/.test(c);
}

/** Le dossier de design visé, écrit avec des / : docs/design/identite ou docs/design/maquettes/<spec>, sinon null. */
function dossierDeDesign(c) {
  if (!cheminSur(c)) return null;
  const parties = c.replace(/\\/g, "/").split("/").filter((p) => p !== "" && p !== ".");
  const normal = parties.join("/");
  if (normal === "docs/design/identite") return normal;
  if (parties.length === 4 && normal.startsWith("docs/design/maquettes/") && !["retenue", "alternatives"].includes(parties[3])) return normal;
  return null;
}

/** Le dossier existant reste-t-il, liens résolus, à sa place dans le projet ? */
function resteDansLeProjet(dossier, normal) {
  if (!fs.existsSync(dossier)) return true;
  const reel = fs.realpathSync.native(dossier);
  const attendu = path.join(fs.realpathSync.native(process.cwd()), normal);
  return process.platform === "win32" ? reel.toLowerCase() === attendu.toLowerCase() : reel === attendu;
}

const estUnLien = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

/** comparer.html écrit par ce script (et non une page de la personne au même nom). */
function pageDeComparaison(fichier) {
  try {
    const texte = fs.readFileSync(fichier, "utf8");
    return texte.startsWith("<!doctype html>") && texte.includes("<title>Comparer – ");
  } catch {
    return false;
  }
}

function sousDossiers(d) {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}

/** Les dossiers de variantes (d<n>-…, v<n>-…) présents directement dans le dossier. */
function variantesPresentes(dossier) {
  return sousDossiers(dossier)
    .filter((n) => NOM_VARIANTE.test(n))
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
}

/** Le numéro du prochain lot : plus grand <n> trouvé, alternatives/ compris, plus 1. */
function prochainNumero(dossier) {
  const noms = [...sousDossiers(dossier), ...sousDossiers(path.join(dossier, "alternatives"))];
  return 1 + noms.reduce((max, n) => Math.max(max, Number((NOM_VARIANTE.exec(n) || [0, 0])[1])), 0);
}

/** Un nom libre dans un dossier : le nom tel quel, sinon suivi de -2, -3… */
function nomLibre(dossier, nom) {
  let libre = nom;
  for (let k = 2; fs.existsSync(path.join(dossier, libre)); k++) libre = `${nom}-${k}`;
  return libre;
}

function dateDuJour(j = new Date()) {
  return `${j.getFullYear()}-${String(j.getMonth() + 1).padStart(2, "0")}-${String(j.getDate()).padStart(2, "0")}`;
}

/** La variante désignée : son nom complet, ou son début (v2 pour v2-cartes) s'il n'en désigne qu'une. */
function trouverVariante(presentes, demande) {
  if (presentes.includes(demande)) return { nom: demande };
  const candidates = presentes.filter((n) => n.startsWith(`${demande}-`));
  if (candidates.length === 1) return { nom: candidates[0] };
  if (candidates.length > 1) return { erreur: `« ${demande} » désigne plusieurs variantes (${candidates.join(", ")}) : indiquez le nom complet.` };
  return { erreur: `Variante introuvable : ${demande}. Variantes présentes : ${presentes.join(", ") || "aucune"}.` };
}

const affiche = (...p) => p.join("/").replace(/\\/g, "/");

/** Options du rangement ; null si la ligne de commande est incomplète ou contradictoire. */
function lireOptionsRangement(argv) {
  const [cible, ...reste] = argv;
  if (!cible || cible.startsWith("--")) return null;
  const options = { cible };
  for (let i = 0; i < reste.length; i++) {
    const o = reste[i];
    if (o === "--ranger") options.ranger = true;
    else if (o === "--retenir" || o === "--mobile") {
      const valeur = reste[i + 1];
      if (!valeur || valeur.startsWith("--")) return null;
      options[o.slice(2)] = valeur;
      i++;
    } else return null;
  }
  if (Boolean(options.ranger) === Boolean(options.retenir) || (options.mobile && !options.retenir)) return null;
  return options;
}

function refus(message) {
  console.error(`${message} Rien n'a changé.`);
  return 2;
}

/** Défait les déplacements dans l'ordre inverse, retire les dossiers créés, puis signale l'échec (code 3). */
function echec(erreur, journal, crees) {
  for (const [de, vers] of journal.reverse()) {
    try {
      fs.renameSync(vers, de);
    } catch {
      // déjà remis ou introuvable : défaire le reste quand même
    }
  }
  for (const d of crees.reverse()) {
    try {
      if (path.basename(d) === "alternatives") fs.rmdirSync(d); // seulement s'il est redevenu vide
      else fs.rmSync(d, { recursive: true, force: true });
    } catch {
      // dossier non vide : il garde ce qu'il contenait
    }
  }
  console.error(`Le rangement a échoué (${erreur.message}) : l'état d'avant est remis.`);
  return 3;
}

function rangement(argv) {
  const options = lireOptionsRangement(argv);
  if (!options) {
    console.error("Usage : pulse-aidd comparer <dossier> --ranger | pulse-aidd comparer <dossier> --retenir <variante> [--mobile <variante>]");
    return 1;
  }
  const normal = dossierDeDesign(options.cible);
  if (!normal)
    return refus(`Rangement refusé pour ${options.cible} : seuls docs/design/identite et docs/design/maquettes/<spec> se rangent, indiqués depuis la racine du projet.`);
  const dossier = path.resolve(normal);
  if (!resteDansLeProjet(dossier, normal) || ["alternatives", "retenue"].some((n) => estUnLien(path.join(dossier, n))))
    return refus(`Rangement refusé pour ${options.cible} : ce dossier, ou un dossier qu'il contient, renvoie ailleurs (lien).`);
  if (fs.existsSync(dossier) && !fs.statSync(dossier).isDirectory()) return refus(`Dossier introuvable : ${options.cible} est un fichier.`);
  const alternatives = path.join(dossier, "alternatives");
  const journal = []; // déplacements faits, défaits en cas d'échec
  const crees = []; // dossiers créés ici, retirés en cas d'échec
  const lignes = [];
  const deplacer = (de, vers) => {
    fs.renameSync(de, vers);
    journal.push([de, vers]);
  };
  const versAlternatives = (nom, de) => {
    if (!fs.existsSync(alternatives)) {
      fs.mkdirSync(alternatives);
      crees.push(alternatives);
    }
    const libre = nomLibre(alternatives, nom);
    deplacer(de, path.join(alternatives, libre));
    return affiche(options.cible, "alternatives", libre);
  };
  const rangerSauf = (gardees) => {
    for (const nom of variantesPresentes(dossier).filter((n) => !gardees.includes(n)))
      lignes.push(`range: ${versAlternatives(nom, path.join(dossier, nom))}`);
  };
  const retirerComparer = () => {
    const page = path.join(dossier, "comparer.html");
    if (pageDeComparaison(page)) fs.rmSync(page);
  };

  if (options.ranger) {
    const prochain = prochainNumero(dossier);
    if (fs.existsSync(dossier)) {
      try {
        rangerSauf([]);
        retirerComparer();
      } catch (e) {
        return echec(e, journal, crees);
      }
    }
    for (const l of lignes) console.log(l);
    console.log(`prochain: ${prochain}`);
    return 0;
  }

  if (!fs.existsSync(dossier) || !fs.statSync(dossier).isDirectory()) return refus(`Dossier introuvable : ${options.cible}.`);
  const presentes = variantesPresentes(dossier);
  const choix = trouverVariante(presentes, options.retenir);
  if (choix.erreur) return refus(choix.erreur);
  const mobile = options.mobile ? trouverVariante(presentes, options.mobile) : null;
  if (mobile && mobile.erreur) return refus(mobile.erreur);
  if (mobile && !fs.existsSync(path.join(dossier, mobile.nom, CADRES.mobile.fichier))) return refus(`${mobile.nom} n'a pas de ${CADRES.mobile.fichier}.`);

  const enCours = path.join(dossier, ".retenue-en-cours");
  const retenue = path.join(dossier, "retenue");
  try {
    fs.rmSync(enCours, { recursive: true, force: true });
    crees.push(enCours);
    fs.cpSync(path.join(dossier, choix.nom), enCours, { recursive: true });
    if (mobile) fs.copyFileSync(path.join(dossier, mobile.nom, CADRES.mobile.fichier), path.join(enCours, CADRES.mobile.fichier));
    if (fs.existsSync(retenue)) lignes.push(`ancienne: ${versAlternatives(`retenue-${dateDuJour()}`, retenue)}`);
    deplacer(enCours, retenue);
    lignes.push(`retenue: ${affiche(options.cible, "retenue")} (${mobile ? `${choix.nom}, mobile de ${mobile.nom}` : choix.nom})`);
    rangerSauf(mobile ? [choix.nom, mobile.nom] : [choix.nom]);
    retirerComparer();
  } catch (e) {
    return echec(e, journal, crees);
  }
  for (const l of lignes) console.log(l);
  return 0;
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { lireVariantes, these, echapper, construirePage, prochainNumero, trouverVariante, dossierDeDesign, principal };

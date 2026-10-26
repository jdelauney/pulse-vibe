#!/usr/bin/env node
// Pulse – mesure et contrôle des skills Claude Code (`pulse-aidd skill mesurer|verifier <chemin>`), pour
// /pulse:skill-creator, /pulse:audit-skill et /pulse:optimize-skill. Lecture seule, sans réseau.
// Les règles K1 à K14, leurs niveaux et leurs gravités : references/skills/regles-skills.md.
//
//   pulse-aidd skill mesurer <chemin>    lignes « clé: valeur » par skill : skill, chemin, skill-md, frontmatter,
//                                        description, processus-fin (jetons estimés, dans le corps du SKILL.md, sans
//                                        l'en-tête ; ou « absent »), reference (une par fichier de references/ et assets/),
//                                        injection (!`pulse-aidd …` d'affichage seulement : contexte, etape, reference,
//                                        modele, agent, qualite, tests, piles, pile contexte|reference, lancée dans un
//                                        dossier temporaire vide ; toute autre : « non mesurée »),
//                                        au-dela-30000 ; par agent : agent, chemin, agent-md, description.
//                                        Sur un dossier : puis descriptions-total (les textes chargés en permanence :
//                                        skills invocables par le modèle et agents) et recoupement: <a> <b> <n> lignes.
//   pulse-aidd skill verifier <chemin>   une ligne par constat « K<n> · bloquant|a-corriger|conseil · fichier:ligne ·
//                                        message », puis « bilan: … » ; « installe: oui » en tête pour une skill d'un
//                                        plugin installé (chemin sous plugins/cache/).
//   pulse-aidd skill usage [--depuis AAAA-MM-JJ] [--projets <dossier>]
//                                        l'usage observé dans l'historique des sessions de Claude Code (par défaut
//                                        ~/.claude/projects, 90 derniers jours), lu en flux, ligne à ligne : periode,
//                                        fichiers-lus, puis « usage: <nom> · personne <n> · modele <n> · dernier <date> »
//                                        par skill vue (personne : /<nom> tapé ; modèle : outil Skill) ; « historique:
//                                        absent » sans dossier. Rien n'est envoyé ailleurs ; lancé après l'accord de la personne.
//
// <chemin> : une skill (dossier ou SKILL.md), un agent (agents/<nom>.md), un dossier de skills (.claude/skills/),
// ou un dossier qui contient skills/ ou agents/ (.claude/, un plugin). Les conventions (K3, trame de K5, K11 model)
// sont « à corriger » dans un plugin dont le manifeste s'appelle pulse ou pulse-next, « conseil » ailleurs.
// Codes : 0 fait (verifier : aucun bloquant) ; 1 usage, chemin introuvable, fichier hors format, ou (verifier) un bloquant.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { spawnSync } = require("child_process");

const LIMITE_LECTURE = 30000; // caractères : au-delà, Claude Code enregistre la sortie dans un fichier (aperçu seul)
const LIMITE_PROCESSUS = 5000; // jetons estimés : une compaction garde seulement le début d'une skill
const DESCRIPTION_MAX = 1024;
const DESCRIPTION_CONSEIL = 300;
const SEUIL_RECOUPEMENT = 6; // lignes identiques non vides
const SEUIL_NEGATIONS = 3;
const PULSE_AIDD = path.join(__dirname, "..", "bin", "pulse-aidd");

const jetons = (car) => Math.ceil(car / 3.5);
const unix = (p) => p.split(path.sep).join("/");

/** Le texte d'un fichier, comparable d'un système à l'autre : sans BOM, fins de ligne LF, accents composés (NFC). */
function lireTexte(fichier) {
  return fs.readFileSync(fichier, "utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n").normalize("NFC");
}

/** Un chemin montré : relatif au dossier courant quand il y est, sinon absolu ; toujours avec des « / ». */
function montrer(p) {
  const rel = path.relative(process.cwd(), p);
  return unix(rel === "" ? "." : rel.startsWith("..") || path.isAbsolute(rel) ? p : rel);
}

// ---------------------------------------------------------------- En-tête YAML (sans dépendance)

const sansGuillemets = (v) => {
  if (/^".*"$/.test(v)) return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  return v;
};

/**
 * L'en-tête entre les deux lignes « --- » : { present, valide, erreur, ligneErreur, champs: { cle: { valeur, ligne, brut } },
 * taille (caractères de l'en-tête), corps, ligneCorps (numéro de la première ligne du corps) }.
 * Clés simples, valeurs entre guillemets, listes ([a, b] ou « - a »), blocs sur plusieurs lignes (> et |).
 */
function lireEntete(texte) {
  const lignes = texte.split("\n");
  const resultat = { present: false, valide: true, erreur: "", ligneErreur: 1, champs: {}, taille: 0, corps: texte, ligneCorps: 1 };
  if (lignes[0].trim() !== "---") return resultat;
  resultat.present = true;
  const fin = lignes.findIndex((l, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(l));
  if (fin === -1) return { ...resultat, valide: false, erreur: "en-tête non fermé (ligne --- attendue)" };
  resultat.taille = lignes.slice(0, fin + 1).join("\n").length + 1;
  resultat.corps = lignes.slice(fin + 1).join("\n");
  resultat.ligneCorps = fin + 2;
  const invalide = (i, raison) => Object.assign(resultat, { valide: false, erreur: `ligne ${i + 1} : ${raison}`, ligneErreur: i + 1 });
  let i = 1;
  while (i < fin) {
    const ligne = lignes[i];
    if (/^\s*(#.*)?$/.test(ligne)) { i++; continue; }
    const m = /^([A-Za-z_][\w-]*)\s*:(?:\s+(.*))?$/.exec(ligne);
    if (!m) return invalide(i, `« ${ligne.trim().slice(0, 60)} » n'est pas une clé « nom: valeur »`);
    const [, cle, brut = ""] = m;
    if (cle in resultat.champs) return invalide(i, `clé « ${cle} » en double`);
    const debut = i;
    const suite = [];
    i++;
    while (i < fin && (/^\s+\S/.test(lignes[i]) || (brut === "" && /^-\s/.test(lignes[i])) || (/^\s*$/.test(lignes[i]) && /^[>|]/.test(brut.trim())))) suite.push(lignes[i++]);
    // Un commentaire en fin de valeur (« valeur # note », « "valeur" # note ») n'en fait pas partie.
    const cite = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')\s*(?:#.*)?$/.exec(brut.trim());
    const v = cite ? cite[1] : brut.trim().replace(/(^|\s+)#.*$/, "");
    const bloc = /^([>|])([1-9]?)[+-]?([1-9]?)$/.exec(v);
    let valeur;
    if (bloc) {
      const indicateur = Number(bloc[2] || bloc[3]);
      const marge = indicateur || Math.min(...suite.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length));
      const texteBloc = suite.map((l) => l.slice(marge)).join("\n").trim();
      valeur = v.startsWith(">") ? texteBloc.replace(/([^\n])\n(?!\n)/g, "$1 ") : texteBloc;
    } else if (v === "" && suite.length && suite.every((l) => /^\s*-\s/.test(l) || !l.trim())) {
      valeur = suite.filter((l) => l.trim()).map((l) => sansGuillemets(l.replace(/^\s*-\s+/, "").trim()));
    } else if (/^\[.*\]$/.test(v)) {
      valeur = v.slice(1, -1).split(",").map((x) => sansGuillemets(x.trim())).filter(Boolean);
    } else {
      const entier = [v, ...suite.map((l) => l.trim())].filter(Boolean).join(" ");
      if ((/^"/.test(entier) && !/^".*"$/.test(entier)) || (/^'/.test(entier) && !/^'.*'$/.test(entier))) return invalide(debut, `guillemet non fermé pour « ${cle} »`);
      valeur = sansGuillemets(entier);
    }
    resultat.champs[cle] = { valeur, ligne: debut + 1, brut: v };
  }
  return resultat;
}

/** Les entrées d'une liste d'outils (« Read, Grep », « Bash(git status *) Write(docs/**) », ou une liste YAML). */
function listeOutils(valeur) {
  const textes = Array.isArray(valeur) ? valeur : [String(valeur || "")];
  const entrees = [];
  for (const t of textes)
    for (const m of t.matchAll(/([A-Za-z_][\w.:-]*)(?:\(([^)]*)\))?/g)) entrees.push({ outil: m[1], motif: m[2] === undefined ? null : m[2].trim(), texte: m[0] });
  return entrees;
}

// ---------------------------------------------------------------- Où sont les skills

function trouverPluginPulse(depart) {
  let d = depart;
  for (;;) {
    const manifeste = path.join(d, ".claude-plugin", "plugin.json");
    if (fs.existsSync(manifeste)) {
      try {
        return ["pulse", "pulse-next"].includes(JSON.parse(fs.readFileSync(manifeste, "utf8")).name);
      } catch {
        return false;
      }
    }
    const parent = path.dirname(d);
    if (parent === d) return false;
    d = parent;
  }
}

const unite = (type, fichier) => ({ type, fichier, dossier: type === "skill" ? path.dirname(fichier) : null, nom: type === "skill" ? path.basename(path.dirname(fichier)) : path.basename(fichier, ".md") });

/** { unites, collection } pour un chemin ; { erreur: "introuvable" | "hors-format" } sinon. */
function localiser(chemin) {
  const cible = path.resolve(chemin);
  if (!fs.existsSync(cible)) return { erreur: "introuvable", cible };
  const stat = fs.statSync(cible);
  if (stat.isFile()) {
    if (path.basename(cible) === "SKILL.md") return { unites: [unite("skill", cible)], collection: false, cible };
    if (cible.endsWith(".md") && path.basename(path.dirname(cible)) === "agents") return { unites: [unite("agent", cible)], collection: false, cible };
    return { erreur: "hors-format", cible };
  }
  if (fs.existsSync(path.join(cible, "SKILL.md"))) return { unites: [unite("skill", path.join(cible, "SKILL.md"))], collection: false, cible };
  const sousDossiers = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []);
  const skillsDe = (d) => sousDossiers(d).map((n) => path.join(d, n, "SKILL.md")).filter((f) => fs.existsSync(f)).map((f) => unite("skill", f));
  const agentsDe = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".md")).sort().map((f) => unite("agent", path.join(d, f))) : []);
  if (path.basename(cible) === "agents") return { unites: agentsDe(cible), collection: true, cible };
  const avecSkills = (d) => fs.existsSync(path.join(d, "skills")) || fs.existsSync(path.join(d, "agents"));
  // La racine d'un projet : ses skills et ses agents sont dans .claude/.
  const racine = !avecSkills(cible) && avecSkills(path.join(cible, ".claude")) ? path.join(cible, ".claude") : cible;
  const unites = avecSkills(racine) ? [...skillsDe(path.join(racine, "skills")), ...agentsDe(path.join(racine, "agents"))] : skillsDe(racine);
  return { unites, collection: true, cible };
}

// ---------------------------------------------------------------- Mesures

// Les seules sous-commandes de pulse-aidd lancées pour mesurer une injection : elles affichent un texte et n'écrivent rien.
const LISIBLES = /^pulse-aidd (contexte|etape|reference|modele|agent|qualite|tests|piles|pile (contexte|reference))(\s|$)/;
/** Vrai pour une injection que `mesurer` peut lancer sans rien changer : une sous-commande d'affichage, sans signe du shell. */
const injectionLisible = (commande) => LISIBLES.test(commande) && !/[;&|<>$`\\(){}]/.test(commande);

const injectionsMesurees = new Map();
/**
 * La taille de la sortie d'une injection `pulse-aidd …` d'affichage, lancée dans un dossier temporaire vide (retiré
 * ensuite) : rien n'est écrit dans le projet, et la taille ne dépend pas du dossier courant. null pour toute autre commande.
 */
function mesurerInjection(commande) {
  if (!injectionLisible(commande)) return null;
  if (!injectionsMesurees.has(commande)) {
    const vide = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-skill-mesure-"));
    try {
      const r = spawnSync("bash", [unix(PULSE_AIDD), ...commande.split(/\s+/).slice(1)], { cwd: vide, encoding: "utf8", timeout: 60000 });
      injectionsMesurees.set(commande, r.error || r.stdout === undefined ? null : r.stdout.replace(/\r\n?/g, "\n").length);
    } finally {
      fs.rmSync(vide, { recursive: true, force: true });
    }
  }
  return injectionsMesurees.get(commande);
}

const fichiersDe = (d) => {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => (e.isDirectory() ? fichiersDe(path.join(d, e.name)) : [path.join(d, e.name)]));
};
const estBinaire = (fichier) => fs.readFileSync(fichier).subarray(0, 8000).includes(0);

const SECTION_PROCESSUS = /^(#{1,3})\s+(Processus|Process|Workflow|Déroulé|Procédure|Procedure|Étapes|Steps)(?![\p{L}\p{N}_])/iu;

/** Les titres d'un texte, hors blocs de code (une ligne « # commentaire » d'un bloc bash n'est pas un titre). */
function titresHorsCode(lignes) {
  let bloc = false;
  return lignes.map((l) => {
    if (/^\s*```/.test(l)) {
      bloc = !bloc;
      return null;
    }
    return bloc ? null : /^(#{1,6})\s/.exec(l);
  });
}

/** Début et fin (index de caractère dans le corps) de la section Processus, et sa ligne ; null sans section. */
function sectionProcessus(corps) {
  const lignes = corps.split("\n");
  const titres = titresHorsCode(lignes);
  let position = 0;
  let debut = null;
  for (let i = 0; i < lignes.length; i++) {
    const titre = titres[i];
    if (debut && titre && titre[1].length <= debut.niveau) return { ...debut, fin: position };
    const m = titre && SECTION_PROCESSUS.exec(lignes[i]);
    if (!debut && m) debut = { niveau: m[1].length, debut: position, ligne: i };
    position += lignes[i].length + 1;
  }
  return debut ? { ...debut, fin: corps.length } : null;
}

/** Les injections !`commande` d'un texte : { commande, index, ligne (dans ce texte, à partir de 0) }. */
const injectionsDe = (texte) => [...texte.matchAll(/!`([^`\n]+)`/g)].map((m) => ({ commande: m[1].trim(), index: m.index, ligne: texte.slice(0, m.index).split("\n").length - 1 }));

/** Les données de travail d'une mesure, gardées hors de ses propriétés visibles (JSON, comparaisons). */
const cacher = (mesure, internes) => Object.defineProperty(mesure, "interne", { value: internes, enumerable: false });

function mesurerSkill(u) {
  const texte = lireTexte(u.fichier);
  const entete = lireEntete(texte);
  const desc = entete.valide && entete.champs.description ? String(entete.champs.description.valeur) : null;
  const invocable = !(entete.valide && String((entete.champs["disable-model-invocation"] || {}).valeur) === "true");
  const injections = injectionsDe(entete.corps).map((inj) => ({ ...inj, ligne: inj.ligne + entete.ligneCorps, car: mesurerInjection(inj.commande) }));
  const section = sectionProcessus(entete.corps);
  let processusFin = null;
  if (section) {
    const avant = injections.filter((inj) => inj.index < section.fin && inj.car !== null).reduce((s, inj) => s + inj.car, 0);
    processusFin = jetons(section.fin + avant);
  }
  const references = ["references", "assets"].flatMap((d) =>
    fichiersDe(path.join(u.dossier, d)).map((f) => ({ fichier: unix(path.relative(u.dossier, f)), chemin: f, car: estBinaire(f) ? null : lireTexte(f).length })),
  );
  const auDela30000 = [...references.filter((r) => r.car > LIMITE_LECTURE).map((r) => r.fichier), ...injections.filter((inj) => inj.car > LIMITE_LECTURE).map((inj) => `!${inj.commande}`)];
  return cacher(
    {
      type: "skill",
      nom: u.nom,
      chemin: montrer(u.dossier),
      fichier: u.fichier,
      skillMd: { car: texte.length, jetons: jetons(texte.length) },
      frontmatter: entete.taille,
      description: desc === null ? null : desc.length,
      descriptionTexte: desc,
      permanente: invocable,
      processusFin,
      references: references.map(({ fichier, car }) => ({ fichier, car })),
      injections: injections.map(({ commande, car, ligne }) => ({ commande, car, ligne })),
      auDela30000,
    },
    { texte, entete, section, injections, references },
  );
}

function mesurerAgent(u) {
  const texte = lireTexte(u.fichier);
  const entete = lireEntete(texte);
  const desc = entete.valide && entete.champs.description ? String(entete.champs.description.valeur) : null;
  return cacher(
    {
      type: "agent",
      nom: u.nom,
      chemin: montrer(u.fichier),
      fichier: u.fichier,
      agentMd: { car: texte.length, jetons: jetons(texte.length) },
      description: desc === null ? null : desc.length,
      descriptionTexte: desc,
      permanente: true,
    },
    { texte, entete },
  );
}

/** Les lignes non vides comparables d'une unité (corps du SKILL.md et ses références, ou corps de l'agent). */
function lignesComparables(m) {
  const fichiers = [{ fichier: m.fichier, texte: m.interne.entete.corps, decalage: m.interne.entete.ligneCorps }];
  if (m.type === "skill") for (const r of m.interne.references) if (r.car !== null && r.fichier.endsWith(".md")) fichiers.push({ fichier: r.chemin, texte: lireTexte(r.chemin), decalage: 1 });
  return fichiers.map((f) => ({ ...f, lignes: f.texte.split("\n").map((t, i) => ({ t: t.trim().replace(/\s+/g, " "), ligne: i + f.decalage })).filter((l) => l.t) }));
}

/** Les recoupements entre unités : { a, b, lignes, fichier, ligne } pour chaque paire avec 6 lignes identiques de suite ou plus. */
function recoupements(mesures) {
  const fenetres = (f) => f.lignes.slice(0, Math.max(0, f.lignes.length - SEUIL_RECOUPEMENT + 1)).map((_, i) => f.lignes.slice(i, i + SEUIL_RECOUPEMENT).map((l) => l.t).join("\n"));
  const donnees = mesures.map((m) => {
    const fichiers = lignesComparables(m);
    return { m, fichiers, toutes: new Set(fichiers.flatMap(fenetres)) };
  });
  const resultat = [];
  for (let i = 0; i < donnees.length; i++)
    for (let j = i + 1; j < donnees.length; j++) {
      let total = 0;
      let premier = null;
      for (const f of donnees[i].fichiers) {
        const couvertes = new Set();
        fenetres(f).forEach((cle, k) => {
          if (donnees[j].toutes.has(cle)) for (let x = k; x < k + SEUIL_RECOUPEMENT; x++) couvertes.add(x);
        });
        if (couvertes.size && !premier) premier = { fichier: f.fichier, ligne: f.lignes[Math.min(...couvertes)].ligne };
        total += couvertes.size;
      }
      if (total) resultat.push({ a: donnees[i].m.nom, b: donnees[j].m.nom, lignes: total, ...premier });
    }
  return resultat;
}

/** Les mesures d'une skill, d'un agent ou d'un dossier ; sur un dossier, un dernier élément { type: "dossier", descriptionsTotal, recoupements }. */
function mesurer(chemin) {
  const lieu = localiser(chemin);
  if (lieu.erreur) throw Object.assign(new Error(`${lieu.erreur} : ${chemin}`), { code: lieu.erreur });
  const mesures = lieu.unites.map((u) => (u.type === "skill" ? mesurerSkill(u) : mesurerAgent(u)));
  if (lieu.collection)
    mesures.push({
      type: "dossier",
      chemin: montrer(lieu.cible),
      descriptionsTotal: mesures.filter((m) => m.permanente && m.description).reduce((s, m) => s + m.description, 0),
      recoupements: recoupements(mesures),
    });
  return mesures;
}

// ---------------------------------------------------------------- Règles vérifiables par script

// Règle de Claude Code : « * » remplace n'importe quel texte ; un « * » final précédé d'une espace couvre aussi la commande sans argument.
function couvre(motif, commande) {
  const m = motif.replace(/:\*$/, " *");
  if (/^[^*]+ \*$/.test(m)) {
    const base = m.slice(0, -2);
    return commande === base || commande.startsWith(`${base} `);
  }
  const echappe = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${m.split("*").map(echappe).join(".*")}$`, "s").test(commande);
}

// Des commandes qui envoient, suppriment, écrasent du travail, fusionnent, forcent, changent la configuration ou touchent
// la production : toujours par la demande d'accord de Claude Code. Seule source de cette liste : les tests de cohérence
// du plugin la lisent ici (« allowed-tools : ni Bash(pulse-aidd *), ni sous-commande sensible autorisée d'avance »).
const SENSIBLES = [
  "git push", "git push origin main", "git push --force origin main", "git reset --hard HEAD~1", "git clean -fd",
  "git branch -D essai", "git branch -f main HEAD", "git branch -M main", "git merge essai", "git rebase main", "git pull",
  "git remote add origin X", "git remote remove origin", "git remote set-url origin X", "git config core.hooksPath X",
  "git rm fichier", "git stash drop", "git tag -d v1", "git checkout -- fichier", "git checkout .", "git restore fichier", "git commit --amend",
  "rm fichier", "rm -rf dossier", "rmdir dossier", "del fichier", "Remove-Item fichier",
  "npm publish", "gh pr merge 1", "glab mr merge 1", "gh repo create X", "gh repo delete X", "gh release create v1",
  "vercel --prod", "vercel deploy --prod", "netlify deploy --prod", "curl -X POST https://exemple.fr", "sudo X",
  "pulse-aidd secrets generer NOM", "pulse-aidd secrets generer NOM --envoyer production,preview", "pulse-aidd secrets envoyer NOM --env production",
  "pulse-aidd secrets elaguer NOM", "pulse-aidd secrets redeployer", "pulse-aidd secrets redeployer --env production",
  "pulse-aidd installer-ci --forcer", // remplace un verifier.js déjà adapté par le projet
  "pulse-aidd ligne-etat --installer", "pulse-aidd ligne-etat --retirer", // changent les réglages de Claude Code du projet
  "pulse-aidd autorisations --ecrire", // change les réglages de Claude Code du projet
  "pulse-aidd copies --mettre-a-jour", "pulse-aidd copies --copier verifier scripts/verifier.js", // remplacent des fichiers du projet
  "pulse-aidd search-console deconnecter",
  "pulse-aidd pile hebergeur envoyer NOM production", "pulse-aidd pile hebergeur redeployer production",
  "pulse-aidd deplacer-commits feat/us-003-liste", "pulse-aidd deplacer-commits feat/us-003-liste --principale main", // déplace la branche principale
];
/** Une commande pulse-aidd qui passe toujours par la demande d'accord (citée par une consigne sans être autorisée d'avance). */
const estSensible = (commande) => /^pulse-aidd (secrets (generer|envoyer|elaguer|redeployer)|search-console deconnecter|pile hebergeur|installer-ci --forcer|ligne-etat --(installer|retirer)|autorisations --ecrire|copies --(mettre-a-jour|copier)|deplacer-commits)\b/.test(commande);
// Des programmes à tout faire : « Bash(<programme> *) » autorise aussi leurs gestes sensibles.
const LARGES = new Set(["git", "npm", "npx", "pnpm", "yarn", "bun", "bunx", "node", "deno", "python", "python3", "py", "pip", "pip3", "bash", "sh", "zsh", "pwsh", "powershell", "cmd", "gh", "glab", "docker", "kubectl", "sudo", "rm", "curl", "wget", "make", "cargo", "go", "vercel", "netlify", "pulse-aidd", "find", "xargs", "env", "eval", "ssh", "scp", "rsync", "mv", "cp"]);
const DONNEES = /\.(json|ya?ml|csv|tsv|xml)$/i;
const CONFIGURATION = [".claude/settings.json", ".claude/settings.local.json", "~/.claude/settings.json", "~/.claude/settings.local.json", ".git/config", ".git/hooks/pre-commit"];
// Un outil est cité entre accents graves (`Write`, `Bash(git status)`) ou à côté du mot « outil » ou « tool » ;
// ailleurs, « Write a report » ou « Edit nothing » sont des verbes.
const NOMS_OUTILS = "Read|Write|Edit|MultiEdit|Glob|Grep|Bash|PowerShell|WebFetch|WebSearch|NotebookEdit|TodoWrite|Agent|Task|Skill";
const OUTILS_CITES = [
  new RegExp("`(" + NOMS_OUTILS + ")(?:\\([^`]*\\))?`", "g"),
  new RegExp("\\b(?:[Oo]utils?|[Tt]ools?)\\s+`?(" + NOMS_OUTILS + ")\\b", "g"),
  new RegExp("\\b(" + NOMS_OUTILS + ")`?\\s+(?:[Oo]utils?|[Tt]ools?)\\b", "g"),
];
const SECTIONS_TRAME = [
  ["Objectif", /^(Objectif|Goal|Objective|Purpose)/i],
  ["Règles", /^(Règles|Rules)/i],
  ["Contexte", /^(Contexte|Context)/i],
  ["Processus", /^(Processus|Process|Workflow|Déroulé|Procédure|Procedure|Étapes|Steps)/i],
  ["Exemples", /^(Exemples|Examples)/i],
  ["Références", /^(Références|References)/i],
];
const NEGATIONS = [
  /\bne\s+(?:jamais|pas|rien)\b/giu,
  /\b(?:ne\s+|n['’])\p{L}+ez\s+(?:jamais|pas|rien)\b/giu,
  /\b(?:never|do not|don't)\b/giu,
  /(?:^|[.!?;:]\s+|^\s*(?:[-*]|\d+\.)\s+)jamais\b/gimu,
];

const globVersRegex = (motif) => new RegExp(`^${motif.replace(/^\.?\//, "").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*")}$`);

/** Le texte hors blocs de code, ligne à ligne : [{ texte, ligne }]. */
function lignesHorsCode(texte, decalage) {
  const resultat = [];
  let bloc = false;
  texte.split("\n").forEach((l, i) => {
    if (/^\s*```/.test(l)) bloc = !bloc;
    else if (!bloc) resultat.push({ texte: l, ligne: i + decalage });
  });
  return resultat;
}

function constatsDescription(m, ajouter) {
  const { entete: e } = m.interne;
  if (!e.present) return ajouter("K2", "bloquant", 1, "pas d'en-tête (bloc --- en haut du fichier) : la description, la phrase qui dit à Claude quand utiliser la skill, manque");
  if (!e.valide) return ajouter("K2", "bloquant", e.ligneErreur, `en-tête illisible (${e.erreur}) : Claude Code ne lit pas la description`);
  const champ = e.champs.description;
  if (!champ || !String(champ.valeur).trim()) return ajouter("K2", "bloquant", 1, "description absente : écrire ce que la skill fait, en une phrase");
  const texte = String(champ.valeur);
  if (texte.length > DESCRIPTION_MAX) return ajouter("K2", "bloquant", champ.ligne, `description de ${texte.length} caractères (plafond ${DESCRIPTION_MAX}) : la raccourcir`);
  if (m.type === "skill" && m.permanente && !/(à|a) utiliser (quand|lorsque|pour)|use (this skill )?(when|for)|should be used when/i.test(texte))
    ajouter("K2", "a-corriger", champ.ligne, "skill invocable par le modèle sans « À utiliser quand … » (ou « Use when … ») : dire quand la lancer, avec les mots de la personne");
  if (m.permanente && texte.length > DESCRIPTION_CONSEIL) ajouter("K2", "conseil", champ.ligne, `description de ${texte.length} caractères, chargée en permanence : viser 300 au plus`);
  if (typeof champ.valeur === "string" && !/^["'>|]/.test(champ.brut) && /:\s/.test(champ.brut)) ajouter("K2", "conseil", champ.ligne, "description avec « : » hors guillemets : l'écrire entre guillemets pour un lecteur YAML strict");
}

function constatsAutorisations(m, ajouter) {
  const champ = m.interne.entete.champs["allowed-tools"];
  if (!champ) return;
  for (const { outil, motif, texte } of listeOutils(champ.valeur)) {
    if (["Bash", "PowerShell"].includes(outil)) {
      const m2 = (motif || "").replace(/:\*$/, " *").trim();
      if (!m2 || m2 === "*") {
        ajouter("K4", "bloquant", champ.ligne, `${texte} autorise toute commande sans demande : écrire un motif par commande (${outil}(git status *))`);
        continue;
      }
      const programme = (/^([^\s*]+)\s*\*$/.exec(m2) || [])[1];
      if (programme && LARGES.has(programme)) {
        ajouter("K4", "bloquant", champ.ligne, `${texte} est trop large (il couvre aussi les envois et les suppressions) : écrire un motif par commande (${outil}(${programme} <action> *))`);
        continue;
      }
      const sensible = SENSIBLES.find((c) => couvre(m2, c));
      if (sensible) ajouter("K4", "bloquant", champ.ligne, `${texte} autorise d'avance « ${sensible} » : laisser ce geste à la demande d'accord de Claude Code`);
    } else if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(outil)) {
      // Sans chemin précis (Write, Edit(**)) : à corriger, quel que soit l'outil ; un motif qui vise la configuration : bloquant.
      if (!motif || /^(\.?\/)?(\*\*?\/?)+$/.test(motif)) {
        ajouter("K4", "a-corriger", champ.ligne, `${texte} autorise l'écriture partout : préciser le dossier (${outil}(docs/**))`);
        continue;
      }
      const config = CONFIGURATION.find((f) => globVersRegex(motif).test(f));
      if (config) ajouter("K4", "bloquant", champ.ligne, `${texte} autorise d'avance l'écriture de ${config} (configuration) : la laisser à la demande d'accord`);
    }
  }
}

/**
 * La ligne (numéro dans le fichier) qui recharge les consignes de la skill après une compaction : elle parle de
 * compaction (ou de compactage) et cite une commande qui réaffiche ces consignes (`pulse-aidd etape <cette skill>`,
 * ou la lecture de son SKILL.md). Elle compte seulement placée dans les premiers jetons, ceux que la compaction garde.
 */
function ligneRechargement(m) {
  const { entete: e } = m.interne;
  let position = 0;
  const lignes = e.corps.split("\n");
  for (let i = 0; i < lignes.length; i++) {
    position += lignes[i].length + 1;
    if (jetons(position) > LIMITE_PROCESSUS) return null;
    if (!/compact(ion|age|ed)/i.test(lignes[i])) continue;
    const commandes = [...lignes[i].matchAll(/`([^`\n]+)`/g)].map((c) => c[1]);
    const sonSkillMd = (c) => c.split(/[\s/\\]+/).some((x, k, t) => x === "SKILL.md" && t[k - 1] === m.nom);
    if (commandes.some((c) => (/^pulse-aidd etape (\S+)/.exec(c) || [])[1] === m.nom || sonSkillMd(c))) return i + e.ligneCorps;
  }
  return null;
}

function constatsTrame(m, ajouter, convention) {
  const { entete: e, section, injections } = m.interne;
  const corps = e.corps;
  if (section) {
    if (m.processusFin > LIMITE_PROCESSUS) {
      const fin = `fin du Processus à ${m.processusFin} jetons estimés (au-delà des ${LIMITE_PROCESSUS} premiers) : une compaction garde seulement le début de la skill`;
      const rechargement = ligneRechargement(m);
      if (rechargement) ajouter("K5", "a-corriger", section.ligne + e.ligneCorps, `${fin} ; la ligne ${rechargement} recharge les consignes après une compaction ; avancer le Processus reste conseillé`);
      else ajouter("K5", "bloquant", section.ligne + e.ligneCorps, `${fin} ; avancer le Processus, sortir le détail vers references/, ou écrire tôt dans le fichier une ligne qui recharge les consignes après une compaction`);
    }
    const tot = injections.find((inj) => inj.index < section.fin);
    if (tot) ajouter("K5", convention, tot.ligne, `injection !\`${tot.commande}\` avant la fin du Processus : la placer en dernière section, avec une ligne de repli`);
  } else if (jetons(corps.length) > LIMITE_PROCESSUS) {
    ajouter("K5", "a-corriger", e.ligneCorps, `aucune section Processus repérable dans un SKILL.md de ${jetons(corps.length)} jetons estimés : la fin du déroulé risque d'être perdue après une compaction`);
  }
  const lignesCorps = corps.split("\n");
  const titres = titresHorsCode(lignesCorps).map((t, i) => t && t[1] === "##" && lignesCorps[i].replace(/^##\s+/, "")).filter(Boolean);
  const manquantes = SECTIONS_TRAME.filter(([, re]) => !titres.some((t) => re.test(t))).map(([nom]) => nom);
  if (manquantes.length) ajouter("K5", convention, e.ligneCorps, `sections absentes de la trame (Objectif, Règles, Contexte, Processus, Exemples, Références) : ${manquantes.join(", ")}`);
}

function constatsLecture(m, ajouter) {
  for (const r of m.interne.references) {
    if (!(r.car > LIMITE_LECTURE)) continue;
    // Un fichier de données (JSON, YAML, CSV) sert souvent à un script seul : à corriger, pas bloquant.
    if (DONNEES.test(r.fichier)) ajouter("K7", "a-corriger", 1, `${r.car} caractères (plus de ${LIMITE_LECTURE}) : lu par le modèle, il serait coupé ; s'il sert seulement à un script, le dire à côté de son lien`, r.chemin);
    else ajouter("K7", "bloquant", 1, `${r.car} caractères (plus de ${LIMITE_LECTURE}) : Claude Code n'en montrerait qu'un aperçu ; scinder le fichier`, r.chemin);
  }
  for (const inj of m.injections)
    // Une injection se charge au lancement de la skill, sans passer par un outil : pas de coupure, mais un coût à chaque lancement.
    if (inj.car > LIMITE_LECTURE) ajouter("K7", "a-corriger", inj.ligne, `l'injection !\`${inj.commande}\` affiche ${inj.car} caractères (plus de ${LIMITE_LECTURE}), chargés à chaque lancement : mesurer ce qui sert, et la scinder si possible (le reste chargé à l'étape qui le sert)`);
  const textes = [{ chemin: m.fichier, texte: m.interne.texte }, ...m.interne.references.filter((r) => r.car !== null && r.fichier.endsWith(".md")).map((r) => ({ chemin: r.chemin, texte: lireTexte(r.chemin) }))];
  for (const { chemin, texte } of textes)
    texte.split("\n").forEach((l, i) => {
      for (const c of l.matchAll(/`([^`\n]+)`/g))
        if (/\|\s*(head|tail)\b/.test(c[1])) ajouter("K7", "a-corriger", i + 1, `« ${c[1]} » coupe la sortie : lire les règles en entier, en appels séparés au besoin`, chemin);
    });
}

function constatsNegations(chemin, texte, decalage, ajouter) {
  const trouvees = [];
  for (const { texte: l, ligne } of lignesHorsCode(texte, decalage)) for (const re of NEGATIONS) for (const _ of l.matchAll(re)) trouvees.push(ligne);
  if (trouvees.length >= SEUIL_NEGATIONS)
    ajouter("K9", "conseil", trouvees[0], `${trouvees.length} tournures négatives (lignes ${[...new Set(trouvees)].slice(0, 8).join(", ")}) : dire quoi faire ; garder une interdiction pour la sécurité ou l'irréversible, avec son alternative`, chemin);
}

function constatsAgent(m, ajouter, convention) {
  const { entete: e } = m.interne;
  if (!e.valide) return;
  const entrees = (cle) => (e.champs[cle] ? listeOutils(e.champs[cle].valeur) : null);
  const tous = e.champs.tools && [].concat(e.champs.tools.valeur).some((v) => String(v).trim() === "*"); // tools: "*" : tous les outils
  const outils = !tous && e.champs.tools ? entrees("tools").map((x) => x.outil) : null;
  // Un motif de disallowedTools (Bash(git push *)) retire ce motif seul, pas l'outil.
  const refuses = (entrees("disallowedTools") || []).filter((x) => x.motif === null).map((x) => x.outil);
  const vus = new Set();
  for (const { texte: l, ligne } of lignesHorsCode(e.corps, e.ligneCorps))
    for (const c of OUTILS_CITES.flatMap((re) => [...l.matchAll(re)]).sort((a, b) => a.index - b.index)) {
      const outil = NOMS_OUTILS.split("|").find((n) => n.toLowerCase() === c[1].toLowerCase());
      if (vus.has(outil)) continue;
      vus.add(outil);
      const absent = refuses.includes(outil) || (outils && !outils.includes(outil));
      if (absent) ajouter("K11", "bloquant", ligne, `${outil} est cité dans les consignes mais indisponible pour l'agent (${refuses.includes(outil) ? "disallowedTools" : "absent de tools"}) : l'ajouter à tools, ou changer la consigne`);
    }
  if (!e.champs.model) ajouter("K11", convention, 1, "model absent : l'écrire (haiku, sonnet ou opus) pour un coût et une qualité prévisibles");
}

/** Les constats d'une skill, d'un agent ou d'un dossier : [{ regle, gravite, fichier, ligne, message }]. */
function verifier(chemin, options = {}) {
  const mesures = mesurer(chemin);
  const pulse = typeof options.pulse === "boolean" ? options.pulse : trouverPluginPulse(path.resolve(chemin));
  const convention = pulse ? "a-corriger" : "conseil";
  const constats = [];
  for (const m of mesures) {
    if (m.type === "dossier") {
      for (const r of m.recoupements)
        constats.push({ regle: "K8", gravite: "a-corriger", fichier: montrer(r.fichier), ligne: r.ligne, message: `${r.lignes} lignes identiques entre ${r.a} et ${r.b} : écrire ce passage une fois, dans une référence commune` });
      continue;
    }
    const ajouter = (regle, gravite, ligne, message, fichier = m.fichier) => constats.push({ regle, gravite, fichier: montrer(fichier), ligne, message });
    constatsDescription(m, ajouter);
    constatsNegations(m.fichier, m.interne.entete.corps, m.interne.entete.ligneCorps, ajouter);
    if (m.type === "agent") {
      constatsAgent(m, ajouter, convention);
      continue;
    }
    if (m.interne.entete.valide) {
      constatsAutorisations(m, ajouter);
      const invocable = m.permanente;
      const effets = listeOutils((m.interne.entete.champs["allowed-tools"] || {}).valeur).some((x) => ["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(x.outil)) || m.skillMd.car > 15000;
      if (invocable && (pulse || effets))
        ajouter("K3", convention, 1, pulse ? "commande Pulse invocable par le modèle : ajouter disable-model-invocation: true" : "skill à effets (écrit, ou charge beaucoup) invocable par le modèle : envisager disable-model-invocation: true");
    }
    constatsTrame(m, ajouter, convention);
    constatsLecture(m, ajouter);
    for (const r of m.interne.references) if (r.car !== null && r.fichier.endsWith(".md")) constatsNegations(r.chemin, lireTexte(r.chemin), 1, ajouter);
  }
  const ordre = { bloquant: 0, "a-corriger": 1, conseil: 2 };
  return constats.sort((a, b) => ordre[a.gravite] - ordre[b.gravite] || a.fichier.localeCompare(b.fichier) || a.ligne - b.ligne || a.regle.localeCompare(b.regle));
}

// ---------------------------------------------------------------- Usage observé (historique des sessions)

const JOUR = 86400000;
const PERIODE_DEFAUT = 90; // jours
const jourDe = (d) => d.toISOString().slice(0, 10);

/** Les lancements d'une ligne de l'historique : [{ nom, par: "personne" | "modele" }]. */
function lancementsDe(entree) {
  const message = entree && entree.message;
  if (!message) return [];
  const blocs = typeof message.content === "string" ? [{ type: "text", text: message.content }] : Array.isArray(message.content) ? message.content : [];
  const trouves = [];
  for (const b of blocs) {
    if (!b || typeof b !== "object") continue;
    if (entree.type === "user" && b.type === "text" && typeof b.text === "string")
      for (const m of b.text.matchAll(/<command-name>\/?([^<\s]+)<\/command-name>/g)) trouves.push({ nom: m[1], par: "personne" });
    if (b.type === "tool_use" && b.name === "Skill" && b.input && typeof b.input.skill === "string") trouves.push({ nom: b.input.skill.replace(/^\//, ""), par: "modele" });
  }
  return trouves;
}

/** Lit un fichier .jsonl en flux, ligne à ligne, et ajoute au compte ses lancements de la période. */
async function lireHistorique(fichier, debut, compte) {
  const dateFichier = fs.statSync(fichier).mtime;
  const lignes = readline.createInterface({ input: fs.createReadStream(fichier, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const ligne of lignes) {
    if (!ligne.includes("command-name>") && !ligne.includes('"Skill"')) continue; // la plupart des lignes : aucun lancement
    let entree;
    try {
      entree = JSON.parse(ligne);
    } catch {
      continue; // ligne cassée (session interrompue) : ignorée
    }
    const quand = entree.timestamp && !Number.isNaN(Date.parse(entree.timestamp)) ? new Date(entree.timestamp) : dateFichier;
    if (quand < debut) continue;
    for (const { nom, par } of lancementsDe(entree)) {
      const c = compte.get(nom) || { nom, personne: 0, modele: 0, dernier: quand };
      c[par]++;
      if (quand > c.dernier) c.dernier = quand;
      compte.set(nom, c);
    }
  }
}

/** L'usage observé : { absent, periode: { du, au }, fichiersLus, skills: [{ nom, personne, modele, dernier }] }. */
async function usage({ depuis, projets = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "projects"), maintenant = new Date() } = {}) {
  const debut = depuis ? new Date(`${depuis}T00:00:00.000Z`) : new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()) - PERIODE_DEFAUT * JOUR);
  const periode = { du: jourDe(debut), au: jourDe(maintenant) };
  if (!fs.existsSync(projets) || !fs.statSync(projets).isDirectory()) return { absent: true, periode, fichiersLus: 0, skills: [] };
  // Un fichier modifié pour la dernière fois avant la période ne contient rien de plus récent : sauté.
  const fichiers = fs
    .readdirSync(projets, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => fs.readdirSync(path.join(projets, e.name)).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(projets, e.name, f)))
    .filter((f) => fs.statSync(f).isFile() && fs.statSync(f).mtime >= debut);
  const compte = new Map();
  for (const f of fichiers) await lireHistorique(f, debut, compte);
  const skills = [...compte.values()].map((c) => ({ ...c, dernier: jourDe(c.dernier) })).sort((a, b) => b.personne + b.modele - (a.personne + a.modele) || a.nom.localeCompare(b.nom));
  return { absent: false, periode, fichiersLus: fichiers.length, skills };
}

async function afficherUsage(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--depuis") options.depuis = args[++i] || "";
    else if (args[i] === "--projets") options.projets = deplier(args[++i] || "");
    else {
      console.log(USAGE);
      return 1;
    }
  }
  if (options.depuis !== undefined && !(/^\d{4}-\d{2}-\d{2}$/.test(options.depuis) && !Number.isNaN(Date.parse(options.depuis)))) {
    console.log(`erreur: --depuis attend une date AAAA-MM-JJ (reçu : ${options.depuis || "rien"})\n${USAGE}`);
    return 1;
  }
  let r;
  try {
    r = await usage(options);
  } catch (e) {
    console.log(`erreur: l'historique n'a pas pu être lu (${e.message})`);
    return 1;
  }
  const lignes = [`periode: ${r.periode.du} → ${r.periode.au}`];
  if (r.absent) lignes.push("historique: absent");
  else {
    lignes.push(`fichiers-lus: ${r.fichiersLus}`, "note: historique des assistants non lu (<projet>/<session>/subagents/) : une skill lancée seulement par un assistant peut paraître non observée");
    for (const s of r.skills) lignes.push(`usage: ${s.nom} · personne ${s.personne} · modele ${s.modele} · dernier ${s.dernier}`);
  }
  console.log(lignes.join("\n"));
  return 0;
}

// ---------------------------------------------------------------- Ligne de commande

const USAGE = [
  "Usage : pulse-aidd skill mesurer <chemin>    tailles d'une skill, d'un agent ou d'un dossier de skills",
  "        pulse-aidd skill verifier <chemin>   règles K vérifiables par script (pulse-aidd reference skills/regles-skills.md)",
  "<chemin> : une skill (dossier ou SKILL.md), un agent (agents/<nom>.md), un dossier de skills (.claude/skills/),",
  "ou un dossier qui contient skills/ ou agents/ (.claude/, un plugin).",
  "        pulse-aidd skill usage [--depuis AAAA-MM-JJ] [--projets <dossier>]   l'usage observé dans l'historique des sessions",
  "(par défaut ~/.claude/projects, 90 derniers jours).",
].join("\n");

const deplier = (p) => (p === "~" || /^~[\\/]/.test(p) ? path.join(os.homedir(), p.slice(1)) : p);

function formaterMesures(mesures) {
  const blocs = [];
  for (const m of mesures) {
    if (m.type === "dossier") {
      blocs.push([`descriptions-total: ${m.descriptionsTotal} car`, ...m.recoupements.map((r) => `recoupement: ${r.a} ${r.b} ${r.lignes} lignes`)].join("\n"));
      continue;
    }
    const l = [`${m.type}: ${m.nom}`, `chemin: ${m.chemin}`];
    if (m.type === "agent") {
      l.push(`agent-md: ${m.agentMd.car} car · ${m.agentMd.jetons} jetons estimés`, `description: ${m.description === null ? "absente" : `${m.description} car`}`);
    } else {
      l.push(`skill-md: ${m.skillMd.car} car · ${m.skillMd.jetons} jetons estimés`, `frontmatter: ${m.frontmatter} car`, `description: ${m.description === null ? "absente" : `${m.description} car`}`);
      l.push(`processus-fin: ${m.processusFin === null ? "absent" : `${m.processusFin} jetons estimés`}`);
      for (const r of m.references) l.push(`reference: ${r.fichier} ${r.car === null ? "binaire" : `${r.car} car`}`);
      for (const inj of m.injections) l.push(`injection: ${inj.commande} ${inj.car === null ? "non mesurée" : `${inj.car} car`}`);
      for (const f of m.auDela30000) l.push(`au-dela-30000: ${f}`);
    }
    blocs.push(l.join("\n"));
  }
  return blocs.join("\n\n");
}

function main(argv) {
  const [action, cheminBrut] = argv;
  if (!["mesurer", "verifier"].includes(action) || !cheminBrut) {
    console.log(USAGE);
    return 1;
  }
  const chemin = deplier(cheminBrut);
  const lieu = localiser(chemin);
  if (lieu.erreur === "introuvable") {
    console.log(`introuvable: ${cheminBrut}\n${USAGE}`);
    return 1;
  }
  if (lieu.erreur === "hors-format") {
    console.log(`hors-format: ${montrer(lieu.cible)} (format attendu : une skill Claude Code, dossier avec SKILL.md, ou un agent agents/<nom>.md)`);
    return 1;
  }
  try {
    return action === "mesurer" ? afficherMesures(chemin, lieu) : afficherConstats(chemin, lieu);
  } catch (e) {
    console.log(`erreur: ${e.message}`);
    return 1;
  }
}

const aucune = (lieu) => `skills: 0 (aucune skill trouvée dans ${montrer(lieu.cible)})`;

function afficherMesures(chemin, lieu) {
  if (!lieu.unites.length) return console.log(aucune(lieu)), 0;
  console.log(formaterMesures(mesurer(chemin)));
  return 0;
}

function afficherConstats(chemin, lieu) {
  const constats = verifier(chemin);
  const lignes = [];
  if (unix(lieu.cible).includes("/plugins/cache/")) lignes.push("installe: oui");
  if (!lieu.unites.length) lignes.push(aucune(lieu));
  for (const c of constats) lignes.push(`${c.regle} · ${c.gravite} · ${c.fichier}:${c.ligne} · ${c.message}`);
  const n = (g) => constats.filter((c) => c.gravite === g).length;
  lignes.push(`bilan: ${n("bloquant")} bloquants · ${n("a-corriger")} à corriger · ${n("conseil")} conseils`);
  console.log(lignes.join("\n"));
  return n("bloquant") ? 1 : 0;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "usage") afficherUsage(args.slice(1)).then((code) => (process.exitCode = code));
  else process.exitCode = main(args);
}

module.exports = { mesurer, verifier, usage, lireEntete, listeOutils, couvre, SENSIBLES, estSensible, injectionLisible, main };

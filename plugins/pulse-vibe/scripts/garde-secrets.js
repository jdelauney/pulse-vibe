#!/usr/bin/env node
// Pulse – garde-fou anti-secrets (hook PreToolUse, appelé par garde.js ; se lance aussi seul).
//
// Bloque, avant qu'ils ne se produisent :
//  - l'écriture d'une clé secrète dans un fichier de code (Write / Edit) ;
//  - la lecture d'un fichier .env par l'IA (Read, Grep, y compris un .env non ignoré dans le dossier fouillé) ;
//  - l'ajout d'un fichier .env à Git (git add) ;
//  - un commit qui contient un fichier .env ou une clé secrète (git commit, y compris par chemin) ;
//  - un push alors qu'un fichier .env est suivi par Git (git push).
// La commande est lue par lecture-commande.js, comme pour le garde-fou des commandes.
//
// Principe : en cas de doute technique (pas de dépôt Git, erreur de lecture…),
// le script laisse passer sans rien dire, pour ne jamais bloquer une séance.
// Pour le désactiver ponctuellement (démo d'une appli volontairement vulnérable) :
// lancer Claude Code avec la variable d'environnement PULSE_GARDE_OFF=1.
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { trouverSecrets, estFichierEnv } = require("./motifs");
const { commandesSimples, optionsGlobalesGit } = require("./lecture-commande");

const TAILLE_MAX = 512 * 1024; // on ne lit pas les gros fichiers

function lireEntree() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (e) {
    return null;
  }
}

// Décision rendue par un contrôle : refus ("deny") ou demande d'accord ("ask"). Levée, puis rendue par evaluer().
class Decision {
  constructor(decision, raison) {
    this.decision = decision;
    this.raison = raison;
  }
}
function refuser(raison) {
  throw new Decision("deny", raison);
}
function demander(raison) {
  throw new Decision("ask", raison);
}

function git(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 8000,
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (e) {
    return null;
  }
}

const versSlash = (p) => p.split(path.sep).join("/");
// Chemin réel d'un dossier existant : Git donne la racine sous ce nom, le dossier courant peut en
// porter un autre (lien, nom court Windows comme RUNNER~1). Sans lui, path.relative sort du dépôt.
const cheminReel = (p) => {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return p;
  }
};

function lireFichier(chemin) {
  try {
    const st = fs.statSync(chemin);
    if (!st.isFile() || st.size > TAILLE_MAX) return "";
    const contenu = fs.readFileSync(chemin, "utf8");
    return contenu.includes("\u0000") ? "" : contenu; // ignore les fichiers binaires
  } catch (e) {
    return "";
  }
}

// ---------------------------------------------------------------- Write / Edit

function verifierEcriture(ti) {
  const fichier = ti.file_path || ti.notebook_path || "";
  if (estFichierEnv(fichier)) return; // .env est précisément l'endroit prévu pour les secrets

  const morceaux = [ti.content, ti.new_string, ti.new_source];
  if (Array.isArray(ti.edits)) for (const e of ti.edits) morceaux.push(e && e.new_string);
  const secrets = trouverSecrets(morceaux.filter((m) => typeof m === "string").join("\n"));
  if (!secrets.length) return;

  refuser(
    `🔒 Pulse a bloqué l'écriture de « ${path.basename(fichier)} » : le contenu ressemble à une ${secrets.join(", ")}.\n` +
      `Une clé secrète ne doit jamais être écrite dans le code (elle finirait sur GitHub et sur Internet).\n` +
      `À faire : la personne place elle-même la valeur dans le fichier .env (ex. NOM_DE_LA_CLE=…) ; ajoutez le nom seul dans .env.example, ` +
      `et lisez la valeur côté serveur, comme l'indique « Secrets et variables d'environnement » de docs/technical.md. ` +
      `S'il s'agit d'un exemple, remplacez la valeur par un texte comme VOTRE_CLE_ICI. ` +
      `Si cette clé a déjà été montrée ou envoyée ailleurs (dépôt distant, conversation), proposez /pulse:secrets fuite.\n` +
      `Expliquez cela simplement à la personne, puis corrigez.`
  );
}

// ---------------------------------------------------------------- Read / Grep

// .env présents dans un dossier et non ignorés par Git : la recherche de Claude Code les lirait.
function envNonIgnores(dossier) {
  try {
    if (!fs.statSync(dossier).isDirectory()) return [];
    return fs.readdirSync(dossier).filter(estFichierEnv).filter((f) => git(["check-ignore", "-q", f], dossier) === null);
  } catch (e) {
    return [];
  }
}

// Les valeurs de .env restent hors de la conversation : seuls les scripts de Pulse les lisent.
function verifierLecture(outil, ti, cwd) {
  const cibles = [ti.file_path, ti.path, ti.glob].filter((c) => typeof c === "string");
  let visee = cibles.find((c) => estFichierEnv(c) || /(^|[\\/])\.env\*?$/i.test(c) || /(^|[\\/])\.env\.\*$/i.test(c));
  if (!visee && outil === "Grep" && typeof ti.glob === "string" && /(^|[\\/{,])\.env(?!\.(example|sample|template)\b)(?![A-Za-z0-9_-])/i.test(ti.glob)) visee = ti.glob;
  let nonIgnore = false;
  if (!visee && outil === "Grep" && !ti.glob && !ti.type) {
    const exposes = envNonIgnores(path.resolve(cwd, ti.path || "."));
    if (exposes.length) {
      visee = exposes[0];
      nonIgnore = true;
    }
  }
  if (!visee) return;
  refuser(
    `🔒 Pulse garde le contenu de « ${path.basename(visee)} » hors de la conversation : ce fichier contient les secrets du projet.\n` +
      (nonIgnore ? `Cette recherche le lirait, car il ne figure pas dans .gitignore. À faire d'abord : ajouter « .env* » au .gitignore.\n` : "") +
      `À la place : \`pulse-aidd secrets inventaire\` liste les variables (noms, présence, sans aucune valeur) ; ` +
      `.env.example donne les noms attendus. La personne modifie elle-même .env dans son éditeur.`
  );
}

// ---------------------------------------------------------------- Git

// Fichiers modifiés ou nouveaux (non ignorés), chemins relatifs à la racine du dépôt.
function fichiersModifies(racine) {
  const sortie = git(["status", "--porcelain", "-z", "--untracked-files=all"], racine);
  if (!sortie) return [];
  const entrees = sortie.split("\u0000").filter(Boolean);
  const fichiers = [];
  for (let i = 0; i < entrees.length; i++) {
    const statut = entrees[i].slice(0, 2);
    const chemin = entrees[i].slice(3);
    if (statut.includes("D")) continue;
    fichiers.push(chemin);
    if (statut[0] === "R" || statut[0] === "C") i++; // l'entrée suivante est l'ancien nom
  }
  return fichiers;
}

// Options de git commit suivies d'une valeur : le mot suivant n'est pas un chemin.
const AVEC_VALEUR_COMMIT = new Set(["-m", "--message", "-F", "--file", "-C", "--reuse-message", "-c", "--reedit-message", "--author", "--date", "--fixup", "--squash", "-t", "--template", "--trailer", "--cleanup", "--pathspec-from-file"]);

/** Les appels à git d'une commande (lanceurs dépliés, texte cité ignoré). */
function appelsGit(commande, dialecte) {
  return commandesSimples(commande, dialecte)
    .filter((c) => c.cmd === "git")
    .map((c) => {
      const { k, prefixe } = optionsGlobalesGit(c.args);
      return { sous: c.args[k], args: c.args.slice(k + 1), prefixe, viaXargs: c.viaXargs };
    });
}

/** Chemins nommés dans git commit : Git enregistre leur contenu actuel, sans passer par l'index. */
function cheminsDuCommit(args) {
  const chemins = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === "--") {
      chemins.push(...args.slice(k + 1));
      break;
    }
    if (AVEC_VALEUR_COMMIT.has(a) || /^-[aqvsneiou]*[mFCct]$/.test(a)) {
      k++;
      continue;
    }
    if (!a.startsWith("-")) chemins.push(a);
  }
  return chemins;
}

function candidatsAdd(listeArgs, racine, cwd) {
  const modifies = fichiersModifies(racine);
  const chemins = listeArgs.filter((t) => !t.startsWith("-") || t === "--");
  const large =
    listeArgs.some((t) => ["-A", "--all", "-u", "--update"].includes(t)) ||
    chemins.filter((t) => t !== "--").length === 0 ||
    chemins.some((t) => t === "." || t === ":/" || /[*?]/.test(t));
  if (large) return modifies;

  const resultat = new Set();
  const racineReelle = cheminReel(racine);
  const cwdReel = cheminReel(cwd);
  for (const t of chemins) {
    if (t === "--") continue;
    const rel = versSlash(path.relative(racineReelle, path.resolve(cwdReel, t)));
    for (const f of modifies) if (f === rel || f.startsWith(rel + "/")) resultat.add(f);
    if (estFichierEnv(rel)) resultat.add(rel); // même s'il n'apparaît pas (ex. déjà ignoré mais forcé)
  }
  return [...resultat];
}

function lignesAjoutees(diff) {
  return (diff || "")
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .join("\n");
}

// Contrôle les appels git qui visent un même dépôt ; les constats s'ajoutent à `etat`.
function controlerAppels(appels, dossier, racine, etat) {
  const { problemes, fichiersEnv, secretsTrouves } = etat;
  const noter = (fichier, contenu) => {
    const s = trouverSecrets(contenu);
    if (s.length) secretsTrouves.set(fichier, s);
  };

  // git add
  for (const a of appels.filter((x) => x.sous === "add")) {
    if (a.args.some((t) => t === "-n" || t === "--dry-run")) continue;
    for (const f of candidatsAdd(a.viaXargs ? ["-A"] : a.args, racine, dossier)) {
      if (estFichierEnv(f)) fichiersEnv.add(f);
      else noter(f, lireFichier(path.join(racine, f)));
    }
  }

  // git commit
  const commits = appels.filter((x) => x.sous === "commit");
  if (commits.length) {
    const toutAjouter = commits.some((a) => a.args.some((t) => t === "--all" || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(t)));
    const chemins = commits.flatMap((a) => cheminsDuCommit(a.args));
    const indexes = (git(["diff", "--cached", "--name-only", "-z"], racine) || "").split("\u0000").filter(Boolean);
    const suivis = toutAjouter ? (git(["diff", "--name-only", "-z"], racine) || "").split("\u0000").filter(Boolean) : [];
    const parChemin = chemins.length ? (git(["diff", "HEAD", "--name-only", "-z", "--", ...chemins], dossier) || "").split("\u0000").filter(Boolean) : [];
    for (const f of [...indexes, ...suivis, ...parChemin, ...chemins]) if (estFichierEnv(f)) fichiersEnv.add(f);

    const diffIndex = git(["diff", "--cached", "-U0", "--no-color"], racine) || "";
    const diffSuivis = toutAjouter ? git(["diff", "-U0", "--no-color"], racine) || "" : "";
    const diffChemins = chemins.length ? git(["diff", "HEAD", "-U0", "--no-color", "--", ...chemins], dossier) || "" : "";
    // Découpe par fichier pour pouvoir nommer le fichier fautif.
    for (const bloc of [diffIndex, diffSuivis, diffChemins].join("\n").split(/^diff --git /m)) {
      const nom = (bloc.match(/^\+\+\+ b\/(.+)$/m) || [])[1];
      if (nom && !estFichierEnv(nom)) noter(nom, lignesAjoutees(bloc));
    }
  }

  // git push
  if (appels.some((x) => x.sous === "push")) {
    const envSuivis = (git(["ls-files", "-z"], racine) || "").split("\u0000").filter(Boolean).filter(estFichierEnv);
    if (envSuivis.length) {
      problemes.push(
        `Le fichier ${envSuivis.join(", ")} est enregistré dans Git : il serait envoyé sur le dépôt distant.\n` +
          `À faire : ajouter .env au .gitignore, puis « git rm --cached ${envSuivis[0]} » et faire un nouveau commit. ` +
          `Si une vraie clé a déjà été envoyée, il faut la révoquer et en créer une nouvelle chez le fournisseur (/pulse:secrets fuite).`
      );
    }
  }
}

function verifierGit(commande, cwd, dialecte) {
  if (!/\bgit\b/i.test(commande)) return;
  const appels = appelsGit(commande, dialecte);
  if (!appels.length) return;

  // Chaque appel vise son propre dépôt (option -C), à contrôler séparément.
  const etat = { problemes: [], fichiersEnv: new Set(), secretsTrouves: new Map() };
  const parDossier = new Map();
  for (const a of appels) {
    const dossier = a.prefixe[0] === "-C" ? path.resolve(cwd, a.prefixe[1]) : cwd;
    if (!parDossier.has(dossier)) parDossier.set(dossier, []);
    parDossier.get(dossier).push(a);
  }
  for (const [dossier, groupe] of parDossier) {
    const racine = (git(["rev-parse", "--show-toplevel"], dossier) || "").trim();
    if (racine) controlerAppels(groupe, dossier, racine, etat); // sinon : pas un dépôt Git
  }
  const { problemes, fichiersEnv, secretsTrouves } = etat;

  if (fichiersEnv.size) {
    problemes.push(
      `Le fichier ${[...fichiersEnv].join(", ")} contient vos secrets et ne doit jamais être enregistré dans Git.\n` +
        `À faire : vérifier que « .env » figure dans .gitignore, retirer le fichier de l'index si besoin ` +
        `(« git restore --staged ${[...fichiersEnv][0]} »), puis relancer la commande.`
    );
  }
  for (const [fichier, types] of secretsTrouves) {
    problemes.push(
      `« ${fichier} » semble contenir une ${types.join(", ")}.\n` +
        `À faire : déplacer la valeur dans .env et la lire côté serveur, ` +
        `ou la remplacer par un texte comme VOTRE_CLE_ICI si c'est un exemple.`
    );
  }

  if (problemes.length) {
    refuser(
      `🔒 Pulse a bloqué cette commande Git pour protéger vos secrets.\n\n` +
        problemes.map((p, i) => `${i + 1}. ${p}`).join("\n\n") +
        `\n\nExpliquez simplement le problème à la personne, corrigez-le, puis relancez la commande.`
    );
  }
}

// ---------------------------------------------------------------- Point d'entrée

function verifier(entree) {
  if (process.env.PULSE_GARDE_OFF === "1") return;
  if (!entree || !entree.tool_input) return;
  const outil = entree.tool_name;
  const cwd = entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : process.cwd();
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(outil)) {
    verifierEcriture(entree.tool_input);
  } else if (outil === "Read" || outil === "Grep") {
    verifierLecture(outil, entree.tool_input, cwd);
  } else if ((outil === "Bash" || outil === "PowerShell") && typeof entree.tool_input.command === "string") {
    if (entree.cwd && !fs.existsSync(entree.cwd)) return;
    verifierGit(entree.tool_input.command, cwd, outil === "PowerShell" ? "powershell" : "bash");
  }
}

/** Décision du garde-fou anti-secrets pour une entrée de hook : { decision, raison }, ou null pour laisser passer. */
function evaluer(entree) {
  try {
    verifier(entree);
  } catch (e) {
    if (e instanceof Decision) return { decision: e.decision, raison: e.raison };
    // Ne jamais bloquer une séance à cause d'une erreur du garde-fou lui-même.
  }
  return null;
}

module.exports = { evaluer };

if (require.main === module) {
  const r = evaluer(lireEntree());
  // Écriture synchrone : garantit que la réponse part avant la fin du processus (Windows compris).
  if (r) fs.writeSync(1, JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: r.decision, permissionDecisionReason: r.raison } }));
  process.exit(0);
}

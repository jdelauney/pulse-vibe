#!/usr/bin/env node
// Pulse – garde-fou anti-secrets (hook PreToolUse).
//
// Bloque, avant qu'ils ne se produisent :
//  - l'écriture d'une clé secrète dans un fichier de code (Write / Edit) ;
//  - l'ajout d'un fichier .env à Git (git add) ;
//  - un commit qui contient un fichier .env ou une clé secrète (git commit) ;
//  - un push alors qu'un fichier .env est suivi par Git (git push).
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

const TAILLE_MAX = 512 * 1024; // on ne lit pas les gros fichiers

function lireEntree() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (e) {
    return null;
  }
}

function refuser(raison) {
  // Écriture synchrone : garantit que la réponse part avant la fin du processus (Windows compris).
  fs.writeSync(
    1,
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: raison,
      },
    })
  );
  process.exit(0);
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
      `À faire : placez la valeur dans le fichier .env (ex. NOM_DE_LA_CLE=…), ajoutez le nom seul dans .env.example, ` +
      `et lisez-la côté serveur avec process.env.NOM_DE_LA_CLE (fonction Netlify). ` +
      `S'il s'agit d'un exemple, remplacez la valeur par un texte comme VOTRE_CLE_ICI.\n` +
      `Expliquez cela simplement à la personne, puis corrigez.`
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

// Arguments qui suivent "git add" jusqu'au prochain séparateur de commande.
function argumentsDe(commande, sousCommande) {
  const re = new RegExp(`\\bgit\\s+(?:-C\\s+\\S+\\s+)?${sousCommande}\\b([^;&|\\n]*)`, "g");
  const listes = [];
  let m;
  while ((m = re.exec(commande)) !== null) {
    listes.push(m[1].trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/^['"]|['"]$/g, "")));
  }
  return listes;
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
  for (const t of chemins) {
    if (t === "--") continue;
    const rel = versSlash(path.relative(racine, path.resolve(cwd, t)));
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

function verifierGit(commande, cwd) {
  if (!/\bgit\b/.test(commande)) return;
  const racine = (git(["rev-parse", "--show-toplevel"], cwd) || "").trim();
  if (!racine) return; // pas un dépôt Git

  const problemes = [];
  const fichiersEnv = new Set();
  const secretsTrouves = new Map(); // fichier -> types

  const noter = (fichier, contenu) => {
    const s = trouverSecrets(contenu);
    if (s.length) secretsTrouves.set(fichier, s);
  };

  // git add
  const adds = argumentsDe(commande, "add");
  for (const args of adds) {
    for (const f of candidatsAdd(args, racine, cwd)) {
      if (estFichierEnv(f)) fichiersEnv.add(f);
      else noter(f, lireFichier(path.join(racine, f)));
    }
  }

  // git commit
  const commits = argumentsDe(commande, "commit");
  if (commits.length) {
    const toutAjouter = commits.some((a) => a.some((t) => t === "--all" || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(t)));
    const indexes = (git(["diff", "--cached", "--name-only", "-z"], racine) || "").split("\u0000").filter(Boolean);
    const suivis = toutAjouter ? (git(["diff", "--name-only", "-z"], racine) || "").split("\u0000").filter(Boolean) : [];
    for (const f of [...indexes, ...suivis]) if (estFichierEnv(f)) fichiersEnv.add(f);

    const diffIndex = git(["diff", "--cached", "-U0", "--no-color"], racine) || "";
    const diffSuivis = toutAjouter ? git(["diff", "-U0", "--no-color"], racine) || "" : "";
    // Découpe par fichier pour pouvoir nommer le fichier fautif.
    for (const bloc of (diffIndex + "\n" + diffSuivis).split(/^diff --git /m)) {
      const nom = (bloc.match(/^\+\+\+ b\/(.+)$/m) || [])[1];
      if (nom && !estFichierEnv(nom)) noter(nom, lignesAjoutees(bloc));
    }
  }

  // git push
  if (/\bgit\s+(?:-C\s+\S+\s+)?push\b/.test(commande)) {
    const suivis = (git(["ls-files", "-z"], racine) || "").split("\u0000").filter(Boolean);
    const envSuivis = suivis.filter(estFichierEnv);
    if (envSuivis.length) {
      problemes.push(
        `Le fichier ${envSuivis.join(", ")} est enregistré dans Git : il serait envoyé sur GitHub.\n` +
          `À faire : ajouter .env au .gitignore, puis « git rm --cached ${envSuivis[0]} » et faire un nouveau commit. ` +
          `Si une vraie clé a déjà été envoyée sur GitHub, il faut la révoquer et en créer une nouvelle chez le fournisseur.`
      );
    }
  }

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
        `À faire : déplacer la valeur dans .env et la lire avec process.env côté serveur, ` +
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

function principal() {
  if (process.env.PULSE_GARDE_OFF === "1") return;
  const entree = lireEntree();
  if (!entree || !entree.tool_input) return;
  const outil = entree.tool_name;
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(outil)) {
    verifierEcriture(entree.tool_input);
  } else if (outil === "Bash" && typeof entree.tool_input.command === "string") {
    verifierGit(entree.tool_input.command, entree.cwd || process.cwd());
  }
}

try {
  principal();
} catch (e) {
  // Ne jamais bloquer une séance à cause d'une erreur du garde-fou lui-même.
}
process.exit(0);

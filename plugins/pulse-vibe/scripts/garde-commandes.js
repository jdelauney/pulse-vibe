#!/usr/bin/env node
// Pulse – garde-fou des commandes (hook PreToolUse sur Bash).
//
// Une règle écrite influence ; un hook empêche. Ce garde-fou agit aussi en mode « bypass »,
// où les demandes d'autorisation de Claude Code ne s'affichent plus.
//
// Refuse (avec l'alternative) :
//  - un envoi forcé (git push --force, -f, --force-with-lease, +branche) ;
//  - le contournement d'un contrôle (--no-verify, git commit -n) ;
//  - l'indexation globale (git add -A / . / -u, git commit -a) dans un dépôt qui a déjà un commit :
//    une autre session peut travailler dans le même dépôt.
// Demande confirmation pour :
//  - ce qui jette du travail (git reset --hard, checkout/restore de fichiers, clean -f, stash drop/clear) ;
//  - git branch -D, git worktree remove --force, la suppression d'une branche distante ;
//  - git config qui écrit autre chose que user.name / user.email ;
//  - une suppression récursive (rm -r, rimraf, find -delete) hors dossiers reconstruits ;
//  - une commande de base de données qui écrase ou supprime (drizzle-kit push, db:push, prisma db push,
//    migrate reset, supabase db reset/push, DROP / TRUNCATE / DELETE sans WHERE dans psql) ;
//  - une mise en production directe (vercel --prod, promote, rollback, netlify deploy --prod,
//    wrangler deploy / secret put) et une fusion (gh pr merge, glab mr merge).
//
// La commande est lue comme le shell la lit : segments (&&, ||, ;, |, retours à la ligne, parenthèses),
// préfixes retirés (sudo, env, VAR=…, npx, pnpm dlx…), sh -c, eval, heredoc lu par un shell et $(…) dépliés.
// Un texte cité (message de commit, echo, heredoc écrit dans un fichier) ne déclenche rien.
//
// Fail-open : en cas d'erreur du garde-fou, la commande passe.
// Désactivation : PULSE_GARDE_COMMANDES_OFF=1 dans l'environnement où Claude Code est lancé
// (jamais dans la commande elle-même).
"use strict";

const fs = require("fs");
const { execFileSync } = require("child_process");

const PROFONDEUR_MAX = 6;
const DOSSIERS_RECONSTRUITS = new Set(["node_modules", ".next", "dist", "build", "coverage", ".turbo", ".vercel", "out", ".cache", ".svelte-kit", ".nuxt", ".output", "playwright-report", "test-results"]);
const MOTS_CLES = new Set(["if", "then", "else", "elif", "fi", "do", "done", "while", "until", "!", "{", "}", "time"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
const GESTIONNAIRES = new Set(["npm", "pnpm", "yarn", "bun"]);

// ---------------------------------------------------------------- Lecture de la commande

/**
 * Découpe un script shell en segments ({ mots, entrees }) et en sous-scripts ($(…) et `…`).
 * `entrees` : le texte des heredocs et here-strings du segment (lu seulement si le segment est un shell).
 */
function decouper(script) {
  const segments = [];
  const sousScripts = [];
  let mots = [];
  let entrees = [];
  let mot = null;
  let redirection = false; // le prochain mot est une cible de redirection, pas un argument
  let texteEnvoye = false; // le prochain mot est le texte d'un here-string (<<<)
  let heredocsEnAttente = []; // { delim, retirerTabs, segment }
  let i = 0;
  const n = script.length;

  const finirMot = () => {
    if (mot !== null) {
      if (redirection) redirection = false;
      else if (texteEnvoye) {
        entrees.push(mot);
        texteEnvoye = false;
      } else mots.push(mot);
    }
    mot = null;
  };
  // Termine le segment courant ; les heredocs ouverts lui appartiennent.
  const finirSegment = () => {
    finirMot();
    const seg = { mots, entrees };
    if (mots.length || entrees.length) segments.push(seg);
    for (const h of heredocsEnAttente) if (!h.segment) h.segment = seg;
    mots = [];
    entrees = [];
  };
  const ajouter = (c) => (mot = (mot || "") + c);

  // Lit $( … ) à partir de i (sur le « $ »), rend l'indice après la parenthèse fermante.
  const lireSubstitution = (debut) => {
    let profondeur = 0;
    let j = debut + 1;
    for (; j < n; j++) {
      const c = script[j];
      if (c === "'") {
        j = script.indexOf("'", j + 1);
        if (j < 0) return n;
      } else if (c === "(") profondeur++;
      else if (c === ")" && --profondeur === 0) break;
    }
    sousScripts.push(script.slice(debut + 2, j));
    return Math.min(j + 1, n);
  };

  const lireHeredocs = () => {
    for (const h of heredocsEnAttente) {
      const lignes = [];
      while (i < n) {
        let fin = script.indexOf("\n", i);
        if (fin < 0) fin = n;
        const ligne = script.slice(i, fin);
        i = fin + 1;
        if ((h.retirerTabs ? ligne.replace(/^\t+/, "") : ligne) === h.delim) break;
        lignes.push(ligne);
      }
      h.segment.entrees.push(lignes.join("\n"));
    }
    heredocsEnAttente = [];
  };

  while (i < n) {
    const c = script[i];
    if (c === "'") {
      const fin = script.indexOf("'", i + 1);
      ajouter(script.slice(i + 1, fin < 0 ? n : fin));
      i = fin < 0 ? n : fin + 1;
    } else if (c === '"') {
      let j = i + 1;
      let texte = "";
      while (j < n && script[j] !== '"') {
        if (script[j] === "\\" && j + 1 < n && '"\\$`'.includes(script[j + 1])) {
          texte += script[j + 1];
          j += 2;
        } else if (script[j] === "$" && script[j + 1] === "(") {
          const apres = lireSubstitution(j);
          texte += script.slice(j, apres);
          j = apres;
        } else texte += script[j++];
      }
      ajouter(texte);
      i = j + 1;
    } else if (c === "\\") {
      if (script[i + 1] !== "\n") ajouter(script[i + 1] || "");
      i += 2;
    } else if (c === "$" && script[i + 1] === "(") {
      const apres = lireSubstitution(i);
      ajouter(script.slice(i, apres));
      i = apres;
    } else if (c === "`") {
      const fin = script.indexOf("`", i + 1);
      sousScripts.push(script.slice(i + 1, fin < 0 ? n : fin));
      i = fin < 0 ? n : fin + 1;
    } else if (c === "#" && mot === null) {
      while (i < n && script[i] !== "\n") i++;
    } else if (c === "\n") {
      finirSegment();
      i++;
      lireHeredocs();
    } else if (c === " " || c === "\t" || c === "\r") {
      finirMot();
      i++;
    } else if (c === ";" || c === "&" || c === "|" || c === "(" || c === ")") {
      if (c === "&" && script[i + 1] === ">") {
        finirMot();
        redirection = true;
        i += script[i + 2] === ">" ? 3 : 2;
        continue;
      }
      finirSegment();
      i += (c === "&" || c === "|" || c === ";") && script[i + 1] === c ? 2 : 1;
    } else if (c === "<" && script.startsWith("<<<", i)) {
      finirMot();
      texteEnvoye = true;
      i += 3;
    } else if (c === "<" && script[i + 1] === "<") {
      finirMot();
      i += 2;
      const retirerTabs = script[i] === "-";
      if (retirerTabs) i++;
      while (script[i] === " ") i++;
      let delim = "";
      while (i < n && !" \t\n;&|<>".includes(script[i])) {
        if (script[i] !== "'" && script[i] !== '"' && script[i] !== "\\") delim += script[i];
        i++;
      }
      heredocsEnAttente.push({ delim, retirerTabs, segment: null });
    } else if (c === ">" || c === "<") {
      if (mot !== null && /^\d+$/.test(mot)) mot = null;
      finirMot();
      redirection = true;
      i++;
      if (script[i] === ">" || script[i] === "&" || script[i] === "|") i++;
    } else {
      ajouter(c);
      i++;
    }
  }
  finirSegment();
  lireHeredocs();
  return { segments, sousScripts };
}

/** Nom d'une commande : sans chemin, sans extension Windows, sans version épinglée. */
function nomCommande(mot) {
  let nom = String(mot).split(/[\\/]/).pop().toLowerCase();
  nom = nom.replace(/\.(exe|cmd|bat)$/, "");
  const arobase = nom.indexOf("@", nom.startsWith("@") ? 1 : 0);
  if (arobase > 0) nom = nom.slice(0, arobase);
  return nom;
}

const estOption = (m) => m.startsWith("-") && m !== "-" && m !== "--";
const flagsCourts = (m) => (/^-[a-zA-Z]+$/.test(m) ? m.slice(1) : "");

// ---------------------------------------------------------------- Constats

const REFUS = "deny";
const ACCORD = "ask";

const MESSAGES = {
  envoiForce:
    "Pulse refuse l'envoi forcé : il réécrit l'historique du dépôt distant et peut effacer le travail d'une autre personne. " +
    "À la place : `git pull`, résoudre les différences, puis `git push`. En cas de blocage, `/pulse:get-help`.",
  noVerify:
    "Pulse refuse le contournement des contrôles (--no-verify) : ils protègent vos secrets et la qualité du projet. " +
    "À la place : corriger ce que le contrôle signale, puis relancer la commande.",
  indexationGlobale:
    "Pulse refuse l'indexation globale dans un dépôt qui a déjà un historique : une autre session peut travailler dans le même dépôt, " +
    "et ses fichiers partiraient dans votre commit. À la place : `git add <fichier> <fichier>…` en nommant les fichiers du sujet, puis `git commit`.",
  travailJete:
    "Pulse demande votre accord : cette commande efface des modifications qui ne sont enregistrées nulle part. " +
    "Pour revenir en arrière sans rien perdre, préférez `/pulse:annuler`.",
  brancheForcee:
    "Pulse demande votre accord : cette commande supprime une branche ou un worktree même s'il contient du travail non fusionné. " +
    "Sans risque : `git branch -d` (Git refuse s'il reste du travail à fusionner).",
  brancheDistante: "Pulse demande votre accord : cette commande supprime une branche sur le dépôt distant.",
  config: "Pulse demande votre accord : cette commande change la configuration de Git au-delà du nom et de l'e-mail.",
  suppression: "Pulse demande votre accord : cette commande supprime des fichiers et des dossiers entiers, sans passer par la corbeille.",
  baseDeDonnees:
    "Pulse demande votre accord : cette commande peut écraser ou supprimer des données de la base, qui est peut-être celle du site en ligne. " +
    "Préférez une migration relue et testée en local.",
  production:
    "Pulse demande votre accord : cette commande publie ou modifie directement le site en ligne. " +
    "D'habitude, la mise en ligne passe par `git push` (le déploiement continu publie la nouvelle version).",
  fusion: "Pulse demande votre accord : cette commande fusionne une demande de fusion. D'habitude, la fusion se fait par vous, sur le site du dépôt.",
  lectureEnv:
    "Pulse garde le contenu des fichiers .env hors de la conversation : ils contiennent les secrets du projet. " +
    "À la place : `pulse-aidd secrets inventaire` liste les variables (noms, présence, sans aucune valeur) ; `.env.example` donne les noms attendus.",
};

// Commandes qui affichent le contenu d'un fichier (shell et PowerShell).
const LECTEURS = new Set(["cat", "type", "more", "less", "head", "tail", "grep", "egrep", "rg", "nl", "bat", "get-content", "gc", "select-string", "sls", "awk", "sed", "strings", "xxd", "od"]);
const estFichierEnv = (mot) => {
  const nom = String(mot).split(/[\\/]/).pop();
  return /^\.env(\..+)?$/.test(nom) && !/^\.env\.(example|sample|template)$/.test(nom);
};

// ---------------------------------------------------------------- Règles par commande

function aDejaUnCommit(cwd, dossierGit) {
  try {
    const args = dossierGit ? ["-C", dossierGit, "rev-parse", "--verify", "-q", "HEAD"] : ["rev-parse", "--verify", "-q", "HEAD"];
    execFileSync("git", args, { cwd, stdio: "ignore", timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
}

function reglesGit(args, cwd, constats) {
  // Options globales avant la sous-commande.
  let dossierGit = null;
  let k = 0;
  while (k < args.length && args[k].startsWith("-")) {
    if (args[k] === "-C") dossierGit = args[++k];
    else if (args[k] === "-c") k++;
    k++;
  }
  const sous = args[k];
  const reste = args.slice(k + 1);
  const options = reste.filter(estOption);
  const positions = reste.filter((m) => !estOption(m) && m !== "--");
  const aFlag = (...noms) => options.some((o) => noms.includes(o) || noms.some((nm) => nm.length === 2 && flagsCourts(o).includes(nm[1])));

  switch (sous) {
    case "push":
      if (options.some((o) => o === "--force" || o.startsWith("--force-with-lease") || o === "--force-if-includes" || flagsCourts(o).includes("f")) || positions.some((p) => p.startsWith("+")))
        constats.push([REFUS, MESSAGES.envoiForce]);
      if (options.includes("--no-verify")) constats.push([REFUS, MESSAGES.noVerify]);
      if (options.includes("--delete") || options.includes("-d") || options.includes("--mirror") || positions.some((p) => p.startsWith(":") && p.length > 1))
        constats.push([ACCORD, MESSAGES.brancheDistante]);
      break;
    case "commit":
      if (options.includes("--no-verify") || options.some((o) => flagsCourts(o).includes("n"))) constats.push([REFUS, MESSAGES.noVerify]);
      if ((options.includes("--all") || options.some((o) => flagsCourts(o).includes("a"))) && aDejaUnCommit(cwd, dossierGit))
        constats.push([REFUS, MESSAGES.indexationGlobale]);
      break;
    case "merge":
    case "rebase":
    case "am":
      if (options.includes("--no-verify")) constats.push([REFUS, MESSAGES.noVerify]);
      break;
    case "add": {
      const globale =
        options.some((o) => ["-A", "--all", "-u", "--update", "--no-ignore-removal"].includes(o) || /^-[a-zA-Z]*[Au][a-zA-Z]*$/.test(o)) ||
        positions.some((p) => [".", "./", ":/", "*", ":(top)", ":/*"].includes(p));
      if (globale && aDejaUnCommit(cwd, dossierGit)) constats.push([REFUS, MESSAGES.indexationGlobale]);
      break;
    }
    case "reset":
      if (options.includes("--hard")) constats.push([ACCORD, MESSAGES.travailJete]);
      break;
    case "checkout":
      if (reste.includes("--") || positions.includes(".") || options.includes("-f") || options.includes("--force")) constats.push([ACCORD, MESSAGES.travailJete]);
      break;
    case "restore": {
      const worktree = options.includes("--worktree") || options.includes("-W") || !(options.includes("--staged") || options.includes("-S"));
      if (worktree && positions.length) constats.push([ACCORD, MESSAGES.travailJete]);
      break;
    }
    case "clean":
      if (options.some((o) => o === "--force" || flagsCourts(o).includes("f"))) constats.push([ACCORD, MESSAGES.travailJete]);
      break;
    case "stash":
      if (positions[0] === "drop" || positions[0] === "clear") constats.push([ACCORD, MESSAGES.travailJete]);
      break;
    case "branch":
      if (options.includes("-D") || ((options.includes("--delete") || options.includes("-d")) && (options.includes("--force") || options.includes("-f"))))
        constats.push([ACCORD, MESSAGES.brancheForcee]);
      break;
    case "worktree":
      if (positions[0] === "remove" && (options.includes("--force") || options.includes("-f"))) constats.push([ACCORD, MESSAGES.brancheForcee]);
      break;
    case "config":
      if (configEcrit(reste)) constats.push([ACCORD, MESSAGES.config]);
      break;
    default:
      break;
  }
}

/** Vrai si `git config <reste>` écrit autre chose que user.name / user.email. */
function configEcrit(reste) {
  const AVEC_VALEUR = new Set(["--file", "-f", "--blob", "--type", "--default"]);
  const ECRITURES = ["--unset", "--unset-all", "--add", "--replace-all", "--edit", "-e", "--rename-section", "--remove-section"];
  const LECTURES = ["--get", "--get-all", "--get-regexp", "--get-urlmatch", "--list", "-l", "--show-origin", "--show-scope", "--name-only"];
  const positions = [];
  let ecriture = false;
  let lecture = false;
  for (let k = 0; k < reste.length; k++) {
    const m = reste[k];
    if (AVEC_VALEUR.has(m)) k++;
    else if (ECRITURES.includes(m)) ecriture = true;
    else if (LECTURES.includes(m)) lecture = true;
    else if (!estOption(m)) positions.push(m);
  }
  // Syntaxe récente : git config set|unset|get|list …
  if (["set", "unset", "rename-section", "remove-section", "edit"].includes(positions[0])) {
    ecriture = true;
    positions.shift();
  } else if (["get", "list"].includes(positions[0])) return false;
  if (lecture && !ecriture) return false;
  if (!ecriture && positions.length < 2) return false;
  const cle = (positions[0] || "").toLowerCase();
  return !(cle === "user.name" || cle === "user.email");
}

function suppressionRecursive(cibles, constats) {
  const aRisque = cibles.filter((c) => !DOSSIERS_RECONSTRUITS.has(c.replace(/[\\/]+$/, "").split(/[\\/]/).pop()));
  if (aRisque.length) constats.push([ACCORD, MESSAGES.suppression]);
}

function reglesSql(texte, constats) {
  const sql = String(texte || "");
  if (/\b(drop|truncate)\b/i.test(sql)) constats.push([ACCORD, MESSAGES.baseDeDonnees]);
  else
    for (const instruction of sql.split(";"))
      if (/\b(delete\s+from|update)\b/i.test(instruction) && !/\bwhere\b/i.test(instruction)) {
        constats.push([ACCORD, MESSAGES.baseDeDonnees]);
        break;
      }
}

// ---------------------------------------------------------------- Analyse d'un segment

function analyserScript(script, cwd, constats, profondeur) {
  if (profondeur > PROFONDEUR_MAX || !script) return;
  const { segments, sousScripts } = decouper(script);
  for (const s of segments) analyserSegment(s.mots, s.entrees, cwd, constats, profondeur);
  for (const sous of sousScripts) analyserScript(sous, cwd, constats, profondeur + 1);
}

function retirerOptions(m, avecValeur) {
  while (m.length && estOption(m[0])) {
    const o = m.shift();
    if (avecValeur.includes(o)) m.shift();
  }
  if (m[0] === "--") m.shift();
  return m;
}

function analyserSegment(motsInitiaux, entrees, cwd, constats, profondeur) {
  if (profondeur > PROFONDEUR_MAX) return;
  let m = motsInitiaux.slice();

  // Retirer le costume : mots-clés, affectations, préfixes et lanceurs.
  for (let tour = 0; tour < 12 && m.length; tour++) {
    if (MOTS_CLES.has(m[0]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(m[0])) {
      m.shift();
      continue;
    }
    const cmd = nomCommande(m[0]);
    if (cmd === "sudo" || cmd === "doas") {
      m.shift();
      retirerOptions(m, ["-u", "-g", "-C", "-h", "-p", "-U", "-r", "-t", "-D", "-R", "-T"]);
    } else if (cmd === "env") {
      m.shift();
      while (m.length && (estOption(m[0]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(m[0]))) {
        const o = m.shift();
        if (o === "-S" || o === "--split-string") {
          m = decouper(m.shift() || "").segments.flatMap((s) => s.mots).concat(m);
          break;
        }
        if (["-u", "--unset", "-C", "--chdir"].includes(o)) m.shift();
      }
      if (m[0] === "--") m.shift();
    } else if (["command", "builtin", "exec", "nohup"].includes(cmd)) {
      m.shift();
      retirerOptions(m, []);
    } else if (cmd === "nice") {
      m.shift();
      retirerOptions(m, ["-n", "--adjustment"]);
    } else if (cmd === "timeout") {
      m.shift();
      retirerOptions(m, ["-s", "--signal", "-k", "--kill-after"]);
      m.shift(); // durée
    } else if (cmd === "stdbuf") {
      m.shift();
      retirerOptions(m, ["-i", "-o", "-e"]);
    } else if (cmd === "xargs") {
      m.shift();
      retirerOptions(m, ["-n", "-I", "-L", "-P", "-d", "-E", "-s", "-a", "--arg-file", "--delimiter", "--max-args", "--max-procs"]);
    } else if (cmd === "npx" || cmd === "bunx") {
      m.shift();
      retirerOptions(m, ["-p", "--package", "-c", "--call"]);
    } else if (GESTIONNAIRES.has(cmd)) {
      // Script du projet qui écrase la base (pnpm db:push, npm run db:reset…).
      if (m.slice(1).some((w) => /^db:(push|reset|drop)\b/.test(w))) constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      m.shift();
      retirerOptions(m, ["--filter", "-F", "-C", "--dir", "--prefix", "-w", "--workspace", "--cwd"]);
      if (["dlx", "exec", "x"].includes(m[0])) {
        m.shift();
        retirerOptions(m, ["-p", "--package", "-c"]);
      } else if (["run", "run-script", "test", "start", "install", "i", "add", "remove", "ci", "build", "dev"].includes(m[0])) {
        return;
      }
    } else break;
  }
  if (!m.length) return;

  const cmd = nomCommande(m[0]);
  const args = m.slice(1);

  if (SHELLS.has(cmd)) {
    const k = args.findIndex((a) => estOption(a) && flagsCourts(a).includes("c"));
    if (k >= 0) analyserScript(args.slice(k + 1).find((a) => !estOption(a)) || "", cwd, constats, profondeur + 1);
    else if (!args.some((a) => !estOption(a))) for (const e of entrees) analyserScript(e, cwd, constats, profondeur + 1);
    return;
  }
  if (cmd === "eval") return analyserScript(args.join(" "), cwd, constats, profondeur + 1);

  if (LECTEURS.has(cmd) && args.some((a) => !estOption(a) && estFichierEnv(a))) constats.push([REFUS, MESSAGES.lectureEnv]);

  switch (cmd) {
    case "git":
      reglesGit(args, cwd, constats);
      break;
    case "rm":
      if (args.some((a) => a === "--recursive" || /^-[a-zA-Z]*[rR][a-zA-Z]*$/.test(a))) suppressionRecursive(args.filter((a) => !estOption(a) && a !== "--"), constats);
      break;
    case "rimraf":
      suppressionRecursive(args.filter((a) => !estOption(a)), constats);
      break;
    case "find": {
      if (args.includes("-delete")) constats.push([ACCORD, MESSAGES.suppression]);
      const k = args.findIndex((a) => ["-exec", "-execdir", "-ok", "-okdir"].includes(a));
      if (k >= 0) {
        const fin = args.findIndex((a, j) => j > k && (a === ";" || a === "+" || a === "\\;"));
        analyserSegment(args.slice(k + 1, fin < 0 ? undefined : fin), [], cwd, constats, profondeur + 1);
      }
      break;
    }
    case "drizzle-kit":
      if (args[0] === "push" || args[0] === "drop") constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      break;
    case "prisma":
      if ((args[0] === "db" && args[1] === "push") || (args[0] === "migrate" && args[1] === "reset")) constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      break;
    case "supabase":
      if (args[0] === "db" && (args[1] === "reset" || args[1] === "push")) constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      break;
    case "psql":
      for (let k = 0; k < args.length; k++) if (args[k] === "-c" || args[k] === "--command") reglesSql(args[k + 1], constats);
      for (const e of entrees) reglesSql(e, constats);
      break;
    case "vercel": {
      const prod = args.some((a) => a === "--prod" || a === "--production" || a === "--target=production") || args.join(" ").includes("--target production");
      if ((prod && args[0] !== "build") || ["promote", "rollback", "remove", "rm"].includes(args[0])) constats.push([ACCORD, MESSAGES.production]);
      break;
    }
    case "netlify":
      if (args[0] === "deploy" && args.includes("--prod")) constats.push([ACCORD, MESSAGES.production]);
      break;
    case "wrangler":
      if (((args[0] === "deploy" || args[0] === "publish") && !args.includes("--dry-run")) || (args[0] === "secret" && args[1] === "put") || args[0] === "delete")
        constats.push([ACCORD, MESSAGES.production]);
      break;
    case "gh":
      if (args[0] === "pr" && args[1] === "merge") constats.push([ACCORD, MESSAGES.fusion]);
      break;
    case "glab":
      if (args[0] === "mr" && args[1] === "merge") constats.push([ACCORD, MESSAGES.fusion]);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------- Point d'entrée

function repondre(decision, raison) {
  fs.writeSync(
    1,
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: raison },
    })
  );
}

function principal() {
  if (process.env.PULSE_GARDE_COMMANDES_OFF === "1") return;
  let entree;
  try {
    entree = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (e) {
    return;
  }
  if (!entree || !["Bash", "PowerShell"].includes(entree.tool_name) || !entree.tool_input || typeof entree.tool_input.command !== "string") return;
  const cwd = entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : process.cwd();

  const constats = [];
  analyserScript(entree.tool_input.command, cwd, constats, 0);
  if (!constats.length) return;

  const refus = constats.filter(([d]) => d === REFUS);
  const retenus = refus.length ? refus : constats;
  const raisons = [...new Set(retenus.map(([, r]) => r))];
  repondre(refus.length ? REFUS : ACCORD, `🔒 ${raisons.join("\n\n")}${refus.length ? "\n\nExpliquez simplement la raison à la personne, puis utilisez l'alternative." : ""}`);
}

try {
  principal();
} catch (e) {
  // Fail-open : une erreur du garde-fou ne bloque jamais une séance.
}
process.exit(0);

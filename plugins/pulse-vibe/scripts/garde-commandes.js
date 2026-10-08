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

const path = require("path");
const { commandesSimples, optionsGlobalesGit, estOption, flagsCourts } = require("./lecture-commande");
const { estFichierEnv } = require("./motifs");

const DOSSIERS_RECONSTRUITS = new Set(["node_modules", ".next", "dist", "build", "coverage", ".turbo", ".vercel", "out", ".cache", ".svelte-kit", ".nuxt", ".output", "playwright-report", "test-results"]);

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
  controlesCoupes:
    "Pulse refuse de désactiver les contrôles avant commit (core.hooksPath, HUSKY=0…) : ils protègent vos secrets et la qualité du projet. " +
    "À la place : corriger ce que le contrôle signale, puis relancer la commande.",
  brancheDeplacee:
    "Pulse demande votre accord : cette commande déplace ou réécrit une branche ; les commits qu'elle seule contenait ne seront plus visibles. " +
    "Pour revenir en arrière sans rien perdre, préférez `/pulse:annuler`.",
  historiqueReecrit:
    "Pulse demande votre accord : cette commande réécrit l'historique du projet ou efface les moyens de récupérer un travail. " +
    "Elle sert rarement, par exemple pour retirer un secret de l'historique (`/pulse:secrets fuite` vous guide).",
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
  suppressionTotale:
    "Pulse refuse cette suppression : elle viserait tout le disque, votre dossier personnel ou tout le projet. " +
    "À la place : nommez précisément le dossier à supprimer (par exemple `rm -r dist`).",
  commandeMasquee:
    "Pulse demande votre accord : le nom de cette commande n'est connu qu'au moment de l'exécution, Pulse ne peut donc pas vérifier ce qu'elle fait. " +
    "Écrivez plutôt la commande en clair.",
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

// ---------------------------------------------------------------- Règles par commande

function aDejaUnCommit(cwd, prefixe) {
  try {
    execFileSync("git", [...prefixe, "rev-parse", "--verify", "-q", "HEAD"], { cwd, stdio: "ignore", timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
}

// Option longue, éventuellement abrégée comme Git l'accepte (--har pour --hard), d'au moins `min` caractères.
const longue = (o, nom, min = 4) => {
  const base = o.split("=")[0];
  return base.startsWith("--") && base.length >= min && nom.startsWith(base);
};
const COUPE_HOOKS = /^(HUSKY=0|HUSKY_SKIP_HOOKS=1|SKIP_SIMPLE_GIT_HOOKS=1|LEFTHOOK=0)$/;

function reglesGit(c, cwd, constats) {
  const { k, prefixe, configs } = optionsGlobalesGit(c.args);
  if (configs.some((v) => /^core\.hookspath=/i.test(v)) || c.affectations.some((a) => COUPE_HOOKS.test(a))) constats.push([REFUS, MESSAGES.controlesCoupes]);
  const sous = c.args[k];
  const reste = c.args.slice(k + 1);
  const options = reste.filter(estOption);
  const positions = reste.filter((m) => !estOption(m) && m !== "--");
  const court = (lettre) => options.some((o) => flagsCourts(o).includes(lettre));
  const aLongue = (nom, min) => options.some((o) => longue(o, nom, min));
  const noVerify = aLongue("--no-verify", 6);

  switch (sous) {
    case "push":
      if (aLongue("--force") || aLongue("--force-with-lease") || aLongue("--force-if-includes") || court("f") || positions.some((p) => p.startsWith("+")))
        constats.push([REFUS, MESSAGES.envoiForce]);
      if (noVerify) constats.push([REFUS, MESSAGES.noVerify]);
      if (aLongue("--delete") || options.includes("-d") || aLongue("--mirror") || positions.some((p) => p.startsWith(":") && p.length > 1))
        constats.push([ACCORD, MESSAGES.brancheDistante]);
      break;
    case "commit":
      if (noVerify || court("n")) constats.push([REFUS, MESSAGES.noVerify]);
      if ((aLongue("--all") || court("a")) && aDejaUnCommit(cwd, prefixe)) constats.push([REFUS, MESSAGES.indexationGlobale]);
      break;
    case "merge":
    case "rebase":
    case "am":
    case "cherry-pick":
    case "revert":
      if (noVerify) constats.push([REFUS, MESSAGES.noVerify]);
      break;
    case "add": {
      if (aLongue("--dry-run") || court("n")) break;
      const normalise = (p) => path.posix.normalize(p.replace(/\\/g, "/").replace(/\/+$/, "") || "/");
      const globale =
        c.viaXargs ||
        options.some((o) => ["-A", "-u", "--no-ignore-removal"].includes(o) || longue(o, "--all") || longue(o, "--update") || /^-[a-zA-Z]*[Au][a-zA-Z]*$/.test(o)) ||
        positions.some((p) => [":/", ":(top)", ":/*"].includes(p) || normalise(p) === "." || /[*?]/.test(p) || p.startsWith("$(") || p.startsWith("`"));
      if (globale && aDejaUnCommit(cwd, prefixe)) constats.push([REFUS, MESSAGES.indexationGlobale]);
      break;
    }
    case "reset":
      if (aLongue("--hard")) constats.push([ACCORD, MESSAGES.travailJete]);
      break;
    case "checkout": {
      const AVEC_VALEUR = new Set(["-b", "-B", "--orphan", "--conflict"]);
      const cibles = [];
      for (let j = 0; j < reste.length; j++) {
        if (AVEC_VALEUR.has(reste[j]) || /^-[a-zA-Z]*[bB]$/.test(reste[j])) j++;
        else if (!estOption(reste[j]) && reste[j] !== "--") cibles.push(reste[j]);
      }
      if (reste.includes("--") || cibles.includes(".") || cibles.length >= 2 || court("f") || aLongue("--force")) constats.push([ACCORD, MESSAGES.travailJete]);
      break;
    }
    case "switch":
      if (court("f") || aLongue("--force") || aLongue("--discard-changes", 5)) constats.push([ACCORD, MESSAGES.travailJete]);
      if (court("C") || aLongue("--force-create", 9)) constats.push([ACCORD, MESSAGES.brancheDeplacee]);
      break;
    case "restore": {
      const worktree = options.includes("--worktree") || options.includes("-W") || !(options.includes("--staged") || options.includes("-S"));
      if (worktree && positions.length) constats.push([ACCORD, MESSAGES.travailJete]);
      break;
    }
    case "clean":
      if (aLongue("--force") || court("f")) constats.push([ACCORD, MESSAGES.travailJete]);
      break;
    case "stash":
      if (positions[0] === "drop" || positions[0] === "clear") constats.push([ACCORD, MESSAGES.travailJete]);
      break;
    case "branch":
      if (court("D") || ((aLongue("--delete") || court("d")) && (aLongue("--force") || court("f")))) constats.push([ACCORD, MESSAGES.brancheForcee]);
      // -M (renommer en écrasant) reste libre : /pulse:deploy l'emploie pour renommer master en main.
      else if (court("f") || aLongue("--force") || court("C")) constats.push([ACCORD, MESSAGES.brancheDeplacee]);
      break;
    case "update-ref":
      constats.push([ACCORD, MESSAGES.brancheDeplacee]);
      break;
    case "filter-branch":
    case "filter-repo":
      constats.push([ACCORD, MESSAGES.historiqueReecrit]);
      break;
    case "reflog":
      if (positions[0] === "expire" || positions[0] === "delete") constats.push([ACCORD, MESSAGES.historiqueReecrit]);
      break;
    case "gc":
      if (options.some((o) => /^--prune=(now|all)$/.test(o))) constats.push([ACCORD, MESSAGES.historiqueReecrit]);
      break;
    case "show":
    case "cat-file":
      if (positions.some((p) => p.includes(":") && estFichierEnv(p.slice(p.indexOf(":") + 1)))) constats.push([REFUS, MESSAGES.lectureEnv]);
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

const CIBLES_TOTALES = /^(\/|\/\*|~|~\/|~\/\*|\$HOME|\$\{HOME\}|\$HOME\/\*|\.|\.\/|\.\.|\.\.\/|\*|\.\/\*|[A-Za-z]:[\/]?|[A-Za-z]:[\/]\*|%USERPROFILE%|\$env:USERPROFILE)$/i;
const COMMANDES_SUPPRESSION = new Set(["rm", "remove-item", "ri", "del", "erase", "rd", "rmdir", "unlink"]);
const estRecursif = (a) => a === "--recursive" || (/^-[a-zA-Z]{1,4}$/.test(a) && /[rR]/.test(a)) || /^-r(e(c(u(r(s(e)?)?)?)?)?)?$/i.test(a) || /^\/s$/i.test(a);

function suppressionRecursive(cibles, constats) {
  if (cibles.some((c) => CIBLES_TOTALES.test(c))) return constats.push([REFUS, MESSAGES.suppressionTotale]);
  const aRisque = cibles.filter((c) => !DOSSIERS_RECONSTRUITS.has(c.replace(/[\\/]+$/, "").split(/[\\/]/).pop()));
  if (aRisque.length) constats.push([ACCORD, MESSAGES.suppression]);
}

function reglesSuppression(c, constats) {
  const cibles = c.args.filter((a) => !estOption(a) && a !== "--" && !/^\/[a-zA-Z]$/.test(a));
  const recursif = c.args.some(estRecursif);
  const motif = cibles.some((a) => /[*?]/.test(a));
  if ((recursif || motif) && cibles.some((a) => CIBLES_TOTALES.test(a))) constats.push([REFUS, MESSAGES.suppressionTotale]);
  else if (c.viaFind || c.viaXargs || (c.apresTube && !cibles.length)) constats.push([ACCORD, MESSAGES.suppression]);
  else if (recursif || motif) suppressionRecursive(cibles, constats);
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

// ---------------------------------------------------------------- Analyse

function appliquerRegles(c, cwd, constats) {
  const { cmd, args } = c;
  if (c.dialecte !== "powershell" && c.brut.startsWith("$")) constats.push([ACCORD, MESSAGES.commandeMasquee]);
  if (COMMANDES_SUPPRESSION.has(cmd)) reglesSuppression(c, constats);
  if (c.code !== undefined && /\b(rmSync|rmdirSync|unlinkSync|rimraf|rmtree|remove_tree|rm_rf|os\.remove|os\.unlink|unlink|rmdir)\b/.test(c.code))
    constats.push([ACCORD, MESSAGES.suppression]);
  if (LECTEURS.has(cmd) && args.some((a) => !estOption(a) && estFichierEnv(a))) constats.push([REFUS, MESSAGES.lectureEnv]);

  switch (cmd) {
    case "git":
      reglesGit(c, cwd, constats);
      break;
    case "npm":
    case "pnpm":
    case "yarn":
    case "bun":
      // Script du projet qui écrase la base (pnpm db:push, npm run db:reset…).
      if (args.some((w) => /^db:(push|reset|drop)\b/.test(w))) constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      break;
    case "rimraf":
      suppressionRecursive(args.filter((a) => !estOption(a)), constats);
      break;
    case "find":
      if (args.includes("-delete")) constats.push([ACCORD, MESSAGES.suppression]);
      break;
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
      for (const e of c.entrees) reglesSql(e, constats);
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

function analyser(commande, cwd, dialecte) {
  const constats = [];
  for (const c of commandesSimples(commande, dialecte)) appliquerRegles(c, cwd, constats);
  // Contrôles coupés par une variable posée avant la commande (export HUSKY=0 ; $env:HUSKY = 0).
  const coupe = /(^|[\s;&|(])(export\s+|\$env:)(HUSKY\s*=\s*['"]?0|HUSKY_SKIP_HOOKS\s*=\s*['"]?1|SKIP_SIMPLE_GIT_HOOKS\s*=\s*['"]?1|LEFTHOOK\s*=\s*['"]?0)\b/i;
  if (coupe.test(commande.replace(/(?<!=)('[^']*'|"(?:[^"\\]|\\.)*")/g, "")) && commandesSimples(commande, dialecte).some((c) => c.cmd === "git")) constats.push([REFUS, MESSAGES.controlesCoupes]);
  return constats;
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

  const dialecte = entree.tool_name === "PowerShell" ? "powershell" : "bash";
  const constats = analyser(entree.tool_input.command, cwd, dialecte);
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

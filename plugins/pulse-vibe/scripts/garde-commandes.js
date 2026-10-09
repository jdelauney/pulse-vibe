#!/usr/bin/env node
// Pulse – garde-fou des commandes (hook PreToolUse sur Bash et PowerShell, appelé par garde.js ; se lance aussi seul).
//
// Une règle écrite influence ; un hook empêche. Ce garde-fou agit aussi en mode « bypass »,
// où les demandes d'autorisation de Claude Code ne s'affichent plus.
//
// Refuse (avec l'alternative) :
//  - un envoi forcé (git push --force, -f, --force-with-lease, +branche, formes abrégées comprises) ;
//  - le contournement d'un contrôle (--no-verify, git commit -n, -c core.hooksPath, HUSKY=0, GIT_CONFIG_…, -c alias.…) ;
//  - l'indexation globale (git add -A / . / -u / motifs / xargs, git commit -a) dans un dépôt qui a déjà un commit ;
//  - toute commande qui désigne un fichier .env (argument, valeur d'option, @fichier, HEAD:.env, motif qui le couvre),
//    sauf celles qui le nomment sans le lire (git add/rm --cached/check-ignore, echo, touch, code, pulse-aidd…) ;
//  - git grep / git diff avec --no-index, --untracked ou --no-exclude-standard dans un dossier qui contient un .env ;
//  - la suppression de tout le disque, du dossier personnel ou du projet ;
//  - la suppression d'un dépôt distant, ou son passage en public (gh repo, gh api private=false) ;
//  - gitleaks sans --redact.
// Demande confirmation pour :
//  - ce qui jette ou déplace du travail (reset --hard, checkout/restore/switch -f, clean -f, stash drop,
//    branch -D / -f, update-ref, filter-branch, reflog expire, gc --prune=now) ;
//  - git config au-delà de user.name / user.email ;
//  - une suppression récursive ou par motif (rm, git rm -rf, Remove-Item, rd /s, del /s, rsync --delete, shred,
//    find -exec rm, xargs rm, code), ou d'un fichier .env ;
//  - une commande calculée ($x, $(…), & $x), un tube vers un shell (| sh, | iex), un alias ;
//  - une commande de base de données qui écrase ou supprime (drizzle-kit push, db:push, prisma db push, pg_restore,
//    supabase db reset, DROP / TRUNCATE / DELETE sans WHERE par -c, --command=, -f, <, un tube ou du code, neonctl delete) ;
//  - une mise en production directe, un envoi vers main ou master quand le site est publié depuis ce dépôt
//    (--all, refspec à motif ou calculé compris), une variable changée chez l'hébergeur, vercel … rm,
//    un secret envoyé par pulse-aidd secrets (ou par l'appel direct de scripts/secrets.js), une fusion,
//    une suppression, une archive ou un secret changé par gh ;
//  - une écriture dans un .env existant, le remplacement de .env.local (vercel env pull) ;
//  - une modification du contrôle avant commit (.git/hooks, scripts/verifier.js) ;
//  - la modification (git commit --amend) d'un commit déjà envoyé.
//
// La commande est lue par lecture-commande.js (bash, PowerShell, cmd ; lanceurs dépliés).
// Un texte cité (message de commit, echo, heredoc écrit dans un fichier) ne déclenche rien.
//
// Fail-open : en cas d'erreur du garde-fou, la commande passe.
// Désactivation : PULSE_GARDE_COMMANDES_OFF=1 dans l'environnement où Claude Code est lancé
// (jamais dans la commande elle-même).
"use strict";

const fs = require("fs");
const { execFileSync } = require("child_process");

const path = require("path");
const { commandesSimples, decouper, nomCommande, optionsGlobalesGit, estOption, flagsCourts } = require("./lecture-commande");
const { estFichierEnv } = require("./motifs");
const { designeEnv, contientEnv, envDuDossier, motifVersRegex, NOMS_ENV_COURANTS, estControleAvantCommit, MESSAGE_CONTROLE } = require("./chemins-sensibles");

const DOSSIERS_RECONSTRUITS = new Set(["node_modules", ".next", "dist", "build", "coverage", ".turbo", ".vercel", "out", ".cache", ".svelte-kit", ".nuxt", ".output", "playwright-report", "test-results"]);

// ---------------------------------------------------------------- Constats

const REFUS = "deny";
const ACCORD = "ask";

const MESSAGES = {
  amendEnvoye:
    "Pulse demande votre accord : ce commit a déjà été envoyé sur le dépôt distant ; le modifier obligerait ensuite à un envoi forcé, que Pulse refuse. " +
    "À la place : faites un nouveau commit avec la correction.",
  envoiProduction:
    "Pulse demande votre accord : envoyer sur la branche principale met le site en ligne (déploiement continu). " +
    "Vérifiez que cette version a été testée, ou passez par une demande de fusion (`/pulse:pr`).",
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
  aliasGit:
    "Pulse refuse un alias Git défini dans la commande (-c alias.…) : il cache la vraie commande. " +
    "À la place : écrivez la commande Git en clair.",
  configMasquee:
    "Pulse refuse de changer la configuration de Git par des variables d'environnement (GIT_CONFIG_…) : elles peuvent couper les contrôles sans le montrer. " +
    "À la place : lancez la commande Git sans ces variables.",
  scriptInconnu:
    "Pulse demande votre accord : cette commande fait exécuter par un shell un texte que Pulse ne voit pas (tube vers sh, bash, pwsh ou Invoke-Expression). " +
    "Écrivez plutôt la commande en clair.",
  suppressionEnv:
    "Pulse demande votre accord : cette commande supprime un fichier .env ; ses secrets ne sont enregistrés nulle part ailleurs. " +
    "Pour retirer .env de Git en le gardant sur le poste : `git rm --cached .env`.",
  depotModifie: "Pulse demande votre accord : cette commande archive, renomme ou transfère le dépôt sur son site ; les liens et les envois en cours peuvent cesser de fonctionner.",
  secretsDepot:
    "Pulse demande votre accord : cette commande crée, change ou supprime un secret du dépôt, utilisé par les vérifications automatiques (CI). " +
    "La valeur reste hors de la conversation : la personne la saisit elle-même sur le site du dépôt.",
  gitleaksSansMasque:
    "Pulse refuse gitleaks sans --redact : les secrets trouvés s'afficheraient en clair dans la conversation. " +
    "À la place : `gitleaks detect --config .gitleaks.toml --redact`.",
  sondeDetournee:
    "Pulse demande votre accord : cette commande change l'adresse à laquelle les tests de secrets envoient une clé (PULSE_SONDES_…). " +
    "Lancez plutôt la commande sans cette variable.",
  baseDeDonnees:
    "Pulse demande votre accord : cette commande peut écraser ou supprimer des données de la base, qui est peut-être celle du site en ligne. " +
    "Préférez une migration relue et testée en local.",
  production:
    "Pulse demande votre accord : cette commande publie ou modifie directement le site en ligne. " +
    "D'habitude, la mise en ligne passe par `git push` (le déploiement continu publie la nouvelle version).",
  depotSupprime:
    "Pulse refuse la suppression d'un dépôt distant depuis la conversation : elle est définitive. " +
    "Si vous le voulez vraiment, faites-le vous-même sur le site du dépôt (Settings, puis Danger Zone).",
  depotPublic:
    "Pulse refuse de rendre un dépôt public depuis la conversation : tout son historique, secrets compris, deviendrait lisible par tous, sans retour possible. " +
    "À la place : créez ou gardez le dépôt privé (`--private`). Pour le publier plus tard, vérifiez d'abord l'historique avec `/pulse:security`, puis changez la visibilité vous-même sur le site du dépôt.",
  apiSuppression: "Pulse demande votre accord : cette commande supprime quelque chose sur le site du dépôt.",
  apiModification:
    "Pulse demande votre accord : cette commande modifie le dépôt sur son site avec un contenu que Pulse ne voit pas (--input). " +
    "Écrivez plutôt chaque champ en clair avec -f, par exemple `gh api -X PATCH repos/<propriétaire>/<dépôt> -f description=…`.",
  variablesHebergeur:
    "Pulse demande votre accord : cette commande change une variable chez l'hébergeur ; le site en ligne l'utilisera au prochain déploiement. " +
    "Préférez `/pulse:secrets`, qui ne montre jamais la valeur.",
  secretsHebergeur: "Pulse demande votre accord : cette commande crée, envoie ou retire un secret chez l'hébergeur, ou redéploie le site en ligne.",
  deconnexion: "Pulse demande votre accord : cette commande supprime l'accès Search Console enregistré sur ce poste.",
  fusion: "Pulse demande votre accord : cette commande fusionne une demande de fusion. D'habitude, la fusion se fait par vous, sur le site du dépôt.",
  lectureEnv:
    "Pulse garde le contenu des fichiers .env hors de la conversation : ils contiennent les secrets du projet. " +
    "À la place : `pulse-aidd secrets inventaire` liste les variables (noms, présence, sans aucune valeur) ; `.env.example` donne les noms attendus.",
  rechercheEnv:
    "Pulse refuse cette recherche : elle parcourt aussi les fichiers .env, et leurs secrets entreraient dans la conversation. " +
    "À la place : ajoutez `--exclude='.env*'` (grep), ou utilisez l'outil de recherche de Claude Code, qui ignore les fichiers du .gitignore.",
  gitHorsDepot:
    "Pulse refuse cette recherche : avec --no-index, --untracked ou --no-exclude-standard, Git lit aussi les fichiers ignorés, dont .env et ses secrets. " +
    "À la place : la même commande sans ces options (Git lit alors les seuls fichiers suivis), ou `pulse-aidd secrets inventaire` pour les noms des variables.",
  envDansVariable:
    "Pulse demande votre accord : cette commande range le nom d'un fichier .env dans une variable, Pulse ne peut donc pas suivre ce qu'elle en fait. " +
    "Pour connaître les variables du projet : `pulse-aidd secrets inventaire` (noms et présence, sans valeur).",
  envModifie:
    "Pulse demande votre accord : cette commande modifie ou remplace un fichier .env existant ; ses secrets ne sont enregistrés nulle part ailleurs. " +
    "D'habitude, la personne modifie .env elle-même dans son éditeur, ou `pulse-aidd secrets preparer <NOM>` ajoute la ligne à remplir.",
  envEcrase:
    "Pulse demande votre accord : cette commande remplace le fichier .env.local par les variables de l'hébergeur ; les valeurs locales seraient perdues. " +
    "Les valeurs restent hors de la conversation.",
};

// Commandes qui copient ou déplacent un fichier : la dernière position est la destination.
const COPIEURS = new Set(["cp", "scp", "rsync", "copy", "copy-item", "cpi", "xcopy", "robocopy", "mv", "move", "move-item", "mi"]);
// Commandes qui nomment un .env sans en montrer le contenu : vérifier, lister, créer, ouvrir pour la personne, écrire du texte.
const SANS_LECTURE = new Set(["test", "[", "stat", "touch", "chmod", "icacls", "code", "cursor", "notepad", "open", "xdg-open", "start", "invoke-item", "ii", "test-path", "new-item", "ni", "echo", "printf", "write-output", "write-host", "add-content", "ac", "set-content", "sc", "out-file", "tee", "pulse-aidd", "pulse-pile-next", "ls", "dir", "get-childitem", "gci", "basename", "dirname", "realpath", "where-object", "where", "?"]);
// Sous-commandes Git qui nomment un .env sans l'afficher (le garde-fou anti-secrets contrôle add et commit).
const GIT_SANS_LECTURE = new Set(["add", "stage", "commit", "check-ignore", "check-attr", "ls-files", "status", "rm", "restore", "reset", "update-index"]);
// Recherche : le premier mot libre est le motif cherché, pas un fichier (sauf -e, -f ou -Pattern).
const CHERCHEURS = new Set(["grep", "egrep", "fgrep", "rg", "select-string", "sls", "findstr"]);
const CMDLETS_RECHERCHE = new Set(["select-string", "sls", "findstr"]);
const GESTIONNAIRES = new Set(["npm", "pnpm", "yarn", "bun"]);
// Outils qui chargent .env d'eux-mêmes.
const CHARGEURS_ENV = new Set(["dotenv", "dotenv-cli", "dotenvx", "env-cmd"]);
// Écriture PowerShell : le fichier visé est la valeur de -Path (ou le premier mot libre).
const ECRIVAINS_PS = new Set(["add-content", "ac", "set-content", "sc", "out-file", "clear-content", "clc"]);
// PowerShell : une liste de fichiers passée par un tube est lue par la commande suivante (Get-ChildItem .env | Get-Content),
// sauf par celles qui montrent seulement les noms et les propriétés.
const LISTEURS_PS = new Set(["ls", "dir", "get-childitem", "gci"]);
const SANS_CONTENU_PS = new Set(["select-object", "select", "measure-object", "measure", "format-table", "ft", "format-list", "fl", "format-wide", "fw", "sort-object", "sort", "out-null", "group-object", "group", "where-object", "where", "?", "foreach-object", "foreach", "%"]);
// Bloc { } après le tube : sûr seulement s'il lit des propriétés ($_.Name), compare, calcule, filtre, trie ou affiche.
const SURES_BLOC_PS = new Set(["where-object", "where", "?", "select-object", "select", "sort-object", "sort", "write-output", "write-host", "echo", "format-table", "ft", "format-list", "fl", "format-wide", "fw", "measure-object", "measure", "out-null", "group-object", "group", "get-date", "join-path", "split-path", "test-path", "resolve-path", "foreach-object", "foreach", "%"]);
// Méthodes qui ouvrent, lisent, copient ou lancent quelque chose : un bloc qui les appelle compte comme une lecture.
const METHODES_LECTURE_PS = /^(read\w*|open\w*|load\w*|import\w*|copyto|moveto|invoke\w*|create\w*|execute\w*|start|upload\w*|download\w*|send\w*|getresponse\w*|getrequeststream|decrypt|appendtext)$/i;
// Types dont les méthodes statiques ([math]::Round) calculent sans rien lire ; tout autre type ([IO.File]::ReadLines) compte comme une lecture.
const TYPES_SURS_PS = /^(system\.)?(math|string|char|int|int16|int32|int64|long|uint32|uint64|double|single|float|decimal|byte|bool|boolean|datetime|timespan|guid|convert|text\.regularexpressions\.regex|regex|io\.path)$/i;

/** Le texte PowerShell, chaque texte entre guillemets remplacé par une variable « $0 » (même longueur) ; un texte "…" qui contient $( ) est gardé, car il lance du code. */
function masquerTextesPs(texte) {
  return texte.replace(/'(?:[^']|'')*'|"(?:[^"`]|`.)*"/gs, (t) => (t.startsWith('"') && t.includes("$(") ? t : "$0".padEnd(t.length)));
}

/** Les textes des blocs { } d'un texte PowerShell (blocs imbriqués compris dans leur bloc parent) ; dans un texte masqué, les accolades entre guillemets ne comptent pas. */
function blocsPs(masque) {
  const blocs = [];
  for (let i = 0; i < masque.length; i++) {
    if (masque[i] !== "{") continue;
    let profondeur = 0;
    let j = i;
    for (; j < masque.length; j++) {
      if (masque[j] === "{") profondeur++;
      else if (masque[j] === "}" && --profondeur === 0) break;
    }
    blocs.push(masque.slice(i + 1, j));
    i = j;
  }
  return blocs;
}

/** Le texte, chaque bloc { } (repéré dans sa version masquée, de même longueur) remplacé par des espaces. */
function sansBlocsPs(texte, masque) {
  let resultat = texte;
  let i = 0;
  for (const bloc of blocsPs(masque)) {
    const debut = masque.indexOf("{" + bloc, i);
    const fin = debut + bloc.length + 2;
    resultat = resultat.slice(0, debut) + " ".repeat(Math.min(fin, texte.length) - debut) + resultat.slice(fin);
    i = fin;
  }
  return resultat;
}

/** Fin du tube qui commence à `debut` dans un texte PowerShell masqué : le premier « ; », retour à la ligne (hors suite après | ou `), && ou || de son niveau,
 *  ou la fin du bloc { } qui le contient (sauf si ce bloc est lui-même suivi d'un tube). Une parenthèse fermante ne l'arrête pas : sa valeur continue dans le tube. */
function finTubePs(masque, debut) {
  let profondeur = 0;
  for (let i = debut; i < masque.length; i++) {
    const ch = masque[i];
    if ("({[".includes(ch)) profondeur++;
    else if (")]".includes(ch)) profondeur--;
    else if (ch === "}" && --profondeur < 0 && !/^\s*\|(?!\|)/.test(masque.slice(i + 1))) return i;
    else if (profondeur <= 0 && (ch === ";" || (ch === "\n" && !/[|`]\s*$/.test(masque.slice(debut, i))) || masque.startsWith("&&", i) || masque.startsWith("||", i))) return i;
  }
  return masque.length;
}

/** Vrai si le bloc (texte masqué) ne fait que lire des propriétés, comparer, calculer, filtrer, trier ou afficher. */
function blocSur(texte) {
  for (const m of texte.matchAll(/(::|\.)\s*([A-Za-z_]\w*)\s*\(/g)) {
    if (m[1] === "::") {
      const type = /\[\s*([\w.]+)\s*\]\s*$/.exec(texte.slice(0, m.index));
      if (!type || !TYPES_SURS_PS.test(type[1])) return false;
    } else if (METHODES_LECTURE_PS.test(m[2])) return false;
  }
  // Appel d'une commande par son nom (& $c, . $c) : elle peut lire.
  if (/(^|[;{(|=\n])\s*(&(?!&)|\.\s)/.test(texte)) return false;
  return instructionsSures(texte);
}

// Mots qui ouvrent une instruction PowerShell sans être une commande.
const MOTS_CLES_PS = /^(if|elseif|else|while|until|do|for|foreach|switch|default|try|catch|finally|return|throw|exit|break|continue|in|\{|\})$/i;

/** Vrai si chaque instruction du texte (sous-expressions $( ) comprises) est une affectation, une expression ($_.Name, -not …, + …, [type], nombre)
 *  ou une commande de SURES_BLOC_PS. Le premier mot est jugé tel qu'il est écrit : bash -c, iex, cmd /c comptent comme des commandes inconnues. */
function instructionsSures(texte) {
  const { segments, sousScripts } = decouper(texte, "powershell");
  const segmentSur = ({ mots }) => {
    const m = mots.slice();
    for (let tour = 0; tour < 12 && m.length; tour++) {
      if (MOTS_CLES_PS.test(m[0])) m.shift();
      // $x = …, $x += …, [int]$x = … : la valeur affectée est jugée comme une instruction.
      else if (/^(\[[^\]]*\])*\$\S*$/.test(m[0]) && /^([-+*/%]|\?\?)?=$/.test(m[1] || "")) m.splice(0, 2);
      else {
        // Formes collées : $x=gc, n=valeur (table @{ }).
        const colle = /^(?:(?:\[[^\]]*\])*\$[^=\s]*?|[A-Za-z_]\w*)(?:[-+*/%]|\?\?)?=(?!=)(.*)$/s.exec(m[0]);
        if (!colle) break;
        if (colle[1]) m[0] = colle[1];
        else m.shift();
      }
    }
    // Un nom de commande commence par une lettre, ou par . \ / ~ pour un chemin ; « .AddDays » suit une parenthèse : c'est une méthode.
    return !m.length || /^(\d|[^\p{L}\d_.\\/~&]|\.[\p{L}_])/u.test(m[0]) || SURES_BLOC_PS.has(nomCommande(m[0]));
  };
  return segments.every(segmentSur) && sousScripts.every(instructionsSures);
}
// PowerShell : commandes qui produisent un nom de fichier (lu ensuite s'il est passé entre parenthèses à une autre commande).
const PRODUCTEURS_PS = new Set(["echo", "write-output", "printf", "ls", "dir", "get-childitem", "gci", "realpath", "basename", "dirname"]);
// find sans action qui lance une commande : il affiche seulement des noms.
const ACTIONS_FIND = new Set(["-exec", "-execdir", "-ok", "-okdir"]);
// git log : options qui affichent le contenu des fichiers (différences).
const logAvecContenu = (o) => /^-[a-zA-Z0-9]*[puc]/.test(o) || o.startsWith("-L") || /^--(patch|word-diff|color-words|cc$|dd$|remerge-diff|function-context)/.test(o);
const TEXTES_CITES = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

/** Les mots d'une commande qui peuvent désigner un fichier lu : sans valeur d'exclusion, sans le motif cherché, sans la destination d'une copie. */
function motsLus(c) {
  const git = c.cmd === "git" ? optionsGlobalesGit(c.args) : null;
  const args = git ? c.args.slice(git.k + 1) : c.args;
  const mots = [];
  for (let j = 0; j < args.length; j++) {
    const a = args[j];
    // La valeur de -e, --regexp ou -Pattern est le motif cherché, pas un fichier.
    if (/^(-e|--regexp|-pattern)$/i.test(a) && (CHERCHEURS.has(c.cmd) || (git && c.args[git.k] === "grep"))) {
      mots.push(a);
      j++;
      continue;
    }
    if (/^(--exclude|--exclude-dir|--exclude-from|--ignore-file|-exclude)$/i.test(a)) {
      j++;
      continue;
    }
    if (/^--(exclude|exclude-dir|exclude-from|ignore-file)=/i.test(a)) continue;
    if (/^(-g|--glob|--iglob)$/.test(a) && /^!/.test(args[j + 1] || "")) {
      j++;
      continue;
    }
    if (/^--(glob|iglob)=!/.test(a) || /^(!|:!|:\^|:\(exclude\))/.test(a)) continue;
    mots.push(a);
  }
  const chercheur = CHERCHEURS.has(c.cmd) || (git && c.args[git.k] === "grep");
  if (chercheur && !motifParOption(c.cmd, mots)) {
    // La valeur de -Path ou -LiteralPath (Select-String) est un fichier lu, jamais le motif.
    const motif = mots.findIndex((a, i) => !estOption(a) && !(i > 0 && /^-(path|literalpath)$/i.test(mots[i - 1])));
    if (motif >= 0) mots.splice(motif, 1);
  }
  if (COPIEURS.has(c.cmd)) {
    const destination = destinationCopie(mots);
    if (destination) mots.splice(destination.index, 1);
  }
  return mots;
}

/** Motif donné par une option : -e, -f, --regexp, -Pattern, -Pattern:x, ou collé (-eKEY, -e.) pour grep, rg et git grep. */
const motifParOption = (cmd, mots) =>
  mots.some((a) => /^(-e|-f|--regexp|--file)$/.test(a) || /^--(regexp|file)=/.test(a) || /^-pattern(:|$)/i.test(a) || (!CMDLETS_RECHERCHE.has(cmd) && /^-[a-zA-Z]*[ef]./.test(a)));

/** Destination d'une copie ou d'un déplacement : valeur de -Destination, -t ou --target-directory, sinon la dernière position. */
function destinationCopie(args) {
  for (let j = 0; j < args.length; j++) {
    if (/^(-destination|-t|--target-directory)$/i.test(args[j])) return args[j + 1] === undefined ? null : { valeur: args[j + 1], index: j + 1 };
    const collee = /^(?:--target-directory=|-destination:)(.*)$/i.exec(args[j]);
    if (collee) return { valeur: collee[1], index: j };
  }
  const positions = args.map((a, j) => [a, j]).filter(([a]) => !estOption(a));
  return positions.length >= 2 ? { valeur: positions[positions.length - 1][0], index: positions[positions.length - 1][1] } : null;
}

/** Valeurs des options nommées (-F x, -Fx, --file=x, --file x). */
function valeursOption(args, noms) {
  const valeurs = [];
  for (let j = 0; j < args.length; j++) {
    const a = args[j];
    for (const n of noms) {
      if (a === n) valeurs.push(args[j + 1] || "");
      else if (n.startsWith("--") && a.startsWith(n + "=")) valeurs.push(a.slice(n.length + 1));
      else if (/^-[a-zA-Z]$/.test(n) && a.startsWith(n) && a.length > 2) valeurs.push(a.slice(2));
    }
  }
  return valeurs;
}

/** Options qui lisent un fichier et peuvent en afficher le contenu (message de commit, liste de chemins dans une erreur). */
function optionLitEnv(c, cwd) {
  const designe = (v) => designeEnv(v, cwd, c.dialecte);
  if (c.cmd === "git") {
    const { k } = optionsGlobalesGit(c.args);
    const sous = c.args[k];
    const noms = ["-F", "--file", "--pathspec-from-file", ...(["commit", "tag", "merge"].includes(sous) ? ["-t", "--template"] : [])];
    return valeursOption(c.args.slice(k + 1), noms).some(designe);
  }
  if (c.cmd === "find") return valeursOption(c.args, ["-files0-from"]).some(designe);
  return false;
}

/**
 * Vrai si une commande qui liste des fichiers (ls, dir, Get-ChildItem, find) en sort un .env :
 * il est nommé, ou il se trouve dans le dossier listé (fichiers cachés montrés, ou PowerShell), ou plus bas si la liste descend.
 */
function listeurCouvreEnv(c, cwd) {
  const mots = motsLus(c);
  if (c.cmd === "find") {
    const racines = [];
    for (const a of c.args) {
      if (/^[-(!]/.test(a)) break;
      racines.push(a);
    }
    if (!(racines.length ? racines : ["."]).some((d) => contientEnv(path.resolve(cwd, d)))) return false;
    const noms = [];
    const exclus = [];
    c.args.forEach((a, j) => {
      if (/^-i?name$/.test(a) && c.args[j + 1] !== undefined) (["!", "-not"].includes(c.args[j - 1]) ? exclus : noms).push(c.args[j + 1]);
    });
    const couvre = (n) => [...NOMS_ENV_COURANTS, ...envDuDossier(cwd)].some((e) => motifVersRegex(n).test(e));
    return noms.length ? noms.some(couvre) : !exclus.some(couvre);
  }
  if (mots.some((a) => designeEnv(a, cwd, c.dialecte))) return true;
  const libres = mots.filter((a) => !estOption(a));
  const dossiers = libres.length ? libres : ["."];
  const recursif = c.args.some((a) => /^-r(ecurse)?$/i.test(a) || /^-[a-zA-Z]*R/.test(a) || a === "--recursive");
  const caches = c.dialecte !== "bash" || c.args.some((a) => /^-[a-zA-Z]*[aA]/.test(a) || a === "--all" || a === "--almost-all");
  if (!caches) return false;
  return dossiers.some((d) => (recursif ? contientEnv(path.resolve(cwd, d)) : envDuDossier(path.resolve(cwd, d)).length > 0));
}

/** Vrai si la commande lit un .env : redirection d'entrée, chargeur de .env, ou un mot (la commande elle-même comprise) qui le désigne. */
function litEnv(c, cwd) {
  // PowerShell : Where-Object Name -like '.env*' ou { $_.Name -like ".env*" } compare des noms sans rien lire.
  if (c.dialecte === "powershell" && /^\$[\w.]+$/.test(c.brut) && c.args.length && /^-(i|c)?(like|notlike|match|notmatch|eq|ne)$/i.test(c.args[0])) return false;
  if (c.lectures.some((f) => designeEnv(f, cwd, c.dialecte))) return true;
  if (optionLitEnv(c, cwd)) return true;
  if (c.cmd === "git") {
    const { k } = optionsGlobalesGit(c.args);
    if (GIT_SANS_LECTURE.has(c.args[k])) return false;
    if (c.args[k] === "log" && !c.args.slice(k + 1).some(logAvecContenu)) return false;
  }
  if (SANS_LECTURE.has(c.cmd) && !c.dansSubstitution) return false;
  if (c.cmd === "find" && !c.args.some((a) => ACTIONS_FIND.has(a))) return false;
  if (COMMANDES_SUPPRESSION.has(c.cmd) || c.cmd === "shred") return false; // suppression d'un .env : règle à part
  if (c.cmd === "vercel" && c.args[0] === "env" && c.args[1] === "pull") return false; // remplacement de .env.local : règle à part
  if (CHARGEURS_ENV.has(c.cmd) || (c.cmd === "node" && c.args.some((a) => /^dotenv\/config/.test(a)))) return true;
  // npm, pnpm, yarn, bun : la commande qu'ils lancent (pnpm dlx vercel env pull .env.local) est lue à part ; seules leurs options comptent ici.
  const mots = GESTIONNAIRES.has(c.cmd) ? motsLus(c).filter(estOption) : motsLus(c);
  return [c.brut, ...mots].some((a) => designeEnv(a, cwd, c.dialecte));
}

/** Vrai si la commande écrit dans un .env qui existe déjà (redirection, tee, Set-Content, copie ou déplacement vers lui). */
function ecritEnvExistant(c, cwd) {
  const existe = (f) => {
    try {
      return fs.statSync(path.resolve(cwd, f)).isFile();
    } catch (e) {
      return false;
    }
  };
  const positions = c.args.filter((a) => !estOption(a));
  const cibles = [...(c.ecritures || [])];
  if (c.cmd === "tee") cibles.push(...positions);
  if (ECRIVAINS_PS.has(c.cmd)) {
    const j = c.args.findIndex((a) => /^-(path|literalpath|filepath)$/i.test(a));
    cibles.push(j >= 0 ? c.args[j + 1] : positions[0]);
  }
  if (COPIEURS.has(c.cmd)) cibles.push((destinationCopie(c.args) || {}).valeur);
  return cibles.some((f) => f && estFichierEnv(f) && existe(f));
}

// Commandes qui modifient, déplacent ou suppriment le fichier qu'elles nomment.
const MODIFIEURS = new Set(["rm", "unlink", "shred", "chmod", "chown", "truncate", "ln", "remove-item", "ri", "del", "erase", "rename-item", "rni", "set-content", "sc", "add-content", "ac", "out-file", "clear-content", "clc", "tee", "curl", "wget", "invoke-webrequest", "iwr", "invoke-restmethod", "irm", "new-item", "ni"]);
// Commandes qui déplacent ou suppriment un dossier entier.
const DEPLACEURS_DOSSIER = new Set(["mv", "move", "move-item", "mi", "rename-item", "rni", "rm", "remove-item", "ri", "del", "erase", "rd", "rmdir"]);

/** Vrai si le chemin désigne le dossier scripts/ qui contient verifier.js (mv scripts scripts.old). */
function dossierDuControle(chemin, cwd) {
  const n = path.posix.normalize(String(chemin).replace(/\\/g, "/")).replace(/\/+$/, "");
  if (!/(^|\/)scripts$/i.test(n)) return false;
  try {
    return fs.statSync(path.resolve(cwd, n, "verifier.js")).isFile();
  } catch (e) {
    return false;
  }
}

/** Vrai si la commande modifie le contrôle des secrets avant commit (.git/hooks, .git/pulse, .git/config, scripts/verifier.js). */
function toucheControle(c, cwd) {
  if ((c.ecritures || []).some(estControleAvantCommit)) return true;
  const positions = c.args.filter((a) => !estOption(a));
  // git rm, git mv (sauf --cached, qui laisse le fichier en place).
  if (c.cmd === "git") {
    const { k } = optionsGlobalesGit(c.args);
    const reste = c.args.slice(k + 1);
    if (!["rm", "mv"].includes(c.args[k]) || reste.includes("--cached")) return false;
    return reste.filter((a) => !estOption(a)).some((a) => estControleAvantCommit(a) || dossierDuControle(a, cwd));
  }
  if (DEPLACEURS_DOSSIER.has(c.cmd) && positions.some((a) => dossierDuControle(a, cwd))) return true;
  if (COPIEURS.has(c.cmd)) {
    const deplace = ["mv", "move", "move-item", "mi"].includes(c.cmd);
    return (positions.length >= 2 && estControleAvantCommit(positions[positions.length - 1])) || (deplace && positions.some(estControleAvantCommit));
  }
  if ((c.cmd === "sed" || c.cmd === "perl") && c.args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith("--in-place"))) return positions.some(estControleAvantCommit);
  if (!MODIFIEURS.has(c.cmd)) return false;
  // curl -oscripts/verifier.js, wget -Oscripts/verifier.js : la destination collée à l'option.
  const colle = (a) => (c.cmd === "curl" || c.cmd === "wget") && /^-[a-zA-Z]*[oO]./.test(a) && estControleAvantCommit(a.slice(a.search(/[oO]/) + 1));
  return c.args.some((a) => estControleAvantCommit(a) || colle(a));
}

// ---------------------------------------------------------------- Règles par commande

function aDejaUnCommit(cwd, prefixe) {
  try {
    execFileSync("git", [...prefixe, "rev-parse", "--verify", "-q", "HEAD"], { cwd, stdio: "ignore", timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
}

const sortieGit = (args, cwd) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).trim();
  } catch (e) {
    return "";
  }
};
const BRANCHES_PRODUCTION = new Set(["main", "master"]);

// Site publié automatiquement depuis ce dépôt : adresse notée dans CLAUDE.md, ou configuration d'un hébergeur.
function hebergeurRelie(racine) {
  if (!racine) return false;
  try {
    if (/^- Site en ligne\s*:\s*[<*`]*https?:\/\//m.test(fs.readFileSync(path.join(racine, "CLAUDE.md"), "utf8"))) return true;
  } catch (e) {
    // pas de CLAUDE.md
  }
  return ["vercel.json", ".vercel/project.json", "netlify.toml", "wrangler.toml", "wrangler.jsonc", "fly.toml", "render.yaml"].some((f) => fs.existsSync(path.join(racine, f)));
}

// Vrai si l'envoi vise main ou master : destination écrite, branche courante, ou envoi de toutes les branches
// (--all, --mirror, --branches, push.default=matching|upstream, -c remote.<nom>.mirror|push), refspec à motif (*) ou calculé ($(…), $x).
function versProduction(positions, options, configs, cwd, prefixe) {
  if (options.some((o) => longue(o, "--all", 4) || longue(o, "--mirror", 4) || longue(o, "--branches", 5))) return true;
  if (configs.some((v) => /^push\.default=(matching|upstream|tracking)$/i.test(v) || /^remote\..+\.(mirror=true|push=)/i.test(v))) return true;
  const courante = () => sortieGit([...prefixe, "rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const refspecs = positions.slice(1); // positions[0] : le dépôt distant
  if (refspecs.some((r) => /[*$`]/.test(r))) return true;
  if (!refspecs.length) return BRANCHES_PRODUCTION.has(courante());
  return refspecs.some((r) => {
    // Destination : après « : », sans refs/heads/ ni heads/ ; « @ » vaut HEAD.
    const destination = r.replace(/^\+/, "").split(":").pop().replace(/^(refs\/)?heads\//, "");
    return BRANCHES_PRODUCTION.has(destination) || ((destination === "HEAD" || destination === "@") && BRANCHES_PRODUCTION.has(courante()));
  });
}

// Option longue, éventuellement abrégée comme Git l'accepte (--har pour --hard), d'au moins `min` caractères.
const longue = (o, nom, min = 4) => {
  const base = o.split("=")[0];
  return base.startsWith("--") && base.length >= min && nom.startsWith(base);
};
const COUPE_HOOKS = /^(HUSKY=0|HUSKY_SKIP_HOOKS=1|SKIP_SIMPLE_GIT_HOOKS=1|LEFTHOOK=0)$/;
// Configuration de Git par l'environnement : GIT_CONFIG_COUNT, _KEY_n, _VALUE_n, _PARAMETERS, et aussi GIT_CONFIG_GLOBAL ou GIT_CONFIG (un autre fichier de configuration).
const GIT_CONFIG_ENV = /^GIT_CONFIG(_\w+)?=/i;
// Commandes qui posent ou exportent une variable par son nom (export X, declare -x X=1, cmd : set X=1, setx X 1).
const POSEURS_VARIABLE = new Set(["export", "declare", "typeset", "local", "readonly", "set", "setx"]);

/** Vrai si la commande pose une variable d'environnement dont le nom répond à `nom` (texte cité compris : export "X=1", Set-Item 'env:X'). */
function poseVariable(c, nom) {
  if (c.affectations.some((a) => nom.test(a))) return true;
  if (POSEURS_VARIABLE.has(c.cmd) && c.args.some((a) => nom.test(a.replace(/^\/a\s*/i, "")))) return true;
  // PowerShell : $env:X = 1, ${env:X} = 1, Set-Item env:X, New-Item -Path Env: -Name X.
  const sansEnv = (m) => m.replace(/^\$?\{?env:\\?/i, "");
  if (/^\$\{?env:/i.test(c.brut) && nom.test(sansEnv(c.brut))) return true;
  if (c.args.some((a) => /^env:\\?./i.test(a) && nom.test(sansEnv(a)))) return true;
  return c.args.some((a) => /^env:\\?$/i.test(a)) && c.args.some((a) => nom.test(a));
}

function reglesGit(c, cwd, constats) {
  const { k, prefixe, configs } = optionsGlobalesGit(c.args);
  if (configs.some((v) => /^core\.hookspath=/i.test(v)) || c.affectations.some((a) => COUPE_HOOKS.test(a))) constats.push([REFUS, MESSAGES.controlesCoupes]);
  const sous = c.args[k];
  if (configs.some((v) => /^alias\./i.test(v))) constats.push([REFUS, MESSAGES.aliasGit]);
  if (c.affectations.some((a) => GIT_CONFIG_ENV.test(a))) constats.push([REFUS, MESSAGES.configMasquee]);
  // Sous-commande calculée : git $x, git $(…), git `…`, git @args (PowerShell).
  if (sous !== undefined && /^\$|^@\w|\$\(|`/.test(sous)) constats.push([ACCORD, MESSAGES.commandeMasquee]);
  const reste = c.args.slice(k + 1);
  const options = reste.filter(estOption);
  const positions = reste.filter((m) => !estOption(m) && m !== "--");
  const court = (lettre) => options.some((o) => flagsCourts(o).includes(lettre));
  const aLongue = (nom, min) => options.some((o) => longue(o, nom, min));
  const noVerify = aLongue("--no-verify", 6);
  // --config-env=<clé>=<variable> : la valeur vient de l'environnement, Pulse ne la voit pas.
  const configsEnv = valeursOption(c.args.slice(0, k), ["--config-env"]);

  // --output=<fichier> : git log, diff et show écrivent le résultat dans ce fichier.
  if (["log", "diff", "show", "format-patch"].includes(sous) && options.some((o) => /^--output(=|$)/.test(o))) constats.push([ACCORD, MESSAGES.commandeMasquee]);

  switch (sous) {
    case "push":
      if (aLongue("--force") || aLongue("--force-with-lease") || aLongue("--force-if-includes") || court("f") || positions.some((p) => p.startsWith("+")))
        constats.push([REFUS, MESSAGES.envoiForce]);
      if (noVerify) constats.push([REFUS, MESSAGES.noVerify]);
      if (aLongue("--delete") || options.includes("-d") || aLongue("--mirror") || configs.some((v) => /^remote\..+\.mirror=true$/i.test(v)) || positions.some((p) => p.startsWith(":") && p.length > 1))
        constats.push([ACCORD, MESSAGES.brancheDistante]);
      if (hebergeurRelie(sortieGit([...prefixe, "rev-parse", "--show-toplevel"], cwd)) && (versProduction(positions, options, configs, cwd, prefixe) || configsEnv.some((v) => /^(push|remote)\./i.test(v))))
        constats.push([ACCORD, MESSAGES.envoiProduction]);
      break;
    case "commit":
      if (noVerify || court("n")) constats.push([REFUS, MESSAGES.noVerify]);
      if ((aLongue("--all") || court("a")) && aDejaUnCommit(cwd, prefixe)) constats.push([REFUS, MESSAGES.indexationGlobale]);
      if (aLongue("--amend", 5) && sortieGit([...prefixe, "branch", "-r", "--contains", "HEAD"], cwd)) constats.push([ACCORD, MESSAGES.amendEnvoye]);
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
    case "grep":
    case "diff": {
      // --no-index, --untracked, --no-exclude-standard : Git lit aussi les fichiers ignorés, dont .env.
      const horsDepot = options.some((o) => o === "--no-index" || longue(o, "--untracked", 5) || longue(o, "--no-exclude-standard", 6));
      // -O<commande> / --open-files-in-pager : git grep lance la commande donnée.
      if (sous === "grep" && options.some((o) => /^(-[a-zA-Z]*O|--open-files-in-pager)/.test(o))) constats.push([ACCORD, MESSAGES.commandeMasquee]);
      if (!horsDepot) break;
      const tirets = reste.indexOf("--");
      const chemins = tirets >= 0 ? reste.slice(tirets + 1) : sous === "grep" && !options.some((o) => o === "-e" || o === "-f") ? positions.slice(1) : positions;
      if ((chemins.length ? chemins : ["."]).some((d) => contientEnv(path.resolve(cwd, d)))) constats.push([REFUS, MESSAGES.gitHorsDepot]);
      break;
    }
    case "worktree":
      if (positions[0] === "remove" && (options.includes("--force") || options.includes("-f"))) constats.push([ACCORD, MESSAGES.brancheForcee]);
      break;
    case "config":
      if (configEcrit(reste)) constats.push([ACCORD, reste.some((m) => /^core\.hookspath$/i.test(m)) ? MESSAGE_CONTROLE : MESSAGES.config]);
      break;
    case "rm":
      if (options.includes("--cached")) break;
      if ((court("r") || aLongue("--recursive")) && (court("f") || aLongue("--force"))) constats.push([ACCORD, MESSAGES.suppression]);
      if (positions.some((p) => designeEnv(p, cwd, c.dialecte))) constats.push([ACCORD, MESSAGES.suppressionEnv]);
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

const CIBLES_TOTALES = /^(\/|\/\*|~|~\/|~\/\*|\$HOME\/?|\$\{HOME\}\/?|\$HOME\/\*|\$\{HOME\}\/\*|\.|\.\/|\.\.|\.\.\/|\*|\.\/\*|[A-Za-z]:[\\/]?|[A-Za-z]:[\\/]\*|\/[a-zA-Z]\/?|\/[a-zA-Z]\/\*|\/mnt\/[a-zA-Z]\/?|\/mnt\/[a-zA-Z]\/\*|%USERPROFILE%|\$env:USERPROFILE)$/i;
const COMMANDES_SUPPRESSION = new Set(["rm", "remove-item", "ri", "del", "erase", "rd", "rmdir", "unlink"]);
const estRecursif = (a) => a === "--recursive" || (/^-[a-zA-Z]{1,4}$/.test(a) && /[rR]/.test(a)) || /^-r(e(c(u(r(s(e)?)?)?)?)?)?(:\$?(true|1))?$/i.test(a) || /^\/s$/i.test(a);

function suppressionRecursive(cibles, constats) {
  if (cibles.some((c) => CIBLES_TOTALES.test(c))) return constats.push([REFUS, MESSAGES.suppressionTotale]);
  const aRisque = cibles.filter((c) => !DOSSIERS_RECONSTRUITS.has(c.replace(/[\\/]+$/, "").split(/[\\/]/).pop()));
  if (aRisque.length) constats.push([ACCORD, MESSAGES.suppression]);
}

function reglesSuppression(c, cwd, constats) {
  const cibles = c.args.filter((a) => !estOption(a) && a !== "--" && !(c.dialecte !== "bash" && ["del", "erase", "rd", "rmdir"].includes(c.cmd) && /^\/[a-zA-Z]$/.test(a)));
  if (cibles.some((a) => designeEnv(a, cwd, c.dialecte))) constats.push([ACCORD, MESSAGES.suppressionEnv]);
  const recursif = c.args.some(estRecursif);
  const motif = cibles.some((a) => /[*?]/.test(a));
  if ((recursif || motif) && cibles.some((a) => CIBLES_TOTALES.test(a))) constats.push([REFUS, MESSAGES.suppressionTotale]);
  else if (c.viaFind || c.viaXargs || (c.apresTube && !cibles.length)) constats.push([ACCORD, MESSAGES.suppression]);
  else if (recursif || motif) suppressionRecursive(cibles, constats);
}

// Requête qui supprime ou réécrit des données, lue à partir de son premier mot (code de node -e, tsx -e…).
// Le nom de table peut être une variable (Drizzle : ${users}) ; la requête finit au bout du texte, à une fermeture (; ) ' " `) ou à WHERE.
const SQL_DESTRUCTEUR = /^(drop\s+(table|schema|database|view|index|materialized|type|sequence)\b|truncate(\s+table)?\s+[^\s;,()]+\s*($|[,;)'"`]|\s+(cascade|restrict|restart|continue)\b)|delete\s+from\s+[^\s;,()]+\s*($|[;)'"`]|\s+(where|using|returning)\b)|update\s+[^\s;,()]+\s+set\s|alter\s+table\s)/i;

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

function reglesSqlFichier(fichier, cwd, constats) {
  try {
    const chemin = path.resolve(cwd, fichier);
    if (fs.statSync(chemin).size > 1024 * 1024) return constats.push([ACCORD, MESSAGES.baseDeDonnees]);
    reglesSql(fs.readFileSync(chemin, "utf8"), constats);
  } catch (e) {
    constats.push([ACCORD, MESSAGES.baseDeDonnees]);
  }
}

// pulse-aidd : ce qui change la production, crée ou retire un secret, ou coupe un accès.
function reglesOutil(args, constats) {
  const [a0, a1, a2] = args.map((a) => String(a || "").toLowerCase());
  if (a0 === "secrets" && ["generer", "envoyer", "elaguer", "redeployer"].includes(a1)) constats.push([ACCORD, MESSAGES.secretsHebergeur]);
  if (a0 === "search-console" && a1 === "deconnecter") constats.push([ACCORD, MESSAGES.deconnexion]);
  if (a0 === "pile" && a1 === "hebergeur" && ["envoyer", "redeployer"].includes(a2)) constats.push([ACCORD, MESSAGES.secretsHebergeur]);
}

// ---------------------------------------------------------------- Analyse

function appliquerRegles(c, cwd, constats) {
  const { cmd, args } = c;
  if (c.dialecte !== "powershell" && c.brut.startsWith("$")) constats.push([ACCORD, MESSAGES.commandeMasquee]);
  // PowerShell : & $g push … ou . $s … (hors affectation $x = …, $x ??= …, opérateur $x -eq …, foreach ($x in …), simple lecture $env:X).
  // & $g suivi d'une option (& $g -C . push) : règle à part dans analyser.
  if (c.dialecte === "powershell" && /^\$[\w:{}]+$/.test(c.brut) && args.length && !/^([-+*\/%]?=|\?\?=|-|in$)/i.test(args[0])) constats.push([ACCORD, MESSAGES.commandeMasquee]);
  if (c.dialecte === "powershell" && c.brut === "." && /^\$/.test(args[0] || "")) constats.push([ACCORD, MESSAGES.commandeMasquee]);
  if (c.scriptInconnu) constats.push([ACCORD, MESSAGES.scriptInconnu]);
  if (COMMANDES_SUPPRESSION.has(cmd)) reglesSuppression(c, cwd, constats);
  if (c.code !== undefined && /\b(rmSync|rmdirSync|unlinkSync|rimraf|rmtree|remove_tree|rm_rf|os\.remove|os\.unlink|unlink|rmdir)\b|\.rm\s*\(|\brm\s*\(|\[\s*['"`](rm|rmdir|unlink)\w*['"`]\s*\]/.test(c.code))
    constats.push([ACCORD, MESSAGES.suppression]);
  if (c.affectations.some((a) => /^PULSE_SONDES_/i.test(a))) constats.push([ACCORD, MESSAGES.sondeDetournee]);
  if (litEnv(c, cwd)) constats.push([REFUS, MESSAGES.lectureEnv]);
  // Une variable qui contient le nom d'un .env (f=.env ; cat $f).
  if (c.affectations.some((a) => designeEnv(a.slice(a.indexOf("=") + 1), cwd, c.dialecte))) constats.push([ACCORD, MESSAGES.envDansVariable]);
  if (ecritEnvExistant(c, cwd)) constats.push([ACCORD, MESSAGES.envModifie]);
  if (toucheControle(c, cwd)) constats.push([ACCORD, MESSAGE_CONTROLE]);
  if (c.cmd === "vercel" && c.args[0] === "env" && c.args[1] === "pull") constats.push([ACCORD, MESSAGES.envEcrase]);
  // Recherche récursive : refusée seulement si un dossier fouillé contient un .env.
  // Les dossiers fouillés : les positions, sans le motif (premier mot libre, ou valeur de -e, -eTODO, --regexp…).
  const positionsRecherche = args.filter((a, j) => !estOption(a) && !/^(-e|-f|--regexp|--file)$/.test(args[j - 1] || ""));
  const dossiersRecherche = motifParOption(cmd, args) ? positionsRecherche : positionsRecherche.slice(1);
  const fouilles = (dossiersRecherche.length ? dossiersRecherche : ["."]).map((d) => path.resolve(cwd, d));
  if (["grep", "egrep", "fgrep"].includes(cmd) && args.some((a) => a === "--recursive" || a === "--dereference-recursive" || (/^-[a-zA-Z]+$/.test(a) && /[rR]/.test(a))) && !/--exclude[= ]['"]?\.env/.test(args.join(" ")))
    if (fouilles.some((d) => contientEnv(d))) constats.push([REFUS, MESSAGES.rechercheEnv]);
  if (cmd === "rg" && (args.some((a) => /^-u{2,}$/.test(a)) || (args.some((a) => a.startsWith("--no-ignore")) && args.includes("--hidden"))) && !/(-g|--glob)[= ]['"]?!\.env/.test(args.join(" ")))
    if (fouilles.some((d) => contientEnv(d))) constats.push([REFUS, MESSAGES.rechercheEnv]);
  if (c.code !== undefined) {
    const cites = [...c.code.matchAll(TEXTES_CITES)].map((t) => t[2]);
    if (cites.some((t) => designeEnv(t, cwd, c.dialecte)) || (/\b(dotenv|load_dotenv)\b/.test(c.code) && /\b(console\.log|print|puts|echo)\b/.test(c.code))) constats.push([REFUS, MESSAGES.lectureEnv]);
    // SQL écrit dans du code (node -e, tsx -e) : mêmes règles que psql -c, sur la requête jusqu'au guillemet qui la ferme.
    // Un texte ordinaire (« delete from cache done ») n'a pas la forme d'une requête.
    // Premier mot en début de mot, ou en capitales collé à un mot (PowerShell retire les accents graves : sql`DELETE … devient sqlDELETE …).
    const debuts = [...c.code.matchAll(/\b(drop|truncate|delete|update|alter)\b/gi), ...c.code.matchAll(/(?<=[a-z])(DROP|TRUNCATE|DELETE|UPDATE|ALTER)\b/g)];
    for (const m of debuts) {
      const reste = c.code.slice(m.index);
      if (SQL_DESTRUCTEUR.test(reste)) reglesSql(reste.split(/['"`]/)[0], constats);
    }
  }

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
      if (/^(push|drop)(:|$)/.test(args[0] || "")) constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      break;
    case "prisma":
      if ((args[0] === "db" && args[1] === "push") || (args[0] === "migrate" && args[1] === "reset")) constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      break;
    case "supabase":
      if (args[0] === "db" && (args[1] === "reset" || args[1] === "push")) constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      break;
    case "psql": {
      let sqlConnu = false;
      for (let k = 0; k < args.length; k++) {
        // -c SQL, -tAc SQL (options sans valeur groupées avant c), -cSQL, -tAcSQL, --command SQL, --command=SQL et ses abréviations (--com…).
        const groupe = /^-[AaeEHlnqsStxX01]*c(.*)$/.exec(args[k]);
        const longueCommande = /^--com(m(a(n(d)?)?)?)?(=(.*))?$/s.exec(args[k]);
        if (groupe || longueCommande) {
          const colle = groupe ? groupe[1] || undefined : longueCommande[6];
          reglesSql(colle !== undefined ? colle : args[k + 1], constats);
          sqlConnu = true;
        } else if (args[k] === "-f" || args[k] === "--file") {
          reglesSqlFichier(args[k + 1], cwd, constats);
          sqlConnu = true;
        } else if (args[k].startsWith("--file=")) {
          reglesSqlFichier(args[k].slice(7), cwd, constats);
          sqlConnu = true;
        }
      }
      for (const e of c.entrees) {
        reglesSql(e, constats);
        sqlConnu = true;
      }
      for (const f of c.lectures) {
        reglesSqlFichier(f, cwd, constats);
        sqlConnu = true;
      }
      if (!sqlConnu && c.apresTube) constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      break;
    }
    case "neonctl":
    case "neon":
      if (args.some((a) => ["delete", "reset", "restore"].includes(a))) constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      break;
    case "vercel": {
      // Options globales retirées d'abord (vercel --scope t project rm x).
      const v = [];
      for (let j = 0; j < args.length; j++) {
        if (/^(--scope|-S|--team|-T|--token|-t|--cwd|--local-config|-A|--global-config|-Q)$/.test(args[j])) j++;
        else if (!/^--(scope|team|token|cwd|local-config|global-config)=/.test(args[j])) v.push(args[j]);
      }
      const prod = v.some((a) => a === "--prod" || a === "--production" || a === "--target=production" || /^--prod(uction)?=(?!false$)/i.test(a)) || v.join(" ").includes("--target production");
      if ((prod && v[0] !== "build" && v[0] !== "env") || ["promote", "rollback", "remove", "rm"].includes(v[0])) constats.push([ACCORD, MESSAGES.production]);
      if (v[0] === "env" && ["add", "update", "rm", "remove"].includes(v[1])) constats.push([ACCORD, MESSAGES.variablesHebergeur]);
      // vercel project rm, vercel domains rm, vercel alias rm… (la suppression d'une variable a sa règle ci-dessus).
      if (["rm", "remove"].includes(v[1]) && v[0] !== "env") constats.push([ACCORD, MESSAGES.production]);
      break;
    }
    case "pg_restore":
      constats.push([ACCORD, MESSAGES.baseDeDonnees]);
      break;
    case "shred":
      constats.push([ACCORD, MESSAGES.suppression]);
      break;
    case "rsync":
      if (args.some((a) => /^--(del\b|delete|remove-source-files)/.test(a))) constats.push([ACCORD, MESSAGES.suppression]);
      break;
    case "gitleaks": {
      // --redact masque tout ; --redact=N ne masque que N % de chaque secret.
      // Seule la dernière occurrence compte.
      const dernier = args.filter((a) => /^--redact(=|$)/.test(a)).pop();
      const masque = dernier !== undefined && (dernier === "--redact" || Number((/^--redact=(\d+)$/.exec(dernier) || [])[1]) >= 100);
      if (args.some((a) => ["detect", "dir", "git", "protect", "stdin"].includes(a)) && !masque) constats.push([REFUS, MESSAGES.gitleaksSansMasque]);
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
    case "glab": {
      // Options globales -R / --repo retirées : gh -R o/r repo delete reste une suppression.
      const g = [];
      for (let j = 0; j < args.length; j++) {
        if (args[j] === "-R" || args[j] === "--repo") j++;
        else if (!/^--repo=/.test(args[j])) g.push(args[j]);
      }
      const [a0, a1] = g;
      const texte = g.join(" ");
      if ((cmd === "gh" && a0 === "pr" && a1 === "merge") || (cmd === "glab" && a0 === "mr" && a1 === "merge")) constats.push([ACCORD, MESSAGES.fusion]);
      if (a0 === "repo" && a1 === "delete") constats.push([REFUS, MESSAGES.depotSupprime]);
      const publicDemande = g.includes("--public") || g.some((a, j) => (a === "--visibility" && /^public$/i.test(g[j + 1] || "")) || /^--visibility=public$/i.test(a));
      if (a0 === "repo" && ["create", "edit"].includes(a1) && publicDemande) constats.push([REFUS, MESSAGES.depotPublic]);
      // Champs envoyés (-f, -F, --field, --raw-field, collés ou non) ou requête GraphQL : une simple lecture (gh api 'user/repos?visibility=public') passe.
      const champs = valeursOption(g, ["-f", "-F", "--field", "--raw-field"]);
      if (a0 === "api" && (champs.some((v) => /^(private=false|visibility=public)$/i.test(v)) || (a1 === "graphql" && /visibility\s*:\s*PUBLIC/i.test(texte)))) constats.push([REFUS, MESSAGES.depotPublic]);
      // Corps lu sur l'entrée standard ou dans un fichier (--input) pour modifier un dépôt : Pulse ne le voit pas.
      const methode = (g.find((a, j) => ["-X", "--method"].includes(g[j - 1])) || (g.find((a) => /^(-X|--method=)\w+$/.test(a)) || "").replace(/^(-X|--method=)/, "")).toUpperCase();
      if (cmd === "gh" && a0 === "api" && ["PATCH", "POST", "PUT"].includes(methode) && g.some((a) => /^repos\//.test(a)) && g.some((a) => a === "--input" || a.startsWith("--input=")))
        constats.push([ACCORD, MESSAGES.apiModification]);
      if (cmd === "gh" && a0 === "api" && g.some((a, j) => (["-X", "--method"].includes(a) && /^delete$/i.test(g[j + 1] || "")) || /^(-X|--method=)delete$/i.test(a)))
        constats.push([ACCORD, MESSAGES.apiSuppression]);
      if (a0 === "api" && a1 === "graphql" && /mutation/i.test(texte) && /delete|archive|transfer/i.test(texte)) constats.push([ACCORD, MESSAGES.apiSuppression]);
      if (a0 === "repo" && ["archive", "rename", "transfer"].includes(a1)) constats.push([ACCORD, MESSAGES.depotModifie]);
      if (a0 === "secret" && ["set", "delete", "remove"].includes(a1)) constats.push([ACCORD, MESSAGES.secretsDepot]);
      if (a0 === "release" && a1 === "delete") constats.push([ACCORD, MESSAGES.apiSuppression]);
      break;
    }
    case "set-item":
    case "si":
    case "new-item":
    case "ni":
      // Set-Item alias:g git crée un alias, comme Set-Alias.
      if (args.some((a) => /^(-(path|literalpath|name):?)?alias:/i.test(a) || /^alias:?$/i.test(a))) constats.push([ACCORD, MESSAGES.commandeMasquee]);
      break;
    case "alias":
    case "set-alias":
    case "sal":
    case "new-alias":
    case "nal":
      if (args.length) constats.push([ACCORD, MESSAGES.commandeMasquee]);
      break;
    default:
      break;
  }
  const outil = appelOutilPulse(c);
  if (outil) reglesOutil(outil, constats);
}

// Outils et scripts de Pulse, avec les mots qui les précèdent dans pulse-aidd (secrets.js envoyer = pulse-aidd secrets envoyer).
const OUTILS_PULSE = { "pulse-aidd": [], "pulse-pile-next": ["pile"], secrets: ["secrets"], "search-console": ["search-console"], "secrets-vercel": ["pile", "hebergeur"] };
const LANCEURS_SCRIPT = new Set(["node", "bun", "tsx", "ts-node", "deno"]);
const nomScript = (m) => String(m).split(/[\\/]/).pop().toLowerCase().replace(/\.(cmd|exe|bat|ps1|[cm]?[jt]s)$/, "");

/** Les arguments, façon pulse-aidd, d'un appel à un outil de Pulse : pulse-aidd …, pulse-pile-next …, node …/secrets.js …, bun|tsx|deno run …/bin/pulse-aidd … ; sinon null. */
function appelOutilPulse(c) {
  const connu = (nom) => Object.prototype.hasOwnProperty.call(OUTILS_PULSE, nom);
  // Appel direct : pulse-aidd, pulse-pile-next, ou un script nommé par son chemin (./scripts/secrets.js, lancé par bun).
  const direct = nomScript(c.brut || "");
  if (connu(direct) && (direct.startsWith("pulse-") || /[\\/]|\.[cm]?[jt]s$/.test(c.brut))) return [...OUTILS_PULSE[direct], ...c.args];
  if (!LANCEURS_SCRIPT.has(c.cmd) || c.code !== undefined) return null;
  const libres = c.args.filter((a) => !estOption(a));
  if (c.cmd === "deno" && libres[0] === "run") libres.shift();
  const nom = libres.length ? nomScript(libres[0]) : "";
  return connu(nom) ? [...OUTILS_PULSE[nom], ...libres.slice(1)] : null;
}

function analyser(commande, cwd, dialecte) {
  const constats = [];
  const commandes = commandesSimples(commande, dialecte);
  for (const c of commandes) appliquerRegles(c, cwd, constats);
  const sansCitations = commande.replace(/(?<!=)('[^']*'|"(?:[^"\\]|\\.)*")/g, "");
  // Contrôles coupés par une variable posée avant la commande (export HUSKY=0 ; $env:HUSKY = 0).
  const coupe = /(^|[\s;&|(])(export\s+|\$env:)(HUSKY\s*=\s*['"]?0|HUSKY_SKIP_HOOKS\s*=\s*['"]?1|SKIP_SIMPLE_GIT_HOOKS\s*=\s*['"]?1|LEFTHOOK\s*=\s*['"]?0)\b/i;
  if (coupe.test(sansCitations) && commandes.some((c) => c.cmd === "git")) constats.push([REFUS, MESSAGES.controlesCoupes]);
  // Configuration de Git par des variables posées à part (GIT_CONFIG_COUNT=1 ; export "GIT_CONFIG_COUNT=1" ; $env:GIT_CONFIG_COUNT = 1 ;
  // Set-Item 'env:GIT_CONFIG_COUNT' ; New-Item -Path Env: -Name GIT_CONFIG_COUNT ; cmd /c "set GIT_CONFIG_COUNT=1&& …") : refus si le script lance git.
  const configParVariable = commandes.some((c) => poseVariable(c, /^GIT_CONFIG(_\w+)?\b/i)) || /SetEnvironmentVariable\s*\(\s*['"]?GIT_CONFIG/i.test(commande);
  if (configParVariable && commandes.some((c) => c.cmd === "git")) constats.push([REFUS, MESSAGES.configMasquee]);
  if (commandes.some((c) => poseVariable(c, /^PULSE_SONDES_/i)) || /SetEnvironmentVariable\s*\(\s*['"]?PULSE_SONDES_/i.test(commande)) constats.push([ACCORD, MESSAGES.sondeDetournee]);
  // Suppression .NET : [IO.Directory]::Delete('src', $true), [IO.File]::Delete(…), ::DeleteDirectory(…), (Get-Item src).Delete($true) en PowerShell.
  if (/::Delete(Directory|File)?\s*\(/i.test(sansCitations) || (dialecte === "powershell" && /\.Delete(Directory)?\s*\(/i.test(sansCitations))) constats.push([ACCORD, MESSAGES.suppression]);
  // PowerShell : opérateur d'appel sur un nom calculé (& $g -C . push, & ('gi'+'t'), & (Get-Command git)) ; & $PSScriptRoot/x.ps1 reste libre.
  if (dialecte === "powershell" && /(^|[;|{(\s])&\s*(\$[\w:{}]+(\s|$)|\()/.test(sansCitations)) constats.push([ACCORD, MESSAGES.commandeMasquee]);
  // Lecture .NET depuis PowerShell : [IO.File]::ReadAllText('.env').
  for (const m of commande.matchAll(/::ReadAll(?:Text|Lines|Bytes)\s*\(\s*['"]([^'"]+)['"]/gi)) if (designeEnv(m[1], cwd, dialecte)) constats.push([REFUS, MESSAGES.lectureEnv]);
  // PowerShell : ${chemin} lit le contenu du fichier (${C:\projet\.env}, ${E:.env}).
  if (dialecte === "powershell")
    for (const m of commande.matchAll(/\$\{([^}]+)\}/g))
      if ([m[1], m[1].replace(/^[A-Za-z]:(?![\\/])/, "")].some((p) => /[\\/:]/.test(m[1]) && designeEnv(p, cwd, dialecte))) constats.push([REFUS, MESSAGES.lectureEnv]);
  // Un nom passé à xargs : la commande lancée lit ce que la précédente a nommé (echo .env | xargs cat).
  if (commandes.some((c) => c.viaXargs) && commandes.some((c) => [c.brut, ...c.args].some((a) => designeEnv(a, cwd, dialecte)))) constats.push([REFUS, MESSAGES.lectureEnv]);
  // Une liste de fichiers qui contient un .env sans le nommer (ls -A | xargs cat ; find . -type f -exec cat {} +), lue par la commande lancée.
  const lecteur = (c) => !SANS_LECTURE.has(c.cmd) && !COMMANDES_SUPPRESSION.has(c.cmd) && c.cmd !== "git";
  const listeurs = commandes.filter((c) => ["ls", "dir", "find"].includes(c.cmd) && c.dialecte === "bash");
  if (commandes.some((c) => c.viaXargs && lecteur(c)) && listeurs.some((c) => listeurCouvreEnv(c, cwd))) constats.push([REFUS, MESSAGES.lectureEnv]);
  if (commandes.some((c) => c.viaFind && lecteur(c)) && listeurs.some((c) => c.cmd === "find" && listeurCouvreEnv(c, cwd))) constats.push([REFUS, MESSAGES.lectureEnv]);
  // PowerShell : des fichiers .env listés puis passés par un tube à une commande qui les lit (Get-ChildItem .env | Get-Content).
  // Les commandes qui suivent le listeur dans le tube montrent seulement noms et propriétés (SANS_CONTENU_PS).
  const listeursEnv = commandes.filter((c) => c.dialecte === "powershell" && LISTEURS_PS.has(c.cmd) && listeurCouvreEnv(c, cwd));
  commandes.forEach((c, i) => {
    if (!listeursEnv.includes(c)) return;
    for (let j = i + 1; j < commandes.length && commandes[j].apresTube; j++)
      if (!SANS_CONTENU_PS.has(commandes[j].cmd)) return constats.push([REFUS, MESSAGES.lectureEnv]);
  });
  // Les blocs { } ou @{ } du tube du listeur (jusqu'au « ; » ou à la ligne suivante) comptent comme une lecture,
  // sauf s'ils ne font que lire des propriétés, comparer, calculer, filtrer, trier ou afficher (blocSur).
  if (dialecte === "powershell" && listeursEnv.length) {
    const masque = masquerTextesPs(commande);
    let vus = 0;
    for (const m of masque.matchAll(/(^|[;|({&=\n])(\s*)(?:ls|dir|get-childitem|gci)(?=$|[\s;|)}])/gi)) {
      const debut = m.index + m[1].length + m[2].length;
      const fin = finTubePs(masque, debut);
      const listeur = commandesSimples(commande.slice(debut, fin), "powershell")[0];
      if (!listeur || !LISTEURS_PS.has(listeur.cmd) || !listeurCouvreEnv(listeur, cwd)) continue;
      vus++;
      if (!blocsPs(masque.slice(debut, fin)).every(blocSur)) constats.push([REFUS, MESSAGES.lectureEnv]);
      // Après un bloc, la liste continue dans le tube (gci .env | % { $_ } | Get-Content) : blocs effacés, chaque commande du tube est jugée.
      const tube = commandesSimples(sansBlocsPs(commande.slice(debut, fin), masque.slice(debut, fin)), "powershell");
      if (tube.slice(1).some((d) => d.apresTube && !SANS_CONTENU_PS.has(d.cmd))) constats.push([REFUS, MESSAGES.lectureEnv]);
    }
    // Listeur introuvable dans le texte (dans des guillemets, appelé autrement) : tous les blocs de la commande sont examinés.
    if (vus < listeursEnv.length && !blocsPs(commande).every(blocSur)) constats.push([REFUS, MESSAGES.lectureEnv]);
  }
  // PowerShell : un nom produit entre parenthèses puis lu (gc (echo .env), (Get-ChildItem .env).OpenText()).
  if (dialecte === "powershell")
    for (const c of commandes) {
      if (!PRODUCTEURS_PS.has(c.cmd) || !(LISTEURS_PS.has(c.cmd) ? listeurCouvreEnv(c, cwd) : motsLus(c).some((a) => designeEnv(a, cwd, c.dialecte)))) continue;
      const re = new RegExp(`\\(\\s*${c.brut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s)])`, "gi");
      for (const m of commande.matchAll(re)) {
        // « @( … ) » (tableau) se lit comme « ( … ) ».
        const avant = commande.slice(0, m.index).replace(/@$/, "").trimEnd();
        const argument = /[\w'"]$/.test(avant) && !/(^|[\s;|({])(if|elseif|while|until|foreach|for|switch|return|-and|-or|-not)$/i.test(avant);
        let profondeur = 0;
        let fin = m.index;
        for (; fin < commande.length; fin++) {
          if (commande[fin] === "(") profondeur++;
          else if (commande[fin] === ")" && --profondeur === 0) break;
        }
        const methode = /^\.\w+\s*\(/.test(commande.slice(fin + 1));
        if (argument || methode) constats.push([REFUS, MESSAGES.lectureEnv]);
      }
    }
  // Nom calculé par concaténation de textes cités ('.e'+'nv').
  for (const m of commande.matchAll(/(?:(["'])[^"'\n]*\1\s*\+\s*)+(["'])[^"'\n]*\2/g)) {
    const joint = [...m[0].matchAll(/(["'])([^"'\n]*)\1/g)].map((x) => x[2]).join("");
    if (designeEnv(joint, cwd, dialecte)) constats.push([REFUS, MESSAGES.lectureEnv]);
  }
  return constats;
}

// ---------------------------------------------------------------- Point d'entrée

/** Décision du garde-fou des commandes pour une entrée de hook : { decision, raison }, ou null pour laisser passer. */
function evaluer(entree) {
  if (process.env.PULSE_GARDE_COMMANDES_OFF === "1") return null;
  if (!entree || !["Bash", "PowerShell"].includes(entree.tool_name) || !entree.tool_input || typeof entree.tool_input.command !== "string") return null;
  try {
    const cwd = entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : process.cwd();
    const constats = analyser(entree.tool_input.command, cwd, entree.tool_name === "PowerShell" ? "powershell" : "bash");
    if (!constats.length) return null;
    const refus = constats.filter(([d]) => d === REFUS);
    const raisons = [...new Set((refus.length ? refus : constats).map(([, r]) => r))];
    return {
      decision: refus.length ? REFUS : ACCORD,
      raison: `🔒 ${raisons.join("\n\n")}${refus.length ? "\n\nExpliquez simplement la raison à la personne, puis utilisez l'alternative." : ""}`,
    };
  } catch (e) {
    return null; // Fail-open : une erreur du garde-fou ne bloque jamais une séance.
  }
}

module.exports = { evaluer };

if (require.main === module) {
  let entree = null;
  try {
    entree = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (e) {
    // entrée illisible : rien à décider
  }
  const r = evaluer(entree);
  if (r) fs.writeSync(1, JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: r.decision, permissionDecisionReason: r.raison } }));
  process.exit(0);
}

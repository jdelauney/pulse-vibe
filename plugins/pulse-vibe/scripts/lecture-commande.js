// Pulse – lecture d'une commande shell, partagée par les garde-fous (garde-commandes.js, garde-secrets.js).
//
// La commande est lue comme le shell la lit : segments (&&, ||, ;, |, retours à la ligne, parenthèses),
// préfixes retirés (sudo, env, VAR=…, npx, xargs…), lanceurs dépliés (sh -c, pwsh -c, cmd /c, eval,
// Invoke-Expression, Start-Process, heredoc lu par un shell, $(…), code de node -e ou python -c).
// Trois dialectes : "bash" (Git Bash, sh), "powershell" (accent grave d'échappement, here-strings,
// barre oblique inverse ordinaire), "cmd" (accent circonflexe d'échappement). Un texte cité ne devient
// jamais une commande.
"use strict";

const PROFONDEUR_MAX = 6;
const MOTS_CLES = new Set(["if", "then", "else", "elif", "fi", "do", "done", "while", "until", "!", "{", "}", "time"]);
const SHELLS_POSIX = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
const GESTIONNAIRES = new Set(["npm", "pnpm", "yarn", "bun"]);
const SOUS_COMMANDES_GESTIONNAIRE = new Set(["run", "run-script", "test", "start", "install", "i", "add", "remove", "ci", "build", "dev"]);
// Options qui portent le code à exécuter, par interpréteur.
const INTERPRETES = {
  node: ["-e", "--eval", "-p", "--print"],
  python: ["-c"],
  python3: ["-c"],
  py: ["-c"],
  perl: ["-e", "-E"],
  ruby: ["-e"],
  php: ["-r"],
  bun: ["-e", "--eval"],
  deno: ["eval"],
  tsx: ["-e", "--eval", "-p", "--print"],
  "ts-node": ["-e", "--eval", "-p", "--print"],
};

/**
 * Découpe un script en segments ({ mots, entrees, lectures, apresTube }) et en sous-scripts ($(…), `…`).
 * `entrees` : le texte des heredocs et here-strings du segment (lu seulement si le segment est un shell).
 * `lectures` : les fichiers lus par une redirection d'entrée (`< fichier`).
 * `ecritures` : les fichiers écrits par une redirection de sortie (`> fichier`, `>> fichier`, `&> fichier`).
 */
function decouper(script, dialecte = "bash") {
  const posix = dialecte === "bash";
  const segments = [];
  const sousScripts = [];
  let mots = [];
  let entrees = [];
  let lectures = [];
  let ecritures = [];
  let apresTube = false;
  let mot = null;
  let redirection = null; // "entree" ou "sortie" : le prochain mot est une cible de redirection, pas un argument
  let texteEnvoye = false; // le prochain mot est le texte d'un here-string (<<<)
  let heredocsEnAttente = []; // { delim, retirerTabs, segment }
  let i = 0;
  const n = script.length;

  const finirMot = () => {
    if (mot !== null) {
      if (redirection) {
        if (redirection === "entree") lectures.push(mot);
        else if (redirection === "sortie") ecritures.push(mot); // « flux » (`>&2`) : renvoi vers un flux, pas un fichier
        redirection = null;
      } else if (texteEnvoye) {
        entrees.push(mot);
        texteEnvoye = false;
      } else mots.push(mot);
    }
    mot = null;
  };
  // Termine le segment courant ; les heredocs ouverts lui appartiennent.
  const finirSegment = () => {
    finirMot();
    const seg = { mots, entrees, lectures, ecritures, apresTube };
    if (mots.length || entrees.length || lectures.length || ecritures.length) segments.push(seg);
    for (const h of heredocsEnAttente) if (!h.segment) h.segment = seg;
    mots = [];
    entrees = [];
    lectures = [];
    ecritures = [];
    apresTube = false;
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
        const ligne = script.slice(i, fin).replace(/\r$/, "");
        i = fin + 1;
        if ((h.retirerTabs ? ligne.replace(/^\t+/, "") : ligne) === h.delim) break;
        lignes.push(ligne);
      }
      if (h.segment) h.segment.entrees.push(lignes.join("\n"));
    }
    heredocsEnAttente = [];
  };

  while (i < n) {
    const c = script[i];
    if (dialecte === "powershell" && c === "@" && mot === null && (script[i + 1] === "'" || script[i + 1] === '"') && /^\r?\n/.test(script.slice(i + 2, i + 4))) {
      // Here-string PowerShell : texte cité jusqu'à la ligne '@ ou "@.
      const fermeture = "\n" + script[i + 1] + "@";
      const debut = script.indexOf("\n", i) + 1;
      const fin = script.indexOf(fermeture, debut - 1);
      ajouter(script.slice(debut, fin < 0 ? n : fin).replace(/\r$/, ""));
      i = fin < 0 ? n : fin + fermeture.length;
    } else if (c === "'" && dialecte !== "cmd") {
      const fin = script.indexOf("'", i + 1);
      ajouter(script.slice(i + 1, fin < 0 ? n : fin));
      i = fin < 0 ? n : fin + 1;
    } else if (c === '"') {
      let j = i + 1;
      let texte = "";
      while (j < n) {
        const d = script[j];
        if (d === '"') {
          if (dialecte === "powershell" && script[j + 1] === '"') {
            texte += '"';
            j += 2;
            continue;
          }
          break;
        }
        if (posix && d === "\\" && j + 1 < n && '"\\$`'.includes(script[j + 1])) {
          texte += script[j + 1];
          j += 2;
        } else if (dialecte === "powershell" && d === "`" && j + 1 < n) {
          texte += script[j + 1];
          j += 2;
        } else if (dialecte !== "cmd" && d === "$" && script[j + 1] === "(") {
          const apres = lireSubstitution(j);
          texte += script.slice(j, apres);
          j = apres;
        } else texte += script[j++];
      }
      ajouter(texte);
      i = j + 1;
    } else if (c === "\\" && posix) {
      if (script[i + 1] !== "\n") ajouter(script[i + 1] || "");
      i += 2;
    } else if (c === "^" && dialecte === "cmd") {
      if (script[i + 1] !== "\n") ajouter(script[i + 1] || "");
      i += 2;
    } else if (c === "$" && script[i + 1] === "(" && dialecte !== "cmd") {
      const apres = lireSubstitution(i);
      ajouter(script.slice(i, apres));
      i = apres;
    } else if (c === "`" && posix) {
      const fin = script.indexOf("`", i + 1);
      sousScripts.push(script.slice(i + 1, fin < 0 ? n : fin));
      i = fin < 0 ? n : fin + 1;
    } else if (c === "`" && dialecte === "powershell") {
      // Accent grave PowerShell : continuation de ligne, ou caractère suivant pris tel quel.
      if (script[i + 1] === "\n") i += 2;
      else if (script[i + 1] === "\r" && script[i + 2] === "\n") i += 3;
      else {
        ajouter(script[i + 1] || "");
        i += 2;
      }
    } else if (c === "#" && mot === null && dialecte !== "cmd") {
      while (i < n && script[i] !== "\n") i++;
    } else if (c === "\n") {
      finirSegment();
      i++;
      lireHeredocs();
    } else if (c === " " || c === "\t" || c === "\r") {
      finirMot();
      i++;
    } else if (c === ";" || c === "&" || c === "|" || c === "(" || c === ")" || (dialecte === "powershell" && (c === "{" || c === "}") && !(mot || "").endsWith("$"))) {
      if (c === "&" && script[i + 1] === ">") {
        finirMot();
        redirection = "sortie";
        i += script[i + 2] === ">" ? 3 : 2;
        continue;
      }
      const double = (c === "&" || c === "|" || c === ";") && script[i + 1] === c;
      finirSegment();
      if (c === "|" && !double) apresTube = true;
      i += double ? 2 : 1;
    } else if (c === "<" && script.startsWith("<<<", i) && dialecte !== "cmd") {
      finirMot();
      texteEnvoye = true;
      i += 3;
    } else if (c === "<" && script[i + 1] === "<" && dialecte !== "cmd") {
      finirMot();
      i += 2;
      const retirerTabs = script[i] === "-";
      if (retirerTabs) i++;
      while (script[i] === " ") i++;
      let delim = "";
      while (i < n && !" \t\r\n;&|<>".includes(script[i])) {
        if (script[i] !== "'" && script[i] !== '"' && script[i] !== "\\") delim += script[i];
        i++;
      }
      heredocsEnAttente.push({ delim, retirerTabs, segment: null });
    } else if (c === ">" || c === "<") {
      if (mot !== null && /^(\d+|\*)$/.test(mot)) mot = null;
      finirMot();
      redirection = c === "<" ? "entree" : "sortie";
      i++;
      if (c === ">" && script[i] === "&" && /\d|-/.test(script[i + 1] || "")) redirection = "flux";
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

/** Nom d'une commande : sans chemin, sans extension Windows, sans version épinglée, en minuscules. */
function nomCommande(mot) {
  let nom = String(mot).split(/[\\/]/).pop().toLowerCase();
  nom = nom.replace(/\.(exe|cmd|bat|ps1)$/, "");
  const arobase = nom.indexOf("@", nom.startsWith("@") ? 1 : 0);
  if (arobase > 0) nom = nom.slice(0, arobase);
  return nom;
}

const estOption = (m) => m.startsWith("-") && m !== "-" && m !== "--";
const flagsCourts = (m) => (/^-[a-zA-Z]+$/.test(m) ? m.slice(1) : "");

function retirerOptions(m, avecValeur) {
  while (m.length && estOption(m[0])) {
    const o = m.shift();
    if (avecValeur.includes(o)) m.shift();
  }
  if (m[0] === "--") m.shift();
  return m;
}

/** Options globales de git, avant la sous-commande. */
function optionsGlobalesGit(args) {
  const prefixe = [];
  const configs = [];
  let k = 0;
  while (k < args.length && args[k].startsWith("-")) {
    const o = args[k];
    const egal = o.indexOf("=");
    const nom = egal > 0 ? o.slice(0, egal) : o;
    const valeurJointe = egal > 0 ? o.slice(egal + 1) : undefined;
    if (nom === "-C") prefixe.push("-C", args[++k]);
    else if (nom === "-c") configs.push(args[++k] || "");
    else if (nom === "--config-env") configs.push(valeurJointe !== undefined ? valeurJointe : args[++k] || "");
    else if (nom === "--git-dir" || nom === "--work-tree") prefixe.push(`${nom}=${valeurJointe !== undefined ? valeurJointe : args[++k]}`);
    else if ((nom === "--namespace" || nom === "--super-prefix") && valeurJointe === undefined) k++;
    k++;
  }
  return { k, prefixe, configs };
}

/** Les commandes simples d'un script, lanceurs dépliés (voir CommandeSimple dans le plan). `extra` : champs ajoutés au contexte de chaque commande. */
function commandesSimples(script, dialecte = "bash", profondeur = 0, resultat = [], extra = {}) {
  if (profondeur > PROFONDEUR_MAX || !script) return resultat;
  const { segments, sousScripts } = decouper(String(script), dialecte);
  for (const s of segments)
    deplier(s.mots, { entrees: s.entrees, lectures: s.lectures, ecritures: s.ecritures, apresTube: s.apresTube, dialecte, affectations: [], viaXargs: false, viaFind: false, ...extra }, profondeur, resultat);
  for (const sous of sousScripts) commandesSimples(sous, dialecte, profondeur + 1, resultat, { ...extra, dansSubstitution: true });
  return resultat;
}

function deplier(motsInitiaux, ctx, profondeur, resultat) {
  if (profondeur > PROFONDEUR_MAX) return;
  let m = motsInitiaux.slice();
  const affectations = [...ctx.affectations];
  let viaXargs = ctx.viaXargs;

  // Retirer le costume : mots-clés, affectations, préfixes.
  for (let tour = 0; tour < 12 && m.length; tour++) {
    if (MOTS_CLES.has(m[0])) {
      m.shift();
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(m[0])) {
      affectations.push(m.shift());
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
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(o)) affectations.push(o);
        else if (["-u", "--unset", "-C", "--chdir"].includes(o)) m.shift();
      }
      if (m[0] === "--") m.shift();
    } else if (["command", "builtin", "exec", "nohup", "busybox"].includes(cmd)) {
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
    } else if (cmd === "wsl") {
      // wsl [-d distribution] [-u utilisateur] [-e] commande : la commande lancée sous Linux.
      m.shift();
      retirerOptions(m, ["-d", "--distribution", "-u", "--user", "--cd", "--shell-type"]);
    } else if (cmd === "xargs") {
      viaXargs = true;
      m.shift();
      retirerOptions(m, ["-n", "-I", "-L", "-P", "-d", "-E", "-s", "-a", "--arg-file", "--delimiter", "--max-args", "--max-procs"]);
    } else if (cmd === "npx" || cmd === "bunx") {
      m.shift();
      retirerOptions(m, ["-p", "--package", "-c", "--call"]);
    } else break;
  }
  if (!m.length) {
    // Segment sans commande (`done < .env`, `f=.env`, `> fichier`) : gardé pour ses redirections et affectations.
    if (ctx.lectures.length || (ctx.ecritures || []).length || affectations.length) resultat.push({ cmd: "", brut: "", args: [], ...ctx, affectations, viaXargs });
    return;
  }

  const brut = m[0];
  const cmd = nomCommande(brut);
  const args = m.slice(1);
  const base = { ...ctx, affectations, viaXargs };
  const ajouter = (extra = {}) => resultat.push({ cmd, brut, args, ...base, ...extra });
  const script = (texte, dialecte) => commandesSimples(texte, dialecte, profondeur + 1, resultat, ctx.dansSubstitution ? { dansSubstitution: true } : {});
  const sousCommande = (mots, extra = {}) => deplier(mots, { ...base, entrees: [], lectures: [], ecritures: [], ...extra }, profondeur + 1, resultat);

  if (SHELLS_POSIX.has(cmd)) {
    const k = args.findIndex((a) => estOption(a) && flagsCourts(a).includes("c"));
    if (k >= 0) return script(args.slice(k + 1).find((a) => !estOption(a)) || "", "bash");
    const fichier = args.find((a) => !estOption(a));
    // « sh - », « bash -s », « bash /dev/stdin » : le script vient de l'entrée standard.
    const litEntree = fichier === undefined || fichier === "-" || fichier === "/dev/stdin" || args.some((a) => estOption(a) && flagsCourts(a).includes("s"));
    if (litEntree) {
      for (const e of ctx.entrees) script(e, "bash");
      // Texte reçu par un tube ou un fichier redirigé : Pulse ne le voit pas.
      if (!ctx.entrees.length && (ctx.apresTube || ctx.lectures.length)) ajouter({ scriptInconnu: true });
      return;
    }
    if (nomCommande(fichier) === "pulse-aidd") return sousCommande(args.slice(args.indexOf(fichier)));
    return ajouter();
  }
  if (cmd === "powershell" || cmd === "pwsh") {
    const k = args.findIndex((a) => /^-(c|command)$/i.test(a));
    if (k >= 0) {
      const texte = args.slice(k + 1).join(" ").trim();
      if (texte === "-") return ajouter({ scriptInconnu: true });
      return script(texte, "powershell");
    }
    const e = args.findIndex((a) => /^-(e|ec|encodedcommand)$/i.test(a));
    if (e >= 0 && args[e + 1]) return script(Buffer.from(args[e + 1], "base64").toString("utf16le"), "powershell");
    // powershell.exe lit son premier argument libre comme une commande (pwsh, comme un fichier).
    const libre = args.findIndex((a) => !a.startsWith("-"));
    if (cmd === "powershell" && libre >= 0) return script(args.slice(libre).join(" "), "powershell");
    return ajouter(ctx.apresTube && libre < 0 ? { scriptInconnu: true } : {});
  }
  if (cmd === "cmd") {
    const k = args.findIndex((a) => /^\/{1,2}[ck]$/i.test(a));
    if (k >= 0) return script(args.slice(k + 1).join(" "), "cmd");
    return ajouter(ctx.apresTube ? { scriptInconnu: true } : {});
  }
  if (cmd === "eval") return script(args.join(" "), "bash");
  if (cmd === "iex" || cmd === "invoke-expression") {
    const texte = args.filter((a) => !/^-command$/i.test(a)).join(" ");
    // Texte reçu par un tube, ou contenu d'une variable : Pulse ne le voit pas.
    if ((!texte && ctx.apresTube) || /^\$[\w:{}]+$/.test(texte)) return ajouter({ scriptInconnu: true });
    return script(texte, "powershell");
  }
  if (cmd === "start-process" || cmd === "saps") {
    let fichier = null;
    const liste = [];
    for (let j = 0; j < args.length; j++) {
      const a = args[j];
      if (/^-(filepath|fi)$/i.test(a)) fichier = args[++j];
      else if (/^-(argumentlist|args)$/i.test(a)) liste.push(...String(args[++j] || "").split(","));
      else if (/^-(workingdirectory|wo|windowstyle|verb|redirectstandard\w*)$/i.test(a)) j++;
      else if (!a.startsWith("-")) {
        if (fichier === null) fichier = a;
        else liste.push(...a.split(","));
      }
    }
    if (fichier) sousCommande([fichier, ...liste.map((x) => x.trim()).filter(Boolean)]);
    return;
  }
  const flagsCode = INTERPRETES[cmd];
  if (flagsCode && args.some((a) => flagsCode.includes(a))) {
    const code = String(args[args.findIndex((a) => flagsCode.includes(a)) + 1] || "");
    ajouter({ code });
    // Les textes cités du code (system("…"), execSync('…')) peuvent être des commandes.
    for (const t of code.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) script(t[2], "bash");
    return;
  }
  if (GESTIONNAIRES.has(cmd)) {
    ajouter();
    const reste = retirerOptions(args.slice(), ["--filter", "-F", "-C", "--dir", "--prefix", "-w", "--workspace", "--cwd"]);
    if (["dlx", "exec", "x"].includes(reste[0])) {
      reste.shift();
      retirerOptions(reste, ["-p", "--package", "-c"]);
      if (reste.length) sousCommande(reste);
    } else if (reste.length && !SOUS_COMMANDES_GESTIONNAIRE.has(reste[0])) sousCommande(reste);
    return;
  }
  if (cmd === "find") {
    ajouter();
    const k = args.findIndex((a) => ["-exec", "-execdir", "-ok", "-okdir"].includes(a));
    if (k >= 0) {
      const fin = args.findIndex((a, j) => j > k && (a === ";" || a === "+" || a === "\\;"));
      sousCommande(args.slice(k + 1, fin < 0 ? undefined : fin), { viaFind: true });
    }
    return;
  }
  ajouter();
}

module.exports = { decouper, commandesSimples, optionsGlobalesGit, nomCommande, estOption, flagsCourts, retirerOptions };

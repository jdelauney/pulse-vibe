#!/usr/bin/env node
// Pulse – les secrets du projet, sans jamais afficher une valeur (`pulse-aidd secrets`, /pulse:secrets).
//
//   pulse-aidd secrets inventaire [--json] [--sans-hebergeur]
//   pulse-aidd secrets preparer <NOM> [--fichier .env]
//   pulse-aidd secrets generer <NOM> [--octets 32] [--versionne [--ancien <NOM>] [--seul]] [--envoyer production,preview] [--sans-local]
//   pulse-aidd secrets elaguer <NOM> [--fichier .env]
//   pulse-aidd secrets verifier <NOM> [--fichier .env] [--sans-test]
//   pulse-aidd secrets envoyer <NOM> [--env production,preview] [--depuis .env] [--vider] [--meme-valeur]
//   pulse-aidd secrets redeployer [--env production]
//   pulse-aidd secrets historique [--depuis <commit>]
//   pulse-aidd secrets journal <NOM> <raison> [--revoquee <AAAA-MM-JJ|non>] [--production oui|non]
//
// Règle absolue : aucune sortie ne contient la valeur d'un secret. Les valeurs passent
// du fichier .env à l'hébergeur par l'entrée standard d'un adaptateur fourni par le pack
// de pile déclaré dans docs/technical.md (le cœur ne connaît aucun hébergeur).
// Contrat du pack (outil pulse-pile-<id>) utilisé ici :
//   secrets regles                       JSON : règles par variable (préfixes, groupes, tests, parEnvironnement) et noms lus dans le code
//   secrets tester <NOM>                 test réel ; reçoit sur l'entrée standard un JSON { NOM: valeur, … } ; code 0 bon, 1 mauvais, 3 sans test
//   hebergeur ls                         JSON : { hebergeur, variables: [{ nom, environnements, type }] }, sans valeur
//   hebergeur envoyer <NOM> <env> [--type secret|config]   valeur sur l'entrée standard
//   hebergeur redeployer <env>           relance le dernier déploiement de cet environnement
// Codes de sortie : 0 tout va bien, 1 problème signalé (ou usage incorrect).
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { trouverSecrets, estFichierEnv } = require("./motifs");

const MODELE_SECRETS = path.join(__dirname, "..", "templates", "secrets.md");
const RACINE = process.cwd();
const NOM_VALIDE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PREFIXES_PUBLICS = /^(NEXT_PUBLIC_|VITE_|PUBLIC_|EXPO_PUBLIC_|REACT_APP_|NUXT_PUBLIC_|GATSBY_)/;
const NOM_SECRET = /(SECRET|PASSWORD|PASSWD|PASS$|TOKEN|PRIVATE|_KEY$|_KEYS$|API_KEY|DATABASE_URL|_DSN$|CREDENTIAL)/;
const ENVIRONNEMENTS = ["production", "preview", "development"];
const LIBELLE_ENV = { production: "Production", preview: "Preview", development: "Development" };

// ---------------------------------------------------------------- Sorties

const lignes = [];
const dire = (texte = "") => lignes.push(texte);
// Écriture synchrone : la sortie part en entier avant la fin du processus (tubes Windows compris).
const ecrire = (texte) => fs.writeSync(1, texte);
function terminer(code) {
  if (lignes.length) ecrire(lignes.join("\n") + "\n");
  process.exit(code);
}
function echec(message) {
  dire(message);
  terminer(1);
}

/** Retire toute valeur connue d'un texte venu d'un autre programme (défense en profondeur). */
function masquer(texte, valeurs) {
  let t = String(texte || "");
  for (const v of valeurs) {
    if (!v || v.length < 4) continue;
    t = t.split(v).join("«valeur masquée»");
    // Mot de passe contenu dans une adresse (schéma://nom:mot-de-passe@hôte).
    const m = /^[a-z][a-z0-9+.-]*:\/\/[^:/@\s]+:([^@\s]+)@/i.exec(v);
    if (m && m[1].length >= 4) t = t.split(m[1]).join("«valeur masquée»");
  }
  return t;
}

// ---------------------------------------------------------------- Arguments

function lireArguments(argv) {
  const positionnels = [];
  const options = {};
  const AVEC_VALEUR = new Set(["--fichier", "--octets", "--ancien", "--envoyer", "--env", "--depuis", "--revoquee", "--production"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [cle, val] = a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
      if (AVEC_VALEUR.has(cle)) options[cle] = val !== undefined ? val : argv[++i];
      else options[cle] = true;
    } else positionnels.push(a);
  }
  return { positionnels, options };
}

function listeEnvironnements(texte, defaut) {
  const liste = String(texte || defaut).split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const inconnus = liste.filter((e) => !ENVIRONNEMENTS.includes(e));
  if (inconnus.length) echec(`❌ Environnement inconnu : ${inconnus.join(", ")}. Choix possibles : ${ENVIRONNEMENTS.join(", ")}.`);
  return [...new Set(liste)];
}

function exigerNom(nom, usage) {
  if (!nom || !NOM_VALIDE.test(nom)) echec(`Usage : ${usage}\nLe nom d'une variable s'écrit en lettres, chiffres et _ (ex. STRIPE_SECRET_KEY).`);
  return nom;
}

// ---------------------------------------------------------------- Fichiers d'environnement

/** Lit un fichier d'environnement : lignes, fin de ligne, définitions (sans rien afficher). */
function lireFichierEnv(fichier) {
  const chemin = path.resolve(RACINE, fichier);
  if (!fs.existsSync(chemin)) return { chemin, existe: false, fin: "\n", lignes: [], definitions: [] };
  const texte = fs.readFileSync(chemin, "utf8");
  const fin = texte.includes("\r\n") ? "\r\n" : "\n";
  const lignesFichier = texte.split(/\r?\n/);
  if (lignesFichier.length && lignesFichier[lignesFichier.length - 1] === "") lignesFichier.pop();
  const definitions = [];
  lignesFichier.forEach((ligne, index) => {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=(.*)$/.exec(ligne);
    if (m) definitions.push({ nom: m[1], brut: m[2], index });
  });
  return { chemin, existe: true, fin, crlf: fin === "\r\n", lignes: lignesFichier, definitions };
}

/** Interprète une valeur brute comme le fait dotenv (Next.js, Vite…), et relève les pièges de copier-coller. */
function analyserValeur(brut) {
  const anomalies = [];
  const t = brut.replace(/\r$/, "").trim();
  let valeur;
  const q = t[0];
  if (q === '"' || q === "'" || q === "`") {
    const finQ = t.indexOf(q, 1);
    if (finQ === -1) {
      anomalies.push("guillemet ouvert mais jamais refermé : la valeur lue garderait le guillemet");
      valeur = t;
    } else {
      valeur = t.slice(1, finQ);
      if (q === '"') valeur = valeur.replace(/\\n/g, "\n");
      if (/^\s|\s$/.test(valeur)) anomalies.push("espace au début ou à la fin, entre les guillemets (souvent un copier-coller)");
      if (t.slice(finQ + 1).trim() && !/^\s*#/.test(t.slice(finQ + 1))) anomalies.push("texte après le guillemet fermant");
    }
  } else {
    const diese = t.indexOf("#");
    valeur = (diese === -1 ? t : t.slice(0, diese)).trim();
    if (diese > 0 && !/\s#/.test(t)) anomalies.push("contient # : sans guillemets, la fin de la valeur serait ignorée ; entourez la valeur de guillemets");
    if (/\s/.test(valeur)) anomalies.push("espace au milieu de la valeur (deux valeurs collées à la suite ?)");
  }
  if (/^(VOTRE_|YOUR_|CHANGE_?ME|XXX|<|\.\.\.)/i.test(valeur)) anomalies.push("ressemble à une valeur d'exemple, pas à une vraie valeur");
  return { valeur, anomalies };
}

function lireVariable(fichier, nom) {
  const env = lireFichierEnv(fichier);
  const defs = env.definitions.filter((d) => d.nom === nom);
  if (!defs.length) return { env, present: false, valeur: "", anomalies: [] };
  const derniere = defs[defs.length - 1]; // dotenv garde la dernière définition
  const { valeur, anomalies } = analyserValeur(derniere.brut);
  if (defs.length > 1) anomalies.push(`définie ${defs.length} fois dans ${fichier} : seule la dernière compte`);
  return { env, present: true, valeur, anomalies };
}

/** Écrit NOM=valeur (remplace la dernière définition ou ajoute la ligne), en une écriture atomique. */
function ecrireVariable(fichier, nom, valeur) {
  const env = lireFichierEnv(fichier);
  const lignesFichier = env.lignes.slice();
  const defs = env.definitions.filter((d) => d.nom === nom);
  const ligne = `${nom}=${valeur}`;
  if (defs.length) lignesFichier[defs[defs.length - 1].index] = ligne;
  else lignesFichier.push(ligne);
  const contenu = lignesFichier.join(env.fin) + env.fin;
  fs.mkdirSync(path.dirname(env.chemin), { recursive: true });
  const provisoire = `${env.chemin}.pulse-provisoire`;
  fs.writeFileSync(provisoire, contenu, { mode: 0o600 });
  fs.renameSync(provisoire, env.chemin);
}

// ---------------------------------------------------------------- Git

function git(args, options = {}) {
  const r = spawnSync("git", args, { cwd: RACINE, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 60000, ...options });
  return r.status === 0 ? r.stdout : null;
}
const dansDepotGit = () => git(["rev-parse", "--is-inside-work-tree"]) !== null;
const estIgnore = (fichier) => spawnSync("git", ["check-ignore", "-q", fichier], { cwd: RACINE }).status === 0;
const estSuivi = (fichier) => (git(["ls-files", "--", fichier]) || "").trim() !== "";

/** Vérifie que le fichier de secrets reste hors de Git ; complète .gitignore si besoin. Rend un message d'arrêt ou null. */
function protegerFichier(fichier) {
  if (!dansDepotGit()) return null;
  if (estSuivi(fichier)) {
    return `⛔ ${fichier} est enregistré dans Git : ses valeurs partiraient sur le dépôt distant.\n` +
      `À faire avant tout : retirer le fichier de Git (« git rm --cached ${fichier} », puis un commit) ; si des vraies valeurs y sont déjà passées, lancer /pulse:secrets fuite.`;
  }
  if (!estIgnore(fichier)) {
    const gi = path.join(RACINE, ".gitignore");
    const existant = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
    const ajout = [".env", ".env.*", "!.env.example"].filter((l) => !existant.split(/\r?\n/).includes(l));
    const nomFichier = path.basename(fichier);
    if (!/^\.env/.test(nomFichier)) ajout.push(nomFichier);
    if (ajout.length) {
      fs.writeFileSync(gi, existant + (existant && !existant.endsWith("\n") ? "\n" : "") + "# secrets : jamais dans le dépôt\n" + ajout.join("\n") + "\n");
      dire(`🔒 .gitignore complété (${ajout.join(", ")}) : ${fichier} reste hors de Git.`);
    }
    if (!estIgnore(fichier)) return `⛔ ${fichier} n'est pas ignoré par Git malgré .gitignore : vérifiez .gitignore avant d'y écrire un secret.`;
  }
  return null;
}

// ---------------------------------------------------------------- Pack de pile

function packDeclare() {
  const tech = path.join(RACINE, "docs", "technical.md");
  if (!fs.existsSync(tech)) return null;
  const m = /^\*\*Pack de pile Pulse\*\* *: *([a-z0-9-]+)/m.exec(fs.readFileSync(tech, "utf8"));
  return m ? m[1] : null;
}

function trouverDansPath(nom) {
  for (const dossier of (process.env.PATH || "").split(path.delimiter)) {
    if (!dossier) continue;
    const chemin = path.join(dossier, nom);
    try {
      if (fs.statSync(chemin).isFile()) return chemin;
    } catch (e) {
      // absent de ce dossier
    }
  }
  return null;
}

let packCache;
function pack() {
  if (packCache !== undefined) return packCache;
  const id = packDeclare();
  const outil = id ? trouverDansPath(`pulse-pile-${id}`) : null;
  packCache = { id, outil };
  return packCache;
}

/** Appelle l'outil du pack (par bash, comme pulse-aidd). Rend { ok, code, sortie } ou null sans pack. */
function appelerPack(args, entree, valeurs = []) {
  const { outil } = pack();
  if (!outil) return null;
  const r = spawnSync("bash", [outil, ...args], { cwd: RACINE, input: entree === undefined ? "" : entree, encoding: "utf8", timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  const sortie = masquer(`${r.stdout || ""}${r.stderr || ""}`, valeurs).trim();
  return { ok: r.status === 0, code: r.status, sortie, stdout: masquer(r.stdout || "", valeurs) };
}

function raisonSansPack() {
  const { id, outil } = pack();
  if (!id) return "aucun pack de pile déclaré dans docs/technical.md";
  if (!outil) return `le pack de pile « ${id} » est déclaré mais pas installé`;
  return null;
}

let reglesCache;
function regles() {
  if (reglesCache !== undefined) return reglesCache;
  reglesCache = { variables: {}, code: [] };
  const r = appelerPack(["secrets", "regles"]);
  if (r && r.ok) {
    try {
      const json = JSON.parse(r.stdout);
      reglesCache = { variables: json.variables || {}, code: json.code || [] };
    } catch (e) {
      // règles illisibles : on continue avec les règles génériques
    }
  }
  return reglesCache;
}

function estSecret(nom) {
  const r = regles().variables[nom];
  if (r && typeof r.secret === "boolean") return r.secret;
  return !PREFIXES_PUBLICS.test(nom) && NOM_SECRET.test(nom);
}

// ---------------------------------------------------------------- Journal (docs/secrets.md)

const FICHIER_SECRETS = () => path.join(RACINE, "docs", "secrets.md");

function derniersRenouvellements() {
  const f = FICHIER_SECRETS();
  const dates = {};
  if (!fs.existsSync(f)) return dates;
  const texte = fs.readFileSync(f, "utf8");
  const debut = texte.search(/^## Journal des rotations/m);
  if (debut === -1) return dates;
  for (const ligne of texte.slice(debut).split(/\r?\n/)) {
    const m = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*`?([A-Za-z_][A-Za-z0-9_]*)`?\s*\|/.exec(ligne);
    if (m && (!dates[m[2]] || dates[m[2]] < m[1])) dates[m[2]] = m[1];
  }
  return dates;
}

// ---------------------------------------------------------------- Protection de Claude Code

function regleDenyPresente() {
  for (const f of [path.join(RACINE, ".claude", "settings.json"), path.join(RACINE, ".claude", "settings.local.json")]) {
    try {
      const deny = (JSON.parse(fs.readFileSync(f, "utf8")).permissions || {}).deny || [];
      if (deny.some((r) => /^Read\((\.\/)?\.env\)$/.test(String(r)))) return true;
    } catch (e) {
      // fichier absent ou illisible
    }
  }
  return false;
}

// ---------------------------------------------------------------- inventaire

function inventaire(options) {
  const exemple = lireFichierEnv(".env.example");
  const local = lireFichierEnv(".env");
  const r = regles();
  const noms = new Set([...exemple.definitions.map((d) => d.nom), ...local.definitions.map((d) => d.nom), ...r.code]);

  let hebergeur = null;
  let hebergeurErreur = null;
  if (!options["--sans-hebergeur"]) {
    const sans = raisonSansPack();
    if (sans) hebergeurErreur = sans;
    else {
      const rep = appelerPack(["hebergeur", "ls"]);
      if (rep && rep.ok) {
        try {
          hebergeur = JSON.parse(rep.stdout);
          for (const v of hebergeur.variables || []) noms.add(v.nom);
        } catch (e) {
          hebergeurErreur = "réponse de l'hébergeur illisible";
        }
      } else hebergeurErreur = (rep && rep.sortie.split("\n").pop()) || "hébergeur injoignable";
    }
  }

  const dates = derniersRenouvellements();
  const alertes = [];
  const variables = [...noms].sort().map((nom) => {
    const secret = estSecret(nom);
    const v = lireVariable(".env", nom);
    const surHebergeur = {};
    for (const env of ["production", "preview"]) {
      const trouvees = hebergeur ? (hebergeur.variables || []).filter((x) => x.nom === nom && (x.environnements || []).includes(env)) : [];
      surHebergeur[env] = hebergeur ? { present: trouvees.length > 0, type: trouvees.length ? trouvees[0].type : null } : null;
    }
    const entree = {
      nom,
      secret,
      fournisseur: (r.variables[nom] && r.variables[nom].fournisseur) || null,
      exemple: exemple.definitions.some((d) => d.nom === nom),
      local: { present: v.present, rempli: v.present && v.valeur !== "" },
      hebergeur: surHebergeur,
      dernierRenouvellement: dates[nom] || null,
    };
    if (secret && !entree.exemple) alertes.push({ niveau: "⚠️", message: `${nom} : absente de .env.example (ajoutez le nom, sans valeur).` });
    if (entree.exemple && !entree.local.rempli) alertes.push({ niveau: "⚠️", message: `${nom} : à remplir dans .env (pulse-aidd secrets preparer ${nom}).` });
    if (v.anomalies.length) alertes.push({ niveau: "⚠️", message: `${nom} dans .env : ${v.anomalies.join(" ; ")}.` });
    if (PREFIXES_PUBLICS.test(nom) && NOM_SECRET.test(nom.replace(PREFIXES_PUBLICS, ""))) alertes.push({ niveau: "⚠️", message: `${nom} : nom exposé au navigateur pour une valeur qui semble secrète ; vérifiez qu'elle est prévue pour être publique.` });
    if (hebergeur && secret) {
      for (const env of ["production", "preview"]) {
        const h = surHebergeur[env];
        if (h.present && h.type !== "secret") alertes.push({ niveau: "⛔", message: `${nom} (${LIBELLE_ENV[env]}) : enregistrée en type Config chez l'hébergeur, donc relisible ; à recréer en type Secret.` });
      }
      if (!surHebergeur.production.present && entree.exemple) alertes.push({ niveau: "⚠️", message: `${nom} : absente de l'hébergeur en Production.` });
      if (surHebergeur.production.present && surHebergeur.preview.present) alertes.push({ niveau: "❓", message: `${nom} : présente en Production et en Preview ; les valeurs sont-elles différentes ? (Une valeur Secret ne se relit pas : à vous de le confirmer.)` });
    }
    return entree;
  });

  if (local.existe && dansDepotGit()) {
    if (estSuivi(".env")) alertes.unshift({ niveau: "⛔", message: ".env est enregistré dans Git : lancez /pulse:secrets fuite si de vraies valeurs y sont passées." });
    else if (!estIgnore(".env")) alertes.unshift({ niveau: "⛔", message: ".env n'est pas ignoré par Git : ajoutez .env et .env.* à .gitignore." });
  }
  if (!regleDenyPresente()) alertes.push({ niveau: "⚠️", message: "Claude Code n'a pas de règle qui lui interdit de lire .env : proposez la règle deny (« Read(./.env) », « Read(./.env.local) », « Read(./.env.*.local) », « Read(./.env.envoi) ») dans .claude/settings.json." });

  const resultat = { hebergeur: hebergeur ? hebergeur.hebergeur || "hébergeur" : null, hebergeurErreur, variables, alertes };
  if (options["--json"]) {
    ecrire(JSON.stringify(resultat, null, 2) + "\n");
    process.exit(0);
  }

  const nomHeb = resultat.hebergeur || "Hébergeur";
  dire("Secrets et variables du projet (noms seulement, aucune valeur)");
  dire("");
  if (!variables.length) dire("Aucune variable trouvée (.env.example, .env, code, hébergeur).");
  else {
    dire(`| Variable | Nature | .env.example | .env | ${nomHeb} Production | ${nomHeb} Preview | Dernier renouvellement |`);
    dire("|---|---|---|---|---|---|---|");
    const cellH = (h) => (h === null ? "?" : h.present ? `✅ ${h.type === "secret" ? "Secret" : "Config"}` : "—");
    for (const v of variables) {
      dire(`| ${v.nom} | ${v.secret ? "secret" : "réglage"} | ${v.exemple ? "✅" : "—"} | ${v.local.rempli ? "rempli" : v.local.present ? "vide" : "—"} | ${cellH(v.hebergeur.production)} | ${cellH(v.hebergeur.preview)} | ${v.dernierRenouvellement || "—"} |`);
    }
  }
  if (hebergeurErreur && !options["--sans-hebergeur"]) dire(`\nHébergeur non consulté : ${hebergeurErreur}.`);
  dire("");
  if (alertes.length) {
    dire("Points d'attention :");
    for (const a of alertes) dire(`${a.niveau} ${a.message}`);
  } else dire("✅ Aucun point d'attention.");
  terminer(0);
}

// ---------------------------------------------------------------- preparer

function preparer(nom, options) {
  const fichier = options["--fichier"] || ".env";
  const env = lireFichierEnv(fichier);
  if (!env.existe) {
    const exemple = path.join(RACINE, ".env.example");
    const depart = path.basename(fichier) === ".env" && fs.existsSync(exemple) ? fs.readFileSync(exemple, "utf8").replace(/\r\n/g, "\n") : "";
    // Le modèle ne contient que des noms ; par prudence, on vide toute valeur qui s'y trouverait.
    const contenu = depart.split("\n").map((l) => l.replace(/^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_.-]*\s*=).*$/, "$1")).join("\n");
    fs.mkdirSync(path.dirname(env.chemin), { recursive: true });
    fs.writeFileSync(env.chemin, contenu && !contenu.endsWith("\n") ? contenu + "\n" : contenu, { mode: 0o600 });
    dire(`📄 ${fichier} créé${depart ? " à partir de .env.example (noms seulement)" : ""}.`);
  }
  const arret = protegerFichier(fichier);
  if (arret) echec(arret);
  const v = lireVariable(fichier, nom);
  if (v.present && v.valeur !== "") {
    dire(`✅ ${nom} est déjà remplie dans ${fichier} : rien changé.`);
    terminer(0);
  }
  if (!v.present) ecrireVariable(fichier, nom, "");
  dire(`✅ Ligne « ${nom}= » prête dans ${fichier}. La personne ouvre ${fichier} dans son éditeur, colle la valeur juste après le signe =, enregistre, puis ferme l'onglet.`);
  terminer(0);
}

// ---------------------------------------------------------------- generer, elaguer

function lireVersions(valeur) {
  if (!valeur) return [];
  const entrees = valeur.split(",").map((e) => e.trim()).filter(Boolean);
  const versions = [];
  for (const e of entrees) {
    const m = /^(\d+):(.+)$/.exec(e);
    if (!m) return null;
    versions.push({ version: Number(m[1]), valeur: m[2] });
  }
  return versions;
}
const ecrireVersions = (versions) => versions.map((v) => `${v.version}:${v.valeur}`).join(",");

function aleatoire(octets) {
  return crypto.randomBytes(octets).toString("base64url");
}

function generer(nom, options) {
  const octets = options["--octets"] === undefined ? 32 : Number(options["--octets"]);
  if (!Number.isInteger(octets) || octets < 16 || octets > 128) echec("❌ --octets attend un nombre entier entre 16 et 128 (32 par défaut).");
  const envs = options["--envoyer"] ? listeEnvironnements(options["--envoyer"]) : [];
  if (options["--versionne"] && envs.length) {
    echec("❌ --versionne et --envoyer ne vont pas ensemble : une valeur versionnée garde l'ancienne valeur, que l'hébergeur ne rend pas. " +
      "Générez la valeur versionnée en local, puis envoyez-la avec « pulse-aidd secrets envoyer », ou générez une valeur simple par environnement avec --envoyer.");
  }
  const sansLocal = options["--sans-local"] === true;
  if (sansLocal && !envs.length) echec("❌ --sans-local sert avec --envoyer : sinon la valeur générée n'irait nulle part.");

  if (!sansLocal) {
    const arret = protegerFichier(".env");
    if (arret) echec(arret);
    const nouvelle = aleatoire(octets);
    let ecrite = nouvelle;
    let detail = `${octets} octets, ${nouvelle.length} caractères`;
    if (options["--versionne"]) {
      const actuelle = lireVariable(".env", nom).valeur;
      let versions = lireVersions(actuelle);
      if (versions === null) echec(`❌ ${nom} existe dans .env mais n'a pas la forme « version:valeur,… » : rien changé.`);
      if (!versions.length && options["--ancien"]) {
        const ancien = lireVariable(".env", exigerNom(options["--ancien"], "pulse-aidd secrets generer <NOM> --versionne --ancien <NOM>")).valeur;
        if (ancien) versions = [{ version: 1, valeur: ancien }];
      }
      const suivante = versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
      const gardees = options["--seul"] ? [] : versions;
      ecrite = ecrireVersions([{ version: suivante, valeur: nouvelle }, ...gardees]);
      detail += `, version ${suivante}${gardees.length ? ` ; versions gardées pour relire l'existant : ${gardees.map((v) => v.version).join(", ")}` : " ; aucune ancienne version gardée"}`;
    }
    try {
      ecrireVariable(".env", nom, ecrite);
    } catch (e) {
      echec(`❌ Écriture de .env impossible (${e.code || e.message}) : rien changé.`);
    }
    dire(`✅ ${nom} : nouvelle valeur aléatoire écrite dans .env (${detail}). Rien n'est affiché.`);
  }

  if (envs.length) {
    const sans = raisonSansPack();
    if (sans) echec(`❌ Envoi impossible : ${sans}. ${sansLocal ? "" : "La valeur locale est en place ; "}pour l'hébergeur, suivez sa documentation.`);
    let ok = true;
    for (const env of envs) {
      const valeur = aleatoire(octets); // une valeur différente par environnement
      const r = appelerPack(["hebergeur", "envoyer", nom, env, "--type", "secret"], valeur, [valeur]);
      ok = ok && r.ok;
      dire(`${r.ok ? "✅" : "❌"} ${LIBELLE_ENV[env]} : ${r.sortie.split("\n").filter(Boolean).pop() || (r.ok ? "envoyée" : "échec")}`);
    }
    dire(ok ? `Valeurs distinctes pour ${envs.map((e) => LIBELLE_ENV[e]).join(" et ")}${sansLocal ? "" : " et pour .env"}. ➡️ Redéployez : pulse-aidd secrets redeployer --env ${envs.join(",")}` : "⚠️ Envoi incomplet : relancez la commande pour les environnements en échec.");
    terminer(ok ? 0 : 1);
  }
  terminer(0);
}

function elaguer(nom, options) {
  const fichier = options["--fichier"] || ".env";
  const v = lireVariable(fichier, nom);
  const versions = lireVersions(v.valeur);
  if (!v.present || !versions || !versions.length) echec(`❌ ${nom} n'a pas de valeur versionnée (« version:valeur,… ») dans ${fichier} : rien changé.`);
  if (versions.length === 1) {
    dire(`✅ ${nom} n'a déjà qu'une version (${versions[0].version}) : rien changé.`);
    terminer(0);
  }
  ecrireVariable(fichier, nom, ecrireVersions([versions[0]]));
  dire(`✅ ${nom} : seule la version ${versions[0].version} reste dans ${fichier} (retirées : ${versions.slice(1).map((x) => x.version).join(", ")}). Envoyez-la ensuite à l'hébergeur et redéployez.`);
  terminer(0);
}

// ---------------------------------------------------------------- verifier

function verifier(nom, options) {
  const fichier = options["--fichier"] || ".env";
  const v = lireVariable(fichier, nom);
  dire(`Vérification de ${nom} dans ${fichier} (aucune valeur affichée)`);
  if (!lireFichierEnv(fichier).existe) echec(`❌ ${fichier} n'existe pas : pulse-aidd secrets preparer ${nom}`);
  if (!v.present) echec(`❌ absente de ${fichier} : pulse-aidd secrets preparer ${nom}`);
  if (v.valeur === "") echec(`❌ vide : la personne colle la valeur dans ${fichier}, enregistre et ferme l'onglet.`);
  let ok = true;
  dire(`✅ présente et remplie (${v.valeur.length} caractères)`);
  for (const a of v.anomalies) {
    ok = false;
    dire(`❌ ${a}`);
  }
  if (lireFichierEnv(fichier).crlf) dire("ℹ️ fichier en fins de ligne Windows : sans effet, elles sont ignorées.");
  const r = regles().variables[nom];
  if (r) {
    if (Array.isArray(r.prefixes) && r.prefixes.length) {
      const trouve = r.prefixes.find((p) => v.valeur.startsWith(p));
      if (trouve) dire(`✅ commence par « ${trouve} »${r.modes && r.modes[trouve] ? ` (${r.modes[trouve]})` : ""}`);
      else {
        ok = false;
        dire(`❌ ne commence par aucun préfixe attendu (${r.prefixes.map((p) => `« ${p} »`).join(", ")}) : mauvaise valeur copiée ?`);
      }
    }
    if (r.longueurMin && v.valeur.length < r.longueurMin) {
      ok = false;
      dire(`❌ trop courte : ${r.longueurMin} caractères au moins.`);
    }
    if (Array.isArray(r.groupe) && r.groupe.length > 1) dire(`ℹ️ à renouveler ensemble : ${r.groupe.join(", ")}`);
  }
  if (!options["--sans-test"]) {
    const sans = raisonSansPack();
    if (sans) dire(`⚪ test réel non fait : ${sans} ; testez la fonction concernée à la main.`);
    else {
      const besoins = new Set([nom, ...((r && r.besoins) || [])]);
      const valeurs = {};
      for (const b of besoins) valeurs[b] = lireVariable(fichier, b).valeur;
      // Les réglages publics (serveur, bucket) restent lisibles dans le message ; les secrets sont masqués.
      const aMasquer = Object.entries(valeurs).filter(([n]) => n === nom || estSecret(n)).map(([, x]) => x);
      const rep = appelerPack(["secrets", "tester", nom], JSON.stringify(valeurs), aMasquer);
      const message = rep.sortie.split("\n").filter(Boolean).pop() || "";
      if (rep.code === 3) dire(`⚪ ${message.replace(/^⚪\s*/, "") || "pas de test réel pour cette variable"}`);
      else if (rep.ok) dire(`✅ test réel : ${message.replace(/^✅\s*/, "")}`);
      else {
        ok = false;
        dire(`❌ test réel : ${message.replace(/^❌\s*/, "") || "échec"}`);
      }
    }
  }
  terminer(ok ? 0 : 1);
}

// ---------------------------------------------------------------- envoyer, redeployer

function envoyer(nom, options) {
  const source = options["--depuis"] || ".env";
  const envs = listeEnvironnements(options["--env"], "production,preview");
  // Variable propre à chaque environnement (règle « parEnvironnement » du pack) : la valeur de .env sert au
  // développement ; celle de la production arrive par .env.envoi, sauf si la personne confirme qu'elle est la même.
  const regle = regles().variables[nom];
  if (regle && regle.parEnvironnement && source === ".env" && envs.includes("production") && !options["--meme-valeur"]) {
    echec(
      `⚠️ ${nom} est propre à chaque environnement : la valeur de .env sert au développement. Rien envoyé.
` +
        `   Valeur de production : pulse-aidd secrets preparer ${nom} --fichier .env.envoi ; la personne y colle la valeur ; puis pulse-aidd secrets envoyer ${nom} --env production --depuis .env.envoi --vider.
` +
        `   La personne confirme que la valeur de .env est aussi celle de la production : relancez avec --meme-valeur.`
    );
  }
  const v = lireVariable(source, nom);
  if (!v.present || v.valeur === "") echec(`❌ ${nom} est ${v.present ? "vide" : "absente"} dans ${source} : rien envoyé (une valeur vide remplacerait la bonne). pulse-aidd secrets preparer ${nom}${source !== ".env" ? ` --fichier ${source}` : ""}`);
  if (v.anomalies.length) echec(`❌ ${nom} dans ${source} : ${v.anomalies.join(" ; ")}. Rien envoyé : corrigez la ligne, puis relancez.`);
  const sans = raisonSansPack();
  if (sans) echec(`❌ Envoi automatique impossible : ${sans}. La personne saisit la valeur elle-même dans les réglages de l'hébergeur.`);
  const type = estSecret(nom) ? "secret" : "config";
  let ok = true;
  for (const env of envs) {
    const r = appelerPack(["hebergeur", "envoyer", nom, env, "--type", type], v.valeur, [v.valeur]);
    ok = ok && r.ok;
    dire(`${r.ok ? "✅" : "❌"} ${LIBELLE_ENV[env]} : ${r.sortie.split("\n").filter(Boolean).pop() || (r.ok ? "envoyée" : "échec")}`);
  }
  const r = regles().variables[nom];
  if (r && r.genere && envs.length > 1) dire(`ℹ️ La même valeur part en ${envs.map((e) => LIBELLE_ENV[e]).join(" et ")}. Pour un secret généré, préférez une valeur par environnement : pulse-aidd secrets generer ${nom} --envoyer ${envs.join(",")}`);
  if (r && Array.isArray(r.groupe)) {
    const autres = r.groupe.filter((g) => g !== nom);
    if (autres.length) dire(`ℹ️ À envoyer aussi : ${autres.join(", ")} (elles changent ensemble).`);
  }
  if (!ok) {
    dire("⚠️ Envoi incomplet : la rotation n'est pas terminée. Relancez pour les environnements en échec avant de révoquer quoi que ce soit.");
    terminer(1);
  }
  if (options["--vider"]) {
    ecrireVariable(source, nom, "");
    dire(`🧹 Valeur retirée de ${source} (elle vit maintenant chez le fournisseur et l'hébergeur).`);
  }
  dire(`➡️ Une variable modifiée sert au prochain déploiement : pulse-aidd secrets redeployer --env ${envs.join(",")}`);
  terminer(0);
}

function redeployer(options) {
  const envs = listeEnvironnements(options["--env"], "production");
  const sans = raisonSansPack();
  if (sans) echec(`❌ Redéploiement automatique impossible : ${sans}. Relancez le dernier déploiement depuis le tableau de bord de l'hébergeur.`);
  let ok = true;
  for (const env of envs) {
    const r = appelerPack(["hebergeur", "redeployer", env]);
    ok = ok && r.ok;
    dire(`${r.ok ? "✅" : "❌"} ${LIBELLE_ENV[env]} : ${r.sortie.split("\n").filter(Boolean).pop() || (r.ok ? "redéploiement lancé" : "échec")}`);
  }
  terminer(ok ? 0 : 1);
}

// ---------------------------------------------------------------- historique

function historique(options) {
  if (!dansDepotGit()) echec("❌ Ce dossier n'est pas un dépôt Git : aucun historique à examiner.");
  const portee = options["--depuis"] ? [`${options["--depuis"]}..HEAD`] : ["--all"];
  const sortie = git(["log", ...portee, "-p", "-U0", "--no-color", "--no-ext-diff", "--no-renames", "--date=short", "--format=%x00%h%x09%ad%x09%s"]);
  if (sortie === null) echec("❌ Lecture de l'historique Git impossible (référence --depuis inconnue ?).");
  const traces = [];
  for (const bloc of sortie.split("\u0000").filter(Boolean)) {
    const [entete, ...reste] = bloc.split("\n");
    const [hash, date] = entete.split("\t");
    for (const partie of reste.join("\n").split(/^diff --git /m).slice(1)) {
      const fichier = ((/^\+\+\+ b\/(.+)$/m.exec(partie) || /^a\/(.+?) b\//.exec(partie) || [])[1] || "?").trim();
      const ajoutees = partie.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).join("\n");
      const types = estFichierEnv(fichier) ? (/^new file mode/m.test(partie) || ajoutees ? ["fichier d'environnement enregistré"] : []) : trouverSecrets(ajoutees);
      if (types.length) traces.push({ hash, date, fichier, types });
    }
  }
  dire("Recherche de secrets dans tout l'historique Git (aucune valeur affichée)");
  if (!traces.length) {
    dire("✅ Aucune trace de clé secrète ni de fichier d'environnement dans l'historique.");
    terminer(0);
  }
  const suivis = new Set((git(["ls-files"]) || "").split("\n"));
  for (const t of traces) {
    const actuel = suivis.has(t.fichier) ? trouverSecrets(git(["show", `HEAD:${t.fichier}`]) || "").length > 0 || estFichierEnv(t.fichier) : false;
    dire(`⛔ ${t.hash} (${t.date}) ${t.fichier} : ${t.types.join(", ")}${actuel ? " – encore présent dans la version actuelle" : " – retiré depuis, mais toujours lisible dans l'historique"}`);
  }
  const distants = (git(["remote"]) || "").trim();
  if (!distants) dire("ℹ️ Aucun dépôt distant : l'historique n'a pas quitté cet ordinateur par Git.");
  else {
    const gh = spawnSync("gh", ["repo", "view", "--json", "visibility", "-q", ".visibility"], { cwd: RACINE, encoding: "utf8", timeout: 15000 });
    const visibilite = gh.status === 0 ? gh.stdout.trim().toLowerCase() : "";
    if (visibilite === "public") dire("🔴 Le dépôt distant est PUBLIC : chaque clé ci-dessus est à considérer comme exposée. /pulse:secrets fuite");
    else if (visibilite) dire(`ℹ️ Dépôt distant ${visibilite === "private" ? "privé" : visibilite} : les personnes et outils qui y ont accès ont pu lire ces clés.`);
    else dire("ℹ️ Visibilité du dépôt distant inconnue (vérifiez sur le site du dépôt) : public = clés exposées.");
  }
  dire("➡️ Une clé trouvée ici se révoque chez son fournisseur : /pulse:secrets fuite. Effacer l'historique ne suffit pas.");
  terminer(1);
}

// ---------------------------------------------------------------- journal

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function journal(nom, raison, options) {
  if (!raison) echec("Usage : pulse-aidd secrets journal <NOM> <raison> [--revoquee <AAAA-MM-JJ|non>] [--production oui|non]");
  if (trouverSecrets(raison).length) echec("❌ La raison ressemble à une clé secrète : rien écrit. Décrivez la raison en quelques mots.");
  const nettoyer = (t) => String(t).replace(/[|\r\n]+/g, " / ").trim();
  const revoquee = options["--revoquee"] ? nettoyer(options["--revoquee"]) : "à faire";
  const production = options["--production"] ? nettoyer(options["--production"]) : "à vérifier";
  const f = FICHIER_SECRETS();
  if (!fs.existsSync(f)) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.copyFileSync(MODELE_SECRETS, f);
    dire("📄 docs/secrets.md créé à partir du modèle.");
  }
  const texte = fs.readFileSync(f, "utf8");
  const fin = texte.includes("\r\n") ? "\r\n" : "\n";
  const lignesFichier = texte.split(/\r?\n/);
  const titre = lignesFichier.findIndex((l) => /^## Journal des rotations/.test(l));
  const ligne = `| ${aujourdhui()} | \`${nom}\` | ${nettoyer(raison)} | ${revoquee} | ${production} |`;
  if (titre === -1) {
    if (lignesFichier[lignesFichier.length - 1] === "") lignesFichier.pop();
    lignesFichier.push("", "## Journal des rotations", "", "| Date | Variable | Raison | Ancienne valeur révoquée le | Vérifiée en production |", "|---|---|---|---|---|", ligne, "");
  } else {
    let i = titre + 1;
    while (i < lignesFichier.length && !lignesFichier[i].startsWith("|")) i++;
    while (i < lignesFichier.length && lignesFichier[i].startsWith("|")) i++;
    // Une ligne d'exemple du modèle ({{…}}) est remplacée par la première vraie ligne.
    if (i > 0 && /\{\{/.test(lignesFichier[i - 1])) lignesFichier[i - 1] = ligne;
    else lignesFichier.splice(i, 0, ligne);
  }
  fs.writeFileSync(f, lignesFichier.join(fin));
  dire(`✅ Journal des rotations : ${nom} – ${nettoyer(raison)} (docs/secrets.md).`);
  terminer(0);
}

// ---------------------------------------------------------------- Point d'entrée

const AIDE = `pulse-aidd secrets – les secrets du projet, sans jamais afficher une valeur

  inventaire [--json] [--sans-hebergeur]   noms, présence (.env.example, .env, hébergeur), type, dernier renouvellement, points d'attention
  preparer <NOM> [--fichier .env]          ajoute la ligne « NOM= » (sans valeur) ; crée le fichier ; le garde hors de Git
  generer <NOM> [--octets 32]              écrit une valeur aléatoire dans .env, sans l'afficher
           [--versionne [--ancien <NOM>] [--seul]]   forme « version:valeur,… » (rotation douce) ; --seul : sans les anciennes
           [--envoyer production,preview] [--sans-local]   une valeur différente par environnement, envoyée à l'hébergeur
  elaguer <NOM> [--fichier .env]           garde seulement la version la plus récente d'une valeur versionnée
  verifier <NOM> [--fichier .env] [--sans-test]   présence, pièges de copier-coller, préfixe attendu, test réel (pack)
  envoyer <NOM> [--env production,preview] [--depuis .env] [--vider]   vers l'hébergeur par l'entrée standard
           [--meme-valeur]                 variable propre à chaque environnement : la valeur de .env part aussi en production
  redeployer [--env production]            relance le dernier déploiement (une variable sert au déploiement suivant)
  historique [--depuis <commit>]           clés et fichiers d'environnement passés dans l'historique Git (code 1 si trouvés)
  journal <NOM> <raison> [--revoquee <AAAA-MM-JJ|non>] [--production oui|non]   ligne du journal de docs/secrets.md`;

function principal() {
  const [action, ...reste] = process.argv.slice(2);
  const { positionnels, options } = lireArguments(reste);
  switch (action || "inventaire") {
    case "inventaire":
      return inventaire(options);
    case "preparer":
      return preparer(exigerNom(positionnels[0], "pulse-aidd secrets preparer <NOM> [--fichier .env]"), options);
    case "generer":
      return generer(exigerNom(positionnels[0], "pulse-aidd secrets generer <NOM> [--octets 32] [--versionne] [--envoyer production,preview]"), options);
    case "elaguer":
      return elaguer(exigerNom(positionnels[0], "pulse-aidd secrets elaguer <NOM>"), options);
    case "verifier":
      return verifier(exigerNom(positionnels[0], "pulse-aidd secrets verifier <NOM> [--fichier .env]"), options);
    case "envoyer":
      return envoyer(exigerNom(positionnels[0], "pulse-aidd secrets envoyer <NOM> [--env production,preview]"), options);
    case "redeployer":
      return redeployer(options);
    case "historique":
      return historique(options);
    case "journal":
      return journal(exigerNom(positionnels[0], "pulse-aidd secrets journal <NOM> <raison>"), positionnels.slice(1).join(" "), options);
    default:
      echec(AIDE);
  }
}

principal();

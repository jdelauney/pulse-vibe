#!/usr/bin/env node
// Contrôle automatique du projet, à lancer avant chaque mise en ligne et dans la CI
// (installé par /pulse:cicd, via pulse-aidd installer-ci).
//
// Vérifie que :
//  1. aucun fichier d'environnement (.env, .env.*) n'est enregistré dans Git ;
//  2. aucun fichier ne contient de clé secrète ;
//  3. (projet Pulse) chaque scénario automatisé (@unitaire, @integration, @bout-en-bout) d'une US
//     dont le plan est terminé est cité par au moins un test (son étiquette, ex. US-003-1) ;
//  4. (projet Pulse) chaque règle du projet qui porte un contrôle est respectée (aidd_docs/memory/technical.md,
//     « - <règle> — Contrôle : interdit|obligatoire `motif` dans `portée` »).
// En cas de problème, le script s'arrête en erreur : la mise en ligne doit être annulée.
//
//   node scripts/verifier.js               les quatre contrôles
//   node scripts/verifier.js --scenarios   l'état de couverture des scénarios de tous les plans, sans échouer
//   node scripts/verifier.js --index       les fichiers prêts à être enregistrés (contrôle avant commit) : secrets et règles, sans les scénarios
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// DEBUT-MOTIFS
// Valeurs d'exemple : hôte local, mot de passe de démonstration.
const HOTE_LOCAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal|example\.(com|org|net))(:\d+)?$/i;
// Hôte sans point (nom de service : db, postgres, redis…) : un exemple seulement avec un mot de passe d'exemple.
const HOTE_SANS_POINT = /^[a-z0-9_-]+(:\d+)?$/i;
const VALEUR_EXEMPLE = /^(password|passwd|motdepasse|mot_de_passe|mdp|postgres|root|secret|changeme|change_me|example|exemple|test|pass|user|admin|x+|\*+|\.+|<[^>]*>|\$\{[^}]*\}|\{\{[^}]*\}\}|(votre|your)[_-](cle|clé|key|secret|mot[_-]?de[_-]?passe|password|token)\w*)$/i;
// Un mot de passe tiré au hasard ; app:app@db ou postgres:postgres@db n'en sont pas.
const motDePasseAleatoire = (mdp, utilisateur) =>
  mdp !== utilisateur && !/(pass|secret|change|exemple|example|test|demo)/i.test(mdp) && ((/\d/.test(mdp) && /[a-z]/.test(mdp) && /[A-Z]/.test(mdp)) || (mdp.length >= 16 && /\d/.test(mdp) && /[A-Za-z]/.test(mdp)));
// m[1] : utilisateur, m[2] : mot de passe, m[3] : hôte.
const adresseReelle = (m) => !VALEUR_EXEMPLE.test(m[2]) && !HOTE_LOCAL.test(m[3]) && (!HOTE_SANS_POINT.test(m[3]) || motDePasseAleatoire(m[2], m[1]));
// Des noms, pas des secrets : STRIPE_WEBHOOK_SECRET_V2, un UUID, une clé de traduction (auth.passwordHint.label2).
const NOM_MAJUSCULES = /^[A-Z0-9]+(?:_[A-Z0-9]+){2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLE_TRADUCTION = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*){2,}$/;
// Du texte lisible (generateToken2FA, SecretManagerClient2024, src/lib/secretsManager2.ts), pas une valeur tirée au hasard.
const motsDe = (v) => (v.match(/[A-Z]?[a-z]{3,}/g) || []).join("").length;
const texteLisible = (v) => (v.includes("/") && !(v.length >= 32 && /^[A-Za-z0-9+/=]+$/.test(v))) || (v.length < 40 && motsDe(v) / v.length >= 0.35);
// Valeur entre guillemets sous un nom en MAJUSCULES_SNAKE : le texte lisible reste signalé ; ailleurs (camelCase, sans guillemets), il est du code.
const valeurReelle = (v, prudent) =>
  !VALEUR_EXEMPLE.test(v) && !(prudent && texteLisible(v)) && !NOM_MAJUSCULES.test(v) && !UUID.test(v) && !CLE_TRADUCTION.test(v) && !/^(votre|your|change|exemple|example|xxx)/i.test(v) && !/(test|fake|factice|exemple|example|dummy|mock|demo)/i.test(v) && /^[A-Za-z0-9_+\/=.-]+$/.test(v) && !v.includes("://") && (/^[0-9a-f]{32,}$/i.test(v) || (/\d/.test(v) && /[a-z]/.test(v) && /[A-Z]/.test(v)) || (v.length >= 24 && /\d/.test(v) && /[A-Za-z]/.test(v) && !/^_*[a-z0-9]+(?:[-._]+[a-z0-9]+){2,}$/.test(v)));
// Noms qui annoncent un secret, quelle que soit la casse (apiKey, client_secret, DB_PASSWORD), et les suffixes _PASS / Pass (DB_PASS, dbPass).
const NOM_SECRET = /(secret|password|passwd|token|api[_-]?key|private[_-]?key)/i;
const NOM_MAJUSCULES_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const nomSecret = (n) => NOM_SECRET.test(n) || /(?:_PASS|_pass|[a-z0-9]Pass)$/.test(n);
// Une référence (process.env.R2_SECRET_2, config.auth.token), pas une valeur.
const CHAINE_IDENTIFIANTS = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/;

const MOTIFS = [
  { nom: "clé secrète (Stripe ou Clerk)", re: /\b[rs]k_(?:live|test)_[0-9a-zA-Z]{16,}/ },
  { nom: "secret de webhook Stripe", re: /\bwhsec_[0-9a-zA-Z]{20,}/ },
  { nom: "clé secrète Supabase", re: /\bsb_secret_[0-9a-zA-Z_-]{16,}/ },
  { nom: "clé Anthropic", re: /\bsk-ant-[0-9a-zA-Z_-]{20,}/ },
  { nom: "clé OpenAI", re: /\bsk-(?:proj-)?[0-9a-zA-Z_-]{32,}/g, garder: (m) => /\d/.test(m[0]) && /[A-Za-z]/.test(m[0].slice(3)) },
  { nom: "jeton GitHub", re: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[0-9a-zA-Z_.-]{20,}/ },
  { nom: "jeton GitLab", re: /\bglpat-[0-9A-Za-z_-]{20,}/ },
  { nom: "jeton npm", re: /\bnpm_[0-9A-Za-z]{36}\b/ },
  { nom: "jeton Hugging Face", re: /\bhf_[0-9A-Za-z]{30,}/ },
  { nom: "clé Groq", re: /\bgsk_[0-9A-Za-z]{40,}/ },
  { nom: "jeton Replicate", re: /\br8_[0-9A-Za-z]{30,}/ },
  { nom: "clé AWS", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { nom: "clé SendGrid", re: /\bSG\.[0-9a-zA-Z_-]{16,}\.[0-9a-zA-Z_-]{16,}/ },
  { nom: "jeton Slack", re: /\bxox[abprs]-[0-9a-zA-Z-]{10,}/ },
  { nom: "clé privée", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nom: "mot de passe dans une adresse de base de données", re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?):\/\/([^:\s/@]+):([^@\s]{3,})@([^/\s?#"'`]+)/g, garder: adresseReelle },
  { nom: "mot de passe dans une adresse web", re: /\bhttps?:\/\/([^:\s/@]+):([^@\s]{3,})@([^/\s?#"'`]+)/g, garder: adresseReelle },
  { nom: "secret client Google OAuth", re: /\bGOCSPX-[0-9A-Za-z_-]{28}(?![0-9A-Za-z_-])/ },
  { nom: "jeton d'accès Google", re: /\bya29\.[0-9A-Za-z_-]{20,}/ },
  { nom: "jeton de rafraîchissement Google", re: /\b1\/\/0[0-9A-Za-z_-]{30,}/ },
  { nom: "clé d'API Google", re: /\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/ },
  { nom: "clé d'API Brevo", re: /\bxkeysib-[a-f0-9]{64}-[0-9A-Za-z]{16}\b/ },
  { nom: "clé d'API Neon", re: /\bnapi_[0-9a-z]{40,}/ },
  { nom: "jeton Vercel", re: /\bvc[pkiar]_[0-9A-Za-z]{24,}/ },
  { nom: "jeton d'API Cloudflare", re: /\bcf(?:k|ut|at)_[0-9A-Za-z]{40,}/ },
  // Valeur entre guillemets : const apiKey = "…", { secret: "…" }, "password": "…".
  { nom: "secret en clair", re: /(?<![\w$.-])([A-Za-z_][\w-]*)["']?[ \t]*[:=][ \t]*["'`]([^"'`\s]{16,})["'`]/g, garder: (m) => nomSecret(m[1]) && valeurReelle(m[2], !NOM_MAJUSCULES_SNAKE.test(m[1])) },
  // Valeur sans guillemets, seule sur sa ligne : AUTH_SECRET=…, export CLIENT_SECRET=…, password: … (YAML).
  { nom: "secret en clair", re: /^[ \t]*(?:export[ \t]+)?([A-Za-z_][\w-]*)[ \t]*[:=][ \t]*([A-Za-z0-9_+\/=.-]{16,})[ \t]*$/gm, garder: (m) => nomSecret(m[1]) && valeurReelle(m[2], true) && !CHAINE_IDENTIFIANTS.test(m[2]) },
];

// Clé Resend : "re_" suivi d'un mélange de chiffres et de majuscules.
const RESEND = /\bre_[0-9a-zA-Z]{6,}_[0-9a-zA-Z]{12,}\b/g;

// Jeton JWT (ex. clés Supabase). Seul le rôle "service_role" est secret ;
// la clé "anon" est publique par conception.
const JWT = /\beyJ[0-9a-zA-Z_-]{10,}\.(eyJ[0-9a-zA-Z_-]{10,})\.[0-9a-zA-Z_-]{10,}/g;

function roleJwt(segment) {
  try {
    const json = Buffer.from(segment.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json).role || null;
  } catch (e) {
    return null;
  }
}

/** Retourne la liste des types de secrets trouvés dans un texte (sans doublon). */
function trouverSecrets(texte) {
  if (!texte || typeof texte !== "string") return [];
  const trouves = new Set();
  for (const m of MOTIFS) {
    if (!m.garder) {
      if (m.re.test(texte)) trouves.add(m.nom);
      continue;
    }
    for (const r of texte.matchAll(m.re))
      if (m.garder(r)) {
        trouves.add(m.nom);
        break;
      }
  }
  for (const r of texte.match(RESEND) || []) {
    if (/\d/.test(r) && /[A-Z]/.test(r)) trouves.add("clé Resend");
  }
  let j;
  JWT.lastIndex = 0;
  while ((j = JWT.exec(texte)) !== null) {
    if (roleJwt(j[1]) === "service_role") trouves.add("clé service_role Supabase");
  }
  return [...trouves];
}

// Fichiers de code nommés comme un fichier d'environnement (.env.ts, .env.mjs) : du code, pas des secrets.
const EXTENSIONS_CODE = /\.(?:d\.ts|[cm]?[jt]sx?|py|rb|go|rs|php|vue|svelte|astro)$/i;

/** Nom de fichier tel que le système le lit : sans « / » ni « /. » finaux, sans flux NTFS (::$DATA, :flux), sans points ni espaces finaux (Windows les ignore). */
function nomReel(chemin) {
  const segments = String(chemin).trim().split(/[\\/]/).filter((s) => s !== "" && s !== ".");
  return (segments.pop() || "").replace(/::\$\w+$/, "").replace(/(.):[^:]*$/, "$1").replace(/[. ]+$/, "");
}

/** Vrai pour .env, .env.local, .ENV, .dev.vars, .envrc, y compris sous un chemin déguisé (.env/, .env::$DATA) ; faux pour .env.example, .env.sample, .env.template et le code (.env.ts). */
function estFichierEnv(chemin) {
  const nom = nomReel(chemin).toLowerCase();
  if (/^\.env\.(example|sample|template)$/.test(nom) || EXTENSIONS_CODE.test(nom)) return false;
  return /^\.env(\..+)?$/.test(nom) || nom === ".dev.vars" || nom === ".envrc";
}
// FIN-MOTIFS

const IGNORES = new Set([".git", "node_modules", ".netlify"]);

function listerFichiers() {
  try {
    const sortie = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const liste = sortie.split("\u0000").filter(Boolean);
    if (liste.length) return liste;
  } catch (e) {
    // pas de Git : on parcourt le dossier
  }
  const resultat = [];
  (function parcourir(dossier) {
    for (const nom of fs.readdirSync(dossier)) {
      if (IGNORES.has(nom)) continue;
      const chemin = path.join(dossier, nom);
      const st = fs.statSync(chemin);
      if (st.isDirectory()) parcourir(chemin);
      else resultat.push(path.relative(".", chemin));
    }
  })(".");
  return resultat;
}

const gitSortie = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 });
const reel = (p) => {
  try {
    return fs.realpathSync(p);
  } catch (e) {
    return path.resolve(p);
  }
};

/** La racine du dépôt Git, ou null hors d'un dépôt. */
function racineDepot() {
  try {
    return gitSortie(["rev-parse", "--show-toplevel"]).trim() || null;
  } catch (e) {
    return null;
  }
}

/** Le dossier du projet : le plus proche du dossier courant, jusqu'à la racine du dépôt, qui contient aidd_docs/ ou scripts/verifier.js ;
 *  sinon la racine du dépôt. Un projet rangé dans un sous-dossier d'un dépôt plus grand garde ainsi ses règles et ses scénarios. */
function dossierProjet(racine) {
  const haut = reel(racine);
  let dossier = reel(process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(dossier, "aidd_docs")) || fs.existsSync(path.join(dossier, "scripts", "verifier.js"))) return dossier;
    const rel = path.relative(haut, dossier);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return haut;
    dossier = path.dirname(dossier);
  }
}

/** Les fichiers préparés pour le commit (ajoutés, copiés, modifiés, renommés, changés de type) : { fichier, mode, objet },
 *  chemins depuis la racine du dépôt ; null si Git ne répond pas. */
function fichiersIndexes(racine) {
  let sortie;
  try {
    sortie = gitSortie(["diff", "--cached", "--raw", "-z", "--no-abbrev", "--diff-filter=ACMRT"], racine);
  } catch (e) {
    return null;
  }
  const morceaux = sortie.split("\u0000");
  const resultat = [];
  for (let i = 0; i < morceaux.length; i++) {
    const m = /^:\d+ (\d+) [0-9a-f]+ ([0-9a-f]+) ([A-Z])/.exec(morceaux[i]);
    if (!m) continue;
    if (m[3] === "R" || m[3] === "C") i++; // l'ancien chemin, puis le nouveau
    if (morceaux[i + 1]) resultat.push({ fichier: morceaux[++i], mode: m[1], objet: m[2] });
  }
  return resultat;
}

/** Lance « git cat-file » en un seul processus pour tous les objets : la sortie brute, ou null si Git ne répond pas. */
function catFile(option, objets, racine, taille = 0) {
  try {
    return execFileSync("git", ["cat-file", option], { cwd: racine, input: objets.join("\n") + "\n", stdio: ["pipe", "pipe", "ignore"], maxBuffer: taille + objets.length * 128 + 1024 * 1024 });
  } catch (e) {
    return null;
  }
}

/** La taille de chaque objet (Map objet → octets), lue en un seul processus ; null si Git ne répond pas. */
function taillesObjets(objets, racine) {
  if (!objets.length) return new Map();
  const brut = catFile("--batch-check", objets, racine);
  if (brut === null) return null;
  const tailles = new Map();
  for (const ligne of brut.toString("latin1").split("\n")) {
    const [objet, type, n] = ligne.split(" ");
    if (n !== undefined && type !== "missing") tailles.set(objet, Number(n));
  }
  return tailles;
}

/** Le contenu de chaque objet (Map objet → Buffer), lu en un seul processus ; null si Git ne répond pas. */
function lireObjets(objets, racine, taille) {
  if (!objets.length) return new Map();
  const brut = catFile("--batch", objets, racine, taille);
  if (brut === null) return null;
  const lus = new Map();
  let pos = 0;
  while (pos < brut.length) {
    const fin = brut.indexOf(10, pos);
    if (fin === -1) break;
    const [objet, type, n] = brut.toString("latin1", pos, fin).split(" ");
    pos = fin + 1;
    if (n === undefined || type === "missing") continue;
    lus.set(objet, brut.subarray(pos, pos + Number(n)));
    pos += Number(n) + 1;
  }
  return lus;
}

// Au-delà, un fichier texte préparé est refusé plutôt que lu (même limite que le garde-fou des commandes).
const TAILLE_MAX_INDEX = 20 * 1024 * 1024;
const TAILLE_MAX_PAQUET = 64 * 1024 * 1024;

/** Un fichier préparé de plus de 20 Mo est-il binaire (Git ne compte pas ses lignes) ? */
function estBinaireIndexe(f, racine) {
  try {
    return /^-\t-\t/.test(gitSortie(["--literal-pathspecs", "diff", "--cached", "--numstat", "--", f], racine));
  } catch (e) {
    return false;
  }
}

/** Le contenu préparé de chaque fichier : Map fichier → { contenu } (binaire ou sous-module : contenu vide), ou { probleme }
 *  quand il ne peut pas être contrôlé. Deux processus Git, quel que soit le nombre de fichiers (un de plus par tranche de 64 Mo de contenu). */
function contenusIndexes(entrees, racine) {
  const resultat = new Map();
  const illisible = (f) => ({ probleme: `${f} : contenu préparé illisible, non contrôlé. Préparez-le de nouveau (git add ${f}), puis relancez le contrôle.` });
  // Un sous-module (mode 160000) est un lien vers un commit d'un autre dépôt : rien à lire ici.
  const aLire = entrees.filter((e) => e.mode !== "160000");
  for (const e of entrees) if (e.mode === "160000") resultat.set(e.fichier, { contenu: "" });
  const tailles = taillesObjets([...new Set(aLire.map((e) => e.objet))], racine);
  const petits = [];
  for (const e of aLire) {
    const taille = tailles ? tailles.get(e.objet) : undefined;
    if (taille === undefined) resultat.set(e.fichier, illisible(e.fichier));
    else if (taille <= TAILLE_MAX_INDEX) petits.push(e);
    else if (estBinaireIndexe(e.fichier, racine)) resultat.set(e.fichier, { contenu: "" });
    else resultat.set(e.fichier, { probleme: `${e.fichier} : fichier trop gros pour être contrôlé (plus de 20 Mo). Un fichier de cette taille n'a pas sa place dans le dépôt : rangez-le hors du projet, ou ajoutez-le au .gitignore.` });
  }
  // Lus par paquets d'au plus 64 Mo : un seul tampon pour tous les fichiers pourrait manquer de mémoire.
  const lus = new Map();
  let paquet = [];
  let tailleDuPaquet = 0;
  const lirePaquet = () => {
    const contenus = lireObjets(paquet, racine, tailleDuPaquet);
    if (contenus) for (const [objet, brut] of contenus) lus.set(objet, brut);
    paquet = [];
    tailleDuPaquet = 0;
  };
  for (const objet of new Set(petits.map((e) => e.objet))) {
    if (paquet.length && tailleDuPaquet + tailles.get(objet) > TAILLE_MAX_PAQUET) lirePaquet();
    paquet.push(objet);
    tailleDuPaquet += tailles.get(objet);
  }
  if (paquet.length) lirePaquet();
  for (const e of petits) {
    const brut = lus.get(e.objet);
    resultat.set(e.fichier, brut ? { contenu: brut.includes(0) ? "" : brut.toString("utf8") } : illisible(e.fichier));
  }
  return resultat;
}

// ---------------------------------------------------------------- Scénarios

const DOSSIERS_IGNORES = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", ".vercel", ".turbo", ".netlify", "out"]);
const NIVEAUX_AUTOMATISES = ["unitaire", "integration", "bout-en-bout"];

function parcourir(dossier, resultat = []) {
  let entrees = [];
  try {
    entrees = fs.readdirSync(dossier, { withFileTypes: true });
  } catch (e) {
    return resultat;
  }
  for (const e of entrees) {
    if (DOSSIERS_IGNORES.has(e.name)) continue;
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) parcourir(chemin, resultat);
    else if (e.isFile()) resultat.push(chemin);
  }
  return resultat;
}

const versSlash = (p) => p.split(path.sep).join("/");

/** Fichier de test, quel que soit le langage : par son nom (x.test.ts, x_test.go, test_x.py) ou son dossier (tests/, e2e/…). */
function estFichierTest(chemin) {
  const parties = versSlash(chemin).split("/");
  const nom = parties.pop();
  return (
    /\.(test|spec)\.[a-z]+$/i.test(nom) ||
    /_test\.[a-z]+$/i.test(nom) ||
    /^test_.+\.py$/i.test(nom) ||
    parties.some((d) => ["test", "tests", "__tests__", "e2e", "spec"].includes(d))
  );
}

/** Les exemples Gherkin d'une spec : étiquette d'US, niveau, titre. */
function scenariosDeSpec(texte) {
  const lignes = texte.split(/\r?\n/);
  const scenarios = [];
  for (let k = 0; k < lignes.length; k++) {
    const ligne = lignes[k].trim();
    if (!ligne.startsWith("@")) continue;
    const etiquettes = ligne.split(/\s+/).map((t) => t.replace(/^@/, ""));
    const ids = etiquettes.filter((t) => /^US-\d{3}-\d+$/.test(t));
    if (!ids.length) continue;
    const niveau = etiquettes.find((t) => NIVEAUX_AUTOMATISES.includes(t) || t === "manuel") || null;
    const suivante = (lignes.slice(k + 1).find((l) => l.trim()) || "").trim();
    const titre = suivante.replace(/^(Exemple|Scénario|Plan du scénario|Example|Scenario Outline|Scenario)\s*:\s*/i, "");
    for (const id of ids) scenarios.push({ id, niveau, titre });
  }
  return scenarios;
}

/** Statut d'un plan : "termine" (toutes les tâches [x]), "en-cours", ou null s'il manque ou n'a pas de tâche. */
function statutPlan(chemin) {
  let texte;
  try {
    texte = fs.readFileSync(chemin, "utf8");
  } catch (e) {
    return null;
  }
  const statuts = [...texte.matchAll(/^\s*- \[([ ~x])\] \*\*T\d+/gm)].map((m) => m[1]);
  if (!statuts.length) return null;
  return statuts.every((st) => st === "x") ? "termine" : "en-cours";
}

/** Couverture des scénarios des specs de aidd_docs/tasks/, ou null si le projet n'en a pas. */
function couvertureScenarios() {
  const taches = path.join("aidd_docs", "tasks");
  if (!fs.existsSync(taches)) return null;
  const specs = parcourir(taches).filter((f) => /^SPEC-US-\d{3}.*\.md$/.test(path.basename(f)));
  const tests = parcourir(".")
    .filter((f) => estFichierTest(f) && !versSlash(f).startsWith("aidd_docs/"))
    .map((f) => {
      try {
        return { fichier: versSlash(f), contenu: fs.statSync(f).size <= 1024 * 1024 ? fs.readFileSync(f, "utf8") : "" };
      } catch (e) {
        return { fichier: versSlash(f), contenu: "" };
      }
    });
  const citeUneEtiquette = tests.some((t) => /US-\d{3}-\d+/.test(t.contenu));
  const lignes = [];
  for (const spec of specs) {
    const statut = statutPlan(path.join(path.dirname(spec), "PLAN-" + path.basename(spec)));
    for (const sc of scenariosDeSpec(fs.readFileSync(spec, "utf8"))) {
      const motif = new RegExp(`${sc.id}(?!\\d)`);
      const fichiers = sc.niveau === "manuel" ? [] : tests.filter((t) => motif.test(t.contenu)).map((t) => t.fichier);
      lignes.push({ ...sc, spec: path.basename(spec), statut, fichiers });
    }
  }
  return { lignes, citeUneEtiquette };
}

function afficherCouverture() {
  const c = couvertureScenarios();
  if (!c) return console.log("Aucun dossier aidd_docs/tasks/ : pas de scénario à suivre.");
  if (!c.lignes.length) return console.log("Aucun scénario étiqueté (@US-XXX-n) dans les specs.");
  for (const l of c.lignes) {
    const etat = l.niveau === "manuel" ? "manuel (test par la personne)" : l.fichiers.length ? `testé : ${l.fichiers.join(", ")}` : "sans test";
    const plan = { termine: "plan terminé", "en-cours": "plan en cours" }[l.statut] || "sans plan";
    console.log(`- ${l.id} « ${l.titre} » (${l.niveau || "niveau non précisé"}, ${plan}) : ${etat}`);
  }
}

/** Contrôle 3 : rend le bilan à afficher, et ajoute aux erreurs les scénarios sans test. */
function controlerScenarios(erreurs) {
  const c = couvertureScenarios();
  if (!c) return "";
  const surveilles = c.lignes.filter((l) => l.statut === "termine" && NIVEAUX_AUTOMATISES.includes(l.niveau));
  if (!surveilles.length) return "";
  if (!c.citeUneEtiquette)
    return `⚠️ Scénarios : aucun test ne cite d'étiquette de scénario (ex. US-003-1) ; la traçabilité des ${surveilles.length} scénarios automatisés des US terminées n'est pas contrôlée.`;
  const sansTest = surveilles.filter((l) => !l.fichiers.length);
  for (const l of sansTest)
    erreurs.push(
      `${l.id} « ${l.titre} » (${l.spec}) : scénario automatisé d'une US terminée, cité par aucun test. ` +
        `Écrivez son test (titre qui commence par ${l.id}) avec /pulse:test ecrire, ou passez le scénario en @manuel dans la spec s'il se vérifie à la main.`
    );
  return sansTest.length ? "" : `✅ Scénarios : ${surveilles.length} scénarios automatisés des US terminées, chacun cité par un test.`;
}

// ---------------------------------------------------------------- Règles du projet

// DEBUT-REGLES
const enSlash = (p) => p.split(path.sep).join("/");
const echapper = (s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");

/** Une portée (« src/prix/ », « src/app/**\/page.tsx », « *.ts ») en expression régulière sur un chemin relatif. */
function porteeEnRegex(portee) {
  const p = enSlash(portee.trim()).replace(/^\.\//, "");
  if (p.endsWith("/")) return new RegExp("^" + echapper(p));
  if (!/[*?]/.test(p)) return new RegExp("^" + echapper(p) + "(?:/|$)");
  const corps = echapper(p)
    .replace(/\*\*\//g, "\u0001")
    .replace(/\*\*/g, "\u0002")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0001/g, "(?:.*/)?")
    .replace(/\u0002/g, ".*");
  return new RegExp("^" + (p.includes("/") ? "" : "(?:.*/)?") + corps + "$");
}

/** Les règles contrôlées d'un texte : « - <règle> — Contrôle : interdit|obligatoire `motif` dans `portée`[, `portée`][ sauf `portée`[, `portée`]] ». */
function analyserRegles(texte) {
  const regles = [];
  for (const ligne of texte.split(/\r?\n/)) {
    const m = /^\s*[-*]\s+(.*?)\s+[—–-]\s+Contr[ôo]le\s*:\s*(interdit|obligatoire)\s+`([^`]+)`\s+dans\s+(.+)$/i.exec(ligne);
    if (!m) continue;
    const [dans, sauf = ""] = m[4].split(/\s+sauf\s+/i);
    const enRegex = (s) => [...s.matchAll(/`([^`]+)`/g)].map((x) => porteeEnRegex(x[1]));
    const portees = enRegex(dans);
    const exclusions = enRegex(sauf);
    // Un motif /…/ est une expression régulière ; sinon, un texte à trouver tel quel.
    const re = /^\/(.+)\/([a-z]*)$/.exec(m[3]);
    let motif = null;
    try {
      if (re) motif = new RegExp(re[1], re[2].replace("g", ""));
    } catch (e) {
      continue;
    }
    if (portees.length) regles.push({ regle: m[1].trim(), sorte: m[2].toLowerCase(), brut: m[3], motif, portees, exclusions });
  }
  return regles;
}

/** Les règles contrôlées de aidd_docs/memory/technical.md, sous la racine donnée. */
function lireRegles(racine = ".") {
  try {
    return analyserRegles(fs.readFileSync(path.join(racine, "aidd_docs", "memory", "technical.md"), "utf8"));
  } catch (e) {
    return [];
  }
}

/** Les messages des fichiers lus ({ fichier, contenu }) qui enfreignent une règle contrôlée. */
function enfreintes(regles, lus) {
  const messages = [];
  for (const r of regles) {
    for (const { fichier, contenu } of lus) {
      const chemin = enSlash(fichier);
      if (chemin.startsWith("aidd_docs/") || !r.portees.some((p) => p.test(chemin)) || r.exclusions.some((p) => p.test(chemin))) continue;
      const present = r.motif ? r.motif.test(contenu) : contenu.includes(r.brut);
      if (r.sorte === "interdit" && present) messages.push(`${chemin} : enfreint la règle du projet « ${r.regle} » (${r.brut} est interdit ici).`);
      if (r.sorte === "obligatoire" && !present) messages.push(`${chemin} : la règle du projet « ${r.regle} » demande ${r.brut} dans ce fichier.`);
    }
  }
  return messages;
}
// FIN-REGLES

/** Contrôle 4 : ajoute aux erreurs chaque fichier lu qui enfreint une règle contrôlée du projet. */
function controlerRegles(lus, erreurs) {
  erreurs.push(...enfreintes(lireRegles(), lus));
}

function principal() {
  // Depuis un sous-dossier, le contrôle porte sur tout le projet, avec ses règles et ses scénarios (dossierProjet) ;
  // Git répond toujours depuis la racine du dépôt, même quand le projet est rangé dans un sous-dossier d'un dépôt plus grand.
  const racine = racineDepot();
  const projet = racine ? dossierProjet(racine) : process.cwd();
  process.chdir(projet);
  if (process.argv.includes("--scenarios")) return afficherCouverture();
  const index = process.argv.includes("--index");
  const erreurs = [];
  const entrees = index && racine ? fichiersIndexes(racine) : null;
  const fichiers = index ? entrees && entrees.map((e) => e.fichier) : listerFichiers();
  if (fichiers === null) {
    console.error("❌ Contrôle impossible : Git ne donne pas la liste des fichiers préparés (dossier hors d'un dépôt Git, ou dépôt illisible). Le commit attend : lancez le contrôle depuis le dossier du projet.");
    process.exit(1);
  }
  const contenus = index ? contenusIndexes(entrees, racine) : null;
  // Avant commit, les chemins viennent de la racine du dépôt ; les règles se lisent depuis le dossier du projet (hors du projet : secrets seulement).
  const pourRegles = (f) => {
    if (!index) return f;
    const rel = path.relative(projet, path.join(reel(racine), f));
    return rel.startsWith("..") || path.isAbsolute(rel) ? null : rel;
  };
  const lus = [];
  let nonControles = 0;

  for (const f of fichiers) {
    if (estFichierEnv(f)) {
      erreurs.push(`${f} : fichier de secrets enregistré dans le projet. Retirez-le (git rm --cached ${f}) et ajoutez-le au .gitignore.`);
      continue;
    }
    let contenu = "";
    if (index) {
      const lu = contenus.get(f);
      if (lu.probleme) {
        erreurs.push(lu.probleme);
        nonControles++;
        continue;
      }
      contenu = lu.contenu;
    } else {
      try {
        const st = fs.statSync(f);
        if (!st.isFile() || st.size > 512 * 1024) continue;
        contenu = fs.readFileSync(f, "utf8");
      } catch (e) {
        continue;
      }
    }
    if (contenu.includes("\u0000")) continue;
    const chemin = pourRegles(f);
    if (chemin !== null) lus.push({ fichier: chemin, contenu });
    const secrets = trouverSecrets(contenu);
    if (secrets.length) erreurs.push(`${f} : contient une ${secrets.join(", ")}. Déplacez-la dans les variables d'environnement.`);
  }

  const secretsTrouves = erreurs.length > nonControles;
  const bilanScenarios = index ? "" : controlerScenarios(erreurs);
  const avantRegles = erreurs.length;
  controlerRegles(lus, erreurs);

  if (erreurs.length) {
    const entete = !index
      ? "❌ Vérification échouée, la mise en ligne est annulée :\n"
      : secretsTrouves
        ? "❌ Commit annulé : un secret allait être enregistré.\n"
        : nonControles
          ? "❌ Commit annulé : un fichier préparé n'a pas pu être contrôlé.\n"
          : "❌ Commit annulé : une règle du projet n'est pas respectée.\n";
    console.error(entete);
    for (const e of erreurs) console.error("  - " + e);
    if (secretsTrouves) console.error("\nSi une vraie clé a été envoyée vers le dépôt distant, révoquez-la chez le fournisseur et créez-en une nouvelle : /pulse:secrets fuite vous guide.");
    if (erreurs.length > avantRegles) console.error("\nLes règles du projet sont dans aidd_docs/memory/technical.md (lignes « Contrôle : … ») : corrigez le fichier, ou la règle avec /pulse:memory.");
    process.exit(1);
  }
  console.log(`✅ Vérification réussie (${fichiers.length} fichiers contrôlés).`);
  if (bilanScenarios) console.log(bilanScenarios);
}

principal();

#!/usr/bin/env node
// Contrôle automatique du projet, à lancer avant chaque mise en ligne et dans la CI
// (installé par /pulse:cicd, via pulse-aidd installer-ci).
//
// Vérifie que :
//  1. aucun fichier d'environnement (.env, .env.*) n'est enregistré dans Git ;
//  2. aucun fichier ne contient de clé secrète ;
//  3. (projet Pulse) chaque scénario automatisé (@unitaire, @integration, @bout-en-bout) d'une US
//     dont le plan est terminé est cité par au moins un test (son étiquette, ex. US-003-1).
// En cas de problème, le script s'arrête en erreur : la mise en ligne doit être annulée.
//
//   node scripts/verifier.js               les trois contrôles
//   node scripts/verifier.js --scenarios   l'état de couverture des scénarios de tous les plans, sans échouer
//   node scripts/verifier.js --index       les fichiers prêts à être enregistrés (contrôle avant commit), sans les scénarios
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
const valeurReelle = (v) =>
  !VALEUR_EXEMPLE.test(v) && !NOM_MAJUSCULES.test(v) && !UUID.test(v) && !CLE_TRADUCTION.test(v) && !/^(votre|your|change|exemple|example|xxx)/i.test(v) && !/(test|fake|factice|exemple|example|dummy|mock|demo)/i.test(v) && /^[A-Za-z0-9_+\/=.-]+$/.test(v) && !v.includes("://") && (/^[0-9a-f]{32,}$/i.test(v) || (/\d/.test(v) && /[a-z]/.test(v) && /[A-Z]/.test(v)) || (v.length >= 24 && /\d/.test(v) && /[A-Za-z]/.test(v) && !/^_*[a-z0-9]+(?:[-._]+[a-z0-9]+){2,}$/.test(v)));
// Noms qui annoncent un secret, quelle que soit la casse (apiKey, client_secret, DB_PASSWORD), et les suffixes _PASS / Pass (DB_PASS, dbPass).
const NOM_SECRET = /(secret|password|passwd|token|api[_-]?key|private[_-]?key)/i;
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
  { nom: "secret en clair", re: /(?<![\w$.-])([A-Za-z_][\w-]*)["']?[ \t]*[:=][ \t]*["'`]([^"'`\s]{16,})["'`]/g, garder: (m) => nomSecret(m[1]) && valeurReelle(m[2]) },
  // Valeur sans guillemets, seule sur sa ligne : AUTH_SECRET=…, export CLIENT_SECRET=…, password: … (YAML).
  { nom: "secret en clair", re: /^[ \t]*(?:export[ \t]+)?([A-Za-z_][\w-]*)[ \t]*[:=][ \t]*([A-Za-z0-9_+\/=.-]{16,})[ \t]*$/gm, garder: (m) => nomSecret(m[1]) && valeurReelle(m[2]) && !CHAINE_IDENTIFIANTS.test(m[2]) },
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

function fichiersIndexes() {
  try {
    const sortie = execFileSync("git", ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return sortie.split("\u0000").filter(Boolean);
  } catch (e) {
    return [];
  }
}

function contenuIndexe(f) {
  try {
    return execFileSync("git", ["show", `:${f}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1024 * 1024 });
  } catch (e) {
    return "";
  }
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

function principal() {
  if (process.argv.includes("--scenarios")) return afficherCouverture();
  const index = process.argv.includes("--index");
  const erreurs = [];
  const fichiers = index ? fichiersIndexes() : listerFichiers();

  for (const f of fichiers) {
    if (estFichierEnv(f)) {
      erreurs.push(`${f} : fichier de secrets enregistré dans le projet. Retirez-le (git rm --cached ${f}) et ajoutez-le au .gitignore.`);
      continue;
    }
    let contenu = "";
    if (index) contenu = contenuIndexe(f);
    else {
      try {
        const st = fs.statSync(f);
        if (!st.isFile() || st.size > 512 * 1024) continue;
        contenu = fs.readFileSync(f, "utf8");
      } catch (e) {
        continue;
      }
    }
    if (contenu.includes("\u0000")) continue;
    const secrets = trouverSecrets(contenu);
    if (secrets.length) erreurs.push(`${f} : contient une ${secrets.join(", ")}. Déplacez-la dans les variables d'environnement.`);
  }

  const bilanScenarios = index ? "" : controlerScenarios(erreurs);

  if (erreurs.length) {
    console.error(index ? "❌ Commit annulé : un secret allait être enregistré.\n" : "❌ Vérification échouée, la mise en ligne est annulée :\n");
    for (const e of erreurs) console.error("  - " + e);
    console.error("\nSi une vraie clé a été envoyée vers le dépôt distant, révoquez-la chez le fournisseur et créez-en une nouvelle : /pulse:secrets fuite vous guide.");
    process.exit(1);
  }
  console.log(`✅ Vérification réussie (${fichiers.length} fichiers contrôlés).`);
  if (bilanScenarios) console.log(bilanScenarios);
}

principal();

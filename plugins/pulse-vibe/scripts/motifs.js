// Pulse – motifs de détection des secrets.
// Partagé par le garde-fou (garde-secrets.js). Une copie identique se trouve
// dans templates/verifier.js (le test tests/garde-secrets.test.js vérifie qu'elles restent alignées).
"use strict";

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

module.exports = { trouverSecrets, estFichierEnv, nomReel };

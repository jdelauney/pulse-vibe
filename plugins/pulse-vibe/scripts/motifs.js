// Pulse – motifs de détection des secrets.
// Partagé par le garde-fou (garde-secrets.js). Une copie identique se trouve
// dans templates/verifier.js (le test tests/garde-secrets.test.js vérifie qu'elles restent alignées).
"use strict";

// DEBUT-MOTIFS
const MOTIFS = [
  { nom: "clé secrète Stripe", re: /\b[rs]k_(?:live|test)_[0-9a-zA-Z]{16,}/ },
  { nom: "secret de webhook Stripe", re: /\bwhsec_[0-9a-zA-Z]{20,}/ },
  { nom: "clé secrète Supabase", re: /\bsb_secret_[0-9a-zA-Z_-]{16,}/ },
  { nom: "clé Anthropic", re: /\bsk-ant-[0-9a-zA-Z_-]{20,}/ },
  { nom: "clé OpenAI", re: /\bsk-(?:proj-)?[0-9a-zA-Z_-]{32,}/ },
  { nom: "jeton GitHub", re: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[0-9a-zA-Z_]{20,}/ },
  { nom: "clé AWS", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { nom: "clé SendGrid", re: /\bSG\.[0-9a-zA-Z_-]{16,}\.[0-9a-zA-Z_-]{16,}/ },
  { nom: "jeton Slack", re: /\bxox[abprs]-[0-9a-zA-Z-]{10,}/ },
  { nom: "clé privée", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nom: "mot de passe dans une adresse de base de données", re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?):\/\/[^:\s/@]+:[^@\s]{3,}@/ },
  { nom: "secret client Google OAuth", re: /\bGOCSPX-[0-9A-Za-z_-]{28}(?![0-9A-Za-z_-])/ },
  { nom: "jeton d'accès Google", re: /\bya29\.[0-9A-Za-z_-]{20,}/ },
  { nom: "jeton de rafraîchissement Google", re: /\b1\/\/0[0-9A-Za-z_-]{30,}/ },
  { nom: "clé d'API Google", re: /\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/ },
  { nom: "clé d'API Brevo", re: /\bxkeysib-[a-f0-9]{64}-[0-9A-Za-z]{16}\b/ },
  { nom: "clé d'API Neon", re: /\bnapi_[0-9a-z]{40,}/ },
  { nom: "jeton Vercel", re: /\bvc[pkiar]_[0-9A-Za-z]{24,}/ },
  { nom: "jeton d'API Cloudflare", re: /\bcf(?:k|ut|at)_[0-9A-Za-z]{40,}/ },
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
  for (const m of MOTIFS) if (m.re.test(texte)) trouves.add(m.nom);
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
// FIN-MOTIFS

/** Vrai pour .env, .env.local, .env.production… mais pas pour .env.example. */
function estFichierEnv(chemin) {
  const nom = String(chemin).split(/[\\/]/).pop();
  return /^\.env(\..+)?$/.test(nom) && !/^\.env\.(example|sample|template)$/.test(nom);
}

module.exports = { trouverSecrets, estFichierEnv };

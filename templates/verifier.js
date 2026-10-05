#!/usr/bin/env node
// Contrôle automatique du projet, à lancer avant chaque mise en ligne et dans la CI
// (installé par /pulse:deploy en mode production).
//
// Vérifie que :
//  1. aucun fichier d'environnement (.env, .env.*) n'est enregistré dans Git ;
//  2. aucun fichier ne contient de clé secrète.
// En cas de problème, le script s'arrête en erreur : la mise en ligne doit être annulée.
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

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
  { nom: "mot de passe dans une adresse de base de données", re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s/@]+:[^@\s]{3,}@/ },
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

function estFichierEnv(chemin) {
  const nom = String(chemin).split(/[\\/]/).pop();
  return /^\.env(\..+)?$/.test(nom) && !/^\.env\.(example|sample|template)$/.test(nom);
}

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

function principal() {
  const erreurs = [];
  const fichiers = listerFichiers();

  for (const f of fichiers) {
    if (estFichierEnv(f)) {
      erreurs.push(`${f} : fichier de secrets enregistré dans le projet. Retirez-le (git rm --cached ${f}) et ajoutez-le au .gitignore.`);
      continue;
    }
    let contenu = "";
    try {
      const st = fs.statSync(f);
      if (!st.isFile() || st.size > 512 * 1024) continue;
      contenu = fs.readFileSync(f, "utf8");
    } catch (e) {
      continue;
    }
    if (contenu.includes("\u0000")) continue;
    const secrets = trouverSecrets(contenu);
    if (secrets.length) erreurs.push(`${f} : contient une ${secrets.join(", ")}. Déplacez-la dans les variables d'environnement.`);
  }


  if (erreurs.length) {
    console.error("❌ Vérification échouée, la mise en ligne est annulée :\n");
    for (const e of erreurs) console.error("  - " + e);
    console.error("\nSi une vraie clé a été envoyée vers le dépôt distant, révoquez-la chez le fournisseur et créez-en une nouvelle.");
    process.exit(1);
  }
  console.log(`✅ Vérification réussie (${fichiers.length} fichiers contrôlés).`);
}

principal();

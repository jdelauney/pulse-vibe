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

  const bilanScenarios = controlerScenarios(erreurs);

  if (erreurs.length) {
    console.error("❌ Vérification échouée, la mise en ligne est annulée :\n");
    for (const e of erreurs) console.error("  - " + e);
    console.error("\nSi une vraie clé a été envoyée vers le dépôt distant, révoquez-la chez le fournisseur et créez-en une nouvelle.");
    process.exit(1);
  }
  console.log(`✅ Vérification réussie (${fichiers.length} fichiers contrôlés).`);
  if (bilanScenarios) console.log(bilanScenarios);
}

principal();

#!/usr/bin/env node
// Pulse – sonde de mise en ligne (`pulse-aidd sonder`, /pulse:deploy, /pulse:tech et /pulse:security).
//
//   pulse-aidd sonder <adresse> [--texte "<texte attendu>"] [--essais 5] [--delai 6000]
//   pulse-aidd sonder <adresse> --entetes
//
// Vérifie qu'un site en ligne répond : code 200, et le texte attendu dans la page s'il est donné.
// Plusieurs essais espacés, car un hébergeur met parfois quelques secondes à publier.
// Sort avec le code 0 si le site répond comme prévu, 1 sinon (avec la cause, en français).
// --entetes : une requête HEAD, sans suivre de redirection ; affiche le code et les en-têtes servis,
// un par ligne, doublons compris (deux lignes strict-transport-security restent deux lignes).
"use strict";

const USAGE = 'Usage : pulse-aidd sonder <adresse> [--texte "<texte attendu>"] [--essais 5] [--delai 6000] [--entetes]';

function lireArguments(argv) {
  const opts = { adresse: null, texte: null, essais: 5, delai: 6000, entetes: false, donnees: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (["--texte", "--essais", "--delai"].includes(a)) opts.donnees.push(a);
    if (a === "--texte") opts.texte = argv[++i];
    else if (a === "--essais") opts.essais = Number(argv[++i]);
    else if (a === "--delai") opts.delai = Number(argv[++i]);
    else if (a === "--entetes") opts.entetes = true;
    else if (!a.startsWith("--") && opts.adresse === null) opts.adresse = a;
  }
  return opts;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const CAUSES = {
  ECONNREFUSED: "le serveur refuse la connexion (le site n'est pas démarré, ou pas à cette adresse)",
  ENOTFOUND: "l'adresse est introuvable (nom de domaine mal écrit, ou pas encore actif)",
  EAI_AGAIN: "le nom de domaine ne se résout pas pour l'instant (réseau ou DNS)",
  ETIMEDOUT: "le site met trop de temps à répondre",
  TimeoutError: "le site n'a pas répondu en 15 secondes",
  ECONNRESET: "la connexion a été coupée par le serveur",
  CERT_HAS_EXPIRED: "le certificat de sécurité du site a expiré",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "le certificat de sécurité du site n'est pas reconnu",
  DEPTH_ZERO_SELF_SIGNED_CERT: "le certificat de sécurité du site n'est pas reconnu",
};

/** Un essai : rend null si tout va bien, sinon la cause du problème. */
async function essayer(adresse, texte) {
  let reponse;
  try {
    reponse = await fetch(adresse, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  } catch (e) {
    const code = (e.cause && e.cause.code) || e.name;
    return `le site ne répond pas : ${CAUSES[code] || "erreur réseau"} (${code})`;
  }
  if (reponse.status !== 200) return `le site répond avec le code ${reponse.status} au lieu de 200`;
  if (texte) {
    const corps = await reponse.text();
    if (!corps.includes(texte)) return `la page ne contient pas le texte attendu « ${texte} »`;
  }
  return null;
}

/** En-têtes servis, tels qu'envoyés (un par ligne, doublons compris), par une requête HEAD sans redirection. */
function lireEntetes(adresse) {
  const client = adresse.startsWith("https:") ? require("https") : require("http");
  return new Promise((resoudre, rejeter) => {
    const req = client.request(adresse, { method: "HEAD", timeout: 15000 }, (res) => {
      const lignes = [];
      for (let i = 0; i < res.rawHeaders.length; i += 2) lignes.push(`${res.rawHeaders[i].toLowerCase()}: ${res.rawHeaders[i + 1]}`);
      res.resume();
      resoudre({ statut: res.statusCode, lignes });
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("délai dépassé"), { code: "TimeoutError" })));
    req.on("error", rejeter);
    req.end();
  });
}

async function principal() {
  const opts = lireArguments(process.argv.slice(2));
  if (!opts.adresse || !/^https?:\/\/\S+$/.test(opts.adresse)) {
    console.error(USAGE);
    process.exit(1);
  }
  if (opts.entetes) {
    if (opts.donnees.length) console.error(`⚠️ --entetes lit seulement les en-têtes, en une requête : ${opts.donnees.join(", ")} laissé${opts.donnees.length > 1 ? "s" : ""} de côté.`);
    try {
      const { statut, lignes } = await lireEntetes(opts.adresse);
      console.log(`HTTP ${statut} – ${opts.adresse}`);
      for (const l of lignes) console.log(l);
    } catch (e) {
      const code = (e && (e.code || e.name)) || "erreur";
      console.error(`❌ ${opts.adresse} : le site ne répond pas : ${CAUSES[code] || "erreur réseau"} (${code}).`);
      process.exit(1);
    }
    return;
  }
  const essais = Number.isInteger(opts.essais) && opts.essais > 0 ? opts.essais : 5;
  let cause = null;
  const delai = Number.isFinite(opts.delai) && opts.delai >= 0 ? opts.delai : 6000;
  for (let n = 1; n <= essais; n++) {
    cause = await essayer(opts.adresse, opts.texte);
    if (!cause) {
      console.log(`✅ ${opts.adresse} répond (code 200${opts.texte ? `, texte « ${opts.texte} » présent` : ""}), essai ${n}/${essais}.`);
      return;
    }
    if (n < essais) await attendre(delai);
  }
  console.error(`❌ ${opts.adresse} : ${cause}, après ${essais} essai${essais > 1 ? "s" : ""}.`);
  process.exit(1);
}

principal();

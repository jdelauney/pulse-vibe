#!/usr/bin/env node
// Pulse – Google Search Console en lecture seule (`pulse-aidd search-console`, /pulse:search-console).
//
//   pulse-aidd search-console connecter --client <client_secret_….json> [--sans-navigateur]
//   pulse-aidd search-console deconnecter
//   pulse-aidd search-console proprietes
//   pulse-aidd search-console lire [--periode 28j|3m] [--fichier <export.zip|dossier|fichier.csv>] [--site <adresse>]
//                                  [--propriete <sc-domain:… | https://…/>] [--inspecter <n>] [--ecrire] [--json]
//   pulse-aidd search-console suivre [mêmes options que lire]
//   pulse-aidd search-console inspecter <adresse> [--site <adresse>] [--propriete …]
//
// Accès, du plus simple au plus outillé :
//   - export CSV de l'interface (--fichier) : aucun secret ;
//   - connexion OAuth « application de bureau » de la personne : portée webmasters.readonly seule, PKCE,
//     adresse de bouclage 127.0.0.1 ; identifiants rangés hors du projet, droits 0600 :
//     %APPDATA%\pulse\search-console.json (Windows), ~/.config/pulse/search-console.json (ailleurs) ;
//   - compte de service, pour une automatisation (CI) seulement : PULSE_GSC_COMPTE_SERVICE=<chemin du JSON>.
// Aucun jeton, secret client ni clé n'est jamais écrit sur la sortie.
//
// Codes de sortie : 0 ok · 1 autre problème · 2 pas connecté · 3 connexion expirée ou révoquée (se reconnecter)
//                   4 propriété inaccessible (403) · 5 quota dépassé (429) · 6 pas encore de données
// Variables pour les tests : PULSE_GSC_API, PULSE_GSC_JETON, PULSE_GSC_AUTORISATION, PULSE_GSC_REVOCATION,
//   PULSE_CONFIG_DIR, PULSE_GSC_TAILLE_PAGE, PULSE_GSC_ATTENTE, PULSE_GSC_AUJOURDHUI (AAAA-MM-JJ).
// process.exitCode plutôt que process.exit() : sous Windows, quitter juste après une réponse HTTPS peut planter Node.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const zlib = require("zlib");
const crypto = require("crypto");
const { spawn } = require("child_process");

const PORTEE = "https://www.googleapis.com/auth/webmasters.readonly";
const base = () => process.env.PULSE_GSC_API || "https://searchconsole.googleapis.com";
const adresseJeton = () => process.env.PULSE_GSC_JETON || "https://oauth2.googleapis.com/token";
const adresseAutorisation = () => process.env.PULSE_GSC_AUTORISATION || "https://accounts.google.com/o/oauth2/v2/auth";
const adresseRevocation = () => process.env.PULSE_GSC_REVOCATION || "https://oauth2.googleapis.com/revoke";

class ErreurPulse extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------- Sortie sans secret

/** Remplace tout ce qui ressemble à un jeton ou à un secret Google. Appliqué à chaque sortie. */
function masquer(texte) {
  return String(texte)
    .replace(/ya29\.[0-9A-Za-z_.-]+/g, "[jeton masqué]")
    .replace(/1\/\/[0-9A-Za-z_-]+/g, "[jeton masqué]")
    .replace(/GOCSPX-[0-9A-Za-z_-]+/g, "[secret masqué]")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[clé masquée]");
}
const dire = (t) => process.stdout.write(masquer(t) + "\n");
const signaler = (t) => process.stderr.write(masquer(t) + "\n");

// ---------------------------------------------------------------- Identifiants (hors du projet)

function dossierConfig(env = process.env, plateforme = process.platform) {
  if (env.PULSE_CONFIG_DIR) return env.PULSE_CONFIG_DIR;
  if (plateforme === "win32") return path.join(env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "pulse");
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "pulse");
}
const fichierIdentifiants = () => path.join(dossierConfig(), "search-console.json");

function ecrireIdentifiants(donnees) {
  const fichier = fichierIdentifiants();
  fs.mkdirSync(path.dirname(fichier), { recursive: true, mode: 0o700 });
  fs.writeFileSync(fichier, JSON.stringify(donnees, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(fichier, 0o600);
  return fichier;
}

function lireIdentifiants() {
  const compteService = process.env.PULSE_GSC_COMPTE_SERVICE;
  if (compteService) {
    let sa;
    try {
      sa = JSON.parse(fs.readFileSync(compteService, "utf8"));
    } catch (e) {
      throw new ErreurPulse(`Fichier de compte de service illisible (PULSE_GSC_COMPTE_SERVICE) : ${e.code || "JSON invalide"}.`, 2);
    }
    if (!sa.client_email || !sa.private_key) throw new ErreurPulse("PULSE_GSC_COMPTE_SERVICE ne désigne pas une clé de compte de service (client_email ou private_key absent).", 2);
    return { type: "service_account", client_email: sa.client_email, private_key: sa.private_key };
  }
  const fichier = fichierIdentifiants();
  if (!fs.existsSync(fichier)) {
    throw new ErreurPulse("Pas encore connecté à Search Console. Deux possibilités : un export CSV (--fichier), ou la connexion en lecture seule (pulse-aidd search-console connecter).", 2);
  }
  try {
    return JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch (e) {
    throw new ErreurPulse(`Fichier d'identifiants illisible (${fichier}) : se reconnecter.`, 3);
  }
}

// ---------------------------------------------------------------- PKCE, JWT, jeton d'accès

const base64url = (tampon) => Buffer.from(tampon).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Paire PKCE : verifier aléatoire, challenge = base64url(sha256(verifier)). */
function pkce(aleatoire = crypto.randomBytes) {
  const verifier = base64url(aleatoire(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge, methode: "S256" };
}

function urlAutorisation({ clientId, redirection, challenge, etat }) {
  const u = new URL(adresseAutorisation());
  u.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirection,
    response_type: "code",
    scope: PORTEE,
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: etat,
  }).toString();
  return u.toString();
}

/** JWT RS256 signé d'un compte de service (durée 1 h au plus). */
function jwtCompteService(sa, maintenant = Date.now(), aud = "https://oauth2.googleapis.com/token") {
  const iat = Math.floor(maintenant / 1000);
  const entete = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const charge = base64url(JSON.stringify({ iss: sa.client_email, scope: PORTEE, aud, iat, exp: iat + 3600 }));
  const signature = crypto.createSign("RSA-SHA256").update(`${entete}.${charge}`).sign(sa.private_key);
  return `${entete}.${charge}.${base64url(signature)}`;
}

async function demanderJeton(parametres) {
  let reponse;
  try {
    reponse = await fetch(adresseJeton(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(parametres).toString(),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new ErreurPulse(`Google ne répond pas (${(e.cause && e.cause.code) || e.name}) : vérifier la connexion Internet.`, 1);
  }
  const corps = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    if (corps.error === "invalid_grant") {
      throw new ErreurPulse("La connexion à Search Console a expiré ou a été retirée (application en statut « Testing » : 7 jours ; ou accès révoqué dans le compte Google). Se reconnecter : pulse-aidd search-console connecter.", 3);
    }
    if (corps.error === "invalid_client") throw new ErreurPulse("Le client OAuth n'est plus reconnu par Google (supprimé ou modifié) : en créer un nouveau, puis se reconnecter.", 3);
    throw new ErreurPulse(`Google refuse la demande de jeton (code ${reponse.status}${corps.error ? `, ${corps.error}` : ""}).`, 1);
  }
  return corps;
}

async function jetonAcces(identifiants) {
  if (identifiants.type === "service_account") {
    const corps = await demanderJeton({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwtCompteService(identifiants, Date.now(), adresseJeton()) });
    return corps.access_token;
  }
  if (!identifiants.refresh_token) throw new ErreurPulse("Identifiants incomplets : se reconnecter (pulse-aidd search-console connecter).", 3);
  const corps = await demanderJeton({
    grant_type: "refresh_token",
    refresh_token: identifiants.refresh_token,
    client_id: identifiants.client_id,
    client_secret: identifiants.client_secret || "",
  });
  return corps.access_token;
}

// ---------------------------------------------------------------- Connexion (adresse de bouclage)

/** Écoute sur 127.0.0.1 (port libre) et attend le retour de Google. Rend { port, code: Promise<string>, fermer }. */
function attendreRetour({ etat, delai = 5 * 60 * 1000 }) {
  return new Promise((pret, echec) => {
    let resoudre, rejeter;
    const code = new Promise((a, b) => ((resoudre = a), (rejeter = b)));
    const page = (titre, texte) => `<!doctype html><meta charset="utf-8"><title>${titre}</title><body style="font-family:sans-serif;max-width:40rem;margin:3rem auto"><h1>${titre}</h1><p>${texte}</p></body>`;
    const serveur = http.createServer((req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      if (u.pathname !== "/") {
        res.writeHead(404).end();
        return;
      }
      const repondre = (statut, titre, texte) => {
        res.writeHead(statut, { "Content-Type": "text/html; charset=utf-8", Connection: "close" });
        res.end(page(titre, texte));
      };
      if (u.searchParams.get("state") !== etat) {
        repondre(400, "Demande refusée", "Cette réponse ne correspond pas à la connexion lancée par Pulse. Relancez la connexion depuis Claude Code.");
        terminer(() => rejeter(new ErreurPulse("Réponse de connexion refusée : le paramètre de contrôle (state) ne correspond pas. Relancer la connexion.", 1)));
        return;
      }
      if (u.searchParams.get("error")) {
        repondre(200, "Connexion annulée", "Vous pouvez fermer cet onglet et revenir à Claude Code.");
        terminer(() => rejeter(new ErreurPulse(`Connexion annulée sur l'écran Google (${u.searchParams.get("error")}).`, 1)));
        return;
      }
      const valeur = u.searchParams.get("code");
      if (!valeur) {
        repondre(400, "Demande incomplète", "Relancez la connexion depuis Claude Code.");
        terminer(() => rejeter(new ErreurPulse("Réponse de connexion incomplète (code absent).", 1)));
        return;
      }
      repondre(200, "Connexion réussie", "Pulse peut maintenant lire vos données Search Console, en lecture seule. Vous pouvez fermer cet onglet et revenir à Claude Code.");
      terminer(() => resoudre(valeur));
    });
    const minuterie = setTimeout(() => terminer(() => rejeter(new ErreurPulse("Aucune réponse de Google après 5 minutes : relancer la connexion.", 1))), delai);
    minuterie.unref();
    let fini = false;
    function terminer(suite) {
      if (fini) return;
      fini = true;
      clearTimeout(minuterie);
      serveur.close();
      serveur.closeAllConnections && setImmediate(() => serveur.closeAllConnections());
      suite();
    }
    serveur.on("error", echec);
    serveur.listen(0, "127.0.0.1", () => pret({ port: serveur.address().port, code, fermer: () => terminer(() => rejeter(new ErreurPulse("Connexion interrompue.", 1))) }));
  });
}

function ouvrirNavigateur(url) {
  const [cmd, args] =
    process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    const p = spawn(cmd, args, { detached: true, stdio: "ignore" });
    p.on("error", () => {});
    p.unref();
  } catch (e) {
    /* l'adresse est aussi affichée */
  }
}

function lireClient(chemin) {
  if (!chemin) throw new ErreurPulse("Indiquez le chemin du fichier du client OAuth téléchargé : pulse-aidd search-console connecter --client <chemin du client_secret_….json>.", 1);
  let json;
  try {
    json = JSON.parse(fs.readFileSync(chemin, "utf8"));
  } catch (e) {
    throw new ErreurPulse(`Fichier du client illisible : ${e.code === "ENOENT" ? "introuvable à cet emplacement" : "ce n'est pas un JSON valide"}.`, 1);
  }
  if (json.type === "service_account") throw new ErreurPulse("Ce fichier est une clé de compte de service, pas un client OAuth « Application de bureau ». Pour une connexion personnelle, créer un client de type « Application de bureau ».", 1);
  if (json.web) throw new ErreurPulse("Ce client est de type « Application Web ». Créer un client de type « Application de bureau » (Desktop app), puis recommencer.", 1);
  const c = json.installed;
  if (!c || !c.client_id) throw new ErreurPulse("Ce fichier n'est pas un client OAuth « Application de bureau » (section installed absente).", 1);
  return { client_id: c.client_id, client_secret: c.client_secret || "" };
}

async function connecter(opts) {
  const client = lireClient(opts.client);
  const { verifier, challenge } = pkce();
  const etat = base64url(crypto.randomBytes(16));
  const retour = await attendreRetour({ etat });
  const redirection = `http://127.0.0.1:${retour.port}`;
  const url = urlAutorisation({ clientId: client.client_id, redirection, challenge, etat });
  dire("Connexion à Search Console, en lecture seule.");
  dire("Votre navigateur va s'ouvrir sur l'écran de Google : choisissez votre compte, puis « Autoriser ».");
  dire(`Si le navigateur ne s'ouvre pas, ouvrez cette adresse : ${url}`);
  if (!opts.sansNavigateur) ouvrirNavigateur(url);
  const code = await retour.code;
  const jetons = await demanderJeton({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirection,
    client_id: client.client_id,
    client_secret: client.client_secret,
  });
  if (!jetons.refresh_token) throw new ErreurPulse("Google n'a pas fourni d'accès durable. Retirer l'accès de l'application dans le compte Google (Sécurité → applications tierces), puis se reconnecter.", 1);
  if (jetons.scope && !jetons.scope.split(" ").includes(PORTEE)) throw new ErreurPulse("L'autorisation de lecture Search Console n'a pas été accordée : cocher la case sur l'écran de Google et recommencer.", 1);
  const fichier = ecrireIdentifiants({
    type: "oauth",
    client_id: client.client_id,
    client_secret: client.client_secret,
    refresh_token: jetons.refresh_token,
    portee: PORTEE,
    connecte_le: new Date().toISOString().slice(0, 10),
  });
  dire(`✅ Connecté en lecture seule. Accès rangé hors du projet : ${fichier}`);
  dire(`Vous pouvez supprimer le fichier du client téléchargé (${path.basename(opts.client)}) : il n'est plus utile.`);
}

async function deconnecter() {
  const fichier = fichierIdentifiants();
  if (!fs.existsSync(fichier)) {
    dire("Aucune connexion enregistrée : rien à retirer.");
    return;
  }
  let identifiants = null;
  try {
    identifiants = JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch (e) {
    /* fichier abîmé : on le supprime quand même */
  }
  let revoque = false;
  if (identifiants && identifiants.refresh_token) {
    try {
      const r = await fetch(adresseRevocation(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: identifiants.refresh_token }).toString(),
        signal: AbortSignal.timeout(15000),
      });
      revoque = r.ok;
    } catch (e) {
      revoque = false;
    }
  }
  fs.rmSync(fichier, { force: true });
  dire(`✅ Accès retiré de ce poste (${fichier} supprimé).`);
  dire(revoque ? "Google a aussi révoqué l'autorisation." : "Pour retirer aussi l'autorisation chez Google : Compte Google → Sécurité → applications tierces ayant accès au compte.");
}

// ---------------------------------------------------------------- API Search Console

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function creerApi(jeton) {
  return async function appeler(chemin, { methode = "GET", corps } = {}) {
    const tentatives = 3;
    for (let n = 1; n <= tentatives; n++) {
      let reponse;
      try {
        reponse = await fetch(base() + chemin, {
          method: methode,
          headers: { Authorization: `Bearer ${jeton}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
          body: corps ? JSON.stringify(corps) : undefined,
          signal: AbortSignal.timeout(30000),
        });
      } catch (e) {
        throw new ErreurPulse(`Search Console ne répond pas (${(e.cause && e.cause.code) || e.name}) : vérifier la connexion Internet.`, 1);
      }
      if (reponse.ok) return reponse.json();
      const erreur = await reponse.json().catch(() => ({}));
      const raison = (erreur.error && erreur.error.message) || "";
      if (reponse.status === 429 || (reponse.status === 403 && /quota|rate/i.test(raison))) {
        if (n < tentatives) {
          await attendre(Number(process.env.PULSE_GSC_ATTENTE || 2000) * n);
          continue;
        }
        throw new ErreurPulse("Quota de Search Console atteint pour le moment : réessayer dans quelques minutes (ou demain pour l'inspection, limitée à 2 000 pages par jour).", 5);
      }
      if (reponse.status === 401) throw new ErreurPulse("Connexion refusée par Search Console (expirée ou révoquée) : se reconnecter avec pulse-aidd search-console connecter.", 3);
      if (reponse.status === 403) throw new ErreurPulse("Ce compte Google n'a pas accès à cette propriété Search Console. Vérifier la propriété (pulse-aidd search-console proprietes) ou demander l'accès à son propriétaire.", 4);
      if (reponse.status === 404) throw new ErreurPulse("Propriété ou adresse inconnue de Search Console : vérifier l'adresse (pulse-aidd search-console proprietes).", 4);
      throw new ErreurPulse(`Search Console a répondu avec le code ${reponse.status}${raison ? ` (${raison})` : ""}.`, 1);
    }
  };
}

async function listerProprietes(appeler) {
  const r = await appeler("/webmasters/v3/sites");
  return (r.siteEntry || []).map((s) => ({ siteUrl: s.siteUrl, droits: s.permissionLevel }));
}

/** Choisit la propriété qui couvre l'adresse du site : préfixe exact, puis domaine, puis variante www / http. */
function choisirPropriete(liste, adresse) {
  const utilisables = liste.filter((p) => p.droits !== "siteUnverifiedUser");
  let u;
  try {
    u = new URL(adresse);
  } catch (e) {
    return null;
  }
  const hote = u.hostname.toLowerCase();
  const prefixe = `${u.protocol}//${hote}${u.port ? ":" + u.port : ""}/`;
  const exact = utilisables.find((p) => p.siteUrl.toLowerCase() === prefixe);
  if (exact) return { siteUrl: exact.siteUrl, note: null };
  const domaine = utilisables
    .filter((p) => p.siteUrl.startsWith("sc-domain:"))
    .find((p) => {
      const d = p.siteUrl.slice("sc-domain:".length).toLowerCase();
      return hote === d || hote.endsWith("." + d);
    });
  if (domaine) return { siteUrl: domaine.siteUrl, note: null };
  const sansWww = hote.replace(/^www\./, "");
  const variante = utilisables.find((p) => {
    try {
      const v = new URL(p.siteUrl);
      return v.hostname.replace(/^www\./, "") === sansWww;
    } catch (e) {
      return false;
    }
  });
  if (variante) return { siteUrl: variante.siteUrl, note: `La propriété trouvée (${variante.siteUrl}) ne correspond pas exactement à l'adresse servie (${prefixe}) : les chiffres peuvent être incomplets.` };
  return null;
}

const ligne = (r) => ({ cle: (r.keys || [""])[0], clics: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr || 0, position: r.position || 0 });

async function performance(appeler, siteUrl, { debut, fin, dimensions = [] }) {
  const taille = Number(process.env.PULSE_GSC_TAILLE_PAGE || 25000);
  const lignes = [];
  for (let startRow = 0; ; startRow += taille) {
    const r = await appeler(`/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      methode: "POST",
      corps: { startDate: debut, endDate: fin, dimensions, type: "web", rowLimit: taille, startRow },
    });
    const recues = r.rows || [];
    lignes.push(...recues.map(ligne));
    if (recues.length < taille || dimensions.length === 0) break;
  }
  return lignes;
}

async function inspecterUrl(appeler, siteUrl, url) {
  const r = await appeler("/v1/urlInspection/index:inspect", { methode: "POST", corps: { inspectionUrl: url, siteUrl, languageCode: "en-US" } });
  return (r.inspectionResult && r.inspectionResult.indexStatusResult) || {};
}

// ---------------------------------------------------------------- Fonctions pures : dates

/** Date du jour en heure du Pacifique (AAAA-MM-JJ), fuseau des données Search Console. */
function datePacifique(instant) {
  const parties = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const v = (t) => parties.find((p) => p.type === t).value;
  return `${v("year")}-${v("month")}-${v("day")}`;
}

function decaler(jour, n) {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const JOURS = { "28j": 28, "3m": 91 };

/**
 * Fenêtre de lecture : se termine 3 jours avant aujourd'hui (heure du Pacifique), car les données
 * définitives arrivent en 2 à 3 jours ; 28 jours, ou 91 jours (13 semaines) pour « 3m ».
 */
function fenetre(instant = new Date(), periode = "28j") {
  const jours = JOURS[periode];
  if (!jours) throw new ErreurPulse(`Période inconnue « ${periode} » : 28j ou 3m.`, 1);
  const fin = decaler(datePacifique(instant), -3);
  return { debut: decaler(fin, -(jours - 1)), fin, jours };
}

/** La fenêtre de même longueur juste avant (mêmes jours de la semaine). */
function fenetrePrecedente(f) {
  const fin = decaler(f.debut, -1);
  return { debut: decaler(fin, -(f.jours - 1)), fin, jours: f.jours };
}

// ---------------------------------------------------------------- Fonctions pures : analyses

function mediane(valeurs) {
  if (!valeurs.length) return 0;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

const tranche = (position) => (position < 2.5 ? "1-2" : position <= 5.5 ? "3-5" : position <= 10.5 ? "6-10" : "11+");

/**
 * Requêtes à potentiel (heuristiques Pulse) :
 *  - « proche » : position moyenne entre 8 et 20, impressions régulières → enrichir la page et ses liens internes ;
 *  - « titre » : position 1 à 5, CTR inférieur à la moitié de la médiane du site dans la même tranche → revoir titre et description.
 */
function opportunites(lignes, { impressionsMin = 20, positionMin = 8, positionMax = 20, ecartCtr = 0.5, echantillonMin = 3 } = {}) {
  const resultat = [];
  const parTranche = {};
  for (const l of lignes) if (l.impressions >= impressionsMin) (parTranche[tranche(l.position)] = parTranche[tranche(l.position)] || []).push(l.ctr);
  for (const l of lignes) {
    if (l.impressions < impressionsMin) continue;
    if (l.position >= positionMin && l.position <= positionMax) resultat.push({ ...l, type: "proche" });
    else if (l.position <= 5.5) {
      const ctrs = parTranche[tranche(l.position)] || [];
      const ref = mediane(ctrs);
      if (ctrs.length >= echantillonMin && ref > 0 && l.ctr < ref * ecartCtr) resultat.push({ ...l, type: "titre", ctrReference: ref });
    }
  }
  return resultat.sort((a, b) => b.impressions - a.impressions);
}

function normaliserUrl(url) {
  try {
    const u = new URL(String(url).trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (u.pathname !== "/" && s.endsWith("/") && !u.search) s = s.slice(0, -1);
    return s;
  } catch (e) {
    return String(url).trim();
  }
}

/** Adresses du sitemap qui n'apparaissent dans aucune ligne « page » (aucune impression sur la période). */
function pagesSansImpression(urlsSitemap, lignesPages) {
  const vues = new Set(lignesPages.filter((l) => l.impressions > 0).map((l) => normaliserUrl(l.cle)));
  return [...new Set(urlsSitemap.map(normaliserUrl))].filter((u) => !vues.has(u));
}

const ENTITES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

/** Lit un sitemap : { type: "urlset" | "index", urls: [...] } (index : adresses des sitemaps enfants). */
function lireSitemap(xml) {
  const texte = String(xml || "");
  const type = /<sitemapindex[\s>]/i.test(texte) ? "index" : "urlset";
  const urls = [...texte.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&(amp|lt|gt|quot|apos);/g, (e) => ENTITES[e]));
  return { type, urls };
}

function sommer(lignes) {
  const clics = lignes.reduce((s, l) => s + l.clics, 0);
  const impressions = lignes.reduce((s, l) => s + l.impressions, 0);
  const position = impressions ? lignes.reduce((s, l) => s + l.position * l.impressions, 0) / impressions : 0;
  return { clics, impressions, ctr: impressions ? clics / impressions : 0, position };
}

function variation(avant, apres) {
  if (!avant) return apres ? null : 0;
  return (apres - avant) / avant;
}

/** Compare deux instantanés (période précédente → période actuelle). */
function comparer(avant, apres) {
  const totaux = {};
  for (const k of ["clics", "impressions", "ctr", "position"]) {
    const a = (avant.totaux && avant.totaux[k]) || 0;
    const b = (apres.totaux && apres.totaux[k]) || 0;
    totaux[k] = { avant: a, apres: b, ecart: b - a, variation: variation(a, b) };
  }
  const ecarts = (la, lb) => {
    const ma = new Map((la || []).map((l) => [l.cle, l]));
    const mb = new Map((lb || []).map((l) => [l.cle, l]));
    const cles = new Set([...ma.keys(), ...mb.keys()]);
    const liste = [...cles].map((cle) => {
      const a = ma.get(cle) || { clics: 0, impressions: 0 };
      const b = mb.get(cle) || { clics: 0, impressions: 0 };
      return { cle, clicsAvant: a.clics, clicsApres: b.clics, impressionsAvant: a.impressions, impressionsApres: b.impressions, ecart: b.impressions - a.impressions, nouveau: !ma.has(cle), disparu: !mb.has(cle) };
    });
    return {
      hausses: liste.filter((l) => l.ecart > 0).sort((x, y) => y.ecart - x.ecart).slice(0, 5),
      baisses: liste.filter((l) => l.ecart < 0).sort((x, y) => x.ecart - y.ecart).slice(0, 5),
      nouvelles: liste.filter((l) => l.nouveau).length,
      disparues: liste.filter((l) => l.disparu).length,
    };
  };
  return { periodeAvant: avant.periode, periodeApres: apres.periode, totaux, pages: ecarts(avant.pages, apres.pages), requetes: ecarts(avant.requetes, apres.requetes) };
}

// ---------------------------------------------------------------- Fonctions pures : états d'indexation

const VERDICTS = { PASS: "✅ indexée", PARTIAL: "🟡 indexée avec réserves", FAIL: "❌ non indexée", NEUTRAL: "⚪ exclue ou inconnue", VERDICT_UNSPECIFIED: "⚪ état inconnu" };

const ETATS = [
  [/^submitted and indexed$/i, "Envoyée et indexée", "Rien à faire : la page est dans l'index de Google."],
  [/^indexed, not submitted in sitemap$/i, "Indexée, mais absente du sitemap", "Ajouter la page au sitemap si elle doit être trouvée."],
  [/^indexed, though blocked by robots\.txt$/i, "Indexée malgré le blocage par robots.txt", "Décider : la page doit-elle être trouvée ? Si non, retirer le blocage et ajouter « noindex » ; si oui, retirer le blocage."],
  [/^discovered .? currently not indexed$/i, "Détectée, actuellement non indexée", "Rien à faire tout de suite : Google l'a trouvée et viendra plus tard. Vérifier qu'elle est liée depuis d'autres pages du site."],
  [/^crawled .? currently not indexed$/i, "Explorée, actuellement non indexée", "Google l'a lue sans la retenir pour l'instant : enrichir le contenu propre à la page et ses liens internes ; inutile de la renvoyer."],
  [/^alternate page with proper canonical tag$/i, "Autre page avec balise canonique correcte", "Rien à faire : c'est une copie qui renvoie vers la version officielle."],
  [/^duplicate without user-selected canonical$/i, "Doublon : aucune page canonique indiquée", "Indiquer la version officielle (canonique) ou différencier les contenus."],
  [/^duplicate, google chose different canonical than user$/i, "Doublon : Google a choisi une autre page canonique", "Vérifier quelle version doit compter, puis harmoniser la canonique, les liens et le sitemap."],
  [/^duplicate, submitted url not selected as canonical$/i, "Doublon : la page envoyée n'est pas retenue comme canonique", "Harmoniser la canonique, les liens internes et le sitemap."],
  [/^excluded by .?noindex.? tag$/i, "Exclue par la balise « noindex »", "Vérifier que c'est voulu (page privée) ; sinon retirer « noindex »."],
  [/^blocked by robots\.txt$/i, "Bloquée par le fichier robots.txt", "Vérifier que c'est voulu ; sinon corriger robots.txt."],
  [/^not found \(404\)$/i, "Introuvable (404)", "Normal si la page n'existe plus ; si elle a changé d'adresse, ajouter une redirection permanente (301)."],
  [/^soft 404$/i, "Soft 404 (page vide ou « introuvable » qui répond 200)", "Renvoyer un vrai code 404, ou donner un vrai contenu à la page."],
  [/^page with redirect$/i, "Page avec redirection", "Rien à faire si la redirection est voulue ; mettre la page d'arrivée dans le sitemap."],
  [/^server error \(5xx\)$/i, "Erreur serveur (5xx)", "Le site a planté quand Google est passé : vérifier que la page répond (pulse-aidd sonder)."],
  [/^redirect error$/i, "Erreur de redirection", "Corriger la chaîne de redirections (boucle ou trop longue)."],
  [/^blocked due to unauthorized request \(401\)$/i, "Bloquée : connexion demandée (401)", "Normal pour une page privée ; sinon la rendre publique."],
  [/^blocked due to access forbidden \(403\)$/i, "Bloquée : accès interdit (403)", "Normal pour une page privée ; sinon vérifier les réglages d'accès."],
  [/^url is unknown to google$/i, "Adresse inconnue de Google", "Google ne la connaît pas encore : la lier depuis une autre page, vérifier le sitemap, et demander l'indexation dans l'interface si elle est importante."],
  [/^page indexed without content$/i, "Indexée sans contenu", "Google n'a pas pu lire le contenu : vérifier que la page s'affiche sans connexion ni script bloqué."],
];

const INDEXATION = {
  INDEXING_ALLOWED: "autorisée",
  BLOCKED_BY_META_TAG: "bloquée par une balise « noindex »",
  BLOCKED_BY_HTTP_HEADER: "bloquée par un en-tête « noindex » (X-Robots-Tag)",
  BLOCKED_BY_ROBOTS_TXT: "bloquée par robots.txt",
  INDEXING_STATE_UNSPECIFIED: "inconnue",
};
const RECUPERATION = {
  SUCCESSFUL: "réussie",
  SOFT_404: "page vide (soft 404)",
  BLOCKED_ROBOTS_TXT: "bloquée par robots.txt",
  NOT_FOUND: "introuvable (404)",
  ACCESS_DENIED: "accès refusé (401)",
  SERVER_ERROR: "erreur serveur (5xx)",
  REDIRECT_ERROR: "erreur de redirection",
  ACCESS_FORBIDDEN: "accès interdit (403)",
  BLOCKED_4XX: "bloquée (erreur 4xx)",
  INTERNAL_CRAWL_ERROR: "erreur interne de Google",
  INVALID_URL: "adresse invalide",
  PAGE_FETCH_STATE_UNSPECIFIED: "inconnue",
};

/** Traduit un résultat d'inspection (indexStatusResult, en anglais) en français, avec ce qu'il faut faire. */
function traduireEtat(r = {}) {
  const couverture = String(r.coverageState || "").trim();
  const trouve = ETATS.find(([re]) => re.test(couverture));
  return {
    verdict: VERDICTS[r.verdict] || VERDICTS.VERDICT_UNSPECIFIED,
    etat: trouve ? trouve[1] : couverture || "inconnu",
    action: trouve ? trouve[2] : "État non répertorié par Pulse : lire l'explication de Google dans l'interface (Inspection de l'URL).",
    indexation: INDEXATION[r.indexingState] || r.indexingState || "inconnue",
    recuperation: RECUPERATION[r.pageFetchState] || r.pageFetchState || "inconnue",
    derniereVisite: r.lastCrawlTime ? String(r.lastCrawlTime).slice(0, 10) : "jamais",
    canoniqueGoogle: r.googleCanonical || null,
    canoniqueDeclaree: r.userCanonical || null,
    canoniqueDifferente: Boolean(r.googleCanonical && r.userCanonical && normaliserUrl(r.googleCanonical) !== normaliserUrl(r.userCanonical)),
  };
}

// ---------------------------------------------------------------- Fonctions pures : export CSV

/** Lit un CSV (guillemets, BOM, séparateur virgule, point-virgule ou tabulation) en tableau de lignes. */
function lireCsv(texte) {
  const t = String(texte).replace(/^﻿/, "");
  const premiere = t.split(/\r?\n/, 1)[0];
  const sep = [",", ";", "\t"].map((s) => [s, premiere.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const lignes = [];
  let champ = "";
  let courante = [];
  let guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') (champ += '"'), i++;
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) courante.push(champ), (champ = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      courante.push(champ);
      if (courante.some((v) => v !== "")) lignes.push(courante);
      (courante = []), (champ = "");
    } else champ += c;
  }
  courante.push(champ);
  if (courante.some((v) => v !== "")) lignes.push(courante);
  return lignes;
}

/** Nombre écrit à la française (« 1 234 », « 12,5 % ») ou à l'anglaise (« 1,234 », « 12.5% »). */
function nombre(texte, francais) {
  let s = String(texte == null ? "" : texte).replace(/[\s  %]/g, "");
  if (s === "" || s === "-") return 0;
  if (francais) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const COLONNES = {
  clics: /^(clicks|clics)$/i,
  impressions: /^impressions$/i,
  ctr: /^(ctr|taux de clics)$/i,
  position: /^position$/i,
};
const SORTES = [
  ["requetes", /^(top queries|queries|query|requêtes les plus fréquentes|requêtes|requête)$/i],
  ["pages", /^(top pages|pages|page|pages les plus populaires|pages principales)$/i],
  ["dates", /^(date|dates|jour|semaine|week|mois|month)$/i],
  ["filtres", /^(filter|filtre)$/i],
];
const FRANCAIS = /clics|requêtes|requête|pages les plus|filtre|valeur|jour|semaine|mois|pays|appareil/i;

function colonne(entetes, re) {
  let i = entetes.findIndex((e) => re.test(e.trim()));
  if (i < 0) i = entetes.findIndex((e) => re.test(e.trim().split(/\s+/).pop()));
  return i;
}

/** Classe un fichier d'export d'après sa première colonne, et lit ses lignes. */
function lireTableau(texte) {
  const lignes = lireCsv(texte);
  if (!lignes.length) return null;
  const entetes = lignes[0].map((e) => e.trim());
  const sorte = (SORTES.find(([, re]) => re.test(entetes[0])) || [null])[0];
  if (!sorte) return null;
  const francais = FRANCAIS.test(entetes.join(" "));
  if (sorte === "filtres") return { sorte, lignes: lignes.slice(1).map((l) => ({ filtre: l[0], valeur: l[1] || "" })) };
  const idx = Object.fromEntries(Object.entries(COLONNES).map(([k, re]) => [k, colonne(entetes, re)]));
  return {
    sorte,
    francais,
    lignes: lignes.slice(1).map((l) => ({
      cle: (l[0] || "").trim(),
      clics: idx.clics >= 0 ? nombre(l[idx.clics], francais) : 0,
      impressions: idx.impressions >= 0 ? nombre(l[idx.impressions], francais) : 0,
      ctr: idx.ctr >= 0 ? Math.round(nombre(l[idx.ctr], francais) * 1e4) / 1e6 : 0,
      position: idx.position >= 0 ? nombre(l[idx.position], francais) : 0,
    })),
  };
}

/** Lit les fichiers d'une archive ZIP (méthodes « stockée » et « deflate »), sans dépendance. */
function lireZip(tampon) {
  let fin = -1;
  for (let i = tampon.length - 22; i >= Math.max(0, tampon.length - 65557); i--) {
    if (tampon.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new ErreurPulse("Archive ZIP illisible (fin de répertoire introuvable) : décompressez-la et indiquez le dossier.", 1);
  const nombreFichiers = tampon.readUInt16LE(fin + 10);
  let p = tampon.readUInt32LE(fin + 16);
  const fichiers = [];
  for (let n = 0; n < nombreFichiers; n++) {
    if (tampon.readUInt32LE(p) !== 0x02014b50) break;
    const methode = tampon.readUInt16LE(p + 10);
    const taille = tampon.readUInt32LE(p + 20);
    const longNom = tampon.readUInt16LE(p + 28);
    const longExtra = tampon.readUInt16LE(p + 30);
    const longComm = tampon.readUInt16LE(p + 32);
    const local = tampon.readUInt32LE(p + 42);
    const nom = tampon.slice(p + 46, p + 46 + longNom).toString("utf8");
    p += 46 + longNom + longExtra + longComm;
    const debut = local + 30 + tampon.readUInt16LE(local + 26) + tampon.readUInt16LE(local + 28);
    const donnees = tampon.slice(debut, debut + taille);
    if (methode === 0) fichiers.push({ nom, contenu: donnees.toString("utf8") });
    else if (methode === 8) fichiers.push({ nom, contenu: zlib.inflateRawSync(donnees).toString("utf8") });
  }
  return fichiers;
}

/** Fichiers CSV d'un export : archive .zip, dossier, ou un seul fichier .csv. */
function fichiersExport(chemin) {
  if (!fs.existsSync(chemin)) throw new ErreurPulse(`Export introuvable : ${chemin}`, 1);
  const st = fs.statSync(chemin);
  if (st.isDirectory()) {
    return fs
      .readdirSync(chemin)
      .filter((f) => /\.csv$/i.test(f))
      .map((f) => ({ nom: f, contenu: fs.readFileSync(path.join(chemin, f), "utf8") }));
  }
  if (/\.zip$/i.test(chemin)) return lireZip(fs.readFileSync(chemin)).filter((f) => /\.csv$/i.test(f.nom));
  return [{ nom: path.basename(chemin), contenu: fs.readFileSync(chemin, "utf8") }];
}

/** Données d'un export « Performances » de Search Console (en-têtes français ou anglais). */
function lireExport(fichiers) {
  const donnees = { requetes: [], pages: [], dates: [], filtres: [], fichiersIgnores: [] };
  for (const f of fichiers) {
    const t = lireTableau(f.contenu);
    if (!t) donnees.fichiersIgnores.push(f.nom);
    else donnees[t.sorte] = t.lignes;
  }
  if (!donnees.requetes.length && !donnees.pages.length && !donnees.dates.length) {
    throw new ErreurPulse("Aucun tableau de performances reconnu dans cet export (requêtes, pages ou dates). Exporter depuis « Performances » → « Exporter » → « Télécharger le fichier CSV ».", 1);
  }
  const dates = donnees.dates.map((d) => d.cle).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const totaux = sommer(donnees.dates.length ? donnees.dates : donnees.pages);
  return {
    source: "export",
    periode: dates.length ? { debut: dates[0], fin: dates[dates.length - 1], jours: Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 864e5) + 1 } : null,
    filtres: donnees.filtres,
    totaux,
    requetes: donnees.requetes,
    pages: donnees.pages,
    fichiersIgnores: donnees.fichiersIgnores,
  };
}

// ---------------------------------------------------------------- Fonctions pures : rapport

const fr = (n, d = 0) => Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, " ");
const pct = (x) => `${fr((x || 0) * 100, 1)} %`;
const pos = (x) => (x ? fr(x, 1) : "–");
const signe = (x, f = fr) => (x > 0 ? "+" : x < 0 ? "−" : "±") + f(Math.abs(x));
const cellule = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

function cheminPage(url) {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch (e) {
    return url;
  }
}

function tableau(lignes, titre, limite = 10) {
  if (!lignes.length) return "_Aucune ligne pour cette période._\n";
  const t = [`| ${titre} | Clics | Impressions | CTR | Position |`, "|---|---:|---:|---:|---:|"];
  for (const l of [...lignes].sort((a, b) => b.clics - a.clics || b.impressions - a.impressions).slice(0, limite)) {
    t.push(`| ${cellule(titre === "Page" ? cheminPage(l.cle) : l.cle)} | ${fr(l.clics)} | ${fr(l.impressions)} | ${pct(l.ctr)} | ${pos(l.position)} |`);
  }
  return t.join("\n") + "\n";
}

/** Jusqu'à 3 actions prioritaires, chacune reliée à une page ou une requête et à une commande Pulse. */
function actions(d) {
  const liste = [];
  for (const i of d.inspection || []) {
    if (liste.length >= 3) break;
    if (/noindex|robots|404|5xx|Erreur|Bloquée|Doublon/.test(`${i.etat} ${i.indexation}`) && !/^Rien/.test(i.action)) {
      liste.push(`**${cheminPage(i.url)}** – ${i.etat} : ${i.action} → \`/pulse:spirc "${cheminPage(i.url)} : ${i.etat.toLowerCase()}"\``);
    }
  }
  for (const o of d.opportunites || []) {
    if (liste.length >= 3) break;
    if (o.type === "titre") liste.push(`**« ${o.cle} »** – bien placée (position ${pos(o.position)}) mais peu cliquée (${pct(o.ctr)} contre ${pct(o.ctrReference)} en moyenne à ce rang) : revoir le titre et la description de la page qui répond → \`/pulse:seo textes\``);
    else liste.push(`**« ${o.cle} »** – en position ${pos(o.position)}, ${fr(o.impressions)} impressions : enrichir la page qui répond et ajouter des liens vers elle depuis vos autres pages → \`/pulse:spirc "enrichir la page sur ${o.cle}"\``);
  }
  if (liste.length < 3 && (d.sansImpression || []).length) {
    liste.push(`**${d.sansImpression.length} page${d.sansImpression.length > 1 ? "s" : ""} du sitemap sans impression** (ex. ${cheminPage(d.sansImpression[0])}) : vérifier qu'elles sont liées depuis l'accueil et qu'elles répondent à une vraie question → \`/pulse:search-console inspecter ${d.sansImpression[0]}\``);
  }
  return liste;
}

function enBref(d) {
  if (!d.totaux.impressions) {
    return [
      "- Pas encore de données : c'est normal pour un site relié depuis moins d'une semaine, ou encore peu connu de Google.",
      `- Revenez vers le ${d.prochaineLecture} pour un premier relevé ; le premier vrai rapport vient après 28 jours.`,
      "- En attendant : vérifier dans l'interface que le sitemap est « Réussi », et lier vos pages entre elles.",
    ];
  }
  const l = [`- Google a montré votre site **${fr(d.totaux.impressions)} fois** en ${d.periode ? d.periode.jours : "?"} jours ; **${fr(d.totaux.clics)} visites** en sont venues.`];
  const top = [...d.requetes].sort((a, b) => b.clics - a.clics || b.impressions - a.impressions)[0];
  if (top) l.push(`- La requête qui vous amène le plus : « ${top.cle} » (${fr(top.clics)} clics, ${fr(top.impressions)} impressions).`);
  if (d.totaux.impressions < 100) l.push("- Volume encore faible : les CTR et les positions ne permettent pas de conclusion pour l'instant.");
  else if (d.actions.length) l.push(`- À regarder en premier : ${d.actions[0].replace(/ → .*$/, "")}.`);
  else l.push("- Rien d'urgent : continuez à publier et à relier vos pages.");
  return l;
}

/** Rapport Markdown daté (modèle : templates/rapport-search-console.md). */
function rapport(d) {
  const s = [];
  const periode = d.periode ? `${d.periode.debut} → ${d.periode.fin} (${d.periode.jours} jours, heure du Pacifique)` : "non indiquée dans l'export (fichier « Dates » absent)";
  s.push(`# Search Console – ${d.site || "site"} – ${d.date}`, "");
  s.push(`> Source : ${d.source === "api" ? `connexion en lecture seule, propriété \`${d.propriete}\`` : "export CSV de l'interface"} · Période : ${periode} · Données définitives seulement : les 2 à 3 derniers jours manquent toujours.`);
  const filtres = (d.filtres || []).filter((f) => f.filtre && !/^date$/i.test(f.filtre));
  if (filtres.length) s.push(`>`, `> Filtres de l'export : ${filtres.map((f) => `${f.filtre} = ${f.valeur}`).join(" · ")}. Les chiffres ne valent que pour ces filtres.`);
  if (d.note) s.push(`>`, `> ⚠️ ${d.note}`);
  s.push("", "## En bref", "", ...enBref(d), "");
  s.push("## Les chiffres", "", "| Clics | Impressions | CTR | Position moyenne |", "|---:|---:|---:|---:|");
  s.push(`| ${fr(d.totaux.clics)} | ${fr(d.totaux.impressions)} | ${pct(d.totaux.ctr)} | ${pos(d.totaux.position)} |`, "");
  const sommeRequetes = d.requetes.reduce((t, l) => t + l.impressions, 0);
  if (d.totaux.impressions && sommeRequetes < d.totaux.impressions) {
    s.push(`Les requêtes listées totalisent ${fr(sommeRequetes)} impressions sur ${fr(d.totaux.impressions)} : Google masque les requêtes rares (confidentialité). C'est normal.`, "");
  }
  s.push("## Pages principales", "", tableau(d.pages, "Page"));
  s.push("## Requêtes principales", "", tableau(d.requetes, "Requête"));
  s.push("## Requêtes à potentiel", "");
  if (!d.opportunites.length) s.push("_Aucune pour l'instant (il faut au moins 20 impressions par requête)._", "");
  else {
    s.push("| Requête | Impressions | CTR | Position | Piste |", "|---|---:|---:|---:|---|");
    for (const o of d.opportunites.slice(0, 10)) s.push(`| ${cellule(o.cle)} | ${fr(o.impressions)} | ${pct(o.ctr)} | ${pos(o.position)} | ${o.type === "titre" ? "bien placée, peu cliquée : titre et description" : "proche de la première page : enrichir, relier"} |`);
    s.push("");
  }
  s.push("## Pages du sitemap sans impression", "");
  if (d.sitemap === null) s.push("_Sitemap non lu (export CSV, ou sitemap introuvable)._", "");
  else if (!d.sansImpression.length) s.push(`_Toutes les pages du sitemap (${d.sitemap}) ont été vues au moins une fois._`, "");
  else {
    s.push(`${d.sansImpression.length} sur ${d.sitemap} :`, "");
    for (const u of d.sansImpression.slice(0, 20)) s.push(`- ${u}`);
    if (d.sansImpression.length > 20) s.push(`- … et ${d.sansImpression.length - 20} autres`);
    s.push("");
  }
  s.push("## Échantillon d'indexation", "");
  if (!d.inspection) s.push("_Pas d'inspection (export CSV, ou inspection non demandée). Le rapport « Indexation des pages » de l'interface donne la vue complète._", "");
  else {
    s.push(`Échantillon de ${d.inspection.length} page${d.inspection.length > 1 ? "s" : ""} inspectée${d.inspection.length > 1 ? "s" : ""} une par une : ce n'est **pas** la couverture complète du site.`, "");
    s.push("| Page | Verdict | État | Dernière visite de Google | Que faire |", "|---|---|---|---|---|");
    for (const i of d.inspection) s.push(`| ${cellule(cheminPage(i.url))} | ${i.verdict} | ${cellule(i.etat)} | ${i.derniereVisite} | ${cellule(i.action)} |`);
    s.push("");
  }
  if (d.evolution) {
    const e = d.evolution;
    s.push("## Évolution", "", `Période précédente : ${e.periodeAvant ? `${e.periodeAvant.debut} → ${e.periodeAvant.fin}` : "rapport précédent"}.`, "");
    s.push("| | Avant | Maintenant | Écart |", "|---|---:|---:|---:|");
    s.push(`| Clics | ${fr(e.totaux.clics.avant)} | ${fr(e.totaux.clics.apres)} | ${signe(e.totaux.clics.ecart)} |`);
    s.push(`| Impressions | ${fr(e.totaux.impressions.avant)} | ${fr(e.totaux.impressions.apres)} | ${signe(e.totaux.impressions.ecart)} |`);
    s.push(`| CTR | ${pct(e.totaux.ctr.avant)} | ${pct(e.totaux.ctr.apres)} | ${signe(e.totaux.ctr.ecart * 100, (x) => fr(x, 1))} pt |`);
    s.push(`| Position moyenne | ${pos(e.totaux.position.avant)} | ${pos(e.totaux.position.apres)} | ${signe(e.totaux.position.ecart, (x) => fr(x, 1))} (plus bas = mieux) |`, "");
    const liste = (titre, l) => {
      if (!l.length) return;
      s.push(`${titre} :`, "");
      for (const x of l) s.push(`- ${cheminPage(x.cle)} : ${fr(x.impressionsAvant)} → ${fr(x.impressionsApres)} impressions`);
      s.push("");
    };
    liste("Pages en hausse", e.pages.hausses);
    liste("Pages en baisse", e.pages.baisses);
    s.push(`Requêtes nouvelles : ${e.requetes.nouvelles} · disparues : ${e.requetes.disparues}.`, "");
  }
  s.push("## Actions prioritaires", "");
  if (!d.actions.length) s.push("Rien d'urgent. Continuez à publier, à relier vos pages entre elles, et revenez dans 28 jours.", "");
  else d.actions.forEach((a, i) => s.push(`${i + 1}. ${a}`));
  if (d.actions.length) s.push("");
  s.push("## Ce que ce rapport ne montre pas", "");
  s.push("À regarder dans l'interface de Search Console :", "");
  s.push("- **Indexation des pages** : la liste complète des pages indexées ou non, et pourquoi.");
  s.push("- **Performances dans l'IA générative** (AI Overviews, AI Mode) : impressions seulement, par page ; ces apparitions comptent aussi dans les chiffres ci-dessus.");
  s.push("- **Requêtes de marque**, **Insights**, **annotations** : visibles seulement dans l'interface.");
  s.push("- **Bing Webmaster Tools** : vos chiffres Bing et le rapport « AI Performance » (citations dans Copilot).", "");
  s.push("## Journal des changements du site", "");
  s.push(d.journal && d.journal.length ? d.journal.map((j) => `- ${j}`).join("\n") : "_Aucun changement noté depuis le rapport précédent._", "");
  s.push(`_Prochain rapport conseillé : à partir du ${d.prochainRapport}._`, "");
  return s.join("\n");
}

// ---------------------------------------------------------------- Projet de la personne

/** Adresse du site : « Site en ligne » de docs/technical.md, sinon une adresse de site dans CLAUDE.md. */
function siteDuProjet(dossier = process.cwd()) {
  const lire = (f) => (fs.existsSync(path.join(dossier, f)) ? fs.readFileSync(path.join(dossier, f), "utf8") : "");
  const technique = lire(path.join("docs", "technical.md")).match(/Site en ligne\s*:\s*\**\s*<?(https?:\/\/[^\s>)`*,]+)/i);
  if (technique) return technique[1];
  const claude = lire("CLAUDE.md").match(/^.*[Ss]ite.*?(https?:\/\/[^\s>)`*,]+)/m);
  return claude ? claude[1] : null;
}

const aujourdhui = () => process.env.PULSE_GSC_AUJOURDHUI || new Date().toISOString().slice(0, 10);
const dossierRapports = () => path.join(process.cwd(), "docs", "referencement");

function dernierInstantane(avantLe) {
  const dossier = path.join(dossierRapports(), "donnees");
  if (!fs.existsSync(dossier)) return null;
  const f = fs
    .readdirSync(dossier)
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n) && n.slice(0, 10) < avantLe)
    .sort()
    .pop();
  return f ? JSON.parse(fs.readFileSync(path.join(dossier, f), "utf8")) : null;
}

// ---------------------------------------------------------------- Lecture complète

async function lireSitemapDuSite(site) {
  const urls = [];
  const aLire = [new URL("/sitemap.xml", site).toString()];
  for (let n = 0; n < aLire.length && n < 10; n++) {
    let r;
    try {
      r = await fetch(aLire[n], { signal: AbortSignal.timeout(15000) });
    } catch (e) {
      continue;
    }
    if (!r.ok) continue;
    const { type, urls: trouvees } = lireSitemap(await r.text());
    if (type === "index") aLire.push(...trouvees);
    else urls.push(...trouvees);
  }
  return aLire.length && urls.length ? urls : null;
}

async function collecter(opts) {
  const date = aujourdhui();
  if (opts.fichier) {
    const d = lireExport(fichiersExport(opts.fichier));
    return { ...d, date, site: opts.site || siteDuProjet(), sitemap: null, sansImpression: [], inspection: null };
  }
  const site = opts.site || siteDuProjet();
  if (!site && !opts.propriete) throw new ErreurPulse("Adresse du site inconnue : la renseigner dans « Site en ligne » de docs/technical.md, ou passer --site <adresse>.", 1);
  const appeler = creerApi(await jetonAcces(lireIdentifiants()));
  let propriete = opts.propriete;
  let note = null;
  if (!propriete) {
    const choix = choisirPropriete(await listerProprietes(appeler), site);
    if (!choix) throw new ErreurPulse(`Aucune propriété Search Console de ce compte ne couvre ${site}. Relier le site d'abord (/pulse:search-console relier), ou vérifier le compte Google utilisé.`, 4);
    propriete = choix.siteUrl;
    note = choix.note;
  }
  const f = fenetre(new Date(`${date}T20:00:00Z`), opts.periode);
  const lirePeriode = async (p) => {
    const [totaux, pages, requetes] = await Promise.all([
      performance(appeler, propriete, { ...p, dimensions: [] }),
      performance(appeler, propriete, { ...p, dimensions: ["page"] }),
      performance(appeler, propriete, { ...p, dimensions: ["query"] }),
    ]);
    return { totaux: totaux[0] ? (({ cle, ...t }) => t)(totaux[0]) : sommer([]), pages, requetes };
  };
  const actuel = await lirePeriode(f);
  let sitemap = null;
  let sansImpression = [];
  let urlsSitemap = [];
  if (site) {
    urlsSitemap = (await lireSitemapDuSite(site)) || [];
    if (urlsSitemap.length) {
      sitemap = urlsSitemap.length;
      sansImpression = pagesSansImpression(urlsSitemap, actuel.pages);
    }
  }
  let inspection = null;
  const n = Math.min(Number.isFinite(opts.inspecter) ? opts.inspecter : 10, 20);
  if (n > 0 && site) {
    const cibles = [...new Set([normaliserUrl(new URL("/", site).toString()), ...sansImpression, ...urlsSitemap.map(normaliserUrl)])].slice(0, n);
    inspection = [];
    for (const url of cibles) inspection.push({ url, ...traduireEtat(await inspecterUrl(appeler, propriete, url)) });
  }
  const d = { source: "api", date, site, propriete, note, periode: f, ...actuel, sitemap, sansImpression, inspection };
  if (opts.suivre) d.precedent = { periode: fenetrePrecedente(f), ...(await lirePeriode(fenetrePrecedente(f))) };
  return d;
}

function completer(d) {
  d.opportunites = opportunites(d.requetes);
  d.actions = actions(d);
  d.prochaineLecture = decaler(d.date, 7);
  d.prochainRapport = decaler(d.date, 28);
  return d;
}

function instantane(d) {
  const garder = (l) => [...l].sort((a, b) => b.impressions - a.impressions).slice(0, 500);
  return { date: d.date, site: d.site, propriete: d.propriete || null, source: d.source, periode: d.periode, totaux: d.totaux, pages: garder(d.pages), requetes: garder(d.requetes), sitemap: d.sitemap, sansImpression: d.sansImpression, inspection: d.inspection };
}

async function lire(opts) {
  const d = await collecter(opts);
  if (opts.suivre) {
    const avant = d.precedent || dernierInstantane(d.date);
    if (!avant) throw new ErreurPulse("Aucune période précédente à comparer : faire d'abord un relevé avec « lire » (ou utiliser la connexion en lecture seule, qui lit les deux périodes).", 1);
    d.evolution = comparer(avant, d);
    delete d.precedent;
  }
  completer(d);
  const texte = rapport(d);
  if (opts.ecrire) {
    const dossier = dossierRapports();
    fs.mkdirSync(path.join(dossier, "donnees"), { recursive: true });
    const md = path.join(dossier, `search-console-${d.date}.md`);
    const json = path.join(dossier, "donnees", `${d.date}.json`);
    fs.writeFileSync(md, texte);
    fs.writeFileSync(json, JSON.stringify(instantane(d), null, 2) + "\n");
    dire(`Rapport écrit : ${path.relative(process.cwd(), md).replace(/\\/g, "/")}`);
    dire(`Instantané : ${path.relative(process.cwd(), json).replace(/\\/g, "/")}`);
    dire("");
  }
  dire(opts.json ? JSON.stringify({ ...instantane(d), opportunites: d.opportunites, actions: d.actions, evolution: d.evolution || null }, null, 2) : texte);
  if (!d.totaux.impressions) process.exitCode = 6;
}

async function inspecter(opts) {
  if (!opts.adresse || !/^https?:\/\/\S+$/.test(opts.adresse)) throw new ErreurPulse("Usage : pulse-aidd search-console inspecter <adresse complète de la page, https://…>", 1);
  const appeler = creerApi(await jetonAcces(lireIdentifiants()));
  let propriete = opts.propriete;
  if (!propriete) {
    const choix = choisirPropriete(await listerProprietes(appeler), opts.site || opts.adresse);
    if (!choix) throw new ErreurPulse(`Aucune propriété Search Console de ce compte ne couvre ${opts.adresse}.`, 4);
    propriete = choix.siteUrl;
  }
  const t = traduireEtat(await inspecterUrl(appeler, propriete, opts.adresse));
  dire(`# Inspection – ${opts.adresse}`);
  dire("");
  dire(`- Verdict : ${t.verdict}`);
  dire(`- État : ${t.etat}`);
  dire(`- Que faire : ${t.action}`);
  dire(`- Indexation : ${t.indexation} · récupération de la page : ${t.recuperation}`);
  dire(`- Dernière visite de Google : ${t.derniereVisite}`);
  if (t.canoniqueGoogle || t.canoniqueDeclaree) dire(`- Version officielle (canonique) : déclarée ${t.canoniqueDeclaree || "aucune"} · retenue par Google ${t.canoniqueGoogle || "aucune"}${t.canoniqueDifferente ? " ⚠️ différentes" : ""}`);
  dire("");
  dire("C'est l'état de la version déjà indexée (pas un test en direct). Une demande d'indexation se fait dans l'interface : Inspection de l'URL → Demander l'indexation.");
}

async function proprietes() {
  const appeler = creerApi(await jetonAcces(lireIdentifiants()));
  const liste = await listerProprietes(appeler);
  if (!liste.length) {
    dire("Aucune propriété visible avec ce compte Google. Ajouter et vérifier le site dans Search Console d'abord (/pulse:search-console relier).");
    return;
  }
  const DROITS = { siteOwner: "propriétaire", siteFullUser: "utilisateur complet", siteRestrictedUser: "utilisateur restreint", siteUnverifiedUser: "non vérifiée" };
  dire("Propriétés visibles avec ce compte (lecture seule) :");
  for (const p of liste) dire(`- ${p.siteUrl} – ${DROITS[p.droits] || p.droits}`);
}

// ---------------------------------------------------------------- Ligne de commande

const USAGE = `Usage :
  pulse-aidd search-console connecter --client <client_secret_….json> [--sans-navigateur]
  pulse-aidd search-console deconnecter
  pulse-aidd search-console proprietes
  pulse-aidd search-console lire [--periode 28j|3m] [--fichier <export>] [--site <adresse>] [--inspecter <n>] [--ecrire] [--json]
  pulse-aidd search-console suivre [mêmes options que lire]
  pulse-aidd search-console inspecter <adresse>`;

function lireArguments(argv) {
  const opts = { action: argv[0], periode: "28j", inspecter: undefined };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--periode") opts.periode = argv[++i];
    else if (a === "--fichier") opts.fichier = argv[++i];
    else if (a === "--site") opts.site = argv[++i];
    else if (a === "--propriete") opts.propriete = argv[++i];
    else if (a === "--client") opts.client = argv[++i];
    else if (a === "--inspecter") opts.inspecter = Number(argv[++i]);
    else if (a === "--ecrire") opts.ecrire = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--sans-navigateur") opts.sansNavigateur = true;
    else if (!a.startsWith("--") && !opts.adresse) opts.adresse = a;
  }
  if (opts.fichier) opts.inspecter = 0;
  return opts;
}

async function principal(argv) {
  const opts = lireArguments(argv);
  try {
    switch (opts.action) {
      case "connecter":
        return await connecter(opts);
      case "deconnecter":
        return await deconnecter();
      case "proprietes":
        return await proprietes();
      case "lire":
        return await lire(opts);
      case "suivre":
        return await lire({ ...opts, suivre: true });
      case "inspecter":
        return await inspecter(opts);
      default:
        signaler(USAGE);
        process.exitCode = 1;
    }
  } catch (e) {
    signaler(`❌ ${e instanceof ErreurPulse ? e.message : `Erreur inattendue : ${e.message}`}`);
    process.exitCode = e instanceof ErreurPulse ? e.code : 1;
  }
}

if (require.main === module) principal(process.argv.slice(2));

module.exports = {
  PORTEE,
  masquer,
  dossierConfig,
  pkce,
  urlAutorisation,
  jwtCompteService,
  attendreRetour,
  lireClient,
  choisirPropriete,
  datePacifique,
  fenetre,
  fenetrePrecedente,
  opportunites,
  pagesSansImpression,
  lireSitemap,
  comparer,
  traduireEtat,
  lireCsv,
  nombre,
  lireTableau,
  lireZip,
  lireExport,
  rapport,
  actions,
  siteDuProjet,
  sommer,
};

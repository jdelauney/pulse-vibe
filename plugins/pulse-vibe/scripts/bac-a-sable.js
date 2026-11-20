#!/usr/bin/env node
// Pulse – le bac à sable de Claude Code (`pulse-aidd autorisations --bac-a-sable [--ecrire]`, et module des scripts réseau).
//
// Le bac à sable limite, au niveau du système, ce que les commandes du shell peuvent écrire et les domaines qu'elles peuvent
// joindre (note docs/superpowers/notes/2026-11-19-bac-a-sable.md, essais du 2026-11-19). Il marche sous macOS, Linux et
// WSL2, pas sous Windows natif ni WSL1. Dans une commande, il se signale par SANDBOX_RUNTIME=1 ; son réseau passe par un
// proxy (HTTPS_PROXY) que fetch de Node lit seulement avec NODE_USE_ENV_PROXY=1 (posé par bin/pulse-aidd).
//
// Le réglage proposé (.claude/settings.json, clé « sandbox ») : bac à sable actif ; écriture permise dans les caches de npm
// et des navigateurs de test (~/.npm, ~/.cache) ; domaines du cœur (paquets, dépôt GitHub), ceux du pack de pile déclaré
// (ligne « domaines: » de pulse-pile-<id> info, passée par PULSE_PACK_DOMAINES), l'adresse du site en ligne (CLAUDE.md) et
// localhost quand le projet a des tests de bout en bout ; lecture permise des fichiers de variables que lisent la
// construction et les tests (.env, .env.local, .env.<mode>.local). Sans elle, le bac à sable applique aux commandes la
// règle Read(./.env…) que Pulse écrit pour l'IA, et la construction ne trouve plus ses variables (essai du 2026-11-19) ;
// les garde-fous refusent toujours une commande qui nomme ces fichiers ; captures des maquettes et relevé d'un site lancés
// hors du bac à sable (excludedCommands), parce que le navigateur y est refusé. Les réglages déjà présents sont gardés.
//
//   pulse-aidd autorisations --bac-a-sable           plateforme, état, domaines qui manquent
//   pulse-aidd autorisations --bac-a-sable --ecrire  écrit le réglage dans .claude/settings.json
//
// Module : actif(env), causeReseau(adresse, env), plateforme(), reglage(racine, options), etat(racine), ecrire(racine).
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const DOMAINES_COEUR = ["registry.npmjs.org", "*.npmjs.org", "pypi.org", "files.pythonhosted.org", "github.com", "*.github.com", "codeload.github.com", "objects.githubusercontent.com"];
const ECRITURE = ["~/.npm", "~/.cache"];
const LECTURE = [".env", ".env.local", ".env.development.local", ".env.production.local", ".env.test.local"];
// Commandes lancées hors du bac à sable : elles ouvrent le navigateur du poste, qui y est refusé (sockets Unix bloquées sous
// Linux et WSL2, essai du 2026-11-20) ; hors du bac à sable, le navigateur garde son propre bac à sable.
const HORS_BAC = ["pulse-aidd maquettes capturer *", "pulse-aidd identite site *"];

const actif = (env = process.env) => env.SANDBOX_RUNTIME === "1";

/** La phrase à donner quand une requête échoue dans le bac à sable : le domaine à autoriser. */
function causeReseau(adresse, env = process.env) {
  if (!actif(env)) return null;
  let hote = String(adresse || "");
  try {
    hote = new URL(adresse).hostname;
  } catch (e) {
    // adresse sans protocole : gardée telle quelle
  }
  return `le bac à sable de Claude Code bloque peut-être « ${hote} » : s'il manque à sandbox.network.allowedDomains de .claude/settings.json, ajoutez-le (pulse-aidd autorisations --bac-a-sable)`;
}

/** « proposable » (macOS, Linux, WSL2), « windows » ou « wsl1 ». */
function plateforme(systeme = process.platform, version = lireVersionNoyau()) {
  if (systeme === "win32") return "windows";
  if (systeme === "linux" && /microsoft/i.test(version) && !/WSL2|microsoft-standard/i.test(version)) return "wsl1";
  return systeme === "darwin" || systeme === "linux" ? "proposable" : "windows";
}

function lireVersionNoyau() {
  try {
    return fs.readFileSync("/proc/version", "utf8");
  } catch (e) {
    return os.release();
  }
}

const lireSi = (f) => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch (e) {
    return "";
  }
};

function lireReglages(f) {
  try {
    const r = JSON.parse(fs.readFileSync(f, "utf8"));
    return r && typeof r === "object" ? r : {};
  } catch (e) {
    return {};
  }
}

/** Les domaines utiles au projet : cœur, pack, site en ligne, localhost pour les tests de bout en bout. */
function domaines(racine, env = process.env) {
  const liste = [...DOMAINES_COEUR, ...String(env.PULSE_PACK_DOMAINES || "").split(/\s+/).filter(Boolean)];
  const site = (/Site en ligne\s*:\s*<?(https?:\/\/[^\s>)`*,]+)/i.exec(lireSi(path.join(racine, "CLAUDE.md"))) || [])[1];
  if (site) {
    try {
      liste.push(new URL(site).hostname);
    } catch (e) {
      // adresse illisible : laissée de côté
    }
  }
  if (/playwright|test:e2e|bout en bout/i.test(lireSi(path.join(racine, "docs", "technical.md")))) liste.push("localhost", "127.0.0.1");
  return [...new Set(liste)];
}

/** Le réglage « sandbox » complet, fusionné avec celui du projet (rien de retiré). */
function reglage(racine, env = process.env) {
  const actuel = lireReglages(path.join(racine, ".claude", "settings.json")).sandbox || {};
  const reseau = actuel.network || {};
  const fichiers = actuel.filesystem || {};
  return {
    ...actuel,
    enabled: true,
    filesystem: {
      ...fichiers,
      allowWrite: [...new Set([...(fichiers.allowWrite || []), ...ECRITURE])],
      allowRead: [...new Set([...(fichiers.allowRead || []), ...LECTURE])],
    },
    network: { ...reseau, allowedDomains: [...new Set([...(reseau.allowedDomains || []), ...domaines(racine, env)])] },
    excludedCommands: [...new Set([...(actuel.excludedCommands || []), ...HORS_BAC])],
  };
}

/** L'état : { plateforme, actif, manquants: [domaines ou chemins absents du réglage du projet] }. */
function etat(racine, env = process.env) {
  const actuel = lireReglages(path.join(racine, ".claude", "settings.json")).sandbox || {};
  const f = actuel.filesystem || {};
  const presents = new Set([...((actuel.network || {}).allowedDomains || []), ...(f.allowWrite || []), ...(f.allowRead || []), ...(actuel.excludedCommands || [])]);
  return {
    plateforme: plateforme(),
    actif: actuel.enabled === true,
    manquants: [...ECRITURE, ...LECTURE, ...HORS_BAC, ...domaines(racine, env)].filter((x) => !presents.has(x)),
  };
}

/** Écrit le réglage dans .claude/settings.json ; rend le nombre d'éléments ajoutés. */
function ecrire(racine, env = process.env) {
  const f = path.join(racine, ".claude", "settings.json");
  const r = lireReglages(f);
  const avant = etat(racine, env);
  r.sandbox = reglage(racine, env);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(r, null, 2) + "\n");
  return avant.manquants.length + (avant.actif ? 0 : 1);
}

function formaterEtat(e) {
  const lignes = [`plateforme: ${e.plateforme}`, `bac-a-sable: ${e.actif ? "actif" : "absent"}`, `manquants: ${e.manquants.length}`, ...e.manquants.map((x) => `- ${x}`)];
  if (e.plateforme === "windows") lignes.push("note: le bac à sable de Claude Code ne fonctionne pas sous Windows natif ; il marche si Claude Code est lancé dans WSL2.");
  if (e.plateforme === "wsl1") lignes.push("note: WSL1 ne permet pas le bac à sable : passer la distribution à WSL2 (wsl --set-version <nom> 2).");
  return lignes.join("\n");
}

module.exports = { DOMAINES_COEUR, ECRITURE, LECTURE, HORS_BAC, actif, causeReseau, plateforme, domaines, reglage, etat, ecrire, formaterEtat };

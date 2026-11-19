#!/usr/bin/env node
// Pulse – où en est le projet avant le passage en production (`pulse-aidd pret-production`), lu par /pulse:deploy
// (mode production, point 0). Rien n'est bloqué : chaque ligne qui manque renvoie à sa commande, la personne décide.
//
// Une ligne par contrôle, « <clé>: <ok | manque | inconnu | conseillee> · <commande ou -> · <raison> », puis le bilan :
//   tests: ok · - · les tests et les contrôles sont à jour et verts
//   audit-securite: manque · /pulse:security · aucun audit de sécurité complet ni de fin de réalisation
//   secrets: ok · - · l'inventaire des clés ne signale rien
//   ci: ok · - · les contrôles automatiques tournent à chaque envoi
//   branche-protegee: inconnu · /pulse:cicd proteger · gh n'est pas connecté
//   surveillance: manque · /pulse:deploy production · aucune sonde de disponibilité notée
//   retour-arriere: manque · /pulse:deploy production · le retour arrière n'a jamais été essayé
//   relecture-metier: conseillee · /pulse:get-help · paiement : une relecture par une personne du métier est conseillée
//   bilan: a-completer (3 à faire)
// relecture-metier n'apparaît que pour un projet sensible (paiement, santé, données sensibles, lus dans docs/prd.md et
// docs/technical.md). Les contrôles lents ou en réseau ont un délai court ; un contrôle impossible vaut « inconnu ».
// Sort toujours avec le code 0.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const COEUR = path.join(__dirname, "..", "..", "..");
const DATE = /(\d{4}-\d{2}-\d{2})/;
// Mots du besoin qui signalent un projet sensible (accents exigés : « sante » se lit dans une adresse comme /api/sante).
const SENSIBLE = /(paiement|payer en ligne|stripe|carte bancaire|abonnement payant|santé|médical|dossier patient|données sensibles|données de mineurs)/i;

const lireSi = (f) => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch (e) {
    return null;
  }
};

/** La section « ## <titre> » d'un document Markdown, ou "". */
function section(texte, titre) {
  const m = new RegExp(`^##\\s+${titre}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "m").exec(texte || "");
  return m ? m[1] : "";
}

function lancer(cmd, args, racine, delai = 120000) {
  return spawnSync(cmd, args, { cwd: racine, encoding: "utf8", timeout: delai, windowsHide: true });
}

/** Les contrôles, dans l'ordre : [{ cle, etat, commande, raison }]. `outils` remplace les appels externes (tests). */
function controler(racine, outils = {}) {
  const p = (...x) => path.join(racine, ...x);
  const technique = lireSi(p("docs", "technical.md")) || "";
  const o = {
    preuve: () => lancer(process.execPath, [path.join(COEUR, "scripts", "preuve.js"), "etat", "--exiger", "suite"], racine, 30000).status,
    secrets: () => lancer(process.execPath, [path.join(COEUR, "skills", "secrets", "scripts", "secrets.js"), "inventaire", "--sans-hebergeur"], racine, 30000).status,
    protection: () => {
      const r = lancer("gh", ["api", "repos/{owner}/{repo}/branches/main/protection", "--silent"], racine, 10000);
      if (r.error) return "inconnu";
      if (r.status === 0) return "ok";
      return /404|Branch not protected/i.test(`${r.stderr}${r.stdout}`) ? "manque" : "inconnu";
    },
    ...outils,
  };
  const res = [];
  const ajouter = (cle, etat, commande, raison) => res.push({ cle, etat, commande: etat === "ok" ? "-" : commande, raison });

  const preuve = o.preuve();
  ajouter("tests", preuve === 0 ? "ok" : preuve === 1 ? "manque" : "inconnu", "/pulse:test lancer", preuve === 0 ? "les tests et les contrôles sont à jour et verts" : preuve === 1 ? "les tests ne sont pas à jour ou pas tous verts" : "la preuve n'a pas pu être lue");

  const auditComplet = lireSi(p("docs", "securite.md"));
  const plans = [];
  const parcourir = (d) => {
    for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
      if (e.isDirectory() && e.name !== "revues") parcourir(path.join(d, e.name));
      else if (/^PLAN-.*\.md$/.test(e.name)) plans.push(path.join(d, e.name));
    }
  };
  parcourir(p("aidd_docs", "tasks"));
  const auditFin = plans.some((f) => /audit de sécurité de fin/i.test(lireSi(f) || ""));
  if (auditComplet) ajouter("audit-securite", "ok", "-", `audit de sécurité complet du ${(DATE.exec(auditComplet.slice(0, 600)) || [])[1] || "projet"}`);
  else if (auditFin) ajouter("audit-securite", "ok", "-", "audit de sécurité de fin de réalisation fait (l'audit complet reste conseillé une fois en ligne)");
  else ajouter("audit-securite", "manque", "/pulse:security", "aucun audit de sécurité complet ni de fin de réalisation");

  const secrets = o.secrets();
  ajouter("secrets", secrets === 0 ? "ok" : secrets === 1 ? "manque" : "inconnu", "/pulse:secrets", secrets === 0 ? "l'inventaire des clés ne signale rien" : secrets === 1 ? "l'inventaire des clés signale un problème" : "l'inventaire des clés n'a pas pu être lu");

  const ci = fs.existsSync(p(".gitlab-ci.yml")) || (fs.existsSync(p(".github", "workflows")) && fs.readdirSync(p(".github", "workflows")).length > 0);
  ajouter("ci", ci ? "ok" : "manque", "/pulse:cicd", ci ? "les contrôles automatiques tournent à chaque envoi" : "aucun contrôle automatique à chaque envoi");

  const github = /github\.com/i.test((lancer("git", ["remote", "get-url", "origin"], racine, 5000).stdout || "").trim());
  if (github) {
    const protection = o.protection();
    ajouter("branche-protegee", protection, "/pulse:cicd proteger", protection === "ok" ? "la branche principale est protégée" : protection === "manque" ? "la branche principale n'est pas protégée" : "gh n'est pas connecté, ou la protection n'a pas pu être lue");
  }

  const surveillance = (/^\s*[-*]?\s*\*{0,2}Surveillance\*{0,2}\s*:\s*(.+)$/im.exec(technique) || [])[1] || "";
  const sonde = surveillance && !/^[\s«"]*(aucune|\{\{)/i.test(surveillance);
  ajouter("surveillance", sonde ? "ok" : "manque", "/pulse:deploy production", sonde ? "une sonde de disponibilité est notée" : "aucune sonde de disponibilité notée");

  const retour = section(technique, "Retour arrière");
  const repete = (/Répété le\**\s*:\s*(\d{4}-\d{2}-\d{2})/i.exec(retour) || [])[1];
  if (!retour.trim()) ajouter("retour-arriere", "manque", "/pulse:deploy production", "la marche à suivre pour revenir en arrière n'est pas écrite");
  else ajouter("retour-arriere", repete ? "ok" : "manque", "/pulse:deploy production", repete ? `retour arrière essayé le ${repete}` : "le retour arrière n'a jamais été essayé");

  const sensible = SENSIBLE.exec(`${lireSi(p("docs", "prd.md")) || ""}\n${technique}`);
  if (sensible) ajouter("relecture-metier", "conseillee", "/pulse:get-help", `${sensible[1].toLowerCase()} : une relecture par une personne du métier est conseillée avant l'ouverture au public`);
  return res;
}

function formater(res) {
  const lignes = res.map((r) => `${r.cle}: ${r.etat} · ${r.commande} · ${r.raison}`);
  const aFaire = res.filter((r) => r.etat === "manque").length;
  lignes.push(`bilan: ${aFaire ? `a-completer (${aFaire} à faire)` : "pret"}`);
  return lignes.join("\n");
}

module.exports = { controler, formater, section };

if (require.main === module) {
  try {
    console.log(formater(controler(process.cwd())));
  } catch (e) {
    console.log(`bilan: illisible (${e.message})`);
  }
  process.exitCode = 0;
}

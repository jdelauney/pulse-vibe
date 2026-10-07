#!/usr/bin/env node
// Pack Pulse Next.js – adaptateur d'hébergeur Vercel pour pulse-aidd secrets (via pulse-pile-next hebergeur …).
//
//   pulse-pile-next hebergeur ls                                   JSON : { hebergeur, variables: [{ nom, environnements, type }] }, sans valeur
//   pulse-pile-next hebergeur envoyer <NOM> <env> [--type secret|config]   la valeur arrive sur l'entrée standard
//   pulse-pile-next hebergeur redeployer <env>                     relance le dernier déploiement prêt de cet environnement
//
// S'appuie sur le Vercel CLI du poste (vercel login, puis vercel link dans le projet).
// La valeur passe seulement par l'entrée standard de « vercel env add | update » : jamais en argument,
// jamais affichée. Les variables propres à une branche Git sont laissées de côté.
// Codes de sortie : 0 réussi, 1 échec (avec la cause, en français, sans valeur).
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ENVIRONNEMENTS = { production: "Production", preview: "Preview", development: "Development" };
const NOM_VALIDE = /^[A-Za-z_][A-Za-z0-9_]*$/;

let valeurAMasquer = "";
const masquer = (t) => (valeurAMasquer.length >= 4 ? String(t || "").split(valeurAMasquer).join("«valeur masquée»") : String(t || ""));
function finir(code, message) {
  fs.writeSync(1, masquer(message) + "\n");
  process.exit(code);
}

/** Lance le Vercel CLI. Sous Windows, « vercel » est un script .cmd : il passe par le shell (arguments contrôlés, sans valeur). */
function vercel(args, entree) {
  const r = spawnSync("vercel", args, {
    cwd: process.cwd(),
    input: entree === undefined ? "" : entree,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 300000,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  if (r.error && r.error.code === "ENOENT") finir(1, "Vercel CLI absent : npm install -g vercel, puis vercel login.");
  const absent = r.status !== 0 && /not recognized|command not found|introuvable|n'est pas reconnu/i.test(r.stderr || "");
  if (absent) finir(1, "Vercel CLI absent : npm install -g vercel, puis vercel login.");
  return { ok: r.status === 0, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function cause(r) {
  const texte = masquer(`${r.stderr}\n${r.stdout}`).replace(/\u001b\[[0-9;]*m/g, "");
  if (/not linked|link your project|vercel link/i.test(texte)) return "projet non relié à Vercel : lancez « vercel link » dans le dossier du projet.";
  if (/not authorized|log in|vercel login|No existing credentials/i.test(texte)) return "Vercel CLI non connecté : lancez « vercel login ».";
  const lignes = texte.split("\n").map((l) => l.trim()).filter(Boolean);
  return (lignes.find((l) => /^Error/i.test(l)) || lignes.pop() || "échec du Vercel CLI").slice(0, 300);
}

function exigerProjetRelie() {
  if (!fs.existsSync(path.join(process.cwd(), ".vercel", "project.json"))) finir(1, "projet non relié à Vercel : lancez « vercel link » dans le dossier du projet.");
}

function lister() {
  const r = vercel(["env", "ls", "--format", "json"]);
  if (!r.ok) finir(1, cause(r));
  let json;
  try {
    json = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  } catch (e) {
    finir(1, "réponse du Vercel CLI illisible (version trop ancienne ? npm install -g vercel).");
  }
  // Les valeurs des variables Config figurent dans cette réponse : elles ne sont jamais recopiées.
  return (json.envs || [])
    .filter((e) => !e.gitBranch)
    .map((e) => ({
      nom: e.key,
      environnements: (Array.isArray(e.target) ? e.target : [e.target]).filter(Boolean),
      type: e.type === "sensitive" || e.visibility === "secret" ? "secret" : "config",
    }));
}

function envoyer(nom, env, type) {
  if (!NOM_VALIDE.test(nom || "")) finir(1, "Usage : hebergeur envoyer <NOM> <production|preview|development> [--type secret|config]");
  if (!ENVIRONNEMENTS[env]) finir(1, `environnement inconnu : ${env} (production, preview ou development).`);
  if (!["secret", "config"].includes(type)) finir(1, "--type attend secret ou config.");
  const valeur = fs.readFileSync(0, "utf8");
  valeurAMasquer = valeur;
  if (!valeur.trim()) finir(1, "valeur vide : rien envoyé (elle remplacerait la bonne valeur).");
  exigerProjetRelie();
  const existante = lister().find((v) => v.nom === nom && v.environnements.includes(env));
  if (existante && existante.type === "config" && type === "secret") {
    finir(1, `${nom} existe en type Config (relisible) sur Vercel en ${ENVIRONNEMENTS[env]} : supprimez-la dans Settings → Environment Variables, puis relancez l'envoi, qui la recrée en type Secret.`);
  }
  const args = existante ? ["env", "update", nom, env, "--yes"] : ["env", "add", nom, env, "--type", type, "--yes"];
  const r = vercel(args, valeur);
  if (!r.ok) finir(1, cause(r));
  finir(0, `${nom} ${existante ? "mise à jour" : "ajoutée"} sur Vercel (${ENVIRONNEMENTS[env]}, type ${(existante ? existante.type : type) === "secret" ? "Secret" : "Config"}).`);
}

function redeployer(env) {
  if (!["production", "preview"].includes(env)) finir(1, "Usage : hebergeur redeployer <production|preview>");
  exigerProjetRelie();
  const r = vercel(["ls", "--format", "json", ...(env === "production" ? ["--prod"] : ["--environment", "preview"])]);
  if (!r.ok) finir(1, cause(r));
  let deploiements;
  try {
    deploiements = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).deployments || [];
  } catch (e) {
    finir(1, "liste des déploiements illisible (version du Vercel CLI trop ancienne ? npm install -g vercel).");
  }
  const dernier = deploiements.filter((d) => d.state === "READY").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  if (!dernier) finir(1, `aucun déploiement ${ENVIRONNEMENTS[env]} prêt à relancer : envoyez une nouvelle version (git push) ou déployez depuis Vercel.`);
  const adresse = /^https?:\/\//.test(dernier.url) ? dernier.url : `https://${dernier.url}`;
  const relance = vercel(["redeploy", adresse, ...(env === "production" ? ["--target", "production"] : [])]);
  if (!relance.ok) finir(1, cause(relance));
  const nouvelle = relance.stdout.trim().split("\n").filter(Boolean).pop() || "";
  finir(0, `redéploiement ${ENVIRONNEMENTS[env]} terminé${/^https?:\/\//.test(nouvelle) ? ` : ${nouvelle}` : ""}.`);
}

function principal() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--type");
  const type = i === -1 ? "secret" : args[i + 1];
  const positionnels = args.filter((a, j) => !a.startsWith("--") && (i === -1 || j !== i + 1));
  const [action, a1, a2] = positionnels;
  if (action === "ls") {
    exigerProjetRelie();
    return finir(0, JSON.stringify({ hebergeur: "Vercel", variables: lister() }));
  }
  if (action === "envoyer") return envoyer(a1, a2, type);
  if (action === "redeployer") return redeployer(a1);
  finir(1, "Usage : pulse-pile-next hebergeur ls | envoyer <NOM> <env> [--type secret|config] | redeployer <env>");
}

principal();

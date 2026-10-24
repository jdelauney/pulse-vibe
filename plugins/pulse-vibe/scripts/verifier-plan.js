#!/usr/bin/env node
// Pulse – contrôle d'un plan avant la réalisation (`pulse-aidd verifier-plan <US-XXX>`), lancé par /pulse:plan
// avant de montrer le plan, et par /pulse:spirc avant la réalisation.
//
// Confronte le plan de l'US à son US, à sa spec et aux autres plans de aidd_docs/tasks/, sans rien modifier :
//   à corriger    : critère d'acceptation vérifié par aucune tâche, scénario automatisé cité par aucune ligne
//                   « Tests », dépendance vers une tâche inconnue ou en boucle, spec absente ou en brouillon,
//                   champ du modèle resté à remplir, mise en ligne dans le plan d'une autre US que la dernière
//                   Indispensable du parcours ;
//   avertissement : fichier « à modifier » absent (et créé par aucune tâche), fichier « à créer » déjà présent,
//                   tâche de plus de 3 fichiers (sauf une tâche « Recette : ») ou 3 critères, plan de plus de 4 tâches, mise en ligne manquante.
// Affiche des lignes « clé: valeur », puis un constat par ligne (« - à corriger · T4 · … ») :
//   plan: aidd_docs/tasks/<epic>/PLAN-SPEC-US-003-<nom>.md
//   statut: à valider | validé
//   taches: 3
//   bilan: ok | avertissements | à corriger | introuvable
// Sort toujours avec le code 0 : un échec annulerait la commande /pulse qui l'appelle.
"use strict";

const fs = require("fs");
const path = require("path");
const { lireUs } = require("./etat.js");
const { formaterConstats, lancerControle, normaliserUs, numero } = require("./constats.js");

const NIVEAUX_AUTOMATISES = ["unitaire", "integration", "bout-en-bout"];
const STATUTS = { " ": "a-faire", "~": "en-cours", x: "terminee", X: "terminee" };

const lireSi = (f) => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
};
const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const rel = (racine, f) => path.relative(racine, f).split(path.sep).join("/");

/** Les tâches de « ## Tâches », avec leurs détails (« - Clé : valeur »). */
function lireTachesDetaillees(texte) {
  const taches = [];
  let dans = false;
  let courante = null;
  for (const ligne of texte.split(/\r?\n/)) {
    if (/^##\s/.test(ligne)) {
      dans = /^##\s+T[âa]ches\s*$/i.test(ligne);
      courante = null;
      continue;
    }
    if (!dans) continue;
    const t = /^- \[(.)\]\s+\*\*(T\d+)\s*[–—-]\s*(.+?)\*\*/.exec(ligne);
    if (t) {
      const titre = t[3].trim();
      courante = { id: t[2].toUpperCase(), titre, statut: STATUTS[t[1]] || "a-faire", details: {}, miseEnLigne: /^mettre en ligne/i.test(titre) };
      taches.push(courante);
      continue;
    }
    const d = courante && /^\s+- ([^:]+?)\s*:\s*(.*)$/.exec(ligne);
    if (d) courante.details[sansAccent(d[1])] = d[2].trim();
  }
  return taches;
}

/** Les numéros des critères d'acceptation de l'US (« 1. **Cas nominal** – … »). */
function criteresDeUs(texte) {
  const section = (texte.split(/^## Crit[èe]res d'acceptation\s*$/im)[1] || "").split(/^## /m)[0];
  return [...section.matchAll(/^\s*(\d+)\.\s/gm)].map((m) => Number(m[1]));
}

/** Les critères de l'US cités par une ligne « Vérification » : « US-003 critère 2 », « critères 1 et 3 », « critères 1 à 3 », « US-003-2 ». */
function criteresCites(texte, us) {
  const cites = new Set();
  for (const m of texte.matchAll(/(?:(US-\d+)\s*,?\s*)?crit[èe]res?\s+(\d+(?:\s*(?:,|et|à|-|–)\s*\d+)*)/gi)) {
    if (m[1] && normaliserUs(m[1]) !== us) continue;
    for (const [, a, b] of m[2].matchAll(/(\d+)(?:\s*(?:à|-|–)\s*(\d+))?/g)) {
      for (let n = Number(a); n <= Number(b || a); n++) cites.add(n);
    }
  }
  for (const m of texte.matchAll(/\b(US-\d+)-(\d+)(?!\d)/gi)) if (normaliserUs(m[1]) === us) cites.add(Number(m[2]));
  return cites;
}

/** Les scénarios étiquetés d'une spec (même lecture que scripts/verifier.js du projet). */
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
    for (const id of ids) scenarios.push({ id, niveau, titre, securite: etiquettes.includes("securite") });
  }
  return scenarios;
}

/** Les fichiers d'une ligne « Fichiers » : « à créer : `a`, `b` · à modifier : `c` ». */
function fichiersDeTache(valeur) {
  const fichiers = { creer: [], modifier: [] };
  for (const partie of (valeur || "").split("·")) {
    const sorte = /cr[ée]er/i.test(partie) ? "creer" : /modifier/i.test(partie) ? "modifier" : null;
    if (!sorte) continue;
    const entre = [...partie.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
    const bruts = entre.length ? entre : partie.replace(/^[^:]*:/, "").split(",").map((s) => s.trim());
    fichiers[sorte].push(...bruts.filter((f) => /[/.]/.test(f) && !/\s/.test(f)));
  }
  return fichiers;
}

/** Le dossier de l'US et ses trois fichiers (US, spec, plan), ou null. */
function trouverUs(racine, us) {
  const taches = path.join(racine, "aidd_docs", "tasks");
  if (!fs.existsSync(taches)) return null;
  const n = numero(us);
  for (const epic of fs.readdirSync(taches, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    const dossier = path.join(taches, epic);
    const noms = fs.readdirSync(dossier);
    const trouve = (re) => noms.find((f) => (re.exec(f) || [])[1] && numero(re.exec(f)[1]) === n);
    const plan = trouve(/^PLAN-SPEC-US-(\d+)-.+\.md$/i);
    if (!plan) continue;
    const spec = trouve(/^SPEC-US-(\d+)-.+\.md$/i);
    const fiche = trouve(/^US-(\d+)-.+\.md$/i);
    return { plan: path.join(dossier, plan), spec: spec && path.join(dossier, spec), us: fiche && path.join(dossier, fiche) };
  }
  return null;
}

/** Toutes les tâches de tous les plans du projet (pour les dépendances et les fichiers créés ailleurs). */
function toutesLesTaches(racine) {
  const taches = path.join(racine, "aidd_docs", "tasks");
  const toutes = [];
  if (!fs.existsSync(taches)) return toutes;
  for (const epic of fs.readdirSync(taches, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const dossier = path.join(taches, epic.name);
    for (const f of fs.readdirSync(dossier).filter((x) => /^PLAN-SPEC-US-\d+-.+\.md$/i.test(x))) {
      toutes.push(...lireTachesDetaillees(lireSi(path.join(dossier, f)) || ""));
    }
  }
  return toutes;
}

/** Une boucle dans les dépendances des tâches du plan : la liste des tâches concernées, ou null. */
function boucle(taches) {
  const deps = new Map(taches.map((t) => [t.id, (t.details["depend de"] || "").toUpperCase().match(/T\d+/g) || []]));
  const etat = new Map();
  const chemin = [];
  const visiter = (id) => {
    if (etat.get(id) === "fini" || !deps.has(id)) return null;
    if (etat.get(id) === "en-cours") return chemin.slice(chemin.indexOf(id)).concat(id);
    etat.set(id, "en-cours");
    chemin.push(id);
    for (const d of deps.get(id)) {
      const b = visiter(d);
      if (b) return b;
    }
    chemin.pop();
    etat.set(id, "fini");
    return null;
  };
  for (const t of taches) {
    const b = visiter(t.id);
    if (b) return b;
  }
  return null;
}

/** Le contrôle complet : { plan, statut, taches, constats: [{ gravite, ou, message }] }, ou null si le plan est introuvable. */
function verifierPlan(racine, idUs) {
  const us = normaliserUs(idUs);
  const fichiers = trouverUs(racine, us);
  if (!fichiers) return null;
  const constats = [];
  const corriger = (ou, message) => constats.push({ gravite: "à corriger", ou, message });
  const avertir = (ou, message) => constats.push({ gravite: "avertissement", ou, message });

  const textePlan = lireSi(fichiers.plan) || "";
  const taches = lireTachesDetaillees(textePlan);
  const statut = /\*\*Statut\*\*\s*:\s*[àa] valider/i.test(textePlan) ? "à valider" : "validé";
  const claude = lireSi(path.join(racine, "CLAUDE.md")) || "";
  const rapide = /\*\*Rythme\*\*\s*:\s*rapide/i.test(claude);

  if (taches.length === 0) corriger("plan", "aucune tâche dans la section « ## Tâches »");
  const restes = textePlan.split(/\r?\n/).filter((l) => /\{\{/.test(l) && !l.trimStart().startsWith(">") && !l.trimStart().startsWith("<!--"));
  if (restes.length) corriger("plan", `${restes.length} ligne(s) encore au modèle (« {{…}} »), dont : ${restes[0].trim().slice(0, 80)}`);

  // Spec : présente et verrouillée ; ses scénarios automatisés sont cités par une ligne « Tests ».
  if (!fichiers.spec) corriger("spec", `la spec SPEC-${us}-… manque à côté du plan`);
  else {
    const spec = lireSi(fichiers.spec) || "";
    const lignes = spec.split(/\r?\n/).filter((l) => !l.trimStart().startsWith(">"));
    if (lignes.some((l) => /\*\*Statut\*\*\s*:\s*brouillon/i.test(l)) || lignes.some((l) => /\bTBD:/.test(l))) {
      corriger("spec", "la spec est encore en brouillon (statut « brouillon » ou des « TBD: » restants) : le plan attend une spec verrouillée");
    }
    const tests = taches.map((t) => t.details.tests || "").join("\n");
    const testsSansAccent = sansAccent(tests);
    for (const sc of scenariosDeSpec(spec)) {
      const automatise = NIVEAUX_AUTOMATISES.includes(sc.niveau);
      if (!automatise && !sc.securite) continue;
      // Rythme rapide : seuls les tests d'intégration et de sécurité sont écrits (tests essentiels).
      if (rapide && !sc.securite && sc.niveau !== "integration") continue;
      const parId = new RegExp(`${sc.id}(?!\\d)`, "i").test(tests);
      const titre = sansAccent(sc.titre.replace(/["«»“”]/g, ""));
      const parTitre = titre.length >= 8 && testsSansAccent.replace(/["«»“”]/g, "").includes(titre);
      if (!parId && !parTitre) corriger("tests", `le scénario ${sc.id} « ${sc.titre} » (${sc.niveau || "sécurité"}) n'est cité par aucune ligne « Tests »`);
    }
  }

  // Critères d'acceptation de l'US : chacun vérifié par au moins une tâche.
  if (!fichiers.us) avertir("us", `le fichier ${us}-… manque à côté du plan : ses critères n'ont pas pu être confrontés aux tâches`);
  else {
    const criteres = criteresDeUs(lireSi(fichiers.us) || "");
    const cites = new Set();
    for (const t of taches) for (const n of criteresCites(t.details.verification || "", us)) cites.add(n);
    for (const n of criteres) if (!cites.has(n)) corriger("vérification", `le critère ${n} de ${us} n'est vérifié par aucune tâche (ligne « Vérification »)`);
  }

  // Dépendances : vers des tâches connues, sans boucle.
  const connues = new Set(toutesLesTaches(racine).map((t) => t.id));
  for (const t of taches) {
    for (const d of (t.details["depend de"] || "").toUpperCase().match(/T\d+/g) || []) {
      if (d === t.id) corriger(t.id, "la tâche dépend d'elle-même");
      else if (!connues.has(d)) corriger(t.id, `dépend de ${d}, qui n'existe dans aucun plan`);
    }
  }
  const b = boucle(taches);
  if (b) corriger(b[0], `les dépendances tournent en rond : ${b.join(" → ")}`);

  // Fichiers et taille des tâches (avertissements : une mise en place peut créer des fichiers sans les lister).
  const creesAilleurs = new Set(toutesLesTaches(racine).flatMap((t) => fichiersDeTache(t.details.fichiers).creer));
  for (const t of taches) {
    const f = fichiersDeTache(t.details.fichiers);
    if (t.statut === "a-faire") {
      for (const x of f.modifier) if (!fs.existsSync(path.join(racine, x)) && !creesAilleurs.has(x)) avertir(t.id, `« ${x} » est à modifier, mais il est absent du projet et aucune tâche ne le crée`);
      for (const x of f.creer) if (fs.existsSync(path.join(racine, x))) avertir(t.id, `« ${x} » est à créer, mais il existe déjà : à modifier ?`);
    }
    const total = f.creer.length + f.modifier.length;
    // Une tâche « Recette : » garde le découpage vérifié de sa recette (plusieurs fichiers d'un seul tenant).
    if (total > 3 && !/^Recette\s*:/i.test(t.titre)) avertir(t.id, `${total} fichiers : au-delà de 3, découper la tâche`);
    const criteres = criteresCites(t.details.verification || "", us).size;
    if (criteres > 3) avertir(t.id, `${criteres} critères : au-delà de 3, découper la tâche`);
  }
  const utiles = taches.filter((t) => !t.miseEnLigne && !/mise en place|squelette/i.test(t.titre));
  if (utiles.length > 4) avertir("plan", `${utiles.length} tâches (hors mise en place et mise en ligne) : au-delà de 4, proposer de découper l'US`);

  // Mise en ligne : seulement dans le plan de la dernière US Indispensable du parcours.
  const indispensables = lireUs(racine).filter((u) => u.priorite === 0);
  const derniere = indispensables.length ? indispensables[indispensables.length - 1].id : null;
  const miseEnLigne = taches.find((t) => t.miseEnLigne);
  if (miseEnLigne && derniere && derniere !== us) corriger(miseEnLigne.id, `la mise en ligne va dans le plan de ${derniere}, la dernière US Indispensable du parcours`);
  if (!miseEnLigne && derniere === us) {
    const ailleurs = toutesLesTaches(racine).some((t) => t.miseEnLigne);
    if (!ailleurs) avertir("plan", `${us} est la dernière US Indispensable du parcours : son plan se termine par « Mettre en ligne la première version »`);
  }

  return { plan: rel(racine, fichiers.plan), statut, taches: taches.length, constats };
}

function formater(r, us) {
  if (!r) return `us: ${us}\nbilan: introuvable\nraison: aucun plan PLAN-SPEC-${us}-… dans aidd_docs/tasks/`;
  return formaterConstats([`plan: ${r.plan}`, `statut: ${r.statut}`, `taches: ${r.taches}`], r.constats);
}

if (require.main === module) lancerControle("du plan", "pulse-aidd verifier-plan US-003", verifierPlan, formater);

module.exports = { verifierPlan, formater, lireTachesDetaillees, criteresCites, fichiersDeTache, scenariosDeSpec, criteresDeUs };

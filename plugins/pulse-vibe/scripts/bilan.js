#!/usr/bin/env node
// Pulse – le bilan chiffré des user stories du projet (`pulse-aidd bilan`), lu dans les plans et les rapports de relecture.
//
// Pour chaque US qui a un plan : ses tâches (terminées / toutes), les relectures (rapports), les relectures de contrôle
// (une par cycle de correction), les tests de la personne non concluants, les constats par gravité (🔴 Critique,
// 🟠 Haute, 🟡 Moyenne, 🔵 Basse) et les modes de réalisation lus dans les rapports. Une ligne par US, puis le total :
//   US-001 · 4/4 tâches · 5 relectures · 2 corrections · 1 test non concluant · constats 0/1/3/2 · spirc rapide
//   total · 7/9 tâches · 8 relectures · 3 corrections · 1 test non concluant · constats 0/2/5/4
// Avec aussi : les tâches validées du premier coup (aucune relecture de contrôle), les écarts au plan et les tests figés
// touchés (lignes du journal du plan), la durée du journal (premier et dernier jour) :
//   US-001 · 4/4 tâches · 5 relectures · 3 du premier coup · 2 corrections · … · constats 0/1/3/2 · 1 écart au plan · 6 jours · spirc rapide
// `pulse-aidd bilan --repetes` : les familles de constats (`clean-code` § 5, S3…) vues dans au moins deux relectures,
// tous plans confondus, avec où : « repete: clean-code § 5 · 3 relectures · US-001 T2, US-002 T1, US-002 T3 ».
// Sert à voir où le temps se perd, sur des faits. Sort toujours avec le code 0.
"use strict";

const fs = require("fs");
const path = require("path");

const lireSi = (f) => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
};
const dossiers = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []);
const GRAVITES = ["🔴", "🟠", "🟡", "🔵"];

/** Les chiffres d'un rapport de relecture (modèle « revue »). */
function lireRapport(texte) {
  const sections = texte.split(/^##[ \t]+/m);
  const constats = (sections.find((s) => /^Constats\b/.test(s)) || "").split(/\r?\n/).filter((l) => /^\d+\.\s/.test(l.trim()));
  // Un vrai constat porte une seule gravité ; la ligne du modèle (« 🔴 Critique / 🟠 Haute / … ») les porte toutes.
  const reels = constats.filter((l) => GRAVITES.filter((g) => l.includes(g)).length === 1 && !l.includes("{{"));
  const parGravite = GRAVITES.map((g) => reels.filter((l) => l.includes(g)).length);
  const resultats = [...texte.matchAll(/^[-*][ \t]+\*\*R[ée]sultat\*\*[ \t]*:(.*)$/gim)].map((m) => m[1]);
  return {
    controles: sections.filter((s) => /^Relecture de contr[ôo]le\b/i.test(s)).length,
    nonConcluants: resultats.filter((r) => !r.includes("|") && /❌|non concluant/i.test(r)).length + (/\*\*Remarque\*\*[^\n]*❌/.test(texte) ? 1 : 0),
    parGravite,
    mode: ((/^\*\*Mode\*\*\s*:\s*(.+)$/m.exec(texte) || [])[1] || "").replace(/\{\{.*?\}\}/g, "").trim(),
    familles: famillesDe(reels),
  };
}

/** Les familles citées par des lignes de constats : « clean-code § 5 », « experience § 2 », « S3 ». */
function famillesDe(lignes) {
  const familles = new Set();
  for (const l of lignes) {
    for (const m of l.matchAll(/`?([a-z][a-z-]+)`?\s*§\s*(\d+(?:\s*bis|\s*ter)?)/g)) familles.add(`${m[1]} § ${m[2].replace(/\s+/g, " ")}`);
    for (const m of l.matchAll(/\b(S\d{1,2})\b/g)) familles.add(m[1]);
    if (/\(\s*`?m[ée]moire`?\s*\)/i.test(l)) familles.add("memoire");
  }
  return [...familles];
}

/** Ce que dit le journal du plan : écarts au plan, tests figés touchés, durée en jours (premier au dernier jour). */
function lireJournal(plan) {
  const journal = (plan.split(/^##[ \t]+Journal\b/m)[1] || "").split(/^##[ \t]/m)[0];
  const lignes = journal.split(/\r?\n/).filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}/.test(l));
  const dates = lignes.map((l) => Date.parse(/\d{4}-\d{2}-\d{2}/.exec(l)[0])).filter((t) => !Number.isNaN(t));
  return {
    ecarts: lignes.filter((l) => /[ée]cart/i.test(l)).length,
    figesTouches: lignes.filter((l) => /tests fig[ée]s modifi[ée]s/i.test(l)).length,
    jours: dates.length ? Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1 : 0,
  };
}

/** Le bilan de chaque US qui a un plan : [{ us, faites, total, relectures, controles, nonConcluants, parGravite, modes }]. */
function bilan(racine) {
  const taches = path.join(racine, "aidd_docs", "tasks");
  const lignes = [];
  for (const epic of dossiers(taches)) {
    for (const f of fs.readdirSync(path.join(taches, epic)).filter((x) => /^PLAN-SPEC-US-\d+-.+\.md$/i.test(x)).sort()) {
      const plan = lireSi(path.join(taches, epic, f)) || "";
      const statuts = [...plan.matchAll(/^- \[(.)\]\s+\*\*T\d+/gm)].map((m) => m[1]);
      const revues = path.join(taches, epic, "revues", f.replace(/\.md$/i, ""));
      const rapports = fs.existsSync(revues) ? fs.readdirSync(revues).filter((x) => x.endsWith(".md")).sort().map((x) => ({ tache: (/^(T\d+)-/i.exec(x) || [])[1], ...lireRapport(lireSi(path.join(revues, x)) || "") })) : [];
      const somme = (cle) => rapports.reduce((n, r) => n + r[cle], 0);
      // Tâches relues du premier coup : aucun de leurs rapports n'a de relecture de contrôle.
      const parTache = new Map();
      for (const r of rapports.filter((x) => x.tache)) parTache.set(r.tache, (parTache.get(r.tache) || 0) + r.controles);
      const journal = lireJournal(plan);
      lignes.push({
        us: /^PLAN-SPEC-(US-\d+)/i.exec(f)[1].toUpperCase(),
        faites: statuts.filter((s) => /x/i.test(s)).length,
        total: statuts.length,
        relectures: rapports.length,
        premierCoup: [...parTache.values()].filter((n) => n === 0).length,
        controles: somme("controles"),
        nonConcluants: somme("nonConcluants"),
        parGravite: GRAVITES.map((_, i) => rapports.reduce((n, r) => n + r.parGravite[i], 0)),
        modes: [...new Set(rapports.map((r) => r.mode).filter(Boolean))],
        ...journal,
        familles: rapports.map((r) => ({ ou: `${/^PLAN-SPEC-(US-\d+)/i.exec(f)[1].toUpperCase()}${r.tache ? ` ${r.tache.toUpperCase()}` : ""}`, familles: r.familles })),
      });
    }
  }
  return lignes;
}

const pluriel = (n, mot, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;
const formaterLigne = (nom, l) =>
  [
    nom,
    `${l.faites}/${l.total} tâches`,
    pluriel(l.relectures, "relecture"),
    `${l.premierCoup} du premier coup`,
    pluriel(l.controles, "correction"),
    pluriel(l.nonConcluants, "test non concluant", "tests non concluants"),
    `constats ${l.parGravite.join("/")}`,
    ...(l.ecarts ? [pluriel(l.ecarts, "écart au plan", "écarts au plan")] : []),
    ...(l.figesTouches ? [pluriel(l.figesTouches, "test figé touché", "tests figés touchés")] : []),
    ...(l.jours ? [pluriel(l.jours, "jour")] : []),
    ...(l.modes && l.modes.length ? [l.modes.join(", ")] : []),
  ].join(" · ");

function formater(lignes) {
  if (!lignes.length) return "bilan: aucun plan dans aidd_docs/tasks/";
  const total = lignes.reduce(
    (t, l) => ({
      faites: t.faites + l.faites,
      total: t.total + l.total,
      relectures: t.relectures + l.relectures,
      premierCoup: t.premierCoup + l.premierCoup,
      controles: t.controles + l.controles,
      nonConcluants: t.nonConcluants + l.nonConcluants,
      parGravite: t.parGravite.map((n, i) => n + l.parGravite[i]),
      ecarts: t.ecarts + l.ecarts,
      figesTouches: t.figesTouches + l.figesTouches,
    }),
    { faites: 0, total: 0, relectures: 0, premierCoup: 0, controles: 0, nonConcluants: 0, parGravite: [0, 0, 0, 0], ecarts: 0, figesTouches: 0 },
  );
  return [...lignes.map((l) => formaterLigne(l.us, l)), formaterLigne("total", total), "constats : Critique/Haute/Moyenne/Basse"].join("\n");
}

/** Les familles de constats vues dans au moins deux relectures : [{ famille, ou: ["US-001 T2", …] }], la plus fréquente d'abord. */
function repetes(lignes) {
  const parFamille = new Map();
  for (const l of lignes) for (const r of l.familles || []) for (const fam of r.familles) parFamille.set(fam, [...(parFamille.get(fam) || []), r.ou]);
  return [...parFamille.entries()].filter(([, ou]) => ou.length >= 2).map(([famille, ou]) => ({ famille, ou })).sort((a, b) => b.ou.length - a.ou.length || a.famille.localeCompare(b.famille));
}

function formaterRepetes(liste) {
  if (!liste.length) return "repetes: aucun";
  return liste.map((r) => `repete: ${r.famille} · ${pluriel(r.ou.length, "relecture")} · ${r.ou.join(", ")}`).join("\n");
}

if (require.main === module) {
  try {
    if (process.argv.includes("--repetes")) console.log(formaterRepetes(repetes(bilan(process.cwd()))));
    else console.log(formater(bilan(process.cwd())));
  } catch (e) {
    console.log(`bilan: illisible (${e.message})`);
  }
}

module.exports = { bilan, formater, lireRapport, lireJournal, famillesDe, repetes, formaterRepetes };

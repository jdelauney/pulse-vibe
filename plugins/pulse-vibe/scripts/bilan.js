#!/usr/bin/env node
// Pulse – le bilan chiffré des user stories du projet (`pulse-aidd bilan`), lu dans les plans et les rapports de relecture.
//
// Pour chaque US qui a un plan : ses tâches (terminées / toutes), les relectures (rapports), les relectures de contrôle
// (une par cycle de correction), les tests de la personne non concluants, les constats par gravité (🔴 Critique,
// 🟠 Haute, 🟡 Moyenne, 🔵 Basse) et les modes de réalisation lus dans les rapports. Une ligne par US, puis le total :
//   US-001 · 4/4 tâches · 5 relectures · 2 corrections · 1 test non concluant · constats 0/1/3/2 · spirc rapide
//   total · 7/9 tâches · 8 relectures · 3 corrections · 1 test non concluant · constats 0/2/5/4
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
  const parGravite = GRAVITES.map((g) => constats.filter((l) => l.includes(g) && !l.includes("/")).length);
  const resultats = [...texte.matchAll(/^[-*][ \t]+\*\*R[ée]sultat\*\*[ \t]*:(.*)$/gim)].map((m) => m[1]);
  return {
    controles: sections.filter((s) => /^Relecture de contr[ôo]le\b/i.test(s)).length,
    nonConcluants: resultats.filter((r) => !r.includes("|") && /❌|non concluant/i.test(r)).length + (/\*\*Remarque\*\*[^\n]*❌/.test(texte) ? 1 : 0),
    parGravite,
    mode: ((/^\*\*Mode\*\*\s*:\s*(.+)$/m.exec(texte) || [])[1] || "").replace(/\{\{.*?\}\}/g, "").trim(),
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
      const rapports = fs.existsSync(revues) ? fs.readdirSync(revues).filter((x) => x.endsWith(".md")).map((x) => lireRapport(lireSi(path.join(revues, x)) || "")) : [];
      const somme = (cle) => rapports.reduce((n, r) => n + r[cle], 0);
      lignes.push({
        us: /^PLAN-SPEC-(US-\d+)/i.exec(f)[1].toUpperCase(),
        faites: statuts.filter((s) => /x/i.test(s)).length,
        total: statuts.length,
        relectures: rapports.length,
        controles: somme("controles"),
        nonConcluants: somme("nonConcluants"),
        parGravite: GRAVITES.map((_, i) => rapports.reduce((n, r) => n + r.parGravite[i], 0)),
        modes: [...new Set(rapports.map((r) => r.mode).filter(Boolean))],
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
    pluriel(l.controles, "correction"),
    pluriel(l.nonConcluants, "test non concluant", "tests non concluants"),
    `constats ${l.parGravite.join("/")}`,
    ...(l.modes && l.modes.length ? [l.modes.join(", ")] : []),
  ].join(" · ");

function formater(lignes) {
  if (!lignes.length) return "bilan: aucun plan dans aidd_docs/tasks/";
  const total = lignes.reduce(
    (t, l) => ({
      faites: t.faites + l.faites,
      total: t.total + l.total,
      relectures: t.relectures + l.relectures,
      controles: t.controles + l.controles,
      nonConcluants: t.nonConcluants + l.nonConcluants,
      parGravite: t.parGravite.map((n, i) => n + l.parGravite[i]),
    }),
    { faites: 0, total: 0, relectures: 0, controles: 0, nonConcluants: 0, parGravite: [0, 0, 0, 0] },
  );
  return [...lignes.map((l) => formaterLigne(l.us, l)), formaterLigne("total", total), "constats : Critique/Haute/Moyenne/Basse"].join("\n");
}

if (require.main === module) {
  try {
    console.log(formater(bilan(process.cwd())));
  } catch (e) {
    console.log(`bilan: illisible (${e.message})`);
  }
}

module.exports = { bilan, formater, lireRapport };

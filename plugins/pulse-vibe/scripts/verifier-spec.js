#!/usr/bin/env node
// Pulse – contrôle d'une spec avant son verrouillage (`pulse-aidd verifier-spec <US-XXX>`), lancé par /pulse:spec
// avant la question de validation.
//
// Confronte la spec à son US, sans rien modifier :
//   à corriger    : critère d'acceptation illustré par aucun scénario (étiquette @US-XXX-n), scénario sans niveau
//                   (@unitaire, @integration, @bout-en-bout ou @manuel), section obligatoire absente (Intention,
//                   Scénarios, Données personnelles et accès, Terminé quand), champ du modèle resté à remplir,
//                   spec verrouillée qui garde un « TBD: » ;
//   avertissement : scénario étiqueté pour un critère qui n'existe pas dans l'US ; écran du tableau de la section 3
//                   sans présentation choisie (colonne « Présentation » vide ou au modèle : « presentation-manquante: <écran> »).
// Affiche des lignes « clé: valeur », puis un constat par ligne (« - à corriger · scénarios · … ») :
//   spec: aidd_docs/tasks/<epic>/SPEC-US-003-<nom>.md
//   statut: brouillon | verrouillée
//   tbd: 2                     les questions encore ouvertes : la spec se verrouille seulement à 0
//   bilan: ok | avertissements | à corriger | introuvable
// Sort toujours avec le code 0 : un échec annulerait la commande /pulse qui l'appelle.
"use strict";

const fs = require("fs");
const path = require("path");
const { scenariosDeSpec, criteresDeUs } = require("./verifier-plan.js");
const { formaterConstats, lancerControle, normaliserUs, numero } = require("./constats.js");

const lireSi = (f) => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
};
const SECTIONS = [
  ["Intention", /^## \d+\.\s*Intention\b/m],
  ["Scénarios", /^## \d+\.\s*Sc[ée]narios\b/m],
  ["Données personnelles et accès", /^## \d+\.\s*Donn[ée]es personnelles et acc[èe]s\b/m],
  ["Terminé quand", /^## \d+\.\s*Termin[ée] quand\b/m],
];

/** La spec et l'US de même numéro, dans le même dossier de groupe : { spec, us } ou null. */
function trouver(racine, us) {
  const taches = path.join(racine, "aidd_docs", "tasks");
  if (!fs.existsSync(taches)) return null;
  for (const epic of fs.readdirSync(taches, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    const dossier = path.join(taches, epic);
    const noms = fs.readdirSync(dossier);
    const trouve = (re) => noms.find((f) => (re.exec(f) || [])[1] && numero(re.exec(f)[1]) === numero(us));
    const spec = trouve(/^SPEC-US-(\d+)-.+\.md$/i);
    if (!spec) continue;
    const fiche = trouve(/^US-(\d+)-.+\.md$/i);
    return { spec: path.join(dossier, spec), us: fiche && path.join(dossier, fiche) };
  }
  return null;
}

/** Les écrans nommés du tableau de la section 3 dont la colonne « Présentation » est vide, encore au modèle ou absente. */
function ecransSansPresentation(texte) {
  const section = (texte.split(/^## \d+\.\s*Ce que l'utilisateur voit et fait\b.*$/m)[1] || "").split(/^## /m)[0];
  const cellules = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const lignes = section.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  if (!lignes.length) return [];
  const colonne = cellules(lignes[0]).findIndex((c) => /^Pr[ée]sentation\b/i.test(c));
  return lignes
    .slice(1)
    .filter((l) => !/^\|[\s|:-]+\|?$/.test(l.trim()))
    .map(cellules)
    .filter((c) => c[0] && !/\{\{/.test(c[0]))
    .filter((c) => colonne === -1 || !c[colonne] || /\{\{/.test(c[colonne]))
    .map((c) => c[0]);
}

function verifierSpec(racine, idUs) {
  const us = normaliserUs(idUs);
  const fichiers = trouver(racine, us);
  if (!fichiers) return null;
  const constats = [];
  const corriger = (ou, message) => constats.push({ gravite: "à corriger", ou, message });
  const avertir = (ou, message) => constats.push({ gravite: "avertissement", ou, message });

  const texte = lireSi(fichiers.spec) || "";
  const lignes = texte.split(/\r?\n/).filter((l) => !l.trimStart().startsWith(">") && !l.trimStart().startsWith("<!--"));
  const tbd = lignes.filter((l) => /\bTBD:/.test(l)).length;
  const verrouillee = /\*\*Statut\*\*\s*:\s*verrouill/i.test(texte);
  if (verrouillee && tbd) corriger("statut", `la spec est verrouillée mais garde ${tbd} « TBD: »`);

  for (const [nom, re] of SECTIONS) if (!re.test(texte)) corriger("sections", `la section « ${nom} » manque`);
  const restes = lignes.filter((l) => /\{\{/.test(l));
  if (restes.length) corriger("modèle", `${restes.length} ligne(s) encore au modèle (« {{…}} »), dont : ${restes[0].trim().slice(0, 80)}`);

  for (const ecran of ecransSansPresentation(texte)) avertir("écrans", `presentation-manquante: ${ecran}`);

  const scenarios = scenariosDeSpec(texte).filter((s) => normaliserUs(s.id.replace(/-\d+$/, "")) === us);
  for (const s of scenarios) if (!s.niveau) corriger("scénarios", `le scénario ${s.id} « ${s.titre} » n'a pas de niveau (@unitaire, @integration, @bout-en-bout ou @manuel)`);
  if (!fichiers.us) avertir("us", `le fichier ${us}-… manque à côté de la spec : ses critères n'ont pas pu être confrontés aux scénarios`);
  else {
    const criteres = criteresDeUs(lireSi(fichiers.us) || "");
    const illustres = new Set(scenarios.map((s) => Number(s.id.split("-").pop())));
    for (const n of criteres) if (!illustres.has(n)) corriger("scénarios", `le critère ${n} de ${us} n'est illustré par aucun scénario (étiquette @${us}-${n})`);
    for (const n of illustres) if (criteres.length && !criteres.includes(n)) avertir("scénarios", `l'étiquette @${us}-${n} vise un critère qui n'existe pas dans l'US`);
  }
  const rel = path.relative(racine, fichiers.spec).split(path.sep).join("/");
  return { spec: rel, statut: verrouillee ? "verrouillée" : "brouillon", tbd, constats };
}

function formater(r, us) {
  if (!r) return `us: ${us}\nbilan: introuvable\nraison: aucune spec SPEC-${us}-… dans aidd_docs/tasks/`;
  return formaterConstats([`spec: ${r.spec}`, `statut: ${r.statut}`, `tbd: ${r.tbd}`], r.constats);
}

if (require.main === module) lancerControle("de la spec", "pulse-aidd verifier-spec US-003", verifierSpec, formater);

module.exports = { verifierSpec, formater };

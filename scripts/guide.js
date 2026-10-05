#!/usr/bin/env node
// Pulse – guide de réalisation (`pulse-aidd guide`, /pulse:guide, et hook PostToolUse).
//
// Lit les plans de docs/plans/ et écrit docs/guide/ : un index (où en est le projet, étapes
// avant le plan, plans et jalons) et, pour chaque plan, un dossier docs/guide/<plan>/ avec un
// fichier par jalon : pour chaque tâche, les commandes à copier-coller dans Claude Code dans
// l'ordre. Le guide ne fait que refléter les plans : il est régénéré entièrement à chaque fois,
// et les cases suivent les statuts des plans.
//
// Deux modes :
//  - `--hook` (PostToolUse sur Write/Edit) : lit l'entrée du hook sur stdin, ne fait quelque
//    chose que si le fichier modifié est un plan de docs/plans/, reste silencieux et ne bloque jamais ;
//  - sans option : régénère et affiche un résumé (code 1 si aucun plan n'est reconnu).
"use strict";

const fs = require("fs");
const path = require("path");

const PLANS = path.join("docs", "plans");
const ANCIEN_PLAN = path.join("docs", "plan.md");
const DOSSIER = path.join("docs", "guide");

const STATUTS = { " ": "a-faire", "~": "en-cours", x: "terminee", X: "terminee" };
const LIBELLES = { "a-faire": "⬜ à faire", "en-cours": "🔄 en cours", terminee: "✅ terminée" };

// ---------------------------------------------------------------- lecture des plans

function slug(texte) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "jalon";
}

/** Découpe un plan en jalons et tâches (format du modèle « plan.md » de Pulse). */
function lirePlan(texte) {
  const jalons = [];
  let jalon = null;
  let tache = null;
  for (const ligne of texte.split(/\r?\n/)) {
    const titreJalon = /^##\s+(Jalon\s+(\d+)\s*[–—-]\s*(.+?))\s*$/i.exec(ligne);
    if (titreJalon) {
      jalon = { numero: Number(titreJalon[2]), titre: titreJalon[1].trim(), nom: titreJalon[3].trim(), taches: [] };
      jalons.push(jalon);
      tache = null;
      continue;
    }
    if (/^##\s/.test(ligne)) {
      jalon = null; // « Journal » ou autre section : hors jalon
      tache = null;
      continue;
    }
    if (!jalon) continue;
    const t = /^- \[( |~|x|X)\]\s+\*\*(T\d+)\s*[–—-]\s*(.+?)\*\*\s*(?:·\s*(.*))?$/.exec(ligne);
    if (t) {
      const us = (t[4] || "").trim();
      tache = { id: t[2], titre: t[3].trim(), statut: STATUTS[t[1]], us: /^[—–-]?$/.test(us) ? "" : us, details: [] };
      jalon.taches.push(tache);
      continue;
    }
    const detail = /^\s{2,}[-*]\s+(.+)$/.exec(ligne);
    if (tache && detail) {
      const m = /^([^:]{2,30}?)\s*:\s*(.+)$/.exec(detail[1]);
      tache.details.push(m ? { cle: m[1].trim(), valeur: m[2].trim() } : { cle: "", valeur: detail[1].trim() });
    }
  }
  return jalons.filter((j) => j.taches.length > 0);
}

function listerMd(dossier) {
  if (!fs.existsSync(dossier)) return [];
  return fs.readdirSync(dossier).filter((f) => /\.md$/i.test(f)).map((f) => f.replace(/\.md$/i, "")).sort();
}

const premierNumero = (plan) => Math.min(...plan.jalons.flatMap((j) => j.taches.map((t) => Number(t.id.slice(1)))));

/** Lit tous les plans reconnus, dans l'ordre de leurs tâches (le plan du MVP, qui commence à T1, en premier). */
function lirePlans() {
  const plans = [];
  const ignores = [];
  for (const nom of listerMd(PLANS)) {
    const jalons = lirePlan(fs.readFileSync(path.join(PLANS, `${nom}.md`), "utf8"));
    if (jalons.length === 0) {
      ignores.push(nom);
      continue;
    }
    const fichiers = new Map(jalons.map((j) => [j, `${nom}/jalon-${String(j.numero).padStart(2, "0")}-${slug(j.nom.replace(/\s*\(.*$/, ""))}.md`]));
    plans.push({ nom, jalons, fichiers });
  }
  plans.sort((a, b) => premierNumero(a) - premierNumero(b) || a.nom.localeCompare(b.nom));
  return { plans, ignores };
}

const detail = (tache, cle) => {
  const d = tache.details.find((x) => x.cle.toLowerCase().startsWith(cle));
  return d ? d.valeur : null;
};
const estMiseEnLigne = (tache) => /^mettre en ligne/i.test(tache.titre);
const estManuelle = (d) => /manuel|à faire par|coller|tableau de bord|créer un compte|console/i.test(`${d.cle} ${d.valeur}`);

// ---------------------------------------------------------------- écriture

const bloc = (commande) => ["  ```", `  ${commande}`, "  ```"];
const coche = (fait) => (fait ? "[x]" : "[ ]");

function etapesAvantLePlan(plans) {
  const etapes = [
    ["Préparer le projet", "/pulse:init", "CLAUDE.md"],
    ["Raconter l'idée", "/pulse:brainstorm", "docs/brief.md"],
    ["Décider du MVP", "/pulse:prd", "docs/prd.md"],
    ["Choisir les outils", "/pulse:tech", "docs/technical.md"],
    ["Écrire les user stories", "/pulse:us", "docs/user-stories.md"],
  ];
  const lignes = etapes.map(([quoi, commande, fichier]) => `- ${coche(fs.existsSync(fichier))} ${quoi} : \`${commande}\` → \`${fichier}\``);
  const specs = listerMd(path.join("docs", "specs"));
  lignes.push(`- ${coche(specs.length > 0)} Spécifier une ou plusieurs US : \`/pulse:spec <US ou demande>\` → \`docs/specs/\``);
  lignes.push(`- ${coche(plans.length > 0)} Planifier une spec : \`/pulse:plan <spec>\` → \`docs/plans/\``);
  for (const s of specs.filter((n) => !plans.some((p) => p.nom === n))) {
    lignes.push(`- ⚠️ Spec sans plan : \`/pulse:plan ${s}\``);
  }
  return lignes;
}

/** La tâche à reprendre : une tâche en cours d'abord, quel que soit le plan, sinon la première à faire. */
function prochaineTache(plans) {
  for (const statut of ["en-cours", "a-faire"]) {
    for (const plan of plans) {
      for (const jalon of plan.jalons) {
        const tache = jalon.taches.find((x) => x.statut === statut);
        if (tache) return { plan, jalon, tache };
      }
    }
  }
  return null;
}

function commandeSuivante(plan, tache) {
  if (estMiseEnLigne(tache)) return "/pulse:deploy";
  return tache.statut === "en-cours" ? `/pulse:review ${tache.id}` : `/pulse:implement ${plan.nom} ${tache.id}`;
}

function ecrireIndex(plans, nom) {
  const suite = prochaineTache(plans);
  const lignes = [
    `# Guide de réalisation – ${nom}`,
    "",
    "> Généré automatiquement à partir des plans de `docs/plans/` (`/pulse:guide`). **Ne pas le modifier à la main** : il est refait à chaque changement d'un plan.",
    "> Suivez-le dans l'ordre : copiez chaque commande dans Claude Code, puis passez à la suivante. Les statuts reflètent les plans.",
    "",
    "## Où en êtes-vous ?",
    "",
  ];
  if (suite) {
    const lien = suite.plan.fichiers.get(suite.jalon);
    lignes.push(`Prochaine étape : **${suite.tache.id} – ${suite.tache.titre}** (${LIBELLES[suite.tache.statut]}), plan \`${suite.plan.nom}\`, dans [${lien}](${lien}) :`, "");
    lignes.push("```", commandeSuivante(suite.plan, suite.tache), "```", "");
  } else {
    lignes.push("🎉 Toutes les tâches des plans sont terminées. Prochaines étapes possibles : `/pulse:deploy`, `/pulse:security`, une nouvelle US avec `/pulse:spec <US>`, ou une demande avec `/pulse:spirc <plan> \"…\"`.", "");
  }
  lignes.push("## Avant de construire", "", ...etapesAvantLePlan(plans), "");
  lignes.push("## Les plans", "", "| Plan | Jalon | Tâches | Terminées | Guide |", "|---|---|---|---|---|");
  for (const plan of plans) {
    for (const j of plan.jalons) {
      const faites = j.taches.filter((t) => t.statut === "terminee").length;
      const lien = plan.fichiers.get(j);
      lignes.push(`| ${plan.nom} | ${j.numero} – ${j.nom} | ${j.taches.length} | ${faites}/${j.taches.length} | [${lien}](${lien}) |`);
    }
  }
  lignes.push(
    "",
    "## Conventions",
    "",
    "- 🔵 Étape obligatoire (le chemin normal)",
    "- ⚪ Étape facultative (conseillée, mais on peut s'en passer)",
    "- ⚠️ À faire avant (prérequis ou action manuelle de votre part)",
    "",
    "## À chaque séance",
    "",
    "```",
    "/pulse:init        # où en est le projet, et quoi faire maintenant",
    "```",
    "",
    "## Si vous êtes bloqué",
    "",
    "- Une erreur, un bouton qui ne marche pas : `/pulse:fix \"<message ou description>\"`",
    "- Le plan ne vous convient plus (une question, une tâche à changer) : `/pulse:refine <plan> \"<votre remarque>\"`",
    "- Des erreurs rouges dans le code : `/pulse:auto-fix`",
    "- Toujours bloqué après deux essais : demandez de l'aide à une personne qui sait programmer.",
    "",
    "## Les 4 réflexes",
    "",
    "1. **Une tâche à la fois.** Petit, testé, enregistré.",
    "2. **C'est vous qui testez.** L'IA propose, vous validez.",
    "3. **Jamais de vraie donnée ni de vraie clé** dans la conversation ou dans le code.",
    "4. **« Si ce n'est pas interdit côté serveur, c'est autorisé. »**",
    "",
  );
  return lignes.join("\n");
}

function ecrireTache(plan, tache, precedente) {
  const lignes = [`### ${tache.id} – ${tache.titre}`, "", `Statut : ${LIBELLES[tache.statut]}${tache.us ? ` · ${tache.us}` : ""}`, ""];
  const objectif = detail(tache, "objectif");
  if (objectif) lignes.push(`> ${objectif}`, "");
  if (precedente && precedente.statut !== "terminee") {
    lignes.push(`- ⚠️ Avant : terminer et enregistrer ${precedente.id} – ${precedente.titre}.`);
  }
  for (const d of tache.details.filter(estManuelle)) {
    const libelle = d.cle && !/manuel|action/i.test(d.cle) ? `${d.cle} : ` : "";
    lignes.push(`- ⚠️ Action de votre part : ${libelle}${d.valeur}`);
  }
  const fait = tache.statut === "terminee";
  if (estMiseEnLigne(tache)) {
    lignes.push(`- ${coche(fait)} 🔵 Mettre en ligne`, ...bloc("/pulse:deploy"));
  } else {
    lignes.push(`- ${coche(fait || tache.statut === "en-cours")} 🔵 Réaliser`, ...bloc(`/pulse:implement ${plan.nom} ${tache.id}`));
    lignes.push(`- ${coche(fait)} 🔵 Relire, puis tester vous-même`, ...bloc(`/pulse:review ${tache.id}`));
    lignes.push(`- ${coche(fait)} 🔵 Enregistrer la version`, ...bloc("/pulse:commit"));
    lignes.push(`- ⚪ Ou les trois d'un coup, avec des points d'arrêt : \`/pulse:spirc ${plan.nom} ${tache.id}\``);
  }
  const verification = detail(tache, "vérification") || detail(tache, "verification");
  if (verification) lignes.push("", `🧪 Ce que vous vérifierez : ${verification}`);
  const fichiers = detail(tache, "fichiers");
  if (fichiers) lignes.push(`📄 Fichiers concernés : ${fichiers}`);
  lignes.push("");
  return lignes;
}

function ecrireJalon(plan, jalon, precedent, nom) {
  const lignes = [`# ${jalon.titre} – ${nom}`, "", `> Généré automatiquement à partir de \`docs/plans/${plan.nom}.md\`. Retour au sommaire : [index.md](../index.md).`, ""];
  if (precedent) {
    const reste = precedent.taches.filter((t) => t.statut !== "terminee").length;
    lignes.push(reste ? `> ⚠️ Prérequis : terminer le ${precedent.titre} (encore ${reste} tâche(s)).` : `> ✅ Prérequis rempli : ${precedent.titre} terminé.`, "");
  }
  let avant = precedent ? precedent.taches[precedent.taches.length - 1] : null;
  for (const t of jalon.taches) {
    lignes.push(...ecrireTache(plan, t, avant));
    avant = t;
  }
  const dejaEnLigne = jalon.taches.some(estMiseEnLigne);
  lignes.push(
    `## Fin du ${jalon.titre}`,
    "",
    ...(dejaEnLigne ? [] : ["- 🔵 Mettre la nouvelle version en ligne : `/pulse:deploy`"]),
    "- ⚪ Contrôle de sécurité rapide : `/pulse:security rapide` (ou l'audit complet : `/pulse:security`)",
    "- ⚪ Erreurs rouges dans le code : `/pulse:auto-fix`",
    "- ⚪ Vérifier que la mémoire du projet est à jour : `/pulse:memory actualiser`",
    "",
  );
  return lignes.join("\n");
}

function nomDuProjet() {
  try {
    const titre = /^#\s+(.+)$/m.exec(fs.readFileSync("CLAUDE.md", "utf8"));
    if (titre && !titre[1].includes("{{")) return titre[1].trim();
  } catch (e) {
    // pas de CLAUDE.md : nom du dossier
  }
  return path.basename(process.cwd());
}

/** Retire ce qui ne correspond plus à aucun plan : le guide reflète les plans. */
function nettoyer(attendus) {
  for (const f of fs.readdirSync(DOSSIER)) {
    const complet = path.join(DOSSIER, f);
    if (fs.statSync(complet).isDirectory()) {
      for (const g of fs.readdirSync(complet)) {
        if (/^jalon-\d+-.*\.md$/.test(g) && !attendus.has(`${f}/${g}`)) fs.unlinkSync(path.join(complet, g));
      }
      if (fs.readdirSync(complet).length === 0) fs.rmdirSync(complet);
    } else if (/^jalon-\d+-.*\.md$/.test(f)) {
      fs.unlinkSync(complet); // guide d'un projet d'avant docs/plans/
    }
  }
}

function generer() {
  const { plans, ignores } = lirePlans();
  if (plans.length === 0) {
    if (fs.existsSync(ANCIEN_PLAN)) return { erreur: "docs/plan.md est à l'ancien emplacement : lancez /pulse:init pour le déplacer dans docs/plans/." };
    if (ignores.length === 0) return { erreur: "Aucun plan dans docs/plans/ : lancez d'abord /pulse:plan." };
    return { erreur: `Aucune tâche reconnue dans docs/plans/ (${ignores.join(", ")}) : format attendu « - [ ] **T1 – Titre** » sous « ## Jalon 1 – … ».` };
  }

  const nom = nomDuProjet();
  const attendus = new Set(plans.flatMap((p) => [...p.fichiers.values()]));
  fs.mkdirSync(DOSSIER, { recursive: true });
  nettoyer(attendus);
  const ecrits = [];
  const ecrire = (f, contenu) => {
    const complet = path.join(DOSSIER, f);
    fs.mkdirSync(path.dirname(complet), { recursive: true });
    const avant = fs.existsSync(complet) ? fs.readFileSync(complet, "utf8") : null;
    if (avant !== contenu) fs.writeFileSync(complet, contenu, "utf8");
    ecrits.push(f);
  };
  ecrire("index.md", ecrireIndex(plans, nom));
  for (const plan of plans) {
    plan.jalons.forEach((j, i) => ecrire(plan.fichiers.get(j), ecrireJalon(plan, j, plan.jalons[i - 1], nom)));
  }
  const toutes = plans.flatMap((p) => p.jalons.flatMap((j) => j.taches));
  return {
    ecrits,
    ignores,
    plans: plans.length,
    taches: toutes.length,
    faites: toutes.filter((t) => t.statut === "terminee").length,
    suite: prochaineTache(plans),
  };
}

// ---------------------------------------------------------------- principal

function modifiePlan(entree) {
  try {
    const donnees = JSON.parse(entree);
    const fichier = (donnees.tool_input && (donnees.tool_input.file_path || donnees.tool_input.notebook_path)) || "";
    return /(^|[\\/])docs[\\/]plans[\\/][^\\/]+\.md$/i.test(fichier);
  } catch (e) {
    return false;
  }
}

const projet = process.env.CLAUDE_PROJECT_DIR;
if (projet && fs.existsSync(projet)) process.chdir(projet);

if (process.argv.includes("--hook")) {
  // Le hook ne doit jamais gêner la session : aucune sortie, aucune erreur.
  try {
    if (modifiePlan(fs.readFileSync(0, "utf8"))) generer();
  } catch (e) {
    // silencieux
  }
} else {
  const r = generer();
  if (r.erreur) {
    console.log(`⚠️ ${r.erreur}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Guide de réalisation à jour : ${r.plans} plan(s), ${r.faites}/${r.taches} tâche(s) terminée(s).`);
    for (const f of r.ecrits) console.log(`   docs/guide/${f}`);
    for (const n of r.ignores) console.log(`⚠️ docs/plans/${n}.md : aucune tâche reconnue, plan ignoré.`);
    if (r.suite) console.log(`➡️ Prochaine étape : ${commandeSuivante(r.suite.plan, r.suite.tache)}  (${r.suite.tache.id} – ${r.suite.tache.titre})`);
  }
}

#!/usr/bin/env node
// Pulse – guide de réalisation (`pulse-aidd guide`, /pulse:guide, et hook PostToolUse).
//
// Lit les plans de aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md (un plan par user story) et
// écrit docs/guide/ : un index (où en est le projet, étapes avant le plan, plans par epic) et,
// pour chaque plan, un fichier docs/guide/<epic>/US-XXX-<nom>.md : pour chaque tâche, les
// commandes à copier-coller dans Claude Code dans l'ordre. Le guide ne fait que refléter les
// plans : il est régénéré entièrement à chaque fois, et les cases suivent les statuts des plans.
//
// Deux modes :
//  - `--hook` (PostToolUse sur Write/Edit) : lit l'entrée du hook sur stdin, ne fait quelque
//    chose que si le fichier modifié est un plan de aidd_docs/tasks/, reste silencieux et ne bloque jamais ;
//  - sans option : régénère et affiche un résumé (code 1 si aucun plan n'est reconnu).
"use strict";

const fs = require("fs");
const path = require("path");

const TACHES = path.join("aidd_docs", "tasks");
const ANCIENS = [path.join("docs", "plans"), path.join("docs", "plan.md")];
const DOSSIER = path.join("docs", "guide");
const FICHIER_PLAN = /^PLAN-SPEC-(US-\d+)-(.+)\.md$/i;
const FICHIER_SPEC = /^SPEC-(US-\d+)-(.+)\.md$/i;

const STATUTS = { " ": "a-faire", "~": "en-cours", x: "terminee", X: "terminee" };
const LIBELLES = { "a-faire": "⬜ à faire", "en-cours": "🔄 en cours", terminee: "✅ terminée" };
const PRIORITES = ["indispensable", "essentiel", "optionnel"];

// ---------------------------------------------------------------- lecture des plans

/** Lit les tâches de la section « ## Tâches » d'un plan (format du modèle « plan.md » de Pulse). */
function lireTaches(texte) {
  const taches = [];
  let dansTaches = false;
  let tache = null;
  for (const ligne of texte.split(/\r?\n/)) {
    if (/^##\s/.test(ligne)) {
      dansTaches = /^##\s+T[âa]ches\s*$/i.test(ligne); // « Journal » ou autre section : ignorée
      tache = null;
      continue;
    }
    if (!dansTaches) continue;
    const t = /^- \[( |~|x|X)\]\s+\*\*(T\d+)\s*[–—-]\s*(.+?)\*\*\s*(?:·\s*(.*))?$/.exec(ligne);
    if (t) {
      const us = (t[4] || "").trim();
      tache = { id: t[2], titre: t[3].trim(), statut: STATUTS[t[1]], us: /^[—–-]?$/.test(us) ? "" : us, details: [] };
      taches.push(tache);
      continue;
    }
    const detail = /^\s{2,}[-*]\s+(.+)$/.exec(ligne);
    if (tache && detail) {
      const m = /^([^:]{2,30}?)\s*:\s*(.+)$/.exec(detail[1]);
      tache.details.push(m ? { cle: m[1].trim(), valeur: m[2].trim() } : { cle: "", valeur: detail[1].trim() });
    }
  }
  return taches;
}

/** Rang de priorité de l'US du plan (ligne « **Priorité** : … » de la vue d'ensemble) : Indispensable d'abord. */
function lirePriorite(texte) {
  const m = /\*\*Priorit[ée]\*\*\s*:\s*([^\s·|*]+)/i.exec(texte);
  const mot = m ? m[1].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() : "";
  const rang = PRIORITES.findIndex((p) => mot.startsWith(p));
  return { rang: rang === -1 ? PRIORITES.length : rang, libelle: m ? m[1] : "—" };
}

/** Les US indépendantes de celle du plan (ligne « **En parallèle avec** : US-004, US-006 (…) » ou « aucune »). */
function lireParallele(texte) {
  const m = /\*\*En parall[èe]le avec\*\*\s*:\s*([^\n]*)/i.exec(texte);
  if (!m || /^\s*(aucune|\{\{)/i.test(m[1])) return [];
  return (m[1].split("(")[0].match(/US-\d+/gi) || []).map((id) => id.toUpperCase());
}

function lireTitre(texte, id) {
  const h1 = /^#\s+(.+)$/m.exec(texte);
  const m = h1 && new RegExp(`${id}\\s*[–—-]?\\s*(.+)$`, "i").exec(h1[1]);
  return m && !m[1].includes("{{") ? m[1].trim() : "";
}

const dossiers = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => fs.statSync(path.join(d, f)).isDirectory()).sort() : []);
const fichiers = (d, motif) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => motif.test(f)).sort() : []);
const numero = (id) => Number(id.replace(/\D/g, ""));
const premierNumero = (plan) => Math.min(...plan.taches.map((t) => numero(t.id)));

/** Lit tous les plans reconnus : par priorité de leur US, puis dans l'ordre de leurs tâches. */
function lirePlans() {
  const plans = [];
  const ignores = [];
  for (const epic of dossiers(TACHES)) {
    for (const f of fichiers(path.join(TACHES, epic), FICHIER_PLAN)) {
      const [, brut, nom] = FICHIER_PLAN.exec(f);
      const id = brut.toUpperCase();
      const source = `aidd_docs/tasks/${epic}/${f}`;
      const texte = fs.readFileSync(path.join(TACHES, epic, f), "utf8");
      const taches = lireTaches(texte);
      if (taches.length === 0) {
        ignores.push(source);
        continue;
      }
      const cle = `${id}-${nom}`;
      plans.push({ epic, id, cle, source, titre: lireTitre(texte, id), priorite: lirePriorite(texte), parallele: lireParallele(texte), taches, guide: `${epic}/${cle}.md` });
    }
  }
  plans.sort((a, b) => a.priorite.rang - b.priorite.rang || premierNumero(a) - premierNumero(b) || a.cle.localeCompare(b.cle));
  return { plans, ignores };
}

/** Les specs sans plan, à signaler dans l'index. */
function specsSansPlan(plans) {
  const sans = [];
  for (const epic of dossiers(TACHES)) {
    for (const f of fichiers(path.join(TACHES, epic), FICHIER_SPEC)) {
      const id = FICHIER_SPEC.exec(f)[1].toUpperCase();
      if (!plans.some((p) => p.epic === epic && p.id === id)) sans.push(id);
    }
  }
  return sans.sort((a, b) => numero(a) - numero(b));
}

const detail = (tache, cle) => {
  const d = tache.details.find((x) => x.cle.toLowerCase().startsWith(cle));
  return d ? d.valeur : null;
};
const estMiseEnLigne = (tache) => /^mettre en ligne/i.test(tache.titre);
const estManuelle = (d) => /manuel|à faire par|coller|tableau de bord|créer un compte|console/i.test(`${d.cle} ${d.valeur}`);

/**
 * Toutes les tâches dans l'ordre où les réaliser : par priorité d'US (le MVP d'abord) ; dans une
 * même priorité, les tâches des plans dans l'ordre, et la mise en ligne seulement après elles.
 */
function ordreDesTaches(plans) {
  const ordre = [];
  for (let rang = 0; rang <= PRIORITES.length; rang++) {
    const groupe = plans.filter((p) => p.priorite.rang === rang);
    const paires = groupe.flatMap((plan) => plan.taches.map((tache) => ({ plan, tache })));
    ordre.push(...paires.filter((x) => !estMiseEnLigne(x.tache)), ...paires.filter((x) => estMiseEnLigne(x.tache)));
  }
  return ordre;
}

// ---------------------------------------------------------------- écriture

const bloc = (commande) => ["  ```", `  ${commande}`, "  ```"];
const coche = (fait) => (fait ? "[x]" : "[ ]");
const nomPlan = (plan) => (plan.titre ? `${plan.id} – ${plan.titre}` : plan.cle);

function etapesAvantLePlan(plans) {
  const etapes = [
    ["Préparer le projet", "/pulse:init", "CLAUDE.md"],
    ["Raconter l'idée", "/pulse:brainstorm", "docs/brief.md"],
    ["Décider du MVP", "/pulse:prd", "docs/prd.md"],
    ["Choisir les outils", "/pulse:tech", "docs/technical.md"],
    ["⚪ Définir l'identité visuelle (facultatif, avant les user stories)", "/pulse:ui identite", "docs/design.md"],
    ["Écrire les user stories, par epic", "/pulse:us", "docs/user-stories.md"],
  ];
  const lignes = etapes.map(([quoi, commande, fichier]) => `- ${coche(fs.existsSync(fichier))} ${quoi} : \`${commande}\` → \`${fichier}\``);
  const sansPlan = specsSansPlan(plans);
  lignes.push(`- ${coche(plans.length + sansPlan.length > 0)} Spécifier une US : \`/pulse:spec <US-XXX>\` → \`aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md\``);
  lignes.push(`- ${coche(plans.length > 0)} Planifier sa spec : \`/pulse:plan <US-XXX>\` → \`aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md\``);
  for (const id of sansPlan) lignes.push(`- ⚠️ Spec sans plan : \`/pulse:plan ${id}\``);
  return lignes;
}

/** La tâche à reprendre : une tâche en cours d'abord, quel que soit le plan, sinon la première à faire. */
function prochaineTache(plans) {
  const ordre = ordreDesTaches(plans);
  return ordre.find((x) => x.tache.statut === "en-cours") || ordre.find((x) => x.tache.statut === "a-faire") || null;
}

function commandeSuivante(plan, tache) {
  if (estMiseEnLigne(tache)) return "/pulse:deploy";
  return tache.statut === "en-cours" ? `/pulse:review ${tache.id}` : `/pulse:implement ${plan.id} ${tache.id}`;
}

/** Un worktree est-il déjà ouvert pour cette US (dossier .claude/worktrees/us-xxx-…) ? */
function aUnWorktree(id) {
  const dossier = path.join(".claude", "worktrees");
  return fs.existsSync(dossier) && fs.readdirSync(dossier).some((f) => f.toLowerCase().startsWith(`${id.toLowerCase()}-`));
}

/** La première US indépendante de celle du plan, encore à faire et à laquelle personne ne travaille. */
function usEnParallele(plans, plan) {
  return plans.find(
    (p) =>
      plan.parallele.includes(p.id) &&
      p.taches.some((t) => t.statut === "a-faire") &&
      !p.taches.some((t) => t.statut === "en-cours") &&
      !aUnWorktree(p.id),
  );
}

function ecrireIndex(plans, nom) {
  const suite = prochaineTache(plans);
  const lignes = [
    `# Guide de réalisation – ${nom}`,
    "",
    "> Généré automatiquement à partir des plans de `aidd_docs/tasks/` (`/pulse:guide`). **Ne pas le modifier à la main** : il est refait à chaque changement d'un plan.",
    "> Suivez-le dans l'ordre : copiez chaque commande dans Claude Code, puis passez à la suivante. Les statuts reflètent les plans.",
    "",
    "## Où en êtes-vous ?",
    "",
  ];
  const mvp = plans.filter((p) => p.priorite.rang === 0).flatMap((p) => p.taches);
  if (mvp.length > 0) {
    lignes.push(`MVP (US Indispensables planifiées) : ${mvp.filter((t) => t.statut === "terminee").length}/${mvp.length} tâche(s) terminée(s).`, "");
  }
  if (suite) {
    lignes.push(`Prochaine étape : **${suite.tache.id} – ${suite.tache.titre}** (${LIBELLES[suite.tache.statut]}), US \`${suite.plan.id}\`, dans [${suite.plan.guide}](${suite.plan.guide}) :`, "");
    lignes.push("```", commandeSuivante(suite.plan, suite.tache), "```", "");
    const autre = usEnParallele(plans, suite.plan);
    if (autre) {
      lignes.push(`💡 En même temps, dans une deuxième session Claude Code : \`/pulse:spirc -w ${autre.id}\` (${nomPlan(autre)} ne touche pas aux mêmes fichiers ; elle avancera dans son propre worktree).`, "");
    }
  } else {
    lignes.push("🎉 Toutes les tâches des plans sont terminées. Prochaines étapes possibles : `/pulse:deploy`, `/pulse:security`, une nouvelle US avec `/pulse:spec <US-XXX>`, ou une demande avec `/pulse:spirc <US-XXX> \"…\"`.", "");
  }
  lignes.push("## Avant de construire", "", ...etapesAvantLePlan(plans), "");
  lignes.push("## Les plans", "", "| Epic | US | Priorité | Tâches | Terminées | Guide |", "|---|---|---|---|---|---|");
  for (const plan of plans) {
    const faites = plan.taches.filter((t) => t.statut === "terminee").length;
    lignes.push(`| ${plan.epic} | ${nomPlan(plan)} | ${plan.priorite.libelle} | ${plan.taches.length} | ${faites}/${plan.taches.length} | [${plan.guide}](${plan.guide}) |`);
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
    "/pulse:status      # où en est le projet, et quoi faire maintenant",
    "```",
    "",
    "La première fois, ou après une mise à jour du plugin Pulse : `/pulse:init` (il prépare le projet et le met à niveau).",
    "",
    "## Si vous êtes bloqué",
    "",
    "- Une erreur, un bouton qui ne marche pas : `/pulse:fix \"<message ou description>\"`",
    "- Le plan ne vous convient plus (une question, une tâche à changer) : `/pulse:refine <US-XXX> \"<votre remarque>\"`",
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
  if (estMiseEnLigne(tache)) {
    lignes.push("- ⚠️ Avant : terminer les tâches de toutes les US Indispensables (voir [index.md](../index.md)).");
  }
  for (const d of tache.details.filter(estManuelle)) {
    const libelle = d.cle && !/manuel|action/i.test(d.cle) ? `${d.cle} : ` : "";
    lignes.push(`- ⚠️ Action de votre part : ${libelle}${d.valeur}`);
  }
  const fait = tache.statut === "terminee";
  if (estMiseEnLigne(tache)) {
    lignes.push(`- ${coche(fait)} 🔵 Mettre en ligne`, ...bloc("/pulse:deploy"));
  } else {
    lignes.push(`- ${coche(fait || tache.statut === "en-cours")} 🔵 Réaliser`, ...bloc(`/pulse:implement ${plan.id} ${tache.id}`));
    lignes.push(`- ${coche(fait)} 🔵 Relire, puis tester vous-même`, ...bloc(`/pulse:review ${tache.id}`));
    lignes.push(`- ${coche(fait)} 🔵 Enregistrer la version`, ...bloc("/pulse:commit"));
    lignes.push(`- ⚪ Ou les trois d'un coup, avec des points d'arrêt : \`/pulse:spirc ${plan.id} ${tache.id}\``);
  }
  const verification = detail(tache, "vérification") || detail(tache, "verification");
  if (verification) lignes.push("", `🧪 Ce que vous vérifierez : ${verification}`);
  const fichiersTache = detail(tache, "fichiers");
  if (fichiersTache) lignes.push(`📄 Fichiers concernés : ${fichiersTache}`);
  lignes.push("");
  return lignes;
}

function ecrirePlan(plan, nom) {
  const lignes = [
    `# ${nomPlan(plan)} – ${nom}`,
    "",
    `> Généré automatiquement à partir de \`${plan.source}\`. Retour au sommaire : [index.md](../index.md).`,
    `> Epic : ${plan.epic} · Priorité : ${plan.priorite.libelle}${plan.parallele.length ? ` · Peut avancer en parallèle de : ${plan.parallele.join(", ")}` : ""}`,
    "",
  ];
  let avant = null;
  for (const t of plan.taches) {
    lignes.push(...ecrireTache(plan, t, avant));
    avant = t;
  }
  const dejaEnLigne = plan.taches.some(estMiseEnLigne);
  lignes.push(
    `## Fin de ${plan.id}`,
    "",
    ...(dejaEnLigne ? [] : ["- 🔵 Mettre la nouvelle version en ligne (une fois le MVP en ligne) : `/pulse:deploy`"]),
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

/** Retire les pages qui ne correspondent plus à aucun plan (dont celles d'un ancien guide par jalon) : le guide reflète les plans. */
function nettoyer(dossier, attendus, relatif = "") {
  for (const f of fs.readdirSync(dossier)) {
    const complet = path.join(dossier, f);
    const rel = relatif ? `${relatif}/${f}` : f;
    if (fs.statSync(complet).isDirectory()) {
      nettoyer(complet, attendus, rel);
      if (fs.readdirSync(complet).length === 0) fs.rmdirSync(complet);
    } else if (/^(US-.*|jalon-\d+-.*)\.md$/i.test(f) && !attendus.has(rel)) {
      fs.unlinkSync(complet);
    }
  }
}

const ancienEmplacement = () =>
  ANCIENS.some((a) => fs.existsSync(a) && (fs.statSync(a).isFile() || fs.readdirSync(a).some((f) => /\.md$/i.test(f))));

function generer() {
  const { plans, ignores } = lirePlans();
  if (plans.length === 0) {
    if (ignores.length > 0) {
      return { erreur: `Aucune tâche reconnue (${ignores.join(", ")}) : format attendu « - [ ] **T1 – Titre** · US-001 » sous « ## Tâches ».` };
    }
    if (ancienEmplacement()) return { erreur: "Les plans sont à l'ancien emplacement (docs/plans/ ou docs/plan.md) : lancez /pulse:init pour les réorganiser dans aidd_docs/tasks/." };
    return { erreur: "Aucun plan dans aidd_docs/tasks/ : lancez d'abord /pulse:plan <US-XXX>." };
  }

  const nom = nomDuProjet();
  const attendus = new Set(plans.map((p) => p.guide));
  fs.mkdirSync(DOSSIER, { recursive: true });
  nettoyer(DOSSIER, attendus);
  const ecrits = [];
  const ecrire = (f, contenu) => {
    const complet = path.join(DOSSIER, f);
    fs.mkdirSync(path.dirname(complet), { recursive: true });
    const avant = fs.existsSync(complet) ? fs.readFileSync(complet, "utf8") : null;
    if (avant !== contenu) fs.writeFileSync(complet, contenu, "utf8");
    ecrits.push(f);
  };
  ecrire("index.md", ecrireIndex(plans, nom));
  for (const plan of plans) ecrire(plan.guide, ecrirePlan(plan, nom));
  const toutes = plans.flatMap((p) => p.taches);
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
    return /(^|[\\/])aidd_docs[\\/]tasks[\\/][^\\/]+[\\/]PLAN-[^\\/]+\.md$/i.test(fichier);
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
    for (const n of r.ignores) console.log(`⚠️ ${n} : aucune tâche reconnue, plan ignoré.`);
    if (r.suite) console.log(`➡️ Prochaine étape : ${commandeSuivante(r.suite.plan, r.suite.tache)}  (${r.suite.tache.id} – ${r.suite.tache.titre})`);
  }
}

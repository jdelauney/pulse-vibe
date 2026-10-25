// Tests du guide de réalisation (docs/guide/ produit à partir des plans de aidd_docs/tasks/<epic>/).
// Lancer : node --test plugins/pulse-vibe/tests/*.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const GUIDE = path.join(__dirname, "..", "scripts", "guide.js");
const ETAT = path.join(__dirname, "..", "scripts", "etat.js");

// Un projet Pulse prêt jusqu'aux user stories : la prochaine étape du guide est celle de pulse-aidd etat.
const CLAUDE = `# TodoIt

## Résumé du projet

Ce projet suit la **méthode Pulse**.

<!-- pulse_pile:debut -->
- **Pile** : HTML et JavaScript
<!-- pulse_pile:fin -->

<!-- pulse_memoire:debut -->
<!-- pulse_memoire:fin -->

<!-- pulse_profil:debut -->
- **Niveau** : Jamais programmé
<!-- pulse_profil:fin -->

- Dépôt distant : aucun pour l'instant
`;
const PROJET_PULSE = {
  "CLAUDE.md": CLAUDE,
  "aidd_docs/memory/project.md": "# Projet\n",
  "aidd_docs/memory/technical.md": "# Technique\n",
  "aidd_docs/memory/glossary.md": "# Glossaire\n",
  ".claude/settings.json": '{ "permissions": { "deny": ["Read(./.env)"], "allow": ["Bash(git commit -m *)", "Bash(pulse-aidd qualite *)"] } }\n',
  "docs/brief.md": "# Brief\n",
  "docs/prd.md": "# PRD\n",
  "docs/technical.md": "# Technique\n",
  "docs/user-stories.md": "# User stories\n",
};

const PLAN_US1 = `# Plan – TodoIt – US-001 Créer une tâche

## Vue d'ensemble

- **US** : US-001 – Créer une tâche · **Groupe** : Gérer les tâches · **Priorité** : Indispensable

## Tâches

> US terminée quand : on crée une tâche et on la voit dans la liste.

- [x] **T1 – Afficher la page** · US-001
  - Objectif : la page s'affiche
  - Fichiers : public/index.html
  - Vérification : US-001 critère 1

- [~] **T2 – Créer une tâche** · US-001
  - Objectif : saisir une tâche et la voir
  - Vérification : US-001 critères 1 et 2
  - Action manuelle : coller supabase/schema.sql dans l'éditeur SQL de Supabase

## Journal

| Date | Tâche | Commit | Remarque |
|---|---|---|---|
| 2026-10-05 | T1 | abc1234 | - [ ] **T99 – piège dans le journal** |
`;

const PLAN_US2 = `# Plan – TodoIt – US-002 Terminer une tâche

## Vue d'ensemble

- **US** : US-002 – Terminer une tâche · **Groupe** : Gérer les tâches · **Priorité** : Indispensable

## Tâches

- [ ] **T3 – Cocher une tâche** · US-002
  - Objectif : marquer une tâche comme faite

<!-- Tâche de mise en ligne : dernière US Indispensable du parcours. -->
- [ ] **T4 – Mettre en ligne la première version** · —
  - Vérification : l'adresse s'ouvre sur un téléphone
`;

const PLAN_US6 = `# Plan – TodoIt – US-006 Exporter la liste

## Vue d'ensemble

- **US** : US-006 – Exporter la liste · **Groupe** : Partager · **Priorité** : Essentiel

## Tâches

- [ ] **T5 – Exporter en CSV** · US-006
  - Objectif : télécharger la liste
`;

const TACHES = { epic: "gerer-taches", us1: "PLAN-SPEC-US-001-creer-tache", us2: "PLAN-SPEC-US-002-terminer-tache" };
const US1 = "gerer-taches/US-001-creer-tache.md";
const US2 = "gerer-taches/US-002-terminer-tache.md";
const US6 = "partager/US-006-exporter-liste.md";

/** plans : { "<epic>/<fichier sans .md>": contenu } */
function projet(plans = { [`${TACHES.epic}/${TACHES.us1}`]: PLAN_US1 }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-guide-"));
  fs.mkdirSync(path.join(d, "aidd_docs", "tasks"), { recursive: true });
  for (const [chemin, contenu] of Object.entries(PROJET_PULSE)) {
    fs.mkdirSync(path.dirname(path.join(d, chemin)), { recursive: true });
    fs.writeFileSync(path.join(d, chemin), contenu);
  }
  for (const [nom, contenu] of Object.entries(plans)) ecrire(d, nom, contenu);
  return d;
}
function ecrire(d, nom, contenu) {
  const f = path.join(d, "aidd_docs", "tasks", `${nom}.md`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenu);
}
const lancer = (d, args = [], input) => spawnSync("node", [GUIDE, ...args], { encoding: "utf8", input, env: { ...process.env, CLAUDE_PROJECT_DIR: d } });
const lire = (d, f) => fs.readFileSync(path.join(d, "docs", "guide", f), "utf8");
const existe = (d, ...f) => fs.existsSync(path.join(d, "docs", "guide", ...f));
const hook = (d, fichier) => lancer(d, ["--hook"], JSON.stringify({ tool_name: "Edit", tool_input: { file_path: path.join(d, ...fichier) } }));
const troisPlans = () =>
  projet({
    "partager/PLAN-SPEC-US-006-exporter-liste": PLAN_US6,
    [`${TACHES.epic}/${TACHES.us2}`]: PLAN_US2,
    [`${TACHES.epic}/${TACHES.us1}`]: PLAN_US1,
  });

test("produit l'index et une page par plan, rangée dans le dossier de son epic, avec la prochaine commande", () => {
  const d = projet();
  ecrire(d, "gerer-taches/revues/PLAN-SPEC-US-001-creer-tache/T1-2026-10-05", "# Revue – T1\n\n## Tâches\n\n- [ ] **T98 – piège dans un rapport**\n");
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stdout);
  assert.deepStrictEqual(fs.readdirSync(path.join(d, "docs", "guide")).sort(), ["gerer-taches", "index.md"]);
  assert.deepStrictEqual(fs.readdirSync(path.join(d, "docs", "guide", "gerer-taches")), ["US-001-creer-tache.md"]);
  const index = lire(d, "index.md");
  assert.match(index, /# Guide de réalisation – TodoIt/);
  assert.match(index, /```\n\/pulse:review T2\n```/, "T2 en cours : la prochaine étape est la relecture");
  assert.match(index, /\| gerer-taches \| US-001 – Créer une tâche \| Indispensable \| 2 \| 1\/2 \|/);
  assert.match(index, /Première version \(US Indispensables planifiées\) : 1\/2/);
  assert.match(index, /Choisir les outils[^\n]*\n- \[ \] ⚪ Définir l'identité visuelle \(facultatif, avant les user stories\) : `\/pulse:ui identite`[^\n]*\n- \[[ x]\] Écrire les user stories/, "l'identité visuelle, facultative, entre la pile et les user stories");
  assert.doesNotMatch(index + lire(d, US1), /T99/, "le Journal est ignoré");
  assert.doesNotMatch(index, /T98|\| revues \|/, "les rapports de relecture ne sont ni un plan ni une epic");
});

test("chaque tâche a ses commandes, avec l'identifiant de l'US, ses prérequis et ses actions manuelles", () => {
  const d = troisPlans();
  lancer(d);
  const p1 = lire(d, US1);
  assert.match(p1, /^# US-001 – Créer une tâche – TodoIt/);
  assert.match(p1, /aidd_docs\/tasks\/gerer-taches\/PLAN-SPEC-US-001-creer-tache\.md/);
  assert.match(p1, /- \[x\] 🔵 Réaliser\n  ```\n  \/pulse:implement US-001 T1/);
  assert.match(p1, /\/pulse:spirc US-001 T2/);
  assert.match(p1, /\[index\.md\]\(\.\.\/index\.md\)/);
  assert.match(p1, /⚠️ Action de votre part : coller supabase\/schema\.sql/);
  assert.match(p1, /## Fin de US-001\n\n- 🔵 Mettre la nouvelle version en ligne/);
  const p2 = lire(d, US2);
  assert.match(p2, /### T4 – Mettre en ligne la première version\n\nStatut : ⬜ à faire\n/, "pas de « — » affiché");
  assert.match(p2, /⚠️ Avant : terminer et enregistrer T3/);
  assert.match(p2, /⚠️ Avant : terminer les tâches de toutes les US Indispensables/);
  assert.match(p2, /- \[ \] 🔵 Mettre en ligne\n  ```\n  \/pulse:deploy/);
  assert.doesNotMatch(p2, /\/pulse:implement \S+ T4/);
  assert.doesNotMatch(p2, /## Fin de US-002\n\n- 🔵 Mettre la nouvelle version en ligne/, "le plan qui met en ligne ne le propose pas une seconde fois");
});

test("plusieurs plans : MVP d'abord, la mise en ligne après toutes ses tâches, specs sans plan signalées", () => {
  const d = troisPlans();
  fs.writeFileSync(path.join(d, "aidd_docs", "tasks", "partager", "SPEC-US-007-rappels.md"), "# Spec\n");
  fs.writeFileSync(path.join(d, "aidd_docs", "tasks", "partager", "SPEC-US-006-exporter-liste.md"), "# Spec\n");
  assert.strictEqual(lancer(d).status, 0);
  let index = lire(d, "index.md");
  assert.ok(index.indexOf("| US-001 –") < index.indexOf("| US-002 –") && index.indexOf("| US-002 –") < index.indexOf("| US-006 –"), "les US Indispensables d'abord");
  assert.match(index, /⚠️ Spec sans plan : `\/pulse:plan US-007`/);
  assert.doesNotMatch(index, /Spec sans plan : `\/pulse:plan US-006`/);
  assert.match(index, /```\n\/pulse:review T2\n```/, "une tâche en cours passe avant la spec sans plan, comme dans pulse-aidd etat");
  fs.unlinkSync(path.join(d, "aidd_docs", "tasks", "partager", "SPEC-US-007-rappels.md"));

  ecrire(d, `${TACHES.epic}/${TACHES.us1}`, PLAN_US1.replace("- [~] **T2", "- [x] **T2"));
  lancer(d);
  assert.match(lire(d, "index.md"), /```\n\/pulse:spirc US-002\n```/, "T3 avant la mise en ligne T4 : réaliser US-002 (règle R19 de pulse-aidd etat)");
  assert.match(lire(d, "index.md"), /Tâche à reprendre : \*\*T3 – Cocher une tâche\*\* \(⬜ à faire\), US `US-002`, dans \[gerer-taches\/US-002-terminer-tache\.md\]/);

  ecrire(d, `${TACHES.epic}/${TACHES.us2}`, PLAN_US2.replace("- [ ] **T3", "- [x] **T3"));
  ecrire(d, "gerer-taches/PLAN-SPEC-US-003-supprimer-tache", PLAN_US2.replace(/US-002/g, "US-003").replace("T3 – Cocher", "T6 – Supprimer").replace(/\n<!--[\s\S]*$/, "\n"));
  lancer(d);
  assert.match(lire(d, "index.md"), /```\n\/pulse:spirc US-003\n```/, "une US Indispensable planifiée plus tard passe avant la mise en ligne");

  ecrire(d, "gerer-taches/PLAN-SPEC-US-003-supprimer-tache", "# Plan\n\n- **Priorité** : Indispensable\n\n## Tâches\n\n- [x] **T6 – Supprimer** · US-003\n");
  lancer(d);
  index = lire(d, "index.md");
  assert.match(index, /```\n\/pulse:deploy\n```/, "MVP terminé : la mise en ligne passe avant les US Essentielles");

  ecrire(d, "partager/PLAN-SPEC-US-006-exporter-liste", PLAN_US6.replace("- [ ] **T5", "- [~] **T5"));
  lancer(d);
  assert.match(lire(d, "index.md"), /```\n\/pulse:review T5\n```/, "une tâche en cours passe avant les autres");
});

test("index et résumé : la même prochaine commande que pulse-aidd etat (T1 terminée, T2 à faire : /pulse:spirc US-002)", () => {
  const plan = PLAN_US1.replace(/US-001/g, "US-002").replace("- [~] **T2", "- [ ] **T2");
  const d = projet({ [`${TACHES.epic}/PLAN-SPEC-US-002-voir-liste`]: plan });
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stdout);
  const etat = spawnSync("node", [ETAT, "--sans-git"], { cwd: d, encoding: "utf8" }).stdout;
  assert.match(etat, /^prochaine: \/pulse:spirc US-002$/m);
  const index = lire(d, "index.md");
  assert.match(index, /```\n\/pulse:spirc US-002\n```/);
  assert.match(index, /C'est la même que `\/pulse:status`, sauf une fois le site en ligne ou quand des versions enregistrées ne sont pas encore envoyées : tapez alors `\/pulse:status` pour l'étape à jour\./);
  assert.doesNotMatch(index, /^\/pulse:implement US-002 T2$/m, "plus de règle propre au guide pour l'index");
  assert.match(r.stdout, /➡️ Prochaine étape : \/pulse:spirc US-002 {2}\(US-002 a des tâches à réaliser/);
});

test("US indépendante : proposée dans une deuxième session, sauf si on y travaille déjà ou si elle est terminée", () => {
  const parallele = (texte) => PLAN_US1.replace("**Priorité** : Indispensable", `**Priorité** : Indispensable\n- **En parallèle avec** : ${texte}`);
  const d = projet({ [`${TACHES.epic}/${TACHES.us1}`]: parallele("US-006 (aucun fichier ni donnée en commun avec US-002)"), "partager/PLAN-SPEC-US-006-exporter-liste": PLAN_US6 });
  lancer(d);
  assert.match(lire(d, "index.md"), /```\n\/pulse:review T2\n```\n\nC'est la même que [^\n]*\n\nTâche à reprendre : [^\n]*\n\n💡 En même temps, dans une deuxième session Claude Code : `\/pulse:spirc US-006` \(US-006 – Exporter la liste/);
  assert.doesNotMatch(lire(d, "index.md"), /spirc -w/);
  assert.doesNotMatch(lire(d, "index.md"), /deuxième session Claude Code : `\/pulse:spirc US-002`/, "une US citée dans la parenthèse n'est pas retenue");
  assert.match(lire(d, US1), /Peut avancer en parallèle de : US-006/);

  fs.mkdirSync(path.join(d, ".claude", "worktrees", "us-006-exporter-liste"), { recursive: true });
  lancer(d);
  assert.doesNotMatch(lire(d, "index.md"), /deuxième session Claude Code/, "un worktree est déjà ouvert pour US-006");

  fs.rmSync(path.join(d, ".claude"), { recursive: true });
  ecrire(d, "partager/PLAN-SPEC-US-006-exporter-liste", PLAN_US6.replace("- [ ] **T5", "- [x] **T5"));
  lancer(d);
  assert.doesNotMatch(lire(d, "index.md"), /deuxième session Claude Code/, "US-006 terminée");

  ecrire(d, `${TACHES.epic}/${TACHES.us1}`, parallele("aucune"));
  ecrire(d, "partager/PLAN-SPEC-US-006-exporter-liste", PLAN_US6);
  lancer(d);
  assert.doesNotMatch(lire(d, "index.md") + lire(d, US1), /deuxième session Claude Code|parallèle de/);
});

test("mode hook : régénère seulement quand un plan de aidd_docs/tasks/ est modifié, sans rien afficher", () => {
  const d = projet();
  lancer(d);
  ecrire(d, `${TACHES.epic}/${TACHES.us1}`, PLAN_US1.replace("- [~] **T2", "- [x] **T2"));

  const autre = hook(d, ["aidd_docs", "tasks", TACHES.epic, "SPEC-US-001-creer-tache.md"]);
  assert.strictEqual(autre.stdout, "");
  assert.match(lire(d, "index.md"), /\/pulse:review T2/, "autre fichier : guide inchangé");

  const plan = hook(d, ["aidd_docs", "tasks", TACHES.epic, `${TACHES.us1}.md`]);
  assert.strictEqual(plan.status, 0);
  assert.strictEqual(plan.stdout, "");
  assert.match(lire(d, "index.md"), /Toutes les tâches des plans sont terminées/, "T2 terminée : guide régénéré");

  assert.strictEqual(lancer(d, ["--hook"], "pas du json").status, 0);
});

test("retire les pages d'un plan disparu, les dossiers d'epic vides et l'ancien guide par jalon", () => {
  const d = troisPlans();
  fs.mkdirSync(path.join(d, "docs", "guide", "us-01-mvp"), { recursive: true });
  fs.writeFileSync(path.join(d, "docs", "guide", "jalon-01-mvp.md"), "ancien guide à plat");
  fs.writeFileSync(path.join(d, "docs", "guide", "us-01-mvp", "jalon-01-mvp.md"), "ancien guide par plan");
  lancer(d);
  assert.ok(!existe(d, "jalon-01-mvp.md"));
  assert.ok(!existe(d, "us-01-mvp"));

  fs.unlinkSync(path.join(d, "aidd_docs", "tasks", "partager", "PLAN-SPEC-US-006-exporter-liste.md"));
  fs.unlinkSync(path.join(d, "aidd_docs", "tasks", TACHES.epic, `${TACHES.us2}.md`));
  lancer(d);
  assert.ok(!existe(d, "partager"));
  assert.ok(!existe(d, US2));
  assert.ok(existe(d, US1));
});

test("aucun plan, ancien emplacement ou plan sans tâche reconnue : message clair, code 1", () => {
  const sansPlan = lancer(projet({}));
  assert.strictEqual(sansPlan.status, 1);
  assert.match(sansPlan.stdout, /\/pulse:plan/);

  for (const ancien of [["docs", "plan.md"], ["docs", "plans", "mvp.md"]]) {
    const d = projet({});
    fs.mkdirSync(path.join(d, ...ancien.slice(0, -1)), { recursive: true });
    fs.writeFileSync(path.join(d, ...ancien), PLAN_US1);
    const r = lancer(d);
    assert.strictEqual(r.status, 1);
    assert.match(r.stdout, /\/pulse:init/);
  }

  const vide = lancer(projet({ "gerer-taches/PLAN-SPEC-US-001-vide": "# Plan\n\nRien ici.\n" }));
  assert.strictEqual(vide.status, 1);
  assert.match(vide.stdout, /aucune tâche reconnue/i);
  assert.match(vide.stdout, /## Tâches/);
});

test("index : « Si vous êtes bloqué » propose /pulse:annuler et /pulse:get-help", () => {
  const d = projet();
  assert.strictEqual(lancer(d).status, 0);
  const index = lire(d, "index.md");
  assert.match(index, /\/pulse:annuler/);
  assert.match(index, /\/pulse:get-help/);
  assert.doesNotMatch(index, /personne qui sait programmer/);
});

test("le guide lu par la personne : ni « MVP », ni « epic », ni « demande de fusion » (hors chemins et commandes)", () => {
  const d = troisPlans();
  assert.strictEqual(lancer(d).status, 0);
  const sansChemins = (t) => t.replace(/`[^`]*`/g, " ").replace(/<[^>]*>/g, " ").replace(/\S*\/\S*/g, " ");
  const problemes = [];
  for (const f of ["index.md", US1, US2, US6]) {
    lire(d, f).split("\n").forEach((ligne, i) => {
      const m = /\bMVP\b/.exec(sansChemins(ligne)) || /\b(epics?|demandes? de fusion)\b/i.exec(sansChemins(ligne));
      if (m) problemes.push(`${f}:${i + 1} : ${m[0]}`);
    });
  }
  assert.deepStrictEqual(problemes, []);
  assert.match(lire(d, "index.md"), /\| Groupe \| US \| Priorité \|/);
  assert.match(lire(d, US1), /^> Groupe : gerer-taches · Priorité : Indispensable/m);
});

test("plan avec « Questions en attente », « Choix faits par Pulse » et « En pause » : la tâche compte normalement, Q1 n'est pas une tâche", () => {
  const plan = PLAN_US1.replace(
    "## Journal",
    "## Questions en attente\n\n- [ ] Q1 · T2 · Garder les terminées ? · Options : oui / non · Recommandé : oui\n\n## Choix faits par Pulse\n\n- T2 · tri par date · Autre possibilité : par nom · Raison : simple\n\n## Journal",
  ).replace("  - Vérification : US-001 critères 1 et 2", "  - Vérification : US-001 critères 1 et 2\n  - En pause : Q1 (votre décision)");
  const d = projet({ [`${TACHES.epic}/${TACHES.us1}`]: plan });
  const r = lancer(d);
  assert.strictEqual(r.status, 0, r.stdout);
  const p1 = lire(d, US1);
  assert.match(p1, /\/pulse:spirc US-001 T2/);
  assert.match(lire(d, "index.md"), /\| gerer-taches \| US-001 – Créer une tâche \| Indispensable \| 2 \| 1\/2 \|/);
  assert.doesNotMatch(p1, /Q1 ·/, "la question n'est pas lue comme une tâche");
});

// Tests de `pulse-aidd etat` (scripts/etat.js) : la prochaine étape calculée à partir des fichiers du projet.
// Lancer : node --test plugins/pulse-vibe/tests/etat.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const ETAT = path.join(RACINE, "scripts", "etat.js");
const { lireFaits, decider, sortieIllisible } = require(ETAT);

const CLAUDE = (options = {}) => `# TodoIt

Ce projet suit la **méthode Pulse** (plugin \`pulse\`).

<!-- pulse_profil:debut -->
- **Niveau** : ${options.niveau || "Jamais programmé"}
- **Explications** : normales
<!-- pulse_profil:fin -->

## Pile technique

<!-- pulse_pile:debut -->
${options.pile || "Pile non choisie : lancer `/pulse:tech`."}
<!-- pulse_pile:fin -->

## Mémoire du projet

<!-- pulse_memoire:debut -->
<!-- pulse_memoire:fin -->

## Adresses

- Dépôt distant : ${options.depot || "{{à compléter}}"}
- Site en ligne : ${options.site || "{{à compléter}}"}
`;

const PILE = "- **Pile** : HTML et JavaScript";

/** Un rapport de relecture (modèle « revue ») : verdict, et au besoin résultat du test par la personne et blocage. */
// Le modèle non rempli liste les trois résultats possibles : MODELE_TEST.
const MODELE_TEST = "✅ concluant | ❌ non concluant | ⏳ reporté au test groupé de fin de plan (mode autonome)";
const RAPPORT = (verdict, { test = "✅ concluant", blocage, verif = "✅ Prouvé", retest } = {}) => `# Revue – T2 – 2026-10-07

**Verdict** : ${verdict}
**Mode** : /pulse:review

## Vérification

- **Verdict** : ${verif}

## Constats

${blocage ? `**Blocage** : ${blocage}` : ""}

## Test par la personne

- **Date** : 2026-10-07
- **Résultat** : ${test}
${retest ? `- **Résultat** : ${retest}\n` : ""}`;

const REFERENTIEL = `# User stories – TodoIt

> Priorités : **Indispensable** (le MVP) · **Essentiel** · **Optionnel** · **En attente**.

## Ordre de réalisation

> D'abord ce dont les autres dépendent, puis par priorité.

US-002 → US-001 → US-003

---

## Epic – Gérer les tâches (\`gerer-taches\`)

| ID | Titre | Acteur | Priorité | Taille | Dépend de | Fichier |
|---|---|---|---|---|---|---|
| US-001 | Créer une tâche | membre | Indispensable | S | — | [US-001-creer-tache.md](../aidd_docs/tasks/gerer-taches/US-001-creer-tache.md) |
| US-002 | Voir la liste | membre | Indispensable | S | — | [US-002-voir-liste.md](../aidd_docs/tasks/gerer-taches/US-002-voir-liste.md) |
| US-003 | Exporter la liste | membre | Essentiel | S | — | — (détaillée lors de sa spec) |
| US-004 | Partager | membre | En attente | S | — | — |
`;

const SPEC = (statut) => `# Spécification – TodoIt – US-001 Créer une tâche

> Une question sans réponse s'écrit \`TBD: <question précise>\` à l'endroit concerné.

**Statut** : ${statut}

## 1. Intention

- **Ce que l'utilisateur pourra faire** : créer une tâche
`;

const PLAN = (id, taches) => `# Plan – TodoIt – ${id} Titre

## Vue d'ensemble

- **US** : ${id} – Titre · **Epic** : Gérer les tâches · **Priorité** : Indispensable

## Tâches

${taches}

## Journal

| Date | Tâche | Commit | Remarque |
|---|---|---|---|
`;

/** Un projet Pulse prêt (profil, mémoire branchée, secrets protégés), complété par `fichiers` ({ chemin: contenu }). */
function projet(fichiers = {}, options = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-etat-"));
  const tous = {
    "CLAUDE.md": CLAUDE(options),
    "aidd_docs/memory/project.md": "# Projet\n",
    "aidd_docs/memory/technical.md": "# Technique\n",
    "aidd_docs/memory/glossary.md": "# Glossaire\n",
    ".claude/settings.json": '{ "permissions": { "deny": ["Read(./.env)"] } }\n',
    ...fichiers,
  };
  for (const [chemin, contenu] of Object.entries(tous)) {
    if (contenu === null) continue;
    const complet = path.join(d, chemin);
    fs.mkdirSync(path.dirname(complet), { recursive: true });
    if (contenu === "<dossier>") fs.mkdirSync(complet, { recursive: true });
    else fs.writeFileSync(complet, contenu);
  }
  return d;
}

/** Lance l'outil dans le projet et lit ses lignes « clé: valeur » (aussi : toutes les lignes). */
function etat(dossier, ...args) {
  const r = spawnSync(process.execPath, [ETAT, "--sans-git", "--aujourdhui", "2026-10-08", ...args], { cwd: dossier, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  const sortie = { aussi: [], brut: r.stdout };
  for (const ligne of r.stdout.trim().split("\n")) {
    const m = /^([a-z-]+): (.*)$/.exec(ligne);
    assert.ok(m, `ligne inattendue : ${ligne}`);
    if (m[1] === "aussi") sortie.aussi.push(m[2]);
    else sortie[m[1]] = m[2];
  }
  return sortie;
}

// Les documents de la méthode jusqu'au référentiel des user stories.
const AVANT_US = {
  "docs/brief.md": "# Brief\n",
  "docs/prd.md": "# PRD\n",
  "docs/technical.md": "# Technique\n",
  "docs/design.md": "# Design\n",
  "docs/user-stories.md": REFERENTIEL,
};
const PILE_CHOISIE = { pile: PILE };

test("dossier vide : préparer le projet (R2)", () => {
  const r = etat(projet({ "CLAUDE.md": null, "aidd_docs/memory/project.md": null, "aidd_docs/memory/technical.md": null, "aidd_docs/memory/glossary.md": null, ".claude/settings.json": null }));
  assert.strictEqual(r.prochaine, "/pulse:init");
  assert.strictEqual(r.regle, "R2");
  assert.strictEqual(r.fondation, "dossier");
  assert.deepStrictEqual(r.aussi, [], "pas d'alternative tant que le projet n'est pas préparé");
});

test("CLAUDE.md sans Pulse (R3), documents à l'ancien format (R4), profil à préciser (R5)", () => {
  assert.strictEqual(etat(projet({ "CLAUDE.md": "# Mon outil\n\nDes règles à moi.\n" })).regle, "R3");
  const ancien = etat(projet({ "docs/specs/creer.md": "# Spec\n" }));
  assert.deepStrictEqual([ancien.regle, ancien.prochaine, ancien.fondation], ["R4", "/pulse:init", "documents"]);
  const profil = etat(projet({}, { niveau: "à préciser" }));
  assert.deepStrictEqual([profil.regle, profil.fondation], ["R5", "profil"]);
});

test("mémoire non branchée (R6) et pile incohérente avec docs/technical.md (R8)", () => {
  const memoire = etat(projet({ "aidd_docs/memory/glossary.md": null }));
  assert.deepStrictEqual([memoire.regle, memoire.prochaine, memoire.fondation], ["R6", "/pulse:memory creer", "memoire"]);
  const pile = etat(projet({ "docs/technical.md": "# Technique\n" }));
  assert.deepStrictEqual([pile.regle, pile.prochaine, pile.fondation], ["R8", "/pulse:tech", "pile"]);
});

test("travail en cours : reprendre la décision en attente, d'abord (R1)", () => {
  const attente = `# Travail en cours

- **Commande** : \`/pulse:prd\`
- **Étape** : ronde 2
- **Mis à jour le** : 2026-10-07 18:00
- **Pour reprendre** : \`/pulse:prd\`
`;
  const r = etat(projet({ "aidd_docs/tasks/in-progress.md": attente }));
  assert.deepStrictEqual([r.regle, r.prochaine, r.attente], ["R1", "/pulse:prd", "ronde 2"]);
  assert.strictEqual(r.ancien, undefined);
  const vieux = etat(projet({ "aidd_docs/tasks/in-progress.md": attente.replace("2026-10-07", "2026-09-01") }));
  assert.strictEqual(vieux.ancien, "oui");
  assert.match(vieux.raison, /pulse-aidd travail-fini/);
  const worktree = etat(projet({ ".claude/worktrees/us-001-creer-tache/aidd_docs/tasks/in-progress.md": attente }));
  assert.deepStrictEqual([worktree.regle, worktree.dossier], ["R1", ".claude/worktrees/us-001-creer-tache"]);
});

test("projet neuf : raconter l'idée, ou démarrer vite (R9)", () => {
  const r = etat(projet());
  assert.deepStrictEqual([r.regle, r.prochaine], ["R9", "/pulse:brainstorm"]);
  assert.match(r.aussi[0], /^\/pulse:express — /);
  assert.ok(r.aussi.some((a) => a.startsWith("/pulse:init — relier")), "dépôt distant à décider");
  assert.strictEqual(r.etapes, "brief=a-faire prd=a-faire technique=a-faire design=facultatif us=a-faire spec=a-faire plan=a-faire realisation=a-faire en-ligne=non");
  assert.strictEqual(r.mvp, "0/0");
});

test("documents de cadrage : PRD (R10), outils (R11), identité facultative puis user stories (R12)", () => {
  assert.strictEqual(etat(projet({ "docs/brief.md": "# Brief\n" })).prochaine, "/pulse:prd");
  assert.strictEqual(etat(projet({ "docs/brief.md": "x", "docs/prd.md": "x" })).prochaine, "/pulse:tech");
  const identite = etat(projet({ "docs/brief.md": "x", "docs/prd.md": "x", "docs/technical.md": "x" }, PILE_CHOISIE));
  assert.deepStrictEqual([identite.regle, identite.prochaine], ["R12", "/pulse:ui identite"]);
  assert.match(identite.aussi[0], /^\/pulse:us — /);
  const us = etat(projet({ "docs/brief.md": "x", "docs/prd.md": "x", "docs/technical.md": "x", "docs/design.md": "x" }, PILE_CHOISIE));
  assert.deepStrictEqual([us.regle, us.prochaine], ["R12", "/pulse:us"]);
});

test("specs : la première US Indispensable de l'ordre de réalisation (R20), un brouillon d'abord (R17)", () => {
  const r = etat(projet(AVANT_US, PILE_CHOISIE));
  assert.deepStrictEqual([r.regle, r.prochaine], ["R20", "/pulse:spec US-002"], "US-002 vient avant US-001 dans l'ordre de réalisation");
  const brouillon = etat(projet({ ...AVANT_US, "aidd_docs/tasks/gerer-taches/SPEC-US-001-creer-tache.md": SPEC("brouillon") }, PILE_CHOISIE));
  assert.deepStrictEqual([brouillon.regle, brouillon.prochaine], ["R17", "/pulse:spec US-001"]);
  const tbd = SPEC("verrouillée le 2026-10-08").replace("créer une tâche", "créer une tâche\n- TBD: combien de caractères au plus ?");
  assert.strictEqual(etat(projet({ ...AVANT_US, "aidd_docs/tasks/gerer-taches/SPEC-US-001-creer-tache.md": tbd }, PILE_CHOISIE)).regle, "R17");
});

test("le TBD cité dans l'en-tête du modèle de spec ne rend pas la spec brouillon (R18)", () => {
  const r = etat(projet({ ...AVANT_US, "aidd_docs/tasks/gerer-taches/SPEC-US-001-creer-tache.md": SPEC("verrouillée le 2026-10-08") }, PILE_CHOISIE));
  assert.deepStrictEqual([r.regle, r.prochaine], ["R18", "/pulse:plan US-001"]);
  assert.match(r.aussi[0], /^\/pulse:ui maquettes US-001 — /, "design.md présent, aucune maquette retenue");
  assert.match(r.etapes, /spec=en-cours plan=a-faire/);
  const avecMaquette = etat(projet({
    ...AVANT_US,
    "aidd_docs/tasks/gerer-taches/SPEC-US-001-creer-tache.md": SPEC("verrouillée le 2026-10-08"),
    "docs/design/maquettes/US-001-creer-tache/retenue": "<dossier>",
  }, PILE_CHOISIE));
  assert.ok(!avecMaquette.aussi.some((a) => a.startsWith("/pulse:ui maquettes")));
});

const SPECS_VALIDEES = {
  "aidd_docs/tasks/gerer-taches/SPEC-US-001-creer-tache.md": SPEC("verrouillée le 2026-10-08"),
  "aidd_docs/tasks/gerer-taches/SPEC-US-002-voir-liste.md": SPEC("verrouillée le 2026-10-08"),
};

test("tâche en cours : relecture et vérification (R14), puis enregistrement une fois relue (R13)", () => {
  const fichiers = {
    ...AVANT_US,
    ...SPECS_VALIDEES,
    "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir-liste.md": PLAN("US-002", "- [x] **T1 – Afficher la page** · US-002\n- [~] **T2 – Voir la liste** · US-002"),
  };
  const r = etat(projet(fichiers, PILE_CHOISIE));
  assert.deepStrictEqual([r.regle, r.prochaine], ["R14", "/pulse:review T2"]);
  const relue = etat(projet({ ...fichiers, "aidd_docs/tasks/gerer-taches/revues/PLAN-SPEC-US-002-voir-liste/T2-2026-10-07.md": RAPPORT("✅ Validé") }, PILE_CHOISIE));
  assert.deepStrictEqual([relue.regle, relue.prochaine], ["R13", "/pulse:commit"]);
  const autre = etat(projet({ ...fichiers, "aidd_docs/tasks/gerer-taches/revues/PLAN-SPEC-US-002-voir-liste/T21-2026-10-07.md": RAPPORT("✅ Validé") }, PILE_CHOISIE));
  assert.strictEqual(autre.regle, "R14", "le rapport de T21 ne vaut pas pour T2");
});

test("spec validée sans plan avant les tâches restantes (R18), puis les tâches du MVP d'abord (R19)", () => {
  const plan2 = PLAN("US-002", "- [x] **T1 – Afficher la page** · US-002\n- [ ] **T2 – Voir la liste** · US-002");
  const r = etat(projet({ ...AVANT_US, ...SPECS_VALIDEES, "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir-liste.md": plan2 }, PILE_CHOISIE));
  assert.deepStrictEqual([r.regle, r.prochaine], ["R18", "/pulse:plan US-001"]);
  const plan1 = PLAN("US-001", "- [ ] **T3 – Créer une tâche** · US-001\n- [ ] **T4 – Mettre en ligne le MVP** · —");
  const taches = etat(projet({
    ...AVANT_US,
    ...SPECS_VALIDEES,
    "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir-liste.md": plan2,
    "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-001-creer-tache.md": plan1,
  }, PILE_CHOISIE));
  assert.deepStrictEqual([taches.regle, taches.prochaine], ["R19", "/pulse:spirc US-002"]);
  assert.match(taches.aussi[0], /^\/pulse:implement US-002 T2 — /);
  assert.strictEqual(taches.mvp, "1/4");
  assert.match(taches.etapes, /plan=fait realisation=en-cours en-ligne=non/);
});

test("MVP terminé : mise en ligne (R15), audit de sécurité une fois en ligne (R21), puis US suivante (R22)", () => {
  const fichiers = {
    ...AVANT_US,
    ...SPECS_VALIDEES,
    "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir-liste.md": PLAN("US-002", "- [x] **T1 – Afficher la page** · US-002"),
    "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-001-creer-tache.md": PLAN("US-001", "- [x] **T2 – Créer une tâche** · US-001\n- [ ] **T3 – Mettre en ligne le MVP** · —"),
  };
  const horsLigne = etat(projet(fichiers, PILE_CHOISIE));
  assert.deepStrictEqual([horsLigne.regle, horsLigne.prochaine, horsLigne.mvp], ["R15", "/pulse:deploy", "2/3"]);
  assert.match(horsLigne.etapes, /realisation=fait en-ligne=non/);
  const enLigne = { ...PILE_CHOISIE, site: "https://todoit.example.org", depot: "https://github.com/exemple/todoit" };
  const fini = { ...fichiers, "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-001-creer-tache.md": PLAN("US-001", "- [x] **T2 – Créer une tâche** · US-001\n- [x] **T3 – Mettre en ligne le MVP** · —") };
  const audit = etat(projet(fini, enLigne));
  assert.deepStrictEqual([audit.regle, audit.prochaine], ["R21", "/pulse:security"]);
  const suivante = etat(projet({ ...fini, "docs/securite.md": "# Sécurité\n" }, enLigne));
  assert.deepStrictEqual([suivante.regle, suivante.prochaine], ["R22", "/pulse:spec US-003"], "US-004 est « En attente » : jamais proposée");
  assert.ok(suivante.aussi.some((a) => a.startsWith("/pulse:cicd — ")), "dépôt relié, aucune CI");
  const aJour = etat(projet({ ...fini, "docs/securite.md": "x", "aidd_docs/tasks/partager/SPEC-US-003-exporter.md": SPEC("verrouillée le 2026-10-08"), "aidd_docs/tasks/partager/PLAN-SPEC-US-003-exporter.md": PLAN("US-003", "- [x] **T4 – Exporter** · US-003"), ".github/workflows/verifications.yml": "on: push\n" }, enLigne));
  assert.strictEqual(aJour.regle, "R23");
  assert.ok(!aJour.aussi.some((a) => a.startsWith("/pulse:cicd")), "une CI existe");
});

test("Git : dossier sans historique propre (R7), versions pas encore envoyées (R16)", () => {
  const dossier = projet(AVANT_US, PILE_CHOISIE);
  const faits = lireFaits(dossier, { git: false });
  assert.strictEqual(decider({ ...faits, git: { depot: false, commits: false, remote: false, avance: 0 } }).regle, "R7");
  assert.strictEqual(decider({ ...faits, git: { depot: true, commits: false, remote: false, avance: 0 } }).regle, "R7");
  const envoi = decider({ ...faits, git: { depot: true, commits: true, remote: true, avance: 2 } });
  assert.deepStrictEqual([envoi.regle, envoi.prochaine], ["R16", "/pulse:deploy"]);
  assert.strictEqual(decider({ ...faits, git: { depot: true, commits: true, remote: false, avance: 2 } }).regle, "R20", "sans dépôt distant, rien à envoyer");
});

test("Git réel : un dépôt propre au projet, avec un commit, ne bloque pas", { skip: spawnSync("git", ["--version"]).error ? "git absent" : false }, () => {
  const dossier = projet();
  const git = (...args) => spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.org", ...args], { cwd: dossier, encoding: "utf8" });
  assert.strictEqual(git("init", "-q").status, 0);
  assert.strictEqual(git("commit", "-q", "--allow-empty", "-m", "init").status, 0);
  const r = spawnSync(process.execPath, [ETAT], { cwd: dossier, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^regle: R9$/m);
  const sansCommit = projet();
  spawnSync("git", ["init", "-q"], { cwd: sansCommit });
  assert.match(spawnSync(process.execPath, [ETAT], { cwd: sansCommit, encoding: "utf8" }).stdout, /^regle: R7$/m);
});

test("pulse-aidd etat relaie vers le script et figure dans l'aide", { skip: spawnSync("bash", ["--version"]).error ? "bash absent" : false }, () => {
  const outil = path.join(RACINE, "bin", "pulse-aidd").split(path.sep).join("/");
  const r = spawnSync("bash", [outil, "etat", "--sans-git"], { cwd: projet(), encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^prochaine: \/pulse:brainstorm$/m);
  assert.match(spawnSync("bash", [outil], { encoding: "utf8" }).stdout, /pulse-aidd etat /);
});

test("statut de tâche inconnu = à faire, plan sans tâche jamais terminé, décision vide sans « : » final", () => {
  const base = { ...AVANT_US, ...SPECS_VALIDEES, "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir-liste.md": PLAN("US-002", "- [x] **T1 – Afficher la page** · US-002") };
  const inconnu = etat(projet({ ...base, "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-001-creer-tache.md": PLAN("US-001", "- [x] **T2 – Créer** · US-001\n- [!] **T3 – Valider** · US-001") }, PILE_CHOISIE));
  assert.deepStrictEqual([inconnu.regle, inconnu.prochaine], ["R19", "/pulse:spirc US-001"]);
  const vide = etat(projet({ ...base, "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-001-creer-tache.md": PLAN("US-001", "(rien)") }, PILE_CHOISIE));
  assert.notStrictEqual(vide.regle, "R15");
  const attente = etat(projet({ "aidd_docs/tasks/in-progress.md": "" }));
  assert.strictEqual(attente.regle, "R1");
  assert.doesNotMatch(attente.raison, /:\s*$/);
});

const REVUES = "aidd_docs/tasks/gerer-taches/revues/PLAN-SPEC-US-002-voir-liste";
const EN_COURS = {
  ...AVANT_US,
  ...SPECS_VALIDEES,
  "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir-liste.md": PLAN("US-002", "- [x] **T1 – Afficher la page** · US-002\n- [~] **T2 – Voir la liste** · US-002"),
};

test("R13 seulement si la dernière relecture est validée ; sinon relire (R14) ou demander de l'aide", () => {
  const avec = (fichiers) => etat(projet({ ...EN_COURS, ...fichiers }, PILE_CHOISIE));
  const rapport = (nom) => `${REVUES}/${nom}.md`;
  const bloquant = avec({ [rapport("T2-2026-10-07")]: RAPPORT("⛔ Bloquant") });
  assert.deepStrictEqual([bloquant.regle, bloquant.prochaine], ["R14", "/pulse:review T2"]);
  assert.strictEqual(avec({ [rapport("T2-2026-10-07")]: RAPPORT("⚠️ À corriger") }).prochaine, "/pulse:review T2");
  assert.strictEqual(avec({ [rapport("T2-2026-10-07")]: RAPPORT("✅ Validé | ⚠️ À corriger | ⛔ Bloquant") }).prochaine, "/pulse:review T2", "modèle non rempli");
  assert.strictEqual(avec({ [rapport("T2-2026-10-07")]: "# Revue\n" }).prochaine, "/pulse:review T2", "rapport sans verdict");
  // le dernier rapport fait foi
  assert.strictEqual(avec({ [rapport("T2-2026-10-07")]: RAPPORT("⛔ Bloquant"), [rapport("T2-2026-10-08")]: RAPPORT("✅ Validé") }).regle, "R13");
  assert.strictEqual(avec({ [rapport("T2-2026-10-07")]: RAPPORT("✅ Validé"), [rapport("T2-2026-10-07-2")]: RAPPORT("⚠️ À corriger") }).prochaine, "/pulse:review T2");
  // test par la personne
  assert.strictEqual(avec({ [rapport("T2-2026-10-07")]: RAPPORT("✅ Validé", { test: "❌ non concluant" }) }).prochaine, "/pulse:review T2");
  assert.strictEqual(avec({ [rapport("T2-2026-10-07")]: RAPPORT("✅ Validé", { test: "⏳ reporté au test groupé de fin de plan (mode autonome)" }) }).regle, "R13");
  // bloquée après deux cycles
  const aide = avec({ [rapport("T2-2026-10-07")]: RAPPORT("⛔ Bloquant", { blocage: "persiste après 2 cycles : /pulse:get-help" }) });
  assert.deepStrictEqual([aide.regle, aide.prochaine], ["R14", "/pulse:get-help"]);
  assert.strictEqual(avec({ [rapport("T2-2026-10-07")]: RAPPORT("⛔ Bloquant", { blocage: "{{aucun | persiste après 2 cycles : /pulse:get-help}}" }) }).prochaine, "/pulse:review T2", "ligne du modèle non remplie");
});

test("projet existant : du code sans brief ni choix techniques, documenter l'existant (R8c) avant R9", () => {
  const codes = [{ "package.json": "{}" }, { "src/index.js": "x" }, { "app/page.tsx": "x" }, { "requirements.txt": "flask" }, { "composer.json": "{}" }, { Gemfile: "x" }, { "go.mod": "module x" }, { "Cargo.toml": "x" }, { "Api.csproj": "<Project/>" }, { "index.html": "<html>" }];
  for (const code of codes) {
    const r = etat(projet({ ...code, "aidd_docs/memory/project.md": "# {{NOM_DU_PROJET}}\n" }));
    assert.deepStrictEqual([r.regle, r.prochaine], ["R8c", "/pulse:tech"], Object.keys(code)[0]);
    assert.match(r.raison, /existant/);
  }
  // avec un brief ou des choix techniques, la suite normale s'applique
  assert.strictEqual(etat(projet({ "package.json": "{}", "docs/brief.md": "x" })).regle, "R10");
  assert.strictEqual(etat(projet({ "package.json": "{}", "docs/technical.md": "x" }, PILE_CHOISIE)).regle, "R10");
  assert.strictEqual(etat(projet()).regle, "R9");
});

test("modèle à mettre à niveau : une ligne « aussi », jamais un blocage du parcours", () => {
  const modele = (fichiers, options) => etat(projet(fichiers, options));
  const MAJ = "/pulse:init — mettre à niveau le projet (modèles et contrôles)";
  const ancien = modele({ "CLAUDE.md": CLAUDE().replace("Ce projet suit", "Projet AI-Driven : il suit") });
  assert.deepStrictEqual([ancien.regle, ancien.prochaine, ancien.fondation], ["R9", "/pulse:brainstorm", undefined]);
  assert.ok(ancien.aussi.includes(MAJ));
  const a = (fichiers) => modele(fichiers).aussi.includes(MAJ);
  assert.ok(a({ "CLAUDE.md": CLAUDE() + "\n- Commit et envoi vers le dépôt distant : uniquement sur demande.\n" }));
  assert.ok(a({ "CLAUDE.md": CLAUDE() + "\n- `aidd_docs/tasks/` : traces de travail par session.\n" }));
  assert.ok(a({ ".gitignore": ".env\n" }));
  assert.ok(!a({ ".gitignore": ".env\naidd_docs/tasks/in-progress.md\n" }));
  const crochet = { "scripts/verifier.js": "x", ".git/hooks/pre-commit": "#!/bin/sh\nexit 0\n" };
  assert.ok(a(crochet));
  assert.ok(!a({ ...crochet, ".git/hooks/pre-commit": "# pulse-aidd: contrôle des secrets\nexec node \"$secours/pulse/verifier.js\" --index\n" }), "crochet à jour");
  assert.ok(a({ ...crochet, ".git/hooks/pre-commit": "# pulse-aidd: contrôle des secrets\n[ -f scripts/verifier.js ] || exit 0\n" }), "ancien crochet, sans copie de secours");
  // /pulse:init remplace aussi cet ancien crochet (installer-hook réécrit un crochet de Pulse).
  assert.match(fs.readFileSync(path.join(RACINE, "skills", "init", "SKILL.md"), "utf8"), /ou crochet de Pulse sans `pulse\/verifier\.js` \(ancien modèle[^)]*\) → `pulse-aidd installer-hook`/);
  assert.ok(!a({ ...crochet, ".git/hooks/pre-commit": "#!/bin/sh\nnode scripts/verifier.js --index\n" }), "ligne ajoutée à la main");
  assert.ok(a({ "scripts/verifier.js": "x", ".git/hooks": "<dossier>" }), "crochet absent");
  assert.ok(!a({ ...crochet, ".git/config": "[core]\n\thooksPath = .husky\n" }), "Husky range ses contrôles ailleurs");
  assert.ok(!a({ "scripts/verifier.js": "x" }), "sans dépôt, pas de crochet à vérifier");
  // la décision en attente et les autres fondations gardent leur place
  assert.strictEqual(modele({ ".gitignore": ".env\n", "aidd_docs/tasks/in-progress.md": "" }).regle, "R1");
  assert.strictEqual(modele({ ".gitignore": ".env\n", "aidd_docs/memory/glossary.md": null }).regle, "R6");
});

test("R13 lit le verdict du rapport à jour, pas le résultat d'origine du verifier", () => {
  const r = (opts, verdict = "✅ Validé") => etat(projet({ ...EN_COURS, [`${REVUES}/T2-2026-10-07.md`]: RAPPORT(verdict, opts) }, PILE_CHOISIE));
  assert.strictEqual(r({ verif: "❌ Échoue" }).regle, "R13", "verifier d'origine ❌, contrôle ✅ : le Verdict en tête fait foi");
  assert.strictEqual(r({}, "⚠️ À corriger, accepté par la personne").regle, "R13");
  assert.strictEqual(r({ test: "❌ non concluant", retest: "✅ concluant" }).regle, "R13", "dernier Résultat");
  assert.strictEqual(r({ test: "✅ concluant", retest: "❌ non concluant" }).prochaine, "/pulse:review T2");
  assert.strictEqual(r({}, "⚠️ À corriger").prochaine, "/pulse:review T2");
  assert.strictEqual(r({}, "⛔ Bloquant, accepté par la personne").prochaine, "/pulse:review T2");
});

test("état illisible (R0) : demander de l'aide, sans reboucler sur /pulse:status", () => {
  const lignes = sortieIllisible("EACCES").split("\n");
  assert.deepStrictEqual(lignes.map((l) => l.split(":")[0]), ["prochaine", "raison", "regle"]);
  assert.strictEqual(lignes[0], "prochaine: /pulse:get-help");
  assert.match(lignes[1], /n'a pas pu être lu \(EACCES\)/);
  assert.strictEqual(lignes[2], "regle: R0");
});

test("etat signale une option inconnue, avec la liste des options", () => {
  const r = spawnSync(process.execPath, [ETAT, "--sans-gti"], { cwd: os.tmpdir(), encoding: "utf8" });
  assert.strictEqual(r.status, 2);
  assert.match(r.stdout, /option inconnue « --sans-gti »/);
  assert.match(r.stdout, /--sans-git, --aujourdhui AAAA-MM-JJ/);
});

test("lireOptions : --sans-git et --aujourdhui", () => {
  const { lireOptions } = require(ETAT);
  assert.deepStrictEqual(lireOptions(["--sans-git", "--aujourdhui", "2026-10-08"]), { git: false, aujourdhui: Date.parse("2026-10-08T00:00:00Z") });
  assert.strictEqual(lireOptions([]).git, true);
  assert.throws(() => lireOptions(["--aujourdhui", "demain"]), /« --aujourdhui » attend une date AAAA-MM-JJ, reçu « demain »/);
  assert.throws(() => lireOptions(["--aujourdhui"]), /« --aujourdhui » attend une date AAAA-MM-JJ/);
  for (const jour of ["2026-02-31", "2026-13-01", "2025-02-29"]) assert.throws(() => lireOptions(["--aujourdhui", jour]), new RegExp(`attend une date AAAA-MM-JJ, reçu « ${jour} »`), jour);
  assert.strictEqual(lireOptions(["--aujourdhui", "2028-02-29"]).aujourdhui, Date.parse("2028-02-29T00:00:00Z"));
  const r = spawnSync(process.execPath, [ETAT, "--aujourdhui", "2026-02-31"], { cwd: os.tmpdir(), encoding: "utf8" });
  assert.strictEqual(r.status, 2);
});

test("relecture validée sans le test de la personne : relire reprend au test (R14), jamais l'enregistrement", () => {
  const avec = (opts, verdict = "✅ Validé") => etat(projet({ ...EN_COURS, [`${REVUES}/T2-2026-10-07.md`]: RAPPORT(verdict, opts) }, PILE_CHOISIE));
  for (const test of [MODELE_TEST, "", "{{✅ concluant | ❌ non concluant}}"]) {
    const r = avec({ test });
    assert.deepStrictEqual([r.regle, r.prochaine], ["R14", "/pulse:review T2"], `test « ${test} »`);
    assert.match(r.raison, /votre test manuel/);
  }
  assert.strictEqual(avec({ test: MODELE_TEST }, "⚠️ À corriger, accepté par la personne").prochaine, "/pulse:review T2");
  assert.strictEqual(avec({ test: "non concluant" }).prochaine, "/pulse:review T2", "« non concluant » sans emoji");
  assert.strictEqual(avec({ test: "❌ non concluant, accepté par la personne" }).regle, "R13", "test non concluant accepté");
  assert.strictEqual(avec({ test: "✅ OK" }).regle, "R13");
});

test("pulse-aidd revue <Tn> : dernière relecture, rapport et où reprendre", () => {
  const PLAN_T2 = "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir-liste.md";
  const revue = (fichiers, id = "T2") => etat(projet({ ...EN_COURS, ...fichiers }, PILE_CHOISIE), "--revue", id);
  const sans = revue({});
  assert.deepStrictEqual([sans.tache, sans.statut, sans.plan, sans.etat, sans.rapport, sans.reprendre], ["T2", "en-cours", PLAN_T2, "absente", "aucun", "examen"]);
  const cas = [
    [RAPPORT("✅ Validé", { test: MODELE_TEST }), "a-tester", "test"],
    [RAPPORT("✅ Validé"), "validee", "commit"],
    [RAPPORT("✅ Validé", { test: "⏳ reporté au test groupé de fin de plan (mode autonome)" }), "validee", "commit"],
    [RAPPORT("⚠️ À corriger"), "a-corriger", "correction"],
    [RAPPORT("✅ Validé", { test: "❌ non concluant" }), "a-corriger", "correction"],
    [RAPPORT("⛔ Bloquant", { blocage: "persiste après 2 cycles : /pulse:get-help" }), "bloquee", "aide"],
  ];
  for (const [contenu, etatAttendu, reprendre] of cas) {
    const r = revue({ [`${REVUES}/T2-2026-10-07.md`]: contenu });
    assert.deepStrictEqual([r.etat, r.reprendre], [etatAttendu, reprendre], etatAttendu);
    assert.strictEqual(r.rapport, `${REVUES}/T2-2026-10-07.md`);
  }
  // le rapport le plus récent fait foi ; minuscules acceptées
  const deux = revue({ [`${REVUES}/T2-2026-10-07.md`]: RAPPORT("⚠️ À corriger"), [`${REVUES}/T2-2026-10-07-2.md`]: RAPPORT("✅ Validé", { test: MODELE_TEST }) }, "t2");
  assert.deepStrictEqual([deux.tache, deux.etat, deux.rapport], ["T2", "a-tester", `${REVUES}/T2-2026-10-07-2.md`]);
  // tâche inconnue ou absente : une réponse lisible, jamais une erreur
  const inconnue = revue({}, "T99");
  assert.deepStrictEqual([inconnue.tache, inconnue.etat, inconnue.reprendre], ["T99", "inconnue", "aucune"]);
  assert.strictEqual(etat(projet({}), "--revue").etat, "inconnue");
});

test("pulse-aidd revue relaie vers le script et figure dans l'aide", { skip: spawnSync("bash", ["--version"]).error ? "bash absent" : false }, () => {
  const outil = path.join(RACINE, "bin", "pulse-aidd").split(path.sep).join("/");
  const r = spawnSync("bash", [outil, "revue", "T1"], { cwd: projet(), encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^etat: inconnue$/m);
  const aide = spawnSync("bash", [outil], { encoding: "utf8" }).stdout;
  assert.match(aide, /pulse-aidd revue <Tn>/);
  assert.match(aide, /Ne sort jamais en erreur/, "la plage du sed suit l'en-tête allongé d'une ligne");
});

/** L'état de la relecture d'un rapport écrit tel quel (derniereRevue, sans lancer l'outil). */
function etatRapport(contenu) {
  const { derniereRevue } = require(ETAT);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-revue-"));
  fs.writeFileSync(path.join(d, "T2-2026-10-07.md"), contenu);
  return derniereRevue(d, "T2").etat;
}

test("test par la personne : seules les réponses positives valident ; les réponses proposées « Non, … » sont à corriger", () => {
  const cas = [
    ["Non, il y a un problème : le bouton ne réagit pas", "a-corriger"],
    ["Non, quelque chose ne va pas", "a-corriger"],
    ["❌ Non, il y a un problème", "a-corriger"],
    ["pas concluant", "a-corriger"],
    ["Non concluant", "a-corriger"],
    ["échec : le bouton ne marche pas", "a-corriger"],
    ["❌ non concluant, la personne n'a pas accepté", "a-corriger"],
    ["non concluant, accepté par la personne", "validee"],
    ["Oui, tout fonctionne", "validee"],
    ["concluant", "validee"],
    ["⏳ reporté au test groupé", "validee"],
    ["OK", "a-tester"],
  ];
  for (const [test, attendu] of cas) assert.strictEqual(etatRapport(RAPPORT("✅ Validé", { test })), attendu, test);
});

test("test par la personne : la dernière section « Test par la personne » fait foi, jusqu'au titre suivant", () => {
  const SECTION = (resultat) => `\n## Test par la personne\n\n- **Date** : 2026-10-08\n- **Résultat** : ${resultat}\n`;
  const CONTROLE = "\n## Relecture de contrôle\n\n- **Date** : 2026-10-08\n- **Verdict** : ✅ Validé\n";
  assert.strictEqual(etatRapport(RAPPORT("✅ Validé", { test: "❌ non concluant" }) + CONTROLE + SECTION("✅ concluant")), "validee", "deux sections, la seconde ✅");
  assert.strictEqual(etatRapport(RAPPORT("✅ Validé") + SECTION(MODELE_TEST)), "a-tester", "seconde section restée au modèle");
  assert.strictEqual(etatRapport(RAPPORT("✅ Validé", { test: "" }) + "\n## Relecture de contrôle\n\n- **Résultat** : ✅ Validé\n"), "a-tester", "un « Résultat » d'une autre section ne vaut pas test");
  assert.strictEqual(etatRapport(RAPPORT("✅ Validé", { test: "❌ non concluant" }) + CONTROLE), "a-tester", "test ❌, correction relue : le test est à refaire");
});

test("test par la personne : « **Résultat :** », puces « * » et « é » décomposé sont lus", () => {
  const avec = (ligne) => etatRapport(RAPPORT("✅ Validé", { test: "x" }).replace("- **Résultat** : x", ligne));
  assert.strictEqual(avec("- **Résultat :** ✅ concluant"), "validee");
  assert.strictEqual(avec("* **Résultat** : ✅ concluant"), "validee");
  assert.strictEqual(avec("- **Résultat** : ❌ non concluant"), "a-corriger");
});

test("pulse-aidd revue T2 T3 : un bloc par tâche", () => {
  const r = spawnSync(process.execPath, [ETAT, "--revue", "T2", "T99"], { cwd: projet({ ...EN_COURS }, PILE_CHOISIE), encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stdout);
  const blocs = r.stdout.trim().split("\n\n");
  assert.strictEqual(blocs.length, 2);
  assert.match(blocs[0], /^tache: T2$[\s\S]*^reprendre: examen$/m);
  assert.match(blocs[1], /^tache: T99$[\s\S]*^etat: inconnue$/m);
});

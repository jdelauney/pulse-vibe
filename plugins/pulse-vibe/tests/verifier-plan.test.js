// Tests de `pulse-aidd verifier-plan <US-XXX>` (scripts/verifier-plan.js) : le plan confronté à son US, sa spec et aux autres plans.
// Lancer : node --test plugins/pulse-vibe/tests/verifier-plan.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "verifier-plan.js");
const { verifierPlan, ecartsTache, criteresCites, fichiersDeTache, horsFichier } = require(SCRIPT);

const DOSSIER = "aidd_docs/tasks/gerer-taches";

const US = `# US-002 – Voir la liste

**Priorité** : Indispensable · **Taille** : S · **Dépend de** : —

## Critères d'acceptation

1. **Cas nominal** – **Étant donné** deux tâches, **lorsque** j'ouvre la liste, **alors** je les vois.
2. **Cas limite** – **Étant donné** aucune tâche, **lorsque** j'ouvre la liste, **alors** je lis « Aucune tâche ».

## Hors périmètre de cette US

- rien à signaler
`;

const SPEC = (extra = "") => `# Spec – US-002 Voir la liste

**Statut** : verrouillée le 2026-10-10

## 6. Scénarios

\`\`\`gherkin
@US-002-1 @integration
Exemple: Deux tâches enregistrées apparaissent dans la liste
  Étant donné deux tâches
\`\`\`

\`\`\`gherkin
@US-002-2 @manuel
Exemple: Liste vide
  Étant donné aucune tâche
\`\`\`
${extra}`;

const TACHE = (id, { titre = "Voir la liste", depend = "—", fichiers = "à créer : `src/liste.js`", verification = "US-002 critère 1 – ouvrir la liste", tests = "US-002-1 (intégration)", statut = " ", recette = "" } = {}) => `- [${statut}] **${id} – ${titre}** · US-002
  - Objectif : voir mes tâches
  - Dépend de : ${depend}
  - Fichiers : ${fichiers}
  - Vérification : ${verification}
  - Tests : ${tests}
${recette ? `  - Recette : ${recette}\n` : ""}`;

const CAS_OK = "| liste vide | le message « Aucune tâche pour l'instant » | T1 | @manuel |";
const PLAN = (taches, statut = "validé le 2026-10-11", cas = CAS_OK) => `# Plan – TodoIt – US-002 Voir la liste

## Vue d'ensemble

- **US** : US-002 – Voir la liste · **Groupe** : Gérer · **Priorité** : Indispensable
- **Statut** : ${statut}

## Conception technique

### Arbitrages

- **Ce que ce changement peut casser** : rien d'existant n'est touché
- **Autre façon envisagée** : une liste en mémoire, écartée car elle se perd au rechargement
${cas === null ? "" : `
### Cas limites et états à couvrir

| Cas | Ce que vit la personne | Tâche | Preuve |
|---|---|---|---|
${cas}
`}
## Tâches

> US terminée quand : je vois mes tâches.

${taches.join("\n")}
## Journal

| Date | Tâche | Commit | Remarque |
|---|---|---|---|
`;

const REFERENTIEL = `# User stories

| US | Titre | Priorité |
|---|---|---|
| US-001 | Créer | Indispensable |
| US-002 | Voir la liste | Indispensable |

## Ordre de réalisation

US-001 → US-002
`;

function projet(fichiers) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-plan-"));
  const tous = { "docs/user-stories.md": REFERENTIEL, [`${DOSSIER}/US-002-voir-liste.md`]: US, [`${DOSSIER}/SPEC-US-002-voir-liste.md`]: SPEC(), ...fichiers };
  for (const [f, contenu] of Object.entries(tous)) {
    if (contenu === null) continue;
    fs.mkdirSync(path.dirname(path.join(racine, f)), { recursive: true });
    fs.writeFileSync(path.join(racine, f), contenu);
  }
  return racine;
}
const planFichier = `${DOSSIER}/PLAN-SPEC-US-002-voir-liste.md`;
const constats = (racine) => verifierPlan(racine, "US-002").constats.map((c) => `${c.gravite} · ${c.ou} · ${c.message}`);
const MISE_EN_LIGNE = "- [ ] **T3 – Mettre en ligne la première version** · —\n  - Dépend de : toutes les tâches des US Indispensables\n  - Vérification : l'adresse s'ouvre\n";

test("un plan complet et cohérent : aucun constat", () => {
  const racine = projet({
    [planFichier]: PLAN([TACHE("T1"), TACHE("T2", { titre: "Liste vide", depend: "T1", fichiers: "à modifier : `src/liste.js`", verification: "US-002 critère 2", tests: "aucun" }), MISE_EN_LIGNE]),
  });
  assert.deepStrictEqual(constats(racine), []);
  const r = verifierPlan(racine, "us-2");
  assert.strictEqual(r.statut, "validé");
  assert.strictEqual(r.taches, 3);
});

test("critère d'acceptation sans tâche, scénario automatisé sans ligne Tests : à corriger", () => {
  const racine = projet({ [planFichier]: PLAN([TACHE("T1", { tests: "aucun" }), MISE_EN_LIGNE]) });
  const c = constats(racine);
  assert.ok(c.some((l) => /^à corriger · vérification · le critère 2 de US-002/.test(l)), c.join("\n"));
  assert.ok(c.some((l) => /^à corriger · tests · le scénario US-002-1/.test(l)), c.join("\n"));
  // Le scénario @manuel n'attend pas de test automatique.
  assert.ok(!c.some((l) => /US-002-2/.test(l)));
});

test("un scénario cité par son titre, sans étiquette, compte", () => {
  const racine = projet({
    [planFichier]: PLAN([TACHE("T1", { verification: "US-002 critères 1 et 2", tests: "« Deux tâches enregistrées apparaissent dans la liste » (intégration)" }), MISE_EN_LIGNE]),
  });
  assert.deepStrictEqual(constats(racine), []);
});

test("dépendance inconnue, boucle et dépendance sur soi-même : à corriger", () => {
  const racine = projet({
    [planFichier]: PLAN([TACHE("T1", { depend: "T2", verification: "US-002 critères 1 à 2" }), TACHE("T2", { depend: "T1, T9", fichiers: "—" }), TACHE("T4", { depend: "T4", fichiers: "—" }), MISE_EN_LIGNE]),
  });
  const c = constats(racine);
  assert.ok(c.some((l) => /T2 · dépend de T9, qui n'existe dans aucun plan/.test(l)), c.join("\n"));
  assert.ok(c.some((l) => /dépendances tournent en rond : T1 → T2 → T1/.test(l)), c.join("\n"));
  assert.ok(c.some((l) => /T4 · la tâche dépend d'elle-même/.test(l)), c.join("\n"));
});

test("spec en brouillon et champ du modèle resté à remplir : à corriger", () => {
  const racine = projet({
    [`${DOSSIER}/SPEC-US-002-voir-liste.md`]: SPEC("\n- TBD: la liste se trie-t-elle par date ?\n"),
    [planFichier]: PLAN([TACHE("T1", { verification: "US-002 critères 1, 2", fichiers: "à créer : {{…}}" }), MISE_EN_LIGNE]),
  });
  const c = constats(racine);
  assert.ok(c.some((l) => /^à corriger · spec · la spec est encore en brouillon/.test(l)), c.join("\n"));
  assert.ok(c.some((l) => /^à corriger · plan · 1 ligne\(s\) encore au modèle/.test(l)), c.join("\n"));
});

test("fichiers : à modifier absent, à créer déjà présent, plus de 3 fichiers : avertissements", () => {
  const racine = projet({
    "src/existe.js": "",
    [planFichier]: PLAN([
      TACHE("T1", { verification: "US-002 critères 1 et 2", fichiers: "à créer : `src/existe.js`, `src/a.js`, `src/b.js` · à modifier : `src/absent.js`" }),
      MISE_EN_LIGNE,
    ]),
  });
  const c = constats(racine);
  assert.ok(c.some((l) => /^avertissement · T1 · « src\/absent\.js » est à modifier/.test(l)), c.join("\n"));
  assert.ok(c.some((l) => /^avertissement · T1 · « src\/existe\.js » est à créer, mais il existe déjà/.test(l)), c.join("\n"));
  assert.ok(c.some((l) => /^avertissement · T1 · 4 fichiers/.test(l)), c.join("\n"));
  // Une tâche terminée a créé ses fichiers : rien à signaler.
  const fait = projet({ "src/liste.js": "", [planFichier]: PLAN([TACHE("T1", { statut: "x", verification: "US-002 critères 1 et 2" }), MISE_EN_LIGNE]) });
  assert.deepStrictEqual(constats(fait), []);
});

test("fichiers : une tâche « Recette : » garde son découpage, une tâche ordinaire de 4 fichiers est signalée", () => {
  const huit = Array.from({ length: 8 }, (_, i) => `\`src/f${i}.js\``).join(", ");
  const quatre = Array.from({ length: 4 }, (_, i) => `\`src/g${i}.js\``).join(", ");
  const racine = projet({
    [planFichier]: PLAN([
      TACHE("T1", { titre: "Recette : liste des factures", verification: "US-002 critère 1", fichiers: `à créer : ${huit}` }),
      TACHE("T2", { titre: "Voir le détail", depend: "T1", verification: "US-002 critère 2", fichiers: `à créer : ${quatre}` }),
      MISE_EN_LIGNE,
    ]),
  });
  const c = constats(racine);
  assert.ok(!c.some((l) => /^avertissement · T1 · \d+ fichiers/.test(l)), c.join("\n"));
  assert.ok(c.some((l) => /^avertissement · T2 · 4 fichiers/.test(l)), c.join("\n"));
});

test("fichiers : une tâche au titre descriptif et à la ligne « Recette : <nom> » garde aussi son découpage", () => {
  const dix = Array.from({ length: 10 }, (_, i) => `\`src/h${i}.js\``).join(", ");
  const racine = projet({
    [planFichier]: PLAN([TACHE("T1", { titre: "Règles des factures et aides génériques", verification: "US-002 critère 1", fichiers: `à créer : ${dix}`, recette: "liste" }), MISE_EN_LIGNE]),
  });
  const c = constats(racine);
  assert.ok(!c.some((l) => /^avertissement · T1 · \d+ fichiers/.test(l)), c.join("\n"));
});

test("fichiers : une tâche « Entité : » (générateur d'un pack) garde son découpage, par son titre ou par sa ligne", () => {
  const huit = Array.from({ length: 8 }, (_, i) => `\`src/e${i}.ts\``).join(", ");
  const parLigne = `${TACHE("T2", { titre: "Gérer les clients", depend: "T1", verification: "US-002 critère 2", fichiers: `à créer : ${huit}` })}  - Entité : client\n`;
  const racine = projet({
    [planFichier]: PLAN([
      TACHE("T1", { titre: "Entité : facture", verification: "US-002 critère 1", fichiers: `à créer : ${huit}` }),
      parLigne,
      TACHE("T3", { titre: "Voir le détail", depend: "T2", verification: "US-002 critère 1", fichiers: `à créer : ${huit}` }),
      MISE_EN_LIGNE,
    ]),
  });
  const c = constats(racine);
  assert.ok(!c.some((l) => /^avertissement · T[12] · \d+ fichiers/.test(l)), c.join("\n"));
  assert.ok(c.some((l) => /^avertissement · T3 · 8 fichiers/.test(l)), c.join("\n"));
});

test("un fichier à modifier créé par une autre tâche, dans ce plan ou un autre, ne déclenche rien", () => {
  const racine = projet({
    [planFichier]: PLAN([TACHE("T1"), TACHE("T2", { depend: "T1", fichiers: "à modifier : `src/liste.js`", verification: "US-002 critère 2", tests: "aucun" }), MISE_EN_LIGNE]),
  });
  assert.ok(!constats(racine).some((l) => /src\/liste\.js/.test(l)));
});

test("mise en ligne : seulement dans le plan de la dernière US Indispensable du parcours", () => {
  const referentiel = REFERENTIEL.replace("US-001 → US-002", "US-002 → US-001");
  const ailleurs = projet({ "docs/user-stories.md": referentiel, [planFichier]: PLAN([TACHE("T1", { verification: "US-002 critères 1, 2" }), MISE_EN_LIGNE]) });
  assert.ok(constats(ailleurs).some((l) => /^à corriger · T3 · la mise en ligne va dans le plan de US-001/.test(l)));
  const manquante = projet({ [planFichier]: PLAN([TACHE("T1", { verification: "US-002 critères 1, 2" })]) });
  assert.ok(constats(manquante).some((l) => /^avertissement · plan · US-002 est la dernière US Indispensable/.test(l)));
});

test("plus de 4 tâches (hors mise en place et mise en ligne) : avertissement", () => {
  const taches = ["T1", "T2", "T3", "T4", "T5"].map((id, i) => TACHE(id, { depend: i ? `T${i}` : "—", fichiers: "—", verification: "US-002 critères 1, 2" }));
  const racine = projet({ [planFichier]: PLAN([TACHE("T0", { titre: "Mise en place du squelette", fichiers: "—", tests: "aucun" }), ...taches]) });
  assert.ok(constats(racine).some((l) => /^avertissement · plan · 5 tâches/.test(l)));
});

test("rythme rapide : seuls les scénarios d'intégration et de sécurité attendent leur ligne Tests", () => {
  const spec = SPEC("\n```gherkin\n@US-002-3 @unitaire\nExemple: Le compteur affiche deux\n```\n");
  const fichiers = { [`${DOSSIER}/SPEC-US-002-voir-liste.md`]: spec, [planFichier]: PLAN([TACHE("T1", { verification: "US-002 critères 1, 2", tests: "US-002-1 (intégration)" }), MISE_EN_LIGNE]) };
  const complet = projet(fichiers);
  assert.ok(constats(complet).some((l) => /Le compteur affiche deux/.test(l)));
  const rapide = projet({ ...fichiers, "CLAUDE.md": "- **Rythme** : rapide\n" });
  assert.ok(!constats(rapide).some((l) => /Le compteur affiche deux/.test(l)));
});

test("statut « à valider » lu dans la vue d'ensemble", () => {
  const racine = projet({ [planFichier]: PLAN([TACHE("T1", { verification: "US-002 critères 1, 2" }), MISE_EN_LIGNE], "à valider") });
  assert.strictEqual(verifierPlan(racine, "US-002").statut, "à valider");
});

test("lecture des critères cités et des fichiers d'une tâche", () => {
  assert.deepStrictEqual([...criteresCites("US-002 critères 1 à 3 ; US-001 critère 4", "US-002")], [1, 2, 3]);
  assert.deepStrictEqual([...criteresCites("critère 2 et US-002-4", "US-002")].sort(), [2, 4]);
  assert.deepStrictEqual(fichiersDeTache("à créer : `a/b.js`, `c.css` · à modifier : d/e.ts"), { creer: ["a/b.js", "c.css"], modifier: ["d/e.ts"] });
});

test("en ligne de commande : lignes clé: valeur, bilan, plan introuvable, argument manquant", () => {
  const racine = projet({ [planFichier]: PLAN([TACHE("T1", { tests: "aucun" }), MISE_EN_LIGNE]) });
  const lancer = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: racine, encoding: "utf8" });
  const r = lancer("US-002");
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /^plan: aidd_docs\/tasks\/gerer-taches\/PLAN-SPEC-US-002-voir-liste\.md$/m);
  assert.match(r.stdout, /^a-corriger: 2$/m);
  assert.match(r.stdout, /^bilan: à corriger$/m);
  assert.match(lancer("US-009").stdout, /^bilan: introuvable$/m);
  const vide = lancer();
  assert.strictEqual(vide.status, 0);
  assert.match(vide.stdout, /^erreur: indiquez l'US/m);
});

test("sections « Questions en attente » et « Choix faits par Pulse » et sous-ligne « En pause » : aucun constat nouveau", () => {
  const pause = TACHE("T2", { titre: "Liste vide", depend: "T1", fichiers: "à modifier : `src/liste.js`", verification: "US-002 critère 2", tests: "aucun" }) + "  - En pause : Q1 (votre décision)\n";
  const sections = "## Questions en attente\n\n- [ ] Q1 · T2 · Garder les terminées ? · Options : oui / non · Recommandé : oui\n\n## Choix faits par Pulse\n\n- T2 · tri par date · Autre possibilité : par nom · Raison : simple\n\n";
  const plan = PLAN([TACHE("T1"), pause, MISE_EN_LIGNE]).replace("## Journal", `${sections}## Journal`);
  const racine = projet({ [planFichier]: plan });
  assert.deepStrictEqual(constats(racine), []);
  assert.strictEqual(verifierPlan(racine, "US-002").taches, 3);
});

test("cas limites : section absente en avertissement ; cas sans ce que vit la personne, sans preuve ou hors du plan à corriger", () => {
  const sans = projet({ [planFichier]: PLAN([TACHE("T1"), TACHE("T2", { titre: "Liste vide", depend: "T1", fichiers: "à modifier : `src/liste.js`", verification: "US-002 critère 2", tests: "aucun" }), MISE_EN_LIGNE], undefined, null) });
  assert.deepStrictEqual(constats(sans), ["avertissement · cas limites · la section « Cas limites et états à couvrir » manque à la conception technique (référence tests/cas-limites.md)"]);
  const cas = ["| double clic sur Ajouter | une seule tâche ajoutée | T2 | |", "| coupure du réseau | | T9 | @manuel |"].join("\n");
  const faux = projet({ [planFichier]: PLAN([TACHE("T1"), TACHE("T2", { titre: "Liste vide", depend: "T1", fichiers: "à modifier : `src/liste.js`", verification: "US-002 critère 2", tests: "aucun" }), MISE_EN_LIGNE], undefined, cas) });
  assert.deepStrictEqual(constats(faux), [
    "à corriger · cas limites · le cas « double clic sur Ajouter » n'a pas de preuve (test ou @manuel)",
    "à corriger · cas limites · le cas « coupure du réseau » ne dit pas ce que vit la personne",
    "à corriger · cas limites · le cas « coupure du réseau » est rattaché à T9, absente de ce plan",
  ]);
});

test("arbitrages : un plan sans « Ce que ce changement peut casser » reçoit un avertissement", () => {
  const sans = PLAN([TACHE("T1")]).replace(/### Arbitrages[\s\S]*?(?=\n### |\n## )/, "");
  const d = projet({ [planFichier]: sans });
  assert.ok(constats(d).some((c) => c.startsWith("avertissement · conception ·")), constats(d).join("\n"));
});

test("après la tâche (--apres) : fichier modifié non prévu, fichier prévu intact ; tests et documents laissés de côté", () => {
  const d = projet({ [planFichier]: PLAN([TACHE("T1", { fichiers: "à créer : `src/liste.js` · à modifier : `src/menu.js`" })]) });
  const r = ecartsTache(d, "US-002", "t1", ["src/liste.js", "src/autre.js", "src/__tests__/liste.test.js", "docs/technical.md", "aidd_docs/tasks/x.md", "package-lock.json"]);
  assert.deepStrictEqual(r.prevus, ["src/liste.js", "src/menu.js"]);
  assert.deepStrictEqual(r.modifies, ["src/liste.js", "src/autre.js"]);
  assert.deepStrictEqual(r.constats.map((c) => c.message), ["« src/autre.js » est modifié, mais n'est pas dans la ligne « Fichiers » de la tâche", "« src/menu.js » est prévu dans la ligne « Fichiers », mais n'a pas changé"]);
  assert.ok(r.constats.every((c) => c.gravite === "avertissement" && c.ou === "T1"));
  const dossier = projet({ [planFichier]: PLAN([TACHE("T1", { fichiers: "à créer : `src/liste.js`, `__tests__/`, `src/__tests__/liste.test.js`" })]) });
  assert.deepStrictEqual(ecartsTache(dossier, "US-002", "T1", ["src/liste.js"]).constats, [], "dossier cité et test prévu : pas d'avertissement");
  assert.strictEqual(ecartsTache(d, "US-002", "T9", []).introuvable, true);
  assert.strictEqual(ecartsTache(d, "US-009", "T1", []), null);
  const sortie = spawnSync(process.execPath, [SCRIPT, "US-002"], { cwd: d, encoding: "utf8" }).stdout;
  assert.doesNotMatch(sortie, /--apres/);
  assert.match(spawnSync(process.execPath, [SCRIPT, "US-002", "--apres", "x"], { cwd: d, encoding: "utf8" }).stdout, /^erreur: indiquez l'US et la tâche/);
});

test("--apres : les fichiers spéciaux que pose le bac à sable de Claude Code ne comptent pas comme modifiés", { skip: process.platform === "win32" && "pas de fichier spécial sous Windows" }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-hors-fichier-"));
  fs.writeFileSync(path.join(d, "vrai.js"), "x");
  spawnSync("mkfifo", [path.join(d, ".zshrc")]);
  assert.strictEqual(horsFichier(path.join(d, "vrai.js")), false);
  assert.strictEqual(horsFichier(path.join(d, ".zshrc")), true, "fichier spécial");
  assert.strictEqual(horsFichier(path.join(d, "supprime.js")), false, "un fichier supprimé reste compté");
  fs.rmSync(d, { recursive: true, force: true });
});

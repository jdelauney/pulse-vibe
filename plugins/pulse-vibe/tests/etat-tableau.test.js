// Tests de `pulse-aidd etat --tableau` (scripts/etat-tableau.js) : le tableau de bord de /pulse:status calculé à partir
// des fichiers et de Git, et les signaux de suivi du référencement appliqués par `decider` (même verdict pour init et status).
// Lancer : node --test plugins/pulse-vibe/tests/etat-tableau.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const ETAT = path.join(RACINE, "scripts", "etat.js");
const { lireFaits, decider, lireOptions } = require(ETAT);
const { lireSuivi } = require(path.join(RACINE, "scripts", "etat-tableau.js"));
const SANS_GIT = spawnSync("git", ["--version"]).error ? "git absent" : false;
const SESSIONS = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-tableau-sessions-"));

const CLAUDE = ({ site = "{{à compléter}}", rythme = "complet" } = {}) => `# TodoIt

## Résumé du projet

Ce projet suit la **méthode Pulse** (plugin \`pulse\`).

### Adresses

- Dépôt distant : aucun pour l'instant
- Site en ligne : ${site}

## Stack technique

<!-- pulse_pile:debut -->

- **Pile** : HTML et JavaScript
<!-- pulse_pile:fin -->

<!-- pulse_memoire:debut -->
<!-- pulse_memoire:fin -->

<!-- pulse_profil:debut -->
- **Niveau** : Jamais programmé
- **Explications** : normales
- **Rythme** : ${rythme}
<!-- pulse_profil:fin -->
`;

const REFERENTIEL = `# User stories – TodoIt

| ID | Titre | Acteur | Priorité | Taille | Dépend de | Fichier |
|---|---|---|---|---|---|---|
| US-001 | Créer une tâche | membre | Indispensable | S | — | — |
| US-002 | Voir la liste | membre | Indispensable | S | — | — |
| US-003 | Exporter | membre | Essentiel | S | — | — |
`;

const SPEC = (statut) => `# Spécification – US-001\n\n**Statut** : ${statut}\n`;
const PLAN = (id, taches, { envoi = "branche principale", parallele = "aucune" } = {}) => `# Plan – TodoIt – ${id} Titre

## Vue d'ensemble

- **US** : ${id} – Titre · **Groupe** : Gérer les tâches · **Priorité** : Indispensable
- **Envoi** : ${envoi}
- **En parallèle avec** : ${parallele}

## Tâches

${taches}

## Journal
`;

const SEO_SUIVI = (lignes, rendezVous) => `# Référencement

## Suivi

| Date | Quoi | Résultat |
|---|---|---|
${lignes}

**Tests manuels auprès des assistants** (5 questions de clients, à 1 et 3 mois) :

| Date | Question | Assistant | Cité ? |
|---|---|---|---|
| | | | |

**Prochain rendez-vous** : ${rendezVous} – lire Search Console (Pages, Performance), puis \`/pulse:seo audit\`.
`;
const SUIVI_MODELE = "| {{DATE}} | Search Console : propriété {{Domaine / Préfixe d'URL}} | {{validée}} |\n| | Sitemap soumis | {{Réussite}} |";
const SUIVI_FAIT = "| 2026-09-01 | Search Console : propriété Domaine, vérification par DNS | validée |\n| | Sitemap soumis | Réussite |";
const TECHNIQUE = (searchConsole) => `# Technique

## Hébergement et mise en ligne

- Site en ligne : https://todoit.example.org
${searchConsole === null ? "" : `
## Référencement

- Search Console : ${searchConsole}
- Rapports : \`docs/referencement/\` ; prochain conseillé : 2026-10-01
`}`;
const PRD = (trouve) => `# PRD\n\n- **Être trouvé** : ${trouve}\n`;

function projet(fichiers = {}, options = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-tableau-"));
  const tous = {
    "CLAUDE.md": CLAUDE(options),
    "aidd_docs/memory/project.md": "# Projet\n",
    "aidd_docs/memory/technical.md": "# Technique\n",
    "aidd_docs/memory/glossary.md": "# Glossaire\n",
    ".claude/settings.json": '{ "permissions": { "deny": ["Read(./.env)"], "allow": ["Bash(git commit -m *)", "Bash(pulse-aidd qualite *)"] } }\n',
    "docs/brief.md": "# Brief\n",
    "docs/prd.md": PRD("sur Google, par les familles du quartier"),
    "docs/technical.md": TECHNIQUE(null),
    "docs/design.md": "# Design\n",
    "docs/user-stories.md": REFERENTIEL,
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

/** Lance l'outil ; une clé répétée donne une liste. */
function tableau(dossier, ...args) {
  const r = spawnSync(process.execPath, [ETAT, "--aujourdhui", "2026-10-08", ...args], {
    cwd: dossier,
    encoding: "utf8",
    env: { ...process.env, PULSE_SESSIONS_DIR: SESSIONS },
  });
  assert.strictEqual(r.status, 0, r.stderr);
  const sortie = { brut: r.stdout };
  for (const ligne of r.stdout.trim().split("\n")) {
    const m = /^([a-z-]+): (.*)$/.exec(ligne);
    assert.ok(m, `ligne inattendue : ${ligne}`);
    if (m[1] in sortie) sortie[m[1]] = [].concat(sortie[m[1]], m[2]);
    else sortie[m[1]] = m[2];
  }
  return sortie;
}
const liste = (v) => (v === undefined ? [] : [].concat(v));

const TERMINE = {
  "aidd_docs/tasks/gerer-taches/SPEC-US-001-creer.md": SPEC("verrouillée le 2026-09-01"),
  "aidd_docs/tasks/gerer-taches/SPEC-US-002-voir.md": SPEC("verrouillée le 2026-09-01"),
  "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-001-creer.md": PLAN("US-001", "- [x] **T1 – Créer** · US-001"),
  "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir.md": PLAN("US-002", "- [x] **T2 – Voir** · US-002\n- [x] **T3 – Mettre en ligne la première version** · —"),
  "aidd_docs/tasks/exporter/SPEC-US-003-exporter.md": SPEC("verrouillée le 2026-09-01"),
  "aidd_docs/tasks/exporter/PLAN-SPEC-US-003-exporter.md": PLAN("US-003", "- [x] **T4 – Exporter** · US-003"),
  "docs/securite.md": "# Sécurité\n",
};
const EN_LIGNE = { site: "https://todoit.example.org" };

test("sans --tableau : la sortie d'init, sans les lignes du tableau", () => {
  const s = tableau(projet(), "--sans-git");
  assert.ok(s.prochaine && s.etapes);
  for (const cle of ["projet", "pile", "groupe", "tache", "memoire", "referencement"]) assert.ok(!(cle in s), `${cle} absent sans --tableau`);
});

test("lireOptions : --tableau", () => {
  assert.strictEqual(lireOptions(["--tableau"]).tableau, true);
  assert.strictEqual(lireOptions([]).tableau, undefined);
});

test("--tableau : projet, pile, rythme, groupes, tâches, plans, CI, en ligne, revue, sécurité, mémoire", () => {
  const revues = "aidd_docs/tasks/gerer-taches/revues/PLAN-SPEC-US-002-voir";
  const d = projet(
    {
      "aidd_docs/tasks/gerer-taches/US-001-creer.md": "# US-001\n",
      "aidd_docs/tasks/gerer-taches/SPEC-US-001-creer.md": SPEC("verrouillée le 2026-09-01"),
      "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-001-creer.md": PLAN("US-001", "- [x] **T1 – Créer une tâche** · US-001", { envoi: "version parallèle (branche et demande de fusion)", parallele: "US-002, US-003 (aucun fichier en commun)" }),
      "aidd_docs/tasks/gerer-taches/SPEC-US-002-voir.md": SPEC("brouillon"),
      "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir.md":
        PLAN("US-002", "- [~] **T2 – Voir la liste** · US-002\n  - En pause : Q1 (votre décision)\n- [ ] **T3 – Trier** · US-002").replace("- **Envoi**", "**Statut** : à valider\n- **Envoi**"),
      [`${revues}/T2-2026-10-01.md`]: "# Revue\n\n**Verdict** : ❌ À reprendre\n",
      [`${revues}/T2-2026-10-05-2.md`]: "# Revue\n\n**Verdict** : ✅ Validé\n\n## Test par la personne\n\n- **Résultat** : ✅ concluant\n",
      "docs/design/maquettes/US-001-creer/retenue/": "<dossier>",
      ".github/workflows/verifications.yml": "on: push\n",
      "docs/securite.md": "# Audit de sécurité – TodoIt – 2026-09-30\n",
      "aidd_docs/memory/glossary.md": "# Glossaire\n\n<!-- **Mot** :\nexemple -->\n\n**Tâche** :\nUne chose à faire.\n\n**Liste** :\nToutes les tâches.\n",
      "aidd_docs/memory/internal/decisions/2026-09-01-stockage.md": "# Décision\n",
    },
    EN_LIGNE,
  );
  const s = tableau(d, "--sans-git", "--tableau");
  assert.strictEqual(s.projet, "TodoIt");
  assert.strictEqual(s.pile, "- **Pile** : HTML et JavaScript");
  assert.strictEqual(s.rythme, "complet");
  assert.deepStrictEqual(liste(s.groupe), [
    "gerer-taches | US-001 spec=verrouillee plan=valide maquette=oui | US-002 spec=brouillon plan=a-valider maquette=non",
    "sans-dossier | US-003 spec=absente plan=absent maquette=non",
  ]);
  assert.deepStrictEqual(liste(s.tache), ["US-001 T1 terminee Créer une tâche", "US-002 T2 en-cours en-pause Voir la liste", "US-002 T3 a-faire Trier"]);
  assert.deepStrictEqual(liste(s.plan), ["US-001 envoi=version parallèle parallele=US-002,US-003 titre=Titre", "US-002 envoi=branche principale parallele=aucune titre=Titre"]);
  assert.strictEqual(s.ci, "github fichier=.github/workflows/verifications.yml");
  assert.strictEqual(s["en-ligne"], "https://todoit.example.org");
  assert.strictEqual(s.revue, `T2 etat=validee date=2026-10-05 fichier=${revues}/T2-2026-10-05-2.md`);
  assert.strictEqual(s.securite, "2026-09-30");
  assert.strictEqual(s.memoire, "bloc=oui glossaire=2 decisions=1");
  assert.strictEqual(s.referencement, "relie=non rapport=aucun prochain=aucun");
  assert.strictEqual(s["seo-suivi"], "non rendez-vous=aucun");
  assert.strictEqual(s.sessions, "0");
  assert.ok(!("git" in s), "--sans-git : pas de ligne git");
});

test("--tableau : valeurs par défaut d'un projet sans plan, sans CI, hors ligne", () => {
  const d = projet({ "docs/securite.md": null, "aidd_docs/memory/glossary.md": "# Glossaire\n\n<!-- **Mot** :\nDéfinition -->\n" }, { rythme: "à choisir" });
  fs.writeFileSync(path.join(d, "CLAUDE.md"), CLAUDE({ rythme: "à choisir" }).replace(/<!-- pulse_pile:debut -->[\s\S]*<!-- pulse_pile:fin -->/, "<!-- pulse_pile:debut -->\nPile non choisie : lancer `/pulse:tech`.\n<!-- pulse_pile:fin -->"));
  const s = tableau(d, "--sans-git", "--tableau");
  assert.strictEqual(s.pile, "non choisie");
  assert.strictEqual(s.rythme, "à choisir");
  assert.strictEqual(s.ci, "aucune");
  assert.strictEqual(s["en-ligne"], "non");
  assert.strictEqual(s.revue, "aucune");
  assert.strictEqual(s.securite, "absent");
  assert.strictEqual(s.memoire, "bloc=oui glossaire=0 decisions=0");
  assert.deepStrictEqual(liste(s.groupe), ["sans-dossier | US-001 spec=absente plan=absent maquette=non | US-002 spec=absente plan=absent maquette=non | US-003 spec=absente plan=absent maquette=non"]);
  assert.deepStrictEqual(liste(s.tache), []);
});

test("--tableau : référencement relié, dernier rapport et prochain conseillé ; suivi SEO noté et rendez-vous", () => {
  const d = projet({
    "docs/technical.md": TECHNIQUE("`sc-domain:todoit.example.org` – DNS – vérifiée le 2026-09-02"),
    "docs/referencement/search-console-2026-09-03.md": "# Rapport\n\n_Prochain rapport conseillé : à partir du 2026-10-01._\n",
    "docs/referencement/search-console-2026-09-20.md": "# Rapport\n\n_Prochain rapport conseillé : à partir du 2026-10-18._\n",
    "docs/seo.md": SEO_SUIVI(SUIVI_FAIT, "2026-12-01"),
  }, EN_LIGNE);
  const s = tableau(d, "--sans-git", "--tableau");
  assert.strictEqual(s.referencement, "relie=2026-09-02 rapport=2026-09-20 prochain=2026-10-18");
  assert.strictEqual(s["seo-suivi"], "oui rendez-vous=2026-12-01");
  const modele = tableau(projet({ "docs/seo.md": SEO_SUIVI(SUIVI_MODELE, "{{date}}"), "docs/technical.md": TECHNIQUE("{{propriété – méthode – vérifiée le AAAA-MM-JJ, ou « à relier avec /pulse:search-console relier »}}") }, EN_LIGNE), "--sans-git", "--tableau");
  assert.strictEqual(modele["seo-suivi"], "non rendez-vous=aucun", "le modèle non rempli ne compte pas");
  assert.strictEqual(modele.referencement, "relie=non rapport=aucun prochain=aucun");
});

// ---------------------------------------------------------------- signaux de suivi dans decider (init et status)

test("signaux de suivi : site en ligne sans suivi SEO → /pulse:seo lancer, devant l'étape R21-R23 passée dans « aussi »", () => {
  const s = tableau(projet({ ...TERMINE, "docs/seo.md": SEO_SUIVI(SUIVI_MODELE, "{{date}}") }, EN_LIGNE), "--sans-git");
  assert.deepStrictEqual([s.regle, s.prochaine], ["R24", "/pulse:seo lancer"]);
  assert.ok(liste(s.aussi).some((a) => a.startsWith('/pulse:spirc <US-XXX> "une demande" — ')), "le verdict R23 passe dans « aussi »");
});

test("signaux de suivi : site en ligne, suivi SEO noté, Search Console absente ou « à relier » → /pulse:search-console relier", () => {
  const base = { ...TERMINE, "docs/seo.md": SEO_SUIVI(SUIVI_FAIT, "2026-12-01") };
  const absente = tableau(projet(base, EN_LIGNE), "--sans-git");
  assert.deepStrictEqual([absente.regle, absente.prochaine], ["R24", "/pulse:search-console relier"]);
  const commencee = tableau(projet({ ...base, "docs/technical.md": TECHNIQUE("à relier – domaine `sc-domain:todoit.example.org` ; TXT ajouté le 2026-10-07 ; vérification DNS en attente") }, EN_LIGNE), "--sans-git");
  assert.deepStrictEqual([commencee.regle, commencee.prochaine], ["R24", "/pulse:search-console relier"]);
  assert.match(commencee.raison, /commencée/);
  assert.match(tableau(projet({ ...base, "docs/technical.md": TECHNIQUE("à relier – domaine `sc-domain:todoit.example.org` ; TXT ajouté le 2026-10-07") }, EN_LIGNE), "--sans-git", "--tableau").referencement, /^relie=non /, "une date d'étape n'est pas une vérification");
  const pasCommencee = tableau(projet({ ...base, "docs/technical.md": TECHNIQUE("à relier avec /pulse:search-console relier") }, EN_LIGNE), "--sans-git");
  assert.deepStrictEqual([pasCommencee.regle, pasCommencee.prochaine], ["R24", "/pulse:search-console relier"]);
  assert.doesNotMatch(pasCommencee.raison, /commencée/, "la valeur par défaut du modèle n'est pas une liaison commencée");
});

test("signaux de suivi : rendez-vous SEO dépassé → /pulse:seo audit ; prochain rapport arrivé → /pulse:search-console suivre", () => {
  const relie = TECHNIQUE("`sc-domain:todoit.example.org` – DNS – vérifiée le 2026-09-02");
  const audit = tableau(projet({ ...TERMINE, "docs/technical.md": relie, "docs/seo.md": SEO_SUIVI(SUIVI_FAIT, "2026-10-01") }, EN_LIGNE), "--sans-git");
  assert.deepStrictEqual([audit.regle, audit.prochaine], ["R24", "/pulse:seo audit"]);
  assert.match(audit.raison, /2026-10-01/);
  const suivre = tableau(projet({ ...TERMINE, "docs/technical.md": relie, "docs/seo.md": SEO_SUIVI(SUIVI_FAIT, "2026-12-01"), "docs/referencement/search-console-2026-09-03.md": "_Prochain rapport conseillé : à partir du 2026-10-01._\n" }, EN_LIGNE), "--sans-git");
  assert.deepStrictEqual([suivre.regle, suivre.prochaine], ["R24", "/pulse:search-console suivre"]);
  const aJour = tableau(projet({ ...TERMINE, "docs/technical.md": relie, "docs/seo.md": SEO_SUIVI(SUIVI_FAIT, "2026-12-01"), "docs/referencement/search-console-2026-09-20.md": "_Prochain rapport conseillé : à partir du 2026-10-18._\n" }, EN_LIGNE), "--sans-git");
  assert.strictEqual(aJour.regle, "R23", "rien d'arrivé : le verdict reste");
});

test("signaux de suivi : en tête de « aussi » quand une autre étape passe avant ; aucun signal hors ligne ou pour un outil interne", () => {
  const enCours = { ...TERMINE, "aidd_docs/tasks/exporter/PLAN-SPEC-US-003-exporter.md": PLAN("US-003", "- [ ] **T4 – Exporter** · US-003") };
  const s = tableau(projet(enCours, EN_LIGNE), "--sans-git");
  assert.deepStrictEqual([s.regle, s.prochaine], ["R19", "/pulse:spirc US-003"]);
  assert.match(liste(s.aussi)[0], /^\/pulse:seo lancer — /, "le signal en tête de « aussi »");
  const interne = tableau(projet({ ...TERMINE, "docs/prd.md": PRD("non : outil interne, rien dans Google") }, EN_LIGNE), "--sans-git");
  assert.strictEqual(interne.regle, "R23");
  assert.ok(!liste(interne.aussi).some((a) => /seo|search-console/.test(a)));
  const horsLigne = tableau(projet({ ...TERMINE, "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir.md": PLAN("US-002", "- [x] **T2 – Voir** · US-002") }), "--sans-git");
  assert.ok(!liste(horsLigne.aussi).some((a) => /seo lancer|search-console/.test(a)), "site hors ligne : pas de signal");
});

// ---------------------------------------------------------------- lancement du référencement interrompu, R21, R15

const SUIVI_DNS = "| 2026-10-07 | Search Console : propriété Domaine, TXT ajouté | Plus tard (vérification DNS en attente) |";

test("lancement interrompu pendant l'attente DNS : /pulse:seo lancer le reprend (pas search-console relier seul)", () => {
  const s = tableau(projet({ ...TERMINE, "docs/seo.md": SEO_SUIVI(SUIVI_DNS, "{{date}}"), "docs/technical.md": TECHNIQUE("à relier – domaine `sc-domain:todoit.example.org` ; TXT ajouté le 2026-10-07 ; vérification DNS en attente") }, EN_LIGNE), "--sans-git");
  assert.deepStrictEqual([s.regle, s.prochaine], ["R24", "/pulse:seo lancer"]);
  assert.match(s.raison, /reprendre/);
});

test("lancement interrompu après Search Console (étape 2 faite, pas de rendez-vous) : /pulse:seo lancer le reprend", () => {
  const relie = TECHNIQUE("`sc-domain:todoit.example.org` – DNS – vérifiée le 2026-09-02");
  const s = tableau(projet({ ...TERMINE, "docs/technical.md": relie, "docs/seo.md": SEO_SUIVI(SUIVI_FAIT, "{{date}}") }, EN_LIGNE), "--sans-git");
  assert.deepStrictEqual([s.regle, s.prochaine], ["R24", "/pulse:seo lancer"]);
  assert.match(s.raison, /reprendre/);
});

test("lancement fini (rendez-vous écrit) : aucun signal avant la date, /pulse:seo audit une fois la date arrivée", () => {
  const fichiers = { ...TERMINE, "docs/technical.md": TECHNIQUE("`sc-domain:todoit.example.org` – DNS – vérifiée le 2026-09-02"), "docs/seo.md": SEO_SUIVI(SUIVI_FAIT, "2026-11-08") };
  assert.strictEqual(tableau(projet(fichiers, EN_LIGNE), "--sans-git").regle, "R23");
  const plusTard = spawnSync(process.execPath, [ETAT, "--sans-git", "--aujourdhui", "2026-11-09"], { cwd: projet(fichiers, EN_LIGNE), encoding: "utf8", env: { ...process.env, PULSE_SESSIONS_DIR: SESSIONS } }).stdout;
  assert.match(plusTard, /^regle: R24$/m);
  assert.match(plusTard, /^prochaine: \/pulse:seo audit$/m);
});

test("R24 remplace aussi R21 (en ligne, sans audit de sécurité) ; prête mais hors ligne, le rendez-vous passe en tête de « aussi » derrière R15", () => {
  const sansAudit = { ...TERMINE, "docs/securite.md": null };
  const r21 = tableau(projet({ ...sansAudit, "docs/seo.md": SEO_SUIVI(SUIVI_MODELE, "{{date}}") }, EN_LIGNE), "--sans-git");
  assert.deepStrictEqual([r21.regle, r21.prochaine], ["R24", "/pulse:seo lancer"]);
  assert.ok(liste(r21.aussi).some((a) => a.startsWith("/pulse:security — ")), "le verdict R21 passe dans « aussi »");
  const horsLigne = { ...TERMINE, "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir.md": PLAN("US-002", "- [x] **T2 – Voir** · US-002\n- [ ] **T3 – Mettre en ligne la première version** · —"), "docs/seo.md": SEO_SUIVI(SUIVI_FAIT, "2026-10-01") };
  const r15 = tableau(projet(horsLigne), "--sans-git");
  assert.deepStrictEqual([r15.regle, r15.prochaine], ["R15", "/pulse:deploy"]);
  assert.match(liste(r15.aussi)[0], /^\/pulse:seo audit — /);
});

// ---------------------------------------------------------------- une lecture qui échoue ne dégrade que ses lignes

/** Lance etat.js avec un fs.readdirSync qui échoue sur les chemins contenant `fragment`. */
function avecPanne(dossier, fragment, ...args) {
  const panne = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pulse-panne-")), "panne.js");
  fs.writeFileSync(panne, `const fs = require("fs"); const lire = fs.readdirSync; fs.readdirSync = (d, ...r) => { if (String(d).includes(${JSON.stringify(fragment)})) throw new Error("lecture refusée"); return lire(d, ...r); };\n`);
  const r = spawnSync(process.execPath, ["-r", panne, ETAT, "--aujourdhui", "2026-10-08", ...args], { cwd: dossier, encoding: "utf8", env: { ...process.env, PULSE_SESSIONS_DIR: SESSIONS } });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout;
}

test("faits de suivi illisibles : verdict sans suivi et ligne « suivi: illisible », jamais R0", () => {
  const d = projet({ ...TERMINE, "docs/referencement/search-console-2026-09-03.md": "_Prochain rapport conseillé : à partir du 2026-10-01._\n" }, EN_LIGNE);
  const sortie = avecPanne(d, "referencement", "--sans-git", "--tableau");
  assert.match(sortie, /^regle: R23$/m, "le verdict reste, sans les signaux de suivi");
  assert.match(sortie, /^suivi: illisible \(lecture refusée\)$/m);
  assert.match(sortie, /^referencement: illisible$/m);
  assert.match(sortie, /^seo-suivi: illisible$/m);
  assert.match(sortie, /^projet: TodoIt$/m, "le reste du tableau reste");
});

test("tableau illisible : les lignes d'init restent, une ligne « tableau: illisible » à la place du tableau", () => {
  const d = projet({ ...TERMINE, "aidd_docs/memory/internal/decisions/2026-09-01-stockage.md": "# Décision\n" }, EN_LIGNE);
  const sortie = avecPanne(d, "decisions", "--sans-git", "--tableau");
  assert.match(sortie, /^prochaine: /m);
  assert.doesNotMatch(sortie, /^regle: R0$/m);
  assert.match(sortie, /^tableau: illisible \(lecture refusée\)$/m);
  assert.doesNotMatch(avecPanne(d, "decisions", "--sans-git"), /illisible/, "sans --tableau, rien n'est lu ni signalé");
});

test("decider sans les faits de suivi (guide, tests) : verdict inchangé ; lireSuivi lit les mêmes faits que le tableau", () => {
  const d = projet({ ...TERMINE, "docs/seo.md": SEO_SUIVI(SUIVI_MODELE, "{{date}}") }, EN_LIGNE);
  assert.strictEqual(decider(lireFaits(d, { git: false })).regle, "R23");
  const faits = { ...lireFaits(d, { git: false }), suivi: lireSuivi(d, Date.parse("2026-10-08T00:00:00Z")) };
  assert.deepStrictEqual([decider(faits).regle, decider(faits).prochaine], ["R24", "/pulse:seo lancer"]);
});

// ---------------------------------------------------------------- Git : dossiers à part, branches fusionnées, tâche en cours sans trace

function git(dossier, ...args) {
  const r = spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.org", "-c", "commit.gpgsign=false", ...args], { cwd: dossier, encoding: "utf8" });
  assert.strictEqual(r.status, 0, `git ${args.join(" ")} : ${r.stderr}`);
  return r.stdout;
}

test("--tableau avec Git : état, dossiers à part (fusionné ou non), branche fusionnée, tâche en cours sans trace", { skip: SANS_GIT }, () => {
  const d = projet({
    "aidd_docs/tasks/gerer-taches/SPEC-US-001-creer.md": SPEC("verrouillée le 2026-09-01"),
    "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-001-creer.md": PLAN("US-001", "- [~] **T1 – Créer** · US-001"),
    "aidd_docs/tasks/gerer-taches/SPEC-US-002-voir.md": SPEC("verrouillée le 2026-09-01"),
    "aidd_docs/tasks/gerer-taches/PLAN-SPEC-US-002-voir.md": PLAN("US-002", "- [~] **T2 – Voir** · US-002"),
    ".gitignore": ".claude/worktrees/\n",
  });
  git(d, "init", "-q", "-b", "main");
  git(d, "add", "-A");
  git(d, "commit", "-q", "-m", "feat: premier");
  // US-002 a son dossier à part, avec un enregistrement d'avance : T2 a une trace ; T1 n'en a aucune.
  git(d, "worktree", "add", "-q", "-b", "feat/us-002-voir", path.join(".claude", "worktrees", "us-002-voir"));
  fs.writeFileSync(path.join(d, ".claude", "worktrees", "us-002-voir", "liste.js"), "// liste\n");
  git(path.join(d, ".claude", "worktrees", "us-002-voir"), "add", "-A");
  git(path.join(d, ".claude", "worktrees", "us-002-voir"), "commit", "-q", "-m", "feat(T2): liste");
  git(d, "worktree", "add", "-q", "-b", "feat/us-003-exporter", path.join(".claude", "worktrees", "us-003-exporter"));
  git(d, "branch", "feat/us-009-ancienne");
  const s = tableau(d, "--tableau");
  assert.strictEqual(s.git, "modifies=0 dernier=feat: premier distant=non branche=main");
  assert.deepStrictEqual(liste(s.worktree), [
    "us-002-voir branche=feat/us-002-voir avance=1 modifies=0 fusionne=non",
    "us-003-exporter branche=feat/us-003-exporter avance=0 modifies=0 fusionne=oui",
  ]);
  assert.deepStrictEqual(liste(s["branche-fusionnee"]), ["feat/us-009-ancienne"], "branche sans dossier à part, fusionnée");
  assert.deepStrictEqual(liste(s["en-cours-sans-trace"]), ["T1"]);
  fs.writeFileSync(path.join(d, "brouillon.js"), "// en cours\n");
  const modifie = tableau(d, "--tableau");
  assert.strictEqual(modifie.git, "modifies=1 dernier=feat: premier distant=non branche=main");
  assert.deepStrictEqual(liste(modifie["en-cours-sans-trace"]), [], "une modification dans le dossier principal est une trace");
});

test("pulse-aidd etat --tableau figure dans l'aide", () => {
  const aide = fs.readFileSync(path.join(RACINE, "bin", "pulse-aidd"), "utf8");
  assert.match(aide, /pulse-aidd etat \[--sans-git\] \[--tableau\]/);
});

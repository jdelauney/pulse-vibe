// Les règles d'écriture du dépôt (CLAUDE.md à la racine), vérifiées à chaque lancement des tests.
// Lancer : node --test plugins/pulse-vibe/tests/coherence.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const DEPOT = path.join(RACINE, "..", "..");
const lire = (...p) => fs.readFileSync(path.join(...p), "utf8");
const lister = (dossier) => (fs.existsSync(dossier) ? fs.readdirSync(dossier) : []);

function fichiers(dossier, extension) {
  if (!fs.existsSync(dossier)) return [];
  const resultat = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) resultat.push(...fichiers(chemin, extension));
    else if (e.name.endsWith(extension)) resultat.push(chemin);
  }
  return resultat;
}

// Tous les plugins du dépôt (le cœur seul s'il est installé hors du dépôt).
const DOSSIER_PLUGINS = path.join(DEPOT, "plugins");
const PLUGINS = fs.existsSync(DOSSIER_PLUGINS)
  ? lister(DOSSIER_PLUGINS).map((p) => path.join(DOSSIER_PLUGINS, p)).filter((p) => fs.existsSync(path.join(p, ".claude-plugin", "plugin.json")))
  : [RACINE];

// Tous les textes de consignes des plugins, et le mémo des commandes du dépôt.
const TEXTES = [
  ...PLUGINS.flatMap((p) => [...["skills", "agents", "references", "templates"].flatMap((d) => fichiers(path.join(p, d), ".md")), path.join(p, "README.md")]),
  path.join(DEPOT, "docs", "memo-commandes.md"),
]
  .filter((f) => fs.existsSync(f))
  .map((f) => ({ fichier: path.relative(DEPOT, f), texte: lire(f) }));

// Les commandes /pulse:* et les agents pulse:* sont ceux du cœur.
const SKILLS = new Set(lister(path.join(RACINE, "skills")));
const AGENTS = new Set(lister(path.join(RACINE, "agents")).map((f) => f.replace(/\.md$/, "")));
// Agents et skills de chaque plugin, pour les règles qui valent partout.
const AGENTS_PAR_PLUGIN = PLUGINS.flatMap((p) => lister(path.join(p, "agents")).filter((f) => f.endsWith(".md")).map((f) => path.join(p, "agents", f)));
const SKILLS_PAR_PLUGIN = PLUGINS.flatMap((p) => lister(path.join(p, "skills")).map((s) => path.join(p, "skills", s, "SKILL.md"))).filter((f) => fs.existsSync(f));
const OUTIL = lire(RACINE, "bin", "pulse-aidd");

// Sous-commandes de pulse-aidd : les étiquettes du dernier « case "$1" in ».
const dernierCase = OUTIL.slice(OUTIL.lastIndexOf('case "$1" in'));
const SOUS_COMMANDES = new Set([...dernierCase.matchAll(/^ {2}([a-z|-]+)\)/gm)].flatMap((m) => m[1].split("|")));
// Commandes connues de « contexte » : les étiquettes de la fonction contexte().
const corpsContexte = OUTIL.slice(OUTIL.indexOf("contexte() {"), OUTIL.indexOf("contexte_pack \"$1\""));
const CONTEXTES = new Set([...corpsContexte.matchAll(/^ {4}([a-z|-]+)\)/gm)].flatMap((m) => m[1].split("|")));

function citations(regex) {
  const trouvees = [];
  for (const { fichier, texte } of TEXTES) for (const m of texte.matchAll(regex)) trouvees.push({ fichier, valeur: m[1] });
  return trouvees;
}

const absentes = (liste, existe) => liste.filter((c) => !existe(c.valeur)).map((c) => `${c.fichier} : ${c.valeur}`);

test("chaque commande /pulse:<commande> citée existe", () => {
  // « xxx » : exemple fictif des modèles.
  assert.deepStrictEqual(absentes(citations(/\/pulse:([a-z][a-z-]*)/g), (v) => SKILLS.has(v) || v === "xxx"), []);
});

test("chaque sous-commande pulse-aidd citée existe", () => {
  assert.ok(SOUS_COMMANDES.has("contexte") && SOUS_COMMANDES.has("piles"), "lecture des sous-commandes");
  assert.deepStrictEqual(absentes(citations(/pulse-aidd ([a-z][a-z-]*)/g), (v) => SOUS_COMMANDES.has(v)), []);
});

test("pulse-aidd contexte / etape : chaque commande citée est connue", () => {
  assert.ok(CONTEXTES.has("implement") && CONTEXTES.has("ui"), "lecture des commandes de contexte");
  assert.deepStrictEqual(absentes(citations(/pulse-aidd (?:contexte|etape) ([a-z][a-z-]*)/g), (v) => CONTEXTES.has(v)), []);
  // Chaque skill charge son propre contexte : sa commande doit être connue.
  for (const skill of SKILLS) {
    const m = lire(RACINE, "skills", skill, "SKILL.md").match(/!`pulse-aidd contexte ([a-z-]+)`/);
    if (m) assert.ok(CONTEXTES.has(m[1]), `skills/${skill} : contexte ${m[1]} inconnu`);
  }
});

test("pulse-aidd modele / reference / agent : chaque fichier cité existe", () => {
  assert.deepStrictEqual(absentes(citations(/pulse-aidd modele ([\w.-]+[\w])/g), (v) => fs.existsSync(path.join(RACINE, "templates", v))), []);
  assert.deepStrictEqual(absentes(citations(/pulse-aidd reference ([\w./-]+\.md)/g), (v) => fs.existsSync(path.join(RACINE, "references", v))), []);
  assert.deepStrictEqual(absentes(citations(/pulse-aidd agent ([a-z][a-z-]*)/g), (v) => AGENTS.has(v)), []);
});

test("chaque agent pulse:<nom> cité existe", () => {
  assert.deepStrictEqual(absentes(citations(/(?<![\/\w-])pulse:([a-z][a-z-]*)/g), (v) => AGENTS.has(v) || SKILLS.has(v)), []);
});

test("un outil cité dans les consignes d'un agent lui est disponible", () => {
  const OUTILS = ["Read", "Write", "Edit", "MultiEdit", "NotebookEdit", "Bash", "Glob", "Grep", "Agent", "WebFetch", "WebSearch", "AskUserQuestion", "ToolSearch"];
  assert.ok(AGENTS_PAR_PLUGIN.length >= AGENTS.size && AGENTS.size > 0, "lecture des agents");
  const problemes = [];
  for (const fichier of AGENTS_PAR_PLUGIN) {
    const nom = path.relative(DEPOT, fichier);
    const [, entete, corps] = lire(fichier).match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || [];
    assert.ok(entete, `${nom} : en-tête absent`);
    const liste = (cle) => ((entete.match(new RegExp(`^${cle}:\\s*(.*)$`, "m")) || [])[1] || "").split(",").map((t) => t.trim()).filter(Boolean);
    const permis = liste("tools");
    const interdits = liste("disallowedTools");
    const disponible = (outil) => (permis.length ? permis.includes(outil) : !interdits.includes(outil));
    for (const outil of OUTILS) if (new RegExp(`\\b${outil}\\b`).test(corps) && !disponible(outil)) problemes.push(`${nom} : ${outil}`);
  }
  assert.deepStrictEqual(problemes, []);
});

test("allowed-tools des skills : motifs précis, sans suppression, fusion de demande, envoi forcé ni configuration", () => {
  // Permis : l'abandon d'une fusion en conflit (git merge --abort).
  assert.ok(SKILLS_PAR_PLUGIN.length >= SKILLS.size && SKILLS.size > 0, "lecture des skills");
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const skill = path.relative(DEPOT, path.dirname(fichier));
    const entete = (lire(fichier).match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
    const ligne = (entete.match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
    for (const [, motif] of ligne.matchAll(/Bash\(([^)]*)\)/g)) {
      const refus =
        /^\*$|^git \*$|^rm\b|push.*(--force|\s-f\b|\+)|branch -D|reset --hard|\bclean\b|(gh pr|glab mr) merge/.test(motif) ||
        (/\bconfig\b/.test(motif) && !/^git config (--global )?user\.(name|email)( \*)?$/.test(motif));
      if (refus) problemes.push(`${skill} : Bash(${motif})`);
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("catalogue : chaque plugin listé a son manifeste, avec une version x.y.z", { skip: !fs.existsSync(path.join(DEPOT, ".claude-plugin", "marketplace.json")) }, () => {
  const catalogue = JSON.parse(lire(DEPOT, ".claude-plugin", "marketplace.json"));
  assert.ok(catalogue.plugins.length >= 1);
  for (const p of catalogue.plugins) {
    const manifeste = path.join(DEPOT, p.source, ".claude-plugin", "plugin.json");
    assert.ok(fs.existsSync(manifeste), `${p.name} : ${manifeste} absent`);
    const { version, name } = JSON.parse(fs.readFileSync(manifeste, "utf8"));
    assert.match(version || "", /^\d+\.\d+\.\d+$/, `${p.name} : version`);
    assert.ok(name, `${p.name} : nom`);
  }
});

test("chaque plugin du dépôt figure au catalogue", { skip: !fs.existsSync(path.join(DEPOT, ".claude-plugin", "marketplace.json")) }, () => {
  const sources = JSON.parse(lire(DEPOT, ".claude-plugin", "marketplace.json")).plugins.map((p) => path.resolve(DEPOT, p.source));
  assert.deepStrictEqual(PLUGINS.filter((p) => !sources.includes(path.resolve(p))).map((p) => path.relative(DEPOT, p)), []);
});

test("fins de ligne LF dans bin/, scripts/ et hooks/ de chaque plugin", () => {
  const crlf = PLUGINS.flatMap((p) => ["bin", "scripts", "hooks"].flatMap((d) => fichiers(path.join(p, d), "")))
    .filter((f) => lire(f).includes("\r\n"))
    .map((f) => path.relative(DEPOT, f));
  assert.deepStrictEqual(crlf, []);
});

test("en-têtes de sécurité : chaque en-tête de la checklist S12 est décrit dans securite/entetes.md", () => {
  const s12 = lire(RACINE, "references", "checklist-securite.md").split("## S12")[1].split("\n---")[0];
  const entetes = lire(RACINE, "references", "securite", "entetes.md");
  const noms = [...s12.matchAll(/\b[A-Z][a-zA-Z]*(?:-[A-Z][a-zA-Z]*)+\b/g)].map((m) => m[0]);
  assert.ok(noms.includes("Cross-Origin-Opener-Policy"), "S12 cite Cross-Origin-Opener-Policy");
  for (const nom of noms) assert.ok(entetes.includes(`| \`${nom}\` |`), `${nom} absent du tableau de entetes.md`);
  assert.ok(entetes.includes("browsing-topics=()"), "Permissions-Policy avec browsing-topics");
  assert.match(entetes, /prérend/, "règle nonce et pages prérendues");
  assert.match(entetes, /`preload`/, "règle preload");
  const rapide = lire(RACINE, "references", "securite", "rapide.md");
  for (const nom of noms) assert.ok(rapide.includes(nom), `${nom} absent de securite/rapide.md`);
});

test("chaque outil de bin/ a son relais .cmd pour PowerShell et cmd", () => {
  for (const p of PLUGINS) {
    const bin = path.join(p, "bin");
    for (const f of lister(bin).filter((x) => !x.includes("."))) {
      const relais = path.join(bin, `${f}.cmd`);
      assert.ok(fs.existsSync(relais), `${path.relative(DEPOT, relais)} manquant`);
      assert.match(lire(relais), new RegExp(`"%~dp0${f}" %\\*`), `${f}.cmd relaie vers ${f}`);
    }
  }
});

// ---------------------------------------------------------------- Autorisations d'avance des skills (allowed-tools)

// Motifs Bash de la ligne allowed-tools d'un SKILL.md.
function motifsBash(fichier) {
  const entete = (lire(fichier).match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
  const ligne = (entete.match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
  return [...ligne.matchAll(/Bash\(([^)]*)\)/g)].map((m) => m[1]);
}

// Règle de Claude Code : « * » remplace n'importe quel texte ; un « * » final précédé d'une espace,
// seul joker du motif, couvre aussi la commande sans argument (Bash(ls *) couvre ls).
function couvre(motif, commande) {
  if (/^[^*]+ \*$/.test(motif)) {
    const base = motif.slice(0, -2);
    return commande === base || commande.startsWith(`${base} `);
  }
  const echappe = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${motif.split("*").map(echappe).join(".*")}$`, "s").test(commande);
}

// Ce qui change la production, crée ou retire un secret, ou coupe un accès : toujours par la demande d'autorisation.
const SENSIBLES = [
  "pulse-aidd secrets generer NOM",
  "pulse-aidd secrets generer NOM --envoyer production,preview",
  "pulse-aidd secrets envoyer NOM --env production",
  "pulse-aidd secrets elaguer NOM",
  "pulse-aidd secrets redeployer",
  "pulse-aidd secrets redeployer --env production",
  "pulse-aidd installer-ci --forcer", // remplace un verifier.js déjà adapté par le projet
  "pulse-aidd search-console deconnecter",
  "pulse-aidd pile hebergeur envoyer NOM production",
  "pulse-aidd pile hebergeur redeployer production",
];
const estSensible = (commande) => /^pulse-aidd (secrets (generer|envoyer|elaguer|redeployer)|search-console deconnecter|pile hebergeur|installer-ci --forcer)\b/.test(commande);

// Une citation `pulse-aidd …` devient une commande d'essai : <x> → X ; […] retiré ; … → X.
const essai = (citation) => citation.replace(/<[^>]*>/g, "X").replace(/\[[^\]]*\]/g, "").replace(/…/g, "X").replace(/\s+/g, " ").trim();
const citationsOutil = (texte) => [...texte.matchAll(/`(pulse-aidd [^`]+)`/g)].map((m) => essai(m[1]));

test("allowed-tools : ni Bash(pulse-aidd *), ni sous-commande sensible autorisée d'avance", () => {
  assert.ok(couvre("pulse-aidd *", SENSIBLES[0]) && !couvre("pulse-aidd secrets inventaire *", SENSIBLES[0]), "règle de correspondance");
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const skill = path.relative(DEPOT, path.dirname(fichier));
    for (const motif of motifsBash(fichier)) {
      if (motif === "pulse-aidd *") problemes.push(`${skill} : Bash(pulse-aidd *)`);
      for (const commande of SENSIBLES) if (couvre(motif, commande)) problemes.push(`${skill} : Bash(${motif}) couvre « ${commande} »`);
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("allowed-tools : chaque pulse-aidd cité par un skill, ou par une étape qu'il enchaîne, est autorisé d'avance", () => {
  assert.ok(couvre("pulse-aidd sonder *", "pulse-aidd sonder") && !couvre("pulse-aidd seo *", "pulse-aidd seobis") && couvre("pulse-aidd secrets inventaire*", "pulse-aidd secrets inventaire --json"), "règle de correspondance");
  const texteSkill = (s) => lire(RACINE, "skills", s, "SKILL.md");
  // Étapes enchaînées : chaque `pulse-aidd etape <commande>` nommée, de proche en proche.
  const enchainees = (depart) => {
    const vues = new Set([depart]);
    const aVoir = [depart];
    while (aVoir.length) {
      for (const c of citationsOutil(texteSkill(aVoir.pop()))) {
        const etape = (c.match(/^pulse-aidd etape ([a-z][a-z-]*)$/) || [])[1];
        if (etape && SKILLS.has(etape) && !vues.has(etape)) {
          vues.add(etape);
          aVoir.push(etape);
        }
      }
    }
    return [...vues];
  };
  const manquants = [];
  for (const skill of SKILLS) {
    const motifs = motifsBash(path.join(RACINE, "skills", skill, "SKILL.md"));
    const commandes = new Set(enchainees(skill).flatMap((s) => citationsOutil(texteSkill(s))));
    for (const commande of commandes) {
      if (estSensible(commande)) continue; // passe par la demande d'autorisation : c'est voulu
      if (!motifs.some((m) => couvre(m, commande))) manquants.push(`skills/${skill} : ${commande}`);
    }
  }
  assert.deepStrictEqual(manquants, []);
});

test("allowed-tools : chaque motif Bash(pulse-aidd …) commence par une sous-commande connue", () => {
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    for (const motif of motifsBash(fichier).filter((m) => m.startsWith("pulse-aidd"))) {
      const sous = (motif.match(/^pulse-aidd ([a-z][a-z-]*)(?: |\*|$)/) || [])[1];
      if (!SOUS_COMMANDES.has(sous)) problemes.push(`${path.relative(DEPOT, path.dirname(fichier))} : Bash(${motif})`);
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("envoi du travail : git push passe par la demande d'autorisation ; /pulse:commit envoie seulement si push est le premier mot", () => {
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const skill = path.relative(DEPOT, path.dirname(fichier));
    for (const motif of motifsBash(fichier)) if (/^git push\b/.test(motif)) problemes.push(`${skill} : Bash(${motif})`);
  }
  assert.deepStrictEqual(problemes, []);
  const commit = lire(RACINE, "skills", "commit", "SKILL.md");
  assert.doesNotMatch(commit, /n'importe où/);
  assert.match(commit, /si le \*\*premier mot\*\* est `push`/);
  assert.match(commit, /ajoute le bouton push/);
  assert.match(lire(RACINE, "references", "regles-communes.md"), /envoyer le travail sur le dépôt distant \(`git push`/);
});

test("allowed-tools : ni branche déplacée, ni fusion ou récupération locale, ni dépôt distant créé ; commits par git commit -m", () => {
  const interdit = /^(git branch -f\b|git merge --no-ff\b|git pull\b|gh repo create\b|glab repo create\b)/;
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const skill = path.relative(DEPOT, path.dirname(fichier));
    for (const motif of motifsBash(fichier)) {
      if (interdit.test(motif)) problemes.push(`${skill} : Bash(${motif})`);
      if (/^git commit\b/.test(motif) && motif !== "git commit -m *") problemes.push(`${skill} : Bash(${motif}) (attendu : Bash(git commit -m *))`);
    }
  }
  assert.deepStrictEqual(problemes, []);
  const regles = lire(RACINE, "references", "regles-communes.md");
  for (const operation of ["`git merge`", "`git branch -f`", "`git pull`", "créer un dépôt distant"]) assert.ok(regles.includes(operation), `règle 17 : ${operation}`);
  const depot = lire(RACINE, "references", "depot-distant.md");
  assert.match(depot, /`gh repo create <nom> --private /);
  assert.match(depot, /`glab repo create <nom> --private`/);
  assert.match(depot, /Claude Code demande l'accord de la personne/);
  assert.match(lire(RACINE, "references", "git.md"), /`git commit -m "<description>"`/);
});

test("mise en ligne : tests, contrôle rapide de sécurité avant la première fois, audit complet proposé en clôture", () => {
  const fichier = path.join(RACINE, "skills", "deploy", "SKILL.md");
  const deploy = lire(fichier);
  const controles = deploy.split("## 1. Contrôles avant envoi")[1].split("\n## 2.")[0];
  assert.match(controles, /la commande « Tester »/);
  assert.match(controles, /avant la \*\*première\*\* mise en ligne/);
  assert.match(controles, /`pulse-aidd reference securite\/rapide\.md`/);
  assert.match(controles, /Un ⛔ bloque la mise en ligne/);
  assert.match(deploy.split("## 6. Clore")[1], /`\/pulse:security audit`/);
  const motifs = motifsBash(fichier);
  for (const m of ["git ls-files *", "git grep *", "curl -sI *"]) assert.ok(motifs.includes(m), `allowed-tools de deploy : Bash(${m})`);
});

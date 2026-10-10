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
        (/(^|\s)config\b/.test(motif) && !/^git config (--global )?user\.(name|email)( \*)?$/.test(motif));
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
  const s12 = lire(RACINE, "references", "checklist-securite.md").split("## S12")[1].split(/\n## S13|\n---/)[0];
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

test("chaque outil de bin/ a ses relais .ps1 (PowerShell) et .cmd (cmd), identiques d'un plugin à l'autre", () => {
  const relais = { ps1: new Set(), cmd: new Set() };
  for (const p of PLUGINS) {
    const bin = path.join(p, "bin");
    for (const f of lister(bin).filter((x) => !x.includes("."))) {
      for (const ext of ["ps1", "cmd"]) {
        const fichier = path.join(bin, `${f}.${ext}`);
        assert.ok(fs.existsSync(fichier), `${path.relative(DEPOT, fichier)} manquant`);
        relais[ext].add(lire(fichier));
      }
      const script = lire(bin, f);
      assert.match(script, /\nif \[ \$# -eq 0 \] && \[ -n "\$\{PULSE_RELAIS_ARGC:-\}" \]; then\n/, `${f} relit les arguments du relais .ps1, seulement sans argument`);
      assert.match(script, /\n {2}case "\$_n" in ''\|\*\[!0-9\]\*\|\?{5}\*\) _n=0 ;; esac/, `${f} vérifie le nombre d'arguments avant tout calcul`);
      assert.match(script, /\nunset "\$\{!PULSE_RELAIS_ARG@\}" PULSE_RELAIS_ARGC\n/, `${f} efface toujours les variables du relais`);
    }
  }
  assert.strictEqual(relais.ps1.size, 1, "les relais .ps1 diffèrent d'un outil à l'autre");
  assert.strictEqual(relais.cmd.size, 1, "les relais .cmd diffèrent d'un outil à l'autre");
  const [ps1] = relais.ps1;
  assert.match(ps1, /^[\x00-\x7F]*$/, "relais .ps1 en ASCII seulement (Windows PowerShell 5.1)");
  assert.match(ps1, /GetFileNameWithoutExtension\(\$PSCommandPath\)/, "le .ps1 lance le script bash de son propre nom");
  assert.doesNotMatch(ps1, /System32|WindowsApps/i, "jamais le bash de WSL");
  const [cmd] = relais.cmd;
  assert.match(cmd, /"%~dpn0" %\*/, "le .cmd lance le script bash de son propre nom");
  assert.doesNotMatch(cmd, /set "PULSE_BASH=bash"/, "jamais un bash pris au hasard dans le PATH (WSL)");
  assert.match(lire(RACINE, "references", "regles-communes.md"), /relais `\.ps1`/, "règle commune : le relais .ps1");
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
        const etape = (c.match(/^pulse-aidd etape ([a-z][a-z-]*)(?: --sans-communes)?$/) || [])[1];
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

test("allowed-tools : les commandes pulse-aidd des agents qu'un skill lance, et des références qu'il nomme, sont autorisées d'avance", () => {
  const texteSkill = (s) => lire(RACINE, "skills", s, "SKILL.md");
  const enchainees = (depart) => {
    const vues = new Set([depart]);
    const aVoir = [depart];
    while (aVoir.length) {
      for (const c of citationsOutil(texteSkill(aVoir.pop()))) {
        const etape = (c.match(/^pulse-aidd etape ([a-z][a-z-]*)(?: --sans-communes)?$/) || [])[1];
        if (etape && SKILLS.has(etape) && !vues.has(etape)) {
          vues.add(etape);
          aVoir.push(etape);
        }
      }
    }
    return [...vues];
  };
  let verifies = 0;
  const manquants = [];
  for (const skill of SKILLS) {
    const motifs = motifsBash(path.join(RACINE, "skills", skill, "SKILL.md"));
    const textes = enchainees(skill).map(texteSkill);
    const sources = new Map();
    for (const texte of textes) {
      for (const m of texte.matchAll(/(?<![\/\w-])pulse:([a-z][a-z-]*)|pulse-aidd agent ([a-z][a-z-]*)/g)) {
        const agent = m[1] || m[2];
        if (AGENTS.has(agent)) sources.set(`agent ${agent}`, lire(RACINE, "agents", `${agent}.md`));
      }
      for (const m of texte.matchAll(/pulse-aidd reference ([\w./-]+\.md)|references\/([\w./-]+\.md)/g)) {
        const ref = m[1] || m[2];
        if (fs.existsSync(path.join(RACINE, "references", ref))) sources.set(`référence ${ref}`, lire(RACINE, "references", ref));
      }
    }
    for (const [origine, texte] of sources) {
      for (const commande of citationsOutil(texte)) {
        if (estSensible(commande) || commande === "pulse-aidd search-console") continue; // le second est un titre de tableau, pas une commande
        verifies++;
        if (!motifs.some((m) => couvre(m, commande))) manquants.push(`skills/${skill} (${origine}) : ${commande}`);
      }
    }
  }
  assert.ok(verifies > 100, "lecture des agents et des références");
  assert.deepStrictEqual([...new Set(manquants)], []);
});

test("allowed-tools : les commandes git de lecture citées par un skill, ou par une étape qu'il enchaîne, sont autorisées d'avance", () => {
  assert.ok(couvre("git log *", "git log --oneline") && !couvre("git remote -v", "git remote add origin x"), "règle de correspondance");
  const texteSkill = (s) => lire(RACINE, "skills", s, "SKILL.md");
  const enchainees = (depart) => {
    const vues = new Set([depart]);
    const aVoir = [depart];
    while (aVoir.length) {
      for (const c of citationsOutil(texteSkill(aVoir.pop()))) {
        const etape = (c.match(/^pulse-aidd etape ([a-z][a-z-]*)(?: --sans-communes)?$/) || [])[1];
        if (etape && SKILLS.has(etape) && !vues.has(etape)) {
          vues.add(etape);
          aVoir.push(etape);
        }
      }
    }
    return [...vues];
  };
  // Formes en lecture seule ou sans effet distant : `git remote -v`, `git remote get-url …`, `git fetch origin`, `git status …`, `git log …`, `git diff …`.
  const lecture = /`(git (?:remote -v|remote get-url [^`]+|fetch origin|status(?: [^`]*)?|log(?: [^`]*)?|diff(?: [^`]*)?))`/g;
  let verifiees = 0;
  const manquants = [];
  for (const skill of SKILLS) {
    const motifs = motifsBash(path.join(RACINE, "skills", skill, "SKILL.md"));
    const commandes = new Set(enchainees(skill).flatMap((s) => [...texteSkill(s).matchAll(lecture)].map((m) => essai(m[1]))));
    for (const commande of commandes) {
      verifiees++;
      if (!motifs.some((m) => couvre(m, commande))) manquants.push(`skills/${skill} : ${commande}`);
    }
  }
  assert.ok(verifiees > 20, "lecture des commandes git citées");
  assert.deepStrictEqual(manquants, []);
});

test("allowed-tools : aucun skill n'autorise d'avance la modification d'un dépôt distant ni une récupération forcée", () => {
  assert.ok(couvre("git remote *", "git remote remove origin") && !couvre("git remote -v", "git remote remove origin") && !couvre("git fetch origin", "git fetch origin +a:b"), "règle de correspondance");
  const interdites = ["git remote remove origin", "git remote set-url origin X", "git remote rename origin X", "git fetch origin +refs/heads/main:refs/heads/main", "git fetch --force origin", "git fetch origin +main"];
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const skill = path.relative(DEPOT, path.dirname(fichier));
    for (const motif of motifsBash(fichier)) for (const c of interdites) if (couvre(motif, c)) problemes.push(`${skill} : Bash(${motif}) couvre « ${c} »`);
  }
  assert.deepStrictEqual(problemes, []);
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
  for (const m of ["git ls-files *", "git grep -n *", "pulse-aidd sonder *"]) assert.ok(motifs.includes(m), `allowed-tools de deploy : Bash(${m})`);
});

test("allowed-tools : ni curl ni wget, gitleaks seulement avec --redact, ni git rm, git grep seulement avec -n ou -l", () => {
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const skill = path.relative(DEPOT, path.dirname(fichier));
    for (const motif of motifsBash(fichier)) {
      const refus =
        /^(curl|wget)\b/.test(motif) || (/^gitleaks\b/.test(motif) && !/ --redact\b/.test(motif)) || /^git rm\b/.test(motif) || (/^git grep\b/.test(motif) && !/^git grep -[nl] \*$/.test(motif));
      if (refus) problemes.push(`${skill} : Bash(${motif})`);
    }
  }
  assert.deepStrictEqual(problemes, []);
  assert.ok(motifsBash(path.join(RACINE, "skills", "security", "SKILL.md")).includes("gitleaks detect --config .gitleaks.toml --redact*"));
});

test("en-têtes servis : vérifiés par pulse-aidd sonder --entetes, plus par curl", () => {
  for (const ref of ["securite/entetes.md", "securite/rapide.md"]) {
    const texte = lire(RACINE, "references", ref);
    assert.ok(texte.includes("pulse-aidd sonder <adresse> --entetes"), ref);
    assert.doesNotMatch(texte, /curl -sI/, ref);
  }
});

test("checklist sécurité : S13 (CSRF, sessions, cookies, webhooks), requêtes paramétrées, redirections, SSRF, sauvegardes ; audit des dépendances exigé", () => {
  const checklist = lire(RACINE, "references", "checklist-securite.md");
  const section = (id) => (checklist.split(`\n## ${id} `)[1] || "").split(/\n## |\n---/)[0];
  assert.match(section("S3"), /\*\*restauration\*\*/);
  assert.match(section("S5"), /\*\*paramétrées\*\*/);
  assert.match(section("S5"), /redirection ouverte/);
  assert.match(section("S5"), /SSRF/);
  const s13 = section("S13");
  for (const mot of ["CSRF", "`Origin`", "`HttpOnly`", "`Secure`", "`SameSite`", "expire", "**signature**"]) assert.ok(s13.includes(mot), `S13 : ${mot}`);
  assert.match(checklist, /\n7\. \*\*Déconnexion\*\*/);
  const auditeur = lire(RACINE, "agents", "security-auditor.md");
  assert.match(auditeur, /S8 vaut ✅ seulement avec cette sortie/);
  assert.match(auditeur, /\*\*S13\*\*/);
  assert.match(lire(RACINE, "templates", "securite.md"), /\| S13 CSRF, sessions et cookies \|/);
  assert.match(lire(RACINE, "templates", "technical.md"), /\| Auditer les dépendances \|/);
  assert.match(lire(RACINE, "templates", "ci-verifications.yml.template"), /\{\{Auditer les dépendances\}\}/);
  const cicd = lire(RACINE, "skills", "cicd", "SKILL.md");
  assert.match(cicd, /auditer les dépendances \(« Auditer les dépendances »/);
  assert.match(cicd, /## 8\. Mises à jour des dépendances/);
  assert.match(cicd, /Dependabot/);
  assert.match(cicd, /Renovate/);
  // Plus aucune mention de l'ancienne étendue de la checklist.
  assert.deepStrictEqual(TEXTES.filter(({ texte }) => /S1\s*(à|–|-)\s*S12\b/.test(texte)).map(({ fichier }) => fichier), []);
});

test("checklist sécurité : sauvegarde dans le modèle technique, audit dans l'essai local, S8 non concerné sans dépendance, S13 relié", () => {
  assert.match(lire(RACINE, "templates", "technical.md"), /- Sauvegarde et restauration : \{\{/);
  assert.match(lire(RACINE, "..", "pulse-vibe-next", "references", "technical.md"), /- Sauvegarde et restauration : /);
  const cicd = lire(RACINE, "skills", "cicd", "SKILL.md");
  assert.match(cicd.split("## 4. Essayer en local")[1].split("\n## ")[0], /audit des dépendances/);
  assert.match(cicd.split("## Objectif")[1].split("\n## ")[0], /dépendances/);
  assert.match(lire(RACINE, "README.md"), /\/pulse:cicd[^\n]*dépendances/);
  assert.match(lire(RACINE, "agents", "security-auditor.md"), /aucun fichier de dépendances[^\n]*S8 vaut « — »/);
  const code = lire(RACINE, "references", "qualite", "securite-code.md");
  assert.match(code, /En-têtes de sécurité \| S12 \|/);
  assert.match(code, /\| S13 \|/);
  assert.match(code, /\(S13\)/);
});

test("Node.js 22.19 ou plus : prérequis bloquant de /pulse:init, annoncé par les README", () => {
  const regle = lire(RACINE, "skills", "init", "SKILL.md").split("## 2. Décider")[1].split("\n2. ")[0];
  assert.match(regle, /\*\*Node\.js absent, ou en version inférieure à 22\.19\*\*/);
  assert.match(regle, /s'arrêter de la même façon/);
  assert.doesNotMatch(regle, /prévenir et continuer/);
  const readmes = [path.join(DEPOT, "README.md"), path.join(RACINE, "README.md"), path.join(DEPOT, "plugins", "pulse-vibe-next", "README.md")].filter((f) => fs.existsSync(f));
  assert.ok(readmes.length >= 1);
  for (const readme of readmes) assert.match(lire(readme), /Node\.js 22\.19 ou plus/, path.relative(DEPOT, readme));
});

test("catalogue : chaque entrée porte le nom de son manifeste, anciens noms redirigés, commandes d'installation exactes", { skip: !fs.existsSync(path.join(DEPOT, ".claude-plugin", "marketplace.json")) }, () => {
  const catalogue = JSON.parse(lire(DEPOT, ".claude-plugin", "marketplace.json"));
  const noms = catalogue.plugins.map((p) => p.name);
  for (const p of catalogue.plugins) {
    const { name, dependencies = [] } = JSON.parse(lire(DEPOT, p.source, ".claude-plugin", "plugin.json"));
    assert.strictEqual(p.name, name, `${p.source} : entrée « ${p.name} », manifeste « ${name} »`);
    for (const d of dependencies) {
      const dependance = typeof d === "string" ? d : d.name;
      assert.ok(noms.includes(dependance), `${name} : dépendance « ${dependance} » absente du catalogue`);
    }
  }
  assert.deepStrictEqual(catalogue.renames, { "pulse-vibe": "pulse", "pulse-vibe-next": "pulse-next" });
  const textes = [...TEXTES, { fichier: "README.md", texte: fs.existsSync(path.join(DEPOT, "README.md")) ? lire(DEPOT, "README.md") : "" }, { fichier: "bin/pulse-aidd", texte: OUTIL }];
  const cites = textes.flatMap(({ fichier, texte }) => [...texte.matchAll(/plugin (?:install|update) ([a-z0-9$%{}-]+)@pulseia/g)].map((m) => ({ fichier, nom: m[1] })));
  assert.ok(cites.length >= 3, "commandes d'installation citées");
  const connu = (nom) => noms.includes(nom) || /^pulse-(\$id|%s)$/.test(nom);
  assert.deepStrictEqual(cites.filter(({ nom }) => !connu(nom)).map(({ fichier, nom }) => `${fichier} : ${nom}@pulseia`), []);
});

test("README : section « Mettre à jour » mise en avant, avec les commandes exactes", () => {
  const readmes = [path.join(DEPOT, "README.md"), path.join(RACINE, "README.md")].filter((f) => fs.existsSync(f));
  assert.ok(readmes.length >= 1);
  for (const readme of readmes) {
    const nom = path.relative(DEPOT, readme);
    const section = (lire(readme).split("\n## Mettre à jour\n")[1] || "").split("\n## ")[0];
    assert.ok(section, `${nom} : section « Mettre à jour » absente`);
    for (const attendu of ["claude plugin marketplace update pulseia", "claude plugin update pulse@pulseia", "claude plugin update pulse-next@pulseia", "relancez Claude Code", "Enable auto-update", "/plugin install pulse@pulseia"])
      assert.ok(section.includes(attendu), `${nom} : « ${attendu} » absent de « Mettre à jour »`);
  }
  if (fs.existsSync(path.join(DEPOT, "README.md"))) assert.match(lire(DEPOT, "README.md").split("\n## Installation\n")[0], /\[Mettre à jour\]\(#mettre-à-jour\)/);
});

// ---------------------------------------------------------------- Parcours et langage

const skillTexte = (nom) => lire(RACINE, "skills", nom, "SKILL.md");

test("init et status appliquent le verdict de pulse-aidd etat, sans règles de décision recopiées", () => {
  for (const skill of ["init", "status"]) {
    const texte = skillTexte(skill);
    assert.match(texte, /`pulse-aidd etat`/, `${skill} lance pulse-aidd etat`);
    assert.doesNotMatch(texte, /spec sans plan → `\/pulse:plan/i, `${skill} : règle de décision recopiée`);
  }
  assert.doesNotMatch(skillTexte("status"), /Sa seule modification/);
  assert.doesNotMatch(skillTexte("init"), /\*\*Questions\*\* \(une ronde AskUserQuestion\) : le \*\*nom\*\*/, "nom et description : réponse libre");
});

test("init et status ne citent que des clés et des valeurs réellement émises par etat.js", () => {
  const source = lire(RACINE, "scripts", "etat.js");
  const valeurs = [...new Set([...source.matchAll(/fondation: "([a-z]+)"/g)].map((m) => m[1]))];
  assert.ok(valeurs.length >= 6, "valeurs de fondation lues dans etat.js");
  const tableau = skillTexte("init").split("| `fondation` |")[1] || "";
  for (const v of valeurs) assert.ok(tableau.includes(`| \`${v}\` |`), `init : ligne « ${v} » absente de la table des fondations`);
  const emises = new Set(["prochaine", "raison", "regle", "etapes", "mvp", "aussi"]);
  for (const m of source.matchAll(/for \(const cle of \[([^\]]+)\]\)/g)) for (const c of m[1].match(/"([a-z]+)"/g)) emises.add(c.replace(/"/g, ""));
  for (const c of ["prochaine", "raison", "regle", "etapes", "mvp", "aussi"]) assert.ok(source.includes(`\`${c}: `) || source.includes(`\`${c}:`), `etat.js n'émet pas ${c}`);
  for (const skill of ["init", "status"]) {
    const cites = [...skillTexte(skill).matchAll(/`(prochaine|raison|regle|fondation|attente|ancien|dossier|aussi|etapes|mvp)(?::[^`]*)?`/g)].map((m) => m[1]);
    for (const c of cites) assert.ok(emises.has(c), `${skill} cite la clé ${c}, absente de etat.js`);
  }
});

test("examen d'une tâche : décrit une seule fois, reviewer et verifier pour chaque chemin", () => {
  const unix = (f) => f.split(path.sep).join("/");
  const delegations = TEXTES.filter(({ texte }) => /\*\*`pulse:verifier`\*\* :/.test(texte)).map(({ fichier }) => unix(fichier));
  assert.deepStrictEqual(delegations, ["plugins/pulse-vibe/references/examen.md"]);
  const examen = lire(RACINE, "references", "examen.md");
  for (const agent of ["**`pulse:reviewer`**", "**`pulse:security-auditor`**"]) assert.ok(examen.includes(agent), agent);
  for (const skill of ["review", "spirc"]) assert.match(skillTexte(skill), /référence « Examiner une tâche »/, skill);
  assert.match(skillTexte("implement"), /`pulse:reviewer` et `pulse:verifier`/, "la boucle d'implement annonce la vérification");
  assert.match(lire(RACINE, "templates", "revue.md"), /^## Vérification$/m);
  assert.match(lire(RACINE, "agents", "verifier.md").match(/^description:.*$/m)[0], /\/pulse:review/);
});

test("examen d'une tâche : chaque agent nommé par la référence est repliable par `pulse-aidd agent <nom>` dans les skills qui la chargent", () => {
  const examen = lire(RACINE, "references", "examen.md");
  const agents = [...AGENTS].filter((a) => new RegExp(`(?<![\w-])${a}(?![\w-])`).test(examen));
  assert.ok(agents.length >= 4, agents.join(","));
  for (const skill of ["review", "spirc", "implement"]) {
    const motifs = motifsBash(path.join(RACINE, "skills", skill, "SKILL.md"));
    for (const a of agents) assert.ok(motifs.some((m) => couvre(m, `pulse-aidd agent ${a}`)), `${skill} : pulse-aidd agent ${a}`);
  }
});

test("plan : montré et validé avant d'être écrit, avec la ligne « plan validé » du journal", () => {
  const deroule = skillTexte("plan").split("## Déroulé")[1];
  const valider = deroule.indexOf("« Valider le plan (Recommandé) »");
  const ecrire = deroule.indexOf("Écrire `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md`");
  assert.ok(valider !== -1 && ecrire !== -1, "validation et écriture présentes");
  assert.ok(valider < ecrire, "la validation précède l'écriture");
  assert.match(deroule, /« plan validé »/);
});

test("règles communes : rondes de 4 questions, réponses libres en texte, mode découverte écrit une fois", () => {
  const unix = (f) => f.split(path.sep).join("/");
  const regles = lire(RACINE, "references", "regles-communes.md");
  assert.doesNotMatch(regles, /Poser les questions une par une/);
  assert.match(regles, /une ronde de 4 questions au plus/);
  assert.match(regles, /réponse libre/);
  assert.doesNotMatch(regles, /`\/pulse:pr branche <US-XXX>` avant `\/pulse:implement`/);
  const definitions = TEXTES.filter(({ texte }) => /\*\*Mode découverte\*\* :/.test(texte)).map(({ fichier }) => unix(fichier));
  assert.deepStrictEqual(definitions, ["plugins/pulse-vibe/references/regles-communes.md"]);
});

test("implement : questions de démarrage en clair et mode découverte", () => {
  const texte = skillTexte("implement");
  assert.match(texte, /« Je code en coulisse \(Recommandé\) »/);
  assert.match(texte, /« Je code devant vous »/);
  assert.match(texte, /\*\*Mode découverte\*\* \(règles communes § 1\)/);
  assert.doesNotMatch(texte, /Implémentation via sous-agent|Implémentation directe/);
});

test("spirc : une ronde de départ de 4 questions au plus, sans double validation", () => {
  const texte = skillTexte("spirc");
  assert.doesNotMatch(texte, /Point de validation 1|✋ ?1/);
  assert.match(texte, /« Pas à pas, avec un contrôle de sécurité à chaque tâche »/);
  assert.match(texte, /\*\*Mode découverte\*\* \(règles communes § 1\)/);
  const ronde = texte.split("## Choisir la façon de travailler")[1];
  assert.ok(ronde, "section « Choisir la façon de travailler »");
  const questions = ronde.split(/\n## /)[0].split("\n").filter((l) => /^- \*\*[^*]+\*\*/.test(l));
  assert.ok(questions.length >= 3 && questions.length <= 4, `${questions.length} questions dans la ronde`);
});

test("spirc : le mode autonome s'arrête aussi pour la validation du plan", () => {
  const texte = skillTexte("spirc");
  const puce = texte.split("\n").find((l) => l.startsWith("- `-a`"));
  assert.match(puce, /validation du plan quand il vient d'être créé/);
  assert.match(texte, /vous testez tout à la fin\) ;/);
  assert.match(texte, /je m'arrête seulement pour vos décisions : besoin, validation du plan, actions à la main/);
});

// Mots réservés aux consignes : la personne les voit seulement expliqués (lexique), jamais dans une description, un libellé ou un écran.
// « MVP », « epic » et « demande de fusion » restent permis dans les consignes destinées à l'IA (décision du 2026-10-09).
const SIGLES_JARGON = /\b(CI|CD|PR|CSV|INVEST|MoSCoW|TBD|MVP)\b/;
const MOTS_JARGON = /\b(worktrees?|pull requests?|demandes? de fusion|lint|lighthouse|epics?|squelette|aidd_docs|test-runner|test-writer|kanban|storytelling|sous-agents?|feynman|definition of ready)\b/i;
const jargon = (texte) => SIGLES_JARGON.exec(texte) || MOTS_JARGON.exec(texte);
// Dans un libellé ou un écran, les chemins, le code et les emplacements à remplacer (<epic>) restent permis.
const sansChemins = (texte) => texte.replace(/`[^`]*`/g, " ").replace(/<[^>]*>/g, " ").replace(/\S*\/\S*/g, " ");

test("descriptions des commandes sans jargon", () => {
  const unix = (f) => f.split(path.sep).join("/");
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const description = (lire(fichier).match(/^description:\s*(.*)$/m) || [])[1] || "";
    const m = jargon(description);
    if (m) problemes.push(`${unix(path.relative(DEPOT, fichier))} : ${m[0]}`);
  }
  assert.deepStrictEqual(problemes, []);
});

test("libellés des questions sans jargon : la réponse recommandée et ses alternatives", () => {
  const unix = (f) => f.split(path.sep).join("/");
  const problemes = [];
  for (const { fichier, texte } of TEXTES) {
    for (const ligne of texte.split("\n")) {
      for (const m of ligne.matchAll(/« ((?:[^«»]|«[^«»]*»)+) »/g)) {
        const avant = ligne.slice(0, m.index);
        const apres = ligne.slice(m.index + m[0].length);
        const libelle =
          !/^\d+[a-z]?\. /.test(m[1]) &&
          (/\([Rr]ecommandé/.test(m[1]) || / \/ ?$/.test(avant) || /^ ?\/ /.test(apres) || (/AskUserQuestion/.test(ligne) && /(, |et )$/.test(avant)));
        const j = libelle && jargon(sansChemins(m[1]));
        if (j) problemes.push(`${unix(fichier)} : ${j[0]} dans « ${m[1]} »`);
      }
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("écrans des commandes sans jargon", () => {
  const unix = (f) => f.split(path.sep).join("/");
  const problemes = [];
  // Écrans des commandes et des références (bloc de fin de commande, stratégie de tests…).
  const references = PLUGINS.flatMap((p) => fichiers(path.join(p, "references"), ".md"));
  for (const fichier of [...SKILLS_PAR_PLUGIN, ...references]) {
    // Clôtures lues dans l'ordre : seul le contenu d'un bloc ouvert par ``` ou ```text est un écran (un bloc de code est sauté).
    // Dans readme.md du pack, les blocs ```markdown sont le texte du README du projet de la personne : lus aussi.
    const ecrans = new Set(["", "text", ...(unix(fichier).endsWith("pulse-vibe-next/references/readme.md") ? ["markdown"] : [])]);
    let bloc = null;
    for (const ligne of lire(fichier).split("\n")) {
      const cloture = /^\s*```\s*(\S*)/.exec(ligne);
      if (cloture) {
        bloc = bloc === null ? (ecrans.has(cloture[1]) ? "ecran" : "code") : null;
        continue;
      }
      if (bloc !== "ecran") continue;
      if (/\/pulse:[a-z-]+ →|→ \/pulse:/.test(ligne)) continue; // chemin de commandes
      const j = jargon(sansChemins(ligne));
      if (j) problemes.push(`${unix(path.relative(DEPOT, fichier))} : ${j[0]} dans « ${ligne.trim().slice(0, 60)} »`);
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("documents lus par la personne sans sigles de méthode", () => {
  for (const f of ["plugins/pulse-vibe/README.md", "docs/memo-commandes.md", "plugins/pulse-vibe/references/fichiers-projet.md", "plugins/pulse-vibe/references/cycle.md"])
    assert.doesNotMatch(lire(DEPOT, f), /\b(INVEST|MoSCoW|Definition of Ready|storytelling)\b|TBD:/, f);
  assert.doesNotMatch(lire(RACINE, "templates", "CLAUDE.md"), /\(\{fuseau_horaire\}\)/, "fuseau horaire écrit en mots");
});

test("README et mémo sans « MVP », « epic » ni « demande de fusion » (hors chemins et code)", () => {
  const problemes = [];
  for (const f of ["plugins/pulse-vibe/README.md", "plugins/pulse-vibe-next/README.md", "docs/memo-commandes.md"]) {
    lire(DEPOT, f).split("\n").forEach((ligne, i) => {
      const m = /\bMVP\b/.exec(sansChemins(ligne)) || /\b(epics?|demandes? de fusion)\b/i.exec(sansChemins(ligne));
      if (m) problemes.push(`${f}:${i + 1} : ${m[0]}`);
    });
  }
  assert.deepStrictEqual(problemes, []);
});

// Ce que la personne lit hors des commandes : documents de son projet (modèles), tableau des fichiers et cycle des commandes,
// verdicts de pulse-aidd etat, messages du garde-fou des commandes.
// Chemins, code, emplacements <…> et commentaires HTML (consignes pour l'IA) exclus.
const motDeMethode = (texte) => /\bMVP\b/.exec(sansChemins(texte)) || /\b(epics?|demandes? de fusion|worktrees?)\b/i.exec(sansChemins(texte));
// Chaînes entre guillemets doubles d'un script, et raisons des verdicts écrites entre accents graves (sans les ${…}).
const chainesDuScript = (source) => [
  ...[...source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]),
  ...[...source.matchAll(/verdict\("R\d+", "[^"]*", `([^`]*)`/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, " ")),
];

test("modèles et sorties des outils lus par la personne sans « MVP », « epic », « demande de fusion » ni « worktree »", () => {
  const problemes = [];
  const modeles = path.join(RACINE, "templates");
  const documents = [
    ...lister(modeles).filter((f) => f.endsWith(".md")).map((f) => path.join(modeles, f)),
    path.join(DEPOT, "plugins", "pulse-vibe-next", "references", "technical.md"),
    path.join(RACINE, "references", "fichiers-projet.md"),
    path.join(RACINE, "references", "cycle.md"),
  ];
  for (const fichier of documents) {
    // Le lexique explique le mot « worktree » (décision du contrôleur) : seul ce mot y reste permis.
    const lexique = path.basename(fichier) === "lexique.md";
    lire(fichier).replace(/<!--[\s\S]*?-->/g, "").split("\n").forEach((ligne, i) => {
      const m = motDeMethode(lexique ? ligne.replace(/\bworktrees?\b/gi, " ") : ligne);
      if (m) problemes.push(`${path.relative(DEPOT, fichier).split(path.sep).join("/")}:${i + 1} : ${m[0]}`);
    });
  }
  for (const script of ["etat.js", "guide.js", "garde-commandes.js"]) {
    // Une chaîne d'un seul mot (« worktrees », « --worktree ») est du code : un nom de dossier ou une option de Git.
    for (const chaine of chainesDuScript(lire(RACINE, "scripts", script)).filter((c) => /\s/.test(c.trim()))) {
      const m = motDeMethode(chaine);
      if (m) problemes.push(`scripts/${script} : ${m[0]} dans « ${chaine.slice(0, 60)} »`);
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("phrases dites à la personne sans « MVP », « worktree » ni « demande de fusion » (commandes du parcours Git et du PRD)", () => {
  // Permis : un titre de section ou de référence cité (lu par l'IA), et la phrase qui explique le mot « worktree ».
  const PERMIS = /^\d+\. |^Travailler dans un worktree$|^Un worktree est /;
  const problemes = [];
  const fichiers = [...["cicd", "pr", "prd", "refine", "status", "implement", "spirc"].map((s) => path.join("skills", s, "SKILL.md")), path.join("references", "worktree.md"), path.join("references", "depot-distant.md")];
  for (const f of fichiers) {
    for (const ligne of lire(RACINE, f).split("\n")) {
      for (const m of ligne.matchAll(/« ((?:[^«»]|«[^«»]*»)+) »/g)) {
        const j = /\bMVP\b|\bworktrees?\b|\bdemandes? de fusion\b/i.exec(sansChemins(m[1]));
        if (j && !PERMIS.test(m[1])) problemes.push(`${f.split(path.sep).join("/")} : ${j[0]} dans « ${m[1].slice(0, 60)} »`);
      }
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("messages du garde-fou sur les branches et les secrets du dépôt sans jargon", () => {
  const source = lire(RACINE, "scripts", "garde-commandes.js");
  for (const cle of ["brancheForcee", "secretsDepot"]) {
    // Le message : ses chaînes "…", de « cle: » à la clé suivante du tableau MESSAGES.
    const bloc = source.split(`\n  ${cle}:`)[1]?.split(/\n  [A-Za-z]+:/)[0];
    assert.ok(bloc, `message ${cle} trouvé`);
    const message = [...bloc.matchAll(/"([^"]*)"/g)].map((m) => m[1]).join("");
    assert.match(message, /^Pulse /, `${cle} : message lu en entier`);
    const j = jargon(sansChemins(message));
    assert.strictEqual(j && j[0], null, `${cle} : ${j && j[0]}`);
  }
});

test("questions et accueil en clair : les anciens libellés ont disparu", () => {
  const unix = (f) => f.split(path.sep).join("/");
  const ANCIENS = /Implémentation via sous-agent|Implémentation directe|Valider et verrouiller|[Ee]xamen renforcé|« Renforcé »|« Travailler dans un worktree \(|« Reprendre dans le worktree|AI-Driven Development/;
  assert.deepStrictEqual(TEXTES.filter(({ texte }) => ANCIENS.test(texte)).map(({ fichier }) => unix(fichier)), []);
  for (const f of ["CLAUDE.md", "banniere.txt"]) assert.doesNotMatch(lire(RACINE, "templates", f), /AI-Driven/, f);
  assert.doesNotMatch(lire(RACINE, "templates", "plan.md"), /kanban/i);
  assert.doesNotMatch(lire(RACINE, "templates", "CLAUDE.md"), /kanban/i);
});

test("les envois, fusions et récupérations soumis à l'accord sont annoncés en une phrase", () => {
  const ANNONCE = /Claude Code (va|vous) (vous )?demander/;
  for (const [fichier, motif] of [
    [["skills", "commit", "SKILL.md"], /### 7\. Envoyer[\s\S]*Claude Code va vous demander/],
    [["skills", "pr", "SKILL.md"], /Claude Code va vous demander l'accord pour \x60git pull\x60[\s\S]*Claude Code va vous demander l'accord pour envoyer/],
    [["skills", "deploy", "SKILL.md"], /## 4\. Mise à jour\s+1\. Annoncer : « Claude Code va vous demander/],
    [["skills", "cicd", "SKILL.md"], /Annoncer : « Claude Code va vous demander[^\n]*Puis l'envoyer \(\x60git push\x60/],
    [["references", "worktree.md"], /\*\*Fusionner\*\* :[\s\S]*Claude Code va vous demander/],
  ]) {
    const texte = lire(RACINE, ...fichier);
    assert.match(texte, ANNONCE, fichier.join("/"));
    assert.match(texte, motif, fichier.join("/"));
  }
});

test("deploy : chaque envoi est annoncé avant la demande d'accord, dans sa section", () => {
  const sections = lire(RACINE, "skills", "deploy", "SKILL.md").split(/^## /m).filter((s) => /git push/.test(s));
  assert.ok(sections.length >= 4, "sections avec envoi");
  for (const s of sections) assert.match(s, /Claude Code va vous demander l'accord|Chaque envoi déclenche une demande d'accord|accord annoncé au § 3/, s.slice(0, 30));
});

test("commit et annuler nomment la forme `git commit -m`, et commit utilise `git remote -v`", () => {
  for (const s of ["commit", "annuler"]) assert.match(lire(RACINE, "skills", s, "SKILL.md"), /git commit -m "<sujet>" -m "<corps>"|git commit -m "revert\(/, s);
  const commit = lire(RACINE, "skills", "commit", "SKILL.md");
  assert.match(commit, /git commit -m "<sujet>" -m "<corps>"/);
  assert.doesNotMatch(commit, /`git remote`/);
  assert.match(commit, /`git remote -v`/);
  assert.match(commit, /contrôle de sécurité à chaque tâche/);
});

test("prd, us, spec et plan lisent et écrivent leurs documents sans demande d'autorisation", () => {
  const attendus = {
    prd: ["Read", "Glob", "Grep", "Write(docs/prd.md)", "Edit(docs/prd.md)", "Write(aidd_docs/tasks/in-progress.md)", "Edit(aidd_docs/tasks/in-progress.md)"],
    us: ["Read", "Glob", "Grep", "Write(docs/user-stories.md)", "Edit(docs/user-stories.md)", "Write(aidd_docs/tasks/**)", "Edit(aidd_docs/tasks/**)"],
    spec: ["Read", "Glob", "Grep", "Write(aidd_docs/tasks/**)", "Edit(aidd_docs/tasks/**)", "Edit(docs/user-stories.md)", "Edit(docs/prd.md)"],
    plan: ["Read", "Glob", "Grep", "Write(aidd_docs/tasks/**)", "Edit(aidd_docs/tasks/**)"],
  };
  for (const [skill, outils] of Object.entries(attendus)) {
    const ligne = (skillTexte(skill).match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
    const jetons = ligne.match(/[A-Za-z]+(?:\([^)]*\))?/g) || [];
    for (const outil of [...outils, "Write(docs/lexique.md)", "Edit(docs/lexique.md)"]) assert.ok(jetons.includes(outil), `${skill} : ${outil} manquant`);
  }
});

test("les commandes qui écrivent des documents, ou enchaînent des étapes qui le font, les écrivent sans demande d'autorisation", () => {
  const attendus = {
    brainstorm: ["Write(docs/brief.md)", "Edit(docs/brief.md)"],
    init: ["Write(docs/brief.md)", "Write(docs/prd.md)", "Write(docs/user-stories.md)", "Write(aidd_docs/tasks/**)", "Edit(aidd_docs/tasks/**)", "Write(docs/lexique.md)"],
    express: ["Write(docs/brief.md)", "Write(docs/prd.md)", "Write(docs/user-stories.md)", "Write(aidd_docs/tasks/**)", "Edit(aidd_docs/tasks/**)", "Write(docs/lexique.md)"],
    spirc: ["Write(aidd_docs/tasks/**)", "Edit(aidd_docs/tasks/**)", "Edit(docs/prd.md)", "Edit(docs/user-stories.md)", "Write(docs/lexique.md)"],
    implement: ["Write(aidd_docs/tasks/**)", "Edit(aidd_docs/tasks/**)", "Edit(docs/prd.md)"],
    review: ["Write(aidd_docs/tasks/**)", "Edit(aidd_docs/tasks/**)"],
    commit: ["Write(aidd_docs/tasks/**)", "Edit(aidd_docs/tasks/**)"],
  };
  for (const [skill, outils] of Object.entries(attendus)) {
    const ligne = (skillTexte(skill).match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
    const jetons = ligne.match(/[A-Za-z]+(?:\([^)]*\))?/g) || [];
    for (const outil of outils) assert.ok(jetons.includes(outil), `${skill} : ${outil} manquant`);
  }
  assert.match(lire(RACINE, "references", "examen.md"), /Claude Code demande alors l'accord de la personne pour démarrer l'application/);
});

test("allowed-tools : les écritures autorisées d'avance restent dans docs/ et aidd_docs/", () => {
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const ligne = (lire(fichier).match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
    for (const [, outil, motif] of ligne.matchAll(/\b(Write|Edit|MultiEdit)\(([^)]*)\)/g)) {
      if (!/^(docs|aidd_docs)\/\S+$/.test(motif)) problemes.push(`${path.relative(DEPOT, fichier).split(path.sep).join("/")} : ${outil}(${motif})`);
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("tests automatiques : installer un outil de test est recommandé quand la pile en a un", () => {
  const texte = lire(RACINE, "references", "tests-automatiques.md");
  assert.match(texte, /« Installer un outil de test \(Recommandé\) »/);
  assert.match(texte, /« Sans tests automatiques »/);
});

test("modèle CLAUDE.md, agents et références cohérents entre eux", () => {
  const claude = lire(RACINE, "templates", "CLAUDE.md");
  assert.doesNotMatch(claude, /uniquement sur demande/);
  assert.match(claude, /boucles de `\/pulse:implement` et `\/pulse:spirc`/);
  assert.doesNotMatch(claude, /traces de travail par session/);
  assert.match(lire(RACINE, "agents", "explorer.md").match(/^description:.*$/m)[0], /\/pulse:get-help/);
  assert.match(skillTexte("ui"), /quatre références de design/);
  assert.doesNotMatch(skillTexte("ui"), /trois références/);
});

test("la règle deny se propose en clair : le bloc JSON se montre seulement sur demande", () => {
  for (const s of ["init", "secrets"]) {
    const texte = lire(RACINE, "skills", s, "SKILL.md");
    assert.doesNotMatch(texte, /montrer le bloc/i, `${s} : ne plus montrer le bloc d'office`);
    assert.match(texte, /bloc[^.]*sur demande/i, `${s} : le bloc reste disponible sur demande`);
  }
});

test("production : retour arrière dans le modèle technical.md et dans deploy ; variables propres à chaque environnement", () => {
  const modele = lire(RACINE, "templates", "technical.md");
  assert.match(modele, /\n## Retour arrière\n/);
  assert.ok(modele.indexOf("## Retour arrière") < modele.indexOf("## Référencement"), "après « Hébergement et mise en ligne »");
  const deploy = lire(RACINE, "skills", "deploy", "SKILL.md");
  assert.match(deploy, /section « Retour arrière » de `docs\/technical\.md`/);
  assert.match(deploy, /propre à chaque environnement/);
  assert.match(lire(RACINE, "references", "secrets", "sans-conversation.md"), /--meme-valeur/);
});

test("mise en production : une sonde de disponibilité est proposée et notée", () => {
  assert.match(lire(RACINE, "skills", "deploy", "SKILL.md"), /\*\*Surveillance\*\*/);
  assert.match(lire(RACINE, "templates", "technical.md"), /^- Surveillance : /m);
});

test("règles communes : le noyau seul ; fichiers du projet et cycle dans leurs références", () => {
  const communes = lire(RACINE, "references", "regles-communes.md");
  for (const titre of ["## 1. À qui vous parlez", "## 3. Garde-fous de la méthode", "## 4. Format de fin de commande", "## 6. Les constats de relecture"])
    assert.ok(communes.includes(titre), titre);
  assert.ok(!communes.includes("| Fichier | Produit par | Contenu |"), "tableau des fichiers sorti des règles communes");
  assert.ok(!communes.includes("/pulse:init → /pulse:brainstorm"), "cycle sorti des règles communes");
  assert.ok(communes.includes("pulse-aidd reference fichiers-projet.md"), "renvoi vers les fichiers du projet");
  assert.ok(communes.includes("pulse-aidd reference cycle.md"), "renvoi vers le cycle");
  const fichiersProjet = lire(RACINE, "references", "fichiers-projet.md");
  assert.ok(fichiersProjet.includes("| Fichier | Produit par | Contenu |"));
  assert.ok(fichiersProjet.split("\n").filter((l) => l.startsWith("| `")).length >= 30, "les lignes du tableau");
  for (const f of ["`CLAUDE.md`", "`docs/technical.md`", "`aidd_docs/tasks/in-progress.md`", "`docs/lexique.md`", "`aidd_docs/memory/internal/decisions/`"])
    assert.ok(fichiersProjet.includes(`| ${f} |`), f);
  const cycle = lire(RACINE, "references", "cycle.md");
  assert.ok(cycle.includes("/pulse:init → /pulse:brainstorm"));
  assert.ok(cycle.includes('`/pulse:spirc <US-XXX> [tâche | "demande"]`'));
});

test("une étape enchaînée par une commande se charge sans les règles communes", () => {
  const sources = [...fichiers(path.join(RACINE, "skills"), ".md"), ...fichiers(path.join(RACINE, "references"), ".md")];
  const problemes = [];
  for (const f of sources) {
    const corps = lire(f).replace(/^---\n[\s\S]*?\n---\n/, "");
    for (const m of corps.matchAll(/pulse-aidd etape (\S+)( --sans-communes)?/g))
      if (!m[2]) problemes.push(`${path.relative(DEPOT, f)} : pulse-aidd etape ${m[1]}`);
  }
  assert.deepStrictEqual(problemes, []);
});

test("les sous-commandes etape, reference et qualite citées par un skill sont permises par son allowed-tools", () => {
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const motifs = motifsBash(fichier);
    const corps = lire(fichier).replace(/^---\n[\s\S]*?\n---\n/, "");
    for (const [, citation] of corps.matchAll(/`(pulse-aidd (?:etape|reference|qualite)\b[^`]*)`/g)) {
      const commande = essai(citation);
      if (!motifs.some((m) => couvre(m, commande))) problemes.push(`${path.relative(DEPOT, fichier)} : ${commande}`);
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("règles communes : les documents du projet restent appliqués par les commandes qui écrivent", () => {
  const { spawnSync } = require("child_process");
  for (const commande of ["implement", "spec", "spirc"]) {
    const r = spawnSync("bash", ["bin/pulse-aidd", "contexte", commande], { cwd: RACINE, encoding: "utf8" });
    for (const doc of ["docs/design.md", "docs/seo.md", "docs/textes", "docs/voix.md"])
      assert.ok(r.stdout.includes(doc), `${commande} : ${doc}`);
  }
});

test("les lectures de fichiers-projet.md et cycle.md, citées par les règles communes, sont permises dans chaque skill", () => {
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const motifs = motifsBash(fichier);
    for (const ref of ["fichiers-projet.md", "cycle.md"])
      if (!motifs.some((m) => couvre(m, `pulse-aidd reference ${ref}`))) problemes.push(`${path.relative(DEPOT, fichier)} : ${ref}`);
  }
  assert.deepStrictEqual(problemes, []);
});

test("checklist sécurité : chargée par les agents qui relisent, plus recopiée dans les délégations", () => {
  for (const agent of ["reviewer", "security-auditor"]) {
    const texte = lire(RACINE, "agents", `${agent}.md`);
    assert.ok(texte.includes("pulse-aidd reference checklist-securite.md"), `${agent} charge la checklist`);
    const entete = texte.match(/^---\n([\s\S]*?)\n---/)[1];
    const liste = (cle) => ((entete.match(new RegExp(`^${cle}:\s*(.*)$`, "m")) || [])[1] || "").split(",").map((t) => t.trim()).filter(Boolean);
    const permis = liste("tools");
    assert.ok(permis.length ? permis.includes("Bash") : !liste("disallowedTools").includes("Bash"), `${agent} a Bash`);
  }
  for (const fichier of [["skills", "review", "SKILL.md"], ["skills", "spirc", "SKILL.md"], ["skills", "security", "SKILL.md"], ["references", "examen.md"]])
    assert.doesNotMatch(lire(RACINE, ...fichier), /checklist sécurité complète/, fichier.join("/"));
});

test("boucles d'implement et de spirc : review et commit chargés une seule fois", () => {
  const implement = lire(RACINE, "skills", "implement", "SKILL.md");
  const boucle = implement.slice(implement.indexOf("### 6. Boucle sur tout le plan"));
  assert.match(boucle, /\*\*Avant la première tâche\*\*/);
  assert.strictEqual((boucle.match(/pulse-aidd etape review --sans-communes/g) || []).length, 1, "review chargée une fois");
  assert.strictEqual((boucle.match(/pulse-aidd etape commit --sans-communes/g) || []).length, 1, "commit chargée une fois");
  const spirc = lire(RACINE, "skills", "spirc", "SKILL.md");
  assert.strictEqual((spirc.match(/pulse-aidd etape commit --sans-communes/g) || []).length, 1, "spirc : commit chargée une fois");
  for (const ref of ["pulse-aidd reference worktree.md", "pulse-aidd reference tests-automatiques.md", "pulse-aidd reference memoire.md"])
    assert.ok(spirc.includes(ref), ref);
});

test("chaque agent a un modèle explicite (model:)", () => {
  // Valeurs acceptées par Claude Code : https://code.claude.com/docs/en/sub-agents
  const MODELES = /^(sonnet|opus|haiku|fable|inherit|claude-[a-z0-9-]+)$/;
  const problemes = [];
  for (const fichier of AGENTS_PAR_PLUGIN) {
    const entete = (lire(fichier).match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
    const modele = (entete.match(/^model:\s*(\S+)\s*$/m) || [])[1];
    if (!modele || !MODELES.test(modele)) problemes.push(`${path.relative(DEPOT, fichier)} : ${modele || "absent"}`);
  }
  assert.deepStrictEqual(problemes, []);
});

test("reprise : spirc et implement rechargent les références de la réalisation, implement vérifie le dépôt distant", () => {
  const spirc = lire(RACINE, "skills", "spirc", "SKILL.md");
  assert.match(spirc, /y compris une reprise[^\n]*ne figurent pas dans la conversation, lancer les commandes de « Choisir la façon de travailler »/);
  assert.match(spirc, /avant la première tâche, le test groupé ou la fin/);
  const groupe = spirc.slice(spirc.indexOf("## Test groupé"));
  assert.equal((groupe.match(/Choisir la façon de travailler/g) || []).length, 2, "test groupé et fin rappellent le rechargement");
  const implement = lire(RACINE, "skills", "implement", "SKILL.md");
  assert.match(implement, /y compris à une reprise/);
  assert.match(implement, /dès qu'un dépôt distant existe, lancer `pulse-aidd reference depot-distant\.md`/);
});

// ---------------------------------------------------------------- Références atteignables

// Une référence sert si l'outil du plugin l'affiche ($REF/<chemin>), si une consigne la nomme sur une ligne qui
// charge des références (`pulse-aidd reference …`, `pulse-aidd pile reference …`, ou une liste qui suit), ou si
// un script la lit. Les recettes du pack sont servies par « recette <nom> » (references-structure.test.js).
test("chaque référence est atteignable : affichée par l'outil, nommée pour être chargée, ou lue par un script", () => {
  const citees = new Set();
  for (const f of PLUGINS.flatMap((p) => ["skills", "agents", "references", "templates"].flatMap((d) => fichiers(path.join(p, d), ".md"))))
    for (const ligne of lire(f).split("\n"))
      if (/\breference /.test(ligne)) for (const m of ligne.matchAll(/[\w-]+(?:\/[\w.-]+)*\.(?:md|json)/g)) citees.add(m[0]);
  const manquantes = [];
  for (const p of PLUGINS) {
    const ref = path.join(p, "references");
    const outils = lister(path.join(p, "bin")).filter((f) => !f.includes(".")).map((f) => lire(p, "bin", f)).join("\n");
    const scripts = fichiers(path.join(p, "scripts"), ".js").map((f) => lire(f)).join("\n");
    for (const f of [...fichiers(ref, ".md"), ...fichiers(ref, ".json")]) {
      const r = path.relative(ref, f).split(path.sep).join("/");
      if (r.startsWith("recettes/")) continue;
      if (outils.includes(`$REF/${r}`) || citees.has(r) || scripts.includes(path.basename(r))) continue;
      manquantes.push(path.relative(DEPOT, f).split(path.sep).join("/"));
    }
  }
  assert.deepStrictEqual(manquantes, []);
});

test("les textes lus par la personne nomment les plugins pulse et pulse-next (les anciens noms restent dans les chemins)", () => {
  // Un ancien nom employé comme nom : ni dans un chemin (plugins/pulse-vibe/, jdelauney/pulse-vibe), ni dans un nom d'installation.
  const ANCIEN = /(?<![\w./@-])pulse-vibe(?:-next)?(?![\w/@.-])/;
  const trouves = [];
  for (const p of PLUGINS) {
    const textes = [
      ...["skills", "agents", "references", "templates"].flatMap((d) => fichiers(path.join(p, d), ".md")),
      ...lister(path.join(p, "bin")).filter((f) => !f.includes(".")).map((f) => path.join(p, "bin", f)),
    ];
    for (const f of textes)
      lire(f).split("\n").forEach((ligne, i) => {
        if (ANCIEN.test(ligne)) trouves.push(`${path.relative(DEPOT, f).split(path.sep).join("/")}:${i + 1}`);
      });
  }
  assert.deepStrictEqual(trouves, []);
});

test("reprise après une interruption : commit, implement, spirc et review suivent pulse-aidd revue ; commit refuse une tâche sans test", () => {
  const commit = skillTexte("commit");
  const verification = commit.slice(commit.indexOf("### 2."), commit.indexOf("### 3."));
  assert.match(verification, /`pulse-aidd revue <Tn>`/);
  assert.match(verification, /- `test` : [^\n]*Enregistrer seulement une tâche testée/);
  assert.match(verification, /- `correction` ou `aide` : [^\n]*S'arrêter/);
  assert.doesNotMatch(verification, /`test`[^\n]*Enregistrer quand même/, "l'enregistrement sans test n'est pas proposé");
  const implement = skillTexte("implement");
  assert.match(implement, /\*\*Reprendre une tâche en cours\*\* : [^\n]*`pulse-aidd revue <Tn>`/);
  assert.match(implement, /- `test` : au test manuel/);
  assert.doesNotMatch(implement, /reprend à la correction ou au commit/);
  const spirc = skillTexte("spirc");
  assert.match(spirc, /Une tâche `\[~\]` est reprise là où elle en était : lancer `pulse-aidd revue <Tn>`/);
  assert.doesNotMatch(spirc, /reprendre à l'examen\)/);
  assert.match(skillTexte("review"), /`pulse-aidd revue <Tn>` : `test` → passer directement au § 5/);
  // Les boucles passent à l'enregistrement sur la réponse du § 2 de commit, pas sur la seule existence d'un rapport.
  for (const [nom, texte] of [["implement", implement], ["spirc", spirc]]) {
    assert.match(texte, /Le § 2 de l'étape commit donne `commit`/, nom);
    assert.doesNotMatch(texte, /Le rapport de revue existe : la relecture est faite/, nom);
  }
  // Le résultat du test s'écrit avec les choix du modèle, que pulse-aidd revue sait lire.
  for (const nom of ["review", "spirc"]) assert.match(skillTexte(nom), /« ✅ concluant » ou « ❌ non concluant : <ce qui ne va pas> »/, nom);
});

test("commit : un commit docs:, chore: ou sans rapport avec la tâche n'est jamais refusé pour un test en attente", () => {
  const commit = skillTexte("commit");
  const verification = commit.slice(commit.indexOf("### 2."), commit.indexOf("### 3."));
  assert.match(verification, /tâches `\[~\]`[^\n]* concernées par ce commit : celles dont les fichiers en font partie/);
  assert.match(verification, /Un commit sans tâche concernée \(`docs:`, `chore:`[^\n]*s'enregistre toujours[^\n]*« T3 attend encore votre test\. »/);
  assert.doesNotMatch(verification, /sur une branche `feat\/us-xxx-<nom>`, seulement/, "le périmètre suit les fichiers du commit, pas la branche");
});

test("règle 16 : chaque commande qui attend une décision structurante la sauvegarde, et peut l'effacer", () => {
  const COMMANDES = ["express", "brainstorm", "prd", "us", "spirc", "implement", "tech", "ui", "spec", "plan", "search-console"];
  const regles = lire(RACINE, "references", "regles-communes.md");
  const regle16 = regles.split("\n").find((l) => l.startsWith("16. "));
  const fichiersProjet = lire(RACINE, "references", "fichiers-projet.md").split("\n").find((l) => l.startsWith("| `aidd_docs/tasks/in-progress.md` |"));
  for (const c of COMMANDES) {
    assert.ok(regle16.includes(`\`/pulse:${c}\``), `règle 16 : /pulse:${c}`);
    assert.ok(fichiersProjet.includes(`\`/pulse:${c}\``), `fichiers-projet.md : /pulse:${c}`);
    const texte = skillTexte(c);
    assert.match(texte, /aidd_docs\/tasks\/in-progress\.md|règle commune 16/, `${c} : écrit le travail en cours`);
    const motifs = motifsBash(path.join(RACINE, "skills", c, "SKILL.md"));
    assert.ok(motifs.some((m) => couvre(m, "pulse-aidd travail-fini")), `${c} : pulse-aidd travail-fini autorisé`);
    const ligne = (texte.match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
    assert.ok(/Write\(aidd_docs\/tasks\/(in-progress\.md|\*\*)\)/.test(ligne), `${c} : écriture du travail en cours autorisée`);
  }
});

test("fin d'un dossier à part : la proposition passe « prête » en mode PR ; mode découverte sur la version principale", () => {
  const worktree = lire(RACINE, "references", "worktree.md");
  const fin = worktree.slice(worktree.indexOf("## 3. Terminer"), worktree.indexOf("**Fusionner** :"));
  const pr = fin.split("\n").find((l) => l.startsWith("- **Envoi PR**"));
  assert.ok(pr, "cas « Envoi PR »");
  assert.match(pr, /« Marquer la proposition comme prête à accepter »/);
  assert.match(pr, /« \(Recommandé\) » va à la première quand toutes les tâches du plan sont terminées, sinon à « Garder le dossier à part »/);
  assert.match(pr, /marquée prête, sortir du dossier à part \(outil `ExitWorktree`/);
  assert.match(lire(RACINE, "references", "depot-distant.md"), /Chaque envoi passe toujours par la demande d'autorisation de Claude Code/);
  for (const skill of ["tech", "ui"]) assert.match(skillTexte(skill), /étape de `\/pulse:express`[^)]*: le réécrire plutôt pour cette commande, à son étape suivante\)/, skill);
  assert.doesNotMatch(pr, /Rassembler dans/, "pas de fusion locale proposée en mode PR");
  assert.match(fin, /- \*\*Autre envoi\*\*[^\n]*« Rassembler dans `<branche de départ>` maintenant \(Recommandé\) »/);
  const depot = lire(RACINE, "references", "depot-distant.md");
  assert.match(depot, /« Une version parallèle pour l'US, publiée quand vous l'acceptez sur le site du dépôt \(Recommandé\) »/);
  assert.match(depot, /En mode découverte \(règles communes § 1\)[^\n]*« Directement sur la version principale »/);
  const regles = lire(RACINE, "references", "regles-communes.md");
  assert.match(regles, /sauf l'envoi, qui prend « Directement sur la version principale »/);
});

test("vocabulaire : branche = version parallèle, worktree = dossier à part, écrits une fois dans le lexique", () => {
  const unix = (f) => f.split(path.sep).join("/");
  const lexique = lire(RACINE, "templates", "lexique.md");
  for (const image of ["une version parallèle du projet", "un dossier à part du projet", "la proposition de rassembler une version parallèle dans la version principale"])
    assert.ok(lexique.includes(image), `lexique : ${image}`);
  assert.match(lire(RACINE, "references", "git.md"), /Une \*\*branche\*\* est une version parallèle du projet/);
  assert.match(skillTexte("pr"), /« Une branche, c'est une version parallèle de votre projet/);
  assert.match(lire(RACINE, "references", "worktree.md"), /« Un worktree est un dossier à part du projet/);
  const sources = [...TEXTES, { fichier: path.join("plugins", "pulse-vibe", "scripts", "guide.js"), texte: lire(RACINE, "scripts", "guide.js") }];
  assert.deepStrictEqual(sources.filter(({ texte }) => /copie (de travail|à part)|copie séparée/i.test(texte)).map(({ fichier }) => unix(fichier)), []);
});

test("forme : « (Recommandé) » avec majuscule, chemin des commandes dans cycle.md seulement, en-tête de spirc sans parenthèses imbriquées", () => {
  const unix = (f) => f.split(path.sep).join("/");
  assert.deepStrictEqual(TEXTES.filter(({ texte }) => /\(recommandé\) »/.test(texte)).map(({ fichier }) => unix(fichier)), []);
  const chemins = TEXTES.filter(({ texte }) => /\/pulse:prd → \/pulse:tech/.test(texte)).map(({ fichier }) => unix(fichier));
  assert.deepStrictEqual(chemins, ["plugins/pulse-vibe/references/cycle.md"]);
  const cycle = lire(RACINE, "references", "cycle.md");
  assert.ok(cycle.includes("(/pulse:ui maquettes <US-XXX>)") && cycle.includes("/pulse:spirc <US-XXX>"), "cycle complet");
  assert.match(cycle, /`\/pulse:status` \(où en suis-je \?\)/);
  assert.doesNotMatch(skillTexte("init"), /\/pulse:init \(où j'en suis\)/);
  const entete = skillTexte("spirc").split("\n").find((l) => l.startsWith("Appliquer les « Règles communes Pulse »"));
  assert.doesNotMatch(entete, /\([^()]*\([^()]*\)[^()]*\)|\) \(/, "parenthèses imbriquées ou accolées");
});

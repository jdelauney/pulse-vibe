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
  assert.deepStrictEqual(absentes(citations(/pulse-aidd modele ([\w.-]+[\w])/g), (v) => fs.existsSync(path.join(RACINE, "templates", v)) || fs.existsSync(path.join(RACINE, "skills", v.split("/")[0], "assets", v.split("/").slice(1).join("/")))), []);
  assert.deepStrictEqual(absentes(citations(/pulse-aidd reference ([\w./-]+\.md)/g), (v) => fs.existsSync(path.join(RACINE, "references", v)) || fs.existsSync(path.join(RACINE, "skills", v.split("/")[0], "references", v.split("/").slice(1).join("/")))), []);
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

test("aucune consigne ne cite pulse-aidd reference design/ (les références de design sont dans ui/)", () => {
  const fautifs = [...fichiers(path.join(RACINE, "skills"), "SKILL.md"), ...AGENTS_PAR_PLUGIN].filter((f) => /pulse-aidd reference design\//.test(lire(f))).map((f) => path.relative(DEPOT, f));
  assert.deepStrictEqual(fautifs, []);
});

test("agents : chaque commande pulse-aidd citée figure dans la phrase « Utiliser … seulement/uniquement … » de l'agent", () => {
  const problemes = [];
  for (const fichier of AGENTS_PAR_PLUGIN) {
    const corps = lire(fichier);
    const phrase = (corps.match(/^- Utiliser (?:Bash seulement|uniquement des commandes en lecture)[^\n]*$/m) || [])[0];
    if (!phrase) continue;
    const reste = corps.replace(phrase, "");
    for (const m of reste.matchAll(/(?<!par `)pulse-aidd (pile (?:contexte|reference|recette)|[a-z][a-z-]*)/g)) {
      if (!phrase.includes("pulse-aidd " + m[1]) && !phrase.includes("pulse-aidd " + m[1].split(" ")[0] + " …")) problemes.push(path.relative(DEPOT, fichier) + " : pulse-aidd " + m[1]);
    }
  }
  assert.deepStrictEqual([...new Set(problemes)], []);
});

test("un agent qui doit corriger un fichier avec Edit a Edit dans tools (designer compris)", () => {
  const problemes = [];
  for (const fichier of AGENTS_PAR_PLUGIN) {
    const [, entete, corps] = lire(fichier).match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || [];
    const tools = ((entete.match(/^tools:\s*(.*)$/m) || [])[1] || "").split(",").map((x) => x.trim());
    if (/corriger[^.\n]*avec Edit/.test(corps) && !tools.includes("Edit")) problemes.push(path.relative(DEPOT, fichier));
  }
  assert.deepStrictEqual(problemes, []);
  const designer = lire(RACINE, "agents", "designer.md");
  assert.ok(/^tools:.*\bEdit\b/m.test(designer) && /corriger[^.\n]*avec Edit/.test(designer), "designer : corrige avec Edit");
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

test("en-têtes de sécurité : chaque en-tête de la checklist S12 est décrit dans security/entetes.md", () => {
  const s12 = lire(RACINE, "references", "checklist-securite.md").split("## S12")[1].split(/\n## S13|\n---/)[0];
  const entetes = lire(RACINE, "skills", "security", "references", "entetes.md");
  const noms = [...s12.matchAll(/\b[A-Z][a-zA-Z]*(?:-[A-Z][a-zA-Z]*)+\b/g)].map((m) => m[0]);
  assert.ok(noms.includes("Cross-Origin-Opener-Policy"), "S12 cite Cross-Origin-Opener-Policy");
  for (const nom of noms) assert.ok(entetes.includes(`| \`${nom}\` |`), `${nom} absent du tableau de entetes.md`);
  assert.ok(entetes.includes("browsing-topics=()"), "Permissions-Policy avec browsing-topics");
  assert.match(entetes, /prérend/, "règle nonce et pages prérendues");
  assert.match(entetes, /`preload`/, "règle preload");
  const rapide = lire(RACINE, "skills", "security", "references", "rapide.md");
  for (const nom of noms) assert.ok(rapide.includes(nom), `${nom} absent de security/rapide.md`);
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
  "pulse-aidd ligne-etat --installer", // change les réglages de Claude Code du projet
  "pulse-aidd ligne-etat --retirer",
  "pulse-aidd autorisations --ecrire", // change les réglages de Claude Code du projet
  "pulse-aidd copies --mettre-a-jour", // remplace des fichiers du projet
  "pulse-aidd search-console deconnecter",
  "pulse-aidd pile hebergeur envoyer NOM production",
  "pulse-aidd pile hebergeur redeployer production",
];
const estSensible = (commande) => /^pulse-aidd (secrets (generer|envoyer|elaguer|redeployer)|search-console deconnecter|pile hebergeur|installer-ci --forcer|ligne-etat --(installer|retirer)|autorisations --ecrire|copies --(mettre-a-jour|copier))\b/.test(commande);

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

// Règles communes : le noyau, puis les modules (tâches, relecture, réalisation) que « pulse-aidd contexte <commande> » affiche.
const MODULES_COMMUNES = { "Règles des tâches": "regles-taches.md", "Règles de relecture": "regles-relecture.md", "Règles de réalisation": "regles-realisation.md" };
const contextesCharges = new Map();
function contexteCharge(skill) { // le texte affiché par pulse-aidd contexte <skill>, sans pack de pile (cwd = racine du plugin)
  if (!contextesCharges.has(skill)) contextesCharges.set(skill, require("child_process").spawnSync("bash", ["bin/pulse-aidd", "contexte", skill], { cwd: RACINE, encoding: "utf8" }).stdout);
  return contextesCharges.get(skill);
}
const MODULES_COMMUNES_FICHIERS = Object.fromEntries(Object.values(MODULES_COMMUNES).map((f) => [f, true]));
const modulesCharges = (skill) => Object.entries(MODULES_COMMUNES).filter(([titre]) => contexteCharge(skill).includes(`===== ${titre} =====`)).map(([, fichier]) => fichier);

test("allowed-tools : chaque pulse-aidd cité par un skill, ou par une étape qu'il enchaîne, est autorisé d'avance", () => {
  assert.ok(couvre("pulse-aidd sonder *", "pulse-aidd sonder") && !couvre("pulse-aidd seo *", "pulse-aidd seobis") && couvre("pulse-aidd secrets inventaire*", "pulse-aidd secrets inventaire --json"), "règle de correspondance");
  const texteSkill = (s) => lire(RACINE, "skills", s, "SKILL.md");
  // Étapes enchaînées : chaque `pulse-aidd etape <commande>` nommée, de proche en proche.
  const enchainees = (depart) => {
    const vues = new Set([depart]);
    const aVoir = [depart];
    while (aVoir.length) {
      for (const c of citationsOutil(texteSkill(aVoir.pop()))) {
        const etape = (c.match(/^pulse-aidd etape ([a-z][a-z-]*)(?: --sans-(?:communes|noyau))?$/) || [])[1];
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
    // Les citations du noyau (outils cités pour toutes les commandes) sont contrôlées dans une tâche ultérieure ; les modules ne citent aucune commande pulse-aidd.
  }
  assert.deepStrictEqual([...new Set(manquants)], []);
});

test("étapes enchaînées : avec --sans-communes, les modules de l'étape sont déjà chargés par la commande qui l'enchaîne (sinon --sans-noyau, ou les modules lus à part)", () => {
  const sansEntete = (f) => lire(f).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  // Ce que la commande lit : son SKILL.md, et les références qu'elle nomme.
  const sources = (skill) => {
    const corps = sansEntete(path.join(RACINE, "skills", skill, "SKILL.md"));
    const textes = [corps];
    for (const m of corps.matchAll(/pulse-aidd reference ([\w./-]+\.md)|references\/([\w./-]+\.md)/g)) {
      const ref = m[1] || m[2];
      for (const chemin of [path.join(RACINE, "references", ref), path.join(RACINE, "skills", skill, "references", ref), path.join(RACINE, "skills", ...ref.split("/").slice(0, 1), "references", ...ref.split("/").slice(1))])
        if (fs.existsSync(chemin) && fs.statSync(chemin).isFile()) textes.push(sansEntete(chemin));
    }
    return textes.join("\n");
  };
  const problemes = [];
  let verifiees = 0;
  for (const parent of SKILLS) {
    const disponibles = new Set(modulesCharges(parent));
    const vues = new Set([parent]);
    const aVoir = [parent];
    while (aVoir.length) {
      const courant = aVoir.pop();
      // Un module lu à part (« pulse-aidd reference regles-taches.md ») est chargé comme s'il venait du contexte.
      for (const x of Object.values(MODULES_COMMUNES)) if (sources(courant).includes(`pulse-aidd reference ${x}`)) disponibles.add(x);
      for (const m of sources(courant).matchAll(/pulse-aidd etape ([a-z][a-z-]*) (--sans-communes|--sans-noyau)/g)) {
        const [, etape, option] = m;
        if (!SKILLS.has(etape)) continue;
        verifiees++;
        if (option === "--sans-communes") {
          const manque = modulesCharges(etape).filter((x) => !disponibles.has(x));
          if (manque.length) problemes.push(`${parent} → ${etape} (cité par ${courant}) : --sans-communes sans ${manque.join(", ")}`);
        } else for (const x of modulesCharges(etape)) disponibles.add(x);
        if (!vues.has(etape)) { vues.add(etape); aVoir.push(etape); }
      }
    }
  }
  assert.ok(verifiees > 40, "étapes enchaînées relevées : " + verifiees);
  assert.deepStrictEqual([...new Set(problemes)], []);
});

test("règles communes : chaque mention d'un module (règles de relecture, de réalisation, des tâches, mode découverte) vient d'une commande qui le charge", () => {
  // Mention -> module que la commande doit charger. « règles des tâches » : le module T.
  const MENTIONS = [[/règles de relecture/i, "regles-relecture.md"], [/règles de réalisation|mode découverte/i, "regles-realisation.md"], [/règles des tâches/i, "regles-taches.md"]];
  const sansEntete = (f) => lire(f).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  const problemes = [];
  let verifiees = 0;
  // Un SKILL.md : la commande elle-même charge le module.
  for (const skill of SKILLS) {
    const corps = sansEntete(path.join(RACINE, "skills", skill, "SKILL.md"));
    for (const [motif, module] of MENTIONS)
      if (motif.test(corps)) {
        verifiees++;
        if (!modulesCharges(skill).includes(module)) problemes.push(`skills/${skill}/SKILL.md : ${motif} sans ${module}`);
      }
  }
  // Une référence ou un modèle que « contexte » affiche, ou qu'un skill nomme : au moins une commande qui l'utilise charge le module.
  const references = [...fichiers(path.join(RACINE, "references"), ".md"), ...fichiers(path.join(RACINE, "templates"), ".md"), ...fichiers(path.join(RACINE, "skills"), ".md").filter((f) => !f.endsWith("SKILL.md"))];
  for (const f of references) {
    const nom = path.basename(f);
    if (nom in MODULES_COMMUNES_FICHIERS || nom === "regles-communes.md") continue; // les modules se citent entre eux sans condition
    const corps = sansEntete(f);
    // Les commandes qui reçoivent ce texte : celles dont le contexte l'affiche, ou dont le SKILL.md ou la référence qui la nomme le charge.
    const utilisatrices = [...SKILLS].filter((s) => contexteCharge(s).includes(corps.trim().slice(0, 80)) || sansEntete(path.join(RACINE, "skills", s, "SKILL.md")).includes(nom));
    for (const [motif, module] of MENTIONS)
      if (motif.test(corps) && utilisatrices.length) {
        verifiees++;
        if (!utilisatrices.some((s) => modulesCharges(s).includes(module))) problemes.push(`${path.relative(DEPOT, f)} : ${motif} sans ${module} dans aucune de ses commandes (${utilisatrices.join(", ")})`);
      }
  }
  assert.ok(verifiees >= 10, "mentions relevées : " + verifiees);
  assert.deepStrictEqual(problemes, []);
});

test("allowed-tools : les commandes pulse-aidd des agents qu'un skill lance, et des références qu'il nomme, sont autorisées d'avance", () => {
  const texteSkill = (s) => lire(RACINE, "skills", s, "SKILL.md").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ""); // le corps seul : les motifs allowed-tools ne sont pas des citations
  const enchainees = (depart) => {
    const vues = new Set([depart]);
    const aVoir = [depart];
    while (aVoir.length) {
      for (const c of citationsOutil(texteSkill(aVoir.pop()))) {
        const etape = (c.match(/^pulse-aidd etape ([a-z][a-z-]*)(?: --sans-(?:communes|noyau))?$/) || [])[1];
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
        const etape = (c.match(/^pulse-aidd etape ([a-z][a-z-]*)(?: --sans-(?:communes|noyau))?$/) || [])[1];
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
  const interdit = /^(git branch -f\b|git branch -M\b|git remote add\b|git merge --no-ff\b|git pull\b|gh repo create\b|glab repo create\b)/;
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

test("consignes mortes : ni « 3 questions au plus », ni --force-with-lease proposé, ni « une journée »", () => {
  const problemes = [];
  for (const { fichier, texte } of TEXTES) {
    if (/3 questions au plus/.test(texte)) problemes.push(`${fichier} : « 3 questions au plus » (règle commune 5 : 4 au plus)`);
    for (const ligne of texte.split("\n")) {
      if (/--force-with-lease/.test(ligne) && !/refus/.test(ligne)) problemes.push(`${fichier} : --force-with-lease hors d'une phrase de refus`);
      if (/une journée|fin de journée/.test(ligne) && /MVP|première version|Délai/.test(ligne)) problemes.push(`${fichier} : durée imposée à la première version`);
    }
  }
  assert.deepStrictEqual(problemes, []);
  assert.doesNotMatch(lire(RACINE, "skills", "spec", "SKILL.md"), /rondes de 3 au plus/);
  assert.doesNotMatch(lire(DEPOT, "docs", "commandes", "prd.html"), /en une journée/);
});

test("mise en ligne : tests, contrôle rapide de sécurité avant la première fois, audit complet proposé en clôture", () => {
  const fichier = path.join(RACINE, "skills", "deploy", "SKILL.md");
  const deploy = lire(fichier);
  const controles = deploy.split("### 1. Contrôles avant envoi")[1].split("\n### 2.")[0];
  assert.match(controles, /la commande « Tester »/);
  assert.match(controles, /avant la \*\*première\*\* mise en ligne/);
  assert.match(controles, /`pulse-aidd reference security\/rapide\.md`/);
  assert.match(controles, /Un ⛔ bloque la mise en ligne/);
  assert.match(deploy.split("### 6. Clore")[1], /`\/pulse:security audit`/);
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
  for (const ref of ["entetes.md", "rapide.md"]) {
    const texte = lire(RACINE, "skills", "security", "references", ref);
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
  assert.match(lire(RACINE, "skills", "security", "assets", "securite.md"), /\| S13 CSRF, sessions et cookies \|/);
  assert.match(lire(RACINE, "skills", "tech", "assets", "technical.md"), /\| Auditer les dépendances \|/);
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
  assert.match(lire(RACINE, "skills", "tech", "assets", "technical.md"), /- Sauvegarde et restauration : \{\{/);
  assert.match(lire(RACINE, "..", "pulse-vibe-next", "references", "technical.md"), /- Sauvegarde et restauration : /);
  const cicd = lire(RACINE, "skills", "cicd", "SKILL.md");
  assert.match(cicd.split("### 4. Essayer en local")[1].split(/\n##+ /)[0], /audit des dépendances/);
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

// Les consignes d'une commande : son SKILL.md, puis les références qui ne servent qu'à elle (skills/<nom>/references/).
const skillTexte = (nom) => {
  const refs = path.join(RACINE, "skills", nom, "references");
  const propres = fs.existsSync(refs) ? fs.readdirSync(refs).filter((f) => f.endsWith(".md")).sort().map((f) => lire(RACINE, "skills", nom, "references", f)) : [];
  return [lire(RACINE, "skills", nom, "SKILL.md"), ...propres].join("\n");
};

test("init et status appliquent le verdict de pulse-aidd etat, sans règles de décision recopiées", () => {
  for (const skill of ["init", "status"]) {
    const texte = skillTexte(skill);
    assert.match(texte, /`pulse-aidd etat`/, `${skill} lance pulse-aidd etat`);
    assert.doesNotMatch(texte, /spec sans plan → `\/pulse:plan/i, `${skill} : règle de décision recopiée`);
  }
  assert.doesNotMatch(skillTexte("status"), /Sa seule modification/);
  assert.doesNotMatch(skillTexte("init"), /\*\*Questions\*\* \(une ronde AskUserQuestion\) : le \*\*nom\*\*/, "nom et description : réponse libre");
});

test("décision 6 : plus de réorganisation de l'ancien format, les contrôles du projet remis à jour à la demande", () => {
  const unix = (f) => f.split(path.sep).join("/");
  assert.deepStrictEqual(TEXTES.filter(({ texte }) => /réorganise les documents|réorganiser \*\*en conservant|Documents à l'ancien format/.test(texte)).map(({ fichier }) => unix(fichier)), []);
  const init = lire(RACINE, "skills", "init", "SKILL.md");
  assert.match(init, /^#### Remettre les contrôles du projet à jour$/m);
  assert.match(init, /`pulse-aidd reference init\/controles\.md`/);
  assert.doesNotMatch(init.match(/^allowed-tools:.*$/m)[0], /Bash\(git mv \*\)/, "git mv servait seulement à la réorganisation");
  assert.match(lire(RACINE, "skills", "init", "references", "controles.md"), /`CLAUDE\.md` sans la ligne des commandes à proposer \(`\/pulse:status`, `\/pulse:refine`\)/);
});

test("init et status ne citent que des clés et des valeurs réellement émises par etat.js", () => {
  const source = lire(RACINE, "scripts", "etat.js");
  const valeurs = [...new Set([...source.matchAll(/fondation: "([a-z]+)"/g)].map((m) => m[1]))];
  assert.ok(valeurs.length >= 5, "valeurs de fondation lues dans etat.js");
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
  assert.match(skillTexte("implement"), /`\/pulse:review`, où deux assistants indépendants relisent la tâche et l'essaient en marche/, "implement renvoie la vérification indépendante à review");
  assert.match(lire(RACINE, "templates", "revue.md"), /^## Vérification$/m);
  assert.match(lire(RACINE, "agents", "verifier.md").match(/^description:.*$/m)[0], /surface réelle/);
  for (const { fichier, texte } of TEXTES) assert.doesNotMatch(texte, /boucle de `?\/pulse:implement|`?\/pulse:implement`? et sa boucle|boucle d'implement/, `${fichier} : implement n'a plus de boucle`);
  assert.doesNotMatch(lire(RACINE, "agents", "verifier.md"), /boucle de \/pulse:implement/);
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

test("plan : écrit « à valider », contrôlé par verifier-plan, montré, puis validé avec la ligne « plan validé » du journal", () => {
  const deroule = skillTexte("plan").split(/^## Processuss*$/m)[1];
  const etapes = ["Statut : à valider", "pulse-aidd verifier-plan US-XXX", "« Valider le plan (Recommandé) »", "« validé le AAAA-MM-JJ »"].map((t) => deroule.indexOf(t));
  assert.ok(etapes.every((i) => i !== -1), "écriture, contrôle, validation et changement de statut présents");
  assert.deepStrictEqual([...etapes].sort((a, b) => a - b), etapes, "dans cet ordre");
  assert.match(deroule, /« plan validé »/);
  assert.match(lire(RACINE, "templates", "plan.md"), /^- \*\*Statut\*\* : à valider$/m);
});

test("règles communes : rondes de 4 questions, réponses libres en texte, mode découverte écrit une fois", () => {
  const unix = (f) => f.split(path.sep).join("/");
  const regles = lire(RACINE, "references", "regles-communes.md");
  assert.doesNotMatch(regles, /Poser les questions une par une/);
  assert.match(regles, /une ronde de 4 questions au plus/);
  assert.match(regles, /réponse libre/);
  assert.doesNotMatch(regles, /`\/pulse:pr branche <US-XXX>` avant `\/pulse:implement`/);
  const definitions = TEXTES.filter(({ texte }) => /\*\*Mode découverte\*\* :/.test(texte)).map(({ fichier }) => unix(fichier));
  assert.deepStrictEqual(definitions, ["plugins/pulse-vibe/references/regles-realisation.md"]);
});

test("brainstorm et « Penser avant d'écrire » citent les règles communes 4, 5 et 10 et les règles de la mémoire au lieu de les recopier", () => {
  const brainstorm = lire(RACINE, "skills", "brainstorm", "SKILL.md");
  assert.match(brainstorm, /Les questions secondaires suivent la règle commune 5 ; la description de la réponse recommandée dit pourquoi\./);
  assert.doesNotMatch(brainstorm, /2 à 4 réponses concrètes/);
  assert.match(brainstorm, /^#### 2\. Chercher avant de demander$/m);
  assert.doesNotMatch(brainstorm, /Les décisions appartiennent à la personne\*\* : besoin, priorités/);
  assert.match(brainstorm, /S'en tenir à la complexité qu'elle a mentionnée/);
  assert.match(brainstorm, /`pulse:explorer`/);
  assert.match(brainstorm, /seulement si les 3 conditions des règles de la mémoire sont réunies/);
  assert.doesNotMatch(brainstorm, /difficile à défaire, surprenante sans contexte/);
  // Le test de compréhension porte le principe « la personne raisonne » : gardé mot pour mot.
  assert.ok(brainstorm.includes("2. **Test de compréhension** : demander, dans la conversation : « Présentez votre outil en une phrase, comme vous le feriez à un client. » Cette phrase devient la phrase de synthèse du brief."));
  const raisonnement = lire(RACINE, "references", "raisonnement.md");
  assert.match(raisonnement, /^# Penser avant d'écrire \(\/pulse:brainstorm, \/pulse:prd, \/pulse:us, \/pulse:express\)$/m);
  assert.match(raisonnement, /\| AskUserQuestion selon la règle commune 5 \|/);
});

test("implement : questions de démarrage en clair et mode découverte", () => {
  const texte = skillTexte("implement");
  assert.match(texte, /« Je code en coulisse \(Recommandé\) »/);
  assert.match(texte, /« Je code devant vous »/);
  assert.match(texte, /\*\*Mode découverte\*\* \(règles de réalisation\)/);
  assert.doesNotMatch(texte, /Implémentation via sous-agent|Implémentation directe/);
});

test("spirc : une ronde de départ de 4 questions au plus, sans double validation", () => {
  const texte = skillTexte("spirc");
  assert.doesNotMatch(texte, /Point de validation 1|✋ ?1/);
  const ronde = texte.split("**Ronde de départ**")[1].split("\n\n**Portée**")[0];
  const questions = ronde.split("\n").filter((l) => /^\d\. \*\*[^*]+\*\*/.test(l));
  assert.ok(questions.length >= 3 && questions.length <= 4, `${questions.length} questions dans la ronde`);
});

test("spirc : le mode autonome s'arrête aussi pour la validation du plan", () => {
  const texte = skillTexte("spirc");
  const puce = texte.split("\n").find((l) => l.startsWith("- `-a`"));
  assert.match(puce, /validation du plan quand il vient d'être créé/);
  assert.match(texte, /vous testez tout à la fin\)/);
  assert.match(texte, /je note vos décisions et vous les pose ensemble ; vous testez tout à la fin\)/);
});

test("spirc : en autonome, une décision arrête seulement sa tâche ; petits choix notés ; travail mis de côté sans suppression", () => {
  const texte = skillTexte("spirc");
  const puce = texte.split("\n").find((l) => l.startsWith("- `-a`"));
  assert.match(puce, /seule sa tâche s'arrête/);
  assert.doesNotMatch(texte, /interrompt aussi le mode autonome/);
  const section = texte.split("### Questions en attente (mode autonome)")[1].split("\n### ")[0];
  assert.match(section, /En pause : Q<n> \(votre décision\)/);
  assert.match(section, /pulse-aidd attente mettre-de-cote T4 -- <fichiers de T4>/);
  assert.match(section, /pulse-aidd attente remettre T4/);
  assert.match(section, /retirer la sous-ligne `En pause : Q<n>`/);
  assert.match(section, /4 par ronde/);
  assert.doesNotMatch(section, /git stash (drop|clear)/);
  const [mise, remise] = [/^2\. \*\*Mettre de côté/m, /^5\. \*\*Remettre/m].map((debut) => section.split("\n").find((l) => debut.test(l)));
  for (const etat of ["fait", "rien-a-mettre-de-cote", "refuse", "echec", "mise-de-cote-orpheline"]) assert.match(mise, new RegExp("`" + etat + "`"), etat);
  for (const etat of ["remis", "absente", "echec", "arbre-occupe", "conflit", "conflit-non-nettoye", "remis-sans-nettoyage"]) assert.match(remise, new RegExp("`" + etat + "`"), etat);
  assert.match(texte, /`decision` → elle attend une réponse/);
  assert.match(texte, /Vous pouvez faire autre chose : je note mes questions et vous les pose toutes ensemble/);
  assert.match(texte, /« Garder ce choix \(Recommandé\) » \/ « Changer ce choix »/);
  assert.match(texte, /\*\*Conversation longue\*\* \(hors mode autonome\)/);
  const marqueur = texte.split("**Marqueur de réalisation**")[1].split("\n\n")[0];
  for (const etape of ["test", "realisation", "examen", "commit", "questions", "test-groupe"]) assert.match(marqueur, new RegExp("`" + etape + "`"), etape);
  assert.match(texte, /pulse-aidd realisation fin/);
  assert.match(section, /\*\*Petit choix\*\*[^\n]*Dans le doute, c'est une question en attente/);
  assert.match(section, /constat Critique non résolu/);
  assert.match(section, /les questions d'abord, puis le test groupé/);
  assert.doesNotMatch(lire(RACINE, "references", "regles-communes.md"), /Petit choix/, "défini une seule fois, dans spirc");
});

// Mots réservés aux consignes (liste partagée avec wiki.test.js).
const { jargon } = require("./jargon");
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
    // Seul le mot « worktree » y est permis ; les autres mots de méthode restent cherchés.
    for (const chaine of chainesDuScript(lire(RACINE, "scripts", script))) {
      const m = motDeMethode(/\s/.test(chaine.trim()) ? chaine : chaine.replace(/\bworktrees?\b/gi, " "));
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

test("lignes « Prochaine étape : », « Résumé » et « Présenter » de toutes les commandes sans « MVP », « epic », « worktree » ni « demande de fusion »", () => {
  // Mêmes exceptions que ci-dessus : un titre cité entre guillemets, la phrase qui explique « worktree » ; chemins et code retirés.
  const PERMIS = /^\d+\. |^Travailler dans un worktree$|^Un worktree est /;
  const problemes = [];
  for (const s of lister(path.join(RACINE, "skills"))) {
    const f = path.join("skills", s, "SKILL.md");
    if (!fs.existsSync(path.join(RACINE, f))) continue;
    lire(RACINE, f).split("\n").forEach((ligne, i) => {
      if (!/Prochaine étape :|Résumé|Présenter/.test(ligne)) return;
      const texte = sansChemins(ligne).replace(/« ((?:[^«»]|«[^«»]*»)+) »/g, (tout, cite) => (PERMIS.test(cite) ? " " : tout));
      const j = /\bMVP\b|\bepics?\b|\bworktrees?\b|\bdemandes? de fusion\b/i.exec(texte);
      if (j) problemes.push(`${f.split(path.sep).join("/")}:${i + 1} : ${j[0]}`);
    });
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
  for (const f of [["templates", "CLAUDE.md"], ["skills", "init", "assets", "banniere.txt"]]) assert.doesNotMatch(lire(RACINE, ...f), /AI-Driven/, f.join("/"));
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
    [["references", "worktree-dossier.md"], /\*\*Fusionner\*\* :[\s\S]*Claude Code va vous demander/],
  ]) {
    const texte = lire(RACINE, ...fichier);
    assert.match(texte, ANNONCE, fichier.join("/"));
    assert.match(texte, motif, fichier.join("/"));
  }
});

test("deploy : chaque envoi est annoncé avant la demande d'accord, dans sa section", () => {
  const sections = lire(RACINE, "skills", "deploy", "SKILL.md").split(/^###? /m).filter((s) => /git push/.test(s));
  assert.ok(sections.length >= 4, "sections avec envoi");
  for (const s of sections) assert.match(s, /Claude Code va vous demander l'accord|Chaque envoi déclenche une demande d'accord|accord annoncé au § 3/, s.slice(0, 30));
});

test("commit nomme la forme `git commit -m`, annuler passe par `pulse-aidd annuler`, et commit utilise `git remote -v`", () => {
  assert.match(lire(RACINE, "skills", "annuler", "SKILL.md"), /pulse-aidd annuler defaire/);
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

// Un nom de fichier seul (Edit(CLAUDE.md)) vaut à toute profondeur ; ./ l'ancre à la racine du projet. Edit couvre aussi la création.
test("allowed-tools : les écritures autorisées d'avance restent dans docs/ et aidd_docs/, plus ./CLAUDE.md et ./README.md à la racine (écriture autorisée)", () => {
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const ligne = (lire(fichier).match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
    for (const [, outil, motif] of ligne.matchAll(/\b(Write|Edit|MultiEdit)\(([^)]*)\)/g)) {
      const document = /^(docs|aidd_docs)\/\S+$/.test(motif) && !motif.split("/").includes("..");
      const racine = outil === "Edit" && /^\.\/(CLAUDE|README)\.md$/.test(motif);
      if (!document && !racine) problemes.push(`${path.relative(DEPOT, fichier).split(path.sep).join("/")} : ${outil}(${motif})`);
    }
  }
  assert.deepStrictEqual(problemes, []);
});

test("tests automatiques : installer un outil de test est recommandé quand la pile en a un", () => {
  const texte = lire(RACINE, "references", "tests-automatiques.md");
  assert.match(texte, /« Installer un outil de test \(Recommandé\) »/);
  assert.match(texte, /« Utiliser le lanceur de tests intégré \(Recommandé\) »/);
  assert.match(texte, /`node --test`/);
  const sansTests = texte.split("\n").filter((l) => l.includes("« Sans tests automatiques (Recommandé) »"));
  assert.strictEqual(sansTests.length, 1, "un seul cas recommande de se passer de tests");
  assert.match(sansTests[0], /aucun code à tester automatiquement/);
  const choix = lire(RACINE, "skills", "tech", "references", "choix-techniques.md");
  assert.match(choix, /sinon le lanceur de tests intégré au langage/);
  assert.match(texte, /« Utiliser le lanceur de tests intégré \(Recommandé\) » \(l'outil de test fourni avec le langage, rien à installer ;/);
  assert.match(texte, /ni lanceur intégré au langage : « Installer un outil de test \(Recommandé\) »/, "repli : du code, ni outil documenté ni lanceur intégré");
  assert.match(texte, /1\. Choisir l'outil recommandé [^\n]*ou le lanceur intégré au langage \(§ 2\)/);
  // TypeScript : mêmes conditions dans la référence des tests et dans « Choisir l'outil de test » de la démarche de tech, écrite une fois.
  const ts = "pour TypeScript avec Node.js 22.19 ou plus quand le code s'en tient à la syntaxe effaçable, importe ses fichiers avec l'extension `.ts` et n'utilise pas d'alias de chemins, sinon l'outil de test recommandé pour la pile";
  assert.ok(texte.includes(ts), "référence : TypeScript");
  assert.ok(choix.includes(ts), "tech/choix-techniques.md : TypeScript");
  assert.match(choix, /^## Choisir l'outil de test$/m);
  assert.ok(!lire(RACINE, "skills", "tech", "SKILL.md").includes(ts), "tech/SKILL.md renvoie à la démarche");
});

test("modèle CLAUDE.md, agents et références cohérents entre eux", () => {
  const claude = lire(RACINE, "templates", "CLAUDE.md");
  assert.doesNotMatch(claude, /uniquement sur demande/);
  assert.match(claude, /par la boucle de `\/pulse:spirc`/);
  assert.doesNotMatch(claude, /boucles de `\/pulse:implement`/);
  assert.doesNotMatch(claude, /traces de travail par session/);
  // Décision 4 : à la fin de « Commandes », la ligne qui fait proposer /pulse:status et /pulse:refine ; les commandes restent tapées par la personne.
  const commandes = claude.split(/^## Commandes\s*$/m)[1].split(/^## /m)[0];
  assert.match(commandes, /proposez-lui de taper `\/pulse:status`/);
  assert.match(commandes, /proposez `\/pulse:refine <US-XXX>`/);
  assert.match(commandes.trim().split("\n").pop(), /Les commandes `\/pulse:\*` se lancent quand la personne les tape\.$/, "dernière ligne de « Commandes »");
  // Hors d'une commande, aucune règle commune n'est chargée : le modèle n'y renvoie pas.
  assert.doesNotMatch(claude, /règles communes Pulse, § 1|règles de réalisation de Pulse/);
  assert.match(lire(RACINE, "agents", "explorer.md").match(/^description:.*$/m)[0], /\/pulse:get-help/);
  assert.match(skillTexte("ui"), /quatre références de design/);
  assert.doesNotMatch(skillTexte("ui"), /trois références/);
});

test("la règle deny se propose en clair : le bloc JSON se montre seulement sur demande", () => {
  for (const [s, texte] of [["init", lire(RACINE, "references", "autorisations.md")], ["secrets", lire(RACINE, "skills", "secrets", "SKILL.md")]]) {
    assert.doesNotMatch(texte, /montrer le bloc/i, `${s} : ne plus montrer le bloc d'office`);
    assert.match(texte, /bloc[^.]*sur demande/i, `${s} : le bloc reste disponible sur demande`);
  }
});

test("production : retour arrière dans le modèle technical.md et dans deploy ; variables propres à chaque environnement", () => {
  const modele = lire(RACINE, "skills", "tech", "assets", "technical.md");
  assert.match(modele, /\n## Retour arrière\n/);
  assert.ok(modele.indexOf("## Retour arrière") < modele.indexOf("## Référencement"), "après « Hébergement et mise en ligne »");
  const deploy = lire(RACINE, "skills", "deploy", "SKILL.md");
  assert.match(deploy, /section « Retour arrière » de `docs\/technical\.md`/);
  assert.match(deploy, /propre à chaque environnement/);
  assert.match(lire(RACINE, "references", "secrets", "sans-conversation.md"), /--meme-valeur/);
});

test("mise en production : une sonde de disponibilité est proposée et notée", () => {
  assert.match(lire(RACINE, "skills", "deploy", "SKILL.md"), /\*\*Surveillance\*\*/);
  assert.match(lire(RACINE, "skills", "tech", "assets", "technical.md"), /^- Surveillance : /m);
});

test("règles communes : le noyau seul ; fichiers du projet et cycle dans leurs références, tâches, relecture et réalisation dans leurs modules", () => {
  const communes = lire(RACINE, "references", "regles-communes.md");
  for (const titre of ["## 1. À qui vous parlez", "## 3. Garde-fous de la méthode", "## 4. Format de fin de commande"])
    assert.ok(communes.includes(titre), titre);
  for (const [titre, module] of [["Chaque constat d'une relecture", "regles-relecture.md"], ["**Mode découverte**", "regles-realisation.md"], ["## Garder la trace", "regles-realisation.md"], ["**Rangement**", "regles-taches.md"]]) {
    assert.ok(!communes.includes(titre), `noyau : « ${titre} » sorti vers ${module}`);
    assert.ok(lire(RACINE, "references", module).includes(titre), `${module} : ${titre}`);
  }
  assert.match(lire(RACINE, "references", "regles-relecture.md"), /^\| Gravité \| Traitement \|$/m, "regles-relecture.md : le tableau des gravités");
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
    for (const m of corps.matchAll(/pulse-aidd etape (\S+)( --sans-(?:communes|noyau))?/g))
      if (!m[2]) problemes.push(`${path.relative(DEPOT, f)} : pulse-aidd etape ${m[1]}`);
  }
  assert.deepStrictEqual(problemes, []);
});

test("les sous-commandes etape, reference, qualite et tests citées par un skill sont permises par son allowed-tools", () => {
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const motifs = motifsBash(fichier);
    const corps = lire(fichier).replace(/^---\n[\s\S]*?\n---\n/, "");
    for (const [, citation] of corps.matchAll(/`(pulse-aidd (?:etape|reference|qualite|tests)\b[^`]*)`/g)) {
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

test("les lectures de fichiers-projet.md, cycle.md, gestes.md et secrets/fuite.md, citées par les règles communes, sont permises dans chaque skill", () => {
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    const motifs = motifsBash(fichier);
    for (const ref of ["fichiers-projet.md", "cycle.md", "gestes.md", "secrets/fuite.md"])
      if (!motifs.some((m) => couvre(m, `pulse-aidd reference ${ref}`))) problemes.push(`${path.relative(DEPOT, fichier)} : ${ref}`);
  }
  assert.deepStrictEqual(problemes, []);
});

test("allowed-tools : aucun motif `contexte <autre>` sans emploi, aucune paire `x` et `x *`", () => {
  const texteSkill = (s) => lire(RACINE, "skills", s, "SKILL.md").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ""); // le corps seul : les motifs allowed-tools ne sont pas des citations
  const enchainees = (depart) => {
    const vues = new Set([depart]);
    const aVoir = [depart];
    while (aVoir.length) {
      for (const c of citationsOutil(texteSkill(aVoir.pop()))) {
        const etape = (c.match(/^pulse-aidd etape ([a-z][a-z-]*)(?: --sans-(?:communes|noyau))?$/) || [])[1];
        if (etape && SKILLS.has(etape) && !vues.has(etape)) {
          vues.add(etape);
          aVoir.push(etape);
        }
      }
    }
    return [...vues];
  };
  const problemes = [];
  for (const skill of SKILLS) {
    const motifs = motifsBash(path.join(RACINE, "skills", skill, "SKILL.md"));
    const citees = new Set(enchainees(skill).flatMap((s) => [...texteSkill(s).matchAll(/pulse-aidd contexte ([a-z][a-z-]*)/g)].map((m) => m[1])));
    for (const motif of motifs) {
      const cible = (motif.match(/^pulse-aidd contexte ([a-z][a-z-]*)$/) || [])[1];
      if (cible && cible !== skill && !citees.has(cible)) problemes.push(`${skill} : Bash(${motif}) sans emploi`);
      if (!motif.endsWith("*") && motifs.includes(`${motif} *`)) problemes.push(`${skill} : Bash(${motif}) doublé par Bash(${motif} *)`);
    }
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

test("auditeur de sécurité : deux portées, projet (/pulse:security) ou tache (-x), données par la délégation", () => {
  const auditeur = lire(RACINE, "agents", "security-auditor.md");
  assert.match(auditeur.match(/^description:.*$/m)[0], /le projet, ou une tâche/);
  assert.match(auditeur.match(/^description:.*$/m)[0], /\/pulse:spirc/);
  const portee = (auditeur.split(/^## Portée$/m)[1] || "").split(/^## /m)[0];
  assert.ok(portee, "section « ## Portée »");
  assert.match(portee, /\*\*`projet`\*\*/);
  const tache = portee.split("**`tache`**")[1] || "";
  assert.ok(tache, "portée `tache`");
  for (const point of ["S3", "S4", "S9", "S11", "S12", "S13"]) assert.ok(tache.includes(point), `portée tache : ${point} en premier`);
  assert.match(tache, /les points que ces fichiers touchent/);
  assert.match(tache, /« — hors de la tâche »/);
  assert.match(auditeur, /S1 à S13, tous présents ; en portée `tache`, « — hors de la tâche »/);
  assert.match(portee, /sans portée indiquée : `projet`/, "portée par défaut");
  assert.match(tache, /à l'étape 2, l'inventaire de ces fichiers et de leur chemin d'appel/, "portée tache : inventaire limité");
  const texteExamen = lire(RACINE, "references", "examen.md");
  const fiche = texteExamen.split("## 3 bis.")[1].split(/\n## /)[0];
  assert.match(fiche, /contrôle de sécurité[^\n]*« Fiche du cambrioleur » de l'auditeur[^\n]*s'ajoutent à la fiche/, "§ 3 bis : les tests de l'auditeur rejoignent la fiche de test");
  const controle = texteExamen.split("## 4. Relecture de contrôle")[1].split(/\n## /)[0];
  assert.match(controle, /l'auditeur en portée `tache`/, "§ 4 : relecture de contrôle en portée tache");
  const examen = lire(RACINE, "references", "examen.md").split("\n").find((l) => l.includes("**`pulse:security-auditor`**"));
  assert.match(examen, /portée `tache`/);
  assert.doesNotMatch(examen, /checklist/, "examen.md : l'agent charge la checklist lui-même");
  const security = lire(RACINE, "skills", "security", "SKILL.md");
  const delegation = security.split("\n").find((l) => l.includes("outil Agent avec **`pulse:security-auditor`**"));
  assert.match(delegation, /portée `projet`/);
  assert.doesNotMatch(delegation, /checklist-securite\.md|PLAN-SPEC/, "security : l'agent lit lui-même les documents et la checklist");
});

test("la boucle sur le plan vit dans spirc seule : commit chargée une fois par déroulé", () => {
  const spirc = lire(RACINE, "skills", "spirc", "SKILL.md");
  // Deux emplois : aux prérequis (modifications à enregistrer d'abord) et au démarrage de la réalisation ; le second se saute si le premier a eu lieu.
  assert.strictEqual((spirc.match(/pulse-aidd etape commit --sans-communes/g) || []).length, 2, "spirc : commit chargée une fois par déroulé");
  for (const ref of ["pulse-aidd reference worktree.md", "pulse-aidd reference worktree-dossier.md", "pulse-aidd reference tests-automatiques.md", "pulse-aidd reference tests-dabord.md", "pulse-aidd reference memoire.md"])
    assert.ok(spirc.includes(ref), ref);
});

test("devant vous : le marqueur porte --devant et la sortie de l'étape de réalisation (fiche du pack comprise) se lit avant le premier fichier", () => {
  const ligne = (texte, motif) => texte.split("\n").find((l) => motif.test(l)) || "";
  for (const [skill, motifDevant] of [["implement", /^\*\*Devant vous\*\*/], ["spirc", /Avec `-d`, ou quand l'agent est indisponible \(dans les deux cas, marqueur lancé avec `--devant`\) :/]]) {
    const texte = lire(RACINE, "skills", skill, "SKILL.md");
    assert.match(ligne(texte, /^\*\*Marqueur de réalisation\*\*/), /`--devant`/, `${skill} : la ligne du marqueur cite --devant`);
    const devant = ligne(texte, motifDevant);
    assert.match(devant, /`--devant`/, `${skill} : la ligne « devant vous » cite --devant`);
    assert.match(devant, /`pulse-aidd realisation etape <Tn> realisation`[^.]*fiche du pack[^.]*en entier[^.]*avant le premier fichier écrit/, `${skill} : la sortie de l'étape se lit en entier avant le premier fichier`);
  }
});

test("devant vous : la fiche donnée par l'étape de réalisation tient lieu de l'appel pile contexte implement de l'implementer", () => {
  const pack = (lire(RACINE, "agents", "implementer.md").match(/## Pack de pile\n\n([^\n]*)\n/) || [])[1] || "";
  assert.match(pack, /`pulse-aidd pile contexte implement`/);
  assert.match(pack, /Devant vous, la sortie de l'étape de réalisation \(`realisation etape <Tn> realisation`, lancée par la commande\) donne déjà cette fiche : elle tient lieu de cet appel\./);
});

test("rappel après compaction : chaque commande pulse-aidd qu'il peut écrire pour spirc et implement est autorisée d'avance", () => {
  const { ecrire, rappel } = require(path.join(RACINE, "scripts", "realisation.js"));
  const os = require("os");
  const maintenant = new Date().toISOString();
  const problemes = [];
  for (const commande of ["spirc", "implement"]) {
    const motifs = motifsBash(path.join(RACINE, "skills", commande, "SKILL.md"));
    for (const devant of [false, true])
      for (const [tache, etape] of [["", ""], ["T2", "test"], ["T2", "realisation"], ["T2", "examen"], ["T2", "commit"], ["US-004", "test-groupe"]]) {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-rappel-"));
        ecrire(d, { us: "US-004", commande, rythme: "complet", autonome: false, devant, tache, etape, questions: 0, debut: maintenant, maj: maintenant });
        const cites = citationsOutil(rappel(d));
        if (!cites.length) problemes.push(`${commande} : rappel sans commande à relancer`);
        for (const c of cites) if (!motifs.some((m) => couvre(m, c))) problemes.push(`${commande} (devant ${devant}, ${etape || "aucune étape"}) : « ${c} » non autorisée`);
        fs.rmSync(d, { recursive: true, force: true });
      }
  }
  assert.deepStrictEqual(problemes, []);
});

test("la réalisation dans la conversation s'appelle « devant vous » (`-d`) partout, plus « mode direct »", () => {
  assert.deepStrictEqual(TEXTES.filter(({ texte }) => /mode direct/i.test(texte)).map(({ fichier }) => fichier), []);
});

test("implement relancé sur une tâche [~] au code commencé : le marqueur fait reprendre la réalisation, pas la relecture", () => {
  const prerequis = skillTexte("implement").split("\n").find((l) => l.startsWith("- Tâche déjà `[~]`")) || "";
  assert.match(prerequis, /`pulse-aidd realisation` montre `commande: implement`, `us: <US-XXX>`, `tache: <Tn>` et `etape: realisation` ou `test`, sans `perime: oui`/);
  assert.match(prerequis, /reprendre au § 2/);
  assert.ok(prerequis.indexOf("pulse-aidd realisation") < prerequis.indexOf("pulse-aidd revue <Tn>"), "le marqueur se lit avant pulse-aidd revue");
  // Reprise au § 2, § 0 sauté : les tests figés à l'index rappellent les tests d'abord, la phase « Vert » n'est pas sautée.
  assert.match(prerequis, /fichiers de test déjà à l'index \(`git diff --cached --name-only`\) sont les tests figés des tests d'abord : reprendre alors à « Vert : réaliser »/);
  assert.ok(motifsBash(path.join(RACINE, "skills", "implement", "SKILL.md")).some((m) => couvre(m, "git diff --cached --name-only")), "implement : git diff autorisé");
  // Filet quoi qu'il arrive : l'examen exige une preuve de toute la suite à jour et verte.
  assert.match(lire(RACINE, "references", "examen.md"), /une preuve « à jour » et ✅ \(code 0\) : une preuve ❌, périmée ou absente n'est jamais une preuve/);
});

test("implement réalise une tâche : sans tâche il propose /pulse:spirc, plus de boucle.md, aucun texte ne dit qu'il boucle sur un plan", () => {
  assert.ok(!fs.existsSync(path.join(RACINE, "skills", "implement", "references", "boucle.md")), "boucle.md supprimée");
  const implement = skillTexte("implement");
  assert.match(implement, /\*\*Sans tâche\*\* : dire en une phrase que tout le plan s'enchaîne avec `\/pulse:spirc <US-XXX>`, à taper par la personne/);
  assert.match(implement, /« Réaliser seulement <Tn> – <titre> ici »/);
  assert.match(implement, /« Je tape \/pulse:spirc US-XXX pour enchaîner tout le plan \(Recommandé\) »/);
  assert.doesNotMatch(implement, /boucle\.md|Boucle sur tout le plan|sans tâche, boucler/);
  const entete = lire(RACINE, "skills", "implement", "SKILL.md").match(/^allowed-tools:.*$/m)[0];
  assert.doesNotMatch(entete, /pulse-aidd (etape|contexte) (commit|review)|pulse-aidd contexte pr|git commit|gh pr ready|glab mr update/, "implement n'enchaîne plus ni relecture ni commit");
  // Décision 10 : en coulisse, le rapport de l'implementer et le contrôle de fin de tour font foi ; une erreur lui revient (deleguer.md), deux essais.
  assert.match(implement, /\*\*En coulisse\*\* : s'appuyer sur « Vérifications lancées » et « Tests » du rapport de l'implementer et sur le contrôle de fin de tour ; ne pas relancer/);
  assert.match(implement, /relancer l'implementer avec la liste \(« Déléguer à l'implementer », une correction\), deux essais au plus/);
  assert.match(implement, /la preuve indépendante viendra de `\/pulse:review`/);
  const problemes = [];
  for (const { fichier, texte } of TEXTES) {
    if (texte.split("\n").some((l) => /\/pulse:implement[^\n]{0,80}(boucle|tout le plan|toutes les tâches)/i.test(l) && !l.includes("/pulse:spirc"))) problemes.push(fichier);
    if (/implement\/boucle\.md/.test(texte)) problemes.push(`${fichier} (boucle.md)`);
  }
  assert.deepStrictEqual(problemes, []);
});

test("auto-fix : la règle anti-affaiblissement reste aux consignes du fixer, le message n'a pas à la recopier ; autorisations réduites à l'emploi", () => {
  const autofix = lire(RACINE, "skills", "auto-fix", "SKILL.md");
  assert.doesNotMatch(autofix, /Rappeler dans chaque message/);
  assert.doesNotMatch(autofix, /restent interdites les « corrections » qui les affaiblissent/);
  assert.match(lire(RACINE, "agents", "fixer.md"), /Corriger la cause elle-même, à sa source\*\*, en gardant intacts les règles du lint/);
  const entete = autofix.match(/^allowed-tools:.*$/m)[0];
  assert.doesNotMatch(entete, /pulse-aidd (modele|tests|scenarios|pile recette|pile reference)/, "motifs sans emploi retirés (reference * reste : les règles communes citent des références ; qualite sert à la section « Correction de comportement » du fixer)");
});

test("fixer : la réponse a sa place pour la preuve et pour une autre solution ; fix relit aussi ses changements", () => {
  const format = (lire(RACINE, "agents", "fixer.md").match(/## Format de votre réponse\n\n```\n([\s\S]*?)```/) || [])[1] || "";
  assert.match(format, /^## Preuve\n- `<commande>` → <résultat copié> \(ou « preuve à refaire par la personne »\)$/m);
  assert.match(format, /## À signaler\n- <seulement si besoin : pack de pile non installé, code corrigé sans la fiche ; « Une autre solution paraît nécessaire : … »>/);
  const fix = lire(RACINE, "skills", "fix", "SKILL.md");
  assert.match(fix, /Relire son rapport et ses changements \(`git diff -- <fichiers>`\) : ils s'en tiennent à la solution retenue\./);
  assert.match(fix.match(/^allowed-tools:.*$/m)[0], /Bash\(git diff \*\)/);
});

test("fix confie la correction décidée au fixer, élargi aux corrections de comportement (décision 17)", () => {
  const fixer = lire(RACINE, "agents", "fixer.md");
  const fix = lire(RACINE, "skills", "fix", "SKILL.md");
  const description = fixer.match(/^description: (.*)$/m)[1];
  assert.match(description, /correction de comportement déjà décidée/);
  assert.match(description, /\/pulse:fix/);
  const section = (fixer.match(/## Correction de comportement[^\n]*\n([\s\S]*?)(?=\n## |$)/) || [])[1] || "";
  assert.match(section, /la cause trouvée, la solution retenue avec la personne/);
  assert.match(section, /pulse-aidd qualite <famille>/);
  assert.match(section, /Une autre solution vous paraît nécessaire : la signaler sans l'appliquer/);
  assert.match(fixer, /Corriger la cause elle-même, à sa source/, "règle anti-affaiblissement gardée pour tous les cas");
  assert.match(fixer.match(/## Informations reçues\n\n([^\n]*)\n/)[1], /cause trouvée|solution retenue/, "champs de la correction de comportement annoncés");
  assert.match(fix.match(/^allowed-tools:.*$/m)[0], /Bash\(pulse-aidd agent fixer\)/);
  assert.match(fixer, /change le comportement de l'appli, la signaler au lieu de l'appliquer, sauf si le message la donne comme solution retenue avec la personne \(section « Correction de comportement »\)/);
  assert.match(section, /sans commande de preuve, ou si la preuve est un parcours, rendre « preuve à refaire par la personne »/);
  assert.doesNotMatch(fixer.match(/^disallowedTools: .*$/m)[0], /\bWrite\b/, "un nouveau fichier peut être demandé par la solution retenue");
  assert.match(section, /créer un fichier seulement quand la solution retenue le nomme ; sinon, la signaler/);
  assert.match(section, /Les corrections de `\/pulse:auto-fix` restent des modifications de fichiers existants/);
  assert.match(section, /« Une autre solution paraît nécessaire : … »/);
  assert.match(fix, /chaque message redonne toute la cause et toute la solution retenue, les groupes se lancent l'un après l'autre, et la relecture du résultat se fait à la fin/);
  assert.match(fix, /confiée à `pulse:fixer` \(outil Agent, `model: "sonnet"`\)/);
  assert.match(fix, /Agent indisponible : `pulse-aidd agent fixer`/);
  assert.doesNotMatch(fix, /Une correction complexe se fait dans la conversation principale/);
  const symptomes = (fix.match(/\| Symptôme \| Cause habituelle \|\n\|---\|---\|\n((?:\|[^\n]*\n)+)/) || [])[1] || "";
  assert.strictEqual(symptomes.trim().split("\n").length, 5, "tableau des symptômes ramené aux cinq lignes propres à Pulse");
});

test("fix et fixer : le même plafond de 5 fichiers", () => {
  const fixer = lire(RACINE, "agents", "fixer.md");
  const fix = lire(RACINE, "skills", "fix", "SKILL.md");
  const cote = (texte, motif) => (texte.match(motif) || [])[1];
  assert.strictEqual(cote(fix, /tient en (\d+) fichiers au plus/), "5");
  const plafond = cote(fixer, /dans (\d+) fichiers au plus/);
  assert.strictEqual(cote(fix, /une demande par groupe de (\d+) au plus/), plafond, "groupes de fix = plafond du fixer");
  assert.strictEqual(cote(fixer, /Pour chaque fichier \((\d+) au plus\)/), plafond);
  assert.strictEqual(cote(fixer, /les fichiers \((\d+) au plus\)/), plafond);
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
  const groupe = spirc.slice(spirc.indexOf("## Test groupé"), spirc.indexOf("## Références de la commande"));
  // Une seule règle de rechargement (la boucle par tâche) : ni le test groupé ni la fin ne la répètent.
  assert.equal((spirc.match(/ne figurent (?:pas|plus) dans la conversation/g) || []).length, 1, "une seule règle de rechargement");
  assert.equal((groupe.match(/Choisir la façon de travailler/g) || []).length, 0, "ni le test groupé ni la fin ne rappellent le rechargement");
  assert.doesNotMatch(spirc, /Références de la réalisation chargées ; sinon les relancer/);
  const implement = skillTexte("implement");
  assert.match(implement, /y compris à une reprise/);
  assert.match(implement, /dès qu'un dépôt distant existe, lancer `pulse-aidd reference depot-distant\.md`/);
});

test("spirc : l'analyse d'une demande libre est une référence, -d est un raccourci, chaque référence de la réalisation se charge par son appel", () => {
  const spirc = lire(RACINE, "skills", "spirc", "SKILL.md");
  const analyse = spirc.slice(spirc.indexOf("### [A] Analyser"), spirc.indexOf("### [S] Spécifier"));
  assert.match(analyse, /pulse-aidd reference spirc\/analyser\.md/);
  assert.ok(analyse.length < 600, "l'analyse détaillée n'est plus dans le SKILL.md");
  const analyser = lire(RACINE, "skills", "spirc", "references", "analyser.md");
  for (const t of ["Situer la demande", "Clarifier ce qui change ce qui sera construit", "Écrire le contrat"]) assert.ok(analyser.includes(t), t);
  assert.match(analyser, /éléguer la demande à `pulse:explorer`/);
  // -d : raccourci seulement, absent de la ronde de départ.
  assert.match(spirc, /^- `-d` \*\*devant vous\*\*/m);
  const ronde = spirc.split("**Ronde de départ**")[1].split("\n\n**Portée**")[0];
  assert.doesNotMatch(ronde, /`-d`/, "-d n'est pas une question de la ronde de départ");
  assert.match(spirc, /coder une tâche soi-même, sauf avec `-d`/);
  // Chaque référence de la réalisation : son propre appel, pas de chaîne.
  const charge = spirc.split("**Charger une seule fois les références de la réalisation**")[1].split("\n")[0];
  for (const ref of ["pulse-aidd etape commit --sans-communes", "pulse-aidd reference worktree.md", "pulse-aidd reference tests-automatiques.md", "pulse-aidd reference tests-dabord.md"])
    assert.ok(charge.includes("`" + ref + "`"), ref);
  assert.match(charge, /chacune par son propre appel/);
  assert.doesNotMatch(charge, /&&|\|/, "aucune chaîne ni tube");
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
  assert.match(implement, /Tâche déjà `\[~\]` : sauf si `aidd_docs\/tasks\/in-progress\.md` concerne cette commande et cette tâche \(reprendre à son étape, règle commune 16\), ou si `pulse-aidd realisation` montre [^\n]*?\(code commencé : reprendre au § 2[^\n]*?\), lancer `pulse-aidd revue <Tn>` : `examen`, `test`, `correction` ou `aide` → proposer de taper `\/pulse:review <Tn>` ; `commit` → proposer de taper `\/pulse:commit` ; `decision` → proposer de taper `\/pulse:spirc <US-XXX>`/);
  assert.doesNotMatch(implement, /reprend à la correction ou au commit/);
  const spirc = skillTexte("spirc");
  assert.match(spirc, /Une tâche `\[~\]` est reprise là où elle en était : lancer `pulse-aidd revue <Tn>`/);
  assert.doesNotMatch(spirc, /reprendre à l'examen\)/);
  assert.match(skillTexte("review"), /`pulse-aidd revue <Tn>` : `test` → passer directement au § 5/);
  // Les boucles passent à l'enregistrement sur la réponse du § 2 de commit, pas sur la seule existence d'un rapport.
  assert.match(spirc, /Le § 2 de l'étape commit donne `commit`/);
  assert.doesNotMatch(spirc, /Le rapport de revue existe : la relecture est faite/);
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
  assert.doesNotMatch(regle16, /`\/pulse:/, "règle 16 : pas de liste de commandes recopiée (chaque commande dit déjà qu'elle l'applique)");
  const fichiersProjet = lire(RACINE, "references", "fichiers-projet.md").split("\n").find((l) => l.startsWith("| `aidd_docs/tasks/in-progress.md` |"));
  for (const c of COMMANDES) {
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
  const worktree = lire(RACINE, "references", "worktree-dossier.md");
  const fin = worktree.slice(worktree.indexOf("## 3. Terminer"), worktree.indexOf("**Fusionner** :"));
  const pr = fin.split("\n").find((l) => l.startsWith("- **Envoi : version parallèle**"));
  assert.ok(pr, "cas « Envoi : version parallèle »");
  assert.match(pr, /« Marquer la proposition comme prête à accepter »/);
  assert.match(pr, /« \(Recommandé\) » va à la première quand toutes les tâches du plan sont terminées, sinon à « Garder le dossier à part »/);
  assert.match(pr, /marquée prête, sortir du dossier à part \(outil `ExitWorktree`/);
  assert.match(lire(RACINE, "references", "depot-distant.md"), /Chaque envoi passe toujours par la demande d'autorisation de Claude Code/);
  for (const skill of ["tech", "ui"]) assert.match(skillTexte(skill), /étape de `\/pulse:express`[^)]*: le réécrire plutôt pour cette commande, à son étape suivante\)/, skill);
  assert.doesNotMatch(pr, /Rassembler dans/, "pas de fusion locale proposée en mode PR");
  assert.match(fin, /- \*\*Autre envoi\*\*[^\n]*« Rassembler dans `<branche de départ>` maintenant \(Recommandé\) »/);
  const depot = lire(RACINE, "references", "depot-distant.md");
  assert.match(depot, /« Une version parallèle pour l'US, publiée quand vous l'acceptez sur le site du dépôt \(Recommandé\) »/);
  assert.match(depot, /En mode découverte \(règles de réalisation\)[^\n]*« Directement sur la version principale »/);
  const regles = lire(RACINE, "references", "regles-realisation.md");
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

test("chaque commande écrit ses documents sans demande d'autorisation (W13)", () => {
  const MEMOIRE = ["Write(aidd_docs/memory/**)", "Edit(aidd_docs/memory/**)"];
  const TECH = ["Write(docs/technical.md)", "Edit(docs/technical.md)", "Edit(./CLAUDE.md)", ...MEMOIRE];
  const DESIGN = ["Write(docs/design.md)", "Edit(docs/design.md)", "Write(docs/design/**)", "Edit(docs/design/**)"];
  const PERF = ["Write(docs/performance.md)", "Edit(docs/performance.md)"];
  const LEXIQUE = ["Write(docs/lexique.md)", "Edit(docs/lexique.md)"];
  const attendus = {
    annuler: ["Edit(aidd_docs/tasks/**)"],
    cicd: ["Edit(docs/technical.md)", ...PERF],
    deploy: ["Edit(docs/technical.md)", "Edit(./CLAUDE.md)", "Edit(./README.md)", "Edit(aidd_docs/tasks/**)", ...PERF],
    "get-help": ["Write(docs/aide/**)", "Edit(docs/aide/**)"],
    guide: ["Edit(aidd_docs/tasks/**)"],
    memory: [...MEMOIRE, "Edit(./CLAUDE.md)"],
    perf: [...PERF, "Edit(docs/technical.md)", ...LEXIQUE],
    rediger: ["Write(docs/voix.md)", "Edit(docs/voix.md)", "Write(docs/textes/**)", "Edit(docs/textes/**)"],
    "search-console": ["Edit(docs/technical.md)", "Write(docs/referencement/**)", "Edit(docs/referencement/**)", "Write(aidd_docs/tasks/in-progress.md)"],
    secrets: ["Write(docs/secrets.md)", "Edit(docs/secrets.md)", "Write(docs/incidents/**)", "Edit(docs/incidents/**)", ...LEXIQUE],
    security: ["Write(docs/securite.md)", "Edit(docs/securite.md)"],
    seo: ["Write(docs/seo.md)", "Edit(docs/seo.md)", "Write(docs/seo/**)", "Edit(docs/seo/**)"],
    tech: [...TECH, "Edit(./README.md)", "Write(aidd_docs/tasks/in-progress.md)"],
    ui: [...DESIGN, "Edit(aidd_docs/tasks/**)", "Write(aidd_docs/tasks/in-progress.md)"],
    brainstorm: [...MEMOIRE, "Edit(./CLAUDE.md)", ...LEXIQUE],
    init: [...TECH, ...DESIGN],
    express: [...TECH, ...DESIGN],
    spirc: TECH,
  };
  const manquants = [];
  for (const [skill, outils] of Object.entries(attendus)) {
    const ligne = (skillTexte(skill).match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
    const jetons = ligne.match(/[A-Za-z]+(?:\([^)]*\))?/g) || [];
    for (const outil of outils) if (!jetons.includes(outil)) manquants.push(`${skill} : ${outil}`);
  }
  assert.deepStrictEqual(manquants, []);
  // pr et status n'écrivent aucun fichier : aucune écriture autorisée d'avance.
  for (const skill of ["pr", "status"]) assert.doesNotMatch((skillTexte(skill).match(/^allowed-tools:\s*(.*)$/m) || [])[1], /\b(Write|Edit)\(/, skill);
});

test("plan : avec un pack, une tâche « Recette : » garde son découpage, les autres suivent le découpage du cœur", () => {
  const plan = skillTexte("plan");
  assert.match(plan, /\*\*Avec un pack de pile\*\*, une tâche tirée d'une recette \(titre ou ligne « Recette : <nom> »\) garde le découpage vérifié de sa recette/);
  assert.match(plan, /toute autre tâche suit les règles 1, 2 et 4/);
  assert.match(plan, /Chaque tâche reste vérifiable par la personne/);
});

test("tech : une fois le pack choisi, seules ses consignes se chargent ; review dit que le reviewer charge le pack", () => {
  const tech = skillTexte("tech");
  assert.match(tech, /puis lancer `pulse-aidd pile contexte tech`/);
  assert.match(tech, /`pulse-aidd piles`, qui affiche aussi, pour chaque pack, ce qu'il faut vérifier et dire avant le choix : l'appliquer aux étapes 3 et 4/);
  assert.doesNotMatch(tech, /relancer `pulse-aidd contexte tech`/);
  assert.ok(motifsBash(path.join(RACINE, "skills", "tech", "SKILL.md")).some((m) => couvre(m, "pulse-aidd pile contexte tech")), "tech : pile contexte tech autorisé");
  assert.match(skillTexte("review"), /le reviewer les charge lui-même \(`pulse-aidd pile contexte review`\)/);
  // Les corrections de review se codent avec les consignes du pack, chargées en entier avant la première correction.
  assert.match(skillTexte("review"), /avant la première correction faite par cette conversation elle-même \(un agent qui corrige charge le pack lui-même\), lancer `pulse-aidd pile contexte implement`, lu en entier/);
  assert.ok(motifsBash(path.join(RACINE, "skills", "review", "SKILL.md")).some((m) => couvre(m, "pulse-aidd pile contexte implement")), "review : pile contexte implement autorisé");
});

test("tech : démarche de choix et organisation chargées à l'étape qui les sert ; squelette décrit une fois ; pile écrite à un seul endroit", () => {
  const tech = lire(RACINE, "skills", "tech", "SKILL.md");
  const contexte = contexteCharge("tech");
  assert.ok(!contexte.includes("===== Aider à choisir la technologie ====="), "démarche hors du contexte");
  assert.ok(!contexte.includes("===== Organisation des fichiers et nommage ====="), "organisation hors du contexte");
  const projetNeuf = tech.split("### B. Projet neuf")[1] || "";
  assert.match(projetNeuf.split("#### 2.")[0], /Avant la première question : lancer `pulse-aidd reference tech\/choix-techniques\.md` et l'appliquer jusqu'à l'étape 5\./);
  assert.match(tech, /Projet neuf sans pack : lancer `pulse-aidd reference qualite\/organisation\.md`/);
  // Squelette : la règle des fichiers gardés vit dans « Mise en place » du modèle, lue par tech, plan et l'implementer.
  const modele = lire(RACINE, "skills", "tech", "assets", "technical.md");
  assert.match(modele.split("## Mise en place")[1], /dossier temporaire[^\n]*`CLAUDE\.md`, `README\.md` et `\.gitignore`/);
  assert.match(tech, /Appliquer les étapes de « Mise en place » de `docs\/technical\.md`/);
  assert.doesNotMatch(tech, /dossier temporaire/);
  // Pile : docs/technical.md et le bloc « Stack technique » ; la mémoire technique garde les décisions datées.
  assert.match(tech, /une ligne datée par décision dans « Décisions techniques »\. La pile reste dans `docs\/technical\.md` et le bloc « Stack technique »/);
  assert.doesNotMatch(tech, /résumé de la pile retenue/);
  assert.doesNotMatch(tech, /Pulse 0\.3/);
  assert.match(tech, /Prochaine étape : projet existant : `\/pulse:memory creer`/);
  // La liste des sections du modèle : une seule fois, dans le modèle.
  assert.doesNotMatch(lire(RACINE, "skills", "tech", "references", "choix-techniques.md"), /« Les besoins qui guident le choix » :/);
});

// Trames imposées : une skill = un dossier (SKILL.md, et au besoin assets/, references/, scripts/) ; titres des SKILL.md et du CLAUDE.md des projets.
const TRAME_SKILL = ["Objectif", "Règles", "Contexte", "Rôle", "Processus", "Exemples", "Références de la commande"];
const titres2 = (texte) => [...texte.replace(/```[\s\S]*?```/g, "").matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);

test("une skill = un dossier : SKILL.md, et seulement assets/, references/, scripts/ à côté", () => {
  const ecarts = [];
  for (const p of PLUGINS) for (const skill of lister(path.join(p, "skills"))) {
    const dossier = path.join(p, "skills", skill);
    if (!fs.statSync(dossier).isDirectory()) { ecarts.push(`${skill} : un fichier, pas un dossier`); continue; }
    const contenu = lister(dossier);
    if (!contenu.includes("SKILL.md")) ecarts.push(`${skill} : SKILL.md absent (nom sensible à la casse)`);
    for (const e of contenu) if (!["SKILL.md", "assets", "references", "scripts"].includes(e)) ecarts.push(`${skill} : ${e}`);
  }
  assert.deepStrictEqual(ecarts, []);
});

// Après une compaction, Claude Code ne garde que les premiers ~5 000 jetons d'un skill : l'injection du contexte (13 à 35 ko de règles) ferme donc le fichier, et le Processus reste dans le début conservé.
test("chaque SKILL.md suit la trame : Objectif, Règles, Contexte, Rôle (facultatif), Processus, Exemples, Références de la commande", () => {
  const ecarts = [];
  for (const p of PLUGINS) for (const skill of lister(path.join(p, "skills"))) {
    const texte = lire(p, "skills", skill, "SKILL.md");
    const t = titres2(texte);
    const attendu = TRAME_SKILL.filter((x) => x !== "Rôle" || t.includes("Rôle"));
    if (JSON.stringify(t) !== JSON.stringify(attendu)) ecarts.push(`${skill} : ${t.join(", ")}`);
    const regles = texte.split(/^## Règles\s*$/m)[1] || "";
    if (!/^\s*Appliquer les « Règles communes Pulse »/.test(regles)) ecarts.push(`${skill} : Règles commence par les règles communes`);
    // Le repli est dans le début conservé après une compaction, pas en fin de fichier avec les règles.
    if (!regles.includes(`absentes de la conversation : lancer \`pulse-aidd contexte ${skill}\` et lire sa sortie en entier`)) ecarts.push(`${skill} : la ligne des règles donne le repli « pulse-aidd contexte ${skill} »`);
    const references = texte.split(/^## Références de la commande\s*$/m)[1] || "";
    if (!references.includes(`!\`pulse-aidd contexte ${skill}\``)) ecarts.push(`${skill} : contexte chargé dans « Références de la commande »`);
    if ((texte.match(/!`pulse-aidd contexte /g) || []).length !== 1) ecarts.push(`${skill} : une seule injection du contexte, en fin de fichier`);
    if (/dans « Contexte »/.test(texte)) ecarts.push(`${skill} : les règles sont « chargées en fin de fichier, dans « Références de la commande » »`);
  }
  assert.deepStrictEqual(ecarts, []);
});

test("CLAUDE.md des projets : Résumé du projet, Stack technique, Architecture, Commandes, Contraintes, dans cet ordre", () => {
  const claude = lire(RACINE, "templates", "CLAUDE.md");
  assert.deepStrictEqual(titres2(claude), ["Résumé du projet", "Stack technique", "Architecture", "Commandes", "Contraintes"]);
  for (const bloc of ["pulse_profil", "pulse_pile", "pulse_memoire"]) assert.ok(claude.includes(`<!-- ${bloc}:debut -->`), bloc);
  assert.match(claude, /^- Site en ligne : /m, "adresse lue par le garde-fou et l'état du projet");
  assert.match(claude, /\[docs\/technical\.md\]\(docs\/technical\.md\)/, "liens vers les documents du projet");
});

test("fiche de test de la personne : un fichier SMOKE-TEST par tâche, des gestes sans commande, tests lancés par l'assistant", () => {
  const modele = lire(RACINE, "templates", "smoke-test.md");
  for (const t of ["## Avant de commencer", "## Les étapes", "**Vous devez voir**", "- [ ] C'est bien ce que je vois", "vous n'avez aucune commande à taper"]) assert.ok(modele.includes(t), t);
  const manuel = lire(RACINE, "references", "tests", "test-manuel.md");
  assert.match(manuel, /SMOKE-TEST-US-XXX-<Tâche>-<titre-de-la-tache>\.md/);
  assert.match(manuel, /ne demande jamais de taper une commande/);
  assert.match(lire(RACINE, "references", "examen.md"), /## 3 bis\. Écrire la fiche de test de la personne/);
  assert.match(lire(RACINE, "agents", "verifier.md"), /Les contrôles automatiques que vous avez lancés n'y figurent pas/);
  for (const s of ["review", "spirc", "implement"]) assert.match(skillTexte(s), /SMOKE-TEST-/, s);
  assert.match(lire(RACINE, "references", "fichiers-projet.md"), /\| `aidd_docs\/tasks\/<epic>\/SMOKE-TEST-US-XXX-<Tâche>-<titre>\.md` \|/);
});

test("règle commune 19 : chaque demande d'accord nomme ses fichiers, avec un lien", () => {
  const regles = lire(RACINE, "references", "regles-communes.md");
  assert.match(regles, /19\. \*\*Chaque demande d'accord nomme ses fichiers\.\*\*/);
  assert.match(regles, /lien cliquable/);
});

test("init, tech et spirc proposent les autorisations du projet (pulse-aidd autorisations), écrites après accord", () => {
  assert.match(skillTexte("init"), /\*\*Régler les autorisations\*\* : lancer `pulse-aidd reference autorisations\.md`/);
  assert.match(skillTexte("tech"), /`pulse-aidd reference autorisations\.md`/);
  assert.match(skillTexte("spirc"), /\*\*Mode autonome\*\*[^\n]*`pulse-aidd autorisations`/);
  const ref = lire(RACINE, "references", "autorisations.md");
  assert.match(ref, /« Écrire ces règles dans `\.claude\/settings\.json` \(Recommandé\) » \/ « Plus tard »/);
  assert.match(ref, /`pulse-aidd autorisations --ecrire`/);
  // Les règles elles-mêmes (Git, lecture des clés interdite) sont celles du script, testées dans autorisations.test.js.
});

test("gestes de la personne : faire soi-même d'abord, fichier d'environnement expliqué et rempli, gestes courants mot pour mot", () => {
  const gestes = lire(RACINE, "references", "gestes.md");
  for (const t of ["## 1. Faire soi-même d'abord", "## 3. Un fichier d'environnement", "`.env.e2e`", "pulse-aidd secrets generer <NOM> --fichier <fichier>", "| Lancer l'application |", "| Navigation privée |", "| Voir en taille téléphone |"]) assert.ok(gestes.includes(t), t);
  assert.match(lire(RACINE, "references", "regles-communes.md"), /20\. \*\*Une action demandée à la personne se donne pas à pas\.\*\*/);
  assert.match(lire(RACINE, "references", "tests", "test-manuel.md"), /« Navigation privée » seul ne suffit pas/);
  assert.match(lire(RACINE, "templates", "smoke-test.md"), /\*\*Si l'application n'est pas ouverte\*\*/);
  for (const a of ["implementer", "test-writer", "test-runner", "verifier"]) assert.match(lire(RACINE, "agents", `${a}.md`), /pulse-aidd reference gestes\.md/, a);
});

test("rythme rapide : posé par express ou par -f, tests essentiels sans bout en bout, une fiche complète de l'US à la fin", () => {
  assert.match(lire(RACINE, "templates", "CLAUDE.md"), /- \*\*Rythme\*\* : à choisir\n<!-- pulse_profil:fin -->/);
  // Trois valeurs : « à choisir » (la question est posée), « rapide », « complet » (plus de question sur le rythme).
  assert.match(skillTexte("spirc"), /1\. \*\*Rythme\*\* \(seulement si la ligne « Rythme » du profil de `CLAUDE\.md` vaut « à choisir » ou manque/);
  assert.match(lire(RACINE, "templates", "CLAUDE.md"), /« demande-moi le rythme à chaque fois »/);
  assert.match(skillTexte("express"), /« - \*\*Rythme\*\* : rapide »/);
  const spirc = skillTexte("spirc");
  assert.match(spirc, /^- `-f` \*\*rapide\*\*/m);
  assert.match(spirc, /« Comment réaliser cette user story \? » → « Rapide \(Recommandé\) »[^\n]*« Rapide » vaut `-f`/, "question au début, sans -f");
  assert.match(spirc, /SMOKE-TEST-US-XXX-<nom>\.md/);
  const auto = lire(RACINE, "references", "tests-automatiques.md");
  assert.match(auto, /## 2 bis\. Tests essentiels \(rythme rapide\)/);
  assert.match(auto, /\*\*Aucun test de l'interface pendant les tâches\*\*/);
  assert.match(lire(RACINE, "references", "regles-realisation.md"), /\*\*Rythme\*\* \(profil\) : « à choisir »[^\n]*« rapide »/);
  assert.match(lire(RACINE, "agents", "implementer.md"), /\*\*Tests essentiels\*\* \(rythme rapide/);
  assert.match(lire(RACINE, "references", "tests", "gherkin.md"), /en rythme rapide[^|]*seulement `@integration` \(dont `@securite`\)[^|]*parcours principal compris, est `@manuel`/);
});

test("envoi : sans suivi de la mise en ligne chez l'hébergeur, laissé à deploy et status", () => {
  assert.match(lire(RACINE, "references", "depot-distant.md"), /\*\*Après l'envoi, passer directement à la suite\.\*\*[^\n]*`\/pulse:deploy` et `\/pulse:status`[^\n]*rythme rapide/);
});

test("spirc : une ronde de départ unique (rythme, options à cocher, tests, envoi), posée même en mode découverte", () => {
  const spirc = skillTexte("spirc");
  const ronde = spirc.split("**Ronde de départ**")[1].split("\n\n**Portée**")[0];
  for (const t of ["une seule ronde", "« Comment réaliser cette user story ? »", "`multiSelect`", "« Enchaîner les tâches sans m'arrêter » (`-a`", "« Un contrôle de sécurité à chaque tâche » (`-x`)", "« Travailler dans un dossier à part » (`-w`)", "**Tests**", "**Envoi**", "même en mode découverte"])
    assert.ok(ronde.includes(t), t);
  assert.doesNotMatch(spirc, /« Comment avancer \? »/, "plus de question de rythme après le plan");
});

test("rythme rapide : aucun test de l'interface pendant les tâches ; avec spirc, une relecture et une vérification de toute l'US, puis la fiche de fin d'US", () => {
  const examen = lire(RACINE, "references", "examen.md");
  assert.ok(examen.includes("avec `/pulse:spirc`, aucun examen par tâche : toute l'US s'examine une fois, à la fin (`spirc/examen-us.md`)"));
  assert.ok(examen.includes("Sinon : `pulse:reviewer` seul, sur le code de la tâche ; ni verifier, ni application lancée ou interrogée"));
  const us = lire(RACINE, "skills", "spirc", "references", "examen-us.md");
  assert.match(us, /lancer une fois toute la suite/);
  assert.match(us, /`pulse:reviewer`[^\n]*`git diff <départ>\.\.HEAD`/);
  assert.match(us, /`pulse:verifier`[^\n]*\*\*une seule fois\*\*[^\n]*sans la construction/);
  assert.match(us, /US-<AAAA-MM-JJ>\.md/);
  assert.match(us, /`pulse-aidd revue US-XXX`/);
  assert.ok(lire(RACINE, "references", "tests-automatiques.md").includes("**Aucun test de l'interface pendant les tâches**"));
  assert.ok(!lire(RACINE, "agents", "verifier.md").includes("Vérification légère"));
  const spirc = skillTexte("spirc");
  assert.ok(spirc.includes("**Rythme rapide** : pas de [R] par tâche ; après [I] et ses contrôles, passer à [C]."));
  assert.ok(spirc.includes("puis lancer `pulse-aidd reference spirc/examen-us.md` et l'appliquer"));
  assert.match(skillTexte("commit"), /appelé par `\/pulse:spirc` en rythme rapide : continuer/);
});

test("écrans : la présentation se choisit dans la spec, les maquettes se proposent, plan et implementer la suivent", () => {
  const spec = skillTexte("spec");
  for (const t of ["### 1 bis. Choisir la présentation des écrans", "« Comment présenter <les factures> ? »", "« Où créer ou modifier <une facture> ? »", "« Dans une fenêtre par-dessus la liste »", "« Voir 2 ou 3 propositions d'écran à comparer avant de coder (Recommandé) »", "`/pulse:ui maquettes US-XXX`"])
    assert.ok(spec.includes(t), t);
  assert.match(lire(RACINE, "skills", "spec", "assets", "spec.md"), /\| Présentation \(choisie par la personne\) \|/);
  assert.match(lire(RACINE, "skills", "spec", "assets", "spec.md"), /\*\*Maquettes\*\* :/);
  assert.match(skillTexte("plan"), /sa \*\*présentation\*\*, reprise de la colonne « Présentation » de la spec/);
  assert.match(skillTexte("spirc"), /Si sa ligne « Maquettes » vaut « à voir » : d'abord lancer `pulse-aidd etape ui --sans-communes`/);
  assert.match(lire(RACINE, "agents", "implementer.md"), /\*\*Présentation des écrans\*\* : suivre celle que la personne a choisie/);
});

test("tests essentiels : intégration et sécurité nécessaires seulement, ceux de la tâche une fois, toute la suite une fois à la fin de l'US", () => {
  const auto = lire(RACINE, "references", "tests-automatiques.md");
  assert.ok(auto.includes("**Seulement les tests d'intégration et de sécurité nécessaires**"));
  assert.ok(auto.includes("**Lancés une seule fois par tâche, et seulement les siens**"));
  assert.ok(auto.includes("**Toute la suite tourne une seule fois**"));
  assert.ok(auto.includes("**Seulement les contrôles rapides**") && auto.includes("`next build`"), "pas de construction en rythme rapide");
  assert.ok(lire(RACINE, "agents", "implementer.md").includes("tests essentiels : jamais de « construire »"));
  assert.ok(lire(RACINE, "agents", "implementer.md").includes("seulement les fichiers de test de la tâche, et rien si la tâche n'en a pas"));
  assert.ok(lire(RACINE, "skills", "spirc", "references", "examen-us.md").includes("**Tests** : lancer une fois toute la suite, avec les contrôles automatiques, par `pulse-aidd preuve lancer --portee suite`"));
});

test("série : deux US indépendantes en même temps, avec accord, dossiers à part rassemblés dès la fin de leur construction", () => {
  const serie = lire(RACINE, "skills", "spirc", "references", "serie.md");
  const bis = serie.split("## 4 bis. Deux US en même temps")[1] || "";
  assert.match(bis, /\*\*Deux à la fois au plus\.\*\*/);
  assert.match(bis, /« En parallèle avec »/);
  assert.match(bis, /\(Recommandé\) » \/ « L'une après l'autre »/);
  assert.match(bis, /\*\*sans y entrer\*\*/);
  assert.match(bis, /« Dossier de travail : `<chemin absolu du dossier à part>` »/);
  assert.match(bis, /`git merge --abort`[^\n]*sans jamais écraser/);
  assert.match(bis, /L'envoi, lui, attend toujours les tests de la personne/);
  assert.match(lire(RACINE, "references", "worktree.md"), /Sauf dans une série \(`spirc\/serie\.md`\), avec son accord\./);
  assert.match(lire(RACINE, "agents", "implementer.md"), /\*\*Dossier de travail\*\* : s'il est donné/);
});

test("règles contrôlées : décrites une fois, citées par la mémoire et le modèle, appliquées par verifier.js", () => {
  const regles = lire(RACINE, "references", "regles-controlees.md");
  assert.match(regles, /— Contrôle : interdit `parseFloat\(` dans `src\/prix\/`/);
  assert.match(lire(RACINE, "references", "memoire.md"), /`pulse-aidd reference regles-controlees\.md`/);
  assert.match(lire(RACINE, "templates", "aidd-memory-technical.md"), /« — Contrôle : … »/);
  assert.match(lire(RACINE, "templates", "verifier.js"), /function controlerRegles\(/);
});

test("décision 5 : projet existant, tech puis memory creer ; la pile écrite seulement dans docs/technical.md et « Stack technique »", () => {
  const memory = lire(RACINE, "skills", "memory", "SKILL.md");
  assert.match(memory, /code sans `docs\/technical\.md`[^\n]*taper d'abord `\/pulse:tech`/, "memory creer : tech d'abord");
  assert.match(memory, /les fichiers créés, et ceux encore au modèle/, "creer remplit aussi les fichiers restés au modèle");
  assert.match(memory, /la pile reste dans `docs\/technical\.md` et le bloc « Stack technique »/);
  assert.doesNotMatch(memory, /pile et conventions depuis/);
  const memoire = lire(RACINE, "references", "memoire.md");
  assert.match(memoire, /\| Conventions de code propres au projet, sécurité propre, pièges et leçons techniques, décisions techniques \(la pile : bloc « Stack technique » de `CLAUDE\.md` et `docs\/technical\.md`\) \| `aidd_docs\/memory\/technical\.md` \|/);
  assert.match(lire(RACINE, "skills", "init", "SKILL.md"), /`\/pulse:tech` \(documenter les outils observés dans le code\), puis `\/pulse:memory creer`/);
  // Les seuils de taille sont écrits dans les règles de la mémoire et dans l'action compacter, pas ailleurs dans la commande.
  assert.strictEqual((memory.match(/140/g) || []).length, 1, "cible écrite une fois dans memory");
  assert.strictEqual((memory.match(/95 %/g) || []).length, 1, "seuil écrit une fois dans memory");
});

test("qualite et tests : aucun texte livré ne les lance sans famille, morceau, --tout ni --checklists", () => {
  const sansNom = /pulse-aidd (qualite|tests)`/;
  const textes = [];
  for (const plugin of PLUGINS) for (const ext of [".md", ".js"]) textes.push(...fichiers(plugin, ext).filter((f) => !f.endsWith(".test.js") && !f.includes("node_modules")));
  for (const f of textes) assert.doesNotMatch(lire(f), sansNom, `${path.relative(DEPOT, f)} : « pulse-aidd qualite » ou « tests » sans famille`);
});

// Une famille tient sous 30 000 caractères, pas deux : « clean-code composants » fait 31 720, « clean-code securite » 35 288.
// Au-delà, Claude Code enregistre la sortie dans un fichier et n'en montre qu'un aperçu. Les textes livrés citent donc une commande par famille
// (l'outil accepte toujours plusieurs familles, mais aucune consigne ne le demande).
test("qualite : aucun texte livré ne lance deux familles dans le même appel", () => {
  const famille = "(?:clean-code|composants|securite|organisation)";
  const combine = new RegExp(`pulse-aidd qualite ${famille}(?: ${famille})+`);
  const textes = [];
  for (const plugin of PLUGINS) textes.push(...fichiers(plugin, ".md").filter((f) => !f.includes(`${path.sep}tests${path.sep}`) && !f.includes("node_modules")));
  assert.ok(textes.length > 100, "textes relevés : " + textes.length);
  assert.ok(combine.test("lancer `pulse-aidd qualite clean-code composants` ici"), "auto-test du repérage");
  assert.ok(!combine.test("`pulse-aidd qualite clean-code`, puis `pulse-aidd qualite composants`"), "auto-test : une famille par appel");
  for (const f of textes) assert.doesNotMatch(lire(f), combine, `${path.relative(DEPOT, f)} : plusieurs familles dans un appel`);
});

test("agents de la boucle : chacun charge seulement les règles utiles", () => {
  const agent = (nom) => lire(RACINE, "agents", `${nom}.md`);
  const implementer = agent("implementer");
  assert.match(implementer, /une commande par famille/);
  assert.match(implementer, /Lire chaque sortie en entier, sans la couper/);
  const choix = lire(RACINE, "references", "qualite", "README.md");
  for (const famille of ["clean-code", "composants", "securite", "organisation"]) assert.match(choix, new RegExp(`\`${famille}\``), famille);
  assert.match(agent("reviewer"), /`pulse-aidd qualite --checklists`/);
  assert.match(agent("test-writer"), /`pulse-aidd tests ecrire gherkin/);
  assert.match(agent("test-runner"), /`pulse-aidd tests ecrire/);
  for (const nom of ["implementer", "reviewer", "test-writer", "test-runner"]) assert.match(agent(nom), /en entier/, `${nom} : règles lues en entier`);
  for (const nom of ["implementer", "reviewer", "test-writer", "test-runner"]) {
    assert.doesNotMatch(agent(nom), /`pulse-aidd (?:qualite|tests)`/, `${nom} : chargement complet`);
  }
  assert.match(lire(RACINE, "references", "tests-dabord.md"), /`pulse-aidd tests ecrire gherkin/);
});

test("règles de Pulse lues en entier : consigne dans travail-sobre.md, aucun agent ne coupe la sortie", () => {
  assert.match(lire(RACINE, "references", "travail-sobre.md"), /en entier/);
  for (const f of fichiers(RACINE, ".md").filter((x) => x.includes(`${path.sep}agents${path.sep}`))) {
    assert.doesNotMatch(lire(f), /pulse-aidd (?:qualite|reference|tests|pile)[^\n]*\|\s*(?:head|grep|tail|sed)\b/, `${path.relative(DEPOT, f)} : sortie de règles coupée`);
  }
});

// Chaque sortie d'une famille ou d'un morceau reste lisible en entier (sous la limite d'affichage de 30 000 caractères).
// Garde les tâches de raccourcissement des familles (2.3b et 2.3c du refactoring d'optimisation).
test("qualite <famille> et tests <morceau> : chaque sortie fait moins de 30 000 caractères", () => {
  const { spawnSync } = require("child_process");
  const sorties = [["qualite", ["clean-code", "organisation", "composants", "securite"]], ["tests", ["strategie", "ecrire", "unitaire", "integration", "bout-en-bout", "tdd", "gherkin"]]];
  for (const [type, noms] of sorties) {
    for (const nom of noms) {
      const r = spawnSync("bash", ["bin/pulse-aidd", type, nom], { cwd: RACINE, encoding: "utf8" });
      assert.strictEqual(r.status, 0, `${type} ${nom} : échec ${r.stderr}`);
      assert.ok(r.stdout.length > 0, `${type} ${nom} : sortie vide`);
      assert.ok(r.stdout.length < 30000, `${type} ${nom} : ${r.stdout.length}`);
    }
  }
});

test("correction ciblée : l'implementer reçoit les constats et charge leurs familles de qualité", () => {
  for (const [nom, texte] of [
    ["examen.md", lire(RACINE, "references", "examen.md")],
    ["spirc", lire(RACINE, "skills", "spirc", "SKILL.md")],
    ["deleguer.md", lire(RACINE, "references", "deleguer.md")],
  ]) assert.match(texte, /familles de qualité (?:qu'ils|que les constats) concernent/, nom);
  assert.match(lire(RACINE, "agents", "reviewer.md"), /`pulse-aidd qualite --checklists`/, "le reviewer charge lui-même les checklists de qualité");
  // Le message de délégation est écrit une fois (deleguer.md) ; les deux commandes y renvoient.
  assert.match(lire(RACINE, "references", "deleguer.md"), /familles de qualité de la tâche/);
  for (const skill of ["implement", "spirc"]) assert.match(lire(RACINE, "skills", skill, "SKILL.md"), /selon « Déléguer à l'implementer »/, skill);
});

// Aucune commande n'en lance une autre : les commandes /pulse:* ont disable-model-invocation: true.
// Une commande enchaîne une étape avec `pulse-aidd etape <commande> --sans-communes`, ou écrit « tapez `/pulse:…` ».
// Formes interdites (un verbe d'action adressé au modèle devant la commande) ; permis : une ligne qui dit « tapez »/« taper »,
// et les lignes « Prochaine étape ».
const LIGNE_PERMISE = /tapez|taper|Prochaine étape/i;
const RENVOIS_INTERDITS = [
  [/\b(?:lancer|enchaînez sur)\b[^`\n.]{0,25}`\/pulse:/, "lancer / enchaîner sur une commande", "Voulez-vous lancer `/pulse:spec US-003` d'abord ?"],
  [/\bavec `\/pulse:(?:fix|auto-fix|get-help)\b/, "corriger ou demander de l'aide « avec /pulse:… »", "un par un, avec `/pulse:fix`"],
  [/\bcorriger[^`\n]{0,20}\((?:ou )?`\/pulse:(?:fix|auto-fix)\b/, "corriger par /pulse:fix ou /pulse:auto-fix", "corriger (ou `/pulse:fix`)"],
  [/erreurs : `\/pulse:auto-fix\b/, "beaucoup d'erreurs : /pulse:auto-fix", "s'il reste beaucoup d'erreurs : `/pulse:auto-fix`"],
  [/\bpuis ?: ?`\/pulse:commit`/, "puis /pulse:commit", "puis : `/pulse:commit`, `git push`"],
  [/\bpropos(?:er|ez) d'abord `\/pulse:review`/, "proposer d'abord /pulse:review", "proposer d'abord `/pulse:review` puis"],
  [/« [^»\n]*`\/pulse:[^`\n]*` \(Recommandé\)/, "réponse proposée qui contient la commande", "« Reprendre avec `/pulse:init` (Recommandé) »"],
  [/Recommandé\) » \(`\/pulse:/, "réponse proposée suivie de la commande", "« La reprendre (Recommandé) » (`/pulse:spirc US-XXX`)"],
  [/(?:\bproposez|enchaînez sur) `\/pulse:secrets fuite\b|\bpropos(?:er|ez) `\/pulse:memory retenir\b/, "fuite ou mémoire lancée par une commande", "proposez `/pulse:secrets fuite`"],
  [/\b(?:proposer|proposez|appliquer|appliquez|enchaîner sur|enchaînez sur|traite avec|enregistrer avec)\s+(?:d'abord\s+)?`\/pulse:(?:commit|fix|auto-fix|review|secrets fuite|get-help|memory retenir)\b/, "verbe d'action devant une commande que le modèle ne peut pas lancer", "l'enregistrer avec `/pulse:commit`"],
  [/\(`\/pulse:memory retenir`\)/, "mémoire lancée par une commande", "fichier de décision (`/pulse:memory retenir`)"],
  [/\b(?:enregistrer|mettre en ligne|enregistrez|mettez en ligne)\b[^`\n]{0,60}\(`\/pulse:(?:commit|deploy)\b|\bEnregistrer et mettre en ligne ?: ?`\/pulse:/i, "enregistrer ou mettre en ligne par une commande que le modèle ne peut pas lancer", "enregistrer (`/pulse:commit`), mettre en ligne (`/pulse:deploy`) ; Enregistrer et mettre en ligne : `/pulse:commit`"],
];
test("aucune commande n'en lance une autre : elle enchaîne une étape ou fait taper la suivante", () => {
  for (const [forme, nom, exemple] of RENVOIS_INTERDITS) assert.match(exemple, forme, `la forme « ${nom} » reconnaît son exemple`);
  const fautifs = [];
  for (const { fichier, texte } of TEXTES) {
    if (!/(^|[\\/])(skills|agents|references)[\\/]/.test(fichier)) continue;
    texte.split("\n").forEach((ligne, i) => {
      if (LIGNE_PERMISE.test(ligne)) return;
      for (const [forme, nom] of RENVOIS_INTERDITS) if (forme.test(ligne)) fautifs.push(`${fichier}:${i + 1} (${nom})`);
    });
  }
  assert.deepStrictEqual(fautifs, []);
});

test("une correction garde clean-code et la sécurité du code dès qu'elle touche le serveur", () => {
  assert.match(lire(RACINE, "agents", "implementer.md"), /Pour une correction : `clean-code`, les familles des constats reçus, et `securite` dès que la correction touche/);
});

test("spirc : le bout en bout se lance aussi en autonome, le rythme rapide est transmis, le profil « rapide » vaut -f", () => {
  const spirc = lire(RACINE, "skills", "spirc", "SKILL.md");
  const groupe = spirc.slice(spirc.indexOf("### Test groupé"), spirc.indexOf("### Fin"));
  assert.match(groupe, /\*\*En rythme complet\*\* : lancer d.abord « Tester de bout en bout »/, "Test groupé");
  assert.match(spirc.slice(spirc.indexOf("### Fin")), /Rythme complet hors autonome, US faite : lancer « Tester de bout en bout »/, "Fin");
  assert.doesNotMatch(spirc, /^Hors autonome, US faite/m);
  // Le rythme rapide est transmis à l'implementer par le texte de délégation, écrit une fois.
  assert.match(spirc, /Déléguer à \*\*`pulse:implementer`\*\* selon « Déléguer à l'implementer »/);
  assert.match(lire(RACINE, "references", "deleguer.md"), /rythme rapide : « tests essentiels » \(référence « Tests automatiques », § 2 bis\)/);
  assert.match(spirc, /le rythme est celui du profil \(« rapide » vaut `-f`\)/);
});

test("implementer : [I] Implémenter, en coulisse ; un secret à inventer est rendu à l'appelant", () => {
  const texte = lire(RACINE, "agents", "implementer.md");
  const description = texte.match(/^description:.*$/m)[0];
  assert.match(description, /\/pulse:spirc \(\[I\] Implémenter\) et \/pulse:implement \(en coulisse\)/);
  assert.doesNotMatch(description, /phase Exécuter|mode sous-agent/);
  assert.match(texte, /un secret à inventer : son NOM, que l'appelant génère avec l'accord de la personne/);
});

test("explorer sans numéro de checklist inventé, implementer sans doublon de la méthode", () => {
  const explorer = lire(RACINE, "agents", "explorer.md");
  assert.doesNotMatch(explorer, /point S… de la checklist|\bS\d+\b/, "l'explorer ne charge pas la checklist : pas de numéro");
  assert.match(explorer, /sécurité \(donnée personnelle, accès réservé, saisie affichée, clé secrète\), régression possible, cas limite/);
  const implementer = lire(RACINE, "agents", "implementer.md");
  assert.doesNotMatch(implementer, /Toujours appliquer les règles de qualité de code, chargées par famille \(étape 3 de la méthode\)/);
  assert.match(implementer, /code-concepts\.md/, "le pointeur vers les concepts de code reste, avec son quand");
});

test("agents : aucun ne cite les gestes qui touchent la production comme un geste à faire lui-même", () => {
  for (const f of AGENTS_PAR_PLUGIN) assert.doesNotMatch(lire(f), /pulse-aidd secrets (generer|envoyer|elaguer|redeployer)/, path.relative(DEPOT, f));
});

test("pulse-aidd : SK n'est affecté qu'une fois", () => {
  assert.strictEqual((lire(RACINE, "bin", "pulse-aidd").match(/^SK=/gm) || []).length, 1);
});

test("aucun motif allowed-tools ne finit par un guillemet isolé", () => {
  const problemes = [];
  for (const fichier of SKILLS_PAR_PLUGIN) {
    for (const motif of motifsBash(fichier)) {
      // Un guillemet en trop (nombre impair dans le motif) : Bash(start "" *.html") ne correspond à rien.
      if ((motif.match(/"/g) || []).length % 2 === 1) problemes.push(`${path.relative(DEPOT, path.dirname(fichier))} : Bash(${motif})`);
    }
  }
  assert.deepStrictEqual(problemes, []);
});

// ---------------------------------------------------------------- Preuve unique (pulse-aidd preuve)

test("preuve unique : le verifier et le test-runner la produisent, l'implementer et le reviewer la laissent, le test-runner juge avec les checklists", () => {
  const agent = (nom) => lire(RACINE, "agents", `${nom}.md`);
  for (const nom of ["verifier", "test-runner"]) assert.match(agent(nom), /`pulse-aidd preuve lancer --portee suite/, `${nom} produit la preuve`);
  assert.match(agent("verifier"), /`pulse-aidd preuve etat --exiger suite/, "le verifier lit d'abord la preuve");
  assert.match(agent("verifier"), /`--construire` si « Construire » existe[^.]*page, une route ou la configuration/, "construction seulement pour une page, une route ou la configuration");
  assert.doesNotMatch(agent("verifier"), /lancé pendant cette vérification/, "un test compte s'il a été lancé sur le contenu actuel des fichiers");
  for (const nom of ["implementer", "reviewer"]) assert.doesNotMatch(agent(nom), /preuve lancer/, `${nom} ne produit pas la preuve`);
  assert.match(agent("test-runner"), /`pulse-aidd tests ecrire --checklists/, "le test-runner juge avec les checklists");
  assert.doesNotMatch(agent("test-runner"), /surtout `tests\/ecrire-un-test\.md`/);
  assert.match(agent("test-writer"), /mode « corriger » : `pulse-aidd tests ecrire <niveau> --checklists`/, "test-writer : mode corriger avec les checklists");
  for (const nom of ["verifier", "test-runner", "test-writer"]) assert.doesNotMatch(agent(nom).match(/^description:.*$/m)[0], /Utilisé par/, `${nom} : description sans « Utilisé par »`);
  const auto = lire(RACINE, "references", "tests-automatiques.md");
  assert.match(auto, /`pulse-aidd preuve etat --exiger suite`/, "le filet lit la preuve");
  assert.match(auto, /`pulse-aidd preuve lancer --portee suite`/, "le filet relance la preuve si besoin");
  assert.doesNotMatch(auto, /après la dernière modification de fichier/, "l'empreinte décide, plus le jugement du modèle");
  const dabord = lire(RACINE, "references", "tests-dabord.md");
  assert.doesNotMatch(dabord, /\(recopiés\)|\(recopiées\)/, "délégation au test-writer sans recopie");
  assert.match(dabord, /L'agent lit lui-même[^.]*`docs\/technical\.md`/);
  assert.match(dabord, /relancer le test-runner en phase « vert attendu » \*\*avant\*\* la relecture de contrôle/);
});

test("examen : rapport au modèle chargé à l'étape, délégations sans recopie de docs/technical.md, preuve unique lue et exigée", () => {
  const examen = lire(RACINE, "references", "examen.md");
  assert.match(examen, /`pulse-aidd modele revue\.md`/, "le modèle de rapport se charge à l'étape du rapport");
  assert.match(examen, /`pulse-aidd preuve etat --exiger suite`/, "la ligne « Filet anti-régression » vient de la preuve");
  assert.match(examen, /constat 🟠 Haute/, "un échec de la preuve devient un constat Haute");
  const ligne = (agent) => examen.split("\n").find((l) => l.startsWith(`- **\`pulse:${agent}\`** :`)) || "";
  for (const agent of ["reviewer", "verifier"]) {
    assert.ok(ligne(agent), agent);
    assert.doesNotMatch(ligne(agent), /sections? « (Pile retenue|Commandes du projet) »/, `${agent} : docs/technical.md non recopié`);
    assert.match(ligne(agent), /L'agent lit lui-même/, `${agent} lit lui-même ses documents`);
  }
  assert.match(ligne("reviewer"), /sans verifier \(rythme rapide\), la consigne d'écrire la section « Test manuel »/);
  assert.match(examen, /test-runner en phase « vert attendu » d'abord/, "relecture de contrôle : le test-runner d'abord");
  for (const skill of ["review", "spirc"]) {
    assert.match(skillTexte(skill), /`pulse-aidd modele revue\.md`/, `${skill} : pointeur du modèle de rapport`);
    assert.ok(motifsBash(path.join(RACINE, "skills", skill, "SKILL.md")).some((m) => couvre(m, "pulse-aidd preuve etat --exiger suite")), `${skill} : preuve autorisée`);
  }
  assert.doesNotMatch(skillTexte("review"), /Les références et modèles cités dans cette commande figurent dans ce contexte/);
  const reviewer = lire(RACINE, "agents", "reviewer.md");
  assert.doesNotMatch(reviewer, /Lancer les contrôles automatiques/, "le reviewer ne relance pas les contrôles");
  for (const phrase of reviewer.split(/(?<=[.;])\s/).filter((x) => /contrôles automatiques de « Commandes du projet »/.test(x)))
    assert.match(phrase, /^Sans verifier dans l'examen/, "le reviewer lance les contrôles seulement sans verifier dans l'examen");
  assert.doesNotMatch(reviewer.match(/^description:.*$/m)[0], /Utilisé par/);
  assert.match(reviewer, /## Test manuel à faire par la personne \(seulement si le message l'indique : examen sans verifier\)/);
  assert.match(lire(RACINE, "skills", "spirc", "references", "examen-us.md"), /1\. \*\*Tests\*\* : lancer une fois toute la suite[^\n]*`pulse-aidd preuve lancer --portee suite`/);
  assert.match(lire(RACINE, "skills", "spirc", "references", "examen-us.md"), /`pulse-aidd modele revue\.md`/);
});

test("test : références des tests chargées à la demande, délégation au test-writer sans recopie de docs/technical.md", () => {
  const t = skillTexte("test");
  assert.match(t, /Quand elle vaut « aucune » : lancer `pulse-aidd reference tests-automatiques\.md` et appliquer son § 3/);
  assert.match(t, /Seulement pour une spec sans scénarios[^\n]*`pulse-aidd tests gherkin`/);
  assert.match(t, /Pour écrire des tests \*\*avant\*\* le code d'une nouvelle tâche : `\/pulse:implement -t` ou `\/pulse:spirc -t`\.\n/);
  const delegation = t.split("\n").find((l) => l.startsWith("2. Déléguer à **`pulse:test-writer`**")) || "";
  assert.ok(delegation, "délégation au test-writer");
  assert.doesNotMatch(delegation, /« Pile retenue »|contrat recopié/);
  assert.match(delegation, /L'agent lit lui-même `docs\/technical\.md`/);
  assert.doesNotMatch(t, /Les références citées dans cette commande figurent dans ce contexte/);
  assert.match(t, /`pulse-aidd etape fix --sans-communes`/, "échec dû au code : l'étape fix enchaînée");
  assert.ok(!motifsBash(path.join(RACINE, "skills", "test", "SKILL.md")).some((m) => m.startsWith("git add")), "test n'autorise pas git add");
});

test("preuve : relance seulement pour périmée, aucune ou portée insuffisante ; rouge à jour = échecs à corriger ; filet limité sans boucle", () => {
  const examen = lire(RACINE, "references", "examen.md");
  const auto = lire(RACINE, "references", "tests-automatiques.md");
  const verifier = lire(RACINE, "agents", "verifier.md");
  for (const [nom, texte] of [["examen.md", examen], ["tests-automatiques.md", auto], ["verifier.md", verifier]]) {
    assert.match(texte, /« à jour » ❌[^.]*sans relance/, `${nom} : une preuve rouge à jour se corrige, sans relance`);
    assert.match(texte, /la relance indiquée par sa ligne/, `${nom} : la relance vient de la ligne de la preuve`);
    assert.match(texte, /--portee tache|preuve de portée tâche/, `${nom} : le filet limité se lit en portée tâche`);
    assert.doesNotMatch(texte, /ne prouve rien : relancer|« à jour » et ✅ ; sinon, relancer/, `${nom} : pas de relance d'une preuve rouge`);
  }
  assert.match(examen, /filet limité/, "examen : le message au verifier dit le filet limité");
  assert.match(auto, /toute la suite tourne une fois à la fin de l'US/, "filet limité : toute la suite à la fin de l'US");
  assert.doesNotMatch(lire(RACINE, "agents", "reviewer.md"), /extraits du message de délégation/);
  assert.match(lire(RACINE, "agents", "test-runner.md"), /contrôle automatique en échec[^.]*« code »/, "test-runner : un contrôle rouge se classe code");
  assert.match(lire(RACINE, "README.md"), /produite par le test-runner, le verifier ou, à défaut, la conversation au moment de décider ; jamais par l'implementer/);
  assert.doesNotMatch(lire(DEPOT, "docs", "commandes", "review.html"), /Deux assistants qui n'ont pas écrit le code vont l'examiner/);
});

test("filet limité : le test-runner est prévenu, la portée tâche se lance (pas une option de etat), tâche sans test : contrôles seuls", () => {
  assert.match(lire(RACINE, "references", "tests-dabord.md"), /phase « vert attendu »[^\n]*filet limité/, "délégation vert : le filet limité est transmis");
  assert.doesNotMatch(lire(RACINE, "references", "examen.md"), /`--portee tache`, lue sans/, "--portee tache appartient à preuve lancer");
  assert.match(lire(RACINE, "references", "tests-automatiques.md"), /tâche sans test : `pulse-aidd preuve lancer --portee tache` sans fichier/);
});

test("preuve : délai de l'outil Bash donné à chaque lancement ; preuve rouge due à l'environnement relancée une fois la cause réparée ; aucun test écrit non bloquant", () => {
  const textes = {
    "verifier.md": lire(RACINE, "agents", "verifier.md"),
    "test-runner.md": lire(RACINE, "agents", "test-runner.md"),
    "tests-automatiques.md": lire(RACINE, "references", "tests-automatiques.md"),
    "examen.md": lire(RACINE, "references", "examen.md"),
    "examen-us.md": lire(RACINE, "skills", "spirc", "references", "examen-us.md"),
  };
  for (const [nom, texte] of Object.entries(textes)) assert.match(texte, /outil Bash[^\n]*`timeout` 600000/, `${nom} : délai de l'outil Bash`);
  assert.match(textes["examen.md"], /sans relance, sauf cause hors des fichiers réparée \(relance indiquée par la preuve\)/);
  assert.match(textes["verifier.md"], /dû à l'environnement[^.]*la cause réparée, se relance une fois/);
  assert.match(lire(RACINE, "references", "tests-dabord.md"), /dû à l'environnement\*\*[^\n]*guider pas à pas, puis relancer le test-runner une fois/);
  assert.match(textes["tests-automatiques.md"], /aucun test écrit pour l'instant/);
  assert.match(lire(RACINE, "templates", "revue.md"), /— \(aucun test écrit pour l'instant\)/);
  for (const nom of ["examen.md", "tests-automatiques.md"]) assert.match(textes[nom], /filet limité : (avec les )?fichiers de test de cette tâche/, `${nom} : relance du filet limité avec les tests de la tâche`);
});

test("examen sans verifier (rythme rapide, tout) : le reviewer lance les contrôles qui laissent les fichiers intacts ; rythme rapide avec -x : l'auditeur en portée tâche ; examens parallèles : une seule preuve", () => {
  const reviewer = lire(RACINE, "agents", "reviewer.md");
  assert.match(reviewer, /Sans verifier dans l'examen \(le message le dit : rythme rapide, ou `tout`\), lancer aussi les contrôles automatiques de « Commandes du projet » qui laissent les fichiers intacts \(pas les tests\) et signaler leurs erreurs/);
  const examen = lire(RACINE, "references", "examen.md");
  assert.match(examen, /sans verifier \(rythme rapide\), la consigne d'écrire la section « Test manuel » et de lancer les contrôles/);
  const review = skillTexte("review");
  assert.match(review, /Avec `tout` : seulement `pulse:reviewer`[^\n]*examen sans verifier/, "tout : le message dit l'examen sans verifier");
  assert.match(review, /avant des examens en parallèle[^\n]*`pulse-aidd preuve etat --exiger suite`[^\n]*une seule preuve/, "une US : une seule preuve avant les examens parallèles");
  const us = lire(RACINE, "skills", "spirc", "references", "examen-us.md");
  assert.match(us, /avec `-x` : `pulse:security-auditor`, portée `tache`/, "rythme rapide avec -x : l'auditeur");
  assert.match(us, /« Audit de sécurité »/);
  assert.match(lire(RACINE, "templates", "revue.md"), /^## Audit de sécurité$/m, "le modèle de rapport a sa section « Audit de sécurité »");
});

test("commit : le filet anti-régression se lit dans la preuve, sans référence absente de son contexte ; filet limité : toute la suite au commit de la dernière tâche de l'US hors spirc", () => {
  const commit = skillTexte("commit");
  const ligne = commit.split("\n").find((l) => l.startsWith("- `commit` :")) || "";
  assert.match(ligne, /En rythme complet : `pulse-aidd preuve etat --exiger suite`/, "commit lit la preuve");
  assert.match(ligne, /❌ : s'arrêter, dire les échecs et proposer de taper `\/pulse:review <Tn>`/);
  assert.match(ligne, /la relance indiquée, une fois \(outil Bash : `timeout` 600000\)/);
  assert.match(ligne, /dernière tâche de l'US hors `\/pulse:spirc`/, "filet limité : toute la suite à la dernière tâche");
  assert.doesNotMatch(commit, /référence « Tests automatiques »/, "aucune référence hors du contexte de commit");
  assert.ok(motifsBash(path.join(RACINE, "skills", "commit", "SKILL.md")).some((m) => couvre(m, "pulse-aidd preuve etat --exiger suite")), "commit : preuve autorisée");
});

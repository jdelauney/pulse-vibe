// Le plugin pulse-skills : ses commandes, son agent et son outil, avec la méthode Pulse (dont vient pulse-aidd skill).
// Lancer : node --test plugins/pulse-skills/tests/pulse-skills.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const DEPOT = path.join(RACINE, "..", "..");
const CORE = path.join(DEPOT, "plugins", "pulse-vibe");
const lire = (...p) => fs.readFileSync(path.join(...p), "utf8");
const { couvre, estSensible, verifier } = require(path.join(CORE, "scripts", "skill.js"));
const verifierSkills = verifier;
const OUTIL = path.join(RACINE, "bin", "pulse-skills").split(path.sep).join("/");
const CHEMIN = { ...process.env, PATH: path.join(CORE, "bin") + path.delimiter + process.env.PATH };
const lancer = (...args) => spawnSync("bash", [OUTIL, ...args], { encoding: "utf8", env: CHEMIN });

function motifsBash(fichier) {
  const entete = (lire(fichier).match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
  const ligne = (entete.match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
  return [...ligne.matchAll(/Bash\(([^)]*)\)/g)].map((m) => m[1]);
}
const contexteCharge = (skill) => lancer("contexte", skill).stdout;
const titres2 = (texte) => [...texte.replace(/```[\s\S]*?```/g, "").matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);

test("pulse-skills : aucun constat bloquant de pulse-aidd skill verifier (conventions Pulse)", () => {
  const bloquants = verifier(RACINE, { pulse: true }).filter((c) => c.gravite === "bloquant");
  assert.deepStrictEqual(bloquants.map((c) => `${c.regle} · ${c.fichier}:${c.ligne} · ${c.message}`), []);
});

test("pulse-skills : déclaré au catalogue, dépend de la mineure courante de pulse", () => {
  const catalogue = JSON.parse(lire(DEPOT, ".claude-plugin", "marketplace.json"));
  assert.ok(catalogue.plugins.some((p) => p.name === "pulse-skills" && p.source === "./plugins/pulse-skills"));
  const manifeste = JSON.parse(lire(RACINE, ".claude-plugin", "plugin.json"));
  const coeur = JSON.parse(lire(CORE, ".claude-plugin", "plugin.json")).version;
  assert.strictEqual(manifeste.name, "pulse-skills");
  assert.deepStrictEqual(manifeste.dependencies, [{ name: "pulse", version: "^" + coeur.split(".").slice(0, 2).join(".") }]);
});

test("pulse-skills contexte : les règles communes du cœur et les règles des skills, sous la limite de lecture", () => {
  for (const skill of ["skill-creator", "audit-skill", "optimize-skill"]) {
    const sortie = contexteCharge(skill);
    assert.match(sortie, /===== Règles communes Pulse =====\n\n# Règles communes/, skill);
    assert.match(sortie, /===== Règles des skills =====/, skill);
    assert.ok(sortie.length < 30000, `${skill} : ${sortie.length} caractères`);
  }
});

test("pulse-skills : références, modèles et agent affichés ; un nom inconnu ou hors du dossier est refusé", () => {
  assert.match(lancer("reference", "regles-skills.md").stdout, /K1 à K14/);
  assert.match(lancer("reference", "optimize-skill/plan.md").stdout, /\S/);
  assert.match(lancer("modele", "audit-skill/rapport.md").stdout, /\S/);
  assert.match(lancer("agent", "skill-auditor").stdout, /^---\nname: skill-auditor/);
  for (const args of [["reference", "../../pulse-vibe/references/git.md"], ["modele", "../README.md"], ["agent", "../README"]]) assert.strictEqual(lancer(...args).status, 1, args.join(" "));
  assert.strictEqual(lancer("contexte", "inconnue").status, 0, "contexte ne sort jamais en erreur");
});

test("pulse-aidd ne connaît plus ces commandes ; le cœur garde l'outil de mesure", () => {
  const coeur = lire(CORE, "bin", "pulse-aidd");
  assert.doesNotMatch(coeur, /audit-skill|skill-auditor/);
  assert.match(coeur, /^ {2}skill\)$/m);
  for (const s of ["skill-creator", "audit-skill", "optimize-skill"]) assert.ok(!fs.existsSync(path.join(CORE, "skills", s)), s);
});

test("skill-auditor : lecture seule, sonnet, règles des skills lues en entier, deux modes (audit, avant-apres)", () => {
  const texte = lire(RACINE, "agents", "skill-auditor.md");
  const [, entete, corps] = texte.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || [];
  assert.ok(entete, "en-tête");
  assert.match(entete, /^tools: Read, Grep, Glob, Bash$/m, "lecture seule : Read, Grep, Glob, Bash");
  assert.match(entete, /^model: sonnet$/m);
  // La liste Bash « seulement pour » nomme chaque commande que l'agent lance.
  const phrase = (corps.match(/^- Utiliser Bash seulement[^\n]*$/m) || [])[0] || "";
  for (const c of ["pulse-aidd skill mesurer", "pulse-aidd skill verifier", "pulse-skills reference regles-skills.md"]) assert.ok(phrase.includes(c), `liste Bash : ${c}`);
  assert.doesNotMatch(corps, /pulse-aidd skill usage/, "l'usage observé est lu par la commande, avec l'accord de la personne");
  assert.match(corps, /`pulse-skills reference regles-skills\.md`[^\n]*en entier/, "règles lues en entier");
  // Mode audit : les règles de jugement, un verdict par règle, des constats avec correction et gain.
  assert.match(corps, /`audit`/);
  for (const k of ["K1", "K3", "K6", "K8", "K12", "K13"]) assert.match(corps, new RegExp(`\\b${k}\\b`), k);
  assert.match(corps, /K<n> · gravité · fichier:ligne · message · correction proposée · gain estimé/);
  // Mode avant-apres : ce qui a disparu, et un verdict.
  assert.match(corps, /`avant-apres`/);
  for (const perte of ["règle", "validation", "question clé", "garde-fou", "étape"]) assert.match(corps, new RegExp(perte), perte);
  assert.match(corps, /aucune perte \| pertes/);
});

test("audit-skill : constat par script, jugement par skill-auditor par lots de 5, usage lu avec accord, rapport écrit, rien de modifié", () => {
  const texte = lire(RACINE, "skills", "audit-skill", "SKILL.md");
  const motifs = motifsBash(path.join(RACINE, "skills", "audit-skill", "SKILL.md"));
  const ligne = (texte.match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
  const processus = texte.split(/^## Processus\s*$/m)[1].split(/^## Exemples\s*$/m)[0];
  for (const m of ["pulse-skills contexte audit-skill", "pulse-aidd skill mesurer *", "pulse-aidd skill verifier *", "pulse-aidd skill empreinte *", "pulse-skills modele audit-skill/*", "pulse-skills reference *", "pulse-skills agent skill-auditor"])
    assert.ok(motifs.includes(m), `allowed-tools : Bash(${m})`);
  for (const o of ["Read", "Glob", "Grep", "Write(docs/audits-skills/**)"]) assert.ok(ligne.split(/\s+/).includes(o), `allowed-tools : ${o}`);
  // Rien n'est modifié : aucune écriture autorisée d'avance hors du dossier des rapports, aucune commande git (l'empreinte vient du script).
  assert.deepStrictEqual([...ligne.matchAll(/\b(?:Write|Edit|MultiEdit)\(([^)]*)\)/g)].map((m) => m[1]), ["docs/audits-skills/**"]);
  assert.deepStrictEqual(motifs.filter((m) => /^git\b/.test(m)), []);
  assert.match(processus, /`pulse-aidd skill empreinte <chemin>`[^\n]*(taille|octets)[^\n]*date/);
  // Cible par défaut, une seule formulation : les skills et agents du projet (.claude/).
  assert.match(texte, /^argument-hint: .*\(par défaut : les skills et agents du projet, \.claude\/\)"$/m);
  assert.match(texte.split(/^## Contexte\s*$/m)[1], /vide = les skills et agents du projet, `\.claude\/`/);
  assert.doesNotMatch(texte, /\.claude\/skills\/`?\)/, "plus de « .claude/skills/ » comme cible par défaut");
  assert.match(processus, /`~\/\.claude\/skills\/`/, "proposition : les skills personnelles");
  // Aucune skill trouvée : réponse claire, sans rapport, jamais « chemin inexistant » sans argument.
  assert.match(processus, /`skills: 0`[^\n]*sans rapport/);
  assert.match(processus, /[Ss]ans argument[^\n]*`introuvable: \.claude`[^\n]*sans rapport/);
  // Les lignes de l'outil, lues à la bonne étape : introuvable et hors-format au départ, installe après verifier.
  assert.match(processus, /`introuvable:`/);
  assert.match(processus, /`hors-format:`/);
  assert.ok(processus.indexOf("`installe: oui`") > processus.indexOf("`pulse-aidd skill verifier <chemin>`"), "installe: oui traité après verifier");
  assert.match(processus, /`mode: resume`/, "mesurer résumé sur un gros dossier");
  // L'historique des sessions : lu seulement avec l'accord de la personne (Claude Code le demande à chaque audit).
  assert.ok(!motifs.some((m) => couvre(m, "pulse-aidd skill usage")), "skill usage passe par la demande d'accord");
  assert.ok(estSensible("pulse-aidd skill usage"), "skill usage : geste soumis à l'accord, dans scripts/skill.js");
  assert.match(processus, /AskUserQuestion : « Oui, lire l'historique \(Recommandé\) »/);
  assert.match(processus, /accord[^\n]*`pulse-aidd skill usage`/, "skill usage lancé après l'accord");
  assert.match(processus, /non observée sur la période/);
  assert.match(processus, /`note:`[^\n]*assistant/, "la note sur l'historique des assistants est transmise");
  // Le jugement : skill-auditor, mode audit, lots de 5 en parallèle, repli.
  assert.match(processus, /`pulse-skills:skill-auditor`[^\n]*`audit`/);
  assert.match(processus, /lots de 5 skills[^\n]*en parallèle|en parallèle[^\n]*lots de 5 skills/);
  assert.match(processus, /`pulse-skills agent skill-auditor`/, "repli si l'assistant est indisponible");
  // Le rapport : un par cible (projet, personnelles), au modèle, rien d'autre de modifié.
  assert.match(processus, /docs\/audits-skills\/<nom>-<AAAA-MM-JJ>\.md/);
  assert.match(processus, /`pulse-skills modele audit-skill\/rapport\.md`/);
  assert.match(processus, /un rapport par cible[^\n]*`skills-projet`[^\n]*`skills-personnelles`/);
  assert.match(processus, /[Rr]ien n'est modifié/);
  // Le contexte charge les règles des skills.
  assert.ok(contexteCharge("audit-skill").includes("===== Règles des skills ====="), "contexte : regles-skills.md");
  const rapport = lire(RACINE, "skills", "audit-skill", "assets", "rapport.md");
  for (const partie of ["## Empreinte", "## Mesures", "## Usage observé", "non lu", "## Verdict par règle", "## Constats", "### Bloquants", "### À corriger", "### Conseils", "## Gain estimé"]) assert.ok(rapport.includes(partie), `rapport : ${partie}`);
  assert.match(rapport, /\| Fichier \| Empreinte \| Taille \| Date \|/);
  for (let k = 1; k <= 14; k++) assert.match(rapport, new RegExp(`^\\| K${k} `, "m"), `rapport : K${k}`);
  // L'agent reprend tous les constats du script (K3 et K8 compris) et la note sur l'historique.
  const agent = lire(RACINE, "agents", "skill-auditor.md");
  assert.match(agent, /tous les constats de `verifier`/);
  assert.match(agent, /`note:`/);
  // Aucune skill trouvée : la création d'une skill est proposée, à taper par la personne.
  for (const ligne of processus.split("\n").filter((l) => /`skills: 0`|`introuvable: \.claude`/.test(l)))
    assert.match(ligne, /tapez `\/pulse-skills:skill-creator`/, `aucune skill : création proposée (${ligne.slice(0, 40)})`);
});

test("skill-creator : questions une à une, plan validé, skill ordinaire écrite au modèle, verifier jusqu'à zéro bloquant, essai proposé", () => {
  const texte = lire(RACINE, "skills", "skill-creator", "SKILL.md");
  const motifs = motifsBash(path.join(RACINE, "skills", "skill-creator", "SKILL.md"));
  const ligne = (texte.match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
  const processus = texte.split(/^## Processus\s*$/m)[1].split(/^## Exemples\s*$/m)[0];
  assert.match(texte, /^disable-model-invocation: true$/m);
  for (const m of ["pulse-skills contexte skill-creator", "pulse-aidd skill mesurer *", "pulse-aidd skill verifier *", "pulse-skills modele skill-creator/*", "pulse-skills reference *"])
    assert.ok(motifs.includes(m), `allowed-tools : Bash(${m})`);
  for (const o of ["Read", "Glob", "Grep", "Write(.claude/skills/**)", "Edit(.claude/skills/**)"]) assert.ok(ligne.split(/\s+/).includes(o), `allowed-tools : ${o}`);
  // Écrit seulement dans les skills du projet sans demande ; ailleurs (skills personnelles, plugin), Claude Code demande l'accord.
  assert.deepStrictEqual([...ligne.matchAll(/\b(?:Write|Edit|MultiEdit)\(([^)]*)\)/g)].map((m) => m[1]), [".claude/skills/**", ".claude/skills/**"]);
  assert.deepStrictEqual(motifs.filter((m) => /^git\b/.test(m) || /^pulse-aidd skill (?:usage|empreinte)/.test(m)), []);
  // Questions de fond, une à la fois : travail, phrases, qui la lance, effets, destinataire, emplacement (projet par défaut).
  assert.match(processus, /une à la fois/);
  for (const q of ["travail", "phrases", "Qui la lance", "touche", "À qui elle parle", "Où la ranger"]) assert.match(processus, new RegExp(q), `question : ${q}`);
  assert.match(processus, /« Dans ce projet, `\.claude\/skills\/` \(Recommandé\) »/);
  assert.match(processus, /`~\/\.claude\/skills\/<nom>\/`/);
  // Un dossier déjà là n'est pas écrasé.
  assert.match(processus, /existe déjà/);
  // Plan de la skill validé avant d'écrire.
  assert.match(processus, /« Écrire cette skill \(Recommandé\) »/);
  assert.ok(processus.indexOf("« Écrire cette skill (Recommandé) »") < processus.indexOf("`pulse-skills modele skill-creator/SKILL.md`"), "plan validé avant l'écriture");
  // Une skill ordinaire : aucun outil Pulse dans le projet de la personne ; conventions Pulse seulement dans un plugin Pulse.
  assert.match(texte, /sans `pulse-aidd`/);
  assert.match(processus, /plugin Pulse[^\n]*`CLAUDE\.md` du dépôt/);
  // Contrôle par script jusqu'à zéro bloquant, puis mesure.
  assert.match(processus, /`pulse-aidd skill verifier <chemin>`[^\n]*jusqu'à[^\n]*bloquant/);
  assert.match(processus, /`pulse-aidd skill mesurer <chemin>`/);
  assert.ok(processus.indexOf("`pulse-aidd skill verifier <chemin>`") < processus.indexOf("`pulse-aidd skill mesurer <chemin>`"), "verifier puis mesurer");
  // Résultat montré et essai proposé (la personne tape la skill).
  assert.match(processus, /essai/i);
  assert.match(processus, /tapez `\/<nom>/);
  assert.ok(contexteCharge("skill-creator").includes("===== Règles des skills ====="), "contexte : regles-skills.md");
  // Le modèle : une skill ordinaire, à la trame recommandée, sans outil Pulse.
  const modele = lire(RACINE, "skills", "skill-creator", "assets", "SKILL.md");
  assert.match(modele, /^---\nname: <[^>]+>\ndescription: /);
  assert.match(modele, /^disable-model-invocation: true$/m);
  assert.match(modele, /^allowed-tools: /m);
  assert.deepStrictEqual(titres2(modele), ["Objectif", "Règles", "Contexte", "Processus", "Exemples", "Références"]);
  assert.doesNotMatch(modele, /pulse-aidd|\/pulse:/, "aucun outil Pulse dans une skill ordinaire");
  // La description du modèle est entre guillemets : une skill écrite d'après lui passe verifier sans aucun constat.
  assert.match(modele, /^description: "[^\n]*"$/m);
  const essai = fs.mkdtempSync(path.join(require("os").tmpdir(), "pulse-modele-"));
  try {
    fs.mkdirSync(path.join(essai, ".claude", "skills", "essai"), { recursive: true });
    fs.writeFileSync(path.join(essai, ".claude", "skills", "essai", "SKILL.md"), modele);
    assert.deepStrictEqual(verifierSkills(path.join(essai, ".claude", "skills", "essai")).map((c) => `${c.regle} · ${c.gravite} · ${c.message}`), []);
  } finally {
    fs.rmSync(essai, { recursive: true, force: true });
  }
  // Doublons (K1) cherchés dans l'emplacement choisi, une fois l'emplacement connu.
  assert.match(processus, /Glob `<emplacement>\/\*\/SKILL\.md`/);
  assert.ok(processus.indexOf("Glob `<emplacement>/*/SKILL.md`") > processus.indexOf("**Où la ranger**"), "doublons cherchés après le choix de l'emplacement");
});

test("optimize-skill : audit réutilisé, plan validé, cache refusé, sauvegarde toujours faite hors des skills, relecture avant / après (opus) refaite après correction, commit proposé seulement si suivi par Git", () => {
  const fichier = path.join(RACINE, "skills", "optimize-skill", "SKILL.md");
  const texte = lire(fichier);
  const motifs = motifsBash(fichier);
  const ligne = (texte.match(/^allowed-tools:\s*(.*)$/m) || [])[1] || "";
  const processus = texte.split(/^## Processus\s*$/m)[1].split(/^## Exemples\s*$/m)[0];
  const lignes = processus.split("\n");
  const position = (re) => lignes.findIndex((l) => re.test(l));
  assert.match(texte, /^disable-model-invocation: true$/m);
  for (const m of ["pulse-skills contexte optimize-skill", "pulse-aidd skill mesurer *", "pulse-aidd skill verifier *", "pulse-aidd skill empreinte *", "pulse-skills modele audit-skill/*", "pulse-skills reference *", "pulse-skills reference optimize-skill/*", "pulse-skills agent skill-auditor"])
    assert.ok(motifs.includes(m), `allowed-tools : Bash(${m})`);
  // Aucune commande git : le suivi par Git vient de `pulse-aidd skill empreinte`, l'avant de la sauvegarde.
  assert.deepStrictEqual(motifs.filter((m) => /^git\b/.test(m)), []);
  assert.doesNotMatch(texte, /git (?:diff|status)/);
  for (const o of ["Read", "Glob", "Grep"]) assert.ok(ligne.split(/\s+/).includes(o), `allowed-tools : ${o}`);
  // Écritures sans demande : les skills du projet et le rapport ; ailleurs (skills personnelles, plugins), l'accord de Claude Code.
  assert.deepStrictEqual([...ligne.matchAll(/\b(?:Write|Edit|MultiEdit)\(([^)]*)\)/g)].map((m) => m[1]).sort(), [".claude/skills/**", ".claude/skills/**", "docs/audits-skills/**", "docs/audits-skills/**"]);
  assert.ok(!motifs.some((m) => couvre(m, "pulse-aidd skill usage")), "l'historique des sessions reste soumis à l'accord");
  // Aucun enchaînement de commit : ni git add ni git commit autorisés, ni étape commit chargée ; /pulse:commit seulement à taper, sous Git.
  assert.deepStrictEqual(motifs.filter((m) => /^git (?:add|commit|checkout|restore|reset|stash)\b/.test(m)), []);
  assert.doesNotMatch(texte, /pulse-aidd etape commit/);
  const commits = texte.split("\n").filter((l) => l.includes("`/pulse:commit`"));
  assert.ok(commits.length >= 1, "l'enregistrement est proposé");
  for (const l of commits) assert.match(l, /`suivi-git: oui`[^\n]*tapez `\/pulse:commit`/, `commit à taper, seulement avec suivi-git: oui : ${l.slice(0, 60)}`);
  assert.match(processus, /`pulse-aidd skill empreinte <chemin>`[^\n]*`suivi-git:`/);
  // Plugin installé (cache de Claude Code) : la skill reste telle quelle, le dossier source est indiqué.
  const cache = lignes.find((l) => l.includes("`installe: oui`")) || "";
  assert.match(cache, /plugins\/cache/);
  assert.match(cache, /telle quelle/);
  assert.match(cache, /mise à jour/);
  assert.match(cache, /dossier source/);
  // Toujours une sauvegarde, avant toute modification, hors des dossiers de skills (ni chargée ni enregistrée par mégarde),
  // avec les noms de fichiers d'origine : projet → docs/audits-skills/sauvegardes/, sans demande ; personnelle → ~/.claude/skills-sauvegardes/, avec l'accord.
  const copie = position(/^### 5\. .*toujours/i);
  assert.ok(copie >= 0, "étape 5 : la sauvegarde, toujours");
  const etape5 = processus.split(/^### 5\./m)[1].split(/^### 6\./m)[0];
  assert.match(etape5, /[Aa]vant toute modification/);
  assert.match(etape5, /`docs\/audits-skills\/sauvegardes\/<nom>-<AAAA-MM-JJ>\/`[^\n]*sans demande/);
  assert.match(etape5, /`~\/\.claude\/skills-sauvegardes\/<nom>-<AAAA-MM-JJ>\/`[^\n]*accord/);
  assert.match(etape5, /noms d'origine/);
  assert.doesNotMatch(texte, /SKILL\.md\.avant|\.avant-</, "plus de copie à côté de la skill");
  assert.ok(ligne.split(/\s+/).includes("Write(docs/audits-skills/**)"), "sauvegarde du projet écrite sans demande");
  // Le rapport d'audit du jour est réutilisé si l'empreinte est la même.
  assert.match(processus, /du jour[^\n]*empreinte|empreinte[^\n]*du jour/);
  assert.match(processus, /`pulse-skills modele audit-skill\/rapport\.md`/);
  // Audit court : l'audit complet (usage observé compris) reste à taper.
  assert.match(processus, /pour un audit complet[^\n]*tapez `\/pulse-skills:audit-skill <chemin>`/i);
  // Plan point par point, validation tout / partie / rien, avant toute modification.
  assert.match(processus, /`pulse-skills reference optimize-skill\/plan\.md`/);
  const validation = position(/« Tout appliquer \(Recommandé\) » \/ « Une partie » \/ « Rien »/);
  assert.ok(validation >= 0, "validation : tout, une partie, rien");
  assert.ok(validation < copie, "validation avant la copie et l'application");
  // Relecture avant / après par skill-auditor, avec le modèle opus ; pertes corrigées une fois.
  const relecture = lignes.find((l) => /`pulse-skills:skill-auditor`/.test(l) && /`avant-apres`/.test(l)) || "";
  assert.match(relecture, /`opus`/);
  assert.ok(position(/`avant-apres`/) > copie, "relecture après l'application");
  // L'avant de la relecture est la sauvegarde, jamais un diff.
  const etape7 = processus.split(/^### 7\./m)[1].split(/^### 8\./m)[0];
  assert.match(etape7, /sauvegarde/);
  // Pertes : corrigées une fois, puis une seconde relecture ; s'il en reste, arrêt, pertes dites simplement, choix de la personne.
  assert.match(etape7, /pertes?[^\n]*une fois/);
  assert.match(etape7, /relire une seconde fois|seconde relecture/i);
  assert.match(etape7, /s'arrêter/);
  assert.match(etape7, /mots de tous les jours/);
  assert.match(etape7, /AskUserQuestion : « Remettre la sauvegarde \(Recommandé\) » \/ « Garder ainsi »/);
  assert.match(etape7, /Remettre la sauvegarde[^\n]*recopier/);
  assert.match(processus, /`pulse-skills agent skill-auditor`/, "repli si l'assistant est indisponible");
  assert.ok(contexteCharge("optimize-skill").includes("===== Règles des skills ====="), "contexte : regles-skills.md");
  // La forme du plan et du bilan.
  const plan = lire(RACINE, "skills", "optimize-skill", "references", "plan.md");
  for (const partie of ["## Plan d'optimisation", "## Bilan avant / après", "Gardé tel quel", "| N° | Règle | Changement | Gain attendu | Risque pour la qualité |", "| Mesure | Avant | Après | Écart |"]) assert.ok(plan.includes(partie), `plan.md : ${partie}`);
  // audit-skill renvoie à optimize-skill ; les règles des skills nomment les trois commandes.
  assert.match(lire(RACINE, "skills", "audit-skill", "SKILL.md"), /Prochaine étape : [^\n]*tapez `\/pulse-skills:optimize-skill <chemin>`/);
  const utilise = (lire(RACINE, "references", "regles-skills.md").match(/^Utilisé par [^\n]*/m) || [""])[0];
  for (const c of ["`/pulse-skills:skill-creator`", "`/pulse-skills:audit-skill`", "`/pulse-skills:optimize-skill`", "`pulse-skills:skill-auditor`"]) assert.ok(utilise.includes(c), `regles-skills.md, « Utilisé par » : ${c}`);
  // Le wiki dit la même chose : une sauvegarde à chaque fois.
  const page = lire(DEPOT, "docs", "commandes", "optimize-skill.html");
  assert.match(page, /docs\/audits-skills\/sauvegardes\//);
  assert.doesNotMatch(page, /Seulement pour une skill qui n'est pas enregistrée|\.avant-/);
});

test("optimize-skill : la sauvegarde du projet supprimée avant /pulse:commit ; les fichiers binaires listés, hors de la sauvegarde, laissés tels quels", () => {
  const texte = lire(RACINE, "skills", "optimize-skill", "SKILL.md");
  const processus = texte.split(/^## Processus\s*$/m)[1].split(/^## Exemples\s*$/m)[0];
  const etape5 = processus.split(/^### 5\./m)[1].split(/^### 6\./m)[0];
  const etape7 = processus.split(/^### 7\./m)[1].split(/^### 8\./m)[0];
  const etape8 = processus.split(/^### 8\./m)[1];
  // Sous docs/, la sauvegarde serait enregistrée avec la skill : la supprimer avant de taper /pulse:commit.
  assert.match(etape8, /[Ss]upprime[rz][^\n]*sauvegarde[^\n]*avant[^\n]*`\/pulse:commit`/);
  // Read puis Write ne copient pas un fichier binaire : listé, absent de la sauvegarde, jamais modifié ; la personne le copie si elle le souhaite.
  assert.match(etape5, /binaire/);
  assert.match(etape5, /`binaire`[^\n]*`pulse-aidd skill mesurer`|`pulse-aidd skill mesurer`[^\n]*`binaire`/);
  assert.match(etape5, /binaire[^\n]*pas dans la sauvegarde/);
  assert.match(etape5, /binaire[^\n]*tel quel/);
  assert.match(etape5, /binaire[^\n]*vous-même/);
  assert.match(etape7, /binaire/, "remettre la sauvegarde : les fichiers binaires sont restés en place");
  const page = lire(DEPOT, "docs", "commandes", "optimize-skill.html");
  assert.match(page, /binaire/);
  assert.match(page, /[Ss]upprime[rz][^<]*sauvegarde[^<]*avant[^<]*\/pulse:commit|<a href="commit\.html"><code>\/pulse:commit<\/code><\/a>[^<]*sauvegarde/);
});

test("audit du jour repris par optimize-skill : celui de la skill seule, et le wiki le dit", () => {
  assert.match(lire(RACINE, "skills", "optimize-skill", "SKILL.md"), /`docs\/audits-skills\/<nom>-<AAAA-MM-JJ>\.md`, le nom de la skill/);
  const optimize = lire(DEPOT, "docs", "commandes", "optimize-skill.html");
  const audit = lire(DEPOT, "docs", "commandes", "audit-skill.html");
  assert.match(optimize, /audit[^<]*de cette seule skill|audit-skill.html"><code>\/pulse-skills:audit-skill <chemin de la skill>/);
  assert.match(audit, /skill seule|une seule skill[^<]*repris/);
  assert.doesNotMatch(audit, /Le rapport du jour est repris tel quel si la skill n'a pas changé/);
});

test("fichiers-projet.md : les rapports d'audit des skills, les sauvegardes et les skills créées", () => {
  const liste = lire(CORE, "references", "fichiers-projet.md");
  assert.match(liste, /^\| `docs\/audits-skills\/<nom>-<AAAA-MM-JJ>\.md` \| `\/pulse-skills:audit-skill`, `\/pulse-skills:optimize-skill` \|/m);
  assert.match(liste, /^\| `docs\/audits-skills\/sauvegardes\/<nom>-<AAAA-MM-JJ>\/` \| `\/pulse-skills:optimize-skill` \|/m);
  assert.match(liste, /^\| `\.claude\/skills\/<nom>\/` \| `\/pulse-skills:skill-creator`, `\/pulse-skills:optimize-skill` \|/m);
});

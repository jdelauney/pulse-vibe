#!/usr/bin/env node
// Pulse – les gestes Git de /pulse:annuler (`pulse-aidd annuler`), testés et réversibles.
//
//   pulse-aidd annuler etat [--session <id>]
//   pulse-aidd annuler apercu <T3 | US-003 | version <commit> | annulation <commit>>
//   pulse-aidd annuler defaire <même cible>
//   pulse-aidd annuler mettre-de-cote [--resume "<mots>"] [-- <fichier…>]
//   pulse-aidd annuler recuperer <stash@{k} | commit>
//
// Sortie : lignes « clé: valeur ». Codes : 0 fait, 1 usage, 2 refus préalable (rien n'a changé),
// 3 échec rattrapé (état d'avant remis).
// Opérations Git permises : stash push / apply, revert --no-commit / --abort, reset --merge (pour défaire
// ses propres changements, sur un dossier vérifié propre au départ), checkout --ours -- (plans seulement),
// add (liste explicite), commit -m, branch sauvegarde/…. Jamais : reset --hard, clean, push, branch -D,
// checkout -- ., stash drop.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const sortie = [];
const dire = (cle, valeur = "") => sortie.push(valeur === "" ? `${cle}:` : `${cle}: ${valeur}`);
function terminer(code) {
  if (sortie.length) fs.writeSync(1, sortie.join("\n") + "\n");
  process.exit(code);
}
const refuser = (etat, ...details) => { dire("etat", etat); for (const [k, v] of details) dire(k, v); terminer(2); };
const usage = (texte) => { dire("usage", texte); terminer(1); };

// ---------------------------------------------------------------- Git

let RACINE = process.cwd();
function git(args, options = {}) {
  const r = spawnSync("git", ["-c", "core.quotepath=off", ...args], { cwd: RACINE, encoding: "utf8", input: options.input });
  return { ok: r.status === 0, sortie: (r.stdout || "").replace(/\r/g, ""), erreur: (r.stderr || "").trim() };
}
const lignesDe = (texte) => texte.split("\n").filter(Boolean);
const gitLignes = (args) => { const r = git(args); return r.ok ? lignesDe(r.sortie) : []; };

function trouverRacine() {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd(), encoding: "utf8" });
  if (r.status !== 0 || !r.stdout.trim()) return false;
  RACINE = path.resolve(r.stdout.trim());
  return true;
}
const aDesCommits = () => git(["rev-parse", "--verify", "-q", "HEAD"]).ok;

/** Chemin reçu de l'extérieur : refusé s'il remonte, est absolu ou commence par une lettre de lecteur. */
function cheminSur(c) {
  return typeof c === "string" && c !== "" && !/(^|[\\/])\.\.([\\/]|$)/.test(c) && !path.isAbsolute(c) && !/^[A-Za-z]:/.test(c) && !c.startsWith("-");
}

function operationEnCours() {
  const chemin = (n) => { const r = git(["rev-parse", "--git-path", n]); return r.ok ? path.resolve(RACINE, r.sortie.trim()) : ""; };
  const existe = (n) => { const c = chemin(n); return c && fs.existsSync(c); };
  if (existe("MERGE_HEAD")) return "fusion";
  if (existe("REVERT_HEAD")) return "annulation";
  if (existe("CHERRY_PICK_HEAD")) return "report";
  if (existe("rebase-merge") || existe("rebase-apply")) return "rebasage";
  return "aucune";
}

// Vrai dès qu'un geste a commencé à modifier le dépôt : un refus « rien n'a changé » ne serait plus vrai.
let modifie = false;

/** Changements non enregistrés (fichiers ignorés exclus) : [{ etat, chemin }]. */
function changements() {
  const r = git(["status", "--porcelain", "-z", "--untracked-files=all"]);
  if (!r.ok && modifie) {
    dire("etat", "conflit-non-nettoye");
    dire("raison", (r.erreur || "git status a échoué").replace(/s+/g, " ").slice(0, 200));
    terminer(3);
  }
  if (!r.ok) refuser("lecture-impossible", ["raison", (r.erreur || "git status a échoué").slice(0, 200)]);
  const morceaux = r.sortie.split("\0").filter(Boolean);
  const res = [];
  for (let i = 0; i < morceaux.length; i++) {
    const m = morceaux[i];
    const etat = m.slice(0, 2);
    res.push({ etat: etat.trim() || "?", chemin: m.slice(3) });
    if (/[RC]/.test(etat)) i++; // l'ancien nom suit
  }
  return res;
}

// ---------------------------------------------------------------- Plans

function listerPlans() {
  const base = path.join(RACINE, "aidd_docs", "tasks");
  const plans = [];
  const parcourir = (dossier, profondeur) => {
    let entrees;
    try { entrees = fs.readdirSync(dossier, { withFileTypes: true }); } catch { return; }
    for (const e of entrees) {
      const complet = path.join(dossier, e.name);
      if (e.isDirectory() && profondeur < 2) parcourir(complet, profondeur + 1);
      else if (e.isFile() && /^PLAN-SPEC-(US-\d+).*\.md$/.test(e.name)) {
        plans.push({ fichier: path.relative(RACINE, complet).split(path.sep).join("/"), us: e.name.match(/^PLAN-SPEC-(US-\d+)/)[1] });
      }
    }
  };
  parcourir(base, 0);
  return plans.sort((a, b) => a.fichier.localeCompare(b.fichier));
}

const lirePlan = (p) => fs.readFileSync(path.join(RACINE, p.fichier), "utf8").replace(/\r\n/g, "\n");

/** Les tâches d'un plan : { id, statut, titre, objectif, fichiers, action, plan, us }. */
function tachesDuPlan(plan) {
  const lignes = lirePlan(plan).split("\n");
  const taches = [];
  let courante = null;
  for (const l of lignes) {
    const m = l.match(/^- \[([ ~x])\] \*\*(T\d+)(?:\s*[–-]\s*(.*?))?\*\*/);
    if (m) {
      courante = { id: m[2], statut: m[1], titre: (m[3] || "").trim(), objectif: "", fichiers: "", action: "", plan: plan.fichier, us: plan.us };
      taches.push(courante);
    } else if (courante) {
      const champ = l.match(/^\s+- (Objectif|Fichiers|Action manuelle) : (.*)$/);
      if (champ) courante[{ Objectif: "objectif", Fichiers: "fichiers", "Action manuelle": "action" }[champ[1]]] = champ[2].trim();
      else if (/^\S/.test(l)) courante = null;
    }
  }
  return taches;
}
const toutesLesTaches = () => listerPlans().flatMap(tachesDuPlan);

/** Passe une tâche à `[x]`, `[ ]` (ou `[~]`) dans le texte d'un plan. */
function changerStatut(texte, id, de, vers) {
  return texte.replace(new RegExp(`^(- )\\[${de === " " ? " " : de}\\]( \\*\\*${id}(?!\\d))`, "m"), `$1[${vers}]$2`);
}

function ajouterJournal(texte, ligne) {
  const lignes = texte.split("\n");
  const debut = lignes.findIndex((l) => /^## Journal\s*$/.test(l));
  if (debut < 0) return texte.replace(/\n*$/, "\n") + `\n## Journal\n\n| Date | Tâche | Commit | Remarque |\n|---|---|---|---|\n${ligne}\n`;
  let fin = -1;
  for (let i = debut + 1; i < lignes.length; i++) {
    if (/^## /.test(lignes[i])) break;
    if (lignes[i].startsWith("|")) fin = i;
  }
  if (fin < 0) { lignes.splice(debut + 1, 0, "", "| Date | Tâche | Commit | Remarque |", "|---|---|---|---|", ligne); }
  else lignes.splice(fin + 1, 0, ligne);
  return lignes.join("\n");
}

const pad = (n) => String(n).padStart(2, "0");
const aujourdhui = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const heureMin = (d = new Date()) => `${pad(d.getHours())}${pad(d.getMinutes())}`;

/** Met les tâches dans l'état voulu (de : leur état actuel exigé, ou null pour n'importe lequel), avec une ligne de journal chacune ; renvoie les plans modifiés. */
function majPlans(ids, de, vers, remarque) {
  const modifies = new Set();
  const taches = toutesLesTaches();
  for (const id of ids) {
    const t = taches.find((x) => x.id === id && (de === null || x.statut === de));
    if (!t) continue;
    const complet = path.join(RACINE, t.plan);
    let texte = fs.readFileSync(complet, "utf8").replace(/\r\n/g, "\n");
    texte = changerStatut(texte, id, t.statut, vers);
    texte = ajouterJournal(texte, `| ${aujourdhui()} | ${id} | — | ${remarque} |`);
    fs.writeFileSync(complet, texte);
    modifies.add(t.plan);
  }
  return [...modifies];
}

// ---------------------------------------------------------------- Commits et cibles

const tachesDuSujet = (sujet) => { const m = sujet.match(/^[a-z]+\((T\d+)\)/); return m ? [m[1]] : []; };
const estAnnulation = (sujet) => /^revert(\(|:)/.test(sujet);

/** Les commits de la branche courante, du plus récent au plus ancien : { hash, parents, sujet }. */
function historique(plage = "HEAD") {
  const r = git(["log", "--format=%H%x09%P%x09%s", plage]);
  if (!r.ok) return [];
  return lignesDe(r.sortie).map((l) => { const [hash, parents, ...s] = l.split("\t"); return { hash, parents: parents ? parents.split(" ") : [], sujet: s.join("\t") }; });
}
const court = (h) => h.slice(0, 7);

function fichiersDuCommit(c) {
  const r = c.parents.length ? git(["diff", "--name-only", `${c.hash}^1`, c.hash]) : git(["show", "--name-only", "--format=", "--root", c.hash]);
  return r.ok ? lignesDe(r.sortie) : [];
}

function hashSur(texte) {
  if (!/^[0-9a-f]{4,40}$/i.test(texte || "")) return null;
  const r = git(["rev-parse", "--verify", "-q", `${texte}^{commit}`]);
  return r.ok ? r.sortie.trim() : null;
}

/**
 * Résout la cible : { type, libelle, commits (récent → ancien), taches, plansUS, version?, annules? }.
 * Un refus (exit 2) sort directement.
 */
function resoudreCible(args) {
  const [genre, valeur] = args;
  if (!genre) usage("annuler apercu|defaire <T3 | US-003 | version <commit> | annulation <commit>>");
  const hist = historique();
  if (/^T\d+$/.test(genre) && args.length === 1) {
    const t = toutesLesTaches().find((x) => x.id === genre);
    if (!t) refuser("tache-inconnue", ["tache", genre]);
    if (t.statut !== "x") refuser("tache-non-terminee", ["tache", genre]);
    const commits = hist.filter((c) => !estAnnulation(c.sujet) && tachesDuSujet(c.sujet).includes(genre));
    if (!commits.length) refuser("aucun-commit", ["tache", genre]);
    return { type: "tache", libelle: genre, commits, taches: [genre] };
  }
  if (/^US-\d+$/.test(genre) && args.length === 1) {
    const plans = listerPlans().filter((p) => p.us === genre);
    if (!plans.length) refuser("us-inconnue", ["us", genre]);
    const ids = plans.flatMap(tachesDuPlan).filter((t) => t.statut === "x").map((t) => t.id);
    const commits = hist.filter((c) => !estAnnulation(c.sujet) && tachesDuSujet(c.sujet).some((t) => ids.includes(t)));
    if (!commits.length) refuser("aucun-commit", ["us", genre]);
    const taches = ids.filter((t) => commits.some((c) => tachesDuSujet(c.sujet).includes(t)));
    return { type: "us", libelle: genre, commits, taches };
  }
  if (genre === "version" && args.length === 2) {
    const h = hashSur(valeur);
    if (!h) refuser("version-inconnue", ["version", valeur || ""]);
    if (!git(["merge-base", "--is-ancestor", h, "HEAD"]).ok) refuser("version-hors-branche", ["version", valeur]);
    const hashes = gitLignes(["rev-list", "--first-parent", `${h}..HEAD`]);
    if (!hashes.length) refuser("version-actuelle", ["version", valeur]);
    const commits = hashes.map((x) => hist.find((c) => c.hash === x));
    const taches = [...new Set(commits.filter((c) => !estAnnulation(c.sujet)).flatMap((c) => tachesDuSujet(c.sujet)))].sort((a, b) => a.slice(1) - b.slice(1));
    return { type: "version", libelle: `version ${court(h)}`, commits, taches, version: h };
  }
  if (genre === "annulation" && args.length === 2) {
    const h = hashSur(valeur);
    const c = h && hist.find((x) => x.hash === h);
    if (!c || !estAnnulation(c.sujet)) refuser("annulation-inconnue", ["annulation", valeur || ""]);
    const corps = git(["log", "-1", "--format=%B", h]).sortie;
    const annules = (corps.match(/^Annule ([0-9a-f ]+)\.$/m) || [])[1];
    if (!annules) refuser("annulation-inconnue", ["annulation", valeur]);
    const taches = [...new Set(annules.split(" ").filter(Boolean).flatMap((a) => { const x = hashSur(a); const cc = x && hist.find((y) => y.hash === x); return cc && !estAnnulation(cc.sujet) ? tachesDuSujet(cc.sujet) : []; }))];
    return { type: "annulation", libelle: `annulation ${court(h)}`, commits: [c], taches, retablit: true };
  }
  usage("annuler apercu|defaire <T3 | US-003 | version <commit> | annulation <commit>>");
}

function sont_envoyes(commits) {
  return commits.some((c) => gitLignes(["branch", "-r", "--contains", c.hash]).length > 0);
}

function adresseEnLigne() {
  try {
    const texte = fs.readFileSync(path.join(RACINE, "CLAUDE.md"), "utf8");
    const m = texte.match(/^- Site en ligne\s*:\s*(\S.*)$/m);
    if (m && !/^\{\{/.test(m[1].trim()) && !/^à compléter/i.test(m[1].trim())) return m[1].trim();
  } catch { /* pas de CLAUDE.md */ }
  return "";
}

// ---------------------------------------------------------------- Arguments

function lireArguments(argv) {
  const positionnels = [];
  const options = {};
  let fichiers = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { fichiers = argv.slice(i + 1); break; }
    if (a === "--session" || a === "--resume") options[a.slice(2)] = argv[++i];
    else if (a.startsWith("--")) usage(`option inconnue : ${a}`);
    else positionnels.push(a);
  }
  return { positionnels, options, fichiers };
}

// ---------------------------------------------------------------- etat

function etat(options) {
  const dernier = historique("-15");
  const ref = git(["log", "-15", "--date=format:%d/%m %H:%M", "--format=%H%x09%ad%x09%s"]);
  const dates = new Map(lignesDe(ref.sortie).map((l) => { const [h, d] = l.split("\t"); return [h, d]; }));
  const taches = toutesLesTaches();
  const usDe = (id) => (taches.find((t) => t.id === id) || {}).us || "—";
  dire("depot", "oui");
  dire("commits", String(parseInt(git(["rev-list", "--count", "HEAD"]).sortie, 10) || 0));
  dire("operation", operationEnCours());
  const chg = changements();
  dire("changements", String(chg.length));
  for (const c of chg) {
    const en = taches.find((t) => t.statut === "~" && t.fichiers.includes(c.chemin));
    dire("changement", `${c.etat} ${c.chemin} · ${en ? en.id : "—"}`);
  }
  for (const c of dernier) {
    const t = tachesDuSujet(c.sujet)[0] || "—";
    dire("version", `${court(c.hash)} · ${dates.get(c.hash) || ""} · ${t} · ${t === "—" ? "—" : usDe(t)} · ${c.sujet} · ${sont_envoyes([c]) ? "envoye" : "local"}`);
  }
  for (const l of gitLignes(["stash", "list", "--format=%gd%x09%gs"])) {
    const [ref2, ...msg] = l.split("\t");
    const texte = msg.join("\t").replace(/^On [^:]+: /, "");
    if (/^pulse-annuler/.test(texte)) dire("mise-de-cote", `${ref2} · ${texte}`);
  }
  for (const b of gitLignes(["branch", "--list", "sauvegarde/*", "--format=%(refname:short)"])) dire("sauvegarde", b);
  for (const c of historique("-60").filter((x) => estAnnulation(x.sujet))) dire("annulation", `${court(c.hash)} · ${c.sujet}`);
  const distant = gitLignes(["remote", "-v"]).length > 0;
  dire("distant", distant ? "oui" : "non");
  dire("en-ligne", adresseEnLigne() || "—");
  if (options.session) {
    const r = spawnSync(process.execPath, [path.join(__dirname, "..", "..", "..", "scripts", "sessions.js"), options.session], { cwd: RACINE, encoding: "utf8" });
    const m = (r.stdout || "").match(/autres=(\d+)/);
    dire("autres-sessions", m ? m[1] : "0");
  }
  terminer(0);
}

// ---------------------------------------------------------------- apercu

function apercu(args) {
  const cible = resoudreCible(args);
  dire("cible", cible.libelle);
  dire("taches", cible.taches.join(" ") || "—");
  const taches = toutesLesTaches();
  for (const id of cible.taches) {
    const t = taches.find((x) => x.id === id);
    if (t) dire("tache", `${id} · ${t.titre || "—"} · ${t.objectif || "—"}`);
  }
  const fichiers = new Set();
  for (const c of cible.commits) {
    dire("commit", `${court(c.hash)} · ${c.sujet}`);
    for (const f of fichiersDuCommit(c)) fichiers.add(f);
  }
  for (const f of [...fichiers].sort()) dire("fichier", f);
  const plusAncien = cible.commits[cible.commits.length - 1];
  const dansCible = new Set(cible.commits.map((c) => c.hash));
  for (const c of historique(`${plusAncien.hash}..HEAD`)) {
    if (dansCible.has(c.hash) || estAnnulation(c.sujet)) continue;
    const communs = fichiersDuCommit(c).filter((f) => fichiers.has(f));
    if (communs.length) dire("posterieure", `${tachesDuSujet(c.sujet)[0] || "—"} · ${court(c.hash)} · ${communs.join(" ")}`);
  }
  for (const id of cible.taches) {
    const t = taches.find((x) => x.id === id);
    if (t && t.action) dire("action-manuelle", `${id} · ${t.action}`);
  }
  dire("envoyes", sont_envoyes(cible.commits) ? "oui" : "non");
  dire("en-ligne", adresseEnLigne() || "—");
  terminer(0);
}

// ---------------------------------------------------------------- defaire

/** L'état du dépôt à un instant : HEAD, opération en cours et changements. */
function instantane() {
  return { head: git(["rev-parse", "HEAD"]).sortie.trim(), operation: operationEnCours(), statut: new Map(changements().map((c) => [normal(c.chemin), c.etat])) };
}

/** Les différences entre l'état d'avant et l'état actuel (liste vide : identique). */
function ecartsAvec(avant) {
  const apres = instantane();
  const ecarts = [];
  if (apres.head !== avant.head) ecarts.push(`HEAD ${court(avant.head)} -> ${court(apres.head)}`);
  if (apres.operation !== avant.operation) ecarts.push(`operation ${apres.operation}`);
  for (const [p, e] of apres.statut) if (avant.statut.get(p) !== e) ecarts.push(`${e} ${p}`);
  for (const p of avant.statut.keys()) if (!apres.statut.has(p)) ecarts.push(`absent ${p}`);
  return ecarts;
}

/**
 * Remet l'état d'avant par `reset --merge`.
 * Réservé aux gestes lancés sur un arbre vérifié propre au départ : sinon `reset --merge` effacerait le travail de la personne.
 * `revert --abort` n'est permis que pour une annulation lancée par ce script (defaire).
 */
function remettreEtatAvant(arbrePropreAuDepart, { abandonnerAnnulation = false } = {}) {
  if (arbrePropreAuDepart !== true) throw new Error("remettreEtatAvant : arbre propre au départ non établi");
  if (abandonnerAnnulation) git(["revert", "--abort"]);
  if (changements().length || operationEnCours() !== "aucune") git(["reset", "--merge"]);
}

/** Termine un geste raté : « echec » seulement si le dépôt est exactement comme avant, sinon « conflit-non-nettoye » et la liste des écarts. */
function terminerEchec(raison, avant, details = []) {
  const ecarts = ecartsAvec(avant);
  dire("etat", ecarts.length ? "conflit-non-nettoye" : "echec");
  dire("raison", raison.replace(/s+/g, " ").slice(0, 300));
  for (const [k, v] of details) dire(k, v);
  for (const x of ecarts) dire("fichier", x);
  terminer(3);
}

let avantDefaire = null;
function echecRattrape(raison, details = []) { // seulement dans defaire, après la vérification de l'arbre propre
  remettreEtatAvant(true, { abandonnerAnnulation: true });
  terminerEchec(raison, avantDefaire, details);
}

const estPlan = (f) => /^aidd_docs\/tasks\/[^/]+(\/[^/]+)?\/PLAN-SPEC-US-[^/]*\.md$/.test(f);

function fichiersEnConflit() {
  return gitLignes(["diff", "--name-only", "--diff-filter=U"]);
}

function defaire(args, retablissement = false) {
  const cible = resoudreCible(args);
  const op = operationEnCours();
  if (op !== "aucune") refuser("operation-en-cours", ["operation", op]);
  const chg = changements();
  if (chg.length) refuser("changements-en-cours", ...chg.map((c) => ["changement", `${c.etat} ${c.chemin}`]));
  const envoyes = sont_envoyes(cible.commits);
  const retablit = Boolean(cible.retablit || retablissement);
  const hashesAvant = git(["rev-parse", "HEAD"]).sortie.trim();
  avantDefaire = instantane();
  modifie = true;

  for (const c of cible.commits) {
    const fusion = c.parents.length > 1;
    const r = git(["revert", "--no-commit", ...(fusion ? ["-m", "1"] : []), c.hash]);
    if (r.ok) continue;
    const conflits = fichiersEnConflit();
    if (conflits.length && conflits.every(estPlan)) {
      for (const p of conflits) {
        if (!git(["checkout", "--ours", "--", p]).ok || !git(["add", "--", p]).ok) echecRattrape(`plan non résolu : ${p}`, [["fichier", p]]);
      }
      continue;
    }
    echecRattrape(r.erreur || "conflit", [["conflit", "oui"], ...conflits.map((f) => ["fichier", f])]);
  }

  // Plans : les tâches défaites repassent à [ ] (ou à [x] pour un rétablissement).
  const hashes = cible.commits.map((c) => court(c.hash));
  const plansModifies = retablit
    ? majPlans(cible.taches, null, "x", "rétablie par /pulse:annuler")
    : majPlans(cible.taches, null, " ", "annulée par /pulse:annuler");
  if (plansModifies.length && !git(["add", "--", ...plansModifies]).ok) echecRattrape("plans non ajoutés");

  let sujet;
  const messages = [];
  if (retablit) sujet = `revert: rétablit ${cible.taches.length ? cible.taches.join(" ") : cible.libelle}`;
  else if (cible.type === "version") {
    const d = new Date(git(["log", "-1", "--format=%cI", cible.version]).sortie.trim());
    sujet = `revert: revient à la version du ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } else sujet = `revert(${cible.libelle}): annule ${titreDe(cible)}`;
  messages.push(sujet, `Annule ${hashes.join(" ")}.`);
  if (cible.type === "version" && cible.taches.length) messages.push(`Tâches défaites : ${cible.taches.join(" ")}`);

  const commit = git(["commit", ...messages.flatMap((m) => ["-m", m])]);
  if (!commit.ok) echecRattrape(commit.erreur || commit.sortie || "commit refusé");

  // Branche de sauvegarde (version) : posée après le commit réussi, sur l'état d'avant (aucune branche en trop si le commit est refusé).
  let sauvegarde = "";
  if (cible.type === "version") {
    const base = `sauvegarde/${aujourdhui()}-${heureMin()}`;
    sauvegarde = base;
    for (let n = 2; git(["rev-parse", "--verify", "-q", `refs/heads/${sauvegarde}`]).ok; n++) sauvegarde = `${base}-${n}`;
    if (!git(["branch", sauvegarde, hashesAvant]).ok) { dire("avertissement", "sauvegarde non créée : l'état d'avant reste le commit " + court(hashesAvant)); sauvegarde = ""; }
  }
  dire("etat", "fait");
  dire("commit", court(git(["rev-parse", "HEAD"]).sortie.trim()));
  dire("taches", cible.taches.join(" ") || "—");
  dire("plans", plansModifies.join(" ") || "—");
  if (sauvegarde) dire("sauvegarde", sauvegarde);
  dire("envoyes", envoyes ? "oui" : "non");
  terminer(0);
}

function titreDe(cible) {
  const taches = toutesLesTaches();
  const titres = cible.taches.map((id) => (taches.find((t) => t.id === id) || {}).titre).filter(Boolean);
  const texte = titres.length ? titres.join(", ") : cible.libelle;
  return texte.length > 50 ? texte.slice(0, 49) + "…" : texte;
}

// ---------------------------------------------------------------- mettre-de-cote

function metteDeCote(options, fichiers) {
  const chg = changements();
  if (!chg.length) refuser("rien-a-mettre-de-cote");
  let cibles = null;
  if (fichiers) {
    if (!fichiers.length) usage("annuler mettre-de-cote [--resume \"<mots>\"] [-- <fichier…>]");
    for (const f of fichiers) if (!cheminSur(f)) refuser("chemin-refuse", ["fichier", f]);
    const connus = new Set(chg.map((c) => c.chemin));
    const absents = fichiers.filter((f) => !connus.has(f.replace(/\\/g, "/")));
    if (absents.length) refuser("fichier-sans-changement", ...absents.map((f) => ["fichier", f]));
    cibles = fichiers.map((f) => f.replace(/\\/g, "/"));
  }
  const maintenant = new Date();
  const resume = (options.resume || "").replace(/\s+/g, " ").trim();
  const message = `pulse-annuler ${aujourdhui(maintenant)} ${pad(maintenant.getHours())}:${pad(maintenant.getMinutes())}${resume ? " " + resume : ""}`;
  modifie = true;
  const r = git(["stash", "push", "-u", "-m", message, ...(cibles ? ["--", ...cibles] : [])]);
  if (!r.ok) { dire("etat", "echec"); dire("raison", r.erreur.slice(0, 300)); terminer(3); }
  dire("etat", "fait");
  dire("mise-de-cote", `stash@{0} · ${message}`);
  const mises = new Set(cibles || chg.map((c) => c.chemin));
  for (const f of mises) dire("fichier", f);

  // Une tâche [~] dont tous les fichiers touchés sont partis repasse à [ ].
  const restes = new Set(changements().map((c) => c.chemin));
  for (const t of toutesLesTaches().filter((x) => x.statut === "~")) {
    const touches = chg.map((c) => c.chemin).filter((f) => t.fichiers.includes(f));
    if (touches.length && touches.every((f) => mises.has(f)) && !touches.some((f) => restes.has(f))) {
      dire("tache-en-cours", t.id);
      majPlans([t.id], "~", " ", "mise de côté par /pulse:annuler");
      dire("plan", t.plan);
    }
  }
  terminer(0);
}

// ---------------------------------------------------------------- recuperer

const normal = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "");
const imbriques = (a, b) => a === b || a.startsWith(b + "/") || b.startsWith(a + "/");

/** Les fichiers de la mise de côté (sans détection de renommage : l'ancien et le nouveau chemin y figurent). */
const fichiersDeLEntree = (ref) => gitLignes(["stash", "show", "--include-untracked", "--name-only", "--no-renames", ref]).map(normal);

/** Ce qui empêche de reprendre l'entrée : arbre occupé, ou chemin de l'entrée déjà présent sur le disque sans être suivi. */
function obstaclesALaReprise(chemins, ref) {
  const obstacles = new Set();
  for (const c of changements()) {
    if (c.etat !== "?" && c.etat !== "??") obstacles.add(normal(c.chemin)); // modifié, préparé, supprimé, en conflit
    else if (chemins.some((p) => imbriques(p, normal(c.chemin)))) obstacles.add(normal(c.chemin));
  }
  const suivis = new Set(gitLignes(["ls-files"]).map(normal));
  for (const p of chemins) {
    if (fs.existsSync(path.join(RACINE, p)) && !suivis.has(p)) obstacles.add(p);
    // Un dossier parent de l'entrée qui existe comme fichier serait remplacé par un dossier.
    const morceaux = p.split("/");
    for (let k = 1; k < morceaux.length; k++) {
      const parent = morceaux.slice(0, k).join("/");
      try { if (!fs.statSync(path.join(RACINE, parent)).isDirectory()) obstacles.add(parent); } catch { /* absent : rien à craindre */ }
    }
  }
  // Un fichier non suivi de l'entrée que HEAD suit désormais : la reprise le changerait à moitié.
  for (const f of gitLignes(["ls-tree", "-r", "--name-only", `${ref}^3`]).map(normal)) if (suivis.has(f)) obstacles.add(f);
  return [...obstacles];
}

/** Reprise ratée sur un arbre propre au départ : `reset --merge`, puis retrait des seuls fichiers neufs créés par la reprise. */
function annulerReprise(ref, chemins, avant, sortieGit) {
  const conflits = fichiersEnConflit();
  remettreEtatAvant(true);
  for (const p of chemins) {
    if (!cheminSur(p) || git(["cat-file", "-e", `HEAD:${p}`]).ok) continue; // un fichier suivi est revenu à HEAD par reset --merge
    if (avant.statut.has(p)) continue;
    try { fs.rmSync(path.join(RACINE, p), { force: true }); } catch (e) { dire("erreur", `${p} : ${e.message}`); }
  }
  terminerEchec(sortieGit, avant, [["mise-de-cote", ref], ...conflits.map((f) => ["fichier-en-conflit", f])]);
}

function recuperer(args) {
  const [ref] = args;
  if (!ref || args.length !== 1) usage("annuler recuperer <stash@{k} | commit>");
  const estPile = /^stash@\{\d+\}$/.test(ref);
  if (estPile) {
    const entree = gitLignes(["stash", "list", "--format=%gd%x09%gs"]).map((l) => l.split("\t")).find(([r]) => r === ref);
    if (!entree) refuser("mise-de-cote-inconnue", ["mise-de-cote", ref]);
    const texte = entree.slice(1).join("\t").replace(/^On [^:]+: /, "");
    if (!/^pulse-annuler/.test(texte)) refuser("mise-de-cote-etrangere", ["mise-de-cote", `${ref} · ${texte}`]);
    const op = operationEnCours();
    if (op !== "aucune") refuser("operation-en-cours", ["operation", op]);
    const dedans = fichiersDeLEntree(ref);
    const obstacles = obstaclesALaReprise(dedans, ref);
    if (obstacles.length) refuser("arbre-occupe", ...obstacles.map((f) => ["fichier", f]));
    const avant = instantane();
    modifie = true;
    const r = git(["stash", "apply", ref]);
    if (!r.ok) annulerReprise(ref, dedans, avant, `${r.erreur} ${r.sortie}`);
    dire("etat", "fait");
    dire("a-supprimer", ref);
    terminer(0);
  }
  defaire(["annulation", ref], true);
}

// ---------------------------------------------------------------- Programme

const [sous, ...reste] = process.argv.slice(2);
if (!sous || !["etat", "apercu", "defaire", "mettre-de-cote", "recuperer"].includes(sous)) {
  usage("pulse-aidd annuler etat|apercu|defaire|mettre-de-cote|recuperer");
}
if (!trouverRacine() || !aDesCommits()) {
  if (sous === "etat") { dire("depot", "non"); terminer(0); }
  refuser("pas-de-depot");
}
const { positionnels, options, fichiers } = lireArguments(reste);
switch (sous) {
  case "etat": etat(options); break;
  case "apercu": apercu(positionnels); break;
  case "defaire": defaire(positionnels); break;
  case "mettre-de-cote": metteDeCote(options, fichiers); break;
  case "recuperer": recuperer(positionnels); break;
}

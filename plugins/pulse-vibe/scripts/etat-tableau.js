// Pulse – tableau de bord de /pulse:status (`pulse-aidd etat --tableau`) et signaux de suivi du référencement.
//
// `tableau(racine, faits, options)` : les lignes « clé: valeur » ajoutées à la sortie de `pulse-aidd etat` par --tableau
// (une clé répétée = une liste) :
//   projet: TodoIt                        titre de CLAUDE.md, sinon nom du dossier
//   pile: …                               première ligne du bloc pulse_pile de CLAUDE.md, ou « non choisie »
//   rythme: complet                       « Rythme » du profil
//   groupe: <dossier> | US-001 spec=<absente|brouillon|verrouillee> plan=<absent|a-valider|valide> maquette=<oui|non> | …
//                                         US du référentiel sans fichier : groupe « sans-dossier »
//   tache: US-001 T2 <a-faire|en-cours|terminee>[ en-pause] <titre>
//   plan: US-001 envoi=<choix> parallele=<US-…,…|aucune> titre=<titre de l'US, d'après le titre du plan>
//   git: modifies=<n> dernier=<sujet|aucun> distant=<oui|non> branche=<nom>            (sauf --sans-git)
//   sessions: <autres sessions ouvertes sur ce dossier>
//   worktree: <nom> branche=<b> avance=<n> modifies=<n> fusionne=<oui|non>             (.claude/worktrees/*)
//   branche-fusionnee: feat/us-…          branche locale sans dossier à part, déjà fusionnée, autre que la courante
//   ci: <github|gitlab|aucune> fichier=<chemin>
//   en-ligne: <adresse|non>
//   referencement: relie=<AAAA-MM-JJ|oui|non> rapport=<AAAA-MM-JJ|aucun> prochain=<AAAA-MM-JJ|aucun>
//   seo-suivi: <oui|non> rendez-vous=<AAAA-MM-JJ|aucun>
//                                         faits de suivi illisibles : « referencement: illisible », « seo-suivi: illisible »
//                                         (etat.js écrit alors « suivi: illisible (<raison>) » ; un tableau illisible : « tableau: illisible (<raison>) »)
//   revue: <Tn|US-XXX> etat=<…> date=<AAAA-MM-JJ> fichier=<chemin>   (ou « aucune »)
//   securite: <AAAA-MM-JJ|absent>
//   memoire: bloc=<oui|non> glossaire=<n> decisions=<n>
//   en-cours-sans-trace: T3               tâche [~] sans dossier à part de son US, dossier principal sans modification
//                                         ni enregistrement d'avance (seulement avec Git)
//
// `lireSuivi(racine, aujourdhui)` et `appliquerSuivi(f, verdict, pret)` : les signaux de suivi tirés des fichiers, appliqués
// par `decider` (etat.js) quand la première version est prête ou le site en ligne. Le premier signal remplace un verdict
// R21 à R23 (règle R24, le verdict passe dans « aussi ») ; sinon les signaux passent en tête de « aussi ». La CI en échec
// (réseau) reste lue par /pulse:status.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const lireSi = (f) => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
};
const existe = (f) => fs.existsSync(f);
const dossiers = (d) =>
  existe(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
const fichiersDe = (d) => (existe(d) && fs.statSync(d).isDirectory() ? fs.readdirSync(d).sort() : []);
const normaliserUs = (id) => `US-${String(Number(String(id).replace(/\D/g, ""))).padStart(3, "0")}`;
const DATE = /(\d{4}-\d{2}-\d{2})/;
const jour = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Une section « ## <titre> » d'un texte Markdown, jusqu'au titre de même niveau suivant (null si absente). */
function section(texte, titre) {
  const lignes = (texte || "").split(/\r?\n/);
  const debut = lignes.findIndex((l) => new RegExp(`^##\\s+${titre}\\s*$`, "i").test(l));
  if (debut === -1) return null;
  const fin = lignes.findIndex((l, i) => i > debut && /^##\s/.test(l));
  return lignes.slice(debut + 1, fin === -1 ? undefined : fin).join("\n");
}

// ---------------------------------------------------------------- suivi du référencement

/** « Être trouvé » de docs/prd.md : oui sauf « non … », modèle non rempli ou ligne absente. */
const veutEtreTrouve = (prd) => {
  const m = /\*\*[ÊE]tre trouv[ée]\*\*\s*:\s*(.+)/i.exec(prd || "");
  return Boolean(m) && !m[1].includes("{{") && !/^\W*non\b/i.test(m[1].trim());
};

/** Section « Suivi » de docs/seo.md : au moins une ligne de tableau remplie (hors modèle, en-têtes et lignes vides). */
function suiviNote(seo) {
  const texte = section(seo, "Suivi");
  if (texte === null) return false;
  const lignes = texte.split("\n");
  const separateur = (l) => /^\|[\s:|-]+\|\s*$/.test(l);
  return lignes.some((l, i) => {
    if (!/^\|/.test(l) || separateur(l) || l.includes("{{")) return false;
    if (i + 1 < lignes.length && separateur(lignes[i + 1])) return false; // ligne d'en-tête
    return l.split("|").slice(1, -1).some((c) => c.trim() !== "");
  });
}

/** Les faits de suivi : site, « Être trouvé », suivi SEO, rendez-vous, Search Console (liaison, rapports). */
function lireSuivi(racine, aujourdhui = Date.now()) {
  const p = (...x) => path.join(racine, ...x);
  const seo = lireSi(p("docs", "seo.md"));
  const rendezVous = (/\*\*Prochain rendez-vous\*\*\s*:\s*(\d{4}-\d{2}-\d{2})/.exec(seo || "") || [])[1] || null;
  const referencement = section(lireSi(p("docs", "technical.md")), "R[ée]f[ée]rencement");
  const ligneSc = referencement === null ? "" : ((/^-\s*Search Console\s*:\s*(.+)$/im.exec(referencement) || [])[1] || "");
  // « à relier – … ajouté le … » : liaison commencée (relier.md, « Avancement ») ; « à relier avec /pulse:search-console relier » : pas commencée.
  const aRelier = /à relier\s*[–—-]/i.test(ligneSc) && !ligneSc.includes("{{");
  const relie = ligneSc === "" || ligneSc.includes("{{") || /à relier/i.test(ligneSc) ? "non" : (DATE.exec(ligneSc) || [])[1] || "oui";
  const rapports = fichiersDe(p("docs", "referencement")).filter((f) => /^search-console-\d{4}-\d{2}-\d{2}\.md$/.test(f));
  const dernier = rapports.length ? rapports[rapports.length - 1] : null;
  const prochain = dernier ? (/Prochain rapport conseillé : à partir du (\d{4}-\d{2}-\d{2})/.exec(lireSi(p("docs", "referencement", dernier)) || "") || [])[1] || null : null;
  return {
    aujourdhui: jour(aujourdhui),
    trouve: veutEtreTrouve(lireSi(p("docs", "prd.md"))),
    seoSuivi: suiviNote(seo),
    rendezVous,
    relie,
    aRelier,
    rapport: dernier ? DATE.exec(dernier)[1] : null,
    prochain,
  };
}

/** Les signaux de suivi qui s'appliquent, dans l'ordre : { prochaine, raison }. */
function signauxSuivi(s, enLigne) {
  const signaux = [];
  if (enLigne && s.trouve) {
    // Le lancement note chaque étape dans « Suivi » et écrit le rendez-vous à la fin (seo/references/lancer.md § 5) :
    // sans rendez-vous, il reste à finir. /pulse:seo lancer reprend lui-même la liaison à Search Console à l'étape notée.
    if (!s.seoSuivi) signaux.push({ prochaine: "/pulse:seo lancer", raison: "le site est en ligne : il reste à le faire connaître de Google et de Bing (Search Console, plan du site)" });
    else if (!s.rendezVous) signaux.push({ prochaine: "/pulse:seo lancer", raison: "le lancement du référencement est commencé : le reprendre là où il s'est arrêté (Search Console, carte de partage, assistants IA, rendez-vous de suivi)" });
    else if (s.relie === "non") {
      signaux.push({
        prochaine: "/pulse:search-console relier",
        raison: s.aRelier ? "la liaison à Search Console est commencée : la reprendre là où elle s'est arrêtée" : "le site n'est pas encore relié à Search Console, qui montre comment Google le voit",
      });
    }
  }
  if (s.rendezVous && s.rendezVous <= s.aujourdhui) {
    signaux.push({ prochaine: "/pulse:seo audit", raison: `le rendez-vous de suivi du référencement (${s.rendezVous}) est arrivé : relire Search Console, puis refaire l'audit` });
  }
  if (s.prochain && s.prochain <= s.aujourdhui) {
    signaux.push({ prochaine: "/pulse:search-console suivre", raison: `le prochain rapport Search Console est conseillé depuis le ${s.prochain}` });
  }
  return signaux;
}

/** Applique les signaux de suivi à un verdict de `decider` (faits de suivi absents : verdict inchangé). */
function appliquerSuivi(f, v, pret) {
  if (!f.suivi || (!pret && !f.enLigne)) return v;
  const signaux = signauxSuivi(f.suivi, f.enLigne);
  if (signaux.length === 0) return v;
  const enAussi = (s) => `${s.prochaine} — ${s.raison}`;
  if (["R21", "R22", "R23"].includes(v.regle)) {
    const [premier, ...autres] = signaux;
    return { ...v, regle: "R24", prochaine: premier.prochaine, raison: premier.raison, aussi: [...autres.map(enAussi), enAussi(v), ...v.aussi] };
  }
  return { ...v, aussi: [...signaux.map(enAussi), ...v.aussi] };
}

// ---------------------------------------------------------------- Git

function lireGitTableau(racine, faits) {
  const git = (...args) => spawnSync("git", args, { cwd: racine, encoding: "utf8" });
  if (!faits.git || !faits.git.depot) return null;
  const compter = (sortie) => sortie.split("\n").filter((l) => l.trim() !== "").length;
  const branche = git("branch", "--show-current").stdout.trim();
  const dernier = faits.git.commits ? git("log", "-1", "--format=%s").stdout.trim() : "";
  const fusionnees = branche ? git("branch", "--merged", branche, "--format=%(refname:short)").stdout.split("\n").map((l) => l.trim()).filter(Boolean) : [];
  const worktrees = dossiers(path.join(racine, ".claude", "worktrees")).map((nom) => {
    const dossier = path.join(racine, ".claude", "worktrees", nom);
    const b = spawnSync("git", ["branch", "--show-current"], { cwd: dossier, encoding: "utf8" }).stdout.trim();
    const avance = b && branche ? Number(git("rev-list", "--count", `${branche}..${b}`).stdout.trim() || 0) : 0;
    const modifies = compter(spawnSync("git", ["status", "--porcelain"], { cwd: dossier, encoding: "utf8" }).stdout || "");
    return { nom, branche: b, avance, modifies, fusionne: Boolean(b) && fusionnees.includes(b) };
  });
  const avecDossier = new Set(worktrees.map((w) => w.branche));
  return {
    modifies: compter(git("status", "--porcelain").stdout),
    dernier,
    branche,
    worktrees,
    branchesFusionnees: fusionnees.filter((b) => /^feat\/us-/i.test(b) && b !== branche && !avecDossier.has(b)),
  };
}

// ---------------------------------------------------------------- lignes du tableau

/** Les US par dossier de groupe (aidd_docs/tasks/<dossier>/) ; les US sans fichier forment « sans-dossier ». */
function groupes(racine, us) {
  const taches = path.join(racine, "aidd_docs", "tasks");
  const parDossier = new Map();
  const ranges = new Set();
  for (const nom of dossiers(taches)) {
    const ids = new Set();
    for (const f of fichiersDe(path.join(taches, nom))) {
      const m = /^(?:PLAN-SPEC-|SPEC-)?US-(\d+)-.+\.md$/i.exec(f);
      if (m) ids.add(normaliserUs(m[1]));
    }
    if (ids.size) parDossier.set(nom, us.filter((u) => ids.has(u.id)));
    for (const id of ids) ranges.add(id);
  }
  const sans = us.filter((u) => !ranges.has(u.id));
  if (sans.length) parDossier.set("sans-dossier", sans);
  const plan = (u) => (!u.plan ? "absent" : u.plan.aValider ? "a-valider" : "valide");
  return [...parDossier].map(([nom, liste]) => [nom, ...liste.map((u) => `${u.id} spec=${u.spec} plan=${plan(u)} maquette=${u.maquette ? "oui" : "non"}`)].join(" | "));
}

/** Les lignes « Envoi » et « En parallèle avec » de chaque plan. */
function plans(racine) {
  const taches = path.join(racine, "aidd_docs", "tasks");
  const lignes = [];
  for (const nom of dossiers(taches)) {
    for (const f of fichiersDe(path.join(taches, nom))) {
      const m = /^PLAN-SPEC-(US-\d+)-.+\.md$/i.exec(f);
      if (!m) continue;
      const texte = lireSi(path.join(taches, nom, f)) || "";
      const envoi = ((/\*\*Envoi\*\*\s*:\s*(.+)/.exec(texte) || [])[1] || "à choisir").split(" (")[0].replace(/\{\{.*?\}\}/g, "").trim() || "à choisir";
      const brut = (/\*\*En parall[èe]le avec\*\*\s*:\s*(.+)/i.exec(texte) || [])[1] || "";
      const ids = /^\s*(aucune|\{\{)/i.test(brut) ? [] : (brut.split("(")[0].match(/US-\d+/gi) || []).map(normaliserUs);
      const id = normaliserUs(m[1]);
      const h1 = (/^#\s+(.+)$/m.exec(texte) || [])[1] || "";
      const titre = ((/US-\d+\s*[–—-]?\s*(.+)$/i.exec(h1) || [])[1] || "").trim();
      lignes.push({ us: id, texte: `${id} envoi=${envoi} parallele=${ids.length ? ids.join(",") : "aucune"} titre=${titre && !titre.includes("{{") ? titre : "—"}` });
    }
  }
  return lignes.sort((a, b) => a.us.localeCompare(b.us)).map((l) => l.texte);
}

/** Le rapport de relecture le plus récent de aidd_docs/tasks/<dossier>/revues/<plan>/ (derniereRevue : celle d'etat.js). */
function derniereRevueDuProjet(racine, derniereRevue) {
  const taches = path.join(racine, "aidd_docs", "tasks");
  let meilleure = null;
  for (const nom of dossiers(taches)) {
    for (const plan of dossiers(path.join(taches, nom, "revues"))) {
      const dossier = path.join(taches, nom, "revues", plan);
      for (const f of fichiersDe(dossier)) {
        const m = /^(T\d+|US)-(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.md$/i.exec(f);
        if (!m) continue;
        const cle = `${m[2]}-${String(m[3] || 1).padStart(4, "0")}`;
        if (!meilleure || cle > meilleure.cle) meilleure = { cle, id: m[1], date: m[2], dossier, plan };
      }
    }
  }
  if (!meilleure) return "aucune";
  const { etat, fichier } = derniereRevue(meilleure.dossier, meilleure.id);
  const id = /^US$/i.test(meilleure.id) ? normaliserUs((/US-\d+/i.exec(meilleure.plan) || ["US-0"])[0]) : meilleure.id;
  return `${id} etat=${etat} date=${meilleure.date} fichier=${path.relative(racine, fichier).split(path.sep).join("/")}`;
}

/** Les lignes du tableau ; `derniereRevue` vient d'etat.js, qui appelle ce module avant d'avoir publié ses fonctions. */
function tableau(racine, faits, { git = true, derniereRevue }) {
  const p = (...x) => path.join(racine, ...x);
  const claude = lireSi(p("CLAUDE.md")) || "";
  const bloc = (nom) => (new RegExp(`<!-- ${nom}:debut -->([\\s\\S]*?)<!-- ${nom}:fin -->`).exec(claude) || [])[1];
  const titre = (/^#\s+(.+)$/m.exec(claude) || [])[1];
  const pile = bloc("pulse_pile");
  const premiere = pile === undefined ? "" : (pile.split(/\r?\n/).find((l) => l.trim() !== "") || "").trim();
  const lignes = [
    `projet: ${titre && !titre.includes("{{") ? titre.trim() : path.basename(racine)}`,
    `pile: ${!premiere || /Pile non choisie/i.test(premiere) ? "non choisie" : premiere}`,
    `rythme: ${((/\*\*Rythme\*\*\s*:\s*(.+)/.exec(bloc("pulse_profil") || "") || [])[1] || "à choisir").trim()}`,
  ];
  for (const g of groupes(racine, faits.us)) lignes.push(`groupe: ${g}`);
  for (const u of faits.us) for (const t of u.plan ? u.plan.taches : []) lignes.push(`tache: ${u.id} ${t.id} ${t.statut}${t.enPause ? " en-pause" : ""} ${t.titre}`);
  for (const l of plans(racine)) lignes.push(`plan: ${l}`);

  const g = git ? lireGitTableau(racine, faits) : null;
  if (g) lignes.push(`git: modifies=${g.modifies} dernier=${g.dernier || "aucun"} distant=${faits.git.remote ? "oui" : "non"} branche=${g.branche || "aucune"}`);
  lignes.push(`sessions: ${require("./sessions.js").autresSessions(racine)}`);
  if (g) {
    for (const w of g.worktrees) lignes.push(`worktree: ${w.nom} branche=${w.branche || "aucune"} avance=${w.avance} modifies=${w.modifies} fusionne=${w.fusionne ? "oui" : "non"}`);
    for (const b of g.branchesFusionnees) lignes.push(`branche-fusionnee: ${b}`);
  }

  const workflows = fichiersDe(p(".github", "workflows")).filter((f) => /\.ya?ml$/i.test(f));
  lignes.push(workflows.length ? `ci: github fichier=.github/workflows/${workflows[0]}` : existe(p(".gitlab-ci.yml")) ? "ci: gitlab fichier=.gitlab-ci.yml" : "ci: aucune");
  const site = (/Site en ligne\s*:\s*<?(https?:\/\/[^\s>)`*,]+)/i.exec(claude) || [])[1];
  lignes.push(`en-ligne: ${site || "non"}`);
  const s = faits.suivi; // absent : faits de suivi illisibles (etat.js l'a signalé)
  lignes.push(s ? `referencement: relie=${s.relie} rapport=${s.rapport || "aucun"} prochain=${s.prochain || "aucun"}` : "referencement: illisible");
  lignes.push(s ? `seo-suivi: ${s.seoSuivi ? "oui" : "non"} rendez-vous=${s.rendezVous || "aucun"}` : "seo-suivi: illisible");
  lignes.push(`revue: ${derniereRevueDuProjet(racine, derniereRevue)}`);
  const securite = lireSi(p("docs", "securite.md"));
  const dateSecurite = securite === null ? null : (DATE.exec(securite.split(/\r?\n/).slice(0, 10).join("\n")) || [])[1] || jour(fs.statSync(p("docs", "securite.md")).mtimeMs);
  lignes.push(`securite: ${dateSecurite || "absent"}`);
  const glossaire = (lireSi(p("aidd_docs", "memory", "glossary.md")) || "").replace(/<!--[\s\S]*?-->/g, "");
  const decisions = fichiersDe(p("aidd_docs", "memory", "internal", "decisions")).filter((f) => /\.md$/i.test(f));
  lignes.push(`memoire: bloc=${claude.includes("<!-- pulse_memoire:debut -->") ? "oui" : "non"} glossaire=${(glossaire.match(/^\*\*[^*\n]+\*\*\s*:/gm) || []).length} decisions=${decisions.length}`);

  if (g && g.modifies === 0 && !faits.git.avance) {
    const avecDossier = (id) => g.worktrees.some((w) => w.nom.toLowerCase().startsWith(`${id.toLowerCase()}-`));
    for (const u of faits.us) for (const t of u.plan ? u.plan.taches : []) if (t.statut === "en-cours" && !avecDossier(u.id)) lignes.push(`en-cours-sans-trace: ${t.id}`);
  }
  return lignes;
}

module.exports = { tableau, lireSuivi, signauxSuivi, appliquerSuivi };

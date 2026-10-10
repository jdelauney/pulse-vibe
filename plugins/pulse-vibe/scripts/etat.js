#!/usr/bin/env node
// Pulse – état du projet et prochaine étape (`pulse-aidd etat`), lu par /pulse:init et /pulse:status.
//
// Lit les fichiers du projet (CLAUDE.md, docs/, aidd_docs/, .claude/) et, sauf --sans-git, l'état
// Git ; applique les règles R1 à R23 dans l'ordre (la première qui s'applique donne la prochaine
// étape) et affiche des lignes « clé: valeur » :
//   prochaine: /pulse:spec US-003       la commande conseillée
//   raison: …                            pourquoi, en une phrase
//   regle: R20                           la règle appliquée
//   fondation: profil                    R2 à R8 : ce que /pulse:init prépare ou met à niveau (dossier, documents, profil, memoire, git, pile)
//   attente: … / ancien: oui / dossier: …   R1 : la décision en attente, si elle date de plus de 7 jours, son dossier
//   aussi: /pulse:… — …                  alternatives utiles (zéro, une ou plusieurs lignes)
//   etapes: brief=fait prd=fait technique=a-faire design=facultatif us=a-faire spec=a-faire plan=a-faire realisation=a-faire en-ligne=non
//   mvp: 2/6                             tâches terminées / tâches des plans des US Indispensables
// Options : --sans-git (ne lit pas Git), --aujourdhui AAAA-MM-JJ (date de référence, pour les tests).
// --revue <Tn> [<Tn>…] (`pulse-aidd revue <Tn>`) : la dernière relecture de chaque tâche et où reprendre (tache, statut, plan,
// etat, rapport, reprendre) ; plusieurs tâches : un bloc par tâche, séparés par une ligne vide.
// Sort toujours avec le code 0 : un échec annulerait la commande /pulse qui l'appelle.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const PRIORITES = ["indispensable", "essentiel", "optionnel"];
const INCONNUE = PRIORITES.length; // priorité absente : après les priorités connues
const EN_ATTENTE = 9; // « En attente » : hors périmètre, jamais proposée
const LIBELLES = ["Indispensable", "Essentiel", "Optionnel"];
const STATUTS = { " ": "a-faire", "~": "en-cours", x: "terminee", X: "terminee" };

// ---------------------------------------------------------------- lecture

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
const numero = (id) => Number(String(id).replace(/\D/g, ""));
const normaliserUs = (id) => `US-${String(numero(id)).padStart(3, "0")}`;
const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function rangPriorite(mot) {
  const m = sansAccent(mot || "");
  if (m === "en" || m.startsWith("en attente")) return EN_ATTENTE;
  const rang = PRIORITES.findIndex((p) => m.startsWith(p));
  return rang === -1 ? INCONNUE : rang;
}

/** CLAUDE.md : Pulse ou non, profil, bloc de pile, adresses. */
function lireClaude(texte) {
  if (texte === null) return { etat: "absent", profil: null, pile: "sans-marqueurs", enLigne: false, distant: "", memoireBloc: false };
  const bloc = (nom) => (new RegExp(`<!-- ${nom}:debut -->([\\s\\S]*?)<!-- ${nom}:fin -->`).exec(texte) || [])[1];
  const profil = bloc("pulse_profil");
  const pile = bloc("pulse_pile");
  const depot = ((/D[ée]p[ôo]t distant\s*:\s*(.+)/i.exec(texte) || [])[1] || "").trim();
  return {
    etat: /m[ée]thode Pulse|\/pulse:/i.test(texte) ? "pulse" : "sans-pulse",
    profil: profil === undefined ? null : ((/\*\*Niveau\*\*\s*:\s*(.+)/.exec(profil) || [])[1] || "").trim() || null,
    pile: pile === undefined ? "sans-marqueurs" : /Pile non choisie/i.test(pile) ? "non-choisie" : "choisie",
    enLigne: /Site en ligne\s*:\s*<?https?:\/\//i.test(texte),
    distant: /aucun pour l'instant/i.test(depot) ? "aucun" : /^<?(https?:\/\/|git@)/i.test(depot) ? "adresse" : "",
    memoireBloc: texte.includes("<!-- pulse_memoire:debut -->"),
  };
}

/** aidd_docs/tasks/in-progress.md (modèle « travail en cours »). */
function lireAttente(fichier, aujourdhui, dossier) {
  const texte = lireSi(fichier);
  if (texte === null) return null;
  const champ = (nom) =>
    ((new RegExp(`\\*\\*${nom}\\*\\*\\s*:\\s*(.+)`, "i").exec(texte) || [])[1] || "").replace(/`/g, "").replace(/\{\{.*?\}\}/g, "").trim();
  const quand = /(\d{4})-(\d{2})-(\d{2})/.exec(champ("Mis à jour le"));
  const jours = quand ? (aujourdhui - Date.UTC(Number(quand[1]), Number(quand[2]) - 1, Number(quand[3]))) / 86400000 : 0;
  return { commande: champ("Commande"), etape: champ("[ÉE]tape"), pourReprendre: champ("Pour reprendre"), ancien: jours > 7, dossier };
}

/** Les tâches de la section « ## Tâches » d'un plan (même format que le guide de réalisation). */
function lireTaches(texte) {
  const taches = [];
  let dansTaches = false;
  for (const ligne of texte.split(/\r?\n/)) {
    if (/^##\s/.test(ligne)) {
      dansTaches = /^##\s+T[âa]ches\s*$/i.test(ligne);
      continue;
    }
    const t = dansTaches && /^- \[(.)\]\s+\*\*(T\d+)\s*[–—-]\s*(.+?)\*\*/.exec(ligne);
    if (t) taches.push({ id: t[2], titre: t[3].trim(), statut: STATUTS[t[1]] || "a-faire", miseEnLigne: /^mettre en ligne/i.test(t[3].trim()) });
  }
  return taches;
}

/** Spec en brouillon : statut « brouillon » ou un `TBD:` hors des lignes de citation (l'en-tête du modèle en cite un). */
function statutSpec(texte) {
  const lignes = texte.split(/\r?\n/).filter((l) => !l.trimStart().startsWith(">"));
  const brouillon = lignes.some((l) => /\*\*Statut\*\*\s*:\s*brouillon/i.test(l)) || lignes.some((l) => /\bTBD:/.test(l));
  return brouillon ? "brouillon" : "verrouillee";
}

/**
 * La dernière relecture d'une tâche (rapport `<Tn>-AAAA-MM-JJ[-n].md`, modèle « revue ») et son fichier :
 * absente · bloquee (ligne « Blocage » remplie) · a-corriger (verdict à reprendre, ou test non concluant sans accord) ·
 * a-tester (verdict validé, test par la personne encore vide) · validee (verdict validé et test concluant, reporté ou accepté).
 */
function derniereRevue(dossier, id) {
  const motif = new RegExp(`^${id}-(\\d{4}-\\d{2}-\\d{2})(?:-(\\d+))?\\.md$`, "i");
  const rapports = fichiersDe(dossier)
    .map((nom) => ({ nom, m: motif.exec(nom) }))
    .filter((r) => r.m)
    .sort((a, b) => a.m[1].localeCompare(b.m[1]) || Number(a.m[2] || 1) - Number(b.m[2] || 1));
  if (rapports.length === 0) return { etat: "absente", fichier: null };
  const fichier = path.join(dossier, rapports[rapports.length - 1].nom);
  const texte = (lireSi(fichier) || "").normalize("NFC"); // « é » écrit en deux caractères : relu comme un seul
  const valeur = (re) => ((re.exec(texte) || [])[1] || "").replace(/\{\{.*?\}\}/g, "");
  const blocage = valeur(/^\*\*Blocage\*\*\s*:(.*)$/m);
  // Une ligne encore au modèle (choix séparés par « | ») ne bloque pas.
  if (!blocage.includes("|") && /get-help|cycles/i.test(blocage)) return { etat: "bloquee", fichier };
  const verdict = valeur(/^\*\*Verdict\*\*\s*:(.*)$/m);
  // Seul le Verdict en tête compte (examen § 3 et § 4 le tiennent à jour) ; « ⚠️ … accepté par la personne » vaut prêt (review § 7).
  const accepte = verdict.includes("⚠") && /accept[ée]/i.test(verdict) && !/[⛔❌]|critique/iu.test(verdict);
  if (!accepte && (!verdict.includes("✅") || /[⚠⛔❌]|critique/iu.test(verdict))) return { etat: "a-corriger", fichier };
  return { etat: etatDuTest(texte), fichier };
}

/**
 * Le test par la personne : le dernier « Résultat » de la dernière section « ## Test par la personne » (jusqu'au titre suivant).
 * Vide, modèle non rempli (choix séparés par « | ») ou réponse sans repère : a-tester. Un test non concluant suivi d'une
 * « ## Relecture de contrôle » datée d'un jour plus récent (correction faite après le test) est à refaire : a-tester.
 * Limite : une relecture de contrôle du même jour que le test ne compte pas (spirc l'écrit avant le test) ; sans date
 * dans l'une ou l'autre section, toute relecture de contrôle placée après le test compte.
 */
function etatDuTest(texte) {
  const sections = texte.split(/^##[ \t]+/m).slice(1);
  const derniere = sections.map((s) => /^Test par la personne\b/i.test(s.trim())).lastIndexOf(true);
  if (derniere === -1) return "a-tester";
  const resultats = [...sections[derniere].matchAll(/^[-*][ \t]+\*\*R[ée]sultat(?:\*\*[ \t  ]*:|[ \t  ]*:\*\*)(.*)$/gim)];
  const test = resultats.length ? resultats[resultats.length - 1][1].replace(/\{\{.*?\}\}/g, "").trim() : "";
  if (test === "" || test.includes("|")) return "a-tester";
  const accord = /accept[ée]/i.test(test) && !/\bpas\b[^,.;]*accept/i.test(test);
  const oui = /✅/u.test(test) || /^oui\b/i.test(test);
  // Négatifs francs : ❌, « Non, … », « non/pas concluant ». « problème » ou « échec » comptent seulement sans ✅ ni « Oui »,
  // et hors « aucun problème », « sans échec ».
  const negatif =
    /❌/u.test(test) || /^non\b/i.test(test) || /\b(non|pas)\s+concluant/i.test(test) || (!oui && /(?<!\b(?:aucun|sans)\s+)(probl[èe]me|[ée]chec)/i.test(test));
  if (negatif) {
    if (accord) return "validee";
    const date = (s) => (/^[-*][ \t]+\*\*Date\*\*[ \t  ]*:[ \t]*(\d{4}-\d{2}-\d{2})/m.exec(s) || [])[1];
    const dateTest = date(sections[derniere]);
    const corrigee = sections.slice(derniere + 1).some((s) => {
      if (!/^Relecture de contr[ôo]le\b/i.test(s.trim())) return false;
      const dateControle = date(s);
      return !dateTest || !dateControle || dateControle > dateTest;
    });
    return corrigee ? "a-tester" : "a-corriger";
  }
  const positif = oui || /⏳/u.test(test) || /(?<!\b(?:non|pas|peu)\s+)concluant/i.test(test) || accord;
  return positif ? "validee" : "a-tester";
}

const lireRevue = (dossier, id) => derniereRevue(dossier, id).etat;

/** Le référentiel docs/user-stories.md : priorité de chaque US (lignes de tableau « | US-001 | … | Indispensable | … »). */
function lireReferentiel(texte) {
  const priorites = new Map();
  for (const ligne of (texte || "").split(/\r?\n/)) {
    const m = /^\|\s*(US-\d+)\s*\|(.*)$/i.exec(ligne);
    if (!m) continue;
    const cellule = m[2].split("|").find((c) => /^(indispensable|essentiel|optionnel|en attente)\b/.test(sansAccent(c)));
    if (cellule) priorites.set(normaliserUs(m[1]), rangPriorite(cellule));
  }
  return priorites;
}

/** La section « ## Ordre de réalisation » du référentiel : les US dans l'ordre où les réaliser. */
function lireOrdre(texte) {
  const apres = (texte || "").split(/^## Ordre de r[ée]alisation\s*$/m)[1];
  if (!apres) return [];
  const section = apres.split(/^(?:## |---)/m)[0];
  const ids = section.split(/\r?\n/).filter((l) => !l.trimStart().startsWith(">")).join(" ").match(/US-\d+/gi) || [];
  return [...new Set(ids.map(normaliserUs))];
}

/** Toutes les US connues (référentiel et fichiers de aidd_docs/tasks/<epic>/), dans l'ordre où les traiter. */
function lireUs(racine) {
  const taches = path.join(racine, "aidd_docs", "tasks");
  const referentiel = lireSi(path.join(racine, "docs", "user-stories.md"));
  const maquettes = path.join(racine, "docs", "design", "maquettes");
  const liste = new Map();
  const us = (id) => {
    const cle = normaliserUs(id);
    if (!liste.has(cle)) liste.set(cle, { id: cle, priorite: INCONNUE, spec: "absente", plan: null, maquette: false });
    return liste.get(cle);
  };
  const prioriteDuTexte = (texte) => (/\*\*Priorit[ée]\*\*\s*:\s*([^·|*\n]+)/i.exec(texte) || [])[1];
  for (const [id, rang] of lireReferentiel(referentiel)) us(id).priorite = rang;
  for (const epic of dossiers(taches)) {
    const dossier = path.join(taches, epic);
    for (const f of fichiersDe(dossier)) {
      let m;
      if ((m = /^US-(\d+)-.+\.md$/i.exec(f))) {
        const u = us(m[1]);
        if (u.priorite === INCONNUE) u.priorite = rangPriorite(prioriteDuTexte(lireSi(path.join(dossier, f)) || ""));
      } else if ((m = /^SPEC-US-(\d+)-.+\.md$/i.exec(f))) {
        us(m[1]).spec = statutSpec(lireSi(path.join(dossier, f)) || "");
      } else if ((m = /^PLAN-SPEC-US-(\d+)-.+\.md$/i.exec(f))) {
        const u = us(m[1]);
        const texte = lireSi(path.join(dossier, f)) || "";
        const revues = path.join(dossier, "revues", f.replace(/\.md$/i, ""));
        u.plan = { taches: lireTaches(texte).map((t) => ({ ...t, revue: lireRevue(revues, t.id) })) };
        if (u.priorite === INCONNUE) u.priorite = rangPriorite(prioriteDuTexte(texte));
      }
    }
  }
  for (const d of dossiers(maquettes)) {
    const m = /^US-(\d+)-/i.exec(d);
    if (m && existe(path.join(maquettes, d, "retenue"))) us(m[1]).maquette = true;
  }
  const ordre = lireOrdre(referentiel);
  const rang = (id) => (ordre.includes(id) ? ordre.indexOf(id) : ordre.length);
  return [...liste.values()].sort((a, b) => a.priorite - b.priorite || rang(a.id) - rang(b.id) || numero(a.id) - numero(b.id));
}

/** L'état Git du dossier, ou null si Git est absent de la machine. */
function lireGit(racine) {
  const git = (...args) => spawnSync("git", args, { cwd: racine, encoding: "utf8" });
  const haut = git("rev-parse", "--show-toplevel");
  if (haut.error) return null;
  const reel = (p) => {
    let r;
    try {
      r = fs.realpathSync.native(p);
    } catch {
      r = path.resolve(p);
    }
    return process.platform === "win32" ? r.toLowerCase() : r;
  };
  const depot = haut.status === 0 && reel(haut.stdout.trim()) === reel(racine);
  const commits = depot && git("rev-parse", "--verify", "--quiet", "HEAD").status === 0;
  const remote = depot && git("remote").stdout.trim() !== "";
  const entete = depot ? git("status", "--porcelain=v1", "--branch").stdout.split("\n")[0] || "" : "";
  const avance = Number((/\[ahead (\d+)/.exec(entete) || [])[1] || 0);
  return { depot, commits, remote, avance };
}

/** Du code déjà présent à la racine (manifeste de dépendances, sources, page), dans n'importe quel langage. */
function codeExistant(racine) {
  const manifestes = ["package.json", "requirements.txt", "pyproject.toml", "composer.json", "Gemfile", "go.mod", "Cargo.toml", "pom.xml", "build.gradle", "index.html"];
  return (
    manifestes.some((f) => existe(path.join(racine, f))) ||
    ["src", "app"].some((d) => dossiers(racine).includes(d)) ||
    fichiersDe(racine).some((f) => /\.(csproj|sln)$/i.test(f))
  );
}

/** Un projet Pulse créé avec un modèle plus ancien : ancien CLAUDE.md, .gitignore sans le travail en cours, contrôle avant commit absent. */
function modeleAncien(racine, texteClaude) {
  const p = (...x) => path.join(racine, ...x);
  if (texteClaude !== null && (/AI-Driven/.test(texteClaude) || /Commit et envoi[^\n]*uniquement sur demande/.test(texteClaude) || /traces de travail par session/.test(texteClaude))) return true;
  const gitignore = lireSi(p(".gitignore"));
  if (gitignore !== null && !gitignore.includes("aidd_docs/tasks/in-progress.md")) return true;
  if (existe(p("scripts", "verifier.js")) && existe(p(".git", "hooks")) && !/hooksPath/.test(lireSi(p(".git", "config")) || "")) {
    const crochet = lireSi(p(".git", "hooks", "pre-commit")) || "";
    // Crochet de Pulse : à jour seulement avec la copie de secours (l'ancien laissait passer sans scripts/verifier.js).
    if (crochet.includes("pulse-aidd: contrôle des secrets")) return !crochet.includes("pulse/verifier.js");
    return !crochet.includes("verifier.js --index");
  }
  return false;
}

/** Tous les faits utiles à la décision. */
function lireFaits(racine, { git = true, aujourdhui = Date.now() } = {}) {
  const p = (...x) => path.join(racine, ...x);
  const texteClaude = lireSi(p("CLAUDE.md"));
  const claude = lireClaude(texteClaude);
  const faitsGit = git ? lireGit(racine) : null;
  const attentes = [
    lireAttente(p("aidd_docs", "tasks", "in-progress.md"), aujourdhui, ""),
    ...dossiers(p(".claude", "worktrees")).map((w) =>
      lireAttente(p(".claude", "worktrees", w, "aidd_docs", "tasks", "in-progress.md"), aujourdhui, `.claude/worktrees/${w}`),
    ),
  ].filter(Boolean);
  const anciens = [p("docs", "spec.md"), p("docs", "plan.md")].some(existe) ||
    ["specs", "plans", "revues"].some((d) => fichiersDe(p("docs", d)).some((f) => /\.md$/i.test(f)));
  const relie = (faitsGit && faitsGit.remote) || claude.distant === "adresse";
  return {
    claude: claude.etat,
    profil: claude.profil,
    pile: claude.pile,
    enLigne: claude.enLigne,
    memoire: claude.memoireBloc && ["project.md", "technical.md", "glossary.md"].every((f) => existe(p("aidd_docs", "memory", f))),
    modeleAncien: claude.etat === "pulse" && modeleAncien(racine, texteClaude),
    codeExistant: codeExistant(racine),
    secretsProteges: (lireSi(p(".claude", "settings.json")) || "").includes("Read(./.env)"),
    depotDistant: relie ? "relie" : claude.distant === "aucun" ? "aucun" : "a-decider",
    ancienFormat: anciens,
    enAttente: attentes[0] || null,
    docs: {
      brief: existe(p("docs", "brief.md")),
      prd: existe(p("docs", "prd.md")),
      technical: existe(p("docs", "technical.md")),
      design: existe(p("docs", "design.md")),
      userStories: existe(p("docs", "user-stories.md")),
    },
    us: lireUs(racine),
    securite: existe(p("docs", "securite.md")),
    ci: fichiersDe(p(".github", "workflows")).length > 0 || existe(p(".gitlab-ci.yml")),
    git: faitsGit,
  };
}

// ---------------------------------------------------------------- décision

/** Le MVP : les tâches des plans des US Indispensables (la mise en ligne n'empêche pas d'être prêt). */
function bilan(f) {
  const indispensables = f.us.filter((u) => u.priorite === 0);
  const taches = indispensables.flatMap((u) => (u.plan ? u.plan.taches : []));
  const pret = indispensables.length > 0 && indispensables.every((u) => u.plan && u.plan.taches.length > 0 && u.plan.taches.every((t) => t.miseEnLigne || t.statut === "terminee"));
  return { pret, faites: taches.filter((t) => t.statut === "terminee").length, total: taches.length };
}

const libelle = (u) => LIBELLES[u.priorite] || "priorité à préciser";

/** Applique les règles R1 à R23 dans l'ordre : la première qui s'applique donne la prochaine étape. */
function decider(f) {
  const aussi = [];
  const verdict = (regle, prochaine, raison, extra = {}) => ({ regle, prochaine, raison, aussi, ...extra });
  if (f.claude === "pulse") {
    if (!f.secretsProteges) aussi.push("/pulse:init — protéger vos clés : la règle qui empêche l'IA de lire .env manque");
    if (f.modeleAncien) aussi.push("/pulse:init — mettre à niveau le projet (modèles et contrôles)");
    if (f.depotDistant === "a-decider") aussi.push("/pulse:init — relier le projet à un dépôt distant (facultatif)");
  }

  const a = f.enAttente;
  if (a) {
    const sujet = a.etape || a.commande;
    const raison = a.ancien
      ? `une décision attend depuis plus de 7 jours${sujet ? ` (${sujet})` : ""} : demander si elle est toujours d'actualité, sinon l'effacer avec pulse-aidd travail-fini`
      : sujet ? `une décision vous attend : ${sujet}` : "une décision vous attend dans aidd_docs/tasks/in-progress.md";
    return verdict("R1", a.pourReprendre || a.commande || "/pulse:status", raison, { attente: a.etape, ancien: a.ancien ? "oui" : "", dossier: a.dossier });
  }
  if (f.claude === "absent") return verdict("R2", "/pulse:init", "le projet n'est pas encore préparé pour Pulse", { fondation: "dossier" });
  if (f.claude === "sans-pulse") return verdict("R3", "/pulse:init", "CLAUDE.md existe sans les règles de Pulse", { fondation: "dossier" });
  if (f.ancienFormat) return verdict("R4", "/pulse:init", "des documents sont à l'ancien format : ils se rangent maintenant par epic", { fondation: "documents" });
  if (!f.profil || /pr[ée]ciser/i.test(f.profil)) return verdict("R5", "/pulse:init", "votre profil (niveau, explications) reste à préciser", { fondation: "profil" });
  if (!f.memoire) return verdict("R6", "/pulse:memory creer", "la mémoire du projet n'est pas branchée", { fondation: "memoire" });
  if (f.git && (!f.git.depot || !f.git.commits)) {
    const raison = f.git.depot ? "l'historique Git n'a encore aucune version" : "le dossier n'a pas son propre historique Git";
    return verdict("R7", "/pulse:init", raison, { fondation: "git" });
  }
  if (f.pile === "sans-marqueurs" || (f.docs.technical && f.pile === "non-choisie")) {
    return verdict("R8", "/pulse:tech", "le bloc « Pile technique » de CLAUDE.md ne reflète pas docs/technical.md", { fondation: "pile" });
  }

  const d = f.docs;
  if (f.codeExistant && !d.brief && !d.prd && !d.userStories && !d.technical) {
    return verdict("R8c", "/pulse:tech", "le projet existant a déjà du code : documenter les outils qu'il utilise (Chemin A) avant de continuer");
  }
  if (!d.brief && !d.prd && !d.userStories && !d.technical) {
    aussi.unshift("/pulse:express — démarrer vite : l'idée, le PRD et les user stories en une conversation");
    return verdict("R9", "/pulse:brainstorm", "raconter l'idée est la première étape");
  }
  if (!d.prd && !d.userStories) return verdict("R10", "/pulse:prd", "il reste à décider du périmètre du MVP");
  if (!d.technical) return verdict("R11", "/pulse:tech", "choisir les outils vient avant les user stories et le code");
  if (!d.userStories) {
    if (!d.design) {
      aussi.unshift("/pulse:us — passer directement aux user stories");
      return verdict("R12", "/pulse:ui identite", "l'identité visuelle est facultative ; faite maintenant, les user stories, specs et plans s'y conformeront");
    }
    return verdict("R12", "/pulse:us", "écrire les user stories, epic par epic");
  }

  const enCours = f.us.flatMap((u) => (u.plan ? u.plan.taches.filter((t) => t.statut === "en-cours").map((t) => ({ u, t })) : []));
  if (enCours.length > 0) {
    const { t } = enCours[0];
    if (t.miseEnLigne) return verdict("R14", "/pulse:deploy", `${t.id} – ${t.titre} est en cours : la mise en ligne se fait avec /pulse:deploy`);
    if (t.revue === "validee") return verdict("R13", "/pulse:commit", `${t.id} – ${t.titre} est relue : il reste à l'enregistrer`);
    if (t.revue === "bloquee") return verdict("R14", "/pulse:get-help", `${t.id} – ${t.titre} reste bloquée après deux cycles de correction : demander de l'aide`);
    if (t.revue === "a-tester") return verdict("R14", `/pulse:review ${t.id}`, `${t.id} – ${t.titre} est relue et vérifiée : il reste votre test manuel, avant de l'enregistrer`);
    if (t.revue === "a-corriger") return verdict("R14", `/pulse:review ${t.id}`, `${t.id} – ${t.titre} : la dernière relecture a des points à reprendre ou un test non concluant`);
    return verdict("R14", `/pulse:review ${t.id}`, `${t.id} – ${t.titre} est en cours : la relecture et la vérification viennent ensuite`);
  }

  const mvp = bilan(f);
  if (mvp.pret && !f.enLigne) return verdict("R15", "/pulse:deploy", "toutes les US Indispensables sont terminées : le MVP peut être mis en ligne");
  if (f.git && f.git.remote && f.git.avance > 0) {
    return verdict("R16", "/pulse:deploy", `${f.git.avance} version(s) enregistrée(s) pas encore envoyée(s) sur le dépôt distant`);
  }

  const brouillon = f.us.find((u) => u.spec === "brouillon");
  if (brouillon) return verdict("R17", `/pulse:spec ${brouillon.id}`, `la spec de ${brouillon.id} a encore des questions ouvertes`);
  const sansPlan = f.us.find((u) => u.spec === "verrouillee" && !u.plan);
  if (sansPlan) {
    if (d.design && !sansPlan.maquette) aussi.unshift(`/pulse:ui maquettes ${sansPlan.id} — dessiner ses écrans avant le plan (facultatif)`);
    return verdict("R18", `/pulse:plan ${sansPlan.id}`, `la spec de ${sansPlan.id} est validée : elle attend son plan`);
  }
  const restante = f.us
    .filter((u) => u.plan)
    .map((u) => ({ u, t: u.plan.taches.find((t) => t.statut === "a-faire" && (!t.miseEnLigne || mvp.pret)) }))
    .find((x) => x.t);
  if (restante) {
    const { u, t } = restante;
    if (t.miseEnLigne) return verdict("R19", "/pulse:deploy", `${t.id} – ${t.titre} : la mise en ligne se fait avec /pulse:deploy`);
    aussi.unshift(`/pulse:implement ${u.id} ${t.id} — réaliser seulement ${t.id}, pas à pas`);
    return verdict("R19", `/pulse:spirc ${u.id}`, `${u.id} a des tâches à réaliser, à commencer par ${t.id} – ${t.titre}`);
  }
  const indispensable = f.us.find((u) => u.priorite === 0 && u.spec === "absente");
  if (indispensable) return verdict("R20", `/pulse:spec ${indispensable.id}`, `${indispensable.id} (Indispensable) attend sa spec`);
  if (mvp.pret && f.enLigne && !f.securite) return verdict("R21", "/pulse:security", "le MVP est en ligne : un audit de sécurité complet est conseillé");
  if (f.depotDistant === "relie" && !f.ci) aussi.push("/pulse:cicd — un contrôle automatique à chaque envoi (facultatif)");
  const suivante = f.us.find((u) => u.priorite >= 1 && u.priorite <= INCONNUE && u.spec === "absente");
  if (suivante) return verdict("R22", `/pulse:spec ${suivante.id}`, `${suivante.id} (${libelle(suivante)}) attend sa spec`);
  aussi.push("/pulse:security — un audit de sécurité", "/pulse:memory actualiser — relire la mémoire du projet", "/pulse:guide — le carnet de route");
  return verdict("R23", '/pulse:spirc <US-XXX> "une demande"', "tout est à jour : décrivez une nouvelle demande, elle rejoindra le bon plan");
}

// ---------------------------------------------------------------- pulse-aidd revue <Tn>

const REPRENDRE = { absente: "examen", "a-corriger": "correction", "a-tester": "test", validee: "commit", bloquee: "aide" };

/** `pulse-aidd revue <Tn>` : la tâche dans les plans de aidd_docs/tasks/, sa dernière relecture et l'étape où reprendre. */
function revueDeTache(racine, id) {
  const tache = String(id || "").trim().toUpperCase();
  const rel = (f) => path.relative(racine, f).split(path.sep).join("/");
  const taches = path.join(racine, "aidd_docs", "tasks");
  if (/^T\d+$/.test(tache)) {
    for (const epic of dossiers(taches)) {
      const dossier = path.join(taches, epic);
      for (const f of fichiersDe(dossier).filter((x) => /^PLAN-SPEC-US-\d+-.+\.md$/i.test(x))) {
        const t = lireTaches(lireSi(path.join(dossier, f)) || "").find((x) => x.id.toUpperCase() === tache);
        if (!t) continue;
        const { etat, fichier } = derniereRevue(path.join(dossier, "revues", f.replace(/\.md$/i, "")), t.id);
        return { tache: t.id, statut: t.statut, plan: rel(path.join(dossier, f)), etat, rapport: fichier ? rel(fichier) : "aucun", reprendre: REPRENDRE[etat] };
      }
    }
  }
  return { tache: tache || "?", etat: "inconnue", reprendre: "aucune" };
}

const formaterRevue = (r) => Object.entries(r).map(([cle, valeur]) => `${cle}: ${valeur}`).join("\n");

// ---------------------------------------------------------------- affichage

function etapes(f, mvp) {
  const fait = (b) => (b ? "fait" : "a-faire");
  const avancement = (n, complet) => (n === 0 ? "a-faire" : complet ? "fait" : "en-cours");
  const indispensables = f.us.filter((u) => u.priorite === 0);
  const toutes = f.us.flatMap((u) => (u.plan ? u.plan.taches : []));
  return [
    `brief=${fait(f.docs.brief)}`,
    `prd=${fait(f.docs.prd)}`,
    `technique=${fait(f.docs.technical)}`,
    `design=${f.docs.design ? "fait" : "facultatif"}`,
    `us=${fait(f.docs.userStories)}`,
    `spec=${avancement(f.us.filter((u) => u.spec !== "absente").length, indispensables.length > 0 && indispensables.every((u) => u.spec === "verrouillee"))}`,
    `plan=${avancement(f.us.filter((u) => u.plan).length, indispensables.length > 0 && indispensables.every((u) => u.plan))}`,
    `realisation=${avancement(toutes.filter((t) => t.statut !== "a-faire").length, mvp.pret)}`,
    `en-ligne=${f.enLigne ? "oui" : "non"}`,
  ].join(" ");
}

function formater(f, v) {
  const mvp = bilan(f);
  const lignes = [`prochaine: ${v.prochaine}`, `raison: ${v.raison}`, `regle: ${v.regle}`];
  for (const cle of ["fondation", "attente", "ancien", "dossier"]) if (v[cle]) lignes.push(`${cle}: ${v[cle]}`);
  for (const a of v.aussi) lignes.push(`aussi: ${a}`);
  lignes.push(`etapes: ${etapes(f, mvp)}`, `mvp: ${mvp.faites}/${mvp.total}`);
  return lignes.join("\n");
}

/** R0 : les fichiers n'ont pas pu être lus. /pulse:status relancerait cet outil : mieux vaut demander de l'aide. */
function sortieIllisible(message) {
  return `prochaine: /pulse:get-help\nraison: l'état du projet n'a pas pu être lu (${message}) : décrivez le problème à /pulse:get-help\nregle: R0`;
}

const OPTIONS = "options : --sans-git, --aujourdhui AAAA-MM-JJ, --revue <Tn> [<Tn>…]";

/** Options : --sans-git, --aujourdhui AAAA-MM-JJ (tests), --revue <Tn> [<Tn>…]. Toute autre option est une erreur de la consigne qui appelle l'outil. */
function lireOptions(args) {
  const options = { git: true, aujourdhui: Date.now() };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sans-git") options.git = false;
    else if (args[i] === "--revue") {
      // Les tâches qui suivent, jusqu'à l'option suivante ; aucune tâche : réponse « inconnue », jamais une erreur.
      options.revue = [];
      while (i + 1 < args.length && !args[i + 1].startsWith("--")) options.revue.push(args[++i]);
      if (options.revue.length === 0) options.revue.push("");
    }
    else if (args[i] === "--aujourdhui") {
      const jour = args[++i];
      const date = /^\d{4}-\d{2}-\d{2}$/.test(jour || "") ? Date.parse(`${jour}T00:00:00Z`) : NaN;
      // Une date relue différemment n'existe pas au calendrier (2026-02-31 deviendrait le 3 mars).
      if (Number.isNaN(date) || new Date(date).toISOString().slice(0, 10) !== jour) throw new Error(`« --aujourdhui » attend une date AAAA-MM-JJ, reçu « ${jour ?? ""} » (${OPTIONS})`);
      options.aujourdhui = date;
    } else throw new Error(`option inconnue « ${args[i]} » (${OPTIONS})`);
  }
  return options;
}

if (require.main === module) {
  let options;
  try {
    options = lireOptions(process.argv.slice(2));
  } catch (e) {
    console.log(`erreur: ${e.message}`);
    process.exit(2);
  }
  if (options.revue) {
    const blocs = options.revue.map((id) => {
      try {
        return formaterRevue(revueDeTache(process.cwd(), id));
      } catch (e) {
        return `tache: ${id || "?"}\netat: inconnue\nreprendre: aucune\nraison: les fichiers n'ont pas pu être lus (${e.message})`;
      }
    });
    console.log(blocs.join("\n\n"));
  } else {
    try {
      const faits = lireFaits(process.cwd(), options);
      console.log(formater(faits, decider(faits)));
    } catch (e) {
      console.log(sortieIllisible(e.message));
    }
  }
}

module.exports = { lireFaits, decider, formater, sortieIllisible, lireOptions, derniereRevue, revueDeTache, formaterRevue };

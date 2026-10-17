#!/usr/bin/env node
// Pulse – point d'entrée des hooks Stop et SubagentStop, actif seulement dans un projet Pulse :
// quand l'agent rend la main, contrôle les seuls fichiers écrits pendant le tour (relevé de tour.js) :
// règles contrôlées du projet, clés secrètes, et contrôles automatiques de « Commandes du projet »
// pendant une réalisation (pendantUneTache) ; un contrôle en échec bloque seulement si sa sortie nomme
// un fichier du tour. Chaque fichier suit les règles de sa propre racine Git (tour.parRacine).
// Bloque au plus deux fois de suite, puis demande de dire à la personne ce qui reste à corriger.
// Silencieux en cas d'erreur interne.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

// Agents qui écrivent (avec ou sans préfixe « pulse: ») ; test-writer écrit des tests d'abord, qui
// échouent par conception : ses fichiers passent les règles et les secrets, pas les contrôles rapides.
const AGENTS_QUI_ECRIVENT = ["implementer", "fixer", "test-writer"];
const AGENTS_CONTROLES_RAPIDES = ["implementer", "fixer"];
const typeAgent = (t) => (typeof t === "string" ? t.split(":").pop() : "");
const RELANCES_MAX = 2;
const DELAI_S = 60;
const TAILLE_MAX = 512 * 1024;
const CONSTATS_MAX = 20;
const LIGNES_SORTIE = 40;
const DEPASSE = 124; // code du lanceur quand le délai est dépassé
const INTROUVABLE = /Missing script|command not found|n'est pas reconnu|not recognized as an internal or external command/i;

/** Contenu texte d'un fichier relevé, ou null : disparu, dossier, trop gros ou binaire. */
function lireTexte(racine, fichier) {
  try {
    const chemin = path.join(racine, fichier);
    const st = fs.statSync(chemin);
    if (!st.isFile() || st.size > TAILLE_MAX) return null;
    const brut = fs.readFileSync(chemin);
    if (brut.subarray(0, 8192).includes(0)) return null;
    return brut.toString("utf8");
  } catch (e) {
    return null;
  }
}

/** Le numéro de la première ligne qui contient le motif d'une règle « interdit », ou 0. */
function ligneDe(regle, contenu) {
  if (regle.sorte !== "interdit") return 0;
  const lignes = contenu.split(/\r?\n/);
  const i = lignes.findIndex((l) => (regle.motif ? regle.motif.test(l) : l.includes(regle.brut)));
  return i + 1;
}

function constatsFichiers(racine, fichiers) {
  const { lireRegles, enfreintes } = require("./regles");
  const { trouverSecrets, estFichierEnv } = require("./motifs");
  const regles = lireRegles(racine);
  const constats = [];
  for (const fichier of fichiers) {
    const contenu = lireTexte(racine, fichier);
    if (contenu === null) continue;
    for (const r of regles)
      for (const m of enfreintes([r], [{ fichier, contenu }])) {
        const ligne = ligneDe(r, contenu);
        constats.push(ligne ? m.replace(`${fichier} : `, `${fichier}, ligne ${ligne} : `) : m);
      }
    if (!estFichierEnv(fichier)) {
      const secrets = trouverSecrets(contenu);
      if (secrets.length) constats.push(`${fichier} : contient une ${secrets.join(", ")} (une clé secrète se range dans .env, jamais dans le code).`);
    }
  }
  return constats;
}

/**
 * Vrai quand un plan de aidd_docs/tasks/ a une tâche en cours (« - [~] **T… ») dans « ## Tâches » (ou « ## Taches »)
 * qui ne porte pas la sous-ligne « En pause : Q<n> » (elle attend une décision : personne n'y travaille).
 */
function tacheEnCours(racine) {
  const taches = path.join(racine, "aidd_docs", "tasks");
  let dossiers = [];
  try {
    dossiers = fs.readdirSync(taches, { withFileTypes: true }).filter((x) => x.isDirectory());
  } catch (e) {
    return false;
  }
  for (const d of dossiers) {
    let plans = [];
    try {
      plans = fs.readdirSync(path.join(taches, d.name)).filter((f) => /^PLAN-.*\.md$/.test(f));
    } catch (e) {
      continue;
    }
    for (const p of plans) {
      let dans = false;
      let texte = "";
      try {
        texte = fs.readFileSync(path.join(taches, d.name, p), "utf8");
      } catch (e) {
        continue; // plan illisible : les autres comptent
      }
      let enCours = false; // la tâche [~] lue en dernier, tant qu'aucune sous-ligne « En pause » ne la suit
      for (const ligne of texte.split(/\r?\n/)) {
        if (/^##\s/.test(ligne)) {
          if (enCours) return true;
          dans = /^##\s+T[âa]ches\s*$/i.test(ligne);
        } else if (dans && /^- \[.\]\s+\*\*T\d+/.test(ligne)) {
          if (enCours) return true;
          enCours = /^- \[~\]/.test(ligne);
        } else if (enCours && /^\s+- En pause\s*:/i.test(ligne)) enCours = false;
      }
      if (enCours) return true;
    }
  }
  return false;
}

/**
 * Les contrôles rapides se lancent seulement pendant une réalisation : marqueur vivant (realisation.js, sous la racine
 * du groupe ou celle de la session), tâche [~] hors pause, et au moins un fichier relevé hors de docs/ et aidd_docs/.
 */
function pendantUneTache(groupe, racineSession) {
  if (!groupe.fichiers.some((f) => !/^(docs|aidd_docs)\//.test(f))) return false;
  const { lire } = require("./realisation");
  const racines = [...new Set([groupe.racine, racineSession])];
  return racines.some((r) => lire(r)) && racines.some((r) => tacheEnCours(r));
}

/** Les commandes entre accents graves d'une cellule, hors parenthèses (« (corriger le format : `…`) »). */
function commandesDe(cellule) {
  const commandes = [];
  let profondeur = 0;
  let courante = null;
  for (const c of cellule) {
    if (courante !== null) {
      if (c === "`") {
        if (profondeur === 0 && courante.trim()) commandes.push(courante.trim());
        courante = null;
      } else courante += c;
    } else if (c === "`") courante = "";
    else if (c === "(") profondeur++;
    else if (c === ")") profondeur = Math.max(0, profondeur - 1);
    else if (c === "|") break;
  }
  return commandes;
}

/** Les contrôles automatiques de « Commandes du projet » (docs/technical.md), ou []. */
function controlesRapides(racine) {
  let texte;
  try {
    texte = fs.readFileSync(path.join(racine, "docs", "technical.md"), "utf8");
  } catch (e) {
    return [];
  }
  for (const ligne of texte.split(/\r?\n/)) {
    const m = /^\s*\|\s*Contrôles automatiques[^|]*\|(.*)$/.exec(ligne);
    if (m) return commandesDe(m[1]);
  }
  return [];
}

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Vrai quand la sortie d'un contrôle nomme un des fichiers relevés : chemin relatif à la racine (`src/a.ts`,
 * `./src/a.ts`, ou à la fin d'un chemin absolu), `\` lus comme `/`. Un échec qui ne nomme aucun fichier du
 * tour (erreur ailleurs dans le projet, configuration) ne bloque pas : ce tour ne l'a pas causé.
 */
function nommeUnFichier(texte, racine, fichiers) {
  const sortie = texte.replace(/\\/g, "/");
  const minuscules = process.platform === "win32" || /^[a-z]:\//i.test(sortie);
  const base = String(racine).replace(/\\/g, "/").replace(/\/+$/, "");
  return fichiers.some((rel) => {
    const absolu = `${base}/${rel}`;
    if (minuscules ? sortie.toLowerCase().includes(absolu.toLowerCase()) : sortie.includes(absolu)) return true;
    return new RegExp(`(^|[^\\w.-])${echapper(rel)}(?![\\w/-]|\\.\\w)`, minuscules ? "mi" : "m").test(sortie);
  });
}

// Un contrôle qui réécrit les fichiers (`prettier --write`, `eslint --fix`, `ruff format`, `npm run format`,
// `cargo fmt`, `lint:fix`) n'a pas sa place en fin de tour : il modifierait le travail sans que l'agent le voie.
// Il est sauté ; seules les commandes qui vérifient sans modifier sont lancées.
const REECRIT = /(^|\s)--(write|fix)(?![\w-])|(^|\s)(format|fmt)(\s|$)|:(fix|format)(?![\w:-])/i;

/** Lance les contrôles l'un après l'autre dans le délai ; renvoie les constats des échecs qui nomment un fichier du tour. */
function lancerControles(racine, commandes, fichiers) {
  const delai = (Number(process.env.PULSE_FIN_DE_TOUR_DELAI) > 0 ? Number(process.env.PULSE_FIN_DE_TOUR_DELAI) : DELAI_S) * 1000;
  const fin = Date.now() + delai;
  const constats = [];
  for (const commande of commandes) {
    if (REECRIT.test(commande)) continue;
    const reste = fin - Date.now();
    if (reste <= 0) break;
    // Par le lanceur (arrêt de toute la commande au délai), sortie dans un fichier : rien ne retient le hook.
    const sortie = path.join(os.tmpdir(), `pulse-fin-${process.pid}-${Date.now()}.txt`);
    const fd = fs.openSync(sortie, "w");
    let r;
    try {
      r = spawnSync(process.execPath, [__filename, "--lancer", commande, String(reste)], { cwd: racine, timeout: reste + 10000, stdio: ["ignore", fd, fd], windowsHide: true });
    } finally {
      fs.closeSync(fd);
    }
    let texte = "";
    try {
      texte = fs.readFileSync(sortie, "utf8");
      fs.unlinkSync(sortie);
    } catch (e) {
      // sortie illisible
    }
    if (r.error || r.signal || r.status === null || r.status === DEPASSE) continue; // délai dépassé ou lancement impossible
    const lignesSortie = texte.replace(/\s+$/, "").split(/\r?\n/);
    if (r.status === 0 || r.status === 127 || r.status === 9009 || INTROUVABLE.test(lignesSortie.slice(-5).join("\n"))) continue;
    if (!nommeUnFichier(texte, racine, fichiers)) continue;
    const lignes = lignesSortie.slice(-LIGNES_SORTIE).join("\n");
    constats.push(`Le contrôle automatique \`${commande}\` échoue :\n\`\`\`\n${lignes}\n\`\`\``);
  }
  return constats;
}

const liste = (constats) => {
  const vus = constats.slice(0, CONSTATS_MAX).map((c) => `- ${c}`);
  if (constats.length > CONSTATS_MAX) vus.push("- …");
  return vus.join("\n");
};

function principal() {
  const entree = JSON.parse(fs.readFileSync(0, "utf8"));
  if (!entree || typeof entree !== "object") return;
  const evenement = entree.hook_event_name === "SubagentStop" ? "SubagentStop" : "Stop";
  const agent = typeAgent(entree.agent_type);
  if (evenement === "SubagentStop" && (!AGENTS_QUI_ECRIVENT.includes(agent) || !entree.agent_id)) return;
  // Le relevé de la session sert au seul hook Stop ; un sous-agent ne touche que le sien.
  const cleEntree = evenement === "Stop" ? { session_id: entree.session_id } : entree;
  const tour = require("./tour");
  const k = tour.cle(cleEntree);
  if (!k || (evenement === "SubagentStop" && k === tour.cle({ session_id: entree.session_id }))) return;
  const cwd = entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : process.cwd();
  if (!require("./garde").projetPulse(cwd)) return;
  const racine = tour.racineGit(cwd);
  if (!racine) return;

  const etat = tour.lireTour(cleEntree, racine);
  if (!etat.fichiers.length) return;
  const rapides = evenement === "Stop" || AGENTS_CONTROLES_RAPIDES.includes(agent);
  const constats = [];
  // Chaque fichier se contrôle avec les règles de sa propre racine Git (dépôt principal ou dossier à part).
  for (const groupe of tour.parRacine(racine, etat.fichiers)) {
    constats.push(...constatsFichiers(groupe.racine, groupe.fichiers));
    if (rapides && pendantUneTache(groupe, racine)) constats.push(...lancerControles(groupe.racine, controlesRapides(groupe.racine), groupe.fichiers));
  }
  // Le relevé n'est jamais réécrit (des écritures en parallèle s'y ajoutent) : seule la part lue est marquée contrôlée.
  if (!constats.length) return tour.marquerLus(cleEntree, racine, etat.lu);

  // stop_hook_active : seulement un indice, quand le compteur a été perdu.
  const relances = Math.max(etat.relances, entree.stop_hook_active === true ? 1 : 0);
  if (relances >= RELANCES_MAX) {
    tour.marquerLus(cleEntree, racine, etat.lu);
    const contexte =
      `Pulse a déjà bloqué ${RELANCES_MAX} fois la fin de ce tour. Ces points restent à corriger :\n${liste(constats)}\n` +
      "Dites simplement à la personne ce qui reste à corriger, sans annoncer que le travail est terminé.";
    fs.writeSync(1, JSON.stringify({ hookSpecificOutput: { hookEventName: evenement, additionalContext: contexte } }));
    return;
  }
  tour.ecrireRelances(cleEntree, racine, relances + 1);
  const raison =
    `Pulse a contrôlé les fichiers écrits pendant ce tour et trouvé des points à corriger :\n${liste(constats)}\n` +
    "Corrigez ces points, puis relancez `pulse-aidd verifier`. Expliquez ensuite le blocage à la personne en une phrase simple.";
  fs.writeSync(1, JSON.stringify({ decision: "block", reason: raison }));
}

/** Lanceur d'un contrôle (`--lancer <commande> <délai ms>`) : au délai, arrête la commande et tout ce qu'elle a lancé. */
function lanceur(commande, delai) {
  const { spawn } = require("child_process");
  const enfant = spawn(commande, { shell: true, stdio: "inherit", detached: process.platform !== "win32", windowsHide: true });
  const minuterie = setTimeout(() => {
    try {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(enfant.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      else process.kill(-enfant.pid, "SIGKILL");
    } catch (e) {
      // déjà arrêtée
    }
    process.exit(DEPASSE);
  }, delai);
  enfant.on("error", () => process.exit(127));
  enfant.on("exit", (code) => {
    clearTimeout(minuterie);
    process.exit(code === null ? 1 : code === DEPASSE ? 1 : code);
  });
}

if (process.argv[2] === "--lancer") lanceur(process.argv[3], Number(process.argv[4]) || DELAI_S * 1000);
else {
  try {
    principal();
  } catch (e) {
    // silencieux
  }
}

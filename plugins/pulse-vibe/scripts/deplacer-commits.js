#!/usr/bin/env node
// Pulse – ranger les commits pas encore envoyés de la branche principale sur une nouvelle branche
// (`pulse-aidd deplacer-commits`, /pulse:pr section B.1), puis remettre la principale à l'état du dépôt distant.
//
//   pulse-aidd deplacer-commits <nouvelle-branche> [--principale <nom>]
//
// Sans --principale : la branche principale se lit dans origin/HEAD (Conventions Git § 5).
// Vérifie d'abord, sans rien toucher : dépôt Git, aucune opération Git en cours, dossier propre (aucun fichier modifié
// ni nouveau), branche courante = principale, origin/<principale> connu et ancêtre de HEAD, au moins un commit d'avance,
// nom de branche valide et libre. Puis : git branch <nom>, git switch <nom>, git branch -f <principale> origin/<principale> ;
// enfin contrôle que la principale vaut origin/<principale> et que <nom> porte les commits.
// Sortie : lignes « clé: valeur ». Codes : 0 fait, 1 usage, 2 refus préalable (rien n'a changé),
// 3 échec rattrapé (principale remise à son commit de départ, retour sur elle ; la nouvelle branche, qui porte les commits, est gardée).
// Soumis à la demande d'accord de Claude Code (déplacer une branche, règle commune 17) : absent de tout allowed-tools.
// Opérations Git permises : branch <nom>, switch, branch -f <principale> (vers origin/<principale>, ou vers son commit de départ
// après un échec), lectures. Jamais : reset, branch -D, push, stash.
"use strict";

const fs = require("fs");
const { spawnSync } = require("child_process");

const sortie = [];
// Une valeur tient toujours sur une ligne : un retour à la ligne ajouterait une clé lue par le modèle.
const dire = (cle, valeur = "") => { const v = String(valeur).replace(/[\r\n]+/g, " "); sortie.push(v === "" ? `${cle}:` : `${cle}: ${v}`); };
function terminer(code) {
  if (sortie.length) fs.writeSync(1, sortie.join("\n") + "\n");
  process.exit(code);
}
const usage = () => { dire("usage", "pulse-aidd deplacer-commits <nouvelle-branche> [--principale <nom>]"); terminer(1); };
const refuser = (etat, ...details) => { dire("etat", etat); for (const [k, v] of details) dire(k, v); terminer(2); };

/** Lance git dans le dossier courant ; la sortie est rognée, sauf avec brut (git status : l'état tient dans les premiers caractères). */
function git(args, brut = false) {
  const r = spawnSync("git", ["-c", "core.quotepath=off", ...args], { encoding: "utf8" });
  const texte = (r.stdout || "").replace(/\r/g, "");
  return { ok: r.status === 0, sortie: brut ? texte : texte.trim(), erreur: (r.stderr || "").trim() };
}
/** La raison d'un échec, tirée de la sortie de Git : la première erreur, sur une ligne. */
function raisonDe(texte, repli) {
  const lignes = String(texte || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^hint:/i.test(l));
  return (lignes.find((l) => /^(error|fatal)\b/i.test(l)) || lignes[0] || repli).replace(/\s+/g, " ").slice(0, 300);
}
const sha = (ref) => { const r = git(["rev-parse", "--verify", "-q", `${ref}^{commit}`]); return r.ok ? r.sortie : ""; };

function lireArguments(args) {
  let nom = null;
  let principale = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--principale") {
      if (i + 1 >= args.length || principale !== null) usage();
      principale = args[++i];
    } else if (a.startsWith("--")) usage();
    else if (nom === null) nom = a;
    else usage();
  }
  if (nom === null) usage();
  return { nom, principale };
}

function operationEnCours() {
  for (const [nom, libelle] of [["MERGE_HEAD", "fusion"], ["REVERT_HEAD", "annulation"], ["CHERRY_PICK_HEAD", "report"], ["rebase-merge", "rebasage"], ["rebase-apply", "rebasage"], ["sequencer", "suite d'annulations ou de reports"]]) {
    const r = git(["rev-parse", "--git-path", nom]);
    if (r.ok && fs.existsSync(r.sortie)) return libelle;
  }
  return "";
}

/** Les fichiers modifiés ou nouveaux (les fichiers ignorés ne comptent pas). */
function fichiersOccupes() {
  const r = git(["status", "--porcelain", "-z", "--untracked-files=all"], true);
  if (!r.ok) refuser("lecture-impossible", ["raison", raisonDe(r.erreur, "git status a échoué")]);
  const morceaux = r.sortie.split("\0").filter(Boolean);
  const fichiers = [];
  for (let i = 0; i < morceaux.length; i++) {
    fichiers.push(morceaux[i].slice(3));
    if (/[RC]/.test(morceaux[i].slice(0, 2))) i++; // l'ancien nom suit
  }
  return fichiers;
}

const nomValide = (nom) => !nom.startsWith("-") && nom !== "HEAD" && git(["check-ref-format", "--branch", nom]).ok && git(["check-ref-format", `refs/heads/${nom}`]).ok;

function verifier({ nom, principale }) {
  if (!git(["rev-parse", "--is-inside-work-tree"]).ok || !sha("HEAD")) refuser("pas-de-depot");
  const op = operationEnCours();
  if (op) refuser("operation-en-cours", ["operation", op]);
  const occupes = fichiersOccupes();
  if (occupes.length) refuser("arbre-occupe", ...occupes.map((f) => ["fichier", f]));
  if (principale === null) {
    const r = git(["symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD"]);
    if (!r.ok || !r.sortie.startsWith("origin/")) refuser("principale-inconnue", ["conseil", "lire la branche principale (Conventions Git § 5), puis relancer avec --principale <nom>"]);
    principale = r.sortie.slice("origin/".length);
  }
  if (!nomValide(principale)) refuser("principale-invalide", ["principale", principale]);
  const courante = git(["symbolic-ref", "--short", "-q", "HEAD"]);
  if (!courante.ok) refuser("tete-detachee");
  if (courante.sortie !== principale) refuser("autre-branche", ["branche-courante", courante.sortie], ["principale", principale]);
  const distante = `refs/remotes/origin/${principale}`;
  const shaDistant = sha(distante);
  if (!shaDistant) refuser("principale-absente-du-depot-distant", ["principale", principale], ["conseil", "la principale n'a jamais été envoyée : envoyez-la, rien n'est à déplacer"]);
  const depart = sha("HEAD");
  if (!git(["merge-base", "--is-ancestor", shaDistant, depart]).ok) {
    refuser("divergence", ["conseil", "le dépôt distant a des changements absents d'ici : récupérez d'abord la version du dépôt distant (git pull), puis relancez"]);
  }
  const avance = Number(git(["rev-list", "--count", `${shaDistant}..${depart}`]).sortie) || 0;
  if (avance < 1) refuser("rien-a-deplacer", ["principale", principale]);
  if (!nomValide(nom)) refuser("nom-invalide", ["branche", nom]);
  if (git(["show-ref", "--verify", "--quiet", `refs/heads/${nom}`]).ok) refuser("branche-existante", ["branche", nom]);
  return { principale, distante, shaDistant, depart, avance };
}

/** Échec après le début des gestes : principale remise à son commit de départ, retour sur elle ; la nouvelle branche reste. */
function rattraper(etat, raison, { nom, principale, depart }) {
  const courante = git(["symbolic-ref", "--short", "-q", "HEAD"]).sortie;
  if (courante !== principale) {
    if (sha(`refs/heads/${principale}`) !== depart) git(["branch", "-f", principale, depart]);
    git(["switch", "-q", principale]);
  }
  const remise = git(["symbolic-ref", "--short", "-q", "HEAD"]).sortie === principale && sha(`refs/heads/${principale}`) === depart;
  dire("etat", remise ? etat : "etat-incertain");
  dire("raison", raison);
  dire("principale", remise ? `${principale}, à son commit de départ ${depart.slice(0, 7)}` : `à vérifier : son commit de départ était ${depart.slice(0, 7)}`);
  if (sha(`refs/heads/${nom}`) === depart) dire("branche-gardee", nom);
  terminer(3);
}

function main() {
  const demande = lireArguments(process.argv.slice(2));
  const { nom } = demande;
  const { principale, distante, shaDistant, depart, avance } = verifier(demande);
  const contexte = { nom, principale, depart };

  let r = git(["branch", nom]);
  if (!r.ok) {
    if (sha(`refs/heads/${nom}`)) rattraper("echec", raisonDe(r.erreur, "création de la branche"), contexte);
    refuser("echec-creation", ["raison", raisonDe(r.erreur, "création de la branche")]); // rien n'a été créé
  }
  if (sha(`refs/heads/${nom}`) !== depart) rattraper("echec", "la nouvelle branche ne pointe pas sur le dernier commit", contexte);
  r = git(["switch", "-q", nom]);
  if (!r.ok) rattraper("echec", raisonDe(r.erreur, "changement de branche"), contexte);
  r = git(["branch", "-f", principale, shaDistant]);
  if (!r.ok) rattraper("echec", raisonDe(r.erreur, "remise de la principale"), contexte);

  // Contrôle final : la principale vaut origin/<principale>, la nouvelle branche porte les commits, on est dessus.
  const ok = sha(`refs/heads/${principale}`) === sha(distante)
    && sha(`refs/heads/${nom}`) === depart
    && Number(git(["rev-list", "--count", `${shaDistant}..refs/heads/${nom}`]).sortie) === avance
    && git(["symbolic-ref", "--short", "-q", "HEAD"]).sortie === nom;
  if (!ok) rattraper("controle-final-echoue", "la principale ou la nouvelle branche n'est pas à l'endroit attendu", contexte);

  dire("etat", "fait");
  dire("deplace", avance);
  dire("branche", nom);
  dire("principale", `${principale}, remise à origin/${principale}`);
  for (const ligne of git(["log", "--oneline", "--no-decorate", `${shaDistant}..refs/heads/${nom}`]).sortie.split("\n").filter(Boolean)) dire("commit", ligne);
  terminer(0);
}

if (require.main === module) main();

// Relais de pulse-aidd hors de Claude Code (bin/pulse-aidd.js, placé dans le PATH par npm) :
//  - lance l'outil bash du plugin pulse (Git for Windows sous Windows), le bin/ des packs choisis en tête du PATH ;
//  - réécrit les mentions propres à Claude Code dans la sortie (textes.reecrire) ;
//  - contexte et etape : ajoute la note « Pulse dans votre outil d'IA » ;
//  - une sortie d'affichage trop longue pour l'outil se lit en parties : pulse-aidd suite <id> <n>.
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { StringDecoder } = require("string_decoder");
const { racineContenu, COEUR, PACKS } = require("./chemins");
const { reecrire, NOTE_OUTILS } = require("./textes");
const { Installation } = require("./installation");

/** Sous-commandes qui affichent des règles ou des modèles : sortie entière, réécrite et découpée au besoin. */
const AFFICHAGE = new Set(["contexte", "etape", "reference", "modele", "agent", "qualite", "tests", "lexique"]);
const TAILLE_PARTIE = () => Number(process.env.PULSE_SORTIE_MAX) || 12000;
const dossierSorties = () => path.join(os.tmpdir(), "pulseia-sorties");

/** Le bash à utiliser : bash sous Linux et macOS ; celui de Git for Windows sous Windows (jamais celui de WSL). */
function trouverBash() {
  if (process.platform !== "win32") return "bash";
  const candidats = [];
  const git = spawnSync("where", ["git.exe"], { encoding: "utf8" });
  for (const ligne of (git.stdout || "").split(/\r?\n/).filter(Boolean)) {
    const d = path.dirname(ligne.trim());
    candidats.push(path.join(d, "..", "bin", "bash.exe"), path.join(d, "..", "..", "bin", "bash.exe"), path.join(d, "bash.exe"));
  }
  for (const v of ["ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"]) if (process.env[v]) candidats.push(path.join(process.env[v], "Git", "bin", "bash.exe"));
  if (process.env.LOCALAPPDATA) candidats.push(path.join(process.env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"));
  return candidats.find((c) => fs.existsSync(c)) || null;
}

/** Le nom réel de la variable PATH (Path sous Windows). */
const clePath = (env) => Object.keys(env).find((k) => k.toUpperCase() === "PATH") || "PATH";

function environnement() {
  const installation = new Installation();
  const contenu = racineContenu();
  const bins = [path.join(contenu, COEUR, "bin"), ...installation.packs.filter((p) => PACKS[p]).map((p) => path.join(contenu, PACKS[p], "bin"))];
  for (const dossier of bins) {
    // npm garde le droit d'exécution des fichiers, mais une copie peut l'avoir perdu.
    for (const f of fs.existsSync(dossier) ? fs.readdirSync(dossier) : []) {
      if (!f.includes(".")) {
        try {
          fs.chmodSync(path.join(dossier, f), 0o755);
        } catch {
          // lecture seule : l'outil reste lancé par bash
        }
      }
    }
  }
  const env = { ...process.env };
  const cle = clePath(env);
  env[cle] = [...bins, env[cle] || ""].join(path.delimiter);
  env.PULSE_OUTIL = process.env.PULSE_OUTIL || (installation.outils.length === 1 ? installation.outils[0] : "autre");
  return env;
}

/** Découpe un texte en parties d'au plus `taille` caractères, sur les fins de ligne quand c'est possible. */
function decouper(texte, taille) {
  const parties = [];
  let courante = "";
  for (const ligne of texte.split(/(?<=\n)/)) {
    if (courante.length + ligne.length > taille && courante) {
      parties.push(courante);
      courante = "";
    }
    let reste = ligne;
    while (reste.length > taille) {
      parties.push(reste.slice(0, taille));
      reste = reste.slice(taille);
    }
    courante += reste;
  }
  if (courante) parties.push(courante);
  return parties;
}

const piedDePartie = (id, n, total) =>
  n < total
    ? `\n[Pulse] Partie ${n}/${total} de cette sortie. Lancer maintenant \`pulse-aidd suite ${id} ${n + 1}\`, puis chaque partie suivante jusqu'à la ${total}e, et tout lire avant de continuer.\n`
    : `\n[Pulse] Partie ${n}/${total} : fin de la sortie.\n`;

/** Écrit une sortie d'affichage : entière si elle tient, sinon sa première partie et la commande des suivantes. */
function afficher(texte) {
  const parties = decouper(texte, TAILLE_PARTIE());
  if (parties.length <= 1) {
    process.stdout.write(texte);
    return;
  }
  const id = crypto.createHash("sha1").update(texte).digest("hex").slice(0, 10);
  fs.mkdirSync(dossierSorties(), { recursive: true });
  fs.writeFileSync(path.join(dossierSorties(), `${id}.json`), JSON.stringify(parties));
  process.stdout.write(parties[0] + piedDePartie(id, 1, parties.length));
}

/** pulse-aidd suite <id> <n> : la partie n d'une sortie découpée. */
function suite(id, n) {
  const numero = Number(n);
  if (!/^[0-9a-f]{10}$/.test(id || "") || !Number.isInteger(numero) || numero < 1) {
    console.error("Usage : pulse-aidd suite <id> <n> (indiqués à la fin de la partie précédente).");
    return 1;
  }
  let parties;
  try {
    parties = JSON.parse(fs.readFileSync(path.join(dossierSorties(), `${id}.json`), "utf8"));
  } catch {
    console.error("Cette sortie n'est plus disponible : relancer la commande pulse-aidd d'origine.");
    return 1;
  }
  if (numero > parties.length) {
    console.error(`Cette sortie a ${parties.length} parties.`);
    return 1;
  }
  process.stdout.write(parties[numero - 1] + piedDePartie(id, numero, parties.length));
  return 0;
}

/** Réécrit un flux au fil de l'eau, ligne par ligne ; une fin sans retour à la ligne (une question) part après un court délai. */
function relayer(source, destination) {
  const decodeur = new StringDecoder("utf8");
  let reste = "";
  let minuterie = null;
  const vider = () => {
    if (reste) destination.write(reecrire(reste));
    reste = "";
  };
  source.on("data", (morceau) => {
    clearTimeout(minuterie);
    const texte = reste + decodeur.write(morceau);
    const fin = texte.lastIndexOf("\n");
    if (fin >= 0) destination.write(reecrire(texte.slice(0, fin + 1)));
    reste = texte.slice(fin + 1);
    if (reste) minuterie = setTimeout(vider, 50);
  });
  return new Promise((resoudre) =>
    source.on("end", () => {
      clearTimeout(minuterie);
      reste += decodeur.end();
      vider();
      resoudre();
    })
  );
}

/** Lance pulse-aidd avec ses arguments ; résout le code de sortie. */
async function lancer(args) {
  if (args[0] === "suite") return suite(args[1], args[2]);
  const bash = trouverBash();
  if (!bash) {
    console.error(
      "pulse-aidd : le bash de Git for Windows est introuvable. Installez Git for Windows (https://git-scm.com/download/win), puis fermez et relancez votre outil d'IA."
    );
    return 127;
  }
  const script = path.join(racineContenu(), COEUR, "bin", "pulse-aidd");
  const env = environnement();
  if (AFFICHAGE.has(args[0])) {
    const r = spawnSync(bash, [script, ...args], { env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["inherit", "pipe", "pipe"] });
    if (r.error) {
      console.error(`pulse-aidd : ${r.error.message}`);
      return 1;
    }
    if (r.stderr) process.stderr.write(reecrire(r.stderr));
    let sortie = reecrire(r.stdout || "");
    if (args[0] === "contexte" || args[0] === "etape") sortie += NOTE_OUTILS;
    afficher(sortie);
    return r.status ?? 1;
  }
  const enfant = spawn(bash, [script, ...args], { env, stdio: ["inherit", "pipe", "pipe"] });
  const flux = [relayer(enfant.stdout, process.stdout), relayer(enfant.stderr, process.stderr)];
  const code = await new Promise((resoudre) => {
    enfant.on("error", (e) => {
      console.error(`pulse-aidd : ${e.message}`);
      resoudre(1);
    });
    enfant.on("close", (c, signal) => resoudre(c ?? (signal ? 1 : 0)));
  });
  await Promise.all(flux);
  return code;
}

module.exports = { lancer, decouper, suite, trouverBash, environnement, AFFICHAGE };

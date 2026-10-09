// Tests de pulse-aidd secrets (scripts/secrets.js) : aucune valeur ne sort jamais.
// Lancer : node --test plugins/pulse-vibe/tests/secrets.test.js (nécessite git et bash dans le PATH)
//
// Les valeurs factices sont construites à l'exécution (concaténation, hasard) : ainsi ce fichier
// ne contient aucune clé reconnaissable par le garde-fou anti-secrets.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "secrets.js");
const hasard = (n = 12) => crypto.randomBytes(n).toString("hex");

// Valeurs factices, différentes à chaque lancement.
const CLE_STRIPE = ["sk", "live", "Fx" + hasard(14)].join("_");
const MOT_DE_PASSE_BASE = "Mdp" + hasard(10);
const ADRESSE_BASE = "postgres" + "ql://appli:" + MOT_DE_PASSE_BASE + "@ep-exemple-pooler.eu-central-1.aws.neon.tech/base";
const CLE_PUBLIQUE = "pk_" + "test_" + hasard(8);

function cleChemin(env) {
  return Object.keys(env).find((k) => k.toUpperCase() === "PATH") || "PATH";
}

/** Projet temporaire : dépôt Git, faux pack « test » dans le PATH qui enregistre argv et l'entrée standard. */
function projet({ pack = true, git = true } = {}) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-secrets-"));
  const bin = path.join(dossier, "_bin");
  const journal = path.join(dossier, "_journal");
  fs.mkdirSync(bin);
  fs.mkdirSync(journal);
  if (git) {
    spawnSync("git", ["init", "-q"], { cwd: dossier });
    fs.writeFileSync(path.join(dossier, ".gitignore"), "_bin/\n_journal/\n");
  }
  if (pack) {
    fs.mkdirSync(path.join(dossier, "docs"));
    fs.writeFileSync(path.join(dossier, "docs", "technical.md"), "# Technique\n\n**Pack de pile Pulse** : test\n");
    // Faux outil de pack. Volontairement bavard : il recopie l'entrée standard dans sa sortie,
    // pour prouver que le cœur masque toute valeur qui reviendrait.
    fs.writeFileSync(
      path.join(bin, "pulse-pile-test"),
      `#!/usr/bin/env bash
J="$FAUX_JOURNAL"
n=$(ls "$J" | grep -c '^argv-' || true)
printf '%s\\n' "$@" > "$J/argv-$n"
entree="$(cat)"
printf '%s' "$entree" > "$J/stdin-$n"
case "$1 $2" in
  "secrets regles")
    printf '%s' '{"variables":{"STRIPE_SECRET_KEY":{"secret":true,"fournisseur":"Stripe","prefixes":["sk_live_","sk_test_"],"modes":{"sk_live_":"mode live","sk_test_":"mode test"}},"DATABASE_URL":{"secret":true,"parEnvironnement":true,"groupe":["DATABASE_URL","DATABASE_URL_DIRECT"],"besoins":["DATABASE_URL_DIRECT"]},"APP_URL":{"secret":false}},"code":["CODE_SEUL_TOKEN"]}' ;;
  "secrets tester")
    echo "sonde : $entree"
    echo "$FAUX_TEST_MESSAGE"
    exit "\${FAUX_TEST:-0}" ;;
  "hebergeur ls")
    printf '%s' '{"hebergeur":"Hébergeur test","variables":[{"nom":"STRIPE_SECRET_KEY","environnements":["production"],"type":"config"},{"nom":"DATABASE_URL","environnements":["production","preview"],"type":"secret"}]}' ;;
  "hebergeur envoyer")
    echo "reçu : $entree"
    if [ "$4" = "$FAUX_ECHEC_ENV" ]; then echo "refusé par l'hébergeur"; exit 1; fi
    echo "$3 envoyée ($4)\${FAUX_BAVARD:+ : $entree}" ;;
  "hebergeur redeployer")
    echo "https://exemple-$3.test" ;;
  *) echo "inconnu"; exit 2 ;;
esac
`,
      { mode: 0o755 }
    );
  }
  return { dossier, journal };
}

function lancer(p, args, envSup = {}) {
  const env = { ...process.env, FAUX_JOURNAL: p.journal, ...envSup };
  const cle = cleChemin(env);
  env[cle] = path.join(p.dossier, "_bin") + path.delimiter + env[cle];
  const r = spawnSync("node", [SCRIPT, ...args], { cwd: p.dossier, env, encoding: "utf8" });
  return { code: r.status, sortie: (r.stdout || "") + (r.stderr || "") };
}

const ecrire = (p, f, contenu) => {
  fs.mkdirSync(path.dirname(path.join(p.dossier, f)), { recursive: true });
  fs.writeFileSync(path.join(p.dossier, f), contenu);
};
const lire = (p, f) => fs.readFileSync(path.join(p.dossier, f), "utf8");
const valeurDans = (texte, nom) => ((new RegExp(`^${nom}=(.*)$`, "m").exec(texte) || [])[1]);

/** Appels du faux pack : [{ argv: [...], stdin }]. */
function appels(p) {
  return fs.readdirSync(p.journal)
    .filter((f) => f.startsWith("argv-"))
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
    .map((f) => ({ argv: fs.readFileSync(path.join(p.journal, f), "utf8").split("\n").filter(Boolean), stdin: fs.readFileSync(path.join(p.journal, "stdin-" + f.slice(5)), "utf8") }));
}

function sansValeur(sortie, ...valeurs) {
  for (const v of valeurs) assert.ok(!sortie.includes(v), `la sortie contient une valeur secrète :\n${sortie}`);
}

// ---------------------------------------------------------------- inventaire

test("inventaire : noms, présence et type chez l'hébergeur, sans aucune valeur", () => {
  const p = projet();
  ecrire(p, ".env.example", "STRIPE_SECRET_KEY=\nDATABASE_URL=\nNEXT_PUBLIC_STRIPE_KEY=\nAPP_URL=\n");
  ecrire(p, ".env", `STRIPE_SECRET_KEY=${CLE_STRIPE}\nDATABASE_URL="${ADRESSE_BASE}"\nNEXT_PUBLIC_STRIPE_KEY=${CLE_PUBLIQUE}\nAPP_URL=\nLOCAL_SEUL_SECRET=abc${hasard(4)}\n`);
  const r = lancer(p, ["inventaire"]);
  assert.strictEqual(r.code, 0, r.sortie);
  sansValeur(r.sortie, CLE_STRIPE, MOT_DE_PASSE_BASE, CLE_PUBLIQUE);
  assert.match(r.sortie, /\| STRIPE_SECRET_KEY \| secret \| ✅ \| rempli \| ✅ Config \| — \|/);
  assert.match(r.sortie, /\| NEXT_PUBLIC_STRIPE_KEY \| réglage \|/);
  assert.match(r.sortie, /\| APP_URL \| réglage \| ✅ \| vide \|/);
  assert.match(r.sortie, /CODE_SEUL_TOKEN/, "noms lus dans le code par le pack");
  assert.match(r.sortie, /⛔ STRIPE_SECRET_KEY \(Production\) : enregistrée en type Config/);
  assert.match(r.sortie, /LOCAL_SEUL_SECRET : absente de \.env\.example/);
  assert.match(r.sortie, /❓ DATABASE_URL : présente en Production et en Preview/);
  assert.match(r.sortie, /règle deny/);
});

test("inventaire --json : structure lisible, sans valeur ; règle deny reconnue ; .env suivi par Git signalé", () => {
  const p = projet();
  ecrire(p, ".env", `STRIPE_SECRET_KEY=${CLE_STRIPE}\n`);
  ecrire(p, ".claude/settings.json", JSON.stringify({ permissions: { deny: ["Read(./.env)", "Read(./.env.*)"] } }));
  const r = lancer(p, ["inventaire", "--json", "--sans-hebergeur"]);
  assert.strictEqual(r.code, 0, r.sortie);
  sansValeur(r.sortie, CLE_STRIPE);
  const json = JSON.parse(r.sortie);
  const stripe = json.variables.find((v) => v.nom === "STRIPE_SECRET_KEY");
  assert.deepStrictEqual(stripe.local, { present: true, rempli: true });
  assert.strictEqual(stripe.fournisseur, "Stripe");
  assert.ok(!json.alertes.some((a) => /règle deny/.test(a.message)));

  ecrire(p, ".gitignore", "_bin/\n_journal/\n");
  spawnSync("git", ["add", "-f", ".env"], { cwd: p.dossier });
  const suivi = lancer(p, ["inventaire", "--sans-hebergeur"]);
  assert.match(suivi.sortie, /⛔ \.env est enregistré dans Git/);
  sansValeur(suivi.sortie, CLE_STRIPE);
});

// ---------------------------------------------------------------- preparer

test("preparer : crée .env depuis .env.example, ajoute la ligne vide, complète .gitignore, idempotent, sans écraser", () => {
  const p = projet();
  ecrire(p, ".env.example", "# Base\nDATABASE_URL=\nAPP_URL=VOTRE_ADRESSE_ICI\n");
  const r1 = lancer(p, ["preparer", "STRIPE_SECRET_KEY"]);
  assert.strictEqual(r1.code, 0, r1.sortie);
  const env = lire(p, ".env");
  assert.match(env, /^# Base\nDATABASE_URL=\nAPP_URL=\nSTRIPE_SECRET_KEY=\n$/);
  assert.ok(!env.includes("\r"), "fins de ligne LF");
  assert.match(lire(p, ".gitignore"), /^\.env\.\*$/m);
  assert.strictEqual(spawnSync("git", ["check-ignore", "-q", ".env"], { cwd: p.dossier }).status, 0);

  const r2 = lancer(p, ["preparer", "STRIPE_SECRET_KEY"]);
  assert.strictEqual(r2.code, 0);
  assert.strictEqual(lire(p, ".env"), env, "deuxième appel sans effet");

  fs.writeFileSync(path.join(p.dossier, ".env"), env.replace("STRIPE_SECRET_KEY=", `STRIPE_SECRET_KEY=${CLE_STRIPE}`));
  const r3 = lancer(p, ["preparer", "STRIPE_SECRET_KEY"]);
  assert.match(r3.sortie, /déjà remplie/);
  assert.strictEqual(valeurDans(lire(p, ".env"), "STRIPE_SECRET_KEY"), CLE_STRIPE);
  sansValeur(r3.sortie, CLE_STRIPE);
});

test("preparer : refuse un fichier suivi par Git ; un nom invalide donne l'usage", () => {
  const p = projet();
  ecrire(p, ".env.envoi", "");
  spawnSync("git", ["add", "-f", ".env.envoi"], { cwd: p.dossier });
  const r = lancer(p, ["preparer", "CLE_API", "--fichier", ".env.envoi"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /⛔ \.env\.envoi est enregistré dans Git/);
  const u = lancer(p, ["preparer", "nom-invalide"]);
  assert.strictEqual(u.code, 1);
  assert.match(u.sortie, /Usage : pulse-aidd secrets preparer/);
});

// ---------------------------------------------------------------- generer, elaguer

test("generer : écrit une valeur aléatoire sans l'afficher, différente à chaque appel", () => {
  const p = projet({ pack: false });
  ecrire(p, ".env", "AUTRE=1\n");
  const r1 = lancer(p, ["generer", "SESSION_SECRET"]);
  assert.strictEqual(r1.code, 0, r1.sortie);
  const v1 = valeurDans(lire(p, ".env"), "SESSION_SECRET");
  assert.match(v1, /^[A-Za-z0-9_-]{43}$/, "32 octets en base64url");
  sansValeur(r1.sortie, v1);
  assert.match(r1.sortie, /32 octets, 43 caractères/);

  const r2 = lancer(p, ["generer", "SESSION_SECRET", "--octets", "48"]);
  const v2 = valeurDans(lire(p, ".env"), "SESSION_SECRET");
  assert.notStrictEqual(v1, v2);
  assert.strictEqual(v2.length, 64);
  sansValeur(r2.sortie, v1, v2);
  assert.match(lire(p, ".env"), /^AUTRE=1\nSESSION_SECRET=[^\n]+\n$/, "une seule ligne, remplacée");
  assert.strictEqual(lancer(p, ["generer", "SESSION_SECRET", "--octets", "8"]).code, 1);
});

test("generer --versionne : nouvelle version en tête, ancienne gardée ; --seul et elaguer retirent les anciennes", () => {
  const p = projet({ pack: false });
  const ancien = "Ancien" + hasard(20);
  ecrire(p, ".env", `AUTH_SECRET=${ancien}\n`);
  const r1 = lancer(p, ["generer", "AUTH_SECRETS", "--versionne", "--ancien", "AUTH_SECRET"]);
  assert.strictEqual(r1.code, 0, r1.sortie);
  const liste1 = valeurDans(lire(p, ".env"), "AUTH_SECRETS");
  assert.match(liste1, new RegExp(`^2:[A-Za-z0-9_-]{43},1:${ancien}$`));
  sansValeur(r1.sortie, ancien, liste1.split(",")[0].slice(2));

  lancer(p, ["generer", "AUTH_SECRETS", "--versionne"]);
  const liste2 = valeurDans(lire(p, ".env"), "AUTH_SECRETS");
  assert.match(liste2, /^3:[^,]+,2:[^,]+,1:/);

  const e = lancer(p, ["elaguer", "AUTH_SECRETS"]);
  assert.strictEqual(e.code, 0, e.sortie);
  assert.match(valeurDans(lire(p, ".env"), "AUTH_SECRETS"), /^3:[^,]+$/);
  sansValeur(e.sortie, liste2);

  lancer(p, ["generer", "AUTH_SECRETS", "--versionne", "--seul"]);
  assert.match(valeurDans(lire(p, ".env"), "AUTH_SECRETS"), /^4:[^,]+$/);

  ecrire(p, ".env", "AUTH_SECRETS=pas-versionnee\n");
  const refus = lancer(p, ["generer", "AUTH_SECRETS", "--versionne"]);
  assert.strictEqual(refus.code, 1);
  assert.strictEqual(lire(p, ".env"), "AUTH_SECRETS=pas-versionnee\n", "rien changé");
});

test("generer --envoyer : une valeur distincte par environnement, sur l'entrée standard seulement", () => {
  const p = projet();
  ecrire(p, ".env", "");
  const r = lancer(p, ["generer", "SESSION_SECRET", "--envoyer", "production,preview"]);
  assert.strictEqual(r.code, 0, r.sortie);
  const locale = valeurDans(lire(p, ".env"), "SESSION_SECRET");
  const envois = appels(p).filter((a) => a.argv[0] === "hebergeur");
  assert.deepStrictEqual(envois.map((a) => a.argv), [
    ["hebergeur", "envoyer", "SESSION_SECRET", "production", "--type", "secret"],
    ["hebergeur", "envoyer", "SESSION_SECRET", "preview", "--type", "secret"],
  ]);
  const [prod, prev] = envois.map((a) => a.stdin);
  assert.match(prod, /^[A-Za-z0-9_-]{43}$/);
  assert.strictEqual(new Set([prod, prev, locale]).size, 3, "trois valeurs différentes");
  sansValeur(r.sortie, prod, prev, locale);
  assert.match(r.sortie, /Valeurs distinctes/);
  assert.strictEqual(lancer(p, ["generer", "X_SECRET", "--versionne", "--envoyer", "production"]).code, 1);
});

// ---------------------------------------------------------------- verifier

test("verifier : pièges de copier-coller signalés, sans jamais montrer la valeur", () => {
  const p = projet({ pack: false });
  const v = "Val" + hasard(10);
  const cas = [
    [`CLE_A="${v} "`, /espace au début ou à la fin/],
    [`CLE_A="${v}`, /guillemet ouvert/],
    [`CLE_A=${v}#suite`, /contient #/],
    [`CLE_A=${v} ${v}`, /espace au milieu/],
    [`CLE_A=VOTRE_CLE_ICI`, /valeur d'exemple/],
    [`CLE_A=${v}\nCLE_A=${v}`, /définie 2 fois/],
  ];
  for (const [ligne, attendu] of cas) {
    ecrire(p, ".env", ligne + "\n");
    const r = lancer(p, ["verifier", "CLE_A"]);
    assert.strictEqual(r.code, 1, ligne);
    assert.match(r.sortie, attendu, ligne);
    sansValeur(r.sortie, v);
  }
  ecrire(p, ".env", `CLE_A=${v}\r\nB=1\r\n`);
  const crlf = lancer(p, ["verifier", "CLE_A"]);
  assert.strictEqual(crlf.code, 0, crlf.sortie);
  assert.match(crlf.sortie, /fins de ligne Windows/);
  assert.match(crlf.sortie, /test réel non fait : aucun pack/);
  sansValeur(crlf.sortie, v);
  ecrire(p, ".env", "CLE_A=\n");
  assert.match(lancer(p, ["verifier", "CLE_A"]).sortie, /❌ vide/);
});

test("verifier : préfixe attendu du pack, test réel par le pack, valeur masquée même si le pack la renvoie", () => {
  const p = projet();
  ecrire(p, ".env", `STRIPE_SECRET_KEY=${CLE_STRIPE}\nDATABASE_URL=${ADRESSE_BASE}\nDATABASE_URL_DIRECT=${ADRESSE_BASE.replace("-pooler", "")}\n`);
  const ok = lancer(p, ["verifier", "STRIPE_SECRET_KEY"], { FAUX_TEST: "0", FAUX_TEST_MESSAGE: "✅ clé acceptée" });
  assert.strictEqual(ok.code, 0, ok.sortie);
  assert.match(ok.sortie, /commence par « sk_live_ » \(mode live\)/);
  assert.match(ok.sortie, /✅ test réel : clé acceptée/);
  sansValeur(ok.sortie, CLE_STRIPE);
  const testeur = appels(p).find((a) => a.argv[1] === "tester");
  assert.deepStrictEqual(testeur.argv, ["secrets", "tester", "STRIPE_SECRET_KEY"], "la valeur ne passe jamais en argument");
  assert.deepStrictEqual(JSON.parse(testeur.stdin), { STRIPE_SECRET_KEY: CLE_STRIPE });

  const base = lancer(p, ["verifier", "DATABASE_URL"], { FAUX_TEST: "1", FAUX_TEST_MESSAGE: "❌ mot de passe refusé" });
  assert.strictEqual(base.code, 1);
  assert.match(base.sortie, /❌ test réel : mot de passe refusé/);
  assert.match(base.sortie, /à renouveler ensemble : DATABASE_URL, DATABASE_URL_DIRECT/);
  sansValeur(base.sortie, MOT_DE_PASSE_BASE);
  const dernier = appels(p).filter((a) => a.argv[1] === "tester").pop();
  assert.deepStrictEqual(Object.keys(JSON.parse(dernier.stdin)).sort(), ["DATABASE_URL", "DATABASE_URL_DIRECT"], "variables nécessaires au test");

  ecrire(p, ".env", `STRIPE_SECRET_KEY=whsec_${hasard(8)}\n`);
  const prefixe = lancer(p, ["verifier", "STRIPE_SECRET_KEY", "--sans-test"]);
  assert.strictEqual(prefixe.code, 1);
  assert.match(prefixe.sortie, /ne commence par aucun préfixe attendu/);

  ecrire(p, ".env", `STRIPE_SECRET_KEY=${CLE_STRIPE}\n`);
  const sansTest = lancer(p, ["verifier", "STRIPE_SECRET_KEY"], { FAUX_TEST: "3", FAUX_TEST_MESSAGE: "⚪ pas de test réel pour cette variable" });
  assert.strictEqual(sansTest.code, 0);
  assert.match(sansTest.sortie, /⚪ pas de test réel/);
});

// ---------------------------------------------------------------- envoyer, redeployer

test("envoyer : la valeur passe par l'entrée standard de l'adaptateur, jamais en argument ni à l'écran", () => {
  const p = projet();
  ecrire(p, ".env.envoi", `DATABASE_URL="${ADRESSE_BASE}"\n`);
  const r = lancer(p, ["envoyer", "DATABASE_URL", "--depuis", ".env.envoi"], { FAUX_BAVARD: "1" });
  assert.strictEqual(r.code, 0, r.sortie);
  sansValeur(r.sortie, ADRESSE_BASE, MOT_DE_PASSE_BASE);
  assert.match(r.sortie, /«valeur masquée»/, "le faux pack bavard a été masqué");
  const envois = appels(p).filter((a) => a.argv[0] === "hebergeur");
  assert.deepStrictEqual(envois.map((a) => a.argv), [
    ["hebergeur", "envoyer", "DATABASE_URL", "production", "--type", "secret"],
    ["hebergeur", "envoyer", "DATABASE_URL", "preview", "--type", "secret"],
  ]);
  for (const a of appels(p)) assert.ok(!a.argv.join(" ").includes(MOT_DE_PASSE_BASE), "jamais en argument");
  assert.ok(envois.every((a) => a.stdin === ADRESSE_BASE), "valeur sans guillemets sur l'entrée standard");
  assert.match(r.sortie, /À envoyer aussi : DATABASE_URL_DIRECT/);
  assert.match(r.sortie, /redeployer --env production,preview/);
});

test("envoyer : une variable propre à chaque environnement ne part pas de .env vers la production", () => {
  const p = projet();
  ecrire(p, ".env", `DATABASE_URL="${ADRESSE_BASE}"\n`);
  const refus = lancer(p, ["envoyer", "DATABASE_URL"]);
  assert.strictEqual(refus.code, 1);
  assert.match(refus.sortie, /propre à chaque environnement/);
  assert.match(refus.sortie, /--fichier \.env\.envoi/);
  assert.match(refus.sortie, /--meme-valeur/);
  sansValeur(refus.sortie, ADRESSE_BASE, MOT_DE_PASSE_BASE);
  assert.deepStrictEqual(appels(p).filter((a) => a.argv[0] === "hebergeur"), [], "rien envoyé");

  const apercu = lancer(p, ["envoyer", "DATABASE_URL", "--env", "preview"]);
  assert.strictEqual(apercu.code, 0, apercu.sortie);
  const confirme = lancer(p, ["envoyer", "DATABASE_URL", "--env", "production", "--meme-valeur"]);
  assert.strictEqual(confirme.code, 0, confirme.sortie);
  assert.deepStrictEqual(appels(p).filter((a) => a.argv[0] === "hebergeur").map((a) => a.argv[3]), ["preview", "production"]);
});

test("envoyer : seule la source .env.envoi libère une variable propre à chaque environnement vers la production", () => {
  const p = projet();
  ecrire(p, ".env", `DATABASE_URL="${ADRESSE_BASE}"
`);
  ecrire(p, ".env.local", `DATABASE_URL="${ADRESSE_BASE}"
`);
  const sources = ["./.env", ".\.env", ".env.local", ".ENV", path.join(p.dossier, ".env")];
  for (const source of sources) {
    const r = lancer(p, ["envoyer", "DATABASE_URL", "--env", "production", "--depuis", source]);
    assert.strictEqual(r.code, 1, source + " : " + r.sortie);
    assert.match(r.sortie, /propre à chaque environnement/, source);
  }
  assert.deepStrictEqual(appels(p).filter((a) => a.argv[0] === "hebergeur"), [], "rien envoyé");
  const preview = lancer(p, ["envoyer", "DATABASE_URL", "--env", "preview"]);
  assert.strictEqual(preview.code, 0, preview.sortie);
  ecrire(p, ".env.envoi", `DATABASE_URL="${ADRESSE_BASE}"
`);
  const ok = lancer(p, ["envoyer", "DATABASE_URL", "--env", "production", "--depuis", "./.env.envoi"]);
  assert.strictEqual(ok.code, 0, ok.sortie);
});

test("envoyer : échec partiel → code 1 et rotation déclarée incomplète ; vide refusé ; --vider après succès", () => {
  const p = projet();
  ecrire(p, ".env", `STRIPE_SECRET_KEY=${CLE_STRIPE}\nAPP_URL=https://exemple.test\nVIDE_SECRET=\n`);
  const partiel = lancer(p, ["envoyer", "STRIPE_SECRET_KEY", "--env", "production,preview"], { FAUX_ECHEC_ENV: "preview" });
  assert.strictEqual(partiel.code, 1);
  assert.match(partiel.sortie, /✅ Production/);
  assert.match(partiel.sortie, /❌ Preview : refusé par l'hébergeur/);
  assert.match(partiel.sortie, /Envoi incomplet/);
  sansValeur(partiel.sortie, CLE_STRIPE);

  const vide = lancer(p, ["envoyer", "VIDE_SECRET"]);
  assert.strictEqual(vide.code, 1);
  assert.match(vide.sortie, /rien envoyé/);

  const config = lancer(p, ["envoyer", "APP_URL", "--env", "production"]);
  assert.strictEqual(config.code, 0, config.sortie);
  assert.deepStrictEqual(appels(p).pop().argv.slice(-2), ["--type", "config"], "réglage non secret : type Config");

  ecrire(p, ".env.envoi", `STRIPE_SECRET_KEY=${CLE_STRIPE}\n`);
  const vider = lancer(p, ["envoyer", "STRIPE_SECRET_KEY", "--env", "production", "--depuis", ".env.envoi", "--vider"]);
  assert.strictEqual(vider.code, 0, vider.sortie);
  assert.strictEqual(lire(p, ".env.envoi"), "STRIPE_SECRET_KEY=\n");
  sansValeur(vider.sortie, CLE_STRIPE);
});

test("sans pack : envoyer et redeployer s'arrêtent avec la marche à suivre", () => {
  const p = projet({ pack: false });
  ecrire(p, ".env", `STRIPE_SECRET_KEY=${CLE_STRIPE}\n`);
  const r = lancer(p, ["envoyer", "STRIPE_SECRET_KEY"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /aucun pack de pile déclaré/);
  sansValeur(r.sortie, CLE_STRIPE);
  assert.match(lancer(p, ["redeployer"]).sortie, /tableau de bord de l'hébergeur/);
});

test("redeployer : relaie vers l'adaptateur, environnement par environnement", () => {
  const p = projet();
  const r = lancer(p, ["redeployer", "--env", "production,preview"]);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.match(r.sortie, /✅ Production : https:\/\/exemple-production\.test/);
  assert.match(r.sortie, /✅ Preview : https:\/\/exemple-preview\.test/);
  assert.strictEqual(lancer(p, ["redeployer", "--env", "lune"]).code, 1);
});

// ---------------------------------------------------------------- historique

test("historique : retrouve une clé et un .env passés dans un ancien commit, sans montrer la valeur", () => {
  const p = projet({ pack: false });
  const g = (...a) => spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@exemple.test", ...a], { cwd: p.dossier, encoding: "utf8" });
  ecrire(p, "lisezmoi.md", "Projet\n");
  g("add", "lisezmoi.md", ".gitignore");
  g("commit", "-q", "-m", "départ");
  const propre = lancer(p, ["historique"]);
  assert.strictEqual(propre.code, 0, propre.sortie);
  assert.match(propre.sortie, /✅ Aucune trace/);

  ecrire(p, "src/config.js", `export const cle = "${CLE_STRIPE}";\n`);
  ecrire(p, ".env.local", `DATABASE_URL=${ADRESSE_BASE}\n`);
  g("add", "-f", "src/config.js", ".env.local");
  g("commit", "-q", "-m", "erreur");
  ecrire(p, "src/config.js", "export const cle = process.env.CLE;\n");
  g("rm", "-q", "--cached", ".env.local");
  g("add", "src/config.js");
  g("commit", "-q", "-m", "correction");

  const r = lancer(p, ["historique"]);
  assert.strictEqual(r.code, 1, r.sortie);
  assert.match(r.sortie, /src\/config\.js : clé secrète \(Stripe ou Clerk\) – retiré depuis/);
  assert.match(r.sortie, /\.env\.local : fichier d'environnement enregistré/);
  assert.match(r.sortie, /Aucun dépôt distant/);
  sansValeur(r.sortie, CLE_STRIPE, MOT_DE_PASSE_BASE);
});

// ---------------------------------------------------------------- journal

test("journal : crée docs/secrets.md depuis le modèle, ajoute la ligne datée ; l'inventaire la reprend", () => {
  const p = projet({ pack: false });
  ecrire(p, ".env.example", "STRIPE_SECRET_KEY=\n");
  const r = lancer(p, ["journal", "STRIPE_SECRET_KEY", "départ", "d'un", "prestataire", "--revoquee", "2026-10-07", "--production", "oui"]);
  assert.strictEqual(r.code, 0, r.sortie);
  const doc = lire(p, "docs/secrets.md");
  const date = /\| (\d{4}-\d{2}-\d{2}) \| `STRIPE_SECRET_KEY` \| départ d'un prestataire \| 2026-10-07 \| oui \|/.exec(doc);
  assert.ok(date, doc);
  assert.ok(!/\{\{AAAA-MM-JJ\}\} \| \{\{NOM\}\}/.test(doc), "la ligne d'exemple du modèle est remplacée");
  lancer(p, ["journal", "DATABASE_URL", "fuite"]);
  assert.match(lire(p, "docs/secrets.md"), /`STRIPE_SECRET_KEY`[^\n]*\n\| \d{4}-\d{2}-\d{2} \| `DATABASE_URL` \| fuite \| à faire \| à vérifier \|/);
  const inv = lancer(p, ["inventaire", "--sans-hebergeur"]);
  assert.match(inv.sortie, new RegExp(`\\| STRIPE_SECRET_KEY \\|.*\\| ${date[1]} \\|`));
  const refus = lancer(p, ["journal", "X", `clé ${CLE_STRIPE}`]);
  assert.strictEqual(refus.code, 1);
  sansValeur(refus.sortie + lire(p, "docs/secrets.md"), CLE_STRIPE);
});

test("action inconnue : l'aide, code 1", () => {
  const p = projet({ pack: false, git: false });
  const r = lancer(p, ["inconnue"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.sortie, /pulse-aidd secrets – les secrets du projet/);
});

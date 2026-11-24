// Tests de l'axe Hébergement du pack : consignes choisies selon docs/technical.md, adaptateur d'hébergeur d'un serveur.
// Lancer : node --test plugins/pulse-vibe-next/tests/hebergement.test.js (nécessite bash dans le PATH)
"use strict";

const test = require("node:test");
const { after } = test;
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const REF = path.join(RACINE, "references");
const OUTIL = path.join(RACINE, "bin", "pulse-pile-next");
const { repondre, A_FAIRE } = require("../scripts/hebergeur-serveur.js");

const crees = [];
after(() => {
  for (const d of crees) fs.rmSync(d, { recursive: true, force: true });
});

/** Projet dont docs/technical.md déclare l'hébergement (null : sans la ligne). */
function projet(hebergement) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-hebergement-"));
  crees.push(d);
  fs.mkdirSync(path.join(d, "docs"));
  fs.writeFileSync(path.join(d, "docs", "technical.md"), `# Technique\n\n**Pack de pile Pulse** : next\n${hebergement ? `**Hébergement** : ${hebergement}\n` : ""}`);
  fs.writeFileSync(path.join(d, "package.json"), '{ "name": "mon-site" }\n');
  return d;
}
const lancer = (dossier, args, entree = "") => spawnSync("bash", [OUTIL, ...args], { cwd: dossier, input: entree, encoding: "utf8" });
const lire = (...p) => fs.readFileSync(path.join(...p), "utf8").trim();

test("contexte : la mise en ligne suit l'hébergement de docs/technical.md ; Vercel sans la ligne", () => {
  const vercel = projet(null);
  const docker = projet("docker");
  const serveur = projet("serveur");
  for (const libelle of ["deploy", "deploy-premiere", "deploy-production", "fix-en-ligne"]) {
    assert.ok(lancer(vercel, ["contexte", libelle]).stdout.includes(lire(REF, "contexte", `${libelle}.md`)), `${libelle} : Vercel par défaut`);
    for (const d of [docker, serveur]) {
      const sortie = lancer(d, ["contexte", libelle]).stdout;
      assert.ok(sortie.includes(lire(REF, "contexte", "hors-vercel", `${libelle}.md`)), `${libelle} : consignes d'un serveur`);
      assert.ok(!sortie.includes(lire(REF, "contexte", `${libelle}.md`)), `${libelle} : sans les consignes Vercel`);
    }
  }
  assert.ok(lancer(projet("vercel"), ["contexte", "deploy"]).stdout.includes(lire(REF, "contexte", "deploy.md")), "vercel déclaré");
  assert.ok(lancer(projet("netlify"), ["contexte", "deploy"]).stdout.includes(lire(REF, "contexte", "deploy.md")), "valeur inconnue : Vercel");
});

test("contexte : variables chez Vercel ou sur le serveur, pour secrets et deploy-variables ; cicd complété par l'hébergement", () => {
  const vercel = lire(REF, "contexte", "variables-vercel.md");
  const serveur = lire(REF, "contexte", "hors-vercel", "variables.md");
  for (const libelle of ["secrets", "deploy-variables"]) {
    assert.ok(lancer(projet(null), ["contexte", libelle]).stdout.includes(vercel), `${libelle} : Vercel`);
    const sortie = lancer(projet("docker"), ["contexte", libelle]).stdout;
    assert.ok(sortie.includes(serveur) && !sortie.includes(vercel), `${libelle} : le .env du serveur, sans Vercel`);
  }
  const cicd = lire(REF, "contexte", "cicd.md");
  assert.strictEqual(lancer(projet(null), ["contexte", "cicd"]).stdout.includes("Contrôle propre"), false);
  for (const h of ["docker", "serveur"]) {
    const sortie = lancer(projet(h), ["contexte", "cicd"]).stdout;
    assert.ok(sortie.includes(cicd) && sortie.includes(lire(REF, "contexte", h, "cicd.md")), `cicd ${h}`);
  }
});

test("fiches de mise en ligne : chargées à la demande, avec les valeurs de docs/technical.md et le retour arrière", () => {
  for (const h of ["docker", "serveur"]) {
    const fiche = lire(REF, `hebergement-${h}.md`);
    for (const section of ["## Valeurs de docs/technical.md", "## Ce qu'il faut", "## Préparer le serveur (une fois)", "## Variables : le fichier .env du serveur", "## Première mise en ligne", "## Retour arrière"]) assert.ok(fiche.includes(section), `${h} : ${section}`);
    assert.ok(fiche.includes(`**Hébergement** : ${h}`), `${h} : ligne de docs/technical.md`);
    assert.ok(fiche.includes("./scripts/deployer.sh retour"), `${h} : retour arrière`);
    assert.ok(fiche.includes("pg_restore --clean --if-exists"), `${h} : restauration de la copie`);
    for (const libelle of ["tech", "deploy", "deploy-premiere", "secrets"]) assert.ok(!lancer(projet(h), ["contexte", libelle]).stdout.includes("## Préparer le serveur"), `${h} : la fiche n'est pas chargée par ${libelle}`);
  }
  const serveur = lire(REF, "hebergement-serveur.md");
  assert.match(serveur, /Le fournisseur a son proxy\*\* : Caddy est inutile/, "proxy du fournisseur : Caddy sauté");
  assert.doesNotMatch(serveur, /Infomaniak|HAProxy/i, "aucun fournisseur nommé");
  assert.match(serveur, /## Pourquoi construire sur le serveur/);
  assert.match(lire(REF, "technical.md"), /^\*\*Hébergement\*\* : vercel$/m);
});

test("hebergeur : Vercel par défaut ; sur un serveur, la marche à suivre (code 3), sans jamais rendre la valeur", () => {
  // Vercel : l'adaptateur Vercel répond (ici, projet non relié).
  const vercel = lancer(projet(null), ["hebergeur", "ls"]);
  assert.strictEqual(vercel.status, 1);
  assert.match(vercel.stdout, /vercel link/);
  const valeur = "valeur-secrete-de-test-1234";
  const docker = projet("docker");
  const ls = JSON.parse(lancer(docker, ["hebergeur", "ls"]).stdout);
  assert.deepStrictEqual(Object.keys(ls).sort(), ["hebergeur", "manuel", "variables"]);
  assert.match(ls.manuel, /fichier \.env du dossier du site, sur le serveur/);
  assert.match(ls.manuel, /openssl rand -hex 32/);
  assert.match(ls.manuel, /\.\/scripts\/deployer\.sh/);
  const envoi = lancer(docker, ["hebergeur", "envoyer", "BETTER_AUTH_SECRET", "production", "--type", "secret"], valeur);
  assert.strictEqual(envoi.status, A_FAIRE);
  assert.match(envoi.stdout, /pas d'envoi automatique.*BETTER_AUTH_SECRET=<valeur>.*\.\/scripts\/deployer\.sh/);
  assert.ok(!envoi.stdout.includes(valeur), "la valeur n'est jamais rendue");
  const apercu = lancer(docker, ["hebergeur", "envoyer", "BETTER_AUTH_SECRET", "preview"], valeur);
  assert.strictEqual(apercu.status, A_FAIRE);
  assert.match(apercu.stdout, /pas de prévisualisation/);
  const serveur = lancer(projet("serveur"), ["hebergeur", "redeployer", "production"]);
  assert.strictEqual(serveur.status, A_FAIRE);
  assert.match(serveur.stdout, /systemctl --user restart mon-site/, "nom du service : le nom du paquet");
});

test("adaptateur d'un serveur : usages refusés (code 1)", () => {
  assert.strictEqual(repondre(["docker", "envoyer", "1MAUVAIS", "production"]).code, 1);
  assert.strictEqual(repondre(["docker", "envoyer", "NOM", "lune"]).code, 1);
  assert.strictEqual(repondre(["serveur", "redeployer", "development"]).code, 1);
  assert.strictEqual(repondre(["netlify", "ls"]).code, 1);
  assert.strictEqual(repondre(["docker", "inconnue"]).code, 1);
});

test("recette fichiers : les blocs du stockage noté dans docs/technical.md ; s3 sur Vercel, dossier par défaut sur un serveur", () => {
  const avecStockage = (hebergement, stockage) => {
    const d = projet(hebergement);
    fs.appendFileSync(path.join(d, "docs", "technical.md"), `**Stockage des fichiers** : ${stockage}\n`);
    return d;
  };
  const adapter = (d) => lancer(d, ["recette", "fichiers", "etape", "6"]).stdout.includes("export class StockageS3Adapter");
  const disque = (d) => lancer(d, ["recette", "fichiers", "etape", "dossier-du-serveur"]).stdout.includes("export class StockageDisqueAdapter");
  assert.ok(adapter(projet(null)) && !disque(projet(null)), "Vercel : s3");
  assert.ok(adapter(avecStockage("vercel", "dossier")), "Vercel : s3 même si dossier est noté");
  assert.ok(!adapter(projet("serveur")) && disque(projet("serveur")), "serveur : dossier sans la ligne");
  assert.ok(adapter(avecStockage("docker", "s3")) && !disque(avecStockage("docker", "s3")), "docker avec s3");
  assert.ok(!adapter(avecStockage("serveur", "dossier")) && disque(avecStockage("serveur", "dossier")), "serveur avec dossier");
});

// Le démarrage d'un projet : l'idée d'abord, une préparation commune à /pulse:init et /pulse:nouveau, les réglages au
// moment où ils servent, l'apparence avant les outils, et la voie directe d'un pack dans /pulse:tech.
// Lancer : node --test plugins/pulse-vibe/tests/demarrage.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { jargon } = require("./jargon");

const RACINE = path.join(__dirname, "..");
const DEPOT = path.join(RACINE, "..", "..");
const lire = (...p) => fs.readFileSync(path.join(...p), "utf8");
const init = lire(RACINE, "skills", "init", "SKILL.md");
const nouveau = lire(RACINE, "skills", "nouveau", "SKILL.md");
const tech = lire(RACINE, "skills", "tech", "SKILL.md");
const preparer = lire(RACINE, "references", "preparer-projet.md");

test("préparation : l'idée, puis le niveau ; les autres réglages attendent le moment où ils servent", () => {
  assert.ok(preparer.indexOf("**L'idée.**") < preparer.indexOf("**Le niveau.**"), "l'idée avant le niveau");
  assert.doesNotMatch(preparer, /autorisations\.md|depot-distant\.md/, "ni autorisations, ni dépôt distant");
  assert.doesNotMatch(preparer, /« Normales \(Recommandé\) »/, "les explications ont une valeur par défaut, sans question");
  for (const [nom, texte] of [["init", init], ["nouveau", nouveau]]) assert.match(texte, /`pulse-aidd reference preparer-projet\.md`/, nom);
  assert.match(init, /Bienvenue ! On commence par votre idée\./);
  assert.match(lire(RACINE, "references", "depot-distant.md"), /\*\*Quand\*\* : `\/pulse:init`, une fois la pile choisie/);
});

test("nouveau prépare un dossier vide au lieu de renvoyer à init ; du code présent reste confié à init", () => {
  const prerequis = nouveau.split("### Prérequis")[1].split("## Processus")[0];
  assert.match(prerequis, /dans un dossier vide ou presque[^\n]*`pulse-aidd reference preparer-projet\.md`/);
  assert.match(prerequis, /Du code présent, ou `CLAUDE\.md` sans Pulse : proposer `\/pulse:init` et s'arrêter/);
  assert.doesNotMatch(prerequis, /`CLAUDE\.md` Pulse présent : sinon/);
});

test("nouveau : l'apparence avant les outils, dans le déroulé comme dans la liste annoncée", () => {
  const identite = nouveau.indexOf("### 6. L'identité visuelle");
  assert.ok(identite > 0 && identite < nouveau.indexOf("### 7. Les outils"), "identité à l'étape 6, outils à la 7");
  assert.ok(nouveau.indexOf("⬜ Identité") < nouveau.indexOf("⬜ Outils"), "la liste annoncée suit le même ordre");
  // Ce qui rend l'ordre possible : l'identité demande le PRD, et les outils appliquent l'identité déjà choisie.
  assert.match(lire(RACINE, "skills", "ui", "SKILL.md"), /#### Prérequis\n\n- `docs\/prd\.md` est nécessaire/);
  assert.match(tech, /si `docs\/design\.md` existe, traduire son identité/);
  assert.match(init, /à « 7\. Les outils »/, "init enchaîne jusqu'à la dernière étape");
});

test("nouveau : l'écran de validation nomme contraintes et points à confirmer, après le test de compréhension", () => {
  assert.ok(nouveau.indexOf("Présentez votre outil en une phrase") < nouveau.indexOf("Votre projet en un coup d'œil"));
  for (const ligne of ["En une phrase :", "Vos contraintes :", "Proposé par Pulse :", "À confirmer   :"]) assert.ok(nouveau.includes(ligne), ligne);
  assert.doesNotMatch(nouveau, /dossier <epic>\)/, "l'écran reste sans nom de dossier");
});

test("verifier-brief : lancé par brainstorm, prd et nouveau, autorisé d'avance, sans jamais bloquer", () => {
  for (const commande of ["brainstorm", "prd", "nouveau"]) {
    const texte = lire(RACINE, "skills", commande, "SKILL.md");
    assert.match(texte, /^allowed-tools:.*Bash\(pulse-aidd verifier-brief\)/m, commande);
    assert.match(texte, /Lancer `pulse-aidd verifier-brief` : chaque constat se dit en une phrase, avec sa conséquence/, commande);
  }
  assert.match(nouveau, /« Compléter maintenant \(Recommandé\) » \/ « Continuer, on verra plus tard »/);
});

test("tech : voie directe d'un pack, la personne garde la décision et peut demander d'autres options", () => {
  assert.match(tech, /\*\*Voie directe\*\* : un pack installé couvre les besoins/);
  assert.match(tech, /« Cette pile \(Recommandé\) » \/ « Voir d'autres options » \/ « Revoir un besoin »/);
  assert.match(tech, /« Voir d'autres options » reprend l'étape 3 avec 2 ou 3 options, vérifiées à l'étape 4/);
  assert.match(tech, /La décision appartient à la personne\.\n/);
  const piles = lire(DEPOT, "plugins", "pulse-vibe-next", "references", "contexte", "piles.md");
  assert.match(piles, /\*\*voie directe\*\*/);
  assert.match(piles, /offre Pro : le dire à la personne avant qu'elle choisisse/, "la vérification du coût reste faite avant le choix");
});

test("tech : carte d'option en mots simples ; niveau et hypothèses ; autorisations avant la saisie des clés", () => {
  const demarche = lire(RACINE, "skills", "tech", "references", "choix-techniques.md");
  const carte = demarche.split("## Présenter une option")[1].split("\n## ")[0];
  for (const champ of ["Ce que vous obtenez", "Coût à 6 mois", "Convient si", "Moins adapté si", "Risque principal", "Changer plus tard"]) assert.ok(carte.includes(champ), champ);
  assert.strictEqual(jargon(carte), null, "carte d'option sans jargon");
  assert.match(lire(RACINE, "skills", "tech", "assets", "technical.md"), /\| Changer plus tard \|/);
  assert.match(tech, /\*\*Niveau « Jamais programmé »\*\*[^\n]*« J'ai supposé … Dites-le si c'est différent\. »/);
  assert.ok(tech.indexOf("`pulse-aidd reference autorisations.md`") < tech.indexOf("Projet neuf : présenter la « Mise en place »"), "autorisations avant la mise en place");
});

test("wiki : le tutoriel rapide suit l'ordre de /pulse:nouveau", () => {
  const rapide = lire(DEPOT, "docs", "tutoriels", "rapide.html");
  assert.ok(rapide.indexOf('id="apparence"') < rapide.indexOf('id="outils"'));
  assert.match(rapide, /<span class="etape-numero">3<\/span> Choisir l'apparence/);
  assert.match(rapide, /<span class="etape-numero">4<\/span> Choisir les outils/);
});

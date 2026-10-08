// Tests du contrôle des tics d'écriture IA (scripts/textes.js).
// Lancer : node --test plugins/pulse-vibe/tests/textes.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "textes.js");
const DETECTEUR = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "references", "redaction", "detecteur-tics-llm.json"), "utf8"));
const { verifier, reglesSansDetecteur } = require(SCRIPT);

const regles = (texte) => verifier(texte).constats.map((c) => c.regle);
const fichier = (contenu) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pulse-textes-")), "texte.md");
  fs.writeFileSync(f, contenu);
  return f;
};
const lancer = (args, entree) => spawnSync("node", [SCRIPT, ...args], { encoding: "utf8", input: entree });

const PROPRE =
  "Notre atelier répare les vélos de Lausanne depuis 2009. Vous déposez le vôtre le matin, et vous le récupérez le soir. " +
  "Parce que les pièces sont en stock, la plupart des réparations prennent moins d'une heure. Le prix est affiché avant le début du travail. Rien ne change ensuite.\n";

test("chaque règle active a un détecteur ou figure dans « à relire »", () => {
  assert.deepStrictEqual(reglesSansDetecteur(DETECTEUR), []);
});

test("un texte propre passe : aucun constat, code 0", () => {
  assert.deepStrictEqual(verifier(PROPRE).constats, []);
  const r = lancer(["verifier", fichier(PROPRE)]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /CONTRÔLE RÉUSSI/);
});

test("les exemples « avant » du lexique sont signalés, en erreur, code 1", () => {
  for (const id of ["LEX-001", "LEX-002", "LEX-005", "LEX-007"]) {
    const regle = DETECTEUR.regles.find((x) => x.id === id);
    assert.ok(regles(regle.exemples.avant).includes(id), id);
  }
  const r = lancer(["verifier", fichier("Ce projet est fondamentalement crucial.\n")]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /LEX-001/);
});

test("formes conjuguées et accords : « permet de », « leviers » ; pas de faux positif dans un mot plus long", () => {
  assert.ok(regles("Cette approche permet de gagner du temps.").includes("LEX-002"));
  assert.ok(regles("Nous avons trois leviers.").includes("LEX-003"));
  assert.ok(!regles("Il faut revitaliser le quartier.").includes("LEX-001"));
});

test("« ainsi (début de phrase) » : signalé en tête de phrase seulement", () => {
  assert.ok(regles("Ainsi, le projet avance.").includes("LEX-005"));
  assert.ok(!regles("Le projet avance ainsi.").includes("LEX-005"));
});

test("ponctuation : virgule d'Oxford et tiret cadratin (sauf réplique de dialogue)", () => {
  assert.ok(regles("Le projet mobilise des associations, des entreprises, des collectivités, et des citoyens.").includes("PON-001"));
  assert.ok(regles("Ce projet — ambitieux — avance.").includes("PON-002"));
  assert.ok(!regles("— Bonjour, dit-elle.").includes("PON-002"));
});

test("typographie : titre en title case, émoji, majuscule après deux-points (avertissement)", () => {
  assert.ok(regles("# Les Enjeux Du Numérique Dans Le Secteur\n\nTexte.").includes("TYP-001"));
  assert.ok(regles("🚀 Une approche qui marche.").includes("TYP-002"));
  const c = verifier("Contact : Marie Dupont répond le lundi.").constats.find((x) => x.regle === "TYP-004");
  assert.strictEqual(c && c.severite, "avertissement");
});

test("participe présent détaché : avertissement seulement", () => {
  const r = verifier("L'association développe ses activités, répondant ainsi aux besoins du territoire.");
  const c = r.constats.find((x) => x.regle === "SYN-001");
  assert.strictEqual(c && c.severite, "avertissement");
});

test("règle de trois au-delà d'une, anaphores en série", () => {
  assert.ok(regles("Cette démarche est inclusive, innovante et utile. Elle mobilise les acteurs, fédère les énergies et crée de la valeur.").includes("LIM-001"));
  assert.ok(regles("C'est un choix. C'est un engagement. C'est une responsabilité.").includes("LIM-002"));
});

test("un fichier au modèle texte-page n'est contrôlé qu'entre <!-- texte --> et <!-- /texte -->", () => {
  const contenu = "# Accueil\n\n- Objectif : un levier crucial\n\n<!-- texte -->\n" + PROPRE + "<!-- /texte -->\n\n## Mesures\n";
  assert.deepStrictEqual(verifier(contenu).constats, []);
});

test("le numéro de ligne suit le fichier", () => {
  const c = verifier("Titre\n\nUne phrase.\nUn projet crucial.\n").constats.find((x) => x.regle === "LEX-001");
  assert.strictEqual(c.ligne, 4);
});

test("sortie JSON, entrée standard, règles à relire, fichier illisible", () => {
  const r = lancer(["verifier", "-", "--json"], "Un projet crucial.\n");
  assert.strictEqual(r.status, 1);
  const j = JSON.parse(r.stdout);
  assert.ok(j.erreurs >= 1);
  assert.ok(j.mesures.mots > 0);
  assert.deepStrictEqual(j.aRelire.map((x) => x.regle).sort(), ["BIA-003", "INJ-003", "LIM-003", "PAT-004", "SYN-004"]);
  assert.match(lancer(["verifier", fichier(PROPRE)]).stdout, /À relire/);
  assert.strictEqual(lancer(["verifier", path.join(os.tmpdir(), "absent-pulse.md")]).status, 2);
  assert.strictEqual(lancer([]).status, 2);
});

test("texte vide ou fait de titres : aucune exception, mesures à zéro", () => {
  const r = verifier("# Titre\n\n## Autre titre\n");
  assert.strictEqual(r.erreurs, 0);
  assert.strictEqual(r.mesures.phrases, 0);
});

test("« de plus près » n'est pas la transition « de plus »", () => {
  assert.ok(!regles("Regardons ça de plus près.").includes("LEX-005"));
  assert.ok(regles("De plus, le prix baisse.").includes("LEX-005"));
});

test("structures : des mots peuvent s'intercaler (« mais elle permet également »)", () => {
  const regle = DETECTEUR.regles.find((x) => x.id === "SYN-002");
  assert.ok(regles(regle.exemples.avant).includes("SYN-002"));
});

test("queue de phrase après un chiffre (« en 2024, illustrant ainsi »)", () => {
  const regle = DETECTEUR.regles.find((x) => x.id === "PAT-001");
  assert.ok(regles(regle.exemples.avant).includes("PAT-001"));
});

// --- Correctifs de la revue finale ---

test("revue 1 : un nom bâti sur le même radical qu'un verbe creux n'est pas signalé", () => {
  for (const phrase of ["Garantie deux ans.", "Notre représentant vous répond.", "Participation à l'atelier.", "Les participants à la sortie.", "Une contribution à la cagnotte.", "La constitution du dossier.", "Votre assurance couvre le vol."])
    assert.ok(!regles(phrase).includes("LEX-002"), phrase);
  for (const phrase of ["Cela permet de gagner du temps.", "Ils permettent de partir tôt.", "Ce choix constitue un pari.", "Nous garantissons le prix.", "Il s'avère utile.", "Le pari s'est avéré payant."])
    assert.ok(regles(phrase).includes("LEX-002"), phrase);
});

test("revue 2 : PON-001 en erreur seulement pour une vraie énumération (trois éléments avant « et »)", () => {
  for (const phrase of ["Marie, notre gérante, et Paul vous accueillent.", "Le matin, nous ouvrons à 8 h, et le soir nous fermons tard."]) {
    const c = verifier(phrase).constats.filter((x) => x.regle === "PON-001");
    assert.ok(c.every((x) => x.severite === "avertissement"), phrase);
  }
  const c = verifier("Le projet mobilise des associations, des entreprises, des collectivités, et des citoyens.").constats.find((x) => x.regle === "PON-001");
  assert.strictEqual(c && c.severite, "erreur");
});

test("revue 2 : titre avec des noms propres en avertissement, title case en erreur", () => {
  for (const titre of ["Nos ateliers à Lausanne et Genève", "Rencontrez Marie Dupont"]) {
    const c = verifier(`# ${titre}\n\nTexte.`).constats.filter((x) => x.regle === "TYP-001");
    assert.ok(c.every((x) => x.severite === "avertissement"), titre);
  }
  const c = verifier("# Les Enjeux Du Numérique Dans Le Secteur\n\nTexte.").constats.find((x) => x.regle === "TYP-001");
  assert.strictEqual(c && c.severite, "erreur");
});

test("revue 2 : « de plus » ordinaire (rien de plus simple, une fois de plus) n'est pas une transition", () => {
  for (const phrase of ["Rien de plus simple.", "Une fois de plus, nous ouvrons.", "Un jour de plus."]) assert.ok(!regles(phrase).includes("LEX-005"), phrase);
  assert.ok(regles("De plus, le prix baisse.").includes("LEX-005"));
});

test("revue 2 : une erreur gardée avec sa raison ne bloque plus le contrôle et reste visible", () => {
  const r = verifier("Naviguez dans le catalogue. <!-- garder LEX-007 : sens littéral, menu du site -->\n");
  assert.strictEqual(r.erreurs, 0);
  assert.deepStrictEqual(r.gardes.map((g) => [g.regle, g.raison]), [["LEX-007", "sens littéral, menu du site"]]);
});

test("revue 3 : apostrophe typographique et élisions", () => {
  assert.ok(regles("Il s’avère utile.").includes("LEX-002"));
  assert.ok(regles("À l’ère du numérique, tout change.").includes("PAT-002"));
  assert.ok(regles("Ce n’est pas une réparation, c’est une promesse.").includes("SYN-003"));
  assert.ok(regles("Cela permet d'économiser.").includes("LEX-002"));
  assert.ok(regles("C'est l'essentiel.").includes("LEX-001"));
  assert.ok(!regles("Aujourd'hui, nous ouvrons.").includes("LEX-001"));
});

test("revue 4 : féminins en -elle et -rice", () => {
  assert.ok(regles("Une étape essentielle.").includes("LEX-001"));
  assert.ok(regles("Une démarche transformatrice.").includes("LEX-001"));
  assert.ok(regles("Une équipe fédératrice.").includes("LEX-004"));
});

test("revue 5 : chaque bloc <!-- texte --> est contrôlé, l'en-tête jamais", () => {
  const contenu = "# Page\n\n- Objectif : crucial\n\n<!-- texte -->\nUn premier bloc.\n<!-- /texte -->\n\n<!-- texte -->\nUn levier crucial.\n<!-- /texte -->\n";
  const c = verifier(contenu).constats.filter((x) => x.regle === "LEX-001");
  assert.deepStrictEqual(c.map((x) => x.ligne), [10]);
});

test("revue : © ® ™ ne sont pas des émojis", () => {
  assert.ok(!regles("© 2026 Atelier Vélo. Marque déposée®, produit™.").includes("TYP-002"));
});

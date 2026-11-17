// Tests du générateur d'entité (scripts/entite.js, scripts/entite-modeles.js) et de sa vérification (scripts/verifier-entite.js) :
// validation de la description, noms dérivés, accords, refus de remplacer un fichier, --essai, gestes suivants.
// Le code généré lui-même se vérifie dans un vrai projet : node plugins/pulse-vibe-next/scripts/verifier-entite.js
// Lancer : node --test plugins/pulse-vibe-next/tests/entite.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const { validerDescription, lireArguments, planifier, prerequisManquants, composantsNecessaires, gestesSuivants, principal, Grammaire, pascal, snake, kebab, constante, camel } = require("../scripts/entite.js");
const { genererFichiers, chemins } = require("../scripts/entite-modeles.js");
const verifierEntite = require("../scripts/verifier-entite.js");

const FACTURES = () => JSON.parse(JSON.stringify(verifierEntite.EXEMPLES[0].description));
const ARTICLES = () => JSON.parse(JSON.stringify(verifierEntite.EXEMPLES[1].description));
const erreursDe = (description) => validerDescription(description).erreurs;

/** Un projet minimal qui a les prérequis du générateur (squelette et recette connexion, réduits à ce qu'il lit). */
function projet(fichiers = {}) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-entite-"));
  const base = {
    "package.json": '{ "dependencies": { "next": "16.4.4" } }\n',
    "src/lib/safe-action.ts": "export const actionConnectee = 1;\n",
    "src/features/compte/queries/utilisateur-connecte.query.ts": "export const utilisateurConnecte = 1;\n",
    "src/db/compte/auth.table.ts": "export const user = 1;\n",
    "e2e/aides/connexion.ts": "export async function connecterNouvelUtilisateur() {}\n",
    "proxy.ts": 'export const config = {\n  matcher: ["/compte/:path*"],\n};\n',
    ...fichiers,
  };
  for (const [f, contenu] of Object.entries(base)) {
    fs.mkdirSync(path.dirname(path.join(dossier, f)), { recursive: true });
    fs.writeFileSync(path.join(dossier, f), contenu);
  }
  return dossier;
}

function ecrireDescription(dossier, description) {
  const f = path.join(dossier, "facture.entite.json");
  fs.writeFileSync(f, JSON.stringify(description));
  return f;
}

function lancer(argv) {
  const sortie = [];
  const code = principal(argv, (t) => sortie.push(t));
  return { code, texte: sortie.join("\n") };
}

test("description : les deux exemples de la vérification sont valides, avec les valeurs par défaut", () => {
  const { entite, erreurs } = validerDescription(FACTURES());
  assert.deepStrictEqual(erreurs, []);
  const champ = (nom) => entite.champs.find((c) => c.nom === nom);
  assert.strictEqual(champ("notes").obligatoire, false);
  assert.strictEqual(champ("statut").obligatoire, true);
  assert.strictEqual(champ("payee").defaut, false);
  assert.strictEqual(validerDescription(ARTICLES()).entite.champs[0].max, 200, "texte : 200 caractères par défaut");
  const sansDefaut = FACTURES();
  delete sansDefaut.champs[5].defaut;
  assert.strictEqual(validerDescription(sansDefaut).entite.champs[5].defaut, "brouillon", "choix : la première valeur par défaut");
});

test("description : noms dérivés (classe, constantes, colonnes, montant en centimes)", () => {
  const { entite } = validerDescription(FACTURES());
  assert.deepStrictEqual(entite.n, { Sujet: "Facture", sujetCamel: "facture", SUJET: "FACTURE", Pluriel: "Factures", plurielCamel: "factures", PLURIEL: "FACTURES", table: "factures", dossierRoute: "app/(connecte)/factures" });
  const montant = entite.champs.find((c) => c.nom === "montant");
  assert.strictEqual(montant.cle, "montantCentimes");
  assert.strictEqual(montant.colonneBase, "montant_centimes");
  const statut = entite.champs.find((c) => c.nom === "statut");
  assert.strictEqual(statut.constanteValeurs, "VALEURS_STATUT_FACTURE");
  assert.strictEqual(statut.typeValeur, "StatutFacture");
  assert.strictEqual(statut.nomEnumPg, "statut_facture");
  assert.deepStrictEqual([pascal("ligne-facture"), camel("ligne-facture"), snake("dateEcheance"), kebab("dateEcheance"), constante("dateEcheance")], ["LigneFacture", "ligneFacture", "date_echeance", "date-echeance", "DATE_ECHEANCE"]);
});

test("description : chaque problème est nommé, en français", () => {
  const cas = [
    [(d) => (d.couleur = "bleu"), /Clé inconnue : « couleur »/],
    [(d) => delete d.feminin, /« feminin » manque/],
    [(d) => (d.sujet = "Facture"), /« sujet » : « Facture » ne convient pas/],
    [(d) => (d.libelle = "Facture"), /« libelle » : en minuscules/],
    [(d) => (d.pluriel = d.sujet), /« pluriel » doit différer/],
    [(d) => (d.sujet = "date"), /classe Date, un nom déjà pris/],
    [(d) => (d.route = "/api/factures"), /\/api est réservé/],
    [(d) => (d.titre = "notes"), /doit être un champ « texte » obligatoire/],
    [(d) => (d.champs[0].max = 10), /20 caractères au moins/],
    [(d) => (d.champs[1].type = "couleur"), /« type » doit valoir texte, texte-long/],
    [(d) => (d.champs[1].nom = "page"), /« page » est déjà pris/],
    [(d) => (d.champs[1].nom = "client"), /le nom « client » est déjà utilisé/],
    [(d) => (d.champs[1].nom = "date échéance"), /« nom » en camelCase/],
    [(d) => (d.champs[2].valeurs = {}), /clé « valeurs » inconnue pour le type nombre/],
    [(d) => (d.champs[2].min = 10001), /« min » dépasse « max »/],
    [(d) => (d.champs[3].min = 1.555), /2 décimales au plus/],
    [(d) => (d.champs[5].valeurs = { brouillon: "Brouillon" }), /au moins deux choix/],
    [(d) => (d.champs[5].valeurs = { tous: "Tous", autre: "Autre" }), /la valeur « tous » est réservée/],
    [(d) => (d.champs[5].defaut = "payee"), /« defaut » doit être l'une des valeurs/],
    [(d) => (d.champs[6].libelle = "Payée {oui}"), /« libelle » est le texte affiché/],
    [(d) => d.champs.push({ nom: "montantCentimes", libelle: "Autre", type: "nombre" }), /s'enregistre sous « montantCentimes »/],
  ];
  for (const [changer, attendu] of cas) {
    const d = FACTURES();
    changer(d);
    const erreurs = erreursDe(d);
    assert.ok(erreurs.some((e) => attendu.test(e)), `${attendu} absent de : ${erreurs.join(" | ")}`);
  }
  assert.match(erreursDe([])[0], /un objet JSON/);
});

test("accords : genre et élision dans les messages", () => {
  const facture = new Grammaire({ libelle: "facture", feminin: true });
  const client = new Grammaire({ libelle: "client", feminin: false });
  const article = new Grammaire({ libelle: "article", feminin: false });
  assert.deepStrictEqual([facture.le(), facture.ce(), facture.de(), facture.du(), facture.nouveau(), facture.accord("créé")], ["la facture", "cette facture", "de facture", "de la facture", "Nouvelle facture", "créée"]);
  assert.deepStrictEqual([client.le(), client.ce(), client.de(), client.du(), client.nouveau(), client.accord("créé")], ["le client", "ce client", "de client", "du client", "Nouveau client", "créé"]);
  assert.deepStrictEqual([article.le(), article.ce(), article.de(), article.du(), article.nouveau()], ["l'article", "cet article", "d'article", "de l'article", "Nouvel article"]);
  assert.strictEqual(new Grammaire({ libelle: "héros", feminin: false, elision: false }).le(), "le héros", "elision: false force l'article plein");
});

test("fichiers générés : emplacements de l'architecture, chemins uniques, aides communes signalées", () => {
  const { entite } = validerDescription(FACTURES());
  const fichiers = genererFichiers(entite, { us: "US-003" });
  const liste = fichiers.map((f) => f.chemin);
  assert.strictEqual(new Set(liste).size, liste.length, "chemins uniques");
  for (const attendu of ["src/core/factures/facture.entity.ts", "src/db/factures/facture.repository.ts", "src/features/factures/actions/supprimer-facture.action.ts", "app/(connecte)/factures/[id]/page.tsx", "app/(connecte)/factures/[id]/error.tsx", "e2e/factures.spec.ts"]) assert.ok(liste.includes(attendu), attendu);
  assert.ok(liste.filter((f) => /^src\/(core|db|features)\/factures\//.test(f)).every((f) => !fichiers.find((x) => x.chemin === f).commun), "les fichiers de l'entité ne sont jamais communs");
  assert.deepStrictEqual(fichiers.filter((f) => f.commun).map((f) => f.chemin.split("/").slice(0, 4).join("/")).filter((v, i, t) => t.indexOf(v) === i), ["src/lib/helpers/pagination", "src/lib/helpers/format", "src/lib/helpers/formulaire", "src/lib/helpers/saisie"]);
  assert.ok(!validerDescription(ARTICLES()).entite.champs.some((c) => c.type === "nombre") && !genererFichiers(validerDescription(ARTICLES()).entite).some((f) => f.chemin.endsWith("format/nombre.ts")), "nombre.ts seulement avec un champ nombre");
});

test("code généré : propriété dans chaque requête, identité de la session, étiquette d'US des tests", () => {
  const { entite } = validerDescription(FACTURES());
  const fichiers = genererFichiers(entite, { us: "US-003" });
  const contenu = (cle) => fichiers.find((f) => f.chemin === chemins(entite)[cle]).contenu;
  const repository = contenu("repository");
  assert.match(repository, /^import "server-only";/m);
  assert.match(repository, /eq\(factures\.utilisateurId, utilisateurId\)/);
  for (const methode of ["trouver", "modifier", "supprimer"]) assert.match(repository.split(`async ${methode}(`)[1].split("\n  }")[0], /this\.proprietaire\(id, utilisateurId\)/, methode);
  for (const action of ["creer", "modifier", "supprimer"]) {
    assert.match(contenu(action), /^"use server";/m, action);
    assert.match(contenu(action), /actionConnectee\s*\n\s*\.metadata\(\{ nom: "\w+Facture" \}\)/, action);
    assert.match(contenu(action), /ctx\.utilisateur\.id/, action);
  }
  assert.match(contenu("schema"), /revalidateLogic|z\.object/);
  assert.match(contenu("formulaire"), /revalidateLogic\(\{ mode: "blur", modeAfterSubmission: "change" \}\)/);
  assert.match(contenu("formulaire"), /onSubmitInvalid/);
  assert.match(contenu("suppression"), /Supprimer la facture « \{titre\} » \?/);
  assert.match(contenu("suppression"), /"Supprimer la facture"/);
  assert.match(contenu("testRepository"), /"US-003 – Léo ne modifie pas la facture de Camille"/);
  assert.match(contenu("testRepository"), /@securite/);
  assert.match(contenu("e2e"), /"US-003 – créer, modifier puis supprimer une facture"/);
  const neutre = genererFichiers(entite).find((f) => f.chemin === "e2e/factures.spec.ts").contenu;
  assert.match(neutre, /test\("créer, modifier puis supprimer une facture"/, "sans --us : titre neutre");
});

test("planifier : un fichier absent s'écrit, un fichier présent est un conflit, une aide commune complète est gardée", () => {
  const dossier = projet({
    "src/core/factures/facture.entity.ts": "// déjà là\n",
    "src/lib/helpers/pagination/pagination.ts": "export function pageValide() {}\nexport function decalagePourPage() {}\nexport function nombreDePages() {}\n",
    "src/lib/helpers/format/format.ts": "export function formaterMontant() {}\n",
  });
  const fichiers = genererFichiers(validerDescription(FACTURES()).entite);
  const { aEcrire, gardes, conflits } = planifier(fichiers, dossier);
  assert.deepStrictEqual(gardes.map((f) => f.chemin), ["src/lib/helpers/pagination/pagination.ts"]);
  assert.deepStrictEqual(conflits.map((f) => [f.chemin, f.raison]), [
    ["src/core/factures/facture.entity.ts", "déjà présent"],
    ["src/lib/helpers/format/format.ts", "aide commune déjà présente, sans formaterDate"],
  ]);
  assert.strictEqual(aEcrire.length + gardes.length + conflits.length, fichiers.length);
});

test("--essai : la liste des fichiers, rien d'écrit", () => {
  const dossier = projet();
  const { code, texte } = lancer([ecrireDescription(dossier, FACTURES()), "--essai", "--dossier", dossier]);
  assert.strictEqual(code, 0, texte);
  assert.match(texte, /essai, rien n'est écrit : 40 fichier\(s\) à écrire/);
  assert.match(texte, /\+ src\/core\/factures\/facture\.entity\.ts/);
  assert.ok(!fs.existsSync(path.join(dossier, "src", "core", "factures")));
});

test("écriture, puis refus de remplacer : la relance liste les conflits et n'écrit rien (code 1)", () => {
  const dossier = projet();
  const description = ecrireDescription(dossier, ARTICLES());
  const premier = lancer([description, "--dossier", dossier]);
  assert.strictEqual(premier.code, 0, premier.texte);
  assert.match(premier.texte, /38 fichier\(s\) écrit\(s\)/, "30 fichiers de l'entité et 8 aides communes");
  assert.match(premier.texte, /Biome n'est pas installé dans le projet/);
  assert.match(premier.texte, /Gestes suivants :[\s\S]*npx shadcn@latest add native-select table alert-dialog empty/);
  assert.match(premier.texte, /npm run db:generate[\s\S]*npm run db:migrate/);
  assert.match(premier.texte, /Ajoutez "\/articles\/:path\*" au matcher de proxy\.ts/);
  const entite = path.join(dossier, "src", "core", "stock", "article.entity.ts");
  fs.writeFileSync(entite, "// adapté à la main\n");
  const relance = lancer([description, "--dossier", dossier]);
  assert.strictEqual(relance.code, 1);
  assert.match(relance.texte, /rien n'est écrit, 30 fichier\(s\) existent déjà/);
  assert.strictEqual(fs.readFileSync(entite, "utf8"), "// adapté à la main\n", "le fichier adapté reste tel quel");
});

test("prérequis, description illisible ou invalide : message clair et code 1, rien d'écrit", () => {
  const vide = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-entite-vide-"));
  const sansConnexion = lancer([ecrireDescription(vide, FACTURES()), "--dossier", vide]);
  assert.strictEqual(sansConnexion.code, 1);
  assert.match(sansConnexion.texte, /src\/lib\/safe-action\.ts : la recette connexion/);
  const dossier = projet();
  fs.writeFileSync(path.join(dossier, "illisible.json"), "{ pas du json");
  assert.match(lancer(["illisible.json", "--dossier", dossier]).texte, /n'est pas un JSON lisible/);
  const invalide = FACTURES();
  invalide.champs[0].type = "texte-riche";
  const r = lancer([ecrireDescription(dossier, invalide), "--dossier", dossier]);
  assert.strictEqual(r.code, 1);
  assert.match(r.texte, /Description à corriger[\s\S]*« type » doit valoir/);
  assert.match(lancer(["absente.json", "--dossier", dossier]).texte, /Description introuvable/);
  assert.ok(!fs.existsSync(path.join(dossier, "src", "core")));
});

test("arguments : options connues, étiquette d'US contrôlée", () => {
  assert.deepStrictEqual(lireArguments(["d.json", "--essai", "--us", "US-012"]), { description: "d.json", essai: true, us: "US-012", dossier: process.cwd(), aide: false });
  assert.throws(() => lireArguments(["d.json", "--us", "3"]), /n'est pas une étiquette d'US/);
  assert.throws(() => lireArguments(["d.json", "--vite"]), /Option inconnue/);
  assert.throws(() => lireArguments(["a.json", "b.json"]), /Un seul fichier/);
  assert.strictEqual(lancer([]).code, 1);
  assert.strictEqual(lancer(["--aide"]).code, 0);
});

test("gestes suivants : composants qui manquent seulement, proxy.ts déjà à jour ou version langues", () => {
  const { entite } = validerDescription(FACTURES());
  assert.deepStrictEqual(composantsNecessaires(entite), ["native-select", "table", "alert-dialog", "empty", "badge", "checkbox", "textarea"]);
  const ui = Object.fromEntries(composantsNecessaires(entite).map((c) => [`src/components/ui/${c}.tsx`, "x"]));
  const complet = projet({ ...ui, "proxy.ts": 'matcher: ["/compte/:path*", "/factures/:path*"]\n' });
  const gestes = gestesSuivants(entite, complet).join("\n");
  assert.doesNotMatch(gestes, /shadcn|proxy\.ts/);
  const langues = projet({ "proxy.ts": 'const PAGES_CONNECTEES = ["/compte"];\n' });
  assert.match(gestesSuivants(entite, langues).join("\n"), /Ajoutez "\/factures" à PAGES_CONNECTEES/);
  assert.deepStrictEqual(prerequisManquants(complet), []);
});

test("verifier-entite : options, ajout au renvoi de proxy.ts", () => {
  assert.deepStrictEqual(verifierEntite.lireArguments(["--e2e", "--garder"]), { e2e: true, garder: true });
  assert.throws(() => verifierEntite.lireArguments(["--toutes"]), /Option inconnue/);
  const dossier = projet();
  verifierEntite.ajouterAuProxy(dossier, ["/factures", "/articles", "/compte"]);
  assert.match(fs.readFileSync(path.join(dossier, "proxy.ts"), "utf8"), /matcher: \["\/compte\/:path\*", "\/factures\/:path\*", "\/articles\/:path\*"\]/);
});

test("pulse-pile-next entite relaie vers le générateur", () => {
  const r = spawnSync("bash", ["bin/pulse-pile-next", "entite", "--aide"], { cwd: RACINE, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /pulse-aidd pile entite <description\.json> \[--essai\]/);
});

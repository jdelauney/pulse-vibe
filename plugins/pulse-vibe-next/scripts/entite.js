#!/usr/bin/env node
// Pulse Next.js – générateur d'un type d'information complet (`pulse-aidd pile entite`, pendant la réalisation).
//
//   pulse-aidd pile entite <description.json> [--essai] [--us <US-XXX>] [--dossier <projet>]
//
//   --essai     affiche les fichiers qui seraient écrits (et les conflits), sans rien écrire
//   --us        étiquette d'US placée en tête du titre de chaque test propre à l'entité (« US-003 – … ») ;
//               sans elle, des titres neutres
//   --dossier   le projet (par défaut : le dossier courant)
//
// Écrit tout le code d'un type d'information (liste filtrée, triée et paginée ; création, modification,
// suppression ; tests) d'après sa description JSON, rédigée depuis les « Informations manipulées » de la spec.
// Format de la description : references/entite.md (`pulse-aidd pile reference entite.md`).
// Le code reprend celui de la recette `liste`, généralisé. Prérequis : le squelette et la recette `connexion`.
// Ne remplace aucun fichier : un fichier déjà présent est un conflit (liste affichée, code 1, rien n'est écrit).
// Seules exceptions : les aides communes à plusieurs entités (src/lib/helpers/…), gardées telles quelles quand
// elles exportent déjà ce dont l'entité a besoin. Après l'écriture : mise en forme par le Biome du projet
// (biome check --write sur les fichiers écrits), puis la liste des gestes suivants (composants shadcn,
// migration, proxy.ts, vérifications).
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const TYPES = ["texte", "texte-long", "nombre", "montant", "date", "choix", "oui-non"];
const CLES_ENTITE = ["domaine", "sujet", "pluriel", "libelle", "libellePluriel", "feminin", "elision", "route", "titre", "champs"];
const CLES_COMMUNES = ["nom", "libelle", "type"];
const CLES_PAR_TYPE = {
  texte: ["obligatoire", "max"],
  "texte-long": ["obligatoire", "max"],
  nombre: ["obligatoire", "min", "max"],
  montant: ["obligatoire", "min", "max"],
  date: ["obligatoire"],
  choix: ["valeurs", "defaut"],
  "oui-non": ["defaut"],
};
const MAX_PAR_DEFAUT = { texte: 200, "texte-long": 5000 };
// Noms de champ déjà pris : colonnes ajoutées d'office, paramètres de l'adresse de la liste.
const NOMS_RESERVES = new Set(["id", "utilisateurId", "creeLe", "recherche", "tri", "page"]);
// Le nom de la classe de l'entité (sujet en PascalCase) ne doit pas masquer un nom global de JavaScript ou de TypeScript.
const CLASSES_RESERVEES = new Set(["Array", "Blob", "Boolean", "Date", "Document", "Element", "Error", "Event", "File", "Function", "Headers", "Image", "Intl", "Json", "Map", "Math", "Node", "Number", "Object", "Omit", "Option", "Partial", "Promise", "Readonly", "Record", "Reflect", "Request", "Response", "Set", "String", "Symbol", "Text", "Url", "Window"]);
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const CAMEL = /^[a-z][a-zA-Z0-9]*$/;
const VALEUR_CHOIX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ROUTE = /^(\/[a-z0-9]+(-[a-z0-9]+)*)+$/;
// Un libellé s'écrit tel quel dans le code (texte JSX, chaîne) : ni accolade, ni chevron, ni accent grave, ni barre oblique inverse.
const LIBELLE = /^[^{}<>`\\"\n\r\t]+$/;
const MONTANT_MAX = 9999999.99; // 7 chiffres avant la virgule : le format de saisie des montants
const ENTIER_MAX = 999999999; // 9 chiffres : tient dans une colonne integer

const pascal = (kebabOuCamel) => kebabOuCamel.split("-").map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join("");
const camel = (kebab) => { const p = pascal(kebab); return p.charAt(0).toLowerCase() + p.slice(1); };
const morceaux = (camelOuKebab) => camelOuKebab.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase().split("-");
const snake = (nom) => morceaux(nom).join("_");
const kebab = (nom) => morceaux(nom).join("-");
const constante = (nom) => morceaux(nom).join("_").toUpperCase();
const majuscule = (texte) => texte.charAt(0).toLocaleUpperCase("fr-FR") + texte.slice(1);
const minuscule = (texte) => texte.charAt(0).toLocaleLowerCase("fr-FR") + texte.slice(1);

/** Nombre écrit à la française, espaces ordinaires (« 9 999 », « 120,50 ») : il va dans des messages et des titres de tests. */
function enFrancais(n, decimales = 0) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n).replace(/[\s  ]/g, " ");
}

/** Accords de la langue pour un libellé (genre, élision devant une voyelle ou un h muet). */
class Grammaire {
  constructor({ libelle, libellePluriel, feminin, elision }) {
    this.l = libelle;
    this.lp = libellePluriel;
    this.feminin = feminin;
    this.elide = typeof elision === "boolean" ? elision : /^[aeiouyhàâäéèêëîïôöûüœ]/i.test(libelle);
  }
  /** « la facture », « le client », « l'article » */
  le() { return this.elide ? `l'${this.l}` : `${this.feminin ? "la" : "le"} ${this.l}`; }
  /** « cette facture », « ce client », « cet article » */
  ce() { return this.feminin ? `cette ${this.l}` : `${this.elide ? "cet" : "ce"} ${this.l}`; }
  /** « de facture », « d'article » (« pas encore de facture ») */
  de() { return this.elide ? `d'${this.l}` : `de ${this.l}`; }
  /** « de la facture », « du client », « de l'article » */
  du() { return this.elide ? `de l'${this.l}` : `${this.feminin ? "de la" : "du"} ${this.l}`; }
  /** « une facture », « un client » */
  un() { return `${this.feminin ? "une" : "un"} ${this.l}`; }
  /** « Aucune facture », « Aucun client » */
  aucun() { return `${this.feminin ? "Aucune" : "Aucun"} ${this.l}`; }
  /** « Nouvelle facture », « Nouveau client », « Nouvel article » */
  nouveau() { return `${this.feminin ? "Nouvelle" : this.elide ? "Nouvel" : "Nouveau"} ${this.l}`; }
  /** « la première », « le premier » */
  premier() { return this.feminin ? "la première" : "le premier"; }
  /** « créée », « créé » */
  accord(participe) { return `${participe}${this.feminin ? "e" : ""}`; }
  /** « anciennes », « anciens » */
  anciens() { return this.feminin ? "anciennes" : "anciens"; }
}

/** Valeur d'exemple valide d'un champ, pour les tests : { saisie (le champ du formulaire), base (la valeur enregistrée) }. */
function exempleDuChamp(c, estTitre) {
  const borne = (v) => Math.min(Math.max(v, c.min ?? -Infinity), c.max ?? Infinity);
  if (c.type === "texte") {
    const t = (estTitre ? "Atelier Dupont" : `${c.libelle} d'essai`).slice(0, c.max);
    return { saisie: t, base: t };
  }
  if (c.type === "texte-long") {
    const t = "Une note d'essai.".slice(0, c.max);
    return { saisie: t, base: t };
  }
  if (c.type === "nombre") {
    const n = borne(12);
    return { saisie: String(n), base: n };
  }
  if (c.type === "montant") {
    const euros = borne(120.5);
    const centimes = Math.round(euros * 100);
    return { saisie: `${Math.trunc(centimes / 100)},${String(centimes % 100).padStart(2, "0")}`, base: centimes };
  }
  if (c.type === "date") return { saisie: "2026-03-10", base: "2026-03-10T12:00:00.000Z" };
  if (c.type === "choix") return { saisie: c.defaut, base: c.defaut };
  return { saisie: !c.defaut, base: !c.defaut };
}

/** Complète un champ validé de ses noms dérivés (colonne, constante, type, clé de la vue). */
function enrichirChamp(c, sujet) {
  const Sujet = pascal(sujet);
  const SUJET = constante(sujet);
  const champ = {
    ...c,
    Nom: pascal(c.nom),
    colonne: snake(c.nom),
    // La valeur enregistrée d'un montant est en centimes : la clé le dit (montant → montantCentimes, colonne montant_centimes).
    cle: c.type === "montant" ? `${c.nom}Centimes` : c.nom,
    colonneBase: c.type === "montant" ? `${snake(c.nom)}_centimes` : snake(c.nom),
    nullable: ["texte", "texte-long", "nombre", "montant", "date"].includes(c.type) && !c.obligatoire,
    triable: ["nombre", "montant", "date"].includes(c.type),
    kebab: kebab(c.nom),
  };
  if (c.type === "choix") {
    champ.constanteValeurs = `VALEURS_${constante(c.nom)}_${SUJET}`;
    champ.typeValeur = `${pascal(c.nom)}${Sujet}`;
    champ.constanteLibelles = `LIBELLES_${constante(c.nom)}_${SUJET}`;
    champ.constanteFiltres = `FILTRES_${constante(c.nom)}_${SUJET}`;
    champ.enumPg = `${c.nom}${Sujet}`;
    champ.nomEnumPg = `${snake(c.nom)}_${snake(sujet)}`;
  }
  return champ;
}

/**
 * Valide strictement une description (objet lu du JSON) ; rend { entite, erreurs }.
 * erreurs : messages en français, un par problème ; entite : null s'il y en a, sinon la description complétée
 * (valeurs par défaut, noms dérivés, accords).
 */
function validerDescription(brut) {
  const erreurs = [];
  const err = (m) => erreurs.push(m);
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return { entite: null, erreurs: ["La description doit être un objet JSON : { \"domaine\": …, \"champs\": [ … ] }."] };
  for (const cle of Object.keys(brut)) if (!CLES_ENTITE.includes(cle)) err(`Clé inconnue : « ${cle} ». Clés possibles : ${CLES_ENTITE.join(", ")}.`);
  const texte = (cle, motif, aide) => {
    const v = brut[cle];
    if (typeof v !== "string" || v.trim() === "") return err(`« ${cle} » manque : ${aide}.`);
    if (motif && !motif.test(v)) err(`« ${cle} » : « ${v} » ne convient pas : ${aide}.`);
  };
  texte("domaine", KEBAB, "le nom du domaine du glossaire, en minuscules sans accent, mots séparés par des tirets (ex. factures)");
  texte("sujet", KEBAB, "le nom d'un élément, en minuscules sans accent, mots séparés par des tirets (ex. facture)");
  texte("pluriel", KEBAB, "le pluriel du sujet, même écriture (ex. factures)");
  texte("libelle", LIBELLE, "le mot affiché pour un élément, en minuscules, comme au milieu d'une phrase (ex. facture)");
  texte("libellePluriel", LIBELLE, "le mot affiché au pluriel (ex. factures)");
  texte("route", ROUTE, "l'adresse de la liste, en minuscules sans accent (ex. /factures)");
  texte("titre", CAMEL, "le nom du champ texte obligatoire qui désigne un élément (ex. client)");
  if (typeof brut.feminin !== "boolean") err("« feminin » manque : true si le libellé est féminin (« une facture »), false sinon.");
  if ("elision" in brut && typeof brut.elision !== "boolean") err("« elision » : true ou false (par défaut : élision devant une voyelle ou un h, « l'article »).");
  for (const cle of ["libelle", "libellePluriel"]) if (typeof brut[cle] === "string" && /^\p{Lu}/u.test(brut[cle])) err(`« ${cle} » : en minuscules, comme au milieu d'une phrase (« ${minuscule(brut[cle])} »).`);
  if (typeof brut.sujet === "string" && brut.sujet === brut.pluriel) err("« pluriel » doit différer de « sujet » (ex. facture et factures).");
  if (typeof brut.sujet === "string" && KEBAB.test(brut.sujet) && CLASSES_RESERVEES.has(pascal(brut.sujet))) err(`« sujet » : « ${brut.sujet} » donnerait la classe ${pascal(brut.sujet)}, un nom déjà pris par JavaScript. Choisissez un mot plus précis (ex. « rendez-vous » plutôt que « date »).`);
  if (typeof brut.route === "string" && /^\/(api|_)/.test(brut.route)) err("« route » : /api est réservé aux adresses techniques ; choisissez l'adresse d'une page (ex. /factures).");

  const champs = [];
  if (!Array.isArray(brut.champs) || brut.champs.length === 0) err("« champs » manque : la liste des informations d'un élément, au moins une.");
  else {
    const vus = new Set();
    brut.champs.forEach((c, i) => {
      const ou = `champs[${i}]${c && typeof c.nom === "string" ? ` (« ${c.nom} »)` : ""}`;
      if (!c || typeof c !== "object" || Array.isArray(c)) return err(`${ou} : un objet { "nom", "libelle", "type", … } est attendu.`);
      if (!TYPES.includes(c.type)) return err(`${ou} : « type » doit valoir ${TYPES.join(", ")}.`);
      const permises = [...CLES_COMMUNES, ...CLES_PAR_TYPE[c.type]];
      for (const cle of Object.keys(c)) if (!permises.includes(cle)) err(`${ou} : clé « ${cle} » inconnue pour le type ${c.type}. Clés possibles : ${permises.join(", ")}.`);
      if (typeof c.nom !== "string" || !CAMEL.test(c.nom)) err(`${ou} : « nom » en camelCase, sans accent ni espace (ex. dateEcheance).`);
      else if (NOMS_RESERVES.has(c.nom)) err(`${ou} : « ${c.nom} » est déjà pris (${[...NOMS_RESERVES].join(", ")}) ; choisissez un autre nom.`);
      else if (vus.has(c.nom)) err(`${ou} : le nom « ${c.nom} » est déjà utilisé par un autre champ.`);
      if (typeof c.nom === "string") vus.add(c.nom);
      if (typeof c.libelle !== "string" || !LIBELLE.test(c.libelle) || c.libelle.trim() === "") err(`${ou} : « libelle » est le texte affiché au-dessus du champ (ex. « Client »), sans accolade, chevron, guillemet droit ni barre oblique inverse.`);
      if ("obligatoire" in c && typeof c.obligatoire !== "boolean") err(`${ou} : « obligatoire » vaut true ou false.`);
      const entier = (cle, min, max) => {
        if (!(cle in c)) return;
        if (!Number.isInteger(c[cle]) || c[cle] < min || c[cle] > max) err(`${ou} : « ${cle} » est un nombre entier de ${enFrancais(min)} à ${enFrancais(max)}.`);
      };
      const champ = { nom: c.nom, libelle: typeof c.libelle === "string" ? c.libelle.trim() : c.libelle, type: c.type, obligatoire: c.obligatoire === true };
      if (c.type === "texte" || c.type === "texte-long") {
        entier("max", 1, 100000);
        champ.max = Number.isInteger(c.max) ? c.max : MAX_PAR_DEFAUT[c.type];
      }
      if (c.type === "nombre") {
        entier("min", -ENTIER_MAX, ENTIER_MAX);
        entier("max", -ENTIER_MAX, ENTIER_MAX);
        champ.min = Number.isInteger(c.min) ? c.min : null;
        champ.max = Number.isInteger(c.max) ? c.max : null;
      }
      if (c.type === "montant") {
        for (const cle of ["min", "max"]) {
          if (!(cle in c)) continue;
          if (typeof c[cle] !== "number" || c[cle] < 0 || c[cle] > MONTANT_MAX || Math.abs(c[cle] * 100 - Math.round(c[cle] * 100)) > 1e-6) err(`${ou} : « ${cle} » est un montant en euros, de 0 à ${enFrancais(MONTANT_MAX, 2)}, avec 2 décimales au plus (ex. 120.5).`);
        }
        champ.min = typeof c.min === "number" ? c.min : null;
        champ.max = typeof c.max === "number" ? c.max : null;
      }
      if ((c.type === "nombre" || c.type === "montant") && champ.min !== null && champ.max !== null && champ.min > champ.max) err(`${ou} : « min » dépasse « max ».`);
      if (c.type === "choix") {
        const valeurs = c.valeurs && typeof c.valeurs === "object" && !Array.isArray(c.valeurs) ? Object.entries(c.valeurs) : [];
        if (valeurs.length < 2) err(`${ou} : « valeurs » liste au moins deux choix : { "brouillon": "Brouillon", "envoyee": "Envoyée" }.`);
        for (const [cle, lib] of valeurs) {
          if (!VALEUR_CHOIX.test(cle)) err(`${ou} : la valeur « ${cle} » s'écrit en minuscules sans accent, mots séparés par des tirets (ex. envoyee).`);
          if (cle === "tous") err(`${ou} : la valeur « tous » est réservée au filtre de la liste ; choisissez un autre mot.`);
          if (typeof lib !== "string" || lib.trim() === "" || !LIBELLE.test(lib)) err(`${ou} : le libellé de « ${cle} » est le texte affiché (ex. « Envoyée »), sans accolade, chevron, guillemet droit ni barre oblique inverse.`);
        }
        champ.valeurs = valeurs.map(([cle, lib]) => ({ cle, libelle: typeof lib === "string" ? lib.trim() : lib }));
        if ("defaut" in c && !valeurs.some(([cle]) => cle === c.defaut)) err(`${ou} : « defaut » doit être l'une des valeurs (${valeurs.map(([k]) => k).join(", ")}).`);
        champ.defaut = "defaut" in c ? c.defaut : valeurs[0]?.[0];
        champ.obligatoire = true;
      }
      if (c.type === "oui-non") {
        if ("defaut" in c && typeof c.defaut !== "boolean") err(`${ou} : « defaut » vaut true ou false.`);
        champ.defaut = c.defaut === true;
        champ.obligatoire = true;
      }
      champs.push(champ);
    });
    // Un montant s'enregistre sous <nom>Centimes : ce nom ne doit pas être celui d'un autre champ.
    for (const c of champs) if (c.type === "montant" && vus.has(`${c.nom}Centimes`)) err(`Le montant « ${c.nom} » s'enregistre sous « ${c.nom}Centimes », déjà le nom d'un autre champ.`);
    if (typeof brut.titre === "string") {
      const t = champs.find((c) => c.nom === brut.titre);
      if (!t) err(`« titre » : aucun champ ne s'appelle « ${brut.titre} ».`);
      else if (t.type !== "texte" || !t.obligatoire) err(`« titre » : « ${brut.titre} » doit être un champ « texte » obligatoire (il nomme un élément dans la liste et dans les messages).`);
      else if (t.max < 20) err(`« titre » : « ${brut.titre} » doit accepter 20 caractères au moins (max), pour nommer un élément.`);
    }
  }
  if (erreurs.length) return { entite: null, erreurs };

  const entite = {
    domaine: brut.domaine,
    sujet: brut.sujet,
    pluriel: brut.pluriel,
    libelle: brut.libelle.trim(),
    libellePluriel: brut.libellePluriel.trim(),
    feminin: brut.feminin,
    route: brut.route,
    titre: brut.titre,
    champs: champs.map((c) => enrichirChamp(c, brut.sujet)),
  };
  entite.g = new Grammaire({ ...entite, elision: brut.elision });
  entite.n = {
    Sujet: pascal(entite.sujet),
    sujetCamel: camel(entite.sujet),
    SUJET: constante(entite.sujet),
    Pluriel: pascal(entite.pluriel),
    plurielCamel: camel(entite.pluriel),
    PLURIEL: constante(entite.pluriel),
    table: snake(entite.pluriel),
    dossierRoute: `app/(connecte)${entite.route}`,
  };
  entite.champTitre = entite.champs.find((c) => c.nom === entite.titre);
  for (const c of entite.champs) c.exemple = exempleDuChamp(c, c.nom === entite.titre);
  return { entite, erreurs: [] };
}

/** Lit et valide une description JSON ; lève une erreur en français (fichier introuvable, JSON illisible, description invalide). */
function lireDescription(fichier) {
  if (!fs.existsSync(fichier)) throw new Error(`Description introuvable : ${fichier}`);
  let brut;
  try {
    brut = JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch (e) {
    throw new Error(`${fichier} n'est pas un JSON lisible : ${e.message}`);
  }
  const { entite, erreurs } = validerDescription(brut);
  if (erreurs.length) throw new Error(`Description à corriger (${fichier}) :\n  - ${erreurs.join("\n  - ")}\nFormat : pulse-aidd pile reference entite.md`);
  return entite;
}

// Fichiers et motifs que la recette connexion pose : l'entité les utilise.
const PREREQUIS = [
  { chemin: "package.json", motif: /"next"/, aide: "le squelette du pack (pulse-aidd pile squelette)" },
  { chemin: "src/lib/safe-action.ts", motif: /export const actionConnectee/, aide: "la recette connexion (actionConnectee)" },
  { chemin: "src/features/compte/queries/utilisateur-connecte.query.ts", motif: /utilisateurConnecte/, aide: "la recette connexion (utilisateurConnecte)" },
  { chemin: "src/db/compte/auth.table.ts", motif: /export const user\b/, aide: "la recette connexion (table user)" },
  { chemin: "e2e/aides/connexion.ts", motif: /connecterNouvelUtilisateur/, aide: "la recette connexion (aide de test connecterNouvelUtilisateur)" },
];

/** Ce qui manque au projet pour recevoir une entité : une ligne par prérequis absent. */
function prerequisManquants(dossier) {
  return PREREQUIS.filter(({ chemin, motif }) => {
    const f = path.join(dossier, ...chemin.split("/"));
    return !fs.existsSync(f) || !motif.test(fs.readFileSync(f, "utf8"));
  }).map(({ chemin, aide }) => `${chemin} : ${aide}`);
}

/**
 * Sort chaque fichier généré en trois groupes : { aEcrire, gardes, conflits }.
 * Un fichier absent est à écrire. Un fichier commun déjà présent (aide partagée entre entités) est gardé s'il exporte
 * chacun des noms attendus ; sinon, comme tout autre fichier présent, c'est un conflit.
 */
function planifier(fichiers, dossier) {
  const aEcrire = [];
  const gardes = [];
  const conflits = [];
  for (const f of fichiers) {
    const complet = path.join(dossier, ...f.chemin.split("/"));
    if (!fs.existsSync(complet)) {
      aEcrire.push(f);
      continue;
    }
    if (f.commun) {
      const actuel = fs.readFileSync(complet, "utf8");
      const manquants = f.commun.filter((nom) => !new RegExp(`export (?:async )?(?:function|const|class|type) ${nom}\\b`).test(actuel));
      if (!manquants.length) {
        gardes.push(f);
        continue;
      }
      conflits.push({ ...f, raison: `aide commune déjà présente, sans ${manquants.join(", ")}` });
      continue;
    }
    conflits.push({ ...f, raison: "déjà présent" });
  }
  return { aEcrire, gardes, conflits };
}

/** Écrit les fichiers (dossiers créés au besoin) ; rend leurs chemins. */
function ecrire(fichiers, dossier) {
  for (const f of fichiers) {
    const complet = path.join(dossier, ...f.chemin.split("/"));
    fs.mkdirSync(path.dirname(complet), { recursive: true });
    fs.writeFileSync(complet, f.contenu);
  }
  return fichiers.map((f) => f.chemin);
}

/** Met en forme les fichiers écrits avec le Biome du projet (imports rangés, mise en forme) ; rend { fait, message }. */
function mettreEnForme(dossier, chemins) {
  const biome = path.join(dossier, "node_modules", "@biomejs", "biome", "bin", "biome");
  if (!fs.existsSync(biome)) return { fait: false, message: "Biome n'est pas installé dans le projet : lancez npm install, puis npm run format." };
  const r = spawnSync(process.execPath, [biome, "check", "--write", ...chemins], { cwd: dossier, encoding: "utf8" });
  if (r.status === 0) return { fait: true, message: "Mise en forme : biome check --write appliqué aux fichiers écrits." };
  return { fait: false, message: `Biome signale encore un écart dans les fichiers écrits (npm run check le détaille) :\n${(r.stdout || "").trim()}\n${(r.stderr || "").trim()}`.trim() };
}

/** Composants shadcn dont l'entité a besoin. */
function composantsNecessaires(entite) {
  const types = new Set(entite.champs.map((c) => c.type));
  return ["native-select", "table", "alert-dialog", "empty", ...(types.has("choix") ? ["badge"] : []), ...(types.has("oui-non") ? ["checkbox"] : []), ...(types.has("texte-long") ? ["textarea"] : [])];
}

/** Les gestes qui suivent l'écriture, dans l'ordre : composants manquants, migration, proxy.ts, vérifications. */
function gestesSuivants(entite, dossier) {
  const gestes = [];
  const ui = path.join(dossier, "src", "components", "ui");
  const manquants = composantsNecessaires(entite).filter((c) => !fs.existsSync(path.join(ui, `${c}.tsx`)));
  if (manquants.length) gestes.push(`Ajoutez les composants shadcn qui manquent : npx shadcn@latest add ${manquants.join(" ")}\n     Si shadcn propose de remplacer button.tsx, répondez non : il perdrait ses cibles tactiles de 44 px.`);
  gestes.push("Créez la migration : npm run db:generate, relisez le fichier SQL créé dans drizzle/, puis appliquez-le à la base de développement : npm run db:migrate.");
  const proxy = path.join(dossier, "proxy.ts");
  const motif = `"${entite.route}/:path*"`;
  if (fs.existsSync(proxy)) {
    const texte = fs.readFileSync(proxy, "utf8");
    if (/PAGES_CONNECTEES/.test(texte)) {
      if (!texte.includes(`"${entite.route}"`)) gestes.push(`Ajoutez "${entite.route}" à PAGES_CONNECTEES de proxy.ts (recette langues) : renvoi rapide vers /connexion.`);
    } else if (!texte.includes(motif)) gestes.push(`Ajoutez ${motif} au matcher de proxy.ts : renvoi rapide vers /connexion (la page reste protégée par utilisateurConnecte()).`);
  }
  gestes.push("Vérifiez : npm run check, npm run typecheck, npm test ; puis npm run test:e2e pour le parcours complet.");
  gestes.push("Adaptez l'écart avec la spec seulement : une règle métier devient une méthode de l'entité et un use-case (architecture.md § 5), un libellé ou un état d'écran se change dans sa section.");
  return gestes;
}

function lireArguments(argv) {
  const opts = { description: null, essai: false, us: null, dossier: process.cwd(), aide: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--essai") opts.essai = true;
    else if (a === "--aide" || a === "-h" || a === "--help") opts.aide = true;
    else if (a === "--us" || a === "--dossier") {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} demande une valeur`);
      if (a === "--us") {
        if (!/^US-(\d{3,}|XXX)$/.test(v)) throw new Error(`--us : « ${v} » n'est pas une étiquette d'US (ex. US-003)`);
        opts.us = v;
      } else opts.dossier = path.resolve(v);
    } else if (a.startsWith("--")) throw new Error(`Option inconnue : ${a}`);
    else if (opts.description === null) opts.description = a;
    else throw new Error(`Un seul fichier de description : ${a} en trop`);
  }
  return opts;
}

const AIDE = "Usage : pulse-aidd pile entite <description.json> [--essai] [--us <US-XXX>] [--dossier <projet>]\nFormat de la description : pulse-aidd pile reference entite.md";

/** Déroulé complet ; rend le code de sortie (0 : écrit ou essai sans conflit ; 1 : erreur, conflit ou prérequis manquant). */
function principal(argv, sortie = console.log) {
  let opts;
  try {
    opts = lireArguments(argv);
  } catch (e) {
    sortie(`${e.message}\n${AIDE}`);
    return 1;
  }
  if (opts.aide || !opts.description) {
    sortie(AIDE);
    return opts.aide ? 0 : 1;
  }
  let entite;
  try {
    entite = lireDescription(path.resolve(opts.dossier, opts.description));
  } catch (e) {
    sortie(e.message);
    return 1;
  }
  const manquants = prerequisManquants(opts.dossier);
  if (manquants.length) {
    sortie(`Le projet n'a pas encore ce dont l'entité a besoin :\n  - ${manquants.join("\n  - ")}`);
    return 1;
  }
  const { genererFichiers } = require("./entite-modeles.js");
  const fichiers = genererFichiers(entite, { us: opts.us });
  const { aEcrire, gardes, conflits } = planifier(fichiers, opts.dossier);
  const titre = `Entité « ${entite.libelle} » (${entite.route})`;
  if (conflits.length) {
    sortie(`${titre} : rien n'est écrit, ${conflits.length} fichier(s) existent déjà :\n${conflits.map((f) => `  ! ${f.chemin} (${f.raison})`).join("\n")}\nChoisissez un autre sujet ou une autre adresse, ou retirez ces fichiers s'ils viennent d'un essai.`);
    return 1;
  }
  const liste = [...aEcrire.map((f) => `  + ${f.chemin}`), ...gardes.map((f) => `  = ${f.chemin} (aide commune déjà présente, gardée)`)].join("\n");
  if (opts.essai) {
    sortie(`${titre} – essai, rien n'est écrit : ${aEcrire.length} fichier(s) à écrire${gardes.length ? `, ${gardes.length} gardé(s)` : ""}.\n${liste}`);
    return 0;
  }
  const ecrits = ecrire(aEcrire, opts.dossier);
  const forme = mettreEnForme(opts.dossier, ecrits);
  const gestes = gestesSuivants(entite, opts.dossier);
  sortie(`${titre} : ${ecrits.length} fichier(s) écrit(s)${gardes.length ? `, ${gardes.length} gardé(s)` : ""}.\n${liste}\n\n${forme.message}\n\nGestes suivants :\n${gestes.map((g, i) => `  ${i + 1}. ${g}`).join("\n")}`);
  return 0;
}

module.exports = { validerDescription, lireDescription, lireArguments, planifier, ecrire, prerequisManquants, composantsNecessaires, gestesSuivants, principal, Grammaire, pascal, camel, snake, kebab, constante, enFrancais, majuscule, minuscule, TYPES };

// Après module.exports : entite-modeles.js, chargé par principal(), importe les aides de ce fichier.
if (require.main === module) process.exitCode = principal(process.argv.slice(2));

// Pulse Next.js – les modèles de code du générateur d'entité (scripts/entite.js).
//
// genererFichiers(entite, { us }) rend la liste des fichiers d'un type d'information : { chemin, contenu, commun? }.
// Le code reprend celui de la recette `liste` (references/recettes/liste/), généralisé aux 7 types de champs.
// commun : noms exportés qu'une aide partagée entre entités doit fournir ; un fichier commun déjà présent qui les
// exporte est gardé tel quel (tableau vide : un test commun déjà présent est toujours gardé).
// La mise en forme fine (retours à la ligne, ordre des imports) est laissée au Biome du projet (entite.js).
"use strict";

const { enFrancais, majuscule, minuscule } = require("./entite.js");

const q = (texte) => JSON.stringify(texte);
const lignes = (...parties) => parties.flat(Infinity).filter((l) => l !== null && l !== undefined && l !== false).join("\n");

// ---------------------------------------------------------------- messages des champs

const remplir = (c) => `Remplissez le champ « ${c.libelle} ».`;
const tropLong = (c) => `Le champ « ${c.libelle} » tient en ${enFrancais(c.max)} caractères au plus.`;
const MESSAGE_ENTIER = (c) => `Écrivez un nombre entier, par exemple ${c.exemple.saisie || "12"}.`;
const MESSAGE_MONTANT = (c) => `Écrivez un montant en euros, par exemple ${c.exemple.saisie || "120,50"}.`;
const MESSAGE_DATE = "Choisissez une date valide.";
const MESSAGE_CHOIX = "Choisissez une valeur dans la liste.";
const euros = (v) => `${enFrancais(v, 2)} €`;

/** Message d'un nombre ou d'un montant hors de ses bornes (null sans borne). */
function horsBornes(c) {
  if (c.min === null && c.max === null) return null;
  const f = c.type === "montant" ? euros : (v) => enFrancais(v);
  const quoi = c.type === "montant" ? "un montant" : "un nombre";
  if (c.min !== null && c.max !== null) return `Écrivez ${quoi} entre ${f(c.min)} et ${f(c.max)}.`;
  if (c.min !== null) return `Écrivez ${quoi} égal ou supérieur à ${f(c.min)}.`;
  return `Écrivez ${quoi} égal ou inférieur à ${f(c.max)}.`;
}

/** Texte d'aide sous le champ : facultatif, exemple, bornes (null s'il n'y a rien à dire). */
function aideDuChamp(c) {
  const parties = [];
  if (!c.obligatoire) parties.push("Facultatif.");
  if (c.type === "montant") parties.push(`Par exemple ${c.exemple.saisie}.`);
  if (c.type === "nombre" || c.type === "montant") {
    const f = c.type === "montant" ? euros : (v) => enFrancais(v);
    if (c.min !== null && c.max !== null) parties.push(`Entre ${f(c.min)} et ${f(c.max)}.`);
    else if (c.min !== null) parties.push(`À partir de ${f(c.min)}.`);
    else if (c.max !== null) parties.push(`Jusqu'à ${f(c.max)}.`);
  }
  return parties.length ? parties.join(" ") : null;
}

const libelleDuChamp = (c) => (c.type === "montant" ? `${c.libelle} (€)` : c.libelle);

/** Condition de bornes sur la valeur v (code TypeScript), ou null. */
function conditionBornes(c, v) {
  const conditions = [];
  if (c.min !== null) conditions.push(`${v} >= ${c.type === "montant" ? Math.round(c.min * 100) : c.min}`);
  if (c.max !== null) conditions.push(`${v} <= ${c.type === "montant" ? Math.round(c.max * 100) : c.max}`);
  return conditions.length ? conditions.join(" && ") : null;
}

/** Le schéma Zod d'un champ (saisie du formulaire → valeur enregistrée). */
function schemaDuChamp(c) {
  if (c.type === "choix") return `z.enum(${c.constanteValeurs}, ${q(MESSAGE_CHOIX)})`;
  if (c.type === "oui-non") return "z.boolean()";
  const debut = c.type === "date" ? "z.string()" : "z.string().trim()";
  const bornes = horsBornes(c);
  if (c.type === "texte" || c.type === "texte-long") {
    if (c.obligatoire) return `${debut}.min(1, { error: ${q(remplir(c))}, abort: true }).max(${c.max}, ${q(tropLong(c))})`;
    return `${debut}.max(${c.max}, ${q(tropLong(c))}).transform(videEnNull)`;
  }
  if (c.type === "nombre") {
    if (c.obligatoire) {
      return lignes(
        `${debut}`,
        `.min(1, { error: ${q(remplir(c))}, abort: true })`,
        `.regex(FORMAT_ENTIER, { error: ${q(MESSAGE_ENTIER(c))}, abort: true })`,
        bornes && `.refine((v) => ${conditionBornes(c, "Number(v)")}, ${q(bornes)})`,
        ".transform((v) => Number(v))",
      );
    }
    return lignes(
      `${debut}`,
      `.refine((v) => v === "" || FORMAT_ENTIER.test(v), { error: ${q(MESSAGE_ENTIER(c))}, abort: true })`,
      bornes && `.refine((v) => v === "" || (${conditionBornes(c, "Number(v)")}), ${q(bornes)})`,
      '.transform((v) => (v === "" ? null : Number(v)))',
    );
  }
  if (c.type === "montant") {
    if (c.obligatoire) {
      return lignes(
        `${debut}`,
        `.min(1, { error: ${q(remplir(c))}, abort: true })`,
        `.regex(FORMAT_MONTANT, { error: ${q(MESSAGE_MONTANT(c))}, abort: true })`,
        bornes && `.refine((v) => ${conditionBornes(c, "eurosEnCentimes(v)")}, ${q(bornes)})`,
        ".transform(eurosEnCentimes)",
      );
    }
    return lignes(
      `${debut}`,
      `.refine((v) => v === "" || FORMAT_MONTANT.test(v), { error: ${q(MESSAGE_MONTANT(c))}, abort: true })`,
      bornes && `.refine((v) => v === "" || (${conditionBornes(c, "eurosEnCentimes(v)")}), ${q(bornes)})`,
      '.transform((v) => (v === "" ? null : eurosEnCentimes(v)))',
    );
  }
  // date : la saisie du champ type="date" (« 2026-03-10 »), enregistrée avec son fuseau.
  if (c.obligatoire) return lignes(`${debut}`, `.min(1, { error: ${q(remplir(c))}, abort: true })`, `.refine(estSaisieDeDate, ${q(MESSAGE_DATE)})`, ".transform(saisieEnDate)");
  return lignes(`${debut}`, `.refine((v) => v === "" || estSaisieDeDate(v), ${q(MESSAGE_DATE)})`, '.transform((v) => (v === "" ? null : saisieEnDate(v)))');
}

/** La valeur enregistrée remise dans la forme du formulaire (code TypeScript), pour la modification. */
function versSaisie(c, v) {
  if (c.type === "texte" || c.type === "texte-long") return c.nullable ? `${v}.${c.cle} ?? ""` : `${v}.${c.cle}`;
  if (c.type === "nombre") return c.nullable ? `${v}.${c.cle} === null ? "" : String(${v}.${c.cle})` : `String(${v}.${c.cle})`;
  if (c.type === "montant") return c.nullable ? `${v}.${c.cle} === null ? "" : centimesEnSaisie(${v}.${c.cle})` : `centimesEnSaisie(${v}.${c.cle})`;
  if (c.type === "date") return c.nullable ? `${v}.${c.cle} === null ? "" : dateEnSaisie(${v}.${c.cle})` : `dateEnSaisie(${v}.${c.cle})`;
  return `${v}.${c.cle}`;
}

/** Valeur vide d'un champ dans le formulaire de création. */
function valeurVide(c) {
  if (c.type === "choix") return q(c.defaut);
  if (c.type === "oui-non") return String(c.defaut);
  return '""';
}

/** Type TypeScript de la valeur enregistrée. */
function typeVue(c) {
  const base = { texte: "string", "texte-long": "string", nombre: "number", montant: "number", date: "Date", choix: c.typeValeur, "oui-non": "boolean" }[c.type];
  return c.nullable ? `${base} | null` : base;
}

/** Un littéral TypeScript de la valeur enregistrée d'exemple (tests). */
function litteralBase(c, valeur = c.exemple.base) {
  if (valeur === null) return "null";
  if (c.type === "date") return `new Date(${q(valeur)})`;
  return q(valeur);
}

// ---------------------------------------------------------------- noms de fichiers

function chemins(e) {
  const { domaine: d, sujet: s, pluriel: p } = e;
  return {
    entite: `src/core/${d}/${s}.entity.ts`,
    erreurs: `src/core/${d}/${s}.errors.ts`,
    port: `src/core/${d}/${s}-repository.port.ts`,
    table: `src/db/${d}/${s}.table.ts`,
    repository: `src/db/${d}/${s}.repository.ts`,
    testRepository: `src/db/${d}/__tests__/${s}.repository.test.ts`,
    constantes: `src/features/${d}/constants/${p}.ts`,
    messages: `src/features/${d}/constants/erreur-messages.ts`,
    schema: `src/features/${d}/schemas/${s}.schema.ts`,
    testSchema: `src/features/${d}/schemas/__tests__/${s}.schema.test.ts`,
    filtres: `src/features/${d}/schemas/filtres-${p}.schema.ts`,
    lister: `src/features/${d}/queries/lister-${p}.query.ts`,
    trouver: `src/features/${d}/queries/trouver-${s}.query.ts`,
    creer: `src/features/${d}/actions/creer-${s}.action.ts`,
    modifier: `src/features/${d}/actions/modifier-${s}.action.ts`,
    supprimer: `src/features/${d}/actions/supprimer-${s}.action.ts`,
    formulaire: `src/features/${d}/components/sections/formulaire-${s}.tsx`,
    tableau: `src/features/${d}/components/sections/tableau-${p}.tsx`,
    creation: `src/features/${d}/components/containers/creation-${s}.container.tsx`,
    modification: `src/features/${d}/components/containers/modification-${s}.container.tsx`,
    edition: `src/features/${d}/components/containers/edition-${s}.container.tsx`,
    suppression: `src/features/${d}/components/containers/suppression-${s}.container.tsx`,
    filtresContainer: `src/features/${d}/components/containers/filtres-${p}.container.tsx`,
    pagination: `src/features/${d}/components/containers/pagination-${p}.container.tsx`,
    liste: `src/features/${d}/components/containers/liste-${p}.container.tsx`,
    page: `${e.n.dossierRoute}/page.tsx`,
    erreurPage: `${e.n.dossierRoute}/error.tsx`,
    pageId: `${e.n.dossierRoute}/[id]/page.tsx`,
    erreurPageId: `${e.n.dossierRoute}/[id]/error.tsx`,
    e2e: `e2e/${p}.spec.ts`,
  };
}

const IMPORT = {
  entite: (e) => `@src/core/${e.domaine}/${e.sujet}.entity`,
  erreurs: (e) => `@src/core/${e.domaine}/${e.sujet}.errors`,
  port: (e) => `@src/core/${e.domaine}/${e.sujet}-repository.port`,
  repository: (e) => `@src/db/${e.domaine}/${e.sujet}.repository`,
  containers: (e) => `@src/features/${e.domaine}/components/containers`,
};

// ---------------------------------------------------------------- src/core

function entite(e) {
  const { Sujet, Pluriel, PLURIEL } = e.n;
  const g = e.g;
  const choix = e.champs.filter((c) => c.type === "choix");
  const tris = ["recentes", "anciennes", ...e.champs.filter((c) => c.triable).flatMap((c) => [`${c.kebab}-desc`, `${c.kebab}-asc`])];
  return lignes(
    `// ${chemins(e).entite}`,
    choix.flatMap((c) => [`export const ${c.constanteValeurs} = [${c.valeurs.map((v) => q(v.cle)).join(", ")}] as const;`, `export type ${c.typeValeur} = (typeof ${c.constanteValeurs})[number];`, ""]),
    `/** Ordres possibles de la liste : par date de création${e.champs.some((c) => c.triable) ? `, ou par ${e.champs.filter((c) => c.triable).map((c) => minuscule(c.libelle)).join(", ")}` : ""}. */`,
    `export const TRIS_${PLURIEL} = [${tris.map(q).join(", ")}] as const;`,
    `export type Tri${Pluriel} = (typeof TRIS_${PLURIEL})[number];`,
    "",
    `/** Les données ${e.feminin ? "d'une" : "d'un"} ${e.libelle} : la forme qui traverse les frontières (base, écran). */`,
    `export type ${Sujet}Vue = {`,
    "  id: string;",
    "  utilisateurId: string;",
    e.champs.map((c) => `  ${c.cle}: ${typeVue(c)};`),
    "  creeLe: Date;",
    "};",
    "",
    `/** Ce que la personne écrit pour ${g.un()} : tout, sauf l'identifiant, la personne propriétaire et la date de création. */`,
    `export type Donnees${Sujet} = Omit<${Sujet}Vue, "id" | "utilisateurId" | "creeLe">;`,
    "",
    `/** ${majuscule(g.un())} : l'état reste en lecture seule ; une règle métier s'ajoute ici, en méthode (architecture.md § 5). */`,
    `export class ${Sujet} {`,
    `  constructor(private readonly donnees: Readonly<${Sujet}Vue>) {}`,
    "",
    "  get id(): string {",
    "    return this.donnees.id;",
    "  }",
    "",
    `  versVue(): ${Sujet}Vue {`,
    "    return { ...this.donnees };",
    "  }",
    "}",
    "",
  );
}

function erreurs(e) {
  return lignes(`// ${chemins(e).erreurs}`, `export type Erreur${e.n.Sujet} = ${q(`${e.sujet}-introuvable`)};`, "");
}

function port(e) {
  const { Sujet } = e.n;
  return lignes(
    `// ${chemins(e).port}`,
    `import type { Donnees${Sujet}, ${Sujet} } from "./${e.sujet}.entity";`,
    "",
    `/** Ce que le métier attend du stockage des ${e.libellePluriel} (patron Repository) : chaque méthode reçoit la personne propriétaire. */`,
    `export interface ${Sujet}Repository {`,
    `  trouver(id: string, utilisateurId: string): Promise<${Sujet} | null>;`,
    `  inserer(utilisateurId: string, donnees: Donnees${Sujet}): Promise<${Sujet}>;`,
    `  /** false si ${e.g.le()} n'existe pas ou appartient à une autre personne. */`,
    `  modifier(id: string, utilisateurId: string, donnees: Donnees${Sujet}): Promise<boolean>;`,
    `  /** false si ${e.g.le()} n'existe pas ou appartient à une autre personne. */`,
    "  supprimer(id: string, utilisateurId: string): Promise<boolean>;",
    "}",
    "",
  );
}

// ---------------------------------------------------------------- src/db

function table(e) {
  const { plurielCamel, table: nomTable } = e.n;
  const choix = e.champs.filter((c) => c.type === "choix");
  const builders = new Set(["index", "pgTable", "text", "timestamp", "uuid"]);
  for (const c of e.champs) {
    if (c.type === "nombre" || c.type === "montant") builders.add("integer");
    if (c.type === "oui-non") builders.add("boolean");
    if (c.type === "choix") builders.add("pgEnum");
  }
  const colonne = (c) => {
    const nom = c.colonneBase !== c.cle ? q(c.colonneBase) : "";
    if (c.type === "choix") return `${c.cle}: ${c.enumPg}(${nom}).notNull().default(${q(c.defaut)}),`;
    if (c.type === "oui-non") return `${c.cle}: boolean(${nom}).notNull().default(${c.defaut}),`;
    const fin = c.obligatoire ? ".notNull()" : "";
    if (c.type === "date") return `${c.cle}: timestamp(${nom ? `${nom}, ` : ""}{ withTimezone: true })${fin},`;
    if (c.type === "nombre" || c.type === "montant") return `${c.cle}: integer(${nom})${fin},`;
    return `${c.cle}: text(${nom})${fin},`;
  };
  return lignes(
    `// ${chemins(e).table}`,
    choix.length ? `import { ${choix.map((c) => c.constanteValeurs).join(", ")} } from "${IMPORT.entite(e)}";` : null,
    'import { user } from "@src/db/compte/auth.table";',
    `import { ${[...builders].sort().join(", ")} } from "drizzle-orm/pg-core";`,
    "",
    choix.map((c) => `export const ${c.enumPg} = pgEnum(${q(c.nomEnumPg)}, ${c.constanteValeurs});`),
    choix.length ? "" : null,
    `// Montants en centimes entiers, dates avec leur fuseau ; chaque ligne appartient à une personne (utilisateur_id).`,
    `export const ${plurielCamel} = pgTable(`,
    `  ${q(nomTable)},`,
    "  {",
    "    id: uuid().primaryKey().defaultRandom(),",
    '    utilisateurId: text("utilisateur_id")',
    "      .notNull()",
    '      .references(() => user.id, { onDelete: "cascade" }),',
    e.champs.map((c) => `    ${colonne(c)}`),
    '    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),',
    "  },",
    "  (table) => [",
    `    index(${q(`${nomTable}_utilisateur_cree_le_idx`)}).on(table.utilisateurId, table.creeLe),`,
    "  ],",
    ");",
    "",
  );
}

function repository(e) {
  const { Sujet, Pluriel, plurielCamel: t } = e.n;
  const choix = e.champs.filter((c) => c.type === "choix");
  const triables = e.champs.filter((c) => c.triable);
  const avecSql = triables.some((c) => c.nullable);
  const titre = e.champTitre;
  const ordre = (c, sens) => {
    if (sens === "desc" && c.nullable) return `sql\`\${${t}.${c.cle}} desc nulls last\``;
    return `${sens}(${t}.${c.cle})`;
  };
  return lignes(
    `// ${chemins(e).repository}`,
    'import "server-only";',
    `import { type Donnees${Sujet}, ${Sujet}, type ${Sujet}Vue, type Tri${Pluriel}${choix.map((c) => `, type ${c.typeValeur}`).join("")} } from "${IMPORT.entite(e)}";`,
    `import type { ${Sujet}Repository } from "${IMPORT.port(e)}";`,
    'import type { Db } from "@src/db/db-client";',
    'import { decalagePourPage } from "@src/lib/helpers/pagination/pagination";',
    `import { and, asc, desc, eq, ilike, type SQL${avecSql ? ", sql" : ""} } from "drizzle-orm";`,
    `import { ${t} } from "./${e.sujet}.table";`,
    "",
    `export type FiltresListe${Pluriel} = {`,
    "  recherche: string;",
    choix.map((c) => `  ${c.cle}: ${c.typeValeur} | null;`),
    `  tri: Tri${Pluriel};`,
    "  page: number;",
    "  taillePage: number;",
    "};",
    "",
    `// L'id termine chaque tri : deux ${e.libellePluriel} de même valeur gardent leur page.`,
    `const ORDRE_PAR_TRI: Record<Tri${Pluriel}, SQL[]> = {`,
    `  recentes: [desc(${t}.creeLe), desc(${t}.id)],`,
    `  anciennes: [asc(${t}.creeLe), asc(${t}.id)],`,
    triables.flatMap((c) => [`  ${q(`${c.kebab}-desc`)}: [${ordre(c, "desc")}, desc(${t}.creeLe), desc(${t}.id)],`, `  ${q(`${c.kebab}-asc`)}: [${ordre(c, "asc")}, desc(${t}.creeLe), desc(${t}.id)],`]),
    "};",
    "",
    "/** Rend %, _ et \\ ordinaires dans un motif ILIKE : la recherche « 100% » cherche le texte « 100% ». */",
    "function echapperMotifLike(texte: string): string {",
    '  return texte.replace(/[\\\\%_]/g, "\\\\$&");',
    "}",
    "",
    `/** Le stockage des ${e.libellePluriel} dans Postgres (Drizzle) : chaque requête porte la condition de propriété. */`,
    `export class Drizzle${Sujet}Repository implements ${Sujet}Repository {`,
    "  constructor(private readonly db: Db) {}",
    "",
    "  async lister(",
    "    utilisateurId: string,",
    `    filtres: FiltresListe${Pluriel},`,
    `  ): Promise<{ ${t}: ${Sujet}Vue[]; total: number }> {`,
    `    const conditions: SQL[] = [eq(${t}.utilisateurId, utilisateurId)];`,
    choix.map((c) => `    if (filtres.${c.cle}) conditions.push(eq(${t}.${c.cle}, filtres.${c.cle}));`),
    "    const recherche = filtres.recherche.trim();",
    '    if (recherche !== "") {',
    `      conditions.push(ilike(${t}.${titre.cle}, \`%\${echapperMotifLike(recherche)}%\`));`,
    "    }",
    "    const filtre = and(...conditions);",
    "",
    "    const [lignes, total] = await Promise.all([",
    "      this.db",
    "        .select()",
    `        .from(${t})`,
    "        .where(filtre)",
    "        .orderBy(...ORDRE_PAR_TRI[filtres.tri])",
    "        .limit(filtres.taillePage)",
    "        .offset(decalagePourPage(filtres.page, filtres.taillePage)),",
    `      this.db.$count(${t}, filtre),`,
    "    ]);",
    `    return { ${t}: lignes, total };`,
    "  }",
    "",
    `  async trouver(id: string, utilisateurId: string): Promise<${Sujet} | null> {`,
    `    const [ligne] = await this.db.select().from(${t}).where(this.proprietaire(id, utilisateurId));`,
    `    return ligne ? new ${Sujet}(ligne) : null;`,
    "  }",
    "",
    `  async inserer(utilisateurId: string, donnees: Donnees${Sujet}): Promise<${Sujet}> {`,
    `    const [ligne] = await this.db.insert(${t}).values({ utilisateurId, ...donnees }).returning();`,
    `    if (!ligne) throw new Error(${q(`La base n'a pas renvoyé ${e.g.le()} ${e.g.accord("créé")}.`)});`,
    `    return new ${Sujet}(ligne);`,
    "  }",
    "",
    `  async modifier(id: string, utilisateurId: string, donnees: Donnees${Sujet}): Promise<boolean> {`,
    "    const lignes = await this.db",
    `      .update(${t})`,
    "      .set(donnees)",
    "      .where(this.proprietaire(id, utilisateurId))",
    `      .returning({ id: ${t}.id });`,
    "    return lignes.length === 1;",
    "  }",
    "",
    "  async supprimer(id: string, utilisateurId: string): Promise<boolean> {",
    "    const lignes = await this.db",
    `      .delete(${t})`,
    "      .where(this.proprietaire(id, utilisateurId))",
    `      .returning({ id: ${t}.id });`,
    "    return lignes.length === 1;",
    "  }",
    "",
    `  /** La condition de propriété : ${e.g.le()} ${e.g.accord("demandé")}, seulement ${e.feminin ? "si elle appartient" : "s'il appartient"} à la personne. */`,
    "  private proprietaire(id: string, utilisateurId: string) {",
    `    return and(eq(${t}.id, id), eq(${t}.utilisateurId, utilisateurId));`,
    "  }",
    "}",
    "",
  );
}

// ---------------------------------------------------------------- src/features : constantes, schémas, lectures, actions

function constantes(e) {
  const { Sujet, Pluriel, PLURIEL, SUJET } = e.n;
  const g = e.g;
  const choix = e.champs.filter((c) => c.type === "choix");
  const triables = e.champs.filter((c) => c.triable);
  const libelleTri = (c, sens) => {
    const l = c.libelle;
    if (c.type === "date") return sens === "desc" ? `${l} : du plus tard au plus tôt` : `${l} : du plus tôt au plus tard`;
    return sens === "desc" ? `${l} : du plus grand au plus petit` : `${l} : du plus petit au plus grand`;
  };
  const importsEntite = [...choix.flatMap((c) => [c.constanteValeurs, `type ${c.typeValeur}`]), `type Tri${Pluriel}`];
  return lignes(
    `// ${chemins(e).constantes}`,
    `import { ${importsEntite.join(", ")} } from "${IMPORT.entite(e)}";`,
    "",
    choix.flatMap((c) => [
      `export const ${c.constanteLibelles}: Record<${c.typeValeur}, string> = {`,
      c.valeurs.map((v) => `  ${/^[a-z][a-z0-9]*$/.test(v.cle) ? v.cle : q(v.cle)}: ${q(v.libelle)},`),
      "};",
      "",
      `export const ${c.constanteFiltres} = ["tous", ...${c.constanteValeurs}] as const;`,
      "",
    ]),
    `export const LIBELLES_TRI_${PLURIEL}: Record<Tri${Pluriel}, string> = {`,
    `  recentes: ${q(`Plus ${g.accord("récent")}s d'abord`)},`,
    `  anciennes: ${q(`Plus ${g.anciens()} d'abord`)},`,
    triables.flatMap((c) => [`  ${q(`${c.kebab}-desc`)}: ${q(libelleTri(c, "desc"))},`, `  ${q(`${c.kebab}-asc`)}: ${q(libelleTri(c, "asc"))},`]),
    "};",
    "",
    `export const TAILLE_PAGE_${PLURIEL} = 10;`,
    "",
    `/** Les champs du formulaire : les erreurs renvoyées par le serveur s'affichent sous eux. */`,
    `export const CHAMPS_${SUJET} = [${e.champs.map((c) => q(c.nom)).join(", ")}] as const;`,
    `export type Champ${Sujet} = (typeof CHAMPS_${SUJET})[number];`,
    "",
  );
}

function messages(e) {
  return lignes(
    `// ${chemins(e).messages}`,
    `import type { Erreur${e.n.Sujet} } from "${IMPORT.erreurs(e)}";`,
    "",
    `export const MESSAGES_${e.n.SUJET}: Record<Erreur${e.n.Sujet}, string> = {`,
    `  ${q(`${e.sujet}-introuvable`)}: ${q(`${majuscule(e.g.ce())} est introuvable : ${e.feminin ? "elle" : "il"} a peut-être été ${e.g.accord("supprimé")}. Rechargez la page.`)},`,
    "};",
    "",
  );
}

function schema(e) {
  const { Sujet, sujetCamel, SUJET } = e.n;
  const choix = e.champs.filter((c) => c.type === "choix");
  const types = new Set(e.champs.map((c) => c.type));
  const aides = [];
  if (types.has("montant")) aides.push("centimesEnSaisie", "eurosEnCentimes", "FORMAT_MONTANT");
  if (types.has("nombre")) aides.push("FORMAT_ENTIER");
  if (types.has("date")) aides.push("dateEnSaisie", "estSaisieDeDate", "saisieEnDate");
  if (e.champs.some((c) => (c.type === "texte" || c.type === "texte-long") && !c.obligatoire)) aides.push("videEnNull");
  return lignes(
    `// ${chemins(e).schema}`,
    `import { ${[...choix.map((c) => c.constanteValeurs), `type Donnees${Sujet}`, `type ${Sujet}Vue`].join(", ")} } from "${IMPORT.entite(e)}";`,
    aides.length ? `import { ${aides.sort().join(", ")} } from "@src/lib/helpers/saisie/saisie";` : null,
    'import { z } from "zod";',
    "",
    `// Les champs tels que la personne les saisit, et leurs règles : le formulaire (navigateur) et les actions (serveur)`,
    "// valident avec ce même schéma. Chaque champ rend sa valeur enregistrée (centimes, date, null pour un champ vide).",
    `export const ${sujetCamel}Schema = z.object({`,
    e.champs.map((c) => `  ${c.nom}: ${schemaDuChamp(c)},`),
    "});",
    "",
    "/** Modification : la même saisie, et l'identifiant de l'élément modifié. */",
    `export const modifier${Sujet}Schema = ${sujetCamel}Schema.extend({ id: z.uuid() });`,
    "",
    `export type ${Sujet}Entree = z.input<typeof ${sujetCamel}Schema>;`,
    "",
    `/** La saisie validée devient les données ${e.g.du()}${e.champs.some((c) => c.cle !== c.nom) ? " (un montant s'enregistre en centimes)" : ""}. */`,
    `export function donnees${Sujet}(valeurs: z.output<typeof ${sujetCamel}Schema>): Donnees${Sujet} {`,
    "  return {",
    e.champs.map((c) => `    ${c.cle}: valeurs.${c.nom},`),
    "  };",
    "}",
    "",
    "/** Le formulaire de création, vide (les choix gardent leur valeur par défaut). */",
    `export const ${SUJET}_VIDE: ${Sujet}Entree = {`,
    e.champs.map((c) => `  ${c.nom}: ${valeurVide(c)},`),
    "};",
    "",
    `/** ${majuscule(e.g.un())} ${e.g.accord("enregistré")}, ${e.g.accord("remis")} dans la forme du formulaire de modification. */`,
    `export function ${sujetCamel}EnSaisie(${sujetCamel}: ${Sujet}Vue): ${Sujet}Entree {`,
    "  return {",
    e.champs.map((c) => `    ${c.nom}: ${versSaisie(c, sujetCamel)},`),
    "  };",
    "}",
    "",
  );
}

function filtres(e) {
  const { Pluriel, PLURIEL } = e.n;
  const choix = e.champs.filter((c) => c.type === "choix");
  return lignes(
    `// ${chemins(e).filtres}`,
    `import { TRIS_${PLURIEL} } from "${IMPORT.entite(e)}";`,
    "import {",
    "  createLoader,",
    "  type inferParserType,",
    "  parseAsInteger,",
    "  parseAsString,",
    "  parseAsStringLiteral,",
    '} from "nuqs/server";',
    choix.length ? `import { ${choix.map((c) => c.constanteFiltres).join(", ")} } from "../constants/${e.pluriel}";` : null,
    "",
    "// Importés depuis nuqs/server : ce fichier sert côté serveur et côté client.",
    `export const filtres${Pluriel} = {`,
    '  recherche: parseAsString.withDefault(""),',
    choix.map((c) => `  ${c.cle}: parseAsStringLiteral(${c.constanteFiltres}).withDefault("tous"),`),
    `  tri: parseAsStringLiteral(TRIS_${PLURIEL}).withDefault("recentes"),`,
    "  page: parseAsInteger.withDefault(1),",
    "};",
    "",
    `export type Filtres${Pluriel} = inferParserType<typeof filtres${Pluriel}>;`,
    "",
    "/** Lecture côté serveur : accepte la promesse `searchParams` de la page. */",
    `export const chargerFiltres${Pluriel} = createLoader(filtres${Pluriel});`,
    "",
  );
}

function lister(e) {
  const { Sujet, Pluriel, PLURIEL } = e.n;
  const choix = e.champs.filter((c) => c.type === "choix");
  return lignes(
    `// ${chemins(e).lister}`,
    'import "server-only";',
    'import { getDb } from "@src/db/db-client";',
    `import { Drizzle${Sujet}Repository } from "${IMPORT.repository(e)}";`,
    `import { TAILLE_PAGE_${PLURIEL} } from "../constants/${e.pluriel}";`,
    `import type { Filtres${Pluriel} } from "../schemas/filtres-${e.pluriel}.schema";`,
    "",
    `export async function lister${Pluriel}(utilisateurId: string, filtres: Filtres${Pluriel}) {`,
    `  return new Drizzle${Sujet}Repository(getDb()).lister(utilisateurId, {`,
    "    recherche: filtres.recherche,",
    choix.map((c) => `    ${c.cle}: filtres.${c.cle} === "tous" ? null : filtres.${c.cle},`),
    "    tri: filtres.tri,",
    "    page: filtres.page,",
    `    taillePage: TAILLE_PAGE_${PLURIEL},`,
    "  });",
    "}",
    "",
  );
}

function trouver(e) {
  const { Sujet, sujetCamel } = e.n;
  return lignes(
    `// ${chemins(e).trouver}`,
    'import "server-only";',
    `import type { ${Sujet}Vue } from "${IMPORT.entite(e)}";`,
    'import { getDb } from "@src/db/db-client";',
    `import { Drizzle${Sujet}Repository } from "${IMPORT.repository(e)}";`,
    'import { notFound } from "next/navigation";',
    'import { z } from "zod";',
    "",
    "const identifiant = z.uuid();",
    "",
    `/** ${majuscule(e.g.le())} ${e.g.accord("demandé")}, ${e.feminin ? "si elle appartient" : "s'il appartient"} à la personne ; sinon la page « introuvable » (une adresse mal formée aussi). */`,
    `export async function trouver${Sujet}(id: string, utilisateurId: string): Promise<${Sujet}Vue> {`,
    "  if (!identifiant.safeParse(id).success) notFound();",
    `  const ${sujetCamel} = await new Drizzle${Sujet}Repository(getDb()).trouver(id, utilisateurId);`,
    `  if (!${sujetCamel}) notFound();`,
    "  // L'écran reçoit des données simples (versVue) : l'instance reste côté serveur.",
    `  return ${sujetCamel}.versVue();`,
    "}",
    "",
  );
}

function enteteAction(e, chemin) {
  return [`// ${chemin}`, '"use server";', ""];
}

function creer(e) {
  const { Sujet, sujetCamel } = e.n;
  return lignes(
    enteteAction(e, chemins(e).creer),
    'import { getDb } from "@src/db/db-client";',
    `import { Drizzle${Sujet}Repository } from "${IMPORT.repository(e)}";`,
    'import { actionConnectee } from "@src/lib/safe-action";',
    'import { refresh } from "next/cache";',
    `import { donnees${Sujet}, ${sujetCamel}Schema } from "../schemas/${e.sujet}.schema";`,
    "",
    "// Sans règle métier, l'action appelle directement le repository (architecture.md § 5) ;",
    "// la personne propriétaire vient de la session (ctx.utilisateur.id), jamais de la saisie.",
    `export const creer${Sujet}Action = actionConnectee`,
    `  .metadata({ nom: ${q(`creer${Sujet}`)} })`,
    `  .inputSchema(${sujetCamel}Schema)`,
    "  .action(async ({ parsedInput, ctx }) => {",
    `    const ${sujetCamel} = await new Drizzle${Sujet}Repository(getDb()).inserer(ctx.utilisateur.id, donnees${Sujet}(parsedInput));`,
    "    refresh();",
    `    return { id: ${sujetCamel}.id };`,
    "  });",
    "",
  );
}

function modifier(e) {
  const { Sujet, SUJET } = e.n;
  return lignes(
    enteteAction(e, chemins(e).modifier),
    'import { getDb } from "@src/db/db-client";',
    `import { Drizzle${Sujet}Repository } from "${IMPORT.repository(e)}";`,
    'import { actionConnectee } from "@src/lib/safe-action";',
    'import { refresh } from "next/cache";',
    'import { returnServerError } from "next-safe-action";',
    `import { MESSAGES_${SUJET} } from "../constants/erreur-messages";`,
    `import { donnees${Sujet}, modifier${Sujet}Schema } from "../schemas/${e.sujet}.schema";`,
    "",
    "// La condition de propriété est dans la requête du repository : une ligne d'une autre personne n'est pas touchée.",
    `export const modifier${Sujet}Action = actionConnectee`,
    `  .metadata({ nom: ${q(`modifier${Sujet}`)} })`,
    `  .inputSchema(modifier${Sujet}Schema)`,
    "  .action(async ({ parsedInput, ctx }) => {",
    "    const { id, ...valeurs } = parsedInput;",
    `    const modifie = await new Drizzle${Sujet}Repository(getDb()).modifier(id, ctx.utilisateur.id, donnees${Sujet}(valeurs));`,
    `    if (!modifie) returnServerError(MESSAGES_${SUJET}[${q(`${e.sujet}-introuvable`)}]);`,
    "    refresh();",
    "    return { id };",
    "  });",
    "",
  );
}

function supprimer(e) {
  const { Sujet, SUJET } = e.n;
  return lignes(
    enteteAction(e, chemins(e).supprimer),
    'import { getDb } from "@src/db/db-client";',
    `import { Drizzle${Sujet}Repository } from "${IMPORT.repository(e)}";`,
    'import { actionConnectee } from "@src/lib/safe-action";',
    'import { refresh } from "next/cache";',
    'import { returnServerError } from "next-safe-action";',
    'import { z } from "zod";',
    `import { MESSAGES_${SUJET} } from "../constants/erreur-messages";`,
    "",
    `export const supprimer${Sujet}Action = actionConnectee`,
    `  .metadata({ nom: ${q(`supprimer${Sujet}`)} })`,
    "  .inputSchema(z.object({ id: z.uuid() }))",
    "  .action(async ({ parsedInput, ctx }) => {",
    `    const supprime = await new Drizzle${Sujet}Repository(getDb()).supprimer(parsedInput.id, ctx.utilisateur.id);`,
    `    if (!supprime) returnServerError(MESSAGES_${SUJET}[${q(`${e.sujet}-introuvable`)}]);`,
    "    refresh();",
    "    return { id: parsedInput.id };",
    "  });",
    "",
  );
}

// ---------------------------------------------------------------- composants

/** Le bloc d'un champ dans le formulaire (TanStack Form + Field). */
function champDuFormulaire(c) {
  const id = "id={`${prefixe}-${field.name}`}";
  const aide = aideDuChamp(c);
  const erreur = [
    "            const erreurChamp =",
    "              envoyees?.[field.name] === field.state.value",
    "                ? erreursChamps?.[field.name]",
    "                : undefined;",
    "            const invalide =",
    "              (montrerErreur(field.state.meta) && !field.state.meta.isValid) ||",
    "              Boolean(erreurChamp);",
  ];
  const messageErreur = ["                {invalide && (", "                  <FieldError errors={[...field.state.meta.errors, erreurChamp]} />", "                )}"];
  if (c.type === "oui-non") {
    return lignes(
      `        <form.Field name=${q(c.nom)}>`,
      "          {(field) => (",
      '            <Field orientation="horizontal">',
      "              <Checkbox",
      `                ${id}`,
      "                name={field.name}",
      "                checked={field.state.value}",
      "                onCheckedChange={(coche) => field.handleChange(coche)}",
      "                onBlur={field.handleBlur}",
      "              />",
      "              <FieldLabel htmlFor={`${prefixe}-${field.name}`}>",
      `                ${c.libelle}`,
      "              </FieldLabel>",
      "            </Field>",
      "          )}",
      "        </form.Field>",
      "",
    );
  }
  const commun = [`                  ${id}`, "                  name={field.name}", "                  value={field.state.value}", "                  onBlur={field.handleBlur}"];
  let controle;
  if (c.type === "choix") {
    controle = [
      "                <NativeSelect",
      ...commun,
      "                  onChange={(e) =>",
      "                    field.handleChange(",
      `                      ${c.constanteValeurs}.find((v) => v === e.target.value) ?? field.state.value,`,
      "                    )",
      "                  }",
      "                  aria-invalid={invalide}",
      "                >",
      `                  {${c.constanteValeurs}.map((valeur) => (`,
      "                    <NativeSelectOption key={valeur} value={valeur}>",
      `                      {${c.constanteLibelles}[valeur]}`,
      "                    </NativeSelectOption>",
      "                  ))}",
      "                </NativeSelect>",
    ];
  } else {
    const balise = c.type === "texte-long" ? "Textarea" : "Input";
    const extra = {
      texte: ['                  autoComplete="off"'],
      "texte-long": ["                  rows={4}"],
      nombre: ['                  inputMode="numeric"', '                  autoComplete="off"'],
      montant: ['                  inputMode="decimal"', '                  autoComplete="off"'],
      date: ['                  type="date"'],
    }[c.type];
    controle = [`                <${balise}`, ...commun, "                  onChange={(e) => field.handleChange(e.target.value)}", "                  aria-invalid={invalide}", ...extra, "                />"];
  }
  return lignes(
    `        <form.Field name=${q(c.nom)}>`,
    "          {(field) => {",
    erreur,
    "            return (",
    "              <Field data-invalid={invalide}>",
    "                <FieldLabel htmlFor={`${prefixe}-${field.name}`}>",
    `                  ${libelleDuChamp(c)}`,
    "                </FieldLabel>",
    controle,
    aide ? `                <FieldDescription>${aide}</FieldDescription>` : null,
    messageErreur,
    "              </Field>",
    "            );",
    "          }}",
    "        </form.Field>",
    "",
  );
}

function formulaire(e) {
  const { Sujet, sujetCamel } = e.n;
  const g = e.g;
  const types = new Set(e.champs.map((c) => c.type));
  const choix = e.champs.filter((c) => c.type === "choix");
  const premier = e.champs.find((c) => c.type !== "oui-non");
  const aideEmployee = e.champs.some((c) => c.type !== "oui-non" && aideDuChamp(c));
  const field = ["Field", ...(aideEmployee ? ["FieldDescription"] : []), "FieldError", "FieldGroup", "FieldLabel"];
  return lignes(
    `// ${chemins(e).formulaire}`,
    '"use client";',
    "",
    'import { Button } from "@src/components/ui/button";',
    types.has("oui-non") ? 'import { Checkbox } from "@src/components/ui/checkbox";' : null,
    `import { ${field.join(", ")} } from "@src/components/ui/field";`,
    [...types].some((t) => ["texte", "nombre", "montant", "date"].includes(t)) ? 'import { Input } from "@src/components/ui/input";' : null,
    types.has("choix") ? 'import { NativeSelect, NativeSelectOption } from "@src/components/ui/native-select";' : null,
    types.has("texte-long") ? 'import { Textarea } from "@src/components/ui/textarea";' : null,
    choix.length ? `import { ${choix.map((c) => c.constanteValeurs).join(", ")} } from "${IMPORT.entite(e)}";` : null,
    'import { revalidateLogic, useForm, useStore } from "@tanstack/react-form";',
    'import { useId, useState } from "react";',
    `import { type Champ${Sujet}${choix.map((c) => `, ${c.constanteLibelles}`).join("")} } from "../../constants/${e.pluriel}";`,
    `import { type ${Sujet}Entree, ${sujetCamel}Schema } from "../../schemas/${e.sujet}.schema";`,
    "",
    "type Props = {",
    "  /** creation : le formulaire se vide après un envoi réussi ; modification : il garde les valeurs enregistrées. */",
    '  mode: "creation" | "modification";',
    `  valeursInitiales: ${Sujet}Entree;`,
    "  /** Répond true quand l'action a réussi (architecture.md § 4). */",
    `  envoyer: (valeurs: ${Sujet}Entree) => Promise<boolean>;`,
    "  /** Erreurs de champ renvoyées par le serveur, affichées sous les champs concernés. */",
    `  erreursChamps?: Partial<Record<Champ${Sujet}, { message: string }>>;`,
    "  erreurServeur?: string;",
    "  enCours: boolean;",
    "};",
    "",
    "const BOUTON = {",
    `  creation: { envoyer: ${q(`Créer ${g.le()}`)}, enCours: "Création en cours…" },`,
    `  modification: { envoyer: ${q(`Enregistrer ${g.le()}`)}, enCours: "Enregistrement en cours…" },`,
    "};",
    "",
    `export function Formulaire${Sujet}({`,
    "  mode,",
    "  valeursInitiales,",
    "  envoyer,",
    "  erreursChamps,",
    "  erreurServeur,",
    "  enCours,",
    "}: Props) {",
    "  const prefixe = useId();",
    "  // Valeurs de la dernière tentative : l'erreur du serveur disparaît dès que le champ est modifié.",
    `  const [envoyees, setEnvoyees] = useState<${Sujet}Entree | null>(null);`,
    "",
    "  const form = useForm({",
    "    defaultValues: valeursInitiales,",
    "    // À la sortie du champ, puis à chaque frappe après le premier envoi (experience § 5).",
    '    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),',
    `    validators: { onDynamic: ${sujetCamel}Schema },`,
    "    // Envoi refusé : le focus va au premier champ en erreur.",
    "    onSubmitInvalid: ({ formApi }) => {",
    "      const champ = Object.entries(formApi.state.fieldMeta).find(",
    "        ([, meta]) => meta?.errors.length,",
    "      )?.[0];",
    "      if (champ) document.getElementById(`${prefixe}-${champ}`)?.focus();",
    "    },",
    "    onSubmit: async ({ value, formApi }) => {",
    "      setEnvoyees(value);",
    '      if ((await envoyer(value)) && mode === "creation") {',
    "        formApi.reset();",
    "        // Après un ajout, le focus revient dans le premier champ.",
    `        document.getElementById(\`\${prefixe}-${premier.nom}\`)?.focus();`,
    "      }",
    "    },",
    "  });",
    "",
    "  // Une erreur s'affiche quand le champ a été modifié puis quitté, ou après un envoi ; jamais pendant la première",
    "  // saisie : la validation du formulaire entier, à la sortie d'un autre champ, a déjà noté les champs encore vides,",
    "  // et un message qui apparaît puis disparaît déplacerait le bouton sous la souris.",
    "  const envois = useStore(form.store, (etat) => etat.submissionAttempts);",
    "  const montrerErreur = (meta: { isBlurred: boolean; isDirty: boolean }) =>",
    "    (meta.isBlurred && meta.isDirty) || envois > 0;",
    "",
    "  return (",
    "    <form",
    "      noValidate",
    "      onSubmit={(e) => {",
    "        e.preventDefault();",
    "        form.handleSubmit();",
    "      }}",
    "    >",
    "      <FieldGroup>",
    e.champs.map(champDuFormulaire),
    "        {erreurServeur && (",
    '          <p role="alert" className="text-sm text-destructive">',
    "            {erreurServeur}",
    "          </p>",
    "        )}",
    "",
    '        <Button type="submit" disabled={enCours} className="self-start">',
    "          {enCours ? BOUTON[mode].enCours : BOUTON[mode].envoyer}",
    "        </Button>",
    "      </FieldGroup>",
    "    </form>",
    "  );",
    "}",
    "",
  );
}

// Sur téléphone, le tableau garde le titre, la première autre colonne et les actions ; les autres colonnes
// apparaissent à partir de md (la page de modification montre tout).
const SUR_ORDINATEUR = "hidden md:table-cell";

/** Les classes d'une colonne : alignement des nombres, colonne masquée sur téléphone (rang 1 et suivants). */
function classesColonne(c, rang, plus = "") {
  const classes = [["nombre", "montant"].includes(c.type) ? "text-right" : "", rang > 0 ? SUR_ORDINATEUR : "", plus].filter(Boolean).join(" ");
  return classes ? ` className="${classes}"` : "";
}

/** La cellule d'un champ dans une ligne du tableau (code JSX). */
function cellule(c, v, rang) {
  const valeur = `${v}.${c.cle}`;
  const siPresent = (code) => (c.nullable ? `{${valeur} === null ? "—" : ${code}}` : `{${code}}`);
  const td = (contenu, plus = "") => `<TableCell${classesColonne(c, rang, plus)}>${contenu}</TableCell>`;
  if (c.type === "texte") return td(c.nullable ? `{${valeur} ?? "—"}` : `{${valeur}}`);
  if (c.type === "nombre") return td(siPresent(`formaterNombre(${valeur})`), "tabular-nums");
  if (c.type === "montant") return td(siPresent(`formaterMontant(${valeur})`), "tabular-nums");
  if (c.type === "date") return td(siPresent(`formaterDate(${valeur})`));
  if (c.type === "choix") return td(`<Badge variant="secondary">{${c.constanteLibelles}[${valeur}]}</Badge>`);
  return td(`{${valeur} ? "Oui" : "Non"}`);
}

function tableau(e) {
  const { Sujet, Pluriel, plurielCamel, sujetCamel } = e.n;
  const g = e.g;
  const choix = e.champs.filter((c) => c.type === "choix");
  const titre = e.champTitre;
  const autres = e.champs.filter((c) => c !== titre && c.type !== "texte-long");
  const types = new Set(autres.map((c) => c.type));
  const format = ["formaterDate", ...(types.has("montant") ? ["formaterMontant"] : [])];
  const enTete = (c, rang) => `<TableHead${classesColonne(c, rang)}>${c.libelle}</TableHead>`;
  return lignes(
    `// ${chemins(e).tableau}`,
    choix.length ? 'import { Badge } from "@src/components/ui/badge";' : null,
    'import { buttonVariants } from "@src/components/ui/button";',
    'import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@src/components/ui/empty";',
    'import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@src/components/ui/table";',
    `import type { ${Sujet}Vue } from "${IMPORT.entite(e)}";`,
    `import { ${format.join(", ")} } from "@src/lib/helpers/format/format";`,
    types.has("nombre") ? 'import { formaterNombre } from "@src/lib/helpers/format/nombre";' : null,
    'import Link from "next/link";',
    'import type { ReactNode } from "react";',
    choix.length ? `import { ${choix.map((c) => c.constanteLibelles).join(", ")} } from "../../constants/${e.pluriel}";` : null,
    "",
    "type Props = {",
    `  ${plurielCamel}: ${Sujet}Vue[];`,
    "  total: number;",
    "  filtresActifs: boolean;",
    `  /** Les actions d'une ligne qui écrivent (supprimer), fournies par le container. */`,
    `  actions: (${sujetCamel}: ${Sujet}Vue) => ReactNode;`,
    "};",
    "",
    `export function Tableau${Pluriel}({ ${plurielCamel}, total, filtresActifs, actions }: Props) {`,
    "  if (total === 0) {",
    "    return (",
    '      <Empty className="border">',
    "        <EmptyHeader>",
    "          <EmptyTitle>",
    "            {filtresActifs",
    `              ? ${q(`${g.aucun()} ne correspond à ces filtres.`)}`,
    `              : ${q(`Vous n'avez pas encore ${g.de()}.`)}}`,
    "          </EmptyTitle>",
    "          <EmptyDescription>",
    "            {filtresActifs",
    '              ? "Modifiez la recherche ou cliquez sur « Effacer les filtres »."',
    `              : ${q(`Créez ${g.premier()} avec le formulaire ci-dessus.`)}}`,
    "          </EmptyDescription>",
    "        </EmptyHeader>",
    "      </Empty>",
    "    );",
    "  }",
    "",
    "  const nombre = (",
    '    <p className="text-sm text-muted-foreground">',
    `      {total} {total > 1 ? ${q(e.libellePluriel)} : ${q(e.libelle)}}`,
    "    </p>",
    "  );",
    "",
    `  if (${plurielCamel}.length === 0) {`,
    "    return (",
    "      <>",
    "        {nombre}",
    '        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">',
    "          Cette page est vide. Revenez à la page précédente.",
    "        </p>",
    "      </>",
    "    );",
    "  }",
    "",
    "  return (",
    "    <>",
    "      {nombre}",
    "      <Table>",
    `        <TableCaption className="sr-only">Mes ${e.libellePluriel}</TableCaption>`,
    "        <TableHeader>",
    "          <TableRow>",
    `            <TableHead>${titre.libelle}</TableHead>`,
    autres.map((c, rang) => `            ${enTete(c, rang)}`),
    `            <TableHead className="${SUR_ORDINATEUR}">${g.accord("Créé")} le</TableHead>`,
    '            <TableHead className="text-right">Actions</TableHead>',
    "          </TableRow>",
    "        </TableHeader>",
    "        <TableBody>",
    `          {${plurielCamel}.map((${sujetCamel}) => (`,
    `            <TableRow key={${sujetCamel}.id}>`,
    `              <TableCell className="font-medium">{${sujetCamel}.${titre.cle}}</TableCell>`,
    autres.map((c, rang) => `              ${cellule(c, sujetCamel, rang)}`),
    `              <TableCell className="${SUR_ORDINATEUR}">{formaterDate(${sujetCamel}.creeLe)}</TableCell>`,
    "              <TableCell>",
    '                <div className="flex justify-end gap-2">',
    "                  <Link",
    `                    href={\`${e.route}/\${${sujetCamel}.id}\`}`,
    '                    className={buttonVariants({ variant: "outline", size: "sm" })}',
    `                    aria-label={\`Modifier ${g.le()} « \${${sujetCamel}.${titre.cle}} »\`}`,
    "                  >",
    "                    Modifier",
    "                  </Link>",
    `                  {actions(${sujetCamel})}`,
    "                </div>",
    "              </TableCell>",
    "            </TableRow>",
    "          ))}",
    "        </TableBody>",
    "      </Table>",
    "    </>",
    "  );",
    "}",
    "",
  );
}

function creation(e) {
  const { Sujet, SUJET } = e.n;
  const t = e.champTitre.nom;
  return lignes(
    `// ${chemins(e).creation}`,
    '"use client";',
    "",
    'import { erreursDeChamps } from "@src/lib/helpers/formulaire/erreurs-de-champs";',
    'import { useAction } from "next-safe-action/hooks";',
    'import { toast } from "sonner";',
    `import { creer${Sujet}Action } from "../../actions/creer-${e.sujet}.action";`,
    `import { CHAMPS_${SUJET} } from "../../constants/${e.pluriel}";`,
    `import { ${SUJET}_VIDE } from "../../schemas/${e.sujet}.schema";`,
    `import { Formulaire${Sujet} } from "../sections/formulaire-${e.sujet}";`,
    "",
    `export function Creation${Sujet}Container() {`,
    `  const { executeAsync, result, isPending } = useAction(creer${Sujet}Action);`,
    "  return (",
    `    <Formulaire${Sujet}`,
    '      mode="creation"',
    `      valeursInitiales={${SUJET}_VIDE}`,
    "      envoyer={async (valeurs) => {",
    "        const reponse = await executeAsync(valeurs);",
    "        if (reponse?.data) {",
    `          toast.success(\`${majuscule(e.libelle)} « \${valeurs.${t}.trim()} » ${e.g.accord("créé")}.\`);`,
    "          return true;",
    "        }",
    "        if (reponse?.validationErrors) {",
    '          toast.error("Vérifiez les champs signalés.");',
    "        }",
    "        return false;",
    "      }}",
    "      erreursChamps={",
    "        result.validationErrors",
    `          ? erreursDeChamps(CHAMPS_${SUJET}, result.validationErrors)`,
    "          : undefined",
    "      }",
    "      erreurServeur={result.serverError}",
    "      enCours={isPending}",
    "    />",
    "  );",
    "}",
    "",
  );
}

function modification(e) {
  const { Sujet, SUJET } = e.n;
  const t = e.champTitre.nom;
  return lignes(
    `// ${chemins(e).modification}`,
    '"use client";',
    "",
    'import { erreursDeChamps } from "@src/lib/helpers/formulaire/erreurs-de-champs";',
    'import { useRouter } from "next/navigation";',
    'import { useAction } from "next-safe-action/hooks";',
    'import { toast } from "sonner";',
    `import { modifier${Sujet}Action } from "../../actions/modifier-${e.sujet}.action";`,
    `import { CHAMPS_${SUJET} } from "../../constants/${e.pluriel}";`,
    `import type { ${Sujet}Entree } from "../../schemas/${e.sujet}.schema";`,
    `import { Formulaire${Sujet} } from "../sections/formulaire-${e.sujet}";`,
    "",
    `export function Modification${Sujet}Container({`,
    "  id,",
    "  valeursInitiales,",
    "}: {",
    "  id: string;",
    `  valeursInitiales: ${Sujet}Entree;`,
    "}) {",
    "  const router = useRouter();",
    `  const { executeAsync, result, isPending } = useAction(modifier${Sujet}Action);`,
    "  return (",
    `    <Formulaire${Sujet}`,
    '      mode="modification"',
    "      valeursInitiales={valeursInitiales}",
    "      envoyer={async (valeurs) => {",
    "        const reponse = await executeAsync({ id, ...valeurs });",
    "        if (reponse?.data) {",
    `          toast.success(\`${majuscule(e.libelle)} « \${valeurs.${t}.trim()} » ${e.g.accord("modifié")}.\`);`,
    `          router.push(${q(e.route)});`,
    "          return true;",
    "        }",
    "        if (reponse?.validationErrors) {",
    '          toast.error("Vérifiez les champs signalés.");',
    "        }",
    "        return false;",
    "      }}",
    "      erreursChamps={",
    "        result.validationErrors",
    `          ? erreursDeChamps(CHAMPS_${SUJET}, result.validationErrors)`,
    "          : undefined",
    "      }",
    "      erreurServeur={result.serverError}",
    "      enCours={isPending}",
    "    />",
    "  );",
    "}",
    "",
  );
}

function edition(e) {
  const { Sujet, sujetCamel } = e.n;
  return lignes(
    `// ${chemins(e).edition}`,
    'import { utilisateurConnecte } from "@src/features/compte/queries/utilisateur-connecte.query";',
    `import { trouver${Sujet} } from "../../queries/trouver-${e.sujet}.query";`,
    `import { ${sujetCamel}EnSaisie } from "../../schemas/${e.sujet}.schema";`,
    `import { Modification${Sujet}Container } from "./modification-${e.sujet}.container";`,
    "",
    `/** Lit ${e.g.le()} (${e.feminin ? "absente ou à une autre personne" : "absent ou à une autre personne"} : page « introuvable »), puis ouvre son formulaire. */`,
    `export async function Edition${Sujet}Container({`,
    "  params,",
    "}: {",
    `  params: PageProps<${q(`${e.route}/[id]`)}>["params"];`,
    "}) {",
    "  const { id } = await params;",
    "  const utilisateur = await utilisateurConnecte();",
    `  const ${sujetCamel} = await trouver${Sujet}(id, utilisateur.id);`,
    "  return (",
    `    <Modification${Sujet}Container`,
    `      id={${sujetCamel}.id}`,
    `      valeursInitiales={${sujetCamel}EnSaisie(${sujetCamel})}`,
    "    />",
    "  );",
    "}",
    "",
  );
}

function suppression(e) {
  const { Sujet } = e.n;
  const g = e.g;
  return lignes(
    `// ${chemins(e).suppression}`,
    '"use client";',
    "",
    "import {",
    "  AlertDialog,",
    "  AlertDialogCancel,",
    "  AlertDialogContent,",
    "  AlertDialogDescription,",
    "  AlertDialogFooter,",
    "  AlertDialogHeader,",
    "  AlertDialogTitle,",
    "  AlertDialogTrigger,",
    '} from "@src/components/ui/alert-dialog";',
    'import { Button } from "@src/components/ui/button";',
    'import { useAction } from "next-safe-action/hooks";',
    'import { useState } from "react";',
    'import { toast } from "sonner";',
    `import { supprimer${Sujet}Action } from "../../actions/supprimer-${e.sujet}.action";`,
    "",
    "/** Suppression définitive : une confirmation qui nomme l'élément, le verbe de l'action sur le bouton (experience § 4). */",
    `export function Suppression${Sujet}Container({ id, titre }: { id: string; titre: string }) {`,
    "  const [ouvert, setOuvert] = useState(false);",
    `  const { executeAsync, isPending } = useAction(supprimer${Sujet}Action);`,
    "",
    "  async function supprimer() {",
    "    const reponse = await executeAsync({ id });",
    "    if (reponse?.data) {",
    "      setOuvert(false);",
    `      toast.success(\`${majuscule(e.libelle)} « \${titre} » ${g.accord("supprimé")}.\`);`,
    "      // La ligne disparaît : le focus va au titre de la liste (experience § 6).",
    `      document.getElementById(${q(`titre-liste-${e.pluriel}`)})?.focus();`,
    "      return;",
    "    }",
    "    toast.error(",
    `      reponse?.serverError ?? ${q(`${majuscule(g.le())} n'a pas pu être ${g.accord("supprimé")}. Réessayez.`)},`,
    "      { duration: Number.POSITIVE_INFINITY, closeButton: true },",
    "    );",
    "  }",
    "",
    "  return (",
    "    <AlertDialog open={ouvert} onOpenChange={setOuvert}>",
    "      <AlertDialogTrigger",
    '        render={<Button type="button" variant="outline" size="sm" />}',
    `        aria-label={\`Supprimer ${g.le()} « \${titre} »\`}`,
    "      >",
    "        Supprimer",
    "      </AlertDialogTrigger>",
    "      <AlertDialogContent>",
    "        <AlertDialogHeader>",
    "          <AlertDialogTitle>",
    `            Supprimer ${g.le()} « {titre} » ?`,
    "          </AlertDialogTitle>",
    "          <AlertDialogDescription>",
    `            Cette action est définitive : ${g.le()} ne pourra pas être ${g.accord("récupéré")}.`,
    "          </AlertDialogDescription>",
    "        </AlertDialogHeader>",
    "        <AlertDialogFooter>",
    `          <AlertDialogCancel>Garder ${g.le()}</AlertDialogCancel>`,
    "          <Button",
    '            type="button"',
    '            variant="destructive"',
    "            disabled={isPending}",
    "            onClick={supprimer}",
    "          >",
    `            {isPending ? "Suppression en cours…" : ${q(`Supprimer ${g.le()}`)}}`,
    "          </Button>",
    "        </AlertDialogFooter>",
    "      </AlertDialogContent>",
    "    </AlertDialog>",
    "  );",
    "}",
    "",
  );
}

function filtresContainer(e) {
  const { Pluriel, PLURIEL } = e.n;
  const choix = e.champs.filter((c) => c.type === "choix");
  const colonnes = 3 + choix.length;
  const idRecherche = `recherche-${e.pluriel}`;
  return lignes(
    `// ${chemins(e).filtresContainer}`,
    '"use client";',
    "",
    'import { Button } from "@src/components/ui/button";',
    'import { Field, FieldLabel } from "@src/components/ui/field";',
    'import { Input } from "@src/components/ui/input";',
    'import { NativeSelect, NativeSelectOption } from "@src/components/ui/native-select";',
    `import { TRIS_${PLURIEL} } from "${IMPORT.entite(e)}";`,
    'import { debounce, useQueryStates } from "nuqs";',
    'import { useTransition } from "react";',
    `import { ${[...choix.flatMap((c) => [c.constanteFiltres, c.constanteLibelles]), `LIBELLES_TRI_${PLURIEL}`].join(", ")} } from "../../constants/${e.pluriel}";`,
    `import { filtres${Pluriel} } from "../../schemas/filtres-${e.pluriel}.schema";`,
    "",
    "// shallow: false : le serveur refait la liste à chaque changement d'adresse ; chaque filtre ramène à la page 1.",
    `export function Filtres${Pluriel}Container() {`,
    "  const [miseAJour, startTransition] = useTransition();",
    `  const [filtres, setFiltres] = useQueryStates(filtres${Pluriel}, {`,
    "    shallow: false,",
    "    startTransition,",
    "  });",
    "",
    "  return (",
    `    <div className="grid gap-4 sm:grid-cols-[1fr${"_auto".repeat(colonnes - 1)}] sm:items-end">`,
    "      <Field>",
    `        <FieldLabel htmlFor=${q(idRecherche)}>Rechercher par ${minuscule(e.champTitre.libelle)}</FieldLabel>`,
    "        <Input",
    `          id=${q(idRecherche)}`,
    '          type="search"',
    "          value={filtres.recherche}",
    "          onChange={(e) =>",
    "            setFiltres(",
    "              { recherche: e.target.value, page: 1 },",
    "              { limitUrlUpdates: debounce(300) },",
    "            )",
    "          }",
    "        />",
    "      </Field>",
    "",
    choix.map((c) => {
      const id = `filtre-${c.kebab}-${e.pluriel}`;
      return lignes(
        "      <Field>",
        `        <FieldLabel htmlFor=${q(id)}>${c.libelle}</FieldLabel>`,
        "        <NativeSelect",
        `          id=${q(id)}`,
        `          value={filtres.${c.cle}}`,
        "          onChange={(e) =>",
        "            setFiltres({",
        `              ${c.cle}: ${c.constanteFiltres}.find((v) => v === e.target.value) ?? "tous",`,
        "              page: 1,",
        "            })",
        "          }",
        "        >",
        '          <NativeSelectOption value="tous">Tous</NativeSelectOption>',
        `          {${c.constanteFiltres}.filter((v) => v !== "tous").map((valeur) => (`,
        "            <NativeSelectOption key={valeur} value={valeur}>",
        `              {${c.constanteLibelles}[valeur]}`,
        "            </NativeSelectOption>",
        "          ))}",
        "        </NativeSelect>",
        "      </Field>",
        "",
      );
    }),
    "      <Field>",
    `        <FieldLabel htmlFor=${q(`tri-${e.pluriel}`)}>Trier par</FieldLabel>`,
    "        <NativeSelect",
    `          id=${q(`tri-${e.pluriel}`)}`,
    "          value={filtres.tri}",
    "          onChange={(e) =>",
    "            setFiltres({",
    `              tri: TRIS_${PLURIEL}.find((t) => t === e.target.value) ?? "recentes",`,
    "              page: 1,",
    "            })",
    "          }",
    "        >",
    `          {TRIS_${PLURIEL}.map((tri) => (`,
    "            <NativeSelectOption key={tri} value={tri}>",
    `              {LIBELLES_TRI_${PLURIEL}[tri]}`,
    "            </NativeSelectOption>",
    "          ))}",
    "        </NativeSelect>",
    "      </Field>",
    "",
    '      <Button type="button" variant="outline" onClick={() => setFiltres(null)}>',
    "        Effacer les filtres",
    "      </Button>",
    "",
    `      <p aria-live="polite" className="text-sm text-muted-foreground sm:col-span-${colonnes + 1}">`,
    '        {miseAJour ? "Mise à jour…" : ""}',
    "      </p>",
    "    </div>",
    "  );",
    "}",
    "",
  );
}

function pagination(e) {
  const { Pluriel } = e.n;
  return lignes(
    `// ${chemins(e).pagination}`,
    '"use client";',
    "",
    'import { Button } from "@src/components/ui/button";',
    'import { pageValide } from "@src/lib/helpers/pagination/pagination";',
    'import { useQueryStates } from "nuqs";',
    'import { useTransition } from "react";',
    `import { filtres${Pluriel} } from "../../schemas/filtres-${e.pluriel}.schema";`,
    "",
    `export function Pagination${Pluriel}Container({ nombreDePages }: { nombreDePages: number }) {`,
    "  const [miseAJour, startTransition] = useTransition();",
    `  const [filtres, setFiltres] = useQueryStates(filtres${Pluriel}, {`,
    "    shallow: false,",
    "    startTransition,",
    "  });",
    "  const page = pageValide(filtres.page);",
    "",
    "  return (",
    '    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">',
    "      <Button",
    '        type="button"',
    '        variant="outline"',
    "        disabled={page <= 1 || miseAJour}",
    "        onClick={() => setFiltres({ page: page - 1 })}",
    "      >",
    "        Page précédente",
    "      </Button>",
    '      <p className="text-sm text-muted-foreground">',
    "        Page {page} sur {nombreDePages}",
    "      </p>",
    "      <Button",
    '        type="button"',
    '        variant="outline"',
    "        disabled={page >= nombreDePages || miseAJour}",
    "        onClick={() => setFiltres({ page: page + 1 })}",
    "      >",
    "        Page suivante",
    "      </Button>",
    "    </nav>",
    "  );",
    "}",
    "",
  );
}

function liste(e) {
  const { Sujet, Pluriel, PLURIEL, plurielCamel, sujetCamel } = e.n;
  const choix = e.champs.filter((c) => c.type === "choix");
  const actifs = ['filtres.recherche.trim() !== ""', ...choix.map((c) => `filtres.${c.cle} !== "tous"`)].join(" || ");
  return lignes(
    `// ${chemins(e).liste}`,
    'import { utilisateurConnecte } from "@src/features/compte/queries/utilisateur-connecte.query";',
    'import { nombreDePages } from "@src/lib/helpers/pagination/pagination";',
    `import { TAILLE_PAGE_${PLURIEL} } from "../../constants/${e.pluriel}";`,
    `import { lister${Pluriel} } from "../../queries/lister-${e.pluriel}.query";`,
    `import { chargerFiltres${Pluriel} } from "../../schemas/filtres-${e.pluriel}.schema";`,
    `import { Tableau${Pluriel} } from "../sections/tableau-${e.pluriel}";`,
    `import { Pagination${Pluriel}Container } from "./pagination-${e.pluriel}.container";`,
    `import { Suppression${Sujet}Container } from "./suppression-${e.sujet}.container";`,
    "",
    "// Container serveur : il lit la session, les filtres et la liste, puis compose le tableau et la pagination.",
    `export async function Liste${Pluriel}Container({`,
    "  searchParams,",
    "}: {",
    `  searchParams: PageProps<${q(e.route)}>["searchParams"];`,
    "}) {",
    "  const utilisateur = await utilisateurConnecte();",
    `  const filtres = await chargerFiltres${Pluriel}(searchParams);`,
    `  const { ${plurielCamel}, total } = await lister${Pluriel}(utilisateur.id, filtres);`,
    `  const filtresActifs = ${actifs};`,
    "",
    "  return (",
    '    <div className="space-y-4">',
    `      <Tableau${Pluriel}`,
    `        ${plurielCamel}={${plurielCamel}}`,
    "        total={total}",
    "        filtresActifs={filtresActifs}",
    `        actions={(${sujetCamel}) => (`,
    `          <Suppression${Sujet}Container id={${sujetCamel}.id} titre={${sujetCamel}.${e.champTitre.cle}} />`,
    "        )}",
    "      />",
    "      {total > 0 && (",
    `        <Pagination${Pluriel}Container nombreDePages={nombreDePages(total, TAILLE_PAGE_${PLURIEL})} />`,
    "      )}",
    "    </div>",
    "  );",
    "}",
    "",
  );
}

// ---------------------------------------------------------------- app/

function page(e) {
  const { Sujet, Pluriel } = e.n;
  const g = e.g;
  const c = IMPORT.containers(e);
  return lignes(
    `// ${chemins(e).page}`,
    'import { Skeleton } from "@src/components/ui/skeleton";',
    `import { Creation${Sujet}Container } from "${c}/creation-${e.sujet}.container";`,
    `import { Filtres${Pluriel}Container } from "${c}/filtres-${e.pluriel}.container";`,
    `import { Liste${Pluriel}Container } from "${c}/liste-${e.pluriel}.container";`,
    'import type { Metadata } from "next";',
    'import { Suspense } from "react";',
    "",
    `export const metadata: Metadata = { title: ${q(`Mes ${e.libellePluriel}`)} };`,
    "",
    "// Tout ce qui lit la requête ou la base est sous <Suspense> ; la page passe la promesse searchParams sans l'attendre.",
    `export default function Page${Pluriel}(props: PageProps<${q(e.route)}>) {`,
    "  return (",
    '    <main className="mx-auto max-w-4xl space-y-10 p-6">',
    `      <h1 className="text-2xl font-semibold">Mes ${e.libellePluriel}</h1>`,
    "",
    `      <section aria-labelledby=${q(`titre-nouveau-${e.sujet}`)} className="space-y-4">`,
    `        <h2 id=${q(`titre-nouveau-${e.sujet}`)} className="text-lg font-medium">`,
    `          ${g.nouveau()}`,
    "        </h2>",
    `        <Creation${Sujet}Container />`,
    "      </section>",
    "",
    `      <section aria-labelledby=${q(`titre-liste-${e.pluriel}`)} className="space-y-4">`,
    "        {/* tabIndex={-1} : le focus y revient après une suppression. */}",
    `        <h2 id=${q(`titre-liste-${e.pluriel}`)} tabIndex={-1} className="text-lg font-medium outline-none">`,
    "          Liste",
    "        </h2>",
    '        <Suspense fallback={<Skeleton className="h-16 w-full" />}>',
    `          <Filtres${Pluriel}Container />`,
    "        </Suspense>",
    "        <Suspense fallback={<SqueletteListe />}>",
    `          <Liste${Pluriel}Container searchParams={props.searchParams} />`,
    "        </Suspense>",
    "      </section>",
    "    </main>",
    "  );",
    "}",
    "",
    "function SqueletteListe() {",
    "  return (",
    '    <div className="space-y-2" aria-busy="true">',
    `      <p className="sr-only">Chargement des ${e.libellePluriel}…</p>`,
    '      <Skeleton className="h-10 w-full" />',
    '      <Skeleton className="h-10 w-full" />',
    '      <Skeleton className="h-10 w-full" />',
    "    </div>",
    "  );",
    "}",
    "",
  );
}

function pageId(e) {
  const { Sujet } = e.n;
  const g = e.g;
  return lignes(
    `// ${chemins(e).pageId}`,
    'import { Skeleton } from "@src/components/ui/skeleton";',
    `import { Edition${Sujet}Container } from "${IMPORT.containers(e)}/edition-${e.sujet}.container";`,
    'import type { Metadata } from "next";',
    'import Link from "next/link";',
    'import { Suspense } from "react";',
    "",
    `export const metadata: Metadata = { title: ${q(`Modifier ${g.un()}`)} };`,
    "",
    `export default function PageModification${Sujet}(props: PageProps<${q(`${e.route}/[id]`)}>) {`,
    "  return (",
    '    <main className="mx-auto max-w-4xl space-y-6 p-6">',
    `      <Link href=${q(e.route)} className="text-sm text-primary underline underline-offset-3">`,
    `        Retour à mes ${e.libellePluriel}`,
    "      </Link>",
    `      <h1 className="text-2xl font-semibold">Modifier ${g.le()}</h1>`,
    "      <Suspense fallback={<SqueletteFormulaire />}>",
    `        <Edition${Sujet}Container params={props.params} />`,
    "      </Suspense>",
    "    </main>",
    "  );",
    "}",
    "",
    "function SqueletteFormulaire() {",
    "  return (",
    '    <div className="space-y-4" aria-busy="true">',
    `      <p className="sr-only">Chargement ${e.g.du()}…</p>`,
    e.champs.map(() => '      <Skeleton className="h-11 w-full" />'),
    "    </div>",
    "  );",
    "}",
    "",
  );
}

function pageErreur(e, chemin, titre, nom) {
  return lignes(
    `// ${chemin}`,
    '"use client";',
    "",
    'import { Button } from "@src/components/ui/button";',
    'import { useEffect } from "react";',
    "",
    `export default function ${nom}({`,
    "  error,",
    "  retry,",
    "}: {",
    "  error: Error & { digest?: string };",
    "  retry: () => void;",
    "}) {",
    "  useEffect(() => {",
    "    console.error(error);",
    "  }, [error]);",
    "",
    "  return (",
    '    <div role="alert" className="mx-auto max-w-4xl space-y-4 p-6">',
    `      <h2 className="text-lg font-medium">${titre}</h2>`,
    '      <p className="text-muted-foreground">Vérifiez votre connexion, puis réessayez.</p>',
    "      {/* retry() relit les données ; reset() réafficherait sans relire. */}",
    '      <Button type="button" onClick={() => retry()}>',
    "        Réessayer",
    "      </Button>",
    "    </div>",
    "  );",
    "}",
    "",
  );
}

// ---------------------------------------------------------------- tests

const titreTest = (us, texte) => q(`${us ? `${us} – ` : ""}${texte}`);

function testSchema(e, us) {
  const { Sujet, sujetCamel } = e.n;
  const g = e.g;
  const valide = e.champs.map((c) => `  ${c.nom}: ${q(c.exemple.saisie)},`);
  const attendu = e.champs.map((c) => `      ${c.nom}: ${litteralBase(c)},`);
  const obligatoires = e.champs.filter((c) => c.obligatoire && !["choix", "oui-non"].includes(c.type));
  const facultatifs = e.champs.filter((c) => c.nullable);
  const cas = [];
  for (const c of e.champs) {
    if (c.type === "texte" || c.type === "texte-long") cas.push([`« ${c.libelle} » trop long`, c.nom, `"x".repeat(${c.max + 1})`, tropLong(c)]);
    if (c.type === "nombre") {
      cas.push([`« ${c.libelle} » qui n'est pas un nombre entier`, c.nom, q("12,5"), MESSAGE_ENTIER(c)]);
      // Hors bornes : la valeur voisine de la borne, tant qu'elle garde le format de saisie (9 chiffres).
      const hors = c.max !== null && c.max < 999999999 ? c.max + 1 : c.min !== null && c.min > -999999999 ? c.min - 1 : null;
      if (horsBornes(c) && hors !== null) cas.push([`« ${c.libelle} » hors de ses bornes`, c.nom, q(String(hors)), horsBornes(c)]);
    }
    if (c.type === "montant") {
      cas.push([`« ${c.libelle} » à trois décimales`, c.nom, q("12,345"), MESSAGE_MONTANT(c)]);
      const hors = c.max !== null && c.max < 9999999.99 ? Math.round(c.max * 100) + 1 : c.min !== null && c.min > 0 ? Math.round(c.min * 100) - 1 : null;
      if (horsBornes(c) && hors !== null) {
        cas.push([`« ${c.libelle} » hors de ses bornes`, c.nom, q(`${Math.trunc(hors / 100)},${String(hors % 100).padStart(2, "0")}`), horsBornes(c)]);
      }
    }
    if (c.type === "date") cas.push([`« ${c.libelle} » au 30 février`, c.nom, q("2026-02-30"), MESSAGE_DATE]);
    if (c.type === "choix") cas.push([`« ${c.libelle} » hors de la liste`, c.nom, q("inconnu"), MESSAGE_CHOIX]);
  }
  return lignes(
    `// ${chemins(e).testSchema}`,
    `import type { ${Sujet}Vue } from "${IMPORT.entite(e)}";`,
    'import { describe, expect, it } from "vitest";',
    `import { donnees${Sujet}, type ${Sujet}Entree, ${sujetCamel}EnSaisie, ${sujetCamel}Schema } from "../${e.sujet}.schema";`,
    "",
    `const VALIDE: ${Sujet}Entree = {`,
    valide,
    "};",
    "",
    "/** Les messages d'erreur d'une saisie, précédés du champ concerné. */",
    "function messages(valeurs: Record<string, unknown>) {",
    `  const resultat = ${sujetCamel}Schema.safeParse(valeurs);`,
    "  return resultat.success",
    "    ? []",
    '    : resultat.error.issues.map((p) => `${p.path.join(".")} : ${p.message}`);',
    "}",
    "",
    `describe(${q(`Schéma ${g.du()}`)}, () => {`,
    `  it(${titreTest(us, "une saisie complète est acceptée et convertie pour la base")}, () => {`,
    `    expect(${sujetCamel}Schema.parse(VALIDE)).toEqual({`,
    attendu,
    "    });",
    "  });",
    "",
    obligatoires.length
      ? lignes(
          "  it.each([",
          obligatoires.map((c) => `    [${q(c.nom)}, ${q(remplir(c))}],`),
          `  ])(${titreTest(us, "« %s » vide est refusé, avec un seul message")}, (champ, message) => {`,
          '    expect(messages({ ...VALIDE, [champ]: "" })).toEqual([`${champ} : ${message}`]);',
          "  });",
          "",
        )
      : null,
    facultatifs.length
      ? lignes(
          `  it(${titreTest(us, "un champ facultatif laissé vide est enregistré vide")}, () => {`,
          `    const ${sujetCamel} = ${sujetCamel}Schema.parse({`,
          "      ...VALIDE,",
          facultatifs.map((c) => `      ${c.nom}: "",`),
          "    });",
          facultatifs.map((c) => `    expect(${sujetCamel}.${c.nom}).toBeNull();`),
          "  });",
          "",
        )
      : null,
    cas.length
      ? lignes(
          "  it.each([",
          cas.map(([titre, champ, valeur, message]) => `    [${q(titre)}, ${q(champ)}, ${valeur}, ${q(message)}],`),
          `  ])(${titreTest(us, "%s : refusé, avec un seul message")}, (_cas, champ, valeur, message) => {`,
          "    expect(messages({ ...VALIDE, [champ]: valeur })).toEqual([`${champ} : ${message}`]);",
          "  });",
          "",
        )
      : null,
    `  it(${titreTest(us, `${g.un()} ${g.accord("enregistré")} revient dans le formulaire tel${e.feminin ? "le" : ""} qu'${e.feminin ? "elle" : "il"} a été ${g.accord("saisi")}`)}, () => {`,
    `    const ${sujetCamel}: ${Sujet}Vue = {`,
    '      id: "0b8f7c4e-6a1d-4c2b-9f3e-2d5a7b9c1e04",',
    '      utilisateurId: "camille",',
    '      creeLe: new Date("2026-03-09T10:00:00Z"),',
    `      ...donnees${Sujet}(${sujetCamel}Schema.parse(VALIDE)),`,
    "    };",
    `    expect(${sujetCamel}EnSaisie(${sujetCamel})).toEqual(VALIDE);`,
    "  });",
    "});",
    "",
  );
}

/** Trois valeurs croissantes, enregistrées, d'un champ triable (ou null si ses bornes n'en laissent pas trois). */
function troisValeurs(c) {
  if (c.type === "date") return ["2026-01-10T12:00:00.000Z", "2026-02-10T12:00:00.000Z", "2026-03-10T12:00:00.000Z"];
  const facteur = c.type === "montant" ? 100 : 1;
  const min = c.min === null ? null : Math.round(c.min * facteur);
  const max = c.max === null ? null : Math.round(c.max * facteur);
  const pas = facteur;
  let depart = Math.max(min ?? pas, pas);
  if (max !== null && depart + 2 * pas > max) depart = min ?? max - 2 * pas;
  const valeurs = [depart, depart + pas, depart + 2 * pas];
  if ((min !== null && valeurs[0] < min) || (max !== null && valeurs[2] > max)) return null;
  return valeurs;
}

function testRepository(e, us) {
  const { Sujet, Pluriel, plurielCamel: t } = e.n;
  const g = e.g;
  const titre = e.champTitre;
  const choix = e.champs.find((c) => c.type === "choix");
  const triable = e.champs.find((c) => c.triable && troisValeurs(c));
  const facultatifs = e.champs.filter((c) => c.nullable);
  const surTitre = (v) => `{ ${titre.cle}: ${q(v)} }`;
  const liste = (v) => `(await depot.lister(${q(v)}, FILTRES)).${t}`;
  return lignes(
    `// ${chemins(e).testRepository}`,
    `import type { Donnees${Sujet} } from "${IMPORT.entite(e)}";`,
    'import { user } from "@src/db/compte/auth.table";',
    'import type { Db } from "@src/db/db-client";',
    'import { afterEach, beforeEach, describe, expect, it } from "vitest";',
    'import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";',
    `import { Drizzle${Sujet}Repository, type FiltresListe${Pluriel} } from "../${e.sujet}.repository";`,
    "",
    `const DONNEES: Donnees${Sujet} = {`,
    e.champs.map((c) => `  ${c.cle}: ${litteralBase(c)},`),
    "};",
    "",
    `const FILTRES: FiltresListe${Pluriel} = {`,
    '  recherche: "",',
    e.champs.filter((c) => c.type === "choix").map((c) => `  ${c.cle}: null,`),
    '  tri: "recentes",',
    "  page: 1,",
    "  taillePage: 10,",
    "};",
    "",
    "let db: Db;",
    "let fermer: () => Promise<void>;",
    `let depot: Drizzle${Sujet}Repository;`,
    "",
    "// Une base PGlite neuve par test, avec les vraies migrations de drizzle/.",
    "beforeEach(async () => {",
    "  ({ db, fermer } = await creerBaseDeTest());",
    "  await db.insert(user).values([",
    '    { id: "camille", name: "Camille", email: "camille@exemple.fr" },',
    '    { id: "leo", name: "Léo", email: "leo@exemple.fr" },',
    "  ]);",
    `  depot = new Drizzle${Sujet}Repository(db);`,
    "});",
    "",
    "afterEach(async () => {",
    "  await fermer();",
    "});",
    "",
    `function ajouter(utilisateurId: string, surcharges: Partial<Donnees${Sujet}> = {}) {`,
    "  return depot.inserer(utilisateurId, { ...DONNEES, ...surcharges });",
    "}",
    "",
    `describe(${q(`Drizzle${Sujet}Repository : créer, relire, modifier, supprimer`)}, () => {`,
    `  it(${titreTest(us, `${g.un()} ${g.accord("créé")} se relit et figure dans la liste de sa propriétaire`)}, async () => {`,
    `    const { id } = await ajouter("camille");`,
    "",
    '    expect((await depot.trouver(id, "camille"))?.versVue()).toEqual(',
    '      expect.objectContaining({ id, utilisateurId: "camille", ...DONNEES }),',
    "    );",
    `    const { ${t}: lignes, total } = await depot.lister("camille", FILTRES);`,
    "    expect(lignes.map((l) => l.id)).toEqual([id]);",
    "    expect(total).toBe(1);",
    "  });",
    "",
    `  it(${titreTest(us, "une modification remplace les valeurs enregistrées")}, async () => {`,
    '    const { id } = await ajouter("camille");',
    `    const nouvelles = { ...DONNEES, ${titre.cle}: "Café Leroy" };`,
    "",
    '    expect(await depot.modifier(id, "camille", nouvelles)).toBe(true);',
    "",
    '    expect((await depot.trouver(id, "camille"))?.versVue()).toEqual(',
    "      expect.objectContaining(nouvelles),",
    "    );",
    "  });",
    "",
    `  it(${titreTest(us, `${g.un()} ${g.accord("supprimé")} disparaît`)}, async () => {`,
    '    const { id } = await ajouter("camille");',
    "",
    '    expect(await depot.supprimer(id, "camille")).toBe(true);',
    "",
    '    expect(await depot.trouver(id, "camille")).toBeNull();',
    `    expect(${liste("camille")}).toEqual([]);`,
    "  });",
    facultatifs.length
      ? lignes(
          "",
          `  it(${titreTest(us, "un champ facultatif vide est enregistré vide")}, async () => {`,
          `    const { id } = await ajouter("camille", { ${facultatifs.map((c) => `${c.cle}: null`).join(", ")} });`,
          "",
          '    expect((await depot.trouver(id, "camille"))?.versVue()).toEqual(',
          `      expect.objectContaining({ ${facultatifs.map((c) => `${c.cle}: null`).join(", ")} }),`,
          "    );",
          "  });",
        )
      : null,
    "});",
    "",
    `describe(${q(`@securite – chaque personne n'atteint que ses propres ${e.libellePluriel}`)}, () => {`,
    `  it(${titreTest(us, `Léo ne voit pas ${g.le()} de Camille dans sa liste`)}, async () => {`,
    '    await ajouter("camille");',
    "",
    `    expect(${liste("leo")}).toEqual([]);`,
    "  });",
    "",
    `  it(${titreTest(us, `Léo ne lit pas ${g.le()} de Camille`)}, async () => {`,
    '    const { id } = await ajouter("camille");',
    "",
    '    expect(await depot.trouver(id, "leo")).toBeNull();',
    "  });",
    "",
    `  it(${titreTest(us, `Léo ne modifie pas ${g.le()} de Camille`)}, async () => {`,
    '    const { id } = await ajouter("camille");',
    "",
    `    expect(await depot.modifier(id, "leo", { ...DONNEES, ${titre.cle}: "Modifié par Léo" })).toBe(false);`,
    "",
    '    expect((await depot.trouver(id, "camille"))?.versVue()).toEqual(',
    "      expect.objectContaining(DONNEES),",
    "    );",
    "  });",
    "",
    `  it(${titreTest(us, `Léo ne supprime pas ${g.le()} de Camille`)}, async () => {`,
    '    const { id } = await ajouter("camille");',
    "",
    '    expect(await depot.supprimer(id, "leo")).toBe(false);',
    "",
    '    expect(await depot.trouver(id, "camille")).not.toBeNull();',
    "  });",
    "});",
    "",
    `describe(${q(`Drizzle${Sujet}Repository.lister : recherche, filtres, tri, pages`)}, () => {`,
    `  it(${titreTest(us, "la recherche ignore les majuscules")}, async () => {`,
    `    await ajouter("camille", ${surTitre("Atelier Dupont")});`,
    `    await ajouter("camille", ${surTitre("Boulangerie Martin")});`,
    "",
    `    const { ${t}: lignes } = await depot.lister("camille", { ...FILTRES, recherche: "dupont" });`,
    "",
    `    expect(lignes.map((l) => l.${titre.cle})).toEqual(["Atelier Dupont"]);`,
    "  });",
    "",
    `  it(${titreTest(us, "les signes %, _ et \\ sont cherchés comme des caractères")}, async () => {`,
    `    await ajouter("camille", ${surTitre("Remise 100%")});`,
    `    await ajouter("camille", ${surTitre("Remise 1000")});`,
    `    await ajouter("camille", ${surTitre("Client_1")});`,
    `    await ajouter("camille", ${surTitre("Client11")});`,
    `    await ajouter("camille", ${surTitre("Atelier\\Dupont")});`,
    `    await ajouter("camille", ${surTitre("Atelier Dupont")});`,
    "",
    `    const cherche = async (recherche: string) => (await depot.lister("camille", { ...FILTRES, recherche })).${t}.map((l) => l.${titre.cle});`,
    "",
    '    expect(await cherche("100%")).toEqual(["Remise 100%"]);',
    '    expect(await cherche("Client_1")).toEqual(["Client_1"]);',
    `    expect(await cherche(${q("Atelier\\Dupont")})).toEqual([${q("Atelier\\Dupont")}]);`,
    "  });",
    choix
      ? lignes(
          "",
          `  it(${titreTest(us, `le filtre « ${choix.libelle} » ne garde que la valeur choisie`)}, async () => {`,
          `    await ajouter("camille", { ${titre.cle}: "Atelier Dupont", ${choix.cle}: ${q(choix.valeurs[0].cle)} });`,
          `    await ajouter("camille", { ${titre.cle}: "Café Leroy", ${choix.cle}: ${q(choix.valeurs[1].cle)} });`,
          "",
          `    const { ${t}: lignes } = await depot.lister("camille", { ...FILTRES, ${choix.cle}: ${q(choix.valeurs[1].cle)} });`,
          "",
          `    expect(lignes.map((l) => l.${titre.cle})).toEqual(["Café Leroy"]);`,
          "  });",
        )
      : null,
    triable
      ? lignes(
          "",
          `  it(${titreTest(us, `le tri « ${triable.libelle} » range ${triable.type === "date" ? "du plus tard au plus tôt" : "du plus grand au plus petit"}`)}, async () => {`,
          troisValeurs(triable).map((v, i, tout) => `    await ajouter("camille", { ${titre.cle}: ${q(`Élément ${[2, 1, 3][i]}`)}, ${triable.cle}: ${litteralBase(triable, tout[[1, 0, 2][i]])} });`),
          "",
          `    const { ${t}: lignes } = await depot.lister("camille", { ...FILTRES, tri: ${q(`${triable.kebab}-desc`)} });`,
          "",
          `    expect(lignes.map((l) => l.${triable.cle})).toEqual([${[...troisValeurs(triable)].reverse().map((v) => litteralBase(triable, v)).join(", ")}]);`,
          "  });",
        )
      : null,
    "",
    `  it(${titreTest(us, `12 ${e.libellePluriel} : 10 en page 1, 2 en page 2`)}, async () => {`,
    "    for (let numero = 1; numero <= 12; numero++) {",
    `      await ajouter("camille", { ${titre.cle}: \`Élément \${numero}\` });`,
    "    }",
    "",
    `    const page1 = await depot.lister("camille", FILTRES);`,
    `    const page2 = await depot.lister("camille", { ...FILTRES, page: 2 });`,
    "",
    `    expect(page1.${t}).toHaveLength(10);`,
    `    expect(page2.${t}).toHaveLength(2);`,
    "    expect(page2.total).toBe(12);",
    "  });",
    "});",
    "",
  );
}

function testE2e(e, us) {
  const g = e.g;
  const titre = e.champTitre;
  const aRemplir = e.champs.filter((c) => c !== titre && c.obligatoire && ["texte", "texte-long", "nombre", "montant", "date"].includes(c.type));
  const L = majuscule(e.libelle);
  return lignes(
    `// ${chemins(e).e2e}`,
    'import { expect, type Page, test } from "@playwright/test";',
    'import { champ, connecterNouvelUtilisateur } from "./aides/connexion";',
    "",
    `/** Remplit les champs obligatoires ${e.feminin ? "d'une" : "d'un"} ${e.libelle}. */`,
    "async function remplir(page: Page, titre: string) {",
    `  await champ(page, ${q(libelleDuChamp(titre))}).fill(titre);`,
    aRemplir.map((c) => `  await champ(page, ${q(libelleDuChamp(c))}).fill(${q(c.exemple.saisie)});`),
    "}",
    "",
    `test.describe(${q(`Mes ${e.libellePluriel}`)}, () => {`,
    "  test.beforeEach(async ({ page }) => {",
    "    await connecterNouvelUtilisateur(page);",
    `    await page.goto(${q(e.route)});`,
    `    await expect(page.getByRole("heading", { name: ${q(`Mes ${e.libellePluriel}`)} })).toBeVisible();`,
    "  });",
    "",
    `  test(${titreTest(us, `créer, modifier puis supprimer ${g.un()}`)}, async ({ page }) => {`,
    `    await expect(page.getByText(${q(`Vous n'avez pas encore ${g.de()}.`)})).toBeVisible();`,
    "",
    '    await remplir(page, "Atelier Dupont");',
    `    await page.getByRole("button", { name: ${q(`Créer ${g.le()}`)} }).click();`,
    `    await expect(page.getByText(${q(`${L} « Atelier Dupont » ${g.accord("créé")}.`)})).toBeVisible();`,
    '    await expect(page.getByRole("row", { name: /Atelier Dupont/ })).toBeVisible();',
    "",
    '    await page.getByRole("row", { name: /Atelier Dupont/ }).getByRole("link", { name: /Modifier/ }).click();',
    `    await expect(page.getByRole("heading", { name: ${q(`Modifier ${g.le()}`)} })).toBeVisible();`,
    `    await expect(champ(page, ${q(libelleDuChamp(titre))})).toHaveValue("Atelier Dupont");`,
    `    await champ(page, ${q(libelleDuChamp(titre))}).fill("Café Leroy");`,
    `    await page.getByRole("button", { name: ${q(`Enregistrer ${g.le()}`)} }).click();`,
    `    await expect(page.getByText(${q(`${L} « Café Leroy » ${g.accord("modifié")}.`)})).toBeVisible();`,
    `    await expect(page.getByRole("heading", { name: ${q(`Mes ${e.libellePluriel}`)} })).toBeVisible();`,
    '    const ligne = page.getByRole("row", { name: /Café Leroy/ });',
    "    await expect(ligne).toBeVisible();",
    "",
    '    await ligne.getByRole("button", { name: /Supprimer/ }).click();',
    `    const fenetre = page.getByRole("alertdialog", { name: ${q(`Supprimer ${g.le()} « Café Leroy » ?`)} });`,
    "    await expect(fenetre).toBeVisible();",
    `    await fenetre.getByRole("button", { name: ${q(`Supprimer ${g.le()}`)} }).click();`,
    `    await expect(page.getByText(${q(`${L} « Café Leroy » ${g.accord("supprimé")}.`)})).toBeVisible();`,
    `    await expect(page.getByText(${q(`Vous n'avez pas encore ${g.de()}.`)})).toBeVisible();`,
    "  });",
    "});",
    "",
  );
}

// ---------------------------------------------------------------- aides communes (src/lib/helpers/)

const COMMUNS = {
  pagination: {
    chemin: "src/lib/helpers/pagination/pagination.ts",
    commun: ["pageValide", "decalagePourPage", "nombreDePages"],
    contenu: lignes(
      "// src/lib/helpers/pagination/pagination.ts",
      "/** Une page reçue dans l'adresse : entier à partir de 1, sinon 1. */",
      "export function pageValide(page: number): number {",
      "  return Number.isInteger(page) && page >= 1 ? page : 1;",
      "}",
      "",
      "export function decalagePourPage(page: number, taillePage: number): number {",
      "  return (pageValide(page) - 1) * taillePage;",
      "}",
      "",
      "export function nombreDePages(total: number, taillePage: number): number {",
      "  return Math.max(1, Math.ceil(total / taillePage));",
      "}",
      "",
    ),
  },
  testPagination: {
    chemin: "src/lib/helpers/pagination/__tests__/pagination.test.ts",
    commun: [],
    contenu: lignes(
      "// src/lib/helpers/pagination/__tests__/pagination.test.ts",
      'import { describe, expect, it } from "vitest";',
      'import { decalagePourPage, nombreDePages, pageValide } from "../pagination";',
      "",
      'describe("Pagination", () => {',
      "  it.each([",
      "    [0, 1],",
      "    [10, 1],",
      "    [11, 2],",
      '  ])("%i éléments font %i page(s)", (total, pages) => {',
      "    expect(nombreDePages(total, 10)).toBe(pages);",
      "  });",
      "",
      '  it("une page invalide revient à la page 1", () => {',
      "    expect(pageValide(-3)).toBe(1);",
      "    expect(pageValide(2.5)).toBe(1);",
      "    expect(decalagePourPage(-3, 10)).toBe(0);",
      "    expect(decalagePourPage(2, 10)).toBe(10);",
      "  });",
      "});",
      "",
    ),
  },
  format: {
    chemin: "src/lib/helpers/format/format.ts",
    commun: ["formaterMontant", "formaterDate"],
    contenu: lignes(
      "// src/lib/helpers/format/format.ts",
      'const formatEuros = new Intl.NumberFormat("fr-FR", {',
      '  style: "currency",',
      '  currency: "EUR",',
      "});",
      "",
      "export function formaterMontant(centimes: number): string {",
      "  return formatEuros.format(centimes / 100);",
      "}",
      "",
      'const formatDate = new Intl.DateTimeFormat("fr-FR", {',
      '  dateStyle: "long",',
      '  timeZone: "Europe/Paris",',
      "});",
      "",
      "/** Affiche une date à l'heure de Paris, quel que soit le fuseau du serveur. */",
      "export function formaterDate(date: Date): string {",
      "  return formatDate.format(date);",
      "}",
      "",
    ),
  },
  testFormat: {
    chemin: "src/lib/helpers/format/__tests__/format.test.ts",
    commun: [],
    contenu: lignes(
      "// src/lib/helpers/format/__tests__/format.test.ts",
      'import { describe, expect, it } from "vitest";',
      'import { formaterDate, formaterMontant } from "../format";',
      "",
      "/** Intl sépare le montant et « € » par une espace insécable : on la remplace pour comparer. */",
      'const espacesSimples = (texte: string) => texte.replace(/\\s/g, " ");',
      "",
      'describe("Affichage", () => {',
      '  it("12050 centimes s\'affichent « 120,50 € »", () => {',
      '    expect(espacesSimples(formaterMontant(12050))).toBe("120,50 €");',
      "  });",
      "",
      '  it("une date s\'affiche à l\'heure de Paris", () => {',
      '    expect(formaterDate(new Date("2026-03-09T23:30:00Z"))).toBe("10 mars 2026");',
      "  });",
      "});",
      "",
    ),
  },
  nombre: {
    chemin: "src/lib/helpers/format/nombre.ts",
    commun: ["formaterNombre"],
    contenu: lignes(
      "// src/lib/helpers/format/nombre.ts",
      'const formatNombre = new Intl.NumberFormat("fr-FR");',
      "",
      "/** Un nombre écrit à la française : 1234 → « 1 234 ». */",
      "export function formaterNombre(nombre: number): string {",
      "  return formatNombre.format(nombre);",
      "}",
      "",
    ),
  },
  testNombre: {
    chemin: "src/lib/helpers/format/__tests__/nombre.test.ts",
    commun: [],
    contenu: lignes(
      "// src/lib/helpers/format/__tests__/nombre.test.ts",
      'import { describe, expect, it } from "vitest";',
      'import { formaterNombre } from "../nombre";',
      "",
      'describe("Affichage d\'un nombre", () => {',
      '  it("1234 s\'affiche « 1 234 »", () => {',
      '    expect(formaterNombre(1234).replace(/\\s/g, " ")).toBe("1 234");',
      "  });",
      "});",
      "",
    ),
  },
  erreurs: {
    chemin: "src/lib/helpers/formulaire/erreurs-de-champs.ts",
    commun: ["erreursDeChamps"],
    contenu: lignes(
      "// src/lib/helpers/formulaire/erreurs-de-champs.ts",
      "type ErreursFormatees<C extends string> = Partial<",
      "  Record<C, { _errors?: string[] }>",
      ">;",
      "",
      "/** Transforme les erreurs de validation de next-safe-action (forme formatée) en erreurs de champ pour TanStack Form. */",
      "export function erreursDeChamps<C extends string>(",
      "  champs: readonly C[],",
      "  erreurs: ErreursFormatees<C>,",
      "): Partial<Record<C, { message: string }>> {",
      "  const resultat: Partial<Record<C, { message: string }>> = {};",
      "  for (const champ of champs) {",
      "    const message = erreurs[champ]?._errors?.[0];",
      "    if (message) resultat[champ] = { message };",
      "  }",
      "  return resultat;",
      "}",
      "",
    ),
  },
  testErreurs: {
    chemin: "src/lib/helpers/formulaire/__tests__/erreurs-de-champs.test.ts",
    commun: [],
    contenu: lignes(
      "// src/lib/helpers/formulaire/__tests__/erreurs-de-champs.test.ts",
      'import { describe, expect, it } from "vitest";',
      'import { erreursDeChamps } from "../erreurs-de-champs";',
      "",
      'describe("erreursDeChamps", () => {',
      '  it("les erreurs du serveur deviennent des erreurs de champ", () => {',
      "    expect(",
      '      erreursDeChamps(["client", "montant"], {',
      '        montant: { _errors: ["Le montant doit être supérieur à 0 €."] },',
      "      }),",
      "    ).toEqual({",
      '      montant: { message: "Le montant doit être supérieur à 0 €." },',
      "    });",
      "  });",
      "});",
      "",
    ),
  },
  saisie: {
    chemin: "src/lib/helpers/saisie/saisie.ts",
    commun: ["FORMAT_MONTANT", "FORMAT_ENTIER", "eurosEnCentimes", "centimesEnSaisie", "saisieEnDate", "estSaisieDeDate", "dateEnSaisie", "videEnNull"],
    contenu: lignes(
      "// src/lib/helpers/saisie/saisie.ts",
      "// Conversions entre ce que la personne écrit dans un champ et la valeur enregistrée (sans règle métier).",
      "",
      "/** Montant saisi en euros : 120 ; 120,5 ; 120.50 (7 chiffres avant la virgule au plus). */",
      "export const FORMAT_MONTANT = /^\\d{1,7}([.,]\\d{1,2})?$/;",
      "",
      "/** Nombre entier saisi : 12 ; -3 (9 chiffres au plus : il tient dans une colonne integer). */",
      "export const FORMAT_ENTIER = /^-?\\d{1,9}$/;",
      "",
      "const FORMAT_DATE = /^(\\d{4})-(\\d{2})-(\\d{2})$/;",
      "",
      "/** « 120,50 » → 12050 centimes, en découpant la saisie (0.29 * 100 donnerait 28.999999999999996) ; NaN hors format. */",
      "export function eurosEnCentimes(saisie: string): number {",
      "  const valeur = saisie.trim();",
      "  if (!FORMAT_MONTANT.test(valeur)) return Number.NaN;",
      '  const [euros, decimales = ""] = valeur.split(/[.,]/);',
      '  return Number(euros) * 100 + Number(decimales.padEnd(2, "0"));',
      "}",
      "",
      "/** 12050 centimes → « 120,50 », la forme du champ de saisie. */",
      "export function centimesEnSaisie(centimes: number): string {",
      '  return `${Math.trunc(centimes / 100)},${String(centimes % 100).padStart(2, "0")}`;',
      "}",
      "",
      "/**",
      " * Un jour du calendrier saisi dans un champ type=\"date\" (« 2026-03-10 »), enregistré à midi UTC :",
      " * le même jour à Paris, en été comme en hiver. Une date qui n'existe pas (30 février) donne une date invalide.",
      " */",
      "export function saisieEnDate(saisie: string): Date {",
      "  const morceaux = FORMAT_DATE.exec(saisie);",
      "  if (!morceaux) return new Date(Number.NaN);",
      "  const [annee, mois, jour] = morceaux.slice(1).map(Number);",
      "  const date = new Date(Date.UTC(annee, mois - 1, jour, 12));",
      "  const existe =",
      "    date.getUTCFullYear() === annee &&",
      "    date.getUTCMonth() === mois - 1 &&",
      "    date.getUTCDate() === jour;",
      "  return existe ? date : new Date(Number.NaN);",
      "}",
      "",
      "export function estSaisieDeDate(saisie: string): boolean {",
      "  return !Number.isNaN(saisieEnDate(saisie).getTime());",
      "}",
      "",
      'const formatJour = new Intl.DateTimeFormat("fr-FR", {',
      '  timeZone: "Europe/Paris",',
      '  year: "numeric",',
      '  month: "2-digit",',
      '  day: "2-digit",',
      "});",
      "",
      "/** Une date enregistrée → « 2026-03-10 » (le jour à Paris), la forme du champ type=\"date\". */",
      "export function dateEnSaisie(date: Date): string {",
      "  const parties = Object.fromEntries(",
      "    formatJour.formatToParts(date).map((p) => [p.type, p.value]),",
      "  );",
      "  return `${parties.year}-${parties.month}-${parties.day}`;",
      "}",
      "",
      "/** Un champ facultatif laissé vide s'enregistre vide (null), pas en texte vide. */",
      "export function videEnNull(texte: string): string | null {",
      '  return texte === "" ? null : texte;',
      "}",
      "",
    ),
  },
  testSaisie: {
    chemin: "src/lib/helpers/saisie/__tests__/saisie.test.ts",
    commun: [],
    contenu: lignes(
      "// src/lib/helpers/saisie/__tests__/saisie.test.ts",
      'import { describe, expect, it } from "vitest";',
      "import {",
      "  centimesEnSaisie,",
      "  dateEnSaisie,",
      "  estSaisieDeDate,",
      "  eurosEnCentimes,",
      "  saisieEnDate,",
      "  videEnNull,",
      '} from "../saisie";',
      "",
      'describe("Montants saisis", () => {',
      "  it.each([",
      '    ["120,50", 12050],',
      '    ["120.5", 12050],',
      '    ["0,05", 5],',
      '    ["45", 4500],',
      '  ])("« %s » vaut %i centimes", (saisie, centimes) => {',
      "    expect(eurosEnCentimes(saisie)).toBe(centimes);",
      "  });",
      "",
      '  it("une saisie hors format ne donne pas de montant", () => {',
      '    expect(eurosEnCentimes("abc")).toBeNaN();',
      '    expect(eurosEnCentimes("12,345")).toBeNaN();',
      "  });",
      "",
      "  it.each([",
      '    [12050, "120,50"],',
      '    [5, "0,05"],',
      '    [4500, "45,00"],',
      '  ])("%i centimes reviennent dans le champ en « %s »", (centimes, saisie) => {',
      "    expect(centimesEnSaisie(centimes)).toBe(saisie);",
      "  });",
      "});",
      "",
      'describe("Dates saisies", () => {',
      '  it("un jour saisi est enregistré à midi UTC et revient tel quel", () => {',
      '    const date = saisieEnDate("2026-03-10");',
      '    expect(date.toISOString()).toBe("2026-03-10T12:00:00.000Z");',
      '    expect(dateEnSaisie(date)).toBe("2026-03-10");',
      "  });",
      "",
      '  it("un jour d\'été garde sa date à Paris", () => {',
      '    expect(dateEnSaisie(saisieEnDate("2026-07-14"))).toBe("2026-07-14");',
      "  });",
      "",
      '  it.each(["2026-02-30", "2026-13-01", "10/03/2026", ""])(',
      '    "« %s » n\'est pas une date",',
      "    (saisie) => {",
      "      expect(estSaisieDeDate(saisie)).toBe(false);",
      "    },",
      "  );",
      "});",
      "",
      'describe("Champs facultatifs", () => {',
      '  it("un texte vide devient null, un texte écrit reste", () => {',
      '    expect(videEnNull("")).toBeNull();',
      '    expect(videEnNull("Bonjour")).toBe("Bonjour");',
      "  });",
      "});",
      "",
    ),
  },
};

/** Les fichiers d'une entité validée (entite.js) : { chemin, contenu, commun? }. */
function genererFichiers(e, { us = null } = {}) {
  const c = chemins(e);
  const g = e.g;
  const propres = [
    [c.entite, entite(e)],
    [c.erreurs, erreurs(e)],
    [c.port, port(e)],
    [c.table, table(e)],
    [c.repository, repository(e)],
    [c.testRepository, testRepository(e, us)],
    [c.constantes, constantes(e)],
    [c.messages, messages(e)],
    [c.schema, schema(e)],
    [c.testSchema, testSchema(e, us)],
    [c.filtres, filtres(e)],
    [c.lister, lister(e)],
    [c.trouver, trouver(e)],
    [c.creer, creer(e)],
    [c.modifier, modifier(e)],
    [c.supprimer, supprimer(e)],
    [c.formulaire, formulaire(e)],
    [c.tableau, tableau(e)],
    [c.creation, creation(e)],
    [c.modification, modification(e)],
    [c.edition, edition(e)],
    [c.suppression, suppression(e)],
    [c.filtresContainer, filtresContainer(e)],
    [c.pagination, pagination(e)],
    [c.liste, liste(e)],
    [c.page, page(e)],
    [c.erreurPage, pageErreur(e, c.erreurPage, `${majuscule(`les ${e.libellePluriel}`)} n'ont pas pu être ${g.accord("chargé")}s.`, `Erreur${e.n.Pluriel}`)],
    [c.pageId, pageId(e)],
    [c.erreurPageId, pageErreur(e, c.erreurPageId, `${majuscule(g.le())} n'a pas pu être ${g.accord("chargé")}.`, `Erreur${e.n.Sujet}`)],
    [c.e2e, testE2e(e, us)],
  ].map(([chemin, contenu]) => ({ chemin, contenu }));
  const avecNombre = e.champs.some((x) => x.type === "nombre");
  const communs = [COMMUNS.pagination, COMMUNS.testPagination, COMMUNS.format, COMMUNS.testFormat, ...(avecNombre ? [COMMUNS.nombre, COMMUNS.testNombre] : []), COMMUNS.erreurs, COMMUNS.testErreurs, COMMUNS.saisie, COMMUNS.testSaisie];
  return [...propres, ...communs.map((x) => ({ ...x }))];
}

module.exports = { genererFichiers, chemins, schemaDuChamp, COMMUNS };

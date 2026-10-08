# Recette : liste

> Quand l'utiliser : la personne connectée consulte ses propres éléments (ici ses factures) dans une liste filtrable, triable et paginée, et en ajoute de nouveaux depuis la même page.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`) : `next.config.ts` contient `cacheComponents: true`, `partialPrefetching: true` et `reactCompiler: true` ; `src/db/index.ts` exporte `getDb()` et le type `Db` ; `src/core/shared/result.ts` fournit `Result`, `ok()` et `echec()` ; `tests/helpers/base-de-test.ts` fournit `creerBaseDeTest()` ; `vitest.config.ts` tourne en environnement `node`, avec les alias `@src` et `@app`, et remplace `server-only` par un module vide.
- La recette `connexion` est faite (`pulse-aidd pile recette connexion`). Elle fournit :
  - `utilisateurConnecte()` dans `src/features/compte/queries/utilisateur-connecte.query.ts` (`server-only`, `React.cache`) : renvoie `{ id, nom }`, ou redirige vers `/connexion` sans session ; elle s'appelle dans un container placé sous `<Suspense>` ;
  - `actionConnectee` dans `src/lib/safe-action.ts`, qui fournit `ctx.utilisateur` = `{ id, nom }` et garde la forme d'erreurs de validation par défaut de next-safe-action (forme « formatée » : `{ champ: { _errors: [...] } }`) ;
  - `getAuth()` dans `src/adapters/auth/auth.adapter.ts` et la table `user` dans `src/db/compte/auth.table.ts` ;
  - le groupe de routes `app/(connecte)/` et le renvoi rapide `proxy.ts` (racine du projet) ;
  - l'aide de test `e2e/aides/connexion.ts` (fonctions `connecterNouvelUtilisateur(page)` et `champ(page, libellé)`).
- Paquets du squelette : `next`, `react`, `next-safe-action`, `zod`, `@tanstack/react-form`, `nuqs`, `drizzle-orm`, `sonner` (recette vérifiée avec les versions du squelette du 2026-10-08). Pour les tests : `vitest`, `@electric-sql/pglite`, `@playwright/test`. Si l'un manque, l'installer à sa dernière version : `npm install <paquet>`.
- Composants shadcn (Base UI) : le squelette fournit déjà `button`, `card`, `field`, `input`, `label`, `separator`, `skeleton`, `sonner`. Ajoutez ceux de la liste : `npx shadcn@latest add native-select table badge`.
- Le layout racine (`app/layout.tsx`) contient déjà `NuqsAdapter` (`nuqs/adapters/next/app`) et `<Toaster />` (`@src/components/ui/sonner`) ; ajoutez `<Toaster />` après `{children}` s'il manque.

## Variables d'environnement

Aucune nouvelle variable. La recette utilise la base déjà configurée par le squelette (`DATABASE_URL`).

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/core/factures/facture.entity.ts` | Type `Facture`, statuts et tris possibles |
| `src/core/factures/facture.errors.ts` | Codes des erreurs attendues |
| `src/core/factures/facture.rules.ts` | Règles du montant : format, conversion en centimes, montant positif |
| `src/core/factures/facture-repository.port.ts` | Ce dont le use-case a besoin pour enregistrer une facture |
| `src/core/factures/use-cases/creer-facture.use-case.ts` | Use-case « créer une facture » |
| `src/lib/helpers/pagination/pagination.ts` | Page valide, décalage, nombre de pages |
| `src/lib/helpers/format/format.ts` | Montant en euros et date à l'heure de Paris |
| `src/lib/helpers/formulaire/erreurs-de-champs.ts` | Erreurs de validation du serveur → erreurs de champ |
| `src/db/factures/facture.table.ts` | Table Drizzle `factures` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée par `npm run db:generate` |
| `src/db/factures/facture.repository.ts` | `factureRepository(db)` : `lister`, `inserer`, condition de propriété |
| `src/features/factures/constants/factures.ts` | Libellés des statuts et des tris, filtres de statut, taille de page, noms des champs |
| `src/features/factures/constants/erreur-messages.ts` | Message affiché pour chaque code d'erreur |
| `src/features/factures/schemas/facture.schema.ts` | Schéma Zod partagé par le formulaire et l'action |
| `src/features/factures/schemas/filtres.schema.ts` | Paramètres d'adresse (nuqs), lus côté serveur et côté client |
| `src/features/factures/queries/lister-factures.query.ts` | Lecture de la liste filtrée (`server-only`) |
| `src/features/factures/actions/creer-facture.action.ts` | Action « créer une facture » (next-safe-action) |
| `src/features/factures/components/sections/formulaire-facture.tsx` | Champs et validation du formulaire (TanStack Form + Field) |
| `src/features/factures/components/sections/tableau-factures.tsx` | Tableau des factures et états vides |
| `src/features/factures/components/containers/creation-facture.container.tsx` | Branche l'action sur le formulaire |
| `src/features/factures/components/containers/filtres-factures.container.tsx` | Contrôles client : statut, recherche, tri |
| `src/features/factures/components/containers/pagination-factures.container.tsx` | Contrôles client : page précédente, page suivante |
| `src/features/factures/components/containers/liste-factures.container.tsx` | Container serveur : lit la session, les filtres et la liste |
| `app/(connecte)/factures/page.tsx` | La page, avec ses zones `<Suspense>` |
| `app/(connecte)/factures/error.tsx` | État d'erreur de la page |
| `proxy.ts` (modifié) | Ajoute `/factures` au renvoi rapide vers `/connexion` |
| `src/core/factures/__tests__/facture.rules.test.ts` | Tests unitaires des règles du montant |
| `src/core/factures/__tests__/creer-facture.use-case.test.ts` | Tests unitaires du use-case (doublure en mémoire) |
| `src/lib/helpers/pagination/__tests__/pagination.test.ts` | Tests unitaires de la pagination |
| `src/lib/helpers/format/__tests__/format.test.ts` | Tests unitaires de l'affichage des montants et des dates |
| `src/lib/helpers/formulaire/__tests__/erreurs-de-champs.test.ts` | Tests unitaires des erreurs de champ |
| `src/features/factures/schemas/__tests__/facture.schema.test.ts` | Tests unitaires du schéma |
| `src/db/factures/__tests__/facture.repository.test.ts` | Tests d'intégration avec PGlite |
| `e2e/factures.spec.ts` | Test de bout en bout Playwright |

## Étapes

Exemple fil rouge : les **factures** d'une personne connectée. Remplacez `factures` par le mot du glossaire du projet, et `US-XXX` par le numéro de l'US. Le domaine `factures` a ses trois dossiers miroirs : `src/core/factures/` (les règles), `src/db/factures/` (le stockage), `src/features/factures/` (l'écran, l'action, la lecture).

### 1. Le métier : entité, erreurs, règles

Le métier ne dépend de rien d'autre que `src/core/`. Les statuts et les tris y vivent : la table, le repository et l'écran les lisent au même endroit.

```ts
// src/core/factures/facture.entity.ts
export const STATUTS_FACTURE = ["brouillon", "envoyee", "payee"] as const;
export type StatutFacture = (typeof STATUTS_FACTURE)[number];

/** Ordres possibles de la liste : par date de création ou par montant. */
export const TRIS_FACTURES = [
  "recentes",
  "anciennes",
  "montant-desc",
  "montant-asc",
] as const;
export type TriFactures = (typeof TRIS_FACTURES)[number];

export type Facture = {
  id: string;
  utilisateurId: string;
  client: string;
  montantCentimes: number;
  statut: StatutFacture;
  creeLe: Date;
};
```

```ts
// src/core/factures/facture.errors.ts
export type ErreurFacture = "montant-invalide";
```

```ts
// src/core/factures/facture.rules.ts
import { echec, ok, type Result } from "@src/core/shared/result";
import type { ErreurFacture } from "./facture.errors";

/** Format accepté pour un montant saisi en euros : 120 ; 120,5 ; 120.50. */
export const FORMAT_MONTANT = /^\d{1,7}([.,]\d{1,2})?$/;

/** Convertit un montant saisi en euros (« 120,50 ») en centimes entiers (12050), sans calcul à virgule. */
export function eurosEnCentimes(saisie: string): number {
  const valeur = saisie.trim();
  if (!FORMAT_MONTANT.test(valeur)) return Number.NaN;
  const [euros, decimales = ""] = valeur.split(/[.,]/);
  return Number(euros) * 100 + Number(decimales.padEnd(2, "0"));
}

/** Règle du montant : une saisie au bon format, supérieure à 0 €. */
export function montantEnCentimes(
  saisie: string,
): Result<number, ErreurFacture> {
  const centimes = eurosEnCentimes(saisie);
  return centimes > 0 ? ok(centimes) : echec("montant-invalide");
}
```

### 2. Le use-case « créer une facture »

Créer une facture applique une règle métier (le montant positif) : l'écriture passe donc par un use-case (architecture.md §5, point 2). Le port décrit seulement ce dont le use-case a besoin ; le repository de l'étape 5 le fournit.

```ts
// src/core/factures/facture-repository.port.ts
export type FactureRepository = {
  inserer(
    utilisateurId: string,
    donnees: { client: string; montantCentimes: number },
  ): Promise<{ id: string }>;
};
```

```ts
// src/core/factures/use-cases/creer-facture.use-case.ts
import { ok, type Result } from "@src/core/shared/result";
import type { ErreurFacture } from "../facture.errors";
import { montantEnCentimes } from "../facture.rules";
import type { FactureRepository } from "../facture-repository.port";

export async function creerFacture(
  deps: { factures: FactureRepository },
  entree: { utilisateurId: string; client: string; montant: string },
): Promise<Result<{ id: string }, ErreurFacture>> {
  const montant = montantEnCentimes(entree.montant);
  if (!montant.ok) return montant;
  const facture = await deps.factures.inserer(entree.utilisateurId, {
    client: entree.client,
    montantCentimes: montant.valeur,
  });
  return ok(facture);
}
```

Le schéma Zod de l'étape 6 applique la même règle dans le navigateur ; le use-case la garantit pour tout point d'entrée (action, import, webhook).

### 3. Les aides techniques génériques

Pagination, affichage des montants et des dates, erreurs de formulaire : rien de propre aux factures. Elles vont dans `src/lib/helpers/<catégorie>/` et servent à toutes les listes du projet.

```ts
// src/lib/helpers/pagination/pagination.ts
/** Une page reçue dans l'adresse : entier à partir de 1, sinon 1. */
export function pageValide(page: number): number {
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function decalagePourPage(page: number, taillePage: number): number {
  return (pageValide(page) - 1) * taillePage;
}

export function nombreDePages(total: number, taillePage: number): number {
  return Math.max(1, Math.ceil(total / taillePage));
}
```

```ts
// src/lib/helpers/format/format.ts
const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function formaterMontant(centimes: number): string {
  return formatEuros.format(centimes / 100);
}

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

/** Affiche une date à l'heure de Paris, quel que soit le fuseau du serveur. */
export function formaterDate(date: Date): string {
  return formatDate.format(date);
}
```

```ts
// src/lib/helpers/formulaire/erreurs-de-champs.ts
type ErreursFormatees<C extends string> = Partial<
  Record<C, { _errors?: string[] }>
>;

/** Transforme les erreurs de validation de next-safe-action (forme formatée) en erreurs de champ pour TanStack Form. */
export function erreursDeChamps<C extends string>(
  champs: readonly C[],
  erreurs: ErreursFormatees<C>,
): Partial<Record<C, { message: string }>> {
  const resultat: Partial<Record<C, { message: string }>> = {};
  for (const champ of champs) {
    const message = erreurs[champ]?._errors?.[0];
    if (message) resultat[champ] = { message };
  }
  return resultat;
}
```

### 4. La table et sa migration

Montant en **centimes entiers**, date de création en `timestamp with time zone`, propriétaire dans `utilisateur_id`.

```ts
// src/db/factures/facture.table.ts
import { STATUTS_FACTURE } from "@src/core/factures/facture.entity";
import { user } from "@src/db/compte/auth.table";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const statutFacture = pgEnum("statut_facture", STATUTS_FACTURE);

export const factures = pgTable(
  "factures",
  {
    id: uuid().primaryKey().defaultRandom(),
    utilisateurId: text("utilisateur_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    client: text().notNull(),
    montantCentimes: integer("montant_centimes").notNull(),
    statut: statutFacture().notNull().default("brouillon"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("factures_utilisateur_cree_le_idx").on(
      table.utilisateurId,
      table.creeLe,
    ),
    check("factures_montant_positif", sql`${table.montantCentimes} > 0`),
  ],
);
```

`drizzle.config.ts` lit déjà `src/db/*/*.table.ts` : rien à déclarer ailleurs. Générez la migration, relisez le fichier SQL créé dans `drizzle/`, puis appliquez-la :

```bash
npm run db:generate
npm run db:migrate
```

### 5. Le repository

Toute la lecture et l'écriture des factures en base. Chaque requête commence par la **condition de propriété** (`utilisateurId`) : une personne ne lit et n'écrit que ses propres factures. La base arrive en paramètre : `getDb()` dans l'application, PGlite dans les tests.

```ts
// src/db/factures/facture.repository.ts
import "server-only";
import type {
  Facture,
  StatutFacture,
  TriFactures,
} from "@src/core/factures/facture.entity";
import type { Db } from "@src/db";
import { decalagePourPage } from "@src/lib/helpers/pagination/pagination";
import { and, asc, desc, eq, ilike, type SQL } from "drizzle-orm";
import { factures } from "./facture.table";

export type FiltresListeFactures = {
  statut: StatutFacture | null;
  recherche: string;
  tri: TriFactures;
  page: number;
  taillePage: number;
};

// L'id termine chaque tri : deux factures de même date ou de même montant gardent leur page.
const ORDRE_PAR_TRI: Record<TriFactures, SQL[]> = {
  recentes: [desc(factures.creeLe), desc(factures.id)],
  anciennes: [asc(factures.creeLe), asc(factures.id)],
  "montant-desc": [
    desc(factures.montantCentimes),
    desc(factures.creeLe),
    desc(factures.id),
  ],
  "montant-asc": [
    asc(factures.montantCentimes),
    desc(factures.creeLe),
    desc(factures.id),
  ],
};

/** Rend %, _ et \ ordinaires dans un motif ILIKE : la recherche « 100% » cherche le texte « 100% ». */
function echapperMotifLike(texte: string): string {
  return texte.replace(/[\\%_]/g, "\\$&");
}

export function factureRepository(db: Db) {
  return {
    async lister(
      utilisateurId: string,
      filtres: FiltresListeFactures,
    ): Promise<{ factures: Facture[]; total: number }> {
      const conditions: SQL[] = [eq(factures.utilisateurId, utilisateurId)];
      if (filtres.statut) {
        conditions.push(eq(factures.statut, filtres.statut));
      }
      const recherche = filtres.recherche.trim();
      if (recherche !== "") {
        conditions.push(
          ilike(factures.client, `%${echapperMotifLike(recherche)}%`),
        );
      }
      const filtre = and(...conditions);

      const [lignes, total] = await Promise.all([
        db
          .select()
          .from(factures)
          .where(filtre)
          .orderBy(...ORDRE_PAR_TRI[filtres.tri])
          .limit(filtres.taillePage)
          .offset(decalagePourPage(filtres.page, filtres.taillePage)),
        db.$count(factures, filtre),
      ]);
      return { factures: lignes, total };
    },

    async inserer(
      utilisateurId: string,
      donnees: { client: string; montantCentimes: number },
    ): Promise<{ id: string }> {
      const [facture] = await db
        .insert(factures)
        .values({ utilisateurId, ...donnees })
        .returning({ id: factures.id });
      if (!facture)
        throw new Error("La base n'a pas renvoyé la facture créée.");
      return facture;
    },
  };
}
```

Le repository fournit la méthode `inserer` du port : TypeScript le vérifie quand l'action le passe au use-case.

### 6. Les constantes, le schéma Zod et les filtres

Les libellés affichés et la taille de page appartiennent à l'écran : ils vont dans `constants/`.

```ts
// src/features/factures/constants/factures.ts
import {
  STATUTS_FACTURE,
  type StatutFacture,
  type TriFactures,
} from "@src/core/factures/facture.entity";

export const LIBELLES_STATUT: Record<StatutFacture, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
};

export const FILTRES_STATUT = ["tous", ...STATUTS_FACTURE] as const;
export type FiltreStatut = (typeof FILTRES_STATUT)[number];

export const LIBELLES_TRI: Record<TriFactures, string> = {
  recentes: "Plus récentes d'abord",
  anciennes: "Plus anciennes d'abord",
  "montant-desc": "Montant décroissant",
  "montant-asc": "Montant croissant",
};

export const TAILLE_PAGE = 10;

export const CHAMPS_FACTURE = ["client", "montant"] as const;
export type ChampFacture = (typeof CHAMPS_FACTURE)[number];
```

`erreur-messages.ts` donne un message à chaque code d'erreur du métier : un code sans message fait échouer `npm run typecheck`.

```ts
// src/features/factures/constants/erreur-messages.ts
import type { ErreurFacture } from "@src/core/factures/facture.errors";

export const MESSAGES_FACTURE: Record<ErreurFacture, string> = {
  "montant-invalide": "Le montant doit être supérieur à 0 €.",
};
```

Le formulaire et l'action valident avec **le même** schéma, qui réutilise les règles du métier. Le montant reste une saisie en euros ; le use-case le convertit en centimes.

```ts
// src/features/factures/schemas/facture.schema.ts
import {
  FORMAT_MONTANT,
  montantEnCentimes,
} from "@src/core/factures/facture.rules";
import { z } from "zod";

export const creerFactureSchema = z.object({
  client: z
    .string()
    .trim()
    .min(1, "Indiquez le nom du client.")
    .max(120, "Le nom du client tient en 120 caractères au plus."),
  montant: z
    .string()
    .trim()
    .regex(FORMAT_MONTANT, "Écrivez un montant en euros, par exemple 120,50.")
    .refine(
      (valeur) => !FORMAT_MONTANT.test(valeur) || montantEnCentimes(valeur).ok,
      "Le montant doit être supérieur à 0 €.",
    ),
});

export type CreerFactureEntree = z.input<typeof creerFactureSchema>;
```

Un seul fichier décrit les paramètres de l'adresse. Il importe depuis `nuqs/server`, ce qui le rend utilisable **côté serveur et côté client**.

```ts
// src/features/factures/schemas/filtres.schema.ts
import { TRIS_FACTURES } from "@src/core/factures/facture.entity";
import {
  createLoader,
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { FILTRES_STATUT } from "../constants/factures";

export const filtresFactures = {
  statut: parseAsStringLiteral(FILTRES_STATUT).withDefault("tous"),
  recherche: parseAsString.withDefault(""),
  tri: parseAsStringLiteral(TRIS_FACTURES).withDefault("recentes"),
  page: parseAsInteger.withDefault(1),
};

export type FiltresFactures = inferParserType<typeof filtresFactures>;

/** Lecture côté serveur : accepte la promesse `searchParams` de la page. */
export const chargerFiltresFactures = createLoader(filtresFactures);
```

### 7. La lecture et l'action

La lecture va directement au repository, sans use-case (architecture.md §6). Elle traduit les filtres de l'adresse en filtres du repository.

```ts
// src/features/factures/queries/lister-factures.query.ts
import "server-only";
import { getDb } from "@src/db";
import { factureRepository } from "@src/db/factures/facture.repository";
import { TAILLE_PAGE } from "../constants/factures";
import type { FiltresFactures } from "../schemas/filtres.schema";

export async function listerFactures(
  utilisateurId: string,
  filtres: FiltresFactures,
) {
  return factureRepository(getDb()).lister(utilisateurId, {
    statut: filtres.statut === "tous" ? null : filtres.statut,
    recherche: filtres.recherche,
    tri: filtres.tri,
    page: filtres.page,
    taillePage: TAILLE_PAGE,
  });
}
```

L'identifiant du propriétaire vient **de la session** (`ctx.utilisateur.id`), jamais de la saisie. L'action assemble le use-case et le repository, traduit un échec en message, puis appelle `refresh()` : la page revient à jour dans la même réponse. La liste est lue sans cache (`"use cache"` absent), donc il n'y a pas d'étiquette de cache à invalider.

```ts
// src/features/factures/actions/creer-facture.action.ts
"use server";

import { creerFacture } from "@src/core/factures/use-cases/creer-facture.use-case";
import { getDb } from "@src/db";
import { factureRepository } from "@src/db/factures/facture.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { refresh } from "next/cache";
import { returnServerError } from "next-safe-action";
import { MESSAGES_FACTURE } from "../constants/erreur-messages";
import { creerFactureSchema } from "../schemas/facture.schema";

export const creerFactureAction = actionConnectee
  .inputSchema(creerFactureSchema)
  .action(async ({ parsedInput, ctx }) => {
    const resultat = await creerFacture(
      { factures: factureRepository(getDb()) },
      {
        utilisateurId: ctx.utilisateur.id,
        client: parsedInput.client,
        montant: parsedInput.montant,
      },
    );
    if (!resultat.ok) returnServerError(MESSAGES_FACTURE[resultat.raison]);
    refresh();
    return { id: resultat.valeur.id };
  });
```

### 8. Le formulaire : section et container

La section porte les champs et le schéma Zod (`validators.onSubmit`, dans le navigateur). Elle reçoit tout par props : `envoyer(valeurs)` (qui répond `true` si l'action a réussi, `false` sinon : voir architecture.md §4), `erreursChamps` (erreurs de champ renvoyées par le serveur, affichées sous les champs concernés), `erreurServeur` (affiché sous les champs) et `enCours` (bouton désactivé pendant l'envoi). Si la validation du navigateur passe, `onSubmit` appelle `envoyer` ; le formulaire se vide après une création réussie.

```tsx
// src/features/factures/components/sections/formulaire-facture.tsx
"use client";

import { Button } from "@src/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@src/components/ui/field";
import { Input } from "@src/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import type { ChampFacture } from "../../constants/factures";
import {
  type CreerFactureEntree,
  creerFactureSchema,
} from "../../schemas/facture.schema";

type Props = {
  envoyer: (valeurs: CreerFactureEntree) => Promise<boolean>;
  /** Erreurs de champ renvoyées par le serveur, affichées sous les champs concernés. */
  erreursChamps?: Partial<Record<ChampFacture, { message: string }>>;
  erreurServeur?: string;
  enCours: boolean;
};

export function FormulaireFacture({
  envoyer,
  erreursChamps,
  erreurServeur,
  enCours,
}: Props) {
  const prefixe = useId();

  const form = useForm({
    defaultValues: { client: "", montant: "" },
    validators: { onSubmit: creerFactureSchema },
    onSubmit: async ({ value, formApi }) => {
      if (await envoyer(value)) {
        formApi.reset();
      }
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="client">
          {(field) => {
            const erreurChamp = erreursChamps?.[field.name];
            const invalide =
              (field.state.meta.isTouched && !field.state.meta.isValid) ||
              Boolean(erreurChamp);
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                  Client
                </FieldLabel>
                <Input
                  id={`${prefixe}-${field.name}`}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={invalide}
                  autoComplete="organization"
                />
                {invalide && (
                  <FieldError
                    errors={[...field.state.meta.errors, erreurChamp]}
                  />
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="montant">
          {(field) => {
            const erreurChamp = erreursChamps?.[field.name];
            const invalide =
              (field.state.meta.isTouched && !field.state.meta.isValid) ||
              Boolean(erreurChamp);
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                  Montant (€)
                </FieldLabel>
                <Input
                  id={`${prefixe}-${field.name}`}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={invalide}
                  inputMode="decimal"
                  autoComplete="off"
                />
                <FieldDescription>Par exemple 120,50.</FieldDescription>
                {invalide && (
                  <FieldError
                    errors={[...field.state.meta.errors, erreurChamp]}
                  />
                )}
              </Field>
            );
          }}
        </form.Field>

        {erreurServeur && (
          <p role="alert" className="text-sm text-destructive">
            {erreurServeur}
          </p>
        )}

        <Button type="submit" disabled={enCours}>
          {enCours ? "Création en cours…" : "Créer la facture"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

Le container (client) appelle `useAction` de `next-safe-action/hooks`, affiche les messages `toast` et passe ses props à la section.

```tsx
// src/features/factures/components/containers/creation-facture.container.tsx
"use client";

import { erreursDeChamps } from "@src/lib/helpers/formulaire/erreurs-de-champs";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { creerFactureAction } from "../../actions/creer-facture.action";
import { CHAMPS_FACTURE } from "../../constants/factures";
import { FormulaireFacture } from "../sections/formulaire-facture";

export function CreationFactureContainer() {
  const { executeAsync, result, isPending } = useAction(creerFactureAction);
  return (
    <FormulaireFacture
      envoyer={async (valeurs) => {
        const reponse = await executeAsync(valeurs);
        if (reponse?.data) {
          toast.success("Facture créée.");
          return true;
        }
        if (reponse?.validationErrors) {
          toast.error("Vérifiez les champs signalés.");
        }
        return false;
      }}
      erreursChamps={
        result.validationErrors
          ? erreursDeChamps(CHAMPS_FACTURE, result.validationErrors)
          : undefined
      }
      erreurServeur={result.serverError}
      enCours={isPending}
    />
  );
}
```

### 9. Les contrôles de filtre et de pagination (containers client)

Ils lisent et écrivent l'état de l'adresse (`useQueryStates`) : ce sont des containers. `shallow: false` demande au serveur de refaire la liste à chaque changement d'adresse. `startTransition` donne l'indicateur « Mise à jour… ». Chaque changement de filtre ramène à la page 1.

```tsx
// src/features/factures/components/containers/filtres-factures.container.tsx
"use client";

import { Button } from "@src/components/ui/button";
import { Field, FieldLabel } from "@src/components/ui/field";
import { Input } from "@src/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@src/components/ui/native-select";
import { TRIS_FACTURES } from "@src/core/factures/facture.entity";
import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";
import {
  FILTRES_STATUT,
  LIBELLES_STATUT,
  LIBELLES_TRI,
} from "../../constants/factures";
import { filtresFactures } from "../../schemas/filtres.schema";

export function FiltresFacturesContainer() {
  const [miseAJour, startTransition] = useTransition();
  const [filtres, setFiltres] = useQueryStates(filtresFactures, {
    shallow: false,
    startTransition,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
      <Field>
        <FieldLabel htmlFor="recherche-client">Rechercher un client</FieldLabel>
        <Input
          id="recherche-client"
          type="search"
          value={filtres.recherche}
          onChange={(e) =>
            setFiltres(
              { recherche: e.target.value, page: 1 },
              { limitUrlUpdates: debounce(300) },
            )
          }
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="filtre-statut">Statut</FieldLabel>
        <NativeSelect
          id="filtre-statut"
          value={filtres.statut}
          onChange={(e) =>
            setFiltres({
              statut:
                FILTRES_STATUT.find((s) => s === e.target.value) ?? "tous",
              page: 1,
            })
          }
        >
          <NativeSelectOption value="tous">Tous</NativeSelectOption>
          {FILTRES_STATUT.filter((s) => s !== "tous").map((statut) => (
            <NativeSelectOption key={statut} value={statut}>
              {LIBELLES_STATUT[statut]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel htmlFor="tri">Trier par</FieldLabel>
        <NativeSelect
          id="tri"
          value={filtres.tri}
          onChange={(e) =>
            setFiltres({
              tri:
                TRIS_FACTURES.find((t) => t === e.target.value) ?? "recentes",
              page: 1,
            })
          }
        >
          {TRIS_FACTURES.map((tri) => (
            <NativeSelectOption key={tri} value={tri}>
              {LIBELLES_TRI[tri]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Button type="button" variant="outline" onClick={() => setFiltres(null)}>
        Effacer les filtres
      </Button>

      <p
        aria-live="polite"
        className="text-sm text-muted-foreground sm:col-span-4"
      >
        {miseAJour ? "Mise à jour…" : ""}
      </p>
    </div>
  );
}
```

```tsx
// src/features/factures/components/containers/pagination-factures.container.tsx
"use client";

import { Button } from "@src/components/ui/button";
import { pageValide } from "@src/lib/helpers/pagination/pagination";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { filtresFactures } from "../../schemas/filtres.schema";

export function PaginationFacturesContainer({
  nombreDePages,
}: {
  nombreDePages: number;
}) {
  const [miseAJour, startTransition] = useTransition();
  const [filtres, setFiltres] = useQueryStates(filtresFactures, {
    shallow: false,
    startTransition,
  });
  const page = pageValide(filtres.page);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4"
    >
      <Button
        type="button"
        variant="outline"
        disabled={page <= 1 || miseAJour}
        onClick={() => setFiltres({ page: page - 1 })}
      >
        Page précédente
      </Button>
      <p className="text-sm text-muted-foreground">
        Page {page} sur {nombreDePages}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={page >= nombreDePages || miseAJour}
        onClick={() => setFiltres({ page: page + 1 })}
      >
        Page suivante
      </Button>
    </nav>
  );
}
```

### 10. La liste : container serveur et tableau

Le tableau est une section : il affiche ce qu'il reçoit, y compris les deux états vides (aucune facture, aucune facture pour ces filtres) et la page vide.

```tsx
// src/features/factures/components/sections/tableau-factures.tsx
import { Badge } from "@src/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@src/components/ui/table";
import type { Facture, StatutFacture } from "@src/core/factures/facture.entity";
import { formaterDate, formaterMontant } from "@src/lib/helpers/format/format";
import { LIBELLES_STATUT } from "../../constants/factures";

const VARIANTE_STATUT: Record<
  StatutFacture,
  "outline" | "secondary" | "default"
> = {
  brouillon: "outline",
  envoyee: "secondary",
  payee: "default",
};

type Props = {
  factures: Facture[];
  total: number;
  filtresActifs: boolean;
};

export function TableauFactures({ factures, total, filtresActifs }: Props) {
  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-medium">
          {filtresActifs
            ? "Aucune facture ne correspond à ces filtres."
            : "Vous n'avez pas encore de facture."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtresActifs
            ? "Modifiez la recherche ou cliquez sur « Effacer les filtres »."
            : "Créez la première avec le formulaire ci-dessus."}
        </p>
      </div>
    );
  }

  const nombre = (
    <p className="text-sm text-muted-foreground">
      {total} facture{total > 1 ? "s" : ""}
    </p>
  );

  if (factures.length === 0) {
    return (
      <>
        {nombre}
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Cette page est vide. Revenez à la page précédente.
        </p>
      </>
    );
  }

  return (
    <>
      {nombre}
      <Table>
        <TableCaption className="sr-only">Mes factures</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Créée le</TableHead>
            <TableHead className="text-right">Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {factures.map((facture) => (
            <TableRow key={facture.id}>
              <TableCell className="font-medium">{facture.client}</TableCell>
              <TableCell>
                <Badge variant={VARIANTE_STATUT[facture.statut]}>
                  {LIBELLES_STATUT[facture.statut]}
                </Badge>
              </TableCell>
              <TableCell>{formaterDate(facture.creeLe)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formaterMontant(facture.montantCentimes)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
```

Le container serveur lit la session, les filtres et la liste, puis compose le tableau et le container de pagination (un container peut rendre d'autres containers de sa feature, architecture.md §4).

```tsx
// src/features/factures/components/containers/liste-factures.container.tsx
import { utilisateurConnecte } from "@src/features/compte/queries/utilisateur-connecte.query";
import { nombreDePages } from "@src/lib/helpers/pagination/pagination";
import { TAILLE_PAGE } from "../../constants/factures";
import { listerFactures } from "../../queries/lister-factures.query";
import { chargerFiltresFactures } from "../../schemas/filtres.schema";
import { TableauFactures } from "../sections/tableau-factures";
import { PaginationFacturesContainer } from "./pagination-factures.container";

export async function ListeFacturesContainer({
  searchParams,
}: {
  searchParams: PageProps<"/factures">["searchParams"];
}) {
  const utilisateur = await utilisateurConnecte();
  const filtres = await chargerFiltresFactures(searchParams);
  const { factures, total } = await listerFactures(utilisateur.id, filtres);
  const filtresActifs =
    filtres.statut !== "tous" || filtres.recherche.trim() !== "";

  return (
    <div className="space-y-4">
      <TableauFactures
        factures={factures}
        total={total}
        filtresActifs={filtresActifs}
      />
      {total > 0 && (
        <PaginationFacturesContainer
          nombreDePages={nombreDePages(total, TAILLE_PAGE)}
        />
      )}
    </div>
  );
}
```

### 11. La page, le chargement et l'erreur

Avec Cache Components, tout ce qui lit la requête (session, `searchParams`) ou la base sans cache se place **sous `<Suspense>`**. La page elle-même reste synchrone : elle passe la promesse `searchParams` au container sans l'attendre. Le titre, le formulaire et les squelettes partent tout de suite ; la liste arrive ensuite. La recette n'utilise pas `loading.tsx` : la documentation recommande `<Suspense>` au plus près de la lecture.

```tsx
// app/(connecte)/factures/page.tsx
import { Skeleton } from "@src/components/ui/skeleton";
import { CreationFactureContainer } from "@src/features/factures/components/containers/creation-facture.container";
import { FiltresFacturesContainer } from "@src/features/factures/components/containers/filtres-factures.container";
import { ListeFacturesContainer } from "@src/features/factures/components/containers/liste-factures.container";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Mes factures" };

export default function PageFactures(props: PageProps<"/factures">) {
  return (
    <main className="mx-auto max-w-4xl space-y-10 p-6">
      <h1 className="text-2xl font-semibold">Mes factures</h1>

      <section aria-labelledby="titre-nouvelle-facture" className="space-y-4">
        <h2 id="titre-nouvelle-facture" className="text-lg font-medium">
          Nouvelle facture
        </h2>
        <CreationFactureContainer />
      </section>

      <section aria-labelledby="titre-liste-factures" className="space-y-4">
        <h2 id="titre-liste-factures" className="text-lg font-medium">
          Liste
        </h2>
        <Suspense fallback={<Skeleton className="h-16 w-full" />}>
          <FiltresFacturesContainer />
        </Suspense>
        <Suspense fallback={<SqueletteListe />}>
          <ListeFacturesContainer searchParams={props.searchParams} />
        </Suspense>
      </section>
    </main>
  );
}

function SqueletteListe() {
  return (
    <div className="space-y-2" aria-busy="true">
      <p className="sr-only">Chargement des factures…</p>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
```

```tsx
// app/(connecte)/factures/error.tsx
"use client";

import { Button } from "@src/components/ui/button";
import { useEffect } from "react";

export default function ErreurFactures({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-4xl space-y-4 p-6">
      <h2 className="text-lg font-medium">
        Les factures n'ont pas pu être chargées.
      </h2>
      <p className="text-muted-foreground">
        Vérifiez votre connexion, puis réessayez.
      </p>
      <Button type="button" onClick={() => retry()}>
        Réessayer
      </Button>
    </div>
  );
}
```

Ajoutez enfin l'adresse de la page au `matcher` de `proxy.ts` (racine du projet, recette `connexion`) :

```ts
export const config = {
  // Une ligne par page du groupe (connecte) : les groupes de routes n'apparaissent pas dans l'adresse.
  matcher: ["/compte/:path*", "/factures/:path*"],
};
```

Avec la recette `langues` : voir `connexion`, étape 12.

### 12. Quand utiliser TanStack Query ou Zustand

**Par défaut, ni l'un ni l'autre.** La liste se lit dans le container serveur, l'état partageable vit dans l'adresse (nuqs), et l'écriture passe par une action suivie de `refresh()`.

- **TanStack Query** : pour une donnée qui se met à jour **seule, sans navigation** dans un écran très interactif (rafraîchissement régulier, défilement infini, autocomplétion). Il lit une route API (Route Handler) qui vérifie la session.
- **Zustand** : pour un état d'interface **partagé entre composants clients sans lien parent** (panneau ouvert, panier non enregistré). Une donnée de la base ou un filtre partageable n'y va pas : la base reste la source, l'adresse garde les filtres.

Mini-exemple TanStack Query : le total impayé, rafraîchi toutes les 30 secondes. Installez d'abord le paquet : `npm install @tanstack/react-query` (dernière version ; vérifié avec 5.104.1). Le fournisseur va dans `src/providers/`.

```tsx
// src/providers/tanstack-query.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

let clientNavigateur: QueryClient | undefined;

function getQueryClient() {
  // Un client neuf par rendu serveur, un seul client réutilisé dans le navigateur.
  if (typeof window === "undefined") return new QueryClient();
  clientNavigateur ??= new QueryClient();
  return clientNavigateur;
}

export function TanstackQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
```

```tsx
// app/(connecte)/factures/layout.tsx
import { TanstackQueryProvider } from "@src/providers/tanstack-query";

export default function Layout({ children }: LayoutProps<"/factures">) {
  return <TanstackQueryProvider>{children}</TanstackQueryProvider>;
}
```

Ajoutez cette méthode à l'objet renvoyé par `factureRepository` (`src/db/factures/facture.repository.ts`), et `ne`, `sql` à son import de `"drizzle-orm"` :

```ts
    async totalImpaye(utilisateurId: string): Promise<number> {
      const [ligne] = await db
        .select({
          total:
            sql<number>`coalesce(sum(${factures.montantCentimes}), 0)`.mapWith(
              Number,
            ),
        })
        .from(factures)
        .where(
          and(
            eq(factures.utilisateurId, utilisateurId),
            ne(factures.statut, "payee"),
          ),
        );
      return ligne?.total ?? 0;
    },
```

```ts
// src/features/factures/queries/total-impaye.query.ts
import "server-only";
import { getDb } from "@src/db";
import { factureRepository } from "@src/db/factures/facture.repository";

export async function totalImpaye(utilisateurId: string): Promise<number> {
  return factureRepository(getDb()).totalImpaye(utilisateurId);
}
```

```ts
// app/api/factures/total-impaye/route.ts
import { getAuth } from "@src/adapters/auth/auth.adapter";
import { totalImpaye } from "@src/features/factures/queries/total-impaye.query";

export async function GET(request: Request) {
  // La requête est lue avant getAuth() : `next build` passe ainsi sans variables d'environnement.
  const enTetes = request.headers;
  const session = await getAuth().api.getSession({ headers: enTetes });
  if (!session) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }
  return Response.json({ totalCentimes: await totalImpaye(session.user.id) });
}
```

```tsx
// src/features/factures/components/containers/total-impaye.container.tsx
"use client";

import { formaterMontant } from "@src/lib/helpers/format/format";
import { useQuery } from "@tanstack/react-query";

async function chargerTotalImpaye(): Promise<{ totalCentimes: number }> {
  const reponse = await fetch("/api/factures/total-impaye");
  if (!reponse.ok) throw new Error("Total impayé indisponible");
  return reponse.json();
}

export function TotalImpayeContainer() {
  const { data, error, isPending } = useQuery({
    queryKey: ["factures", "total-impaye"],
    queryFn: chargerTotalImpaye,
    refetchInterval: 30_000,
  });

  if (error) return <p>Le total impayé est indisponible pour le moment.</p>;
  if (isPending) return <p>Calcul du total impayé…</p>;
  return <p>Total impayé : {formaterMontant(data.totalCentimes)}</p>;
}
```

Dans la page, placez `<TotalImpayeContainer />` dans son propre `<Suspense fallback={<Skeleton className="h-6 w-48" />}>` : avec Cache Components, Next.js pré-rend aussi les composants clients, et TanStack Query lit l'heure courante.

Mini-exemple Zustand : un panneau d'aide ouvert depuis l'en-tête et fermé depuis le panneau. Le magasin se crée **dans un fournisseur**, une fois par rendu, jamais en variable globale. Installez d'abord le paquet : `npm install zustand` (dernière version ; vérifié avec 5.0.15). Le magasin va dans `src/stores/`, son fournisseur dans `src/providers/`.

```ts
// src/stores/panneau.store.ts
import { createStore } from "zustand/vanilla";

export type PanneauStore = {
  ouvert: boolean;
  ouvrir: () => void;
  fermer: () => void;
};

export const creerPanneauStore = () =>
  createStore<PanneauStore>()((set) => ({
    ouvert: false,
    ouvrir: () => set({ ouvert: true }),
    fermer: () => set({ ouvert: false }),
  }));
```

```tsx
// src/providers/panneau.tsx
"use client";

import {
  creerPanneauStore,
  type PanneauStore,
} from "@src/stores/panneau.store";
import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";

type PanneauStoreApi = ReturnType<typeof creerPanneauStore>;
const PanneauContext = createContext<PanneauStoreApi | undefined>(undefined);

export function PanneauProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => creerPanneauStore());
  return (
    <PanneauContext.Provider value={store}>{children}</PanneauContext.Provider>
  );
}

export function usePanneau<T>(selecteur: (etat: PanneauStore) => T): T {
  const store = useContext(PanneauContext);
  if (!store) throw new Error("usePanneau s'utilise dans un PanneauProvider.");
  return useStore(store, selecteur);
}
```

Usage dans un container client : `const ouvrir = usePanneau((etat) => etat.ouvrir);`, puis `ouvrir` passé en prop à la section. Les composants serveur ne lisent pas ce magasin.

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Consulter et créer mes factures

  Règle: Chaque personne ne voit que ses propres factures

    @US-XXX-1 @integration @securite
    Exemple: Camille ne voit pas les factures de Léo
      Étant donné Camille a une facture pour « Atelier Dupont »
      Et Léo a une facture pour « Boulangerie Martin »
      Quand Camille consulte ses factures
      Alors la liste contient « Atelier Dupont »
      Et la liste ne contient pas « Boulangerie Martin »

    @US-XXX-1 @manuel @securite
    Exemple: Une création envoyée sans être connecté est refusée
      Étant donné personne n'est connecté
      Quand quelqu'un envoie directement la création d'une facture de 50 €
      Alors la création est refusée
      Et aucune facture n'est enregistrée

  Règle: On peut filtrer par statut et rechercher un client

    @US-XXX-2 @integration
    Exemple: Filtre « Payée » : seules les factures payées restent
      Étant donné Camille a une facture payée pour « Atelier Dupont » et une facture brouillon pour « Café Leroy »
      Quand Camille filtre sur le statut « Payée »
      Alors la liste contient seulement « Atelier Dupont »

    @US-XXX-2 @integration
    Exemple: La recherche ignore les majuscules
      Étant donné Camille a une facture pour « Atelier Dupont »
      Quand Camille recherche « dupont »
      Alors la liste contient « Atelier Dupont »

    @US-XXX-2 @integration
    Exemple: Le signe % est cherché comme un caractère
      Étant donné Camille a une facture pour « Remise 100% » et une pour « Atelier Dupont »
      Quand Camille recherche « 100% »
      Alors la liste contient seulement « Remise 100% »

    @US-XXX-2 @integration
    Exemple: Le signe _ est cherché comme un caractère
      Étant donné Camille a une facture pour « Client_1 » et une pour « Client11 »
      Quand Camille recherche « Client_1 »
      Alors la liste contient seulement « Client_1 »

    @US-XXX-2 @integration
    Exemple: La barre oblique inverse est cherchée comme un caractère
      Étant donné Camille a une facture pour « Atelier\Dupont » et une pour « Atelier Dupont »
      Quand Camille recherche « Atelier\Dupont »
      Alors la liste contient seulement « Atelier\Dupont »

  Règle: On peut trier par date ou par montant

    @US-XXX-3 @integration
    Exemple: Tri par montant décroissant
      Étant donné Camille a des factures de 45 €, 120,50 € et 80 €
      Quand Camille trie par « Montant décroissant »
      Alors la liste montre 120,50 €, puis 80 €, puis 45 €

  Règle: La liste affiche 10 factures par page

    @US-XXX-4 @integration
    Exemple: 12 factures : 10 en page 1, 2 en page 2
      Étant donné Camille a 12 factures
      Quand Camille ouvre la page 2
      Alors la liste montre 2 factures
      Et le total indique 12 factures

    @US-XXX-4 @unitaire
    Plan du scénario: Nombre de pages selon le nombre de factures
      Étant donné Camille a <total> factures
      Quand on calcule la pagination
      Alors il y a <pages> page(s)

      Exemples:
        | total | pages |
        | 0     | 1     |
        | 10    | 1     |
        | 11    | 2     |

  Règle: Les filtres restent dans l'adresse de la page

    @US-XXX-5 @bout-en-bout
    Exemple: Après un rechargement, la recherche est conservée
      Étant donné Camille a une facture pour « Atelier Dupont » et une pour « Boulangerie Martin »
      Et Camille a recherché « dupont »
      Quand Camille recharge la page
      Alors la recherche contient toujours « dupont »
      Et la liste contient seulement « Atelier Dupont »

  Règle: Une facture créée apparaît aussitôt dans la liste

    @US-XXX-6 @bout-en-bout
    Exemple: Création d'une facture de 120,50 € pour « Atelier Dupont »
      Étant donné Camille n'a aucune facture
      Quand Camille crée une facture de « 120,50 » pour « Atelier Dupont »
      Alors le message « Facture créée. » s'affiche
      Et la liste montre « Atelier Dupont » pour 120,50 €

    @US-XXX-6 @unitaire
    Plan du scénario: Le montant saisi en euros est enregistré en centimes
      Quand Camille saisit le montant « <saisie> »
      Alors le montant enregistré vaut <centimes> centimes

      Exemples:
        | saisie  | centimes |
        | 120,50  | 12050    |
        | 120.5   | 12050    |
        | 0,05    | 5        |
        | 45      | 4500     |

    @US-XXX-6 @unitaire
    Plan du scénario: Un montant invalide est refusé avec un message
      Quand Camille saisit le montant « <saisie> »
      Alors le message « <message> » s'affiche sous le champ

      Exemples:
        | saisie | message                                             |
        | 0      | Le montant doit être supérieur à 0 €.               |
        | 12,345 | Écrivez un montant en euros, par exemple 120,50.    |
        | abc    | Écrivez un montant en euros, par exemple 120,50.    |

  Règle: La liste annonce clairement le vide, le chargement et l'erreur

    @US-XXX-7 @manuel
    Exemple: Première visite : la liste invite à créer une facture
      Étant donné Camille n'a aucune facture
      Quand Camille ouvre « Mes factures »
      Alors le message « Vous n'avez pas encore de facture. » s'affiche

    @US-XXX-7 @manuel
    Exemple: Base indisponible : un message propose de réessayer
      Étant donné la base de données ne répond pas
      Quand Camille ouvre « Mes factures »
      Alors le message « Les factures n'ont pas pu être chargées. » s'affiche
      Et un bouton « Réessayer » est proposé
```

## Tâches de plan prêtes

> US terminée quand : la personne connectée crée une facture, la voit dans sa liste, et filtre, trie et pagine cette liste, avec des filtres conservés dans l'adresse.

- [ ] **T1 – Règles des factures et aides génériques** · US-XXX
  - Objectif : les montants, dates, pages et erreurs de champ sont calculés de façon sûre
  - Dépend de : —
  - Fichiers : à créer : `src/core/factures/facture.entity.ts`, `src/core/factures/facture.errors.ts`, `src/core/factures/facture.rules.ts`, `src/core/factures/__tests__/facture.rules.test.ts`, `src/lib/helpers/pagination/pagination.ts`, `src/lib/helpers/pagination/__tests__/pagination.test.ts`, `src/lib/helpers/format/format.ts`, `src/lib/helpers/format/__tests__/format.test.ts`, `src/lib/helpers/formulaire/erreurs-de-champs.ts`, `src/lib/helpers/formulaire/__tests__/erreurs-de-champs.test.ts`
  - Vérification : US-XXX critères 4 et 6 – `npm test` passe sur les conversions de montant, la pagination et l'affichage
  - Tests : « Le montant saisi en euros est enregistré en centimes » (unitaire) ; « Nombre de pages selon le nombre de factures » (unitaire)
- [ ] **T2 – Table et repository des factures** · US-XXX
  - Objectif : la base enregistre les factures de chaque personne et les renvoie filtrées, triées et paginées
  - Dépend de : T1
  - Fichiers : à créer : `src/db/factures/facture.table.ts`, migration dans `drizzle/`, `src/db/factures/facture.repository.ts`, `src/db/factures/__tests__/facture.repository.test.ts`
  - Vérification : US-XXX critères 1 à 4 – la migration crée la table `factures` avec `utilisateur_id`, `montant_centimes` et `cree_le` en `timestamp with time zone` ; `npm test` passe sur la base PGlite
  - Tests : « Camille ne voit pas les factures de Léo » (intégration) ; « Filtre « Payée » » (intégration) ; « La recherche ignore les majuscules » (intégration) ; « Le signe % est cherché comme un caractère » (intégration) ; « Le signe _ est cherché comme un caractère » (intégration) ; « La barre oblique inverse est cherchée comme un caractère » (intégration) ; « Tri par montant décroissant » (intégration) ; « 12 factures : 10 en page 1, 2 en page 2 » (intégration)
  - Attention : relire le SQL généré avant `npm run db:migrate` ; chaque requête du repository commence par la condition `utilisateurId` (S3)
- [ ] **T3 – Création d'une facture : use-case, schéma, action, formulaire** · US-XXX
  - Objectif : la personne crée une facture et voit le message de confirmation
  - Dépend de : T2
  - Fichiers : à créer : `src/core/factures/facture-repository.port.ts`, `src/core/factures/use-cases/creer-facture.use-case.ts`, `src/core/factures/__tests__/creer-facture.use-case.test.ts`, `src/features/factures/constants/factures.ts`, `src/features/factures/constants/erreur-messages.ts`, `src/features/factures/schemas/facture.schema.ts`, `src/features/factures/schemas/__tests__/facture.schema.test.ts`, `src/features/factures/actions/creer-facture.action.ts`, `src/features/factures/components/sections/formulaire-facture.tsx`, `src/features/factures/components/containers/creation-facture.container.tsx`
  - Vérification : US-XXX critère 6 – `npm test` passe ; une facture créée apparaît dans la liste sans recharger la page ; un montant « 0 » affiche son message sous le champ
  - Tests : « Un montant invalide est refusé avec un message » (unitaire) ; « Une création envoyée sans être connecté est refusée » (manuel)
  - Attention : le propriétaire vient de `ctx.utilisateur.id`, jamais de la saisie (S3, S4) ; le fichier d'action commence par `"use server"` et n'exporte que son action
- [ ] **T4 – Page liste avec filtres, pagination et états** · US-XXX
  - Objectif : la personne consulte, filtre, trie et pagine ses factures
  - Dépend de : T3
  - Fichiers : à créer : `src/features/factures/schemas/filtres.schema.ts`, `src/features/factures/queries/lister-factures.query.ts`, `src/features/factures/components/sections/tableau-factures.tsx`, `src/features/factures/components/containers/filtres-factures.container.tsx`, `src/features/factures/components/containers/pagination-factures.container.tsx`, `src/features/factures/components/containers/liste-factures.container.tsx`, `app/(connecte)/factures/page.tsx`, `app/(connecte)/factures/error.tsx` · à modifier : `proxy.ts` (matcher), `app/layout.tsx` seulement si `<Toaster />` manque
  - Vérification : US-XXX critères 2 à 5 et 7 – `npm run check` et `npm run build` passent ; filtrer change l'adresse et la liste ; recharger garde les filtres
  - Tests : « Première visite : la liste invite à créer une facture » (manuel) ; « Base indisponible : un message propose de réessayer » (manuel)
  - Attention : chaque lecture de la requête ou de la base reste sous `<Suspense>`
- [ ] **T5 – Parcours de bout en bout** · US-XXX
  - Objectif : le parcours complet est vérifié automatiquement
  - Dépend de : T4
  - Fichiers : à créer : `e2e/factures.spec.ts`
  - Vérification : US-XXX critères 5 et 6 – `npm run test:e2e` passe
  - Tests : « Création d'une facture de 120,50 € pour « Atelier Dupont » » (bout en bout) ; « Après un rechargement, la recherche est conservée » (bout en bout)

## Tests

### Unitaires (Vitest)

```ts
// src/core/factures/__tests__/facture.rules.test.ts
import { describe, expect, it } from "vitest";
import { eurosEnCentimes, montantEnCentimes } from "../facture.rules";

describe("Règles du montant", () => {
  it.each([
    ["120,50", 12050],
    ["120.5", 12050],
    ["0,05", 5],
    ["45", 4500],
  ])("US-XXX-6 – « %s » vaut %i centimes", (saisie, centimes) => {
    expect(eurosEnCentimes(saisie)).toBe(centimes);
  });

  it("US-XXX-6 – une saisie hors format ne donne pas de montant", () => {
    expect(eurosEnCentimes("abc")).toBeNaN();
  });

  it("US-XXX-6 – un montant de 0 € est refusé", () => {
    expect(montantEnCentimes("0")).toEqual({
      ok: false,
      raison: "montant-invalide",
    });
  });

  it("US-XXX-6 – un montant positif est accepté en centimes", () => {
    expect(montantEnCentimes("120,50")).toEqual({ ok: true, valeur: 12050 });
  });
});
```

Le use-case se teste avec une doublure du port, en mémoire : aucune base.

```ts
// src/core/factures/__tests__/creer-facture.use-case.test.ts
import { describe, expect, it } from "vitest";
import type { FactureRepository } from "../facture-repository.port";
import { creerFacture } from "../use-cases/creer-facture.use-case";

function facturesEnMemoire() {
  const enregistrees: {
    utilisateurId: string;
    client: string;
    montantCentimes: number;
  }[] = [];
  const factures: FactureRepository = {
    async inserer(utilisateurId, donnees) {
      enregistrees.push({ utilisateurId, ...donnees });
      return { id: `facture-${enregistrees.length}` };
    },
  };
  return { factures, enregistrees };
}

describe("creerFacture", () => {
  it("US-XXX-6 – « 120,50 » est enregistré en 12050 centimes pour la personne", async () => {
    const { factures, enregistrees } = facturesEnMemoire();

    const resultat = await creerFacture(
      { factures },
      { utilisateurId: "camille", client: "Atelier Dupont", montant: "120,50" },
    );

    expect(resultat).toEqual({ ok: true, valeur: { id: "facture-1" } });
    expect(enregistrees).toEqual([
      {
        utilisateurId: "camille",
        client: "Atelier Dupont",
        montantCentimes: 12050,
      },
    ]);
  });

  it("US-XXX-6 – un montant de 0 € est refusé et rien n'est enregistré", async () => {
    const { factures, enregistrees } = facturesEnMemoire();

    const resultat = await creerFacture(
      { factures },
      { utilisateurId: "camille", client: "Atelier Dupont", montant: "0" },
    );

    expect(resultat).toEqual({ ok: false, raison: "montant-invalide" });
    expect(enregistrees).toEqual([]);
  });
});
```

```ts
// src/lib/helpers/pagination/__tests__/pagination.test.ts
import { describe, expect, it } from "vitest";
import { decalagePourPage, nombreDePages, pageValide } from "../pagination";

describe("Pagination", () => {
  it.each([
    [0, 1],
    [10, 1],
    [11, 2],
  ])("US-XXX-4 – %i factures font %i page(s)", (total, pages) => {
    expect(nombreDePages(total, 10)).toBe(pages);
  });

  it("US-XXX-4 – une page invalide revient à la page 1", () => {
    expect(pageValide(-3)).toBe(1);
    expect(pageValide(2.5)).toBe(1);
    expect(decalagePourPage(-3, 10)).toBe(0);
    expect(decalagePourPage(2, 10)).toBe(10);
  });
});
```

```ts
// src/lib/helpers/format/__tests__/format.test.ts
import { describe, expect, it } from "vitest";
import { formaterDate, formaterMontant } from "../format";

/** Intl sépare le montant et « € » par une espace insécable : on la remplace pour comparer. */
const espacesSimples = (texte: string) => texte.replace(/\s/g, " ");

describe("Affichage", () => {
  it("US-XXX-6 – 12050 centimes s'affichent « 120,50 € »", () => {
    expect(espacesSimples(formaterMontant(12050))).toBe("120,50 €");
  });

  it("US-XXX-6 – une date s'affiche à l'heure de Paris", () => {
    expect(formaterDate(new Date("2026-03-09T23:30:00Z"))).toBe("10 mars 2026");
  });
});
```

```ts
// src/lib/helpers/formulaire/__tests__/erreurs-de-champs.test.ts
import { describe, expect, it } from "vitest";
import { erreursDeChamps } from "../erreurs-de-champs";

describe("erreursDeChamps", () => {
  it("US-XXX-6 – les erreurs du serveur deviennent des erreurs de champ", () => {
    expect(
      erreursDeChamps(["client", "montant"], {
        montant: { _errors: ["Le montant doit être supérieur à 0 €."] },
      }),
    ).toEqual({
      montant: { message: "Le montant doit être supérieur à 0 €." },
    });
  });
});
```

```ts
// src/features/factures/schemas/__tests__/facture.schema.test.ts
import { describe, expect, it } from "vitest";
import { creerFactureSchema } from "../facture.schema";

function messagesDuMontant(montant: string) {
  const resultat = creerFactureSchema.safeParse({
    client: "Atelier Dupont",
    montant,
  });
  return resultat.success
    ? []
    : resultat.error.issues.map((probleme) => probleme.message);
}

describe("Schéma de création de facture", () => {
  it("US-XXX-6 – « 120,50 » est accepté", () => {
    expect(messagesDuMontant("120,50")).toEqual([]);
  });

  it.each([
    ["0", "Le montant doit être supérieur à 0 €."],
    ["12,345", "Écrivez un montant en euros, par exemple 120,50."],
    ["abc", "Écrivez un montant en euros, par exemple 120,50."],
  ])("US-XXX-6 – « %s » est refusé avec un seul message", (saisie, message) => {
    expect(messagesDuMontant(saisie)).toEqual([message]);
  });

  it("US-XXX-6 – un client vide est refusé", () => {
    const resultat = creerFactureSchema.safeParse({
      client: "   ",
      montant: "10",
    });
    expect(resultat.success).toBe(false);
  });
});
```

### Intégration du repository (Vitest + PGlite)

Chaque test reçoit une base PGlite neuve (Postgres en mémoire) avec les vraies migrations : `creerBaseDeTest()` du squelette. La base est passée au repository ; le test n'ouvre jamais la base réelle.

```ts
// src/db/factures/__tests__/facture.repository.test.ts
import type { StatutFacture } from "@src/core/factures/facture.entity";
import type { Db } from "@src/db";
import { user } from "@src/db/compte/auth.table";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import {
  type FiltresListeFactures,
  factureRepository,
} from "../facture.repository";
import { factures } from "../facture.table";

const FILTRES_PAR_DEFAUT: FiltresListeFactures = {
  statut: null,
  recherche: "",
  tri: "recentes",
  page: 1,
  taillePage: 10,
};

let db: Db;
let fermer: () => Promise<void>;

beforeEach(async () => {
  ({ db, fermer } = await creerBaseDeTest());
  await db.insert(user).values([
    { id: "camille", name: "Camille", email: "camille@exemple.fr" },
    { id: "leo", name: "Léo", email: "leo@exemple.fr" },
  ]);
});

afterEach(async () => {
  await fermer();
});

async function ajouter(
  utilisateurId: string,
  client: string,
  montantCentimes: number,
  statut: StatutFacture = "brouillon",
) {
  await db
    .insert(factures)
    .values({ utilisateurId, client, montantCentimes, statut });
}

describe("factureRepository.lister", () => {
  it("US-XXX-1 – Camille ne voit pas les factures de Léo", async () => {
    await ajouter("camille", "Atelier Dupont", 12050);
    await ajouter("leo", "Boulangerie Martin", 4500);

    const { factures: liste, total } = await factureRepository(db).lister(
      "camille",
      FILTRES_PAR_DEFAUT,
    );

    expect(liste.map((f) => f.client)).toEqual(["Atelier Dupont"]);
    expect(total).toBe(1);
  });

  it("US-XXX-2 – le filtre « Payée » ne garde que les factures payées", async () => {
    await ajouter("camille", "Atelier Dupont", 12050, "payee");
    await ajouter("camille", "Café Leroy", 8000, "brouillon");

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      statut: "payee",
    });

    expect(liste.map((f) => f.client)).toEqual(["Atelier Dupont"]);
  });

  it("US-XXX-2 – la recherche ignore les majuscules", async () => {
    await ajouter("camille", "Atelier Dupont", 12050);

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      recherche: "dupont",
    });

    expect(liste.map((f) => f.client)).toEqual(["Atelier Dupont"]);
  });

  it("US-XXX-2 – le signe % est cherché comme un caractère", async () => {
    await ajouter("camille", "Remise 100%", 1000);
    await ajouter("camille", "Atelier Dupont", 12050);

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      recherche: "100%",
    });

    expect(liste.map((f) => f.client)).toEqual(["Remise 100%"]);
  });

  it("US-XXX-2 – le signe _ est cherché comme un caractère, pas comme « n'importe quel caractère »", async () => {
    await ajouter("camille", "Client_1", 1000);
    await ajouter("camille", "Client11", 2000);

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      recherche: "Client_1",
    });

    expect(liste.map((f) => f.client)).toEqual(["Client_1"]);
  });

  it("US-XXX-2 – la barre oblique inverse est cherchée comme un caractère", async () => {
    await ajouter("camille", "Atelier\\Dupont", 1000);
    await ajouter("camille", "Atelier Dupont", 2000);

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      recherche: "Atelier\\Dupont",
    });

    expect(liste.map((f) => f.client)).toEqual(["Atelier\\Dupont"]);
  });

  it("US-XXX-3 – le tri par montant décroissant range 120,50 €, 80 €, 45 €", async () => {
    await ajouter("camille", "Boulangerie Martin", 4500);
    await ajouter("camille", "Atelier Dupont", 12050);
    await ajouter("camille", "Café Leroy", 8000);

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      tri: "montant-desc",
    });

    expect(liste.map((f) => f.montantCentimes)).toEqual([12050, 8000, 4500]);
  });

  it("US-XXX-4 – 12 factures : 2 en page 2, total 12", async () => {
    for (let numero = 1; numero <= 12; numero++) {
      await ajouter("camille", `Client ${numero}`, numero * 100);
    }

    const { factures: liste, total } = await factureRepository(db).lister(
      "camille",
      { ...FILTRES_PAR_DEFAUT, page: 2 },
    );

    expect(liste).toHaveLength(2);
    expect(total).toBe(12);
  });
});

describe("factureRepository.inserer", () => {
  it("US-XXX-6 – la facture créée appartient à la personne indiquée", async () => {
    const repository = factureRepository(db);
    const { id } = await repository.inserer("camille", {
      client: "Atelier Dupont",
      montantCentimes: 12050,
    });

    const camille = await repository.lister("camille", FILTRES_PAR_DEFAUT);
    const leo = await repository.lister("leo", FILTRES_PAR_DEFAUT);

    expect(camille.factures).toEqual([
      expect.objectContaining({
        id,
        client: "Atelier Dupont",
        montantCentimes: 12050,
        statut: "brouillon",
      }),
    ]);
    expect(leo.total).toBe(0);
  });
});
```

### Bout en bout (Playwright)

`champ(page, libellé)` (recette `connexion`) vise le champ visible par son libellé exact.

```ts
// e2e/factures.spec.ts
import { expect, type Page, test } from "@playwright/test";
import { champ, connecterNouvelUtilisateur } from "./aides/connexion";

async function creerFacture(page: Page, client: string, montant: string) {
  await champ(page, "Client").fill(client);
  await champ(page, "Montant (€)").fill(montant);
  await page.getByRole("button", { name: "Créer la facture" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(client) }),
  ).toBeVisible();
}

test.describe("Mes factures", () => {
  test.beforeEach(async ({ page }) => {
    await connecterNouvelUtilisateur(page);
    await page.goto("/factures");
    await expect(
      page.getByRole("heading", { name: "Mes factures" }),
    ).toBeVisible();
  });

  test("US-XXX-6 – une facture créée apparaît dans la liste avec un message", async ({
    page,
  }) => {
    await expect(
      page.getByText("Vous n'avez pas encore de facture."),
    ).toBeVisible();

    await champ(page, "Client").fill("Atelier Dupont");
    await champ(page, "Montant (€)").fill("120,50");
    await page.getByRole("button", { name: "Créer la facture" }).click();

    await expect(page.getByText("Facture créée.")).toBeVisible();
    await expect(
      page.getByRole("row", { name: /Atelier Dupont/ }),
    ).toContainText(/120,50\s€/);
  });

  test("US-XXX-5 – la recherche reste dans l'adresse après un rechargement", async ({
    page,
  }) => {
    await creerFacture(page, "Atelier Dupont", "120,50");
    await creerFacture(page, "Boulangerie Martin", "45");

    await champ(page, "Rechercher un client").fill("dupont");
    await expect(page).toHaveURL(/recherche=dupont/);
    await expect(
      page.getByRole("row", { name: /Boulangerie Martin/ }),
    ).toHaveCount(0);

    await page.reload();

    await expect(champ(page, "Rechercher un client")).toHaveValue("dupont");
    await expect(
      page.getByRole("row", { name: /Atelier Dupont/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("row", { name: /Boulangerie Martin/ }),
    ).toHaveCount(0);
  });
});
```

Commandes : `npm test` (unitaires et intégration), `npm run test:e2e` (bout en bout).

## Points de sécurité

- **S3 – Contrôle d'accès aux données** : chaque requête de `facture.repository.ts` commence par la condition `utilisateurId`. L'identifiant vient de la session : `ctx.utilisateur.id` dans l'action, `utilisateurConnecte()` dans `ListeFacturesContainer`. Le test « Camille ne voit pas les factures de Léo » le prouve.
- **S4 – Pages et actions réservées** : l'action utilise `actionConnectee`, car une Server Action est joignable par une requête directe. La liste appelle `utilisateurConnecte()`, qui renvoie vers `/connexion` sans session. La route API du mini-exemple répond 401 sans session.
- **S5 – Validation des entrées** : l'action revalide avec le schéma Zod, même après la validation du formulaire, et le use-case applique encore la règle du montant. Les filtres de l'adresse passent par les parseurs nuqs : un statut ou un tri inconnu revient à sa valeur par défaut, une page invalide revient à 1. La recherche reste un paramètre de requête Drizzle, avec `%`, `_` et `\` échappés.
- **S6 – Affichage sans injection** : les textes s'affichent par JSX, en texte simple.
- **S9 – Données personnelles** : `error.tsx` journalise l'erreur dans le navigateur ; les journaux serveur gardent le nom du client hors des messages.
- **S11 – Messages d'erreur** : la personne voit un message en français, sans détail technique (`erreur-messages.ts` pour une erreur attendue, message générique de `safe-action` sinon). En production, Next.js remplace le message d'une erreur serveur par un identifiant (`digest`).
- `facture.repository.ts` et `lister-factures.query.ts` commencent par `import "server-only"` : un import depuis un composant client casse la construction au lieu d'exposer la base.

## Pièges connus

- **Composant client avec nuqs hors de `<Suspense>`** : la construction échoue (« URL data in a Client Component outside of Suspense »). Gardez `FiltresFacturesContainer` et `PaginationFacturesContainer` sous un `<Suspense>` (la pagination l'est par `ListeFacturesContainer`).
- **Adresse qui change mais liste figée** : ajoutez `shallow: false` aux options de `useQueryStates`, sinon le serveur ne refait pas la liste.
- **Parseurs importés depuis `nuqs` dans `filtres.schema.ts`** : la construction casse côté serveur. Importez-les depuis `nuqs/server` dans tout fichier partagé.
- **Écran pas à jour après la création** : la liste est lue sans cache, donc l'action appelle `refresh()`. Si un jour la lecture passe en `"use cache"` avec `cacheTag`, remplacez `refresh()` par `updateTag(<étiquette>)` (étiquette rangée dans `constants/cache-tags.ts`). `revalidateTag(…, "max")` ne met pas l'écran à jour dans la même réponse.
- **Fonction utilitaire exportée depuis un fichier d'`actions/`** : dans un fichier `"use server"`, chaque fonction exportée devient une adresse publique. Gardez l'accès à la base dans le repository et n'exportez de `creer-facture.action.ts` que l'action next-safe-action.
- **Statuts ou tris importés depuis `constants/` dans la table ou le repository** : Biome refuse l'import (`src/db/` ignore les features). Les listes partagées par la base et l'écran vivent dans `src/core/factures/facture.entity.ts`.
- **Pagination rendue par le tableau** : Biome refuse l'import d'un container dans une section. C'est le container de la liste qui compose le tableau et la pagination.
- **`loading.tsx` à la place de `<Suspense>`** : il ne couvre pas une lecture faite dans un `layout.tsx`. Placez `<Suspense>` au plus près de la lecture, comme dans la page ci-dessus.
- **`error.tsx` en Next.js 16.4** : utilisez la propriété `retry()` (elle relit les données) ; `reset()` réaffiche sans relire.
- **Montants** : calculez en centimes entiers ; `eurosEnCentimes` découpe la saisie au lieu de multiplier un nombre à virgule (`0.29 * 100` donne `28.999999999999996`).
- **Dates** : formatez avec `timeZone: "Europe/Paris"` ; le serveur Vercel tourne en UTC.
- **Pagination instable** : ajoutez toujours une colonne unique (`id`) en fin de tri, sinon deux factures de même montant peuvent changer de page.
- **Filtre changé sur la page 3** : remettez `page: 1` avec chaque changement de filtre, sinon la page affichée peut être vide.
- **Biome signale `children=` sur `form.Field`** (règle `noChildrenProp`) : passez la fonction entre les balises, comme dans le formulaire ci-dessus.
- **`FieldError` vide** : il attend des objets `{ message }`. Les erreurs du serveur passent par `erreursDeChamps`, qui les met sous cette forme.
- **Deux messages pour un montant « abc »** : un `refine` Zod s'exécute même après l'échec du `regex`. Le `refine` du schéma ignore donc les saisies hors format.
- **Test qui échoue sur « 120,50 € »** : `Intl` insère une espace insécable avant « € ». Comparez après `replace(/\s/g, " ")`, ou avec `/120,50\s€/` dans Playwright.
- **Test d'intégration qui plante sur `server-only`** : vérifiez l'alias `server-only` de `vitest.config.ts` (squelette), ou ajoutez `vi.mock("server-only", () => ({}))` en tête du fichier de test.
- **Test d'intégration refusé par `tsc` (« not assignable to type 'Db' »)** : utilisez la base de `creerBaseDeTest()` du squelette, déjà typée `Db`.
- **`next build` échoue sur une route API avec « Variables d'environnement invalides »** : lisez `request.headers` sur sa propre ligne, avant `getAuth()`, comme dans `total-impaye/route.ts`. La lecture de la requête arrête le pré-rendu.
- **TanStack Query et Cache Components** : un composant qui utilise `useQuery` au premier affichage va sous `<Suspense>`, sinon la construction signale une lecture de l'heure courante.
- **Zustand** : créez le magasin dans un fournisseur (`useState(() => creer…())`) ; un magasin global serait partagé entre les visiteurs côté serveur.

## Sources

- Lecture serveur, `<Suspense>`, `loading.js` et ses limites avec les layouts : `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` (Next.js 16.4.0).
- Cache Components, lecture de `searchParams` sous `<Suspense>`, `partialPrefetching`, promesse `searchParams` passée sans l'attendre : `01-app/01-getting-started/08-caching.md`.
- `refresh()` après une écriture, vérification de la session dans chaque Server Action : `01-app/01-getting-started/07-mutating-data.md`, `01-app/03-api-reference/04-functions/refresh.md`.
- `updateTag`, `revalidateTag`, `revalidatePath` : `01-app/01-getting-started/09-revalidating.md`.
- Re-rendu inclus dans la réponse de l'action (`refresh`, `updateTag`) mais pas avec `revalidateTag(…, "max")` : `01-app/02-guides/server-actions.md` (« A single response carries data and UI », « Choosing a cache update »).
- « Une lecture sans cache n'a pas d'étiquette à invalider » : `01-app/02-guides/client-side-data-fetching/tanstack-query.md` et `client-side-data-fetching/index.md` (« Coordinate mutations »).
- Formulaires, validation Zod côté serveur, erreurs affichées : `01-app/02-guides/forms.md`.
- Fournisseur TanStack Query, `useQuery`, `<Suspense>` avec Cache Components : `01-app/02-guides/client-side-data-fetching/tanstack-query.md`.
- `error.js` et `retry()` : `01-app/03-api-reference/03-file-conventions/error.md`.
- `useSearchParams` sous `<Suspense>` : `01-app/03-api-reference/04-functions/use-search-params.md`.
- `PageProps` global, `searchParams` asynchrone : `01-app/03-api-reference/03-file-conventions/page.md`.
- Route Handler `GET` dynamique dès qu'il lit `request.headers` : `01-app/01-getting-started/15-route-handlers.md`.
- Session better-auth côté serveur : https://www.better-auth.com/docs/integrations/next
- nuqs, adaptateur App Router : https://nuqs.dev/docs/adapters ; lecture serveur `createLoader` / `createSearchParamsCache` : https://nuqs.dev/docs/server-side ; `useQueryStates` : https://nuqs.dev/docs/batching ; `shallow`, `startTransition`, `debounce`, `clearOnDefault` : https://nuqs.dev/docs/options ; parseurs et import `nuqs/server` : https://nuqs.dev/docs/parsers/built-in. Vérifié dans le paquet `nuqs@2.10.1` : l'adaptateur n'appelle `useSearchParams` que dans les hooks ; `debounce` et `inferParserType` sont exportés par `nuqs/server`.
- next-safe-action : client et `.use()` : https://next-safe-action.dev/docs/define-actions/create-the-client ; erreurs de validation : https://next-safe-action.dev/docs/define-actions/validation-errors ; `useAction` et `executeAsync` : https://next-safe-action.dev/docs/execute-actions/hooks/useaction ; `returnServerError` : https://next-safe-action.dev/docs/concepts/error-handling. Vérifié dans le paquet `next-safe-action@8.7.3` : forme formatée `{ champ: { _errors } }`.
- TanStack Form, validation `onSubmitAsync` qui renvoie `{ form, fields }` : https://tanstack.com/form/latest/docs/framework/react/guides/validation. Vérifié dans `@tanstack/form-core@1.33.5` : l'envoi marque tous les champs comme touchés, la validation asynchrone ne s'exécute que si la validation synchrone passe.
- shadcn + TanStack Form : https://ui.shadcn.com/docs/forms/tanstack-form ; Field : https://ui.shadcn.com/docs/components/field ; Native Select : https://ui.shadcn.com/docs/components/native-select
- Zod 4 (messages, `z.input`) : https://zod.dev/api
- Drizzle : types de colonnes https://orm.drizzle.team/docs/column-types/pg ; `$count` https://orm.drizzle.team/docs/query-utils ; PGlite https://orm.drizzle.team/docs/connect-pglite ; migrations https://orm.drizzle.team/docs/migrations
- Zustand avec Next.js (magasin par fournisseur) : https://zustand.docs.pmnd.rs/learn/guides/nextjs
- Essai réel le 2026-10-06 sur le squelette du pack (Next.js 16.4.0, nuqs 2.10.1, shadcn 4.21.3 « base-nova », Biome 2.5.15, PGlite 0.5.8, Playwright 1.63.0, TanStack Query 5.104.1, Zustand 5.0.15) : `npm run check`, `npm run typecheck`, `npm test`, `npm run build` sans variables, puis Playwright sur ordinateur et téléphone (filtres, tri, recherche, création, route 401, action refusée sans session).
- Rejoué le 2026-10-08 dans l'architecture du pack (`app/` à la racine, alias `@src/`, règles de couches de Biome, shadcn 4.21.4), après la recette `connexion` : `npm run db:generate`, `npm run check`, `npm run typecheck`, `npm test`, `npm run build` avec des valeurs factices. Les parcours Playwright restent à rejouer sur cette organisation.

## Points à vérifier

- **Connexion réelle à Neon** : la recette a été essayée de bout en bout sur PGlite (`npm test`, puis `next start` et `next dev` branchés sur PGlite pour les tests Playwright). À rejouer une fois sur Neon.
- **Erreurs de validation renvoyées par le serveur** : le formulaire valide avant l'envoi, donc l'essai n'a pas déclenché `validationErrors` côté serveur. `erreursDeChamps` est couverte par son test unitaire seulement.
- **Scénario « Base indisponible »** (`error.tsx` et `retry()`) : non essayé.
- **Parcours Playwright dans l'architecture du pack** (`e2e/factures.spec.ts`, avec `champ()`) : à rejouer.

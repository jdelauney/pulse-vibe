# Recette : liste

> Quand l'utiliser : la personne connectée consulte ses propres éléments (ici ses factures) dans une liste filtrable, triable et paginée, et en ajoute de nouveaux depuis la même page.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`) : `next.config.ts` contient `cacheComponents: true`, `partialPrefetching: true` et `reactCompiler: true`.
- La recette `connexion` est faite (`pulse-aidd pile recette connexion`). Elle fournit :
  - `utilisateurConnecte()` dans `src/features/compte/session.ts` (`server-only`, `React.cache`) : renvoie `{ id, nom }`, ou redirige vers `/connexion` sans session ; elle s'appelle dans un composant placé sous `<Suspense>` ;
  - `actionConnectee` dans `src/lib/safe-action.ts`, qui fournit `ctx.utilisateur` = `{ id, nom }` et garde la forme d'erreurs de validation par défaut de next-safe-action (forme « formatée » : `{ champ: { _errors: [...] } }`) ;
  - `src/lib/auth.ts` (better-auth, fonction `getAuth()`) et la table `user` dans `src/db/schema/auth.ts` ;
  - le groupe de routes `src/app/(connecte)/` ;
  - l'aide de test `e2e/aides/connexion.ts` (fonction `connecterNouvelUtilisateur(page)`).
- `src/db/index.ts` exporte `getDb()` et le type `Db`. `vitest.config.ts` tourne en environnement `node`, avec l'alias `@` → `src`.
- Paquets du squelette : `next`, `react`, `next-safe-action`, `zod`, `@tanstack/react-form`, `nuqs`, `drizzle-orm`, `sonner` (recette vérifiée avec les versions du squelette du 2026-10-06). Pour les tests : `vitest`, `@electric-sql/pglite`, `@playwright/test`. Si l'un manque, l'installer à sa dernière version : `npm install <paquet>`.
- Composants shadcn (Base UI) : le squelette fournit déjà `button`, `card`, `field`, `input`, `label`, `separator`, `skeleton`, `sonner`. Ajoutez ceux de la liste : `npx shadcn@latest add native-select table badge`.
- Le layout racine contient déjà `NuqsAdapter` (`nuqs/adapters/next/app`). Vérifiez qu'il affiche aussi `<Toaster />` (`@/components/ui/sonner`) ; ajoutez-le après `{children}` s'il manque.

## Variables d'environnement

Aucune nouvelle variable. La recette utilise la base déjà configurée par le squelette (`DATABASE_URL`).

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/features/factures/constantes.ts` | Statuts, tris, taille de page, noms des champs (partagés serveur et client) |
| `src/db/schema/factures.ts` | Table Drizzle `factures` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée par `npm run db:generate` |
| `src/features/factures/regles.ts` | Règles pures : montant, dates, pagination, recherche, erreurs serveur |
| `src/features/factures/schemas.ts` | Schéma Zod partagé par le formulaire et l'action |
| `src/features/factures/filtres.ts` | Paramètres d'adresse (nuqs), lus côté serveur et côté client |
| `src/features/factures/queries.ts` | Accès à la base (`server-only`) : liste filtrée, insertion |
| `src/features/factures/actions.ts` | Action « créer une facture » (next-safe-action) |
| `src/features/factures/components/liste-factures.tsx` | Composant serveur : lit la session, les filtres et la base |
| `src/features/factures/components/tableau-factures.tsx` | Tableau des factures et état « page vide » |
| `src/features/factures/components/filtres-factures.tsx` | Contrôles client : statut, recherche, tri |
| `src/features/factures/components/pagination-factures.tsx` | Contrôles client : page précédente, page suivante |
| `src/features/factures/components/formulaire-facture.tsx` | Formulaire TanStack Form + Field shadcn |
| `src/app/(connecte)/factures/page.tsx` | La page, avec ses zones `<Suspense>` |
| `src/app/(connecte)/factures/error.tsx` | État d'erreur de la page |
| `src/proxy.ts` (modifié) | Ajoute `/factures` au renvoi rapide vers `/connexion` |
| `src/features/factures/regles.test.ts`, `schemas.test.ts` | Tests unitaires |
| `src/features/factures/queries.test.ts` | Tests d'intégration avec PGlite |
| `e2e/factures.spec.ts` | Test de bout en bout Playwright |

## Étapes

Exemple fil rouge : les **factures** d'une personne connectée. Remplacez `factures` par le mot du glossaire du projet, et `US-XXX` par le numéro de l'US.

### 1. Les constantes partagées

```ts
// src/features/factures/constantes.ts
export const STATUTS_FACTURE = ["brouillon", "envoyee", "payee"] as const;
export type StatutFacture = (typeof STATUTS_FACTURE)[number];

export const LIBELLES_STATUT: Record<StatutFacture, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
};

export const FILTRES_STATUT = ["tous", ...STATUTS_FACTURE] as const;
export type FiltreStatut = (typeof FILTRES_STATUT)[number];

export const TRIS_FACTURES = [
  "recentes",
  "anciennes",
  "montant-desc",
  "montant-asc",
] as const;
export type TriFactures = (typeof TRIS_FACTURES)[number];

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

### 2. La table et sa migration

Montant en **centimes entiers**, date de création en `timestamp with time zone`, propriétaire dans `utilisateur_id`.

```ts
// src/db/schema/factures.ts
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
import { STATUTS_FACTURE } from "@/features/factures/constantes";
import { user } from "./auth";

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

Si le projet a un fichier `src/db/schema/index.ts`, ajoutez-y `export * from "./factures";`.

Puis générez la migration, relisez le fichier SQL créé dans `drizzle/`, et appliquez-la :

```bash
npm run db:generate
npm run db:migrate
```

### 3. Les règles pures

Toute la logique sans base ni écran vit ici. Elle se teste en unitaire.

```ts
// src/features/factures/regles.ts
import { CHAMPS_FACTURE, type ChampFacture } from "./constantes";

/** Format accepté pour un montant saisi en euros : 120 ; 120,5 ; 120.50. */
export const FORMAT_MONTANT = /^\d{1,7}([.,]\d{1,2})?$/;

/** Convertit un montant saisi en euros (« 120,50 ») en centimes entiers (12050), sans calcul à virgule. */
export function eurosEnCentimes(saisie: string): number {
  const valeur = saisie.trim();
  if (!FORMAT_MONTANT.test(valeur)) return Number.NaN;
  const [euros, decimales = ""] = valeur.split(/[.,]/);
  return Number(euros) * 100 + Number(decimales.padEnd(2, "0"));
}

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

export function pageValide(page: number): number {
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function decalagePourPage(page: number, taillePage: number): number {
  return (pageValide(page) - 1) * taillePage;
}

export function nombreDePages(total: number, taillePage: number): number {
  return Math.max(1, Math.ceil(total / taillePage));
}

/** Rend %, _ et \ ordinaires dans un motif ILIKE : la recherche « 100% » cherche le texte « 100% ». */
export function echapperMotifLike(texte: string): string {
  return texte.replace(/[\\%_]/g, "\\$&");
}

type ErreursFormatees = Partial<Record<ChampFacture, { _errors?: string[] }>>;

/** Transforme les erreurs de validation de next-safe-action en erreurs de champ pour TanStack Form. */
export function erreursServeurParChamp(
  erreurs: ErreursFormatees,
): Partial<Record<ChampFacture, { message: string }>> {
  const champs: Partial<Record<ChampFacture, { message: string }>> = {};
  for (const champ of CHAMPS_FACTURE) {
    const message = erreurs[champ]?._errors?.[0];
    if (message) champs[champ] = { message };
  }
  return champs;
}
```

### 4. Le schéma Zod partagé

Le formulaire et l'action valident avec **le même** schéma. Le montant reste une saisie en euros ; l'action le convertit en centimes.

```ts
// src/features/factures/schemas.ts
import { z } from "zod";
import { eurosEnCentimes, FORMAT_MONTANT } from "./regles";

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
      (valeur) => !FORMAT_MONTANT.test(valeur) || eurosEnCentimes(valeur) > 0,
      "Le montant doit être supérieur à 0 €.",
    ),
});

export type CreerFactureEntree = z.input<typeof creerFactureSchema>;
```

### 5. Les filtres dans l'adresse (nuqs)

Un seul fichier décrit les paramètres. Il importe depuis `nuqs/server`, ce qui le rend utilisable **côté serveur et côté client**.

```ts
// src/features/factures/filtres.ts
import {
  createLoader,
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { FILTRES_STATUT, TRIS_FACTURES } from "./constantes";

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

### 6. L'accès à la base

Chaque fonction reçoit l'identifiant de la personne connectée, et la base en dernier paramètre (`getDb()` par défaut, PGlite dans les tests).

```ts
// src/features/factures/queries.ts
import "server-only";
import { and, asc, desc, eq, ilike, type SQL } from "drizzle-orm";
import { type Db, getDb } from "@/db";
import { factures } from "@/db/schema/factures";
import { TAILLE_PAGE, type TriFactures } from "./constantes";
import type { FiltresFactures } from "./filtres";
import { decalagePourPage, echapperMotifLike } from "./regles";

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

export async function listerFactures(
  utilisateurId: string,
  filtres: FiltresFactures,
  db: Db = getDb(),
) {
  const conditions: SQL[] = [eq(factures.utilisateurId, utilisateurId)];
  if (filtres.statut !== "tous") {
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
      .select({
        id: factures.id,
        client: factures.client,
        montantCentimes: factures.montantCentimes,
        statut: factures.statut,
        creeLe: factures.creeLe,
      })
      .from(factures)
      .where(filtre)
      .orderBy(...ORDRE_PAR_TRI[filtres.tri])
      .limit(TAILLE_PAGE)
      .offset(decalagePourPage(filtres.page, TAILLE_PAGE)),
    db.$count(factures, filtre),
  ]);

  return { factures: lignes, total };
}

export type FactureDeListe = Awaited<
  ReturnType<typeof listerFactures>
>["factures"][number];

export async function insererFacture(
  utilisateurId: string,
  donnees: { client: string; montantCentimes: number },
  db: Db = getDb(),
) {
  const [facture] = await db
    .insert(factures)
    .values({ utilisateurId, ...donnees })
    .returning({ id: factures.id });
  if (!facture) throw new Error("La base n'a pas renvoyé la facture créée.");
  return facture;
}
```

### 7. L'action « créer une facture »

L'identifiant du propriétaire vient **de la session** (`ctx.utilisateur.id`), jamais de la saisie. Après l'écriture, `refresh()` renvoie la page à jour dans la même réponse : la liste est lue sans cache (`use cache` absent), donc il n'y a pas d'étiquette de cache à invalider.

```ts
// src/features/factures/actions.ts
"use server";

import { refresh } from "next/cache";
import { actionConnectee } from "@/lib/safe-action";
import { insererFacture } from "./queries";
import { eurosEnCentimes } from "./regles";
import { creerFactureSchema } from "./schemas";

export const creerFacture = actionConnectee
  .inputSchema(creerFactureSchema)
  .action(async ({ parsedInput, ctx }) => {
    const facture = await insererFacture(ctx.utilisateur.id, {
      client: parsedInput.client,
      montantCentimes: eurosEnCentimes(parsedInput.montant),
    });
    refresh();
    return { id: facture.id };
  });
```

### 8. Le formulaire (TanStack Form + Field)

Le schéma Zod valide dans le navigateur (`onSubmit`). S'il passe, `onSubmitAsync` appelle l'action ; les erreurs renvoyées par le serveur s'affichent sous les champs concernés.

```tsx
// src/features/factures/components/formulaire-facture.tsx
"use client";

import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { creerFacture } from "../actions";
import { erreursServeurParChamp } from "../regles";
import { creerFactureSchema } from "../schemas";

/** Ramène les erreurs (problèmes Zod ou erreurs du serveur) à la forme attendue par FieldError. */
function enMessages(erreurs: readonly unknown[]): { message: string }[] {
  return erreurs.flatMap((erreur) => {
    if (typeof erreur === "string") return [{ message: erreur }];
    if (
      typeof erreur === "object" &&
      erreur !== null &&
      "message" in erreur &&
      typeof erreur.message === "string"
    ) {
      return [{ message: erreur.message }];
    }
    return [];
  });
}

export function FormulaireFacture() {
  const form = useForm({
    defaultValues: { client: "", montant: "" },
    validators: {
      onSubmit: creerFactureSchema,
      onSubmitAsync: async ({ value }) => {
        const resultat = await creerFacture(value);
        if (resultat.validationErrors) {
          toast.error("Vérifiez les champs signalés.");
          return {
            form: "La saisie a été refusée par le serveur.",
            fields: erreursServeurParChamp(resultat.validationErrors),
          };
        }
        if (resultat.serverError) {
          toast.error(
            "La facture n'a pas pu être créée. Réessayez dans un instant.",
          );
          return { form: "Erreur du serveur.", fields: {} };
        }
        return null;
      },
    },
    onSubmit: ({ formApi }) => {
      toast.success("Facture créée.");
      formApi.reset();
    },
  });

  return (
    <form
      id="formulaire-facture"
      noValidate
      onSubmit={(evenement) => {
        evenement.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="client">
          {(field) => {
            const invalide =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={field.name}>Client</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(evenement) =>
                    field.handleChange(evenement.target.value)
                  }
                  aria-invalid={invalide}
                  autoComplete="organization"
                />
                {invalide && (
                  <FieldError errors={enMessages(field.state.meta.errors)} />
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="montant">
          {(field) => {
            const invalide =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={field.name}>Montant (€)</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(evenement) =>
                    field.handleChange(evenement.target.value)
                  }
                  aria-invalid={invalide}
                  inputMode="decimal"
                  autoComplete="off"
                />
                <FieldDescription>Par exemple 120,50.</FieldDescription>
                {invalide && (
                  <FieldError errors={enMessages(field.state.meta.errors)} />
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Subscribe selector={(etat) => etat.isSubmitting}>
          {(envoiEnCours) => (
            <Button type="submit" disabled={envoiEnCours}>
              {envoiEnCours ? "Création en cours…" : "Créer la facture"}
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  );
}
```

### 9. Les contrôles de filtre et de pagination (client)

`shallow: false` demande au serveur de refaire la liste à chaque changement d'adresse. `startTransition` donne l'indicateur « Mise à jour… ». Chaque changement de filtre ramène à la page 1.

```tsx
// src/features/factures/components/filtres-factures.tsx
"use client";

import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  FILTRES_STATUT,
  LIBELLES_STATUT,
  LIBELLES_TRI,
  TRIS_FACTURES,
} from "../constantes";
import { filtresFactures } from "../filtres";

export function FiltresFactures() {
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
          onChange={(evenement) =>
            setFiltres(
              { recherche: evenement.target.value, page: 1 },
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
          onChange={(evenement) =>
            setFiltres({
              statut:
                FILTRES_STATUT.find((s) => s === evenement.target.value) ??
                "tous",
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
          onChange={(evenement) =>
            setFiltres({
              tri:
                TRIS_FACTURES.find((t) => t === evenement.target.value) ??
                "recentes",
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
// src/features/factures/components/pagination-factures.tsx
"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { filtresFactures } from "../filtres";
import { pageValide } from "../regles";

export function PaginationFactures({
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

### 10. La liste (composant serveur) et son tableau

```tsx
// src/features/factures/components/liste-factures.tsx
import { utilisateurConnecte } from "@/features/compte/session";
import { TAILLE_PAGE } from "../constantes";
import { chargerFiltresFactures } from "../filtres";
import { listerFactures } from "../queries";
import { nombreDePages } from "../regles";
import { PaginationFactures } from "./pagination-factures";
import { TableauFactures } from "./tableau-factures";

export async function ListeFactures({
  searchParams,
}: {
  searchParams: PageProps<"/factures">["searchParams"];
}) {
  const utilisateur = await utilisateurConnecte();
  const filtres = await chargerFiltresFactures(searchParams);
  const { factures, total } = await listerFactures(utilisateur.id, filtres);

  if (total === 0) {
    const filtresActifs =
      filtres.statut !== "tous" || filtres.recherche.trim() !== "";
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {total} facture{total > 1 ? "s" : ""}
      </p>
      <TableauFactures factures={factures} />
      <PaginationFactures nombreDePages={nombreDePages(total, TAILLE_PAGE)} />
    </div>
  );
}
```

```tsx
// src/features/factures/components/tableau-factures.tsx
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LIBELLES_STATUT, type StatutFacture } from "../constantes";
import type { FactureDeListe } from "../queries";
import { formaterDate, formaterMontant } from "../regles";

const VARIANTE_STATUT: Record<
  StatutFacture,
  "outline" | "secondary" | "default"
> = {
  brouillon: "outline",
  envoyee: "secondary",
  payee: "default",
};

export function TableauFactures({ factures }: { factures: FactureDeListe[] }) {
  if (factures.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Cette page est vide. Revenez à la page précédente.
      </p>
    );
  }

  return (
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
  );
}
```

### 11. La page, le chargement et l'erreur

Avec Cache Components, tout ce qui lit la requête (session, `searchParams`) ou la base sans cache se place **sous `<Suspense>`**. La page elle-même reste synchrone : elle passe la promesse `searchParams` à la liste sans l'attendre. Le titre, le formulaire et les squelettes partent tout de suite ; la liste arrive ensuite. La recette n'utilise pas `loading.tsx` : la documentation recommande `<Suspense>` au plus près de la lecture.

```tsx
// src/app/(connecte)/factures/page.tsx
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FiltresFactures } from "@/features/factures/components/filtres-factures";
import { FormulaireFacture } from "@/features/factures/components/formulaire-facture";
import { ListeFactures } from "@/features/factures/components/liste-factures";

export default function PageFactures(props: PageProps<"/factures">) {
  return (
    <main className="mx-auto max-w-4xl space-y-10 p-6">
      <h1 className="text-2xl font-semibold">Mes factures</h1>

      <section aria-labelledby="titre-nouvelle-facture" className="space-y-4">
        <h2 id="titre-nouvelle-facture" className="text-lg font-medium">
          Nouvelle facture
        </h2>
        <FormulaireFacture />
      </section>

      <section aria-labelledby="titre-liste-factures" className="space-y-4">
        <h2 id="titre-liste-factures" className="text-lg font-medium">
          Liste
        </h2>
        <Suspense fallback={<Skeleton className="h-16 w-full" />}>
          <FiltresFactures />
        </Suspense>
        <Suspense fallback={<SqueletteListe />}>
          <ListeFactures searchParams={props.searchParams} />
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
// src/app/(connecte)/factures/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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

Ajoutez enfin l'adresse de la page au renvoi rapide de `src/proxy.ts` (recette `connexion`) :

```ts
export const config = {
  matcher: ["/compte/:path*", "/factures/:path*"],
};
```

### 12. Quand utiliser TanStack Query ou Zustand

**Par défaut, ni l'un ni l'autre.** La liste se lit dans le composant serveur, l'état partageable vit dans l'adresse (nuqs), et l'écriture passe par une action suivie de `refresh()`.

- **TanStack Query** : pour une donnée qui se met à jour **seule, sans navigation** dans un écran très interactif (rafraîchissement régulier, défilement infini, autocomplétion). Il lit une route API (Route Handler) qui vérifie la session.
- **Zustand** : pour un état d'interface **partagé entre composants clients sans lien parent** (panneau ouvert, panier non enregistré). Une donnée de la base ou un filtre partageable n'y va pas : la base reste la source, l'adresse garde les filtres.

Mini-exemple TanStack Query : le total impayé, rafraîchi toutes les 30 secondes. Installez d'abord le paquet : `npm install @tanstack/react-query` (dernière version ; vérifié avec 5.104.1).

```tsx
// src/app/(connecte)/factures/providers.tsx
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

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
```

```tsx
// src/app/(connecte)/factures/layout.tsx
import { Providers } from "./providers";

export default function Layout({ children }: LayoutProps<"/factures">) {
  return <Providers>{children}</Providers>;
}
```

```ts
// src/features/factures/queries.ts (ajout)
// Ajoutez `ne` et `sql` à l'import de "drizzle-orm".
export async function totalImpaye(utilisateurId: string, db: Db = getDb()) {
  const [ligne] = await db
    .select({
      total: sql<number>`coalesce(sum(${factures.montantCentimes}), 0)`.mapWith(
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
}
```

```ts
// src/app/api/factures/total-impaye/route.ts
import { totalImpaye } from "@/features/factures/queries";
import { getAuth } from "@/lib/auth";

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
// src/features/factures/components/total-impaye.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { formaterMontant } from "../regles";

async function chargerTotalImpaye(): Promise<{ totalCentimes: number }> {
  const reponse = await fetch("/api/factures/total-impaye");
  if (!reponse.ok) throw new Error("Total impayé indisponible");
  return reponse.json();
}

export function TotalImpaye() {
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

Dans la page, placez `<TotalImpaye />` dans son propre `<Suspense fallback={<Skeleton className="h-6 w-48" />}>` : avec Cache Components, Next.js pré-rend aussi les composants clients, et TanStack Query lit l'heure courante.

Mini-exemple Zustand : un panneau d'aide ouvert depuis l'en-tête et fermé depuis le panneau. Le magasin se crée **dans un fournisseur**, une fois par rendu, jamais en variable globale. Installez d'abord le paquet : `npm install zustand` (dernière version ; vérifié avec 5.0.15).

```ts
// src/features/factures/panneau-store.ts
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
// src/features/factures/components/panneau-provider.tsx
"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import { creerPanneauStore, type PanneauStore } from "../panneau-store";

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

Usage dans un composant client : `const ouvrir = usePanneau((etat) => etat.ouvrir);`. Les composants serveur ne lisent pas ce magasin.

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

- [ ] **T1 – Table des factures** · US-XXX
  - Objectif : la base sait enregistrer les factures de chaque personne
  - Dépend de : —
  - Fichiers : à créer : `src/features/factures/constantes.ts`, `src/db/schema/factures.ts`, migration dans `drizzle/`
  - Vérification : US-XXX critère 1 – la migration générée crée la table `factures` avec `utilisateur_id`, `montant_centimes` et `cree_le` en `timestamp with time zone`
  - Tests : aucun (couvert par T3)
  - Attention : relire le SQL généré avant `npm run db:migrate`
- [ ] **T2 – Règles et schéma des factures** · US-XXX
  - Objectif : les montants, dates, pages et erreurs sont calculés de façon sûre
  - Dépend de : T1
  - Fichiers : à créer : `src/features/factures/regles.ts`, `schemas.ts`, `regles.test.ts`, `schemas.test.ts`
  - Vérification : US-XXX critère 6 – `npm test` passe sur les conversions de montant et les messages d'erreur
  - Tests : « Le montant saisi en euros est enregistré en centimes » (unitaire) ; « Un montant invalide est refusé avec un message » (unitaire) ; « Nombre de pages selon le nombre de factures » (unitaire)
- [ ] **T3 – Lecture filtrée et création en base** · US-XXX
  - Objectif : la base renvoie les factures de la personne, filtrées, triées et paginées
  - Dépend de : T2
  - Fichiers : à créer : `src/features/factures/filtres.ts`, `queries.ts`, `queries.test.ts`
  - Vérification : US-XXX critères 1 à 4 – `npm test` passe sur la base PGlite
  - Tests : « Camille ne voit pas les factures de Léo » (intégration) ; « Filtre « Payée » » (intégration) ; « La recherche ignore les majuscules » (intégration) ; « Le signe % est cherché comme un caractère » (intégration) ; « Tri par montant décroissant » (intégration) ; « 12 factures : 10 en page 1, 2 en page 2 » (intégration)
  - Attention : chaque requête filtre par `utilisateurId` (S3)
- [ ] **T4 – Action et formulaire de création** · US-XXX
  - Objectif : la personne crée une facture et voit le message de confirmation
  - Dépend de : T3
  - Fichiers : à créer : `src/features/factures/actions.ts`, `components/formulaire-facture.tsx`
  - Vérification : US-XXX critère 6 – une facture créée apparaît dans la liste sans recharger la page ; un montant « 0 » affiche son message sous le champ
  - Tests : « Une création envoyée sans être connecté est refusée » (manuel)
  - Attention : le propriétaire vient de `ctx.utilisateur.id`, jamais de la saisie (S3, S4)
- [ ] **T5 – Page liste avec filtres, pagination et états** · US-XXX
  - Objectif : la personne consulte, filtre, trie et pagine ses factures
  - Dépend de : T4
  - Fichiers : à créer : `components/liste-factures.tsx`, `tableau-factures.tsx`, `filtres-factures.tsx`, `pagination-factures.tsx`, `src/app/(connecte)/factures/page.tsx`, `error.tsx` · à modifier : `src/proxy.ts` (matcher), `src/app/layout.tsx` seulement si `<Toaster />` manque
  - Vérification : US-XXX critères 2 à 5 et 7 – `npm run build` passe ; filtrer change l'adresse et la liste ; recharger garde les filtres
  - Tests : « Première visite : la liste invite à créer une facture » (manuel) ; « Base indisponible : un message propose de réessayer » (manuel)
  - Attention : chaque lecture de la requête ou de la base reste sous `<Suspense>`
- [ ] **T6 – Parcours de bout en bout** · US-XXX
  - Objectif : le parcours complet est vérifié automatiquement
  - Dépend de : T5
  - Fichiers : à créer : `e2e/factures.spec.ts`
  - Vérification : US-XXX critères 5 et 6 – `npm run test:e2e` passe
  - Tests : « Création d'une facture de 120,50 € pour « Atelier Dupont » » (bout en bout) ; « Après un rechargement, la recherche est conservée » (bout en bout)

## Tests

### Unitaires (Vitest)

```ts
// src/features/factures/regles.test.ts
import { describe, expect, it } from "vitest";
import {
  decalagePourPage,
  echapperMotifLike,
  erreursServeurParChamp,
  eurosEnCentimes,
  formaterDate,
  formaterMontant,
  nombreDePages,
} from "./regles";

/** Intl sépare le montant et « € » par une espace insécable : on la remplace pour comparer. */
const espacesSimples = (texte: string) => texte.replace(/\s/g, " ");

describe("Règles des factures", () => {
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

  it("US-XXX-6 – 12050 centimes s'affichent « 120,50 € »", () => {
    expect(espacesSimples(formaterMontant(12050))).toBe("120,50 €");
  });

  it("US-XXX-6 – une date s'affiche à l'heure de Paris", () => {
    expect(formaterDate(new Date("2026-03-09T23:30:00Z"))).toBe("10 mars 2026");
  });

  it.each([
    [0, 1],
    [10, 1],
    [11, 2],
  ])("US-XXX-4 – %i factures font %i page(s)", (total, pages) => {
    expect(nombreDePages(total, 10)).toBe(pages);
  });

  it("US-XXX-4 – une page invalide revient à la page 1", () => {
    expect(decalagePourPage(-3, 10)).toBe(0);
    expect(decalagePourPage(2, 10)).toBe(10);
  });

  it("US-XXX-2 – %, _ et \\ sont cherchés comme des caractères", () => {
    expect(echapperMotifLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });

  it("US-XXX-6 – les erreurs du serveur deviennent des erreurs de champ", () => {
    expect(
      erreursServeurParChamp({
        montant: { _errors: ["Le montant doit être supérieur à 0 €."] },
      }),
    ).toEqual({
      montant: { message: "Le montant doit être supérieur à 0 €." },
    });
  });
});
```

```ts
// src/features/factures/schemas.test.ts
import { describe, expect, it } from "vitest";
import { creerFactureSchema } from "./schemas";

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

### Intégration de `queries.ts` (Vitest + PGlite)

Chaque test reçoit une base PGlite neuve (Postgres en mémoire) avec les vraies migrations : `creerBaseDeTest()` du squelette. La base est passée en paramètre ; le test n'ouvre jamais la base réelle.

```ts
// src/features/factures/queries.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { user } from "@/db/schema/auth";
import { factures } from "@/db/schema/factures";
import { creerBaseDeTest } from "../../../tests/helpers/base-de-test";
import type { StatutFacture } from "./constantes";
import type { FiltresFactures } from "./filtres";
import { insererFacture, listerFactures } from "./queries";

const FILTRES_PAR_DEFAUT: FiltresFactures = {
  statut: "tous",
  recherche: "",
  tri: "recentes",
  page: 1,
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

describe("listerFactures", () => {
  it("US-XXX-1 – Camille ne voit pas les factures de Léo", async () => {
    await ajouter("camille", "Atelier Dupont", 12050);
    await ajouter("leo", "Boulangerie Martin", 4500);

    const { factures: liste, total } = await listerFactures(
      "camille",
      FILTRES_PAR_DEFAUT,
      db,
    );

    expect(liste.map((f) => f.client)).toEqual(["Atelier Dupont"]);
    expect(total).toBe(1);
  });

  it("US-XXX-2 – le filtre « Payée » ne garde que les factures payées", async () => {
    await ajouter("camille", "Atelier Dupont", 12050, "payee");
    await ajouter("camille", "Café Leroy", 8000, "brouillon");

    const { factures: liste } = await listerFactures(
      "camille",
      { ...FILTRES_PAR_DEFAUT, statut: "payee" },
      db,
    );

    expect(liste.map((f) => f.client)).toEqual(["Atelier Dupont"]);
  });

  it("US-XXX-2 – la recherche ignore les majuscules", async () => {
    await ajouter("camille", "Atelier Dupont", 12050);

    const { factures: liste } = await listerFactures(
      "camille",
      { ...FILTRES_PAR_DEFAUT, recherche: "dupont" },
      db,
    );

    expect(liste.map((f) => f.client)).toEqual(["Atelier Dupont"]);
  });

  it("US-XXX-2 – le signe % est cherché comme un caractère", async () => {
    await ajouter("camille", "Remise 100%", 1000);
    await ajouter("camille", "Atelier Dupont", 12050);

    const { factures: liste } = await listerFactures(
      "camille",
      { ...FILTRES_PAR_DEFAUT, recherche: "100%" },
      db,
    );

    expect(liste.map((f) => f.client)).toEqual(["Remise 100%"]);
  });

  it("US-XXX-3 – le tri par montant décroissant range 120,50 €, 80 €, 45 €", async () => {
    await ajouter("camille", "Boulangerie Martin", 4500);
    await ajouter("camille", "Atelier Dupont", 12050);
    await ajouter("camille", "Café Leroy", 8000);

    const { factures: liste } = await listerFactures(
      "camille",
      { ...FILTRES_PAR_DEFAUT, tri: "montant-desc" },
      db,
    );

    expect(liste.map((f) => f.montantCentimes)).toEqual([12050, 8000, 4500]);
  });

  it("US-XXX-4 – 12 factures : 2 en page 2, total 12", async () => {
    for (let numero = 1; numero <= 12; numero++) {
      await ajouter("camille", `Client ${numero}`, numero * 100);
    }

    const { factures: liste, total } = await listerFactures(
      "camille",
      { ...FILTRES_PAR_DEFAUT, page: 2 },
      db,
    );

    expect(liste).toHaveLength(2);
    expect(total).toBe(12);
  });
});

describe("insererFacture", () => {
  it("US-XXX-6 – la facture créée appartient à la personne indiquée", async () => {
    const { id } = await insererFacture(
      "camille",
      { client: "Atelier Dupont", montantCentimes: 12050 },
      db,
    );

    const { factures: liste } = await listerFactures(
      "camille",
      FILTRES_PAR_DEFAUT,
      db,
    );

    expect(liste).toEqual([
      expect.objectContaining({
        id,
        client: "Atelier Dupont",
        montantCentimes: 12050,
        statut: "brouillon",
      }),
    ]);
  });
});
```

### Bout en bout (Playwright)

```ts
// e2e/factures.spec.ts
import { expect, type Page, test } from "@playwright/test";
import { connecterNouvelUtilisateur } from "./aides/connexion";

async function creerFacture(page: Page, client: string, montant: string) {
  await page.getByLabel("Client", { exact: true }).fill(client);
  await page.getByLabel("Montant (€)").fill(montant);
  await page.getByRole("button", { name: "Créer la facture" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(client) }),
  ).toBeVisible();
}

test.describe("Mes factures", () => {
  test.beforeEach(async ({ page }) => {
    await connecterNouvelUtilisateur(page);
    await page.goto("/factures");
  });

  test("US-XXX-6 – une facture créée apparaît dans la liste avec un message", async ({
    page,
  }) => {
    await expect(
      page.getByText("Vous n'avez pas encore de facture."),
    ).toBeVisible();

    await page.getByLabel("Client", { exact: true }).fill("Atelier Dupont");
    await page.getByLabel("Montant (€)").fill("120,50");
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

    await page.getByLabel("Rechercher un client").fill("dupont");
    await expect(page).toHaveURL(/recherche=dupont/);
    await expect(
      page.getByRole("row", { name: /Boulangerie Martin/ }),
    ).toHaveCount(0);

    await page.reload();

    await expect(page.getByLabel("Rechercher un client")).toHaveValue("dupont");
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

- **S3 – Contrôle d'accès aux données** : chaque requête de `queries.ts` filtre par `utilisateurId`. L'identifiant vient de la session : `ctx.utilisateur.id` dans l'action, `utilisateurConnecte()` dans la liste. Le test « Camille ne voit pas les factures de Léo » le prouve.
- **S4 – Pages et actions réservées** : l'action utilise `actionConnectee`, car une Server Action est joignable par une requête directe. La liste appelle `utilisateurConnecte()`, qui renvoie vers `/connexion` sans session. La route API du mini-exemple répond 401 sans session.
- **S5 – Validation des entrées** : l'action revalide avec le schéma Zod, même après la validation du formulaire. Les filtres de l'adresse passent par les parseurs nuqs : un statut ou un tri inconnu revient à sa valeur par défaut, une page invalide revient à 1. La recherche reste un paramètre de requête Drizzle, avec `%`, `_` et `\` échappés.
- **S6 – Affichage sans injection** : les textes s'affichent par JSX, en texte simple.
- **S9 – Données personnelles** : `error.tsx` journalise l'erreur dans le navigateur ; les journaux serveur gardent le nom du client hors des messages.
- **S11 – Messages d'erreur** : la personne voit un message en français, sans détail technique. En production, Next.js remplace le message d'une erreur serveur par un identifiant (`digest`).
- `queries.ts` commence par `import "server-only"` : un import depuis un composant client casse la construction au lieu d'exposer la base.

## Pièges connus

- **Composant client avec nuqs hors de `<Suspense>`** : la construction échoue (« URL data in a Client Component outside of Suspense »). Gardez `FiltresFactures` et `PaginationFactures` sous un `<Suspense>`.
- **Adresse qui change mais liste figée** : ajoutez `shallow: false` aux options de `useQueryStates`, sinon le serveur ne refait pas la liste.
- **Parseurs importés depuis `nuqs` dans `filtres.ts`** : la construction casse côté serveur. Importez-les depuis `nuqs/server` dans tout fichier partagé.
- **Écran pas à jour après la création** : la liste est lue sans cache, donc l'action appelle `refresh()`. Si un jour la lecture passe en `"use cache"` avec `cacheTag`, remplacez `refresh()` par `updateTag(<étiquette>)`. `revalidateTag(…, "max")` ne met pas l'écran à jour dans la même réponse.
- **Fonction utilitaire exportée depuis `actions.ts`** : dans un fichier `"use server"`, chaque fonction exportée devient une adresse publique. Gardez l'accès à la base dans `queries.ts` et n'exportez de `actions.ts` que des actions next-safe-action.
- **`loading.tsx` à la place de `<Suspense>`** : il ne couvre pas une lecture faite dans un `layout.tsx`. Placez `<Suspense>` au plus près de la lecture, comme dans la page ci-dessus.
- **`error.tsx` en Next.js 16.4** : utilisez la propriété `retry()` (elle relit les données) ; `reset()` réaffiche sans relire.
- **Montants** : calculez en centimes entiers ; `eurosEnCentimes` découpe la saisie au lieu de multiplier un nombre à virgule (`0.29 * 100` donne `28.999999999999996`).
- **Dates** : formatez avec `timeZone: "Europe/Paris"` ; le serveur Vercel tourne en UTC.
- **Pagination instable** : ajoutez toujours une colonne unique (`id`) en fin de tri, sinon deux factures de même montant peuvent changer de page.
- **Filtre changé sur la page 3** : remettez `page: 1` avec chaque changement de filtre, sinon la page affichée peut être vide.
- **Biome signale `children=` sur `form.Field`** (règle `noChildrenProp`) : passez la fonction entre les balises, comme dans le formulaire ci-dessus.
- **`FieldError` vide** : il attend des objets `{ message }`. Les erreurs du serveur passent par `erreursServeurParChamp`, puis `enMessages`.
- **Deux messages pour un montant « abc »** : un `refine` Zod s'exécute même après l'échec du `regex`. Le `refine` du schéma ignore donc les saisies hors format.
- **Test qui échoue sur « 120,50 € »** : `Intl` insère une espace insécable avant « € ». Comparez après `replace(/\s/g, " ")`, ou avec `/120,50\s€/` dans Playwright.
- **Test d'intégration qui plante sur `server-only`** : vérifiez l'alias `server-only` de `vitest.config.ts` (squelette), ou ajoutez `vi.mock("server-only", () => ({}))` en tête du fichier de test.
- **Test d'intégration refusé par `tsc` (« not assignable to type 'Db' »)** : une base PGlite créée sans `schema` n'a pas le type `Db`. Utilisez `creerBaseDeTest()` du squelette.
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
- next-safe-action : client et `.use()` : https://next-safe-action.dev/docs/define-actions/create-the-client ; erreurs de validation : https://next-safe-action.dev/docs/define-actions/validation-errors ; appel direct : https://next-safe-action.dev/docs/execute-actions/direct-execution. Vérifié dans le paquet `next-safe-action@8.7.3` : forme formatée `{ champ: { _errors } }`, l'appel renvoie `Promise<SafeActionResult>`.
- TanStack Form, validation `onSubmitAsync` qui renvoie `{ form, fields }` : https://tanstack.com/form/latest/docs/framework/react/guides/validation. Vérifié dans `@tanstack/form-core@1.33.5` : l'envoi marque tous les champs comme touchés, la validation asynchrone ne s'exécute que si la validation synchrone passe.
- shadcn + TanStack Form : https://ui.shadcn.com/docs/forms/tanstack-form ; Field : https://ui.shadcn.com/docs/components/field ; Native Select : https://ui.shadcn.com/docs/components/native-select
- Zod 4 (messages, `z.input`) : https://zod.dev/api
- Drizzle : types de colonnes https://orm.drizzle.team/docs/column-types/pg ; `$count` https://orm.drizzle.team/docs/query-utils ; PGlite https://orm.drizzle.team/docs/connect-pglite ; migrations https://orm.drizzle.team/docs/migrations
- Zustand avec Next.js (magasin par fournisseur) : https://zustand.docs.pmnd.rs/learn/guides/nextjs
- Essai réel le 2026-10-06 sur le squelette du pack (Next.js 16.4.0, nuqs 2.10.1, shadcn 4.21.3 « base-nova », Biome 2.5.15, PGlite 0.5.8, Playwright 1.63.0, TanStack Query 5.104.1, Zustand 5.0.15) : `npm run check`, `npm run typecheck`, `npm test`, `npm run build` sans variables, puis Playwright sur ordinateur et téléphone (filtres, tri, recherche, création, route 401, action refusée sans session).

## Points à vérifier

- **Connexion réelle à Neon** : la recette a été essayée de bout en bout sur PGlite (`npm test`, puis `next start` et `next dev` branchés sur PGlite pour les tests Playwright). À rejouer une fois sur Neon.
- **Erreurs de validation renvoyées par le serveur** : le formulaire valide avant l'envoi, donc l'essai n'a pas déclenché `validationErrors` côté serveur. `erreursServeurParChamp` est couverte par son test unitaire seulement.
- **Scénario « Base indisponible »** (`error.tsx` et `retry()`) : non essayé.

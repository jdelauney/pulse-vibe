# Architecture du code (pack Next.js)

Hexagonal simplifié : le métier au centre, la base et les services autour, Next.js au bord. Chaque fichier a une place unique ; Biome et le test `tests/structure.test.ts` le vérifient.

## 1. Arborescence

```
app/                              routes : pages fines qui rendent des containers
├── (public)/  (connecte)/  (admin)/
├── api/<service>/route.ts        Route Handlers : délèguent à features/<domaine>/webhooks/
├── layout.tsx  page.tsx  globals.css  error.tsx  global-error.tsx  not-found.tsx
├── robots.ts  sitemap.ts  opengraph-image.tsx  icon.tsx  apple-icon.tsx  favicon.ico
proxy.ts                          renvoi rapide vers /connexion (à côté d'app/)
src/
├── core/                         métier pur
│   ├── shared/result.ts          Result, ok(), echec()
│   └── <domaine>/                <sujet>.entity.ts, .rules.ts, .errors.ts, <sujet>-repository.port.ts, use-cases/
├── db/
│   ├── db-client.ts              getDb(), type Db
│   └── <domaine>/                <sujet>.table.ts, <sujet>.repository.ts
├── features/<domaine>/
│   ├── actions/                  <action>.action.ts (écritures)
│   ├── queries/                  <lecture>.query.ts (lectures)
│   ├── schemas/                  <sujet>.schema.ts (Zod partagés formulaire ↔ action)
│   ├── components/               containers/, sections/, composites/, elements/
│   ├── hooks/                    hooks des containers
│   └── constants/  types/  webhooks/
├── adapters/<service>/           <service>.adapter.ts : auth, e-mail, fichiers, paiement
├── components/ui/                primitives shadcn
├── components/shared/            elements/, composites/, sections/ communs à plusieurs features
├── providers/  hooks/  stores/  types/  constants/
├── lib/                          utils.ts, logger.ts, safe-action.ts, auth-client.ts, seo/, errors/, helpers/<catégorie>/
└── config/                       env.ts, site.ts, projet.ts
tests/helpers/                    base de test PGlite, aides
e2e/                              parcours Playwright
drizzle/                          migrations
```

- Un dossier se crée au moment d'y écrire son premier fichier utile.
- **20 fichiers au plus par dossier** (hors `src/components/ui/`). Au-delà, découper par sujet : `sections/liste/`, `sections/formulaire/`, `use-cases/paiement/`.
- Alias : `@app/…` pour `app/`, `@src/…` pour `src/`. Dans un même dossier, import relatif (`./facture.rules`).
- `src/lib/auth-client.ts` (client Better Auth, exécuté dans le navigateur) reste dans `lib/` ; `src/adapters/auth/` porte la configuration serveur de Better Auth (`server-only`).
- Les tables se placent un niveau sous `src/db/` : `src/db/<domaine>/<sujet>.table.ts` (motif lu par `drizzle.config.ts`).
- `npm run db:generate` demande au moins une table : la première US qui stocke des données la crée.
- Créés au besoin : `app/@modal/`, `app/[...catchAll]/`, `src/db/seed/`, `tests/fixtures/`.

## 2. Le domaine en miroir et les imports entre features

- Un domaine porte le même nom, tiré du glossaire, dans `src/core/`, `src/db/` et `src/features/` (ex. `factures`). Créer un domaine : créer les dossiers miroirs qui reçoivent du contenu.
- Rôle de chaque arbre : `core` = les règles ; `db` = le stockage ; `features` = l'affichage et le déclenchement (actions, lectures, écrans).
- **Pas de fichier de réexportation** (`index.ts` qui réexporte, `export *`) : on importe directement le fichier qui définit ce qu'on utilise. Biome le vérifie (`noBarrelFile`, `noReExportAll`).
- Une feature importe d'une autre feature seulement ses `actions/`, `queries/` et `components/`. Un besoin commun à deux features va dans `src/core/shared/`, `src/components/shared/` ou `src/lib/`.

## 3. Sens des dépendances

`app → features → core` ; `db` et `adapters` implémentent les ports de `core`.

| Dossier | Importe | Laisse de côté |
|---|---|---|
| `src/core/` | `src/core/` seulement | Next, React, Drizzle, `server-only`, `db/`, `adapters/`, `features/`, `lib/`, `config/`, `app/` |
| `src/db/` | `src/core/` (ports, types), `drizzle-orm`, `src/config/`, `src/lib/` | Next, `features/`, `adapters/`, `app/` |
| `src/adapters/` | `src/core/` (ports, types), `src/config/`, `src/lib/`, SDK du service | `features/`, `db/`, `app/` |
| `src/lib/` | `src/config/`, `src/lib/`, `src/adapters/` (ex. `safe-action.ts` lit la session par `src/adapters/auth/`), bibliothèques | `features/`, `app/`, la logique métier de `core/` (ses types restent permis) |
| `src/features/` | `core/`, `db/`, `adapters/`, `components/`, `lib/`, `config/`, `hooks/`, `stores/` | `app/` |
| `app/` | tout : c'est l'assemblage | — |

- Exception : `src/adapters/auth/` importe aussi `src/db/` (tables de Better Auth), déclarée dans `biome.json`. `auth.adapter.ts` assemble aussi son expéditeur d'e-mails depuis `src/adapters/email/` (recette `email`).
- Un adapter qui sert de garde côté serveur (ex. `src/adapters/turnstile/`, recette `formulaire-public`) peut lire les en-têtes de la requête (`next/headers`) et renvoyer l'erreur d'action (`returnServerError`).
- La limite de requêtes s'assemble dans `src/lib/limite.ts` (recette `limite`) : ce fichier choisit le limiteur (`src/db/limite/`, `src/adapters/limite/` ou la mémoire), lit les en-têtes de la requête et renvoie l'erreur d'action. C'est le seul fichier de `src/lib/` qui importe `src/db/`.

`import "server-only"` en tête de chaque fichier de `src/db/`, `src/adapters/`, `queries/`, et de `src/config/env.ts`, `src/lib/logger.ts`. Les composants client lisent leurs variables publiques par `src/config/env-public.ts` (sans `server-only`). Les fichiers d'`actions/` commencent par `"use server"`.

## 4. Composants : containers et composants d'affichage

Le niveau d'un composant se décide par **ce qu'il importe**.

| Niveau | Rôle | Importe | Laisse de côté |
|---|---|---|---|
| `containers/` (`<nom>.container.tsx`) | lit les données (query, session, store), branche les actions, transmet des props | `queries/`, `actions/`, `hooks/`, `stores/`, `sections/` et en dessous, d'autres containers de la feature | `db/`, `adapters/`, `drizzle-orm` |
| `sections/` | un bloc d'écran (liste, formulaire, en-tête) à partir de props | `composites/`, `elements/`, `components/ui`, `components/shared`, `lib/`, `core/` (types, constantes) | `actions/`, `queries/`, `hooks/`, `stores/`, `containers/`, `db/`, `adapters/` |
| `composites/` | quelques éléments combinés (carte, ligne de tableau) | `elements/`, `components/ui`, `components/shared/elements`, `lib/`, `core/` (types, constantes) | idem + `sections/` |
| `elements/` | une seule chose (badge de statut, montant formaté) | `components/ui`, `lib/`, `core/` (types, constantes) | tout autre composant de feature |

- Une page de `app/` rend des containers (ou des sections sans données), chacun sous `<Suspense>` s'il lit des données.
- Les composants d'affichage peuvent importer les types et les constantes pures de `src/core/` (ex. les statuts d'une entité) ; les données elles-mêmes arrivent en props.
- Les composants d'affichage reçoivent tout par props, typées ; l'état visuel (`useState` pour ouvert/fermé) leur reste permis.
- Les `hooks/` d'une feature servent ses containers ; les composants d'affichage reçoivent le résultat en props.
- **Formulaire** : la section porte les champs (TanStack Form + `Field`) et la validation Zod dans le navigateur ; elle reçoit `envoyer(valeurs)` et `erreurServeur` en props. `envoyer` a toujours la même forme, `(valeurs) => Promise<boolean>` : `true` quand l'action a réussi (la section peut alors vider le formulaire), `false` sinon. Le container (client) appelle `useAction(action)` et les lui passe.

## 5. Écrire

```
container (client) → actions/<action>.action.ts → [core/<d>/use-cases/<action>.use-case.ts] → port ← db/<d>/<sujet>.repository.ts
```

1. L'action valide l'entrée (`actionConnectee.inputSchema(schema)`) et prend l'identité dans `ctx.utilisateur.id`.
2. **Use-case seulement s'il y a au moins une règle métier ou au moins deux ports** ; sinon l'action appelle directement le repository.
3. Assemblage par paramètre : l'action passe le repository au use-case (`payerFacture({ factures: factureRepository(getDb()) }, entree)`).
4. Le use-case renvoie un `Result` ; l'action traduit un échec en message (`returnServerError(MESSAGES[resultat.raison])`).
5. L'action rafraîchit l'écran (`refresh()`, `updateTag(tag)`) puis renvoie seulement ce que l'écran affiche.
6. Le repository pose la condition de propriété dans la requête : `where(and(eq(table.id, id), eq(table.utilisateurId, utilisateurId)))`.

## 6. Lire

```
page (app/) → <Suspense> → container (serveur) → queries/<lecture>.query.ts → db/<d>/<sujet>.repository.ts
```

- La query est `server-only` ; elle porte ce qui est propre à Next : `"use cache"`, `cacheLife`, `cacheTag`, `notFound()`.
- Une lecture va directement au repository, sans use-case.
- Une query mise en cache (`"use cache"`) renvoie `null` quand la donnée manque ; le container (et `generateMetadata`) appelle `notFound()`, hors du cache.
- Tags de cache d'un domaine : `features/<d>/constants/cache-tags.ts`.
- La session : `utilisateurConnecte()` dans `features/compte/queries/utilisateur-connecte.query.ts`.

## 7. Webhooks

`app/api/<service>/route.ts` → `features/<d>/webhooks/<x>.webhook.ts` (vérifie la signature avec l'adapter du service) → use-case. Une erreur technique se renvoie avec `reponseErreur(erreur, contexte)` de `src/lib/errors/reponse-erreur.ts`. Une adresse appelée par le navigateur (ex. une balise de mesure) suit le même chemin ; la vérification de l'origine (`Origin`) filtre les requêtes venues d'autres sites ; elle n'authentifie pas l'expéditeur comme le fait une signature.

## 8. Erreurs

| Nature | Naît dans | Circule comme | S'affiche par |
|---|---|---|---|
| Attendue (métier) | `core/<d>/<sujet>.errors.ts` (union de codes) | `Result` (`echec("code")`) | action : `features/<d>/constants/erreur-messages.ts` → `returnServerError` ; query : `notFound()` |
| Technique (service en panne) | un adapter lève `ErreurService` (`src/lib/errors/erreur-service.ts`), message sans secret, avec `cause` | exception | `safe-action` (journal + message générique) ; `reponseErreur()` dans un Route Handler |
| Imprévue | partout | exception | `error.tsx`, `global-error.tsx`, journal du serveur |

`erreur-messages.ts` est un `Record<CodeErreur, string>` : un code sans message fait échouer `npm run typecheck`.

## 9. Suffixes et nommage

Kebab-case, `[nom].[suffixe].[extension]`, un fichier par action et par query.

| Suffixe | Dossier |
|---|---|
| `.entity`, `.rules`, `.errors`, `.port`, `.use-case` | `src/core/` |
| `.table`, `.repository` | `src/db/` |
| `.store` (état global côté navigateur) | `src/stores/` |
| `.adapter` | `src/adapters/` |
| `.action`, `.query`, `.schema`, `.webhook`, `.container` | `src/features/` |
| `.test` (dans `__tests__/`), `.spec` (dans `e2e/`) | tests |

## 10. Tests

| Quoi | Comment | Où |
|---|---|---|
| `core` | unitaires, ports remplacés par des doublures en mémoire | `src/core/<d>/__tests__/` |
| repositories | intégration sur PGlite (`creerBaseDeTest()`), dont la condition `utilisateurId` | `src/db/<d>/__tests__/` |
| `lib/`, `config/` | unitaires | `__tests__/` du dossier |
| actions, queries, containers | parcours de bout en bout | `e2e/` |
| composants d'affichage | pas de test dédié par défaut ; leurs props typées et les parcours `e2e/` les couvrent | — |

Une aide de test propre à une feature se range dans le `__tests__/` de ses tests (ex. `sut-fichiers.ts`) ; une aide commune à plusieurs features va dans `tests/helpers/`.

## 11. Modèles de code (domaine `factures`)

```ts
// src/core/factures/facture.entity.ts
export type Facture = {
  id: string;
  utilisateurId: string;
  montantCentimes: number;
  payeeLe: Date | null;
};
```

```ts
// src/core/factures/facture.errors.ts
export type ErreurFacture = "facture-introuvable" | "facture-deja-payee";
```

```ts
// src/core/factures/facture.rules.ts
import { echec, ok, type Result } from "@src/core/shared/result";
import type { Facture } from "./facture.entity";
import type { ErreurFacture } from "./facture.errors";

export function verifierPaiementPossible(
  facture: Facture,
): Result<Facture, ErreurFacture> {
  return facture.payeeLe ? echec("facture-deja-payee") : ok(facture);
}
```

```ts
// src/core/factures/facture-repository.port.ts
import type { Facture } from "./facture.entity";

export type FactureRepository = {
  trouver(id: string, utilisateurId: string): Promise<Facture | null>;
  /** Marque la facture payée si elle ne l'est pas encore ; false si une autre demande l'a payée avant. */
  marquerPayee(id: string, utilisateurId: string, le: Date): Promise<boolean>;
};
```

```ts
// src/core/factures/use-cases/payer-facture.use-case.ts
import { echec, ok, type Result } from "@src/core/shared/result";
import type { ErreurFacture } from "../facture.errors";
import { verifierPaiementPossible } from "../facture.rules";
import type { FactureRepository } from "../facture-repository.port";

export async function payerFacture(
  deps: { factures: FactureRepository },
  entree: { id: string; utilisateurId: string; le: Date },
): Promise<Result<void, ErreurFacture>> {
  const facture = await deps.factures.trouver(entree.id, entree.utilisateurId);
  if (!facture) return echec("facture-introuvable");
  const verification = verifierPaiementPossible(facture);
  if (!verification.ok) return verification;
  // La lecture sert au message ; l'écriture conditionnelle décide : deux demandes simultanées
  // passent la vérification, une seule marque la facture payée.
  const marquee = await deps.factures.marquerPayee(
    entree.id,
    entree.utilisateurId,
    entree.le,
  );
  return marquee ? ok(undefined) : echec("facture-deja-payee");
}
```

```ts
// src/db/factures/facture.table.ts
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const factures = pgTable("factures", {
  id: uuid("id").primaryKey().defaultRandom(),
  utilisateurId: text("utilisateur_id").notNull(),
  montantCentimes: integer("montant_centimes").notNull(),
  payeeLe: timestamp("payee_le", { withTimezone: true }),
});
```

```ts
// src/db/factures/facture.repository.ts
import "server-only";
import type { FactureRepository } from "@src/core/factures/facture-repository.port";
import type { Db } from "@src/db/db-client";
import { and, eq, isNull } from "drizzle-orm";
import { factures } from "./facture.table";

export function factureRepository(db: Db): FactureRepository {
  const proprietaire = (id: string, utilisateurId: string) =>
    and(eq(factures.id, id), eq(factures.utilisateurId, utilisateurId));
  return {
    async trouver(id, utilisateurId) {
      const [ligne] = await db
        .select()
        .from(factures)
        .where(proprietaire(id, utilisateurId));
      return ligne ?? null;
    },
    async marquerPayee(id, utilisateurId, le) {
      // Une seule requête : la condition « pas encore payée » et l'écriture sont atomiques.
      const lignes = await db
        .update(factures)
        .set({ payeeLe: le })
        .where(and(proprietaire(id, utilisateurId), isNull(factures.payeeLe)))
        .returning({ id: factures.id });
      return lignes.length === 1;
    },
  };
}
```

```ts
// src/features/factures/constants/erreur-messages.ts
import type { ErreurFacture } from "@src/core/factures/facture.errors";

export const MESSAGES_FACTURE: Record<ErreurFacture, string> = {
  "facture-introuvable":
    "Cette facture n'existe pas ou ne vous appartient pas.",
  "facture-deja-payee": "Cette facture est déjà payée.",
};
```

```ts
// src/features/factures/actions/payer-facture.action.ts
"use server";

import { payerFacture } from "@src/core/factures/use-cases/payer-facture.use-case";
import { getDb } from "@src/db/db-client";
import { factureRepository } from "@src/db/factures/facture.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { refresh } from "next/cache";
import { returnServerError } from "next-safe-action";
import { z } from "zod";
import { MESSAGES_FACTURE } from "../constants/erreur-messages";

// Le nom (.metadata) se pose avant .action(…) : il identifie l'action dans les journaux d'erreurs.
export const payerFactureAction = actionConnectee
  .metadata({ nom: "payerFacture" })
  .inputSchema(z.object({ id: z.uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const resultat = await payerFacture(
      { factures: factureRepository(getDb()) },
      { id: parsedInput.id, utilisateurId: ctx.utilisateur.id, le: new Date() },
    );
    if (!resultat.ok) returnServerError(MESSAGES_FACTURE[resultat.raison]);
    refresh();
    return { ok: true };
  });
```

```ts
// src/features/factures/queries/trouver-facture.query.ts
import "server-only";
import { getDb } from "@src/db/db-client";
import { factureRepository } from "@src/db/factures/facture.repository";
import { notFound } from "next/navigation";

export async function trouverFacture(id: string, utilisateurId: string) {
  const facture = await factureRepository(getDb()).trouver(id, utilisateurId);
  if (!facture) notFound();
  return facture;
}
```

```tsx
// src/features/factures/components/containers/detail-facture.container.tsx
import { utilisateurConnecte } from "@src/features/compte/queries/utilisateur-connecte.query";
import { trouverFacture } from "../../queries/trouver-facture.query";
import { CarteFacture } from "../sections/carte-facture";

export async function DetailFactureContainer({ id }: { id: string }) {
  const utilisateur = await utilisateurConnecte();
  const facture = await trouverFacture(id, utilisateur.id);
  return <CarteFacture facture={facture} />;
}
```

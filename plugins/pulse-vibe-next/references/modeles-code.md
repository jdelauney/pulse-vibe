# Modèles de code (domaine `factures`)

Les modèles de chaque couche, sur un domaine d'exemple, à suivre au moment d'écrire une entité, un use-case, un repository, une action ou un container. Les règles qu'ils appliquent sont dans « Architecture du code » (`pulse-aidd pile reference architecture.md`).

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

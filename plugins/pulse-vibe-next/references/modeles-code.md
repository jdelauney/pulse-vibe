# Modèles de code (domaine `factures`)

Les modèles de chaque couche, sur un domaine d'exemple, à suivre au moment d'écrire une entité, un use-case, un repository, une action ou un container. Le métier, le stockage et les services sont des classes (SOLID, patrons nommés : `pulse-aidd qualite clean-code`, §5 bis) ; actions, queries et composants suivent les conventions de Next.js et de React. Les règles qu'ils appliquent sont dans « Architecture du code » (`pulse-aidd pile reference architecture.md`).

```ts
// src/core/factures/facture.entity.ts
import { echec, ok, type Result } from "@src/core/shared/result";
import type { ErreurFacture } from "./facture.errors";

/** Les données d'une facture : la forme qui traverse les frontières (base, écran). */
export type FactureVue = {
  id: string;
  utilisateurId: string;
  montantCentimes: number;
  payeeLe: Date | null;
};

/** Une facture et ses règles : l'état reste en lecture seule, chaque règle est une méthode. */
export class Facture {
  constructor(private readonly donnees: Readonly<FactureVue>) {
    if (donnees.montantCentimes <= 0) throw new RangeError("Le montant d'une facture est positif.");
  }

  get id(): string {
    return this.donnees.id;
  }

  get estPayee(): boolean {
    return this.donnees.payeeLe !== null;
  }

  verifierPaiementPossible(): Result<Facture, ErreurFacture> {
    return this.estPayee ? echec("facture-deja-payee") : ok(this);
  }

  versVue(): FactureVue {
    return { ...this.donnees };
  }
}
```

```ts
// src/core/factures/facture.errors.ts
export type ErreurFacture = "facture-introuvable" | "facture-deja-payee";
```

```ts
// src/core/factures/facture-repository.port.ts
import type { Facture } from "./facture.entity";

/** Ce que le métier attend du stockage des factures (patron Repository). */
export interface FactureRepository {
  trouver(id: string, utilisateurId: string): Promise<Facture | null>;
  /** Marque la facture payée si elle ne l'est pas encore ; false si une autre demande l'a payée avant. */
  marquerPayee(id: string, utilisateurId: string, le: Date): Promise<boolean>;
}
```

```ts
// src/core/factures/use-cases/payer-facture.use-case.ts
import { echec, ok, type Result } from "@src/core/shared/result";
import type { ErreurFacture } from "../facture.errors";
import type { FactureRepository } from "../facture-repository.port";

/** Payer une facture : reçoit son stockage par le constructeur (inversion de dépendance). */
export class PayerFacture {
  constructor(private readonly factures: FactureRepository) {}

  async executer(entree: {
    id: string;
    utilisateurId: string;
    le: Date;
  }): Promise<Result<void, ErreurFacture>> {
    const facture = await this.factures.trouver(entree.id, entree.utilisateurId);
    if (!facture) return echec("facture-introuvable");
    const verification = facture.verifierPaiementPossible();
    if (!verification.ok) return verification;
    // La lecture sert au message ; l'écriture conditionnelle décide : deux demandes simultanées
    // passent la vérification, une seule marque la facture payée.
    const marquee = await this.factures.marquerPayee(
      entree.id,
      entree.utilisateurId,
      entree.le,
    );
    return marquee ? ok(undefined) : echec("facture-deja-payee");
  }
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
import { Facture } from "@src/core/factures/facture.entity";
import type { FactureRepository } from "@src/core/factures/facture-repository.port";
import type { Db } from "@src/db/db-client";
import { and, eq, isNull } from "drizzle-orm";
import { factures } from "./facture.table";

/** Le stockage des factures dans Postgres (Drizzle) : implémente le port du métier. */
export class DrizzleFactureRepository implements FactureRepository {
  constructor(private readonly db: Db) {}

  async trouver(id: string, utilisateurId: string): Promise<Facture | null> {
    const [ligne] = await this.db
      .select()
      .from(factures)
      .where(this.proprietaire(id, utilisateurId));
    return ligne ? new Facture(ligne) : null;
  }

  async marquerPayee(id: string, utilisateurId: string, le: Date): Promise<boolean> {
    // Une seule requête : la condition « pas encore payée » et l'écriture sont atomiques.
    const lignes = await this.db
      .update(factures)
      .set({ payeeLe: le })
      .where(and(this.proprietaire(id, utilisateurId), isNull(factures.payeeLe)))
      .returning({ id: factures.id });
    return lignes.length === 1;
  }

  private proprietaire(id: string, utilisateurId: string) {
    return and(eq(factures.id, id), eq(factures.utilisateurId, utilisateurId));
  }
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

import { PayerFacture } from "@src/core/factures/use-cases/payer-facture.use-case";
import { getDb } from "@src/db/db-client";
import { DrizzleFactureRepository } from "@src/db/factures/facture.repository";
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
    // L'action assemble les objets (racine de composition) : le cas d'usage reçoit son stockage.
    const payer = new PayerFacture(new DrizzleFactureRepository(getDb()));
    const resultat = await payer.executer({
      id: parsedInput.id,
      utilisateurId: ctx.utilisateur.id,
      le: new Date(),
    });
    if (!resultat.ok) returnServerError(MESSAGES_FACTURE[resultat.raison]);
    refresh();
    return { ok: true };
  });
```

```ts
// src/features/factures/queries/trouver-facture.query.ts
import "server-only";
import { getDb } from "@src/db/db-client";
import type { FactureVue } from "@src/core/factures/facture.entity";
import { DrizzleFactureRepository } from "@src/db/factures/facture.repository";
import { notFound } from "next/navigation";

// L'écran reçoit des données simples (versVue) : une instance reste côté serveur.
export async function trouverFacture(id: string, utilisateurId: string): Promise<FactureVue> {
  const facture = await new DrizzleFactureRepository(getDb()).trouver(id, utilisateurId);
  if (!facture) notFound();
  return facture.versVue();
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

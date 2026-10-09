### 4. La table et sa migration

Montant en **centimes entiers**, date de création en `timestamp with time zone`, propriétaire dans `utilisateur_id`.

<!-- fichier: src/db/factures/facture.table.ts -->
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

<!-- commande: npm run db:generate -->
```bash
npm run db:generate
npm run db:migrate
```


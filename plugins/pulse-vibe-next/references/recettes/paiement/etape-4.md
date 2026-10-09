### 4. Les tables et leur migration

<!-- fichier: src/db/paiement/commande.table.ts -->
```ts
// src/db/paiement/commande.table.ts
import { STATUTS_COMMANDE } from "@src/core/paiement/commande.entity";
import { user } from "@src/db/compte/auth.table";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const commande = pgTable("commande", {
  id: uuid("id").primaryKey().defaultRandom(),
  utilisateurId: text("utilisateur_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  libelle: text("libelle").notNull(),
  // Montant en centimes (entier) : 1900 = 19,00 €.
  montantCentimes: integer("montant_centimes").notNull(),
  devise: text("devise").notNull().default("eur"),
  statut: text("statut", { enum: STATUTS_COMMANDE })
    .notNull()
    .default("en_attente"),
  stripeSessionId: text("stripe_session_id").unique(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  payeeLe: timestamp("payee_le", { withTimezone: true }),
});
```

<!-- fichier: src/db/paiement/evenement-stripe.table.ts -->
```ts
// src/db/paiement/evenement-stripe.table.ts
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Un événement Stripe déjà traité ne l'est jamais deux fois (Stripe peut le renvoyer).
export const evenementStripe = pgTable("evenement_stripe", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  recuLe: timestamp("recu_le", { withTimezone: true }).notNull().defaultNow(),
});
```

`drizzle.config.ts` lit déjà `src/db/*/*.table.ts` : rien à déclarer ailleurs. Générez la migration, relisez le SQL créé dans `drizzle/`, puis appliquez-la :

<!-- commande: npm run db:generate -->
```bash
npm run db:generate
npm run db:migrate
```


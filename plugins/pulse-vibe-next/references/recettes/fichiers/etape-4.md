### 4. La table et sa migration

<!-- fichier: src/db/fichiers/fichier.table.ts -->
```ts
// src/db/fichiers/fichier.table.ts
import { STATUTS_FICHIER } from "@src/core/fichiers/fichier.entity";
import { user } from "@src/db/compte/auth.table";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const fichiers = pgTable("fichiers", {
  id: uuid().primaryKey().defaultRandom(),
  utilisateurId: text("utilisateur_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Clé de l'objet dans R2 : "<id utilisateur>/<id fichier>.<extension>".
  cle: text().notNull().unique(),
  nom: text().notNull(),
  typeMime: text("type_mime").notNull(),
  taille: integer().notNull(),
  statut: text({ enum: STATUTS_FICHIER }).notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});
```

`drizzle.config.ts` lit déjà `src/db/*/*.table.ts` : rien à déclarer ailleurs. Générez la migration, relisez le SQL créé dans `drizzle/`, puis appliquez-la :

<!-- commande: npm run db:generate -->
```bash
npm run db:generate
npm run db:migrate
```


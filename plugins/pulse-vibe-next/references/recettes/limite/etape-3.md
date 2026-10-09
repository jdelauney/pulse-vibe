### 3. La table et la migration

Une ligne par règle et par adresse IP. `drizzle.config.ts` lit déjà `src/db/*/*.table.ts`.

```ts
// src/db/limite/limite.table.ts
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Compteurs de la limite de requêtes : une ligne par règle et par adresse IP.
export const limites = pgTable(
  "limites",
  {
    cle: text().primaryKey(),
    compte: integer().notNull(),
    debut: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [index("limites_debut_idx").on(table.debut)],
);
```

Générez la migration, relisez le fichier SQL créé dans `drizzle/`, puis appliquez-la (les deux adresses Neon, `DATABASE_URL` et `DATABASE_URL_DIRECT`, sont dans `.env`) :

```bash
npm run db:generate
npm run db:migrate
```


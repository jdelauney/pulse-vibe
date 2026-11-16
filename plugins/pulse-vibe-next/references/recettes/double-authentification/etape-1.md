### 1. Les tables

Le plugin `twoFactor` de better-auth ajoute une colonne au compte (`two_factor_enabled`) et une table `two_factor`. Le code envoyé par e-mail n'a pas besoin de cette table, mais better-auth la lit à chaque code vérifié : elle doit exister. Ce qui suit est la sortie de la CLI better-auth 1.7.25 (`npx auth@1.7.25 generate`, plugin `twoFactor`), ajoutée à `src/db/compte/auth.table.ts`.

L'import gagne `integer` :

<!-- remplacer-ligne: src/db/compte/auth.table.ts début: import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core"; -->
```ts
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
```

La table `user` gagne sa colonne, après `image` :

<!-- ajout: src/db/compte/auth.table.ts après: image: text("image"), -->
```ts
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
```

La table du plugin, à la fin du fichier :

<!-- ajout: src/db/compte/auth.table.ts -->
```ts

// Plugin twoFactor (recette double-authentification).
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until"),
  },
  (table) => [
    index("twoFactor_secret_idx").on(table.secret),
    index("twoFactor_userId_idx").on(table.userId),
  ],
);
```

Générez la migration, relisez le SQL créé dans `drizzle/` (un `ALTER TABLE "user" ADD COLUMN`, un `CREATE TABLE "two_factor"`), puis appliquez-la :

<!-- commande: npm run db:generate -->
```bash
npm run db:generate
npm run db:migrate
```

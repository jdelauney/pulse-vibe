### 2. Les tables de better-auth et leur migration

Le domaine s'appelle `compte` : ses tables vont dans `src/db/compte/`. Le fichier ci-dessous est la sortie de la CLI better-auth 1.7.7 (`npx auth@1.7.7 generate --adapter drizzle --dialect postgresql`, e-mail et mot de passe, sans plugin), mise en forme par Biome (`npm run format`), sans les `relations` que la CLI ajoute à la fin : l'application lit avec `db.select().from(table)`, qui s'en passe. Copiez-le tel quel. La CLI refuse un fichier de configuration qui importe `server-only` : la recette fournit donc le résultat. Gardez les noms de tables et de colonnes : l'adaptateur les attend.

<!-- fichier: src/db/compte/auth.table.ts -->
```ts
// src/db/compte/auth.table.ts
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
```

Les tables métier qui appartiennent à une personne importent `user` de `@src/db/compte/auth.table` et le référencent (type `text`) : `text("utilisateur_id").notNull().references(() => user.id, { onDelete: "cascade" })`.

`drizzle.config.ts` lit déjà `src/db/*/*.table.ts` : rien à déclarer ailleurs. Générez la migration, relisez le SQL créé dans `drizzle/` (quatre `CREATE TABLE`), puis appliquez-la :

<!-- commande: npm run db:generate -->
```bash
npm run db:generate
npm run db:migrate
```


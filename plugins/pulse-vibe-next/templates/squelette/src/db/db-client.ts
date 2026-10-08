import "server-only";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { env } from "@src/config/env";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import ws from "ws";

// WebSocket pour Node.js 21 et moins (facultatif à partir de Node.js 22).
neonConfig.webSocketConstructor = ws;

// Type commun à Neon (application) et PGlite (tests) : les repositories reçoivent la base en paramètre.
// Les tables s'importent directement depuis src/db/<domaine>/<sujet>.table.ts (pas d'objet schéma global).
export type Db = PgDatabase<PgQueryResultHKT>;

let db: Db | undefined;

/** La base de l'application, créée à la première demande (pas pendant la construction). */
export function getDb(): Db {
  if (!db) {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    db = drizzle({ client: pool });
  }
  return db;
}

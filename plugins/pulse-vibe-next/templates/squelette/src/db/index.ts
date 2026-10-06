import "server-only";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import ws from "ws";
import { envServeur } from "@/lib/env";
import * as schema from "./schema";

// WebSocket pour Node.js 21 et moins (facultatif à partir de Node.js 22).
neonConfig.webSocketConstructor = ws;

// Type commun à Neon (application) et PGlite (tests) : les fonctions reçoivent la base en paramètre.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | undefined;

/** La base de l'application, créée à la première demande (pas pendant la construction). */
export function getDb(): Db {
  if (!db) {
    const pool = new Pool({ connectionString: envServeur().DATABASE_URL });
    db = drizzle({ client: pool, schema });
  }
  return db;
}

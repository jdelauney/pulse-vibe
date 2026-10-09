import "server-only";
import { Pool } from "@neondatabase/serverless";
import { env } from "@src/config/env";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

// Le pilote Neon passe par WebSocket, fourni par Node.js 22 et plus (package.json : engines) :
// aucun paquet à ajouter.

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

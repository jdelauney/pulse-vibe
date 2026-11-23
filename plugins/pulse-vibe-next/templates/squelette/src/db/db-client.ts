import "server-only";
import { Pool as PoolNeon } from "@neondatabase/serverless";
import { env } from "@src/config/env";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool as PoolPostgres } from "pg";

// Le pilote Neon passe par WebSocket, fourni par Node.js 22 et plus (package.json : engines) :
// aucun paquet à ajouter.

// Type commun à Neon, à PostgreSQL (node-postgres) et à PGlite (tests) : les repositories reçoivent la base
// en paramètre. Les tables s'importent directement depuis src/db/<domaine>/<sujet>.table.ts (pas d'objet schéma global).
export type Db = PgDatabase<PgQueryResultHKT>;

// Nom d'hôte d'une base Neon : ep-….<région>.aws.neon.tech (avec ou sans -pooler).
const HOTE_NEON = /\.neon\.tech$/i;

/**
 * Fabrique (patron Factory) : le pilote se choisit à l'exécution, d'après l'adresse de la base.
 * Neon (en ligne, et en local quand la base de développement est une branche Neon) : pilote Neon.
 * Tout autre PostgreSQL (base Docker du développement) : pilote node-postgres.
 */
export class FabriqueDeBase {
  constructor(private readonly adresse: string) {}

  estNeon(): boolean {
    return HOTE_NEON.test(new URL(this.adresse).hostname);
  }

  creer(): Db {
    const connectionString = this.adresse;
    if (this.estNeon()) {
      return drizzleNeon({ client: new PoolNeon({ connectionString }) });
    }
    return drizzlePostgres({ client: new PoolPostgres({ connectionString }) });
  }
}

let db: Db | undefined;

/** La base de l'application, créée à la première demande (pas pendant la construction). */
export function getDb(): Db {
  if (!db) db = new FabriqueDeBase(env.DATABASE_URL).creer();
  return db;
}

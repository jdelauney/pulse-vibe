import { existsSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Db } from "@src/db";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const DOSSIER_MIGRATIONS = "./drizzle";

/** Base Postgres neuve, en mémoire, avec toutes les migrations du dossier drizzle/ appliquées. */
export async function creerBaseDeTest(): Promise<{
  db: Db;
  fermer: () => Promise<void>;
}> {
  const client = new PGlite();
  const db = drizzle({ client });
  if (existsSync(`${DOSSIER_MIGRATIONS}/meta/_journal.json`)) {
    await migrate(db, { migrationsFolder: DOSSIER_MIGRATIONS });
  }
  return { db, fermer: () => client.close() };
}

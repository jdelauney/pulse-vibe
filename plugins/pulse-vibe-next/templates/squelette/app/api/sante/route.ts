import { getDb } from "@src/db/db-client";
import { verifierSante } from "@src/lib/sante";
import { sql } from "drizzle-orm";
import { connection } from "next/server";

// Adresse surveillée par la sonde de disponibilité (consignes « Pour mettre en ligne » du pack) :
// 200 quand la base répond, 503 sinon. connection() : lue à chaque appel, jamais à la construction.
export async function GET() {
  await connection();
  return verifierSante(() => getDb().execute(sql`select 1`));
}

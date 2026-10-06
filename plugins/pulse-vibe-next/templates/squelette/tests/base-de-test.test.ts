import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { creerBaseDeTest } from "./helpers/base-de-test";

describe("Base de test", () => {
  it("répond à une requête après les migrations", async () => {
    const { db, fermer } = await creerBaseDeTest();
    await expect(db.execute(sql`select 1`)).resolves.toBeDefined();
    await fermer();
  });
});

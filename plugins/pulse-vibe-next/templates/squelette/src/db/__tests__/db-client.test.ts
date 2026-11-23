import { FabriqueDeBase } from "@src/db/db-client";
import { NeonDatabase } from "drizzle-orm/neon-serverless";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

// Les pools se connectent à la première requête : ces tests n'ouvrent aucune connexion.
const NEON =
  "postgresql://neondb_owner:x@ep-essai-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const DOCKER = "postgresql://postgres:postgres@localhost:5432/app";

describe("Choix du pilote de la base", () => {
  it("adresse Neon : pilote Neon", () => {
    const fabrique = new FabriqueDeBase(NEON);
    expect(fabrique.estNeon()).toBe(true);
    expect(fabrique.creer()).toBeInstanceOf(NeonDatabase);
  });

  it("autre PostgreSQL (Docker en local) : pilote node-postgres", () => {
    const fabrique = new FabriqueDeBase(DOCKER);
    expect(fabrique.estNeon()).toBe(false);
    expect(fabrique.creer()).toBeInstanceOf(NodePgDatabase);
  });

  it("un hôte qui contient seulement « neon.tech » n'est pas Neon", () => {
    expect(
      new FabriqueDeBase("postgresql://u@neon.tech.exemple.fr/app").estNeon(),
    ).toBe(false);
  });
});

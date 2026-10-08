import { afterEach, describe, expect, it, vi } from "vitest";
import { chargerEnvValide } from "../../../tests/helpers/env-de-test";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Variables d'environnement", () => {
  it("une variable obligatoire manquante est nommée dans le message", async () => {
    await expect(chargerEnvValide({ DATABASE_URL: undefined })).rejects.toThrow(
      "Variables d'environnement invalides ou manquantes : DATABASE_URL",
    );
  });

  it("une ligne vide compte comme une variable absente", async () => {
    await expect(chargerEnvValide({ DATABASE_URL: "" })).rejects.toThrow(
      /DATABASE_URL/,
    );
  });

  it("une variable présente se lit", async () => {
    expect((await chargerEnvValide()).DATABASE_URL).toBe(
      "postgresql://localhost:5432/essai",
    );
  });
});

describe("Construction de vérification", () => {
  it("sur Vercel, SKIP_ENV_VALIDATION ne coupe pas la validation", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    vi.stubEnv("DATABASE_URL", undefined);
    await expect(import("../env")).rejects.toThrow(/DATABASE_URL/);
  });
});

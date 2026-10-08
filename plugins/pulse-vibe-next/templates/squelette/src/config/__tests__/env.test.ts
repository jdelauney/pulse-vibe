import { afterEach, describe, expect, it, vi } from "vitest";

// vitest.config.ts saute la validation (SKIP_ENV_VALIDATION) ; ces tests la rétablissent.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function chargerEnv() {
  vi.stubEnv("SKIP_ENV_VALIDATION", "");
  return (await import("../env")).env;
}

describe("Variables d'environnement", () => {
  it("une variable obligatoire manquante est nommée dans le message", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    await expect(chargerEnv()).rejects.toThrow(
      "Variables d'environnement invalides ou manquantes : DATABASE_URL",
    );
  });

  it("une ligne vide compte comme une variable absente", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(chargerEnv()).rejects.toThrow(/DATABASE_URL/);
  });

  it("une variable présente se lit", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/essai");
    expect((await chargerEnv()).DATABASE_URL).toBe(
      "postgresql://localhost:5432/essai",
    );
  });
});

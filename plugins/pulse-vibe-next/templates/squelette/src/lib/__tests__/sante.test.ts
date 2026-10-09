import { logger } from "@src/lib/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifierSante } from "../sante";

vi.mock("@src/lib/logger", () => ({ logger: { error: vi.fn() } }));

describe("Sonde de santé", () => {
  beforeEach(() => vi.mocked(logger.error).mockClear());

  it("la base répond : 200, jamais mis en cache", async () => {
    const r = await verifierSante(async () => [{ "?column?": 1 }]);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "ok" });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("la base refuse : 503 sans détail, cause journalisée", async () => {
    const r = await verifierSante(async () => {
      throw new Error("password authentication failed");
    });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ etat: "indisponible" });
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it("la base ne répond pas dans le délai : 503", async () => {
    const r = await verifierSante(() => new Promise(() => {}), 20);
    expect(r.status).toBe(503);
  });

  it("une erreur levée avant même la requête (adresse absente) : 503", async () => {
    const r = await verifierSante(() => {
      throw new Error("DATABASE_URL manque");
    });
    expect(r.status).toBe(503);
  });
});

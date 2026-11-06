import { logger } from "@src/lib/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { oublierSante, verifierSante } from "../sante";

vi.mock("@src/lib/logger", () => ({ logger: { error: vi.fn() } }));

describe("Sonde de santé", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
    oublierSante();
  });

  it("la base répond : 200, gardé 15 minutes par le CDN (la base peut se mettre en veille)", async () => {
    const r = await verifierSante(async () => [{ "?column?": 1 }]);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "ok" });
    expect(r.headers.get("cache-control")).toBe("public, s-maxage=900");
  });

  it("sans CDN : le serveur garde la réponse 200 15 minutes, puis interroge à nouveau la base", async () => {
    let heure = 0;
    const base = vi.fn(async () => [{ "?column?": 1 }]);
    await verifierSante(base, 5_000, () => heure);
    heure = 899_999;
    const gardee = await verifierSante(base, 5_000, () => heure);
    expect(gardee.status).toBe(200);
    expect(base).toHaveBeenCalledOnce();
    heure = 900_000;
    await verifierSante(base, 5_000, () => heure);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("une panne n'est jamais gardée : l'appel suivant interroge la base", async () => {
    const enPanne = vi.fn(async () => {
      throw new Error("injoignable");
    });
    await verifierSante(enPanne);
    await verifierSante(enPanne);
    expect(enPanne).toHaveBeenCalledTimes(2);
  });

  it("la base refuse : 503 sans détail, cause journalisée", async () => {
    const r = await verifierSante(async () => {
      throw new Error("password authentication failed");
    });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ etat: "indisponible" });
    expect(r.headers.get("cache-control")).toBe("no-store");
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

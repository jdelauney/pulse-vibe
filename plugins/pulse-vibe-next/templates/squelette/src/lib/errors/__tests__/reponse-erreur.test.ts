import { logger } from "@src/lib/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErreurService } from "../erreur-service";
import { reponseErreur } from "../reponse-erreur";

vi.mock("@src/lib/logger", () => ({ logger: { error: vi.fn() } }));

describe("reponseErreur", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
  });

  it("panne d'un service externe : 503 et message générique", async () => {
    const err = new ErreurService("paiement", "Délai dépassé", {
      cause: new Error("timeout"),
    });
    const r = reponseErreur(err, "Webhook paiement");
    expect(r.status).toBe(503);
    expect(logger.error).toHaveBeenCalledWith(
      { err, service: "paiement" },
      "Webhook paiement",
    );
    expect(await r.json()).toEqual({
      message: "Service momentanément indisponible. Réessayez dans un instant.",
    });
  });

  it("erreur imprévue : 500, sans détail technique dans la réponse", async () => {
    const err = new Error("mot de passe de la base : secret");
    const r = reponseErreur(err, "Route test");
    expect(r.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith({ err }, "Route test");
    const corps = await r.json();
    expect(corps).toEqual({
      message: "Une erreur est survenue. Réessayez dans un instant.",
    });
    expect(JSON.stringify(corps)).not.toContain("secret");
  });

  it("ErreurService garde le service et la cause pour le journal", () => {
    const cause = new Error("timeout");
    const e = new ErreurService("email", "Envoi impossible", { cause });
    expect(e.name).toBe("ErreurService");
    expect(e.service).toBe("email");
    expect(e.cause).toBe(cause);
  });
});

import { describe, expect, it } from "vitest";
import { ErreurService } from "../erreur-service";
import { reponseErreur } from "../reponse-erreur";

describe("reponseErreur", () => {
  it("panne d'un service externe : 503 et message générique", async () => {
    const r = reponseErreur(
      new ErreurService("paiement", "Délai dépassé", {
        cause: new Error("timeout"),
      }),
      "Webhook paiement",
    );
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({
      message: "Service momentanément indisponible. Réessayez dans un instant.",
    });
  });

  it("erreur imprévue : 500, sans détail technique dans la réponse", async () => {
    const r = reponseErreur(
      new Error("mot de passe de la base : secret"),
      "Route test",
    );
    expect(r.status).toBe(500);
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

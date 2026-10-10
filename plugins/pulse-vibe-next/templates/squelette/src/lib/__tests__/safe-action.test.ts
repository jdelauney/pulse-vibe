import { logger } from "@src/lib/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { actionPublique, MESSAGE_ERREUR_ACTION } from "../safe-action";

vi.mock("@src/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-vercel-id": "fra1::essai" }),
}));

describe("actionPublique", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
    vi.mocked(logger.info).mockClear();
  });

  it("journalise le nom de l'action, la requête, la durée et la réussite", async () => {
    const saluer = actionPublique
      .metadata({ nom: "saluer" })
      .inputSchema(z.object({ prenom: z.string() }))
      .action(async ({ parsedInput }) => `Bonjour ${parsedInput.prenom}`);
    const resultat = await saluer({ prenom: "Alice" });
    expect(resultat.data).toBe("Bonjour Alice");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "saluer",
        requete: "fra1::essai",
        reussite: true,
        duree: expect.any(Number),
      }),
      "Action terminée",
    );
  });

  it("erreur imprévue : journalisée avec le nom de l'action, message générique renvoyé", async () => {
    const erreur = new Error("détail technique");
    const casser = actionPublique
      .metadata({ nom: "casser" })
      .action(async () => {
        throw erreur;
      });
    const resultat = await casser();
    expect(resultat.serverError).toBe(MESSAGE_ERREUR_ACTION);
    expect(logger.error).toHaveBeenCalledWith(
      { err: erreur, action: "casser", requete: "fra1::essai" },
      "Erreur dans une action serveur",
    );
  });

  it("une action sans nom est refusée par la vérification des types", () => {
    // @ts-expect-error .metadata({ nom }) est obligatoire avant .action()
    actionPublique.action(async () => "sans nom");
  });
});

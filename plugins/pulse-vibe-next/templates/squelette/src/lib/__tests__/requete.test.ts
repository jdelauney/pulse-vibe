import { describe, expect, it } from "vitest";
import { identifiantDeRequete } from "../requete";

describe("Identifiant de la requête", () => {
  it("chez Vercel : x-vercel-id", () => {
    const entetes = new Headers({
      "x-vercel-id": "fra1::abc",
      "x-request-id": "autre",
    });
    expect(identifiantDeRequete((n) => entetes.get(n))).toBe("fra1::abc");
  });

  it("ailleurs : x-request-id, posé par le proxy de l'hébergeur", () => {
    const entetes = new Headers({ "x-request-id": "7f3a" });
    expect(identifiantDeRequete((n) => entetes.get(n))).toBe("7f3a");
  });

  it("en-têtes bruts de Node (tableau) : la première valeur", () => {
    const brut: Record<string, string | string[]> = {
      "x-request-id": ["a1", "b2"],
    };
    expect(identifiantDeRequete((n) => brut[n])).toBe("a1");
  });

  it("aucun des deux : aucun identifiant", () => {
    expect(identifiantDeRequete(() => null)).toBeUndefined();
  });
});

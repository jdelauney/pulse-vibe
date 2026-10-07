import { describe, expect, it } from "vitest";
import { echec, ok, type Result } from "../result";

function diviser(a: number, b: number): Result<number, "division-par-zero"> {
  return b === 0 ? echec("division-par-zero") : ok(a / b);
}

describe("Result", () => {
  it("porte la valeur d'un succès", () => {
    expect(diviser(6, 3)).toEqual({ ok: true, valeur: 2 });
  });

  it("porte le code d'une erreur attendue, sans exception", () => {
    expect(diviser(1, 0)).toEqual({ ok: false, raison: "division-par-zero" });
  });
});

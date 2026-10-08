import { describe, expect, test } from "vitest";
import { projet } from "../projet";

describe("Projet", () => {
  test("le nom du projet est renseigné", () => {
    expect(projet.nom.length).toBeGreaterThan(0);
  });
});

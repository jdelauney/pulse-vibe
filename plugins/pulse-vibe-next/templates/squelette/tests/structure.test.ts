import { describe, expect, it } from "vitest";
import { dossiersTropPleins, testsMalRanges } from "./helpers/structure";

// Règles d'organisation du projet (docs/technical.md, « Organisation des fichiers »).
const RACINES = ["app", "src"];
const LIMITE = 20;
const EXEMPTES = ["src/components/ui"]; // composants générés par shadcn

describe("Structure du projet", () => {
  it(`aucun dossier ne dépasse ${LIMITE} fichiers`, () => {
    expect(
      dossiersTropPleins(RACINES, LIMITE, EXEMPTES),
      "Découpez ces dossiers par sujet (ex. sections/liste/, sections/formulaire/).",
    ).toEqual([]);
  });

  it("chaque test unitaire ou d'intégration est dans un dossier __tests__/", () => {
    expect(testsMalRanges(RACINES), "Déplacez ces tests dans le dossier __tests__/ voisin.").toEqual([]);
  });
});

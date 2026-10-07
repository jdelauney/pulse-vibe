import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dossiersTropPleins, testsMalRanges } from "../structure";

function projet(fichiers: string[]): string {
  const racine = mkdtempSync(join(tmpdir(), "structure-"));
  for (const f of fichiers) {
    mkdirSync(join(racine, f, ".."), { recursive: true });
    writeFileSync(join(racine, f), "");
  }
  return racine;
}

const n = (combien: number, dossier: string) =>
  Array.from({ length: combien }, (_, i) => `${dossier}/f${i}.ts`);

describe("dossiersTropPleins", () => {
  it("signale un dossier de plus de 20 fichiers, avec son nombre", () => {
    const r = projet([
      ...n(21, "src/features/factures/actions"),
      ...n(20, "src/core/factures"),
    ]);
    expect(
      dossiersTropPleins([join(r, "app"), join(r, "src")], 20, [], r),
    ).toEqual(["src/features/factures/actions (21 fichiers)"]);
  });

  it("laisse passer src/components/ui, généré par shadcn", () => {
    const r = projet(n(30, "src/components/ui"));
    expect(
      dossiersTropPleins([join(r, "src")], 20, ["src/components/ui"], r),
    ).toEqual([]);
  });

  it("ne compte pas les sous-dossiers comme des fichiers", () => {
    const r = projet([...n(20, "src/lib"), ...n(5, "src/lib/seo")]);
    expect(dossiersTropPleins([join(r, "src")], 20, [], r)).toEqual([]);
  });
});

describe("testsMalRanges", () => {
  it("signale un test hors de __tests__, dans app/ comme dans src/", () => {
    const r = projet([
      "app/factures/page.test.tsx",
      "src/core/factures/facture.rules.test.ts",
      "src/core/factures/__tests__/ok.test.ts",
    ]);
    expect(testsMalRanges([join(r, "app"), join(r, "src")], r).sort()).toEqual([
      "app/factures/page.test.tsx",
      "src/core/factures/facture.rules.test.ts",
    ]);
  });

  it("une racine absente est ignorée", () => {
    const r = projet(["src/a.ts"]);
    expect(testsMalRanges([join(r, "app"), join(r, "src")], r)).toEqual([]);
  });
});

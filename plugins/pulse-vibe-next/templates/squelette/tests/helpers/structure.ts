import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const IGNORES = new Set(["node_modules", ".next"]);

function tousLesDossiers(racine: string): string[] {
  if (!existsSync(racine)) return [];
  const sousDossiers = readdirSync(racine, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !IGNORES.has(e.name))
    .flatMap((e) => tousLesDossiers(join(racine, e.name)));
  return [racine, ...sousDossiers];
}

const fichiersDe = (dossier: string) => readdirSync(dossier, { withFileTypes: true }).filter((e) => e.isFile());
const relatif = (base: string, chemin: string) => relative(base, chemin).split(sep).join("/");

/** Dossiers qui contiennent plus de `limite` fichiers (sous-dossiers non comptés), hors `exemptes`. */
export function dossiersTropPleins(racines: string[], limite: number, exemptes: string[], base = process.cwd()): string[] {
  return racines
    .flatMap(tousLesDossiers)
    .filter((d) => !exemptes.includes(relatif(base, d)))
    .map((d) => ({ d, n: fichiersDe(d).length }))
    .filter(({ n }) => n > limite)
    .map(({ d, n }) => `${relatif(base, d)} (${n} fichiers)`);
}

/** Fichiers .test.ts / .test.tsx rangés ailleurs que dans un dossier __tests__/. */
export function testsMalRanges(racines: string[], base = process.cwd()): string[] {
  return racines
    .flatMap(tousLesDossiers)
    .filter((d) => !d.split(sep).includes("__tests__"))
    .flatMap((d) => fichiersDe(d).filter((e) => /\.test\.tsx?$/.test(e.name)).map((e) => relatif(base, join(d, e.name))));
}

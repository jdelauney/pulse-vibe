import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VARIABLES_VALIDES } from "../../../tests/helpers/env-de-test";

// Les recettes complètent env.ts et env-public.ts : une variable dans `server` ou `client`, une
// vérification juste après la déclaration de `verificationsCroisees`. Ce test fait de même sur des
// copies, posées à côté de ce fichier le temps d'un test (un nom par copie : un module chargé
// n'est pas relu).
const ICI = dirname(fileURLToPath(import.meta.url));
const copies: string[] = [];
let numero = 0;

// Variables d'essai, ajoutées dans `server`.
const VARIABLES = `
    ESSAI_MODE: z.string().optional(),
    ESSAI_A: z.string().optional(),
    ESSAI_B: z.string().optional(),`;

// Deux vérifications, comme deux recettes : chacune exige sa variable quand ESSAI_MODE la demande.
const DEUX_VERIFICATIONS = `
verificationsCroisees.push((valeurs, ctx) => {
  if (valeurs.ESSAI_MODE === "strict" && !valeurs.ESSAI_A) {
    ctx.addIssue({ code: "custom", path: ["ESSAI_A"], message: "requise" });
  }
});
verificationsCroisees.push((valeurs, ctx) => {
  if (valeurs.ESSAI_MODE === "strict" && !valeurs.ESSAI_B) {
    ctx.addIssue({ code: "custom", path: ["ESSAI_B"], message: "requise" });
  }
});`;

// Une vérification qui lit une variable publique : elle la prend dans envPublic.
const VERIFICATION_PUBLIQUE = `
verificationsCroisees.push((_valeurs, ctx) => {
  if (envPublic.NEXT_PUBLIC_ESSAI === "refusee") {
    ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_ESSAI"], message: "refusée" });
  }
});`;

function ajouterApres(texte: string, ancre: string, bloc: string): string {
  const position = texte.indexOf(ancre);
  if (position < 0) throw new Error(`passage introuvable : ${ancre}`);
  const fin = position + ancre.length;
  return `${texte.slice(0, fin)}${bloc}${texte.slice(fin)}`;
}

/** Écrit une copie d'un fichier de src/config, transformée, et rend son nom (sans extension). */
function copier(fichier: string, transformer: (source: string) => string) {
  numero += 1;
  const nom = `copie-${process.pid}-${numero}`;
  const chemin = join(ICI, `${nom}.ts`);
  copies.push(chemin);
  const source = readFileSync(join(ICI, "..", fichier), "utf8").replaceAll(
    'from "./',
    'from "../',
  );
  writeFileSync(chemin, transformer(source));
  return nom;
}

/** Copies d'env-public.ts (une variable publique de plus) et d'env.ts (les vérifications données), chargées avec la validation. */
async function chargerCopies(
  verifications: string,
  ecarts: Record<string, string | undefined> = {},
) {
  const envPublic = copier("env-public.ts", (source) =>
    ajouterApres(
      ajouterApres(
        `import { z } from "zod";\n${source}`,
        "client: {",
        "\n    NEXT_PUBLIC_ESSAI: z.string().optional(),\n  ",
      ),
      "experimental__runtimeEnv: {",
      "\n    NEXT_PUBLIC_ESSAI: process.env.NEXT_PUBLIC_ESSAI,\n  ",
    ),
  );
  const env = copier("env.ts", (source) =>
    ajouterApres(
      ajouterApres(source, "server: {", VARIABLES),
      "const verificationsCroisees: VerificationCroisee[] = [];",
      verifications,
    ).replace('from "../env-public"', `from "./${envPublic}"`),
  );
  vi.stubEnv("SKIP_ENV_VALIDATION", "");
  for (const [nom, valeur] of Object.entries({
    ...VARIABLES_VALIDES,
    ...ecarts,
  })) {
    vi.stubEnv(nom, valeur);
  }
  const chemin = pathToFileURL(join(ICI, `${env}.ts`)).href;
  return (await import(/* @vite-ignore */ chemin)).env;
}

afterEach(() => {
  for (const copie of copies.splice(0)) rmSync(copie, { force: true });
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Vérifications croisées des variables", () => {
  it("deux vérifications ajoutées : les deux s'exécutent et leurs erreurs sont nommées ensemble", async () => {
    await expect(
      chargerCopies(DEUX_VERIFICATIONS, { ESSAI_MODE: "strict" }),
    ).rejects.toThrow(
      "Variables d'environnement invalides ou manquantes : ESSAI_A, ESSAI_B",
    );
  });

  it("deux vérifications satisfaites : les variables se lisent", async () => {
    const env = await chargerCopies(DEUX_VERIFICATIONS, {
      ESSAI_MODE: "strict",
      ESSAI_A: "a",
      ESSAI_B: "b",
    });
    expect([env.ESSAI_A, env.ESSAI_B]).toEqual(["a", "b"]);
  });

  it("une vérification lit une variable publique dans envPublic : refusée, elle est nommée", async () => {
    await expect(
      chargerCopies(VERIFICATION_PUBLIQUE, { NEXT_PUBLIC_ESSAI: "refusee" }),
    ).rejects.toThrow(
      "Variables d'environnement invalides ou manquantes : NEXT_PUBLIC_ESSAI",
    );
  });

  it("une vérification lit une variable publique dans envPublic : acceptée, elle se lit dans env", async () => {
    const env = await chargerCopies(VERIFICATION_PUBLIQUE, {
      NEXT_PUBLIC_ESSAI: "acceptee",
    });
    expect(env.NEXT_PUBLIC_ESSAI).toBe("acceptee");
  });
});

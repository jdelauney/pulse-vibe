import { vi } from "vitest";

// Valeurs valides de toutes les variables obligatoires, pour les tests qui vérifient la validation
// de src/config/env.ts. Une recette qui ajoute une variable obligatoire ajoute ici une valeur de test.
export const VARIABLES_VALIDES: Record<string, string> = {
  DATABASE_URL: "postgresql://localhost:5432/essai",
};

/**
 * Charge src/config/env.ts avec la validation (vitest.config.ts la saute ailleurs), à partir des
 * valeurs valides et des écarts voulus. Appeler vi.unstubAllEnvs() et vi.resetModules() après chaque test.
 */
export async function chargerEnvValide(
  ecarts: Record<string, string | undefined> = {},
) {
  vi.stubEnv("SKIP_ENV_VALIDATION", "");
  for (const [nom, valeur] of Object.entries({
    ...VARIABLES_VALIDES,
    ...ecarts,
  })) {
    vi.stubEnv(nom, valeur);
  }
  return (await import("@src/config/env")).env;
}

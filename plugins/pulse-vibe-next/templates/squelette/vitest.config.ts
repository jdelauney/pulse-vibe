import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitaires et d'intégration : dans les dossiers __tests__/ (app/, src/), aides dans tests/.
export default defineConfig({
  resolve: {
    alias: {
      "@app": fileURLToPath(new URL("./app", import.meta.url)),
      "@src": fileURLToPath(new URL("./src", import.meta.url)),
      // Le paquet server-only refuse d'être chargé hors du serveur React : neutre dans les tests.
      "server-only": fileURLToPath(
        new URL("./tests/helpers/server-only-vide.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["{app,src}/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    // Les tests simulent env ; src/config/__tests__/env.test.ts rétablit la validation.
    env: { SKIP_ENV_VALIDATION: "1" },
  },
});

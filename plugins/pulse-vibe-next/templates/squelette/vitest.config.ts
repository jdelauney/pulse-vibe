import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitaires et d'intégration (à côté du code : src/**/*.test.ts, ou dans tests/).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Le paquet server-only refuse d'être chargé hors du serveur React : neutre dans les tests.
      "server-only": fileURLToPath(
        new URL("./tests/helpers/server-only-vide.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});

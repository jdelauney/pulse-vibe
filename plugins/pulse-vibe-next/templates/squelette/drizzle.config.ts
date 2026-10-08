import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Charge .env comme Next.js le fait.
loadEnvConfig(process.cwd());

// Adresse directe (sans -pooler) : les migrations ne passent pas par le regroupement de connexions.
const adresseDirecte = process.env.DATABASE_URL_DIRECT;
if (!adresseDirecte) {
  throw new Error(
    "DATABASE_URL_DIRECT manque dans .env (adresse directe de Neon, sans -pooler).",
  );
}

export default defineConfig({
  dialect: "postgresql",
  // Chaque domaine range ses tables dans src/db/<domaine>/<sujet>.table.ts.
  schema: "./src/db/*/*.table.ts",
  out: "./drizzle",
  dbCredentials: { url: adresseDirecte },
  strict: true,
  verbose: true,
});

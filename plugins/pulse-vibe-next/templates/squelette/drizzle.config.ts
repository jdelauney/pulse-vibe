import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Charge .env comme Next.js le fait.
loadEnvConfig(process.cwd());

// Adresse directe (sans -pooler) : les migrations ne passent pas par le regroupement de connexions.
// En local : DATABASE_URL_DIRECT de .env (branche dev). Sur Vercel : DATABASE_URL_UNPOOLED, posée par
// l'intégration Vercel–Neon pour chaque environnement.
const adresseDirecte =
  process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL_UNPOOLED;
if (!adresseDirecte) {
  throw new Error(
    "DATABASE_URL_DIRECT manque dans .env (adresse directe de la branche dev de Neon, sans -pooler).",
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

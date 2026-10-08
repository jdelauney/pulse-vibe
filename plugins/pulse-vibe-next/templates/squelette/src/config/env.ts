import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Variables d'environnement, validées au chargement. Importer ce fichier et utiliser `env`.
// Une recette qui ajoute une variable la déclare ici : secrète dans `server` ; publique
// (NEXT_PUBLIC_…) dans `client` et dans `experimental__runtimeEnv`.
export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
  },
  client: {},
  // Next.js n'inscrit dans le code du navigateur que les lectures écrites en entier.
  experimental__runtimeEnv: {},
  // Une ligne « NOM= » vide compte comme une variable absente.
  emptyStringAsUndefined: true,
  // La construction de vérification (CI, vérificateur du pack) se fait sans variables.
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  onValidationError: (problemes) => {
    const noms = problemes
      .map((p) =>
        (p.path ?? [])
          .map((s) => (typeof s === "object" ? String(s.key) : String(s)))
          .join("."),
      )
      .join(", ");
    throw new Error(
      `Variables d'environnement invalides ou manquantes : ${noms}`,
    );
  },
});

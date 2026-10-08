import "server-only";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { optionsCommunes } from "./env-commun";
import { envPublic } from "./env-public";

// Variables d'environnement du serveur, validées au chargement. Importer ce fichier et utiliser `env`
// (les variables publiques d'env-public.ts y sont aussi). Un composant client qui l'importe fait
// échouer la construction : il lit envPublic. Une recette qui ajoute un secret le déclare dans `server`.
export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
  },
  extends: [envPublic],
  experimental__runtimeEnv: {},
  ...optionsCommunes,
});

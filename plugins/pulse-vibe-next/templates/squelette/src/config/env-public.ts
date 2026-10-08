import { createEnv } from "@t3-oss/env-nextjs";
import { optionsCommunes } from "./env-commun";

// Variables publiques (NEXT_PUBLIC_…), les seules qu'un composant client peut lire :
// importer `envPublic` depuis ce fichier. Une recette qui ajoute une variable publique la déclare
// dans `client` et dans `experimental__runtimeEnv`. Les secrets vont dans env.ts.
export const envPublic = createEnv({
  client: {},
  // Next.js n'inscrit dans le code du navigateur que les lectures écrites en entier.
  experimental__runtimeEnv: {},
  ...optionsCommunes,
});

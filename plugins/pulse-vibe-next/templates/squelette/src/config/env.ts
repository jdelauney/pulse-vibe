import "server-only";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { optionsCommunes } from "./env-commun";
import { envPublic } from "./env-public";

/** Vérification qui lit plusieurs variables (ex. deux clés qui vont ensemble). */
type VerificationCroisee = (
  valeurs: Record<string, unknown>,
  ctx: z.RefinementCtx,
) => void;

// Une recette qui exige plusieurs variables ensemble ajoute sa vérification juste après cette ligne :
// verificationsCroisees.push((valeurs, ctx) => { … });
// `valeurs` contient les variables de `server` ; une variable publique se lit dans `envPublic`.
const verificationsCroisees: VerificationCroisee[] = [];

// Variables d'environnement du serveur, validées au chargement. Importer ce fichier et utiliser `env`
// (les variables publiques d'env-public.ts y sont aussi). Un composant client qui l'importe fait
// échouer la construction : il lit envPublic. Une recette qui ajoute un secret le déclare dans `server`.
export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
  },
  extends: [envPublic],
  experimental__runtimeEnv: {},
  createFinalSchema: (forme) =>
    z.object(forme).superRefine((valeurs, ctx) => {
      for (const verifier of verificationsCroisees) verifier(valeurs, ctx);
    }),
  ...optionsCommunes,
});

import "server-only";
import { z } from "zod";

// Variables d'environnement du serveur. Une recette qui en ajoute une la déclare ici.
const schemaEnvServeur = z.object({
  DATABASE_URL: z.url(),
});

export type EnvServeur = z.infer<typeof schemaEnvServeur>;

let envValide: EnvServeur | undefined;

/** Valide process.env à la première utilisation (pas au chargement), puis garde le résultat. */
export function envServeur(): EnvServeur {
  if (!envValide) {
    const resultat = schemaEnvServeur.safeParse(process.env);
    if (!resultat.success) {
      const manquantes = resultat.error.issues
        .map((i) => i.path.join("."))
        .join(", ");
      throw new Error(
        `Variables d'environnement invalides ou manquantes : ${manquantes}`,
      );
    }
    envValide = resultat.data;
  }
  return envValide;
}

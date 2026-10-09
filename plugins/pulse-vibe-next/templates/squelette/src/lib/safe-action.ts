import "server-only";
import { logger } from "@src/lib/logger";
import { headers } from "next/headers";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

export const MESSAGE_ERREUR_ACTION =
  "Une erreur est survenue. Réessayez dans un instant.";

// Client des actions ouvertes à tous. La recette connexion ajoute actionConnectee.
// Chaque action porte un nom : actionPublique.metadata({ nom: "envoyerMessage" }). Sans lui,
// la vérification des types (npm run typecheck) signale l'action.
// Une erreur attendue se renvoie avec returnServerError("message") ; une erreur imprévue
// est journalisée avec le nom de l'action et remplacée par un message générique.
export const actionPublique = createSafeActionClient({
  defineMetadataSchema() {
    return z.object({ nom: z.string().min(1) });
  },
  handleServerError(erreur, { metadata }) {
    logger.error(
      { err: erreur, action: metadata?.nom },
      "Erreur dans une action serveur",
    );
    return MESSAGE_ERREUR_ACTION;
  },
}).use(async ({ next, metadata }) => {
  // x-vercel-id : l'identifiant de la requête, le même que dans les journaux de Vercel.
  const requete = (await headers()).get("x-vercel-id") ?? undefined;
  const debut = performance.now();
  const resultat = await next();
  logger.info(
    {
      action: metadata.nom,
      requete,
      duree: Math.round(performance.now() - debut),
      reussite: resultat.success,
    },
    "Action terminée",
  );
  return resultat;
});

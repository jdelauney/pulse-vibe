import "server-only";
import { createSafeActionClient } from "next-safe-action";
import { logger } from "@src/lib/logger";

// Client des actions ouvertes à tous. La recette connexion ajoute actionConnectee.
// Une erreur attendue se renvoie avec returnServerError("message") ; une erreur imprévue
// est journalisée et remplacée par un message générique.
export const actionPublique = createSafeActionClient({
  handleServerError(erreur) {
    logger.error({ err: erreur }, "Erreur dans une action serveur");
    return "Une erreur est survenue. Réessayez dans un instant.";
  },
});

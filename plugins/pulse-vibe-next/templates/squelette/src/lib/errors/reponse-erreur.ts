import "server-only";
import { logger } from "@src/lib/logger";
import { ErreurService } from "./erreur-service";

const MESSAGE_SERVICE =
  "Service momentanément indisponible. Réessayez dans un instant.";
const MESSAGE_GENERIQUE = "Une erreur est survenue. Réessayez dans un instant.";

/** Réponse d'un Route Handler pour une erreur technique ou imprévue : journalisée, message générique. */
export function reponseErreur(erreur: unknown, contexte: string): Response {
  if (erreur instanceof ErreurService) {
    logger.error({ err: erreur, service: erreur.service }, contexte);
    return Response.json({ message: MESSAGE_SERVICE }, { status: 503 });
  }
  logger.error({ err: erreur }, contexte);
  return Response.json({ message: MESSAGE_GENERIQUE }, { status: 500 });
}

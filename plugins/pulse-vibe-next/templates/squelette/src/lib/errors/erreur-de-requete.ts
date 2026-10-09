import "server-only";
import { logger } from "@src/lib/logger";
import type { Instrumentation } from "next";

type Parametres = Parameters<Instrumentation.onRequestError>;

/** Journalise une erreur captée par Next.js, avec sa référence (digest) et la route, sans en-têtes ni cookies. */
export function journaliserErreurDeRequete(
  erreur: Parametres[0],
  requete: Parametres[1],
  contexte: Parametres[2],
): void {
  const digest =
    typeof erreur === "object" && erreur !== null && "digest" in erreur
      ? String(erreur.digest)
      : undefined;
  const idVercel = requete.headers["x-vercel-id"];
  logger.error(
    {
      err: erreur,
      digest,
      requete: Array.isArray(idVercel) ? idVercel[0] : idVercel,
      methode: requete.method,
      chemin: requete.path,
      route: contexte.routePath,
      type: contexte.routeType,
    },
    "Erreur du serveur",
  );
}

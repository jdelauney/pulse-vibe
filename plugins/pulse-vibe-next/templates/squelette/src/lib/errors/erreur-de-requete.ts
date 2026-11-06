import "server-only";
import { logger } from "@src/lib/logger";
import { identifiantDeRequete } from "@src/lib/requete";
import type { Instrumentation } from "next";

type Parametres = Parameters<Instrumentation.onRequestError>;

/** Chemin sans sa chaîne de requête ni son ancre : un lien peut y porter un jeton (?token=…). */
export function cheminSansRequete(chemin: string): string {
  return chemin.split(/[?#]/)[0];
}

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
  logger.error(
    {
      err: erreur,
      digest,
      requete: identifiantDeRequete((nom) => requete.headers[nom]),
      methode: requete.method,
      chemin: cheminSansRequete(requete.path),
      route: contexte.routePath,
      type: contexte.routeType,
    },
    "Erreur du serveur",
  );
}

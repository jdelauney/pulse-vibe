import type { Instrumentation } from "next";

// Erreurs du serveur (pages, Route Handlers, actions, proxy) envoyées au journal pino.
// digest est la référence affichée à la personne par error.tsx : elle relie l'écran au journal.
export const onRequestError: Instrumentation.onRequestError = async (
  erreur,
  requete,
  contexte,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { journaliserErreurDeRequete } = await import(
    "@src/lib/errors/erreur-de-requete"
  );
  journaliserErreurDeRequete(erreur, requete, contexte);
};

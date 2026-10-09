import type { Instrumentation } from "next";

// Erreurs du serveur (pages, Route Handlers, actions, proxy) envoyées au journal pino.
// digest est la référence affichée à la personne par error.tsx : elle relie l'écran au journal.
export const onRequestError: Instrumentation.onRequestError = async (
  erreur,
  requete,
  contexte,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Le journal ne doit jamais casser la réponse : une panne du journal est ignorée ici.
  try {
    const { journaliserErreurDeRequete } = await import(
      "@src/lib/errors/erreur-de-requete"
    );
    journaliserErreurDeRequete(erreur, requete, contexte);
  } catch {
    // Rien d'autre à faire : l'erreur d'origine suit son cours.
  }
};

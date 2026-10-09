import "server-only";
import pino, { type DestinationStream, type LoggerOptions } from "pino";

// Clés masquées dans les journaux, à toute profondeur jusqu'à quatre niveaux (objet, tableau,
// en-têtes de requête : req.headers.cookie est couvert par *.*.cookie).
export const CLES_MASQUEES = [
  "password",
  "motDePasse",
  "token",
  "authorization",
  "Authorization",
  "cookie",
  "Cookie",
  "set-cookie",
  "Set-Cookie",
  "x-api-key",
  "X-Api-Key",
  "apiKey",
  "secret",
  "clientSecret",
  "email",
];

/** Chemins pino : la clé seule, puis sous un, deux et trois niveaux */
export const CHEMINS_MASQUES = CLES_MASQUEES.flatMap((cle) => [
  `["${cle}"]`,
  `*["${cle}"]`,
  `*.*["${cle}"]`,
  `*.*.*["${cle}"]`,
]);

// Une erreur se journalise toujours sous la clé err (le masquage et ce nettoyage ne s'appliquent qu'à elle).
// Champs d'erreur qui portent des valeurs saisies : paramètres d'une requête Drizzle, détail et
// contexte d'une erreur de Postgres (« Key (email)=(…) already exists »).
const CHAMPS_ERREUR_RETIRES = [
  "params",
  "detail",
  "where",
  "internalQuery",
  "hint",
];

/** Message d'une requête Drizzle qui échoue (« Failed query: … params: … ») → la requête seule, pour l'erreur et ses causes. */
function messagesSansValeurs(erreur: unknown): Map<string, string> {
  const remplacements = new Map<string, string>();
  const vues = new Set<unknown>();
  let courante = erreur;
  while (courante instanceof Error && !vues.has(courante)) {
    vues.add(courante);
    const requete = (courante as { query?: unknown }).query;
    if ("params" in courante && typeof requete === "string") {
      remplacements.set(courante.message, `Failed query: ${requete}`);
    }
    courante = courante.cause;
  }
  return remplacements;
}

/** Erreur prête pour le journal : celle de pino, sans les valeurs des requêtes SQL. */
export function serialiserErreur(erreur: unknown): unknown {
  return serialiser(erreur, new Set());
}

function serialiser(erreur: unknown, vues: Set<unknown>): unknown {
  if (!(erreur instanceof Error)) return erreur;
  // Une erreur déjà en cours de traitement (référence circulaire) garde la version de pino, sans ses valeurs.
  const sortie = pino.stdSerializers.err(erreur) as unknown as Record<
    string,
    unknown
  >;
  for (const [avant, apres] of messagesSansValeurs(erreur)) {
    for (const champ of ["message", "stack"]) {
      const texte = sortie[champ];
      if (typeof texte === "string") {
        sortie[champ] = texte.split(avant).join(apres);
      }
    }
  }
  for (const champ of CHAMPS_ERREUR_RETIRES) delete sortie[champ];
  if (vues.has(erreur)) return sortie;
  vues.add(erreur);
  // Le code et la contrainte de la cause (Postgres) aident à comprendre la panne, sans valeurs.
  const cause = erreur.cause as { code?: unknown; constraint?: unknown } | null;
  if (typeof cause?.code === "string") sortie.causeCode = cause.code;
  if (typeof cause?.constraint === "string") {
    sortie.causeConstraint = cause.constraint;
  }
  if (erreur instanceof AggregateError) {
    sortie.aggregateErrors = erreur.errors.map((e) => serialiser(e, vues));
  }
  for (const [cle, valeur] of Object.entries(erreur)) {
    if (cle !== "cause" && valeur instanceof Error) {
      sortie[cle] = serialiser(valeur, vues);
    }
  }
  return sortie;
}

export const optionsJournal: LoggerOptions = {
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: { paths: CHEMINS_MASQUES, censor: "[masqué]" },
  serializers: { err: serialiserErreur },
};

/**
 * Sorties du journal en production : les erreurs sur la sortie d'erreur, que Vercel → Logs classe
 * au niveau « Error » ; le reste sur la sortie standard (niveau « Info »).
 */
export function sortiesDuJournal(
  sortie: DestinationStream = process.stdout,
  erreurs: DestinationStream = process.stderr,
) {
  return pino.multistream(
    [
      { level: "trace", stream: sortie },
      { level: "error", stream: erreurs },
    ],
    { dedupe: true },
  );
}

// Journal du serveur. Jamais de secret ni de donnée personnelle dans un message : les clés
// ci-dessus sont masquées en plus, par sécurité, et les valeurs des requêtes SQL retirées des erreurs.
// En local, une seule sortie, lisible avec : npm run dev | npx pino-pretty
export const logger =
  process.env.NODE_ENV === "production"
    ? pino(optionsJournal, sortiesDuJournal())
    : pino(optionsJournal);

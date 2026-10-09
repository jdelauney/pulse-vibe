import "server-only";
import pino, { type LoggerOptions } from "pino";

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

export const optionsJournal: LoggerOptions = {
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: { paths: CHEMINS_MASQUES, censor: "[masqué]" },
};

// Journal du serveur. Jamais de secret ni de donnée personnelle dans un message : les clés
// ci-dessus sont masquées en plus, par sécurité.
// En local, la sortie est lisible avec : npm run dev | npx pino-pretty
export const logger = pino(optionsJournal);

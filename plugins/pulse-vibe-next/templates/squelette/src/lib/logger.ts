import "server-only";
import pino from "pino";

// Journal du serveur. Jamais de secret ni de donnée personnelle dans un message.
// En local, la sortie est lisible avec : npm run dev | npx pino-pretty
export const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: [
    "password",
    "motDePasse",
    "*.password",
    "*.motDePasse",
    "token",
    "*.token",
  ],
});

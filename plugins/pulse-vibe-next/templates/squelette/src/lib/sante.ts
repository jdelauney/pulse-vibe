import "server-only";
import { logger } from "@src/lib/logger";

export const DELAI_SANTE_MS = 5_000;
const ENTETES = { "Cache-Control": "no-store" };

/** Réponse de la sonde de santé : 200 si la base répond dans le délai, 503 sinon, sans détail. */
export async function verifierSante(
  interrogerBase: () => Promise<unknown>,
  delaiMs = DELAI_SANTE_MS,
): Promise<Response> {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuterie = setTimeout(
      () => rejeter(new Error(`la base n'a pas répondu en ${delaiMs} ms`)),
      delaiMs,
    );
  });
  try {
    await Promise.race([interrogerBase(), delai]);
    return Response.json({ etat: "ok" }, { headers: ENTETES });
  } catch (erreur) {
    logger.error({ err: erreur }, "Sonde de santé : la base ne répond pas");
    return Response.json(
      { etat: "indisponible" },
      { status: 503, headers: ENTETES },
    );
  } finally {
    clearTimeout(minuterie);
  }
}

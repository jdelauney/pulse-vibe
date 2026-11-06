import "server-only";
import { logger } from "@src/lib/logger";

export const DELAI_SANTE_MS = 5_000;
// Réponse 200 gardée 15 minutes : au plus un appel à la base par quart d'heure, quel que soit le nombre
// de sondes ou de visiteurs. Neon se met alors en veille entre deux appels (offre gratuite : 100 CU-h
// par mois). Le CDN de l'hébergeur la garde (s-maxage) ; sans CDN (next start chez un autre hébergeur
// que Vercel), le serveur la garde lui-même. Une panne (503) n'est jamais gardée.
const DUREE_EN_CACHE_MS = 900_000;
const EN_CACHE = { "Cache-Control": "public, s-maxage=900" };
const SANS_CACHE = { "Cache-Control": "no-store" };
let derniereReussite = Number.NEGATIVE_INFINITY;

/** Oublie la dernière réponse 200 gardée par le serveur (tests). */
export function oublierSante(): void {
  derniereReussite = Number.NEGATIVE_INFINITY;
}

/** Réponse de la sonde de santé : 200 si la base répond dans le délai, 503 sinon, sans détail. */
export async function verifierSante(
  interrogerBase: () => Promise<unknown>,
  delaiMs = DELAI_SANTE_MS,
  maintenant: () => number = Date.now,
): Promise<Response> {
  if (maintenant() - derniereReussite < DUREE_EN_CACHE_MS)
    return Response.json({ etat: "ok" }, { headers: EN_CACHE });
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuterie = setTimeout(
      () => rejeter(new Error(`la base n'a pas répondu en ${delaiMs} ms`)),
      delaiMs,
    );
  });
  try {
    await Promise.race([interrogerBase(), delai]);
    derniereReussite = maintenant();
    return Response.json({ etat: "ok" }, { headers: EN_CACHE });
  } catch (erreur) {
    logger.error({ err: erreur }, "Sonde de santé : la base ne répond pas");
    return Response.json(
      { etat: "indisponible" },
      { status: 503, headers: SANS_CACHE },
    );
  } finally {
    clearTimeout(minuterie);
  }
}

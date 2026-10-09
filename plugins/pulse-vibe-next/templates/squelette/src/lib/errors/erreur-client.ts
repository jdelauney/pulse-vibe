import "server-only";
import { logger } from "@src/lib/logger";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { cheminSansRequete } from "./erreur-de-requete";

export const TAILLE_MAX = 2_000;
export const ENVOIS_PAR_MINUTE = 10;
const MINUTE = 60_000;
const ADRESSES_SUIVIES_MAX = 1_000;
const MESSAGE_MAX = 200;

const schemaErreurClient = z.object({
  digest: z.string().max(100).optional(),
  message: z.string().optional(),
  chemin: z.string().min(1),
});

/**
 * Limite de débit en mémoire : ENVOIS_PAR_MINUTE par adresse IP et par minute. La mémoire est celle
 * d'une instance de fonction : Vercel peut en lancer plusieurs, la limite vaut pour chacune.
 */
export function creerLimiteur(maintenant: () => number = Date.now) {
  const compteurs = new Map<string, { debut: number; nombre: number }>();
  return (cle: string): boolean => {
    const instant = maintenant();
    const compteur = compteurs.get(cle);
    if (!compteur || instant - compteur.debut >= MINUTE) {
      if (compteurs.size >= ADRESSES_SUIVIES_MAX) compteurs.clear();
      compteurs.set(cle, { debut: instant, nombre: 1 });
      return true;
    }
    compteur.nombre += 1;
    return compteur.nombre <= ENVOIS_PAR_MINUTE;
  };
}

const limiteParDefaut = creerLimiteur();
const reponse = (status: number) => new Response(null, { status });

/**
 * Adresses citées dans un message, sans identifiants (moi:secret@), sans chaîne de requête ni ancre :
 * un lien peut y porter un jeton.
 */
function sansDonneesDAdresse(texte: string): string {
  return texte
    .replace(/\/\/[^\s/@]+@/g, "//")
    .replace(
      /((?:[a-z][a-z\d+.-]*:\/\/|\/)[^\s?#"'<>]*)[?#][^\s"'<>]*/gi,
      "$1",
    );
}

/** Corps de la requête, lu jusqu'à TAILLE_MAX octets ; undefined au-delà (lecture arrêtée). */
async function lireCorps(requete: NextRequest): Promise<string | undefined> {
  if (!requete.body) return "";
  const lecteur = requete.body.getReader();
  const decodeur = new TextDecoder();
  let texte = "";
  let taille = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) return texte + decodeur.decode();
    taille += value.byteLength;
    if (taille > TAILLE_MAX) {
      await lecteur.cancel();
      return undefined;
    }
    texte += decodeur.decode(value, { stream: true });
  }
}

/**
 * Reçoit une erreur du navigateur (app/error.tsx, app/global-error.tsx) et la journalise au niveau
 * « error », comme celles du serveur : Vercel → Logs → Level « Error ». Message coupé à 200
 * caractères, adresses et chemin sans leur chaîne de requête.
 */
export async function recevoirErreurClient(
  requete: NextRequest,
  accepter: (cle: string) => boolean = limiteParDefaut,
): Promise<Response> {
  // Le navigateur envoie toujours Origin avec un POST : un envoi venu d'un autre site est refusé.
  if (requete.headers.get("origin") !== requete.nextUrl.origin) {
    return reponse(403);
  }
  const ip =
    requete.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
  if (!accepter(ip)) return reponse(429);
  // Taille annoncée contrôlée avant toute lecture ; la lecture s'arrête aussi à TAILLE_MAX.
  if (Number(requete.headers.get("content-length") ?? 0) > TAILLE_MAX) {
    return reponse(413);
  }
  const texte = await lireCorps(requete);
  if (texte === undefined) return reponse(413);
  let donnees: unknown;
  try {
    donnees = JSON.parse(texte);
  } catch {
    return reponse(400);
  }
  const lu = schemaErreurClient.safeParse(donnees);
  if (!lu.success) return reponse(400);
  logger.error(
    {
      source: "navigateur",
      digest: lu.data.digest,
      message:
        lu.data.message === undefined
          ? undefined
          : sansDonneesDAdresse(lu.data.message).slice(0, MESSAGE_MAX),
      chemin: cheminSansRequete(lu.data.chemin).slice(0, MESSAGE_MAX),
      requete: requete.headers.get("x-vercel-id") ?? undefined,
    },
    "Erreur dans le navigateur",
  );
  return reponse(204);
}

### 12. La vérification côté serveur

La réponse du widget est vérifiée auprès de Cloudflare (`siteverify`). Une réponse ne sert qu'une fois et vaut 5 minutes. Si Cloudflare ne répond pas dans les 3 secondes, l'envoi est refusé : Turnstile ne sert qu'aux formulaires visés par les robots.

```ts
// src/adapters/turnstile/turnstile.adapter.ts
import "server-only";
import { env } from "@src/config/env";
import { ErreurService } from "@src/lib/errors/erreur-service";
import { CHAMP_TURNSTILE } from "@src/lib/helpers/formulaire-public/champs";
import { ipDepuis } from "@src/lib/helpers/limite/ip-et-message";
import { logger } from "@src/lib/logger";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";

const ADRESSE = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TAILLE_MAXIMALE = 2048;

/** Demande à Cloudflare si la réponse du widget est valable. Toute panne compte comme un refus. */
export async function verifierTurnstile(
  reponse: unknown,
  secret: string,
  ip: string,
  envoyer: typeof fetch = fetch,
): Promise<boolean> {
  if (
    typeof reponse !== "string" ||
    reponse === "" ||
    reponse.length > TAILLE_MAXIMALE
  ) {
    return false;
  }
  const corps = new URLSearchParams({ secret, response: reponse });
  if (ip !== "inconnue") corps.set("remoteip", ip);
  try {
    const resultat = await envoyer(ADRESSE, {
      method: "POST",
      body: corps,
      signal: AbortSignal.timeout(3000),
    });
    const donnees = (await resultat.json()) as { success?: boolean };
    return donnees.success === true;
  } catch (erreur) {
    logger.error(
      {
        err: new ErreurService("turnstile", "Turnstile injoignable", {
          cause: { nom: (erreur as Error | undefined)?.name },
        }),
      },
      "Turnstile injoignable : envoi refusé",
    );
    return false;
  }
}

/** Pour une action : arrête l'action si Turnstile est actif et que la réponse du widget n'est pas valable. */
export async function exigerTurnstile(entree: unknown): Promise<void> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  const reponse = (entree as Record<string, unknown> | null)?.[CHAMP_TURNSTILE];
  if (!(await verifierTurnstile(reponse, secret, ipDepuis(await headers())))) {
    returnServerError(
      "La vérification anti-robot a échoué. Réessayez dans un instant.",
    );
  }
}
```


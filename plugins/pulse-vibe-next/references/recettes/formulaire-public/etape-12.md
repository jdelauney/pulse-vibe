### 12. La vérification côté serveur

La réponse du widget est vérifiée auprès de Cloudflare (`siteverify`). Une réponse ne sert qu'une fois et vaut 5 minutes. Si Cloudflare ne répond pas dans les 3 secondes, l'envoi est refusé : Turnstile ne sert qu'aux formulaires visés par les robots.

L'interface `VerificationRobot` dit ce que le formulaire attend (une réponse du widget, une adresse IP, oui ou non) ; la classe `TurnstileAdapter`, patron Adapter, la remplit avec Cloudflare. Elle reçoit la clé secrète (et, pour les tests, la fonction d'envoi) par son constructeur.

<!-- fichier: src/core/shared/verification-robot.port.ts -->
```ts
// src/core/shared/verification-robot.port.ts

/** Ce que le formulaire attend d'un service anti-robot (Turnstile aujourd'hui). */
export interface VerificationRobot {
  /** Vrai si la réponse du widget est valable ; toute panne du service compte comme un refus. */
  verifier(reponse: unknown, ip: string): Promise<boolean>;
}
```

<!-- fichier: src/adapters/turnstile/turnstile.adapter.ts -->
```ts
// src/adapters/turnstile/turnstile.adapter.ts
import "server-only";
import type { VerificationRobot } from "@src/core/shared/verification-robot.port";
import { ErreurService } from "@src/lib/errors/erreur-service";
import { logger } from "@src/lib/logger";

const ADRESSE = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TAILLE_MAXIMALE = 2048;

/** Demande à Cloudflare si la réponse du widget est valable. Toute panne compte comme un refus. */
export class TurnstileAdapter implements VerificationRobot {
  constructor(
    private readonly secret: string,
    private readonly envoyer: typeof fetch = fetch,
  ) {}

  async verifier(reponse: unknown, ip: string): Promise<boolean> {
    if (
      typeof reponse !== "string" ||
      reponse === "" ||
      reponse.length > TAILLE_MAXIMALE
    ) {
      return false;
    }
    const corps = new URLSearchParams({
      secret: this.secret,
      response: reponse,
    });
    if (ip !== "inconnue") corps.set("remoteip", ip);
    try {
      const resultat = await this.envoyer(ADRESSE, {
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
}
```

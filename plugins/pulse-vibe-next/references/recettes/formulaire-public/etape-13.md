### 13. Brancher Turnstile dans les contrôles

`src/lib/formulaire-public.ts` devient (Turnstile ne s'active que si `TURNSTILE_SECRET_KEY` est définie) :

<!-- fichier: src/lib/formulaire-public.ts -->
```ts
// src/lib/formulaire-public.ts
// Client d'action des formulaires publics : champ piège, jeton de délai, limite par adresse IP,
// puis Turnstile s'il est actif.
import "server-only";
import { TurnstileAdapter } from "@src/adapters/turnstile/turnstile.adapter";
import { env } from "@src/config/env";
import {
  CHAMP_JETON,
  CHAMP_TURNSTILE,
  estPiegeRempli,
} from "@src/lib/helpers/formulaire-public/champs";
import { JetonFormulaire } from "@src/lib/helpers/formulaire-public/jeton";
import { ipDepuis } from "@src/lib/helpers/limite/ip-et-message";
import { exigerLimite, type NomLimite } from "@src/lib/limite";
import { logger } from "@src/lib/logger";
import { actionPublique } from "@src/lib/safe-action";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";

const MESSAGE_RECHARGER = "Rechargez la page et réessayez.";
const MESSAGE_TROP_RAPIDE =
  "Envoi trop rapide. Patientez quelques secondes, puis réessayez.";

/** Option Turnstile : arrête l'action si la réponse du widget n'est pas valable ; sans clé secrète, ne fait rien. */
async function exigerTurnstile(entree: unknown): Promise<void> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  const reponse = (entree as Record<string, unknown> | null)?.[CHAMP_TURNSTILE];
  // Le service anti-robot se crée ici, au point d'assemblage : le reste du code ne voit que l'interface.
  const verification = new TurnstileAdapter(secret);
  if (!(await verification.verifier(reponse, ipDepuis(await headers())))) {
    returnServerError(
      "La vérification anti-robot a échoué. Réessayez dans un instant.",
    );
  }
}

export function actionFormulairePublic(
  formulaire: string,
  limite: NomLimite = "formulairePublic",
) {
  return actionPublique.use(async ({ clientInput, next }) => {
    // Du moins coûteux au plus coûteux : rien n'est compté pour un envoi déjà refusé.
    if (estPiegeRempli(clientInput)) {
      logger.warn(
        { formulaire },
        "Formulaire public : champ piège rempli, envoi refusé",
      );
      returnServerError(MESSAGE_RECHARGER);
    }
    const jeton = (clientInput as Record<string, unknown> | null)?.[
      CHAMP_JETON
    ];
    const etat = new JetonFormulaire(env.FORMULAIRE_SECRET).verifier(
      jeton,
      formulaire,
      Date.now(),
    );
    if (etat !== "valide") {
      logger.warn({ formulaire, etat }, "Formulaire public : jeton refusé");
      returnServerError(
        etat === "trop-rapide" ? MESSAGE_TROP_RAPIDE : MESSAGE_RECHARGER,
      );
    }
    await exigerLimite(limite);
    // Option Turnstile : active seulement si TURNSTILE_SECRET_KEY est définie.
    await exigerTurnstile(clientInput);
    return next();
  });
}
```


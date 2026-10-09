### 7. Les contrôles avant l'action

`actionFormulairePublic(formulaire)` remplace `actionPublique` pour un formulaire public. Ses contrôles lisent les données brutes (`clientInput`), avant le schéma Zod : le champ piège, puis le jeton, puis la limite. Le schéma de l'action retire ensuite les champs de protection, et l'action reçoit des données propres.

```ts
// src/lib/formulaire-public.ts
// Client d'action des formulaires publics : champ piège, jeton de délai, puis limite par adresse IP.
import "server-only";
import { env } from "@src/config/env";
import {
  CHAMP_JETON,
  estPiegeRempli,
} from "@src/lib/helpers/formulaire-public/champs";
import { verifierJeton } from "@src/lib/helpers/formulaire-public/jeton";
import { exigerLimite, type NomLimite } from "@src/lib/limite";
import { logger } from "@src/lib/logger";
import { actionPublique } from "@src/lib/safe-action";
import { returnServerError } from "next-safe-action";

const MESSAGE_RECHARGER = "Rechargez la page et réessayez.";
const MESSAGE_TROP_RAPIDE =
  "Envoi trop rapide. Patientez quelques secondes, puis réessayez.";

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
    const etat = verifierJeton(
      jeton,
      formulaire,
      Date.now(),
      env.FORMULAIRE_SECRET,
    );
    if (etat !== "valide") {
      logger.warn({ formulaire, etat }, "Formulaire public : jeton refusé");
      returnServerError(
        etat === "trop-rapide" ? MESSAGE_TROP_RAPIDE : MESSAGE_RECHARGER,
      );
    }
    await exigerLimite(limite);
    return next();
  });
}
```


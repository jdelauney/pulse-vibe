### 3. Le jeton signé

Le jeton vaut `horodatage.formulaire.signature`. La signature (HMAC) est calculée avec `FORMULAIRE_SECRET` : modifier l'heure ou le nom du formulaire la rend fausse. La comparaison se fait en temps constant (`timingSafeEqual`). La classe `JetonFormulaire` reçoit le secret par son constructeur et porte les deux règles du jeton : un délai minimal et une durée de vie.

<!-- fichier: src/lib/helpers/formulaire-public/jeton.ts -->
```ts
// src/lib/helpers/formulaire-public/jeton.ts
// Jeton « horodatage.formulaire.signature » : prouve que le formulaire a été ouvert sur le site, et quand.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const DELAI_MINIMUM_MS = 3_000;
export const DUREE_DE_VIE_MS = 2 * 60 * 60 * 1000;

export type EtatJeton =
  | "valide"
  | "absent"
  | "falsifie"
  | "trop-rapide"
  | "expire";

/** Signe et vérifie les jetons de délai ; le secret arrive par le constructeur. */
export class JetonFormulaire {
  constructor(private readonly secret: string) {}

  signer(formulaire: string, maintenant: number): string {
    const contenu = `${maintenant}.${formulaire}`;
    return `${contenu}.${this.signature(contenu)}`;
  }

  verifier(jeton: unknown, formulaire: string, maintenant: number): EtatJeton {
    if (typeof jeton !== "string" || jeton === "") return "absent";
    const morceaux = jeton.split(".");
    if (morceaux.length !== 3) return "falsifie";
    const [horodatage = "", formulaireDuJeton = "", signatureRecue = ""] =
      morceaux;
    const attendue = Buffer.from(
      this.signature(`${horodatage}.${formulaireDuJeton}`),
    );
    const recue = Buffer.from(signatureRecue);
    if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) {
      return "falsifie";
    }
    if (formulaireDuJeton !== formulaire || !/^\d+$/.test(horodatage)) {
      return "falsifie";
    }
    const age = maintenant - Number(horodatage);
    if (age < DELAI_MINIMUM_MS) return "trop-rapide";
    if (age > DUREE_DE_VIE_MS) return "expire";
    return "valide";
  }

  private signature(contenu: string): string {
    return createHmac("sha256", this.secret)
      .update(contenu)
      .digest("base64url");
  }
}
```

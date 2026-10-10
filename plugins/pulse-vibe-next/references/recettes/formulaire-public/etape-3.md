### 3. Le jeton signé

Le jeton vaut `horodatage.formulaire.signature`. La signature (HMAC) est calculée avec `FORMULAIRE_SECRET` : modifier l'heure ou le nom du formulaire la rend fausse. La comparaison se fait en temps constant (`timingSafeEqual`).

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

function signature(contenu: string, secret: string): string {
  return createHmac("sha256", secret).update(contenu).digest("base64url");
}

export function signerJeton(
  formulaire: string,
  maintenant: number,
  secret: string,
): string {
  const contenu = `${maintenant}.${formulaire}`;
  return `${contenu}.${signature(contenu, secret)}`;
}

export function verifierJeton(
  jeton: unknown,
  formulaire: string,
  maintenant: number,
  secret: string,
): EtatJeton {
  if (typeof jeton !== "string" || jeton === "") return "absent";
  const morceaux = jeton.split(".");
  if (morceaux.length !== 3) return "falsifie";
  const [horodatage = "", formulaireDuJeton = "", signatureRecue = ""] =
    morceaux;
  const attendue = Buffer.from(
    signature(`${horodatage}.${formulaireDuJeton}`, secret),
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
```


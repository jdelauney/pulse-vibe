### 4. La route du jeton

Le navigateur demande le jeton à l'ouverture du formulaire : la page reste statique, et le jeton n'est jamais gardé en cache (`no-store`).

```ts
// app/api/jeton-formulaire/route.ts
// Jeton de délai d'un formulaire public, demandé par le navigateur à l'ouverture du formulaire.
import { env } from "@src/config/env";
import { NOM_FORMULAIRE } from "@src/lib/helpers/formulaire-public/champs";
import { signerJeton } from "@src/lib/helpers/formulaire-public/jeton";
import { connection } from "next/server";

export async function GET(request: Request) {
  // Réponse calculée à chaque demande : l'heure fait partie du jeton.
  await connection();
  const formulaire = new URL(request.url).searchParams.get("formulaire") ?? "";
  if (!NOM_FORMULAIRE.test(formulaire)) {
    return Response.json({ erreur: "Formulaire inconnu." }, { status: 400 });
  }
  const jeton = signerJeton(
    formulaire,
    Date.now(),
    env.FORMULAIRE_SECRET,
  );
  return Response.json({ jeton }, { headers: { "Cache-Control": "no-store" } });
}
```


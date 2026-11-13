### 7. La lecture et l'action

La lecture va directement au repository, sans use-case (architecture.md §6) : elle renvoie des données simples (`FactureVue`) à l'écran, jamais une instance. Elle traduit les filtres de l'adresse en filtres du repository.

<!-- fichier: src/features/factures/queries/lister-factures.query.ts -->
```ts
// src/features/factures/queries/lister-factures.query.ts
import "server-only";
import { getDb } from "@src/db/db-client";
import { DrizzleFactureRepository } from "@src/db/factures/facture.repository";
import { TAILLE_PAGE } from "../constants/factures";
import type { FiltresFactures } from "../schemas/filtres.schema";

export async function listerFactures(
  utilisateurId: string,
  filtres: FiltresFactures,
) {
  return new DrizzleFactureRepository(getDb()).lister(utilisateurId, {
    statut: filtres.statut === "tous" ? null : filtres.statut,
    recherche: filtres.recherche,
    tri: filtres.tri,
    page: filtres.page,
    taillePage: TAILLE_PAGE,
  });
}
```

L'identifiant du propriétaire vient **de la session** (`ctx.utilisateur.id`), jamais de la saisie. L'action crée le use-case et le repository, traduit un échec en message, puis appelle `refresh()` : la page revient à jour dans la même réponse. La liste est lue sans cache (`"use cache"` absent), donc il n'y a pas d'étiquette de cache à invalider.

<!-- fichier: src/features/factures/actions/creer-facture.action.ts -->
```ts
// src/features/factures/actions/creer-facture.action.ts
"use server";

import { CreerFacture } from "@src/core/factures/use-cases/creer-facture.use-case";
import { getDb } from "@src/db/db-client";
import { DrizzleFactureRepository } from "@src/db/factures/facture.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { refresh } from "next/cache";
import { returnServerError } from "next-safe-action";
import { MESSAGES_FACTURE } from "../constants/erreur-messages";
import { creerFactureSchema } from "../schemas/facture.schema";

export const creerFactureAction = actionConnectee
  .metadata({ nom: "creerFacture" })
  .inputSchema(creerFactureSchema)
  .action(async ({ parsedInput, ctx }) => {
    // L'action assemble les objets (racine de composition) : le use-case reçoit son stockage.
    const creer = new CreerFacture(new DrizzleFactureRepository(getDb()));
    const resultat = await creer.executer({
      utilisateurId: ctx.utilisateur.id,
      client: parsedInput.client,
      montant: parsedInput.montant,
    });
    if (!resultat.ok) returnServerError(MESSAGES_FACTURE[resultat.raison]);
    refresh();
    return { id: resultat.valeur.id };
  });
```


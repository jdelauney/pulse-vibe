### 2. Le use-case « créer une facture »

Créer une facture applique une règle métier (le montant positif) : l'écriture passe donc par un use-case (architecture.md §5, point 2). Le port décrit seulement ce dont le use-case a besoin ; le repository de l'étape 5 le fournit.

<!-- fichier: src/core/factures/facture-repository.port.ts -->
```ts
// src/core/factures/facture-repository.port.ts
export type FactureRepository = {
  inserer(
    utilisateurId: string,
    donnees: { client: string; montantCentimes: number },
  ): Promise<{ id: string }>;
};
```

<!-- fichier: src/core/factures/use-cases/creer-facture.use-case.ts -->
```ts
// src/core/factures/use-cases/creer-facture.use-case.ts
import { ok, type Result } from "@src/core/shared/result";
import type { ErreurFacture } from "../facture.errors";
import { montantEnCentimes } from "../facture.rules";
import type { FactureRepository } from "../facture-repository.port";

export async function creerFacture(
  deps: { factures: FactureRepository },
  entree: { utilisateurId: string; client: string; montant: string },
): Promise<Result<{ id: string }, ErreurFacture>> {
  const montant = montantEnCentimes(entree.montant);
  if (!montant.ok) return montant;
  const facture = await deps.factures.inserer(entree.utilisateurId, {
    client: entree.client,
    montantCentimes: montant.valeur,
  });
  return ok(facture);
}
```

Le schéma Zod de l'étape 6 applique la même règle dans le navigateur ; le use-case la garantit pour tout point d'entrée (action, import, webhook).


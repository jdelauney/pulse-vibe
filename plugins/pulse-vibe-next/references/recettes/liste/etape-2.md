### 2. Le use-case « créer une facture »

Créer une facture applique une règle métier (le montant positif) : l'écriture passe donc par un use-case (architecture.md §5, point 2), une classe qui reçoit son stockage par le constructeur. Le port est une interface qui décrit seulement ce dont le use-case a besoin ; le repository de l'étape 5 l'implémente.

<!-- fichier: src/core/factures/facture-repository.port.ts -->
```ts
// src/core/factures/facture-repository.port.ts
import type { Facture } from "./facture.entity";

/** Ce que le métier attend du stockage des factures (patron Repository). */
export interface FactureRepository {
  inserer(
    utilisateurId: string,
    donnees: { client: string; montantCentimes: number },
  ): Promise<Facture>;
}
```

<!-- fichier: src/core/factures/use-cases/creer-facture.use-case.ts -->
```ts
// src/core/factures/use-cases/creer-facture.use-case.ts
import { ok, type Result } from "@src/core/shared/result";
import type { ErreurFacture } from "../facture.errors";
import { ReglesMontantFacture } from "../facture.rules";
import type { FactureRepository } from "../facture-repository.port";

/** Créer une facture : reçoit son stockage par le constructeur (inversion de dépendance). */
export class CreerFacture {
  private readonly regles = new ReglesMontantFacture();

  constructor(private readonly factures: FactureRepository) {}

  async executer(entree: {
    utilisateurId: string;
    client: string;
    montant: string;
  }): Promise<Result<{ id: string }, ErreurFacture>> {
    const montant = this.regles.montantEnCentimes(entree.montant);
    if (!montant.ok) return montant;
    const facture = await this.factures.inserer(entree.utilisateurId, {
      client: entree.client,
      montantCentimes: montant.valeur,
    });
    return ok({ id: facture.id });
  }
}
```

Le schéma Zod de l'étape 6 applique la même règle dans le navigateur ; le use-case la garantit pour tout point d'entrée (action, import, webhook).


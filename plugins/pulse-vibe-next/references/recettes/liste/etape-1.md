### 1. Le métier : entité, erreurs, règles

Le métier ne dépend de rien d'autre que `src/core/`. Les statuts et les tris y vivent : la table, le repository et l'écran les lisent au même endroit.

<!-- fichier: src/core/factures/facture.entity.ts -->
```ts
// src/core/factures/facture.entity.ts
export const STATUTS_FACTURE = ["brouillon", "envoyee", "payee"] as const;
export type StatutFacture = (typeof STATUTS_FACTURE)[number];

/** Ordres possibles de la liste : par date de création ou par montant. */
export const TRIS_FACTURES = [
  "recentes",
  "anciennes",
  "montant-desc",
  "montant-asc",
] as const;
export type TriFactures = (typeof TRIS_FACTURES)[number];

export type Facture = {
  id: string;
  utilisateurId: string;
  client: string;
  montantCentimes: number;
  statut: StatutFacture;
  creeLe: Date;
};
```

<!-- fichier: src/core/factures/facture.errors.ts -->
```ts
// src/core/factures/facture.errors.ts
export type ErreurFacture = "montant-invalide";
```

<!-- fichier: src/core/factures/facture.rules.ts -->
```ts
// src/core/factures/facture.rules.ts
import { echec, ok, type Result } from "@src/core/shared/result";
import type { ErreurFacture } from "./facture.errors";

/** Format accepté pour un montant saisi en euros : 120 ; 120,5 ; 120.50. */
export const FORMAT_MONTANT = /^\d{1,7}([.,]\d{1,2})?$/;

/** Convertit un montant saisi en euros (« 120,50 ») en centimes entiers (12050), sans calcul à virgule. */
export function eurosEnCentimes(saisie: string): number {
  const valeur = saisie.trim();
  if (!FORMAT_MONTANT.test(valeur)) return Number.NaN;
  const [euros, decimales = ""] = valeur.split(/[.,]/);
  return Number(euros) * 100 + Number(decimales.padEnd(2, "0"));
}

/** Règle du montant : une saisie au bon format, supérieure à 0 €. */
export function montantEnCentimes(
  saisie: string,
): Result<number, ErreurFacture> {
  const centimes = eurosEnCentimes(saisie);
  return centimes > 0 ? ok(centimes) : echec("montant-invalide");
}
```


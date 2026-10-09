### 6. Les constantes, le schéma Zod et les filtres

Les libellés affichés et la taille de page appartiennent à l'écran : ils vont dans `constants/`.

<!-- fichier: src/features/factures/constants/factures.ts -->
```ts
// src/features/factures/constants/factures.ts
import {
  STATUTS_FACTURE,
  type StatutFacture,
  type TriFactures,
} from "@src/core/factures/facture.entity";

export const LIBELLES_STATUT: Record<StatutFacture, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
};

export const FILTRES_STATUT = ["tous", ...STATUTS_FACTURE] as const;
export type FiltreStatut = (typeof FILTRES_STATUT)[number];

export const LIBELLES_TRI: Record<TriFactures, string> = {
  recentes: "Plus récentes d'abord",
  anciennes: "Plus anciennes d'abord",
  "montant-desc": "Montant décroissant",
  "montant-asc": "Montant croissant",
};

export const TAILLE_PAGE = 10;

export const CHAMPS_FACTURE = ["client", "montant"] as const;
export type ChampFacture = (typeof CHAMPS_FACTURE)[number];
```

`erreur-messages.ts` donne un message à chaque code d'erreur du métier : un code sans message fait échouer `npm run typecheck`.

<!-- fichier: src/features/factures/constants/erreur-messages.ts -->
```ts
// src/features/factures/constants/erreur-messages.ts
import type { ErreurFacture } from "@src/core/factures/facture.errors";

export const MESSAGES_FACTURE: Record<ErreurFacture, string> = {
  "montant-invalide": "Le montant doit être supérieur à 0 €.",
};
```

Le formulaire et l'action valident avec **le même** schéma, qui réutilise les règles du métier. Le montant reste une saisie en euros ; le use-case le convertit en centimes.

<!-- fichier: src/features/factures/schemas/facture.schema.ts -->
```ts
// src/features/factures/schemas/facture.schema.ts
import {
  FORMAT_MONTANT,
  montantEnCentimes,
} from "@src/core/factures/facture.rules";
import { z } from "zod";

export const creerFactureSchema = z.object({
  client: z
    .string()
    .trim()
    .min(1, "Indiquez le nom du client.")
    .max(120, "Le nom du client tient en 120 caractères au plus."),
  montant: z
    .string()
    .trim()
    .regex(FORMAT_MONTANT, "Écrivez un montant en euros, par exemple 120,50.")
    .refine(
      (valeur) => !FORMAT_MONTANT.test(valeur) || montantEnCentimes(valeur).ok,
      "Le montant doit être supérieur à 0 €.",
    ),
});

export type CreerFactureEntree = z.input<typeof creerFactureSchema>;
```

Un seul fichier décrit les paramètres de l'adresse. Il importe depuis `nuqs/server`, ce qui le rend utilisable **côté serveur et côté client**.

<!-- fichier: src/features/factures/schemas/filtres.schema.ts -->
```ts
// src/features/factures/schemas/filtres.schema.ts
import { TRIS_FACTURES } from "@src/core/factures/facture.entity";
import {
  createLoader,
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { FILTRES_STATUT } from "../constants/factures";

export const filtresFactures = {
  statut: parseAsStringLiteral(FILTRES_STATUT).withDefault("tous"),
  recherche: parseAsString.withDefault(""),
  tri: parseAsStringLiteral(TRIS_FACTURES).withDefault("recentes"),
  page: parseAsInteger.withDefault(1),
};

export type FiltresFactures = inferParserType<typeof filtresFactures>;

/** Lecture côté serveur : accepte la promesse `searchParams` de la page. */
export const chargerFiltresFactures = createLoader(filtresFactures);
```


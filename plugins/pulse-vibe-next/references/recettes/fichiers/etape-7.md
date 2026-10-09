### 7. Les constantes et le schéma

`erreur-messages.ts` donne un message à chaque code d'erreur du métier : un code sans message fait échouer `npm run typecheck`.

<!-- fichier: src/features/fichiers/constants/fichiers.ts -->
```ts
// src/features/fichiers/constants/fichiers.ts
export const MESSAGE_ENVOI_ECHOUE = "L'envoi n'a pas abouti. Réessayez.";
```

<!-- fichier: src/features/fichiers/constants/erreur-messages.ts -->
```ts
// src/features/fichiers/constants/erreur-messages.ts
import type { ErreurFichier } from "@src/core/fichiers/fichier.errors";
import { MESSAGE_ENVOI_ECHOUE } from "./fichiers";

export const MESSAGES_FICHIER: Record<ErreurFichier, string> = {
  "fichier-introuvable": "Fichier introuvable.",
  "envoi-incomplet": MESSAGE_ENVOI_ECHOUE,
};
```

<!-- fichier: src/features/fichiers/schemas/fichier.schema.ts -->
```ts
// src/features/fichiers/schemas/fichier.schema.ts
import {
  TAILLE_MAX,
  TYPES_AUTORISES,
  type TypeAutorise,
} from "@src/core/fichiers/fichier.entity";
import { z } from "zod";

export const demandeEnvoiSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Nom de fichier manquant.")
    .max(200, "Nom de fichier trop long."),
  typeMime: z.enum(
    Object.keys(TYPES_AUTORISES) as [TypeAutorise, ...TypeAutorise[]],
    {
      error: "Type de fichier refusé : JPEG, PNG, WebP ou PDF seulement.",
    },
  ),
  taille: z
    .number()
    .int()
    .min(1, "Le fichier est vide.")
    .max(TAILLE_MAX, "Fichier trop lourd : 5 Mo au maximum."),
});

export const idFichierSchema = z.object({ id: z.uuid() });
```


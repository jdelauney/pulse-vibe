### 7. Les schémas partagés

<!-- fichier: src/features/compte/schemas/compte.schema.ts -->
```ts
// src/features/compte/schemas/compte.schema.ts
import { z } from "zod";

const motDePasse = z
  .string()
  .min(8, "8 caractères au moins.")
  .max(128, "128 caractères au plus.");

export const schemaInscription = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Indiquez votre nom.")
    .max(100, "100 caractères au plus."),
  email: z.email("Adresse e-mail invalide.").max(254),
  motDePasse,
});

export const schemaConnexion = z.object({
  email: z.email("Adresse e-mail invalide.").max(254),
  motDePasse: z.string().min(1, "Indiquez votre mot de passe.").max(128),
});

export const schemaChangementMotDePasse = z
  .object({
    motDePasseActuel: z
      .string()
      .min(1, "Indiquez votre mot de passe actuel.")
      .max(128),
    nouveauMotDePasse: motDePasse,
    confirmation: z.string(),
  })
  .refine((v) => v.nouveauMotDePasse === v.confirmation, {
    message: "Les deux mots de passe sont différents.",
    path: ["confirmation"],
  });

export type Inscription = z.infer<typeof schemaInscription>;
export type Connexion = z.infer<typeof schemaConnexion>;
export type ChangementMotDePasse = z.infer<typeof schemaChangementMotDePasse>;
```


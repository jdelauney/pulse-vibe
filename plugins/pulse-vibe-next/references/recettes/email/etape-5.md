### 5. Les schémas

Ajoutez à la fin de `src/features/compte/schemas/compte.schema.ts` (la constante `motDePasse` y existe déjà) :

```ts
// src/features/compte/schemas/compte.schema.ts (à la fin du fichier)
// Ajouts de la recette email.
export const schemaMotDePasseOublie = z.object({
  email: z.email("Adresse e-mail invalide.").max(254),
});

const champsNouveauMotDePasse = z.object({
  nouveauMotDePasse: motDePasse,
  confirmation: z.string(),
});

const memesMotsDePasse = {
  verifier: (v: { nouveauMotDePasse: string; confirmation: string }) =>
    v.nouveauMotDePasse === v.confirmation,
  erreur: {
    message: "Les deux mots de passe sont différents.",
    path: ["confirmation"],
  },
};

/** Formulaire « Nouveau mot de passe » (le jeton vient de l'adresse, pas d'un champ). */
export const schemaNouveauMotDePasse = champsNouveauMotDePasse.refine(
  memesMotsDePasse.verifier,
  memesMotsDePasse.erreur,
);

/** Action « Nouveau mot de passe » : les champs du formulaire et le jeton reçu par e-mail. */
export const schemaChoixMotDePasse = champsNouveauMotDePasse
  .extend({ token: z.string().min(1).max(200) })
  .refine(memesMotsDePasse.verifier, memesMotsDePasse.erreur);

export type MotDePasseOublie = z.infer<typeof schemaMotDePasseOublie>;
export type NouveauMotDePasse = z.infer<typeof schemaNouveauMotDePasse>;
```


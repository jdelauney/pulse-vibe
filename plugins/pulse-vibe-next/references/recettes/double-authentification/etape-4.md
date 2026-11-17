### 4. La session et les schémas

`utilisateurConnecte()` (recette `connexion`) dit aussi si la double authentification est active : « Mon compte » affiche le bon bouton.

<!-- remplacer-ligne: src/features/compte/queries/utilisateur-connecte.query.ts début: export type UtilisateurConnecte = -->
```ts
export type UtilisateurConnecte = {
  id: string;
  nom: string;
  email: string;
  doubleAuthentification: boolean;
};
```

<!-- ajout: src/features/compte/queries/utilisateur-connecte.query.ts après: email: session.user.email, -->
```ts
      doubleAuthentification: session.user.twoFactorEnabled === true,
```

Les schémas, à la fin de `src/features/compte/schemas/compte.schema.ts` :

<!-- ajout: src/features/compte/schemas/compte.schema.ts -->
```ts

// Ajouts de la recette double-authentification.
export const schemaCodeConnexion = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Le code compte 6 chiffres."),
});

/** Activer ou désactiver la double authentification : le mot de passe du compte. */
export const schemaReglageDoubleAuthentification = z.object({
  motDePasse: z.string().min(1, "Indiquez votre mot de passe.").max(128),
});

export type CodeConnexion = z.infer<typeof schemaCodeConnexion>;
export type ReglageDoubleAuthentification = z.infer<
  typeof schemaReglageDoubleAuthentification
>;
```

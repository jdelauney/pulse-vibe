### 1. Les variables validées

Dans `src/config/env.ts`, ajouter dans `server: { … }` :

<!-- ajout: src/config/env.ts après: server: { -->
```ts
    BETTER_AUTH_SECRET: z.string().min(32),
    // Rotation douce (better-auth 1.5 et plus), lue directement par better-auth : « 2:nouvelle,1:ancienne ».
    // La première version doit faire 32 caractères au moins. BETTER_AUTH_SECRET reste pour relire l'existant.
    BETTER_AUTH_SECRETS: z
      .string()
      .regex(/^\d+:[^,]{32,}(,\d+:[^,]+)*$/)
      .optional(),
    BETTER_AUTH_URL: z.url(),
```

Pour les tests qui vérifient la validation, ajouter des valeurs de test dans `VARIABLES_VALIDES` de `tests/helpers/env-de-test.ts` (aide du squelette) :

<!-- ajout: tests/helpers/env-de-test.ts après: export const VARIABLES_VALIDES: Record<string, string> = { -->
```ts
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
```

`env` valide ces variables dès le chargement : le code les lit par `env.BETTER_AUTH_SECRET`, etc. (import `import { env } from "@src/config/env"`).


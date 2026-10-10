### 5. Les variables

Dans `src/config/env.ts`, ajouter dans `server: { … }` :

<!-- ajout: src/config/env.ts après: server: { -->
```ts
    // Recette limite : où ranger les compteurs (base par défaut ; redis avec l'option ; memoire pour les tests).
    LIMITE_STOCKAGE: z.enum(["base", "memoire"]).default("base"),
```


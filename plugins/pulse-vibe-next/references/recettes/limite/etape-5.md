### 5. Les variables

Dans `src/config/env.ts`, ajouter dans `server: { … }` :

```ts
    // Recette limite : où ranger les compteurs (base par défaut ; memoire pour les tests).
    LIMITE_STOCKAGE: z.enum(["base", "memoire"]).default("base"),
```


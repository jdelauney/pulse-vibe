### 5. Les variables

Dans `src/config/env.ts`, ajouter dans `server: { … }` :

<!-- ajout: src/config/env.ts après: server: { -->
```ts
    // Recette limite : où ranger les compteurs (base par défaut ; redis avec l'option ; memoire pour les tests).
    LIMITE_STOCKAGE: z.enum(["base", "memoire"]).default("base"),
    // Nombre de proxys de confiance devant le site (Vercel, Caddy, proxy du fournisseur : 1).
    PROXYS_DE_CONFIANCE: z.coerce.number().int().min(1).max(5).default(1),
```


### 11. Le widget Cloudflare et les variables

Dans le tableau de bord Cloudflare : **Turnstile** → ajouter un widget, avec le domaine du site et `localhost`. Copier la clé de site et la clé secrète dans `.env` :

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=VOTRE_CLE_ICI
```

Ajouter les deux noms à `.env.example`. La clé de site est publique : elle va dans `src/config/env-public.ts`, dans `client: { … }` et dans `experimental__runtimeEnv` :

```ts
  client: {
    // Recette formulaire-public, option Turnstile : clé de site du widget, publique.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  },
  // Next.js n'inscrit dans le code du navigateur que les lectures écrites en entier.
  experimental__runtimeEnv: {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  },
```

(ajouter `import { z } from "zod";` en tête d'`env-public.ts` s'il n'y est pas). La clé secrète va dans `src/config/env.ts`, dans `server: { … }` :

```ts
    // Recette formulaire-public, option Turnstile : clé secrète du widget (Cloudflare).
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
```

puis, toujours dans `env.ts`, une vérification qui exige les deux clés ensemble : une seule des deux bloquerait chaque envoi, ou laisserait le serveur sans contrôle. S'il existe déjà un `createFinalSchema` (recette `limite`, option Redis), ajouter seulement ce `.superRefine(…)` à la suite du premier :

```ts
  // Recette formulaire-public, option Turnstile : les deux clés vont ensemble
  // (la clé de site est dans env-public.ts).
  createFinalSchema: (forme) =>
    z.object(forme).superRefine((valeurs, ctx) => {
      const cleSite = envPublic.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      if (!cleSite === !valeurs.TURNSTILE_SECRET_KEY) return;
      ctx.addIssue({
        code: "custom",
        path: [
          cleSite ? "TURNSTILE_SECRET_KEY" : "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
        ],
        message: "les deux clés Turnstile vont ensemble",
      });
    }),
```


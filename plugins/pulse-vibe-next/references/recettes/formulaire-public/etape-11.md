### 11. Le widget Cloudflare et les variables

Dans le tableau de bord Cloudflare : **Turnstile** → ajouter un widget, avec le domaine du site et `localhost`. Copier la clé de site et la clé secrète dans `.env` :

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=VOTRE_CLE_ICI
```

Ajouter les deux noms à `.env.example` :

<!-- ajout: .env.example -->
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

La clé de site est publique : elle va dans `src/config/env-public.ts`, qui devient :

<!-- fichier: src/config/env-public.ts -->
```ts
// src/config/env-public.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { optionsCommunes } from "./env-commun";

// Variables publiques (NEXT_PUBLIC_…), les seules qu'un composant client peut lire :
// importer `envPublic` depuis ce fichier. Une recette qui ajoute une variable publique la déclare
// dans `client` et dans `experimental__runtimeEnv`. Les secrets vont dans env.ts.
export const envPublic = createEnv({
  client: {
    // Recette formulaire-public, option Turnstile : clé de site du widget, publique.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  },
  // Next.js n'inscrit dans le code du navigateur que les lectures écrites en entier.
  experimental__runtimeEnv: {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  },
  ...optionsCommunes,
});
```

(Si le projet a déjà d'autres variables publiques, ajouter seulement les deux lignes `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, et `import { z } from "zod";` s'il manque.) La clé secrète va dans `src/config/env.ts`, dans `server: { … }` :

<!-- ajout: src/config/env.ts après: server: { -->
```ts
    // Recette formulaire-public, option Turnstile : clé secrète du widget (Cloudflare).
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
```

puis, toujours dans `env.ts`, une vérification qui exige les deux clés ensemble : une seule des deux bloquerait chaque envoi, ou laisserait le serveur sans contrôle. Elle s'ajoute à la liste `verificationsCroisees` du squelette, juste après sa déclaration :

<!-- ajout: src/config/env.ts après: const verificationsCroisees: VerificationCroisee[] = []; -->
```ts
// Recette formulaire-public, option Turnstile : les deux clés vont ensemble
// (la clé de site est dans env-public.ts).
verificationsCroisees.push((valeurs, ctx) => {
  const cleSite = envPublic.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!cleSite === !valeurs.TURNSTILE_SECRET_KEY) return;
  ctx.addIssue({
    code: "custom",
    path: [cleSite ? "TURNSTILE_SECRET_KEY" : "NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
    message: "les deux clés Turnstile vont ensemble",
  });
});
```

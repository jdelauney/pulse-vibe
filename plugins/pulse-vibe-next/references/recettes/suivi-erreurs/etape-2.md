### Étape 2 – Configurer

Le navigateur :

<!-- fichier: instrumentation-client.ts -->
```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Aucune donnée personnelle envoyée d'office : ni adresse IP, ni cookie, ni en-tête.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false },
  tracesSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

Le serveur et le runtime Edge :

<!-- fichier: sentry.server.config.ts -->
```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false },
  tracesSampleRate: 0,
});
```

<!-- fichier: sentry.edge.config.ts -->
```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false },
  tracesSampleRate: 0,
});
```

`instrumentation.ts` charge ces réglages et garde le journal pino. Une panne de Sentry ou du journal est ignorée : la réponse n'est jamais cassée.

<!-- fichier: instrumentation.ts -->
```ts
import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Chaque erreur de requête va à Sentry (alerte) et au journal pino (référence digest).
// digest est la référence affichée à la personne par error.tsx : elle relie l'écran au journal.
export const onRequestError: Instrumentation.onRequestError = async (
  erreur,
  requete,
  contexte,
) => {
  try {
    Sentry.captureRequestError(erreur, requete, contexte);
  } catch {
    // Une panne de Sentry ne doit pas casser la réponse.
  }
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { journaliserErreurDeRequete } = await import(
      "@src/lib/errors/erreur-de-requete"
    );
    journaliserErreurDeRequete(erreur, requete, contexte);
  } catch {
    // Rien d'autre à faire : l'erreur d'origine suit son cours.
  }
};
```

Dans `next.config.ts`, trois changements. D'abord l'import :

<!-- remplacer-ligne: next.config.ts début: import type { NextConfig } -->
```ts
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
```

Ensuite la CSP : l'hôte d'envoi de Sentry est celui du DSN (`https://<clé>@o<id>.ingest.de.sentry.io/<projet>` pour la région UE). Ajoutez-le à `connect-src` sans toucher à la ligne existante (elle peut déjà avoir été complétée par une autre recette, comme `fichiers`) : cette ligne, juste après l'objet `sources`, convient dans les deux cas.

<!-- ajout: next.config.ts après: }; -->
```ts
// Envoi des erreurs à Sentry (recette suivi-erreurs, région UE).
sources["connect-src"]?.push("https://*.ingest.de.sentry.io");
```

Enfin, remplacez la dernière ligne (`<organisation>` et `<projet>` se lisent dans l'adresse de votre projet Sentry ; ce ne sont pas des secrets) :

<!-- remplacer-ligne: next.config.ts début: export default nextConfig; -->
```ts
export default withSentryConfig(nextConfig, {
  org: "<organisation>",
  project: "<projet>",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
```

Dans `app/global-error.tsx`, l'erreur part à Sentry. Remplacez la ligne `import "./globals.css";` par :

<!-- remplacer-ligne: app/global-error.tsx début: import "./globals.css"; -->
```tsx
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";
```

Puis, juste après la ligne `}) {` de la fonction, ajoutez :

<!-- ajout: app/global-error.tsx après: }) { -->
```tsx
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

```


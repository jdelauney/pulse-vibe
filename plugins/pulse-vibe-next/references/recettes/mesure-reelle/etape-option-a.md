### Option A – Speed Insights de Vercel

1. Dans Vercel : le projet → onglet **Speed Insights** → **Enable** (libellés à vérifier à l'écran).
2. `npm install @vercel/speed-insights`.

<!-- commande: npm install @vercel/speed-insights -->

3. Dans `app/layout.tsx`, importer le composant et le placer dans `<body>`, après `<Toaster />` :

<!-- ajout: app/layout.tsx après: import { partageCommun } from "@src/lib/seo/seo"; -->
```tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
```

<!-- remplacer-ligne: app/layout.tsx début: <Toaster /> -->
```tsx
        <Toaster />
        <SpeedInsights />
```

4. Dans `next.config.ts`, objet `sources` : en développement, le composant charge sa version de diagnostic depuis `https://va.vercel-scripts.com`. Remplacer le bloc `"script-src"` par :

<!-- remplacer: next.config.ts -->
```ts
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    // Développement : messages d'erreur de React, et script de diagnostic de Speed Insights.
    ...(enDeveloppement
      ? ["'unsafe-eval'", "https://va.vercel-scripts.com"]
      : []),
  ],
```

5. `npm run build` (le composant gère seul son `<Suspense>` : la page d'accueil reste statique), `/pulse:commit`, puis mise en ligne (`/pulse:deploy`). En ligne, le script se charge depuis le site lui-même (`/_vercel/speed-insights/script.js`) : la CSP de production reste inchangée. Rien n'est mesuré en développement.
6. Les premières données apparaissent dans l'onglet Speed Insights après quelques visites réelles.


### 16. La CSP autorise Turnstile

Le widget charge un script et s'affiche dans un cadre venant de `https://challenges.cloudflare.com`. Dans `next.config.ts`, objet `sources` :

<!-- remplacer: next.config.ts -->
```ts
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    // Recette formulaire-public, option Turnstile : script du widget.
    "https://challenges.cloudflare.com",
    ...(enDeveloppement ? ["'unsafe-eval'"] : []),
  ],
```

et, après `"connect-src"` :

<!-- ajout: next.config.ts après: "connect-src": ["'self'"], -->
```ts
  // Recette formulaire-public, option Turnstile : cadre du widget.
  "frame-src": ["https://challenges.cloudflare.com"],
```

Sans ces deux lignes, le widget reste vide et la console du navigateur affiche « Refused to load the script ».


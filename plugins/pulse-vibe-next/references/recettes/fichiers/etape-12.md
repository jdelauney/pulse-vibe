### 12. La CSP autorise R2

Le navigateur envoie le fichier directement à R2 (`fetch` avec `PUT`). La CSP bloque tout appel vers une adresse absente de `connect-src` : dans l'objet `sources` de `next.config.ts`, remplacez la ligne `"connect-src": ["'self'"],` par :

<!-- remplacer-ligne: next.config.ts début: "connect-src": -->
```ts
  // Envoi direct des fichiers vers R2 (recette fichiers) : l'adresse signée commence par le nom
  // du bucket. Sans juridiction UE, retirer « .eu ».
  "connect-src": [
    "'self'",
    ...(process.env.R2_BUCKET && process.env.R2_ACCOUNT_ID
      ? [
          `https://${process.env.R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
        ]
      : []),
  ],
```

L'adresse signée par l'adapter a la forme `https://<bucket>.<ACCOUNT_ID>.eu.r2.cloudflarestorage.com/<clé>` : la CSP autorise exactement cet hôte. Next.js lit `.env` avant `next.config.ts` : les valeurs sont connues en local. Sur Vercel, la CSP est fixée à la construction : `R2_BUCKET` et `R2_ACCOUNT_ID` doivent être saisies pour Production et Preview **avant** la mise en ligne. Le téléchargement passe par `/api/fichiers/<id>` (un lien du site) : il reste hors de `connect-src`.


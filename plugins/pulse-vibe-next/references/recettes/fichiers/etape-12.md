### 12. La CSP autorise le service S3

Stockage `dossier` : rien à faire, l'envoi vise le site lui-même (`'self'`). Stockage `s3` :

Le navigateur envoie le fichier directement au service S3 (`fetch` avec `PUT`). La CSP bloque tout appel vers une adresse absente de `connect-src` : dans l'objet `sources` de `next.config.ts`, remplacez la ligne `"connect-src": ["'self'"],` par :

<!-- remplacer-ligne: next.config.ts début: "connect-src": stockage: s3 -->
```ts
  // Envoi direct des fichiers vers le service S3 (recette fichiers) : l'adresse signée vise
  // « <bucket>.<hôte> » ou, avec S3_FORCE_PATH_STYLE=true, « <hôte>/<bucket> ».
  "connect-src": [
    "'self'",
    ...(process.env.S3_ENDPOINT && process.env.S3_BUCKET
      ? [
          new URL(process.env.S3_ENDPOINT).origin,
          `https://${process.env.S3_BUCKET}.${new URL(process.env.S3_ENDPOINT).host}`,
        ]
      : []),
  ],
```

L'adresse signée par l'adapter a la forme `https://<bucket>.<hôte de S3_ENDPOINT>/<clé>`, ou `https://<hôte>/<bucket>/<clé>` quand le service demande le nom du bucket dans le chemin : la CSP autorise ces deux hôtes, et eux seuls. Next.js lit `.env` avant `next.config.ts` : les valeurs sont connues en local. Sur Vercel, la CSP est fixée à la construction : `S3_ENDPOINT` et `S3_BUCKET` doivent être saisies pour Production et Preview **avant** la mise en ligne ; sur un serveur, présentes dans son `.env` au moment de la construction. Le téléchargement passe par `/api/fichiers/<id>` (un lien du site) : il reste hors de `connect-src`.

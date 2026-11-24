### 1. Le stockage et les variables

Stockage `dossier` : rien à créer ailleurs. Stockage `s3` : demandez ou créez chez le service S3 choisi par la personne :

1. un **bucket privé** (aucun accès public, aucun site public), dans l'Union européenne si le service le propose ; relever son nom, l'adresse du service (`https://…`, souvent appelée « endpoint ») et le code de sa région ;
2. une **clé d'accès limitée à ce bucket** : lire, écrire, supprimer et lister ses objets. Copier son identifiant et son secret dans `.env` : le secret s'affiche souvent une seule fois ;
3. une **règle CORS** sur le bucket, pour l'adresse du site (souvent saisie sous cette forme ; remplacer l'adresse en ligne par celle du projet) :

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://mon-projet.exemple"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

4. si la documentation du service demande des adresses « path-style » (le nom du bucket dans le chemin de l'adresse, et non devant l'hôte) : `S3_FORCE_PATH_STYLE=true`.

Puis remplissez `.env`, complétez `src/config/env.ts` et `.env.example`.

Ajoutez ces lignes dans `server: { … }` de `src/config/env.ts` :

<!-- ajout: src/config/env.ts après: server: { stockage: s3 -->
```ts
    S3_ENDPOINT: z.url({ protocol: /^https$/ }),
    S3_REGION: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    // "true" si le service demande le nom du bucket dans le chemin de l'adresse.
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((valeur) => valeur === "true"),
```

<!-- ajout: src/config/env.ts après: server: { stockage: dossier -->
```ts
    FICHIERS_DOSSIER: z.string().min(1),
    FICHIERS_SECRET: z.string().min(32),
```

Pour les tests qui vérifient la validation, ajouter des valeurs de test dans `VARIABLES_VALIDES` de `tests/helpers/env-de-test.ts` (aide du squelette) :

<!-- ajout: tests/helpers/env-de-test.ts après: export const VARIABLES_VALIDES: Record<string, string> = { stockage: s3 -->
```ts
  S3_ENDPOINT: "https://s3.exemple.test",
  S3_REGION: "region-de-test",
  S3_BUCKET: "bucket-de-test",
  S3_ACCESS_KEY_ID: "cle-acces",
  S3_SECRET_ACCESS_KEY: "secret-de-test",
```

<!-- ajout: tests/helpers/env-de-test.ts après: export const VARIABLES_VALIDES: Record<string, string> = { stockage: dossier -->
```ts
  FICHIERS_DOSSIER: "fichiers-de-test",
  FICHIERS_SECRET: "secret-de-test-de-trente-deux-caracteres",
```

Ajoutez les noms, **sans valeur secrète**, à `.env.example` :

<!-- ajout: .env.example stockage: s3 -->
```
# Fichiers envoyés (recette fichiers) : service compatible S3 ; adresse du service en https://, région et bucket donnés par lui
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
# true seulement si le service demande le nom du bucket dans le chemin de l'adresse
S3_FORCE_PATH_STYLE=false
```

<!-- ajout: .env.example stockage: dossier -->
```
# Fichiers envoyés (recette fichiers) : dossier hors de public/ ; docker : /app/fichiers. Secret : openssl rand -hex 32
FICHIERS_DOSSIER=fichiers
FICHIERS_SECRET=
```

Vercel : saisissez-les pour Production et Preview. Serveur : dans le `.env` du serveur. Stockage `dossier` : `FICHIERS_SECRET` tiré sur le serveur (`openssl rand -hex 32`) ; le dossier reste hors de Git :

<!-- ajout: .gitignore stockage: dossier -->
```
# fichiers envoyés par les visiteurs (recette fichiers)
/fichiers/
```

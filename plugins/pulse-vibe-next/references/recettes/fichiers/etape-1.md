### 1. Cloudflare et les variables

Faites les réglages Cloudflare (Prérequis), remplissez `.env`, complétez `src/config/env.ts` et `.env.example`.

Ajoutez ces lignes dans `server: { … }` de `src/config/env.ts` :

<!-- ajout: src/config/env.ts après: server: { hebergement: vercel -->
```ts
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
```

<!-- ajout: src/config/env.ts après: server: { hebergement: docker,serveur -->
```ts
    FICHIERS_DOSSIER: z.string().min(1),
    FICHIERS_SECRET: z.string().min(32),
```

Pour les tests qui vérifient la validation, ajouter des valeurs de test dans `VARIABLES_VALIDES` de `tests/helpers/env-de-test.ts` (aide du squelette) :

<!-- ajout: tests/helpers/env-de-test.ts après: export const VARIABLES_VALIDES: Record<string, string> = { hebergement: vercel -->
```ts
  R2_ACCOUNT_ID: "compte",
  R2_ACCESS_KEY_ID: "cle-acces",
  R2_SECRET_ACCESS_KEY: "secret-de-test",
  R2_BUCKET: "bucket-de-test",
```

<!-- ajout: tests/helpers/env-de-test.ts après: export const VARIABLES_VALIDES: Record<string, string> = { hebergement: docker,serveur -->
```ts
  FICHIERS_DOSSIER: "fichiers-de-test",
  FICHIERS_SECRET: "secret-de-test-de-trente-deux-caracteres",
```

Ajoutez les noms, **sans valeur secrète**, à `.env.example` :

<!-- ajout: .env.example hebergement: vercel -->
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

<!-- ajout: .env.example hebergement: docker,serveur -->
```
# Fichiers envoyés (recette fichiers) : dossier hors de public/ ; docker : /app/fichiers. Secret : openssl rand -hex 32
FICHIERS_DOSSIER=fichiers
FICHIERS_SECRET=
```

Vercel : saisissez-les pour Production et Preview. Serveur : dans le `.env` du serveur, `FICHIERS_SECRET` tiré sur le serveur (`openssl rand -hex 32`) ; le dossier reste hors de Git :

<!-- ajout: .gitignore hebergement: docker,serveur -->
```
# fichiers envoyés par les visiteurs (recette fichiers)
/fichiers/
```

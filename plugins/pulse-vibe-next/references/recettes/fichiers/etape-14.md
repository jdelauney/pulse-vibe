### 14. Mettre en ligne

Stockage `s3` : saisissez les variables `S3_…` chez l'hébergeur (Vercel : Production et Preview ; serveur : son `.env`), ajoutez l'adresse du site en ligne à la règle CORS du bucket, puis mettez en ligne. Docker : l'image se construit sans le `.env` ; l'adresse du service et le nom du bucket (pas des secrets) lui sont passés pour la CSP :

<!-- ajout: Dockerfile après: ARG SITE_URL hebergement: docker stockage: s3 -->
```dockerfile
# Recette fichiers : adresse du service S3 et bucket, lus par next.config.ts pour la CSP (pas des secrets).
ARG S3_ENDPOINT
ARG S3_BUCKET
```

<!-- ajout: compose.production.yml après: SITE_URL: ${SITE_URL:-} hebergement: docker stockage: s3 -->
```yaml
        S3_ENDPOINT: ${S3_ENDPOINT:-}
        S3_BUCKET: ${S3_BUCKET:-}
```

Stockage `dossier` : `FICHIERS_DOSSIER` et `FICHIERS_SECRET` dans le `.env` du serveur ; hébergement serveur, un dossier hors des versions du site (`FICHIERS_DOSSIER=<dossier du site>/fichiers`, chemin complet) ; docker, `FICHIERS_DOSSIER=/app/fichiers`, un volume que l'image prépare pour l'utilisateur du site :

<!-- ajout: Dockerfile après: RUN mkdir -p .next/cache && chown node:node .next/cache hebergement: docker stockage: dossier -->
```dockerfile
RUN mkdir -p fichiers && chown node:node fichiers
```

<!-- ajout: compose.production.yml après: env_file: .env hebergement: docker stockage: dossier -->
```yaml
    # Fichiers envoyés par les visiteurs (recette fichiers) : gardés d'une mise en ligne à l'autre.
    volumes:
      - fichiers:/app/fichiers
```

<!-- ajout: compose.production.yml hebergement: docker stockage: dossier -->
```yaml
  fichiers:
```

Les fichiers du dossier font partie des données : la copie de la base (`sauvegardes/`) ne les contient pas. Activez les sauvegardes du serveur chez l'hébergeur, ou copiez le dossier de temps en temps (docker : `docker run --rm -v <projet>_fichiers:/f -v "$PWD":/s alpine tar czf /s/fichiers.tgz -C /f .`).

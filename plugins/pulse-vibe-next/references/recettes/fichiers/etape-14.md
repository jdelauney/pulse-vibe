### 14. Mettre en ligne

Vercel : saisissez les quatre variables dans Vercel, ajoutez l'adresse du site en ligne à la règle CORS du bucket, redéployez.

Serveur : `FICHIERS_DOSSIER` et `FICHIERS_SECRET` dans le `.env` du serveur ; hébergement serveur, un dossier hors des versions du site (`FICHIERS_DOSSIER=<dossier du site>/fichiers`, chemin complet) ; docker, `FICHIERS_DOSSIER=/app/fichiers`, un volume que l'image prépare pour l'utilisateur du site :

<!-- ajout: Dockerfile après: RUN mkdir -p .next/cache && chown node:node .next/cache hebergement: docker -->
```dockerfile
RUN mkdir -p fichiers && chown node:node fichiers
```

<!-- ajout: compose.production.yml après: env_file: .env hebergement: docker -->
```yaml
    # Fichiers envoyés par les visiteurs (recette fichiers) : gardés d'une mise en ligne à l'autre.
    volumes:
      - fichiers:/app/fichiers
```

<!-- ajout: compose.production.yml hebergement: docker -->
```yaml
  fichiers:
```

Les fichiers font partie des données : la copie de la base (`sauvegardes/`) ne les contient pas. Activez les sauvegardes du serveur chez le fournisseur, ou copiez le dossier de temps en temps (docker : `docker run --rm -v <projet>_fichiers:/f -v "$PWD":/s alpine tar czf /s/fichiers.tgz -C /f .`).

# Pack Pulse Next.js – pour /pulse:secrets

L'index des variables du squelette et des recettes, une ligne chacune : de quoi remplir `docs/secrets.md`. La fiche d'une variable (chemin exact chez le fournisseur, effet, délai de grâce, préfixe attendu, test, traces) : `pulse-aidd pile secrets fiche <NOM>`, au moment où elle sert. Les libellés des tableaux de bord changent : en cas d'écart, la documentation officielle fait foi (règle 15).

## Index des variables

| NOM | rôle | fournisseur | page de renouvellement |
|---|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_DIRECT` | adresses de la base : l'application et les migrations ; même mot de passe, renouvelées ensemble ; une valeur par environnement | Neon | console Neon → la branche → Roles → Reset password |
| `POSTGRES_PASSWORD` | mot de passe de la base PostgreSQL du serveur (hébergement docker, profil `base`) ; les adresses s'en déduisent ; seulement dans le `.env` du serveur | serveur (valeur générée) | `\password app` dans la base, puis `.env` du serveur |
| `NEON_API_KEY` | sauvegarde de la base avant chaque migration de production, avec `NEON_PROJECT_ID` (pas un secret) ; `NEON_ENDPOINT_PRODUCTION` en est déduit | Neon | console Neon → Settings → API keys |
| `BETTER_AUTH_SECRET` | signe les sessions de connexion (recette `connexion`) | projet (valeur générée) | aucune : `pulse-aidd secrets generer` |
| `BETTER_AUTH_SECRETS` | forme versionnée du précédent : l'ancienne valeur reste lisible pendant la transition | projet (valeur générée) | aucune : `pulse-aidd secrets generer --versionne` |
| `BETTER_AUTH_URL` | adresse du site, pas un secret ; une valeur par environnement | projet | aucune |
| `STRIPE_SECRET_KEY` | clé de l'API de paiement (recette `paiement`) ; une valeur par environnement | Stripe | https://dashboard.stripe.com/apikeys → Roll key |
| `STRIPE_WEBHOOK_SECRET` | vérifie les événements envoyés par Stripe ; une valeur par environnement | Stripe | https://dashboard.stripe.com/webhooks → Roll secret |
| `SMTP_PASSWORD` | envoi des e-mails (recette `envoi-email`), avec `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `MAIL_FROM` (réglages) | fournisseur d'e-mail | chez le fournisseur : un nouvel identifiant d'envoi |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | accès au bucket des fichiers (recette `fichiers`, stockage `s3`), avec `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` et `S3_FORCE_PATH_STYLE` (réglages) | service de stockage S3 choisi par la personne | chez le service : une nouvelle clé limitée au bucket |
| `UPSTASH_REDIS_REST_TOKEN` | limite d'envois partagée (recette `limite`, option Redis), avec `UPSTASH_REDIS_REST_URL` (adresse) | Upstash | console Upstash → la base → Reset Credentials |
| `FORMULAIRE_SECRET` | signe le délai des formulaires publics (recette `formulaire-public`) | projet (valeur générée) | aucune : `pulse-aidd secrets generer` |
| `TURNSTILE_SECRET_KEY` | contrôle anti-robot des formulaires (recette `formulaire-public`, option Turnstile), avec `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (publique) | Cloudflare Turnstile | Cloudflare → Turnstile → le widget → Settings → Rotate Secret Key |

## Comptes du poste

Les comptes de l'hébergeur sont plus bas, avec ses variables.

- **Jeton GitHub** (`gh`, CI) : https://github.com/settings/tokens → créer le nouveau, mettre à jour la CI, supprimer l'ancien ; `gh auth refresh` pour le jeton de `gh`. Test : `gh auth status`. Un jeton poussé dans un dépôt public est révoqué automatiquement par GitHub.

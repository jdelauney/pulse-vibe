# Pack Pulse Next.js – pour /pulse:secrets

L'index des variables du squelette et des recettes, une ligne chacune : de quoi remplir `docs/secrets.md`. La fiche d'une variable (chemin exact chez le fournisseur, effet, délai de grâce, préfixe attendu, test, traces) : `pulse-aidd pile secrets fiche <NOM>`, au moment où elle sert. Les libellés des tableaux de bord changent : en cas d'écart, la documentation officielle fait foi (règle 15).

## Index des variables

| NOM | rôle | fournisseur | page de renouvellement |
|---|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_DIRECT` | adresses de la base : l'application et les migrations ; même mot de passe, renouvelées ensemble ; une valeur par environnement | Neon | console Neon → la branche → Roles → Reset password |
| `NEON_API_KEY` | sauvegarde de la base avant chaque migration de production, avec `NEON_PROJECT_ID` (pas un secret) ; `NEON_ENDPOINT_PRODUCTION` en est déduit | Neon | console Neon → Settings → API keys |
| `BETTER_AUTH_SECRET` | signe les sessions de connexion (recette `connexion`) | projet (valeur générée) | aucune : `pulse-aidd secrets generer` |
| `BETTER_AUTH_SECRETS` | forme versionnée du précédent : l'ancienne valeur reste lisible pendant la transition | projet (valeur générée) | aucune : `pulse-aidd secrets generer --versionne` |
| `BETTER_AUTH_URL` | adresse du site, pas un secret ; une valeur par environnement | projet | aucune |
| `STRIPE_SECRET_KEY` | clé de l'API de paiement (recette `paiement`) ; une valeur par environnement | Stripe | https://dashboard.stripe.com/apikeys → Roll key |
| `STRIPE_WEBHOOK_SECRET` | vérifie les événements envoyés par Stripe ; une valeur par environnement | Stripe | https://dashboard.stripe.com/webhooks → Roll secret |
| `SMTP_PASSWORD` | envoi des e-mails (recette `email`), avec `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `MAIL_FROM` (réglages) | fournisseur d'e-mail | chez le fournisseur : un nouvel identifiant d'envoi |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | accès au stockage des fichiers (recette `fichiers`), avec `R2_ACCOUNT_ID` et `R2_BUCKET` (réglages) | Cloudflare R2 | Cloudflare → R2 object storage → Manage API tokens |
| `UPSTASH_REDIS_REST_TOKEN` | limite d'envois partagée (recette `limite`, option Redis), avec `UPSTASH_REDIS_REST_URL` (adresse) | Upstash | console Upstash → la base → Reset Credentials |
| `FORMULAIRE_SECRET` | signe le délai des formulaires publics (recette `formulaire-public`) | projet (valeur générée) | aucune : `pulse-aidd secrets generer` |
| `TURNSTILE_SECRET_KEY` | contrôle anti-robot des formulaires (recette `formulaire-public`, option Turnstile), avec `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (publique) | Cloudflare Turnstile | Cloudflare → Turnstile → le widget → Settings → Rotate Secret Key |

## Comptes de l'hébergeur et du poste

- **Traces chez Vercel** : Vercel → Team → Activity (variables modifiées, déploiements) ; les traces de chaque fournisseur sont dans sa fiche.
- **Jeton d'accès Vercel** (CLI, CI) : Account Settings → Tokens ; créer le nouveau, mettre à jour la CI, supprimer l'ancien. Les jetons récents commencent par `vcp_` (personnel) ou `vck_` (clé d'API). Test : `vercel whoami`. Source : https://vercel.com/changelog/new-token-formats-and-secret-scanning (2026-02-09).
- **Jeton GitHub** (`gh`, CI) : https://github.com/settings/tokens → créer le nouveau, mettre à jour la CI, supprimer l'ancien ; `gh auth refresh` pour le jeton de `gh`. Test : `gh auth status`. Un jeton poussé dans un dépôt public est révoqué automatiquement par GitHub.

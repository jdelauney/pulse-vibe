### 17. Essayer Turnstile

Cloudflare fournit des clés de test (https://developers.cloudflare.com/turnstile/troubleshooting/testing/). Dans `.env` : la clé de site de test « toujours accepté » et la clé secrète de test « toujours accepté » ; ouvrir `/contact` : le widget s'affiche, le bouton s'active, l'envoi réussit. Avec la clé secrète de test « toujours refusé », l'envoi affiche « La vérification anti-robot a échoué. Réessayez dans un instant. ». Remettre ensuite les vraies clés.

En ligne : saisir `NEXT_PUBLIC_TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` dans Vercel (Production et Preview), puis redéployer (la clé de site est lue à la construction).


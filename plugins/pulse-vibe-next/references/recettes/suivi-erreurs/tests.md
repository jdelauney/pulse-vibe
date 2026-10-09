
- `npm run build` passe avec et sans `SENTRY_AUTH_TOKEN` (sans lui, les source maps ne sont pas envoyées : la construction continue), et sans DSN.
- `npm run test:e2e` : `e2e/securite.spec.ts` ne relève aucune violation de CSP sur l'accueil.
- Les deux scénarios `@manuel` ci-dessus, en prévisualisation.


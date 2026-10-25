# Pack Pulse Next.js – pour les contrôles automatiques

**CI (GitHub Actions)**, pour `/pulse:cicd`, dans cet ordre : Node.js LTS récent, `npm ci`, `node scripts/verifier.js`, `npm audit --omit=dev --audit-level=high`, `npm run check`, `npm run typecheck`, `npm test`, `npm run build` avec `SKIP_ENV_VALIDATION=1` (la CI n'a pas les secrets ; t3 env saute alors la validation). Bout en bout en CI : `npx playwright install --with-deps chromium`, puis `npm run test:e2e` (avec `CI=true` et `SKIP_ENV_VALIDATION=1`).

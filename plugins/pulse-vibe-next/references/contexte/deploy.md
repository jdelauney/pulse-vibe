# Pack Pulse Next.js – pour mettre en ligne

**Vercel** (hébergeur) et **GitHub** (dépôt) :

- Première mise en ligne : sur vercel.com, « Add New… → Project », importer le dépôt GitHub ; Vercel reconnaît Next.js (commande de construction inchangée : `npm run build`). La région des fonctions vient de `vercel.json` (`fra1`, proche de Neon).
- **Variables d'environnement** (Project → Settings → Environment Variables), saisies par la personne, pour Production et Preview : celles de `.env.example` (`DATABASE_URL` en adresse « pooled » ; celles des recettes). Après un ajout : redéployer (Deployments → … → Redeploy).
- **Migrations** : avant de mettre en ligne une version qui change le schéma, appliquer `npm run db:migrate` sur la base de production (adresse directe dans `DATABASE_URL_DIRECT`), avec l'accord de la personne. Pour des prévisualisations sans risque : une branche Neon « preview » et ses adresses dans les variables Preview.
- **better-auth** (recette connexion) : `BETTER_AUTH_URL` = l'adresse du site en production ; ajouter l'adresse de prévisualisation aux origines de confiance si besoin.
- Preuve : `pulse-aidd sonder <adresse> --texte "<nom du projet>"`.

**CI (GitHub Actions)**, pour `/pulse:cicd` : Node.js LTS récent, `npm ci`, `node scripts/verifier.js`, `npm run check`, `npm run typecheck`, `npm test`, `npm run build`. Bout en bout en CI : `npx playwright install --with-deps chromium`, puis `npm run test:e2e` (avec `CI=true`).

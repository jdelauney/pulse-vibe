# Pack Pulse Next.js – pour mettre en ligne

**Vercel** (hébergeur) et **GitHub** (dépôt) :

- Première mise en ligne : sur vercel.com, « Add New… → Project », importer le dépôt GitHub ; Vercel reconnaît Next.js (commande de construction inchangée : `npm run build`). La région des fonctions vient de `vercel.json` (`fra1`, proche de Neon).
- **Variables d'environnement**, pour Production et Preview : celles de `.env.example` (`DATABASE_URL` en adresse « pooled » ; celles des recettes). Avec le Vercel CLI relié (`vercel login`, puis `vercel link`) : `pulse-aidd secrets envoyer <NOM> --env production,preview` (valeur par l'entrée standard, type Secret), une valeur par environnement pour les secrets générés (`pulse-aidd secrets generer <NOM> --envoyer production,preview`), puis `pulse-aidd secrets redeployer`. Sans CLI : la personne les saisit dans Project → Settings → Environment Variables, en type Secret, puis Deployments → … → Redeploy.
- **Migrations** : avant de mettre en ligne une version qui change le schéma, appliquer `npm run db:migrate` sur la base de production (adresse directe dans `DATABASE_URL_DIRECT`), avec l'accord de la personne. Pour des prévisualisations sans risque : une branche Neon « preview » et ses adresses dans les variables Preview.
- **better-auth** (recette connexion) : `BETTER_AUTH_URL` = l'adresse du site en production ; ajouter l'adresse de prévisualisation aux origines de confiance si besoin.
- **Adresse du site** : quand le domaine est définitif, la personne saisit `SITE_URL` (ex. `https://www.mon-site.fr`) dans les variables de Production, puis redéploie ; sans elle, le site déclare le domaine de production fourni par Vercel.
- Preuve : `pulse-aidd sonder <adresse> --texte "<nom du projet>"`, puis `pulse-aidd seo <adresse> --essentiel`.
- IndexNow (facultatif, si `public/<clé>.txt` existe) : envoi après les preuves, d'après « IndexNow » des consignes Search Console du pack (`pulse-aidd pile reference contexte/search-console.md`).

**CI (GitHub Actions)**, pour `/pulse:cicd` : Node.js LTS récent, `npm ci`, `node scripts/verifier.js`, `npm run check`, `npm run typecheck`, `npm test`, `npm run build` avec `SKIP_ENV_VALIDATION=1` (la CI n'a pas les secrets ; t3 env saute alors la validation). Bout en bout en CI : `npx playwright install --with-deps chromium`, puis `npm run test:e2e` (avec `CI=true` et `SKIP_ENV_VALIDATION=1`).

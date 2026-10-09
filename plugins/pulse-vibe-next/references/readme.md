# Pack Pulse Next.js – « Tester en local » du README du projet

`/pulse:tech` remplace le contenu de la section « Tester en local » de `README.md` par le bloc de base ; une recette qui demande un outil sur le poste y ajoute sa ligne, au moment où elle est réalisée. Le reste du README reste tel quel.

## Bloc de base

```markdown
1. Installer Node.js 22.19 ou plus (https://nodejs.org), puis, dans ce dossier : `npm install`, et une seule fois `npx playwright install chromium` (le navigateur des tests de bout en bout).
2. Copier `.env.example` en `.env`, puis y coller les deux adresses de la branche `dev` de Neon (« Mise en place » de `docs/technical.md`).
3. `npm run dev`, puis ouvrir http://localhost:3000.
4. Vérifier : `npm run check`, `npm run typecheck`, `npm test`, puis `npm run test:e2e`.
5. Facultatif, pour envoyer les variables à Vercel depuis ce poste : `npm install -g vercel`, `vercel login`, puis `vercel link` dans ce dossier.
```

## Lignes ajoutées par les recettes

Recette `email` :

```markdown
- E-mails : lancer `mailpit` dans un second terminal ; les e-mails envoyés s'affichent sur http://localhost:8025 (installation : recette email).
```

Recette `paiement` :

```markdown
- Paiements : dans un second terminal, `stripe listen --forward-to localhost:3000/api/stripe/webhook --events checkout.session.completed,checkout.session.async_payment_succeeded`, puis copier le secret `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET` de `.env` et relancer `npm run dev`. Carte de test : 4242 4242 4242 4242.
```

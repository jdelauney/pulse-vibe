### 11. Recevoir les webhooks en local

Dans un second terminal, pendant `npm run dev` :

```
stripe listen --forward-to localhost:3000/api/stripe/webhook --events checkout.session.completed,checkout.session.async_payment_succeeded
```

Le CLI affiche `Ready! Your webhook signing secret is 'whsec_…'`. La personne copie elle-même ce secret dans `STRIPE_WEBHOOK_SECRET` de `.env`, puis relance `npm run dev`.


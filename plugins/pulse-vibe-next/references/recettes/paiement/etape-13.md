### 13. Mettre en ligne (toujours en mode test)

Dans le tableau de bord Stripe, mode test, créez une destination de webhook vers `https://<adresse du site>/api/stripe/webhook`, avec les événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`. Saisissez dans Vercel `STRIPE_SECRET_KEY` et le secret `whsec_…` **de cette destination**, puis redéployez.


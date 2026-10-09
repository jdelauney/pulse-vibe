### 10. Le renvoi vers la connexion

Dans `proxy.ts` (racine du projet), ajoutez la page au `matcher` (ici à la suite de `/compte`, recette `connexion`) :

Conservez les pages déjà listées par d'autres recettes (par exemple `/factures/:path*` de `liste`) en ajoutant celle-ci.

<!-- remplacer-ligne: proxy.ts début: matcher: -->
```ts
  matcher: ["/compte/:path*", "/paiement/:path*"],
```

`/api/stripe/webhook` reste hors du `matcher` : Stripe n'a pas de cookie de session. Avec la recette `langues` : voir `connexion`, étape 12.


### 11. Le renvoi vers la connexion

Dans `proxy.ts` (racine du projet), ajoutez la page au `matcher` :

Conservez les pages déjà listées par d'autres recettes (par exemple `/factures/:path*` de `liste`) en ajoutant celle-ci.

<!-- remplacer-ligne: proxy.ts début: matcher: -->
```ts
  matcher: ["/compte/:path*", "/fichiers/:path*"],
```

Avec la recette `langues` : voir `connexion`, étape 12.

La page reste protégée par `utilisateurConnecte()`, et le téléchargement par le Route Handler.


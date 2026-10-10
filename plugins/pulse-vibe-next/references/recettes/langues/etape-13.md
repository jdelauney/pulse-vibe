### 13. Playwright en français

Dans `playwright.config.ts`, bloc `use` :

<!-- ajout: playwright.config.ts après: trace: "on-first-retry", -->
```ts
    // Recette langues : navigateur de test en français (sinon next-intl redirige vers /en).
    locale: "fr-FR",
```


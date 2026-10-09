### 4. L'extension next-intl

Dans `next.config.ts`, ajouter l'import en tête, puis remplacer la dernière ligne. Le chemin donné à `createNextIntlPlugin` est celui de `request.ts` (next-intl le cherche d'office dans `src/i18n/`, qui n'existe pas dans ce pack).

```ts
import createNextIntlPlugin from "next-intl/plugin";
```

```ts
// Recette langues : next-intl lit ses réglages de requête dans src/lib/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

export default withNextIntl(nextConfig);
```


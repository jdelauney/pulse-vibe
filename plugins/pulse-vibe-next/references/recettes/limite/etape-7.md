### 7. Protéger la connexion, l'inscription et le mot de passe oublié

Les formulaires du compte passent par des actions : la limite se place **dans l'action**, en première ligne (la limite intégrée de better-auth ne s'applique pas aux appels `auth.api` des actions). Dans chaque action concernée de `src/features/compte/actions/`, ajouter l'import puis une ligne en tête de l'action. Pour l'inscription (`inscrire.action.ts`) :

<!-- ajout: src/features/compte/actions/inscrire.action.ts après: import { getAuth } from "@src/adapters/auth/auth.adapter"; -->
```ts
import { exigerLimite } from "@src/lib/limite";
```

<!-- ajout: src/features/compte/actions/inscrire.action.ts après: .action(async ({ parsedInput }) => { -->
```ts
    await exigerLimite("inscription");
```

Pour la connexion (`connecter.action.ts`) :

<!-- ajout: src/features/compte/actions/connecter.action.ts après: import { getAuth } from "@src/adapters/auth/auth.adapter"; -->
```ts
import { exigerLimite } from "@src/lib/limite";
```

<!-- ajout: src/features/compte/actions/connecter.action.ts après: .action(async ({ parsedInput }) => { -->
```ts
    await exigerLimite("connexion");
```

La ligne `await exigerLimite(…)` est la première de l'action, avant toute lecture.

Avec la recette `email` : `await exigerLimite("motDePasseOublie");` en tête de `demanderNouveauMotDePasse` (`demander-nouveau-mot-de-passe.action.ts`).

Le message de refus arrive dans `result.serverError` : les containers de la recette `connexion` le transmettent déjà aux formulaires, qui l'affichent.


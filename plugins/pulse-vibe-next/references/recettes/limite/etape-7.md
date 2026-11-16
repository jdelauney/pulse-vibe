### 7. Protéger les actions du compte

Les formulaires du compte passent par des actions : la limite se place **dans l'action**, en première ligne (la limite intégrée de better-auth ne s'applique pas aux appels `auth.api` des actions). Dans chaque action concernée de `src/features/compte/actions/`, ajouter l'import puis une ligne en tête de l'action. Pour l'inscription (`inscrire.action.ts`) :

<!-- ajout: src/features/compte/actions/inscrire.action.ts après: import { MOT_DE_PASSE_COMPROMIS } from "@src/adapters/auth/mot-de-passe-compromis"; -->
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

<!-- ajout: src/features/compte/actions/connecter.action.ts après: .action(async ({ parsedInput, ctx }) => { -->
```ts
    await exigerLimite("connexion");
```

Pour le changement de mot de passe (`changer-mot-de-passe.action.ts`), la limite compte par personne : la session donne l'identifiant.

<!-- ajout: src/features/compte/actions/changer-mot-de-passe.action.ts après: import { MOT_DE_PASSE_COMPROMIS } from "@src/adapters/auth/mot-de-passe-compromis"; -->
```ts
import { exigerLimite } from "@src/lib/limite";
```

<!-- remplacer-ligne: src/features/compte/actions/changer-mot-de-passe.action.ts début: .action(async ({ parsedInput }) => { -->
```ts
  .action(async ({ parsedInput, ctx }) => {
    await exigerLimite("changementMotDePasse", ctx.utilisateur.id);
```

La ligne `await exigerLimite(…)` est la première de l'action, avant toute lecture.

Avec la recette `email`, en tête de chaque action (import `exigerLimite` de `@src/lib/limite`) :

| Action | Ligne |
|---|---|
| `demanderNouveauMotDePasse` | `await exigerLimite("motDePasseOublie");` |
| `choisirNouveauMotDePasse` | `await exigerLimite("nouveauMotDePasse");` |
| `changerAdresseEmail` | `await exigerLimite("changementAdresse", ctx.utilisateur.id);` |
| `demanderSuppressionCompte` | `await exigerLimite("suppressionCompte", ctx.utilisateur.id);` |

Avec la recette `double-authentification` : `await exigerLimite("codeDeConnexion");` dans `verifierCode`, `await exigerLimite("renvoiDuCode");` dans `renvoyerCode`, et `await exigerLimite("reglageDoubleAuthentification", ctx.utilisateur.id);` dans `activerDoubleAuthentification` et `desactiverDoubleAuthentification`.

Une action qui reçoit `ctx` le déclare dans ses paramètres : `.action(async ({ parsedInput, ctx }) => {`.

Le message de refus arrive dans `result.serverError` : les containers le transmettent déjà aux formulaires, qui l'affichent. Chaque refus est journalisé (règle et empreinte courte de l'identifiant).

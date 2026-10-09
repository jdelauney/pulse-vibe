### 7. Protéger la connexion, l'inscription et le mot de passe oublié

Les formulaires du compte passent par des actions : la limite se place **dans l'action**, en première ligne (la limite intégrée de better-auth ne s'applique pas aux appels `auth.api` des actions). Dans chaque action concernée de `src/features/compte/actions/`, ajouter l'import puis une ligne en tête :

```ts
import { exigerLimite } from "@src/lib/limite";
```

```ts
// src/features/compte/actions/inscrire.action.ts
export const inscrire = actionPublique
  .metadata({ nom: "inscrire" })
  .inputSchema(schemaInscription)
  .action(async ({ parsedInput }) => {
    await exigerLimite("inscription");
    // … suite inchangée
```

```ts
// src/features/compte/actions/connecter.action.ts
export const connecter = actionPublique
  .metadata({ nom: "connecter" })
  .inputSchema(schemaConnexion)
  .action(async ({ parsedInput }) => {
    await exigerLimite("connexion");
    // … suite inchangée
```

Avec la recette `email` : `await exigerLimite("motDePasseOublie");` en tête de `demanderNouveauMotDePasse` (`demander-nouveau-mot-de-passe.action.ts`).

Le message de refus arrive dans `result.serverError` : les containers de la recette `connexion` le transmettent déjà aux formulaires, qui l'affichent.


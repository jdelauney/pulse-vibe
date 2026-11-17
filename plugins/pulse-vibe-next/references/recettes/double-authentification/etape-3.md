### 3. L'e-mail du code

Dans la classe `EmailsCompte` (`src/core/compte/emails-compte.rules.ts`, recette `email`), un contenu de plus. Le code figure dans le corps seulement : l'objet d'un e-mail s'affiche sur l'écran verrouillé d'un téléphone et dans les aperçus.

<!-- ajout: src/core/compte/emails-compte.rules.ts après: export class EmailsCompte { -->
```ts
  codeDeConnexion({ nom, code }: { nom: string; code: string }): ContenuEmail {
    return this.composer("Votre code de connexion", [
      `Bonjour ${nom},`,
      `Votre code de connexion : ${code}`,
      "Il reste valable 5 minutes. Saisissez-le sur la page de connexion.",
      "Si vous n'essayez pas de vous connecter, quelqu'un connaît votre mot de passe : changez-le tout de suite.",
    ]);
  }

```

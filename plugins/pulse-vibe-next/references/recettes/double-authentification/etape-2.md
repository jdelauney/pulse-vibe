### 2. better-auth

Dans `src/adapters/auth/auth.adapter.ts` (version de la recette `email`), six retouches. L'import du plugin, après celui de `nextCookies` :

<!-- ajout: src/adapters/auth/auth.adapter.ts après: import { nextCookies } from "better-auth/next-js"; -->
```ts
// Renommé : `twoFactor` désigne déjà la table importée de auth.table.ts.
import { twoFactor as doubleAuthentification } from "better-auth/plugins/two-factor";
```

La table du plugin, dans l'import des tables (ordre alphabétique) puis dans l'objet `schema` :

<!-- ajout: src/adapters/auth/auth.adapter.ts après: session, -->
```ts
  twoFactor,
```

<!-- remplacer-ligne: src/adapters/auth/auth.adapter.ts début: schema: { user, session, account, verification }, -->
```ts
      schema: { user, session, account, verification, twoFactor },
```

Les chemins HTTP du plugin, fermés comme les autres : le code passe par les actions validées.

<!-- ajout: src/adapters/auth/auth.adapter.ts après: "/verify-password", -->
```ts
  // Recette double-authentification : les chemins du plugin twoFactor.
  "/two-factor/disable",
  "/two-factor/enable",
  "/two-factor/generate-backup-codes",
  "/two-factor/get-totp-uri",
  "/two-factor/send-otp",
  "/two-factor/verify-backup-code",
  "/two-factor/verify-otp",
  "/two-factor/verify-totp",
```

Le plugin, avant `nextCookies()` (qui reste le dernier) : le commentaire puis la ligne `plugins`.

<!-- remplacer-ligne: src/adapters/auth/auth.adapter.ts début: // En dernier : écrit les cookies de session quand une Server Action appelle getAuth().api. -->
```ts
    // doubleAuthentification (plugin twoFactor) : un code à 6 chiffres envoyé par e-mail à chaque connexion.
    // nextCookies() en dernier : il écrit les cookies de session quand une Server Action appelle getAuth().api.
```

<!-- remplacer-ligne: src/adapters/auth/auth.adapter.ts début: plugins: [nextCookies()], -->
```ts
    plugins: [
      doubleAuthentification({
        // Pas d'application d'authentification : le code arrive par e-mail.
        totpOptions: { disable: true },
        otpOptions: {
          digits: 6,
          // Durée de vie du code, en minutes.
          period: 5,
          // Essais par code ; au-delà, il faut en demander un nouveau.
          allowedAttempts: 5,
          // Le code est gardé haché dans la base, jamais en clair.
          storeOTP: "hashed",
          sendOTP: async ({ user, otp }) => {
            await options.envoyeur.envoyer({
              a: user.email,
              ...emails.codeDeConnexion({ nom: user.name, code: otp }),
            });
          },
        },
        // Temps laissé pour saisir le code après le mot de passe, en secondes.
        twoFactorCookieMaxAge: 10 * 60,
      }),
      nextCookies(),
    ],
```

Ce que font ces options (code de better-auth 1.7.25, `dist/plugins/two-factor/`) :

- Connexion d'une personne qui a activé la double authentification : better-auth vérifie le mot de passe, n'ouvre pas de session, pose un cookie `two_factor` (10 minutes) et répond `twoFactorRedirect: true`. La session s'ouvre seulement avec le bon code (`verifyTwoFactorOTP`).
- `sendOTP` part par `advanced.backgroundTasks` (après la réponse, comme les autres e-mails) ; un échec d'envoi est journalisé par better-auth.
- `allowedAttempts` : après 5 essais faux, le code ne vaut plus rien, même juste (`TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`) ; « Renvoyer le code » en donne un nouveau.
- Activation (`method: "otp"`) et désactivation demandent le mot de passe ; elles remplacent la session en cours.

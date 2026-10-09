### 4. better-auth

Remplacez `src/adapters/auth/auth.adapter.ts` par la version ci-dessous. `creerAuth` reçoit maintenant l'envoi dans ses options (`envoyerEmail`) : l'adapter d'authentification ne connaît pas Nodemailer, et `getAuth()` lui passe l'adapter `email`.

<!-- fichier: src/adapters/auth/auth.adapter.ts -->
```ts
// src/adapters/auth/auth.adapter.ts
import "server-only";
import { envoyerEmail } from "@src/adapters/email/email.adapter";
import { env } from "@src/config/env";
import type { EnvoyeurEmail } from "@src/core/compte/email.port";
import {
  emailCompteExistant,
  emailMotDePasseOublie,
  emailVerificationAdresse,
} from "@src/core/compte/emails-compte.rules";
import {
  account,
  session,
  user,
  verification,
} from "@src/db/compte/auth.table";
import { type Db, getDb } from "@src/db/db-client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { cookies, headers } from "next/headers";
import { after } from "next/server";

type OptionsAuth = {
  secret: string;
  baseURL: string;
  /** Application : l'adapter `email`. Tests : une doublure qui garde les messages. */
  envoyerEmail: EnvoyeurEmail;
  /** Application : l'e-mail part après la réponse. Tests : absent, l'envoi est attendu. */
  tacheDeFond?: (promesse: Promise<unknown>) => void;
};

/** Crée better-auth sur une base donnée : Neon dans l'application, PGlite dans les tests. */
export function creerAuth(db: Db, options: OptionsAuth) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      // Pas de session tant que l'adresse n'est pas confirmée (erreur EMAIL_NOT_VERIFIED).
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await options.envoyerEmail({
          a: user.email,
          ...emailMotDePasseOublie({ nom: user.name, url }),
        });
      },
      // Inscription avec une adresse déjà prise : même réponse à l'écran, e-mail à sa propriétaire.
      onExistingUserSignUp: async ({ user }) => {
        await options.envoyerEmail({
          a: user.email,
          ...emailCompteExistant({ nom: user.name }),
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await options.envoyerEmail({
          a: user.email,
          ...emailVerificationAdresse({ nom: user.name, url }),
        });
      },
    },
    // Ces écritures passent seulement par les actions validées de src/features/compte/actions/.
    // Restent ouverts : /verify-email et /reset-password/<jeton>, les liens reçus par e-mail.
    disabledPaths: [
      "/sign-up/email",
      "/sign-in/email",
      "/change-password",
      "/request-password-reset",
      "/reset-password",
      "/send-verification-email",
    ],
    advanced: options.tacheDeFond
      ? { backgroundTasks: { handler: options.tacheDeFond } }
      : undefined,
    // En dernier : écrit les cookies de session quand une Server Action appelle getAuth().api.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof creerAuth>;
export type Session = Auth["$Infer"]["Session"];

let instance: Auth | undefined;

/** L'instance de l'application, créée une seule fois, à la première demande. */
export function getAuth(): Auth {
  if (!instance) {
    instance = creerAuth(getDb(), {
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      envoyerEmail,
      // L'e-mail part après la réponse : la durée de réponse ne révèle pas si un compte existe.
      tacheDeFond: (promesse) => after(promesse),
    });
  }
  return instance;
}

/**
 * En-têtes de la requête, avec les cookies à jour.
 * Après une action qui change la session, Next.js réaffiche la page dans la même réponse :
 * headers() garde l'ancien cookie, cookies() donne le nouveau.
 * La requête est lue avant getAuth() : la page est rendue à la demande, jamais pré-rendue avec une session.
 */
export async function enTetesDeSession(): Promise<Headers> {
  const enTetes = new Headers(await headers());
  enTetes.set("cookie", (await cookies()).toString());
  return enTetes;
}
```

Ce que changent ces options (noms vérifiés dans better-auth 1.7.7) :

- `requireEmailVerification: true` : pas de session tant que l'adresse n'est pas confirmée ; la connexion lève l'erreur `EMAIL_NOT_VERIFIED`. Une inscription avec une adresse déjà prise reçoit la même réponse qu'une nouvelle (pas d'erreur « compte existant »), et `onExistingUserSignUp` prévient la propriétaire par e-mail.
- `sendOnSignUp` : e-mail de confirmation à l'inscription. `sendOnSignIn` : nouvel e-mail si la personne se connecte sans avoir confirmé. `autoSignInAfterVerification` : le lien ouvre la session.
- `expiresIn` (24 heures) et `resetPasswordTokenExpiresIn` (1 heure) : durée des liens, en secondes.
- `revokeSessionsOnPasswordReset` : un nouveau mot de passe ferme les sessions ouvertes ailleurs.
- `disabledPaths` : les demandes de lien et le choix du mot de passe passent par les actions validées ; les deux liens reçus par e-mail (`/verify-email`, `/reset-password/<jeton>`) restent ouverts.
- `tacheDeFond` : dans l'application, better-auth confie l'envoi à `after()` de Next.js ; la réponse part sans attendre le serveur SMTP, et sa durée ne révèle pas si un compte existe. Dans les tests, l'option est absente : l'envoi est attendu.


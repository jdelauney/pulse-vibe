### 4. better-auth

Remplacez `src/adapters/auth/auth.adapter.ts` par la version ci-dessous. `creerAuth` reçoit maintenant l'envoi dans ses options (`envoyeur`, un `EnvoyeurEmail`) : l'adapter d'authentification ne connaît pas Nodemailer, et `getAuth()` lui passe `getEnvoyeurEmail()` (recette `envoi-email`). La configuration de better-auth reste celle de la bibliothèque : seul l'expéditeur d'e-mails est une classe.

<!-- fichier: src/adapters/auth/auth.adapter.ts -->
```ts
// src/adapters/auth/auth.adapter.ts
import "server-only";
import { getEnvoyeurEmail } from "@src/adapters/email/email.adapter";
import { HibpMotDePasseAdapter } from "@src/adapters/hibp/hibp.adapter";
import { env } from "@src/config/env";
import { EmailsCompte } from "@src/core/compte/emails-compte.rules";
import type { DetecteurMotsDePasseCompromis } from "@src/core/compte/mot-de-passe-compromis.port";
import type { EnvoyeurEmail } from "@src/core/email/email.port";
import {
  account,
  session,
  user,
  verification,
} from "@src/db/compte/auth.table";
import { type Db, getDb } from "@src/db/db-client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { refuserMotDePasseCompromis } from "./mot-de-passe-compromis";

type OptionsAuth = {
  secret: string;
  baseURL: string;
  /** Application : `HibpMotDePasseAdapter`. Tests : une doublure, sans appel réseau. */
  motsDePasse: DetecteurMotsDePasseCompromis;
  /** Application : `getEnvoyeurEmail()`. Tests : une doublure qui garde les messages. */
  envoyeur: EnvoyeurEmail;
  /** Application : l'e-mail part après la réponse. Tests : absent, l'envoi est attendu. */
  tacheDeFond?: (promesse: Promise<unknown>) => void;
};

/**
 * Chemins HTTP de better-auth fermés (réponse 404) : toutes ses écritures. Le site écrit seulement par
 * les actions validées de src/features/compte/actions/, qui appellent getAuth().api.
 * Restent ouverts : /get-session (lecture de la session par auth-client.ts), /ok, /error, et les deux
 * liens reçus par e-mail : /verify-email et /reset-password/<jeton>.
 */
const CHEMINS_FERMES = [
  "/account-info",
  "/change-email",
  "/change-password",
  "/delete-user",
  "/delete-user/callback",
  "/get-access-token",
  "/link-social",
  "/list-accounts",
  "/list-sessions",
  "/refresh-token",
  "/request-password-reset",
  "/reset-password",
  "/revoke-other-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/send-verification-email",
  "/sign-in/email",
  "/sign-in/social",
  "/sign-out",
  "/sign-up/email",
  "/unlink-account",
  "/update-session",
  "/update-user",
  "/verify-password",
];

/** Crée better-auth sur une base donnée : Neon dans l'application, PGlite dans les tests. */
export function creerAuth(db: Db, options: OptionsAuth) {
  const emails = new EmailsCompte();
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
        await options.envoyeur.envoyer({
          a: user.email,
          ...emails.motDePasseOublie({ nom: user.name, url }),
        });
      },
      // Inscription avec une adresse déjà prise : même réponse à l'écran, e-mail à sa propriétaire.
      onExistingUserSignUp: async ({ user }) => {
        await options.envoyeur.envoyer({
          a: user.email,
          ...emails.compteExistant({ nom: user.name }),
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      // Le lien confirme l'adresse sans ouvrir de session : la personne se connecte ensuite.
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      // Sert aussi au changement d'adresse : le lien part vers la nouvelle adresse.
      sendVerificationEmail: async ({ user, url }) => {
        await options.envoyeur.envoyer({
          a: user.email,
          ...emails.verificationAdresse({ nom: user.name, url }),
        });
      },
    },
    user: {
      // Nouvelle adresse confirmée par le lien qu'elle reçoit ; adresse déjà prise : même réponse, aucun e-mail.
      changeEmail: { enabled: true },
      deleteUser: {
        enabled: true,
        deleteTokenExpiresIn: 60 * 60,
        // Le lien mène à la page de confirmation du site, qui appelle l'action confirmerSuppressionCompte.
        sendDeleteAccountVerification: async ({ user, token }) => {
          const url = `${options.baseURL}/compte/supprimer?token=${encodeURIComponent(token)}`;
          await options.envoyeur.envoyer({
            a: user.email,
            ...emails.confirmationSuppression({ nom: user.name, url }),
          });
        },
      },
    },
    hooks: {
      // Inscription, changement, nouveau mot de passe : un mot de passe déjà paru dans une fuite est refusé.
      before: createAuthMiddleware(async (ctx) => {
        await refuserMotDePasseCompromis(ctx, options.motsDePasse);
      }),
      // Changement d'adresse demandé : l'ancienne adresse est prévenue, que la nouvelle soit libre ou déjà prise.
      after: createAuthMiddleware(async (ctx) => {
        const personne = ctx.context.session?.user;
        if (
          ctx.path !== "/change-email" ||
          !personne ||
          isAPIError(ctx.context.returned)
        ) {
          return;
        }
        await ctx.context.runInBackgroundOrAwait(
          options.envoyeur.envoyer({
            a: personne.email,
            ...emails.alerteChangementAdresse({ nom: personne.name }),
          }),
        );
      }),
    },
    disabledPaths: CHEMINS_FERMES,
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
      motsDePasse: new HibpMotDePasseAdapter(),
      envoyeur: getEnvoyeurEmail(),
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

Ce que changent ces options (noms vérifiés dans le code de better-auth 1.7.25) :

- `requireEmailVerification: true` : pas de session tant que l'adresse n'est pas confirmée ; la connexion lève l'erreur `EMAIL_NOT_VERIFIED`. Une inscription avec une adresse déjà prise reçoit la même réponse qu'une nouvelle (pas d'erreur « compte existant »), et `onExistingUserSignUp` prévient la propriétaire par e-mail.
- `sendOnSignUp` : e-mail de confirmation à l'inscription. `sendOnSignIn` : nouvel e-mail si la personne se connecte sans avoir confirmé. `autoSignInAfterVerification: false` : le lien confirme l'adresse sans ouvrir de session ; better-auth renvoie vers `/adresse-verifiee`, où la personne se connecte. Un lien volé ne donne donc pas accès au compte.
- `expiresIn` et `resetPasswordTokenExpiresIn` (1 heure chacun) : durée des liens, en secondes.
- `revokeSessionsOnPasswordReset` : un nouveau mot de passe ferme les sessions ouvertes ailleurs.
- `user.changeEmail` : la nouvelle adresse reçoit le lien de confirmation (`sendVerificationEmail`) ; l'adresse ne change qu'au clic. Adresse déjà prise : better-auth répond pareil et n'envoie rien. Le crochet `hooks.after` prévient l'ancienne adresse dans les deux cas.
- `user.deleteUser` : la demande envoie un lien (1 heure) vers `/compte/supprimer?token=…` ; la page demande une dernière confirmation, puis l'action supprime le compte. better-auth efface la ligne `user` ; la base efface avec elle sessions, comptes et chaque table métier qui référence `user.id` avec `onDelete: "cascade"`.
- `disabledPaths` : toutes les écritures passent par les actions validées ; restent ouverts les deux liens reçus par e-mail (`/verify-email`, `/reset-password/<jeton>`).
- `tacheDeFond` : dans l'application, better-auth confie l'envoi à `after()` de Next.js ; la réponse part sans attendre le serveur SMTP, et sa durée ne révèle pas si un compte existe. Dans les tests, l'option est absente : l'envoi est attendu.

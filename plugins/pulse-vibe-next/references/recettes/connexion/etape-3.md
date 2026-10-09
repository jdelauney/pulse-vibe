### 3. better-auth côté serveur

better-auth enregistre ses comptes et ses sessions dans la base du projet : son adapter est le seul à importer `src/db/`. Cette exception est déclarée dans `biome.json` (override `src/adapters/auth/**`, architecture.md §3) ; les autres adapters laissent la base aux repositories. L'objet `schema` de l'adaptateur Drizzle se construit ici, à partir des quatre tables.

<!-- fichier: src/adapters/auth/auth.adapter.ts -->
```ts
// src/adapters/auth/auth.adapter.ts
import "server-only";
import { env } from "@src/config/env";
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

type OptionsAuth = { secret: string; baseURL: string };

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
      // Sans e-mail : pas de vérification d'adresse, pas de « mot de passe oublié »
      // (pas de sendVerificationEmail ni de sendResetPassword). La recette `email` les ajoute.
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    // Ces écritures passent seulement par les actions validées de src/features/compte/actions/.
    disabledPaths: ["/sign-up/email", "/sign-in/email", "/change-password"],
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

Pour lire la session ailleurs (Route Handler, par exemple) : `await getAuth().api.getSession({ headers: request.headers })`.


# Recette : connexion

> Quand l'utiliser : l'application a des comptes : une personne crée son compte avec son e-mail et un mot de passe, se connecte, change son mot de passe et se déconnecte, et certaines pages lui sont réservées.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`) : `src/db/index.ts` (`getDb()`, type `Db`), `src/db/schema/index.ts`, `drizzle.config.ts`, `src/lib/env.ts` (`envServeur()`), `src/lib/logger.ts`, `src/lib/safe-action.ts` (`actionPublique`), `tests/helpers/base-de-test.ts` (`creerBaseDeTest()`).
- Une base Neon existe, avec ses deux adresses dans `.env` : `DATABASE_URL` (adresse « pooled », avec `-pooler`) et `DATABASE_URL_DIRECT` (adresse directe).
- Paquets : ceux du squelette (`drizzle-orm`, `drizzle-kit`, `next-safe-action`, `zod`, `@tanstack/react-form`, `sonner`), plus `better-auth` à installer à sa dernière version : `npm install better-auth` (recette vérifiée avec 1.7.7). L'adaptateur Drizzle est inclus (`better-auth/adapters/drizzle`) : rien d'autre à installer.
- Composants shadcn du squelette : `button`, `field`, `input`, `sonner`. Le layout racine affiche `<Toaster />` (`@/components/ui/sonner`) ; ajoutez-le après `{children}` s'il manque.
- `vitest.config.ts` remplace `server-only` par un module vide (alias `"server-only"` → `tests/helpers/server-only-vide.ts`). S'il manque, ajoutez l'alias, ou `vi.mock("server-only", () => ({}))` en tête de chaque test qui importe `@/db`.
- **Sans e-mail** : cette recette ne vérifie pas les adresses et n'offre pas « mot de passe oublié ». La personne change son mot de passe depuis « Mon compte », une fois connectée. La recette `email` ajoutera les deux.

## Variables d'environnement

| Nom | Où | Valeur |
|---|---|---|
| `BETTER_AUTH_SECRET` | `.env`, Vercel (Production et Preview) | 32 caractères au moins, tirés au hasard, une valeur différente par environnement : `pulse-aidd secrets generer BETTER_AUTH_SECRET` (`.env`), puis `pulse-aidd secrets generer BETTER_AUTH_SECRET --envoyer production,preview --sans-local` (Vercel). Rien n'est affiché. |
| `BETTER_AUTH_SECRETS` | facultative, ajoutée lors d'une rotation | Forme versionnée `2:<nouvelle>,1:<ancienne>` (better-auth 1.5 et plus), lue directement par better-auth : voir `/pulse:secrets renouveler BETTER_AUTH_SECRET`. Absente au départ. |
| `BETTER_AUTH_URL` | `.env`, Vercel | Adresse du site : `http://localhost:3000` en local, `https://<projet>.vercel.app` (ou le domaine) en production |
| `DATABASE_URL` | déjà là | Adresse « pooled » de Neon (application) |
| `DATABASE_URL_DIRECT` | déjà là | Adresse directe de Neon (drizzle-kit) |

Ajoutez les deux nouveaux noms à `.env.example`, **sans valeur** :

```
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
```

Le secret est généré par `pulse-aidd secrets generer`, qui l'écrit dans `.env` (et l'envoie à Vercel avec `--envoyer`) sans jamais l'afficher : il ne passe pas par la conversation. Les générateurs qui affichent leur résultat (`npx auth secret`, `openssl rand`) restent à l'écart : leur sortie arriverait dans la conversation.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/lib/env.ts` (modifié) | Ajoute `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` et, facultative, `BETTER_AUTH_SECRETS` |
| `src/db/schema/auth.ts` | Tables `user`, `session`, `account`, `verification` (sortie de la CLI better-auth) |
| `src/db/schema/index.ts` (modifié) | `export * from "./auth";` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée |
| `src/lib/auth.ts` | better-auth côté serveur : `creerAuth(db)`, `getAuth()`, `enTetesDeSession()` |
| `src/lib/auth-client.ts` | Client better-auth pour React (lecture de session côté navigateur) |
| `src/app/api/auth/[...all]/route.ts` | Adresse HTTP de better-auth |
| `src/lib/safe-action.ts` (modifié) | Ajoute `actionConnectee` |
| `src/features/compte/session.ts` | `utilisateurConnecte()` pour les pages |
| `src/features/compte/schemas.ts` | Schémas Zod partagés formulaire / action |
| `src/features/compte/actions.ts` | `inscrire`, `connecter`, `changerMotDePasse`, `deconnecter` |
| `src/features/compte/components/*.tsx` | Trois formulaires et le bouton de déconnexion |
| `src/app/(public)/inscription/page.tsx`, `connexion/page.tsx` | Pages publiques |
| `src/app/(connecte)/layout.tsx` | Pages connectées hors de Google (`noindex`) |
| `src/app/(connecte)/compte/page.tsx` | Page « Mon compte » |
| `src/proxy.ts` | Renvoi rapide vers `/connexion` sans cookie de session |
| `src/lib/auth.test.ts` | Tests d'intégration better-auth + PGlite |
| `e2e/aides/connexion.ts`, `e2e/compte.spec.ts` | Aide Playwright `connecterNouvelUtilisateur(page)` et parcours |

## Étapes

### 1. Les variables validées

```ts
// src/lib/env.ts
import "server-only";
import { z } from "zod";

const schemaEnvServeur = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  // Rotation douce (better-auth 1.5 et plus), lue directement par better-auth : « 2:nouvelle,1:ancienne ».
  // La première version doit faire 32 caractères au moins. BETTER_AUTH_SECRET reste pour relire l'existant.
  BETTER_AUTH_SECRETS: z
    .string()
    .regex(/^\d+:[^,]{32,}(,\d+:[^,]+)*$/)
    .optional(),
  BETTER_AUTH_URL: z.url(),
});

export type EnvServeur = z.infer<typeof schemaEnvServeur>;

let envValide: EnvServeur | undefined;

/** Valide process.env à la première utilisation (pas au chargement), puis garde le résultat. */
export function envServeur(): EnvServeur {
  if (!envValide) {
    const resultat = schemaEnvServeur.safeParse(process.env);
    if (!resultat.success) {
      const manquantes = resultat.error.issues
        .map((i) => i.path.join("."))
        .join(", ");
      throw new Error(
        `Variables d'environnement invalides ou manquantes : ${manquantes}`,
      );
    }
    envValide = resultat.data;
  }
  return envValide;
}
```

### 2. Les tables de better-auth et leur migration

Le fichier ci-dessous est la sortie de la CLI better-auth 1.7.7 (`npx auth@1.7.7 generate --adapter drizzle --dialect postgresql`, e-mail et mot de passe, sans plugin), mise en forme par Biome (`npm run format`). Copiez-le tel quel. La CLI refuse un fichier de configuration qui importe `server-only` : la recette fournit donc le résultat. Gardez les noms de tables et de colonnes : l'adaptateur les attend.

```ts
// src/db/schema/auth.ts
import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
```

```ts
// src/db/schema/index.ts
export * from "./auth";
```

Les tables métier qui appartiennent à une personne référencent `user.id` (type `text`) : `text("utilisateur_id").notNull().references(() => user.id, { onDelete: "cascade" })`.

Générez la migration, relisez le SQL créé dans `drizzle/` (quatre `CREATE TABLE`), puis appliquez-la :

```bash
npm run db:generate
npm run db:migrate
```

### 3. better-auth côté serveur

```ts
// src/lib/auth.ts
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { cookies, headers } from "next/headers";
import { type Db, getDb } from "@/db";
import * as schema from "@/db/schema";
import { envServeur } from "@/lib/env";

type OptionsAuth = { secret: string; baseURL: string };

/** Crée better-auth sur une base donnée : Neon dans l'application, PGlite dans les tests. */
export function creerAuth(db: Db, options: OptionsAuth) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      // Sans e-mail : pas de vérification d'adresse, pas de « mot de passe oublié »
      // (pas de sendVerificationEmail ni de sendResetPassword). La recette `email` les ajoute.
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    // Ces écritures passent seulement par les actions validées de src/features/compte/actions.ts.
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
    const env = envServeur();
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
 * La requête est lue avant getAuth() : `next build` passe ainsi sans variables d'environnement.
 */
export async function enTetesDeSession(): Promise<Headers> {
  const enTetes = new Headers(await headers());
  enTetes.set("cookie", (await cookies()).toString());
  return enTetes;
}
```

Pour lire la session ailleurs (Route Handler, par exemple) : `await getAuth().api.getSession({ headers: request.headers })`.

### 4. Le client React et la route de better-auth

```ts
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

/** Lecture de la session dans un composant client (authClient.useSession()). Les écritures passent par les actions. */
export const authClient = createAuthClient();
```

```ts
// src/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
```

### 5. Le client d'action « connecté »

```ts
// src/lib/safe-action.ts
import "server-only";
import { createSafeActionClient, returnServerError } from "next-safe-action";
import { enTetesDeSession, getAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const actionPublique = createSafeActionClient({
  handleServerError(erreur) {
    logger.error({ err: erreur }, "Erreur dans une action serveur");
    return "Une erreur est survenue. Réessayez dans un instant.";
  },
});

/** Action réservée aux personnes connectées : fournit ctx.utilisateur = { id, nom }. */
export const actionConnectee = actionPublique.use(async ({ next }) => {
  const enTetes = await enTetesDeSession();
  const session = await getAuth().api.getSession({ headers: enTetes });
  if (!session) {
    returnServerError("Connexion requise");
  }
  return next({
    ctx: { utilisateur: { id: session.user.id, nom: session.user.name } },
  });
});
```

`returnServerError` renvoie « Connexion requise » tel quel dans `result.serverError`, sans passer par `handleServerError`.

### 6. La personne connectée, côté pages

```ts
// src/features/compte/session.ts
import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { enTetesDeSession, getAuth } from "@/lib/auth";

export type UtilisateurConnecte = { id: string; nom: string };

/** La personne connectée ; sans session, renvoie vers /connexion. Une seule lecture par requête. */
export const utilisateurConnecte = cache(
  async (): Promise<UtilisateurConnecte> => {
    const enTetes = await enTetesDeSession();
    const session = await getAuth().api.getSession({ headers: enTetes });
    if (!session) {
      redirect("/connexion");
    }
    return { id: session.user.id, nom: session.user.name };
  },
);
```

Appelez-la dans un composant placé sous `<Suspense>`, jamais au premier niveau d'un layout.

### 7. Les schémas partagés

```ts
// src/features/compte/schemas.ts
import { z } from "zod";

const motDePasse = z
  .string()
  .min(8, "8 caractères au moins.")
  .max(128, "128 caractères au plus.");

export const schemaInscription = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Indiquez votre nom.")
    .max(100, "100 caractères au plus."),
  email: z.email("Adresse e-mail invalide.").max(254),
  motDePasse,
});

export const schemaConnexion = z.object({
  email: z.email("Adresse e-mail invalide.").max(254),
  motDePasse: z.string().min(1, "Indiquez votre mot de passe.").max(128),
});

export const schemaChangementMotDePasse = z
  .object({
    motDePasseActuel: z
      .string()
      .min(1, "Indiquez votre mot de passe actuel.")
      .max(128),
    nouveauMotDePasse: motDePasse,
    confirmation: z.string(),
  })
  .refine((v) => v.nouveauMotDePasse === v.confirmation, {
    message: "Les deux mots de passe sont différents.",
    path: ["confirmation"],
  });

export type Inscription = z.infer<typeof schemaInscription>;
export type Connexion = z.infer<typeof schemaConnexion>;
export type ChangementMotDePasse = z.infer<typeof schemaChangementMotDePasse>;
```

### 8. Les actions

```ts
// src/features/compte/actions.ts
"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { returnServerError } from "next-safe-action";
import { getAuth } from "@/lib/auth";
import { actionConnectee, actionPublique } from "@/lib/safe-action";
import {
  schemaChangementMotDePasse,
  schemaConnexion,
  schemaInscription,
} from "./schemas";

export const inscrire = actionPublique
  .inputSchema(schemaInscription)
  .action(async ({ parsedInput }) => {
    try {
      await getAuth().api.signUpEmail({
        body: {
          name: parsedInput.nom,
          email: parsedInput.email,
          password: parsedInput.motDePasse,
        },
        headers: await headers(),
      });
    } catch (erreur) {
      if (
        erreur instanceof APIError &&
        erreur.body?.code?.startsWith("USER_ALREADY_EXISTS")
      ) {
        returnServerError(
          "Un compte existe déjà avec cette adresse. Connectez-vous.",
        );
      }
      throw erreur;
    }
    redirect("/compte");
  });

export const connecter = actionPublique
  .inputSchema(schemaConnexion)
  .action(async ({ parsedInput }) => {
    try {
      await getAuth().api.signInEmail({
        body: { email: parsedInput.email, password: parsedInput.motDePasse },
        headers: await headers(),
      });
    } catch (erreur) {
      if (erreur instanceof APIError && erreur.status === "UNAUTHORIZED") {
        returnServerError("Adresse e-mail ou mot de passe incorrect.");
      }
      throw erreur;
    }
    redirect("/compte");
  });

export const changerMotDePasse = actionConnectee
  .inputSchema(schemaChangementMotDePasse)
  .action(async ({ parsedInput }) => {
    try {
      await getAuth().api.changePassword({
        body: {
          currentPassword: parsedInput.motDePasseActuel,
          newPassword: parsedInput.nouveauMotDePasse,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch (erreur) {
      if (
        erreur instanceof APIError &&
        erreur.body?.code === "INVALID_PASSWORD"
      ) {
        returnServerError("Mot de passe actuel incorrect.");
      }
      throw erreur;
    }
    return { message: "Mot de passe modifié." };
  });

export const deconnecter = actionConnectee.action(async () => {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/connexion");
});
```

Codes vérifiés avec better-auth 1.7.7 : adresse déjà prise → `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` (422) ; mauvais mot de passe à la connexion → `UNAUTHORIZED` / `INVALID_EMAIL_OR_PASSWORD` ; mauvais mot de passe actuel → `INVALID_PASSWORD` (400). `revokeOtherSessions: true` déconnecte les autres appareils et remplace la session en cours par une nouvelle.

### 9. Les formulaires (TanStack Form + Field)

Structure commune aux trois formulaires : `useAction(action)` de `next-safe-action/hooks`, `useForm` avec le **même** schéma Zod en `validators.onSubmit`, un `form.Field` par champ, et le message `result.serverError` sous les champs. Les `id` sont préfixés par `useId()` (voir « Pièges connus »).

```tsx
// src/features/compte/components/formulaire-inscription.tsx
"use client";

import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { inscrire } from "../actions";
import { schemaInscription } from "../schemas";

const champs = [
  { name: "nom", label: "Nom", type: "text", autoComplete: "name" },
  {
    name: "email",
    label: "Adresse e-mail",
    type: "email",
    autoComplete: "email",
  },
  {
    name: "motDePasse",
    label: "Mot de passe (8 caractères au moins)",
    type: "password",
    autoComplete: "new-password",
  },
] as const;

export function FormulaireInscription() {
  const prefixe = useId();
  const { executeAsync, result, isPending } = useAction(inscrire);

  const form = useForm({
    defaultValues: { nom: "", email: "", motDePasse: "" },
    validators: { onSubmit: schemaInscription },
    onSubmit: async ({ value }) => {
      await executeAsync(value);
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        {champs.map((c) => (
          <form.Field key={c.name} name={c.name}>
            {(field) => {
              const invalide =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={invalide}>
                  <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                    {c.label}
                  </FieldLabel>
                  <Input
                    id={`${prefixe}-${field.name}`}
                    name={field.name}
                    type={c.type}
                    autoComplete={c.autoComplete}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={invalide}
                  />
                  {invalide && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>
        ))}

        {result.serverError && (
          <p role="alert" className="text-sm text-destructive">
            {result.serverError}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Création…" : "Créer mon compte"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Déjà un compte ? <Link href="/connexion">Se connecter</Link>
        </p>
      </FieldGroup>
    </form>
  );
}
```

`formulaire-connexion.tsx` suit la même structure, avec deux champs.

```tsx
// src/features/compte/components/formulaire-connexion.tsx
"use client";

import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { connecter } from "../actions";
import { schemaConnexion } from "../schemas";

const champs = [
  {
    name: "email",
    label: "Adresse e-mail",
    type: "email",
    autoComplete: "email",
  },
  {
    name: "motDePasse",
    label: "Mot de passe",
    type: "password",
    autoComplete: "current-password",
  },
] as const;

export function FormulaireConnexion() {
  const prefixe = useId();
  const { executeAsync, result, isPending } = useAction(connecter);

  const form = useForm({
    defaultValues: { email: "", motDePasse: "" },
    validators: { onSubmit: schemaConnexion },
    onSubmit: async ({ value }) => {
      await executeAsync(value);
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        {champs.map((c) => (
          <form.Field key={c.name} name={c.name}>
            {(field) => {
              const invalide =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={invalide}>
                  <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                    {c.label}
                  </FieldLabel>
                  <Input
                    id={`${prefixe}-${field.name}`}
                    name={field.name}
                    type={c.type}
                    autoComplete={c.autoComplete}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={invalide}
                  />
                  {invalide && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>
        ))}

        {result.serverError && (
          <p role="alert" className="text-sm text-destructive">
            {result.serverError}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Connexion…" : "Se connecter"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/inscription">Créer un compte</Link>
        </p>
      </FieldGroup>
    </form>
  );
}
```

```tsx
// src/features/compte/components/formulaire-mot-de-passe.tsx
"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { useId } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changerMotDePasse } from "../actions";
import { schemaChangementMotDePasse } from "../schemas";

const champs = [
  {
    name: "motDePasseActuel",
    label: "Mot de passe actuel",
    autoComplete: "current-password",
  },
  {
    name: "nouveauMotDePasse",
    label: "Nouveau mot de passe",
    autoComplete: "new-password",
  },
  {
    name: "confirmation",
    label: "Confirmez le nouveau mot de passe",
    autoComplete: "new-password",
  },
] as const;

export function FormulaireMotDePasse() {
  const prefixe = useId();
  const { executeAsync, result, isPending } = useAction(changerMotDePasse);

  const form = useForm({
    defaultValues: {
      motDePasseActuel: "",
      nouveauMotDePasse: "",
      confirmation: "",
    },
    validators: { onSubmit: schemaChangementMotDePasse },
    onSubmit: async ({ value, formApi }) => {
      const reponse = await executeAsync(value);
      if (reponse?.data) {
        toast.success(reponse.data.message);
        formApi.reset();
      }
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        {champs.map((c) => (
          <form.Field key={c.name} name={c.name}>
            {(field) => {
              const invalide =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={invalide}>
                  <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                    {c.label}
                  </FieldLabel>
                  <Input
                    id={`${prefixe}-${field.name}`}
                    name={field.name}
                    type="password"
                    autoComplete={c.autoComplete}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={invalide}
                  />
                  {invalide && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>
        ))}

        {result.serverError && (
          <p role="alert" className="text-sm text-destructive">
            {result.serverError}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Enregistrement…" : "Changer mon mot de passe"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

```tsx
// src/features/compte/components/bouton-deconnexion.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { deconnecter } from "../actions";

export function BoutonDeconnexion() {
  const { execute, isPending } = useAction(deconnecter);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => execute()}
    >
      {isPending ? "Déconnexion…" : "Se déconnecter"}
    </Button>
  );
}
```

### 10. Les pages

```tsx
// src/app/(public)/inscription/page.tsx
import type { Metadata } from "next";
import { FormulaireInscription } from "@/features/compte/components/formulaire-inscription";

export const metadata: Metadata = { title: "Créer un compte" };

export default function PageInscription() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">Créer un compte</h1>
      <FormulaireInscription />
    </main>
  );
}
```

```tsx
// src/app/(public)/connexion/page.tsx
import type { Metadata } from "next";
import { FormulaireConnexion } from "@/features/compte/components/formulaire-connexion";

export const metadata: Metadata = { title: "Se connecter" };

export default function PageConnexion() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">Se connecter</h1>
      <FormulaireConnexion />
    </main>
  );
}
```

```tsx
// src/app/(connecte)/layout.tsx
import type { Metadata } from "next";

// Pages réservées aux personnes connectées : hors de Google.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LayoutConnecte({ children }: LayoutProps<"/">) {
  return children;
}
```

```tsx
// src/app/(connecte)/compte/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { BoutonDeconnexion } from "@/features/compte/components/bouton-deconnexion";
import { FormulaireMotDePasse } from "@/features/compte/components/formulaire-mot-de-passe";
import { utilisateurConnecte } from "@/features/compte/session";

export const metadata: Metadata = { title: "Mon compte" };

export default function PageCompte() {
  return (
    <main className="mx-auto max-w-sm space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Mon compte</h1>
      <Suspense fallback={<p className="text-muted-foreground">Chargement…</p>}>
        <ContenuCompte />
      </Suspense>
    </main>
  );
}

async function ContenuCompte() {
  const utilisateur = await utilisateurConnecte();
  return (
    <>
      <section className="flex items-center justify-between gap-4">
        <p>Connecté en tant que {utilisateur.nom}</p>
        <BoutonDeconnexion />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-medium">Changer mon mot de passe</h2>
        <FormulaireMotDePasse />
      </section>
    </>
  );
}
```

Chaque nouvelle page connectée suit ce modèle : page synchrone, lecture de `utilisateurConnecte()` dans un composant sous `<Suspense>`.

### 11. Le renvoi rapide vers la connexion (`proxy.ts`)

```ts
// src/proxy.ts
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // Seulement l'ouverture d'une page (GET). Une action (POST) continue jusqu'à
  // actionConnectee, qui répond « Connexion requise » dans le formulaire.
  if (request.method === "GET" && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Une ligne par page du groupe (connecte) : les groupes de routes n'apparaissent pas dans l'adresse.
  matcher: ["/compte/:path*"],
};
```

`getSessionCookie` regarde seulement si le cookie existe (il reconnaît aussi le préfixe `__Secure-` de la production). Il ne le valide pas : la vraie vérification reste dans `utilisateurConnecte()` et `actionConnectee`.

Le test `request.method === "GET"` laisse passer les actions. Une Server Action envoie un POST à l'adresse de la page : redirigée par le proxy, elle s'arrêterait sans aucun message (essai fait : réponse 307, formulaire muet).

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Compte personnel

  Règle: On crée un compte avec un nom, une adresse e-mail et un mot de passe d'au moins 8 caractères

    @US-XXX-1 @integration
    Exemple: Camille crée son compte et arrive sur « Mon compte »
      Étant donné aucun compte n'existe pour « camille@exemple.fr »
      Quand Camille crée son compte avec le nom « Camille Martin », l'adresse « camille@exemple.fr » et le mot de passe « motdepasse-solide »
      Alors la page « Mon compte » affiche « Connecté en tant que Camille Martin »

    @US-XXX-1 @integration @securite
    Exemple: Le mot de passe n'est jamais enregistré en clair
      Quand Camille crée son compte avec le mot de passe « motdepasse-solide »
      Alors la base ne contient pas le texte « motdepasse-solide »

    @US-XXX-2 @integration
    Exemple: Une adresse déjà utilisée est refusée
      Étant donné un compte existe pour « camille@exemple.fr »
      Quand quelqu'un crée un compte avec l'adresse « camille@exemple.fr »
      Alors le message « Un compte existe déjà avec cette adresse. Connectez-vous. » s'affiche

    @US-XXX-2 @unitaire
    Plan du scénario: Une saisie invalide est refusée avec un message sous le champ
      Quand Camille crée son compte avec <champ> « <saisie> »
      Alors le message « <message> » s'affiche sous le champ

      Exemples:
        | champ           | saisie       | message                  |
        | le nom          |              | Indiquez votre nom.      |
        | l'adresse       | camille@     | Adresse e-mail invalide. |
        | le mot de passe | court        | 8 caractères au moins.   |

  Règle: Seule la bonne combinaison adresse et mot de passe ouvre une session

    @US-XXX-3 @integration @securite
    Exemple: Mauvais mot de passe : la connexion est refusée
      Étant donné Camille a un compte avec le mot de passe « motdepasse-solide »
      Quand Camille se connecte avec le mot de passe « mauvais-mot-de-passe »
      Alors le message « Adresse e-mail ou mot de passe incorrect. » s'affiche
      Et Camille reste sur la page de connexion

    @US-XXX-3 @bout-en-bout @securite
    Exemple: Sans session, « Mon compte » renvoie vers la connexion
      Étant donné personne n'est connecté
      Quand quelqu'un ouvre l'adresse « /compte »
      Alors la page « Se connecter » s'affiche

    @US-XXX-3 @manuel @securite
    Exemple: Une action réservée envoyée sans session est refusée
      Étant donné personne n'est connecté
      Quand quelqu'un envoie directement la demande de changement de mot de passe
      Alors la demande est refusée avec « Connexion requise »

  Règle: Une personne connectée change son mot de passe en donnant l'actuel

    @US-XXX-4 @bout-en-bout
    Exemple: Camille change son mot de passe puis se reconnecte avec le nouveau
      Étant donné Camille est connectée
      Quand Camille remplace « motdepasse-solide » par « nouveau-mot-de-passe »
      Alors le message « Mot de passe modifié. » s'affiche
      Et Camille se reconnecte avec « nouveau-mot-de-passe »

    @US-XXX-4 @integration @securite
    Exemple: Mot de passe actuel faux : rien ne change
      Étant donné Camille est connectée
      Quand Camille donne « faux » comme mot de passe actuel
      Alors le message « Mot de passe actuel incorrect. » s'affiche
      Et l'ancien mot de passe fonctionne toujours

    @US-XXX-4 @integration @securite
    Exemple: Après le changement, l'ancien mot de passe ne marche plus
      Étant donné Camille a changé son mot de passe pour « nouveau-mot-de-passe »
      Quand Camille se connecte avec « motdepasse-solide »
      Alors la connexion est refusée

    @US-XXX-4 @unitaire
    Exemple: Confirmation différente : le changement est refusé
      Quand Camille saisit « nouveau-mot-de-passe » puis « nouveau-mot-de-passx » en confirmation
      Alors le message « Les deux mots de passe sont différents. » s'affiche sous la confirmation

  Règle: Se déconnecter ferme la session

    @US-XXX-5 @bout-en-bout @securite
    Exemple: Après la déconnexion, « Mon compte » renvoie vers la connexion
      Étant donné Camille est connectée
      Quand Camille clique sur « Se déconnecter »
      Alors la page « Se connecter » s'affiche
      Et l'adresse « /compte » renvoie vers la connexion
```

## Tâches de plan prêtes

> US terminée quand : une personne crée son compte, se connecte, change son mot de passe et se déconnecte ; « Mon compte » est inaccessible sans session.

- [ ] **T1 – Tables et configuration de better-auth** · US-XXX
  - Objectif : la base sait enregistrer les comptes et les sessions
  - Dépend de : —
  - Fichiers : à créer : `src/db/schema/auth.ts`, `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`, `src/lib/auth.test.ts`, migration dans `drizzle/` · à modifier : `src/lib/env.ts`, `src/db/schema/index.ts`, `.env.example`
  - Vérification : US-XXX critères 1 à 4 – `npm test` passe ; `npm run db:migrate` crée les 4 tables
  - Tests : « Le mot de passe n'est jamais enregistré en clair » (intégration) ; « Une adresse déjà utilisée est refusée » (intégration) ; « Mauvais mot de passe : la connexion est refusée » (intégration) ; « Mot de passe actuel faux » (intégration) ; « Après le changement, l'ancien mot de passe ne marche plus » (intégration)
  - Attention : `BETTER_AUTH_SECRET` se génère avec `pulse-aidd secrets generer BETTER_AUTH_SECRET`, jamais affiché (S1)
- [ ] **T2 – Actions et client « connecté »** · US-XXX
  - Objectif : chaque écriture du compte passe par une action validée, et les pages savent qui est connecté
  - Dépend de : T1
  - Fichiers : à créer : `src/features/compte/schemas.ts`, `actions.ts`, `session.ts`, `schemas.test.ts` · à modifier : `src/lib/safe-action.ts`
  - Vérification : US-XXX critères 2 et 4 – `npm test` et `npm run typecheck` passent
  - Tests : « Une saisie invalide est refusée avec un message sous le champ » (unitaire) ; « Confirmation différente » (unitaire)
  - Attention : `actions.ts` n'exporte que des actions next-safe-action
- [ ] **T3 – Pages, formulaires et renvoi vers la connexion** · US-XXX
  - Objectif : la personne s'inscrit, se connecte, change son mot de passe et se déconnecte depuis l'écran
  - Dépend de : T2
  - Fichiers : à créer : `src/features/compte/components/formulaire-inscription.tsx`, `formulaire-connexion.tsx`, `formulaire-mot-de-passe.tsx`, `bouton-deconnexion.tsx`, `src/app/(public)/inscription/page.tsx`, `src/app/(public)/connexion/page.tsx`, `src/app/(connecte)/layout.tsx`, `src/app/(connecte)/compte/page.tsx`, `src/proxy.ts`
  - Vérification : US-XXX critères 1 à 5 – `npm run build` passe ; parcours complet à la main en local
  - Tests : « Une action réservée envoyée sans session est refusée » (manuel)
  - Attention : lecture de session sous `<Suspense>` ; `id` des champs préfixés par `useId()`
- [ ] **T4 – Parcours de bout en bout** · US-XXX
  - Objectif : le parcours complet est vérifié automatiquement, et l'aide de connexion sert aux autres recettes
  - Dépend de : T3
  - Fichiers : à créer : `e2e/aides/connexion.ts`, `e2e/compte.spec.ts`
  - Vérification : US-XXX critères 1, 3, 4 et 5 – `npm run test:e2e` passe
  - Tests : « Camille crée son compte et arrive sur « Mon compte » » (bout en bout) ; « Sans session, « Mon compte » renvoie vers la connexion » (bout en bout) ; « Camille change son mot de passe puis se reconnecte avec le nouveau » (bout en bout) ; « Après la déconnexion… » (bout en bout)
- [ ] **T5 – Mise en ligne** · US-XXX
  - Objectif : la connexion marche sur le site en ligne
  - Dépend de : T4
  - Fichiers : aucun
  - Vérification : US-XXX critère 1 – `BETTER_AUTH_SECRET` et `BETTER_AUTH_URL` réglées dans Vercel ; `npm run db:migrate` appliqué à la base de production avant l'envoi ; inscription réussie sur l'adresse publique
  - Attention : la protection contre les essais répétés de mot de passe vient de la recette `limite` ; appliquez-la avant d'ouvrir le site au public

## Tests

### Intégration (Vitest + PGlite)

better-auth tourne sur une base PGlite neuve, avec les migrations du projet. `creerAuth` reçoit cette base : aucune variable d'environnement n'est lue.

```ts
// src/lib/auth.test.ts
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { account } from "@/db/schema";
import { creerBaseDeTest } from "../../tests/helpers/base-de-test";
import { type Auth, creerAuth } from "./auth";

const optionsDeTest = {
  secret: "secret-de-test-secret-de-test-secret-de-test",
  baseURL: "http://localhost:3000",
};

describe("connexion par e-mail et mot de passe", () => {
  let db: Db;
  let fermer: () => Promise<void>;
  let auth: Auth;

  beforeEach(async () => {
    ({ db, fermer } = await creerBaseDeTest());
    auth = creerAuth(db, optionsDeTest);
  });
  afterEach(async () => {
    await fermer();
  });

  async function inscrireCamille() {
    return auth.api.signUpEmail({
      body: {
        name: "Camille Martin",
        email: "camille@exemple.fr",
        password: "motdepasse-solide",
      },
    });
  }

  it("US-XXX-1 – l'inscription crée un compte et ne garde pas le mot de passe en clair", async () => {
    const resultat = await inscrireCamille();

    expect(resultat.user.email).toBe("camille@exemple.fr");
    const [compte] = await db
      .select()
      .from(account)
      .where(eq(account.userId, resultat.user.id));
    expect(compte.password).toBeTruthy();
    expect(compte.password).not.toContain("motdepasse-solide");
  });

  it("US-XXX-2 – une deuxième inscription avec la même adresse est refusée", async () => {
    await inscrireCamille();
    const erreur = await inscrireCamille().catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(APIError);
    expect((erreur as APIError).body?.code).toBe(
      "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    );
  });

  it("US-XXX-3 – la connexion avec un mauvais mot de passe est refusée", async () => {
    await inscrireCamille();
    const erreur = await auth.api
      .signInEmail({
        body: { email: "camille@exemple.fr", password: "mauvais-mot-de-passe" },
      })
      .catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(APIError);
    expect((erreur as APIError).status).toBe("UNAUTHORIZED");
  });

  it("US-XXX-4 – changer son mot de passe : l'ancien ne marche plus, le nouveau oui", async () => {
    await inscrireCamille();
    const { headers: reponse } = await auth.api.signInEmail({
      body: { email: "camille@exemple.fr", password: "motdepasse-solide" },
      returnHeaders: true,
    });
    const cookie = reponse.get("set-cookie") ?? "";
    const enTetes = new Headers({ cookie: cookie.split(";")[0] });

    const mauvais = await auth.api
      .changePassword({
        body: {
          currentPassword: "faux",
          newPassword: "nouveau-mot-de-passe",
          revokeOtherSessions: true,
        },
        headers: enTetes,
      })
      .catch((e: unknown) => e);
    expect((mauvais as APIError).body?.code).toBe("INVALID_PASSWORD");

    await auth.api.changePassword({
      body: {
        currentPassword: "motdepasse-solide",
        newPassword: "nouveau-mot-de-passe",
        revokeOtherSessions: true,
      },
      headers: enTetes,
    });

    await expect(
      auth.api.signInEmail({
        body: { email: "camille@exemple.fr", password: "motdepasse-solide" },
      }),
    ).rejects.toBeInstanceOf(APIError);
    const ok = await auth.api.signInEmail({
      body: { email: "camille@exemple.fr", password: "nouveau-mot-de-passe" },
    });
    expect(ok.user.email).toBe("camille@exemple.fr");
  });
});

describe("chemins HTTP fermés", () => {
  it("US-XXX-2 – l'inscription directe par l'adresse HTTP de better-auth est refusée", async () => {
    const { db, fermer } = await creerBaseDeTest();
    const auth = creerAuth(db, optionsDeTest);
    const reponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "x".repeat(10_000),
          email: "b@exemple.fr",
          password: "motdepasse-solide",
        }),
      }),
    );
    expect(reponse.status).toBe(404);
    await fermer();
  });
});
```

### Unitaires (schémas)

Dans `src/features/compte/schemas.test.ts`, un test par ligne du plan « Une saisie invalide… » et un pour « Confirmation différente » : `schemaInscription.safeParse(...)` puis `expect(resultat.error?.issues[0]?.message).toBe("…")`.

### Bout en bout (Playwright)

L'aide `connecterNouvelUtilisateur(page)` sert aussi aux autres recettes (`liste`, par exemple).

```ts
// e2e/aides/connexion.ts
import { expect, type Page } from "@playwright/test";

export const MOT_DE_PASSE_DE_TEST = "motdepasse-de-test";

/**
 * Champ visible désigné par son libellé exact.
 * Next.js garde les pages déjà visitées, cachées, dans la page : sans `visible: true`,
 * un libellé présent sur deux pages désigne deux champs.
 */
export function champ(page: Page, libelle: string) {
  return page.getByLabel(libelle, { exact: true }).filter({ visible: true });
}

/** Crée un compte neuf (adresse unique), le connecte, et attend la page « Mon compte ». */
export async function connecterNouvelUtilisateur(
  page: Page,
  nom = "Camille Martin",
) {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.fr`;
  await page.goto("/inscription");
  await champ(page, "Nom").fill(nom);
  await champ(page, "Adresse e-mail").fill(email);
  await champ(page, "Mot de passe (8 caractères au moins)").fill(
    MOT_DE_PASSE_DE_TEST,
  );
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/compte$/);
  return { nom, email, motDePasse: MOT_DE_PASSE_DE_TEST };
}
```

```ts
// e2e/compte.spec.ts
import { expect, test } from "@playwright/test";
import { champ, connecterNouvelUtilisateur } from "./aides/connexion";

test.describe("Compte", () => {
  test("US-XXX-1 – après l'inscription, « Mon compte » affiche le nom", async ({
    page,
  }) => {
    await connecterNouvelUtilisateur(page, "Camille Martin");
    await expect(
      page.getByText("Connecté en tant que Camille Martin"),
    ).toBeVisible();
  });

  test("US-XXX-3 – sans session, « Mon compte » renvoie vers la connexion", async ({
    page,
  }) => {
    await page.goto("/compte");
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("US-XXX-4 – changer son mot de passe puis se reconnecter avec le nouveau", async ({
    page,
  }) => {
    const { email, motDePasse } = await connecterNouvelUtilisateur(page);
    await champ(page, "Mot de passe actuel").fill(motDePasse);
    await champ(page, "Nouveau mot de passe").fill("nouveau-mot-de-passe");
    await champ(page, "Confirmez le nouveau mot de passe").fill(
      "nouveau-mot-de-passe",
    );
    await page
      .getByRole("button", { name: "Changer mon mot de passe" })
      .click();
    await expect(page.getByText("Mot de passe modifié.")).toBeVisible();

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await champ(page, "Adresse e-mail").fill(email);
    await champ(page, "Mot de passe").fill("nouveau-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/compte$/);
  });

  test("US-XXX-5 – après la déconnexion, « Mon compte » renvoie vers la connexion", async ({
    page,
  }) => {
    await connecterNouvelUtilisateur(page);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await page.goto("/compte");
    await expect(page).toHaveURL(/\/connexion$/);
  });
});
```

Les tests de bout en bout tournent sur une base de développement (jamais la base de production) : chaque test crée son propre compte.

Commandes : `npm test` (unitaires et intégration), `npm run test:e2e` (bout en bout).

## Points de sécurité

- **S1 – Secrets hors du code** : `BETTER_AUTH_SECRET` et les adresses de base vivent dans `.env` (ignoré par Git) et dans Vercel ; `.env.example` garde seulement les noms. Le secret est généré par `pulse-aidd secrets generer`, sans affichage, avec une valeur différente par environnement. `env.ts` refuse de démarrer si une variable manque, et son message nomme la variable sans afficher de valeur.
- **S2 – Clés côté client** : aucune variable `NEXT_PUBLIC_` ; `auth-client.ts` n'a besoin d'aucune clé (même domaine).
- **S3 – Contrôle d'accès aux données** : l'identifiant de la personne vient toujours de la session (`ctx.utilisateur.id`, `utilisateurConnecte().id`), jamais d'un champ du formulaire.
- **S4 – Pages et actions réservées** : `actionConnectee` relit la session à chaque appel (une Server Action est une adresse publique) ; la page « Mon compte » relit la session avec `utilisateurConnecte()`. `proxy.ts` ne fait qu'un renvoi rapide : il voit la présence d'un cookie, pas sa validité.
- **S5 – Validation des entrées** : chaque action revalide avec son schéma Zod (longueurs maximales comprises). `disabledPaths` ferme les adresses HTTP d'inscription, de connexion et de changement de mot de passe de better-auth : les seules portes d'entrée sont les actions validées.
- **Mots de passe et sessions** : better-auth hache les mots de passe (scrypt) ; 8 à 128 caractères ; cookie de session `HttpOnly`, `SameSite=Lax`, préfixe `__Secure-` en production ; session de 7 jours, prolongée chaque jour d'utilisation ; changement de mot de passe avec l'actuel et déconnexion des autres appareils (`revokeOtherSessions: true`). better-auth refuse aussi les requêtes HTTP venues d'une autre origine que `BETTER_AUTH_URL`.
- **S9 – Données personnelles** : seuls le nom, l'e-mail et le mot de passe haché sont stockés (plus l'adresse IP et le navigateur de chaque session, colonnes `ip_address` et `user_agent`) : à citer dans la mention de confidentialité. La suppression d'un `user` efface ses sessions et comptes (`onDelete: "cascade"`).
- **S10 – Abus** : sans la recette `limite`, rien ne freine les essais répétés de mot de passe (la limite intégrée de better-auth ne s'applique pas aux appels `auth.api` des actions). Appliquez la recette `limite` avant d'ouvrir le site au public.
- **S11 – Messages d'erreur** : messages en français, sans détail technique ; `handleServerError` journalise l'erreur côté serveur et renvoie un message générique. La connexion répond le même message pour une adresse inconnue et un mauvais mot de passe. L'inscription, elle, dit « Un compte existe déjà » : c'est le compromis courant sans e-mail de confirmation (voir « Pièges connus »).

## Pièges connus

- **`next build` échoue sur `/compte` avec « Variables d'environnement invalides »** : la requête doit être lue **avant** `getAuth()`. Passez par `enTetesDeSession()` (ou `const enTetes = await headers();` sur sa propre ligne), jamais `getAuth().api.getSession({ headers: await headers() })` dans une page.
- **Renvoyé vers `/connexion` juste après « Mot de passe modifié »** : la page est réaffichée dans la réponse de l'action avec l'ancien cookie si la session est lue avec `headers()` seul. Lisez-la avec `enTetesDeSession()`, qui prend les cookies à jour.
- **Libellé qui remplit le mauvais champ, ou champ introuvable dans Playwright** : Next.js garde les pages visitées, cachées, dans le document. Préfixez les `id` avec `useId()` ; dans Playwright, utilisez `champ(page, "…")` (libellé exact + `visible: true`).
- **`npx auth generate` refuse de démarrer** (« Please remove import 'server-only' ») : utilisez le fichier `src/db/schema/auth.ts` de la recette. Pour un plugin better-auth qui ajoute des tables, lancez la CLI sur un fichier temporaire sans `server-only`, puis supprimez-le.
- **`authClient.signIn.email` répond 404** : ces adresses sont fermées par `disabledPaths`. Appelez l'action `connecter`. Une recette qui ajoute un parcours HTTP de better-auth retire son chemin de `disabledPaths`.
- **Page connectée qui ne se construit pas** (`next build` signale `cookies()` ou `headers()` « accessed outside of `<Suspense>` ») : la lecture de session va dans un composant sous `<Suspense>`, jamais au premier niveau d'une page ou d'un layout.
- **Nouvelle page connectée accessible sans renvoi** : ajoutez son adresse au `matcher` de `proxy.ts` (`"/factures/:path*"`). La page reste protégée par `utilisateurConnecte()` même si vous l'oubliez.
- **Formulaire muet sur une page connectée quand la session a expiré** : `proxy.ts` redirige aussi le POST de la Server Action (réponse 307), et l'action ne répond rien. Gardez le test `request.method === "GET"` du proxy : l'action arrive alors à `actionConnectee`, qui répond « Connexion requise ».
- **Redirection vers `/connexion` en réponse 200** : quand la session manque dans un composant sous `<Suspense>`, Next.js a déjà commencé à envoyer la page ; la redirection se fait dans le navigateur. C'est normal ; `proxy.ts` répond 307 avant, dès que le cookie manque.
- **Test d'intégration qui plante sur `server-only`** : ajoutez l'alias `server-only` dans `vitest.config.ts` (voir « Prérequis »).
- **Tout le monde est déconnecté après un changement de `BETTER_AUTH_SECRET`** : la signature du cookie de session utilise seulement le secret courant (code de better-auth 1.7.7), même avec `BETTER_AUTH_SECRETS`. C'est normal : chacun se reconnecte. `BETTER_AUTH_SECRETS` garde lisibles les données chiffrées par better-auth (plugins de double authentification, connexion par un service tiers, cookie de session mis en cache). Procédure : `/pulse:secrets renouveler BETTER_AUTH_SECRET`.
- **Pas de lien « Mot de passe oublié »** : il arrive avec la recette `email`. En attendant, la personne qui oublie son mot de passe contacte l'administrateur.
- **Inscription bloquée avec « Un compte existe déjà »** : quelqu'un a pu utiliser l'adresse d'une autre personne, faute de vérification par e-mail. La recette `email` règle ce cas avec `requireEmailVerification: true`.

## Sources

- Installation, variables `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`, route `toNextJsHandler` : https://www.better-auth.com/docs/installation
- Rotation des secrets (`secrets`, `BETTER_AUTH_SECRETS=2:…,1:…`, première version pour les nouveaux chiffrements, suivantes pour relire) : https://www.better-auth.com/docs/reference/options ; lecture de `BETTER_AUTH_SECRETS` et signature des cookies par le seul secret courant : code de `better-auth@1.7.7` (`dist/context/create-context.mjs`, `dist/context/secret-utils.mjs`, `dist/api/routes/session.mjs`), lu le 2026-10-07
- Next.js, `nextCookies()` (en dernier plugin), `auth.api.getSession({ headers })`, `proxy.ts` et `getSessionCookie` (« only checks for the existence of a session cookie ; it does not validate it ») : https://www.better-auth.com/docs/integrations/next
- Adaptateur Drizzle, CLI `npx auth@latest generate` : https://www.better-auth.com/docs/adapters/drizzle
- E-mail et mot de passe (`requireEmailVerification`, longueurs 8–128, `autoSignIn`, `changePassword` et `revokeOtherSessions`, hachage scrypt) : https://www.better-auth.com/docs/authentication/email-password
- Sessions (7 jours, prolongées chaque jour) : https://www.better-auth.com/docs/concepts/session-management
- Limite de fréquence (production seulement ; « Server-side requests using `auth.api` bypass rate limiting ») : https://www.better-auth.com/docs/concepts/rate-limit
- `baseURL`, `trustedOrigins` : https://www.better-auth.com/docs/reference/options ; `disabledPaths` : type `BetterAuthOptions` du paquet `@better-auth/core@1.7.7` (testé : HTTP 404, `auth.api` intact)
- next-safe-action : https://next-safe-action.dev/docs/define-actions/middleware ; https://next-safe-action.dev/docs/concepts/error-handling (`returnServerError`) ; https://next-safe-action.dev/docs/execute-actions/hooks/useaction
- shadcn + TanStack Form : https://ui.shadcn.com/docs/forms/tanstack-form
- Next.js 16.4 (doc embarquée `node_modules/next/dist/docs/`) : `01-app/02-guides/authentication-with-cache-components.md` (session sous `<Suspense>`, revérifier dans chaque action) ; `01-app/01-getting-started/16-proxy.md` et `01-app/03-api-reference/03-file-conventions/proxy.md` (`proxy`, `matcher`, runtime Node.js) ; `01-app/03-api-reference/04-functions/cookies.md` (réaffichage dans la même réponse après un cookie modifié)
- Codes d'erreur, cookies, `disabledPaths`, réaffichage après changement de mot de passe : vérifiés par essai réel (better-auth 1.7.7, Next.js 16.4.0, PGlite 0.5.8, Playwright 1.63.0).
- Rejoué le 2026-10-06 sur le squelette du pack (shadcn 4.21.3 « base-nova », Biome 2.5.15) : `npm run check`, `npm run typecheck`, `npm test`, `npm run build` sans variables, puis Playwright sur ordinateur et téléphone, avec `next start` et `next dev` branchés sur PGlite. Le scénario « Une action réservée envoyée sans session est refusée » a été joué par Playwright (cookies effacés avant l'envoi).

## Points à vérifier

- **Vercel, déploiements de prévisualisation** : avec `BETTER_AUTH_URL` fixé sur l'adresse de production, better-auth refuse les requêtes HTTP venues d'une autre origine (« Invalid origin », essai fait). Les actions passent par `auth.api`, mais `/api/auth/get-session` ou `sign-out` appelés depuis une prévisualisation seraient refusés. Piste documentée : `baseURL: { allowedHosts: ["<projet>.vercel.app", "*.vercel.app"], protocol: "https", fallback: "https://<projet>.vercel.app" }`. Non essayé.
- **Limite de fréquence sur Vercel** : la limite intégrée garde ses compteurs en mémoire, propre à chaque instance (« may not be suitable […] in serverless environments »). La recette `limite` doit couvrir les actions `connecter` et `inscrire`.
- **Connexion réelle à Neon** : tout le parcours a été essayé sur PGlite ; à rejouer une fois sur Neon (`npm run db:migrate`, puis inscription en ligne).
- **Dates sans fuseau dans les tables better-auth** : la CLI génère `timestamp` sans `with time zone`, contrairement à la règle 13 de la fiche. Sans effet tant que la base tourne en UTC (cas de Neon) ; laissé tel quel pour pouvoir régénérer.

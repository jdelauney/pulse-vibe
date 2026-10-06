# Recette : email

> Quand l'utiliser : l'application envoie des e-mails ; elle confirme l'adresse des comptes et permet de remplacer un mot de passe oublié.

## Prérequis

- Recette `connexion` appliquée (`creerAuth`, `getAuth`, actions `inscrire` et `connecter`, aides Playwright `e2e/aides/connexion.ts`).
- Paquet à installer : `npm install nodemailer` (dernière version ; recette vérifiée avec 10.0.15). Nodemailer 10 fournit ses propres types : si `@types/nodemailer` est présent, le désinstaller (`npm uninstall @types/nodemailer`).
- **Mailpit** sur le poste. Il capture tous les e-mails envoyés en local : rien ne part vers de vraies adresses.
  - Windows : `winget install --id axllent.mailpit --exact` (ou l'archive `mailpit-windows-amd64.zip` de https://github.com/axllent/mailpit/releases, à décompresser dans un dossier du PATH).
  - macOS : `brew install mailpit`, puis `brew services start mailpit` pour le lancer en tâche de fond.
  - Linux (et macOS) : `sudo sh < <(curl -sL https://raw.githubusercontent.com/axllent/mailpit/develop/install.sh)`.
  - Lancement : `mailpit` dans un terminal. Il reçoit les e-mails sur le port SMTP **1025** et les affiche sur **http://localhost:8025**.
- Pour le site en ligne, un compte SMTP :
  - **En formation** : le compte Gmail du formateur, créé pour ses formations, avec la validation en deux étapes. Le formateur crée **un mot de passe d'application par stagiaire** sur https://myaccount.google.com/apppasswords et le lui transmet hors de Claude. Le stagiaire le colle lui-même dans `.env`, puis dans Vercel. En fin de session, le formateur révoque ces mots de passe un par un.
  - **Pour un vrai lancement** : le SMTP d'un fournisseur, avec le nom de domaine du projet. Infomaniak (suisse) : `mail.infomaniak.com`, port 587, identifiant = l'adresse e-mail complète. Brevo (français) : `smtp-relay.brevo.com`, port 587, identifiant = l'adresse du compte Brevo, mot de passe = une clé SMTP créée dans « SMTP & API ».

## Variables d'environnement

| Nom | Rôle | En local (Mailpit) | En formation (Gmail) |
|---|---|---|---|
| `SMTP_HOST` | Serveur SMTP | `localhost` | `smtp.gmail.com` |
| `SMTP_PORT` | Port | `1025` | `587` |
| `SMTP_USER` | Identifiant | vide | l'adresse Gmail du formateur |
| `SMTP_PASSWORD` | Mot de passe | vide | le mot de passe d'application du stagiaire (`VOTRE_MOT_DE_PASSE_ICI`) |
| `MAIL_FROM` | Expéditeur affiché | `Mon projet <ne-pas-repondre@exemple.fr>` | `Mon projet <adresse.du.formateur@gmail.com>` |

Ajouter ces lignes au schéma de `src/lib/env.ts` :

```ts
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(1),
```

Ajouter les cinq noms, **sans valeur**, à `.env.example` :

```
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
```

Dans Vercel, les saisir pour Production et Preview.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/lib/env.ts`, `.env.example` (modifiés) | Les cinq variables SMTP |
| `src/lib/email.ts` | `envoyerEmail({ a, sujet, texte, html })` : la seule porte de sortie des e-mails |
| `src/features/compte/emails.ts` | Contenus des e-mails du compte (fonctions pures) |
| `src/lib/auth.ts` (modifié) | Vérification d'adresse, mot de passe oublié, e-mail « compte existant » |
| `src/features/compte/schemas.ts` (modifié) | `schemaMotDePasseOublie`, `schemaNouveauMotDePasse`, `schemaChoixMotDePasse` |
| `src/features/compte/actions.ts` (modifié) | `inscrire` et `connecter` adaptés ; `demanderNouveauMotDePasse`, `choisirNouveauMotDePasse` |
| `src/features/compte/components/formulaire-inscription.tsx`, `formulaire-connexion.tsx` (modifiés) | Message « Ouvrez l'e-mail », lien « Mot de passe oublié ? » |
| `src/features/compte/components/formulaire-mot-de-passe-oublie.tsx`, `formulaire-nouveau-mot-de-passe.tsx` | Les deux nouveaux formulaires |
| `src/app/(public)/mot-de-passe-oublie/page.tsx`, `src/app/(public)/nouveau-mot-de-passe/page.tsx` | Les deux nouvelles pages |
| `src/features/compte/emails.test.ts`, `src/lib/auth-email.test.ts` | Tests unitaires et d'intégration |
| `src/lib/auth.test.ts` (modifié) | Tests de la recette `connexion` adaptés à la vérification d'adresse |
| `e2e/aides/mailpit.ts`, `e2e/aides/connexion.ts` (modifié), `e2e/email.spec.ts` | Lecture de Mailpit dans Playwright |

## Étapes

Le parcours une fois la recette en place :

1. Camille s'inscrit : l'écran affiche « Compte créé. Ouvrez l'e-mail… ». Aucune session n'est ouverte.
2. Elle clique sur le lien de l'e-mail (`/api/auth/verify-email?token=…`) : better-auth confirme l'adresse, ouvre la session et l'envoie sur `/compte`.
3. Si elle se connecte avant de confirmer, la connexion est refusée et un nouvel e-mail de confirmation part.
4. Mot de passe oublié : elle reçoit un lien `/api/auth/reset-password/<jeton>` ; better-auth la renvoie sur `/nouveau-mot-de-passe?token=…` (ou `?error=INVALID_TOKEN` si le lien a expiré), où elle choisit un nouveau mot de passe.

### 1. Mailpit et les variables

Lancer `mailpit`, ouvrir http://localhost:8025 (la boîte est vide). Remplir `.env` avec les valeurs « En local », compléter `src/lib/env.ts` et `.env.example`.

### 2. L'envoi

```ts
// src/lib/email.ts
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { envServeur } from "@/lib/env";
import { logger } from "@/lib/logger";

export type MessageEmail = {
  a: string;
  sujet: string;
  texte: string;
  html?: string;
};

let transporteur: Transporter | undefined;

function obtenirTransporteur(): Transporter {
  if (!transporteur) {
    const env = envServeur();
    transporteur = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // 465 : chiffrement dès la connexion. 587 : chiffrement STARTTLS, exigé ci-dessous.
      secure: env.SMTP_PORT === 465,
      requireTLS: env.SMTP_PORT === 587,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporteur;
}

/** La seule porte de sortie des e-mails de l'application. */
export async function envoyerEmail({
  a,
  sujet,
  texte,
  html,
}: MessageEmail): Promise<void> {
  const env = envServeur();
  const info = await obtenirTransporteur().sendMail({
    from: env.MAIL_FROM,
    to: a,
    subject: sujet,
    text: texte,
    html,
  });
  // Journal sans l'adresse du destinataire (donnée personnelle).
  logger.info({ messageId: info.messageId, sujet }, "E-mail envoyé");
}
```

`secure: true` seulement pour le port 465 ; sur 587, Nodemailer passe en chiffré par STARTTLS, et `requireTLS` refuse d'envoyer en clair. Avec Mailpit (port 1025), ni chiffrement ni identifiant.

### 3. Les contenus des e-mails

```ts
// src/features/compte/emails.ts
// Contenus des e-mails du compte : fonctions pures, testées en unitaire.

export type ContenuEmail = { sujet: string; texte: string; html: string };

type Lien = { libelle: string; url: string };

export function echapperHtml(valeur: string): string {
  return valeur
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Chaque valeur passe par echapperHtml : un nom saisi s'affiche comme du texte.
function composer(
  sujet: string,
  paragraphes: string[],
  lien?: Lien,
): ContenuEmail {
  const corps = paragraphes.map((p) => `<p>${echapperHtml(p)}</p>`).join("");
  const bouton = lien
    ? `<p><a href="${echapperHtml(lien.url)}">${echapperHtml(lien.libelle)}</a></p>`
    : "";
  return {
    sujet,
    texte: [...paragraphes, ...(lien ? [lien.url] : [])].join("\n\n"),
    html: `<!doctype html><html lang="fr"><body style="font-family:sans-serif;line-height:1.5"><h1 style="font-size:20px">${echapperHtml(sujet)}</h1>${corps}${bouton}</body></html>`,
  };
}

export function emailVerificationAdresse({
  nom,
  url,
}: {
  nom: string;
  url: string;
}): ContenuEmail {
  return composer(
    "Confirmez votre adresse e-mail",
    [
      `Bonjour ${nom},`,
      "Cliquez sur le lien ci-dessous pour confirmer votre adresse. Le lien reste valable 24 heures.",
      "Si vous n'avez pas créé de compte, ignorez cet e-mail.",
    ],
    { libelle: "Confirmer mon adresse", url },
  );
}

export function emailMotDePasseOublie({
  nom,
  url,
}: {
  nom: string;
  url: string;
}): ContenuEmail {
  return composer(
    "Choisissez un nouveau mot de passe",
    [
      `Bonjour ${nom},`,
      "Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe. Le lien reste valable 1 heure.",
      "Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe reste le même.",
    ],
    { libelle: "Choisir un nouveau mot de passe", url },
  );
}

export function emailCompteExistant({ nom }: { nom: string }): ContenuEmail {
  return composer("Votre compte existe déjà", [
    `Bonjour ${nom},`,
    "Quelqu'un vient de créer un compte avec votre adresse, qui en a déjà un.",
    "Si c'est vous : connectez-vous, ou choisissez « Mot de passe oublié » sur la page de connexion. Sinon, ignorez cet e-mail.",
  ]);
}
```

### 4. better-auth

Remplacer `src/lib/auth.ts` par :

```ts
// src/lib/auth.ts
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { type Db, getDb } from "@/db";
import * as schema from "@/db/schema";
import {
  emailCompteExistant,
  emailMotDePasseOublie,
  emailVerificationAdresse,
} from "@/features/compte/emails";
import { envoyerEmail } from "@/lib/email";
import { envServeur } from "@/lib/env";

type OptionsAuth = {
  secret: string;
  baseURL: string;
  /** Application : l'e-mail part après la réponse. Tests : absent, l'envoi est attendu. */
  tacheDeFond?: (promesse: Promise<unknown>) => void;
};

/** Crée better-auth sur une base donnée : Neon dans l'application, PGlite dans les tests. */
export function creerAuth(db: Db, options: OptionsAuth) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
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
        await envoyerEmail({
          a: user.email,
          ...emailMotDePasseOublie({ nom: user.name, url }),
        });
      },
      // Inscription avec une adresse déjà prise : même réponse à l'écran, e-mail à sa propriétaire.
      onExistingUserSignUp: async ({ user }) => {
        await envoyerEmail({
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
        await envoyerEmail({
          a: user.email,
          ...emailVerificationAdresse({ nom: user.name, url }),
        });
      },
    },
    // Ces écritures passent seulement par les actions validées de src/features/compte/actions.ts.
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
    const env = envServeur();
    instance = creerAuth(getDb(), {
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
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
 * La requête est lue avant getAuth() : `next build` passe ainsi sans variables d'environnement.
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

### 5. Les schémas

Ajouter à la fin de `src/features/compte/schemas.ts` (la constante `motDePasse` y existe déjà) :

```ts
// Ajouts de la recette email.
export const schemaMotDePasseOublie = z.object({
  email: z.email("Adresse e-mail invalide.").max(254),
});

const champsNouveauMotDePasse = z.object({
  nouveauMotDePasse: motDePasse,
  confirmation: z.string(),
});

const memesMotsDePasse = {
  verifier: (v: { nouveauMotDePasse: string; confirmation: string }) =>
    v.nouveauMotDePasse === v.confirmation,
  erreur: {
    message: "Les deux mots de passe sont différents.",
    path: ["confirmation"],
  },
};

/** Formulaire « Nouveau mot de passe » (le jeton vient de l'adresse, pas d'un champ). */
export const schemaNouveauMotDePasse = champsNouveauMotDePasse.refine(
  memesMotsDePasse.verifier,
  memesMotsDePasse.erreur,
);

/** Action « Nouveau mot de passe » : les champs du formulaire et le jeton reçu par e-mail. */
export const schemaChoixMotDePasse = champsNouveauMotDePasse
  .extend({ token: z.string().min(1).max(200) })
  .refine(memesMotsDePasse.verifier, memesMotsDePasse.erreur);
```

### 6. Les actions

Remplacer `src/features/compte/actions.ts` par la version ci-dessous. Changements : `inscrire` renvoie un message au lieu de rediriger, et passe `callbackURL` ; `connecter` traduit `EMAIL_NOT_VERIFIED` ; deux actions nouvelles. Si la recette `limite` est déjà appliquée, garder ses lignes `await exigerLimite(…)` en tête de `inscrire`, `connecter`, et ajouter `await exigerLimite("motDePasseOublie");` en tête de `demanderNouveauMotDePasse`.

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
  schemaChoixMotDePasse,
  schemaConnexion,
  schemaInscription,
  schemaMotDePasseOublie,
} from "./schemas";

// Même réponse que l'adresse soit libre ou déjà prise : personne ne peut tester les comptes.
export const inscrire = actionPublique
  .inputSchema(schemaInscription)
  .action(async ({ parsedInput }) => {
    await getAuth().api.signUpEmail({
      body: {
        name: parsedInput.nom,
        email: parsedInput.email,
        password: parsedInput.motDePasse,
        callbackURL: "/compte",
      },
      headers: await headers(),
    });
    return {
      message:
        "Compte créé. Ouvrez l'e-mail que nous venons d'envoyer pour confirmer votre adresse.",
    };
  });

export const connecter = actionPublique
  .inputSchema(schemaConnexion)
  .action(async ({ parsedInput }) => {
    try {
      await getAuth().api.signInEmail({
        body: {
          email: parsedInput.email,
          password: parsedInput.motDePasse,
          callbackURL: "/compte",
        },
        headers: await headers(),
      });
    } catch (erreur) {
      if (erreur instanceof APIError && erreur.status === "UNAUTHORIZED") {
        returnServerError("Adresse e-mail ou mot de passe incorrect.");
      }
      if (
        erreur instanceof APIError &&
        erreur.body?.code === "EMAIL_NOT_VERIFIED"
      ) {
        returnServerError(
          "Adresse pas encore confirmée : un nouvel e-mail vient de partir.",
        );
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

// Même réponse que l'adresse existe ou non : personne ne peut tester les comptes.
export const demanderNouveauMotDePasse = actionPublique
  .inputSchema(schemaMotDePasseOublie)
  .action(async ({ parsedInput }) => {
    await getAuth().api.requestPasswordReset({
      body: { email: parsedInput.email, redirectTo: "/nouveau-mot-de-passe" },
      headers: await headers(),
    });
    return {
      message:
        "Si un compte existe pour cette adresse, un e-mail vient de partir. Pensez à regarder vos indésirables.",
    };
  });

export const choisirNouveauMotDePasse = actionPublique
  .inputSchema(schemaChoixMotDePasse)
  .action(async ({ parsedInput }) => {
    try {
      await getAuth().api.resetPassword({
        body: {
          token: parsedInput.token,
          newPassword: parsedInput.nouveauMotDePasse,
        },
        headers: await headers(),
      });
    } catch (erreur) {
      if (erreur instanceof APIError && erreur.body?.code === "INVALID_TOKEN") {
        returnServerError(
          "Ce lien n'est plus valable. Demandez un nouveau lien depuis « Mot de passe oublié ».",
        );
      }
      throw erreur;
    }
    return { message: "Mot de passe modifié. Connectez-vous." };
  });
```

### 7. Les formulaires existants

Dans `src/features/compte/components/formulaire-inscription.tsx`, juste avant `{result.serverError && (`, afficher le message de l'action :

```tsx
        {result.data && (
          <p role="status" className="text-sm">
            {result.data.message}
          </p>
        )}
```

Dans `src/features/compte/components/formulaire-connexion.tsx`, après le lien « Créer un compte » :

```tsx
          {" · "}
          <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
```

### 8. Les deux nouveaux formulaires

```tsx
// src/features/compte/components/formulaire-mot-de-passe-oublie.tsx
"use client";

import { useForm } from "@tanstack/react-form";
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
import { demanderNouveauMotDePasse } from "../actions";
import { schemaMotDePasseOublie } from "../schemas";

export function FormulaireMotDePasseOublie() {
  const prefixe = useId();
  const { executeAsync, result, isPending } = useAction(
    demanderNouveauMotDePasse,
  );

  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: schemaMotDePasseOublie },
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
        <form.Field name="email">
          {(field) => {
            const invalide =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={`${prefixe}-email`}>
                  Adresse e-mail
                </FieldLabel>
                <Input
                  id={`${prefixe}-email`}
                  name={field.name}
                  type="email"
                  autoComplete="email"
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

        {result.serverError && (
          <p role="alert" className="text-sm text-destructive">
            {result.serverError}
          </p>
        )}
        {result.data && (
          <p role="status" className="text-sm text-muted-foreground">
            {result.data.message}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Envoi…" : "Recevoir un lien"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

```tsx
// src/features/compte/components/formulaire-nouveau-mot-de-passe.tsx
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
import { choisirNouveauMotDePasse } from "../actions";
import { schemaNouveauMotDePasse } from "../schemas";

const champs = [
  { name: "nouveauMotDePasse", label: "Nouveau mot de passe" },
  { name: "confirmation", label: "Confirmez le nouveau mot de passe" },
] as const;

export function FormulaireNouveauMotDePasse({ token }: { token: string }) {
  const prefixe = useId();
  const { executeAsync, result, isPending } = useAction(
    choisirNouveauMotDePasse,
  );

  const form = useForm({
    defaultValues: { nouveauMotDePasse: "", confirmation: "" },
    validators: { onSubmit: schemaNouveauMotDePasse },
    onSubmit: async ({ value }) => {
      await executeAsync({ ...value, token });
    },
  });

  if (result.data) {
    return (
      <p role="status">
        {result.data.message}{" "}
        <Link href="/connexion" className="underline">
          Se connecter
        </Link>
      </p>
    );
  }

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
                    autoComplete="new-password"
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
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

### 9. Les deux nouvelles pages

```tsx
// src/app/(public)/mot-de-passe-oublie/page.tsx
import type { Metadata } from "next";
import { FormulaireMotDePasseOublie } from "@/features/compte/components/formulaire-mot-de-passe-oublie";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function PageMotDePasseOublie() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-2 text-2xl font-semibold">Mot de passe oublié</h1>
      <p className="mb-6 text-muted-foreground">
        Indiquez votre adresse : vous recevrez un lien pour choisir un nouveau
        mot de passe.
      </p>
      <FormulaireMotDePasseOublie />
    </main>
  );
}
```

```tsx
// src/app/(public)/nouveau-mot-de-passe/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormulaireNouveauMotDePasse } from "@/features/compte/components/formulaire-nouveau-mot-de-passe";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

// better-auth renvoie ici avec ?token=… (lien valable) ou ?error=INVALID_TOKEN (lien expiré).
// Le titre fait partie de la coquille statique ; la lecture de l'adresse vit sous Suspense.
export default function PageNouveauMotDePasse({
  searchParams,
}: PageProps<"/nouveau-mot-de-passe">) {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">Nouveau mot de passe</h1>
      <Suspense fallback={<p className="text-muted-foreground">Chargement…</p>}>
        <Contenu searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Contenu({
  searchParams,
}: Pick<PageProps<"/nouveau-mot-de-passe">, "searchParams">) {
  const { token, error } = await searchParams;
  if (error || typeof token !== "string") {
    return (
      <p>
        Ce lien n'est plus valable.{" "}
        <Link href="/mot-de-passe-oublie" className="underline">
          Demander un nouveau lien
        </Link>
      </p>
    );
  }
  return <FormulaireNouveauMotDePasse token={token} />;
}
```

### 10. Les tests de la recette `connexion`

Avec la vérification d'adresse, deux tests de `src/lib/auth.test.ts` changent :

1. Après les imports, ajouter `vi` à l'import de `vitest`, `user` à l'import de `@/db/schema`, puis doubler l'envoi :

```ts
// Recette email : aucun e-mail ne part pendant les tests.
vi.mock("@/lib/email", () => ({ envoyerEmail: vi.fn(async () => {}) }));
```

2. Dans `inscrireCamille`, confirmer l'adresse après l'inscription :

```ts
  async function inscrireCamille() {
    const resultat = await auth.api.signUpEmail({
      body: {
        name: "Camille Martin",
        email: "camille@exemple.fr",
        password: "motdepasse-solide",
      },
    });
    // Recette email : Camille a cliqué sur le lien de confirmation.
    await db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.email, "camille@exemple.fr"));
    return resultat;
  }
```

3. Remplacer le test « une deuxième inscription avec la même adresse est refusée » (elle reçoit désormais la même réponse) par :

```ts
  it("US-XXX-2 – une deuxième inscription avec la même adresse ne crée pas de second compte", async () => {
    await inscrireCamille();
    await inscrireCamille();
    const comptes = await db
      .select()
      .from(user)
      .where(eq(user.email, "camille@exemple.fr"));
    expect(comptes).toHaveLength(1);
  });
```

   Dans la spec, l'exemple « Une adresse déjà utilisée est refusée » de la recette `connexion` devient : « Une adresse déjà utilisée reçoit la même réponse, sans second compte ».

### 11. Essayer en local

`npm run dev`, s'inscrire, ouvrir http://localhost:8025, cliquer sur le lien : « Mon compte » s'affiche. Puis se déconnecter et tester « Mot de passe oublié ? ».

### 12. Mettre en ligne

Saisir les cinq variables dans Vercel (valeurs Gmail en formation, ou celles du fournisseur), puis redéployer. S'inscrire sur le site en ligne avec sa propre adresse : l'e-mail arrive.

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: E-mails du compte

  Règle: Une adresse est confirmée par un lien reçu par e-mail avant la première connexion

    @US-XXX-1 @bout-en-bout
    Exemple: Camille s'inscrit puis confirme son adresse : elle arrive sur son compte
      Étant donné aucun compte n'existe pour l'adresse de Camille
      Quand Camille s'inscrit puis clique sur le lien de l'e-mail reçu
      Alors la page « Mon compte » affiche « Connecté en tant que Camille Martin »

    @US-XXX-1 @integration @securite
    Exemple: Adresse non confirmée : la connexion est refusée et un nouvel e-mail part
      Étant donné Camille s'est inscrite sans cliquer sur le lien de confirmation
      Quand Camille se connecte avec son mot de passe
      Alors la connexion est refusée
      Et un nouvel e-mail « Confirmez votre adresse e-mail » part vers Camille

    @US-XXX-1 @integration
    Exemple: Adresse confirmée par le lien : la connexion est acceptée
      Étant donné Camille a cliqué sur le lien de confirmation
      Quand Camille se connecte avec son mot de passe
      Alors la connexion est acceptée

    @US-XXX-1 @unitaire
    Exemple: L'e-mail de Camille contient son lien de confirmation
      Étant donné un lien de confirmation pour Camille
      Quand l'e-mail de confirmation est préparé
      Alors son texte et son HTML contiennent ce lien

  Règle: Une inscription avec une adresse déjà prise ne révèle rien

    @US-XXX-2 @integration @securite
    Exemple: La propriétaire de l'adresse est prévenue par e-mail
      Étant donné Camille a un compte confirmé
      Quand quelqu'un s'inscrit avec l'adresse de Camille
      Alors Camille reçoit l'e-mail « Votre compte existe déjà »

  Règle: Un mot de passe oublié se remplace grâce à un lien valable 1 heure

    @US-XXX-3 @bout-en-bout
    Exemple: Camille choisit un nouveau mot de passe depuis l'e-mail reçu
      Étant donné Camille a un compte confirmé
      Quand Camille demande un lien, l'ouvre et choisit « nouveau-secret-42 »
      Alors Camille lit « Mot de passe modifié. Connectez-vous. »

    @US-XXX-3 @integration
    Exemple: Camille choisit un nouveau mot de passe et se connecte avec
      Étant donné Camille a un compte confirmé
      Quand Camille choisit « nouveau-secret-42 » avec le lien reçu
      Alors Camille se connecte avec « nouveau-secret-42 »

    @US-XXX-3 @integration @securite
    Exemple: Un lien déjà utilisé ne sert plus
      Étant donné Camille a déjà changé son mot de passe avec un lien
      Quand ce même lien sert une deuxième fois
      Alors le changement est refusé

    @US-XXX-3 @integration @securite
    Exemple: Une adresse inconnue reçoit la même réponse, sans e-mail
      Étant donné aucun compte n'existe pour « inconnu@exemple.fr »
      Quand quelqu'un demande un lien pour « inconnu@exemple.fr »
      Alors la réponse est la même que pour une adresse connue
      Et aucun e-mail ne part

  Règle: Un nom saisi s'affiche comme du texte dans l'e-mail

    @US-XXX-4 @unitaire @securite
    Exemple: Un nom contenant du HTML est neutralisé
      Étant donné une personne nommée « <img src=x onerror=alert(1)> »
      Quand l'e-mail de mot de passe oublié est préparé
      Alors le HTML de l'e-mail affiche ce nom comme du texte
```

## Tâches de plan prêtes

- [ ] **Tn – Envoyer des e-mails** · US-XXX
  - Objectif : l'application sait envoyer un e-mail, visible dans Mailpit
  - Dépend de : —
  - Fichiers : à créer : `src/lib/email.ts`, `src/features/compte/emails.ts`, `src/features/compte/emails.test.ts` · à modifier : `src/lib/env.ts`, `.env.example`
  - Vérification : US-XXX critères 1 et 4 – `npm test` passe
  - Tests : « L'e-mail de Camille contient son lien de confirmation » (unitaire) ; « Un nom contenant du HTML est neutralisé » (unitaire)
  - Action manuelle : installer et lancer Mailpit ; remplir les variables SMTP dans `.env`
- [ ] **Tn+1 – Confirmer l'adresse à l'inscription** · US-XXX
  - Objectif : une personne confirme son adresse par e-mail avant sa première connexion
  - Dépend de : Tn
  - Fichiers : à modifier : `src/lib/auth.ts`, `src/features/compte/actions.ts`, `formulaire-inscription.tsx`, `src/lib/auth.test.ts` · à créer : `src/lib/auth-email.test.ts`
  - Vérification : US-XXX critères 1 et 2 – s'inscrire, ouvrir l'e-mail dans Mailpit, cliquer : « Mon compte » s'affiche
  - Tests : « Adresse non confirmée : la connexion est refusée… », « Adresse confirmée par le lien… », « La propriétaire de l'adresse est prévenue par e-mail » (intégration)
  - Attention : les comptes créés avant cette tâche n'ont pas d'adresse confirmée ; les supprimer de la base de développement
- [ ] **Tn+2 – Remplacer un mot de passe oublié** · US-XXX
  - Objectif : une personne qui a oublié son mot de passe en choisit un nouveau
  - Dépend de : Tn+1
  - Fichiers : à modifier : `src/features/compte/schemas.ts`, `formulaire-connexion.tsx` · à créer : `formulaire-mot-de-passe-oublie.tsx`, `formulaire-nouveau-mot-de-passe.tsx`, les pages `/mot-de-passe-oublie` et `/nouveau-mot-de-passe`
  - Vérification : US-XXX critère 3 – demander un lien, l'ouvrir depuis Mailpit, choisir un mot de passe, se connecter avec
  - Tests : « Camille choisit un nouveau mot de passe et se connecte avec », « Un lien déjà utilisé ne sert plus », « Une adresse inconnue reçoit la même réponse, sans e-mail » (intégration)
- [ ] **Tn+3 – Parcours de bout en bout avec Mailpit** · US-XXX
  - Objectif : les parcours avec e-mail sont vérifiés automatiquement
  - Dépend de : Tn+2
  - Fichiers : à créer : `e2e/aides/mailpit.ts`, `e2e/email.spec.ts` · à modifier : `e2e/aides/connexion.ts`
  - Vérification : US-XXX critères 1 et 3 – Mailpit lancé, `npm run test:e2e` passe
  - Tests : « Camille s'inscrit puis confirme son adresse », « Camille choisit un nouveau mot de passe depuis l'e-mail reçu » (bout en bout)
- [ ] **Tn+4 – Envoyer les e-mails du site en ligne** · US-XXX
  - Objectif : le site en ligne envoie de vrais e-mails
  - Dépend de : Tn+3
  - Fichiers : aucun
  - Vérification : US-XXX critère 1 – s'inscrire sur le site en ligne avec sa propre adresse : l'e-mail arrive
  - Action manuelle : saisir `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` dans Vercel (Production et Preview), puis redéployer

## Tests

### Unitaires

```ts
// src/features/compte/emails.test.ts
import { describe, expect, it } from "vitest";
import { emailMotDePasseOublie, emailVerificationAdresse } from "./emails";

describe("E-mails de compte", () => {
  describe("Une adresse est confirmée par un lien reçu par e-mail avant la première connexion", () => {
    it("US-XXX-1 – L'e-mail de Camille contient son lien de confirmation", () => {
      const url =
        "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2Fcompte";

      const contenu = emailVerificationAdresse({ nom: "Camille", url });

      expect(contenu.sujet).toBe("Confirmez votre adresse e-mail");
      expect(contenu.texte).toContain(url);
      expect(contenu.html).toContain("token=abc&amp;callbackURL=%2Fcompte");
    });
  });

  describe("Un nom saisi s'affiche comme du texte dans l'e-mail", () => {
    it("US-XXX-4 – Un nom contenant du HTML est neutralisé", () => {
      const contenu = emailMotDePasseOublie({
        nom: "<img src=x onerror=alert(1)>",
        url: "http://localhost:3000/api/auth/reset-password/abc",
      });

      expect(contenu.html).not.toContain("<img");
      expect(contenu.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    });
  });
});
```

### Intégration (Vitest + PGlite)

better-auth tourne sur une base PGlite neuve ; `@/lib/email` est doublé et garde les messages au lieu de les envoyer. Les liens et jetons viennent des e-mails gardés, comme pour une vraie personne.

```ts
// src/lib/auth-email.test.ts
import { APIError } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageEmail } from "@/lib/email";
import { creerBaseDeTest } from "../../tests/helpers/base-de-test";
import { creerAuth } from "./auth";

// Doublure du service d'e-mail : les messages sont gardés au lieu de partir.
const envoyes = vi.hoisted(() => [] as MessageEmail[]);
vi.mock("@/lib/email", () => ({
  envoyerEmail: vi.fn(async (message: MessageEmail) => {
    envoyes.push(message);
  }),
}));

const optionsDeTest = {
  secret: "secret-de-test-secret-de-test-secret-de-test",
  baseURL: "http://localhost:3000",
};

function createSut() {
  let auth: ReturnType<typeof creerAuth>;
  let fermer: () => Promise<void>;
  let erreur: unknown;
  let reponse: unknown;

  function dernierLien(a: string): string {
    const message = envoyes.findLast((m) => m.a === a);
    const lien = message?.texte.match(/https?:\/\/\S+/)?.[0];
    if (!lien) throw new Error(`Aucun lien envoyé à ${a}`);
    return lien;
  }

  function jetonDuLien(lien: string): string {
    const jeton = new URL(lien).pathname.split("/").pop();
    if (!jeton) throw new Error("Lien sans jeton");
    return jeton;
  }

  return {
    async demarrer() {
      envoyes.length = 0;
      const base = await creerBaseDeTest();
      fermer = base.fermer;
      auth = creerAuth(base.db, optionsDeTest);
    },
    arreter: () => fermer(),
    async givenCompte(email: string, motDePasse: string, confirme: boolean) {
      await auth.api.signUpEmail({
        body: { name: "Camille Martin", email, password: motDePasse },
      });
      if (confirme) {
        const token = new URL(dernierLien(email)).searchParams.get("token");
        await auth.api.verifyEmail({ query: { token: token ?? "" } });
      }
    },
    async whenSeConnecte(email: string, motDePasse: string) {
      erreur = await auth.api
        .signInEmail({ body: { email, password: motDePasse } })
        .then(() => undefined)
        .catch((e: unknown) => e);
    },
    async whenDemandeUnLien(email: string) {
      reponse = await auth.api.requestPasswordReset({
        body: { email, redirectTo: "/nouveau-mot-de-passe" },
      });
    },
    async whenChoisitNouveauMotDePasse(email: string, motDePasse: string) {
      const token = jetonDuLien(dernierLien(email).split("?")[0]);
      erreur = await auth.api
        .resetPassword({ body: { token, newPassword: motDePasse } })
        .then(() => undefined)
        .catch((e: unknown) => e);
      return token;
    },
    async whenReutiliseLeJeton(token: string, motDePasse: string) {
      erreur = await auth.api
        .resetPassword({ body: { token, newPassword: motDePasse } })
        .then(() => undefined)
        .catch((e: unknown) => e);
    },
    thenRefuseAvecLeCode(code: string) {
      expect(erreur).toBeInstanceOf(APIError);
      expect((erreur as APIError).body?.code).toBe(code);
    },
    thenAccepte() {
      expect(erreur).toBeUndefined();
    },
    thenDernierEmailA(a: string, sujet: string) {
      expect(envoyes.findLast((m) => m.a === a)?.sujet).toBe(sujet);
    },
    thenAucunEmailA(a: string) {
      expect(envoyes.filter((m) => m.a === a)).toHaveLength(0);
    },
    thenReponseGenerique() {
      expect(reponse).toMatchObject({ status: true });
    },
  };
}

describe("E-mails de compte", () => {
  let sut: ReturnType<typeof createSut>;
  beforeEach(async () => {
    sut = createSut();
    await sut.demarrer();
  });
  afterEach(async () => {
    await sut.arreter();
  });

  describe("Une adresse est confirmée par un lien reçu par e-mail avant la première connexion", () => {
    it("US-XXX-1 – Adresse non confirmée : la connexion est refusée et un nouvel e-mail part", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", false);
      await sut.whenSeConnecte("camille@exemple.fr", "motdepasse-solide");
      sut.thenRefuseAvecLeCode("EMAIL_NOT_VERIFIED");
      sut.thenDernierEmailA(
        "camille@exemple.fr",
        "Confirmez votre adresse e-mail",
      );
    });

    it("US-XXX-1 – Adresse confirmée par le lien : la connexion est acceptée", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.whenSeConnecte("camille@exemple.fr", "motdepasse-solide");
      sut.thenAccepte();
    });
  });

  describe("Une inscription avec une adresse déjà prise ne révèle rien", () => {
    it("US-XXX-2 – La propriétaire de l'adresse est prévenue par e-mail", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.givenCompte("camille@exemple.fr", "autre-mot-de-passe", false);
      sut.thenDernierEmailA("camille@exemple.fr", "Votre compte existe déjà");
    });
  });

  describe("Un mot de passe oublié se remplace grâce à un lien valable 1 heure", () => {
    it("US-XXX-3 – Camille choisit un nouveau mot de passe et se connecte avec", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.whenDemandeUnLien("camille@exemple.fr");
      await sut.whenChoisitNouveauMotDePasse(
        "camille@exemple.fr",
        "nouveau-secret-42",
      );
      await sut.whenSeConnecte("camille@exemple.fr", "nouveau-secret-42");
      sut.thenAccepte();
    });

    it("US-XXX-3 – Un lien déjà utilisé ne sert plus", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.whenDemandeUnLien("camille@exemple.fr");
      const token = await sut.whenChoisitNouveauMotDePasse(
        "camille@exemple.fr",
        "nouveau-secret-42",
      );
      await sut.whenReutiliseLeJeton(token, "encore-un-autre-42");
      sut.thenRefuseAvecLeCode("INVALID_TOKEN");
    });

    it("US-XXX-3 – Une adresse inconnue reçoit la même réponse, sans e-mail", async () => {
      await sut.whenDemandeUnLien("inconnu@exemple.fr");
      sut.thenReponseGenerique();
      sut.thenAucunEmailA("inconnu@exemple.fr");
    });
  });
});
```

### Bout en bout (Playwright + Mailpit)

Mailpit doit tourner, et le serveur lancé par Playwright doit utiliser `SMTP_HOST=localhost` et `SMTP_PORT=1025` (valeurs de `.env` en local). En CI, ajouter le conteneur `axllent/mailpit` comme service, ports 1025 et 8025. Chaque test utilise une adresse unique : les tests restent indépendants sans vider Mailpit.

L'aide lit l'API REST de Mailpit (`GET /api/v1/search?query=to:"…"`, résultats du plus récent au plus ancien ; `GET /api/v1/message/{ID}`, champs `Subject`, `Text`, `HTML`) :

```ts
// e2e/aides/mailpit.ts
// Lecture des e-mails capturés par Mailpit (API REST, http://localhost:8025 par défaut).
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

type Resume = { ID: string; Subject: string };
export type EmailRecu = { Subject: string; Text: string; HTML: string };

/** Attend l'e-mail de ce sujet reçu par cette adresse (10 secondes au plus). */
export async function emailPour(
  adresse: string,
  sujet: string,
  delaiMs = 10_000,
): Promise<EmailRecu> {
  const limite = Date.now() + delaiMs;
  const recherche = encodeURIComponent(`to:"${adresse}"`);
  while (Date.now() < limite) {
    const reponse = await fetch(`${MAILPIT}/api/v1/search?query=${recherche}`);
    // Résultats triés du plus récent au plus ancien.
    const { messages } = (await reponse.json()) as { messages: Resume[] };
    const trouve = messages.find((m) => m.Subject === sujet);
    if (trouve) {
      const detail = await fetch(`${MAILPIT}/api/v1/message/${trouve.ID}`);
      return (await detail.json()) as EmailRecu;
    }
    await new Promise((resoudre) => setTimeout(resoudre, 250));
  }
  throw new Error(`Aucun e-mail « ${sujet} » reçu par ${adresse} dans Mailpit`);
}

export function premierLien(texte: string): string {
  const lien = texte.match(/https?:\/\/\S+/)?.[0];
  if (!lien) {
    throw new Error("Aucun lien dans l'e-mail");
  }
  return lien;
}
```

`e2e/aides/connexion.ts` remplace celui de la recette `connexion` : un nouveau compte confirme son adresse avant d'arriver sur « Mon compte ». Les tests qui appellent `connecterNouvelUtilisateur` continuent de fonctionner.

```ts
// e2e/aides/connexion.ts
import { expect, type Page } from "@playwright/test";
import { emailPour, premierLien } from "./mailpit";

export const MOT_DE_PASSE_DE_TEST = "motdepasse-de-test";

/**
 * Champ visible désigné par son libellé exact.
 * Next.js garde les pages déjà visitées, cachées, dans la page : sans `visible: true`,
 * un libellé présent sur deux pages désigne deux champs.
 */
export function champ(page: Page, libelle: string) {
  return page.getByLabel(libelle, { exact: true }).filter({ visible: true });
}

/** Crée un compte neuf (adresse unique) sans confirmer l'adresse. */
export async function inscrireNouvelUtilisateur(
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
  await expect(page.getByText(/Ouvrez l'e-mail/)).toBeVisible();
  return { nom, email, motDePasse: MOT_DE_PASSE_DE_TEST };
}

/** Crée un compte neuf, confirme l'adresse avec le lien reçu dans Mailpit, et attend « Mon compte ». */
export async function connecterNouvelUtilisateur(
  page: Page,
  nom = "Camille Martin",
) {
  const compte = await inscrireNouvelUtilisateur(page, nom);
  const email = await emailPour(compte.email, "Confirmez votre adresse e-mail");
  await page.goto(premierLien(email.Text));
  await expect(page).toHaveURL(/\/compte$/);
  return compte;
}
```

```ts
// e2e/email.spec.ts
import { expect, test } from "@playwright/test";
import { champ, connecterNouvelUtilisateur } from "./aides/connexion";
import { emailPour, premierLien } from "./aides/mailpit";

test.describe("E-mails de compte", () => {
  test("US-XXX-1 – Camille s'inscrit puis confirme son adresse : elle arrive sur son compte", async ({
    page,
  }) => {
    await connecterNouvelUtilisateur(page, "Camille Martin");

    await expect(
      page.getByText("Connecté en tant que Camille Martin"),
    ).toBeVisible();
  });

  test("US-XXX-3 – Camille choisit un nouveau mot de passe depuis l'e-mail reçu", async ({
    page,
  }) => {
    const { email } = await connecterNouvelUtilisateur(page);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    await champ(page, "Adresse e-mail").fill(email);
    await page.getByRole("button", { name: "Recevoir un lien" }).click();
    await expect(page.getByText(/Si un compte existe/)).toBeVisible();
    const recu = await emailPour(email, "Choisissez un nouveau mot de passe");
    await page.goto(premierLien(recu.Text));
    await champ(page, "Nouveau mot de passe").fill("nouveau-secret-42");
    await champ(page, "Confirmez le nouveau mot de passe").fill(
      "nouveau-secret-42",
    );
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await expect(
      page.getByText("Mot de passe modifié. Connectez-vous."),
    ).toBeVisible();
  });
});
```

## Points de sécurité

- **S1 – Secrets hors du code** : `SMTP_PASSWORD` vit dans `.env` et dans Vercel ; le mot de passe d'application passe du formateur au stagiaire hors de Claude.
- **S2 – Clés côté client** : aucune variable `NEXT_PUBLIC_` ; `src/lib/email.ts` commence par `import "server-only"`.
- **S5 – Validation des entrées** : chaque formulaire passe par un schéma Zod dans son action ; `disabledPaths` ferme les adresses HTTP de demande de lien et de choix du mot de passe.
- **S6 – Affichage sans injection** : chaque valeur insérée dans le HTML d'un e-mail passe par `echapperHtml`.
- **S9 – Données personnelles** : le journal note l'identifiant du message et le sujet, sans adresse ni lien (le lien contient un jeton).
- **S10 – Abus et coûts** : inscription et « mot de passe oublié » déclenchent des e-mails à la demande d'un inconnu. Appliquer la recette `limite` avant l'ouverture au public. En formation, les 500 destinataires par jour de Gmail sont partagés par tout le groupe : Mailpit pour tous les essais, Gmail seulement pour le site en ligne.
- **S11 – Messages d'erreur** : inscription et « mot de passe oublié » répondent la même chose qu'un compte existe ou non ; l'envoi part après la réponse (`after()`).
- Liens à usage unique et courts : 24 heures pour la confirmation, 1 heure pour le mot de passe ; un nouveau mot de passe ferme les autres sessions.

## Pièges connus

- **Port 25 bloqué par Vercel** : utiliser 587 (STARTTLS) ou 465 (chiffré dès la connexion). `src/lib/email.ts` règle `secure` d'après le port.
- **Mailpit éteint** : l'envoi échoue en silence côté écran (better-auth journalise « Failed to run background task »). Lancer `mailpit` avant `npm run dev` et avant `npm run test:e2e`.
- **Gmail** : le mot de passe d'application exige la validation en deux étapes. Changer le mot de passe du compte Google révoque d'un coup tous les mots de passe d'application. L'expéditeur reste l'adresse Gmail. Un mot de passe d'application ouvre aussi la lecture de la boîte : elle doit contenir seulement des e-mails de formation. Google peut bloquer des connexions venues de nombreux endroits à la fois, et déconseille les mots de passe d'application pour un service en production.
- **Comptes créés avant la recette** : leur adresse n'est pas confirmée ; ils ne peuvent plus se connecter. En développement, les supprimer. En ligne, la connexion leur envoie un e-mail de confirmation (`sendOnSignIn`).
- **`authClient.forgetPassword` ou `requestPasswordReset` répond 404** : ces adresses sont fermées par `disabledPaths`. Passer par les actions `demanderNouveauMotDePasse` et `choisirNouveauMotDePasse`.
- **`after()` hors d'une requête** : `tacheDeFond` reste absent dans `creerAuth` pour les tests ; seul `getAuth()` le fournit.
- **E-mails rangés dans les indésirables** : avec un domaine à soi, configurer SPF, DKIM et DMARC chez le fournisseur.
- **`@types/nodemailer`** : il entre en conflit avec les types fournis par Nodemailer 10 ; le désinstaller.
- **Langues** : avec la recette `langues`, les deux nouvelles pages vont sous `src/app/[locale]/(public)/`, et leur `PageProps` prend la clé `"/[locale]/nouveau-mot-de-passe"`.

## Sources

- better-auth 1.7.7, types et code du paquet installé : `@better-auth/core/dist/types/init-options.d.mts` (`emailVerification`, `emailAndPassword`, `onExistingUserSignUp`, `advanced.backgroundTasks`) ; `better-auth/dist/api/routes/password.mjs` (`/request-password-reset`, `/reset-password/:token` qui renvoie vers `?token=` ou `?error=INVALID_TOKEN`) ; `sign-up.mjs` (réponse identique pour une adresse déjà prise quand `requireEmailVerification` est actif) ; `api/index.mjs` (`disabledPaths` : chemin exact)
- Nodemailer 10.0.15 : `README.md` et `CHANGELOG.md` du paquet (types fournis, Node.js 20, `secure` seulement pour 465) ; https://nodemailer.com/
- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/04-functions/after.md` ; `01-app/01-getting-started/08-caching.md` (lecture de `searchParams` sous `<Suspense>`)
- Mailpit : https://mailpit.axllent.org/docs/install/ (ports 1025 et 8025) ; https://mailpit.axllent.org/docs/usage/search-filters/ ; API : `server/ui/api/v1/swagger.json` du dépôt axllent/mailpit ; paquet winget `axllent.mailpit`
- Vercel, ports SMTP : https://vercel.com/kb/guide/serverless-functions-and-smtp
- Google : https://support.google.com/accounts/answer/185833 (mots de passe d'application) ; https://support.google.com/mail/answer/22839 (limite de 500)
- Infomaniak : https://www.infomaniak.com/fr/support/faq/468/ ; Brevo : https://help.brevo.com/hc/en-us/articles/10905415650322
- Vérifications locales (squelette du pack + recette `connexion`) : `npm run typecheck`, `biome check`, `next build` et Vitest (tests d'intégration ci-dessus) passent ; envoi réel de `envoyerEmail` vers Mailpit 1.31 et lecture par `to:"…"` réussis ; page `/nouveau-mot-de-passe` servie par `next start` avec `?token=` et `?error=INVALID_TOKEN`

## Points à vérifier

- Les tests de bout en bout (`e2e/email.spec.ts`) : écrits et compilés, pas exécutés (pas de base Neon lors de la rédaction).
- L'envoi par `after()` sur Vercel : l'e-mail doit partir après la réponse. À constater à la tâche Tn+4 (réception, et journaux Vercel sans « Failed to run background task »).
- La limite de 500 destinataires par jour : chiffre de l'aide Google pour un compte Gmail, susceptible de changer.
- L'affichage de `result.data.message` dans le formulaire d'inscription, avec les composants `Field` réels du squelette.

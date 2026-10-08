# Recette : langues

> Quand l'utiliser : le site s'affiche en français, sa langue par défaut, et en anglais, avec une adresse par langue (`/compte`, `/en/compte`).

## Prérequis

- Squelette du pack (Next.js 16.4, `cacheComponents: true`) et recette `connexion` appliquée (`proxy.ts` à la racine, qui renvoie vers `/connexion`).
- Paquet à installer : `npm install next-intl` (dernière version ; recette vérifiée avec 4.14.9).
- Next.js 16.3 ou plus récent : `next/root-params` y est actif sans réglage.
- À appliquer **tôt** dans le projet : la recette déplace toutes les pages sous `app/[locale]/`.

## Variables d'environnement

Aucune.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/i18n.ts` | Langues, langue par défaut, préfixe : lus au démarrage par le proxy, la navigation et les pages |
| `src/lib/i18n/request.ts` | Langue et messages de chaque requête |
| `src/lib/i18n/navigation.ts` | `Link`, `redirect`, `usePathname`, `useRouter` qui gardent la langue |
| `src/lib/i18n/chemins.ts` | Lecture de la langue dans une adresse et adresse dans une langue (fonctions pures) |
| `src/lib/i18n/referencement.ts` | Adresse officielle et versions de langue d'une page (`alternates`) |
| `src/lib/i18n/messages/fr.json`, `en.json` | Dictionnaires : un texte par clé, les mêmes clés dans les deux langues |
| `src/lib/i18n/__tests__/chemins.test.ts`, `referencement.test.ts` | Tests unitaires des fonctions pures |
| `next.config.ts` (modifié) | Extension next-intl |
| `app/layout.tsx` → `app/[locale]/layout.tsx` | Layout racine, avec la langue |
| `app/page.tsx`, `error.tsx`, `not-found.tsx`, `(public)/`, `(connecte)/` → sous `app/[locale]/` | Pages déplacées |
| `app/[locale]/[...reste]/page.tsx` | Adresse inconnue : page « introuvable » du site |
| `app/api/`, `global-error.tsx`, `globals.css`, `favicon.ico`, `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx` | Restent dans `app/` |
| `app/[locale]/page.tsx` (modifié) | Exemple d'une page publique qui déclare ses versions de langue |
| `app/sitemap.ts` (modifié) | Une entrée par page et par langue, avec ses versions de langue |
| `src/components/shared/elements/choix-langue.tsx` | Sélecteur de langue |
| `proxy.ts` (réécrit) | Renvoi vers la connexion + langues |
| `src/features/compte/components/containers/compte.container.tsx`, `app/[locale]/(connecte)/compte/page.tsx` (modifiés) | Exemples d'écrans traduits |
| `src/features/contact/schemas/contact.schema.ts`, `src/features/contact/actions/envoyer-message.action.ts` | Exemple d'action qui traduit ses messages |
| `playwright.config.ts` (modifié) | Navigateur de test en français |
| `e2e/langues.spec.ts` | Parcours de bout en bout |

## Étapes

### 1. Le routage

Avec `localePrefix: "as-needed"`, les adresses françaises restent celles d'avant (liens des e-mails, retour de Stripe, favoris) ; l'anglais reçoit le préfixe `/en`. Cette configuration est lue au démarrage : elle vit dans `src/config/`.

```ts
// src/config/i18n.ts
import { defineRouting } from "next-intl/routing";

// Langues du site, lues au démarrage par le proxy, la navigation et les pages.
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  // Le français garde ses adresses sans préfixe (/compte) ; l'anglais a le sien (/en/compte).
  localePrefix: "as-needed",
});

export type Langue = (typeof routing.locales)[number];
```

### 2. La langue de chaque requête

La langue se lit dans le segment `[locale]` avec `next/root-params`, sans en-tête de requête : les pages restent prérendues avec Cache Components. `setRequestLocale` devient inutile (next-intl le présente comme une API ancienne).

```ts
// src/lib/i18n/request.ts
import { routing } from "@src/config/i18n";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => {
  // La langue vient du segment [locale] de l'adresse, lue sans en-tête : les pages restent prérendables.
  if (!locale) {
    const valeur = await rootParams.locale();
    if (hasLocale(routing.locales, valeur)) {
      locale = valeur;
    } else {
      notFound();
    }
  }
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

### 3. Les liens et redirections qui gardent la langue

```ts
// src/lib/i18n/navigation.ts
import { routing } from "@src/config/i18n";
import { createNavigation } from "next-intl/navigation";

// À utiliser à la place de next/link et next/navigation : la langue courante est ajoutée d'office.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

```ts
// src/lib/i18n/chemins.ts
import { type Langue, routing } from "@src/config/i18n";

// "/en/compte" → { langue: "en", chemin: "/compte" } ; "/compte" → { langue: "fr", chemin: "/compte" }.
export function separerLangue(pathname: string): {
  langue: Langue;
  chemin: string;
} {
  const [, premier, ...reste] = pathname.split("/");
  const langue = routing.locales.find((l) => l === premier);
  if (langue) {
    return { langue, chemin: `/${reste.join("/")}` };
  }
  return { langue: routing.defaultLocale, chemin: pathname };
}

export function cheminDansLaLangue(langue: Langue, chemin: string): string {
  if (langue === routing.defaultLocale) return chemin;
  // L'accueil anglais est « /en », sans barre finale.
  return chemin === "/" ? `/${langue}` : `/${langue}${chemin}`;
}
```

### 4. L'extension next-intl

Dans `next.config.ts`, ajouter l'import en tête, puis remplacer la dernière ligne. Le chemin donné à `createNextIntlPlugin` est celui de `request.ts` (next-intl le cherche d'office dans `src/i18n/`, qui n'existe pas dans ce pack).

```ts
import createNextIntlPlugin from "next-intl/plugin";
```

```ts
// Recette langues : next-intl lit ses réglages de requête dans src/lib/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

export default withNextIntl(nextConfig);
```

### 5. Les versions de langue pour Google

Chaque page déclare sa propre adresse et celles de ses traductions, elle-même comprise, plus `x-default` (la version française) : Google ignore des liens qui ne sont pas réciproques.

```ts
// src/lib/i18n/referencement.ts
import { routing } from "@src/config/i18n";
import { hasLocale } from "next-intl";
import { cheminDansLaLangue } from "./chemins";

/** Adresse officielle (canonique) d'une page dans la langue de la requête. `locale` vient de `params` ; une langue inconnue prend la langue par défaut (le layout répond déjà 404). */
export function adresseDansLaLangue(locale: string, chemin: string): string {
  const langue = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;
  return cheminDansLaLangue(langue, chemin);
}

/** Toutes les versions de langue d'une page, elle-même comprise, plus `x-default` (la langue par défaut). */
export function versionsDeLangue(chemin: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = cheminDansLaLangue(l, chemin);
  languages["x-default"] = cheminDansLaLangue(routing.defaultLocale, chemin);
  return languages;
}
```

L'accueil du squelette devient la page d'exemple : ses métadonnées dépendent de la langue de l'adresse, donc `generateMetadata` remplace `metadata` et l'`alternates` de `metadonneesDePage()`. Chaque autre page publique suit le même modèle, avec son propre chemin (`"/tarifs"`).

```tsx
// app/[locale]/page.tsx
import { JsonLd } from "@src/components/shared/elements/json-ld";
import { projet } from "@src/config/projet";
import { adresseDuSite } from "@src/config/site";
import {
  adresseDansLaLangue,
  versionsDeLangue,
} from "@src/lib/i18n/referencement";
import { siteWeb } from "@src/lib/seo/donnees-structurees";
import { metadonneesDePage } from "@src/lib/seo/seo";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...metadonneesDePage({
      titre: projet.nom,
      description: projet.description,
      chemin: "/",
      accueil: true,
    }),
    alternates: {
      canonical: adresseDansLaLangue(locale, "/"),
      languages: versionsDeLangue("/"),
    },
  };
}

export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <JsonLd
        donnees={siteWeb({ nom: projet.nom, adresse: adresseDuSite() })}
      />
      <h1 className="font-heading text-4xl font-semibold tracking-tight">
        {projet.nom}
      </h1>
      <p className="text-lg text-muted-foreground">{projet.description}</p>
    </main>
  );
}
```

Dans `app/sitemap.ts`, chaque page donne une entrée par langue, et chaque entrée porte les adresses complètes de toutes les versions (construites avec `adresseDuSite()`).

```ts
// app/sitemap.ts
import { type Langue, routing } from "@src/config/i18n";
import { adresseDuSite } from "@src/config/site";
import { cheminDansLaLangue } from "@src/lib/i18n/chemins";
import type { MetadataRoute } from "next";

// Les pages publiques, chacune par son adresse officielle. Ajouter ici chaque nouvelle page publique ;
// des contenus publiés en base se lisent avec une fonction "use cache" (recette seo).
// misAJourLe : seulement une vraie date de modification du contenu, jamais la date du jour.
// Google ignore priority et changeFrequency : inutile de les remplir.
const PAGES_PUBLIQUES: { chemin: string; misAJourLe?: Date }[] = [
  { chemin: "/" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const adresse = adresseDuSite();
  // Adresse complète d'une page dans une langue (l'accueil français est l'adresse du site seule).
  const adresseDans = (langue: Langue, chemin: string) => {
    const dansLaLangue = cheminDansLaLangue(langue, chemin);
    return dansLaLangue === "/" ? adresse : `${adresse}${dansLaLangue}`;
  };
  // Une entrée par page et par langue, chacune avec toutes les versions (elle-même comprise).
  return PAGES_PUBLIQUES.flatMap(({ chemin, misAJourLe }) =>
    routing.locales.map((langue) => ({
      url: adresseDans(langue, chemin),
      ...(misAJourLe ? { lastModified: misAJourLe } : {}),
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, adresseDans(l, chemin)]),
        ),
      },
    })),
  );
}
```

### 6. Les messages

Dictionnaires dans `src/lib/i18n/messages/` ; les mêmes clés dans les deux langues ; un espace de noms par écran ou par composant.

`src/lib/i18n/messages/fr.json` :

```json
{
  "ChoixLangue": {
    "libelle": "Langue",
    "fr": "Français",
    "en": "English"
  },
  "Compte": {
    "titre": "Mon compte",
    "connecteEnTantQue": "Connecté en tant que {nom}"
  }
}
```

`src/lib/i18n/messages/en.json` :

```json
{
  "ChoixLangue": {
    "libelle": "Language",
    "fr": "Français",
    "en": "English"
  },
  "Compte": {
    "titre": "My account",
    "connecteEnTantQue": "Signed in as {nom}"
  }
}
```

### 7. Déplacer les pages

1. Créer le dossier `app/[locale]/`.
2. Y déplacer `page.tsx`, `error.tsx`, `not-found.tsx`, `(public)/` et `(connecte)/`.
3. Laisser dans `app/` : `api/`, `global-error.tsx`, `globals.css`, `favicon.ico`, et les fichiers du référencement (`robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx`).
4. Supprimer `app/layout.tsx` : il est remplacé à l'étape suivante.
5. Dans les pages et layouts déplacés, ajouter `[locale]` aux clés de `PageProps` et `LayoutProps` : `PageProps<"/nouveau-mot-de-passe">` devient `PageProps<"/[locale]/nouveau-mot-de-passe">`, `LayoutProps<"/">` de `app/[locale]/(connecte)/layout.tsx` devient `LayoutProps<"/[locale]">`. `npm run typecheck` signale chaque clé à corriger.

### 8. Le layout racine

Version du squelette, complétée : langue validée, `generateStaticParams`, `lang` de la page, fournisseur des messages pour les composants clients, sélecteur de langue.

```tsx
// app/[locale]/layout.tsx
import { ChoixLangue } from "@src/components/shared/elements/choix-langue";
import { Toaster } from "@src/components/ui/sonner";
import { routing } from "@src/config/i18n";
import { projet } from "@src/config/projet";
import { adresseDuSite } from "@src/config/site";
import { partageCommun } from "@src/lib/seo/seo";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "../globals.css";

// La variable porte le nom attendu par globals.css (--font-sans) : sans elle, le navigateur
// retombe sur sa police par défaut.
const policeTexte = Geist({ variable: "--font-sans", subsets: ["latin"] });
const policeCode = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Métadonnées communes du squelette, inchangées (adresse du site, modèle de titre, carte de partage).
export const metadata: Metadata = {
  metadataBase: new URL(adresseDuSite()),
  title: { default: projet.nom, template: `%s | ${projet.nom}` },
  description: projet.description,
  openGraph: {
    ...partageCommun,
    title: projet.nom,
    description: projet.description,
  },
  twitter: { card: "summary_large_image" },
};

// Avec Cache Components, chaque langue est déclarée ici : sans elle, la construction échoue.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  return (
    <html
      lang={locale}
      className={`${policeTexte.variable} ${policeCode.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <NuqsAdapter>
            <header className="flex justify-end px-6 py-3">
              <ChoixLangue />
            </header>
            {children}
          </NuqsAdapter>
        </NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

Le sélecteur est un composant client qui n'importe que `lib/` et `config/` : il se range dans `src/components/shared/elements/`.

```tsx
// src/components/shared/elements/choix-langue.tsx
"use client";

import { routing } from "@src/config/i18n";
import { Link, usePathname } from "@src/lib/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";

export function ChoixLangue() {
  const t = useTranslations("ChoixLangue");
  const langueCourante = useLocale();
  const chemin = usePathname();
  return (
    <nav aria-label={t("libelle")} className="flex gap-3 text-sm">
      {routing.locales.map((langue) => (
        <Link
          key={langue}
          href={chemin}
          locale={langue}
          aria-current={langue === langueCourante ? "true" : undefined}
          className={langue === langueCourante ? "font-semibold" : "underline"}
        >
          {t(langue)}
        </Link>
      ))}
    </nav>
  );
}
```

### 9. Les adresses inconnues

Une adresse qui ne correspond à aucune page affiche ainsi `app/[locale]/not-found.tsx`, dans le layout du site. Cette page ne s'affiche jamais : `noindex` la garde hors de Google.

```tsx
// app/[locale]/[...reste]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Cette page ne s'affiche jamais : hors de Google quoi qu'il arrive.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Adresse inconnue dans une langue : affiche app/[locale]/not-found.tsx, avec le layout du site.
export default function AdresseInconnue() {
  notFound();
}
```

### 10. Le proxy : connexion et langues

Remplacer `proxy.ts` (à la racine). Le `matcher` couvre désormais toutes les pages (next-intl en a besoin) ; la liste `PAGES_CONNECTEES` reprend les lignes de l'ancien `matcher`, sans `/:path*` (ajouter `"/factures"`, `"/fichiers"`, `"/paiement"` quand ces recettes sont appliquées). La redirection vers la connexion passe en premier, dans la langue de l'adresse ; elle ne vaut que pour l'ouverture d'une page (GET), comme avant. next-intl gère ensuite le préfixe, la détection de la langue et la réécriture vers `/[locale]/…`.

```ts
// proxy.ts
import { routing } from "@src/config/i18n";
import { cheminDansLaLangue, separerLangue } from "@src/lib/i18n/chemins";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

const gererLangue = createMiddleware(routing);

// Pages du groupe (connecte), écrites sans préfixe de langue
// (les anciennes lignes du matcher, sans « /:path* »).
const PAGES_CONNECTEES = ["/compte"];

export function proxy(request: NextRequest) {
  const { langue, chemin } = separerLangue(request.nextUrl.pathname);
  const estConnectee = PAGES_CONNECTEES.some(
    (page) => chemin === page || chemin.startsWith(`${page}/`),
  );

  // 1. Renvoi rapide vers la connexion, dans la langue de l'adresse (présence du cookie seulement).
  // Seulement l'ouverture d'une page (GET) : une action (POST) continue jusqu'à actionConnectee,
  // qui répond « Connexion requise » dans le formulaire.
  if (request.method === "GET" && estConnectee && !getSessionCookie(request)) {
    return NextResponse.redirect(
      new URL(cheminDansLaLangue(langue, "/connexion"), request.url),
    );
  }
  // 2. Langue : préfixe, détection, puis réécriture vers /[locale]/… par next-intl.
  return gererLangue(request);
}

export const config = {
  // Toutes les pages, sauf /api, /trpc, /_next, /_vercel et les fichiers (adresse avec un point).
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
```

### 11. Traduire les écrans

- Composant serveur non `async`, ou composant client : `const t = useTranslations("Compte");` puis `t("titre")`.
- Composant serveur `async` : `const t = await getTranslations("Compte");` (de `next-intl/server`) puis `t("connecteEnTantQue", { nom: utilisateur.nom })`.
- Liens internes : `Link` de `@src/lib/i18n/navigation` à la place de `next/link` (dans `app/[locale]/not-found.tsx` et les formulaires de `connexion`, par exemple).
- Les lectures de session et de données restent sous `<Suspense>`, comme avant.
- Les containers et les pages portent les textes ; une section qui a besoin d'un texte le reçoit en props, ou appelle `useTranslations` quand c'est un composant client d'affichage.

Exemple avec l'écran « Mon compte » : le container serveur lit la traduction, la page lit son titre.

```tsx
// src/features/compte/components/containers/compte.container.tsx
import { getTranslations } from "next-intl/server";
import { utilisateurConnecte } from "../../queries/utilisateur-connecte.query";
import { BoutonDeconnexionContainer } from "./bouton-deconnexion.container";
import { MotDePasseContainer } from "./mot-de-passe.container";

export async function CompteContainer() {
  const t = await getTranslations("Compte");
  const utilisateur = await utilisateurConnecte();
  return (
    <>
      <section className="flex items-center justify-between gap-4">
        <p>{t("connecteEnTantQue", { nom: utilisateur.nom })}</p>
        <BoutonDeconnexionContainer />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-medium">Changer mon mot de passe</h2>
        <MotDePasseContainer />
      </section>
    </>
  );
}
```

```tsx
// app/[locale]/(connecte)/compte/page.tsx
import { CompteContainer } from "@src/features/compte/components/containers/compte.container";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Mon compte" };

export default function PageCompte() {
  const t = useTranslations("Compte");
  return (
    <main className="mx-auto max-w-sm space-y-8 p-6">
      <h1 className="text-2xl font-semibold">{t("titre")}</h1>
      <Suspense fallback={<p className="text-muted-foreground">Chargement…</p>}>
        <CompteContainer />
      </Suspense>
    </main>
  );
}
```

### 12. Traduire les messages d'une action

`next/root-params` ne fonctionne pas dans une Server Action. Le formulaire envoie la langue (`useLocale()` de `next-intl`), et l'action la passe à `getTranslations`. Exemple, avec les clés `Contact.merci` et `Contact.liensRefuses` ajoutées aux deux fichiers de messages :

```json
  "Contact": {
    "merci": "Merci, votre message est envoyé.",
    "liensRefuses": "Les liens ne sont pas acceptés dans le message."
  }
```

```json
  "Contact": {
    "merci": "Thank you, your message is sent.",
    "liensRefuses": "Links are not accepted in the message."
  }
```

Le schéma accepte seulement les langues déclarées. Ces messages traduits sont l'exception à la règle « message des erreurs attendues dans `constants/erreur-messages.ts` » : ils dépendent de la langue.

```ts
// src/features/contact/schemas/contact.schema.ts
import { routing } from "@src/config/i18n";
import { z } from "zod";

export const schemaMessage = z.object({
  langue: z.enum(routing.locales),
  message: z.string().trim().min(1).max(2000),
});
```

```ts
// src/features/contact/actions/envoyer-message.action.ts
"use server";

import { actionPublique } from "@src/lib/safe-action";
import { getTranslations } from "next-intl/server";
import { returnServerError } from "next-safe-action";
import { schemaMessage } from "../schemas/contact.schema";

export const envoyerMessage = actionPublique
  .inputSchema(schemaMessage)
  .action(async ({ parsedInput }) => {
    // next/root-params est indisponible dans une action : la langue arrive avec les valeurs.
    const t = await getTranslations({
      locale: parsedInput.langue,
      namespace: "Contact",
    });
    if (parsedInput.message.includes("http")) {
      returnServerError(t("liensRefuses"));
    }
    return { message: t("merci") };
  });
```

### 13. Playwright en français

Dans `playwright.config.ts`, bloc `use` :

```ts
    // Recette langues : navigateur de test en français (sinon next-intl redirige vers /en).
    locale: "fr-FR",
```

### 14. Vérifier

`npm run build` liste `/fr/…` et `/en/…` pour chaque page. Puis ouvrir `/`, `/en`, et `/en/compte` sans être connecté : direction `/en/connexion`.

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Langues

  Règle: La langue se lit dans le début de l'adresse

    @US-XXX-1 @unitaire
    Plan du scénario: Une adresse donne sa langue et sa page
      Étant donné l'adresse « <adresse> »
      Quand on lit sa langue
      Alors la langue est « <langue> » et la page est « <page> »

      Exemples:
        | adresse    | langue | page    |
        | /en/compte | en     | /compte |
        | /compte    | fr     | /compte |

  Règle: Le site s'affiche dans la langue choisie

    @US-XXX-2 @bout-en-bout
    Exemple: Une visiteuse francophone voit le site en français
      Étant donné le navigateur de Camille est réglé en français
      Quand Camille ouvre l'accueil
      Alors la page est en français

    @US-XXX-2 @bout-en-bout
    Exemple: Camille passe en anglais depuis le sélecteur de langue
      Étant donné Camille est sur l'accueil en français
      Quand Camille choisit « English »
      Alors l'adresse devient « /en » et la page est en anglais

  Règle: La page de connexion garde la langue de la personne

    @US-XXX-3 @unitaire
    Plan du scénario: La page de connexion se trouve dans la langue courante
      Étant donné la langue « <langue> »
      Quand on construit l'adresse de connexion
      Alors l'adresse est « <adresse> »

      Exemples:
        | langue | adresse       |
        | en     | /en/connexion |
        | fr     | /connexion    |

    @US-XXX-3 @bout-en-bout @securite
    Exemple: Sans session, la page compte anglaise mène à la connexion anglaise
      Étant donné personne n'est connecté
      Quand on ouvre « /en/compte »
      Alors on arrive sur « /en/connexion »

  Règle: Chaque page publique déclare ses versions de langue

    @US-XXX-4 @unitaire
    Exemple: Une page déclare toutes ses versions, x-default comprise
      Étant donné la page « /tarifs »
      Quand on construit ses versions de langue
      Alors on obtient « fr : /tarifs », « en : /en/tarifs » et « x-default : /tarifs »
```

## Tâches de plan prêtes

- [ ] **Tn – Installer les langues** · US-XXX
  - Objectif : le site répond en français sans préfixe et en anglais sous `/en`
  - Dépend de : —
  - Fichiers : à créer : `src/config/i18n.ts`, `src/lib/i18n/request.ts`, `navigation.ts`, `chemins.ts`, `src/lib/i18n/messages/fr.json`, `en.json`, `src/lib/i18n/__tests__/chemins.test.ts`, `src/components/shared/elements/choix-langue.tsx`, `app/[locale]/layout.tsx`, `app/[locale]/[...reste]/page.tsx` · à modifier : `next.config.ts`, `proxy.ts` · à déplacer : les pages sous `app/[locale]/`
  - Vérification : US-XXX critères 1 et 3 – `npm run build` passe et liste `/fr` et `/en` ; `/en/compte` sans session mène à `/en/connexion`
  - Tests : « Une adresse donne sa langue et sa page », « La page de connexion se trouve dans la langue courante » (unitaires)
  - Attention : `app/api/` reste hors de `[locale]` ; reprendre polices, `NuqsAdapter` et `Toaster` de l'ancien layout ; ajouter `[locale]` aux clés de `PageProps` et `LayoutProps`
- [ ] **Tn+1 – Choisir sa langue** · US-XXX
  - Objectif : le sélecteur de langue (créé par Tn) permet de passer du français à l'anglais sur chaque page, et les parcours le prouvent
  - Dépend de : Tn
  - Fichiers : à créer : `e2e/langues.spec.ts` · à modifier : `playwright.config.ts`
  - Vérification : US-XXX critère 2 – sur l'accueil, cliquer sur « English » : l'adresse devient `/en`
  - Tests : « Une visiteuse francophone voit le site en français », « Camille passe en anglais depuis le sélecteur de langue », « Sans session, la page compte anglaise mène à la connexion anglaise » (bout en bout)
- [ ] **Tn+2 – Traduire les écrans** · US-XXX
  - Objectif : chaque texte affiché vient de `src/lib/i18n/messages/fr.json` et `en.json` ; chaque page publique déclare ses versions de langue
  - Dépend de : Tn+1
  - Fichiers : à créer : `src/lib/i18n/referencement.ts`, `src/lib/i18n/__tests__/referencement.test.ts` · à modifier : pages, containers et actions qui affichent du texte, `app/sitemap.ts`
  - Vérification : US-XXX critères 2 et 4 – parcourir le site en anglais : aucun texte français ne reste ; `pulse-aidd seo http://localhost:3000` : contrôle L23 sans constat
  - Tests : « Une page déclare toutes ses versions, x-default comprise » (unitaire) ; les tests existants vérifient les textes français

## Tests

### Unitaires

```ts
// src/lib/i18n/__tests__/chemins.test.ts
import { describe, expect, it } from "vitest";
import { cheminDansLaLangue, separerLangue } from "../chemins";

describe("Langues", () => {
  describe("La langue se lit dans le début de l'adresse", () => {
    it("US-XXX-1 – Une adresse donne sa langue et sa page : /en/compte", () => {
      expect(separerLangue("/en/compte")).toEqual({
        langue: "en",
        chemin: "/compte",
      });
    });

    it("US-XXX-1 – Une adresse donne sa langue et sa page : /compte", () => {
      expect(separerLangue("/compte")).toEqual({
        langue: "fr",
        chemin: "/compte",
      });
    });
  });

  describe("La page de connexion garde la langue de la personne", () => {
    it("US-XXX-3 – La page de connexion se trouve dans la langue courante : en", () => {
      expect(cheminDansLaLangue("en", "/connexion")).toBe("/en/connexion");
    });

    it("US-XXX-3 – La page de connexion se trouve dans la langue courante : fr", () => {
      expect(cheminDansLaLangue("fr", "/connexion")).toBe("/connexion");
    });

    it("US-XXX-3 – L'accueil anglais est « /en », sans barre finale", () => {
      expect(cheminDansLaLangue("en", "/")).toBe("/en");
      expect(separerLangue("/en")).toEqual({ langue: "en", chemin: "/" });
    });
  });
});
```

```ts
// src/lib/i18n/__tests__/referencement.test.ts
import { describe, expect, it } from "vitest";
import { adresseDansLaLangue, versionsDeLangue } from "../referencement";

describe("Référencement des langues", () => {
  describe("Chaque page déclare ses versions de langue", () => {
    it("US-XXX-4 – Une page déclare toutes ses versions, x-default comprise", () => {
      expect(versionsDeLangue("/tarifs")).toEqual({
        fr: "/tarifs",
        en: "/en/tarifs",
        "x-default": "/tarifs",
      });
    });

    it("US-XXX-4 – Une page a son adresse officielle dans la langue de la requête", () => {
      expect(adresseDansLaLangue("en", "/tarifs")).toBe("/en/tarifs");
      expect(adresseDansLaLangue("fr", "/tarifs")).toBe("/tarifs");
    });

    it("US-XXX-4 – Une langue inconnue prend la langue par défaut", () => {
      expect(adresseDansLaLangue("xx", "/tarifs")).toBe("/tarifs");
    });
  });
});
```

### Bout en bout (Playwright)

```ts
// e2e/langues.spec.ts
import { expect, test } from "@playwright/test";

test.describe("Langues", () => {
  test("US-XXX-2 – Une visiteuse francophone voit le site en français", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("US-XXX-2 – Camille passe en anglais depuis le sélecteur de langue", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "English" }).click();

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("US-XXX-3 – Sans session, la page compte anglaise mène à la connexion anglaise", async ({
    page,
  }) => {
    await page.goto("/en/compte");

    await expect(page).toHaveURL(/\/en\/connexion$/);
  });
});
```

## Points de sécurité

- **S4 – Pages réservées** : le proxy reste un renvoi rapide ; chaque page connectée et chaque action vérifient la session comme avant (`utilisateurConnecte()`, `actionConnectee`).
- **S5 – Validation** : une langue inconnue dans l'adresse donne une page 404 (`hasLocale`, puis `notFound()`) ; la langue reçue par une action passe par `z.enum(routing.locales)`.
- **S6 – Affichage** : les valeurs insérées dans un texte (`t("connecteEnTantQue", { nom })`) s'affichent comme du texte ; `t.rich` et `t.markup` restent réservés aux textes écrits par l'équipe.
- Les fichiers `src/lib/i18n/messages/*.json` partent vers le navigateur : ils ne contiennent aucun secret.

## Pièges connus

- **Construction en échec sur `generateStaticParams`** : avec Cache Components, `app/[locale]/layout.tsx` déclare chaque langue dans `generateStaticParams`.
- **`PageProps<"/…">` ou `LayoutProps<"/">` refusé par `npm run typecheck`** : la clé prend `[locale]` (`PageProps<"/[locale]/…">`, `LayoutProps<"/[locale]">`).
- **Page oubliée dans `app/`** : elle n'a plus de layout racine. Tout déplacer, sauf `api/`, `global-error.tsx`, `globals.css`, `favicon.ico` et les fichiers du référencement (`robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx`).
- **Avertissement `metadataBase` à la construction** : il vient des routes d'images (`opengraph-image`, `icon`, `apple-icon`) laissées dans `app/`, hors du layout `[locale]`. Les pages gardent leur `metadataBase` et leurs adresses complètes.
- **Le proxy laisse passer toutes les pages (404 sur `/compte`, `/connexion`)** : le `matcher` écrit dans une chaîne TypeScript garde le double antislash de `.*\\..*`. Avec un seul antislash, il exclut toute adresse non vide.
- **`next-intl` ne trouve pas `request.ts`** : il le cherche d'office dans `src/i18n/`. Le pack le range dans `src/lib/i18n/` ; `createNextIntlPlugin("./src/lib/i18n/request.ts")` donne le chemin.
- **`next/root-params` dans une action ou un Route Handler** : indisponible. Passer la langue en paramètre (`getTranslations({ locale, namespace })`).
- **Tests Playwright redirigés vers `/en`** : le navigateur de test annonce l'anglais par défaut ; régler `locale: "fr-FR"`.
- **Détection automatique** : un navigateur réglé en anglais qui ouvre `/` part sur `/en` ; le choix fait avec le sélecteur est gardé dans le cookie `NEXT_LOCALE`.
- **Adresses avec un point** (`/profil/jean.dupont`) : exclues par le `matcher` ; ajouter une entrée de `matcher` dédiée.
- **Versions de langue non réciproques** : chaque version cite toutes les autres et elle-même ; sinon Google ignore ces liens (`pulse-aidd seo`, contrôle L23).
- **Liens qui perdent `/en`** : `next/link` et `redirect` de `next/navigation` ignorent la langue ; utiliser ceux de `@src/lib/i18n/navigation`.
- **Liens des e-mails, retour de Stripe, redirections des actions de la recette `connexion`** : ils visent les adresses françaises (sans préfixe), qui restent valides.

## Sources

- next-intl 4.14.9 : https://next-intl.dev/docs/routing/setup (source `docs/src/pages/docs/routing/setup.mdx` du dépôt amannn/next-intl : `next/root-params`, `setRequestLocale` ancien) ; `routing/middleware.mdx` (composition du proxy, `matcher`) ; `environments/actions-metadata-route-handlers.mdx` (actions : `getTranslations({ locale, namespace })`) ; code du paquet (argument de `createNextIntlPlugin` : chemin de `request.ts`, cookie `NEXT_LOCALE`)
- Next.js 16.4, documentation embarquée : `01-app/02-guides/internationalization.md` ; `01-app/03-api-reference/04-functions/next-root-params.md` (indisponible dans les actions et les Route Handlers ; `generateStaticParams` obligatoire avec Cache Components) ; `01-app/01-getting-started/16-proxy.md` ; `01-app/03-api-reference/03-file-conventions/not-found.md`
- better-auth 1.7.7 : `dist/cookies/index.d.mts` (`getSessionCookie`)
- Vérifications locales (squelette du pack + recette `connexion`, puis cette recette) : `npm run check`, `npm run typecheck`, Vitest (47 tests) et `next build` passent ; `next start` : `/` → 200 (`lang="fr"`), `/en` → 200 (`lang="en"`), `/fr` → 307 `/`, `/compte` → 307 `/connexion`, `/en/compte` → 307 `/en/connexion`, navigateur anglais sur `/` → 307 `/en`, adresse inconnue (`/xyz`, `/en/xyz`, `/xx/compte`) → 404 ; sitemap : une entrée par langue avec ses versions ; Playwright (`langues.spec.ts`, `referencement.spec.ts`) : 14 tests passent sur ordinateur et sur téléphone ; `seo-code.js` : aucun constat Critique ou Haute

## Points à vérifier

- Le texte de la page 404 (« Page introuvable ») pour une adresse inconnue : la réponse est bien 404, mais son contenu se construit dans le navigateur ; à regarder une fois dans un vrai navigateur.
- Une redirection `redirect("/compte")` d'une action pour une personne qui a choisi l'anglais : next-intl devrait la renvoyer vers `/en/compte` grâce au cookie `NEXT_LOCALE` ; à constater.
- « Mon compte » en anglais pour une personne connectée (« Signed in as … ») : écrit, mais non constaté, faute de base de données dans l'essai.
- `NextIntlClientProvider` sans `messages` transmet tous les messages de la langue aux composants clients ; pour un gros fichier de messages, ne transmettre que les espaces de noms utiles.
- Le serveur de développement journalise une erreur « Could not validate `instant` » pour `app/[locale]/[...reste]/page.tsx` (la page appelle `notFound()` par conception) ; la réponse reste 404 et les tests passent.
- Le contrôle `seo-code.js` (C13) cherche `languages:` et `x-default` dans le texte des pages et du layout, sans suivre `versionsDeLangue()` : il signale un constat Basse « sans x-default » alors que la page le déclare par le helper.

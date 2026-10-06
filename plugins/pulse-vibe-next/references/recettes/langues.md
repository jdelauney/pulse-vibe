# Recette : langues

> Quand l'utiliser : le site s'affiche en français, sa langue par défaut, et en anglais, avec une adresse par langue (`/compte`, `/en/compte`).

## Prérequis

- Squelette du pack (Next.js 16.4, `cacheComponents: true`) et recette `connexion` appliquée (`src/proxy.ts` qui renvoie vers `/connexion`).
- Paquet à installer : `npm install next-intl` (dernière version ; recette vérifiée avec 4.14.9).
- Next.js 16.3 ou plus récent : `next/root-params` y est actif sans réglage.
- À appliquer **tôt** dans le projet : la recette déplace toutes les pages sous `src/app/[locale]/`.

## Variables d'environnement

Aucune.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/i18n/routing.ts` | Langues, langue par défaut, préfixe |
| `src/i18n/request.ts` | Langue et messages de chaque requête |
| `src/i18n/navigation.ts` | `Link`, `redirect`, `usePathname`, `useRouter` qui gardent la langue |
| `src/i18n/chemins.ts`, `chemins.test.ts` | Lecture de la langue dans une adresse (fonctions pures) et leurs tests |
| `messages/fr.json`, `messages/en.json` | Textes affichés, une clé par texte |
| `next.config.ts` (modifié) | Extension next-intl |
| `src/app/layout.tsx` → `src/app/[locale]/layout.tsx` | Layout racine, avec la langue |
| `src/app/page.tsx`, `error.tsx`, `not-found.tsx`, `(public)/`, `(connecte)/` → sous `src/app/[locale]/` | Pages déplacées |
| `src/app/[locale]/[...reste]/page.tsx` | Adresse inconnue : page « introuvable » du site |
| `src/app/api/`, `global-error.tsx`, `globals.css`, `favicon.ico` | Restent dans `src/app/` |
| `src/components/choix-langue.tsx` | Sélecteur de langue |
| `src/proxy.ts` (réécrit) | Renvoi vers la connexion + langues |
| `playwright.config.ts` (modifié) | Navigateur de test en français |
| `e2e/langues.spec.ts` | Parcours de bout en bout |

## Étapes

### 1. Le routage

Avec `localePrefix: "as-needed"`, les adresses françaises restent celles d'avant (liens des e-mails, retour de Stripe, favoris) ; l'anglais reçoit le préfixe `/en`.

```ts
// src/i18n/routing.ts
import { defineRouting } from "next-intl/routing";

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
// src/i18n/request.ts
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  // La langue vient du segment [locale] de l'adresse, lu sans en-tête : les pages restent prérendables.
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
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

### 3. Les liens et redirections qui gardent la langue

```ts
// src/i18n/navigation.ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// À utiliser à la place de next/link et next/navigation : la langue courante est ajoutée d'office.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

```ts
// src/i18n/chemins.ts
import { type Langue, routing } from "./routing";

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
  return langue === routing.defaultLocale ? chemin : `/${langue}${chemin}`;
}
```

### 4. L'extension next-intl

Dans `next.config.ts`, ajouter l'import en tête, puis remplacer la dernière ligne :

```ts
import createNextIntlPlugin from "next-intl/plugin";
```

```ts
// Recette langues : next-intl trouve tout seul src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
```

### 5. Les messages

Fichiers à la racine du projet ; les mêmes clés dans les deux langues ; un espace de noms par écran ou par composant.

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

### 6. Déplacer les pages

1. Créer le dossier `src/app/[locale]/`.
2. Y déplacer `page.tsx`, `error.tsx`, `not-found.tsx`, `(public)/` et `(connecte)/`.
3. Laisser dans `src/app/` : `api/`, `global-error.tsx`, `globals.css`, `favicon.ico`.
4. Supprimer `src/app/layout.tsx` : il est remplacé à l'étape suivante.
5. Dans les pages déplacées, ajouter `[locale]` aux clés de `PageProps` et `LayoutProps` : `PageProps<"/nouveau-mot-de-passe">` devient `PageProps<"/[locale]/nouveau-mot-de-passe">`, `PageProps<"/paiement/merci">` devient `PageProps<"/[locale]/paiement/merci">`. `npm run typecheck` signale chaque clé à corriger.

### 7. Le layout racine

Version du squelette, complétée : langue validée, `generateStaticParams`, `lang` de la page, fournisseur des messages pour les composants clients, sélecteur de langue.

```tsx
// src/app/[locale]/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ChoixLangue } from "@/components/choix-langue";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { projet } from "@/lib/projet";
import "../globals.css";

// La variable porte le nom attendu par globals.css (--font-sans) : sans elle, le navigateur
// retombe sur sa police par défaut.
const policeTexte = Geist({ variable: "--font-sans", subsets: ["latin"] });
const policeCode = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: projet.nom,
  description: projet.description,
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

```tsx
// src/components/choix-langue.tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

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

### 8. Les adresses inconnues

Une adresse qui ne correspond à aucune page affiche ainsi `src/app/[locale]/not-found.tsx`, dans le layout du site :

```tsx
// src/app/[locale]/[...reste]/page.tsx
import { notFound } from "next/navigation";

// Adresse inconnue dans une langue : affiche src/app/[locale]/not-found.tsx, avec le layout du site.
export default function AdresseInconnue() {
  notFound();
}
```

### 9. Le proxy : connexion et langues

Remplacer `src/proxy.ts`. Le `matcher` couvre désormais toutes les pages (next-intl en a besoin) ; la liste `PAGES_CONNECTEES` reprend les lignes de l'ancien `matcher`, sans `/:path*`. La redirection vers la connexion passe en premier, dans la langue de l'adresse ; next-intl gère ensuite le préfixe, la détection de la langue et la réécriture vers `/[locale]/…`.

```ts
// src/proxy.ts
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { cheminDansLaLangue, separerLangue } from "./i18n/chemins";
import { routing } from "./i18n/routing";

const gererLangue = createMiddleware(routing);

// Pages du groupe (connecte), écrites sans préfixe de langue
// (les anciennes lignes du matcher, sans « /:path* »).
const PAGES_CONNECTEES = ["/compte", "/fichiers", "/paiement"];

export function proxy(request: NextRequest) {
  const { langue, chemin } = separerLangue(request.nextUrl.pathname);
  const estConnectee = PAGES_CONNECTEES.some(
    (page) => chemin === page || chemin.startsWith(`${page}/`),
  );

  // 1. Renvoi rapide vers la connexion, dans la langue de l'adresse (présence du cookie seulement).
  if (estConnectee && !getSessionCookie(request)) {
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

### 10. Traduire les écrans

- Composant serveur non `async`, ou composant client : `const t = useTranslations("Compte");` puis `t("titre")`.
- Composant serveur `async` : `const t = await getTranslations("Compte");` (de `next-intl/server`) puis `t("connecteEnTantQue", { nom: utilisateur.nom })`.
- Liens internes : `Link` de `@/i18n/navigation` à la place de `next/link`.
- Les lectures de session et de données restent sous `<Suspense>`, comme avant.

### 11. Traduire les messages d'une action

`next/root-params` ne fonctionne pas dans une Server Action. Le formulaire envoie la langue (`useLocale()` de `next-intl`), et l'action la passe à `getTranslations`. Exemple, avec les clés `Contact.merci` et `Contact.liensRefuses` ajoutées aux deux fichiers de messages :

```ts
"use server";

import { getTranslations } from "next-intl/server";
import { returnServerError } from "next-safe-action";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { actionPublique } from "@/lib/safe-action";

const schema = z.object({
  langue: z.enum(routing.locales),
  message: z.string().trim().min(1).max(2000),
});

export const envoyerMessage = actionPublique
  .inputSchema(schema)
  .action(async ({ parsedInput }) => {
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

### 12. Playwright en français

Dans `playwright.config.ts`, bloc `use` :

```ts
    // Recette langues : navigateur de test en français (sinon next-intl redirige vers /en).
    locale: "fr-FR",
```

### 13. Vérifier

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
```

## Tâches de plan prêtes

- [ ] **Tn – Installer les langues** · US-XXX
  - Objectif : le site répond en français sans préfixe et en anglais sous `/en`
  - Dépend de : —
  - Fichiers : à créer : `src/i18n/routing.ts`, `request.ts`, `navigation.ts`, `chemins.ts`, `chemins.test.ts`, `messages/fr.json`, `messages/en.json`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/[...reste]/page.tsx` · à modifier : `next.config.ts`, `src/proxy.ts` · à déplacer : les pages sous `src/app/[locale]/`
  - Vérification : US-XXX critères 1 et 3 – `npm run build` passe et liste `/fr` et `/en` ; `/en/compte` sans session mène à `/en/connexion`
  - Tests : « Une adresse donne sa langue et sa page », « La page de connexion se trouve dans la langue courante » (unitaires)
  - Attention : `src/app/api/` reste hors de `[locale]` ; reprendre polices, `NuqsAdapter` et `Toaster` de l'ancien layout ; ajouter `[locale]` aux clés de `PageProps`
- [ ] **Tn+1 – Choisir sa langue** · US-XXX
  - Objectif : un sélecteur permet de passer du français à l'anglais sur chaque page
  - Dépend de : Tn
  - Fichiers : à créer : `src/components/choix-langue.tsx`, `e2e/langues.spec.ts` · à modifier : `playwright.config.ts`
  - Vérification : US-XXX critère 2 – sur l'accueil, cliquer sur « English » : l'adresse devient `/en`
  - Tests : « Une visiteuse francophone voit le site en français », « Camille passe en anglais depuis le sélecteur de langue », « Sans session, la page compte anglaise mène à la connexion anglaise » (bout en bout)
- [ ] **Tn+2 – Traduire les écrans** · US-XXX
  - Objectif : chaque texte affiché vient de `messages/fr.json` et `messages/en.json`
  - Dépend de : Tn+1
  - Fichiers : à modifier : pages, composants et actions qui affichent du texte
  - Vérification : US-XXX critère 2 – parcourir le site en anglais : aucun texte français ne reste
  - Tests : aucun nouveau (les tests existants vérifient les textes français)

## Tests

### Unitaires

```ts
// src/i18n/chemins.test.ts
import { describe, expect, it } from "vitest";
import { cheminDansLaLangue, separerLangue } from "./chemins";

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
- Les fichiers `messages/*.json` partent vers le navigateur : ils ne contiennent aucun secret.

## Pièges connus

- **Construction en échec sur `generateStaticParams`** : avec Cache Components, `src/app/[locale]/layout.tsx` déclare chaque langue dans `generateStaticParams`.
- **`PageProps<"/…">` refusé par `npm run typecheck`** : la clé prend `[locale]` (`PageProps<"/[locale]/…">`).
- **Page oubliée dans `src/app/`** : elle n'a plus de layout racine. Tout déplacer, sauf `api/`, `global-error.tsx`, `globals.css` et `favicon.ico`.
- **`next/root-params` dans une action ou un Route Handler** : indisponible. Passer la langue en paramètre (`getTranslations({ locale, namespace })`).
- **Tests Playwright redirigés vers `/en`** : le navigateur de test annonce l'anglais par défaut ; régler `locale: "fr-FR"`.
- **Détection automatique** : un navigateur réglé en anglais qui ouvre `/` part sur `/en` ; le choix fait avec le sélecteur est gardé dans le cookie `NEXT_LOCALE`.
- **Adresses avec un point** (`/profil/jean.dupont`) : exclues par le `matcher` ; ajouter une entrée de `matcher` dédiée.
- **Liens qui perdent `/en`** : `next/link` et `redirect` de `next/navigation` ignorent la langue ; utiliser ceux de `@/i18n/navigation`.
- **Liens des e-mails, retour de Stripe, redirections des actions de la recette `connexion`** : ils visent les adresses françaises (sans préfixe), qui restent valides.

## Sources

- next-intl 4.14.9 : https://next-intl.dev/docs/routing/setup (source `docs/src/pages/docs/routing/setup.mdx` du dépôt amannn/next-intl : `next/root-params`, `setRequestLocale` ancien) ; `routing/middleware.mdx` (composition du proxy, `matcher`) ; `environments/actions-metadata-route-handlers.mdx` (actions : `getTranslations({ locale, namespace })`) ; code du paquet (chemin par défaut `./src/i18n/request.ts`, cookie `NEXT_LOCALE`)
- Next.js 16.4, documentation embarquée : `01-app/02-guides/internationalization.md` ; `01-app/03-api-reference/04-functions/next-root-params.md` (indisponible dans les actions et les Route Handlers ; `generateStaticParams` obligatoire avec Cache Components) ; `01-app/01-getting-started/16-proxy.md` ; `01-app/03-api-reference/03-file-conventions/not-found.md`
- better-auth 1.7.7 : `dist/cookies/index.d.mts` (`getSessionCookie`)
- Vérifications locales (squelette du pack + recettes `connexion`, `email`, `fichiers`, `paiement`, `limite`, puis cette recette) : `npm run typecheck`, `biome check`, Vitest et `next build` passent ; `next start` : `/` → 200 (`lang="fr"`), `/en` → 200 (`lang="en"`), `/fr` → 307 `/`, `/compte` → 307 `/connexion`, `/en/compte` et `/en/fichiers` → 307 `/en/connexion`, navigateur anglais sur `/` → 307 `/en`, `/compte` avec cookie de session → 200, adresse inconnue → 404

## Points à vérifier

- Le texte de la page 404 (« Page introuvable ») pour une adresse inconnue : la réponse est bien 404, mais son contenu se construit dans le navigateur ; à regarder une fois dans un vrai navigateur.
- Les tests de bout en bout (`e2e/langues.spec.ts`) : écrits et compilés, pas exécutés (pas de navigateur Playwright installé lors de la rédaction).
- Une redirection `redirect("/compte")` d'une action pour une personne qui a choisi l'anglais : next-intl devrait la renvoyer vers `/en/compte` grâce au cookie `NEXT_LOCALE` ; à constater.
- `NextIntlClientProvider` sans `messages` transmet tous les messages de la langue aux composants clients ; pour un gros fichier de messages, ne transmettre que les espaces de noms utiles.

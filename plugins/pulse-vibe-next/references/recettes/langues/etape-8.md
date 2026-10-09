### 8. Le layout racine

Version du squelette, complétée (lien d'évitement traduit et zone `#contenu` conservés) : langue validée, `generateStaticParams`, `lang` de la page, fournisseur des messages pour les composants clients, sélecteur de langue.

```tsx
// app/[locale]/layout.tsx
import { Toaster } from "@src/components/ui/sonner";
import { routing } from "@src/config/i18n";
import { projet } from "@src/config/projet";
import { adresseDuSite } from "@src/config/site";
import { ChoixLangueContainer } from "@src/features/langues/components/containers/choix-langue.container";
import { partageCommun } from "@src/lib/seo/seo";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations({ locale, namespace: "Accessibilite" });
  return (
    <html
      lang={locale}
      className={`${policeTexte.variable} ${policeCode.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Lien d'évitement du squelette, traduit : le premier arrêt au clavier mène au contenu. */}
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-3 focus:ring-ring"
        >
          {t("allerAuContenu")}
        </a>
        <NextIntlClientProvider>
          <NuqsAdapter>
            <header className="flex justify-end px-6 py-3">
              <ChoixLangueContainer />
            </header>
            <div
              id="contenu"
              tabIndex={-1}
              className="flex flex-1 flex-col outline-none"
            >
              {children}
            </div>
          </NuqsAdapter>
        </NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

Le sélecteur se découpe en deux (architecture §4). L'élément d'affichage reçoit tout par props : le nom de chaque langue, la langue courante, l'adresse de la page. Le container client lit la langue (`useLocale`), l'adresse (`usePathname`) et les textes (`useTranslations`) : seul un composant client connaît l'adresse courante, et le layout, qui reste un composant serveur prérendu, ne la connaît pas. Le container se range dans la feature `langues` (le layout est de `app/`, qui peut tout importer) ; l'élément reste dans `src/components/shared/elements/`.

```tsx
// src/components/shared/elements/choix-langue.tsx
import { Link } from "@src/lib/i18n/navigation";

type Props = {
  libelle: string;
  chemin: string;
  langueCourante: string;
  langues: { code: string; nom: string }[];
};

export function ChoixLangue({
  libelle,
  chemin,
  langueCourante,
  langues,
}: Props) {
  return (
    <nav aria-label={libelle} className="flex gap-3 text-sm">
      {langues.map(({ code, nom }) => (
        <Link
          key={code}
          href={chemin}
          locale={code}
          aria-current={code === langueCourante ? "true" : undefined}
          className={code === langueCourante ? "font-semibold" : "underline"}
        >
          {nom}
        </Link>
      ))}
    </nav>
  );
}
```

```tsx
// src/features/langues/components/containers/choix-langue.container.tsx
"use client";

import { ChoixLangue } from "@src/components/shared/elements/choix-langue";
import { routing } from "@src/config/i18n";
import { usePathname } from "@src/lib/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";

export function ChoixLangueContainer() {
  const t = useTranslations("ChoixLangue");
  const langueCourante = useLocale();
  const chemin = usePathname();
  return (
    <ChoixLangue
      libelle={t("libelle")}
      chemin={chemin}
      langueCourante={langueCourante}
      langues={routing.locales.map((code) => ({ code, nom: t(code) }))}
    />
  );
}
```


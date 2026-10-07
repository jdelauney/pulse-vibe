import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@src/components/ui/sonner";
import { projet } from "@src/config/projet";
import { partageCommun } from "@src/lib/seo/seo";
import { adresseDuSite } from "@src/config/site";
import "./globals.css";

// La variable porte le nom attendu par globals.css (--font-sans) : sans elle, le navigateur
// retombe sur sa police par défaut.
const policeTexte = Geist({ variable: "--font-sans", subsets: ["latin"] });
const policeCode = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Métadonnées communes. metadataBase complète les adresses relatives (adresse officielle, image de
// partage) ; chaque page publique ajoute les siennes avec metadonneesDePage() de src/lib/seo/seo.ts.
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${policeTexte.variable} ${policeCode.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NuqsAdapter>{children}</NuqsAdapter>
        <Toaster />
      </body>
    </html>
  );
}

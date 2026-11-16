import { Toaster } from "@src/components/ui/sonner";
import { projet } from "@src/config/projet";
import { adresseDuSite } from "@src/config/site";
import { partageCommun } from "@src/lib/seo/seo";
import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

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
    // Les polices sont servies par le site : app/polices.css (pulse-aidd pile police).
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/* Lien d'évitement : le premier élément atteint au clavier mène droit au contenu. */}
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-3 focus:ring-ring"
        >
          Aller au contenu
        </a>
        <div
          id="contenu"
          tabIndex={-1}
          className="flex flex-1 flex-col outline-none"
        >
          <NuqsAdapter>{children}</NuqsAdapter>
        </div>
        <Toaster />
      </body>
    </html>
  );
}

import type { Graph, Thing, WithContext } from "schema-dts";

export type DonneesStructurees = WithContext<Thing> | Graph;

/**
 * Données structurées d'une page (JSON-LD), lues par Google et par les assistants.
 * Le caractère « < » est échappé : un texte saisi ne peut pas fermer la balise (méthode de la
 * documentation Next.js). Construire les données avec src/lib/seo/donnees-structurees.ts.
 */
export function JsonLd({ donnees }: { donnees: DonneesStructurees }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON échappé, sans HTML saisi
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(donnees).replace(/</g, "\\u003c"),
      }}
    />
  );
}

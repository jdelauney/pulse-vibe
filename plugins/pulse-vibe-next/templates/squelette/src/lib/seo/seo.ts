import type { Metadata } from "next";
import { projet } from "@src/config/projet";

/** Champs de partage communs à toutes les pages. */
export const partageCommun = {
  siteName: projet.nom,
  locale: "fr_FR",
  type: "website",
} as const;

/** L'image de partage du site, produite par app/opengraph-image.tsx. */
export const imageDePartage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: projet.nom,
};

type PagePublique = {
  /** Titre propre à la page ; le layout ajoute « | Nom du site ». */
  titre: string;
  /** Une ou deux phrases utiles, propres à la page (docs/seo.md). */
  description: string;
  /** Chemin de la page, qui devient son adresse officielle : "/tarifs". */
  chemin: string;
  /** Image de partage propre à la page ; sinon celle du site. */
  image?: { url: string; width: number; height: number; alt: string };
  /** Accueil : titre affiché tel quel, sans le nom du site ajouté. */
  accueil?: boolean;
};

/**
 * Les métadonnées d'une page publique : titre, description, adresse officielle et carte de partage complète.
 * Next.js remplace tout l'openGraph du layout dès qu'une page en définit un : cette fonction le
 * reconstruit donc en entier (nom du site, langue, image), pour qu'aucune page ne perde son image.
 */
export function metadonneesDePage({
  titre,
  description,
  chemin,
  image = imageDePartage,
  accueil = false,
}: PagePublique): Metadata {
  return {
    title: accueil ? { absolute: titre } : titre,
    description,
    alternates: { canonical: chemin },
    openGraph: {
      ...partageCommun,
      title: accueil ? titre : `${titre} | ${projet.nom}`,
      description,
      url: chemin,
      images: [image],
    },
  };
}

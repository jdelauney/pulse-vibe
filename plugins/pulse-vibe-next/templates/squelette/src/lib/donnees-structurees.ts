import type {
  BreadcrumbList,
  LocalBusiness,
  Organization,
  WebSite,
  WithContext,
} from "schema-dts";

// Données structurées (schema.org) : les types de schema-dts vérifient les noms et la forme ;
// ces fonctions rendent obligatoires, par leurs paramètres, les propriétés exigées par Google.
// Le Rich Results Test reste la preuve d'éligibilité (search.google.com/test/rich-results).

/** Le nom du site dans Google : à placer sur la page d'accueil seulement. */
export function siteWeb(p: {
  nom: string;
  adresse: string;
  autresNoms?: string[];
}): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: p.nom,
    url: p.adresse,
    alternateName: p.autresNoms,
  };
}

/** L'organisation (accueil ou « À propos ») : logo carré d'au moins 112 pixels, lisible sur fond blanc. */
export function organisation(p: {
  nom: string;
  adresse: string;
  logo: string;
  reseaux?: string[];
}): WithContext<Organization> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: p.nom,
    url: p.adresse,
    logo: p.logo,
    sameAs: p.reseaux,
  };
}

/** Un commerce avec une adresse physique : Google exige le nom et l'adresse, affichés sur la page. */
export function commerceLocal(p: {
  nom: string;
  adresse: string;
  rue: string;
  codePostal: string;
  ville: string;
  pays: string;
  telephone?: string;
}): WithContext<LocalBusiness> {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: p.nom,
    url: p.adresse,
    telephone: p.telephone,
    address: {
      "@type": "PostalAddress",
      streetAddress: p.rue,
      postalCode: p.codePostal,
      addressLocality: p.ville,
      addressCountry: p.pays,
    },
  };
}

type Etape = { nom: string; adresse: string };

/** Fil d'Ariane : au moins deux étapes (exigence de Google, imposée par le type), adresses complètes. */
export function filDAriane(
  etapes: [Etape, Etape, ...Etape[]],
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: etapes.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.nom,
      item: e.adresse,
    })),
  };
}

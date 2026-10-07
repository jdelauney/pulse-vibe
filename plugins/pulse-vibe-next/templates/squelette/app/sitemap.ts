import type { MetadataRoute } from "next";
import { adresseDuSite } from "@src/config/site";

// Les pages publiques, chacune par son adresse officielle. Ajouter ici chaque nouvelle page publique ;
// des contenus publiés en base se lisent avec une fonction "use cache" (recette seo).
// misAJourLe : seulement une vraie date de modification du contenu, jamais la date du jour.
// Google ignore priority et changeFrequency : inutile de les remplir.
const PAGES_PUBLIQUES: { chemin: string; misAJourLe?: Date }[] = [
  { chemin: "/" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const adresse = adresseDuSite();
  return PAGES_PUBLIQUES.map(({ chemin, misAJourLe }) => ({
    url: chemin === "/" ? adresse : `${adresse}${chemin}`,
    ...(misAJourLe ? { lastModified: misAJourLe } : {}),
  }));
}

### 1. Le layout racine

`metadataBase` complète les adresses relatives (adresse officielle, image de partage) ; le modèle de titre ajoute le nom du site aux pages enfants (déjà dans le squelette).

```tsx
// app/layout.tsx (extrait : imports et metadata)
import { projet } from "@src/config/projet";
import { adresseDuSite } from "@src/config/site";
import { partageCommun } from "@src/lib/seo/seo";

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
```


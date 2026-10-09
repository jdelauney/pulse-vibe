### 2. L'accueil

Titre affiché tel quel (le modèle ne s'applique pas au segment qui le définit), nom du site pour Google.

```tsx
// app/page.tsx
import { JsonLd } from "@src/components/shared/elements/json-ld";
import { projet } from "@src/config/projet";
import { adresseDuSite } from "@src/config/site";
import { siteWeb } from "@src/lib/seo/donnees-structurees";
import { metadonneesDePage } from "@src/lib/seo/seo";
import type { Metadata } from "next";

export const metadata: Metadata = metadonneesDePage({
  titre: projet.nom,
  description: projet.description,
  chemin: "/",
  accueil: true,
});

export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <JsonLd
        donnees={siteWeb({ nom: projet.nom, adresse: adresseDuSite() })}
      />
      {/* … contenu de l'accueil … */}
    </main>
  );
}
```

Pour un commerce avec une adresse physique, ajouter sur l'accueil ou la page « À propos » `<JsonLd donnees={commerceLocal({ … })} />`, avec les informations **affichées** sur la page. Sinon, `organisation({ nom, adresse, logo })` (logo carré d'au moins 112 pixels).


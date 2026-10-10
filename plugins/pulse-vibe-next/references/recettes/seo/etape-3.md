### 3. Chaque page publique

Les pages publiques vivent dans `app/(public)/` ; les métadonnées de chaque page passent par `metadonneesDePage()`. Les pages d'authentification font exception : fiche, règle 47.

<!-- fichier: app/(public)/tarifs/page.tsx -->
```tsx
// app/(public)/tarifs/page.tsx
import { metadonneesDePage } from "@src/lib/seo/seo";
import type { Metadata } from "next";

// Textes validés dans docs/seo.md
export const metadata: Metadata = metadonneesDePage({
  titre: "Tarifs",
  description: "Nos tarifs de réparation, sur devis gratuit sous 48 heures.",
  chemin: "/tarifs",
});

export default function Tarifs() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-3xl font-semibold">Tarifs</h1>
    </main>
  );
}
```

Puis ajouter la page à `PAGES_PUBLIQUES` de `app/sitemap.ts` (`{ chemin: "/tarifs" }`). Les pages d'authentification font exception : fiche, règle 47. Une page qui a sa propre image de partage la passe en `image` (`{ url, width: 1200, height: 630, alt }`).


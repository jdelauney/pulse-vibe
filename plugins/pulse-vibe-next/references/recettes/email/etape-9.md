### 9. Les deux nouvelles pages

<!-- fichier: app/(public)/mot-de-passe-oublie/page.tsx -->
```tsx
// app/(public)/mot-de-passe-oublie/page.tsx
import { MotDePasseOublieContainer } from "@src/features/compte/components/containers/mot-de-passe-oublie.container";
import type { Metadata } from "next";

// Page d'authentification : hors de Google (fiche, règle 47).
export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

export default function PageMotDePasseOublie() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-2 text-2xl font-semibold">Mot de passe oublié</h1>
      <p className="mb-6 text-muted-foreground">
        Indiquez votre adresse : vous recevrez un lien pour choisir un nouveau
        mot de passe.
      </p>
      <MotDePasseOublieContainer />
    </main>
  );
}
```

<!-- fichier: app/(public)/nouveau-mot-de-passe/page.tsx -->
```tsx
// app/(public)/nouveau-mot-de-passe/page.tsx
import { LienMotDePasseContainer } from "@src/features/compte/components/containers/lien-mot-de-passe.container";
import type { Metadata } from "next";
import { Suspense } from "react";

// Page d'authentification : hors de Google (fiche, règle 47).
export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

// Le titre fait partie de la coquille statique ; la lecture de l'adresse vit sous Suspense.
export default function PageNouveauMotDePasse({
  searchParams,
}: PageProps<"/nouveau-mot-de-passe">) {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">Nouveau mot de passe</h1>
      <Suspense fallback={<p className="text-muted-foreground">Chargement…</p>}>
        <LienMotDePasseContainer searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
```


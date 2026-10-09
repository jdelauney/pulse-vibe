### 11. Les pages

<!-- fichier: app/(public)/inscription/page.tsx -->
```tsx
// app/(public)/inscription/page.tsx
import { InscriptionContainer } from "@src/features/compte/components/containers/inscription.container";
import type { Metadata } from "next";

// Page d'authentification : hors de Google (fiche, règle 47).
export const metadata: Metadata = {
  title: "Créer un compte",
  robots: { index: false, follow: false },
};

export default function PageInscription() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">Créer un compte</h1>
      <InscriptionContainer />
    </main>
  );
}
```

<!-- fichier: app/(public)/connexion/page.tsx -->
```tsx
// app/(public)/connexion/page.tsx
import { ConnexionContainer } from "@src/features/compte/components/containers/connexion.container";
import type { Metadata } from "next";

// Page d'authentification : hors de Google (fiche, règle 47).
export const metadata: Metadata = {
  title: "Se connecter",
  robots: { index: false, follow: false },
};

export default function PageConnexion() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">Se connecter</h1>
      <ConnexionContainer />
    </main>
  );
}
```

<!-- fichier: app/(connecte)/layout.tsx -->
```tsx
// app/(connecte)/layout.tsx
import type { Metadata } from "next";

// Pages réservées aux personnes connectées : hors de Google.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LayoutConnecte({ children }: LayoutProps<"/">) {
  return children;
}
```

<!-- fichier: app/(connecte)/compte/page.tsx -->
```tsx
// app/(connecte)/compte/page.tsx
import { CompteContainer } from "@src/features/compte/components/containers/compte.container";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Mon compte" };

export default function PageCompte() {
  return (
    <main className="mx-auto max-w-sm space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Mon compte</h1>
      <Suspense fallback={<p className="text-muted-foreground">Chargement…</p>}>
        <CompteContainer />
      </Suspense>
    </main>
  );
}
```

Chaque nouvelle page connectée suit ce modèle : page synchrone, lecture de `utilisateurConnecte()` dans un container sous `<Suspense>`.


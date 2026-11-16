### 9. Les nouvelles pages publiques

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

La page d'arrivée des liens de confirmation : better-auth y renvoie après le clic (`callbackURL`), avec `?error=…` si le lien a expiré ou ne vaut rien. Le lien confirme l'adresse sans ouvrir de session : la page invite à se connecter.

<!-- fichier: src/features/compte/components/containers/adresse-verifiee.container.tsx -->
```tsx
// src/features/compte/components/containers/adresse-verifiee.container.tsx
import Link from "next/link";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// better-auth renvoie ici après le lien de confirmation : sans paramètre (adresse vérifiée) ou avec ?error=….
export async function AdresseVerifieeContainer({ searchParams }: Props) {
  const { error } = await searchParams;
  if (error) {
    return (
      <p>
        Ce lien n'est plus valable. Connectez-vous : si votre adresse n'est pas
        encore confirmée, un nouveau lien part aussitôt.{" "}
        <Link href="/connexion" className="underline">
          Se connecter
        </Link>
      </p>
    );
  }
  return (
    <p role="status">
      Adresse vérifiée, vous pouvez vous connecter.{" "}
      <Link href="/connexion" className="underline">
        Se connecter
      </Link>
    </p>
  );
}
```

<!-- fichier: app/(public)/adresse-verifiee/page.tsx -->
```tsx
// app/(public)/adresse-verifiee/page.tsx
import { AdresseVerifieeContainer } from "@src/features/compte/components/containers/adresse-verifiee.container";
import type { Metadata } from "next";
import { Suspense } from "react";

// Page d'authentification : hors de Google (fiche, règle 47).
export const metadata: Metadata = {
  title: "Adresse e-mail",
  robots: { index: false, follow: false },
};

export default function PageAdresseVerifiee({
  searchParams,
}: PageProps<"/adresse-verifiee">) {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">Adresse e-mail</h1>
      <Suspense fallback={<p className="text-muted-foreground">Chargement…</p>}>
        <AdresseVerifieeContainer searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
```

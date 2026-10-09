### 11. La page, le chargement et l'erreur

Avec Cache Components, tout ce qui lit la requête (session, `searchParams`) ou la base sans cache se place **sous `<Suspense>`**. La page elle-même reste synchrone : elle passe la promesse `searchParams` au container sans l'attendre. Le titre, le formulaire et les squelettes partent tout de suite ; la liste arrive ensuite. La recette n'utilise pas `loading.tsx` : la documentation recommande `<Suspense>` au plus près de la lecture.

<!-- fichier: app/(connecte)/factures/page.tsx -->
```tsx
// app/(connecte)/factures/page.tsx
import { Skeleton } from "@src/components/ui/skeleton";
import { CreationFactureContainer } from "@src/features/factures/components/containers/creation-facture.container";
import { FiltresFacturesContainer } from "@src/features/factures/components/containers/filtres-factures.container";
import { ListeFacturesContainer } from "@src/features/factures/components/containers/liste-factures.container";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Mes factures" };

export default function PageFactures(props: PageProps<"/factures">) {
  return (
    <main className="mx-auto max-w-4xl space-y-10 p-6">
      <h1 className="text-2xl font-semibold">Mes factures</h1>

      <section aria-labelledby="titre-nouvelle-facture" className="space-y-4">
        <h2 id="titre-nouvelle-facture" className="text-lg font-medium">
          Nouvelle facture
        </h2>
        <CreationFactureContainer />
      </section>

      <section aria-labelledby="titre-liste-factures" className="space-y-4">
        <h2 id="titre-liste-factures" className="text-lg font-medium">
          Liste
        </h2>
        <Suspense fallback={<Skeleton className="h-16 w-full" />}>
          <FiltresFacturesContainer />
        </Suspense>
        <Suspense fallback={<SqueletteListe />}>
          <ListeFacturesContainer searchParams={props.searchParams} />
        </Suspense>
      </section>
    </main>
  );
}

function SqueletteListe() {
  return (
    <div className="space-y-2" aria-busy="true">
      <p className="sr-only">Chargement des factures…</p>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
```

<!-- fichier: app/(connecte)/factures/error.tsx -->
```tsx
// app/(connecte)/factures/error.tsx
"use client";

import { Button } from "@src/components/ui/button";
import { useEffect } from "react";

export default function ErreurFactures({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-4xl space-y-4 p-6">
      <h2 className="text-lg font-medium">
        Les factures n'ont pas pu être chargées.
      </h2>
      <p className="text-muted-foreground">
        Vérifiez votre connexion, puis réessayez.
      </p>
      <Button type="button" onClick={() => retry()}>
        Réessayer
      </Button>
    </div>
  );
}
```

Ajoutez enfin l'adresse de la page au `matcher` de `proxy.ts` (racine du projet, recette `connexion`) :

<!-- remplacer: proxy.ts -->
```ts
export const config = {
  // Une ligne par page du groupe (connecte) : les groupes de routes n'apparaissent pas dans l'adresse.
  matcher: ["/compte/:path*", "/factures/:path*"],
};
```

Avec la recette `langues` : voir `connexion`, étape 12.


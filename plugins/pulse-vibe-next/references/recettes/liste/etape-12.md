### 12. Quand utiliser TanStack Query ou Zustand

**Par défaut, ni l'un ni l'autre.** La liste se lit dans le container serveur, l'état partageable vit dans l'adresse (nuqs), et l'écriture passe par une action suivie de `refresh()`.

- **TanStack Query** : pour une donnée qui se met à jour **seule, sans navigation** dans un écran très interactif (rafraîchissement régulier, défilement infini, autocomplétion). Il lit une route API (Route Handler) qui vérifie la session.
- **Zustand** : pour un état d'interface **partagé entre composants clients sans lien parent** (panneau ouvert, panier non enregistré). Une donnée de la base ou un filtre partageable n'y va pas : la base reste la source, l'adresse garde les filtres.

Mini-exemple TanStack Query : le total impayé, rafraîchi toutes les 30 secondes. Installez d'abord le paquet : `npm install @tanstack/react-query` (dernière version ; vérifié avec 5.104.1). Le fournisseur va dans `src/providers/`.

<!-- sans-verification: exemple facultatif, hors chaîne -->
```tsx
// src/providers/tanstack-query.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

let clientNavigateur: QueryClient | undefined;

function getQueryClient() {
  // Un client neuf par rendu serveur, un seul client réutilisé dans le navigateur.
  if (typeof window === "undefined") return new QueryClient();
  clientNavigateur ??= new QueryClient();
  return clientNavigateur;
}

export function TanstackQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
```

<!-- sans-verification: exemple facultatif, hors chaîne -->
```tsx
// app/(connecte)/factures/layout.tsx
import { TanstackQueryProvider } from "@src/providers/tanstack-query";

export default function Layout({ children }: LayoutProps<"/factures">) {
  return <TanstackQueryProvider>{children}</TanstackQueryProvider>;
}
```

Ajoutez cette méthode à l'objet renvoyé par `factureRepository` (`src/db/factures/facture.repository.ts`), et `ne`, `sql` à son import de `"drizzle-orm"` :

<!-- sans-verification: exemple facultatif, hors chaîne -->
```ts
    async totalImpaye(utilisateurId: string): Promise<number> {
      const [ligne] = await db
        .select({
          total:
            sql<number>`coalesce(sum(${factures.montantCentimes}), 0)`.mapWith(
              Number,
            ),
        })
        .from(factures)
        .where(
          and(
            eq(factures.utilisateurId, utilisateurId),
            ne(factures.statut, "payee"),
          ),
        );
      return ligne?.total ?? 0;
    },
```

<!-- sans-verification: exemple facultatif, hors chaîne -->
```ts
// src/features/factures/queries/total-impaye.query.ts
import "server-only";
import { getDb } from "@src/db/db-client";
import { factureRepository } from "@src/db/factures/facture.repository";

export async function totalImpaye(utilisateurId: string): Promise<number> {
  return factureRepository(getDb()).totalImpaye(utilisateurId);
}
```

<!-- sans-verification: exemple facultatif, hors chaîne -->
```ts
// app/api/factures/total-impaye/route.ts
import { getAuth } from "@src/adapters/auth/auth.adapter";
import { totalImpaye } from "@src/features/factures/queries/total-impaye.query";

export async function GET(request: Request) {
  // La requête est lue avant getAuth() : la route est rendue à la demande, jamais pré-rendue.
  const enTetes = request.headers;
  const session = await getAuth().api.getSession({ headers: enTetes });
  if (!session) {
    return Response.json({ message: "Connexion requise." }, { status: 401 });
  }
  return Response.json({ totalCentimes: await totalImpaye(session.user.id) });
}
```

<!-- sans-verification: exemple facultatif, hors chaîne -->
```tsx
// src/features/factures/components/containers/total-impaye.container.tsx
"use client";

import { formaterMontant } from "@src/lib/helpers/format/format";
import { useQuery } from "@tanstack/react-query";

async function chargerTotalImpaye(): Promise<{ totalCentimes: number }> {
  const reponse = await fetch("/api/factures/total-impaye");
  if (!reponse.ok) throw new Error("Total impayé indisponible");
  return reponse.json();
}

export function TotalImpayeContainer() {
  const { data, error, isPending } = useQuery({
    queryKey: ["factures", "total-impaye"],
    queryFn: chargerTotalImpaye,
    refetchInterval: 30_000,
  });

  if (error) return <p>Le total impayé est indisponible pour le moment.</p>;
  if (isPending) return <p>Calcul du total impayé…</p>;
  return <p>Total impayé : {formaterMontant(data.totalCentimes)}</p>;
}
```

Dans la page, placez `<TotalImpayeContainer />` dans son propre `<Suspense fallback={<Skeleton className="h-6 w-48" />}>` : avec Cache Components, Next.js pré-rend aussi les composants clients, et TanStack Query lit l'heure courante.

Mini-exemple Zustand : un panneau d'aide ouvert depuis l'en-tête et fermé depuis le panneau. Le magasin se crée **dans un fournisseur**, une fois par rendu, jamais en variable globale. Installez d'abord le paquet : `npm install zustand` (dernière version ; vérifié avec 5.0.15). Le magasin va dans `src/stores/`, son fournisseur dans `src/providers/`.

<!-- sans-verification: exemple facultatif, hors chaîne -->
```ts
// src/stores/panneau.store.ts
import { createStore } from "zustand/vanilla";

export type PanneauStore = {
  ouvert: boolean;
  ouvrir: () => void;
  fermer: () => void;
};

export const creerPanneauStore = () =>
  createStore<PanneauStore>()((set) => ({
    ouvert: false,
    ouvrir: () => set({ ouvert: true }),
    fermer: () => set({ ouvert: false }),
  }));
```

<!-- sans-verification: exemple facultatif, hors chaîne -->
```tsx
// src/providers/panneau.tsx
"use client";

import {
  creerPanneauStore,
  type PanneauStore,
} from "@src/stores/panneau.store";
import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";

type PanneauStoreApi = ReturnType<typeof creerPanneauStore>;
const PanneauContext = createContext<PanneauStoreApi | undefined>(undefined);

export function PanneauProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => creerPanneauStore());
  return (
    <PanneauContext.Provider value={store}>{children}</PanneauContext.Provider>
  );
}

export function usePanneau<T>(selecteur: (etat: PanneauStore) => T): T {
  const store = useContext(PanneauContext);
  if (!store) throw new Error("usePanneau s'utilise dans un PanneauProvider.");
  return useStore(store, selecteur);
}
```

Usage dans un container client : `const ouvrir = usePanneau((etat) => etat.ouvrir);`, puis `ouvrir` passé en prop à la section. Les composants serveur ne lisent pas ce magasin.


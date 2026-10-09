### 9. Les contrôles de filtre et de pagination (containers client)

Ils lisent et écrivent l'état de l'adresse (`useQueryStates`) : ce sont des containers. `shallow: false` demande au serveur de refaire la liste à chaque changement d'adresse. `startTransition` donne l'indicateur « Mise à jour… ». Chaque changement de filtre ramène à la page 1.

<!-- fichier: src/features/factures/components/containers/filtres-factures.container.tsx -->
```tsx
// src/features/factures/components/containers/filtres-factures.container.tsx
"use client";

import { Button } from "@src/components/ui/button";
import { Field, FieldLabel } from "@src/components/ui/field";
import { Input } from "@src/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@src/components/ui/native-select";
import { TRIS_FACTURES } from "@src/core/factures/facture.entity";
import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";
import {
  FILTRES_STATUT,
  LIBELLES_STATUT,
  LIBELLES_TRI,
} from "../../constants/factures";
import { filtresFactures } from "../../schemas/filtres.schema";

export function FiltresFacturesContainer() {
  const [miseAJour, startTransition] = useTransition();
  const [filtres, setFiltres] = useQueryStates(filtresFactures, {
    shallow: false,
    startTransition,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
      <Field>
        <FieldLabel htmlFor="recherche-client">Rechercher un client</FieldLabel>
        <Input
          id="recherche-client"
          type="search"
          value={filtres.recherche}
          onChange={(e) =>
            setFiltres(
              { recherche: e.target.value, page: 1 },
              { limitUrlUpdates: debounce(300) },
            )
          }
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="filtre-statut">Statut</FieldLabel>
        <NativeSelect
          id="filtre-statut"
          value={filtres.statut}
          onChange={(e) =>
            setFiltres({
              statut:
                FILTRES_STATUT.find((s) => s === e.target.value) ?? "tous",
              page: 1,
            })
          }
        >
          <NativeSelectOption value="tous">Tous</NativeSelectOption>
          {FILTRES_STATUT.filter((s) => s !== "tous").map((statut) => (
            <NativeSelectOption key={statut} value={statut}>
              {LIBELLES_STATUT[statut]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel htmlFor="tri">Trier par</FieldLabel>
        <NativeSelect
          id="tri"
          value={filtres.tri}
          onChange={(e) =>
            setFiltres({
              tri:
                TRIS_FACTURES.find((t) => t === e.target.value) ?? "recentes",
              page: 1,
            })
          }
        >
          {TRIS_FACTURES.map((tri) => (
            <NativeSelectOption key={tri} value={tri}>
              {LIBELLES_TRI[tri]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Button type="button" variant="outline" onClick={() => setFiltres(null)}>
        Effacer les filtres
      </Button>

      <p
        aria-live="polite"
        className="text-sm text-muted-foreground sm:col-span-4"
      >
        {miseAJour ? "Mise à jour…" : ""}
      </p>
    </div>
  );
}
```

<!-- fichier: src/features/factures/components/containers/pagination-factures.container.tsx -->
```tsx
// src/features/factures/components/containers/pagination-factures.container.tsx
"use client";

import { Button } from "@src/components/ui/button";
import { pageValide } from "@src/lib/helpers/pagination/pagination";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { filtresFactures } from "../../schemas/filtres.schema";

export function PaginationFacturesContainer({
  nombreDePages,
}: {
  nombreDePages: number;
}) {
  const [miseAJour, startTransition] = useTransition();
  const [filtres, setFiltres] = useQueryStates(filtresFactures, {
    shallow: false,
    startTransition,
  });
  const page = pageValide(filtres.page);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4"
    >
      <Button
        type="button"
        variant="outline"
        disabled={page <= 1 || miseAJour}
        onClick={() => setFiltres({ page: page - 1 })}
      >
        Page précédente
      </Button>
      <p className="text-sm text-muted-foreground">
        Page {page} sur {nombreDePages}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={page >= nombreDePages || miseAJour}
        onClick={() => setFiltres({ page: page + 1 })}
      >
        Page suivante
      </Button>
    </nav>
  );
}
```


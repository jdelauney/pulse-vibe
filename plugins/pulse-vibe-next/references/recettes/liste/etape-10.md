### 10. La liste : container serveur et tableau

Le tableau est une section : il affiche ce qu'il reçoit, y compris les deux états vides (aucune facture, aucune facture pour ces filtres) et la page vide.

<!-- fichier: src/features/factures/components/sections/tableau-factures.tsx -->
```tsx
// src/features/factures/components/sections/tableau-factures.tsx
import { Badge } from "@src/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@src/components/ui/table";
import type { Facture, StatutFacture } from "@src/core/factures/facture.entity";
import { formaterDate, formaterMontant } from "@src/lib/helpers/format/format";
import { LIBELLES_STATUT } from "../../constants/factures";

const VARIANTE_STATUT: Record<
  StatutFacture,
  "outline" | "secondary" | "default"
> = {
  brouillon: "outline",
  envoyee: "secondary",
  payee: "default",
};

type Props = {
  factures: Facture[];
  total: number;
  filtresActifs: boolean;
};

export function TableauFactures({ factures, total, filtresActifs }: Props) {
  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-medium">
          {filtresActifs
            ? "Aucune facture ne correspond à ces filtres."
            : "Vous n'avez pas encore de facture."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtresActifs
            ? "Modifiez la recherche ou cliquez sur « Effacer les filtres »."
            : "Créez la première avec le formulaire ci-dessus."}
        </p>
      </div>
    );
  }

  const nombre = (
    <p className="text-sm text-muted-foreground">
      {total} facture{total > 1 ? "s" : ""}
    </p>
  );

  if (factures.length === 0) {
    return (
      <>
        {nombre}
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Cette page est vide. Revenez à la page précédente.
        </p>
      </>
    );
  }

  return (
    <>
      {nombre}
      <Table>
        <TableCaption className="sr-only">Mes factures</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Créée le</TableHead>
            <TableHead className="text-right">Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {factures.map((facture) => (
            <TableRow key={facture.id}>
              <TableCell className="font-medium">{facture.client}</TableCell>
              <TableCell>
                <Badge variant={VARIANTE_STATUT[facture.statut]}>
                  {LIBELLES_STATUT[facture.statut]}
                </Badge>
              </TableCell>
              <TableCell>{formaterDate(facture.creeLe)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formaterMontant(facture.montantCentimes)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
```

Le container serveur lit la session, les filtres et la liste, puis compose le tableau et le container de pagination (un container peut rendre d'autres containers de sa feature, architecture.md §4).

<!-- fichier: src/features/factures/components/containers/liste-factures.container.tsx -->
```tsx
// src/features/factures/components/containers/liste-factures.container.tsx
import { utilisateurConnecte } from "@src/features/compte/queries/utilisateur-connecte.query";
import { nombreDePages } from "@src/lib/helpers/pagination/pagination";
import { TAILLE_PAGE } from "../../constants/factures";
import { listerFactures } from "../../queries/lister-factures.query";
import { chargerFiltresFactures } from "../../schemas/filtres.schema";
import { TableauFactures } from "../sections/tableau-factures";
import { PaginationFacturesContainer } from "./pagination-factures.container";

export async function ListeFacturesContainer({
  searchParams,
}: {
  searchParams: PageProps<"/factures">["searchParams"];
}) {
  const utilisateur = await utilisateurConnecte();
  const filtres = await chargerFiltresFactures(searchParams);
  const { factures, total } = await listerFactures(utilisateur.id, filtres);
  const filtresActifs =
    filtres.statut !== "tous" || filtres.recherche.trim() !== "";

  return (
    <div className="space-y-4">
      <TableauFactures
        factures={factures}
        total={total}
        filtresActifs={filtresActifs}
      />
      {total > 0 && (
        <PaginationFacturesContainer
          nombreDePages={nombreDePages(total, TAILLE_PAGE)}
        />
      )}
    </div>
  );
}
```


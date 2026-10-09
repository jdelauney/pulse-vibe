### 9. Les écrans

La lecture de la commande passe par une query. Le statut vient de la base, jamais de l'arrivée sur la page.

<!-- fichier: src/features/paiement/queries/commande-par-session.query.ts -->
```ts
// src/features/paiement/queries/commande-par-session.query.ts
import "server-only";
import { getDb } from "@src/db/db-client";
import { commandeRepository } from "@src/db/paiement/commande.repository";

/** La commande de cette personne pour cette session de paiement, ou null (inconnue, ou à quelqu'un d'autre). */
export async function commandeParSession(
  sessionId: string,
  utilisateurId: string,
) {
  return commandeRepository(getDb()).trouverParSession(
    sessionId,
    utilisateurId,
  );
}
```

Les sections affichent ce qu'elles reçoivent en props. Le container (client) appelle `useAction` pour l'action `payerAction`. En cas de succès, l'action redirige vers la page de paiement de Stripe : `hasNavigated` garde le bouton bloqué pendant le départ.

<!-- fichier: src/features/paiement/components/sections/bouton-payer.tsx -->
```tsx
// src/features/paiement/components/sections/bouton-payer.tsx
import { Button } from "@src/components/ui/button";

type Props = {
  libelle: string;
  payer: () => void;
  enCours: boolean;
  erreur?: string;
};

export function BoutonPayer({ libelle, payer, enCours, erreur }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" disabled={enCours} onClick={payer}>
        {enCours ? "Redirection vers le paiement…" : libelle}
      </Button>
      <p aria-live="polite" className="text-sm text-destructive">
        {erreur}
      </p>
    </div>
  );
}
```

<!-- fichier: src/features/paiement/components/containers/bouton-payer.container.tsx -->
```tsx
// src/features/paiement/components/containers/bouton-payer.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { payerAction } from "../../actions/payer.action";
import { BoutonPayer } from "../sections/bouton-payer";

export function BoutonPayerContainer({ libelle }: { libelle: string }) {
  const { execute, result, isPending, hasNavigated } = useAction(payerAction);
  return (
    <BoutonPayer
      libelle={libelle}
      // En cas de succès, l'action redirige vers la page de paiement de Stripe.
      payer={() => execute()}
      enCours={isPending || hasNavigated}
      erreur={result.serverError}
    />
  );
}
```

<!-- fichier: src/features/paiement/components/sections/statut-paiement.tsx -->
```tsx
// src/features/paiement/components/sections/statut-paiement.tsx
import type { StatutCommande } from "@src/core/paiement/commande.entity";
import Link from "next/link";

type Props = {
  commande: { libelle: string; statut: StatutCommande } | null;
  /** Adresse de la page « Merci » de cette commande, pour revérifier le paiement. */
  adresseActualiser?: string;
};

export function StatutPaiement({ commande, adresseActualiser }: Props) {
  if (!commande) {
    return <p>Commande introuvable.</p>;
  }
  if (commande.statut === "payee") {
    return <p>Paiement reçu : « {commande.libelle} » est activé.</p>;
  }
  return (
    <p>
      Paiement en cours de confirmation.{" "}
      {adresseActualiser && (
        <Link href={adresseActualiser} className="underline">
          Actualiser
        </Link>
      )}
    </p>
  );
}
```

Le container de la page « Merci » lit la session et la commande de la personne connectée.

<!-- fichier: src/features/paiement/components/containers/statut-paiement.container.tsx -->
```tsx
// src/features/paiement/components/containers/statut-paiement.container.tsx
import { utilisateurConnecte } from "@src/features/compte/queries/utilisateur-connecte.query";
import { commandeParSession } from "../../queries/commande-par-session.query";
import { StatutPaiement } from "../sections/statut-paiement";

export async function StatutPaiementContainer({
  searchParams,
}: {
  searchParams: PageProps<"/paiement/merci">["searchParams"];
}) {
  const utilisateur = await utilisateurConnecte();
  const { session_id: sessionId } = await searchParams;
  if (typeof sessionId !== "string") {
    return <StatutPaiement commande={null} />;
  }
  const commande = await commandeParSession(sessionId, utilisateur.id);
  return (
    <StatutPaiement
      commande={commande}
      adresseActualiser={`/paiement/merci?session_id=${encodeURIComponent(sessionId)}`}
    />
  );
}
```

Les pages restent fines : elles rendent les containers, celui qui lit des données sous `<Suspense>`. `formaterMontant` vient de `src/lib/helpers/format/format.ts` (recette `liste`) ; sans cette recette, créez ce fichier :

<!-- fichier: src/lib/helpers/format/format.ts -->
```ts
// src/lib/helpers/format/format.ts
const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function formaterMontant(centimes: number): string {
  return formatEuros.format(centimes / 100);
}
```

<!-- fichier: app/(connecte)/paiement/page.tsx -->
```tsx
// app/(connecte)/paiement/page.tsx
import { BoutonPayerContainer } from "@src/features/paiement/components/containers/bouton-payer.container";
import { OFFRE } from "@src/features/paiement/constants/offre";
import { formaterMontant } from "@src/lib/helpers/format/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Paiement" };

export default function PagePaiement() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">{OFFRE.libelle}</h1>
      <p>Prix : {formaterMontant(OFFRE.montantCentimes)}, paiement unique.</p>
      <BoutonPayerContainer
        libelle={`Payer ${formaterMontant(OFFRE.montantCentimes)}`}
      />
    </main>
  );
}
```

<!-- fichier: app/(connecte)/paiement/merci/page.tsx -->
```tsx
// app/(connecte)/paiement/merci/page.tsx
import { StatutPaiementContainer } from "@src/features/paiement/components/containers/statut-paiement.container";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Merci" };

export default function PageMerci({
  searchParams,
}: PageProps<"/paiement/merci">) {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Merci</h1>
      <Suspense fallback={<p>Vérification du paiement…</p>}>
        <StatutPaiementContainer searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
```

